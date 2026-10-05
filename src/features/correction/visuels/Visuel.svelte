<script lang="ts">
  /**
   * Le répartiteur : un visuel déclaratif, rendu selon son type.
   *
   * C'est le seul endroit du site qui connaisse les huit types. Un type nouveau
   * s'ajoute ici, dans `scripts/lib/visuels.mjs` pour sa validation, et dans
   * `types.ts` pour sa forme — trois endroits, et le contrôle de contenu refuse
   * ce que ce fichier ne saurait pas dessiner.
   *
   * ## Le type `aucun` n'est pas un vide
   *
   * Il porte `raison_aucun`, et cette raison est **affichée**. Une correction
   * sans dessin n'est pas une correction bâclée : certaines questions n'ont
   * rien à montrer, et le dire vaut mieux que laisser croire qu'un visuel
   * manque. Le schéma l'exige, l'écran l'honore.
   *
   * ## Ce qui se passe si les données sont malformées
   *
   * Rien ne devrait arriver ici : le build refuse une correction dont les
   * `donnees` ne correspondent pas à leur type. Mais une banque peut avoir été
   * chiffrée avant que le contrôle existe, et un composant qui jette casse la
   * page entière de révision. On rend donc l'alternative textuelle, qui est
   * obligatoire et dit déjà ce que le dessin aurait montré.
   */
  import VisuelFrise from './VisuelFrise.svelte';
  import VisuelTableau from './VisuelTableau.svelte';
  import VisuelSchema from './VisuelSchema.svelte';
  import VisuelCourbe from './VisuelCourbe.svelte';
  import VisuelVenn from './VisuelVenn.svelte';
  import VisuelFigure from './VisuelFigure.svelte';
  import VisuelGrille from './VisuelGrille.svelte';
  import VisuelTexteAnnote from './VisuelTexteAnnote.svelte';
  import type {
    DonneesCourbe,
    DonneesFigure,
    DonneesFrise,
    DonneesGrille,
    DonneesSchema,
    DonneesTableau,
    DonneesTexteAnnote,
    DonneesVenn,
    Visuel,
  } from './types';

  let { visuel }: { visuel: Visuel } = $props();

  const alt = $derived(visuel.alt ?? '');

  /**
   * Les données sont-elles au moins de la forme attendue ?
   *
   * Un contrôle minimal, et non une seconde validation : la validation
   * complète est au build, en zod, et la refaire dans le navigateur
   * coûterait à chaque visiteur. On vérifie seulement que le champ dont
   * chaque composant part existe, ce qui suffit à ne pas jeter.
   */
  const utilisable = $derived.by(() => {
    const d = visuel.donnees as Record<string, unknown> | undefined;
    if (!d || typeof d !== 'object') return false;
    switch (visuel.type) {
      case 'frise':
        return Array.isArray(d.jalons) && d.jalons.length > 0;
      case 'tableau':
        return Array.isArray(d.entetes) && Array.isArray(d.lignes);
      case 'schema':
        return Array.isArray(d.noeuds) && d.noeuds.length > 0;
      case 'courbe':
        return Array.isArray(d.series) && Boolean(d.axeX) && Boolean(d.axeY);
      case 'venn':
        return Array.isArray(d.ensembles) && d.ensembles.length >= 2;
      case 'figure':
        return Array.isArray(d.points) && d.points.length >= 2;
      case 'grille':
        return typeof d.colonnes === 'number' && typeof d.lignes === 'number';
      case 'texte_annote':
        return Array.isArray(d.segments) && d.segments.length > 0;
      default:
        return false;
    }
  });
</script>

{#if visuel.type === 'aucun'}
  <p class="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600
    dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
    <span class="font-medium">Pas de schéma ici.</span>
    {visuel.raison_aucun}
  </p>
{:else if !utilisable}
  <p class="my-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900
    dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
    {alt || 'Le schéma de cette correction n’a pas pu être affiché.'}
  </p>
{:else if visuel.type === 'frise'}
  <VisuelFrise donnees={visuel.donnees as DonneesFrise} {alt} legende={visuel.legende} />
{:else if visuel.type === 'tableau'}
  <VisuelTableau donnees={visuel.donnees as DonneesTableau} {alt} />
  {#if visuel.legende}<p class="mt-1 mb-3 text-sm text-slate-600 dark:text-slate-300">{visuel.legende}</p>{/if}
{:else if visuel.type === 'schema'}
  <VisuelSchema donnees={visuel.donnees as DonneesSchema} {alt} legende={visuel.legende} />
{:else if visuel.type === 'courbe'}
  <VisuelCourbe donnees={visuel.donnees as DonneesCourbe} {alt} legende={visuel.legende} />
{:else if visuel.type === 'venn'}
  <VisuelVenn donnees={visuel.donnees as DonneesVenn} {alt} legende={visuel.legende} />
{:else if visuel.type === 'figure'}
  <VisuelFigure donnees={visuel.donnees as DonneesFigure} {alt} legende={visuel.legende} />
{:else if visuel.type === 'grille'}
  <VisuelGrille donnees={visuel.donnees as DonneesGrille} {alt} />
  {#if visuel.legende}<p class="mt-1 mb-3 text-sm text-slate-600 dark:text-slate-300">{visuel.legende}</p>{/if}
{:else if visuel.type === 'texte_annote'}
  <VisuelTexteAnnote donnees={visuel.donnees as DonneesTexteAnnote} {alt} />
  {#if visuel.legende}<p class="mt-1 mb-3 text-sm text-slate-600 dark:text-slate-300">{visuel.legende}</p>{/if}
{/if}
