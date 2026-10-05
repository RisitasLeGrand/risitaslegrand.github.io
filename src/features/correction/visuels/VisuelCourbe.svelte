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
   *
   * ## Les repères ne se marchent pas dessus
   *
   * Un repère pose son libellé juste au-dessus de son point. Deux repères
   * voisins — « sans taxe » et « reçu : 4,5 », à un demi-pas l'un de l'autre —
   * superposaient donc leurs textes, et la correction qui expliquait le partage
   * de la taxe devenait illisible à l'endroit même du partage. Les libellés
   * sont maintenant remontés d'un cran tant qu'ils en heurtent un autre, et
   * basculés à gauche de leur point quand ils déborderaient du cadre à droite.
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

  /** Largeur d'un caractère à 10 points, pour estimer un libellé. */
  const LARGEUR_CARACTERE = 5.1;

  /**
   * Les noms de séries, écartés jusqu'à ne plus se heurter.
   *
   * Chaque nom se pose au bout de sa courbe. Deux courbes qui finissent au même
   * niveau — un solde effectif qui a rejoint son solde structurel, deux parts
   * de PIB qui se croisent — y écrivaient donc deux noms l'un sur l'autre, et
   * c'est précisément quand les courbes se rejoignent qu'on a besoin de savoir
   * laquelle est laquelle.
   */
  const nomsDeSeries = $derived.by(() => {
    const prises: [number, number][] = [];
    return donnees.series.map((serie) => {
      const dernier = serie.points[serie.points.length - 1];
      const largeur = serie.nom.length * LARGEUR_CARACTERE;
      // Ancré par la fin : le nom s'écrit à gauche du dernier point, donc à
      // l'intérieur du repère, et jamais au-delà du bord droit.
      const ax = Math.max(X0 + largeur + 2, Math.min(px(dernier[0]) - 3, X1));
      let y = py(dernier[1]) - 6;
      for (let essai = 0; essai < 8; essai += 1) {
        if (!prises.some(([a, b]) => y - 9 < b && y + 2 > a)) break;
        y -= 11;
      }
      prises.push([y - 9, y + 2]);
      return { ax, y };
    });
  });

  /** Les libellés de repères, remontés jusqu'à ne plus se heurter. */
  const etiquettes = $derived.by(() => {
    const prises: [number, number, number, number][] = [];
    return (donnees.reperes ?? []).map((repere) => {
      const largeur = repere.libelle.length * LARGEUR_CARACTERE;
      const droite = px(repere.x) + 7;
      const aGauche = droite + largeur > X1;
      const ancre = aGauche ? 'end' : 'start';
      const ax = aGauche ? px(repere.x) - 7 : droite;
      let y = py(repere.y) - 6;
      const boite = (): [number, number, number, number] => [
        aGauche ? ax - largeur : ax,
        aGauche ? ax : ax + largeur,
        y - 9,
        y + 2,
      ];
      for (let essai = 0; essai < 8; essai += 1) {
        const [a, b, c, d] = boite();
        if (!prises.some(([e, f, g, h]) => a < f && b > e && c < h && d > g)) break;
        y -= 11;
      }
      prises.push(boite());
      return { ancre, ax, y };
    });
  });
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  <line x1={X0} y1={Y0} x2={X1} y2={Y0} class="stroke-slate-400 dark:stroke-slate-500" stroke-width="1.4" />
  <line x1={X0} y1={Y0} x2={X0} y2={Y1} class="stroke-slate-400 dark:stroke-slate-500" stroke-width="1.4" />
  <!-- Le nom de l'axe est centré sous lui, et non calé à droite où il
       chevauchait la graduation maximale. -->
  <text x={(X0 + X1) / 2} y={Y0 + 26} text-anchor="middle"
    class="fill-slate-600 text-[10px] dark:fill-slate-300">{donnees.axeX.nom}</text>
  <!-- Le nom de l'axe des ordonnées est ancré au bord gauche du cadre, et non
       à l'axe : ancré à l'axe, « Solde (% du PIB) » débordait du viewBox par la
       gauche et s'affichait « du PIB) ». Il passe aussi au-dessus du maximum,
       qu'il chevauchait dès que celui-ci avait trois chiffres. -->
  <text x="2" y={Y1 - 7} text-anchor="start" class="fill-slate-600 text-[10px] dark:fill-slate-300"
    >{donnees.axeY.nom}</text>
  <text x={X0 - 6} y={Y1 + 3} text-anchor="end" class="fill-slate-500 text-[9px] dark:fill-slate-400"
    >{donnees.axeY.max}</text>
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
    {@const place = nomsDeSeries[i]}
    <text x={place.ax} y={place.y} text-anchor="end"
      class="fill-slate-700 text-[10px] font-medium dark:fill-slate-200">{serie.nom}</text>
  {/each}

  {#each donnees.reperes ?? [] as repere, i (i)}
    {@const couleur = repere.marqueur ? MARQUEURS[repere.marqueur].couleur : 'var(--etat-accent)'}
    <line x1={X0} y1={py(repere.y)} x2={px(repere.x)} y2={py(repere.y)} stroke={couleur}
      stroke-width="1" stroke-dasharray="3 3" />
    <line x1={px(repere.x)} y1={Y0} x2={px(repere.x)} y2={py(repere.y)} stroke={couleur}
      stroke-width="1" stroke-dasharray="3 3" />
    <circle cx={px(repere.x)} cy={py(repere.y)} r="4.5" fill={couleur} />
    {@const place = etiquettes[i]}
    <!-- Un trait de rappel dès que le libellé a dû être remonté : sans lui, on
         ne saurait plus à quel point il se rapporte. -->
    {#if place.y < py(repere.y) - 8}
      <line x1={px(repere.x)} y1={py(repere.y) - 5} x2={px(repere.x)} y2={place.y + 2}
        stroke={couleur} stroke-width="0.8" stroke-dasharray="2 2" />
    {/if}
    <text x={place.ax} y={place.y} text-anchor={place.ancre}
      class="fill-slate-700 text-[10px] font-medium dark:fill-slate-200">{repere.libelle}</text>
  {/each}
</Cadre>
