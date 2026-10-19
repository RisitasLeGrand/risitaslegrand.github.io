/**
 * Les vitesses de diction d'une fiche audio, et la clé qui les retient.
 *
 * ## Pourquoi ces trois constantes vivent seules dans leur fichier
 *
 * Elles sont lues par deux endroits qui ne peuvent pas se parler :
 *
 * - `podcast.ts`, qui règle le lecteur, et qui touche IndexedDB et le
 *   contenu déchiffré ;
 * - `parametres/catalogue.ts`, qui est **pur** — il est lu à la construction
 *   du site pour écrire le HTML de la page des réglages, et l'essai des
 *   orphelins l'importe dans Node, sans navigateur.
 *
 * Si le catalogue importait `podcast.ts`, il tirerait toute la chaîne du
 * contenu et de la base dans un rendu de page et dans un essai sans
 * navigateur. Et recopier la liste des vitesses des deux côtés l'exposerait
 * à diverger — c'est-à-dire à proposer sur la page centrale une vitesse que
 * le lecteur refuse, ou l'inverse. D'où ce fichier : aucune dépendance,
 * aucun effet, une seule source de vérité.
 */

/** Clé de `localStorage` qui retient la vitesse choisie, par appareil. */
export const CLE_VITESSE = 'revinsp.podcast.vitesse';

/** Les vitesses proposées. 1 = la diction telle qu'elle a été synthétisée. */
export const VITESSES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const VITESSE_PAR_DEFAUT = 1;
