<script lang="ts">
  /**
   * La fenêtre « Demander à l'IA ».
   *
   * ## Le site n'envoie rien
   *
   * Il fabrique un texte et le donne à copier. La fenêtre le dit, et
   * l'avertissement de premier usage le dit plus longuement : c'est en collant
   * le texte quelque part que la personne, elle, le transmet — à son assistant,
   * selon ses propres conditions. Le site n'a ni compte, ni clef, ni requête.
   *
   * ## L'aperçu est obligatoire, et il est éditable
   *
   * Rien n'est copié sans avoir pu être relu. C'est la contrepartie de tout ce
   * qui précède : un module qui rassemble la question, ma réponse, la
   * correction, un extrait de cours et mon historique produit un texte dont je
   * dois pouvoir retirer ce que je ne veux pas donner. Une fois modifié, c'est
   * **le texte modifié** qui part, et le compteur suit.
   *
   * ## Ce que fait le champ libre
   *
   * Il s'ajoute au préréglage, il ne le remplace pas : les six consignes
   * décrivent la *forme* de réponse attendue, la demande libre en décrit le
   * *sujet*. Les mêler ferait perdre l'une ou l'autre.
   */
  import {
    PREREGLAGES,
    construirePrompt,
    lienClaude,
    type Intention,
    type Resultat,
  } from '../prompt';
  import type { Contexte, OptionsDeContexte } from '../contexte';
  import { parcoursCourant } from '../../../lib/parcours/courant';
  import { copier, partageDisponible, partager } from '../livraison';
  import {
    avertissementVu,
    ecrireIntention,
    ecrireOptions,
    lireIntention,
    lireOptions,
    marquerAvertissementVu,
  } from '../reglages';
  import { enregistrerAide } from '../../../lib/db';

  let {
    construireContexte,
    titre = 'Demander à l’IA',
    itemId,
    matiere,
    fermer,
  }: {
    /** Rend le contexte selon les blocs « moi » cochés. */
    construireContexte: (options: OptionsDeContexte) => Promise<Contexte>;
    titre?: string;
    itemId?: string;
    matiere?: string;
    fermer: () => void;
  } = $props();

  let dialogue = $state<HTMLDialogElement | null>(null);
  /*
   * Les préférences sont lues **à l'initialisation**, et non dans un effet.
   *
   * La première version les lisait dans un `$effect` qui appelait aussi le
   * premier calcul : l'effet écrivait alors l'état qu'il venait de lire, et
   * Svelte s'arrêtait sur « effect_update_depth_exceeded » — la fenêtre
   * s'ouvrait vide, en boucle, et l'erreur n'apparaissait que dans la console.
   * Une lecture de `localStorage` n'a aucune raison d'être réactive : elle a
   * lieu une fois, ici.
   */
  let intention = $state<Intention>(lireIntention());
  let options = $state<OptionsDeContexte>(lireOptions());
  let demande = $state('');
  let contexte = $state<Contexte | null>(null);
  let resultat = $state<Resultat | null>(null);
  /** Le texte réellement livré : celui du résultat, ou celui qu'on a modifié. */
  let texte = $state('');
  let modifie = $state(false);
  let etat = $state<'' | 'copie' | 'echec-copie' | 'partage'>('');
  let avertir = $state(!avertissementVu());
  let neePlusAvertir = $state(false);
  let chargement = $state(true);

  /** Recalcule le contexte quand les cases changent, et le prompt avec. */
  async function recalculer() {
    chargement = true;
    contexte = await construireContexte(options);
    chargement = false;
    regenerer();
  }

  function regenerer() {
    if (!contexte) return;
    resultat = construirePrompt(contexte, {
      intention,
      demande,
      parcours: parcoursCourant(),
    });
    // Une modification à la main n'est pas écrasée par un changement de
    // préréglage : la personne a écrit quelque chose, et le lui reprendre
    // serait le pire moment pour le faire.
    if (!modifie) texte = resultat.texte;
  }

  // Le premier calcul part à l'initialisation : il écrit de l'état, et n'a
  // donc rien à faire dans un effet.
  void recalculer();

  // L'effet ne fait plus qu'une chose, et il ne lit que la référence au nœud :
  // ouvrir la fenêtre dès qu'elle existe.
  $effect(() => {
    dialogue?.showModal();
  });

  function choisir(id: Intention) {
    intention = id;
    ecrireIntention(id);
    regenerer();
  }

  function basculer(clef: keyof OptionsDeContexte) {
    options = { ...options, [clef]: !options[clef] };
    ecrireOptions(options);
    void recalculer();
  }

  const lien = $derived(lienClaude(texte));

  async function tracer() {
    await enregistrerAide({
      le: new Date().toISOString(),
      provenance: contexte?.provenance ?? 'inconnue',
      itemId,
      matiere,
      intention,
    });
  }

  async function surCopier() {
    const ok = await copier(texte);
    etat = ok ? 'copie' : 'echec-copie';
    if (ok) await tracer();
  }

  async function surPartager() {
    const ok = await partager(texte, titre);
    if (ok) {
      etat = 'partage';
      await tracer();
    }
  }

  function surFermer() {
    dialogue?.close();
    fermer();
  }
</script>

<!-- `<dialog>` natif : le piège à focus et la touche Échap viennent du
     navigateur, et une réimplémentation en JavaScript les aurait moins bien
     faits. `onclose` couvre donc aussi la fermeture par Échap. -->
<dialog
  bind:this={dialogue}
  onclose={fermer}
  class="m-auto w-[min(46rem,94vw)] max-w-none rounded-2xl bg-white p-0 text-slate-900
    backdrop:bg-slate-900/50 dark:bg-slate-900 dark:text-white"
  aria-label={titre}
>
  <form method="dialog" class="sr-only"><button type="submit">Fermer</button></form>

  <div class="max-h-[86vh] overflow-y-auto p-5">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-lg font-semibold">{titre}</h2>
      <button
        type="button"
        onclick={surFermer}
        class="rounded-md px-2 py-1 text-sm text-slate-600 underline hover:text-slate-900
          dark:text-slate-300 dark:hover:text-white">Fermer</button
      >
    </header>

    {#if avertir}
      <section
        class="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900
          dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
      >
        <p class="font-medium">À lire une fois.</p>
        <p class="mt-1">
          Ce site ne contacte aucune intelligence artificielle. Il assemble un texte à partir de ce
          que vous avez sous les yeux, et vous le donne à copier. C’est en le collant ailleurs que
          vous le transmettez à un service tiers, selon les conditions de ce service — relisez donc
          l’aperçu avant d’envoyer quoi que ce soit.
        </p>
        <label class="mt-2 flex items-center gap-2">
          <input type="checkbox" bind:checked={neePlusAvertir} class="rounded" />
          <span>Ne plus afficher cet avertissement</span>
        </label>
        <button
          type="button"
          class="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white
            hover:bg-amber-700"
          onclick={() => {
            if (neePlusAvertir) marquerAvertissementVu();
            avertir = false;
          }}>J’ai compris</button
        >
      </section>
    {/if}

    <fieldset class="mt-4">
      <legend class="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        Qu’attendez-vous de l’assistant ?
      </legend>
      <div class="flex flex-wrap gap-2">
        {#each PREREGLAGES as p (p.id)}
          <button
            type="button"
            onclick={() => choisir(p.id)}
            aria-pressed={intention === p.id}
            title={p.description}
            class="rounded-full border px-3 py-1.5 text-sm transition
              {intention === p.id
              ? 'border-indigo-500 bg-indigo-600 font-medium text-white'
              : 'border-slate-300 hover:border-indigo-400 dark:border-slate-700'}"
            >{p.libelle}</button
          >
        {/each}
      </div>
      <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        {PREREGLAGES.find((p) => p.id === intention)?.description}
      </p>
    </fieldset>

    <label class="mt-4 block">
      <span class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
        Votre question, si vous en avez une (facultatif)
      </span>
      <textarea
        bind:value={demande}
        oninput={regenerer}
        rows="2"
        placeholder="Par exemple : et si la loi est antérieure au traité ?"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
          dark:border-slate-700 dark:bg-slate-950"
      ></textarea>
    </label>

    <fieldset class="mt-4">
      <legend class="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        Ajouter à propos de moi
      </legend>
      <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label class="flex items-center gap-2">
          <input type="checkbox" checked={options.monNiveau} onchange={() => basculer('monNiveau')} class="rounded" />
          <span>Mon niveau sur ce sujet</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" checked={options.mesErreurs} onchange={() => basculer('mesErreurs')} class="rounded" />
          <span>L’historique de mes erreurs</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" checked={options.mesNotes} onchange={() => basculer('mesNotes')} class="rounded" />
          <span>Mes notes de séance liées</span>
        </label>
      </div>
      <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        Une case cochée n’ajoute rien si la donnée n’existe pas — un niveau trop peu observé, par
        exemple, est tu plutôt qu’annoncé au jugé.
      </p>
    </fieldset>

    <section class="mt-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-sm font-medium text-slate-600 dark:text-slate-300">
          Aperçu — relisez, modifiez si besoin
        </h3>
        <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {texte.length.toLocaleString('fr-FR')} caractères
        </span>
      </div>
      {#if chargement}
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Assemblage du contexte…</p>
      {/if}
      <textarea
        bind:value={texte}
        oninput={() => {
          modifie = true;
          etat = '';
        }}
        rows="12"
        class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs
          leading-relaxed dark:border-slate-700 dark:bg-slate-950"
      ></textarea>

      {#if resultat && (resultat.retires.length || resultat.tronques.length)}
        <p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
          {#if resultat.retires.length}
            Faute de place, ces blocs ont été retirés : {resultat.retires.join(', ')}.
          {/if}
          {#if resultat.tronques.length}
            Raccourcis : {resultat.tronques.join(', ')}.
          {/if}
        </p>
      {/if}
      {#if modifie}
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Texte modifié à la main : c’est votre version qui sera copiée.
        </p>
      {/if}
    </section>

    <footer class="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onclick={surCopier}
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >Copier</button
      >
      {#if partageDisponible()}
        <button
          type="button"
          onclick={surPartager}
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100
            dark:border-slate-700 dark:hover:bg-slate-800">Partager</button
        >
      {/if}
      {#if lien}
        <a
          href={lien}
          target="_blank"
          rel="noreferrer"
          onclick={tracer}
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100
            dark:border-slate-700 dark:hover:bg-slate-800">Ouvrir dans Claude</a
        >
      {:else}
        <!-- Désactivé avec son motif : un lien trop long serait tronqué par le
             navigateur, et ouvrirait une conversation sur un prompt coupé au
             milieu sans que rien ne le signale. -->
        <span class="text-xs text-slate-500 dark:text-slate-400">
          Prompt trop long pour un lien — utilisez « Copier ».
        </span>
      {/if}
      {#if etat === 'copie'}
        <span class="text-sm text-emerald-700 dark:text-emerald-300">Copié.</span>
      {:else if etat === 'partage'}
        <span class="text-sm text-emerald-700 dark:text-emerald-300">Partagé.</span>
      {:else if etat === 'echec-copie'}
        <span class="text-sm text-red-700 dark:text-red-300">
          La copie a échoué — sélectionnez le texte de l’aperçu et copiez-le à la main.
        </span>
      {/if}
    </footer>

    <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
      Ce site n’envoie rien. Le texte ci-dessus part quand vous le collez quelque part.
    </p>
  </div>
</dialog>

<style>
  /* Plein écran sur téléphone : une fenêtre centrée de 94 % de large laisse
     deux bandes inutiles et rend l'aperçu trop court pour être relu. */
  @media (max-width: 640px) {
    dialog {
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      border-radius: 0;
    }
    dialog > div {
      max-height: 100dvh;
    }
  }
</style>
