<script lang="ts">
  /**
   * Un marqueur du vocabulaire visuel, dessiné en SVG.
   *
   * Chaque marqueur porte sa **forme** propre — disque, cercle, losange, coche,
   * croix, carré, flèche — et c'est cette forme qui l'identifie. La couleur
   * vient des tokens du thème et ne fait que renforcer : une correction doit
   * rester lisible en noir et blanc, et pour un œil qui ne distingue pas le
   * rouge du vert.
   */
  import { MARQUEURS, type Marqueur } from '../vocabulaire';

  let {
    marqueur,
    x = 0,
    y = 0,
    taille = 7,
  }: { marqueur: Marqueur; x?: number; y?: number; taille?: number } = $props();

  const style = $derived(MARQUEURS[marqueur]);
  const r = $derived(taille / 2);
</script>

{#if style.forme === 'disque'}
  <circle cx={x} cy={y} r={r} fill={style.couleur} />
{:else if style.forme === 'cercle'}
  <circle
    cx={x} cy={y} r={r}
    fill="none" stroke={style.couleur}
    stroke-width={style.epaisseur}
    stroke-dasharray={style.tirets ?? undefined}
  />
{:else if style.forme === 'losange'}
  <path
    d="M {x} {y - r} L {x + r} {y} L {x} {y + r} L {x - r} {y} Z"
    fill="none" stroke={style.couleur}
    stroke-width={style.epaisseur}
    stroke-dasharray={style.tirets ?? undefined}
  />
{:else if style.forme === 'coche'}
  <g>
    <circle cx={x} cy={y} r={r} fill="none" stroke={style.couleur} stroke-width={style.epaisseur} />
    <path
      d="M {x - r * 0.5} {y} L {x - r * 0.1} {y + r * 0.45} L {x + r * 0.55} {y - r * 0.45}"
      fill="none" stroke={style.couleur} stroke-width={style.epaisseur}
      stroke-linecap="round" stroke-linejoin="round"
    />
  </g>
{:else if style.forme === 'croix'}
  <g stroke={style.couleur} stroke-width={style.epaisseur} stroke-linecap="round">
    <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} />
    <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} />
  </g>
{:else if style.forme === 'carre'}
  <rect
    x={x - r} y={y - r} width={taille} height={taille} rx="1"
    fill="none" stroke={style.couleur} stroke-width={style.epaisseur}
  />
{:else if style.forme === 'fleche'}
  <g stroke={style.couleur} stroke-width={style.epaisseur} stroke-linecap="round" fill="none">
    <line
      x1={x - r} y1={y} x2={x + r * 0.4} y2={y}
      stroke-dasharray={style.tirets ?? undefined}
    />
    <path d="M {x + r * 0.2} {y - r * 0.5} L {x + r} {y} L {x + r * 0.2} {y + r * 0.5}" />
  </g>
{/if}
