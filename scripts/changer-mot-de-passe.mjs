#!/usr/bin/env node
/**
 * Changer le mot de passe du site, d'une seule commande.
 *
 * La décision 5 mesure le coût réel d'un changement : « npm run hash », une
 * ligne dans `site.config.mjs`, un build, un déploiement, et la ressaisie du
 * mot de passe sur chaque appareil. Les deux premières étapes sont mécaniques
 * et c'est exactement pourquoi elles méritent d'être automatisées : recopier
 * une empreinte de soixante-quatre signes à la main, c'est une chance sur
 * combien de se tromper d'un caractère et de se retrouver devant un site qu'on
 * n'ouvre plus ?
 *
 * ## Le mot de passe n'est pas un argument
 *
 * Il se lit dans `.env.local`, et nulle part ailleurs. Le passer en argument
 * l'écrirait dans l'historique du shell, c'est-à-dire dans un fichier que rien
 * n'efface — et la contrainte du projet est que le mot de passe ne vive que
 * dans `.env.local`, ignoré par Git. Le parcours est donc :
 *
 *     printf 'SITE_PASSWORD=nouveau\n' > .env.local
 *     npm run mot-de-passe
 *     npm run deploy
 *     rm -f .env.local
 *
 * ## Ce que ce script ne fait pas, et ne peut pas faire
 *
 * Il ne rend pas illisible ce qui est déjà sorti. Les paquets de
 * synchronisation déjà transmis et les sauvegardes `.cyclades` déjà faites
 * portent chacun leur propre sel et s'ouvrent avec le mot de passe de leur
 * date. Un changement protège l'avenir, pas le passé : c'est écrit ici, c'est
 * écrit sur l'écran des appareils, et aucun des deux ne doit laisser croire
 * qu'un retrait d'appareil est une révocation.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from './lib/crypto.mjs';
import config from '../site.config.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN_CONFIG = path.join(racine, 'site.config.mjs');

const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

function arret(message) {
  console.error(`\n${rouge('Arrêt.')} ${message}\n`);
  process.exit(1);
}

if (process.argv.length > 2) {
  arret(
    'Ce script ne prend pas le mot de passe en argument : il l’écrirait dans\n' +
      '  l’historique du shell. Pose-le dans « .env.local », puis relance sans argument.',
  );
}

const cheminEnv = path.join(racine, '.env.local');
if (!existsSync(cheminEnv)) {
  arret(
    '« .env.local » est absent. C’est le seul endroit où le mot de passe vit :\n\n' +
      '    printf \'SITE_PASSWORD=nouveau\\n\' > .env.local\n',
  );
}

const ligne = (await readFile(cheminEnv, 'utf8'))
  .split(/\r?\n/)
  .find((l) => /^\s*SITE_PASSWORD\s*=/.test(l));
const motDePasse = (ligne ?? '')
  .replace(/^\s*SITE_PASSWORD\s*=/, '')
  .trim()
  .replace(/^["']|["']$/g, '');

if (!motDePasse) arret('« .env.local » ne contient pas de SITE_PASSWORD utilisable.');

const empreinte = await sha256Hex(motDePasse);
const actuelle = config.motDePasseHash.toLowerCase();

if (empreinte === actuelle) {
  console.log(
    `\n${vert('✓')} Le mot de passe de « .env.local » est déjà celui du site : ` +
      'rien à changer.\n',
  );
  process.exit(0);
}

/*
   Un avertissement, pas un refus : la longueur d'un mot de passe est une
   décision de la personne, et un script qui refuse d'obéir pour son bien finit
   par être contourné d'une façon pire.
*/
if (motDePasse.length < 8) {
  console.log(
    `\n${rouge('!')} Ce mot de passe fait ${motDePasse.length} signes. ` +
      'Il protège tout le contenu du dépôt public.',
  );
}

const source = await readFile(CHEMIN_CONFIG, 'utf8');
const aujourdhui = new Date().toISOString().slice(0, 10);

const motifHash = /(motDePasseHash:\s*')([0-9a-f]{64})(')/;
if (!motifHash.test(source)) {
  arret('« motDePasseHash » est introuvable dans site.config.mjs — rien n’a été écrit.');
}
let sortie = source.replace(motifHash, `$1${empreinte}$3`);

const motifDate = /(motDePasseChangeLe:\s*')(\d{4}-\d{2}-\d{2})(')/;
if (motifDate.test(sortie)) {
  sortie = sortie.replace(motifDate, `$1${aujourdhui}$3`);
} else {
  arret('« motDePasseChangeLe » est introuvable dans site.config.mjs — rien n’a été écrit.');
}

await writeFile(CHEMIN_CONFIG, sortie, 'utf8');

console.log(`
${vert('✓')} site.config.mjs mis à jour : nouvelle empreinte, changement daté du ${aujourdhui}.

${gras('Il reste trois choses, et la troisième n’est pas automatisable.')}

  1. ${gras('npm run deploy')}
     Rechiffre le contenu avec le nouveau mot de passe et publie. Le build
     refuse de passer si « .env.local » et site.config.mjs ne s’accordent pas,
     donc une erreur de recopie ne peut pas atteindre le site.

  2. ${gras('rm -f .env.local')}
     Le mot de passe ne doit pas rester sur le disque après le build.

  3. ${gras('Ressaisir le mot de passe sur chaque appareil.')}
     Aucun appareil ne peut l’apprendre tout seul : c’est la preuve de
     connaissance du mot de passe qui fait l’appairage, pas un jeton.

${gras('Ce que ce changement ne fait pas.')}
Il ne rend pas illisibles les paquets de synchronisation déjà transmis ni les
sauvegardes « .cyclades » déjà faites : chacun porte son propre sel et s’ouvre
avec le mot de passe de sa date. Un appareil retiré qui aurait gardé un ancien
paquet pourra toujours l’ouvrir. Le changement protège l’avenir, pas le passé —
${gras('retirer un appareil n’est donc pas une révocation')}.
`);
