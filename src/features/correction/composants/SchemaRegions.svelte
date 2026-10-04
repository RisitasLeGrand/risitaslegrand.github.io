<script lang="ts">
  /**
   * Les huit relations de RCC8, dessinées comme deux disques en position.
   *
   * Même raison que pour les intervalles d'Allen : *tangent interne* et
   * *interne strict* ne se distinguent qu'à l'image. Et le cas des régions est
   * pire, parce que le vocabulaire est opaque — personne ne devine ce que
   * « TPP » veut dire, tout le monde voit un disque qui touche le bord de
   * l'autre par l'intérieur.
   *
   * Les disques sont volontairement de tailles différentes, pour que
   * l'inclusion se lise dans les deux sens sans ambiguïté.
   */
  import Cadre from './Cadre.svelte';
  import { MARQUEURS, type Marqueur } from '../vocabulaire';

  /** Centres et rayons des deux régions, par relation. Repère local 0-100. */
  const DISPOSITIONS: Record<
    string,
    { a: { x: number; y: number; r: number }; b: { x: number; y: number; r: number } }
  > = {
    // Disjointes : aucun point commun, et une marge visible entre les bords.
    dc: { a: { x: 28, y: 50, r: 19 }, b: { x: 74, y: 50, r: 19 } },
    // Tangentes extérieurement : les bords se touchent, les intérieurs non.
    ec: { a: { x: 32, y: 50, r: 21 }, b: { x: 74, y: 50, r: 21 } },
    // Recouvrement partiel : chacune a du dedans et du dehors de l'autre.
    po: { a: { x: 38, y: 50, r: 24 }, b: { x: 64, y: 50, r: 24 } },
    // Égales : un seul disque, tracé deux fois.
    eq: { a: { x: 51, y: 50, r: 24 }, b: { x: 51, y: 50, r: 24 } },
    // Partie tangente : A dans B, bords en contact.
    tpp: { a: { x: 38, y: 50, r: 13 }, b: { x: 51, y: 50, r: 26 } },
    tpp_inv: { a: { x: 51, y: 50, r: 26 }, b: { x: 38, y: 50, r: 13 } },
    // Partie non tangente : A strictement dans B.
    ntpp: { a: { x: 51, y: 50, r: 12 }, b: { x: 51, y: 50, r: 26 } },
    ntpp_inv: { a: { x: 51, y: 50, r: 26 }, b: { x: 51, y: 50, r: 12 } },
  };

  export interface OptionRegion {
    relation: string;
    libelle: string;
    marqueur: Marqueur;
    raison?: string;
  }

  let {
    options = [] as OptionRegion[],
    nomA = 'A',
    nomB = 'B',
    alt,
    titre,
  }: {
    options: OptionRegion[];
    nomA?: string;
    nomB?: string;
    alt: string;
    titre?: string;
  } = $props();

  const COLONNES = 4;
  const CASE = 80;
  const LARGEUR = COLONNES * CASE;
  const lignes = $derived(Math.ceil(options.length / COLONNES));
  const HAUTEUR = $derived(lignes * (CASE + 16));

  const marqueursEmployes = $derived([...new Set(options.map((o) => o.marqueur))]);

  /** Du repère local 0-100 d'une vignette vers le repère du schéma. */
  const loc = (i: number, v: number, axe: 'x' | 'y') => {
    const col = i % COLONNES;
    const row = Math.floor(i / COLONNES);
    return axe === 'x'
      ? col * CASE + (v / 100) * CASE
      : row * (CASE + 16) + 4 + (v / 100) * (CASE - 16);
  };
  const ech = (v: number) => (v / 100) * (CASE - 16);
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} {titre} marqueurs={marqueursEmployes}>
  {#each options as option, i (option.relation)}
    {@const d = DISPOSITIONS[option.relation] ?? DISPOSITIONS.dc}
    {@const style = MARQUEURS[option.marqueur]}

    <!-- La région B, dessous, en trame : c'est le contenant le plus souvent -->
    <circle
      cx={loc(i, d.b.x, 'x')} cy={loc(i, d.b.y, 'y')} r={ech(d.b.r)}
      fill="url(#hachures-correction)" stroke="var(--etat-texte-faible)" stroke-width="1.4"
      color="var(--etat-texte-faible)"
    />
    <!-- La région A, par-dessus, en trait plein -->
    <circle
      cx={loc(i, d.a.x, 'x')} cy={loc(i, d.a.y, 'y')} r={ech(d.a.r)}
      fill="none" stroke="var(--etat-action)" stroke-width="2"
      stroke-dasharray={option.relation === 'eq' ? '4 3' : undefined}
    />
    <text
      x={loc(i, d.a.x, 'x')} y={loc(i, d.a.y, 'y') + 3} text-anchor="middle"
      fill="var(--etat-action)" font-size="8.5" font-weight="700"
    >{nomA}</text>
    {#if option.relation !== 'eq'}
      <text
        x={loc(i, d.b.x, 'x')} y={loc(i, d.b.y, 'y') - ech(d.b.r) - 2} text-anchor="middle"
        fill="var(--etat-texte-faible)" font-size="8"
      >{nomB}</text>
    {/if}

    <!-- Verdict : la croix barre la vignette exclue, la coche signe la possible -->
    {#if option.marqueur === 'exclu'}
      <g stroke={style.couleur} stroke-width="2" stroke-linecap="round" opacity="0.85">
        <line x1={loc(i, 8, 'x')} y1={loc(i, 8, 'y')} x2={loc(i, 94, 'x')} y2={loc(i, 92, 'y')} />
      </g>
    {/if}
    <text
      x={loc(i, 50, 'x')} y={loc(i, 50, 'y') + ech(34)} text-anchor="middle"
      fill={style.couleur} font-size="9" font-weight="600"
    >{style.glyphe} {option.libelle}</text>
  {/each}
</Cadre>

{#if options.some((o) => o.raison)}
  <ul class="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
    {#each options.filter((o) => o.raison) as option (option.relation)}
      <li>
        <strong class="font-medium">{option.libelle}</strong> —
        <span class="sr-only">{MARQUEURS[option.marqueur].libelle} : </span>{option.raison}
      </li>
    {/each}
  </ul>
{/if}
