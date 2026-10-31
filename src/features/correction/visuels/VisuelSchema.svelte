<script lang="ts">
  /**
   * Un schéma à niveaux : pyramide des normes, circuit, organigramme.
   *
   * Le `niveau` déclaré par chaque nœud décide de sa **rangée**, et sa position
   * dans la rangée est son ordre d'apparition. C'est volontairement pauvre :
   * laisser les données choisir des coordonnées libres aurait produit autant de
   * mises en page que de questions, et la première chose qu'on apprend d'un
   * schéma est sa forme — une hiérarchie se lit de haut en bas, toujours au
   * même endroit.
   *
   * ## Les boîtes s'adaptent à la rangée, et le texte y tient
   *
   * La première version donnait à toutes les boîtes 92 points de large et une
   * seule ligne de texte. Deux conséquences, visibles dès la première question
   * écrite pour de bon : à quatre nœuds sur une rangée les boîtes se
   * **chevauchaient**, et « Règlements de l'Union » débordait largement de la
   * sienne — sans que rien, dans le SVG, le signale.
   *
   * La largeur est donc calculée par rangée, à partir du pas disponible, et le
   * libellé est **replié** sur autant de lignes qu'il en faut, la hauteur de la
   * rangée suivant. Le prix est de ne plus avoir une grille parfaitement
   * régulière quand les rangées sont inégalement peuplées ; en échange, le
   * contenu décide de sa formulation sans se demander ce qui tiendra.
   *
   * ## DEUX LECTURES D'UN MÊME ORGANIGRAMME, ET POURQUOI UNE SEULE DÉCLARATION
   *
   * Un organigramme d'administration a deux lectures utiles : le squelette —
   * ce que toutes les directions partagent — et le détail, avec ses divisions
   * nommées. Les écrire en DEUX visuels aurait laissé les deux dériver : le
   * squelette d'un côté, le détail de l'autre, et personne pour voir le jour où
   * ils cesseraient de dire la même chose. C'est le défaut que le partage d'une
   * seule déclaration évite.
   *
   * Un nœud marqué `essentiel` appartient donc au squelette, et le même dessin
   * se lit dans les deux sens : la vue simplifiée garde les nœuds essentiels et
   * les liens dont **les deux bouts** le sont, la vue détaillée garde tout. La
   * mise en page est la même fonction dans les deux cas — moins de boîtes par
   * rangée veut dire des boîtes plus larges, donc un texte plus grand, ce qui
   * est exactement ce qu'il faut sur un téléphone.
   *
   * La bascule n'apparaît que s'il y a deux lectures à offrir : au moins deux
   * nœuds essentiels, et au moins un nœud qui ne l'est pas. Un bouton qui
   * mènerait au même dessin serait un bouton qui ment.
   *
   * ## LE TEXTE N'EST PAS UNE ALTERNATIVE DE SECOURS
   *
   * `alt` est une phrase, et c'est ce qu'un lecteur d'écran annonce. Elle ne
   * remplace pas un organigramme de vingt boîtes : qui ne voit pas le dessin
   * n'a pas de quoi reconstruire la hiérarchie, et qui le voit sur un écran de
   * 390 points lit des boîtes réduites. Le texte complet est donc **engendré
   * depuis les données** — rang par rang, puis lien par lien — et offert sous
   * le dessin, pour tout le monde. Engendré, et non écrit à la main : une
   * description à la main se périme au premier nœud ajouté, et personne ne s'en
   * aperçoit.
   */
  import Cadre from '../composants/Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import { marqueursDuVisuel } from './types';
  import { enTexte, lecture, offreDeuxLectures } from './organigramme';
  import type { DonneesSchema } from './types';

  let { donnees, alt, legende }: { donnees: DonneesSchema; alt: string; legende?: string } = $props();

  const LARGEUR = 340;
  /*
     Le repli et l'interligne dérivent de la taille du texte (D-044).

     « LARGEUR_CARACTERE » valait 5,1, soit un caractère à 10 unités, et
     « HAUTEUR_LIGNE » 11. Les étiquettes sont passées à 14 : le replieur
     croyait donc qu'une ligne tenait quarante pour cent de caractères de plus
     qu'elle n'en tient, et les lignes d'un même libellé se touchaient. Les
     deux suivent maintenant la taille, et une seule valeur à changer suffira
     la prochaine fois.
  */
  const TAILLE_ETIQUETTE = 14;
  const LARGEUR_CARACTERE = TAILLE_ETIQUETTE * 0.51;
  const HAUTEUR_LIGNE = TAILLE_ETIQUETTE * 1.15;
  const L_BOITE_MAX = 150;
  const MARGE = 10;

  /** Replie un libellé sur des lignes qui tiennent dans `largeur`. */
  function replier(texte: string, largeur: number): string[] {
    const parCaracteres = Math.max(6, Math.floor((largeur - 8) / LARGEUR_CARACTERE));
    const lignes: string[] = [];
    let courante = '';
    for (const mot of texte.split(/\s+/)) {
      if (!courante) courante = mot;
      else if ((courante + ' ' + mot).length <= parCaracteres) courante += ' ' + mot;
      else {
        lignes.push(courante);
        courante = mot;
      }
    }
    if (courante) lignes.push(courante);
    return lignes;
  }

  /* ── Les deux lectures, décidées dans « organigramme.ts » ──────────────── */

  let squelette = $state(false);
  const deuxLectures = $derived(offreDeuxLectures(donnees));
  const vue = $derived(lecture(donnees, squelette));
  const noeudsVus = $derived(vue.noeuds);
  const liensVus = $derived(vue.liens);
  const niveaux = $derived([...new Set(noeudsVus.map((n) => n.niveau))].sort((a, b) => a - b));

  /** Une boîte par nœud : sa place, sa taille, et son libellé déjà replié. */
  const boites = $derived.by(() => {
    const calculees = new Map<
      string,
      { x: number; y: number; largeur: number; hauteur: number; lignes: string[] }
    >();
    let y = MARGE;
    for (const niveau of niveaux) {
      const freres = noeudsVus.filter((n) => n.niveau === niveau);
      const pas = LARGEUR / (freres.length + 1);
      const largeur = Math.min(L_BOITE_MAX, pas - MARGE);
      const repliees = freres.map((noeud) => replier(noeud.libelle, largeur));
      const lignesMax = Math.max(...repliees.map((l) => l.length));
      const hauteur = lignesMax * HAUTEUR_LIGNE + TAILLE_ETIQUETTE;
      freres.forEach((noeud, rang) => {
        calculees.set(noeud.id, {
          x: pas * (rang + 1),
          y: y + hauteur / 2,
          largeur,
          hauteur,
          lignes: repliees[rang],
        });
      });
      y += hauteur + 30;
    }
    return calculees;
  });

  const hauteur = $derived(
    Math.max(...[...boites.values()].map((b) => b.y + b.hauteur / 2), 40) + MARGE,
  );

  /* ── Le texte complet, engendré par le même module que les deux lectures ─ */

  const texte = $derived(enTexte(donnees, squelette));
</script>

{#if deuxLectures}
  <!--
    LA BASCULE EST AU-DESSUS DU DESSIN, et elle le nomme.

    Au-dessous, elle serait découverte après avoir renoncé à lire un dessin
    trop dense — c'est-à-dire trop tard. Les deux appuis sont offerts en
    permanence plutôt qu'un seul qui changerait de sens : un bouton unique
    dirait « Voir le squelette » puis « Voir le détail », et l'état courant ne
    se lirait plus que dans le libellé de son contraire.
  -->
  <div class="mb-1 flex flex-wrap gap-2" role="group" aria-label="Les deux lectures de cet organigramme">
    <button
      type="button"
      class="cible-tactile rounded-lg border px-3 py-1 text-xs {squelette
        ? 'border-slate-400 text-slate-600 dark:border-slate-600 dark:text-slate-300'
        : 'border-indigo-600 bg-indigo-50 font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100'}"
      aria-pressed={!squelette}
      onclick={() => (squelette = false)}>Voir le détail</button
    >
    <button
      type="button"
      class="cible-tactile rounded-lg border px-3 py-1 text-xs {squelette
        ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100'
        : 'border-slate-400 text-slate-600 dark:border-slate-600 dark:text-slate-300'}"
      aria-pressed={squelette}
      onclick={() => (squelette = true)}>Voir le squelette</button
    >
  </div>
{/if}

<Cadre largeur={LARGEUR} {hauteur} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  {#each liensVus as lien, i (i)}
    {@const p = boites.get(lien.de)}
    {@const q = boites.get(lien.a)}
    {#if p && q}
      {@const couleur = lien.marqueur ? MARQUEURS[lien.marqueur].couleur : 'var(--etat-texte-faible)'}
      <!--
        Un lien entre deux nœuds du **même niveau** se branche sur les côtés, et
        non sur le haut et le bas : relier le dessus de l'un au dessous de
        l'autre à hauteur égale trace une diagonale qui traverse les deux
        boîtes, et donne à lire une hiérarchie là où il n'y en a pas.
      -->
      {@const memeRangee = Math.abs(q.y - p.y) < 1}
      {@const versLaDroite = q.x > p.x}
      <line
        x1={memeRangee ? p.x + (versLaDroite ? p.largeur / 2 : -p.largeur / 2) : p.x}
        y1={memeRangee ? p.y : p.y + (q.y > p.y ? p.hauteur / 2 : -p.hauteur / 2)}
        x2={memeRangee ? q.x + (versLaDroite ? -q.largeur / 2 : q.largeur / 2) : q.x}
        y2={memeRangee ? q.y : q.y + (q.y > p.y ? -q.hauteur / 2 : q.hauteur / 2)}
        stroke={couleur}
        stroke-width={lien.marqueur ? MARQUEURS[lien.marqueur].epaisseur : 1.4}
        stroke-dasharray={lien.marqueur ? (MARQUEURS[lien.marqueur].tirets ?? undefined) : undefined}
        marker-end="url(#fleche-correction)"
        style="color: {couleur}"
      />
      {#if lien.libelle}
        <!--
          Le libellé se pose au tiers du trait, côté source, et non en son
          milieu : deux liens qui convergent vers le même nœud ont des milieux
          voisins, et leurs libellés se chevauchaient — « écart de production »
          et « en euros » n'en formaient plus qu'un. Pris près de leur source,
          ils s'écartent autant que les sources elles-mêmes.

          Et le texte se pose sur un fond opaque : au-dessus d'un trait, un
          texte seul devient illisible là où ils se croisent.
        -->
        {@const t = 0.36}
        {@const lx = p.x + (q.x - p.x) * t}
        {@const ly = p.y + (q.y - p.y) * t - 3}
        <text
          x={lx}
          y={ly}
          text-anchor="middle"
          class="fill-slate-500 text-xs dark:fill-slate-400"
          stroke="var(--etat-fond-eleve)"
          stroke-width="3"
          paint-order="stroke"
        >{lien.libelle}</text>
      {/if}
    {/if}
  {/each}

  {#each noeudsVus as noeud (noeud.id)}
    {@const boite = boites.get(noeud.id)}
    {#if boite}
      {@const couleur = noeud.marqueur ? MARQUEURS[noeud.marqueur].couleur : undefined}
      <rect
        x={boite.x - boite.largeur / 2}
        y={boite.y - boite.hauteur / 2}
        width={boite.largeur}
        height={boite.hauteur}
        rx="5"
        class="fill-white dark:fill-slate-900"
        stroke={couleur ?? 'var(--etat-texte-faible)'}
        stroke-width={noeud.marqueur ? 2.4 : 1.2}
      />
      {#each boite.lignes as ligne, j (j)}
        <text
          x={boite.x}
          y={boite.y - ((boite.lignes.length - 1) * HAUTEUR_LIGNE) / 2 + j * HAUTEUR_LIGNE + TAILLE_ETIQUETTE * 0.35}
          text-anchor="middle"
          class="fill-slate-900 text-xs font-medium dark:fill-white">{ligne}</text>
      {/each}
    {/if}
  {/each}
</Cadre>

<!--
  LE TEXTE COMPLET, OFFERT À TOUT LE MONDE ET NON CACHÉ AUX VOYANTS.

  Replié, parce qu'il double la hauteur du bloc quand il est ouvert ; présent,
  parce qu'un dessin ramené à 390 points de large ne se lit plus et que « alt »
  n'est qu'une phrase. Il est aussi la seule forme qui survit à une copie dans
  une note.
-->
<details class="mt-1 text-sm" data-organigramme-texte>
  <summary class="cible-tactile cursor-pointer text-xs text-indigo-700 dark:text-indigo-300"
    >Lire cet organigramme en texte</summary
  >
  <div class="mt-2 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
    <p class="text-xs text-slate-500 dark:text-slate-400">
      {squelette && deuxLectures ? 'Le squelette' : 'Le détail'}, rang par rang, puis les
      rattachements.
    </p>
    <ol class="space-y-1">
      {#each texte.rangs as rang (rang.niveau)}
        <li><span class="font-medium">Rang {rang.niveau + 1}</span> : {rang.libelles.join(' · ')}</li>
      {/each}
    </ol>
    {#if texte.liens.length > 0}
      <ul class="space-y-1 text-slate-700 dark:text-slate-200">
        {#each texte.liens as phrase, i (i)}
          <li>{phrase}</li>
        {/each}
      </ul>
    {:else}
      <p class="text-slate-700 dark:text-slate-200">Aucun rattachement n’est tracé.</p>
    {/if}
  </div>
</details>
