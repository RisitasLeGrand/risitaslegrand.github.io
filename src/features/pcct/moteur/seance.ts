/**
 * La séance, sans écran et sans minuterie.
 *
 * Elle ne décide pas QUAND l'essai suivant paraît — c'est l'écran qui mène la
 * cadence, à partir de l'intervalle que le rythme lui donne. Elle décide ce que
 * l'essai contient, ce que la réponse vaut, et ce que la séance aura mesuré.
 *
 * L'appelant fait avancer : `poserEssai`, puis `noter`. Rien ne se déclenche
 * tout seul, ce qui permet d'éprouver une séance de quinze minutes en quelques
 * millisecondes.
 */
import type { Essai, Reponse } from './types';
import type { Reglages } from './reglages';
import type { Hasard } from './tirage';
import { prochainNombre } from './tirage';
import { resultatAttendu } from './calcul';
import { apresEssai, rythmeNeuf, type EtatRythme } from './rythme';
import { mediane, p90, scores, type ComptesArithmetique } from './notation';
import type { DepotPcct, EssaiJoue, SeanceFinie } from './depot';
import { prospectiveNeuve, scoreProspective, type EtatProspective } from './prospective';

export interface EtatSeance {
  reglages: Reglages;
  rythme: EtatRythme;
  prospective: EtatProspective;
  /** Les nombres présentés, dans l'ordre. */
  presentes: number[];
  /** L'essai en cours, ou `null` avant le premier. */
  courant: Essai | null;
  comptes: ComptesArithmetique;
  /** Les intervalles de chaque essai noté, pour la médiane. */
  intervalles: number[];
  /** Les temps de réaction des essais notés et répondus. */
  reactions: number[];
}

export function seanceNeuve(reglages: Reglages): EtatSeance {
  return {
    reglages,
    rythme: rythmeNeuf(reglages),
    prospective: prospectiveNeuve(),
    presentes: [],
    courant: null,
    comptes: { notes: 0, justes: 0 },
    intervalles: [],
    reactions: [],
  };
}

/**
 * Pose l'essai suivant et le rend.
 *
 * L'ÉCHAUFFEMENT N'EST PAS UN ESSAI RATÉ : tant que moins de n nombres ont
 * paru, il n'y a pas de référence, donc rien à calculer. `reference` et
 * `attendu` valent `null`, et `noter` refusera de compter cet essai. Compter
 * les n premiers ferait descendre la précision — et avec elle l'intervalle —
 * pour des essais auxquels personne ne pouvait répondre.
 */
export function poserEssai(etat: EtatSeance, hasard: Hasard): Essai {
  const { n, operation, nombreMin, nombreMax } = etat.reglages;
  const reference = etat.presentes.length >= n ? etat.presentes[etat.presentes.length - n] : null;
  const nombre = prochainNombre(hasard, operation, reference, nombreMin, nombreMax);
  etat.presentes.push(nombre);
  const essai: Essai = {
    rang: etat.presentes.length,
    nombre,
    reference,
    operation,
    attendu: reference === null ? null : resultatAttendu(operation, nombre, reference),
    intervalle: etat.rythme.intervalle,
  };
  etat.courant = essai;
  return essai;
}

/**
 * Note la réponse à l'essai courant.
 *
 * Rend `null` quand l'essai n'était pas notable — échauffement, ou opération
 * impossible à poser. Le rythme ne bouge pas dans ce cas, et le dépôt ne reçoit
 * rien : un essai qu'on ne pouvait pas réussir ne doit ni compter ni accélérer.
 */
export async function noter(
  etat: EtatSeance,
  reponse: Reponse,
  depot: DepotPcct,
): Promise<EssaiJoue | null> {
  const essai = etat.courant;
  if (!essai || essai.attendu === null) return null;

  const juste = reponse.donne === essai.attendu;
  etat.comptes.notes += 1;
  if (juste) etat.comptes.justes += 1;
  etat.intervalles.push(essai.intervalle);
  if (reponse.reaction !== null) etat.reactions.push(reponse.reaction);
  etat.rythme = apresEssai(etat.rythme, juste, etat.reglages);

  const joue: EssaiJoue = { essai, reponse, juste };
  await depot.noterEssai(joue);
  return joue;
}

/** Le résumé de la séance, tel qu'il part au dépôt. */
export function resumer(
  etat: EtatSeance,
  le: string,
  mode: SeanceFinie['mode'],
  secondes: number,
): SeanceFinie {
  return {
    le,
    mode,
    reglages: etat.reglages,
    secondes,
    notes: etat.comptes.notes,
    justes: etat.comptes.justes,
    intervalleDepart: etat.reglages.intervalleDepart,
    intervalleFin: etat.rythme.intervalle,
    intervalleMedian: mediane(etat.intervalles),
    reactionMediane: mediane(etat.reactions),
    reactionP90: p90(etat.reactions),
    scores: scores(etat.comptes, scoreProspective(etat.prospective)),
  };
}
