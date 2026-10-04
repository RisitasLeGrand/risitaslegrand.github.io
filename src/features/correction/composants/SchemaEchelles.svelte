<script lang="ts">
  /**
   * Deux échelles parallèles : la correction perceptive de Veridical Mapping.
   *
   * Ici il n'y a rien à démontrer — la bonne réponse ne se déduit pas, elle se
   * perçoit. La correction consiste donc à montrer **l'écart** : où était le
   * stimulus sur l'échelle de départ, où tombait sa correspondance sur
   * l'échelle d'arrivée, et où la personne a répondu. C'est le seul schéma du
   * jeu où le trait important est une *distance* et non une relation.
   *
   * L'écart est donné deux fois, dans l'unité de la dimension et en écarts
   * types : la première parle à l'intuition, la seconde permet de comparer deux
   * dimensions qui n'ont pas la même unité.
   */
  import Cadre from './Cadre.svelte';
  import MarqueurSvg from './Marqueur.svelte';
  import { MARQUEURS } from '../vocabulaire';

  let {
    source,
    cible,
    /** Position du stimulus sur l'échelle source, de 0 à 1. */
    stimulus,
    /** Position attendue sur l'échelle cible, de 0 à 1. */
    attendue,
    /** Position donnée par la personne sur l'échelle cible, de 0 à 1. */
    donnee,
    /** L'écart, déjà mis en mots par l'appelant : unité puis z. */
    ecart = '',
    alt,
    titre,
  }: {
    source: { nom: string; bas: string; haut: string };
    cible: { nom: string; bas: string; haut: string };
    stimulus: number;
    attendue: number;
    donnee: number;
    ecart?: string;
    alt: string;
    titre?: string;
  } = $props();

  const LARGEUR = 320;
  const HAUTEUR = 168;
  const X0 = 20;
  const X1 = LARGEUR - 20;
  const Y_SOURCE = 46;
  const Y_CIBLE = 118;

  const x = (t: number) => X0 + Math.min(1, Math.max(0, t)) * (X1 - X0);
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} {titre}
  marqueurs={['bonne-reponse', 'ta-reponse']}>
  {#each [{ y: Y_SOURCE, e: source }, { y: Y_CIBLE, e: cible }] as piste (piste.e.nom)}
    <text x={X0} y={piste.y - 14} fill="var(--etat-texte-faible)" font-size="9.5"
      >{piste.e.nom}</text>
    <line x1={X0} y1={piste.y} x2={X1} y2={piste.y}
      stroke="var(--etat-bordure-forte)" stroke-width="2" stroke-linecap="round" />
    <text x={X0} y={piste.y + 15} fill="var(--etat-texte-faible)" font-size="8"
      >{piste.e.bas}</text>
    <text x={X1} y={piste.y + 15} text-anchor="end" fill="var(--etat-texte-faible)" font-size="8"
      >{piste.e.haut}</text>
  {/each}

  <!-- La route : du stimulus vers sa correspondance attendue -->
  <line
    x1={x(stimulus)} y1={Y_SOURCE + 6} x2={x(attendue)} y2={Y_CIBLE - 8}
    stroke={MARQUEURS['bonne-reponse'].couleur} stroke-width="1.6" stroke-dasharray="4 3"
    marker-end="url(#fleche-correction)" color={MARQUEURS['bonne-reponse'].couleur}
  />

  <!-- Le stimulus -->
  <circle cx={x(stimulus)} cy={Y_SOURCE} r="5" fill="var(--etat-action)" />
  <text x={x(stimulus)} y={Y_SOURCE - 9} text-anchor="middle"
    fill="var(--etat-action)" font-size="8.5" font-weight="600">stimulus</text>

  <!-- L'écart, tracé sur l'échelle cible entre l'attendu et le donné -->
  {#if Math.abs(x(donnee) - x(attendue)) > 1.5}
    <line
      x1={x(attendue)} y1={Y_CIBLE + 22} x2={x(donnee)} y2={Y_CIBLE + 22}
      stroke={MARQUEURS['ta-reponse'].couleur} stroke-width="1.4"
      marker-start="url(#fleche-correction)" marker-end="url(#fleche-correction)"
      color={MARQUEURS['ta-reponse'].couleur}
    />
    {#if ecart}
      <text
        x={(x(attendue) + x(donnee)) / 2} y={Y_CIBLE + 34} text-anchor="middle"
        fill={MARQUEURS['ta-reponse'].couleur} font-size="8.5" font-weight="600"
      >{ecart}</text>
    {/if}
  {/if}

  <MarqueurSvg marqueur="bonne-reponse" x={x(attendue)} y={Y_CIBLE} taille={12} />
  <MarqueurSvg marqueur="ta-reponse" x={x(donnee)} y={Y_CIBLE} taille={12} />
</Cadre>
