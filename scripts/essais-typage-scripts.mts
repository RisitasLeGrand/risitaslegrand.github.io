/**
 * LES SCRIPTS SONT TYPÉS, ET LA MESURE LE PROUVE EN SACHANT MONTER.
 *
 *   npm run essais:typage-scripts
 *
 * ## Le défaut que cet essai existe pour fermer
 *
 * `tsconfig.json` porte « **\/*.ts » dans son include, qui ne reconnaît pas
 * l'extension « .mts ». Relevé le 1er novembre par `--listFiles` : 352
 * fichiers de `src/` examinés, ZÉRO de `scripts/`. Et `tsx` transpile sans
 * vérifier. Les cent quatre-vingts essais du dépôt — ceux qui gardent tout le
 * reste — n'étaient donc gardés par rien.
 *
 * Soixante-six erreurs à l'ouverture du chantier, dont une cinquantaine d'une
 * seule famille : un essai qui FABRIQUE un objet que le programme ne peut pas
 * produire, puis l'éprouve. Une « Tache » à qui manquent quatre champs, une
 * valeur hors de son union, un argument de trop ou de moins. Ces essais
 * tournent, et peuvent être verts, sur une entrée qui n'existe pas.
 *
 * ## POURQUOI LE TÉMOIN, et c'est la moitié qui compte
 *
 * La première mesure de ce chantier a rendu « 1 erreur, 0 fichier touché ».
 * Cela ressemblait à un dépôt sain. L'erreur unique était TS5101 — une option
 * `baseUrl` dépréciée dans le tsconfig lui-même, donc une erreur de
 * CONFIGURATION : `tsc` n'avait typé aucun fichier.
 *
 * **Un zéro qui veut dire « la mesure n'a pas tourné » a exactement
 * l'apparence d'un zéro qui veut dire « tout va bien. »** Rien ne les sépare
 * de l'extérieur, et le second est celui qu'on espère.
 *
 * Cet essai ne se contente donc pas de constater zéro. Il écrit un fichier à
 * trois fautes volontaires, vérifie que le compte MONTE, puis l'efface. Un
 * zéro non accompagné d'un témoin n'est pas un résultat : c'est une absence
 * de résultat qui se présente bien. Le Pilote en a fait une règle pour tous
 * le 1er novembre.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RACINE = resolve(import.meta.dirname, '..');
const CONFIG = resolve(RACINE, 'tsconfig.scripts.json');
const TSC = resolve(RACINE, 'node_modules', '.bin', 'tsc');
const TEMOIN = resolve(RACINE, 'scripts', 'temoin-du-typage.mts');

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};
const vrai = (titre: string, condition: boolean) => v(titre, condition, true);

/*
   ON REFUSE PLUTÔT QUE DE RENDRE UN VERT SANS OBJET.

   Sans `tsc` ou sans le tsconfig, il n'y a rien à mesurer. Rendre « tous les
   essais passent » dirait alors le contraire de la vérité, et c'est la pire
   des deux sorties possibles. Code 2 : l'essai n'a pas eu lieu.
*/
for (const [quoi, chemin] of [['tsc', TSC], ['tsconfig.scripts.json', CONFIG]] as const) {
  if (!existsSync(chemin)) {
    console.log(`\n\x1b[33mREFUS — ${quoi} est introuvable (${chemin}).\x1b[0m`);
    console.log('Rien n’a été mesuré : cet essai sort en 2 plutôt que de rendre un vert sans objet.\n');
    process.exit(2);
  }
}

/** Le nombre d'erreurs de typage des scripts, et les lignes qui les portent. */
function compter(): { erreurs: number; lignes: string[]; restantes: string[] } {
  let sortie = '';
  try {
    sortie = execFileSync(TSC, ['--noEmit', '-p', CONFIG], {
      cwd: RACINE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (erreur) {
    /* `tsc` sort en 1 dès qu'il trouve une erreur : c'est le cas normal ici. */
    const e = erreur as { stdout?: string; stderr?: string };
    sortie = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const lignes = sortie.split('\n').filter((l) => / error TS\d+/.test(l));
  /*
     UNE ERREUR QUI NE DÉSIGNE AUCUN FICHIER DE « scripts/ » EST UNE ERREUR DE
     CONFIGURATION, et elle est traitée à part : c'est elle qui avait fait
     passer une mesure morte pour un dépôt sain.
  */
  const deConfig = lignes.filter((l) => !/^scripts[/\\]/.test(l));
  if (deConfig.length) {
    console.log('\n\x1b[31mLA CONFIGURATION ELLE-MÊME EST REFUSÉE :\x1b[0m');
    for (const l of deConfig) console.log(`  ${l}`);
    console.log('Aucun fichier n’a donc été typé. Ce n’est pas un dépôt sain, c’est une mesure morte.\n');
  }
  const dansScripts = lignes.filter((l) => /^scripts[/\\]/.test(l));
  return { erreurs: dansScripts.length, lignes: deConfig, restantes: dansScripts };
}

console.log('\n\x1b[1mLES SCRIPTS SONT TYPÉS\x1b[0m\n');

const avant = compter();
v('la configuration est acceptée — aucune erreur hors de scripts/', avant.lignes, []);
/*
   LE ROUGE NOMME CE QUI RESTE, et ne se contente pas d'un nombre.

   « obtenu 1, attendu 0 » ne dit pas quel fichier, et c'est la même faute que
   partout ailleurs : un contrôle doit échouer LISIBLEMENT. On imprime donc les
   lignes restantes avant de conclure, de sorte que celui qui lit le rouge
   sache quoi ouvrir.
*/
if (avant.erreurs > 0) {
  console.log(
    avant.erreurs >= 2
      ? `  \x1b[33mles ${avant.erreurs} erreurs qui restent :\x1b[0m`
      : '  \x1b[33ml’erreur qui reste :\x1b[0m',
  );
  for (const ligne of avant.restantes) console.log(`      ${ligne}`);
}
v('aucune erreur de typage dans les cent quatre-vingts scripts', avant.erreurs, 0);

console.log('\n\x1b[1mET LA MESURE SAIT MONTER — le témoin\x1b[0m\n');

/*
   TROIS FAUTES DE TROIS FAMILLES DIFFÉRENTES, pour que le témoin ne dépende
   pas d'un seul réglage : une affectation de type, un retour de type, et une
   variable lue avant d'être assignée — cette dernière ne se voit qu'avec
   « strictNullChecks », qui est précisément ce que ce tsconfig ajoute.
*/
const FAUTES = `/* Fichier écrit et effacé par essais:typage-scripts. Ne pas commiter. */
const nombre: number = 'une chaîne';
export const inverse: string = nombre;
let jamaisAssignee: number;
export const lue = jamaisAssignee + 1;
`;

let apres = { erreurs: -1, lignes: [] as string[], restantes: [] as string[] };
try {
  writeFileSync(TEMOIN, FAUTES, 'utf8');
  apres = compter();
} finally {
  /*
     L'EFFACEMENT EST DANS UN « finally », et c'est indispensable : un témoin
     oublié dans « scripts/ » ferait rougir tous les essais suivants, et le
     crochet de fin de tour réclamerait de commiter un fichier qui ne doit
     jamais l'être.
  */
  rmSync(TEMOIN, { force: true });
}

vrai('le témoin a bien été effacé', !existsSync(TEMOIN));
vrai(`le compte MONTE avec le témoin (${avant.erreurs} → ${apres.erreurs})`, apres.erreurs > avant.erreurs);
v('et il monte des trois fautes posées', apres.erreurs - avant.erreurs, 3);

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} ${echecs >= 2 ? 'échecs' : 'échec'}.\x1b[0m\n`,
);
process.exit(echecs ? 1 : 0);
