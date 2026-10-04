<script lang="ts">
  /**
   * Le déroulé pas à pas d'une trace de résolution.
   *
   * La correction ne se donne pas d'un coup : chaque étape s'ajoute au schéma,
   * et ce qui a déjà servi **reste visible**. C'est ce qui distingue une
   * correction d'une réponse — on suit un chemin, on ne contemple pas un
   * résultat.
   *
   * Deux partis pris d'accessibilité, pris ici et non dans chaque schéma.
   *
   * La lecture automatique est **refusée** quand le système demande moins
   * d'animations : non pas ralentie, refusée. Un déroulé qui avance seul est
   * exactement ce que `prefers-reduced-motion` veut éviter, et le proposer
   * quand même sous prétexte qu'il est utile revient à décider à la place de la
   * personne.
   *
   * La légende de l'étape est dans une région `aria-live` : un lecteur d'écran
   * annonce donc le texte de l'étape à chaque avancée, sans qu'on ait à
   * déplacer le focus — déplacer le focus ferait perdre le bouton qu'on vient
   * d'actionner.
   */
  import type { Snippet } from 'svelte';
  import type { Etape } from '../trace';

  let {
    etapes = [] as Etape[],
    /** Appelé avec le nombre d'étapes à montrer : le schéma s'y accorde. */
    children,
  }: { etapes: Etape[]; children?: Snippet<[number]> } = $props();

  let visibles = $state(1);

  const animationsReduites =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let lecture = $state(false);
  let minuteur: ReturnType<typeof setInterval> | undefined;

  const total = $derived(etapes.length);
  const etapeCourante = $derived(etapes[Math.min(visibles, total) - 1]);

  function basculerLecture() {
    lecture = !lecture;
    clearInterval(minuteur);
    if (lecture) {
      minuteur = setInterval(() => {
        if (visibles >= total) {
          lecture = false;
          clearInterval(minuteur);
          return;
        }
        visibles += 1;
      }, 2200);
    }
  }

  $effect(() => () => clearInterval(minuteur));
</script>

<div class="my-3">
  {@render children?.(visibles)}

  {#if etapeCourante}
    <p
      class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-800
        dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200"
      aria-live="polite"
    >
      <span class="font-semibold">Étape {etapeCourante.rang} sur {total}</span>
      {#if etapeCourante.loi}
        <span class="ml-1 text-xs text-slate-500 dark:text-slate-400">({etapeCourante.loi})</span>
      {/if}
      <br />
      {etapeCourante.legende}
    </p>
  {/if}

  {#if total > 1}
    <div class="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium
          text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
        disabled={visibles <= 1}
        onclick={() => (visibles = Math.max(1, visibles - 1))}
      >Étape précédente</button>

      <button
        type="button"
        class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium
          text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
        disabled={visibles >= total}
        onclick={() => (visibles = Math.min(total, visibles + 1))}
      >Étape suivante</button>

      <button
        type="button"
        class="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-700 underline
          dark:text-indigo-300"
        onclick={() => (visibles = total)}
      >Tout voir</button>

      {#if !animationsReduites}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 underline
            dark:text-slate-300"
          aria-pressed={lecture}
          onclick={basculerLecture}
        >{lecture ? 'Interrompre la lecture' : 'Lecture automatique'}</button>
      {/if}

      <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">
        {Math.min(visibles, total)} / {total}
      </span>
    </div>
  {/if}
</div>
