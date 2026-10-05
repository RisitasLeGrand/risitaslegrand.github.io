<script lang="ts">
  /**
   * Deux intervalles sur un cercle : la correction de la tâche modulaire.
   *
   * Ce schéma existe parce qu'une échelle droite **mentirait** ici. Sur une
   * dimension qui reboucle — la teinte est la seule —, il n'y a pas d'origine :
   * le pas 2 et le pas 118 sont voisins, et une règle graduée de gauche à droite
   * les montrerait aux deux bouts. Pire, elle suggérerait que la réponse tient à
   * une position, alors que la tâche porte sur un **écart**, et sur lui seul.
   *
   * Le dessin montre donc deux arcs : celui qu'il fallait reproduire, et celui
   * qu'on a choisi. Leur **longueur** se compare à l'œil, leur position non — ce
   * qui est exactement la leçon. Les deux arcs sont volontairement tracés à des
   * rayons différents, sans quoi deux arcs de longueur proche se recouvriraient
   * et deviendraient illisibles.
   */
  import Cadre from './Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';

  let {
    /** Nombre de pas d'un tour complet. */
    tour,
    /** Les deux bouts de l'intervalle à reproduire, en pas. */
    reference,
    /** Les deux bouts de l'intervalle choisi, ou `null` si rien n'a été choisi. */
    choisi = null,
    /** Les deux longueurs, déjà mises en mots. */
    legende = '',
    alt,
    titre,
  }: {
    tour: number;
    reference: [number, number];
    choisi?: [number, number] | null;
    legende?: string;
    alt: string;
    titre?: string;
  } = $props();

  const COTE = 300;
  const CENTRE = COTE / 2;
  const RAYON_REF = 104;
  const RAYON_CHOIX = 74;

  /** Le haut du cercle est l'origine, et l'on tourne dans le sens horaire. */
  const point = (pas: number, rayon: number) => {
    const angle = (pas / tour) * 2 * Math.PI - Math.PI / 2;
    return { x: CENTRE + rayon * Math.cos(angle), y: CENTRE + rayon * Math.sin(angle) };
  };

  /**
   * L'arc du premier bout vers le second, dans le sens horaire.
   *
   * On trace toujours dans le même sens plutôt que « le plus court chemin » :
   * un arc qui changerait de sens selon les valeurs ferait croire à un
   * changement de nature, là où il n'y a qu'un écart plus grand que le demi-tour.
   */
  const arc = (bornes: [number, number], rayon: number) => {
    const [a, b] = bornes;
    const parcours = ((b - a) % tour + tour) % tour;
    const depart = point(a, rayon);
    const arrivee = point(b, rayon);
    const grand = parcours > tour / 2 ? 1 : 0;
    return `M ${depart.x} ${depart.y} A ${rayon} ${rayon} 0 ${grand} 1 ${arrivee.x} ${arrivee.y}`;
  };
</script>

<Cadre largeur={COTE} hauteur={COTE} {alt} {titre} marqueurs={choisi ? ['bonne-reponse', 'ta-reponse'] : ['bonne-reponse']}>
  <!-- Le cercle support, et les quatre repères du quart de tour : sans eux,
       aucune longueur d'arc ne se juge. -->
  <circle cx={CENTRE} cy={CENTRE} r={RAYON_REF} class="fill-none stroke-slate-300 dark:stroke-slate-700" stroke-width="1" />
  <circle cx={CENTRE} cy={CENTRE} r={RAYON_CHOIX} class="fill-none stroke-slate-200 dark:stroke-slate-800" stroke-width="1" stroke-dasharray="2 4" />
  {#each [0, 0.25, 0.5, 0.75] as fraction (fraction)}
    {@const p = point(fraction * tour, RAYON_REF)}
    {@const q = point(fraction * tour, RAYON_REF + 7)}
    <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} class="stroke-slate-400 dark:stroke-slate-600" stroke-width="1" />
  {/each}

  <!-- L'intervalle à reproduire. -->
  <path
    d={arc(reference, RAYON_REF)}
    fill="none"
    stroke={MARQUEURS['bonne-reponse'].couleur}
    stroke-width={MARQUEURS['bonne-reponse'].epaisseur + 1}
    stroke-linecap="round"
  />
  {#each reference as borne, i (i)}
    {@const p = point(borne, RAYON_REF)}
    <circle cx={p.x} cy={p.y} r="5" fill={MARQUEURS['bonne-reponse'].couleur} />
  {/each}

  {#if choisi}
    <path
      d={arc(choisi, RAYON_CHOIX)}
      fill="none"
      stroke={MARQUEURS['ta-reponse'].couleur}
      stroke-width={MARQUEURS['ta-reponse'].epaisseur + 1}
      stroke-dasharray={MARQUEURS['ta-reponse'].tirets}
      stroke-linecap="round"
    />
    {#each choisi as borne, i (i)}
      {@const p = point(borne, RAYON_CHOIX)}
      <rect x={p.x - 4.5} y={p.y - 4.5} width="9" height="9" fill={MARQUEURS['ta-reponse'].couleur} />
    {/each}
  {/if}

  {#if legende}
    <text x={CENTRE} y={CENTRE + 4} text-anchor="middle"
      class="fill-slate-600 text-[11px] dark:fill-slate-300">{legende}</text>
  {/if}
</Cadre>
