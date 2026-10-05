<script lang="ts">
  /**
   * Un texte découpé en segments étiquetés : sujet, verbe, accord, règle.
   *
   * Rendu en texte courant, et non en dessin, pour une raison de fond : ce qu'il
   * faut voir, c'est **le texte lui-même**. Le mettre en image le rendrait
   * illisible aux lecteurs d'écran et impossible à agrandir sans flou, pour ne
   * gagner qu'une mise en page.
   *
   * L'étiquette est posée en exposant sous le segment, et le marqueur porte sa
   * forme devant : la couleur ne fait qu'appuyer, comme partout ailleurs.
   */
  import { MARQUEURS } from '../vocabulaire';
  import type { DonneesTexteAnnote } from './types';

  let { donnees, alt }: { donnees: DonneesTexteAnnote; alt: string } = $props();
</script>

<p class="my-3 flex flex-wrap items-end gap-x-1 gap-y-3 leading-relaxed" aria-label={alt}>
  {#each donnees.segments as segment, i (i)}
    {#if segment.etiquette || segment.marqueur}
      <span class="inline-flex flex-col items-center">
        <span
          class="rounded px-1 {segment.marqueur
            ? 'bg-indigo-50 font-medium text-slate-900 dark:bg-indigo-950/40 dark:text-white'
            : ''}"
        >
          {#if segment.marqueur}
            <span aria-hidden="true" style="color: {MARQUEURS[segment.marqueur].couleur}"
              >{MARQUEURS[segment.marqueur].glyphe}</span
            >
            <span class="sr-only">{MARQUEURS[segment.marqueur].libelle} :</span>
          {/if}{segment.texte}
        </span>
        {#if segment.etiquette}
          <span class="mt-0.5 text-[11px] uppercase tracking-wide text-indigo-700 dark:text-indigo-300"
            >{segment.etiquette}</span
          >
        {/if}
      </span>
    {:else}
      <span class="text-slate-700 dark:text-slate-300">{segment.texte}</span>
    {/if}
  {/each}
</p>
