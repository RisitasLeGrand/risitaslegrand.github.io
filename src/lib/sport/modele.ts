/**
 * Ce que Sport possède : exercices, séances, séries, phases, blessures.
 *
 * ## L'identité de comparaison, qui est la décision structurante
 *
 * Comparer deux séries suppose qu'elles portent sur **le même exercice**. Or
 * « développé couché » ne suffit pas : à la barre, aux haltères, à la machine
 * convergente, ce sont trois charges incomparables, et une progression
 * calculée dessus mélangerait trois histoires. La **variante** et
 * l'**équipement** font donc partie de l'identité, pas de la description.
 *
 * La conséquence est volontaire et il faut la dire : changer d'équipement
 * **repart de zéro** pour le suivi de force. C'est désagréable, et c'est juste.
 * Un record au Smith machine n'est pas un record à la barre libre, et les
 * confondre inventerait une progression le jour où l'on change de salle.
 *
 * ## L'unité de charge n'est pas toujours le kilo
 *
 * Les tractions se chargent au **poids de corps plus lest**, les élastiques à
 * la couleur, le gainage à la durée. Un modèle qui ne connaîtrait que les
 * kilos obligerait à saisir des zéros, et un zéro saisi est un zéro compté.
 *
 * ## Le volume garde son coefficient
 *
 * Un muscle secondaire compte pour une fraction d'une série. Le coefficient
 * est réglable, et il est **stocké avec chaque calcul** : le changer plus tard
 * ne doit pas réécrire l'histoire. Un volume de mars calculé à 0,5 reste un
 * volume calculé à 0,5, même si l'on passe à 0,3 en avril.
 */
import type { IdDomaine } from '../noyau/domaines';

/* ══════════════════════════════════════════════════════════════════════════
   Les muscles
   ══════════════════════════════════════════════════════════════════════════ */

export type Face = 'avant' | 'arriere';

export interface Muscle {
  id: string;
  libelle: string;
  face: Face;
  /** Le groupe affiché dans les filtres : « Haut du corps », « Jambes »… */
  groupe: string;
}

/**
 * Les muscles du schéma corporel.
 *
 * Volontairement **grossier** : dix-huit entrées, pas une planche d'anatomie.
 * Distinguer le vaste latéral du vaste médial n'aiderait personne à décider de
 * sa séance du lendemain, et obligerait à répartir chaque série entre des
 * cases dont la frontière est discutable. La granularité est celle à laquelle
 * on s'entraîne, pas celle à laquelle on dissèque.
 */
export const MUSCLES: readonly Muscle[] = [
  { id: 'pectoraux', libelle: 'Pectoraux', face: 'avant', groupe: 'Haut du corps' },
  { id: 'deltoide-anterieur', libelle: 'Épaules (avant)', face: 'avant', groupe: 'Haut du corps' },
  { id: 'deltoide-lateral', libelle: 'Épaules (côté)', face: 'avant', groupe: 'Haut du corps' },
  { id: 'deltoide-posterieur', libelle: 'Épaules (arrière)', face: 'arriere', groupe: 'Haut du corps' },
  { id: 'biceps', libelle: 'Biceps', face: 'avant', groupe: 'Bras' },
  { id: 'triceps', libelle: 'Triceps', face: 'arriere', groupe: 'Bras' },
  { id: 'avant-bras', libelle: 'Avant-bras', face: 'avant', groupe: 'Bras' },
  { id: 'dorsaux', libelle: 'Dorsaux', face: 'arriere', groupe: 'Dos' },
  { id: 'trapezes', libelle: 'Trapèzes', face: 'arriere', groupe: 'Dos' },
  { id: 'lombaires', libelle: 'Lombaires', face: 'arriere', groupe: 'Dos' },
  { id: 'abdominaux', libelle: 'Abdominaux', face: 'avant', groupe: 'Tronc' },
  { id: 'obliques', libelle: 'Obliques', face: 'avant', groupe: 'Tronc' },
  { id: 'quadriceps', libelle: 'Quadriceps', face: 'avant', groupe: 'Jambes' },
  { id: 'ischio-jambiers', libelle: 'Ischio-jambiers', face: 'arriere', groupe: 'Jambes' },
  { id: 'fessiers', libelle: 'Fessiers', face: 'arriere', groupe: 'Jambes' },
  { id: 'adducteurs', libelle: 'Adducteurs', face: 'avant', groupe: 'Jambes' },
  { id: 'mollets', libelle: 'Mollets', face: 'arriere', groupe: 'Jambes' },
  { id: 'cou', libelle: 'Cou', face: 'avant', groupe: 'Haut du corps' },
];

const MUSCLE_PAR_ID = new Map(MUSCLES.map((m) => [m.id, m]));

export const muscle = (id: string): Muscle | undefined => MUSCLE_PAR_ID.get(id);

export const libelleDuMuscle = (id: string): string => MUSCLE_PAR_ID.get(id)?.libelle ?? id;

/* ══════════════════════════════════════════════════════════════════════════
   Les exercices
   ══════════════════════════════════════════════════════════════════════════ */

export type NatureExercice = 'force' | 'cardio' | 'mobilite' | 'gainage';

export type Lateralite = 'bilateral' | 'unilateral';

export type UniteDeCharge = 'kg' | 'corps' | 'corps-leste' | 'elastique' | 'duree' | 'aucune';

export const UNITES_DE_CHARGE: Record<UniteDeCharge, string> = {
  kg: 'Kilos',
  corps: 'Poids de corps',
  'corps-leste': 'Poids de corps + lest',
  elastique: 'Élastique',
  duree: 'Durée',
  aucune: 'Sans charge',
};

export interface Exercice {
  id: string;
  nom: string;
  nature: NatureExercice;
  lateralite: Lateralite;
  /** Libre : « barre », « haltères », « poulie », « machine convergente »… */
  equipement: string;
  /** Libre : « prise serrée », « incliné 30° », « au Smith »… Vide si aucune. */
  variante: string;
  unite: UniteDeCharge;
  /** Muscles principalement sollicités. */
  principaux: string[];
  /** Muscles secondairement sollicités : ils comptent au coefficient réduit. */
  secondaires: string[];
  /** Vrai pour les exercices livrés avec le site, faux pour ceux qu'on ajoute. */
  fourni: boolean;
  majLe: string;
}

/**
 * L'identité de comparaison d'un exercice.
 *
 * Deux séries ne se comparent que si cette chaîne est la même. Elle est
 * **normalisée** — minuscules, accents retirés, espaces resserrés — pour que
 * « Haltères » et « halteres » ne fassent pas deux exercices, ce qui est
 * l'erreur de saisie la plus banale et la plus coûteuse : elle couperait une
 * progression en deux sans que rien ne le signale.
 */
export function identiteDeComparaison(e: {
  nom: string;
  equipement: string;
  variante: string;
}): string {
  const net = (texte: string) =>
    texte
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  return [net(e.nom), net(e.equipement), net(e.variante)].join('|');
}

export function controlerExercice(e: Exercice): string[] {
  const problemes: string[] = [];
  if (!e.nom.trim()) problemes.push('Un exercice a besoin d’un nom.');
  if (!e.principaux.length) {
    problemes.push('Un exercice sollicite au moins un muscle principal.');
  }
  for (const id of [...e.principaux, ...e.secondaires]) {
    if (!MUSCLE_PAR_ID.has(id)) problemes.push(`Muscle inconnu : « ${id} ».`);
  }
  /*
     Un muscle à la fois principal et secondaire compterait deux fois dans le
     volume, une fois plein et une fois réduit. C'est le genre d'erreur de
     saisie qui gonfle un chiffre sans jamais se voir.
  */
  const doublons = e.principaux.filter((id) => e.secondaires.includes(id));
  if (doublons.length) {
    problemes.push(
      `Un muscle ne peut être principal et secondaire : ${doublons.map(libelleDuMuscle).join(', ')}.`,
    );
  }
  if (!(e.unite in UNITES_DE_CHARGE)) problemes.push(`Unité de charge inconnue : « ${e.unite} ».`);
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les séries et les séances
   ══════════════════════════════════════════════════════════════════════════ */

export interface Serie {
  /** Identifiant de l'exercice. */
  exerciceId: string;
  /** La charge, dans l'unité de l'exercice. `null` quand l'unité n'en a pas. */
  charge: number | null;
  repetitions: number;
  /** L'échec musculaire a-t-il été atteint ? */
  echec: boolean;
  /**
   * Répétitions en réserve, de 0 à 5, ou `null` si non estimées.
   *
   * C'est l'indicateur d'intensité le plus fiable à la saisie, bien plus que
   * « facile / dur » : on sait assez bien compter ce qu'il restait, et très
   * mal situer un effort sur une échelle abstraite.
   */
  reserve: number | null;
  /** Secondes de récupération **réellement** écoulées avant cette série. */
  repos: number | null;
  /** Instant ISO de l'enregistrement : c'est ce qui rend une reprise possible. */
  le: string;
}

export type StatutSeance = 'en-cours' | 'terminee';

export interface Seance {
  id: string;
  /** Jour logique de la séance. */
  jour: string;
  debut: string;
  fin: string | null;
  statut: StatutSeance;
  series: Serie[];
  /** Difficulté perçue de la séance entière, de 1 à 10, ou `null`. */
  difficulte: number | null;
  note: string;
  /** Le programme dont elle vient, s'il y en a un. */
  programmeId: string | null;
  majLe: string;
}

export function controlerSerie(s: Serie): string[] {
  const problemes: string[] = [];
  if (!s.exerciceId) problemes.push('Une série porte sur un exercice.');
  if (!Number.isFinite(s.repetitions) || s.repetitions < 0) {
    problemes.push('Le nombre de répétitions doit être positif.');
  }
  if (s.charge !== null && (!Number.isFinite(s.charge) || s.charge < 0)) {
    problemes.push('La charge doit être positive.');
  }
  if (s.reserve !== null && (s.reserve < 0 || s.reserve > 5)) {
    problemes.push('Les répétitions en réserve vont de 0 à 5.');
  }
  /*
     Échec **et** réserve non nulle est contradictoire : si l'on aurait pu en
     faire deux de plus, on n'a pas atteint l'échec. La contradiction fausserait
     toute estimation de charge maximale, qui s'appuie sur l'un ou sur l'autre.
  */
  if (s.echec && s.reserve !== null && s.reserve > 0) {
    problemes.push('Une série menée à l’échec n’a pas de répétitions en réserve.');
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les phases et les blessures
   ══════════════════════════════════════════════════════════════════════════ */

export type TypeDePhase = 'prise-de-masse' | 'seche' | 'maintien' | 'deload' | 'reprise';

export const PHASES: Record<TypeDePhase, string> = {
  'prise-de-masse': 'Prise de masse',
  seche: 'Sèche',
  maintien: 'Maintien',
  deload: 'Déload',
  reprise: 'Reprise',
};

export interface Phase {
  id: string;
  type: TypeDePhase;
  debut: string;
  /** `null` tant qu'elle dure. */
  fin: string | null;
  note: string;
  majLe: string;
}

/**
 * Une douleur ou une blessure déclarée.
 *
 * Elle est **sensible** au sens du contrat de faits, et elle commande le seul
 * garde-fou non négociable de la branche : tant qu'elle est ouverte, Sport ne
 * propose jamais de progresser sur les muscles concernés.
 */
export interface Blessure {
  id: string;
  /** Les muscles touchés. Vide signifie « général ». */
  muscles: string[];
  /** De 1 à 10. */
  intensite: number;
  debut: string;
  /** `null` tant qu'elle dure. */
  fin: string | null;
  note: string;
  majLe: string;
}

export const blessureOuverte = (b: Blessure): boolean => b.fin === null;

/**
 * Les muscles sous blessure ouverte à un instant donné.
 *
 * Une blessure **sans muscle** est générale : elle couvre tout. C'est le cas
 * d'une grippe ou d'une fatigue extrême, et le traiter comme « aucun muscle
 * concerné » laisserait proposer une progression le jour où l'on est au lit.
 */
export function musclesEmpeches(
  blessures: readonly Blessure[],
  maintenant = new Date(),
): { muscles: Set<string>; general: boolean } {
  const muscles = new Set<string>();
  let general = false;
  const instant = maintenant.toISOString();
  for (const b of blessures) {
    if (b.debut > instant) continue;
    if (b.fin !== null && b.fin < instant) continue;
    if (!b.muscles.length) general = true;
    for (const m of b.muscles) muscles.add(m);
  }
  return { muscles, general };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le volume par muscle
   ══════════════════════════════════════════════════════════════════════════ */

/** Le coefficient par défaut d'un muscle secondaire. Réglable. */
export const COEFFICIENT_SECONDAIRE = 0.5;

export interface VolumeParMuscle {
  /** Séries pondérées, par muscle. */
  series: Record<string, number>;
  /**
   * Le coefficient employé, **conservé avec le résultat**.
   *
   * Sans lui, un volume lu six mois plus tard serait ininterprétable : on
   * saurait « douze séries » sans savoir si les secondaires y pèsent une
   * demie ou un tiers. Et recalculer l'historique au coefficient du jour
   * réécrirait le passé à chaque changement d'avis.
   */
  coefficient: number;
}

/**
 * Le volume par muscle d'un ensemble de séries.
 *
 * Compté en **séries** et non en tonnage : le tonnage mélange des exercices
 * dont les charges ne sont pas comparables — cent kilos au soulevé de terre et
 * cent kilos au curl ne demandent pas le même effort —, et c'est en séries par
 * muscle et par semaine que se raisonne un programme.
 */
export function volumeParMuscle(
  series: readonly Serie[],
  exercices: readonly Exercice[],
  coefficient = COEFFICIENT_SECONDAIRE,
): VolumeParMuscle {
  const parId = new Map(exercices.map((e) => [e.id, e]));
  const compte: Record<string, number> = {};
  for (const serie of series) {
    const exercice = parId.get(serie.exerciceId);
    if (!exercice) continue;
    for (const m of exercice.principaux) compte[m] = (compte[m] ?? 0) + 1;
    for (const m of exercice.secondaires) compte[m] = (compte[m] ?? 0) + coefficient;
  }
  // Arrondi au centième : 0,5 + 0,5 + 0,5 donne 1,5000000000000002 en flottant.
  for (const m of Object.keys(compte)) compte[m] = Math.round(compte[m] * 100) / 100;
  return { series: compte, coefficient };
}

/** Le domaine auquel Sport rattache ses faits. */
export const DOMAINE_SPORT: IdDomaine = 'corps';
