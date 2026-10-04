<script lang="ts">
  /**
   * Un diagramme de Hasse : un ordre partiel, par niveaux, sans les arêtes
   * qu'on peut déduire.
   *
   * La convention est celle du domaine et il faut la tenir : on ne dessine que
   * les relations de **couverture**. Si A < B < C, on trace A–B et B–C, jamais
   * A–C. Ajouter A–C donnerait à croire que la transitivité est un fait de plus
   * à vérifier, alors qu'elle est la règle de lecture du dessin.
   *
   * L'intérêt pour la correction est la **zone d'incomparabilité** : deux
   * éléments qu'aucun chemin ne relie sont incomparables, et c'est exactement ce
   * que les moteurs d'indétermination font chercher. On la hachure plutôt que
   * de la laisser vide.
   */
  import Cadre from './Cadre.svelte';
  import MarqueurSvg from './Marqueur.svelte';
  import { MARQUEURS, type Marqueur } from '../vocabulaire';

  export interface NoeudHasse {
    nom: string;
    /** 0 en bas ; les niveaux montent. */
    niveau: number;
    /** Rang horizontal dans son niveau. */
    rang: number;
    marqueur?: Marqueur;
  }

  let {
    noeuds = [] as NoeudHasse[],
    /** Seules les relations de couverture : A juste en dessous de B. */
    couvertures = [] as { bas: string; haut: string; marqueur?: Marqueur }[],
    /** La paire interrogée, tracée en pointillés s'il n'y a pas de chemin. */
    interrogee = undefined as { a: string; b: string } | undefined,
    alt,
    titre,
  }: {
    noeuds: NoeudHasse[];
    couvertures?: { bas: string; haut: string; marqueur?: Marqueur }[];
    interrogee?: { a: string; b: string };
    alt: string;
    titre?: string;
  } = $props();

  const LARGEUR = 300;
  const MARGE = 30;
  const niveaux = $derived(Math.max(1, ...noeuds.map((n) => n.niveau)) + 1);
  const HAUTEUR = $derived(MARGE * 2 + (niveaux - 1) * 52);

  const parNiveau = $derived(
    noeuds.reduce<Map<number, number>>((acc, n) => {
      acc.set(n.niveau, Math.max(acc.get(n.niveau) ?? 0, n.rang + 1));
      return acc;
    }, new Map()),
  );

  function pos(nom: string) {
    const n = noeuds.find((x) => x.nom === nom);
    if (!n) return null;
    const combien = parNiveau.get(n.niveau) ?? 1;
    const pas = (LARGEUR - 2 * MARGE) / Math.max(1, combien);
    return {
      x: MARGE + pas * (n.rang + 0.5),
      // Le niveau 0 en bas : l'axe des y du SVG descend, on inverse.
      y: HAUTEUR - MARGE - n.niveau * 52,
    };
  }

  const marqueursEmployes = $derived([
    ...new Set([
      ...noeuds.flatMap((n) => (n.marqueur ? [n.marqueur] : [])),
      ...couvertures.flatMap((c) => (c.marqueur ? [c.marqueur] : [])),
      ...(interrogee ? (['deduit'] as Marqueur[]) : []),
    ]),
  ]);
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} {titre} marqueurs={marqueursEmployes}>
  {#each couvertures as couverture, i (`${couverture.bas}-${couverture.haut}-${i}`)}
    {@const p = pos(couverture.bas)}
    {@const q = pos(couverture.haut)}
    {@const style = couverture.marqueur ? MARQUEURS[couverture.marqueur] : null}
    {#if p && q}
      <line
        x1={p.x} y1={p.y - 12} x2={q.x} y2={q.y + 12}
        stroke={style?.couleur ?? 'var(--etat-bordure-forte)'}
        stroke-width={style?.epaisseur ?? 1.4}
        stroke-dasharray={style?.tirets ?? undefined}
      />
    {/if}
  {/each}

  {#if interrogee}
    {@const p = pos(interrogee.a)}
    {@const q = pos(interrogee.b)}
    {#if p && q}
      <line
        x1={p.x} y1={p.y} x2={q.x} y2={q.y}
        stroke={MARQUEURS.deduit.couleur} stroke-width="1.6" stroke-dasharray="2 4"
      />
      <text
        x={(p.x + q.x) / 2 + 6} y={(p.y + q.y) / 2}
        fill={MARQUEURS.deduit.couleur} font-size="11" font-weight="700"
      >?</text>
    {/if}
  {/if}

  {#each noeuds as noeud (noeud.nom)}
    {@const p = pos(noeud.nom)}
    {#if p}
      {#if noeud.marqueur}
        <MarqueurSvg marqueur={noeud.marqueur} x={p.x} y={p.y} taille={13} />
      {:else}
        <circle cx={p.x} cy={p.y} r="5" fill="var(--etat-texte)" />
      {/if}
      <text
        x={p.x} y={p.y - 11} text-anchor="middle"
        fill="var(--etat-texte-fort)" font-size="10.5" font-weight="600"
      >{noeud.nom}</text>
    {/if}
  {/each}
</Cadre>
