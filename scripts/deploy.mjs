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
 *
 * DEUX EXCEPTIONS, publiées à côté du build Astro sans jamais l'écraser :
 *
 *
 *  - le dossier « actualites-data/ », qui ne vient pas du build
 * mais du dépôt lui-même. Ses entrées sont chiffrées avec la clé publique de la
 * rubrique — les routines de veille peuvent donc les écrire sans détenir le mot
 * de passe du site, et elles restent illisibles sur GitHub Pages. Le script
 * refuse de publier un fichier de ce dossier qui ne serait pas une enveloppe
 * chiffrée : c'est le garde-fou qui empêche une actualité de partir en clair.
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import {
  brancheCourante,
  commitsDeRetard,
  DOSSIER_ACTUALITES,
  ecrireInventaire,
  verifierActualitesChiffrees,
} from './lib/actualites-publication.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(racine, 'dist');
const branche = config.brancheDeploiement;

/** Source de vérité de la rubrique : le dossier versionné du dépôt. */
const actualitesDepot = path.join(racine, DOSSIER_ACTUALITES);


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

// --- Retard sur le dépôt distant -----------------------------------------
// La branche de publication est reconstruite par « push --force ». Si le clone
// local est en retard sur « origin », ce dossier « actualites-data/ » est plus
// pauvre que celui du dépôt : la publication effacerait alors de GitHub Pages
// des actualités déjà en ligne — celles qu'une routine de veille a fusionnées
// depuis le dernier « git pull ». On refuse donc de publier un clone en retard.
//
// Un échec de « git fetch » n'est pas bloquant : hors ligne, on publie ce
// qu'on a, en le disant.
const brancheLocale = brancheCourante(racine);

if (brancheLocale && !process.argv.includes('--forcer')) {
  const enRetard = commitsDeRetard(racine, brancheLocale);
  if (enRetard === null) {
    console.log(
      `› Dépôt distant injoignable : impossible de vérifier si « ${brancheLocale} » est à jour.`,
    );
  } else if (enRetard) {
    echouer(
      `Le clone local est en retard de ${enRetard} commit(s) sur « origin/${brancheLocale} ».\n` +
        '  Publier maintenant effacerait de GitHub Pages les actualités fusionnées entre-temps.\n' +
        `  Mettez à jour :  git pull origin ${brancheLocale}\n` +
        '  Pour passer outre en connaissance de cause :  npm run deploy -- --forcer',
    );
  }
}

// --- Construction de la branche de publication ----------------------------
const temporaire = await mkdtemp(path.join(tmpdir(), 'publication-'));
try {
  // Seul « dist/ » est copié : rien d'autre ne peut se retrouver en ligne.
  await cp(dist, temporaire, { recursive: true });
  // Désactive la construction Jekyll de GitHub (sinon les dossiers commençant
  // par « _ », comme _astro, seraient ignorés).
  await writeFile(path.join(temporaire, '.nojekyll'), '');

  // --- Rubrique Actualités -------------------------------------------------
  // Le dossier vient du dépôt, jamais du build : une copie locale de
  // démonstration éventuellement présente dans « dist/ » est écartée d'office.
  const actualitesDansTemp = path.join(temporaire, DOSSIER_ACTUALITES);
  await rm(actualitesDansTemp, { recursive: true, force: true });

  if (existsSync(actualitesDepot)) {
    await cp(actualitesDepot, actualitesDansTemp, { recursive: true });
    const inventaire = await verifierActualitesChiffrees(actualitesDansTemp);
    // L'inventaire est écrit **après** la vérification, et dans la copie
    // temporaire seulement : il n'entre jamais dans le dépôt, et la
    // vérification ne se prononce donc pas sur lui. Il est chiffré par
    // construction, avec la même clé publique que les entrées.
    await ecrireInventaire(actualitesDansTemp, inventaire);
  } else {
    console.log(
      `› « ${DOSSIER_ACTUALITES}/ » absent du dépôt : la rubrique Actualités restera masquée.`,
    );
  }


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
