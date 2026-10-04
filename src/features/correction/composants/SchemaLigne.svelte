<script lang="ts">
  /**
   * Des entités sur une ligne, avec les relations de l'énoncé en arcs.
   *
   * C'est le support naturel de tout ce qui s'ordonne : rangs, comparaisons,
   * frises chronologiques, « entre ». Chaque prémisse est un **arc au-dessus de
   * la ligne** plutôt qu'une flèche sur la ligne, pour deux raisons : les arcs
   * ne se confondent pas avec l'axe, et ils peuvent se chevaucher sans se
   * masquer puisqu'on les étage selon la distance qu'ils couvrent.
   *
   * La ligne elle-même ne montre les positions que lorsqu'elles sont établies.
   * Une entité dont la place reste indéterminée est dessinée dans une **zone**
   * plutôt qu'à un point : afficher une position fausse serait pire que n'en
   * afficher aucune.
   */
  import Cadre from './Cadre.svelte';
  import MarqueurSvg from './Marqueur.svelte';
  import { MARQUEURS, type Marqueur } from '../vocabulaire';

  export interface EntiteLigne {
    nom: string;
    /** Rang sur la ligne. Deux entités peuvent partager un rang. */
    position: number;
    marqueur?: Marqueur;
    /** Position encore indéterminée : on dessine une zone, de `position` à `jusqua`. */
    jusqua?: number;
  }

  export interface LienLigne {
    de: string;
    a: string;
    libelle?: string;
    marqueur: Marqueur;
  }

  let {
    entites = [] as EntiteLigne[],
    liens = [] as LienLigne[],
    axe = '',
    alt,
    titre,
  }: {
    entites: EntiteLigne[];
    liens?: LienLigne[];
    axe?: string;
    alt: string;
    titre?: string;
  } = $props();

  const MARGE = 28;
  const LARGEUR = 320;

  /** Hauteur réservée aux arcs : un étage par longueur d'arc distincte. */
  const etages = $derived(
    Math.max(
      1,
      new Set(
        liens.map((l) => Math.abs(rang(l.a) - rang(l.de))),
      ).size,
    ),
  );
  const HAUT_ARCS = $derived(18 + etages * 13);
  const Y_LIGNE = $derived(HAUT_ARCS + 10);
  const HAUTEUR = $derived(Y_LIGNE + 38);

  const rangs = $derived(entites.map((e) => e.position));
  const min = $derived(rangs.length ? Math.min(...rangs) : 0);
  const max = $derived(
    rangs.length ? Math.max(...entites.map((e) => e.jusqua ?? e.position)) : 1,
  );

  function rang(nom: string) {
    return entites.find((e) => e.nom === nom)?.position ?? 0;
  }

  /** Un rang en abscisse. */
  function x(position: number) {
    if (max === min) return LARGEUR / 2;
    return MARGE + ((position - min) / (max - min)) * (LARGEUR - 2 * MARGE);
  }

  const marqueursEmployes = $derived([
    ...new Set([
      ...entites.flatMap((e) => (e.marqueur ? [e.marqueur] : [])),
      ...liens.map((l) => l.marqueur),
    ]),
  ]);

  /** Les arcs, étagés : plus un arc est long, plus il monte. */
  const arcs = $derived(
    liens.map((lien) => {
      const x1 = x(rang(lien.de));
      const x2 = x(rang(lien.a));
      const portee = Math.abs(rang(lien.a) - rang(lien.de));
      const hauteur = 16 + portee * 11;
      const sommet = Math.max(8, Y_LIGNE - hauteur);
      return {
        ...lien,
        d: `M ${x1} ${Y_LIGNE - 10} Q ${(x1 + x2) / 2} ${sommet} ${x2} ${Y_LIGNE - 10}`,
        mx: (x1 + x2) / 2,
        my: sommet + (Y_LIGNE - 10 - sommet) * 0.28,
        style: MARQUEURS[lien.marqueur],
      };
    }),
  );
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} {titre} marqueurs={marqueursEmployes}>
  <!-- L'axe -->
  <line
    x1={MARGE - 14} y1={Y_LIGNE} x2={LARGEUR - MARGE + 14} y2={Y_LIGNE}
    stroke="var(--etat-bordure-forte)" stroke-width="1.2"
    marker-end="url(#fleche-correction)" color="var(--etat-bordure-forte)"
  />
  {#if axe}
    <text
      x={LARGEUR - MARGE + 14} y={Y_LIGNE + 26} text-anchor="end"
      fill="var(--etat-texte-faible)" font-size="9"
    >{axe}</text>
  {/if}

  <!-- Les zones d'indétermination, sous la ligne pour ne pas masquer les arcs -->
  {#each entites.filter((e) => e.jusqua !== undefined) as entite (entite.nom)}
    <rect
      x={x(entite.position)} y={Y_LIGNE - 5}
      width={Math.max(4, x(entite.jusqua ?? entite.position) - x(entite.position))} height="10"
      rx="2"
      fill="url(#hachures-correction)" stroke="var(--etat-texte-faible)" stroke-width="1"
      stroke-dasharray="3 2" color="var(--etat-texte-faible)"
    />
  {/each}

  <!-- Les arcs de relation -->
  {#each arcs as arc, i (`${arc.de}-${arc.a}-${i}`)}
    <path
      d={arc.d} fill="none" stroke={arc.style.couleur}
      stroke-width={arc.style.epaisseur}
      stroke-dasharray={arc.style.tirets ?? undefined}
      marker-end="url(#fleche-correction)" color={arc.style.couleur}
    />
    {#if arc.libelle}
      <text
        x={arc.mx} y={arc.my} text-anchor="middle"
        fill={arc.style.couleur} font-size="8.5"
      >{arc.libelle}</text>
    {/if}
  {/each}

  <!-- Les entités -->
  {#each entites as entite (entite.nom)}
    {@const px = x(entite.position)}
    {#if entite.marqueur}
      <MarqueurSvg marqueur={entite.marqueur} x={px} y={Y_LIGNE} taille={11} />
    {:else}
      <circle cx={px} cy={Y_LIGNE} r="4" fill="var(--etat-texte)" />
    {/if}
    <text
      x={px} y={Y_LIGNE + 15} text-anchor="middle"
      fill="var(--etat-texte-fort)" font-size="10.5" font-weight="600"
    >{entite.nom}</text>
  {/each}
</Cadre>
