<script lang="ts">
  /**
   * Une frise : des jalons datés sur un axe, et des intervalles sous l'axe.
   *
   * Les dates peuvent être des nombres (des années) ou des chaînes (« 1958 »,
   * « IVe siècle »). Quand **toutes** sont numériques, l'axe est à l'échelle et
   * les écarts se lisent ; dès qu'une seule ne l'est pas, les jalons sont
   * répartis à intervalles égaux. Mélanger les deux — placer ce qui est
   * numérique à l'échelle et le reste au jugé — donnerait une frise dont une
   * partie ment sur les distances, ce qui est pire qu'une frise sans échelle.
   *
   * ## Les libellés sont rangés par rangées, et non en quinconce
   *
   * La première version alternait deux rangées, ce qui suffit à deux jalons
   * voisins. Cinq jalons portant de vrais libellés — « CE refuse (Semoule) »,
   * « Cass. accepte (Jacques Vabre) » — se chevauchaient encore, au point que
   * trois textes n'en formaient plus qu'un seul illisible. Et rien ne le
   * signalait : le SVG ne se plaint pas d'un recouvrement.
   *
   * Chaque libellé est donc **placé dans la première rangée où il ne heurte
   * aucun de ceux qui y sont déjà**, sa largeur étant estimée d'après sa
   * longueur. Le dessin gagne en hauteur quand il le faut, et seulement alors :
   * une frise à deux jalons courts tient toujours sur une rangée.
   *
   * ## Et ancrés aux bords
   *
   * Un libellé centré sur un jalon proche d'un bord **sort du cadre**, et le
   * `viewBox` le coupe : « Élection au suffrage direct » devenait « ection au
   * suffrage direct ». Les jalons des premiers et derniers dixièmes ancrent donc
   * leur texte par le début ou par la fin, ce qui le ramène à l'intérieur.
   */
  import Cadre from '../composants/Cadre.svelte';
  import { MARQUEURS } from '../vocabulaire';
  import { marqueursDuVisuel } from './types';
  import type { DonneesFrise } from './types';

  let { donnees, alt, legende }: { donnees: DonneesFrise; alt: string; legende?: string } = $props();

  const LARGEUR = 340;
  const X0 = 30;
  const X1 = LARGEUR - 30;
  /** Largeur d'un caractère à 10 points, et marge entre deux libellés. */
  const LARGEUR_CARACTERE = 5.1;
  const ECART_MINIMAL = 6;
  const HAUTEUR_RANGEE = 12;

  const intervalles = $derived(donnees.intervalles ?? []);

  const valeurs = $derived(donnees.jalons.map((j) => Number(j.date)));
  const aLEchelle = $derived(valeurs.every((v) => Number.isFinite(v)));
  const min = $derived(aLEchelle ? Math.min(...valeurs) : 0);
  const etendue = $derived(aLEchelle ? Math.max(1, Math.max(...valeurs) - min) : 1);

  const x = (date: number | string, rang: number) => {
    if (!aLEchelle) {
      const n = Math.max(1, donnees.jalons.length - 1);
      return X0 + (rang / n) * (X1 - X0);
    }
    return X0 + ((Number(date) - min) / etendue) * (X1 - X0);
  };

  /** L'ancrage d'un texte selon sa proximité d'un bord, et son abscisse. */
  function ancrage(px: number) {
    const part = (px - X0) / Math.max(1, X1 - X0);
    const ancre = part < 0.12 ? 'start' : part > 0.88 ? 'end' : 'middle';
    return { ancre, ax: ancre === 'start' ? X0 - 6 : ancre === 'end' ? X1 + 6 : px };
  }

  /**
   * Range des textes en rangées où ils ne se heurtent pas.
   *
   * Glouton, et dans l'ordre des jalons : le premier jalon reste en rangée 0,
   * ce qui garde la lecture naturelle quand rien ne se chevauche.
   */
  function ranger(textes: { ax: number; ancre: string; texte: string }[]): number[] {
    const occupees: [number, number][][] = [];
    return textes.map(({ ax, ancre, texte }) => {
      const largeur = texte.length * LARGEUR_CARACTERE;
      const debut = ancre === 'start' ? ax : ancre === 'end' ? ax - largeur : ax - largeur / 2;
      const span: [number, number] = [debut - ECART_MINIMAL, debut + largeur + ECART_MINIMAL];
      let rangee = 0;
      while (
        occupees[rangee]?.some(([a, b]) => span[0] < b && span[1] > a)
      ) {
        rangee += 1;
      }
      (occupees[rangee] ??= []).push(span);
      return rangee;
    });
  }

  const places = $derived(
    donnees.jalons.map((jalon, i) => {
      const px = x(jalon.date, i);
      return { jalon, px, ...ancrage(px) };
    }),
  );

  const rangeesDates = $derived(
    ranger(places.map((p) => ({ ax: p.ax, ancre: p.ancre, texte: String(p.jalon.date) }))),
  );
  const rangeesLibelles = $derived(
    ranger(places.map((p) => ({ ax: p.ax, ancre: p.ancre, texte: p.jalon.libelle }))),
  );

  const hautDesDates = $derived((Math.max(0, ...rangeesDates) + 1) * HAUTEUR_RANGEE + 10);
  const basDesLibelles = $derived((Math.max(0, ...rangeesLibelles) + 1) * HAUTEUR_RANGEE + 10);

  const Y_AXE = $derived(hautDesDates + 8);
  /*
   * Les intervalles commencent sous la dernière rangée de libellés, et non à
   * son contact : la barre se posait sinon sur le texte de la rangée la plus
   * basse, et son propre libellé s'y mêlait.
   */
  const Y_INTERVALLES = $derived(Y_AXE + basDesLibelles + 16);
  const hauteur = $derived(Y_INTERVALLES + intervalles.length * 24 + 8);

  /** Le rang d'une date dans la liste des jalons, pour les intervalles. */
  const rangDe = (date: number | string) =>
    donnees.jalons.findIndex((j) => String(j.date) === String(date));
</script>

<Cadre largeur={LARGEUR} {hauteur} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  <line x1={X0} y1={Y_AXE} x2={X1} y2={Y_AXE} class="stroke-slate-400 dark:stroke-slate-500" stroke-width="1.5" />

  {#each places as place, i (i)}
    {@const couleur = place.jalon.marqueur ? MARQUEURS[place.jalon.marqueur].couleur : 'var(--etat-texte-faible)'}
    {@const yDate = Y_AXE - 12 - rangeesDates[i] * HAUTEUR_RANGEE}
    {@const yLibelle = Y_AXE + 20 + rangeesLibelles[i] * HAUTEUR_RANGEE}
    <line x1={place.px} y1={Y_AXE - 6} x2={place.px} y2={Y_AXE + 6} stroke={couleur} stroke-width="2" />
    <circle cx={place.px} cy={Y_AXE} r={place.jalon.marqueur ? 5 : 3.5} fill={couleur} />
    <!-- Les traits de rappel relient le jalon à ses textes dès qu'ils sont
         décalés d'une rangée : sans eux, on ne sait plus lequel va avec lequel. -->
    {#if rangeesDates[i] > 0}
      <line x1={place.px} y1={Y_AXE - 8} x2={place.px} y2={yDate + 2} stroke={couleur}
        stroke-width="0.8" stroke-dasharray="2 2" />
    {/if}
    {#if rangeesLibelles[i] > 0}
      <line x1={place.px} y1={Y_AXE + 8} x2={place.px} y2={yLibelle - 8} stroke={couleur}
        stroke-width="0.8" stroke-dasharray="2 2" />
    {/if}
    <text x={place.ax} y={yDate} text-anchor={place.ancre}
      class="fill-slate-700 text-[10px] font-semibold dark:fill-slate-200">{place.jalon.date}</text>
    <text x={place.ax} y={yLibelle} text-anchor={place.ancre}
      class="fill-slate-600 text-[10px] dark:fill-slate-300">{place.jalon.libelle}</text>
  {/each}

  {#each intervalles as intervalle, i (i)}
    {@const rangA = rangDe(intervalle.de)}
    {@const rangB = rangDe(intervalle.a)}
    {@const xa = x(intervalle.de, rangA < 0 ? 0 : rangA)}
    {@const xb = x(intervalle.a, rangB < 0 ? donnees.jalons.length - 1 : rangB)}
    {@const y = Y_INTERVALLES + i * 24}
    {@const couleur = intervalle.marqueur ? MARQUEURS[intervalle.marqueur].couleur : 'var(--etat-action)'}
    <line x1={xa} y1={y} x2={xb} y2={y} stroke={couleur} stroke-width="3" stroke-linecap="round" />
    <line x1={xa} y1={y - 4} x2={xa} y2={y + 4} stroke={couleur} stroke-width="1.5" />
    <line x1={xb} y1={y - 4} x2={xb} y2={y + 4} stroke={couleur} stroke-width="1.5" />
    <text x={(xa + xb) / 2} y={y - 6} text-anchor="middle" class="fill-slate-600 text-[10px] dark:fill-slate-300"
      >{intervalle.libelle}</text>
  {/each}
</Cadre>
