/**
 * Monter la correction d'un QCM depuis une page en JavaScript simple.
 *
 * ## Pourquoi un pont, plutôt qu'un second rendu
 *
 * Les écrans de QCM — quiz de cours, QCM DGFiP — ne sont pas écrits en Svelte :
 * ils manipulent le DOM directement, et c'est très bien ainsi pour ce qu'ils
 * font. Mais la correction, elle, partage ses composants avec Cog-Training : les
 * huit visuels déclaratifs, le vocabulaire de marqueurs, la légende.
 *
 * En réécrire un rendu en JavaScript simple aurait donné **deux** corrections à
 * tenir à jour, qui auraient divergé au premier ajout de type de visuel — et la
 * personne aurait alors vu deux présentations différentes pour la même chose
 * selon l'écran où elle se trouve. Un pont de trente lignes évite cela.
 *
 * ## Une seule correction à l'écran à la fois
 *
 * `monterCorrection` démonte la précédente avant d'en monter une autre. Sans
 * cela, enchaîner les questions empilerait les composants : invisibles, puisque
 * leur conteneur est vidé, mais bien vivants, avec leurs effets et leur mémoire.
 */
import { mount, unmount } from 'svelte';
import CorrectionQcm from './CorrectionQcm.svelte';
import type { Correction } from '../../../lib/contenu';

export interface OptionsCorrection {
  correction: Correction;
  options: string[];
  bonnes: number[];
  choisies?: readonly number[];
  lienFiche?: (id: string) => string;
  fermer?: () => void;
}

/** Les corrections montées, par conteneur, pour pouvoir les démonter. */
const montees = new WeakMap<Element, ReturnType<typeof mount>>();

export function monterCorrection(cible: HTMLElement, props: OptionsCorrection): void {
  demonterCorrection(cible);
  cible.innerHTML = '';
  montees.set(cible, mount(CorrectionQcm, { target: cible, props }));
}

export function demonterCorrection(cible: HTMLElement): void {
  const precedente = montees.get(cible);
  if (!precedente) return;
  void unmount(precedente);
  montees.delete(cible);
  cible.innerHTML = '';
}
