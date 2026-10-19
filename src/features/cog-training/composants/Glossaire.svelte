<!--
  Le mini-glossaire de la branche, ouvrable depuis chaque exercice.

  ## Pourquoi un seul composant pour les trois

  Les termes sont rangés par exercice, mais le glossaire est celui de la
  BRANCHE : quelqu'un qui lit « pas » dans Correspondance peut avoir rencontré
  « amorçage » dans Mémoire la veille, et n'a pas à savoir dans quel écran
  chercher. L'exercice courant est seulement mis en premier.

  ## Pourquoi un `<details>` et non une boîte

  Une boîte modale interrompt : elle prend l'écran, il faut la refermer pour
  revenir à la question. Le glossaire se consulte EN COURS de réflexion, un œil
  sur l'énoncé — c'est un dépliant. Il est atteignable au clavier et annoncé
  comme tel sans qu'on ait rien à écrire : `<details>` et `<summary>` le font
  nativement, là où une bulle maison demanderait trois attributs et un piège à
  focus.
-->
<script lang="ts">
  import { GLOSSAIRE, type Terme } from '../glossaire';

  interface Props {
    /** L'exercice courant : ses termes passent en premier. */
    ou?: Terme['ou'];
  }

  let { ou }: Props = $props();

  const NOMS: Record<Terme['ou'], string> = {
    memoire: 'Mémoire de travail',
    raisonnement: 'Raisonnement relationnel',
    correspondance: 'Correspondance perceptive',
  };

  /*
     L'exercice courant d'abord, les autres ensuite, chacun dans l'ordre de la
     table. Trier par nom aurait mélangé les trois exercices : on cherche un
     mot qu'on vient de lire, pas une entrée dans un dictionnaire.
  */
  const groupes = $derived.by(() => {
    const ordre: Terme['ou'][] = ou
      ? [ou, ...(['memoire', 'raisonnement', 'correspondance'] as Terme['ou'][]).filter((o) => o !== ou)]
      : ['memoire', 'raisonnement', 'correspondance'];
    return ordre
      .map((o) => ({ ou: o, nom: NOMS[o], termes: GLOSSAIRE.filter((t) => t.ou === o) }))
      .filter((groupe) => groupe.termes.length > 0);
  });
</script>

<details
  class="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
>
  <summary class="cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">
    Les mots de ces exercices
  </summary>

  <p class="mt-2 text-xs text-slate-600 dark:text-slate-400">
    Le mot simple porte le sens. Le terme technique, entre parenthèses, sert à
    retrouver la notion ailleurs.
  </p>

  {#each groupes as groupe (groupe.ou)}
    <!--
      PAS DE « uppercase » ICI : le format le réserve aux sigles, et le nom
      d'un exercice n'en est pas un. C'est l'essai qui me l'a rappelé — il
      lisait « MÉMOIRE DE TRAVAIL » là où il cherchait « Mémoire de travail »,
      parce que « innerText » rend la casse appliquée par le style.
    -->
    <h3 class="mt-3 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
      {groupe.nom}
    </h3>
    <dl class="mt-1 space-y-1.5">
      {#each groupe.termes as terme (terme.technique)}
        <div class="text-sm">
          <dt class="font-medium text-slate-800 dark:text-slate-100">
            {terme.simple}
            <span class="font-normal text-slate-500 dark:text-slate-400">({terme.technique})</span>
          </dt>
          <dd class="text-slate-600 dark:text-slate-300">{terme.definition}</dd>
        </div>
      {/each}
    </dl>
  {/each}
</details>
