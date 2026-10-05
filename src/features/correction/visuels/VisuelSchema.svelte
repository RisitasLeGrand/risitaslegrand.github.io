<script lang="ts">
  /**
   * Un schéma à niveaux : pyramide des normes, circuit, organigramme.
   *
   * Le `niveau` déclaré par chaque nœud décide de sa **rangée**, et sa position
   * dans la rangée est son ordre d'apparition. C'est volontairement pauvre :
   * laisser les données choisir des coordonnées libres aurait produit autant de
   * mises en page que de questions, et la première chose qu'on apprend d'un
   * schéma est sa forme — une hiérarchie se lit de haut en bas, toujours au
   * même endroit.
   *
   * ## Les boîtes s'adaptent à la rangée, et le texte y tient
   *
   * La première version donnait à toutes les boîtes 92 points de large et une
   * seule ligne de texte. Deux conséquences, visibles dès la première question
   * écrite pour de bon : à quatre nœuds sur une rangée les boîtes se
   * **chevauchaient**, et « Règlements de l'Union » débordait largement de la
   * sienne — sans que rien, dans le SVG, le signale.
   *
   * La largeur est donc calculée par rangée, à partir du pas disponible, et le
   * libellé est **replié** sur autant de lignes qu'il en faut, la hauteur de la
   * rangée suivant. Le prix est de ne plus avoir une grille parfaitement
   * régulière quand les rangées sont inégalement peuplées ; en échange, le
   * contenu décide de sa formulation sans se demander ce qui tiendra.
   */
  import Cadre from '../composants/Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import { marqueursDuVisuel } from './types';
  import type { DonneesSchema } from './types';

  let { donnees, alt, legende }: { donnees: DonneesSchema; alt: string; legende?: string } = $props();

  const LARGEUR = 340;
  /** Largeur d'un caractère à 10 points, mesurée sur la police du site. */
  const LARGEUR_CARACTERE = 5.1;
  const HAUTEUR_LIGNE = 11;
  const L_BOITE_MAX = 150;
  const MARGE = 10;

  /** Replie un libellé sur des lignes qui tiennent dans `largeur`. */
  function replier(texte: string, largeur: number): string[] {
    const parCaracteres = Math.max(6, Math.floor((largeur - 8) / LARGEUR_CARACTERE));
    const lignes: string[] = [];
    let courante = '';
    for (const mot of texte.split(/\s+/)) {
      if (!courante) courante = mot;
      else if ((courante + ' ' + mot).length <= parCaracteres) courante += ' ' + mot;
      else {
        lignes.push(courante);
        courante = mot;
      }
    }
    if (courante) lignes.push(courante);
    return lignes;
  }

  const niveaux = $derived([...new Set(donnees.noeuds.map((n) => n.niveau))].sort((a, b) => a - b));

  /** Une boîte par nœud : sa place, sa taille, et son libellé déjà replié. */
  const boites = $derived.by(() => {
    const calculees = new Map<
      string,
      { x: number; y: number; largeur: number; hauteur: number; lignes: string[] }
    >();
    let y = MARGE;
    for (const niveau of niveaux) {
      const freres = donnees.noeuds.filter((n) => n.niveau === niveau);
      const pas = LARGEUR / (freres.length + 1);
      const largeur = Math.min(L_BOITE_MAX, pas - MARGE);
      const repliees = freres.map((noeud) => replier(noeud.libelle, largeur));
      const lignesMax = Math.max(...repliees.map((l) => l.length));
      const hauteur = lignesMax * HAUTEUR_LIGNE + 12;
      freres.forEach((noeud, rang) => {
        calculees.set(noeud.id, {
          x: pas * (rang + 1),
          y: y + hauteur / 2,
          largeur,
          hauteur,
          lignes: repliees[rang],
        });
      });
      y += hauteur + 30;
    }
    return calculees;
  });

  const hauteur = $derived(
    Math.max(...[...boites.values()].map((b) => b.y + b.hauteur / 2), 40) + MARGE,
  );
</script>

<Cadre largeur={LARGEUR} {hauteur} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  {#each donnees.liens ?? [] as lien, i (i)}
    {@const p = boites.get(lien.de)}
    {@const q = boites.get(lien.a)}
    {#if p && q}
      {@const couleur = lien.marqueur ? MARQUEURS[lien.marqueur].couleur : 'var(--etat-texte-faible)'}
      <!--
        Un lien entre deux nœuds du **même niveau** se branche sur les côtés, et
        non sur le haut et le bas : relier le dessus de l'un au dessous de
        l'autre à hauteur égale trace une diagonale qui traverse les deux
        boîtes, et donne à lire une hiérarchie là où il n'y en a pas.
      -->
      {@const memeRangee = Math.abs(q.y - p.y) < 1}
      {@const versLaDroite = q.x > p.x}
      <line
        x1={memeRangee ? p.x + (versLaDroite ? p.largeur / 2 : -p.largeur / 2) : p.x}
        y1={memeRangee ? p.y : p.y + (q.y > p.y ? p.hauteur / 2 : -p.hauteur / 2)}
        x2={memeRangee ? q.x + (versLaDroite ? -q.largeur / 2 : q.largeur / 2) : q.x}
        y2={memeRangee ? q.y : q.y + (q.y > p.y ? -q.hauteur / 2 : q.hauteur / 2)}
        stroke={couleur}
        stroke-width={lien.marqueur ? MARQUEURS[lien.marqueur].epaisseur : 1.4}
        stroke-dasharray={lien.marqueur ? (MARQUEURS[lien.marqueur].tirets ?? undefined) : undefined}
        marker-end="url(#fleche-correction)"
        style="color: {couleur}"
      />
      {#if lien.libelle}
        <!-- Le libellé du lien se pose sur un fond opaque : au-dessus d'un
             trait, un texte seul devient illisible là où ils se croisent. -->
        {@const lx = (p.x + q.x) / 2}
        {@const ly = (p.y + q.y) / 2 - 3}
        <text
          x={lx}
          y={ly}
          text-anchor="middle"
          class="fill-slate-500 text-[9px] dark:fill-slate-400"
          stroke="var(--etat-fond-eleve)"
          stroke-width="3"
          paint-order="stroke"
        >{lien.libelle}</text>
      {/if}
    {/if}
  {/each}

  {#each donnees.noeuds as noeud (noeud.id)}
    {@const boite = boites.get(noeud.id)}
    {#if boite}
      {@const couleur = noeud.marqueur ? MARQUEURS[noeud.marqueur].couleur : undefined}
      <rect
        x={boite.x - boite.largeur / 2}
        y={boite.y - boite.hauteur / 2}
        width={boite.largeur}
        height={boite.hauteur}
        rx="5"
        class="fill-white dark:fill-slate-900"
        stroke={couleur ?? 'var(--etat-texte-faible)'}
        stroke-width={noeud.marqueur ? 2.4 : 1.2}
      />
      {#each boite.lignes as ligne, j (j)}
        <text
          x={boite.x}
          y={boite.y - ((boite.lignes.length - 1) * HAUTEUR_LIGNE) / 2 + j * HAUTEUR_LIGNE + 3.5}
          text-anchor="middle"
          class="fill-slate-900 text-[10px] font-medium dark:fill-white">{ligne}</text>
      {/each}
    {/if}
  {/each}
</Cadre>
