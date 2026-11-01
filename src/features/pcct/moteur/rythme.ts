/**
 * Le rythme : trois algorithmes, un seul invariant.
 *
 * L'intervalle entre deux nombres se resserre quand ça va bien et s'élargit
 * quand ça ne va pas. Trois façons de le décider, et toutes les trois sont
 * bornées par `intervalleMin` et `intervalleMax` — c'est le seul invariant que
 * les trois partagent, et c'est celui qui empêche la séance de devenir
 * injouable ou interminable.
 *
 *   standard    par blocs de 5 essais. Au moins 4 justes : on accélère de
 *               100 ms. Sinon : on ralentit de 100 ms. Rien ne bouge au milieu
 *               d'un bloc, ce qui donne au rythme le temps d'être ressenti.
 *   douce       à chaque essai, de `pasAcceleration` ou `pasRalentissement`.
 *   precision   sur une fenêtre glissante de 20 essais, on vise une précision
 *               donnée et on corrige proportionnellement à l'écart.
 *
 * Tout est PUR : `apresEssai` rend un état neuf et ne touche à rien. Un rythme
 * adaptatif ne se vérifie pas à la lecture — il se vérifie en le faisant tourner
 * contre un joueur simulé dont on connaît la précision, et en regardant où il
 * s'arrête. C'est ce que fait `essais:pcct`.
 */
import type { Reglages } from './reglages';
import type { Rythme } from './types';

/** Le pas du rythme standard, en millisecondes. Fixé par la référence. */
export const PAS_STANDARD = 100;
/** La taille d'un bloc, en essais. */
export const BLOC = 5;
/** Le nombre de justes qu'un bloc doit porter pour qu'on accélère. */
export const JUSTES_POUR_ACCELERER = 4;
/** La fenêtre glissante du rythme « precision », en essais. */
export const FENETRE_PRECISION = 20;
/** Millisecondes par unité d'écart de précision. */
export const GAIN_PRECISION = 160;
/** Le plus grand ajustement que « precision » s'autorise, en millisecondes. */
export const AJUSTEMENT_MAX = 80;

export interface EtatRythme {
  /** L'intervalle courant, en millisecondes. */
  intervalle: number;
  /** Essais déjà comptés dans le bloc courant (standard). */
  dansLeBloc: number;
  /** Justes du bloc courant (standard). */
  justesDuBloc: number;
  /** Les derniers verdicts, les plus anciens d'abord (precision). */
  fenetre: boolean[];
}

export function rythmeNeuf(reglages: Reglages): EtatRythme {
  return {
    intervalle: borner(reglages.intervalleDepart, reglages),
    dansLeBloc: 0,
    justesDuBloc: 0,
    fenetre: [],
  };
}

function borner(intervalle: number, reglages: Reglages): number {
  return Math.min(reglages.intervalleMax, Math.max(reglages.intervalleMin, Math.round(intervalle)));
}

/**
 * L'état du rythme après un essai noté.
 *
 * Les essais d'échauffement ne passent PAS par ici : ils ne sont pas notés, donc
 * ils n'ont pas à peser sur la cadence. Les compter ferait descendre l'intervalle
 * pendant que rien n'est encore demandé.
 */
export function apresEssai(etat: EtatRythme, juste: boolean, reglages: Reglages): EtatRythme {
  const suivant: EtatRythme = {
    intervalle: etat.intervalle,
    dansLeBloc: etat.dansLeBloc,
    justesDuBloc: etat.justesDuBloc,
    fenetre: etat.fenetre,
  };

  const algorithme: Rythme = reglages.rythme;

  if (algorithme === 'douce') {
    suivant.intervalle = borner(
      etat.intervalle + (juste ? -reglages.pasAcceleration : reglages.pasRalentissement),
      reglages,
    );
    return suivant;
  }

  if (algorithme === 'precision') {
    const fenetre = [...etat.fenetre, juste].slice(-FENETRE_PRECISION);
    suivant.fenetre = fenetre;
    /* On attend la fenêtre pleine. Juger sur trois essais ferait osciller
       l'intervalle d'un bout à l'autre de sa course pendant tout le début de
       la séance, pour une précision qui ne veut encore rien dire. */
    if (fenetre.length < FENETRE_PRECISION) return suivant;
    const precision = fenetre.filter(Boolean).length / fenetre.length;
    const ecart = reglages.precisionCible / 100 - precision;
    const ajustement = Math.min(
      AJUSTEMENT_MAX,
      Math.max(-AJUSTEMENT_MAX, Math.round(ecart * GAIN_PRECISION)),
    );
    suivant.intervalle = borner(etat.intervalle + ajustement, reglages);
    return suivant;
  }

  /* standard : rien ne bouge avant la fin du bloc. */
  const dansLeBloc = etat.dansLeBloc + 1;
  const justesDuBloc = etat.justesDuBloc + (juste ? 1 : 0);
  if (dansLeBloc < BLOC) {
    suivant.dansLeBloc = dansLeBloc;
    suivant.justesDuBloc = justesDuBloc;
    return suivant;
  }
  suivant.dansLeBloc = 0;
  suivant.justesDuBloc = 0;
  suivant.intervalle = borner(
    etat.intervalle + (justesDuBloc >= JUSTES_POUR_ACCELERER ? -PAS_STANDARD : PAS_STANDARD),
    reglages,
  );
  return suivant;
}
