<script lang="ts">
  /**
   * La correction détaillée d'un item : le visuel d'abord, le texte ensuite.
   *
   * L'ordre des trois parties n'est pas un choix de mise en page, c'est le
   * principe de l'écran.
   *
   * **1. Ce que vous avez répondu, en face de la bonne réponse.** C'est la
   * question qu'on se pose en premier, et la laisser sans réponse pour
   * commencer par un exposé fait relire l'exposé sans le lire. Quand la réponse
   * donnée porte une **étiquette d'erreur**, son diagnostic est affiché ici :
   * « vous avez pris la relation inverse » apprend quelque chose que « faux »
   * n'apprend pas.
   *
   * **2. L'énoncé annoté, qui se construit pas à pas.** Le même énoncé que la
   * question montrait — le même composant `Bloc`, pas une seconde version —,
   * avec les marqueurs de la trace. On avance d'une étape et la prémisse
   * s'allume ; celles qui ne serviront jamais sont barrées dès le départ.
   *
   * **3. Le raisonnement en mots**, étape par étape, à côté du visuel.
   *
   * ## Tout ce qui dépend de l'étape vit dans le `snippet`
   *
   * `Deroule` détient le compteur d'étapes et le passe à son contenu. On ne le
   * recopie donc pas dans un `$state` local : écrire un état pendant le rendu du
   * parent est le genre de boucle qui ne se voit qu'à l'exécution. Les
   * annotations, la légende et la liste des étapes sont recalculées depuis le
   * compteur reçu, et rien n'est dupliqué.
   *
   * ## Ce que ce composant ne fait pas
   *
   * Il n'appelle aucun service, et ne calcule aucune réponse. La trace lui est
   * **donnée** par le solveur qui a produit l'item : s'il recalculait quoi que
   * ce soit, il y aurait deux raisonnements dans le site et rien ne garantirait
   * qu'ils concordent. Un item sans trace n'ouvre pas cet écran — l'appelant ne
   * propose alors pas le bouton.
   */
  import { annoter, marqueursEmployes, reponseJuste, type Donnee } from '../annotations';
  import { DIAGNOSTIC } from '../trace';
  import type { Item, Option, Reponse } from '../../relational-reasoning/moteurs/types';
  import type { TraceResolution } from '../trace';
  import Bloc from '../../relational-reasoning/composants/Bloc.svelte';
  import Deroule from './Deroule.svelte';
  import Legende from './Legende.svelte';
  import { MARQUEURS } from '../vocabulaire';

  let {
    item,
    reponse,
    trace,
    donnee,
    fermer,
  }: {
    item: Item;
    reponse: Reponse;
    trace: TraceResolution;
    donnee: Donnee | null;
    fermer?: () => void;
  } = $props();

  const juste = $derived(reponseJuste(reponse, donnee));

  const options = $derived(
    reponse.genre === 'appariement' ? ([] as Option[]) : (reponse.options as Option[]),
  );

  /**
   * L'étiquette portée par la réponse donnée, s'il y en a une.
   *
   * Une étiquette n'est jamais posée au hasard par les moteurs : elle n'est là
   * que quand l'erreur est identifiable. Son absence est donc une information,
   * et l'écran ne la remplace pas par une formule creuse.
   */
  const etiquette = $derived(
    !juste && donnee?.genre === 'unique' && donnee.choix !== null
      ? options[donnee.choix]?.etiquette
      : undefined,
  );

  function nommer(i: number | null | undefined): string {
    if (i === null || i === undefined) return 'aucune';
    const texte = options[i]?.texte?.trim();
    return texte ? `« ${texte} »` : `la proposition ${i + 1}`;
  }

  function nommerPlusieurs(indices: readonly number[]): string {
    if (!indices.length) return 'aucune';
    return indices.map((i) => nommer(i)).join(', ');
  }

  const paires = $derived(reponse.genre === 'appariement' ? reponse.paires : {});
</script>

<section
  class="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20"
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

  <!-- 1. Votre réponse, en face de la bonne. -->
  <div class="mt-3 grid gap-2 sm:grid-cols-2">
    <p
      class="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800
        dark:bg-slate-900"
    >
      <span
        class="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        <span aria-hidden="true" style="color: {MARQUEURS['ta-reponse'].couleur}"
          >{MARQUEURS['ta-reponse'].glyphe}</span
        >
        Votre réponse
      </span>
      <span class="mt-1 block text-slate-800 dark:text-slate-100">
        {#if reponse.genre === 'unique'}
          {nommer(donnee?.genre === 'unique' ? donnee.choix : null)}
        {:else if reponse.genre === 'multiple'}
          {nommerPlusieurs(donnee?.genre === 'multiple' ? donnee.choix : [])}
        {:else if donnee?.genre === 'appariement'}
          {Object.entries(donnee.paires)
            .map(([g, d]) => `${g} → ${d}`)
            .join(', ') || 'aucune'}
        {:else}
          aucune
        {/if}
      </span>
    </p>
    <p
      class="rounded-lg border border-emerald-200 bg-white p-3 text-sm dark:border-emerald-900
        dark:bg-slate-900"
    >
      <span
        class="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        <span aria-hidden="true" style="color: {MARQUEURS['bonne-reponse'].couleur}"
          >{MARQUEURS['bonne-reponse'].glyphe}</span
        >
        {juste ? 'Et c’était la bonne' : 'La bonne réponse'}
      </span>
      <span class="mt-1 block text-slate-800 dark:text-slate-100">
        {#if reponse.genre === 'unique'}
          {nommer(reponse.bonne)}
        {:else if reponse.genre === 'multiple'}
          {nommerPlusieurs(reponse.bonnes)}
        {:else}
          {Object.entries(paires)
            .map(([g, d]) => `${g} → ${d}`)
            .join(', ')}
        {/if}
      </span>
    </p>
  </div>

  {#if etiquette && DIAGNOSTIC[etiquette]}
    <p
      class="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900
        dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <span class="font-semibold">Ce qui s’est passé :</span>
      {DIAGNOSTIC[etiquette]}.
    </p>
  {/if}

  <!-- 2 et 3. L'énoncé annoté et le raisonnement, qui avancent ensemble. -->
  <Deroule etapes={trace.etapes}>
    {#snippet children(montrees: number)}
      {@const annotations = annoter(trace, reponse, donnee, montrees)}
      {@const employes = marqueursEmployes(annotations)}
      <div class="grid gap-3 lg:grid-cols-2">
        <div
          class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800
            dark:bg-slate-900"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            L’énoncé, à l’étape {Math.min(montrees, trace.etapes.length)} sur {trace.etapes.length}
          </p>
          {#each item.enonce as bloc, i (i)}
            <Bloc {bloc} {annotations} />
          {/each}

          {#if options.length}
            <ul class="mt-3 space-y-1">
              {#each options as option, i (i)}
                {@const marqueur = annotations.options.get(i)}
                <li
                  class="flex items-baseline gap-2 rounded px-1 text-sm
                    {marqueur === 'bonne-reponse'
                    ? 'font-semibold text-emerald-800 dark:text-emerald-200'
                    : marqueur === 'ta-reponse'
                      ? 'text-amber-800 dark:text-amber-200'
                      : 'text-slate-600 dark:text-slate-300'}"
                >
                  <span
                    aria-hidden="true"
                    style={marqueur ? `color: ${MARQUEURS[marqueur].couleur}` : undefined}
                    >{marqueur ? MARQUEURS[marqueur].glyphe : '·'}</span
                  >
                  {#if marqueur}<span class="sr-only">{MARQUEURS[marqueur].libelle} :</span>{/if}
                  <span>{option.texte?.trim() || `proposition ${i + 1}`}</span>
                  {#if option.etiquette && DIAGNOSTIC[option.etiquette]}
                    <span class="text-xs text-slate-500 dark:text-slate-400"
                      >— {DIAGNOSTIC[option.etiquette]}</span
                    >
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}

          {#if employes.length}
            <Legende marqueurs={employes} />
          {/if}
        </div>

        <ol class="space-y-2">
          {#each trace.etapes as etape (etape.rang)}
            <li
              class="rounded-lg border p-3 text-sm
                {etape.rang <= montrees
                ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                : 'border-dashed border-slate-200 bg-transparent opacity-60 dark:border-slate-800'}"
            >
              <p
                class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Étape {etape.rang}{#if etape.loi} — {etape.loi}{/if}
              </p>
              <p class="mt-1 text-slate-800 dark:text-slate-100">{etape.legende}</p>
              <p class="mt-1 font-mono text-xs text-indigo-700 dark:text-indigo-300">
                {etape.produit}
              </p>
            </li>
          {/each}
        </ol>
      </div>
    {/snippet}
  </Deroule>

  <p class="mt-3 text-sm text-slate-700 dark:text-slate-300">{item.explication}</p>
</section>
