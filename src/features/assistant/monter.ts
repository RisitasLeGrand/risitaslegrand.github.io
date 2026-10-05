/**
 * Ouvrir la fenêtre « Demander à l'IA » depuis une page en JavaScript simple.
 *
 * Même raison que pour la correction de QCM : les écrans de quiz, de
 * flashcards, de fiche et d'actualités manipulent le DOM directement, et
 * réécrire la fenêtre en JavaScript simple aurait donné **deux** fenêtres à
 * tenir à jour. Trente lignes de pont l'évitent.
 *
 * La fenêtre est montée dans un conteneur **créé à la volée et détruit à la
 * fermeture** : elle n'a pas d'emplacement réservé dans les pages, puisqu'elle
 * est modale et qu'il n'y en a jamais deux.
 */
import { mount, unmount } from 'svelte';
import DemanderALIA from './composants/DemanderALIA.svelte';
import type { Contexte, OptionsDeContexte } from './contexte';

export interface OuvertureAssistant {
  construireContexte: (options: OptionsDeContexte) => Promise<Contexte>;
  titre?: string;
  itemId?: string;
  matiere?: string;
}

let ouverte: { composant: ReturnType<typeof mount>; hote: HTMLElement } | null = null;

export function fermerAssistant(): void {
  if (!ouverte) return;
  const { composant, hote } = ouverte;
  ouverte = null;
  void unmount(composant);
  hote.remove();
}

export function ouvrirAssistant(options: OuvertureAssistant): void {
  fermerAssistant();
  const hote = document.createElement('div');
  document.body.appendChild(hote);
  ouverte = {
    hote,
    composant: mount(DemanderALIA, {
      target: hote,
      props: { ...options, fermer: fermerAssistant },
    }),
  };
}

/**
 * Le bouton standard, pour que les neuf emplacements se ressemblent.
 *
 * Un bouton fabriqué neuf à chaque appel, et non un gabarit partagé : les
 * pages l'insèrent à des endroits différents, et un nœud unique déplacé d'un
 * endroit à l'autre disparaîtrait du premier.
 */
export function boutonAssistant(
  options: OuvertureAssistant,
  libelle = 'Demander à l’IA',
): HTMLButtonElement {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className =
    'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ' +
    'transition hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-700 ' +
    'dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:text-indigo-300';
  bouton.textContent = libelle;
  bouton.addEventListener('click', () => ouvrirAssistant(options));
  return bouton;
}
