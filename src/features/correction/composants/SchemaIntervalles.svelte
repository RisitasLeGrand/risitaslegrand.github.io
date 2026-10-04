<script lang="ts">
  /**
   * Les treize relations d'Allen, dessinées comme deux intervalles sur une même
   * ligne du temps.
   *
   * Pourquoi dessiner chaque option plutôt que la nommer : « chevauche »,
   * « commence » et « pendant » se confondent dès qu'on les lit vite, et la
   * différence n'est visible que sur le dessin — qui des deux bords coïncide,
   * lequel dépasse. Une correction qui écrirait « la bonne réponse est
   * *overlaps* » n'apprendrait rien à qui a justement confondu *overlaps* et
   * *starts*.
   *
   * Les deux intervalles gardent la même couleur de rôle d'une option à
   * l'autre : le premier nommé en haut, le second en bas, toujours.
   */
  import Cadre from './Cadre.svelte';
  import { MARQUEURS, type Marqueur } from '../vocabulaire';

  /** Les positions relatives des deux intervalles, par relation d'Allen. */
  const DISPOSITIONS: Record<string, { a: [number, number]; b: [number, number] }> = {
    precede: { a: [0, 3], b: [5, 9] },
    precede_inv: { a: [5, 9], b: [0, 3] },
    rencontre: { a: [0, 4.5], b: [4.5, 9] },
    rencontre_inv: { a: [4.5, 9], b: [0, 4.5] },
    chevauche: { a: [0, 5.5], b: [3.5, 9] },
    chevauche_inv: { a: [3.5, 9], b: [0, 5.5] },
    commence: { a: [1, 4], b: [1, 9] },
    commence_inv: { a: [1, 9], b: [1, 4] },
    pendant: { a: [3, 6], b: [0.5, 8.5] },
    pendant_inv: { a: [0.5, 8.5], b: [3, 6] },
    finit: { a: [5, 8], b: [1, 8] },
    finit_inv: { a: [1, 8], b: [5, 8] },
    egale: { a: [1.5, 7.5], b: [1.5, 7.5] },
  };

  export interface OptionIntervalle {
    /** Identifiant de relation d'Allen, clef de `DISPOSITIONS`. */
    relation: string;
    libelle: string;
    marqueur: Marqueur;
    /** Pourquoi cette option est possible ou exclue. */
    raison?: string;
  }

  let {
    options = [] as OptionIntervalle[],
    nomA = 'A',
    nomB = 'B',
    alt,
    titre,
  }: {
    options: OptionIntervalle[];
    nomA?: string;
    nomB?: string;
    alt: string;
    titre?: string;
  } = $props();

  const LARGEUR = 320;
  const MARGE_G = 86;
  const HAUT_OPTION = 36;
  const HAUTEUR = $derived(14 + options.length * HAUT_OPTION);
  const UTILE = $derived(LARGEUR - MARGE_G - 16);

  const x = (t: number) => MARGE_G + (t / 9) * UTILE;

  const marqueursEmployes = $derived([...new Set(options.map((o) => o.marqueur))]);
</script>

<Cadre largeur={LARGEUR} hauteur={HAUTEUR} {alt} {titre} marqueurs={marqueursEmployes}>
  {#each options as option, i (option.relation)}
    {@const y = 16 + i * HAUT_OPTION}
    {@const d = DISPOSITIONS[option.relation] ?? DISPOSITIONS.egale}
    {@const style = MARQUEURS[option.marqueur]}

    <!-- Le libellé de l'option, et son verdict par la forme du marqueur -->
    <text
      x={MARGE_G - 8} y={y + 10} text-anchor="end"
      fill={style.couleur} font-size="9.5" font-weight="600"
    >{option.libelle}</text>

    <!-- L'intervalle du premier terme, en haut -->
    <line
      x1={x(d.a[0])} y1={y + 2} x2={x(d.a[1])} y2={y + 2}
      stroke="var(--etat-action)" stroke-width="3.2" stroke-linecap="butt"
    />
    <line x1={x(d.a[0])} y1={y - 2} x2={x(d.a[0])} y2={y + 6} stroke="var(--etat-action)" stroke-width="1.4" />
    <line x1={x(d.a[1])} y1={y - 2} x2={x(d.a[1])} y2={y + 6} stroke="var(--etat-action)" stroke-width="1.4" />
    <text x={x(d.a[0]) - 3} y={y - 4} text-anchor="end" fill="var(--etat-action)" font-size="8">{nomA}</text>

    <!-- L'intervalle du second terme, en bas -->
    <line
      x1={x(d.b[0])} y1={y + 14} x2={x(d.b[1])} y2={y + 14}
      stroke="var(--etat-texte-faible)" stroke-width="3.2" stroke-linecap="butt"
    />
    <line x1={x(d.b[0])} y1={y + 10} x2={x(d.b[0])} y2={y + 18} stroke="var(--etat-texte-faible)" stroke-width="1.4" />
    <line x1={x(d.b[1])} y1={y + 10} x2={x(d.b[1])} y2={y + 18} stroke="var(--etat-texte-faible)" stroke-width="1.4" />
    <text x={x(d.b[0]) - 3} y={y + 20} text-anchor="end" fill="var(--etat-texte-faible)" font-size="8">{nomB}</text>

    <!-- Une option exclue est barrée : la forme dit le verdict, pas la couleur -->
    {#if option.marqueur === 'exclu'}
      <line
        x1={MARGE_G - 2} y1={y + 8} x2={LARGEUR - 14} y2={y + 8}
        stroke={style.couleur} stroke-width="1.6" stroke-linecap="round"
      />
    {/if}
  {/each}
</Cadre>

{#if options.some((o) => o.raison)}
  <ul class="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
    {#each options.filter((o) => o.raison) as option (option.relation)}
      <li>
        <span aria-hidden="true">{MARQUEURS[option.marqueur].glyphe}</span>
        <strong class="font-medium">{option.libelle}</strong> —
        <span class="sr-only">{MARQUEURS[option.marqueur].libelle} : </span>{option.raison}
      </li>
    {/each}
  </ul>
{/if}
