/**
 * Le journal d'usage : quand l'application est ouverte, et combien de temps.
 *
 * ## Pourquoi il existe
 *
 * La veille du rythme de vie compare des repères factuels à l'habitude de la
 * personne. Presque tous ses repères sont **déclaratifs** — sommeil, repas,
 * séances — et c'est son point faible : quelqu'un qui se dégrade cesse de
 * saisir. Lire une absence comme un comportement est interdit, à juste titre ;
 * la veille s'éteindrait donc exactement quand elle servirait.
 *
 * Ce module est la sortie. Les heures d'ouverture, la durée d'une session, le
 * nombre de sessions dans la journée ne sont pas des champs remplis : ce sont
 * **des traces d'actes**. Elles survivent au décrochage, et c'est tout
 * l'intérêt.
 *
 * ## Il n'enregistre aucun contenu, et un contrôle le vérifie
 *
 * Une session, c'est **un début et une fin**. Pas la page ouverte, pas l'écran
 * consulté, pas l'action faite. Savoir que quelqu'un a ouvert Cyclades à 3 h
 * est une information de rythme ; savoir qu'il a ouvert « Ma psyché » à 3 h
 * est une information sur lui.
 *
 * La tentation d'ajouter un champ `page` « pour affiner » viendra. D'où
 * `CHAMPS_AUTORISES` et `controlerSession()`, qui refusent tout champ non
 * déclaré : la règle vit dans des données qu'un essai peut lire, et non dans
 * ce commentaire.
 *
 * ## Pourquoi il n'est **pas** scellé, contrairement au reste de la psyché
 *
 * C'est la décision la moins confortable de ce module, et elle mérite d'être
 * écrite plutôt que subie.
 *
 * Un magasin scellé ne s'écrit que coffre ouvert. Or le coffre est fermé la
 * plupart du temps — c'est son intérêt. Un journal d'usage scellé
 * n'enregistrerait donc que les sessions où l'on vient voir ses traitements
 * ou sa psyché, c'est-à-dire un échantillon biaisé par exactement ce qu'on
 * cherche à mesurer, et vide le reste du temps.
 *
 * Le choix est donc : des horodatages en clair, ou pas de domaine observé du
 * tout. Ce qui penche pour le clair, c'est la nature de la donnée — une
 * session est un couple d'instants, sans texte, sans nombre, sans sujet. Ce
 * qu'elle révèle, c'est « cet appareil a été utilisé à telle heure », ce que
 * le système d'exploitation sait déjà.
 *
 * ## Il ne voyage pas non plus
 *
 * Il n'entre pas dans le journal d'opérations, et donc pas dans les paquets
 * de synchronisation. Un appareil écrit une session chaque fois qu'on
 * l'ouvre, sans qu'on ait rien demandé ; si ces sessions voyageaient, deux
 * appareils ne pourraient plus jamais présenter la même empreinte, puisque
 * les ouvrir pour comparer suffirait à créer l'écart qu'on vient constater.
 * La vérification de concordance — ce qui permet de faire confiance à une
 * fusion — serait définitivement rouge.
 *
 * La veille n'observe donc que l'appareil sur lequel elle tourne. Un appareil
 * neuf n'a pas les vingt-huit jours de base qu'exige `suffisance()` : il dit
 * « données insuffisantes », et non « effondrement ». Voir la note de
 * `noyau/enregistrements.ts`.
 *
 * Ce qui en est **dérivé**, en revanche — un signal de la veille — est
 * sensible et scellé comme le reste. C'est l'inverse de la charge perçue, où
 * la source est scellée et le dérivé public ; ici la source est publique et
 * le dérivé scellé. Dans les deux cas la ligne passe au même endroit : ce qui
 * dit quelque chose **de la personne** est protégé.
 */
import { heureLocale, jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';

/* ══════════════════════════════════════════════════════════════════════════
   Une session
   ══════════════════════════════════════════════════════════════════════════ */

export interface Session {
  id: string;
  /** Jour logique du début. */
  jour: string;
  debut: string;
  /** `null` tant que la session court : une fin inventée fausserait la durée. */
  fin: string | null;
  majLe: string;
}

/**
 * Les seuls champs qu'une session a le droit de porter.
 *
 * Nommés en **liste blanche** et non en liste noire : interdire `page` et
 * `url` laisserait passer `ecran`, `vue`, `chemin`, et tout ce qu'on n'a pas
 * pensé. Autoriser cinq champs ferme la question une fois pour toutes.
 */
export const CHAMPS_AUTORISES: readonly string[] = ['id', 'jour', 'debut', 'fin', 'majLe'];

export function controlerSession(s: Session): string[] {
  const problemes: string[] = [];
  for (const champ of Object.keys(s)) {
    if (!CHAMPS_AUTORISES.includes(champ)) {
      problemes.push(
        `Une session ne porte que ${CHAMPS_AUTORISES.join(', ')} : « ${champ} » n’y a pas sa ` +
          'place. Le journal d’usage n’enregistre aucun contenu, pas même l’écran consulté.',
      );
    }
  }
  if (!s.debut) problemes.push('Une session a un début.');
  if (s.fin !== null && s.fin < s.debut) problemes.push('Une session se termine après son début.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.jour)) problemes.push('Une session appartient à un jour.');
  return problemes;
}

/** Durée en secondes, ou `null` si la session court encore. */
export function duree(s: Session): number | null {
  if (s.fin === null) return null;
  return Math.max(0, Math.round((Date.parse(s.fin) - Date.parse(s.debut)) / 1000));
}

/**
 * Deux sessions séparées de moins de ce délai n'en font qu'une.
 *
 * Changer de page ferme et rouvre une session : sans fusion, une visite de
 * dix minutes à travers quatre écrans compterait quatre sessions, et la
 * « fragmentation » mesurerait la navigation plutôt que le comportement.
 */
export const SECONDES_ENTRE_DEUX_SESSIONS = 120;

export function fusionnerLesProches(
  sessions: readonly Session[],
  secondes = SECONDES_ENTRE_DEUX_SESSIONS,
): Session[] {
  const triees = [...sessions].sort((a, b) => a.debut.localeCompare(b.debut));
  const sorties: Session[] = [];
  for (const s of triees) {
    const precedente = sorties[sorties.length - 1];
    if (
      precedente &&
      precedente.fin !== null &&
      precedente.jour === s.jour &&
      (Date.parse(s.debut) - Date.parse(precedente.fin)) / 1000 <= secondes
    ) {
      /*
         On étend la précédente, et on garde la fin la plus tardive : deux
         sessions qui se chevauchent — deux onglets — ne doivent pas raccourcir
         la journée.
      */
      if (s.fin === null || s.fin > precedente.fin) precedente.fin = s.fin;
      continue;
    }
    sorties.push({ ...s });
  }
  return sorties;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les indicateurs du domaine C
   ══════════════════════════════════════════════════════════════════════════ */

/** Les heures que le catalogue appelle « tardives ». */
export const HEURE_TARDIVE = { de: 1, a: 5 };

const heure = (instant: string, reglages: Partial<ReglagesJourLogique>) =>
  heureLocale(new Date(instant), reglages.fuseau).heure;

export interface JourneeDUsage {
  jour: string;
  sessions: number;
  /** Secondes. `null` si aucune session terminée : une session en cours ne dure pas zéro. */
  dureeMediane: number | null;
  /** Part des sessions commencées entre 1 h et 5 h, de 0 à 1. */
  partTardive: number;
  /** Première et dernière trace, en heures locales décimales. */
  premiereTrace: number | null;
  derniereTrace: number | null;
  /** Écart entre les deux, en heures. `null` avec une seule session. */
  amplitude: number | null;
}

const mediane = (xs: readonly number[]): number | null => {
  if (!xs.length) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
};

export function journeeDUsage(
  sessions: readonly Session[],
  jour: string,
  reglages: Partial<ReglagesJourLogique> = {},
): JourneeDUsage {
  const duJour = fusionnerLesProches(sessions.filter((s) => s.jour === jour));
  const durees = duJour.map(duree).filter((d): d is number => d !== null);
  const heures = duJour.map((s) => {
    const h = heureLocale(new Date(s.debut), reglages.fuseau);
    return h.heure + h.minute / 60;
  });
  const tardives = duJour.filter((s) => {
    const h = heure(s.debut, reglages);
    return h >= HEURE_TARDIVE.de && h < HEURE_TARDIVE.a;
  });
  const fins = duJour
    .map((s) => (s.fin === null ? null : heureLocale(new Date(s.fin), reglages.fuseau)))
    .filter((h): h is NonNullable<typeof h> => h !== null)
    .map((h) => h.heure + h.minute / 60);

  const premiere = heures.length ? Math.min(...heures) : null;
  const derniere = fins.length ? Math.max(...fins) : null;
  return {
    jour,
    sessions: duJour.length,
    dureeMediane: mediane(durees),
    /*
       Zéro session donne une part de 0, et non `null` : « aucune session
       tardive » est une information vraie, pas une absence de mesure. C'est
       le jour **sans aucune session** qui est une absence — et il n'apparaît
       simplement pas dans la liste des journées.
    */
    partTardive: duJour.length ? tardives.length / duJour.length : 0,
    premiereTrace: premiere,
    derniereTrace: derniere,
    amplitude: premiere !== null && derniere !== null ? Math.round((derniere - premiere) * 10) / 10 : null,
  };
}

/** Les journées où il s'est passé quelque chose, triées. */
export function journeesDUsage(
  sessions: readonly Session[],
  reglages: Partial<ReglagesJourLogique> = {},
): JourneeDUsage[] {
  const jours = [...new Set(sessions.map((s) => s.jour))].sort();
  return jours.map((j) => journeeDUsage(sessions, j, reglages));
}

/* ══════════════════════════════════════════════════════════════════════════
   La rétention
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Combien de jours de journal d'usage sont conservés.
 *
 * La veille a besoin d'une base de huit semaines plus une fenêtre de deux :
 * soixante-dix jours suffisent au calcul. On en garde cent quatre-vingts pour
 * que le **mode rejeu** ait de quoi rejouer, et pas davantage — un journal
 * d'usage de cinq ans ne sert à rien et raconte beaucoup.
 */
export const JOURS_CONSERVES = 180;

export function aElaguer(sessions: readonly Session[], aujourdhui: string): string[] {
  const limite = new Date(Date.parse(`${aujourdhui}T12:00:00.000Z`) - JOURS_CONSERVES * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return sessions.filter((s) => s.jour < limite).map((s) => s.id);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le journal d'usage se contrôle lui-même.
 *
 * Deux choses, qu'un essai peut lire : qu'aucun champ de contenu ne se soit
 * glissé dans la liste blanche, et que la rétention reste bornée. Les deux
 * dérivent par petites touches — un champ « utile », quelques jours « pour
 * voir » — et aucune des deux ne se remarque au moment où elle change.
 */
export const CHAMPS_DE_CONTENU_INTERDITS: readonly string[] = [
  'page',
  'url',
  'chemin',
  'ecran',
  'vue',
  'titre',
  'action',
  'clic',
  'referent',
  'recherche',
];

export function controlerUsage(): string[] {
  const problemes: string[] = [];
  for (const interdit of CHAMPS_DE_CONTENU_INTERDITS) {
    if (CHAMPS_AUTORISES.includes(interdit)) {
      problemes.push(`« ${interdit} » est passé dans les champs autorisés : c’est du contenu.`);
    }
  }
  if (JOURS_CONSERVES > 400) {
    problemes.push(
      `La rétention du journal d’usage est de ${JOURS_CONSERVES} jours. Au-delà d’un an, ` +
        'il raconte une vie sans servir à la veille, qui n’a besoin que de dix semaines.',
    );
  }
  return problemes;
}

/** Le jour logique d'un instant, pour l'enregistreur. */
export const jourDeLaSession = (instant: Date, reglages: Partial<ReglagesJourLogique> = {}) =>
  jourLogique(instant, reglages);
