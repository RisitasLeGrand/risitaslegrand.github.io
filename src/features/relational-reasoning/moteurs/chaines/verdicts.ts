/**
 * Les verdicts de la famille « Chaînes de prémisses ».
 *
 * Deux moteurs posent la même question — « cette conclusion tient-elle ? » —
 * et doivent y répondre dans les **mêmes mots**. Le cahier des charges le
 * demandait déjà pour « Entre-deux », dont ces trois intitulés sont repris :
 * un vocabulaire qui changerait d'un moteur à l'autre obligerait à réapprendre
 * à lire en passant de l'un à l'autre, ce qui est exactement ce que le
 * vocabulaire partagé existe pour éviter.
 *
 * Les intitulés vivaient dans `conclusion.ts` tant qu'un seul moteur les
 * employait. Le second — « Prémisse du second ordre » — les aurait recopiés, et
 * deux listes écrites côte à côte finissent par ne plus concorder : une
 * reformulation d'un côté, et la correction expliquerait un verdict que l'autre
 * moteur n'affiche pas.
 */

/** Les trois verdicts, dans les mots d'« Entre-deux ». */
export const VERDICTS = [
  'il découle nécessairement des prémisses',
  'il les contredit : aucune situation compatible ne le vérifie',
  'il reste ouvert : les prémisses ne permettent pas de trancher',
];

/**
 * Les deux verdicts du mode binaire.
 *
 * Sur un système dont la composition est fonctionnelle, une chaîne couvrant les
 * entités fixe tout le réseau : une conclusion y est nécessairement entraînée
 * ou contredite, jamais entre les deux. « Contredit » et « reste ouvert » se
 * disent alors tous deux « n'en découle pas ».
 */
export const BINAIRES = [
  'il découle nécessairement des prémisses',
  'il n’en découle pas',
];
