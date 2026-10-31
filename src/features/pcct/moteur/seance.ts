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
  /**
   * Le résultat ATTENDU de l'essai précédent, réussi ou non.
   *
   * C'est la référence du module de comparaison des sommes, et la décision du
   * Pilote est explicite : on compare à la somme attendue de l'essai précédent,
   * QUE CELUI-CI AIT ÉTÉ RÉUSSI OU NON.
   *
   * La référence fait autrement, et c'est un défaut : sa variable n'est réécrite
   * que dans la branche des essais réussis. Après un essai manqué, la
   * comparaison porte donc sur une somme plus ancienne que la précédente — et
   * rien à l'écran ne dit laquelle. La personne compare de bonne foi au nombre
   * qu'elle vient d'entendre, et se voit compter faux.
   *
   * `null` pendant l'échauffement, où il n'y a pas d'attendu : la comparaison
   * n'est alors pas possible, et le module devra s'en abstenir plutôt que de
   * traiter l'absence comme un zéro.
   */
  attenduPrecedent: number | null;
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
    attenduPrecedent: null,
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
  /* L'attendu de l'essai qui s'achève devient la référence du suivant. Ici, et
     non dans `noter` : `noter` ne court pas pour un essai d'échauffement, et ne
     courrait pas non plus si la personne ne répondait rien. Le poser au moment
     où l'essai suivant paraît, c'est le poser à chaque fois. */
  etat.attenduPrecedent = etat.courant?.attendu ?? null;
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
