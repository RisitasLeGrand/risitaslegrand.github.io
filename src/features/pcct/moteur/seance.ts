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
import type { Essai, Operation, Reponse } from './types';
import type { Reglages } from './reglages';
import type { Hasard } from './tirage';
import { prochainNombre } from './tirage';
import { resultatAttendu } from './calcul';
import { apresEssai, rythmeNeuf, type EtatRythme } from './rythme';
import { mediane, p90, scores, type ComptesArithmetique } from './notation';
import type { DepotPcct, EssaiJoue, SeanceFinie } from './depot';
import { prospectiveNeuve, scoreProspective, type EtatProspective } from './prospective';
import {
  comptesInhibitionNeufs,
  compterInhibition,
  jugerInhibition,
  operationDuRang,
  operationsCommutables,
  sensAttendu,
  type ComptesInhibition,
  type Donnees,
  type Exigences,
  type Sens,
  type VerdictInhibition,
} from './modules';

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

  /* ── Ce que les modules de L3 ajoutent à l'état ───────────────────────── */

  /**
   * Le NOMBRE présenté à l'essai précédent, référence de NDM.
   *
   * Distinct de `attenduPrecedent`, qui est le RÉSULTAT attendu et sert à SDM.
   * Les confondre ferait un module qui compare la bonne chose une fois sur
   * deux — exactement quand l'opération est l'identité.
   */
  nombrePrecedent: number | null;
  comptesInhibition: ComptesInhibition;
  /** Les sens demandés et les sens justes, pour le score des modules NDM/SDM. */
  comptesSens: { demandes: number; justes: number };
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
    nombrePrecedent: null,
    comptesInhibition: comptesInhibitionNeufs(),
    comptesSens: { demandes: 0, justes: 0 },
  };
}

/**
 * L'opération de cet essai : celle des réglages, ou celle du bloc courant.
 *
 * Le changement de règle n'est pas un réglage de plus posé dans `poserEssai` :
 * c'est une fonction du RANG, déterministe, pour qu'un essai se rejoue à
 * l'identique. Un tirage ici rendrait la correction détaillée invérifiable.
 */
export function operationDeLEssai(etat: EtatSeance, rang: number): Operation {
  const r = etat.reglages;
  if (!r.changementDeRegleActif) return r.operation;
  const commutables = operationsCommutables(r.operationsCommutees);
  return operationDuRang(rang, commutables, r.changementDeRegleBloc, r.operation);
}

/**
 * Cet essai porte-t-il le signal d'inhibition ?
 *
 * Tiré du hasard INJECTÉ, comme le nombre : un signal tiré en cachette ne
 * s'éprouverait qu'en jouant mille essais et en comptant. Et jamais pendant
 * l'échauffement — demander de retenir une réponse qui n'existe pas ne mesure
 * rien, et comptabiliserait une inhibition réussie à qui n'avait rien à
 * inhiber.
 */
export function signalDInhibition(etat: EtatSeance, hasard: Hasard, notable: boolean): boolean {
  if (!etat.reglages.inhibitionActive || !notable) return false;
  return hasard() * 100 < etat.reglages.inhibitionFrequence;
}

/**
 * Ce que cet essai demande, selon les modules actifs.
 *
 * Sur un essai d'inhibition, le nombre n'est PAS demandé : c'est tout l'objet
 * du module. Et le sens n'est demandé que si la comparaison est possible —
 * pendant l'échauffement elle ne l'est pas, et exiger une flèche que rien ne
 * permet de choisir rendrait l'essai impossible plutôt que difficile.
 */
export function exigencesDeLEssai(
  etat: EtatSeance,
  essai: Essai,
  signal: boolean,
): Exigences {
  const r = etat.reglages;
  const sensPossible =
    (r.ndmActif && etat.nombrePrecedent !== null) ||
    (r.sdmActif && etat.attenduPrecedent !== null && essai.attendu !== null);
  return { nombre: !signal && essai.attendu !== null, sens: !signal && sensPossible };
}

/**
 * Le sens attendu de cet essai, ou `null` si aucun n'est demandé.
 *
 * NDM compare les NOMBRES, SDM les RÉSULTATS ATTENDUS. Les deux allumés
 * ensemble, NDM l'emporte : il porte sur ce que la personne vient de VOIR,
 * là où SDM porte sur ce qu'elle a dû calculer. Demander les deux ferait deux
 * flèches, et l'écran n'en a qu'une.
 */
export function sensDeLEssai(etat: EtatSeance, essai: Essai): Sens | null {
  const r = etat.reglages;
  if (r.ndmActif) return sensAttendu(essai.nombre, etat.nombrePrecedent);
  if (r.sdmActif) return sensAttendu(essai.attendu, etat.attenduPrecedent);
  return null;
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
  /* Et le NOMBRE précédent, référence de NDM. Posé ici pour la même raison que
     l'attendu : `noter` ne court pas pour un essai d'échauffement ni pour un
     essai sans réponse, et la référence doit avancer à chaque essai. */
  etat.nombrePrecedent = etat.courant?.nombre ?? null;
  const { n, nombreMin, nombreMax } = etat.reglages;
  const operation = operationDeLEssai(etat, etat.presentes.length + 1);
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
  return noterLEssai(etat, etat.courant, reponse, depot);
}

/**
 * Note la réponse à UN essai nommé, qui n'est pas forcément le courant.
 *
 * C'est ce que demande le délai de grâce : une frappe tombée dans la fenêtre
 * appartient à l'essai PRÉCÉDENT, et c'est à son attendu qu'il faut la
 * comparer. `noter` comparait au courant, et une réponse rattrapée aurait donc
 * été jugée contre le mauvais nombre — l'aide aurait produit la faute qu'elle
 * existe pour empêcher.
 *
 * La fonction vit ici et non dans l'écran pour la même raison que
 * `grace.attribuer` : l'attribution est une règle, et une règle s'éprouve en
 * millisecondes. L'écran n'a qu'à dire de quel essai il parle.
 */
export async function noterLEssai(
  etat: EtatSeance,
  essai: Essai | null,
  reponse: Reponse,
  depot: DepotPcct,
): Promise<EssaiJoue | null> {
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

/**
 * Note l'inhibition d'un essai, et rend son verdict.
 *
 * SÉPARÉE DE `noterLEssai`, et non fondue dedans, parce que les deux ne se
 * déclenchent pas aux mêmes moments : l'arithmétique se note quand une réponse
 * arrive, l'inhibition se note à la FIN de l'essai, y compris — et surtout —
 * quand rien n'est arrivé. Les fondre ferait que ne rien faire ne compte
 * jamais, ce qui est précisément le trou de la référence : son module ne peut
 * mesurer ni la retenue ni la fausse alarme.
 */
export function noterInhibition(
  etat: EtatSeance,
  signal: boolean,
  donnees: Donnees,
): VerdictInhibition {
  if (!etat.reglages.inhibitionActive) return 'sans-objet';
  const verdict = jugerInhibition(signal, donnees.retenir, donnees.nombre !== null);
  etat.comptesInhibition = compterInhibition(etat.comptesInhibition, verdict);
  return verdict;
}

/**
 * Note le sens donné, et dit s'il était juste.
 *
 * Rend `null` quand aucun sens n'était demandé — et ne compte alors RIEN. Un
 * essai qui ne demandait pas de flèche ne doit pas peser dans le score des
 * modules, ni au numérateur ni au dénominateur.
 */
export function noterSens(
  etat: EtatSeance,
  attendu: Sens | null,
  donne: Sens | null,
): boolean | null {
  if (attendu === null) return null;
  etat.comptesSens.demandes += 1;
  const juste = donne === attendu;
  if (juste) etat.comptesSens.justes += 1;
  return juste;
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
