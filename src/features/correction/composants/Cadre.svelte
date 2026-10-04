<script lang="ts">
  /**
   * L'enveloppe commune de tous les schémas de correction.
   *
   * Elle porte ce qu'on oublie sinon une fois sur deux : l'alternative
   * textuelle obligatoire, la légende des seuls marqueurs employés, le motif de
   * hachures partagé, et un `viewBox` qui met le dessin à l'échelle du
   * conteneur — c'est ce qui évite le défilement horizontal sur téléphone, que
   * les schémas à largeur fixe provoquent immanquablement.
   */
  import Legende from './Legende.svelte';
  import type { Marqueur } from '../vocabulaire';
  import type { Snippet } from 'svelte';

  let {
    largeur = 320,
    hauteur = 200,
    alt,
    marqueurs = [],
    titre,
    children,
  }: {
    largeur?: number;
    hauteur?: number;
    /** Obligatoire : ce que lit un lecteur d'écran à la place du dessin. */
    alt: string;
    marqueurs?: Marqueur[];
    /** La légende en une phrase, sous le schéma. */
    titre?: string;
    children?: Snippet;
  } = $props();
</script>

<figure class="my-3">
  <svg
    viewBox="0 0 {largeur} {hauteur}"
    class="h-auto w-full"
    style="max-width: {largeur}px"
    role="img"
    aria-label={alt}
  >
    <defs>
      <!-- Les hachures servent aux surfaces exclues et à « votre réponse » :
           une trame reste visible là où une teinte seule ne l'est pas. -->
      <pattern id="hachures-correction" width="5" height="5" patternTransform="rotate(45)"
        patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" stroke-width="1.2" opacity="0.35" />
      </pattern>
      <marker id="fleche-correction" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5"
        markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
      </marker>
    </defs>
    {@render children?.()}
  </svg>

  <Legende {marqueurs} />

  {#if titre}
    <figcaption class="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{titre}</figcaption>
  {/if}
</figure>
