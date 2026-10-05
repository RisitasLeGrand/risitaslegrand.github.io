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
   */
  import Cadre from '../composants/Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import { marqueursDuVisuel } from './types';
  import type { DonneesSchema } from './types';

  let { donnees, alt, legende }: { donnees: DonneesSchema; alt: string; legende?: string } = $props();

  const LARGEUR = 340;
  const H_RANGEE = 62;
  const L_BOITE = 92;
  const H_BOITE = 30;

  const niveaux = $derived([...new Set(donnees.noeuds.map((n) => n.niveau))].sort((a, b) => a - b));
  const hauteur = $derived(niveaux.length * H_RANGEE + 24);

  const position = $derived(
    new Map(
      donnees.noeuds.map((noeud) => {
        const rangee = niveaux.indexOf(noeud.niveau);
        const freres = donnees.noeuds.filter((n) => n.niveau === noeud.niveau);
        const rang = freres.indexOf(noeud);
        const pas = LARGEUR / (freres.length + 1);
        return [noeud.id, { x: pas * (rang + 1), y: 26 + rangee * H_RANGEE }];
      }),
    ),
  );
</script>

<Cadre largeur={LARGEUR} hauteur={hauteur} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  {#each donnees.liens ?? [] as lien, i (i)}
    {@const p = position.get(lien.de)}
    {@const q = position.get(lien.a)}
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
        x1={memeRangee ? p.x + (versLaDroite ? L_BOITE / 2 : -L_BOITE / 2) : p.x}
        y1={memeRangee ? p.y : p.y + (q.y > p.y ? H_BOITE / 2 : -H_BOITE / 2)}
        x2={memeRangee ? q.x + (versLaDroite ? -L_BOITE / 2 : L_BOITE / 2) : q.x}
        y2={memeRangee ? q.y : q.y + (q.y > p.y ? -H_BOITE / 2 : H_BOITE / 2)}
        stroke={couleur}
        stroke-width={lien.marqueur ? MARQUEURS[lien.marqueur].epaisseur : 1.4}
        stroke-dasharray={lien.marqueur ? (MARQUEURS[lien.marqueur].tirets ?? undefined) : undefined}
        marker-end="url(#fleche-correction)"
        style="color: {couleur}"
      />
      {#if lien.libelle}
        <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 3} text-anchor="middle"
          class="fill-slate-500 text-[9px] dark:fill-slate-400">{lien.libelle}</text>
      {/if}
    {/if}
  {/each}

  {#each donnees.noeuds as noeud (noeud.id)}
    {@const p = position.get(noeud.id)}
    {#if p}
      {@const couleur = noeud.marqueur ? MARQUEURS[noeud.marqueur].couleur : undefined}
      <rect
        x={p.x - L_BOITE / 2} y={p.y - H_BOITE / 2} width={L_BOITE} height={H_BOITE} rx="5"
        class="fill-white dark:fill-slate-900"
        stroke={couleur ?? 'var(--etat-texte-faible)'}
        stroke-width={noeud.marqueur ? 2.4 : 1.2}
      />
      <text x={p.x} y={p.y + 3.5} text-anchor="middle"
        class="fill-slate-900 text-[10px] font-medium dark:fill-white">{noeud.libelle}</text>
    {/if}
  {/each}
</Cadre>
