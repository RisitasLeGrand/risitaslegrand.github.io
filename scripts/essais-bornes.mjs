/**
 * LES BORNES DE « waitForFunction » : LE GARDE-FOU, ET SON PROPRE GARDE-FOU.
 *
 *   npm run essais:bornes
 *
 * ## Ce que garde le balayage, et pourquoi il entre au socle
 *
 * La signature est `waitForFunction(fonction, valeur, options)`. Une borne
 * écrite au SECOND rang part comme valeur, la fonction ne la lit pas, et
 * l'attente retombe sur les trente secondes par défaut. Seize appels de ce
 * dépôt en portaient une, et aucune relecture ne les avait vues : les deux
 * formes se ressemblent trop.
 *
 * ## Ce que garde CET essai, qui est une autre chose
 *
 * Le balayage découpe les arguments caractère par caractère, parce qu'aucune
 * expression régulière plate ne distingue les virgules de l'appel de celles
 * d'une fonction fléchée passée en premier argument. Et un analyseur cassé
 * **ne lève pas** : il rend ZÉRO FAUTE, ce qui est exactement ce que rend un
 * dépôt propre. C'est le piège qui a coûté trois pannes au chemin du
 * navigateur, et il est ici de la même famille.
 *
 * On éprouve donc le balayage dans les DEUX sens, sur des textes écrits pour
 * cela : ce qu'il doit voir, et ce qu'il ne doit pas voir. Un essai qui ne
 * vérifierait que le second serait vert avec un analyseur qui ne trouve
 * jamais rien.
 *
 * ## Et les trois codes de sortie
 *
 * Le socle s'enchaîne avec un `&&` : seul le code de sortie compte. Les trois
 * sont donc mesurés sur des dossiers d'essai, dans un processus enfant —
 * 0 quand c'est propre, 1 sur une faute, 2 quand le balayage n'a rien lu, ce
 * dernier étant le cas qui rendrait un vert sans avoir mesuré.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  PORTEURS_D_EXEMPLES,
  argumentsDePremierNiveau,
  bornesAuMauvaisRang,
  bornesDansLeTexte,
} from './lib/bornes-de-waitforfunction.mjs';

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

/** Les lignes fautives d'un texte, pour comparer à ce qu'on attend. */
const fautesDe = (texte) => bornesDansLeTexte(texte).fautes.map((f) => f.ligne);

console.log('\nCE QUE LE BALAYAGE DOIT VOIR');

/*
   LA FORME EXACTE DES SEIZE. Elle est en tête parce que c'est la seule qui
   prouve que l'analyseur marche encore : tout le reste de cet essai reste
   vert si le balayage ne trouve plus jamais rien.
*/
verifier(
  'la borne au second rang est vue',
  fautesDe("await page.waitForFunction(() => document.body !== null, { timeout: 20_000 });"),
  [1],
);
verifier(
  'la forme abrégée « { timeout } » est vue',
  fautesDe('await page.waitForFunction(() => vrai(), { timeout });'),
  [1],
);
verifier(
  'la borne parenthésée « ({ timeout: N }) » est vue',
  fautesDe('await page.waitForFunction(() => vrai(), ({ timeout: 5000 }));'),
  [1],
);
verifier(
  'une borne accompagnée d’une autre option est vue',
  fautesDe("await page.waitForFunction(() => vrai(), { polling: 'raf', timeout: 9000 });"),
  [1],
);
/*
   LES CAS QUI CASSENT UN ANALYSEUR PLAT, et qui sont la raison du découpage à
   la main : des virgules et des accolades DANS le premier argument, et une
   parenthèse dans une chaîne.
*/
verifier(
  'une fonction fléchée à corps en accolades et à virgules ne masque pas la faute',
  fautesDe(
    'await page.waitForFunction(() => {\n' +
    '    const [a, b] = [1, 2];\n' +
    '    return a + b === 3;\n' +
    '  }, { timeout: 20_000 });',
  ),
  [1],
);
verifier(
  'une parenthèse dans une chaîne ne clôt pas l’appel',
  fautesDe('await page.waitForFunction(() => texte(")") !== \'\', { timeout: 1000 });'),
  [1],
);
/*
   LA VIRGULE FINALE. Ces deux contrôles-ci sont ceux qui ont trouvé quelque
   chose : le balayage ne voyait PAS la forme sur plusieurs lignes, parce que
   la virgule que Prettier pose après le dernier argument rendait un troisième
   argument vide. Trente-quatre bornes étaient au mauvais rang dans huit
   essais, dans le silence d'un balayage qui annonçait zéro.
*/
verifier(
  'une virgule finale sur une ligne ne cache pas la faute',
  fautesDe('await page.waitForFunction(() => vrai(), { timeout: 1000 },);'),
  [1],
);
verifier(
  'un appel sur plusieurs lignes est rendu à la ligne de son nom',
  fautesDe(
    'const a = 1;\n' +
    'await page.waitForFunction(\n' +
    '  () => document.querySelector(\'#x\') !== null,\n' +
    '  { timeout: 20_000 },\n' +
    ');',
  ),
  [2],
);
verifier(
  'deux fautes dans un même texte sont rendues toutes les deux',
  fautesDe(
    'await page.waitForFunction(() => a(), { timeout: 1 });\n' +
    'await page.waitForFunction(() => b(), undefined, { timeout: 2 });\n' +
    'await page.waitForFunction(() => c(), { timeout: 3 });',
  ),
  [1, 3],
);

console.log('\nCE QUE LE BALAYAGE NE DOIT PAS VOIR');

verifier(
  'les options au troisième rang, valeur « undefined »',
  fautesDe('await page.waitForFunction(() => vrai(), undefined, { timeout: 20_000 });'),
  [],
);
verifier(
  'les options au troisième rang, valeur utile',
  fautesDe("await page.waitForFunction((s) => vrai(s), '#x', { timeout: 20_000 });"),
  [],
);
verifier(
  'les options au troisième rang, valeur composée',
  fautesDe("await page.waitForFunction(([s, n]) => vrai(s, n), ['#x', 3], { timeout: 20_000 });"),
  [],
);
/*
   UN APPEL SANS BORNE DU TOUT n'est pas de ce balayage : c'est une autre
   faute, moins trompeuse — elle se voit à la relecture — et son remède n'est
   pas le même. Le confondre ici ferait rougir des appels corrects aux yeux de
   ce que ce balayage annonce garder.
*/
verifier('un appel sans borne du tout n’est pas de ce balayage', fautesDe('await page.waitForFunction(() => vrai());'), []);
verifier(
  'une valeur qui ressemble à des options sans porter « timeout »',
  fautesDe("await page.waitForFunction((o) => vrai(o), { delai: 2000 });"),
  [],
);
/*
   LE MOT ENTIER. « montimeout » ou « timeoutMax » ne sont pas l'option de
   Playwright, et les signaler ferait rougir une valeur légitime.
*/
verifier(
  'un champ dont le nom contient « timeout » sans l’être',
  fautesDe('await page.waitForFunction((o) => vrai(o), { timeoutMax: 10 });'),
  [],
);

console.log('\nL’ANALYSEUR D’ARGUMENTS, PRIS SÉPARÉMENT');

const argsDe = (appel) => argumentsDePremierNiveau(appel, appel.indexOf('('));
verifier('un seul argument', argsDe('f(() => vrai())'), ['() => vrai()']);
verifier('deux arguments', argsDe("f(() => vrai(), '#x')"), ['() => vrai()', "'#x'"]);
verifier(
  'une virgule dans un tableau ne découpe pas',
  argsDe("f((a) => a, ['#x', 3])"),
  ['(a) => a', "['#x', 3]"],
);
verifier(
  'une virgule dans une chaîne ne découpe pas',
  argsDe("f((a) => a, 'x, y')"),
  ['(a) => a', "'x, y'"],
);
/*
   LE REFUS DE L'ANALYSEUR. Des parenthèses qui ne se referment pas — un
   fichier tronqué, une concaténation ratée — ne doivent pas se lire comme un
   appel à un argument : ce serait la façon la plus discrète de perdre une
   faute.
*/
verifier('des parenthèses non refermées rendent « null »', argsDe('f(() => vrai()'), null);

console.log('\nLES TROIS CODES DE SORTIE, SUR DES DOSSIERS D’ESSAI');

/** Lance la ligne de commande sur un dossier, et rend son code de sortie. */
function codeDeSortie(dossier) {
  try {
    execFileSync(
      process.execPath,
      [path.join(racine, 'scripts', 'relever-temporisations.mjs'), '--bornes', '--dans', dossier],
      { encoding: 'utf8', timeout: 60_000, stdio: 'pipe', cwd: racine },
    );
    return 0;
  } catch (erreur) {
    return erreur.status ?? -1;
  }
}

const bac = mkdtempSync(path.join(tmpdir(), 'bornes-'));

const propre = path.join(bac, 'propre');
mkdirSync(propre);
writeFileSync(
  path.join(propre, 'essais-exemple.mjs'),
  "await page.waitForFunction((s) => vrai(s), '#x', { timeout: 20_000 });\n",
);

const fautif = path.join(bac, 'fautif');
mkdirSync(fautif);
writeFileSync(
  path.join(fautif, 'essais-exemple.mjs'),
  'await page.waitForFunction(() => vrai(), { timeout: 20_000 });\n',
);

const muet = path.join(bac, 'muet');
mkdirSync(muet);
writeFileSync(path.join(muet, 'essais-exemple.mjs'), 'await page.click("#x");\n');

verifier('un dossier propre rend 0', codeDeSortie(propre), 0);
verifier('une borne au mauvais rang rend 1', codeDeSortie(fautif), 1);
/*
   CELUI-CI EST LE PLUS IMPORTANT DES TROIS. Sans lui, un dossier renommé ou
   une extension oubliée rendraient 0 — le vert d'un balayage qui n'a rien lu,
   dans un enchaînement où personne ne relit la sortie.
*/
verifier('un dossier sans aucun appel REFUSE, et rend 2', codeDeSortie(muet), 2);

console.log('\nET LE DÉPÔT LUI-MÊME');

/*
   La mesure que le socle fait vraiment. Elle est ici pour que l'essai lancé
   seul dise la même chose que l'enchaînement, et pour que le compte d'appels
   lus soit visible : un balayage qui tomberait à quelques appels aurait cessé
   de lire les essais sans cesser d'être vert.
*/
const dossier = path.join(racine, 'scripts');
const { fautes, appels } = bornesAuMauvaisRang(dossier);
verifier(
  'aucune borne au mauvais rang dans « scripts »',
  fautes.map((f) => `${path.basename(f.fichier)}:${f.ligne}`),
  [],
);
verifier(`plus de cent appels lus (${appels})`, appels > 100, true);

/*
   L'EXCLUSION, PROUVÉE PORTEUSE. Un fichier passé par le balayage est une
   tache aveugle, et une tache aveugle non gardée s'élargit : on en ajoute un
   « le temps de », et le socle ne garde plus ce qu'il annonce.

   Deux contrôles la tiennent. Qu'elle ne compte qu'un fichier — en ajouter un
   second devient alors un choix qu'il faut écrire ici. Et que ce fichier-là
   porte bien des exemples : sans l'exclusion, le balayage DOIT le signaler.
   Si ce second contrôle rougit, c'est que l'exclusion ne cache plus des
   exemples mais quelque chose d'autre.
*/
verifier('un seul fichier est porteur d’exemples', PORTEURS_D_EXEMPLES, ['essais-bornes.mjs']);
verifier(
  'sans l’exclusion, le balayage signale bien les exemples de cet essai',
  bornesAuMauvaisRang(dossier, { ignorer: [] })
    .fautes.every((f) => f.fichier.endsWith('essais-bornes.mjs')) &&
    bornesDansLeTexte(readFileSync(path.join(dossier, 'essais-bornes.mjs'), 'utf8')).fautes.length >= 8,
  true,
);

console.log(
  echecs === 0
    ? `\n${vert('✓')} les bornes de « waitForFunction » sont au bon rang, et le balayage ` +
        'voit ce qu’il annonce voir.\n'
    : `\n${rouge('✗')} ${echecs} ${echecs === 1 ? 'contrôle' : 'contrôles'} en échec.\n`,
);
process.exit(echecs > 0 ? 1 : 0);
