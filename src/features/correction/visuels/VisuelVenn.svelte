<script lang="ts" module>
  /**
   * Le compteur d'instances, partagé par toutes les occurrences du composant.
   *
   * Un bloc `module` est évalué une seule fois, à l'import : c'est ce qui en
   * fait un compteur et non une variable par instance.
   */
  let rang = 0;
  export function suivant(): number {
    rang += 1;
    return rang;
  }
</script>

<script lang="ts">
  /**
   * Un diagramme de Venn à deux ou trois ensembles, avec ses zones marquées.
   *
   * ## La désignation des zones
   *
   * Une zone est désignée par les ensembles qui la **contiennent** : `['A']` est
   * la part de A seule, `['A','B']` leur intersection. C'est la seule
   * désignation indépendante du dessin — « la lune de gauche » cesserait d'être
   * juste dès qu'on change la disposition, et une correction ne doit pas
   * dépendre d'un détail de mise en page.
   *
   * ## Comment une zone est peinte
   *
   * Par **intersection puis soustraction** : on découpe à l'intersection des
   * ensembles qui la contiennent, et l'on masque ceux qui ne la contiennent pas.
   * Les intersections sont obtenues par des `clipPath` emboîtés — un `clipPath`
   * peut lui-même porter un `clip-path`, ce qui donne l'intersection sans
   * calculer la moindre coordonnée de lunule. Les trois ensembles au plus du
   * schéma bornent l'emboîtement à trois niveaux, écrits explicitement : un
   * `#each` ne saurait pas ouvrir et fermer un nombre variable de balises.
   */
  import Cadre from '../composants/Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import { marqueursDuVisuel } from './types';
  import type { DonneesVenn } from './types';

  let { donnees, alt, legende }: { donnees: DonneesVenn; alt: string; legende?: string } = $props();

  /**
   * Un préfixe d'identifiant propre à chaque instance.
   *
   * Les `clipPath` et les `mask` sont désignés par `url(#…)`, et un identifiant
   * SVG vaut pour **tout le document**. Deux diagrammes sur la même page —
   * une correction qui en montre deux, une galerie, une revue de fin de séance —
   * définissaient donc les mêmes identifiants, et le second se dessinait avec
   * les masques du premier.
   *
   * Le défaut était spectaculaire et silencieux : le second diagramme peignait
   * des zones entières au lieu de leurs lunules, sans la moindre erreur de
   * console. Un compteur de module suffit à l'écarter.
   */
  const prefixe = `venn-${suivant()}`;

  const LARGEUR = 320;
  const HAUTEUR = 250;
  const R = 72;

  /** Deux ensembles côte à côte, trois en triangle. */
  const centres = $derived(
    donnees.ensembles.length === 2
      ? [
          { x: LARGEUR / 2 - 40, y: HAUTEUR / 2 - 10 },
          { x: LARGEUR / 2 + 40, y: HAUTEUR / 2 - 10 },
        ]
      : [
          { x: LARGEUR / 2 - 42, y: HAUTEUR / 2 - 30 },
          { x: LARGEUR / 2 + 42, y: HAUTEUR / 2 - 30 },
          { x: LARGEUR / 2, y: HAUTEUR / 2 + 36 },
        ],
  );

  const indexDe = (id: string) => donnees.ensembles.findIndex((e) => e.id === id);
  const zones = $derived(donnees.zones ?? []);

  /** Les ensembles d'une zone, en indices triés, et ceux qu'elle exclut. */
  const partition = (regions: string[]) => {
    const inclus = regions.map(indexDe).filter((i) => i >= 0).sort((a, b) => a - b);
    const exclus = donnees.ensembles.map((_, i) => i).filter((i) => !inclus.includes(i));
    return { inclus, exclus };
  };

  /**
   * Où poser le libellé d'une zone.
   *
   * Le centre des cercles **inclus** ne suffit pas, et c'était le défaut de la
   * première version : les cercles se recouvrant largement, le centre du cercle
   * de gauche tombe dans l'intersection. Les trois libellés d'un Venn à deux
   * ensembles — « Irlande, Chypre », « 25 États », « 4 associés » — se
   * superposaient donc tous les trois au même endroit, et le schéma censé
   * distinguer trois nombres les empilait.
   *
   * On s'écarte donc des cercles **exclus** : une direction, somme des vecteurs
   * qui fuient chaque exclu, et un pas d'un demi-rayon. C'est approximatif —
   * aucune formule simple ne donne le centre d'une lunule — mais cela place le
   * texte dans sa zone pour les dispositions à deux et trois ensembles, qui
   * sont les seules que le schéma autorise.
   */
  const centreZone = (inclus: number[], exclus: number[]) => {
    const pris = inclus.map((i) => centres[i]);
    if (!pris.length) return { x: LARGEUR / 2, y: 16 };
    let x = pris.reduce((s, c) => s + c.x, 0) / pris.length;
    let y = pris.reduce((s, c) => s + c.y, 0) / pris.length;
    let vx = 0;
    let vy = 0;
    for (const i of exclus) {
      const dx = x - centres[i].x;
      const dy = y - centres[i].y;
      const n = Math.hypot(dx, dy) || 1;
      vx += dx / n;
      vy += dy / n;
    }
    const n = Math.hypot(vx, vy);
    if (n > 0) {
      x += (vx / n) * R * 0.5;
      y += (vy / n) * R * 0.5;
    }
    return { x, y };
  };
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  <defs>
    {#each donnees.ensembles as ensemble, i (ensemble.id)}
      <clipPath id="{prefixe}-c-{i}">
        <circle cx={centres[i].x} cy={centres[i].y} r={R} />
      </clipPath>
    {/each}
    {#each zones as zone, z (z)}
      {@const { exclus } = partition(zone.regions)}
      <mask id="{prefixe}-m-{z}">
        <rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill="white" />
        {#each exclus as i (i)}
          <circle cx={centres[i].x} cy={centres[i].y} r={R} fill="black" />
        {/each}
      </mask>
    {/each}
  </defs>

  {#each zones as zone, z (z)}
    {@const { inclus } = partition(zone.regions)}
    {@const style = MARQUEURS[zone.marqueur]}
    <g mask="url(#{prefixe}-m-{z})" style="color: {style.couleur}">
      {#if inclus.length === 1}
        <g clip-path="url(#{prefixe}-c-{inclus[0]})">
          <rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill={style.couleur} opacity="0.22" />
          {#if style.hachures}
            <rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill="url(#hachures-correction)" />
          {/if}
        </g>
      {:else if inclus.length === 2}
        <g clip-path="url(#{prefixe}-c-{inclus[0]})">
          <g clip-path="url(#{prefixe}-c-{inclus[1]})">
            <rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill={style.couleur} opacity="0.22" />
            {#if style.hachures}
              <rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill="url(#hachures-correction)" />
            {/if}
          </g>
        </g>
      {:else if inclus.length === 3}
        <g clip-path="url(#{prefixe}-c-{inclus[0]})">
          <g clip-path="url(#{prefixe}-c-{inclus[1]})">
            <g clip-path="url(#{prefixe}-c-{inclus[2]})">
              <rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill={style.couleur} opacity="0.22" />
              {#if style.hachures}
                <rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill="url(#hachures-correction)" />
              {/if}
            </g>
          </g>
        </g>
      {/if}
    </g>
  {/each}

  {#each donnees.ensembles as ensemble, i (ensemble.id)}
    <circle cx={centres[i].x} cy={centres[i].y} r={R} fill="none"
      class="stroke-slate-500 dark:stroke-slate-400" stroke-width="1.6" />
  {/each}

  <!-- Les libellés de zone, posés après les cercles pour rester lisibles. -->
  {#each zones as zone, z (z)}
    {#if zone.libelle}
      {@const { inclus, exclus } = partition(zone.regions)}
      {@const c = centreZone(inclus, exclus)}
      <text x={c.x} y={c.y + 4} text-anchor="middle"
        class="fill-slate-900 text-[11px] font-semibold dark:fill-white">{zone.libelle}</text>
    {/if}
  {/each}

  {#each donnees.ensembles as ensemble, i (ensemble.id)}
    {@const haut = donnees.ensembles.length === 3 && i === 2}
    <!-- Les noms des deux ensembles du haut sont écartés vers l'extérieur :
         posés sur les centres, ils se touchaient, les cercles se recouvrant. -->
    {@const ecart = haut ? 0 : centres[i].x < LARGEUR / 2 ? -26 : 26}
    <text x={centres[i].x + ecart} y={haut ? centres[i].y + R + 16 : centres[i].y - R - 7}
      text-anchor="middle" class="fill-slate-800 text-[11px] font-semibold dark:fill-slate-100"
      >{ensemble.libelle}</text>
  {/each}
</Cadre>
