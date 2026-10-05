<script lang="ts">
  /**
   * Affiche un bloc d'énoncé, quel qu'en soit le type.
   *
   * C'est le seul point de l'interface qui connaisse les variantes de `Bloc`.
   * Un moteur qui a besoin d'un affichage nouveau ajoute une variante ici, et
   * non un composant de session.
   *
   * ## Les annotations
   *
   * Le même composant sert à poser l'énoncé et à le **corriger**. La correction
   * détaillée lui passe des `annotations`, et l'énoncé porte alors les marqueurs
   * de la trace — la prémisse qui vient de servir, celle qui ne servira jamais,
   * l'entité que l'étape met en jeu.
   *
   * Un second composant d'énoncé « annoté » aurait divergé du premier au premier
   * ajout de variante, et la correction aurait fini par montrer autre chose que
   * ce que la question montrait. C'est précisément ce qu'il faut éviter : la
   * correction doit porter sur **l'énoncé qu'on a vu**.
   */
  import type { Bloc } from '../moteurs/types';
  import type { Annotations } from '../../correction/annotations';
  import { marqueurDePhrase } from '../../correction/annotations';
  import { MARQUEURS } from '../../correction/vocabulaire';
  import Graphe from './Graphe.svelte';
  import Grille from './Grille.svelte';

  let { bloc, annotations = undefined }: { bloc: Bloc; annotations?: Annotations } = $props();

  /** Les entités que la correction met en avant, pour les souligner sur la grille. */
  const enAvant = $derived(
    annotations
      ? [...annotations.elements.entries()]
          .filter(([, marqueur]) => marqueur !== 'inutile')
          .map(([nom]) => nom)
      : [],
  );
</script>

{#if bloc.type === 'texte'}
  <p class="my-2 text-sm text-slate-600 dark:text-slate-300">{bloc.texte}</p>
{:else if bloc.type === 'faits'}
  <ul class="my-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
    {#each bloc.phrases as phrase, i (i)}
      {@const marqueur = annotations ? marqueurDePhrase(annotations, phrase, i) : undefined}
      <li
        class="flex items-baseline gap-2 rounded px-1 font-mono text-sm
          {marqueur === 'inutile'
            ? 'text-slate-400 line-through decoration-slate-400/60 dark:text-slate-500'
            : marqueur
              ? 'bg-indigo-50 font-semibold text-slate-900 dark:bg-indigo-950/40 dark:text-white'
              : 'text-slate-800 dark:text-slate-200'}"
      >
        {#if marqueur}
          <!--
            Le glyphe porte le sens, la couleur ne fait que l'appuyer : une
            correction lisible en noir et blanc est la règle du vocabulaire
            visuel, et une liste de phrases n'y échappe pas.
          -->
          <span aria-hidden="true" style="color: {MARQUEURS[marqueur].couleur}"
            >{MARQUEURS[marqueur].glyphe}</span
          >
          <span class="sr-only">{MARQUEURS[marqueur].libelle} :</span>
        {:else}
          <span aria-hidden="true" class="text-transparent">·</span>
        {/if}
        <span>{phrase}</span>
      </li>
    {/each}
  </ul>
{:else if bloc.type === 'grille'}
  <Grille
    axes={bloc.axes}
    points={bloc.points}
    souligne={enAvant.length ? enAvant : (bloc.souligne ?? [])}
  />
{:else if bloc.type === 'graphe'}
  <Graphe
    noeuds={bloc.noeuds}
    aretes={bloc.aretes}
    manquante={bloc.manquante}
    enAvant={enAvant}
  />
{:else if bloc.type === 'tableau'}
  <!--
    La matrice est l'énoncé entier de deux moteurs d'isomorphisme : sans
    annotation, leur correction se réduirait à du texte alors que la question
    est visuelle. On met donc en avant la **ligne et la colonne** de chaque
    entité que l'étape mobilise : c'est exactement ce qu'on parcourt du doigt
    pour vérifier une relation, et le croisement des deux se voit tout seul.
  -->
  <div class="my-3 overflow-x-auto">
    <table class="text-sm">
      <thead>
        <tr>
          {#each bloc.entetes as entete, i (i)}
            {@const vedette = annotations?.elements.get(entete)}
            <th
              class="border px-2 py-1 font-semibold
                {vedette && vedette !== 'inutile'
                ? 'border-indigo-400 bg-indigo-100 text-indigo-900 dark:border-indigo-600 dark:bg-indigo-950 dark:text-indigo-100'
                : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200'}"
              >{entete}</th
            >
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each bloc.lignes as ligne, i (i)}
          {@const surLigne = annotations?.elements.get(ligne[0])}
          <tr>
            {#each ligne as cellule, j (j)}
              {@const surColonne = annotations?.elements.get(bloc.entetes[j])}
              {@const croisement =
                surLigne &&
                surLigne !== 'inutile' &&
                surColonne &&
                surColonne !== 'inutile' &&
                j > 0}
              <td
                class="border px-2 py-1 text-center
                  {croisement
                  ? 'border-indigo-400 bg-indigo-100 font-semibold text-indigo-900 dark:border-indigo-600 dark:bg-indigo-950 dark:text-indigo-100'
                  : (surLigne && surLigne !== 'inutile') || (surColonne && surColonne !== 'inutile')
                    ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/40'
                    : 'border-slate-200 dark:border-slate-800'}
                  {j === 0
                  ? 'bg-slate-100 font-semibold dark:bg-slate-800'
                  : 'font-mono text-slate-700 dark:text-slate-300'}">{cellule}</td
              >
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
