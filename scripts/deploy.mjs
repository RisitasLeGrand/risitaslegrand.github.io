#!/usr/bin/env node
/**
 * Publication sur GitHub Pages.
 * Suppose que « npm run build » vient d'être exécuté (chiffrement + astro build).
 * Ne pousse que le dossier « dist/ », qui ne contient que du contenu chiffré.
 */
import { publish } from 'gh-pages';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import config from '../site.config.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(racine, 'dist');

if (!existsSync(dist)) {
  console.error('✖ Le dossier « dist/ » est absent. Lancez d\'abord « npm run build ».');
  process.exit(1);
}

// Garde-fou : on refuse de publier si « content/ » s'est retrouvé dans dist/.
if (existsSync(path.join(dist, 'content'))) {
  console.error('✖ « dist/content » existe : publication annulée par sécurité.');
  process.exit(1);
}

const cle = path.join(dist, 'data', 'cle.json');
if (!existsSync(cle)) {
  console.error('✖ « dist/data/cle.json » est absent : le contenu n\'a pas été chiffré.');
  process.exit(1);
}
JSON.parse(await readFile(cle, 'utf8')); // échoue si le fichier est corrompu

console.log(`› Publication de dist/ sur la branche « ${config.brancheDeploiement} »…`);

publish(
  dist,
  {
    branch: config.brancheDeploiement,
    dotfiles: true, // nécessaire pour .nojekyll
    message: `Publication ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    nojekyll: true,
  },
  (err) => {
    if (err) {
      console.error('✖ Échec de la publication :', err.message ?? err);
      process.exit(1);
    }
    console.log('✓ Publié. Le site sera en ligne dans une minute environ.');
  },
);
