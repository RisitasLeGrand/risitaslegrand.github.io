/**
 * La répétition des tâches et des événements — phase 1 du prompt 38.
 *
 * Ce module est **pur** : il ne lit aucune base, n'écrit rien, ne connaît ni
 * `Tache` ni `Evenement`. Il répond à une seule question — *quels jours cette
 * série tombe-t-elle ?* — et il est testable sans écran et sans navigateur.
 * C'est voulu : toute la difficulté du lot est dans le calendrier grégorien et
 * dans l'heure locale, pas dans l'interface, et un calcul qu'on ne peut
 * éprouver qu'en cliquant n'est pas éprouvé.
 *
 * ## Pourquoi `repetition.ts` et pas `recurrences.ts`
 *
 * `src/lib/odyssee/recurrences.ts` existe déjà et n'a rien à voir : il détecte
 * les prélèvements récurrents dans les opérations bancaires, pour en déduire un
 * budget. Reprendre ce nom rendrait le dossier illisible et ferait ouvrir le
 * mauvais fichier au prochain audit. Même raison pour `pointage.ts`, qui est la
 * politique de pointage budgétaire des Finances.
 *
 * ## La décision qui porte tout le reste : des jours, pas des instants
 *
 * Une occurrence est un **jour logique** (`AAAA-MM-JJ`) plus, facultativement,
 * une **heure murale** (`HH:MM`). Jamais un instant.
 *
 * C'est ce qui fait qu'« une tâche à 8 h reste à 8 h après le changement
 * d'heure du 25 octobre 2026 ». Si une série stockait des instants, l'occurrence
 * du 26 octobre serait à 9 h ou à 7 h selon le sens du calcul, et personne ne
 * s'en apercevrait avant le lendemain du changement. En gardant l'heure murale,
 * la conversion en instant se fait au dernier moment, une seule fois, par
 * `instantLocal()` du noyau — le même code qui résout déjà l'heure sautée du
 * printemps et l'heure dédoublée de l'automne.
 *
 * **Conséquence honnête à écrire** : cela veut dire que deux occurrences
 * consécutives d'une tâche quotidienne de 8 h sont séparées de 23 ou 25 heures
 * ces deux jours-là. C'est le comportement voulu — l'humain se lève à 8 h, pas
 * vingt-quatre heures après son dernier lever — mais un calcul de durée qui
 * soustrairait deux occurrences s'en trouverait faux. D'où `dureeDuJourLogique()`
 * dans le noyau, déjà exposée pour cette raison.
 *
 * ## Le jour logique commence à 4 h, et cela change une occurrence sur dix
 *
 * Une occurrence à 2 h du jour logique du 15 tombe, dans le calendrier, le
 * **16 à 2 h** : le jour logique du 15 court de 4 h le 15 à 4 h le 16. La
 * conversion est faite ici, une fois, dans `instantDeLOccurrence()`, et
 * l'invariant « l'instant d'une occurrence retombe sur son propre jour
 * logique » est éprouvé dans les essais. Sans cela, une tâche de nuit
 * apparaîtrait la veille de son jour.
 *
 * ## Ce que ce module ne fait pas
 *
 * Les exceptions — occurrence pointée, déplacée, abandonnée — ne sont pas ici.
 * Elles sont des enregistrements à part (phase 2), parce qu'une exception
 * rangée *dans* la série ferait de « l'appareil A déplace le 12 » et de
 * « l'appareil B change l'heure » deux écritures sur la même cible, dont la
 * seconde effacerait la première en silence. Le moteur ignore donc les
 * exceptions, et l'appelant les superpose.
 *
 * `scinderLaSerie()` est la seule concession : « celle-ci et les suivantes »
 * est une opération sur la série elle-même, pas une exception, et son arithmétique
 * — surtout avec une fin « après N fois » — mérite d'être pure et éprouvée.
 */
import { semaineDe } from '../noyau/observation';
import {
  REGLAGES_PAR_DEFAUT,
  decalerJourLogique,
  ecartJoursLogiques,
  instantLocal,
  type ReglagesJourLogique,
} from '../noyau/jour-logique';

/* ══════════════════════════════════════════════════════════════════════════
   Le modèle
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un jour de la semaine, `0` = dimanche.
 *
 * C'est la convention de `Date.getUTCDay()`, et celle que le dépôt emploie
 * déjà (`noyau/reglages.ts:79`). Elle n'est pas celle de l'affichage, où la
 * semaine commence le lundi : la traduction est le travail de l'écran.
 */
export type JourSemaine = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Une règle de répétition. Les cinq formes demandées par le prompt, et pas une
 * de plus.
 *
 * **Les règles mensuelles et annuelle ne portent aucune date** : le jour du
 * mois, le rang et le mois sont **déduits de `depuis`**. Le prompt dit « chaque
 * mois, le **même** jour » — le même que celui de la série. Stocker en plus un
 * `jourDuMois` créerait un champ qui peut contredire `depuis`, et c'est
 * précisément le genre de désaccord qu'on ne voit jamais en relisant.
 */
export type Repetition =
  /** Chaque jour, ou tous les N jours. */
  | { type: 'jours'; tous: number }
  /** Certains jours de la semaine, chaque semaine ou toutes les N semaines. */
  | { type: 'semaines'; tous: number; jours: JourSemaine[] }
  /** Chaque mois, au même quantième que `depuis` (le 5). */
  | { type: 'mois-date' }
  /** Chaque mois, au même rang que `depuis` (le premier lundi). */
  | { type: 'mois-rang' }
  /** Chaque année, au même jour et au même mois que `depuis`. */
  | { type: 'annee' };

/** Une fin de série : jamais, à une date, ou après N fois. */
export type Fin =
  | { type: 'jamais' }
  /** Jour logique inclus : une occurrence tombant ce jour-là a lieu. */
  | { type: 'date'; jusquAu: string }
  | { type: 'fois'; nombre: number };

export interface Serie {
  /**
   * Le jour logique d'ancrage. Ce n'est pas forcément une occurrence : une
   * série « lundi, mercredi, vendredi » créée un mardi commence le mercredi.
   * Mais aucune occurrence ne le précède.
   */
  depuis: string;
  repetition: Repetition;
  fin: Fin;
  /** Heure murale `HH:MM`, ou `null` : « apparaît dans la journée, pas à minuit ». */
  heure: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Petites lectures du calendrier
   ══════════════════════════════════════════════════════════════════════════ */

const JOUR_MS = 86_400_000;

const enNombres = (jour: string) => jour.split('-').map(Number) as [number, number, number];

/** Le jour de la semaine d'un jour logique. Lu en UTC : un jour n'a pas d'heure. */
function jourDeLaSemaine(jour: string): JourSemaine {
  const [a, m, j] = enNombres(jour);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay() as JourSemaine;
}

/** Le nombre de jours du mois d'un jour logique. */
function joursDuMois(annee: number, mois: number): number {
  // Le jour 0 du mois suivant est le dernier du mois courant.
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/**
 * Le rang d'un jour dans son mois : 1 pour le premier lundi, 2 pour le
 * deuxième, et **−1 pour le dernier**.
 *
 * Le cinquième lundi est traité comme le dernier, et ce n'est pas un détail
 * esthétique : un mois a cinq lundis quatre ou cinq fois par an seulement. Une
 * série ancrée sur un cinquième lundi et prise au pied de la lettre ne
 * tomberait presque jamais — elle paraîtrait éteinte sans l'être. « Dernier »
 * est le sens que la personne avait en tête, et c'est le seul qui donne une
 * occurrence tous les mois.
 */
function rangDansLeMois(jour: string): number {
  const [a, m, j] = enNombres(jour);
  const rang = Math.ceil(j / 7);
  return j + 7 > joursDuMois(a, m) ? -1 : rang;
}

/* ══════════════════════════════════════════════════════════════════════════
   La règle : ce jour est-il une occurrence ?
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La règle seule, **sans la fin de série**.
 *
 * Séparer les deux n'est pas gratuit : `scinderLaSerie()` doit pouvoir compter
 * les occurrences d'une règle en ignorant une fin « après N fois » qu'elle est
 * justement en train de répartir.
 */
export function suitLaRegle(serie: Serie, jour: string): boolean {
  if (jour < serie.depuis) return false;
  const r = serie.repetition;
  const [aj, mj, jj] = enNombres(jour);
  const [ad, md, jd] = enNombres(serie.depuis);

  switch (r.type) {
    case 'jours':
      return ecartJoursLogiques(serie.depuis, jour) % r.tous === 0;

    case 'semaines': {
      if (!r.jours.includes(jourDeLaSemaine(jour))) return false;
      const semaines = ecartJoursLogiques(semaineDe(serie.depuis), semaineDe(jour)) / 7;
      return semaines % r.tous === 0;
    }

    /*
       Un quantième qui n'existe pas dans un mois **saute ce mois**. Le 31
       janvier répété chaque mois ne donne rien en février et rien en avril ;
       il ne donne pas le 28 février ni le 1er mars. C'est le choix le plus
       sûr : décaler au dernier jour du mois inventerait une occurrence que la
       personne n'a pas demandée, et le mois suivant on ne saurait plus si
       « le 28 » était le 28 ou le 31 rabattu.
    */
    case 'mois-date':
      return jj === jd;

    case 'mois-rang':
      return jourDeLaSemaine(jour) === jourDeLaSemaine(serie.depuis)
        && rangDansLeMois(jour) === rangDansLeMois(serie.depuis);

    /*
       Le 29 février ne tombe que les années bissextiles, et la règle du siècle
       s'applique : après 2096 vient 2104, parce que 2100 n'est pas bissextile.
       Rien à coder pour cela — l'égalité du mois et du quantième suffit, le
       calendrier fait le reste.
    */
    case 'annee':
      return mj === md && jj === jd;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Le parcours
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un plafond de boucle, pour qu'un défaut se voie au lieu de figer l'écran.
 *
 * Cent ans de jours. Aucun usage légitime n'en approche : une série quotidienne
 * tenue depuis cinq ans en consomme 1 826.
 */
const PLAFOND_DE_JOURS = 36_600;

/**
 * Les occurrences, du jour `depuis` de la série jusqu'à `jusqua` inclus.
 *
 * ## Pourquoi un parcours jour par jour
 *
 * Une fin « après N fois » oblige de toute façon à **compter depuis le début**
 * de la série : on ne peut pas savoir si l'occurrence du 12 mars est la
 * trentième sans avoir énuméré les vingt-neuf précédentes. Dès lors qu'un
 * parcours complet est nécessaire pour un cas, le faire pour tous garde une
 * seule mécanique, visiblement correcte, au lieu de cinq formules fermées dont
 * chacune aurait son erreur de bord propre.
 *
 * Le coût est réel et assumé : une série annuelle regardée dix ans plus tard
 * fait 3 650 tours de boucle d'un test entier. C'est une fraction de
 * milliseconde, et c'est à optimiser le jour où une mesure le réclamera — pas
 * avant.
 */
function* parcourir(serie: Serie, jusqua: string): Generator<string> {
  let jour = serie.depuis;
  let faites = 0;
  let tours = 0;

  while (jour <= jusqua) {
    if (serie.fin.type === 'date' && jour > serie.fin.jusquAu) return;
    if (serie.fin.type === 'fois' && faites >= serie.fin.nombre) return;
    if (suitLaRegle(serie, jour)) {
      faites += 1;
      yield jour;
    }
    if ((tours += 1) > PLAFOND_DE_JOURS) {
      throw new Error(
        `repetition : plus de ${PLAFOND_DE_JOURS} jours parcourus depuis ${serie.depuis}`,
      );
    }
    jour = decalerJourLogique(jour, 1);
  }
}

/** Les occurrences d'une série dans l'intervalle `[du, au]`, bornes incluses. */
export function occurrences(serie: Serie, du: string, au: string): string[] {
  const liste: string[] = [];
  for (const jour of parcourir(serie, au)) {
    if (jour >= du) liste.push(jour);
  }
  return liste;
}

/**
 * L'horizon au-delà duquel chercher la prochaine occurrence est inutile.
 *
 * Il est calculé par règle, et le cas qui le fixe est le 29 février : après
 * 2096 vient 2104, soit **2 922 jours**, parce que 2100 n'est pas bissextile.
 * Un horizon d'un an aurait rendu `null` pour une série parfaitement vivante,
 * une fois par siècle, et l'essai qui le montre aurait été écrit en 2100.
 */
function horizon(r: Repetition): number {
  switch (r.type) {
    case 'jours':
      return r.tous + 1;
    case 'semaines':
      return r.tous * 7 + 7;
    // Le 31 janvier au 31 mars : 59 jours. Le pire est en deçà de 62.
    case 'mois-date':
      return 62;
    case 'mois-rang':
      return 40;
    case 'annee':
      return 3_000;
  }
}

/**
 * La première occurrence à partir d'un jour logique inclus, ou `null`.
 *
 * `null` veut dire « la série est finie », ou « aucune occurrence avant
 * l'horizon de sa règle ».
 */
export function prochaineOccurrence(serie: Serie, aPartirDe: string): string | null {
  const depart = aPartirDe > serie.depuis ? aPartirDe : serie.depuis;
  const bout = decalerJourLogique(depart, horizon(serie.repetition));
  const limite = serie.fin.type === 'date' && serie.fin.jusquAu < bout ? serie.fin.jusquAu : bout;
  for (const jour of parcourir(serie, limite)) {
    if (jour >= aPartirDe) return jour;
  }
  return null;
}

/** Le nombre d'occurrences **strictement avant** un jour logique. */
export function occurrencesAvant(serie: Serie, jour: string): number {
  let n = 0;
  for (const occurrence of parcourir(serie, jour)) {
    if (occurrence < jour) n += 1;
  }
  return n;
}

/* ══════════════════════════════════════════════════════════════════════════
   De l'occurrence à l'instant
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'instant d'une occurrence, ou `null` si la série n'a pas d'heure.
 *
 * Deux conversions sont faites ici, et nulle part ailleurs :
 *
 * 1. **Le jour logique vers le jour du calendrier.** Une occurrence à 2 h du
 *    jour logique du 15 est le 16 à 2 h : le jour logique court de 4 h à 4 h.
 *    L'invariant qui en découle — `jourLogique(instant) === jour` — est éprouvé.
 * 2. **L'heure murale vers l'instant**, par `instantLocal()`, qui porte déjà
 *    les deux règles du changement d'heure.
 */
export function instantDeLOccurrence(
  serie: Serie,
  jour: string,
  reglages: Partial<ReglagesJourLogique> = {},
): Date | null {
  if (serie.heure === null) return null;
  const { heureBascule, fuseau } = { ...REGLAGES_PAR_DEFAUT, ...reglages };
  const [h, m] = serie.heure.split(':').map(Number);
  const calendaire = h < heureBascule ? decalerJourLogique(jour, 1) : jour;
  return instantLocal(calendaire, h, m, fuseau);
}

/* ══════════════════════════════════════════════════════════════════════════
   « Celle-ci et les suivantes »
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Scinde une série en deux à un jour donné : ce qui précède, ce qui suit.
 *
 * C'est la mécanique de « **celle-ci et les suivantes** ». « Cette occurrence
 * seulement » n'est pas ici : c'est une exception, donc un enregistrement à
 * part (phase 2). « Toute la série » ne scinde rien non plus.
 *
 * `avant` est `null` si le jour tombe avant ou sur la première occurrence —
 * il ne reste alors rien à garder. `apres` est `null` si plus aucune
 * occurrence ne suit.
 *
 * ## Les deux subtilités, et pourquoi elles sont ici plutôt qu'à l'écran
 *
 * **`depuis` porte la règle.** Pour « chaque mois le 5 », le quantième est
 * déduit de `depuis` : poser `depuis` au jour du clic, qui peut être le 12,
 * changerait la règle en silence. La moitié qui suit est donc ancrée sur la
 * **première occurrence** ≥ ce jour, jamais sur le jour lui-même.
 *
 * **Une fin « après N fois » se répartit.** Si douze occurrences étaient
 * prévues et que trois ont déjà eu lieu, la première moitié en garde trois et
 * la seconde neuf. Sans cela, scinder une série fabriquerait des occurrences :
 * trois plus douze. Le prompt dit « aucune série perdue ni réécrite en
 * silence » — en fabriquer est la même faute dans l'autre sens.
 */
export function scinderLaSerie(
  serie: Serie,
  jour: string,
): { avant: Serie | null; apres: Serie | null } {
  const reprise = prochaineOccurrence(serie, jour);
  const deja = occurrencesAvant(serie, jour);

  const avant: Serie | null =
    deja === 0
      ? null
      : {
          ...serie,
          fin:
            serie.fin.type === 'fois'
              ? { type: 'fois', nombre: deja }
              : // Une fin déjà antérieure prime : scinder n'allonge jamais.
                serie.fin.type === 'date' && serie.fin.jusquAu < decalerJourLogique(jour, -1)
                ? serie.fin
                : { type: 'date', jusquAu: decalerJourLogique(jour, -1) },
        };

  if (reprise === null) return { avant, apres: null };

  const apres: Serie = {
    ...serie,
    depuis: reprise,
    fin:
      serie.fin.type === 'fois'
        ? { type: 'fois', nombre: Math.max(0, serie.fin.nombre - deja) }
        : serie.fin,
  };

  return { avant, apres: apres.fin.type === 'fois' && apres.fin.nombre === 0 ? null : apres };
}

/* ══════════════════════════════════════════════════════════════════════════
   Dire la série en français
   ══════════════════════════════════════════════════════════════════════════ */

const JOURS_SEMAINE = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
] as const;

const RANGS = ['', 'premier', 'deuxième', 'troisième', 'quatrième'] as const;

const quantieme = (jour: string) => Number(jour.split('-')[2]);

const MOIS = [
  '', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

/**
 * La série, en une phrase lisible : « chaque jour à 8 h », « le premier lundi
 * de chaque mois, 12 fois ».
 *
 * Elle existe pour une raison précise, et pas pour faire joli : le prompt
 * interdit qu'une série soit « réécrite en silence ». Une personne ne peut
 * confirmer que ce qu'elle comprend, et « {"type":"semaines","tous":2} » ne
 * se comprend pas. Ce libellé est donc une pièce du consentement, au même
 * titre que les avertissements du plan.
 */
export function libelleDeLaSerie(serie: Serie): string {
  const r = serie.repetition;
  let quand: string;

  switch (r.type) {
    case 'jours':
      quand = r.tous === 1 ? 'chaque jour' : `tous les ${r.tous} jours`;
      break;
    case 'semaines': {
      const noms = [...r.jours].sort().map((j) => JOURS_SEMAINE[j]);
      const liste =
        noms.length === 1
          ? noms[0]
          : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
      quand = r.tous === 1 ? `chaque ${liste}` : `${liste}, toutes les ${r.tous} semaines`;
      break;
    }
    case 'mois-date':
      quand = `le ${quantieme(serie.depuis)} de chaque mois`;
      break;
    case 'mois-rang': {
      const [a, m, j] = serie.depuis.split('-').map(Number);
      const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
      const dernier = j + 7 > new Date(Date.UTC(a, m, 0)).getUTCDate();
      const rang = dernier ? 'dernier' : RANGS[Math.ceil(j / 7)];
      quand = `le ${rang} ${JOURS_SEMAINE[jourSemaine]} de chaque mois`;
      break;
    }
    case 'annee': {
      const [, m, j] = serie.depuis.split('-').map(Number);
      quand = `chaque année le ${j} ${MOIS[m]}`;
      break;
    }
  }

  /* L'heure. « 8 h » plutôt que « 08:00 » : c'est ainsi qu'on la dit. */
  if (serie.heure) {
    const [h, min] = serie.heure.split(':');
    quand += ` à ${Number(h)} h${min === '00' ? '' : ` ${min}`}`;
  }

  if (serie.fin.type === 'date') quand += `, jusqu’au ${serie.fin.jusquAu}`;
  if (serie.fin.type === 'fois') {
    quand += `, ${serie.fin.nombre} fois`;
  }
  return quand;
}

/* ══════════════════════════════════════════════════════════════════════════
   Validation
   ══════════════════════════════════════════════════════════════════════════ */

const JOUR_VALIDE = /^\d{4}-\d{2}-\d{2}$/;
const HEURE_VALIDE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Les problèmes d'une série, en clair. Liste vide si elle est saine.
 *
 * Rendre une liste plutôt qu'un booléen : l'écran doit pouvoir dire *lequel*
 * des champs ne va pas, et un essai doit pouvoir vérifier qu'il a repéré le
 * bon.
 */
export function problemesDeLaSerie(serie: Serie): string[] {
  const p: string[] = [];
  if (!JOUR_VALIDE.test(serie.depuis)) p.push('le jour de départ n’est pas au format AAAA-MM-JJ');
  if (serie.heure !== null && !HEURE_VALIDE.test(serie.heure)) {
    p.push('l’heure n’est pas au format HH:MM');
  }

  const r = serie.repetition;
  if ((r.type === 'jours' || r.type === 'semaines') && !Number.isInteger(r.tous)) {
    p.push('l’intervalle doit être un nombre entier');
  } else if ((r.type === 'jours' || r.type === 'semaines') && r.tous < 1) {
    p.push('l’intervalle doit valoir au moins 1');
  }
  if (r.type === 'semaines') {
    if (r.jours.length === 0) p.push('aucun jour de la semaine n’est choisi');
    if (r.jours.some((j) => !Number.isInteger(j) || j < 0 || j > 6)) {
      p.push('un jour de la semaine est hors de 0–6');
    }
    if (new Set(r.jours).size !== r.jours.length) p.push('un jour de la semaine est répété');
  }

  if (serie.fin.type === 'fois' && (!Number.isInteger(serie.fin.nombre) || serie.fin.nombre < 1)) {
    p.push('le nombre de fois doit être un entier d’au moins 1');
  }
  if (serie.fin.type === 'date') {
    if (!JOUR_VALIDE.test(serie.fin.jusquAu)) p.push('la date de fin n’est pas au format AAAA-MM-JJ');
    else if (serie.fin.jusquAu < serie.depuis) p.push('la date de fin précède le jour de départ');
  }
  return p;
}
