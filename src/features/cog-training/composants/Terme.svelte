<!--
  Un terme du glossaire, dans une phrase : « le mot simple (le terme technique) ».

  ## Ce que ce composant fait, et ce qu'il refuse de faire

  Le terme technique entre parenthèses EST la commande — pas un bouton de plus
  posé à côté du mot. Le toucher ouvre le mini-glossaire sur son entrée, mise en
  évidence. La définition reste donc en un seul endroit : la répéter en bulle
  aurait créé dix-sept textes à garder d'accord avec la table.

  ## Seule la première occurrence d'un écran est interactive

  « Seuil » paraît quatre fois dans Correspondance. Quatre boutons feraient
  quatre arrêts de tabulation pour une même définition, et le quatrième
  n'apprendrait rien à personne. Les suivantes restent du texte brut, dans la
  même forme — ce qui compte est que le mot simple soit là, pas qu'il soit
  cliquable.

  Le registre des termes déjà vus vient du parent par le contexte, et le parent
  le vide quand l'écran change : « premier » veut dire premier de CET écran, pas
  premier de la session.

  ## L'aspect

  Un soulignement pointillé, et rien d'autre : ni couleur d'action, ni icône. Le
  terme est une note de bas de page, pas un appel à l'action — le lecteur est au
  milieu d'une phrase, et on ne lui demande pas de sortir.
-->
<script lang="ts">
  import { getContext } from 'svelte';
  import { GLOSSAIRE } from '../glossaire';
  import { glossaireOuvert } from '../glossaire-ouvert.svelte';
  import { CLEF_TERMES_VUS, type TermesVus } from '../termes-vus';

  interface Props {
    /** Le terme technique, tel qu'il figure à la table. */
    technique: string;
    /**
     * Le mot simple, quand la phrase impose une autre tournure que celle de la
     * table — « une règle que suit une relation » au lieu de « la règle… ».
     * Omis, celui de la table est employé.
     */
    simple?: string;
    /**
     * La forme AFFICHÉE du terme technique, quand elle porte une valeur.
     *
     * Le prompt écrit « 2 tours en arrière (n = 2) », et non « (n) » : le
     * terme s'écrit avec sa valeur là où il en a une. Le terme CANONIQUE ne
     * change pas pour autant — c'est lui qui sert à retrouver l'entrée du
     * glossaire et à nommer le bouton, et il doit rester stable.
     */
    forme?: string;
  }

  let { technique, simple, forme }: Props = $props();

  const terme = GLOSSAIRE.find((t) => t.technique === technique);
  const vus = getContext<TermesVus | undefined>(CLEF_TERMES_VUS);

  /*
     La décision est prise UNE FOIS, à la construction, et non dans un
     « $derived » : un terme qui deviendrait cliquable ou non au fil des
     rendus déplacerait les arrêts de tabulation sous les doigts.
  */
  const premier = vus ? vus.premier(technique) : true;

  let bouton = $state<HTMLButtonElement | null>(null);
</script>

{#if !terme}
  <!-- Terme absent de la table : on rend le mot nu plutôt que rien. -->
  {technique}
{:else}
  {simple ?? terme.simple}
  {#if premier}
    <button
      bind:this={bouton}
      type="button"
      data-terme={technique}
      onclick={() => glossaireOuvert.ouvrir(technique, bouton)}
      aria-label={`Définition : ${technique}`}
      class="cible-terme font-normal text-slate-500 underline decoration-dotted underline-offset-2
        hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
    >({forme ?? terme.technique})</button>
  {:else}
    <span class="font-normal text-slate-500 dark:text-slate-400">({forme ?? terme.technique})</span>
  {/if}
{/if}

<style>
  /*
     LA CIBLE EST ÉTENDUE, PAS LE MOT.

     Le plancher du 42 est de 44 px, et un terme au milieu d'une phrase ne peut
     pas faire 44 px de haut sans défoncer l'interligne. La zone touchable est
     donc agrandie par un pseudo-élément, qui déborde au-dessus et en dessous
     sans rien déplacer — c'est la seule façon de tenir les deux exigences à la
     fois.
  */
  .cible-terme {
    position: relative;
  }

  .cible-terme::after {
    content: '';
    position: absolute;
    /* 0,8 rem de chaque côté : à 0,75, « arête » mesurait 43 px — un de
       moins que le plancher, mesuré par l'essai. */
    inset-block: -0.8rem;
    inset-inline: -0.25rem;
  }
</style>
