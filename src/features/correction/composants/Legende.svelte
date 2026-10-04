<script lang="ts">
  /**
   * La légende d'un schéma : les seuls marqueurs qu'il emploie, dans un ordre
   * stable.
   *
   * On n'affiche pas les sept marqueurs à chaque fois : une légende qui décrit
   * ce qui n'est pas dessiné fait chercher ce qui n'existe pas. Et chaque
   * entrée porte le glyphe en texte, de sorte que la légende reste
   * compréhensible même si le dessin ne s'affiche pas.
   */
  import { legende, type Marqueur } from '../vocabulaire';
  import MarqueurSvg from './Marqueur.svelte';

  let { marqueurs = [] as Marqueur[] }: { marqueurs: Marqueur[] } = $props();
  const entrees = $derived(legende(marqueurs));
</script>

{#if entrees.length > 0}
  <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
    {#each entrees as entree (entree.marqueur)}
      <li class="flex items-center gap-1.5">
        <svg viewBox="0 0 12 12" class="h-3 w-3 shrink-0" aria-hidden="true">
          <MarqueurSvg marqueur={entree.marqueur} x={6} y={6} taille={9} />
        </svg>
        <span><span class="sr-only">{entree.style.glyphe} </span>{entree.style.libelle}</span>
      </li>
    {/each}
  </ul>
{/if}
