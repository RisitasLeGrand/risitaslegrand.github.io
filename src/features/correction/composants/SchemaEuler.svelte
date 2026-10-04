<script lang="ts">
  /**
   * Un diagramme d'Euler : des classes en disques, et des témoins en points.
   *
   * C'est le support des quantificateurs — tous, aucun, certains, certains ne
   * pas. Et le **témoin** y est la pièce essentielle, souvent absente des
   * diagrammes de manuel : « certains A sont B » ne se montre pas en déplaçant
   * des cercles, il se montre en posant **un individu** dans l'intersection.
   * C'est aussi ce qui rend visible l'erreur la plus commune du syllogisme,
   * l'affirmation d'existence tirée d'une prémisse universelle : s'il n'y a pas
   * de point, il n'y a personne.
   *
   * La géométrie est fournie par l'appelant — c'est le solveur qui sait quelle
   * configuration ses prémisses autorisent, et deux configurations différentes
   * peuvent valider les mêmes prémisses.
   */
  import Cadre from './Cadre.svelte';
  import MarqueurSvg from './Marqueur.svelte';
  import { MARQUEURS, type Marqueur } from '../vocabulaire';

  export interface CercleEuler {
    nom: string;
    cx: number;
    cy: number;
    r: number;
    marqueur?: Marqueur;
  }

  export interface TemoinEuler {
    /** Le nom de l'individu, ou `×` pour un témoin anonyme. */
    nom: string;
    x: number;
    y: number;
    marqueur: Marqueur;
  }

  let {
    cercles = [] as CercleEuler[],
    temoins = [] as TemoinEuler[],
    /** Zone vide à signaler explicitement : « aucun A n'est B ». */
    vides = [] as { x: number; y: number; libelle: string }[],
    largeur = 300,
    hauteur = 200,
    alt,
    titre,
  }: {
    cercles: CercleEuler[];
    temoins?: TemoinEuler[];
    vides?: { x: number; y: number; libelle: string }[];
    largeur?: number;
    hauteur?: number;
    alt: string;
    titre?: string;
  } = $props();

  const marqueursEmployes = $derived([
    ...new Set([
      ...cercles.flatMap((c) => (c.marqueur ? [c.marqueur] : [])),
      ...temoins.map((t) => t.marqueur),
    ]),
  ]);
</script>

<Cadre {largeur} {hauteur} {alt} {titre} marqueurs={marqueursEmployes}>
  {#each cercles as cercle (cercle.nom)}
    {@const style = cercle.marqueur ? MARQUEURS[cercle.marqueur] : null}
    <circle
      cx={cercle.cx} cy={cercle.cy} r={cercle.r}
      fill="none"
      stroke={style?.couleur ?? 'var(--etat-bordure-forte)'}
      stroke-width={style?.epaisseur ?? 1.6}
      stroke-dasharray={style?.tirets ?? undefined}
    />
    <text
      x={cercle.cx} y={cercle.cy - cercle.r - 4} text-anchor="middle"
      fill={style?.couleur ?? 'var(--etat-texte-fort)'} font-size="10.5" font-weight="600"
    >{cercle.nom}</text>
  {/each}

  <!-- Les zones déclarées vides : une trame barrée, pas un blanc.
       Un blanc ne se distingue pas d'un oubli. -->
  {#each vides as vide, i (i)}
    <g>
      <circle cx={vide.x} cy={vide.y} r="11" fill="url(#hachures-correction)"
        color="var(--etat-texte-faible)" />
      <text x={vide.x} y={vide.y + 3.5} text-anchor="middle"
        fill="var(--etat-texte-faible)" font-size="10" font-weight="700">∅</text>
      <text x={vide.x} y={vide.y + 22} text-anchor="middle"
        fill="var(--etat-texte-faible)" font-size="8">{vide.libelle}</text>
    </g>
  {/each}

  {#each temoins as temoin, i (`${temoin.nom}-${i}`)}
    <MarqueurSvg marqueur={temoin.marqueur} x={temoin.x} y={temoin.y} taille={9} />
    <text
      x={temoin.x + 8} y={temoin.y + 3.5}
      fill={MARQUEURS[temoin.marqueur].couleur} font-size="9" font-weight="600"
    >{temoin.nom}</text>
  {/each}
</Cadre>
