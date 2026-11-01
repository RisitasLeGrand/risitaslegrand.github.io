// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import config from './site.config.mjs';
import { execFileSync } from 'node:child_process';

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
/**
 * LA VERSION DE L'APPLICATION, LUE À L'ASSEMBLAGE — B4 du prompt 58.
 *
 * Elle était « inconnue » dans toute sauvegarde, parce que `service.ts` la
 * cherchait dans un champ `version` que `site.config.mjs` n'a jamais porté.
 * Elle est donc déterminée ici, au seul moment où l'on sait quel code est en
 * train d'être assemblé.
 *
 * TROIS SOURCES, DANS CET ORDRE, et la dernière avoue :
 *
 * 1. `CYCLADES_VERSION`, si l'assemblage la donne. C'est la porte d'un
 *    assemblage publié, où l'on veut un numéro choisi plutôt qu'une empreinte ;
 * 2. le dépôt git : l'empreinte courte du commit, préfixée d'un « g » pour
 *    qu'elle ne se confonde pas avec un nombre, et le jour de l'assemblage.
 *    C'est la seule forme qui permette de retrouver le code EXACT qui a écrit
 *    un fichier, ce qui est toute l'utilité du champ ;
 * 3. faute des deux, une chaîne qui DIT qu'elle ne sait pas. Elle ne prétend
 *    pas être une version, et c'est précisément ce que « inconnue » faisait.
 *
 * POURQUOI CECI NE LÈVE PAS. Un assemblage hors dépôt — une archive, un
 * conteneur sans git — est légitime, et faire échouer la construction pour un
 * champ d'en-tête serait disproportionné. La garde est ailleurs, dans
 * `essais:version`, qui refuse les placeholders et exige la forme du dépôt
 * quand le dépôt est là. Un contrôle qui casse les cas légitimes finit
 * désactivé ; un essai qui accuse reste.
 *
 * UN REPLI SILENCIEUX A CACHÉ MON PROPRE DÉFAUT, et cela mérite d'être écrit
 * ici. Ma première version appelait `require('node:child_process')` — or ce
 * fichier est un module ESM, où `require` n'existe pas. Le `catch` avalait donc
 * « require is not defined » et rendait « indéterminée (assemblage hors
 * dépôt) », sur une machine qui porte un dépôt git parfaitement sain.
 *
 * Rien ne l'a dit. J'ai cru avoir traité le cas du hors-dépôt alors que je
 * n'avais traité aucun cas, et c'est l'écran — « Cyclades, publication
 * indéterminée » — qui a fini par parler. C'est la faute même que B4 corrige,
 * commise dans le code qui la corrige : un repli qui ne distingue pas
 * « je ne peux pas savoir » de « je me suis trompé » transforme un défaut en
 * situation normale.
 *
 * L'import est donc en tête du fichier, où une erreur de nom casse
 * l'assemblage au lieu de se taire.
 *
 * ET L'EMPREINTE EST CELLE DU COMMIT, PAS DE L'ARBRE DE TRAVAIL. Un assemblage
 * fait sur un arbre modifié porte donc l'empreinte de son dernier commit, ce
 * qui est inexact d'un cheveu et bien plus utile que rien. Le suffixe
 * « -modifie » le dit quand c'est le cas.
 */
function versionDeLAssemblage() {
  const annoncee = process.env.CYCLADES_VERSION;
  if (annoncee && annoncee.trim() !== '') return annoncee.trim();
  try {
    const git = (...args) =>
      execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const empreinte = git('rev-parse', '--short=8', 'HEAD');
    if (!/^[0-9a-f]{7,40}$/.test(empreinte)) return 'indéterminée (assemblage hors dépôt)';
    const modifie = git('status', '--porcelain') !== '' ? '-modifie' : '';
    const jour = new Date().toISOString().slice(0, 10);
    return `g${empreinte}${modifie} · ${jour}`;
  } catch {
    return 'indéterminée (assemblage hors dépôt)';
  }
}

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
    define: {
      /*
         Remplacée dans le paquet par la valeur, et non lue à l'exécution : un
         fichier écrit par cette version porte donc l'identité du code qui l'a
         écrit, et non celle du code qui le relit.
      */
      __VERSION_CYCLADES__: JSON.stringify(versionDeLAssemblage()),
    },
  },

  integrations: [svelte()],
});