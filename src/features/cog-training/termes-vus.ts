/**
 * Le registre des termes déjà rencontrés dans l'écran courant.
 *
 * ## À quoi il sert
 *
 * Seule la PREMIÈRE apparition d'un terme technique est interactive. « Seuil »
 * paraît quatre fois dans Correspondance : quatre boutons feraient quatre
 * arrêts de tabulation pour une seule définition, et le quatrième n'apprendrait
 * rien. Le registre dit lequel est le premier.
 *
 * ## Pourquoi il se vide
 *
 * « Premier » veut dire premier de CET écran, et non premier de la session. En
 * passant des réglages au jeu, on recommence à zéro : les mots de l'écran de
 * jeu n'ont pas été lus dans celui des réglages, et une personne qui lance
 * directement une partie n'aurait jamais vu un seul terme cliquable.
 *
 * Le parent appelle donc `vider()` quand l'écran change. C'est lui qui sait ce
 * qu'est un écran — ni le registre ni le terme ne peuvent le deviner.
 */

export const CLEF_TERMES_VUS = Symbol('termes-vus');

export interface TermesVus {
  /** Vrai si c'est la première fois que ce terme est demandé dans l'écran. */
  premier(technique: string): boolean;
  /** À appeler au changement d'écran. */
  vider(): void;
}

export function registreDesTermes(): TermesVus {
  const vus = new Set<string>();
  return {
    premier(technique) {
      if (vus.has(technique)) return false;
      vus.add(technique);
      return true;
    },
    vider() {
      vus.clear();
    },
  };
}
