/**
 * Ce que l'usage dit de lui-même, sans aucune IA et sans rien envoyer.
 *
 * ## À quoi ça sert, et à quoi ça ne sert pas
 *
 * Deux usages, et un seul mécanisme :
 *
 * - **l'initialisation allégée** (A.7) : quelqu'un qui révise depuis un an n'a
 *   pas à se faire demander combien d'heures par semaine il y consacre — on le
 *   sait. La réponse est **proposée**, marquée comme déduite, et attend
 *   confirmation ;
 * - **l'adaptation** (A.8) : quand le déclaré et l'observé s'écartent, la
 *   proposition de correction naît d'ici.
 *
 * Ce module ne décide rien et n'écrit rien. Il lit des faits — les mêmes que
 * les indicateurs et l'XP — et rend des constats. C'est voulu : une déduction
 * qui s'écrirait toute seule serait indiscernable d'une déclaration dans six
 * mois, et la personne ne pourrait plus savoir ce qu'elle a dit d'elle-même.
 *
 * ## Les trois règles d'honnêteté
 *
 * 1. **Un effectif insuffisant ne produit aucune déduction.** Trois séances ne
 *    disent rien d'un rythme hebdomadaire. Le silence est la bonne réponse.
 * 2. **Chaque déduction porte son constat en français**, et le constat dit ce
 *    qui a été vu, pas ce qui en est conclu : « vingt-deux séances sur les huit
 *    dernières semaines, cinq heures par semaine en médiane ».
 * 3. **Ce qui n'est pas observable n'est pas déduit.** Les jours de travail,
 *    par exemple : les jours où l'on révise ne sont pas les jours où l'on
 *    travaille, et pour beaucoup de gens c'est exactement l'inverse. Déduire
 *    l'un de l'autre poserait des créneaux faux pendant des mois.
 */
import { heureLocale, FUSEAU_PAR_DEFAUT } from './jour-logique';
import type { Fait } from './faits';

/** La fenêtre d'observation du rythme, en semaines. */
export const SEMAINES_OBSERVEES = 8;

/** En deçà, aucun rythme hebdomadaire n'est déduit. */
export const SEANCES_MINIMALES = 6;

/** Part d'une plage horaire à partir de laquelle on parle d'une préférence. */
export const PART_DOMINANTE = 0.6;

/* ══════════════════════════════════════════════════════════════════════════
   Les semaines logiques
   ══════════════════════════════════════════════════════════════════════════ */

const JOUR_MS = 86_400_000;

/**
 * Le lundi de la semaine d'un jour logique, au format `AAAA-MM-JJ`.
 *
 * Calculé en UTC à partir du jour logique, qui est déjà une date sans heure :
 * le fuseau a fait son travail en amont, dans `jourLogique()`, et le refaire
 * ici ferait dépendre le découpage des semaines du moment de la lecture.
 */
export function semaineDe(jourLogique: string): string {
  const [a, m, j] = jourLogique.split('-').map(Number);
  const date = new Date(Date.UTC(a, (m ?? 1) - 1, j ?? 1));
  // getUTCDay : 0 = dimanche. On veut le lundi, donc dimanche recule de 6.
  const recul = (date.getUTCDay() + 6) % 7;
  const lundi = new Date(date.getTime() - recul * JOUR_MS);
  return lundi.toISOString().slice(0, 10);
}

export type Plage = 'matin' | 'apres-midi' | 'soir' | 'nuit';

/**
 * La plage horaire d'une heure murale.
 *
 * Les bornes sont celles du questionnaire (question 8), et pas des quarts de
 * journée arbitraires : « matin » s'arrête à midi parce que c'est ce que le mot
 * veut dire pour la personne qui répond.
 */
export function plageDeLHeure(heure: number): Plage {
  if (heure >= 5 && heure < 12) return 'matin';
  if (heure >= 12 && heure < 18) return 'apres-midi';
  if (heure >= 18 && heure < 23) return 'soir';
  return 'nuit';
}

/* ══════════════════════════════════════════════════════════════════════════
   L'observation
   ══════════════════════════════════════════════════════════════════════════ */

export interface ObservationDomaine {
  domaine: string;
  faits: number;
  secondes: number;
  /** Le dernier jour logique où ce domaine a reçu quelque chose. */
  dernierJour: string;
}

export interface Observation {
  /** Les jours logiques où quelque chose a eu lieu, triés. */
  jours: string[];
  /** Les semaines logiques observées, triées. */
  semaines: string[];
  /** Les secondes de travail par semaine logique. */
  secondesParSemaine: Record<string, number>;
  /** La médiane des semaines **pleines** observées, en heures. */
  heuresMedianes: number | null;
  /** Combien de faits datés ont servi à l'observation. */
  faits: number;
  /** Combien de faits portent une durée. */
  faitsDuree: number;
  /** La répartition des faits par plage horaire. */
  parPlage: Record<Plage, number>;
  /** La plage qui domine nettement, ou `null` quand aucune ne domine. */
  plageDominante: Plage | null;
  /** L'heure murale du début le plus matinal observé. */
  heurePremiere: number | null;
  /** L'heure murale de la fin la plus tardive observée. */
  heureDerniere: number | null;
  parDomaine: ObservationDomaine[];
  /** Le dernier jour logique observé, toutes branches confondues. */
  dernierJour: string | null;
}

export interface OptionsObservation {
  /** Le jour logique de référence, pour la fenêtre des huit semaines. */
  jour?: string;
  semaines?: number;
  fuseau?: string;
}

const mediane = (valeurs: number[]): number | null => {
  if (!valeurs.length) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
};

const reculDeJours = (jour: string, jours: number): string =>
  new Date(Date.parse(`${jour}T00:00:00Z`) - jours * JOUR_MS).toISOString().slice(0, 10);

/**
 * Ce que les faits disent de l'usage, sur la fenêtre demandée.
 *
 * La durée d'un fait est lue de `fin − debut` quand les deux sont là, et non de
 * sa valeur : la valeur d'un fait de séance est en secondes, celle d'un fait de
 * QCM en points, et additionner les deux donnerait un nombre dépourvu de sens.
 */
export function observer(
  faits: readonly Fait[],
  options: OptionsObservation = {},
): Observation {
  const fuseau = options.fuseau ?? FUSEAU_PAR_DEFAUT;
  const semainesVoulues = options.semaines ?? SEMAINES_OBSERVEES;
  const jours = [...new Set(faits.map((f) => f.jourLogique).filter(Boolean))].sort();
  const dernierJour = options.jour ?? (jours.length ? jours[jours.length - 1] : null);
  const borne = dernierJour ? reculDeJours(dernierJour, semainesVoulues * 7 - 1) : null;

  const retenus = borne
    ? faits.filter((f) => f.jourLogique >= borne && f.jourLogique <= dernierJour!)
    : [];

  const secondesParSemaine: Record<string, number> = {};
  const parPlage: Record<Plage, number> = { matin: 0, 'apres-midi': 0, soir: 0, nuit: 0 };
  const parDomaine = new Map<string, ObservationDomaine>();
  let faitsDuree = 0;
  let heurePremiere: number | null = null;
  let heureDerniere: number | null = null;

  for (const semaine of new Set(retenus.map((f) => semaineDe(f.jourLogique)))) {
    secondesParSemaine[semaine] = 0;
  }

  for (const fait of retenus) {
    const semaine = semaineDe(fait.jourLogique);
    if (fait.fin && fait.debut) {
      const secondes = Math.max(0, (Date.parse(fait.fin) - Date.parse(fait.debut)) / 1000);
      if (Number.isFinite(secondes) && secondes > 0) {
        secondesParSemaine[semaine] += secondes;
        faitsDuree += 1;
      }
    }

    /*
     * La plage est celle de la **fin**, comme le jour logique : c'est l'instant
     * où l'activité est portée au compte, et les deux doivent se raconter
     * pareil. L'enveloppe des heures, elle, va du début au bout — sinon une
     * séance commencée à 6 h et finie à 8 h ne dirait rien de 6 h.
     */
    const debut = Date.parse(fait.debut);
    const fin = Date.parse(fait.fin ?? fait.debut);
    if (Number.isFinite(fin)) {
      parPlage[plageDeLHeure(heureLocale(new Date(fin), fuseau).heure)] += 1;
      const heure = heureLocale(new Date(fin), fuseau).heure;
      if (heureDerniere === null || heure > heureDerniere) heureDerniere = heure;
    }
    if (Number.isFinite(debut)) {
      const heure = heureLocale(new Date(debut), fuseau).heure;
      if (heurePremiere === null || heure < heurePremiere) heurePremiere = heure;
    }

    const vu = parDomaine.get(fait.domaine);
    const secondes =
      fait.fin && fait.debut
        ? Math.max(0, (Date.parse(fait.fin) - Date.parse(fait.debut)) / 1000)
        : 0;
    if (vu) {
      vu.faits += 1;
      vu.secondes += secondes;
      if (fait.jourLogique > vu.dernierJour) vu.dernierJour = fait.jourLogique;
    } else {
      parDomaine.set(fait.domaine, {
        domaine: fait.domaine,
        faits: 1,
        secondes,
        dernierJour: fait.jourLogique,
      });
    }
  }

  /*
   * La semaine en cours est **exclue** de la médiane : elle est partielle, et
   * une semaine partielle tire le rythme vers le bas d'autant que le jour de la
   * semaine où l'on regarde. Un lundi, elle vaudrait presque zéro.
   */
  const semaineCourante = dernierJour ? semaineDe(dernierJour) : null;
  const pleines = Object.entries(secondesParSemaine)
    .filter(([s]) => s !== semaineCourante)
    .map(([, secondes]) => secondes);

  const total = Object.values(parPlage).reduce((s, n) => s + n, 0);
  const haut = (Object.entries(parPlage) as [Plage, number][]).reduce(
    (meilleur, candidat) => (candidat[1] > meilleur[1] ? candidat : meilleur),
    ['matin', -1] as [Plage, number],
  );

  return {
    jours,
    semaines: Object.keys(secondesParSemaine).sort(),
    secondesParSemaine,
    heuresMedianes:
      retenus.length >= SEANCES_MINIMALES && pleines.length
        ? Math.round(((mediane(pleines) ?? 0) / 3600) * 10) / 10
        : null,
    faits: retenus.length,
    faitsDuree,
    parPlage,
    plageDominante: total && haut[1] / total >= PART_DOMINANTE ? haut[0] : null,
    heurePremiere,
    heureDerniere,
    parDomaine: [...parDomaine.values()].sort((a, b) => b.faits - a.faits),
    dernierJour,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les déductions de l'initialisation allégée (A.7)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une déduction : ce que l'usage laisse penser, avant toute confirmation.
 *
 * Elle n'est **pas** une valeur de champ. Tant que la personne n'a pas touché
 * « C'est juste », rien n'est écrit : A.7 demande que chaque préremplissage soit
 * « affiché comme déduit et attende confirmation », et une valeur devinée
 * présentée comme déclarée est un mensonge qui dure des mois.
 */
export interface Deduction {
  champ: string;
  valeur: unknown;
  /** Ce qui a été **vu**, en français — pas ce qui en est conclu. */
  constat: string;
}

/** Au-dessus, une matière est dite solide. Échelle de `niveau.ts` (1 200 au départ). */
export const NOTE_SOLIDE = 1250;

/** En dessous, une matière est dite fragile. */
export const NOTE_FRAGILE = 1150;

export interface NiveauObserve {
  matiere: string;
  libelle: string;
  note: number;
  /** Faux tant que les observations sont trop rares pour affirmer quoi que ce soit. */
  fiable: boolean;
}

export interface EntreesDeduction {
  observation: Observation;
  /** Les parcours ouverts dans le registre, s'il y en a. */
  parcoursActifs?: readonly { id: string; libelle: string }[];
  /** Les niveaux estimés par matière, tels que `niveau.ts` les rend. */
  niveaux?: readonly NiveauObserve[];
  /** Les domaines allumés par défaut (décision 1 de la phase 0 d'Odyssée). */
  domainesParDefaut?: readonly string[];
}

/**
 * De la plage observée à la réponse de la question R6.
 *
 * L'après-midi devient « variable » et non « matin » : la question demande
 * « matin ou soir », et répondre « matin » pour quelqu'un qui travaille à 15 h
 * serait inventer une préférence qu'il n'a pas exprimée. La nuit penche vers le
 * soir, qui est la plage dont elle est le prolongement.
 */
const REPONSE_DE_PLAGE: Record<Plage, string> = {
  matin: 'matin',
  'apres-midi': 'variable',
  soir: 'soir',
  nuit: 'soir',
};

/**
 * Ce que l'initialisation peut proposer au lieu de le demander.
 *
 * Rien n'est proposé sans effectif : `observer()` rend `heuresMedianes: null`
 * en deçà de six faits, et un niveau non fiable ne devient jamais une matière
 * « solide ». Une déduction absente coûte une question de plus ; une déduction
 * fausse coûte des mois de réglages faux.
 */
export function deduire(entrees: EntreesDeduction): Deduction[] {
  const { observation: o } = entrees;
  const sorties: Deduction[] = [];

  const actifs = entrees.parcoursActifs ?? [];
  if (actifs.length) {
    sorties.push({
      champ: 'concours',
      valeur: actifs.map((p) => p.id),
      constat:
        actifs.length === 1
          ? `Votre parcours « ${actifs[0].libelle} » est ouvert dans le registre.`
          : `${actifs.length} parcours sont ouverts : ${actifs.map((p) => p.libelle).join(', ')}.`,
    });
  }

  if (o.heuresMedianes !== null && o.heuresMedianes > 0) {
    const constat =
      `${o.faits} activités sur les ${o.semaines.length} dernières semaines, ` +
      `${o.heuresMedianes.toLocaleString('fr-FR')} h par semaine en médiane.`;
    sorties.push({ champ: 'heuresRevision', valeur: o.heuresMedianes, constat });
    /*
     * Le temps disponible est au **moins** le temps déjà passé : on l'a passé.
     * Proposer la médiane comme disponibilité serait dire à quelqu'un qu'il n'a
     * pas une minute de plus que ce qu'il fait déjà, ce qui est faux par
     * construction — d'où l'arrondi à l'heure supérieure, et le constat qui dit
     * qu'il s'agit d'un plancher.
     */
    sorties.push({
      champ: 'tempsParSemaine',
      valeur: Math.ceil(o.heuresMedianes),
      constat: `${constat} C'est un plancher : vous en avez au moins autant.`,
    });
  }

  if (o.plageDominante && o.faits >= SEANCES_MINIMALES) {
    const part = Math.round((o.parPlage[o.plageDominante] / o.faits) * 100);
    sorties.push({
      champ: 'momentRevision',
      valeur: REPONSE_DE_PLAGE[o.plageDominante],
      constat: `${part} % de vos activités tombent sur la plage « ${o.plageDominante} ».`,
    });
  }

  const fiables = (entrees.niveaux ?? []).filter((n) => n.fiable);
  const solides = fiables.filter((n) => n.note >= NOTE_SOLIDE);
  const fragiles = fiables.filter((n) => n.note <= NOTE_FRAGILE);
  if (solides.length) {
    sorties.push({
      champ: 'matieresFortes',
      valeur: solides.map((n) => n.matiere),
      constat: `Niveau estimé au-dessus de ${NOTE_SOLIDE} en ${solides
        .map((n) => n.libelle)
        .join(', ')}.`,
    });
  }
  if (fragiles.length) {
    sorties.push({
      champ: 'matieresFaibles',
      valeur: fragiles.map((n) => n.matiere),
      constat: `Niveau estimé sous ${NOTE_FRAGILE} en ${fragiles
        .map((n) => n.libelle)
        .join(', ')}.`,
    });
  }

  /*
   * Les domaines ne sont proposés que si l'usage en montre un que le défaut
   * n'allume pas. Sinon la « déduction » répéterait le défaut, ce qui n'apprend
   * rien à personne et ferait passer un réglage d'usine pour une observation.
   */
  const defauts = entrees.domainesParDefaut ?? [];
  const vus = o.parDomaine.map((d) => d.domaine);
  const nouveaux = vus.filter((d) => !defauts.includes(d));
  if (nouveaux.length) {
    sorties.push({
      champ: 'domainesActifs',
      valeur: [...defauts, ...nouveaux],
      constat: `Vous avez déjà de l'activité dans : ${vus.join(', ')}.`,
    });
  }

  return sorties;
}
