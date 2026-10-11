/**
 * La reprise de l'XP et de la série, et l'état d'activité qui s'ensuit.
 *
 * ## Le socle, encore une fois
 *
 * La migration FSRS avait déjà posé le mot : un **socle** est un état repris
 * tel quel, faute de pouvoir être recalculé. Le problème est le même ici. L'XP
 * du site a été attribuée au fil de cinq mois, à neuf endroits, parfois sur des
 * données qui n'ont pas été conservées — les convergences de Veridical Mapping,
 * les cartes notées avant le journal de révisions. Rejouer l'historique sous
 * les règles d'aujourd'hui donnerait **un autre nombre**, et aucun des deux ne
 * serait plus vrai que l'autre : celui affiché a été vu tous les jours, celui
 * recalculé est incomplet.
 *
 * La décision 2 tranche donc : **convertir sans recalculer**. Le total affiché
 * devient le socle, daté, et tout ce qui vient après est calculé par le moteur
 * d'activité à partir des faits. L'écart entre les deux nombres est mesuré et
 * conservé dans le socle, pour que personne n'ait à le redécouvrir.
 *
 * ## La série repart de zéro, et le record est gardé
 *
 * Même décision, deuxième question. Demain, un jour compte si l'on a fait
 * quelque chose — réviser, s'entraîner, tenir un check-in — là où il ne
 * comptait que si l'on avait révisé. Le compteur change donc de sens, et un
 * « 240 jours » qui signifierait « 180 jours de révision puis 60 jours de vie »
 * ne voudrait plus rien dire. La série repart à zéro, le record reste visible,
 * et la valeur d'avant est écrite dans le socle plutôt que perdue.
 *
 * ## Rien ne se fait en silence
 *
 * La reprise n'est pas automatique. Elle remet une série visible à zéro : la
 * déclencher au chargement d'une page, sans que personne l'ait demandée, serait
 * exactement la mauvaise façon de tenir une décision prise par écrit. L'écran
 * dit ce qu'elle va faire, la personne la demande, et la date est enregistrée.
 */
import { db, lireProfil, ecrireProfil } from '../db';
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';
import {
  calculerNiveau,
  calculerXp,
  joursActifs,
  serie,
  type JournalXp,
  type Niveau,
  type Serie,
} from './activite';
import { publierFaitsRevisions, type Manque, type Publication } from './faits-revisions';
import type { Fait } from '../noyau/faits';

export const CLEF_SOCLE = 'socleActivite';

export interface SocleActivite {
  /** Instant de la reprise. */
  le: string;
  /** Jour logique de la bascule : il appartient au socle, pas au calcul. */
  jour: string;
  /** L'XP reprise, par domaine. Sa somme est exactement l'XP affichée ce jour-là. */
  xpRepris: Record<string, number>;
  /** L'XP affichée au moment de la reprise. */
  xpAffichee: number;
  /** Ce que le recalcul aurait donné sur l'historique publiable. */
  xpRecalculee: number;
  /** La série courante au moment de la reprise, conservée pour mémoire. */
  serieAvant: number;
  /** Le record, qui survit à la reprise. */
  serieRecord: number;
  /** Ce que la branche n'a pas pu publier, et qui explique l'écart. */
  manques: Manque[];
}

export async function lireSocle(): Promise<SocleActivite | null> {
  const base = await db();
  return ((await base.get('etat', CLEF_SOCLE)) as SocleActivite | undefined) ?? null;
}

/**
 * Répartit un total entre des domaines, selon les parts d'un recalcul.
 *
 * Le total rendu est **exactement** celui demandé : les arrondis sont absorbés
 * par le domaine le plus chargé, parce qu'une somme de parts arrondies qui ne
 * ferait pas le total afficherait deux nombres différents pour la même chose.
 */
export function repartir(total: number, parts: Record<string, number>): Record<string, number> {
  const somme = Object.values(parts).reduce((s, n) => s + n, 0);
  if (total <= 0) return {};
  if (somme <= 0) {
    // Rien de publiable : tout va aux connaissances, qui est le domaine
    // d'origine de l'XP du site.
    return { connaissances: total };
  }
  const domaines = Object.keys(parts).sort((a, b) => parts[b] - parts[a]);
  const sortie: Record<string, number> = {};
  let reste = total;
  for (const domaine of domaines.slice(1)) {
    const valeur = Math.round((parts[domaine] / somme) * total);
    sortie[domaine] = valeur;
    reste -= valeur;
  }
  sortie[domaines[0]] = reste;
  return sortie;
}

export interface OptionsReprise {
  reglages?: Partial<ReglagesJourLogique>;
  maintenant?: Date;
}

/**
 * Reprend l'XP et la série. Idempotente : un socle existant est rendu tel quel.
 */
export async function reprendreActivite(options: OptionsReprise = {}): Promise<SocleActivite> {
  const dejaFait = await lireSocle();
  if (dejaFait) return dejaFait;

  const maintenant = options.maintenant ?? new Date();
  const profil = await lireProfil();
  const { faits, manques } = await publierFaitsRevisions({ reglages: options.reglages });
  const journal = calculerXp(faits);

  const socle: SocleActivite = {
    le: maintenant.toISOString(),
    jour: jourLogique(maintenant, options.reglages),
    xpRepris: repartir(profil.xp, journal.parDomaine),
    xpAffichee: profil.xp,
    xpRecalculee: journal.total,
    serieAvant: profil.streakCourante,
    serieRecord: Math.max(profil.streakRecord, profil.streakCourante),
    manques,
  };

  await (await db()).put('etat', socle, CLEF_SOCLE);
  /*
   * La série repart de zéro, et `dernierJourEtudie` est effacé pour que le
   * prochain jour actif compte pour un — et non pour deux, ce qui arriverait
   * si l'ancien dernier jour restait là.
   */
  await ecrireProfil({
    ...profil,
    streakCourante: 0,
    streakRecord: socle.serieRecord,
    dernierJourEtudie: null,
  });
  return socle;
}

export interface EtatActivite {
  socle: SocleActivite | null;
  /** Les faits publiés sur la fenêtre lue. */
  faits: Fait[];
  /** Le journal des faits postérieurs à la bascule — ou de tous, sans socle. */
  journal: JournalXp;
  /** L'XP totale : le socle plus le journal. */
  xp: number;
  parDomaine: Record<string, number>;
  niveau: Niveau;
  serie: Serie;
  manques: Manque[];
}

export interface OptionsEtat {
  reglages?: Partial<ReglagesJourLogique>;
  maintenant?: Date;
  /** Le jour de repos déclaré, pour que la série ne casse pas sur un repos. */
  estRepos?: (jour: string) => boolean;
  /**
   * Une publication déjà faite, pour ne pas la refaire.
   *
   * L'écran a besoin des jours publiés **avant** de pouvoir dire lesquels
   * étaient des jours de repos : il publie donc une fois, interroge la
   * planification, puis redemande l'état avec la réponse.
   */
  publication?: Publication;
}

/**
 * L'état d'activité tel qu'un écran doit l'afficher.
 *
 * Sans socle, le journal porte **tout** l'historique publiable : c'est la vue
 * « ce que le moteur dirait si l'on reprenait tout », celle qui sert à montrer
 * l'écart avant de décider. Avec un socle, seuls les faits postérieurs au jour
 * de bascule sont comptés : le jour de la bascule appartient au socle, puisque
 * son XP a déjà été attribuée à l'ancienne.
 */
export async function etatActivite(options: OptionsEtat = {}): Promise<EtatActivite> {
  const maintenant = options.maintenant ?? new Date();
  const socle = await lireSocle();
  const { faits, manques } =
    options.publication ?? (await publierFaitsRevisions({ reglages: options.reglages }));
  const apres = socle ? faits.filter((f) => f.jourLogique > socle.jour) : faits;
  const journal = calculerXp(apres);

  const parDomaine: Record<string, number> = { ...(socle?.xpRepris ?? {}) };
  for (const [domaine, xp] of Object.entries(journal.parDomaine)) {
    parDomaine[domaine] = (parDomaine[domaine] ?? 0) + xp;
  }
  const reprise = socle ? Object.values(socle.xpRepris).reduce((s, n) => s + n, 0) : 0;
  const xp = reprise + journal.total;

  return {
    socle,
    faits,
    journal,
    xp,
    parDomaine,
    niveau: calculerNiveau(xp),
    serie: serie(joursActifs(apres), {
      estRepos: options.estRepos,
      jusqua: jourLogique(maintenant, options.reglages),
      recordAnterieur: socle?.serieRecord ?? 0,
    }),
    manques: [...(socle?.manques ?? []), ...manques].filter(
      (m, i, tous) => tous.findIndex((autre) => autre.quoi === m.quoi) === i,
    ),
  };
}
