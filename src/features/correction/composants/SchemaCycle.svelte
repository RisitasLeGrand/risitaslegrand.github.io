<script lang="ts">
  /**
   * Un cycle de dominance (Z₃, Z₅…) dessiné en cercle, avec ses flèches « bat ».
   *
   * Ce schéma existe pour une erreur précise et très fréquente : appliquer la
   * transitivité à une relation qui n'est pas transitive. Pierre bat ciseaux,
   * ciseaux bat papier, donc pierre bat papier — sauf que non, papier bat
   * pierre. Le dessin le rend évident, là où aucune phrase n'y parvient : on
   * **voit** que la flèche attendue existe en sens inverse.
   *
   * D'où le trait distinctif de ce composant : l'inférence fautive est tracée,
   * puis barrée à l'endroit exact où elle échoue, à côté de la flèche réelle.
   */
  import Cadre from './Cadre.svelte';
  import { MARQUEURS, type Marqueur } from '../vocabulaire';

  export interface FlecheCycle {
    de: string;
    a: string;
    marqueur?: Marqueur;
  }

  let {
    entites = [] as string[],
    fleches = [] as FlecheCycle[],
    /** L'inférence transitive attendue à tort, tracée en corde et barrée. */
    fautive = undefined as { de: string; a: string } | undefined,
    verbe = 'bat',
    alt,
    titre,
  }: {
    entites: string[];
    fleches?: FlecheCycle[];
    fautive?: { de: string; a: string };
    verbe?: string;
    alt: string;
    titre?: string;
  } = $props();

  const COTE = 260;
  const RAYON = 88;
  const RAYON_NOEUD = 19;

  const positions = $derived(
    new Map(
      entites.map((nom, i) => {
        const angle = (i / Math.max(1, entites.length)) * 2 * Math.PI - Math.PI / 2;
        return [
          nom,
          { x: COTE / 2 + RAYON * Math.cos(angle), y: COTE / 2 + RAYON * Math.sin(angle) },
        ];
      }),
    ),
  );

  function segment(de: string, a: string) {
    const p = positions.get(de);
    const q = positions.get(a);
    if (!p || !q) return null;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    const marge = RAYON_NOEUD + 4;
    return {
      x1: p.x + (dx / l) * marge,
      y1: p.y + (dy / l) * marge,
      x2: q.x - (dx / l) * marge,
      y2: q.y - (dy / l) * marge,
      mx: (p.x + q.x) / 2,
      my: (p.y + q.y) / 2,
    };
  }

  const marqueursEmployes = $derived([
    ...new Set([
      ...fleches.flatMap((f) => (f.marqueur ? [f.marqueur] : [])),
      ...(fautive ? (['exclu'] as Marqueur[]) : []),
    ]),
  ]);
</script>

<Cadre largeur={COTE} hauteur={COTE} {alt} {titre} marqueurs={marqueursEmployes}>
  {#each fleches as fleche, i (`${fleche.de}-${fleche.a}-${i}`)}
    {@const s = segment(fleche.de, fleche.a)}
    {@const style = fleche.marqueur ? MARQUEURS[fleche.marqueur] : null}
    {#if s}
      <line
        x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
        stroke={style?.couleur ?? 'var(--etat-bordure-forte)'}
        stroke-width={style?.epaisseur ?? 1.6}
        stroke-dasharray={style?.tirets ?? undefined}
        marker-end="url(#fleche-correction)"
        color={style?.couleur ?? 'var(--etat-bordure-forte)'}
      />
      <text
        x={s.mx} y={s.my - 4} text-anchor="middle"
        fill={style?.couleur ?? 'var(--etat-texte-faible)'} font-size="8"
      >{verbe}</text>
    {/if}
  {/each}

  {#if fautive}
    {@const s = segment(fautive.de, fautive.a)}
    {#if s}
      <!-- La corde de l'inférence attendue à tort… -->
      <line
        x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
        stroke={MARQUEURS.exclu.couleur} stroke-width="1.8" stroke-dasharray="5 4"
      />
      <!-- …barrée en son milieu, à l'endroit où elle échoue -->
      <g stroke={MARQUEURS.exclu.couleur} stroke-width="2.4" stroke-linecap="round">
        <line x1={s.mx - 7} y1={s.my - 7} x2={s.mx + 7} y2={s.my + 7} />
        <line x1={s.mx - 7} y1={s.my + 7} x2={s.mx + 7} y2={s.my - 7} />
      </g>
      <text
        x={s.mx} y={s.my + 22} text-anchor="middle"
        fill={MARQUEURS.exclu.couleur} font-size="8.5" font-weight="600"
      >la transitivité échoue ici</text>
    {/if}
  {/if}

  {#each entites as nom (nom)}
    {@const p = positions.get(nom)}
    {#if p}
      <circle
        cx={p.x} cy={p.y} r={RAYON_NOEUD}
        fill="var(--etat-fond-eleve)" stroke="var(--etat-bordure-forte)" stroke-width="1.5"
      />
      <text
        x={p.x} y={p.y + 4} text-anchor="middle"
        fill="var(--etat-texte-fort)" font-size="11" font-weight="600"
      >{nom}</text>
    {/if}
  {/each}
</Cadre>
