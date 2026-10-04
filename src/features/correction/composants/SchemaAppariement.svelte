<script lang="ts">
  /**
   * Deux réseaux côte à côte, et les liens d'appariement entre eux.
   *
   * C'est le schéma des moteurs d'isomorphisme, et il doit montrer trois choses
   * que le texte rend illisibles : quel nœud va avec quel nœud, **quels nœuds
   * n'ont pas de partenaire**, et où un appariement proposé se casse. D'où les
   * liens horizontaux en travers, et le cerclage des nœuds orphelins.
   *
   * Les deux réseaux sont disposés en colonne et non en cercle, parce que
   * l'appariement se lit de gauche à droite : un placement circulaire
   * obligerait l'œil à chercher le partenaire au lieu de le suivre.
   */
  import Cadre from './Cadre.svelte';
  import MarqueurSvg from './Marqueur.svelte';
  import { MARQUEURS, type Marqueur } from '../vocabulaire';

  export interface Reseau {
    nom: string;
    noeuds: string[];
    aretes: { de: string; a: string; libelle?: string }[];
  }

  let {
    gauche,
    droite,
    /** Les paires appariées, avec le marqueur qui dit si la paire tient. */
    paires = [] as { gauche: string; droite: string; marqueur: Marqueur }[],
    /** Nœuds sans partenaire, à cercler. */
    orphelins = [] as string[],
    alt,
    titre,
  }: {
    gauche: Reseau;
    droite: Reseau;
    paires?: { gauche: string; droite: string; marqueur: Marqueur }[];
    orphelins?: string[];
    alt: string;
    titre?: string;
  } = $props();

  const LARGEUR = 320;
  const X_G = 54;
  const X_D = LARGEUR - 54;
  const Y0 = 32;
  const PAS = 36;
  const lignes = $derived(Math.max(gauche.noeuds.length, droite.noeuds.length));
  const HAUTEUR = $derived(Y0 + lignes * PAS);

  const y = (i: number) => Y0 + i * PAS;
  const posG = $derived(new Map(gauche.noeuds.map((n, i) => [n, { x: X_G, y: y(i) }])));
  const posD = $derived(new Map(droite.noeuds.map((n, i) => [n, { x: X_D, y: y(i) }])));

  const marqueursEmployes = $derived([
    ...new Set([...paires.map((p) => p.marqueur), ...(orphelins.length ? (['inutile'] as Marqueur[]) : [])]),
  ]);

  /** Une arête interne, courbée vers l'extérieur pour ne pas croiser les nœuds. */
  function arc(
    positions: Map<string, { x: number; y: number }>,
    de: string,
    a: string,
    sens: -1 | 1,
  ) {
    const p = positions.get(de);
    const q = positions.get(a);
    if (!p || !q) return null;
    const dy = Math.abs(q.y - p.y);
    const bombe = 16 + dy * 0.22;
    return `M ${p.x} ${p.y} Q ${p.x + sens * bombe} ${(p.y + q.y) / 2} ${q.x} ${q.y}`;
  }
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} {titre} marqueurs={marqueursEmployes}>
  <text x={X_G} y="16" text-anchor="middle" fill="var(--etat-texte-faible)" font-size="9.5"
    >{gauche.nom}</text>
  <text x={X_D} y="16" text-anchor="middle" fill="var(--etat-texte-faible)" font-size="9.5"
    >{droite.nom}</text>

  <!-- Les liens d'appariement, en travers -->
  {#each paires as paire, i (`${paire.gauche}-${paire.droite}-${i}`)}
    {@const p = posG.get(paire.gauche)}
    {@const q = posD.get(paire.droite)}
    {@const style = MARQUEURS[paire.marqueur]}
    {#if p && q}
      <line
        x1={p.x + 13} y1={p.y} x2={q.x - 13} y2={q.y}
        stroke={style.couleur} stroke-width={style.epaisseur}
        stroke-dasharray={style.tirets ?? undefined}
      />
      {#if paire.marqueur === 'exclu'}
        <!-- La paire fautive est barrée en son milieu -->
        {@const mx = (p.x + q.x) / 2}
        {@const my = (p.y + q.y) / 2}
        <g stroke={style.couleur} stroke-width="2.4" stroke-linecap="round">
          <line x1={mx - 6} y1={my - 6} x2={mx + 6} y2={my + 6} />
          <line x1={mx - 6} y1={my + 6} x2={mx + 6} y2={my - 6} />
        </g>
      {/if}
    {/if}
  {/each}

  <!-- Les arêtes internes de chaque réseau, bombées vers l'extérieur -->
  {#each gauche.aretes as arete, i (`g-${arete.de}-${arete.a}-${i}`)}
    {@const d = arc(posG, arete.de, arete.a, -1)}
    {#if d}
      <path d={d} fill="none" stroke="var(--etat-bordure-forte)" stroke-width="1.3"
        marker-end="url(#fleche-correction)" color="var(--etat-bordure-forte)" />
    {/if}
  {/each}
  {#each droite.aretes as arete, i (`d-${arete.de}-${arete.a}-${i}`)}
    {@const d = arc(posD, arete.de, arete.a, 1)}
    {#if d}
      <path d={d} fill="none" stroke="var(--etat-bordure-forte)" stroke-width="1.3"
        marker-end="url(#fleche-correction)" color="var(--etat-bordure-forte)" />
    {/if}
  {/each}

  <!-- Les nœuds, et le cerclage des orphelins -->
  {#each [...posG, ...posD] as [nom, p] (`${nom}-${p.x}`)}
    {#if orphelins.includes(nom)}
      <MarqueurSvg marqueur="inutile" x={p.x} y={p.y} taille={22} />
    {/if}
    <circle cx={p.x} cy={p.y} r="12"
      fill="var(--etat-fond-eleve)" stroke="var(--etat-bordure-forte)" stroke-width="1.4" />
    <text x={p.x} y={p.y + 3.5} text-anchor="middle"
      fill="var(--etat-texte-fort)" font-size="10" font-weight="600">{nom}</text>
  {/each}
</Cadre>
