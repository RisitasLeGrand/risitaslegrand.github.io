#!/usr/bin/env node
/**
 * Publication sur GitHub Pages.
 *
 * Suppose que « npm run build » vient d'être exécuté (chiffrement + astro build).
 * Ne publie que le dossier « dist/ », qui ne contient que du contenu chiffré.
 *
 * La branche de publication est reconstruite à chaque fois depuis zéro, dans un
 * dossier temporaire : son contenu est donc exactement celui de « dist/ », sans
 * résidu d'une publication précédente. Son historique n'a aucune valeur — tout
 * y est régénérable —, d'où le « push --force ».
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(racine, 'dist');
const branche = config.brancheDeploiement;

function echouer(message) {
  console.error(`\n\x1b[31m✖ ${message}\x1b[0m\n`);
  process.exit(1);
}

/** Exécute une commande git et retourne sa sortie. */
function git(dossier, ...args) {
  return execFileSync('git', ['-C', dossier, ...args], { encoding: 'utf8' }).trim();
}

// --- Vérifications préalables --------------------------------------------
if (!existsSync(dist)) {
  echouer('Le dossier « dist/ » est absent. Lancez d\'abord « npm run build ».');
}
if (existsSync(path.join(dist, 'content'))) {
  echouer('« dist/content » existe : publication annulée par sécurité.');
}

const cheminCle = path.join(dist, 'data', 'cle.json');
if (!existsSync(cheminCle)) {
  echouer('« dist/data/cle.json » est absent : le contenu n\'a pas été chiffré.');
}
JSON.parse(await readFile(cheminCle, 'utf8')); // échoue si le fichier est corrompu

let depot;
try {
  depot = git(racine, 'remote', 'get-url', 'origin');
} catch {
  echouer(
    'Aucun dépôt distant « origin » n\'est configuré.\n' +
      '  Ajoutez-le :  git remote add origin https://github.com/<compte>/<depot>.git',
  );
}

// --- Construction de la branche de publication ----------------------------
const temporaire = await mkdtemp(path.join(tmpdir(), 'publication-'));
try {
  // Seul « dist/ » est copié : rien d'autre ne peut se retrouver en ligne.
  await cp(dist, temporaire, { recursive: true });
  // Désactive la construction Jekyll de GitHub (sinon les dossiers commençant
  // par « _ », comme _astro, seraient ignorés).
  await writeFile(path.join(temporaire, '.nojekyll'), '');

  git(temporaire, 'init', '-q', '-b', branche);
  git(temporaire, 'remote', 'add', 'origin', depot);

  // Identité locale au dépôt temporaire, pour ne dépendre d'aucune configuration.
  let nom = 'Publication';
  let courriel = 'publication@localhost';
  try {
    nom = git(racine, 'config', 'user.name') || nom;
    courriel = git(racine, 'config', 'user.email') || courriel;
  } catch {
    /* pas de configuration git globale : on garde les valeurs par défaut */
  }
  git(temporaire, 'config', 'user.name', nom);
  git(temporaire, 'config', 'user.email', courriel);

  // « -f » ignore un éventuel .gitignore global de la machine.
  git(temporaire, 'add', '-A', '-f', '.');
  git(temporaire, 'commit', '-q', '-m', `Publication ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);

  const fichiers = git(temporaire, 'ls-files').split('\n').filter(Boolean).length;
  console.log(`› Publication de ${fichiers} fichier(s) sur la branche « ${branche} »…`);

  git(temporaire, 'push', '--force', 'origin', `${branche}:${branche}`);
  console.log('✓ Publié. Le site sera en ligne dans une minute environ.');
} catch (erreur) {
  echouer(`Échec de la publication :\n  ${erreur.message ?? erreur}`);
} finally {
  await rm(temporaire, { recursive: true, force: true });
}
