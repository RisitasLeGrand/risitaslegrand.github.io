/**
 * Le suivi de la force : estimer un maximum, et savoir quand on stagne.
 *
 * ## Deux formules, et pourquoi on les donne toutes les deux
 *
 * **Epley** : `charge × (1 + répétitions / 30)`.
 * **Brzycki** : `charge × 36 / (37 − répétitions)`.
 *
 * Elles divergent, et c'est l'information utile. Brzycki est plus
 * conservatrice en haut de la plage, Epley plus optimiste ; leur écart dit à
 * lui seul combien l'estimation est fragile. Donner une seule formule
 * produirait un nombre d'allure sûre là où il n'y a qu'une approximation, et
 * c'est exactement ce que le prompt refuse en demandant que l'imprécision soit
 * **signalée au-delà de dix répétitions**.
 *
 * ## Pourquoi dix
 *
 * Les deux formules sont étalonnées sur des séries courtes. Au-delà de dix
 * répétitions, l'endurance prend le pas sur la force maximale, et l'écart
 * entre les deux estimations se creuse jusqu'à l'absurde : Brzycki diverge
 * franchement à l'approche de trente-sept répétitions, où son dénominateur
 * s'annule. Une série de vingt ne dit presque rien d'un maximum.
 *
 * ## Les bandes de contexte, et le filtre qui va avec
 *
 * Une charge ne se lit pas seule : en sèche, on perd de la force sans avoir
 * régressé. Les périodes déclarées — prise de masse, sèche, déload — sont donc
 * **datées et superposées** à la courbe, et un filtre « périodes comparables »
 * permet de ne comparer que ce qui l'est. Sans lui, toute sèche ressemble à un
 * échec et toute prise de masse à un progrès.
 */
import type { Exercice, Phase, Serie, TypeDePhase } from './modele';
import { identiteDeComparaison } from './modele';

/** Au-delà, l'estimation d'un maximum ne veut plus dire grand-chose. */
export const REPETITIONS_FIABLES = 10;

/** Brzycki diverge à l'approche de 37 ; au-delà, on ne rend rien. */
const REPETITIONS_MAXIMALES = 36;

export interface Estimation {
  epley: number;
  brzycki: number;
  /** La moyenne des deux, qui est ce qu'on affiche. */
  estime: number;
  /** L'écart relatif entre les deux formules : la fragilité, chiffrée. */
  ecart: number;
  /** Vrai au-delà de dix répétitions : l'écran doit le dire. */
  imprecis: boolean;
}

/**
 * La charge maximale estimée d'une série.
 *
 * `null` quand l'estimation n'aurait pas de sens : pas de charge, zéro
 * répétition, ou une série si longue que les formules divergent. Rendre un
 * nombre dans ces cas serait pire que de ne rien rendre, parce qu'il serait
 * utilisé.
 */
export function maximumEstime(charge: number | null, repetitions: number): Estimation | null {
  if (charge === null || !Number.isFinite(charge) || charge <= 0) return null;
  if (!Number.isFinite(repetitions) || repetitions < 1) return null;
  if (repetitions > REPETITIONS_MAXIMALES) return null;
  /*
     Une répétition **est** le maximum : les deux formules le rendent déjà
     (1 + 1/30 ≈ 1,033 pour Epley, 36/36 = 1 pour Brzycki), mais leur écart
     de 3 % sur un cas où l'on sait la réponse exactement serait du bruit.
  */
  if (repetitions === 1) {
    return { epley: charge, brzycki: charge, estime: charge, ecart: 0, imprecis: false };
  }
  const epley = charge * (1 + repetitions / 30);
  const brzycki = (charge * 36) / (37 - repetitions);
  const estime = (epley + brzycki) / 2;
  return {
    epley: Math.round(epley * 10) / 10,
    brzycki: Math.round(brzycki * 10) / 10,
    estime: Math.round(estime * 10) / 10,
    ecart: Math.round((Math.abs(epley - brzycki) / estime) * 1000) / 1000,
    imprecis: repetitions > REPETITIONS_FIABLES,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   La série d'un exercice dans le temps
   ══════════════════════════════════════════════════════════════════════════ */

export interface PointDeForce {
  jour: string;
  /** La meilleure estimation du jour, en kilos. */
  estime: number;
  /** La série qui l'a produite, pour que le chiffre soit traçable. */
  charge: number;
  repetitions: number;
  imprecis: boolean;
  /** La phase déclarée ce jour-là, s'il y en avait une. */
  phase: TypeDePhase | null;
}

export interface OptionsForce {
  /** Les phases déclarées, pour les bandes de contexte. */
  phases?: readonly Phase[];
  /**
   * Ne garder que les jours relevant de ces phases.
   *
   * C'est le filtre « périodes comparables ». Les jours **sans** phase
   * déclarée sont gardés quand le filtre est vide, et écartés sinon : ne pas
   * savoir dans quelle phase on était n'est pas la même chose qu'être dans
   * celle qu'on compare.
   */
  phasesRetenues?: readonly TypeDePhase[];
}

const phaseDuJour = (jour: string, phases: readonly Phase[]): TypeDePhase | null => {
  for (const p of phases) {
    if (p.debut.slice(0, 10) > jour) continue;
    if (p.fin !== null && p.fin.slice(0, 10) < jour) continue;
    return p.type;
  }
  return null;
};

/**
 * La courbe de force d'un exercice, un point par jour.
 *
 * Un point par **jour** et non par série : une séance comporte plusieurs
 * séries du même exercice, et tracer chacune ferait un nuage illisible où la
 * série d'échauffement voisinerait la série lourde. On garde la meilleure
 * estimation du jour, qui est ce que « où j'en suis » veut dire.
 */
export function courbeDeForce(
  exerciceId: string,
  seances: readonly { jour: string; series: readonly Serie[] }[],
  options: OptionsForce = {},
): PointDeForce[] {
  const phases = options.phases ?? [];
  const retenues = options.phasesRetenues ?? [];
  const parJour = new Map<string, PointDeForce>();

  for (const seance of seances) {
    for (const serie of seance.series) {
      if (serie.exerciceId !== exerciceId) continue;
      const estimation = maximumEstime(serie.charge, serie.repetitions);
      if (!estimation) continue;
      const courant = parJour.get(seance.jour);
      if (courant && courant.estime >= estimation.estime) continue;
      parJour.set(seance.jour, {
        jour: seance.jour,
        estime: estimation.estime,
        charge: serie.charge ?? 0,
        repetitions: serie.repetitions,
        imprecis: estimation.imprecis,
        phase: phaseDuJour(seance.jour, phases),
      });
    }
  }

  let points = [...parJour.values()].sort((a, b) => a.jour.localeCompare(b.jour));
  if (retenues.length) {
    points = points.filter((p) => p.phase !== null && retenues.includes(p.phase));
  }
  return points;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le plateau
   ══════════════════════════════════════════════════════════════════════════ */

/** Combien de séances consécutives sans progrès avant de parler de plateau. */
export const SEANCES_POUR_UN_PLATEAU = 4;

/** En deçà, la différence est du bruit de mesure, pas un progrès. */
export const PROGRES_MINIMAL = 0.02;

export interface Plateau {
  /** Vrai quand les dernières séances ne progressent plus. */
  atteint: boolean;
  /** Combien de séances consécutives sans progrès. */
  seances: number;
  /** La meilleure estimation de la fenêtre observée. */
  record: number | null;
  /**
   * Pourquoi on ne conclut pas, quand c'est le cas.
   *
   * Un plateau annoncé sur trois points serait une conclusion tirée du bruit,
   * et un écran qui en annonce souvent cesse d'être lu.
   */
  pourquoiPas: 'assez-de-points' | 'progres-recent' | null;
}

/**
 * Stagne-t-on sur cet exercice ?
 *
 * La règle : aucune des `SEANCES_POUR_UN_PLATEAU` dernières séances n'a
 * dépassé le record **établi avant elles**, de plus de `PROGRES_MINIMAL`. Un
 * plateau n'est donc pas « ça ne monte pas », c'est « ça ne dépasse plus ».
 *
 * Deux cent trois kilos après deux cents, c'est 1,5 % : sous le seuil, et
 * c'est voulu. Une estimation portée par une formule approchée ne distingue
 * pas un progrès d'un centième de celui d'un jour de forme.
 */
export function plateau(points: readonly PointDeForce[]): Plateau {
  if (points.length < SEANCES_POUR_UN_PLATEAU + 1) {
    return {
      atteint: false,
      seances: 0,
      record: points.length ? Math.max(...points.map((p) => p.estime)) : null,
      pourquoiPas: 'assez-de-points',
    };
  }
  const recents = points.slice(-SEANCES_POUR_UN_PLATEAU);
  const avant = points.slice(0, -SEANCES_POUR_UN_PLATEAU);
  const recordAvant = Math.max(...avant.map((p) => p.estime));
  const seuil = recordAvant * (1 + PROGRES_MINIMAL);
  const depasse = recents.some((p) => p.estime > seuil);
  return {
    atteint: !depasse,
    seances: depasse ? 0 : recents.length,
    record: Math.max(recordAvant, ...recents.map((p) => p.estime)),
    pourquoiPas: depasse ? 'progres-recent' : null,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les exercices comparables
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les exercices qui partagent une identité de comparaison.
 *
 * Sert à repérer les **doublons de saisie** : deux entrées créées à des mois
 * d'intervalle avec la même identité normalisée sont le même exercice écrit
 * deux fois, et leurs progressions sont deux moitiés d'une seule histoire.
 * L'écran le signale plutôt que de fusionner d'office : fusionner deux
 * exercices est irréversible, et la personne sait mieux que le code si
 * « développé couché, barre » et « développé couché, barre olympique » sont la
 * même chose.
 */
export function doublons(exercices: readonly Exercice[]): Exercice[][] {
  const paquets = new Map<string, Exercice[]>();
  for (const e of exercices) {
    const clef = identiteDeComparaison(e);
    const liste = paquets.get(clef);
    if (liste) liste.push(e);
    else paquets.set(clef, [e]);
  }
  return [...paquets.values()].filter((liste) => liste.length > 1);
}
