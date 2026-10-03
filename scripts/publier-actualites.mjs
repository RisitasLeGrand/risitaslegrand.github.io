#!/usr/bin/env node
/**
 * Publie la rubrique Actualités sur GitHub Pages, sans reconstruire le site.
 *
 *   npm run actualites:publier                      # publie
 *   npm run actualites:publier -- --essai           # montre le diff, sans pousser
 *   npm run actualites:publier -- --branche <nom>   # répète sur une autre branche
 *
 * **Pourquoi ce script existe.** Jusqu'ici, mettre une actualité en ligne
 * passait par « npm run deploy », donc par un build complet — donc par le mot de
 * passe du site, qui ne quitte jamais la machine du propriétaire. Les routines de
 * veille ne pouvaient donc pas publier : elles ouvraient une pull request, et
 * tout le reste restait manuel.
 *
 * Or publier une actualité ne demande pas de reconstruire quoi que ce soit. Les
 * entrées de « actualites-data/ » sont chiffrées avec la **clé publique** de la
 * rubrique, et « deploy.mjs » les recopie telles quelles à côté du build sans
 * jamais les relire. Seul l'inventaire doit être régénéré, et il se chiffre avec
 * cette même clé publique. Tout cela se fait donc sans aucun secret : ce script
 * n'a jamais besoin du mot de passe, et ne saurait pas lire ce qu'il publie.
 *
 * **Ce qu'il fait.** Il clone la branche de publication, y remplace le seul
 * dossier « actualites-data/ » par celui du dépôt, régénère l'inventaire
 * chiffré, et pousse. Le reste de la branche — le site construit — n'est pas
 * touché : une actualité paraît sans republier les fiches.
 *
 * **Ce qu'il ne fait pas.** Il ne publie aucune modification du site lui-même.
 * Un changement dans « src/ », « content/ » ou « scripts/ » exige toujours
 * « npm run deploy » depuis la machine du propriétaire. Le script le dit quand
 * il détecte ce cas plutôt que de le passer sous silence.
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
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
  nomFichierInventaire,
  verifierActualitesChiffrees,
} from './lib/actualites-publication.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Branche visée. « --branche » sert à répéter une publication complète sur une
 * copie de la branche de publication avant de lui faire confiance : la poussée
 * est alors éprouvée pour de vrai, sans toucher au site en ligne. Sans l'option,
 * c'est la branche de publication du site.
 */
const branche = (() => {
  const i = process.argv.indexOf('--branche');
  if (i === -1) return config.brancheDeploiement;
  const nom = process.argv[i + 1];
  if (!nom || nom.startsWith('--')) {
    console.error('\n\x1b[31m✖ « --branche » attend un nom de branche.\x1b[0m\n');
    process.exit(1);
  }
  return nom;
})();
const actualitesDepot = path.join(racine, DOSSIER_ACTUALITES);
const essai = process.argv.includes('--essai');

/** Nombre de tentatives en cas de poussée refusée (la branche a bougé entre-temps). */
const TENTATIVES = 3;

function echouer(message) {
  console.error(`\n\x1b[31m✖ ${message}\x1b[0m\n`);
  process.exit(1);
}

function git(dossier, ...args) {
  return execFileSync('git', ['-C', dossier, ...args], { encoding: 'utf8' }).trim();
}

/**
 * Comme « git », mais sans laisser fuir la sortie d'erreur : pour les commandes
 * dont l'échec est un cas prévu, et dont le message de git n'apprendrait rien.
 */
function gitDiscret(dossier, ...args) {
  return execFileSync('git', ['-C', dossier, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Identité de commit : celle du dépôt si elle existe, sinon une valeur neutre.
 * Le script tourne aussi bien sur la machine du propriétaire que dans la
 * session d'une routine de veille, où aucune configuration globale n'est
 * garantie.
 */
function identite() {
  const lire = (cle, defaut) => {
    try {
      return git(racine, 'config', cle) || defaut;
    } catch {
      return defaut;
    }
  };
  return {
    nom: lire('user.name', 'Publication'),
    courriel: lire('user.email', 'publication@localhost'),
  };
}

// --- Vérifications préalables --------------------------------------------
if (!existsSync(actualitesDepot)) {
  echouer(
    `« ${DOSSIER_ACTUALITES}/ » est absent du dépôt : il n'y a aucune actualité à publier.`,
  );
}

let depot;
try {
  depot = git(racine, 'remote', 'get-url', 'origin');
} catch {
  echouer('Aucun dépôt distant « origin » n\'est configuré.');
}

// La branche de publication doit déjà exister : ce script la met à jour, il ne
// la crée pas. La créer serait publier un site sans build, donc une coquille.
try {
  const distantes = git(racine, 'ls-remote', '--heads', 'origin', branche);
  if (!distantes) {
    echouer(
      `La branche « ${branche} » n'existe pas encore sur « origin ».\n` +
        '  Publiez d\'abord le site complet :  npm run deploy',
    );
  }
} catch (erreur) {
  echouer(`Impossible d'interroger « origin » :\n  ${erreur.message ?? erreur}`);
}

// --- Retard sur le dépôt distant -----------------------------------------
// La publication remplace le dossier en ligne par celui d'ici. Depuis un clone
// en retard, elle effacerait donc du site les actualités fusionnées entre-temps
// — le cas normal dès que deux routines de veille se suivent de près.
const brancheLocale = brancheCourante(racine);

// Aucune option ne permet de passer outre : si le clone est en retard, « git pull »
// est toujours la bonne réponse. Et comme publier exige le réseau, un dépôt
// distant joignable pour la poussée l'était aussi pour la vérification.
if (brancheLocale) {
  const enRetard = commitsDeRetard(racine, brancheLocale);
  if (enRetard === null) {
    console.log(
      `› Dépôt distant injoignable : impossible de vérifier si « ${brancheLocale} » est à jour.`,
    );
  } else if (enRetard) {
    echouer(
      `Le clone local est en retard de ${enRetard} commit(s) sur « origin/${brancheLocale} ».\n` +
        '  Publier depuis ici effacerait du site les actualités fusionnées entre-temps.\n' +
        `  Mettez à jour :  git pull origin ${brancheLocale}`,
    );
  }
}

/** Une tentative complète : clone, remplacement, inventaire, poussée. */
async function tenter(numero) {
  const temporaire = await mkdtemp(path.join(tmpdir(), 'actualites-'));
  try {
    execFileSync(
      'git',
      ['clone', '--quiet', '--depth', '1', '--branch', branche, depot, temporaire],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    // Garde-fou : on refuse d'écrire sur une branche qui ne ressemble pas au
    // site publié. Mieux vaut ne rien faire que corrompre la publication.
    if (!existsSync(path.join(temporaire, 'index.html'))) {
      echouer(
        `La branche « ${branche} » ne contient pas « index.html » : ce n'est pas le site publié.\n` +
          '  Publication annulée par sécurité.',
      );
    }

    // Le dossier est remplacé, pas fusionné : une entrée retirée du dépôt
    // disparaît donc aussi du site, et aucune empreinte orpheline ne subsiste.
    const cible = path.join(temporaire, DOSSIER_ACTUALITES);
    await rm(cible, { recursive: true, force: true });
    await cp(actualitesDepot, cible, { recursive: true });

    // La vérification passe avant toute décision : c'est le garde-fou qui
    // interdit qu'une entrée en clair parte en ligne, et il ne se saute pas.
    const inventaire = await verifierActualitesChiffrees(cible);

    // L'inventaire publié ne vient pas du dépôt : la copie ci-dessus l'a donc
    // effacé. On le remet en place avant de comparer, car son chiffrement est
    // aléatoire : le régénérer à chaque fois produirait un commit à chaque
    // exécution, même sans aucune actualité nouvelle. Il n'est réécrit que si la
    // liste des entrées a réellement changé — et il est fonction de cette liste.
    const inventaireRelatif = path.join(DOSSIER_ACTUALITES, await nomFichierInventaire());
    try {
      gitDiscret(temporaire, 'checkout', '--', inventaireRelatif);
    } catch {
      /* aucun inventaire en ligne : il manque, et le bloc suivant le recréera */
    }

    // Un inventaire absent de la publication est à lui seul une raison de
    // publier : sans lui le navigateur ne sait plus quelles entrées existent, et
    // la rubrique paraît vide. Sans cette condition, le script conclurait « rien
    // à publier » et ne le recréerait jamais.
    const inventaireAbsent = !existsSync(path.join(temporaire, inventaireRelatif));
    const modifie = git(temporaire, 'status', '--porcelain');
    if (!modifie && !inventaireAbsent) {
      console.log('✓ Rien à publier : la rubrique Actualités en ligne est déjà à jour.');
      return 'inchange';
    }
    if (inventaireAbsent) {
      console.log('› Inventaire absent de la publication : il va être recréé.');
    }

    await ecrireInventaire(cible, inventaire);
    git(temporaire, 'add', '-A', '-f', DOSSIER_ACTUALITES);

    const resume = git(temporaire, 'diff', '--cached', '--stat').split('\n').slice(-1)[0];
    console.log(`› Modifications à publier : ${resume}`);

    if (essai) {
      console.log('✓ Essai : rien n\'a été poussé.');
      return 'essai';
    }

    const { nom, courriel } = identite();
    git(temporaire, 'config', 'user.name', nom);
    git(temporaire, 'config', 'user.email', courriel);
    git(
      temporaire,
      'commit',
      '-q',
      '-m',
      `Actualités ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    );

    try {
      git(temporaire, 'push', 'origin', `HEAD:${branche}`);
    } catch (erreur) {
      if (numero < TENTATIVES) {
        console.log(
          `› Poussée refusée (la branche « ${branche} » a bougé). Nouvelle tentative…`,
        );
        return 'reessayer';
      }
      throw erreur;
    }

    console.log(`✓ Publié sur « ${branche} ». Le site sera à jour dans une minute environ.`);
    return 'publie';
  } finally {
    await rm(temporaire, { recursive: true, force: true });
  }
}

// --- Publication ----------------------------------------------------------
try {
  for (let numero = 1; numero <= TENTATIVES; numero++) {
    if ((await tenter(numero)) !== 'reessayer') break;
  }
} catch (erreur) {
  echouer(`Échec de la publication :\n  ${erreur.message ?? erreur}`);
}
