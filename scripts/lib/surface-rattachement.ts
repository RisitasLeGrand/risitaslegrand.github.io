/**
 * LA SURFACE DU DÉPÔT QUE LA MESURE DU REPÊCHAGE APPELLE.
 *
 * Ce fichier ne contient aucune logique : il ne fait que réexporter. Il existe
 * parce que `scripts/mesurer-cout-du-repechage.mts` doit appeler le VRAI
 * `rattacher` — pas une transcription qui dériverait du jour où quelqu'un
 * touche au barème — et que `rattachement.ts` tire `normaliser` de
 * `src/lib/ui.ts`, lequel lit `import.meta.env.BASE_URL`. Cette globale est
 * posée par Vite à la construction ; `tsx` ne la fournit pas.
 *
 * La mesure passe donc ce point d'entrée à esbuild en définissant cette
 * globale. Un point d'entrée nommé plutôt qu'une liste de fichiers dans le
 * script : c'est ici que se lit ce que la mesure touche au dépôt, et un
 * `import` cassé se verra au type-check au lieu de n'apparaître qu'à
 * l'exécution.
 */
export { aplatirFiches } from '../../src/lib/contenu';
export { construireIndexTexte, rattacher } from '../../src/lib/rattachement';
export { normaliser } from '../../src/lib/ui';
