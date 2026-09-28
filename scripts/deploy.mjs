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
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import { chiffrerPourActualites, idStable, importerPubliqueActualites } from './lib/crypto.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(racine, 'dist');
const branche = config.brancheDeploiement;

/** Dossier de la rubrique Actualités, hors du périmètre du build (voir en-tête). */
const DOSSIER_ACTUALITES = 'actualites-data';
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

/**
 * Vérifie que chaque entrée de la rubrique Actualités est bien une enveloppe
 * chiffrée. Seule « cle-publique.json » est publiée en clair, par définition.
 */
async function verifierActualitesChiffrees(dossier) {
  if (!existsSync(dossier)) return null;
  let verifiees = 0;
  /** Les noms de fichiers publiés, par sous-dossier : c'est l'inventaire. */
  const inventaire = {};
  for (const sousDossier of await readdir(dossier, { withFileTypes: true })) {
    if (!sousDossier.isDirectory()) continue;
    const chemin = path.join(dossier, sousDossier.name);
    inventaire[sousDossier.name] = [];
    for (const fichier of await readdir(chemin)) {
      const brut = await readFile(path.join(chemin, fichier), 'utf8');
      let contenu;
      try {
        contenu = JSON.parse(brut);
      } catch {
        echouer(`« ${DOSSIER_ACTUALITES}/${sousDossier.name}/${fichier} » n'est pas un JSON valide.`);
      }
      if (!contenu?.ct || !contenu?.cle || !contenu?.iv) {
        echouer(
          `« ${DOSSIER_ACTUALITES}/${sousDossier.name}/${fichier} » n'est pas chiffré : publication annulée.\n` +
            '  Chiffrez-le avec « node scripts/chiffrer-actualite.mjs ».',
        );
      }
      inventaire[sousDossier.name].push(fichier.replace(/\.json$/, ''));
      verifiees++;
    }
  }
  console.log(
    verifiees
      ? `› ${DOSSIER_ACTUALITES}/ : ${verifiees} actualité(s) publiée(s), toutes chiffrées.`
      : `› ${DOSSIER_ACTUALITES}/ : aucune actualité à publier pour l'instant.`,
  );
  return inventaire;
}

/**
 * Écrit l'inventaire chiffré des entrées publiées.
 *
 * **Pourquoi.** GitHub Pages ne permet pas de lister un dossier, et les noms de
 * fichiers sont des empreintes : le navigateur n'a donc aucun moyen de savoir ce
 * qui existe. Il sondait jusqu'ici les identifiants de semaine en remontant le
 * temps, ce qui coûtait plusieurs dizaines de requêtes dont l'immense majorité
 * répondaient 404 — et saturait la console d'erreurs, au point de masquer les
 * vraies. L'inventaire supprime le sondage : une requête, puis exactement les
 * fichiers qui existent.
 *
 * **Pourquoi chiffré.** Une liste d'empreintes en clair serait inversible :
 * l'espace des identifiants de période est minuscule (quelques centaines de
 * semaines plausibles), si bien que n'importe qui pourrait précalculer les
 * empreintes et lire dans l'inventaire les dates couvertes. Ce serait une
 * métadonnée sur les périodes de révision, aujourd'hui non énumérable faute de
 * listage. L'inventaire est donc une enveloppe comme les autres : seul le
 * détenteur de la clé privée le lit.
 */
async function ecrireInventaire(dossier, inventaire) {
  if (!inventaire) return;
  const cheminCle = path.join(dossier, 'cle-publique.json');
  if (!existsSync(cheminCle)) {
    console.log(`› ${DOSSIER_ACTUALITES}/ : clé publique absente, inventaire non écrit.`);
    return;
  }
  const { jwk } = JSON.parse(await readFile(cheminCle, 'utf8'));
  const clePublique = await importerPubliqueActualites(jwk);
  const nom = await idStable('inventaire');
  await writeFile(
    path.join(dossier, `${nom}.json`),
    JSON.stringify(await chiffrerPourActualites(clePublique, inventaire)),
  );
  const total = Object.values(inventaire).reduce((n, noms) => n + noms.length, 0);
  console.log(
    `› ${DOSSIER_ACTUALITES}/ : inventaire chiffré de ${total} entrée(s) — ` +
      'le navigateur ne sondera plus les périodes absentes.',
  );
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
