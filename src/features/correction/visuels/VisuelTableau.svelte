<script lang="ts">
  /**
   * Un tableau comparatif, avec ses cellules mises en avant.
   *
   * Rendu en `<table>` et non en SVG : un tableau **est** un tableau, et le
   * rendre en dessin lui ôterait sa structure — donc sa lecture au lecteur
   * d'écran, et la possibilité de le sélectionner ou de le copier.
   */
  import { MARQUEURS } from '../vocabulaire';
  import Legende from '../composants/Legende.svelte';
  import { marqueursDuVisuel } from './types';
  import type { DonneesTableau } from './types';

  let { donnees, alt }: { donnees: DonneesTableau; alt: string } = $props();

  const marqueurDe = (ligne: number, colonne: number) =>
    donnees.marques?.find((m) => m.ligne === ligne && m.colonne === colonne)?.marqueur;
</script>

<div class="my-3 overflow-x-auto">
  <table class="w-full text-sm" aria-label={alt}>
    <thead>
      <tr>
        {#each donnees.entetes as entete, i (i)}
          <th
            class="border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold
              text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >{entete}</th
          >
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each donnees.lignes as ligne, i (i)}
        <tr>
          {#each ligne as cellule, j (j)}
            {@const marqueur = marqueurDe(i, j)}
            <td
              class="border border-slate-200 px-2 py-1.5 align-top dark:border-slate-800
                {marqueur ? 'font-medium' : ''}"
            >
              {#if marqueur}
                <span aria-hidden="true" style="color: {MARQUEURS[marqueur].couleur}"
                  >{MARQUEURS[marqueur].glyphe}</span
                >
                <span class="sr-only">{MARQUEURS[marqueur].libelle} :</span>
              {/if}
              {cellule}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<!-- Les visuels en HTML portent leur légende comme ceux en SVG : sans elle, les
     glyphes « ▣ » et « ⇢ » restent sans clef, alors que tout l'intérêt du
     vocabulaire commun est de s'apprendre une fois et de se relire partout. -->
<Legende marqueurs={marqueursDuVisuel(donnees)} />
