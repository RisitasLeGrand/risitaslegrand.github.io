// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import config from './site.config.mjs';

import svelte from '@astrojs/svelte';

/**
 * NE SERVIR QUE LE WOFF2 DE KATEX.
 *
 * La feuille de KaTeX déclare trois formats par fonte — woff2, woff et ttf —
 * et Vite recopie donc les soixante fichiers, soit 1,2 Mo, là où le woff2 seul
 * en pèse 296 Ko. Le transfert est le même, puisqu'un navigateur essaie le
 * woff2 d'abord et s'arrête là ; mais 900 Ko sont déployés pour n'être jamais
 * demandés, et un contrôle de ce qui part hors ligne les compterait.
 *
 * Le tri est fait ICI plutôt que sur une copie de la feuille : une feuille
 * recopiée dans le dépôt se périmerait à la première montée de version de
 * KaTeX, sans que rien ne le dise. Fait à l'assemblage, le tri suit la version
 * installée.
 *
 * Et il REFUSE de se taire : si la feuille change de forme et qu'il ne trouve
 * plus rien à retirer, il lève. Un tri qui ne trie plus et laisse passer 1,2 Mo
 * en silence est exactement le genre de contrôle qui finit par rassurer.
 */
function queLeWoff2DeKatex() {
  /* « .woff » sans le « 2 » qui suit, et « .ttf ». */
  const SOURCES_EN_TROP = /,\s*url\(([^)]*\.(?:woff(?!2)|ttf))\)\s*format\("(?:woff|truetype)"\)/g;
  const FICHIERS_EN_TROP = /KaTeX_[^/]*\.(?:woff(?!2)|ttf)$/;
  return {
    name: 'cyclades:que-le-woff2-de-katex',
    apply: 'build',
    generateBundle(_options, bundle) {
      let sourcesRetirees = 0;
      let fichiersRetires = 0;
      /*
         Astro assemble en PLUSIEURS passes, et toutes ne portent pas la
         feuille de KaTeX. Un garde-fou qui lèverait sur une passe sans KaTeX
         casserait la construction pour rien : il ne doit se plaindre que là où
         il y avait quelque chose à trier. Constaté à la première mesure — la
         première passe retirait bien 40 fichiers, la seconde n'avait rien à
         faire, et la construction échouait.
      */
      const porteDuKatex = Object.entries(bundle).some(
        ([nom, actif]) =>
          FICHIERS_EN_TROP.test(nom) ||
          (nom.endsWith('.css') && actif.type === 'asset' && String(actif.source).includes('KaTeX_')),
      );
      for (const [nom, actif] of Object.entries(bundle)) {
        if (FICHIERS_EN_TROP.test(nom)) {
          delete bundle[nom];
          fichiersRetires += 1;
          continue;
        }
        if (!nom.endsWith('.css') || actif.type !== 'asset') continue;
        const avant = String(actif.source);
        if (!avant.includes('KaTeX_')) continue;
        const apres = avant.replace(SOURCES_EN_TROP, () => {
          sourcesRetirees += 1;
          return '';
        });
        actif.source = apres;
      }
      if (!porteDuKatex) return;
      if (fichiersRetires === 0 || sourcesRetirees === 0) {
        throw new Error(
          'tri des polices de KaTeX : rien à retirer ' +
            `(${fichiersRetires} fichier(s), ${sourcesRetirees} source(s)). ` +
            'La feuille de KaTeX a changé de forme — relire le tri dans astro.config.mjs ' +
            'plutôt que de le laisser passer en silence.',
        );
      }
      this.warn(
        `KaTeX : ${fichiersRetires} fichier(s) de police écartés et ` +
          `${sourcesRetirees} source(s) retirées de la feuille — woff2 seul.`,
      );
    },
  };
}

// https://astro.build/config
export default defineConfig({
  // Chemin de base sur GitHub Pages (voir site.config.mjs).
  base: config.base,

  trailingSlash: 'ignore',

  // L'ancienne rubrique « Entraînement » est devenue « Cog-Training » : on
  // conserve une redirection pour les favoris et les liens déjà partagés.
  redirects: {
    '/entrainement': '/cog-training',
  },

  build: {
    // Un dossier par page : les URL restent propres sur GitHub Pages.
    format: 'directory',
  },

  vite: {
    plugins: [tailwindcss(), queLeWoff2DeKatex()],
  },

  integrations: [svelte()],
});