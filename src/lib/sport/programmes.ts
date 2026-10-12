/**
 * Les séances types, les programmes, et le volume hebdomadaire.
 *
 * ## Une séance type n'est pas une séance
 *
 * Une **séance type** est une intention : « poussée lourde », cinq exercices,
 * trois à quatre séries chacun. Une séance est ce qui a eu lieu. Les
 * confondre ferait apparaître dans l'historique des séances jamais faites,
 * et dans le volume réalisé des séries jamais soulevées — exactement
 * l'illusion qu'Odyssée combat avec son relevé.
 *
 * C'est pourquoi rien ici n'écrit dans `sportSeances` : un programme
 * **prépare** une séance, et c'est la saisie en direct qui la crée.
 *
 * ## Le volume se compare prévu contre réalisé
 *
 * Un volume réalisé seul ne dit pas s'il est suffisant ; un volume prévu seul
 * ne dit pas s'il a été tenu. Les deux côte à côte disent la seule chose
 * utile : où l'écart se creuse, et sur quel muscle.
 *
 * Le coefficient des muscles secondaires voyage **avec** chaque calcul, par le
 * même raisonnement que dans `modele.ts` : un coefficient changé plus tard ne
 * doit pas réécrire l'histoire.
 */
import type { Exercice, Serie } from './modele';
import { COEFFICIENT_SECONDAIRE, MUSCLES, volumeParMuscle } from './modele';

/* ══════════════════════════════════════════════════════════════════════════
   Le modèle
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un bloc prévu : un exercice, et ce qu'on compte en faire.
 *
 * Les répétitions et le repos sont des **cibles**, pas des contraintes. Rien
 * ne refuse une série hors cible : le réel fait foi, et un programme qui
 * interdirait d'enregistrer ce qui s'est passé serait un programme qui ment.
 */
export interface BlocPrevu {
  exerciceId: string;
  /** Nombre de séries prévues. */
  series: number;
  /** Fourchette de répétitions visée, bornes comprises. */
  repetitionsMin: number;
  repetitionsMax: number;
  /** Repos visé entre les séries, en secondes, ou `null` si libre. */
  repos: number | null;
  /** Charge de départ indicative, ou `null` : la plupart du temps, on la sait. */
  chargeIndicative: number | null;
  note: string;
}

export interface SeanceType {
  id: string;
  nom: string;
  blocs: BlocPrevu[];
}

export interface Programme {
  id: string;
  nom: string;
  description: string;
  /** Les séances types, dans l'ordre où on les enchaîne. */
  seances: SeanceType[];
  /**
   * Séances prévues par semaine.
   *
   * Déclaré plutôt que déduit du nombre de séances types : on peut avoir trois
   * séances types et tourner quatre fois par semaine, ou l'inverse.
   */
  parSemaine: number;
  /** Le programme est-il celui que l'on suit en ce moment ? */
  actif: boolean;
  /** Cibles hebdomadaires de séries par muscle, pour les muscles qu'on surveille. */
  ciblesParMuscle: Record<string, number>;
  majLe: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les contrôles
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerBloc(bloc: BlocPrevu): string[] {
  const problemes: string[] = [];
  if (!bloc.exerciceId) problemes.push('Un bloc porte sur un exercice.');
  if (!Number.isInteger(bloc.series) || bloc.series < 1) {
    problemes.push('Un bloc prévoit au moins une série.');
  }
  if (bloc.repetitionsMin < 1 || bloc.repetitionsMax < 1) {
    problemes.push('Les répétitions visées sont au moins de une.');
  }
  if (bloc.repetitionsMin > bloc.repetitionsMax) {
    problemes.push('La fourchette de répétitions est à l’envers.');
  }
  if (bloc.repos !== null && bloc.repos < 0) problemes.push('Un repos ne peut être négatif.');
  return problemes;
}

export function controlerProgramme(programme: Programme): string[] {
  const problemes: string[] = [];
  if (!programme.nom.trim()) problemes.push('Un programme a besoin d’un nom.');
  if (!programme.seances.length) problemes.push('Un programme a au moins une séance type.');
  if (!Number.isInteger(programme.parSemaine) || programme.parSemaine < 1) {
    problemes.push('Un programme prévoit au moins une séance par semaine.');
  }
  for (const seance of programme.seances) {
    if (!seance.nom.trim()) problemes.push('Une séance type a besoin d’un nom.');
    if (!seance.blocs.length) {
      problemes.push(`La séance « ${seance.nom || '?'} » ne contient aucun exercice.`);
    }
    for (const bloc of seance.blocs) problemes.push(...controlerBloc(bloc));
  }
  for (const [id, cible] of Object.entries(programme.ciblesParMuscle)) {
    if (!MUSCLES.some((m) => m.id === id)) problemes.push(`Muscle inconnu en cible : « ${id} ».`);
    if (cible < 0) problemes.push('Une cible de volume ne peut être négative.');
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le volume prévu
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le volume que **prévoit** un programme sur une semaine.
 *
 * Les blocs sont convertis en séries fictives — une par série prévue — puis
 * passés au même `volumeParMuscle` que le réalisé. Réimplémenter la pondération
 * ici donnerait deux calculs à tenir d'accord, et c'est précisément ce que la
 * comparaison prévu/réalisé ne supporterait pas : l'écart mesurerait alors la
 * divergence des deux formules autant que celle de la personne.
 */
export function volumePrevu(
  programme: Programme,
  exercices: readonly Exercice[],
  coefficient = COEFFICIENT_SECONDAIRE,
) {
  const fictives: Serie[] = [];
  for (const seance of programme.seances) {
    for (const bloc of seance.blocs) {
      for (let i = 0; i < bloc.series; i += 1) {
        fictives.push({
          exerciceId: bloc.exerciceId,
          charge: bloc.chargeIndicative,
          repetitions: bloc.repetitionsMin,
          echec: false,
          reserve: null,
          repos: bloc.repos,
          le: programme.majLe,
        });
      }
    }
  }
  const brut = volumeParMuscle(fictives, exercices, coefficient);

  /*
     Le programme compte des séances types, pas des semaines. Si l'on tourne
     quatre fois par semaine sur trois séances types, chacune revient 4/3 fois :
     c'est ce facteur qui ramène le prévu à l'échelle hebdomadaire du réalisé.
  */
  const facteur = programme.seances.length ? programme.parSemaine / programme.seances.length : 0;
  const series: Record<string, number> = {};
  for (const [muscle, compte] of Object.entries(brut.series)) {
    series[muscle] = Math.round(compte * facteur * 100) / 100;
  }
  return { series, coefficient, facteur };
}

/* ══════════════════════════════════════════════════════════════════════════
   La comparaison
   ══════════════════════════════════════════════════════════════════════════ */

export type EtatVolume = 'sans-cible' | 'sous' | 'dans' | 'au-dela';

/** La tolérance autour de la cible, en part : ±20 %. */
export const TOLERANCE = 0.2;

export interface LigneDeVolume {
  muscle: string;
  prevu: number;
  realise: number;
  /** La cible déclarée, ou `null` s'il n'y en a pas pour ce muscle. */
  cible: number | null;
  etat: EtatVolume;
}

/**
 * Le tableau prévu / réalisé / cible, muscle par muscle.
 *
 * Tous les muscles du modèle y figurent, y compris ceux dont les trois
 * colonnes valent zéro : c'est la ligne vide qui montre un muscle oublié, et
 * la masquer ferait disparaître l'information la plus utile du tableau.
 */
export function comparerVolumes(options: {
  prevu: Record<string, number>;
  realise: Record<string, number>;
  cibles?: Record<string, number>;
  tolerance?: number;
}): LigneDeVolume[] {
  const { prevu, realise, cibles = {}, tolerance = TOLERANCE } = options;
  return MUSCLES.map((m) => {
    const cible = m.id in cibles ? cibles[m.id] : null;
    const fait = realise[m.id] ?? 0;
    let etat: EtatVolume = 'sans-cible';
    if (cible !== null) {
      if (fait < cible * (1 - tolerance)) etat = 'sous';
      else if (fait > cible * (1 + tolerance)) etat = 'au-dela';
      else etat = 'dans';
    }
    return { muscle: m.id, prevu: prevu[m.id] ?? 0, realise: fait, cible, etat };
  });
}

/**
 * Les muscles qu'aucun exercice du programme ne touche.
 *
 * Un trou dans un programme ne se voit pas en le lisant : on voit ce qui y
 * est, jamais ce qui n'y est pas. C'est la seule alerte que ce module émet,
 * et elle reste une alerte — rien n'empêche un programme de n'entraîner que
 * le haut du corps, si c'est voulu.
 */
export function musclesAbsents(
  programme: Programme,
  exercices: readonly Exercice[],
): string[] {
  const parId = new Map(exercices.map((e) => [e.id, e]));
  const touches = new Set<string>();
  for (const seance of programme.seances) {
    for (const bloc of seance.blocs) {
      const exercice = parId.get(bloc.exerciceId);
      if (!exercice) continue;
      for (const m of [...exercice.principaux, ...exercice.secondaires]) touches.add(m);
    }
  }
  return MUSCLES.filter((m) => !touches.has(m.id)).map((m) => m.id);
}
