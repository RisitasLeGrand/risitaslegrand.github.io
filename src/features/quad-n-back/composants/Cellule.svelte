<script>
  /**
   * Un bloc de la grille : cube à six faces en 3D, carré simple en 2D.
   *
   * Rendu inspiré de « quad-box » (src/lib/Cell.svelte, licence MIT) :
   * mêmes proportions et même principe de cube en CSS 3D. Adaptations : la
   * position est calculée plutôt qu'énumérée en 27 classes, et la forme est
   * dessinée en SVG inline au lieu d'une URL de blob — ce qui évite de créer
   * des objets non libérés et fonctionne au rendu statique.
   */
  import { SHAPES, LIGHT_PALETTE, DARK_PALETTE } from '../moteur/constantes.js';

  let { position = null, couleur = null, forme = null, visible = false, sombre = false, grille3D = true } = $props();

  // « 0-1-2 » -> décalages de -1, 0 ou +1 case sur chaque axe.
  const axes = $derived((position ?? '').split('-').map((v) => Number(v) - 1));

  const transform = $derived(
    grille3D
      ? `translate3d(calc(${axes[0] ?? 0} * var(--pas)), calc(${axes[1] ?? 0} * var(--pas)), calc(${axes[2] ?? 0} * var(--pas)))`
      : `translate(calc(${axes[0] ?? 0} * var(--pas)), calc(${axes[1] ?? 0} * var(--pas)))`,
  );

  const palette = $derived(sombre ? DARK_PALETTE : LIGHT_PALETTE);
  // Sans dimension « couleur » active, le bloc prend une teinte neutre.
  const fond = $derived(couleur ? palette[couleur] : sombre ? '#e2e8f0' : '#334155');
  const trace = $derived(forme ? SHAPES[forme] : null);
  // La forme doit rester lisible sur n'importe quelle couleur de fond.
  const remplissageForme = $derived(sombre ? '#0f172a' : '#f8fafc');
</script>

{#if visible && position}
  <div class="cellule" class:plat={!grille3D} style="transform: {transform}">
    {#each grille3D ? [0, 1, 2, 3, 4, 5] : [0] as face (face)}
      <div class="face face-{face}" style="background-color: {fond}">
        {#if trace}
          <svg viewBox="0 0 110 110" aria-hidden="true">
            <path d={trace} fill={remplissageForme} stroke={remplissageForme} stroke-width="2" />
          </svg>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .cellule {
    position: absolute;
    width: var(--pas);
    height: var(--pas);
    left: var(--pas);
    top: var(--pas);
    transform-style: preserve-3d;
  }

  .face {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.25);
  }

  .face svg {
    width: 78%;
    height: 78%;
  }

  /* Les six faces du cube, à une demi-arête du centre. */
  .face-0 { transform: translateZ(calc(var(--pas) / 2)); }
  .face-1 { transform: translateZ(calc(var(--pas) / -2)) rotateY(180deg); }
  .face-2 { transform: translateX(calc(var(--pas) / 2)) rotateY(90deg); }
  .face-3 { transform: translateX(calc(var(--pas) / -2)) rotateY(-90deg); }
  .face-4 { transform: translateY(calc(var(--pas) / 2)) rotateX(-90deg); }
  .face-5 { transform: translateY(calc(var(--pas) / -2)) rotateX(90deg); }

  .plat .face {
    transform: none;
  }
</style>
