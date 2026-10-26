<script>
  /**
   * UN CURSEUR AVEC SES DEUX BOUTONS DE PAS (E9 du prompt 43).
   *
   * ## Le défaut
   *
   * Les neuf réglages du Quad N-Back sont des `input[type=range]`. Mesuré le
   * 25 octobre : **473 × 16 px à la souris**, et aucun bouton de pas. Changer
   * une valeur demandait donc de viser le pouce et de glisser — un geste
   * imprécis à la souris, pire au doigt — ou de focaliser le curseur puis
   * d'employer les flèches, ce que personne ne devine.
   *
   * Sous `pointer: coarse`, la feuille de style donne 44 px de haut aux
   * contrôles de formulaire : la piste est donc confortable au doigt. Mais une
   * piste confortable ne rend pas le POUCE plus facile à viser, et c'est lui
   * qu'il faut attraper pour changer d'un cran.
   *
   * ## Pourquoi des boutons, et pas une piste plus haute
   *
   * Parce que la taille du pouce relève de l'agent utilisateur : WCAG 2.5.8
   * l'exempte à ce titre, et grossir la piste de treize curseurs changerait
   * leur aspect pour un gain discutable. Deux boutons, eux, donnent une cible
   * franche qui fait exactement ce qu'on veut — un cran —, et ils disent la
   * direction à voix haute.
   *
   * ## Ce que le composant garantit
   *
   * - le pas est celui du curseur, jamais un autre : un bouton qui avancerait
   *   de 1 là où le curseur avance de 250 produirait des valeurs que le
   *   curseur ne peut pas atteindre ;
   * - les bornes sont tenues, et un bouton au bout **se désactive** plutôt que
   *   de ne rien faire en silence ;
   * - le curseur garde le nom qu'il avait : SEPT des neuf sont nommés par un
   *   `<label for>` visible, DEUX par un `aria-label`, et extraire le balisage
   *   en composant avait fait tomber celui-là. `nom` le rend, et il reste vide
   *   quand une étiquette visible nomme déjà le curseur — un `aria-label`
   *   la recouvrirait ;
   * - chaque bouton porte un nom qui dit QUOI il change et dans quel sens —
   *   « − » tout seul n'apprend rien à qui l'entend annoncer.
   */
  let {
    id,
    min,
    max,
    pas = 1,
    libelle,
    nom = '',
    classe = '',
    value = $bindable(),
  } = $props();

  const nombre = (v) => Number(v);
  const borner = (v) => Math.min(nombre(max), Math.max(nombre(min), v));

  function bouger(sens) {
    value = borner(nombre(value) + sens * nombre(pas));
  }

  /* Au bout de la course, le bouton se désactive : un bouton qui reste actif
     et ne fait rien laisse croire que l'appui a été manqué. */
  const auMinimum = $derived(nombre(value) <= nombre(min));
  const auMaximum = $derived(nombre(value) >= nombre(max));

  const CLASSE_BOUTON =
    'cible-tactile-pleine shrink-0 rounded-lg border border-slate-300 text-base ' +
    'font-medium text-slate-600 transition hover:bg-slate-100 ' +
    'disabled:cursor-not-allowed disabled:opacity-40 ' +
    'dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';
</script>

<div class="flex items-center gap-2">
  <button
    type="button"
    data-pas="-1"
    data-pour={id}
    class={CLASSE_BOUTON}
    aria-label={`Diminuer ${libelle}`}
    disabled={auMinimum}
    onclick={() => bouger(-1)}
  >
    −
  </button>

  <input
    {id}
    {min}
    {max}
    step={pas}
    type="range"
    aria-label={nom || undefined}
    bind:value
    class={`w-full ${classe}`}
  />

  <button
    type="button"
    data-pas="1"
    data-pour={id}
    class={CLASSE_BOUTON}
    aria-label={`Augmenter ${libelle}`}
    disabled={auMaximum}
    onclick={() => bouger(1)}
  >
    +
  </button>
</div>
