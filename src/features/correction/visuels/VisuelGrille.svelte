<script lang="ts">
  /**
   * Une grille de cases : suites, tables de vérité, raisonnement logique.
   *
   * Comme le tableau, elle reste une `<table>`. La différence tient à l'usage :
   * les cases y sont souvent **vides à trouver**, et une case vide marquée
   * `possible` ou `exclu` se lit alors comme une déduction en cours.
   */
  import { MARQUEURS } from '../vocabulaire';
  import type { DonneesGrille } from './types';

  let { donnees, alt }: { donnees: DonneesGrille; alt: string } = $props();

  const caseDe = (x: number, y: number) => donnees.cases?.find((c) => c.x === x && c.y === y);
  const colonnes = $derived(Array.from({ length: donnees.colonnes }, (_, i) => i));
  const lignes = $derived(Array.from({ length: donnees.lignes }, (_, i) => i));
  const avecEntetesLignes = $derived((donnees.entetesLignes?.length ?? 0) > 0);
</script>

<div class="my-3 overflow-x-auto">
  <table class="text-sm" aria-label={alt}>
    {#if donnees.entetesColonnes?.length}
      <thead>
        <tr>
          {#if avecEntetesLignes}<th class="border border-transparent"></th>{/if}
          {#each donnees.entetesColonnes as entete, i (i)}
            <th
              class="border border-slate-200 bg-slate-100 px-2 py-1 font-semibold text-slate-700
                dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">{entete}</th
            >
          {/each}
        </tr>
      </thead>
    {/if}
    <tbody>
      {#each lignes as y (y)}
        <tr>
          {#if avecEntetesLignes}
            <th
              class="border border-slate-200 bg-slate-100 px-2 py-1 text-left font-semibold
                text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
              >{donnees.entetesLignes?.[y] ?? ''}</th
            >
          {/if}
          {#each colonnes as x (x)}
            {@const c = caseDe(x, y)}
            <td
              class="h-9 min-w-9 border border-slate-200 px-2 py-1 text-center dark:border-slate-800
                {c?.marqueur ? 'font-semibold' : 'text-slate-700 dark:text-slate-300'}"
            >
              {#if c?.marqueur}
                <span aria-hidden="true" style="color: {MARQUEURS[c.marqueur].couleur}"
                  >{MARQUEURS[c.marqueur].glyphe}</span
                >
                <span class="sr-only">{MARQUEURS[c.marqueur].libelle}{c.valeur ? ' :' : ''}</span>
              {/if}
              {c?.valeur ?? ''}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
