/**
 * Le résultat attendu d'un essai.
 *
 * Quatre opérations, et l'ordre des deux termes compte pour deux d'entre elles.
 * La référence est le nombre entendu n positions plus tôt ; le courant est celui
 * qui vient d'être présenté.
 *
 *   somme       courant + référence
 *   difference  référence − courant      (et non l'inverse)
 *   produit     courant × référence
 *   quotient    référence ÷ courant      (et non l'inverse)
 *
 * Deux opérations sur quatre ne sont donc pas commutatives, et c'est exprès :
 * c'est ce qui oblige à retenir LEQUEL des deux nombres était le plus ancien.
 * Les intervertir rendrait l'exercice deux fois plus facile sans le dire.
 */
import type { Operation } from './types';

/**
 * Le résultat attendu, ou `null` quand l'opération ne peut pas se poser.
 *
 * Le seul cas : un quotient dont le courant est zéro, ou dont la division ne
 * tombe pas juste. Le tirage l'empêche (voir `tirage.ts`), mais le calcul ne
 * s'appuie PAS sur cette promesse : il rend `null` plutôt qu'un nombre à
 * virgule, parce qu'un essai qui attend 2,333 est un essai que personne ne peut
 * réussir, et qu'il vaut mieux le voir manquer que le voir noté.
 */
export function resultatAttendu(
  operation: Operation,
  courant: number,
  reference: number,
): number | null {
  switch (operation) {
    case 'somme':
      return courant + reference;
    case 'difference':
      return reference - courant;
    case 'produit':
      return courant * reference;
    case 'quotient': {
      if (courant === 0) return null;
      const quotient = reference / courant;
      return Number.isInteger(quotient) ? quotient : null;
    }
  }
}

/** Le libellé français d'une opération, pour l'écran et la correction. */
export const LIBELLE_OPERATION: Readonly<Record<Operation, string>> = Object.freeze({
  somme: 'somme',
  difference: 'différence',
  produit: 'produit',
  quotient: 'quotient',
});

/** Le signe, pour l'affichage compact d'un essai dans la correction. */
export const SIGNE_OPERATION: Readonly<Record<Operation, string>> = Object.freeze({
  somme: '+',
  difference: '−',
  produit: '×',
  quotient: '÷',
});
