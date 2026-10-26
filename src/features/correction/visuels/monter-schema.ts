/**
 * Monter un organigramme depuis une page en JavaScript simple.
 *
 * ## Pourquoi un pont, comme pour les corrections
 *
 * `VisuelSchema` est un composant Svelte, et la page des organigrammes est
 * écrite en JavaScript simple, comme les écrans de QCM. En réécrire le rendu
 * en JavaScript aurait donné **deux** organigrammes à tenir à jour, qui
 * auraient divergé au premier ajustement — et la personne aurait vu deux
 * dessins différents pour la même donnée selon l'écran où elle se trouve.
 * C'est le raisonnement de `qcm/monter.ts`, et le même pont de trente lignes.
 *
 * ## Un seul montage par conteneur
 *
 * `monterSchema` démonte le précédent. Sans cela, replier puis déplier un
 * organigramme empilerait les composants : invisibles, puisque le conteneur
 * est vidé, mais bien vivants, avec leur état de bascule.
 */
import { mount, unmount } from 'svelte';
import VisuelSchema from './VisuelSchema.svelte';
import type { DonneesSchema } from './types';

export interface OptionsSchema {
  donnees: DonneesSchema;
  alt: string;
  legende?: string;
}

const montes = new WeakMap<Element, ReturnType<typeof mount>>();

export function monterSchema(cible: HTMLElement, props: OptionsSchema): void {
  demonterSchema(cible);
  cible.innerHTML = '';
  montes.set(cible, mount(VisuelSchema, { target: cible, props }));
}

export function demonterSchema(cible: HTMLElement): void {
  const precedent = montes.get(cible);
  if (!precedent) return;
  void unmount(precedent);
  montes.delete(cible);
}
