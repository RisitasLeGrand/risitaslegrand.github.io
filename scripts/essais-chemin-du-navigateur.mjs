/**
 * LE CHEMIN DU NAVIGATEUR DES ESSAIS, ET SON REFUS.
 *
 *   npm run essais:chemin-du-navigateur
 *
 * ## Pourquoi ce garde-fou existe
 *
 * Le chemin du binaire de Chromium a cassé les essais de navigateur TROIS
 * fois, de trois façons différentes, et chaque fois la perte s'est comptée en
 * dizaines de rouges qui ne venaient pas du site :
 *
 *   1. le 19 octobre, quinze essais sans chemin de repli du tout ;
 *   2. le 25 octobre, cent soixante-un essais d'un coup, parce que le
 *      conteneur est passé à une disposition nommée « chrome-linux64 » là où
 *      l'aide partagée ne connaissait que « chrome-linux » ;
 *   3. le même jour, deux essais et un script de captures restés épinglés sur
 *      « chromium-1194/chrome-linux/chrome », un chemin qui ne désigne plus
 *      rien.
 *
 * ## Le piège commun aux trois
 *
 * **Ne rien trouver ne levait pas.** L'aide rendait `undefined`, Playwright
 * retombait sur son propre chemin supposé, et l'erreur parlait d'un binaire
 * que personne n'avait demandé — « chromium_headless_shell-1248 ». On
 * cherchait donc le défaut du côté du site.
 *
 * Le commentaire de l'aide ANNONÇAIT un « refus explicite plus bas » qui
 * n'avait jamais été écrit. Un commentaire qui promet un garde-fou absent est
 * pire qu'un silence : on le lit, on le croit, et on cherche ailleurs.
 *
 * ## Ce que cet essai garde
 *
 * - que l'aide trouve ici un binaire qui existe VRAIMENT, et non un chemin
 *   plausible ;
 * - qu'elle REFUSE quand il n'y a rien, au lieu de rendre `undefined` ;
 * - qu'elle honore `CHROMIUM` quand on le lui donne ;
 * - qu'aucun script ne réécrit un chemin épinglé par numéro de version.
 *
 * Les deux premiers tournent dans un processus enfant : l'aide met son
 * résultat en cache, donc on ne peut pas lui faire changer d'avis deux fois
 * dans le même processus.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const racine = path.resolve(import.meta.dirname, '..');
const vert = (t) => `\u001b[32m${t}\u001b[0m`;
const rouge = (t) => `\u001b[31m${t}\u001b[0m`;

let echecs = 0;
function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    echecs += 1;
    console.log(
      `  ${rouge('✗')} ${quoi} — attendu ${JSON.stringify(attendu)}, ` +
        `obtenu ${JSON.stringify(obtenu)}`,
    );
  }
}

/** Fait appeler l'aide dans un processus neuf, avec l'environnement donné. */
function dansUnEnfant(env) {
  const code =
    "import('" +
    path.join(racine, 'scripts', 'lib', 'chromium-essais.mjs') +
    "').then((m) => { try { console.log('OK ' + m.cheminDuNavigateur()); } " +
    "catch (e) { console.log('REFUS ' + e.message.split('\\n')[0]); } })";
  const sortie = execFileSync(process.execPath, ['-e', code], {
    encoding: 'utf8',
    timeout: 30_000,
    env,
  });
  return sortie.trim();
}

console.log('\nL’AIDE TROUVE UN BINAIRE QUI EXISTE');

const ici = cheminDuNavigateur();
verifier('un chemin est rendu', typeof ici === 'string' && ici.length > 0, true);
/*
   LE CONTRÔLE QUI COMPTE. Un chemin « plausible » est exactement ce que les
   trois pannes ont rendu : il faut que le fichier soit là, et qu'il soit un
   fichier — un lien symbolique vers un fichier compte, `statSync` le suit.
*/
verifier(
  `le binaire existe sur le disque (${ici})`,
  (() => {
    try {
      return statSync(ici).isFile();
    } catch {
      return false;
    }
  })(),
  true,
);

console.log('\nL’AIDE REFUSE AU LIEU DE RENDRE « UNDEFINED »');

/*
   `PLAYWRIGHT_BROWSERS_PATH` posée sur un dossier temporaire vide : elle
   REMPLACE le chemin du conteneur, donc la recherche n'a nulle part où
   trouver quoi que ce soit.

   Ce remplacement a été écrit POUR ce contrôle, et il est juste par ailleurs :
   la variable veut dire « les navigateurs sont ici », et l'aide cherchait
   aussi ailleurs. Tant qu'elle s'ajoutait, le refus était intestable —
   `/opt/pw-browsers` répond toujours — et un garde-fou intestable n'est pas
   un garde-fou.

   `CHROMIUM` doit être retiré, sinon elle court-circuite tout, ce qui est son
   office.
*/
const vide = mkdtempSync(path.join(tmpdir(), 'sans-navigateur-'));
const sansRien = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: vide };
delete sansRien.CHROMIUM;
const refus = dansUnEnfant(sansRien);
verifier(
  'sans aucun binaire, le refus est levé et non « undefined »',
  refus.startsWith('REFUS'),
  true,
);
verifier(
  'le refus nomme où il a cherché',
  refus.includes('Aucun navigateur trouvé'),
  true,
);

console.log('\nL’AIDE HONORE « CHROMIUM »');
const impose = dansUnEnfant({ ...process.env, CHROMIUM: '/un/chemin/a/moi' });
verifier('la variable gagne sur la recherche', impose, 'OK /un/chemin/a/moi');

console.log('\nAUCUN CHEMIN ÉPINGLÉ PAR NUMÉRO DE VERSION');

/*
   On cherche « chromium-<chiffres> » dans du CODE, pas dans un commentaire :
   les trois fichiers réparés racontent leur ancien chemin en toutes lettres,
   et c'est leur chaîne de raisons. Le signe du code est le guillemet qui
   ouvre la chaîne de caractères.
*/
const EPINGLE = /['"`][^'"`\n]*chromium[-_a-z]*[-_][0-9]+/;

function fichiersDe(dossier) {
  const trouves = [];
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree.startsWith('.')) continue;
    const chemin = path.join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiersDe(chemin));
    else if (/\.(mjs|mts|js|ts)$/.test(entree)) trouves.push(chemin);
  }
  return trouves;
}

const SOI = path.join('scripts', 'essais-chemin-du-navigateur.mjs');
const sources = fichiersDe(path.join(racine, 'scripts')).map((c) => path.relative(racine, c));
const epingles = sources
  .filter((relatif) => relatif !== SOI)
  .filter((relatif) => EPINGLE.test(readFileSync(path.join(racine, relatif), 'utf8')));

verifier(`aucun chemin épinglé dans ${sources.length} scripts`, epingles.sort(), []);
for (const e of epingles) {
  console.log(`        ${e} — appelez « cheminDuNavigateur() » plutôt que de nommer une version.`);
}

/*
   SABOTAGES PERMANENTS. Un balayage qui ne trouve rien ne prouve rien.
*/
verifier(
  'sabotage : un chemin épinglé serait vu',
  EPINGLE.test("executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',"),
  true,
);
verifier(
  'sabotage : le lien stable n’est pas vu',
  EPINGLE.test("executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',"),
  false,
);
verifier(
  'sabotage : un commentaire qui raconte l’ancien chemin n’est pas vu',
  EPINGLE.test('     Le chemin était épinglé sur « chromium-1194/chrome-linux/chrome ». Le'),
  false,
);
verifier(
  'sabotage : un nom de dossier de version dans du code est vu',
  EPINGLE.test('const racine = "chromium_headless_shell-1243";'),
  true,
);

console.log(
  echecs === 0
    ? `\n${vert('✓')} le chemin du navigateur se cherche, et son absence refuse.\n`
    : `\n${rouge('✗')} ${echecs} ${echecs === 1 ? 'contrôle' : 'contrôles'} en échec.\n`,
);
process.exit(echecs > 0 ? 1 : 0);
