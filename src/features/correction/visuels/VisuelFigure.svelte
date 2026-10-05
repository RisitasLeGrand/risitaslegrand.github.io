<script lang="ts">
  /**
   * Une figure géométrique : points nommés, segments cotés, angles marqués.
   *
   * Les coordonnées sont celles des données, ramenées au cadre par une
   * **homothétie unique** sur les deux axes. Mettre chaque axe à son échelle
   * remplirait mieux le cadre, mais déformerait la figure : un carré
   * deviendrait un rectangle et un angle droit cesserait d'en être un, sur un
   * dessin dont c'est précisément la question.
   *
   * ## Les textes partent du centre, chacun de son côté
   *
   * Trois sortes de textes se disputent le voisinage d'un sommet : le nom du
   * point, le libellé de l'angle, et la cote des deux côtés qui en partent. La
   * première version les posait tous au même endroit — le nom à droite du
   * point, l'angle sur la bissectrice, la cote au milieu du segment — et sur un
   * triangle large ils se recouvraient tous les trois. « Parlement » sortait en
   * outre du cadre, rogné en « Parl ».
   *
   * Chacun part donc maintenant du **centre de la figure** dans sa direction
   * propre : le nom du point vers l'extérieur, le libellé de l'angle vers
   * l'intérieur, la cote perpendiculairement à son segment. Et le nom du point
   * est ramené dans le cadre quand sa largeur estimée l'en ferait sortir.
   */
  import Cadre from '../composants/Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import { marqueursDuVisuel } from './types';
  import type { DonneesFigure } from './types';

  let { donnees, alt, legende }: { donnees: DonneesFigure; alt: string; legende?: string } = $props();

  /** Le cadre est plus large que haut : les noms de sommets vivent sur les côtés. */
  const LARGEUR = 380;
  const HAUTEUR = 290;
  const MARGE = 30;
  /** Largeur d'un caractère à 11 points, pour ramener un nom dans le cadre. */
  const LARGEUR_CARACTERE = 5.6;

  const xs = $derived(donnees.points.map((p) => p.x));
  const ys = $derived(donnees.points.map((p) => p.y));
  const etendue = $derived(
    Math.max(1e-6, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))),
  );
  const echelle = $derived(Math.min(LARGEUR - 2 * MARGE, HAUTEUR - 2 * MARGE) / etendue);
  // Centré : l'homothétie étant unique, l'axe le plus court laisse du vide, et
  // le vide se répartit des deux côtés plutôt que de pousser la figure en haut.
  const decalageX = $derived((LARGEUR - (Math.max(...xs) - Math.min(...xs)) * echelle) / 2);
  const decalageY = $derived((HAUTEUR - (Math.max(...ys) - Math.min(...ys)) * echelle) / 2);

  const pos = $derived(
    new Map(
      donnees.points.map((p) => [
        p.id,
        {
          // L'axe des ordonnées est retourné : en SVG il descend, en géométrie
          // il monte, et une figure à l'envers est une figure fausse.
          x: decalageX + (p.x - Math.min(...xs)) * echelle,
          y: HAUTEUR - decalageY - (p.y - Math.min(...ys)) * echelle,
        },
      ]),
    ),
  );

  /** Le centre de la figure : toutes les directions en partent. */
  const centre = $derived.by(() => {
    const places = [...pos.values()];
    return {
      x: places.reduce((s, p) => s + p.x, 0) / places.length,
      y: places.reduce((s, p) => s + p.y, 0) / places.length,
    };
  });

  /** Un vecteur unitaire, et zéro si les deux points coïncident. */
  function unitaire(dx: number, dy: number) {
    const n = Math.hypot(dx, dy) || 1;
    return { ux: dx / n, uy: dy / n };
  }

  /** Où poser le nom d'un sommet : dehors, et dans le cadre. */
  function placeDuNom(p: { x: number; y: number }, texte: string) {
    const { ux, uy } = unitaire(p.x - centre.x, p.y - centre.y);
    const ancre = ux < -0.3 ? 'end' : ux > 0.3 ? 'start' : 'middle';
    let x = p.x + ux * 12;
    const y = p.y + uy * 12 + (uy > 0.3 ? 8 : uy < -0.3 ? -2 : 4);
    const largeur = texte.length * LARGEUR_CARACTERE;
    const gauche = ancre === 'end' ? x - largeur : ancre === 'middle' ? x - largeur / 2 : x;
    if (gauche < 3) x += 3 - gauche;
    const droite = gauche + largeur;
    if (droite > LARGEUR - 3) x -= droite - (LARGEUR - 3);
    return { x, y, ancre };
  }
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  {#each donnees.segments ?? [] as segment, i (i)}
    {@const p = pos.get(segment.de)}
    {@const q = pos.get(segment.a)}
    {#if p && q}
      {@const couleur = segment.marqueur ? MARQUEURS[segment.marqueur].couleur : 'var(--etat-texte-faible)'}
      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={couleur}
        stroke-width={segment.marqueur ? MARQUEURS[segment.marqueur].epaisseur + 0.6 : 1.6}
        stroke-dasharray={segment.marqueur ? (MARQUEURS[segment.marqueur].tirets ?? undefined) : undefined} />
      {#if segment.cote}
        <!-- La cote s'écarte du segment du côté opposé au centre : posée sur le
             trait, elle croisait le libellé de l'angle voisin. -->
        {@const mx = (p.x + q.x) / 2}
        {@const my = (p.y + q.y) / 2}
        {@const { ux, uy } = unitaire(mx - centre.x, my - centre.y)}
        <text x={mx + ux * 12} y={my + uy * 12 + 3} text-anchor="middle"
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
      <!-- Le libellé de l'angle part vers l'intérieur de la figure, là où le nom
           du sommet, qui part vers l'extérieur, ne peut plus le rencontrer. -->
      {@const { ux, uy } = unitaire(centre.x - s.x, centre.y - s.y)}
      <text x={s.x + ux * 34} y={s.y + uy * 34 + 3} text-anchor="middle"
        class="fill-slate-700 text-[10px] dark:fill-slate-200">{angle.libelle}</text>
    {/if}
  {/each}

  {#each donnees.points as point (point.id)}
    {@const p = pos.get(point.id)}
    {#if p}
      {@const place = placeDuNom(p, point.libelle ?? point.id)}
      <circle cx={p.x} cy={p.y} r="3.5" class="fill-slate-700 dark:fill-slate-200" />
      <text x={place.x} y={place.y} text-anchor={place.ancre}
        class="fill-slate-900 text-[11px] font-semibold dark:fill-white">{point.libelle ?? point.id}</text>
    {/if}
  {/each}
</Cadre>
