/**
 * UNE SEULE RÈGLE POUR LIRE LE MOT DE PASSE, ET AUCUNE SIXIÈME COPIE.
 *
 *   npm run essais:mot-de-passe-une-source
 *
 * ## Ce qu'on a trouvé
 *
 * Le mot de passe du site avait **cinq** lecteurs, chacun avec sa règle :
 *
 *   1. `lib/motdepasse.mjs`, pour les outils d'actualités ;
 *   2. `lib/mot-de-passe-essais.mjs`, que cent quarante-sept essais emploient ;
 *   3. `build-content.mjs`, en ligne — celui qui CHIFFRE le corpus ;
 *   4. `essais-secret.mjs`, une copie en ligne du deuxième ;
 *   5. `changer-mot-de-passe.mjs`, en ligne — celui qui RECHIFFRE le corpus.
 *
 * Les règles divergeaient sur trois points : la coupure des lignes (`\n` seul
 * ou `\r?\n`), les blancs autour de la valeur, et les guillemets — appariés
 * pour les uns, un seul côté suffisant pour les autres.
 *
 * Les deux conséquences, et aucune des deux n'est théorique :
 *
 * - un `.env.local` écrit avec un retour de chariot, ou avec un espace final,
 *   donnait au build une valeur et aux essais une autre. Le site se chiffre
 *   avec l'une, cent quarante-sept essais de navigateur déverrouillent avec
 *   l'autre, et ils restent sur l'écran de déverrouillage sans qu'aucun
 *   message ne dise pourquoi ;
 * - un mot de passe commençant ou finissant par une apostrophe était lu
 *   AMPUTÉ par `changer-mot-de-passe.mjs`, qui rechiffre tout le corpus avec
 *   ce qu'il a lu. Le site ne se serait plus ouvert, avec aucun mot de passe,
 *   et rien ne l'aurait dit.
 *
 * ## Ce que cet essai garde
 *
 * La règle, par des contrôles sur la fonction pure `motDePasseDuTexte` — elle
 * ne lit aucun fichier, donc elle s'éprouve sans disque et sans secret.
 *
 * Et l'unicité, par un balayage de source : aucun fichier hors du module
 * partagé ne doit porter l'analyse d'une ligne `SITE_PASSWORD=`. C'est la
 * seule forme de garde qui attrape la SIXIÈME copie, celle qu'on écrira un
 * jour sans y penser — une relecture ne l'attrapera pas, parce qu'une copie
 * de quatre lignes a l'air juste.
 *
 * Aucun mot de passe réel n'est employé ici : tous les textes sont inventés.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  deguillemeter,
  motDePasseDeLEnvironnement,
  motDePasseDuTexte,
} from './lib/motdepasse.mjs';

const racine = path.resolve(import.meta.dirname, '..');
const vert = (t) => `\u001b[32m${t}\u001b[0m`;
const rouge = (t) => `\u001b[31m${t}\u001b[0m`;

let echecs = 0;
function verifier(quoi, obtenu, attendu) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    echecs += 1;
    console.log(
      `  ${rouge('✗')} ${quoi} — attendu ${JSON.stringify(attendu)}, ` +
        `obtenu ${JSON.stringify(obtenu)}`,
    );
  }
}

console.log('\nLA RÈGLE DE LECTURE');

verifier('une ligne simple', motDePasseDuTexte('SITE_PASSWORD=secret\n'), 'secret');
verifier(
  'un retour de chariot ne reste pas collé à la valeur',
  motDePasseDuTexte('SITE_PASSWORD=secret\r\n'),
  'secret',
);
verifier('un espace final est coupé', motDePasseDuTexte('SITE_PASSWORD=secret  \n'), 'secret');
verifier('un espace avant la valeur est coupé', motDePasseDuTexte('SITE_PASSWORD= secret\n'), 'secret');
verifier(
  'des guillemets APPARIÉS sont retirés',
  motDePasseDuTexte('SITE_PASSWORD="secret"\n'),
  'secret',
);
verifier(
  'des apostrophes APPARIÉES sont retirées',
  motDePasseDuTexte("SITE_PASSWORD='secret'\n"),
  'secret',
);
/*
   LE CONTRÔLE QUI COMPTE LE PLUS. Un guillemet d'un seul côté est sans doute
   un vrai caractère du mot de passe, et le retirer en silence fabrique un
   mot de passe faux — c'est le défaut qui aurait pu rendre le corpus
   illisible, puisque « changer-mot-de-passe » rechiffre avec ce qu'il a lu.
*/
verifier(
  'un guillemet d’un seul côté reste dans la valeur',
  motDePasseDuTexte('SITE_PASSWORD="secret\n'),
  '"secret',
);
verifier(
  'une apostrophe finale seule reste dans la valeur',
  motDePasseDuTexte("SITE_PASSWORD=secret'\n"),
  "secret'",
);
verifier(
  'une apostrophe interne est intacte',
  motDePasseDuTexte("SITE_PASSWORD=l'été\n"),
  "l'été",
);
verifier('une valeur vide ne vaut pas un mot de passe', motDePasseDuTexte('SITE_PASSWORD=\n'), null);
verifier(
  'une valeur de blancs ne vaut pas un mot de passe',
  motDePasseDuTexte('SITE_PASSWORD=   \n'),
  null,
);
verifier('aucune ligne : rien', motDePasseDuTexte('AUTRE_CHOSE=1\n'), null);
verifier(
  'la ligne peut ne pas être la première',
  motDePasseDuTexte('# un commentaire\nAUTRE=1\nSITE_PASSWORD=secret\n'),
  'secret',
);
verifier(
  'un nom qui CONTIENT SITE_PASSWORD ne compte pas pour lui',
  motDePasseDuTexte('MON_SITE_PASSWORD=secret\n'),
  null,
);
verifier(
  'la première ligne gagne, et non la dernière',
  motDePasseDuTexte('SITE_PASSWORD=premier\nSITE_PASSWORD=second\n'),
  'premier',
);
verifier('un fichier vide : rien', motDePasseDuTexte(''), null);
verifier('deux guillemets nus ne valent pas une valeur vide', motDePasseDuTexte('SITE_PASSWORD=""\n'), null);
verifier('un guillemet seul reste lui-même', motDePasseDuTexte('SITE_PASSWORD="\n'), '"');

console.log('\nLA MÊME RÈGLE POUR L’ENVIRONNEMENT');
const avant = process.env.SITE_PASSWORD;
try {
  process.env.SITE_PASSWORD = ' secret ';
  verifier('les blancs sont coupés', motDePasseDeLEnvironnement(), 'secret');
  process.env.SITE_PASSWORD = '"secret"';
  verifier('les guillemets appariés sont retirés', motDePasseDeLEnvironnement(), 'secret');
  process.env.SITE_PASSWORD = '"secret';
  verifier('un guillemet d’un seul côté reste', motDePasseDeLEnvironnement(), '"secret');
  process.env.SITE_PASSWORD = '   ';
  verifier('des blancs seuls ne valent rien', motDePasseDeLEnvironnement(), null);
  delete process.env.SITE_PASSWORD;
  verifier('absente : rien', motDePasseDeLEnvironnement(), null);
} finally {
  if (avant === undefined) delete process.env.SITE_PASSWORD;
  else process.env.SITE_PASSWORD = avant;
}
verifier('l’environnement est rendu tel qu’on l’a trouvé', process.env.SITE_PASSWORD, avant);

console.log('\nAUCUNE SIXIÈME COPIE DE LA RÈGLE');

/*
   Le seul fichier autorisé à porter l'analyse. Tout autre qui la porte est
   une copie, et une copie finit par diverger — c'est ce qui vient d'arriver
   cinq fois.
*/
const PORTEUR_LEGITIME = path.join('scripts', 'lib', 'motdepasse.mjs');

/*
   ET CET ESSAI-CI, qui porte le motif dans sa chaîne témoin de sabotage. Il
   s'exclut donc, comme « essais:secret » s'exclut de sa propre recherche du
   mot de passe. L'exclusion est nommée et étroite : un seul fichier, le
   nôtre, et non un filtre sur les essais en général — sinon la sixième copie
   n'aurait qu'à s'appeler « essais-quelque-chose » pour passer.
*/
const SOI = path.join('scripts', 'essais-mot-de-passe-une-source.mjs');

/*
   Ce qu'on cherche : une ANALYSE, et non une écriture. Les essais de
   laboratoire écrivent `SITE_PASSWORD=${MOT_DE_PASSE}` dans un `.env.local`
   factice, et c'est juste : ils POSENT une valeur, ils ne la lisent pas.
   Le signe de l'analyse est le motif d'expression régulière.
*/
const ANALYSE = /SITE_PASSWORD\\s\*=/;

function fichiersDe(dossier, suffixes) {
  const trouves = [];
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree.startsWith('.')) continue;
    const chemin = path.join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersDe(chemin, suffixes));
    else if (suffixes.some((s) => entree.endsWith(s))) trouves.push(chemin);
  }
  return trouves;
}

const sources = [
  ...fichiersDe(path.join(racine, 'scripts'), ['.mjs', '.mts', '.js', '.ts']),
  ...fichiersDe(path.join(racine, 'src'), ['.mjs', '.mts', '.js', '.ts', '.astro', '.svelte']),
];

const copies = sources
  .map((chemin) => path.relative(racine, chemin))
  .filter((relatif) => relatif !== PORTEUR_LEGITIME && relatif !== SOI)
  .filter((relatif) => ANALYSE.test(readFileSync(path.join(racine, relatif), 'utf8')));

verifier(
  `aucune copie de la règle dans ${sources.length} fichiers de source`,
  copies.sort(),
  [],
);
if (copies.length > 0) {
  for (const c of copies) {
    console.log(
      `        ${c} — importez « motDePasseDuTexte » de lib/motdepasse.mjs ` +
        'plutôt que de réécrire la règle.',
    );
  }
}

/*
   SABOTAGES PERMANENTS. Un balayage qui ne trouve rien ne prouve rien : ces
   deux-ci disent que le motif attrape bien ce qu'il doit attraper, et laisse
   passer ce qu'il doit laisser passer.
*/
verifier(
  'sabotage : une copie de la règle serait vue',
  /*
     La chaîne témoin porte le motif TEL QU'IL S'ÉCRIT dans un fichier de
     source, et `String.raw` est la seule façon de l'écrire sans compter les
     antislashs à la main. La première version en portait un de trop, et ce
     contrôle-ci l'a dit — sans lui, le « aucune copie dans huit cent trente-
     cinq fichiers » ci-dessus ne prouvait rien du tout.
  */
  ANALYSE.test(String.raw`const l = t.split('\n').find((l) => /^\s*SITE_PASSWORD\s*=/.test(l));`),
  true,
);
verifier(
  'sabotage : une ÉCRITURE de .env.local n’est pas vue',
  ANALYSE.test('writeFileSync(chemin, `SITE_PASSWORD=${MOT_DE_PASSE}\\n`);'),
  false,
);
verifier(
  'sabotage : une lecture d’environnement n’est pas vue',
  ANALYSE.test('const mdp = process.env.SITE_PASSWORD;'),
  false,
);

console.log('\nLES GUILLEMETS, À PART');
verifier('déguillemeter coupe les blancs', deguillemeter('  secret  '), 'secret');
verifier('déguillemeter ne mange pas un guillemet seul', deguillemeter('"'), '"');
verifier('déguillemeter rend une chaîne vide telle quelle', deguillemeter(''), '');

console.log(
  echecs === 0
    ? `\n${vert('✓')} une seule règle, et aucune copie.\n`
    : `\n${rouge('✗')} ${echecs} ${echecs === 1 ? 'contrôle' : 'contrôles'} en échec.\n`,
);
process.exit(echecs > 0 ? 1 : 0);
