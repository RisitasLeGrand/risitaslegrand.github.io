<script lang="ts">
  /**
   * Un texte découpé en segments étiquetés : sujet, verbe, accord, règle.
   *
   * Rendu en texte courant, et non en dessin, pour une raison de fond : ce qu'il
   * faut voir, c'est **le texte lui-même**. Le mettre en image le rendrait
   * illisible aux lecteurs d'écran et impossible à agrandir sans flou, pour ne
   * gagner qu'une mise en page.
   *
   * L'étiquette est posée sous le segment, et le marqueur porte sa forme devant :
   * la couleur ne fait qu'appuyer, comme partout ailleurs.
   *
   * ## Les segments s'alignent sur la ligne de base, et non sur le bas
   *
   * Un segment étiqueté est une colonne — son texte, puis son étiquette — et la
   * première version alignait ces colonnes **par le bas**. L'étiquette venant
   * s'ajouter sous le texte, le segment annoté se trouvait remonté d'une
   * hauteur d'étiquette au-dessus du texte courant : la citation se lisait en
   * escalier, et « régulièrement ratifiés ou approuvés » apparaissait au-dessus
   * des mots qui le précèdent. Autrement dit, l'ordre de lecture était faux.
   *
   * L'alignement sur la **ligne de base** remet tous les textes sur la même
   * ligne et laisse les étiquettes descendre sous elle, là où elles ne gênent
   * rien.
   */
  import { MARQUEURS } from '../vocabulaire';
  import Legende from '../composants/Legende.svelte';
  import { marqueursDuVisuel } from './types';
  import type { DonneesTexteAnnote } from './types';

  let { donnees, alt }: { donnees: DonneesTexteAnnote; alt: string } = $props();
</script>

<p class="my-3 flex flex-wrap items-baseline gap-x-1 gap-y-4 leading-relaxed" aria-label={alt}>
  {#each donnees.segments as segment, i (i)}
    {#if segment.etiquette || segment.marqueur}
      <span class="inline-flex flex-col items-start">
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

<!-- Les visuels en HTML portent leur légende comme ceux en SVG : sans elle, les
     glyphes « ▣ » et « ⇢ » restent sans clef, alors que tout l'intérêt du
     vocabulaire commun est de s'apprendre une fois et de se relire partout. -->
<Legende marqueurs={marqueursDuVisuel(donnees)} />
