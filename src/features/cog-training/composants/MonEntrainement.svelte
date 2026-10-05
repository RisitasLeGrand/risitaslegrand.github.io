<script lang="ts">
  /**
   * « Mon entraînement » : choisir ce qu'on travaille.
   *
   * Le composant est **volontairement ignorant** de Relational Reasoning. Il ne
   * connaît que des « unités » rangées en « groupes », chacune débloquée ou non.
   * C'est ce qui permettra de l'offrir plus tard à Quad N-Back — où les unités
   * seraient les modalités — et à Veridical Mapping — où ce seraient les routes
   * entre dimensions — sans le réécrire. Un composant qui aurait pris des
   * `Moteur` en entrée aurait fermé cette porte au premier jour.
   *
   * Trois décisions d'usage valent d'être dites.
   *
   * **Une sélection vide n'autorise pas de session.** Le bouton est désactivé et
   * dit pourquoi, plutôt que de se rabattre silencieusement sur tout : se
   * rabattre ferait croire qu'on travaille ce qu'on a coché.
   *
   * **Le mode libre n'est pas un raccourci.** Il rend sélectionnable ce qui
   * n'est pas débloqué, à l'échelon de départ, et ne touche pas aux déblocages
   * gagnés. L'étiquette le dit, pour qu'on ne croie pas perdre sa progression en
   * l'activant — ni la gagner.
   *
   * **La recherche filtre l'affichage, jamais la sélection.** Une unité cochée
   * qui sort du filtre reste cochée : filtrer est une façon de regarder, pas une
   * façon de choisir.
   */
  import type { SelectionEntrainement } from '../../../lib/db';
  import type { GroupeUnites } from '../unites';

  let {
    groupes = [] as GroupeUnites[],
    selection,
    onChanger,
    onLancer,
    motUnite = 'exercice',
    motUnites = 'exercices',
  }: {
    groupes: GroupeUnites[];
    selection: SelectionEntrainement;
    onChanger: (selection: SelectionEntrainement) => void;
    onLancer: () => void;
    /** Comment nommer une unité dans les libellés — « exercice », « route »… */
    motUnite?: string;
    motUnites?: string;
  } = $props();

  let recherche = $state('');

  const toutes = $derived(groupes.flatMap((groupe) => groupe.unites));
  const selectionnables = $derived(
    toutes.filter((unite) => unite.debloque || selection.modeLibre),
  );
  /** Les unités cochées **et** réellement jouables : ce que la session tirera. */
  const retenues = $derived(
    selectionnables.filter((unite) => selection.unites.includes(unite.id)),
  );

  const normaliser = (texte: string) =>
    texte
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

  const filtres = $derived.by(() => {
    const terme = normaliser(recherche.trim());
    if (!terme) return groupes;
    return groupes
      .map((groupe) => ({
        ...groupe,
        unites: groupe.unites.filter(
          (unite) =>
            normaliser(unite.nom).includes(terme) || normaliser(unite.resume).includes(terme),
        ),
      }))
      .filter((groupe) => groupe.unites.length > 0);
  });

  function modifier(partiel: Partial<SelectionEntrainement>) {
    onChanger({ ...selection, ...partiel });
  }

  function basculer(id: string) {
    const unites = selection.unites.includes(id)
      ? selection.unites.filter((x) => x !== id)
      : [...selection.unites, id];
    modifier({ unites });
  }

  /** Un préréglage remplace la sélection : c'est ce qu'on attend d'un raccourci. */
  function appliquer(ids: string[]) {
    modifier({ unites: ids });
  }

  function basculerModeLibre(actif: boolean) {
    // En quittant le mode libre, on retire de la sélection ce qui redevient
    // inaccessible : laisser des cases cochées sur des unités verrouillées
    // afficherait un compte qui ne correspondrait pas à la session.
    const unites = actif
      ? selection.unites
      : selection.unites.filter((id) => toutes.find((u) => u.id === id)?.debloque);
    onChanger({ ...selection, modeLibre: actif, unites });
  }
</script>

<section class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
  <h2 class="font-semibold text-slate-900 dark:text-white">Mon entraînement</h2>
  <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
    Cochez ce que vous voulez travailler. La session ne tirera que là.
  </p>

  <!-- Préréglages et recherche -->
  <div class="mt-3 flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700
        dark:border-slate-700 dark:text-slate-200"
      onclick={() => appliquer(selectionnables.map((u) => u.id))}>Tout</button
    >
    {#each groupes as groupe (groupe.id)}
      {@const ids = groupe.unites.filter((u) => u.debloque || selection.modeLibre).map((u) => u.id)}
      <button
        type="button"
        class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700
          disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
        disabled={ids.length === 0}
        onclick={() => appliquer(ids)}>{groupe.nom}</button
      >
    {/each}
    <button
      type="button"
      class="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 underline dark:text-slate-300"
      onclick={() => appliquer([])}>Rien</button
    >

    <label class="ml-auto flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <span class="sr-only">Rechercher un {motUnite}</span>
      <input
        type="search"
        bind:value={recherche}
        placeholder="Rechercher…"
        class="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs
          dark:border-slate-700 dark:bg-slate-900"
      />
    </label>
  </div>

  <!-- Les groupes et leurs unités -->
  {#each filtres as groupe (groupe.id)}
    <fieldset class="mt-4">
      <legend class="text-sm font-semibold text-slate-800 dark:text-slate-100">{groupe.nom}</legend>
      {#if groupe.resume}
        <p class="text-xs text-slate-500 dark:text-slate-400">{groupe.resume}</p>
      {/if}
      <ul class="mt-2 space-y-1.5">
        {#each groupe.unites as unite (unite.id)}
          {@const accessible = unite.debloque || selection.modeLibre}
          <li>
            <label
              class="flex items-start gap-2 text-sm {accessible
                ? 'text-slate-800 dark:text-slate-100'
                : 'text-slate-400 dark:text-slate-500'}"
            >
              <input
                type="checkbox"
                class="mt-0.5 shrink-0"
                checked={selection.unites.includes(unite.id)}
                disabled={!accessible}
                onchange={() => basculer(unite.id)}
              />
              <span>
                <span class="font-medium">{unite.nom}</span>
                {#if !unite.debloque}
                  <span class="ml-1 text-xs italic">
                    {selection.modeLibre ? '(ouvert par le mode libre)' : '(pas encore débloqué)'}
                  </span>
                {/if}
                <span class="block text-xs text-slate-500 dark:text-slate-400">{unite.resume}</span>
              </span>
            </label>
          </li>
        {/each}
      </ul>
    </fieldset>
  {/each}

  {#if filtres.length === 0}
    <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
      Aucun {motUnite} ne correspond à « {recherche} ».
    </p>
  {/if}

  <!-- Réglages de session -->
  <div class="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
    <label class="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <span>Nombre d’items :</span>
      <input
        type="number"
        min="3"
        max="60"
        value={selection.items}
        class="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm
          dark:border-slate-700 dark:bg-slate-900"
        oninput={(e) => modifier({ items: Number((e.currentTarget as HTMLInputElement).value) })}
      />
    </label>

    <fieldset>
      <legend class="text-sm text-slate-700 dark:text-slate-200">Ordre des items</legend>
      <div class="mt-1 flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
        <label class="flex items-center gap-1.5">
          <input
            type="radio"
            name="ordre-entrainement"
            checked={selection.ordre === 'entrelace'}
            onchange={() => modifier({ ordre: 'entrelace' })}
          />
          Entrelacé
        </label>
        <label class="flex items-center gap-1.5">
          <input
            type="radio"
            name="ordre-entrainement"
            checked={selection.ordre === 'par-unite'}
            onchange={() => modifier({ ordre: 'par-unite' })}
          />
          Groupé par {motUnite}
        </label>
      </div>
    </fieldset>

    <label class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input
        type="checkbox"
        class="mt-1 shrink-0"
        checked={selection.modeLibre}
        onchange={(e) => basculerModeLibre((e.currentTarget as HTMLInputElement).checked)}
      />
      <span>
        <strong class="font-medium">Mode libre</strong> — rend sélectionnables les {motUnites} pas
        encore débloqués, <strong>à leur niveau de départ</strong>.
        <span class="block text-xs text-slate-500 dark:text-slate-400">
          Vos déblocages ne changent pas, ni dans un sens ni dans l’autre : ils continuent de se
          recalculer depuis votre historique.
        </span>
      </span>
    </label>
  </div>

  <!-- Lancement -->
  <div class="mt-5 flex flex-wrap items-center gap-3">
    <button
      type="button"
      class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white
        disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-500"
      disabled={retenues.length === 0}
      onclick={onLancer}>Reprendre ma sélection</button
    >
    <p class="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
      {#if retenues.length === 0}
        Cochez au moins un {motUnite} pour lancer une session.
      {:else}
        {retenues.length}
        {retenues.length > 1 ? motUnites : motUnite} retenu{retenues.length > 1 ? 's' : ''}, {selection.items}
        items.
      {/if}
    </p>
  </div>
</section>
