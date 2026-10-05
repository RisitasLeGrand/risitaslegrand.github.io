<script lang="ts">
  /**
   * La correction détaillée d'une question de QCM.
   *
   * Elle n'est pas calculée mais **rédigée** : la question vient d'une banque, il
   * n'y a aucune dérivation à produire. Ce composant ne fait donc que la mettre
   * en forme — et ce choix de mise en forme est tout ce qu'il apporte.
   *
   * ## L'ordre suit la réponse donnée
   *
   * C'est le seul endroit où la correction s'adapte. Le contenu ne change pas —
   * il est écrit une fois pour toutes — mais **l'option que vous avez choisie
   * passe en premier** quand elle est fausse, parce que c'est la question qu'on
   * se pose : « et ce que j'ai répondu, alors ? ». La bonne réponse vient
   * ensuite, puis les autres dans l'ordre de l'énoncé.
   *
   * Quand la réponse est juste, aucun réordonnancement : l'ordre de l'énoncé est
   * alors le plus lisible, et déplacer les options donnerait l'impression d'une
   * erreur là où il n'y en a pas.
   *
   * ## La confiance est affichée, et elle est rare à être moyenne
   *
   * Une correction marquée « moyenne » le dit, et dit pourquoi par ses sources.
   * Cacher l'incertitude serait pire que de l'avouer : une révision se fait
   * contre un texte officiel, et savoir qu'il faut aller le vérifier fait
   * partie de ce qu'on apprend.
   */
  import Visuel from '../visuels/Visuel.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import type { Correction } from '../../../lib/contenu';
  import type { Visuel as TypeVisuel } from '../visuels/types';

  let {
    correction,
    options,
    bonnes,
    choisies = [],
    lienFiche,
    fermer,
  }: {
    correction: Correction;
    options: string[];
    bonnes: number[];
    /** Les rangs cochés par la personne. Vide si elle n'a pas répondu. */
    choisies?: readonly number[];
    /** Comment fabriquer le lien d'une fiche, si l'appelant sait le faire. */
    lienFiche?: (id: string) => string;
    fermer?: () => void;
  } = $props();

  const juste = $derived(
    choisies.length === bonnes.length && bonnes.every((i) => choisies.includes(i)),
  );

  /** Les rangs d'options, réordonnés selon la réponse donnée. */
  const ordre = $derived.by(() => {
    const rangs = options.map((_, i) => i);
    if (juste) return rangs;
    const miennesFausses = rangs.filter((i) => choisies.includes(i) && !bonnes.includes(i));
    const justes = rangs.filter((i) => bonnes.includes(i));
    const reste = rangs.filter((i) => !miennesFausses.includes(i) && !justes.includes(i));
    return [...miennesFausses, ...justes, ...reste];
  });

  const marqueurDe = (i: number) =>
    bonnes.includes(i) ? 'bonne-reponse' : choisies.includes(i) ? 'ta-reponse' : 'exclu';
</script>

<section
  class="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-left
    dark:border-indigo-900 dark:bg-indigo-950/20"
  aria-label="Correction détaillée"
>
  <header class="flex flex-wrap items-baseline justify-between gap-2">
    <h3 class="font-semibold text-slate-900 dark:text-white">Correction détaillée</h3>
    {#if fermer}
      <button
        type="button"
        onclick={fermer}
        class="rounded-md px-2 py-1 text-xs font-medium text-slate-600 underline
          hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      >Replier</button>
    {/if}
  </header>

  <p class="mt-2 text-sm font-medium text-slate-900 dark:text-white">{correction.resume}</p>

  <!-- Le visuel vient avant le texte : c'est le principe du lot B, et il vaut
       autant pour une correction rédigée que pour une correction calculée. -->
  <Visuel visuel={correction.visuel as TypeVisuel} />

  <ul class="mt-3 space-y-1.5">
    {#each ordre as i (i)}
      {@const marqueur = marqueurDe(i)}
      {@const verdict = correction.par_option[i]}
      <li
        class="flex items-baseline gap-2 rounded px-1 text-sm
          {marqueur === 'bonne-reponse'
          ? 'text-emerald-800 dark:text-emerald-200'
          : marqueur === 'ta-reponse'
            ? 'text-amber-800 dark:text-amber-200'
            : 'text-slate-600 dark:text-slate-300'}"
      >
        <span aria-hidden="true" style="color: {MARQUEURS[marqueur].couleur}"
          >{MARQUEURS[marqueur].glyphe}</span
        >
        <span class="sr-only">{MARQUEURS[marqueur].libelle} :</span>
        <span>
          <span class="font-medium">{options[i]}</span>
          {#if verdict}<span class="opacity-90"> — {verdict.pourquoi}</span>{/if}
        </span>
      </li>
    {/each}
  </ul>

  <p class="mt-3 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
    {correction.detail}
  </p>

  {#if correction.rappel_de_cours.length}
    <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
      <span class="font-medium">À relire :</span>
      {#each correction.rappel_de_cours as fiche, i (fiche.id || i)}
        {#if i > 0}, {/if}
        {#if lienFiche}
          <a href={lienFiche(fiche.id)} class="text-indigo-700 underline dark:text-indigo-300"
            >{fiche.titre}</a
          >
        {:else}{fiche.titre}{/if}
      {/each}
    </p>
  {/if}

  <footer class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
    {#if correction.confiance === 'moyenne'}
      <span
        class="rounded-full border border-amber-400 px-2 py-0.5 font-medium text-amber-800
          dark:border-amber-600 dark:text-amber-200"
        >Confiance moyenne — à vérifier dans un texte officiel</span
      >
    {/if}
    {#if correction.sources.length}
      <span>
        Source{correction.sources.length > 1 ? 's' : ''} :
        {#each correction.sources as source, i (i)}
          {#if i > 0}, {/if}
          {#if source.url}
            <a href={source.url} rel="noreferrer" class="underline">{source.nom}</a>
          {:else}{source.nom}{/if}
        {/each}
      </span>
    {/if}
  </footer>
</section>
