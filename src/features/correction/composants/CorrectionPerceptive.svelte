<script lang="ts">
  /**
   * La correction détaillée d'un essai de Veridical Mapping.
   *
   * Elle ne ressemble pas à celle de Relational Reasoning, et c'est voulu : il
   * n'y a **aucun raisonnement à dérouler**. La bonne réponse ne se démontre
   * pas, elle se perçoit, et quand on la manque c'est que l'écart était sous le
   * seuil — non qu'on a mal réfléchi. Prétendre expliquer pourquoi le bon
   * candidat était le bon serait inventer une raison qui n'existe pas.
   *
   * Ce que la correction montre, et qui est utile : **où** se trouvait la
   * référence sur son échelle, **où** tombait sa correspondance, **où** l'on a
   * répondu, et de combien les deux candidats différaient — en pas et dans
   * l'unité de la dimension. On comprend alors ce que l'escalier mesure, au lieu
   * d'enchaîner des verdicts.
   *
   * Trois formes, selon la tâche, parce que les trois tâches ne posent pas la
   * même question :
   *
   * - **point** : deux échelles, la référence, l'attendu, le donné ;
   * - **plan** : deux fois deux échelles, et la correction **nomme l'axe
   *   fautif** — le leurre ne se trompe que sur un, et savoir lequel est tout ce
   *   que la tâche enseigne ;
   * - **modulaire** : deux arcs sur un cercle. Une échelle droite mentirait, la
   *   dimension rebouclant et la réponse portant sur un écart, jamais sur une
   *   position.
   */
  import SchemaEchelles from './SchemaEchelles.svelte';
  import SchemaIntervalleCirculaire from './SchemaIntervalleCirculaire.svelte';
  import { PAS } from '../../veridical-mapping/dimensions';
  import {
    corrigerEssai,
    phraseDEcart,
    positionSurEchelle,
  } from '../../veridical-mapping/correction';
  import type { Essai } from '../../veridical-mapping/session';

  let {
    essai,
    choix,
    fermer,
  }: {
    essai: Essai;
    choix: readonly (number | null)[];
    fermer?: () => void;
  } = $props();

  const corriges = $derived(corrigerEssai(essai, choix));

  /** Les bouts d'une échelle, nommés par leur valeur physique. */
  const bornes = (dimension: { nom: string; unite: string; valeur: (p: number) => number }) => ({
    nom: dimension.nom,
    bas: `${Math.round(dimension.valeur(0))} ${dimension.unite}`,
    haut: `${Math.round(dimension.valeur(PAS - 1))} ${dimension.unite}`,
  });
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

  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
    Il n’y a rien à déduire ici : la bonne réponse se perçoit. La correction montre l’écart que
    votre perception devait distinguer, et non une raison de choisir.
  </p>

  {#each corriges as corrige, i (i)}
    <article
      class="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800
        dark:bg-slate-900"
    >
      {#if corriges.length > 1}
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Sous-essai {i + 1} sur {corriges.length} — {corrige.juste ? 'juste' : 'manqué'}
        </p>
      {/if}

      {#if corrige.tache === 'modulaire' && corrige.intervalles}
        <SchemaIntervalleCirculaire
          tour={PAS}
          reference={corrige.intervalles.bornesReference}
          choisi={corrige.intervalles.bornesChoisies}
          legende={`${corrige.intervalles.reference} pas attendus`}
          alt={`Cercle des ${corrige.axes[0].vers.nom.toLowerCase()}s : l’intervalle à reproduire ` +
            `vaut ${corrige.intervalles.reference} pas ; celui choisi en vaut ` +
            `${corrige.intervalles.donne ?? 'aucun, faute de réponse'}.`}
          titre="Sur une dimension qui reboucle, seul l’écart se transporte — jamais la position."
        />
      {:else}
        {#each corrige.axes as axe, j (j)}
          <SchemaEchelles
            source={bornes(axe.de)}
            cible={bornes(axe.vers)}
            stimulus={positionSurEchelle(axe.pasReference)}
            attendue={positionSurEchelle(axe.pasAttendu)}
            donnee={positionSurEchelle(axe.pasDonne ?? axe.pasAttendu)}
            ecart={axe.mots}
            alt={`Échelles « ${axe.de.nom} » et « ${axe.vers.nom} » : la référence est au rang ` +
              `${axe.pasReference}, la correspondance attendue au rang ${axe.pasAttendu}, ` +
              `la réponse ${axe.pasDonne === null ? 'absente' : `au rang ${axe.pasDonne}`}.`}
            titre={corrige.axes.length > 1
              ? `Axe ${j + 1} : ${axe.de.nom} → ${axe.vers.nom}${axe.juste ? ' — concordant' : ' — c’est ici que le leurre se trompait'}`
              : `${axe.de.nom} → ${axe.vers.nom}`}
          />
        {/each}
      {/if}

      <p class="mt-2 text-sm text-slate-700 dark:text-slate-200">{phraseDEcart(corrige)}</p>
    </article>
  {/each}
</section>
