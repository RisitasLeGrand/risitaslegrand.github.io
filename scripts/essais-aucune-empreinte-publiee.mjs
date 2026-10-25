/**
 * Aucune empreinte du mot de passe ne doit figurer dans ce qui est publié.
 *
 * ## Le défaut que cet essai interdit de refaire
 *
 * `site.config.mjs` portait `motDePasseHash`, une empreinte SHA-256 **sans
 * sel** du mot de passe du site, et ce fichier part dans le paquet construit,
 * donc dans la branche publiée. Une empreinte sans sel se teste par dizaines
 * de milliards par seconde sur une carte graphique ordinaire : le mot de
 * passe se retrouvait en quelques secondes, et tout le contenu avec lui.
 *
 * Elle a été retirée (prompt 44, point 1). Cet essai existe pour que la
 * commodité qui l'avait fait naître — un message d'erreur plus précis — ne la
 * ramène pas dans six mois.
 *
 * ## Ce qu'il cherche, et pourquoi pas une chaîne fixe
 *
 * Il ne cherche pas « motDePasseHash » : renommer la constante suffirait à le
 * tromper, et c'est exactement ce qu'un contrôle textuel ne doit jamais
 * permettre. Il **calcule** les empreintes du vrai mot de passe — SHA-256,
 * SHA-1, SHA-512, en hexadécimal et en base64, et leurs variantes de casse —
 * puis les cherche dans chaque octet de `dist/`.
 *
 * Une sonde textuelle prouve qu'un garde-fou est cité ; celle-ci prouve que
 * le secret n'est pas là.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();

let echecs = 0;
const verifier = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

/** Toutes les formes sous lesquelles l'empreinte pourrait se cacher. */
const empreintes = () => {
  const formes = new Map();
  for (const algo of ['sha256', 'sha1', 'sha512', 'md5']) {
    const hexa = createHash(algo).update(MDP, 'utf8').digest('hex');
    formes.set(`${algo} hexadécimal`, hexa);
    formes.set(`${algo} hexadécimal majuscule`, hexa.toUpperCase());
    formes.set(`${algo} base64`, createHash(algo).update(MDP, 'utf8').digest('base64'));
  }
  /*
     Et le mot de passe lui-même, en clair et en base64. Il n'a rien à faire
     dans « dist/ » non plus, et l'incident du 11 octobre — le mot de passe en
     clair dans huit fichiers suivis — dit assez que cela arrive.
  */
  formes.set('le mot de passe en clair', MDP);
  formes.set('le mot de passe en base64', Buffer.from(MDP, 'utf8').toString('base64'));
  return formes;
};

/** Tous les fichiers de `dist/`, sans exception. */
const fichiers = (racine) => {
  const sortie = [];
  const parcourir = (dossier) => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else sortie.push(chemin);
    }
  };
  parcourir(racine);
  return sortie;
};

console.log('\nRIEN DANS « dist/ » NE TRAHIT LE MOT DE PASSE');

const tous = fichiers('dist');
console.log(`      ${tous.length} fichiers inspectés`);
verifier('le paquet n’est pas vide (sinon l’essai ne prouverait rien)', tous.length > 50, true);

const trouves = [];
for (const [nom, aiguille] of empreintes()) {
  const octets = Buffer.from(aiguille, 'utf8');
  for (const fichier of tous) {
    if (readFileSync(fichier).includes(octets)) {
      trouves.push(`${nom} dans ${fichier}`);
    }
  }
}
verifier('aucune empreinte ni le mot de passe lui-même', trouves, []);

console.log('\nET LE CODE SOURCE NE PORTE PLUS LA CONSTANTE');

/*
   Ce second contrôle est **faible**, et il faut le dire : renommer la
   constante le contournerait. Il ne remplace pas celui du dessus, il sert à
   donner un message clair au développeur qui la réintroduirait par copie
   d'un ancien fichier.
*/
const sources = [...fichiers('src'), 'site.config.mjs'];
const citations = sources.filter((f) => readFileSync(f, 'utf8').match(/motDePasseHash\s*:/));
verifier('« motDePasseHash: » n’est déclaré nulle part', citations, []);

console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
