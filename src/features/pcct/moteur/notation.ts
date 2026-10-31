/**
 * Les trois scores d'une séance.
 *
 * Arithmétique, mémoire prospective, et global. Chacun peut valoir `null`, et
 * `null` n'est pas zéro : c'est « rien n'a été mesuré ». Une séance de
 * découverte sans mémoire prospective n'a pas un score prospectif de 0 %, elle
 * n'en a pas. Les confondre afficherait un échec là où il n'y a pas d'épreuve,
 * et ferait chuter le global de moitié pour une épreuve qu'on n'a pas passée.
 */
import type { Scores } from './types';

export interface ComptesArithmetique {
  /** Essais notés : l'échauffement n'en fait pas partie. */
  notes: number;
  justes: number;
}

/** Les deux scores élémentaires, puis leur moyenne sur les seuls présents. */
export function scores(
  arith: ComptesArithmetique,
  scoreProspectif: number | null,
): Scores {
  const arithmetique = arith.notes > 0 ? arith.justes / arith.notes : null;
  const presents = [arithmetique, scoreProspectif].filter(
    (valeur): valeur is number => valeur !== null,
  );
  return {
    arithmetique,
    prospective: scoreProspectif,
    global: presents.length ? presents.reduce((a, b) => a + b, 0) / presents.length : null,
  };
}

/**
 * La médiane d'une série, ou `null` si elle est vide.
 *
 * Médiane et non moyenne : un seul temps de réaction aberrant — un éternuement,
 * une notification — déplace une moyenne de plusieurs centaines de millisecondes
 * sur une série de trente essais, et ce déplacement se lirait comme un progrès
 * ou un recul qui n'a pas eu lieu.
 */
export function mediane(serie: readonly number[]): number | null {
  if (!serie.length) return null;
  const triee = [...serie].sort((a, b) => a - b);
  const milieu = Math.floor(triee.length / 2);
  return triee.length % 2 ? triee[milieu] : (triee[milieu - 1] + triee[milieu]) / 2;
}

/** Le quantile 90 d'une série, ou `null` si elle est vide. */
export function p90(serie: readonly number[]): number | null {
  if (!serie.length) return null;
  const triee = [...serie].sort((a, b) => a - b);
  const rang = Math.min(triee.length - 1, Math.ceil(0.9 * triee.length) - 1);
  return triee[Math.max(0, rang)];
}
