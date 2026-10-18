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
import { readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/*
   Ce script ne sait plus dire « c'est déjà le mot de passe actuel », et c'est
   la contrepartie assumée du retrait de l'empreinte : il n'existe plus nulle
   part de quoi reconnaître le mot de passe sans l'essayer.

   Le dire vaut mieux que le simuler. Relancer sur le même mot de passe ne
   casse rien — la date est réécrite, le témoin local est refait à
   l'identique — mais la date de changement sera fausse, et c'est elle qui
   permet de savoir quelle sauvegarde s'ouvre avec quoi.
*/
console.log(
  `\n  Rappel : ce script ne peut plus vérifier que le mot de passe est\n` +
    `  nouveau — l'empreinte a quitté le dépôt. Si c'est le même qu'avant,\n` +
    `  interrompez maintenant : la date de changement deviendrait fausse.\n`,
);

/**
 * Un refus, et non plus un avertissement.
 *
 * Ce script avertissait sous huit signes et poursuivait. L'argument écrit
 * ici était bon : « un script qui refuse d'obéir pour son bien finit par être
 * contourné d'une façon pire ». Ce qui a changé n'est pas l'argument, c'est
 * le fait sur lequel il reposait.
 *
 * `site.config.mjs` porte une empreinte **SHA-256 sans sel**, et ce fichier
 * part dans le paquet construit, donc dans la branche publiée. Une empreinte
 * sans sel se teste par dizaines de milliards par seconde sur une carte
 * graphique ordinaire : sous quinze signes, le mot de passe se retrouve en
 * un temps qui ne se compte pas en heures mais en secondes, et les 310 000
 * itérations du coffre n'y changent rien puisqu'on ne passe plus par elles.
 *
 * Un avertissement laisse croire qu'on arbitre entre commodité et sécurité.
 * Ici il n'y a pas d'arbitrage : sous quinze signes, la protection n'existe
 * pas. Le refus dit la vérité, l'avertissement la maquillait.
 *
 * Il tombera quand l'empreinte quittera le paquet livré — c'est le point 1 du
 * prompt 44, et il reste dû.
 */
const LONGUEUR_MINIMALE = 15;

if (motDePasse.length < LONGUEUR_MINIMALE) {
  console.log(
    `\n${rouge('✗')} Ce mot de passe fait ${motDePasse.length} signes, ` +
      `il en faut au moins ${LONGUEUR_MINIMALE}.\n\n` +
      '  Son empreinte SHA-256 part SANS SEL dans le paquet publié. Qui tient\n' +
      '  la branche publiée peut la tester par milliards par seconde : sous\n' +
      '  quinze signes, le mot de passe se retrouve en quelques secondes, et\n' +
      '  tout le contenu du dépôt avec lui.\n\n' +
      '  Une phrase de quatre ou cinq mots fait l’affaire, et se retient mieux\n' +
      '  qu’une suite de signes.\n',
  );
  process.exit(1);
}

const source = await readFile(CHEMIN_CONFIG, 'utf8');
const aujourdhui = new Date().toISOString().slice(0, 10);

/*
   Plus d'empreinte à écrire : elle a quitté `site.config.mjs` le 17 octobre
   2026 (prompt 44, point 1), parce que ce fichier part dans le paquet publié
   et qu'une empreinte SHA-256 sans sel publiée rend le mot de passe trouvable
   en quelques secondes.

   Ce script ne recopie donc plus rien d'un secret. Il date le changement, et
   il efface le **témoin local** de construction pour que le prochain build le
   recrée sur le nouveau mot de passe — sans quoi le build refuserait de
   passer, en croyant à une faute de frappe.
*/
const TEMOIN_LOCAL = '.temoin-mot-de-passe.local.json';
await rm(TEMOIN_LOCAL, { force: true });

let sortie = source;

const motifDate = /(motDePasseChangeLe:\s*')(\d{4}-\d{2}-\d{2})(')/;
if (motifDate.test(sortie)) {
  sortie = sortie.replace(motifDate, `$1${aujourdhui}$3`);
} else {
  arret('« motDePasseChangeLe » est introuvable dans site.config.mjs — rien n’a été écrit.');
}

await writeFile(CHEMIN_CONFIG, sortie, 'utf8');

console.log(`
${vert('✓')} Changement daté du ${aujourdhui} dans site.config.mjs, et témoin local
  de construction effacé : le prochain build le recréera sur ce mot de passe.

${gras('Il reste trois choses, et la troisième n’est pas automatisable.')}

  1. ${gras('npm run deploy')}
     Rechiffre le contenu avec le nouveau mot de passe et publie. Le témoin
     local venant d’être effacé, ce build le recrée sans rien demander ; les
     suivants refuseront un mot de passe différent de celui-ci.

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
