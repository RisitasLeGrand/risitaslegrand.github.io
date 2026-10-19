<!--
  « Comment ça marche » : la consigne, en tête de l'exercice et pendant la partie.

  ## Le défaut que cet encart existe pour combler

  Aucun des trois exercices ne disait ce qu'il attendait. Mémoire de travail
  s'ouvre sur quatre dimensions, des touches de clavier et des seuils de
  progression, sans une phrase sur la tâche elle-même ; Correspondance demande
  de choisir « celle qui est au même niveau » sans dire sur quelle échelle. On
  apprenait la règle en perdant la première partie — et le constat C1 relève
  qu'aucun des trois ne permettait de la revoir en cours de route.

  ## Pourquoi un seul composant pour deux emplacements

  La même consigne est servie en tête de l'écran de réglages et, pendant la
  partie, dans une boîte. Les écrire deux fois, c'est les laisser diverger : le
  jour où l'une est corrigée, l'autre dit encore l'ancienne règle. Le texte est
  donc passé une fois, par le parent, et rendu aux deux endroits.

  ## Pourquoi il s'ouvre tant qu'aucune partie n'a été jouée

  Un encart replié que personne n'ouvre ne vaut pas mieux que pas d'encart.
  Mais ouvert à chaque visite, il devient l'obstacle que l'habitué referme vingt
  fois. Le parent dit donc s'il doit s'ouvrir, et il le dit avec ce qu'il sait
  déjà : le magasin de l'exercice est-il vide ? Aucune donnée n'est écrite pour
  cela.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Le texte de la consigne, écrit par l'exercice. */
    children: Snippet;
    /** Ouvert au premier rendu : le parent décide, voir l'en-tête. */
    ouvert?: boolean;
    /** Rendu dans une boîte, pendant la partie, au lieu de l'encart replié. */
    enBoite?: boolean;
    /** Appelé quand la boîte se ferme — l'exercice y reprend sa partie. */
    fermer?: () => void;
  }

  let { children, ouvert = false, enBoite = false, fermer }: Props = $props();

  let boite = $state<HTMLDialogElement | null>(null);

  /*
     La boîte s'ouvre et se ferme avec `enBoite`, et non à l'appel d'un geste :
     c'est l'exercice qui tient l'état — il met sa partie en pause en même
     temps —, et deux sources de vérité pour une même ouverture finissent
     toujours par se contredire.
  */
  $effect(() => {
    if (!boite) return;
    if (enBoite && !boite.open) boite.showModal();
    if (!enBoite && boite.open) boite.close();
  });
</script>

{#if enBoite}
  <!--
    `onclose` plutôt qu'un seul `onclick` sur le bouton : la touche Échap et le
    geste de retour ferment aussi la boîte, et la partie doit reprendre dans
    les trois cas. Sans cela, échapper la boîte laissait la partie en pause
    sans rien qui le dise.
  -->
  <dialog bind:this={boite} onclose={() => fermer?.()} class="boite">
    <h2 class="text-base font-semibold text-slate-900 dark:text-white">Comment ça marche</h2>
    <div class="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
      {@render children()}
    </div>
    <div class="mt-5 flex justify-end">
      <button
        type="button"
        onclick={() => boite?.close()}
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >Reprendre</button>
    </div>
  </dialog>
{:else}
  <details open={ouvert} class="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <summary class="cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">
      Comment ça marche
    </summary>
    <div class="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
      {@render children()}
    </div>
  </details>
{/if}
