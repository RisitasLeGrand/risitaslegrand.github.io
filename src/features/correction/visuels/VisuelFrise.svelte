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
   * ## Les libellés sont décalés en quinconce
   *
   * Deux jalons proches — 1958 et 1962 sur un siècle — voient leurs libellés se
   * chevaucher au point d'être illisibles, et c'est le cas le plus fréquent
   * d'une frise à l'échelle : les dates qui comptent se groupent. Les libellés
   * alternent donc entre deux rangées, au-dessus pour la date, au-dessous pour
   * le texte. Cela ne garantit pas l'absence de recouvrement — trois jalons
   * collés se gêneront encore — mais cela écarte le cas courant sans rien coûter
   * à la lecture.
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
  const Y_AXE = 62;
  /** Le décalage de la seconde rangée, pour les jalons de rang impair. */
  const QUINCONCE = 13;

  const intervalles = $derived(donnees.intervalles ?? []);
  const hauteur = $derived(Y_AXE + 46 + QUINCONCE + intervalles.length * 24 + 14);

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

  /** Le rang d'une date dans la liste des jalons, pour les intervalles. */
  const rangDe = (date: number | string) =>
    donnees.jalons.findIndex((j) => String(j.date) === String(date));
</script>

<Cadre largeur={LARGEUR} hauteur={hauteur} {alt} titre={legende} marqueurs={marqueursDuVisuel(donnees)}>
  <line x1={X0} y1={Y_AXE} x2={X1} y2={Y_AXE} class="stroke-slate-400 dark:stroke-slate-500" stroke-width="1.5" />

  {#each donnees.jalons as jalon, i (i)}
    {@const px = x(jalon.date, i)}
    {@const couleur = jalon.marqueur ? MARQUEURS[jalon.marqueur].couleur : 'var(--etat-texte-faible)'}
    {@const decale = i % 2 === 1 ? QUINCONCE : 0}
    {@const part = (px - X0) / Math.max(1, X1 - X0)}
    {@const ancre = part < 0.12 ? 'start' : part > 0.88 ? 'end' : 'middle'}
    {@const ancreX = ancre === 'start' ? X0 - 6 : ancre === 'end' ? X1 + 6 : px}
    <line x1={px} y1={Y_AXE - 6} x2={px} y2={Y_AXE + 6} stroke={couleur} stroke-width="2" />
    <circle cx={px} cy={Y_AXE} r={jalon.marqueur ? 5 : 3.5} fill={couleur} />
    <!-- Le trait de rappel relie le jalon à son libellé décalé, sans quoi on ne
         saurait pas lequel va avec lequel. -->
    {#if decale}
      <line x1={px} y1={Y_AXE + 8} x2={px} y2={Y_AXE + 14 + decale} stroke={couleur}
        stroke-width="0.8" stroke-dasharray="2 2" />
      <line x1={px} y1={Y_AXE - 8} x2={px} y2={Y_AXE - 16 - decale + 6} stroke={couleur}
        stroke-width="0.8" stroke-dasharray="2 2" />
    {/if}
    <text x={ancreX} y={Y_AXE - 14 - decale} text-anchor={ancre}
      class="fill-slate-700 text-[10px] font-semibold dark:fill-slate-200">{jalon.date}</text>
    <text x={ancreX} y={Y_AXE + 22 + decale} text-anchor={ancre}
      class="fill-slate-600 text-[10px] dark:fill-slate-300">{jalon.libelle}</text>
  {/each}

  {#each intervalles as intervalle, i (i)}
    {@const rangA = rangDe(intervalle.de)}
    {@const rangB = rangDe(intervalle.a)}
    {@const xa = x(intervalle.de, rangA < 0 ? 0 : rangA)}
    {@const xb = x(intervalle.a, rangB < 0 ? donnees.jalons.length - 1 : rangB)}
    {@const y = Y_AXE + 46 + QUINCONCE + i * 24}
    {@const couleur = intervalle.marqueur ? MARQUEURS[intervalle.marqueur].couleur : 'var(--etat-action)'}
    <line x1={xa} y1={y} x2={xb} y2={y} stroke={couleur} stroke-width="3" stroke-linecap="round" />
    <line x1={xa} y1={y - 4} x2={xa} y2={y + 4} stroke={couleur} stroke-width="1.5" />
    <line x1={xb} y1={y - 4} x2={xb} y2={y + 4} stroke={couleur} stroke-width="1.5" />
    <text x={(xa + xb) / 2} y={y - 6} text-anchor="middle" class="fill-slate-600 text-[10px] dark:fill-slate-300"
      >{intervalle.libelle}</text>
  {/each}
</Cadre>
