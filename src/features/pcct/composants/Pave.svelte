<script lang="ts">
  /**
   * Le pavé de réponse : une touche par réponse possible.
   *
   * ## Pourquoi un pavé, et pas seulement le clavier
   *
   * Au doigt, il n'y a pas de clavier numérique. Sans pavé, l'exercice se joue
   * sur le clavier logiciel du téléphone — qui s'ouvre, occupe la moitié de
   * l'écran, et recouvre le nombre qu'il faut lire. Le pavé est donc ce qui
   * rend la séance jouable à la main, et non un confort.
   *
   * ## Ce que ce composant NE décide pas
   *
   * Ni quelles réponses existent, ni dans quel ordre elles se montrent : les
   * deux viennent du moteur (`moteur/pave.ts`), qui les énumère depuis
   * l'opération et la plage, et les mélange à partir du RANG de l'essai. Le
   * composant reçoit l'ordre déjà fait. C'est ce qui permet d'éprouver « le
   * pavé se remélange à chaque essai » sans navigateur, et de ne garder ici que
   * ce qui est réellement de la mise en page.
   *
   * ## La cible tactile
   *
   * Chaque touche porte `cible-tactile-pleine`, qui donne quarante-quatre
   * pixels dans les deux sens sous « pointer: coarse » et le plancher de
   * vingt-quatre partout. Une touche de pavé n'est pas un lien de phrase : elle
   * n'a aucune des exemptions de WCAG 2.5.8, et `essais:pcct:navigateur` la
   * mesure sous pointeur grossier.
   *
   * Un minimum est posé ici EN PLUS de la classe, parce que la largeur d'une
   * touche vient de son texte : « 0 » fait un caractère, « −8 » en fait deux,
   * et sans minimum la grille offrirait des cibles de tailles différentes pour
   * des gestes identiques.
   */

  let {
    touches = [] as number[],
    actif = true,
    onRepondre,
  }: {
    /** Les réponses à offrir, dans l'ordre d'affichage voulu. */
    touches: number[];
    /** Hors essai — échauffement fini, séance en pause —, le pavé n'accepte rien. */
    actif?: boolean;
    onRepondre: (valeur: number) => void;
  } = $props();
</script>

{#if touches.length}
  <!--
    `role="group"` et non `grid` : une grille d'application impose une
    navigation en deux dimensions que ce pavé ne tient pas, et l'annoncer
    serait promettre des flèches qui ne répondent pas. Un groupe de boutons
    se parcourt à la tabulation, ce qui est exactement ce qui se passe.
  -->
  <div
    role="group"
    aria-label="Pavé de réponse"
    data-pave
    class="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-6"
  >
    {#each touches as touche (touche)}
      <button
        type="button"
        data-touche-pave={touche}
        disabled={!actif}
        onclick={() => onRepondre(touche)}
        class="cible-tactile-pleine min-h-11 min-w-11 rounded-lg border border-slate-300 bg-white
               text-lg font-semibold text-slate-900 tabular-nums
               hover:bg-slate-100 disabled:opacity-40
               dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
      >
        {touche}
      </button>
    {/each}
  </div>
{/if}
