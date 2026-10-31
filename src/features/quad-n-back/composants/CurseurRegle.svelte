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

  /** Le curseur lui-même : c'est lui qui sait stepper. */
  let curseur;

  /*
     LE PAS EST CELUI DU NAVIGATEUR, et non une arithmétique à moi.

     Ma première écriture faisait `value + sens * pas`, ce qui a deux défauts
     que le constructeur a relevés :

     - elle ne REVIENT PAS SUR LA GRILLE. Une valeur hors grille — un réglage
       enregistré par une version antérieure, un stockage retouché — restait
       hors grille indéfiniment : avec min = 10 et pas = 2, une valeur de 11
       donnait 13, puis 15, des valeurs que le curseur ne peut pas atteindre
       en le glissant ;
     - et elle fait DEUX implémentations du même pas. Les flèches du clavier
       sur le curseur suivent la règle du navigateur ; mes boutons suivaient
       la mienne. Deux règles qui se ressemblent aujourd'hui, et qui
       divergeront le jour où l'une des deux change.

     `stepUp()` et `stepDown()` tiennent les trois garanties d'un coup, et ce
     sont celles de la spécification : ramener sur la grille du pas, avancer
     d'un cran, borner à min et max. Les boutons et les flèches ne peuvent
     plus être d'avis différents, puisque c'est le même mécanisme.
  */
  function bouger(sens) {
    if (!curseur) return;
    if (sens > 0) curseur.stepUp();
    else curseur.stepDown();
    value = nombre(curseur.value);
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
    bind:this={curseur}
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
