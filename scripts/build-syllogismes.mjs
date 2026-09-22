#!/usr/bin/env node
/**
 * Construit l'exercice Syllogismes (application Angular vendorisée).
 *
 *   npm run syllogismes:build
 *
 * L'application vit dans « apps/syllogismes/ » avec sa propre chaîne de build,
 * indépendante d'Astro : Angular n'a pas d'intégration Astro, et l'empaqueter
 * en composant natif imposerait d'isoler Zone.js et de cloisonner Bootstrap
 * pour qu'il ne déborde pas sur le reste du site. Le résultat est publié comme
 * sous-site statique à « /syllogismes/ » et affiché dans une iframe par la page
 * « /cog-training/syllogismes/ ».
 *
 * « 404.html » est une copie de « index.html » : GitHub Pages sert ce fichier
 * pour toute URL inconnue, ce qui laisse le routeur Angular reprendre la main.
 */
import { execFileSync } from 'node:child_process';
import { copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const application = path.join(racine, 'apps', 'syllogismes');
const sortie = path.join(application, 'dist');

function echouer(message) {
  console.error(`\n\x1b[31m✖ ${message}\x1b[0m\n`);
  process.exit(1);
}

if (!existsSync(path.join(application, 'package.json'))) {
  echouer('« apps/syllogismes/ » est absent : l\'application n\'a pas été vendorisée.');
}
if (!existsSync(path.join(application, 'node_modules'))) {
  echouer(
    'Dépendances de Syllogismes absentes.\n' +
      '  Installez-les une fois :  npm run syllogismes:install',
  );
}

console.log('› Construction de Syllogismes (Angular)…');
try {
  execFileSync(
    'npx',
    [
      'ng',
      'build',
      '--configuration',
      'production',
      '--base-href',
      '/syllogismes/',
      '--output-path',
      'dist',
    ],
    { cwd: application, stdio: 'inherit' },
  );
} catch {
  echouer('Échec de la construction de Syllogismes.');
}

const index = path.join(sortie, 'index.html');
if (!existsSync(index)) echouer('Le build n\'a produit aucun « index.html ».');
await copyFile(index, path.join(sortie, '404.html'));

const fichiers = (await readdir(sortie)).length;
console.log(`\x1b[32m✓\x1b[0m Syllogismes construit — ${fichiers} entrée(s) dans apps/syllogismes/dist/`);
console.log('\x1b[90m  Publié à « /syllogismes/ » par « npm run deploy ».\x1b[0m');
