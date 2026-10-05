<script lang="ts">
  /**
   * Une figure géométrique : points nommés, segments cotés, angles marqués.
   *
   * Les coordonnées sont celles des données, ramenées au cadre par une
   * **homothétie unique** sur les deux axes. Mettre chaque axe à son échelle
   * remplirait mieux le cadre, mais déformerait la figure : un carré
   * deviendrait un rectangle et un angle droit cesserait d'en être un, sur un
   * dessin dont c'est précisément la question.
   */
  import Cadre from '../composants/Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import { marqueursDuVisuel } from './types';
  import type { DonneesFigure } from './types';

  let { donnees, alt, legende }: { donnees: DonneesFigure; alt: string; legende?: string } = $props();

  const COTE = 300;
  const MARGE = 28;

  const xs = $derived(donnees.points.map((p) => p.x));
  const ys = $derived(donnees.points.map((p) => p.y));
  const etendue = $derived(
    Math.max(1e-6, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))),
  );
  const echelle = $derived((COTE - 2 * MARGE) / etendue);
  // Centré : l'homothétie étant unique, l'axe le plus court laisse du vide, et
  // le vide se répartit des deux côtés plutôt que de pousser la figure en haut.
  const decalageX = $derived((COTE - (Math.max(...xs) - Math.min(...xs)) * echelle) / 2);
  const decalageY = $derived((COTE - (Math.max(...ys) - Math.min(...ys)) * echelle) / 2);

  const pos = $derived(
    new Map(
      donnees.points.map((p) => [
        p.id,
        {
          // L'axe des ordonnées est retourné : en SVG il descend, en géométrie
          // il monte, et une figure à l'envers est une figure fausse.
          x: decalageX + (p.x - Math.min(...xs)) * echelle,
          y: COTE - decalageY - (p.y - Math.min(...ys)) * echelle,
        },
      ]),
    ),
  );
</script>

<Cadre largeur={COTE} hauteur={COTE} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  {#each donnees.segments ?? [] as segment, i (i)}
    {@const p = pos.get(segment.de)}
    {@const q = pos.get(segment.a)}
    {#if p && q}
      {@const couleur = segment.marqueur ? MARQUEURS[segment.marqueur].couleur : 'var(--etat-texte-faible)'}
      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={couleur}
        stroke-width={segment.marqueur ? MARQUEURS[segment.marqueur].epaisseur + 0.6 : 1.6}
        stroke-dasharray={segment.marqueur ? (MARQUEURS[segment.marqueur].tirets ?? undefined) : undefined} />
      {#if segment.cote}
        <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 5} text-anchor="middle"
          class="fill-slate-700 text-[10px] font-medium dark:fill-slate-200">{segment.cote}</text>
      {/if}
    {/if}
  {/each}

  {#each donnees.angles ?? [] as angle, i (i)}
    {@const s = pos.get(angle.en)}
    {@const a = pos.get(angle.de)}
    {@const b = pos.get(angle.a)}
    {#if s && a && b}
      {@const couleur = angle.marqueur ? MARQUEURS[angle.marqueur].couleur : 'var(--etat-action)'}
      {@const ua = Math.atan2(a.y - s.y, a.x - s.x)}
      {@const ub = Math.atan2(b.y - s.y, b.x - s.x)}
      {@const r = 18}
      <path
        d={`M ${s.x + r * Math.cos(ua)} ${s.y + r * Math.sin(ua)} A ${r} ${r} 0 0 ${((ub - ua + 2 * Math.PI) % (2 * Math.PI)) > Math.PI ? 0 : 1} ${s.x + r * Math.cos(ub)} ${s.y + r * Math.sin(ub)}`}
        fill="none" stroke={couleur} stroke-width="1.6" />
      <text x={s.x + 26 * Math.cos((ua + ub) / 2)} y={s.y + 26 * Math.sin((ua + ub) / 2) + 3}
        text-anchor="middle" class="fill-slate-700 text-[10px] dark:fill-slate-200">{angle.libelle}</text>
    {/if}
  {/each}

  {#each donnees.points as point (point.id)}
    {@const p = pos.get(point.id)}
    {#if p}
      <circle cx={p.x} cy={p.y} r="3.5" class="fill-slate-700 dark:fill-slate-200" />
      <text x={p.x + 7} y={p.y - 6} class="fill-slate-900 text-[11px] font-semibold dark:fill-white"
        >{point.libelle ?? point.id}</text>
    {/if}
  {/each}
</Cadre>
