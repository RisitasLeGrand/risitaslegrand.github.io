<script lang="ts">
  /**
   * Le rendu d'un stimulus : une forme à regarder, ou un son à écouter.
   *
   * Les couleurs sont données en `oklch`, dont la clarté et la teinte sont
   * perceptivement régulières — ce qui est ici une exigence et non une
   * commodité. En `hsl`, deux pas de clarté séparés par le même écart numérique
   * ne se ressemblent pas du tout selon la teinte, et le seuil mesuré ne
   * voudrait plus rien dire.
   *
   * Un stimulus sonore ne se montre pas : il se joue. Le bouton reste donc
   * disponible pour le réécouter autant de fois qu'on veut — ce qui n'altère pas
   * la mesure, la difficulté portant sur la mise en correspondance et non sur la
   * mémoire.
   */
  import { jouerTon } from '../audio';
  import { PAS, dimensionParId } from '../dimensions';
  import { zDepuisLAttribut } from '../dimensions/rendus/types';
  import type { PorteUnRendu, RenduVisuel } from '../dimensions/rendus/types';
  import type { Stimulus } from '../stimulus';

  let {
    stimulus,
    /** Teinte parasite, quand le bruit de surface est actif. */
    parasite = undefined as number | undefined,
    /** La référence n'est montrée qu'en partie : il faut la compléter. */
    partiel = false,
    libelle = '',
    auto = false,
  }: {
    stimulus: Stimulus;
    parasite?: number;
    partiel?: boolean;
    libelle?: string;
    auto?: boolean;
  } = $props();

  let joue = $state(false);

  /*
     LE POINT D'APPEL GÉNÉRIQUE DU LOT L5, et il n'y en a qu'un ici.

     Une dimension peut porter son propre rendu — voir
     `dimensions/rendus/types.ts`. Les sept d'origine n'en portent pas et ne
     passent donc pas par là : leurs branches ci-dessous sont intactes, et les
     essais d'A le vérifient en restant verts.

     Un stimulus superposé porte deux identifiants joints par « + » :
     `dimensionParId` ne le reconnaît pas, `aUnRendu` est donc faux, et la
     superposition garde son rendu d'origine. C'est voulu — superposer deux
     dessins de canevas est une question distincte, et ce lot ne la tranche pas.
  */
  const laDimension = $derived(dimensionParId(stimulus.dimension));
  const sonRendu = $derived(
    (laDimension as (typeof laDimension & PorteUnRendu) | undefined)?.rendu,
  );
  const aUnRenduVisuel = $derived(sonRendu !== undefined && stimulus.modalite === 'visuelle');

  let toile: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (!aUnRenduVisuel || !toile || sonRendu === undefined) return;
    /*
       ON DESSINE À LA RÉSOLUTION DE L'ÉCRAN, et non à celle du CSS.

       Sans le rapport de pixels, une texture fine serait rééchantillonnée par
       le navigateur : la personne jugerait un flou d'agrandissement et non la
       texture, et le seuil mesuré porterait sur le rééchantillonnage. C'est un
       indice parasite, du même genre que ceux qu'Alexis a nommés.
    */
    const rapport = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
    const largeur = toile.clientWidth;
    const hauteur = toile.clientHeight;
    toile.width = Math.round(largeur * rapport);
    toile.height = Math.round(hauteur * rapport);
    const ctx = toile.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(rapport, 0, 0, rapport, 0, 0);
    ctx.clearRect(0, 0, largeur, hauteur);
    (sonRendu as RenduVisuel)({
      ctx,
      largeur,
      hauteur,
      z: zDeLAttribut(),
      partiel,
      /* La règle photosensible : le rendu ne choisit pas, on lui impose. */
      grisNeutre: Boolean((laDimension as { varieDansLeTemps?: true } | undefined)?.varieDansLeTemps),
    });
  });

  /*
     LA VALEUR z DU STIMULUS : l'inversion vit dans « dimensions/rendus/types »,
     parce qu'un composant Svelte ne s'importe pas depuis un essai et que cette
     part-là devait être éprouvée.
  */
  function zDeLAttribut(): number {
    const d = laDimension;
    if (!d) return 0;
    return zDepuisLAttribut(d, stimulus as unknown as Record<string, unknown>, PAS).z;
  }

  const teinte = $derived(parasite ?? stimulus.teinte);

  async function ecouter() {
    if (joue) return;
    joue = true;
    await jouerTon({
      frequenceHz: stimulus.frequenceHz,
      niveauDb: stimulus.niveauDb,
      // Une référence partielle est tronquée : on n'en entend que le début, et
      // il faut en inférer la durée entière.
      dureeMs: partiel ? stimulus.dureeMs * 0.45 : stimulus.dureeMs,
    });
    joue = false;
  }

  $effect(() => {
    if (auto && stimulus.modalite === 'auditive') ecouter();
  });
</script>

{#if stimulus.modalite === 'auditive'}
  <button
    type="button"
    onclick={ecouter}
    class="flex h-24 w-full min-w-24 flex-col items-center justify-center gap-1 rounded-lg border
      border-slate-200 bg-slate-50 text-sm text-slate-600 transition hover:border-indigo-300
      dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    aria-label="Écouter {libelle}"
  >
    <span class="text-2xl" aria-hidden="true">{joue ? '🔊' : '🔈'}</span>
    <span class="text-xs">{joue ? 'en cours…' : 'écouter'}</span>
  </button>
{:else if stimulus.dimension === 'position'}
  <div class="flex h-24 w-full items-center px-2">
    <div class="relative h-1 w-full rounded bg-slate-200 dark:bg-slate-700">
      <span
        class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500"
        style="left: {stimulus.positionPct}%"
      ></span>
    </div>
  </div>
{:else}
  <div class="flex h-24 w-full items-center justify-center overflow-hidden">
    {#if stimulus.dimension === 'taille'}
      <span
        class="block rounded-full"
        style="width: {stimulus.taillePx}px; height: {stimulus.taillePx}px;
          background: oklch(0.68 {parasite === undefined ? 0 : 0.16} {teinte});
          {partiel ? 'clip-path: inset(0 50% 0 0);' : ''}"
      ></span>
    {:else if stimulus.dimension === 'luminosite'}
      <span
        class="block h-16 w-16 rounded"
        style="background: oklch({stimulus.clarte / 100} {parasite === undefined ? 0 : 0.1} {teinte});
          {partiel ? 'clip-path: inset(0 50% 0 0);' : ''}"
      ></span>
    {:else if stimulus.dimension === 'teinte'}
      <span
        class="block h-16 w-16 rounded"
        style="background: oklch(0.7 0.16 {stimulus.teinte});
          {partiel ? 'clip-path: inset(0 50% 0 0);' : ''}"
      ></span>
    {:else if aUnRenduVisuel}
      <canvas
        bind:this={toile}
        class="h-24 w-full"
        role="img"
        aria-label={libelle || laDimension?.nom || 'stimulus'}
      ></canvas>
    {:else}
      <!--
        LE REPLI NE DIT PLUS « — », ET C'EST UN CORRECTIF.

        Un tiret se lit comme « il n'y a rien à voir », alors qu'il signifie
        « cet écran ne sait pas dessiner cette dimension ». C'est le même défaut
        que le `default` du switch de `stimulus()`, qu'A a retiré parce qu'une
        dimension oubliée produisait un stimulus immobile et que l'essai qui en
        dépendait mesurait un tirage au sort. Ici le défaut vivait encore dans
        la vue.

        On ne LÈVE pas : lever au milieu d'un rendu laisserait la personne
        devant un écran cassé, et elle n'y peut rien. On dit donc la panne,
        visiblement et nommément, pour qu'aucune séance ne la prenne pour un
        stimulus.
      -->
      <span class="px-2 text-center text-xs text-rose-600 dark:text-rose-400">
        Cette dimension n’a pas de rendu : « {stimulus.dimension} ». Rien n’est
        montré, donc rien ne peut être mesuré ici.
      </span>
    {/if}
  </div>
{/if}
