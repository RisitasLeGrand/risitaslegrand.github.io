<script lang="ts">
  /**
   * Une courbe dans un repère nommé : offre et demande, suite, fonction.
   *
   * Les axes portent leurs bornes **déclarées** et non les bornes des points :
   * une courbe dont l'échelle se recadre sur ses données change de forme d'une
   * question à l'autre, et l'on croit voir une pente là où il n'y a qu'un
   * zoom. Le repère est celui qu'on a voulu, et les points qui en sortiraient
   * sont rognés par le cadre — ce qui se voit, et vaut mieux qu'un axe qui
   * ment.
   */
  import Cadre from '../composants/Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import { marqueursDuVisuel } from './types';
  import type { DonneesCourbe } from './types';

  let { donnees, alt, legende }: { donnees: DonneesCourbe; alt: string; legende?: string } = $props();

  const LARGEUR = 340;
  const HAUTEUR = 240;
  const MARGE_G = 42;
  const MARGE_B = 34;
  const X0 = MARGE_G;
  const X1 = LARGEUR - 16;
  const Y0 = HAUTEUR - MARGE_B;
  const Y1 = 18;

  const px = (x: number) =>
    X0 + ((x - donnees.axeX.min) / (donnees.axeX.max - donnees.axeX.min)) * (X1 - X0);
  const py = (y: number) =>
    Y0 - ((y - donnees.axeY.min) / (donnees.axeY.max - donnees.axeY.min)) * (Y0 - Y1);

  const chemin = (points: [number, number][]) =>
    points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${px(x)} ${py(y)}`).join(' ');

  /** Une série sans marqueur reste lisible : on alterne plein et tirets. */
  const TIRETS_PAR_DEFAUT = [null, '6 4', '2 3', '8 3 2 3'];
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  <line x1={X0} y1={Y0} x2={X1} y2={Y0} class="stroke-slate-400 dark:stroke-slate-500" stroke-width="1.4" />
  <line x1={X0} y1={Y0} x2={X0} y2={Y1} class="stroke-slate-400 dark:stroke-slate-500" stroke-width="1.4" />
  <!-- Le nom de l'axe est centré sous lui, et non calé à droite où il
       chevauchait la graduation maximale. -->
  <text x={(X0 + X1) / 2} y={Y0 + 26} text-anchor="middle"
    class="fill-slate-600 text-[10px] dark:fill-slate-300">{donnees.axeX.nom}</text>
  <text x={X0 - 6} y={Y1 + 2} text-anchor="end" class="fill-slate-600 text-[10px] dark:fill-slate-300"
    >{donnees.axeY.nom}</text>
  <text x={X0} y={Y0 + 14} text-anchor="middle" class="fill-slate-500 text-[9px] dark:fill-slate-400"
    >{donnees.axeX.min}</text>
  <text x={X1} y={Y0 + 14} text-anchor="middle" class="fill-slate-500 text-[9px] dark:fill-slate-400"
    >{donnees.axeX.max}</text>
  <text x={X0 - 6} y={Y0 + 3} text-anchor="end" class="fill-slate-500 text-[9px] dark:fill-slate-400"
    >{donnees.axeY.min}</text>

  {#each donnees.series as serie, i (i)}
    {@const couleur = serie.marqueur ? MARQUEURS[serie.marqueur].couleur : 'var(--etat-action)'}
    <path
      d={chemin(serie.points)}
      fill="none"
      stroke={couleur}
      stroke-width={serie.marqueur ? MARQUEURS[serie.marqueur].epaisseur + 0.6 : 2}
      stroke-dasharray={serie.marqueur
        ? (MARQUEURS[serie.marqueur].tirets ?? undefined)
        : (TIRETS_PAR_DEFAUT[i % TIRETS_PAR_DEFAUT.length] ?? undefined)}
      stroke-linejoin="round"
    />
    {@const dernier = serie.points[serie.points.length - 1]}
    <text x={px(dernier[0]) - 3} y={py(dernier[1]) - 6} text-anchor="end"
      class="fill-slate-700 text-[10px] font-medium dark:fill-slate-200">{serie.nom}</text>
  {/each}

  {#each donnees.reperes ?? [] as repere, i (i)}
    {@const couleur = repere.marqueur ? MARQUEURS[repere.marqueur].couleur : 'var(--etat-accent)'}
    <line x1={X0} y1={py(repere.y)} x2={px(repere.x)} y2={py(repere.y)} stroke={couleur}
      stroke-width="1" stroke-dasharray="3 3" />
    <line x1={px(repere.x)} y1={Y0} x2={px(repere.x)} y2={py(repere.y)} stroke={couleur}
      stroke-width="1" stroke-dasharray="3 3" />
    <circle cx={px(repere.x)} cy={py(repere.y)} r="4.5" fill={couleur} />
    <text x={px(repere.x) + 7} y={py(repere.y) - 6} class="fill-slate-700 text-[10px] font-medium dark:fill-slate-200"
      >{repere.libelle}</text>
  {/each}
</Cadre>
