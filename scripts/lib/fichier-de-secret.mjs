/**
 * Où un fichier de mot de passe a le droit d'être : PAS dans le dépôt.
 *
 * ## Pourquoi cette règle vit dans un module à elle
 *
 * Deux outils la portent — `archiver-corpus.mts` et `recuperer-corpus.mts` —
 * et le second l'a d'abord reçue en copie du premier. Une règle de sécurité
 * recopiée est une règle qui finira par différer d'un outil à l'autre, et la
 * version qui divergera sera celle qu'on n'éprouve pas. Elle est donc écrite
 * une fois, employée deux fois, et éprouvée une fois pour les deux.
 *
 * ## La règle, et le piège qu'elle évite
 *
 * Un chemin est « dans le dépôt » s'il EST la racine, ou s'il commence par la
 * racine SUIVIE DU SÉPARATEUR. Le séparateur n'est pas un détail :
 * `startsWith(racine)` seul refuserait `…/revinsp-secrets`, qui est un dossier
 * voisin parfaitement légitime, et dire « c'est dans le dépôt » d'un dossier
 * qui n'y est pas ferait chercher une faute inexistante.
 *
 * Le chemin est résolu avant comparaison : un `../` suffirait sinon à sortir
 * d'un dépôt dont on vient de dire qu'on y était.
 */
import path from 'node:path';

/** La racine du dépôt, déduite de la place de ce module. */
export const RACINE_DEPOT = path.resolve(import.meta.dirname, '..', '..');

/**
 * Ce chemin est-il dans le dépôt ?
 *
 * @param {string} chemin  Un chemin, relatif ou absolu.
 * @param {string} [racine]  La racine à comparer ; celle du dépôt par défaut.
 *   Le paramètre existe pour que l'essai puisse poser ses propres cas sans
 *   dépendre de l'endroit où le dépôt est rangé sur la machine.
 * @returns {boolean}
 */
export function estDansLeDepot(chemin, racine = RACINE_DEPOT) {
  const abs = path.resolve(chemin);
  const base = path.resolve(racine);
  return abs === base || abs.startsWith(base + path.sep);
}
