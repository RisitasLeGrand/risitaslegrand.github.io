/**
 * Le tirage des nombres, et la garantie que la division tombe juste.
 *
 * ## Le défaut de la référence, et pourquoi la correction est si simple
 *
 * En mode quotient, le résultat attendu est `référence ÷ courant`. Pour qu'il
 * soit entier, le courant doit DIVISER la référence. La référence tire son
 * nombre sans cette contrainte dès que le minimum de la plage dépasse 1, et
 * l'essai attend alors un nombre à virgule que personne ne peut saisir.
 *
 * La correction tient en une observation : les deux nombres sont tirés dans la
 * même plage `[min, max]`, donc la référence est elle-même un diviseur d'elle-
 * même ET dans la plage. L'ensemble des diviseurs admissibles n'est donc JAMAIS
 * vide, et il n'y a pas de cas à rattraper.
 *
 * Deux conséquences à connaître plutôt qu'à masquer :
 *
 *   - quand la référence est un nombre premier et que le minimum dépasse 1, le
 *     seul diviseur admissible est la référence elle-même, et le résultat vaut
 *     donc 1. Sur une plage de 2 à 9, un essai de quotient sur 7 attendra
 *     toujours 1. C'est le prix de l'exactitude, et il est visible ;
 *   - zéro ne peut jamais être le courant d'un quotient. Il reste tirable comme
 *     référence — zéro divisé par n'importe quoi vaut zéro, ce qui est un essai
 *     parfaitement valide.
 */
import type { Operation } from './types';

/**
 * Le hasard, injecté.
 *
 * Rend un nombre dans `[0, 1[`, comme `Math.random`. Il entre par un paramètre
 * pour que les essais soient reproductibles : un moteur qui tire en cachette ne
 * s'éprouve pas, il se regarde.
 */
export type Hasard = () => number;

/** Un entier de `min` à `max`, bornes comprises. */
export function entierEntre(hasard: Hasard, min: number, max: number): number {
  if (max < min) return min;
  return min + Math.floor(hasard() * (max - min + 1));
}

/**
 * Les diviseurs de `reference` qui tiennent dans la plage, zéro exclu.
 *
 * Exporté parce que c'est la garantie elle-même : un essai peut vérifier que
 * cet ensemble n'est jamais vide, pour toute plage et toute référence tirable.
 */
export function diviseursAdmissibles(reference: number, min: number, max: number): number[] {
  const admissibles: number[] = [];
  const bas = Math.max(1, min);
  for (let d = bas; d <= max; d += 1) {
    if (reference % d === 0) admissibles.push(d);
  }
  return admissibles;
}

/**
 * Le prochain nombre à présenter.
 *
 * `reference` est le nombre d'il y a n positions, ou `null` pendant
 * l'échauffement — où aucune contrainte ne s'applique, puisqu'il n'y a rien à
 * calculer.
 */
export function prochainNombre(
  hasard: Hasard,
  operation: Operation,
  reference: number | null,
  min: number,
  max: number,
): number {
  if (operation !== 'quotient' || reference === null) {
    return entierEntre(hasard, min, max);
  }
  /* Zéro en référence : tout diviseur convient, le résultat vaudra zéro. */
  if (reference === 0) return entierEntre(hasard, Math.max(1, min), max);
  const admissibles = diviseursAdmissibles(reference, min, max);
  /* Jamais vide : la référence est dans la plage et se divise elle-même. On
     garde malgré tout le repli, parce qu'une plage incohérente — un minimum
     au-dessus du maximum — rendrait une liste vide, et qu'un `undefined` qui
     file jusqu'au calcul coûte plus cher à comprendre qu'un nombre valide. */
  if (!admissibles.length) return Math.max(1, min);
  return admissibles[Math.floor(hasard() * admissibles.length)];
}
