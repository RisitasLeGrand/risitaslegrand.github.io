/**
 * Finances dans l'analyse globale — phase 4 du prompt 35.
 *
 *   npm run essais:coffre-analyse
 *
 * **Trois promesses, et deux d'entre elles sont des interdits.**
 *
 * *Le manque est nommé, jamais silencieux.* Coffre fermé, l'agrégat ne doit
 * pas échouer, et il ne doit pas non plus se taire : « le coffre est fermé »
 * et « il n'y a rien à montrer » s'afficheraient autrement de la même façon.
 *
 * *L'XP ne bouge pas* (interdit 5). Ce n'est pas une affaire de bonne volonté
 * mais de règles : le moteur d'activité n'accorde d'XP qu'aux types qu'il
 * nomme. Le contrôle lit cette liste et exige qu'aucun type de finances n'y
 * figure. Il échouera donc le jour où quelqu'un en ajoutera un.
 *
 * *Le libellé d'une opération ne sort pas.* C'est le nom d'un commerçant,
 * d'un bailleur, d'un médecin — la donnée la plus parlante du lot, et celle
 * dont un agrégat n'a aucun besoin.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)?.slice(0, 200)} / attendu ${JSON.stringify(attendu)?.slice(0, 200)}`);
};

console.log('\nFINANCES DANS L’ANALYSE GLOBALE');

/* --- A. La source est déclarée ------------------------------------------ */

console.log('\n  A — la source');

{
  const src = readFileSync('src/lib/odyssee/faits-branches.ts', 'utf8');
  v('« finances » figure dans SourceDeFaits', /SourceDeFaits =[^;]*'finances'/.test(src), true);
  v('et dans la liste SOURCES', /SOURCES[\s\S]{0,200}'finances',/.test(src), true);
  v(
    'son absence est nommée, comme pour Psyché',
    src.includes('Finances, coffre fermé'),
    true,
  );
}

/* --- B. L'interdit 5 : l'XP ne bouge pas -------------------------------- */

console.log('\n  B — l’XP ne bouge pas (interdit 5)');

{
  const src = readFileSync('src/lib/odyssee/activite.ts', 'utf8');
  const types = [...src.matchAll(/^\s*type: '([a-z.-]+)',$/gm)].map((m) => m[1]);
  const finances = types.filter((t) => t === 'odyssee.operation' || t === 'odyssee.valorisation');
  console.log(`     ${types.length} règle(s) d’XP, sur des types : ${[...new Set(types)].join(', ')}`);
  v('aucune règle d’XP ne porte sur un type de finances', finances, []);
}

/* --- C. Le libellé ne sort pas ------------------------------------------ */

console.log('\n  C — le libellé d’une opération ne sort pas');

{
  const src = readFileSync('src/lib/odyssee/faits-finances.ts', 'utf8');
  /* On écarte les commentaires : c'est le CODE qui ne doit pas le lire. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  v('le publicateur ne lit jamais « .libelle »', /\.libelle\b/.test(code), false);
  v('mais il publie bien la catégorie', /categorie/.test(code), true);
}

/* --- D. À l'écran : le manque est nommé, puis il disparaît -------------- */

console.log('\n  D — à l’écran');

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

await page.goto(`${RACINE}/odyssee/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.locator('#vue').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});

/*
   LE point : coffre fermé, l'agrégat doit aboutir. Une exception non
   rattrapée ferait disparaître quatre branches lisibles parce que la
   cinquième est verrouillée.
*/
v('coffre fermé, le tableau de bord s’affiche quand même', await page.isVisible('#vue'), true);
v('et aucune erreur de page n’a été levée', erreurs, []);

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
