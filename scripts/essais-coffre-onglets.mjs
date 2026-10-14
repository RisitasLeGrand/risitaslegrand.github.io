/**
 * La session du coffre entre onglets — phase 3 du prompt 35.
 *
 *   npm run essais:coffre-onglets
 *
 * **Ce qu'il faut prouver, et dans les deux sens.**
 *
 * Un contrôle qui se contenterait de vérifier qu'un second onglet s'ouvre
 * sans mot de passe serait vert aussi le jour où la clé partirait du disque —
 * c'est-à-dire précisément le jour où la promesse du prompt serait rompue.
 * Il faut donc aussi prouver le **négatif** : un contexte neuf, sans aucun
 * onglet vivant, ne doit RIEN pouvoir ouvrir, alors même que l'enveloppe
 * d'IndexedDB y serait.
 *
 * Et prouver que fermer dans un onglet ferme dans l'autre : laisser un onglet
 * ouvert après « Fermer le coffre » serait le même mensonge que le bouton
 * absent des six pages.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)} / attendu ${JSON.stringify(attendu)}`);
};

console.log('\nCOFFRE — LA SESSION ENTRE ONGLETS');

const session = async (p) => {
  if (await p.locator('#champ-mdp').isVisible().catch(() => false)) {
    await p.fill('#champ-mdp', MDP);
    await p.click('#bouton-verrou');
  }
};
const coffreDemande = (p) => p.locator('#mdp-coffre').isVisible().catch(() => false);

const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctx.newPage();
a.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

/* --- A. Case cochée : un onglet neuf reçoit la clé d'un onglet vivant ---- */

console.log('\n  A — case cochée : le second onglet n’a rien à saisir');

await a.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await session(a);
await a.locator('#mdp-coffre').waitFor({ state: 'visible', timeout: 25000 });
v('la case de session est bien cochée', await a.isChecked('#coffre-session'), true);
await a.fill('#mdp-coffre', MDP);
await a.click('#ouvrir-coffre');
await a.locator('#coffre-ferme').waitFor({ state: 'hidden', timeout: 25000 });

const b = await ctx.newPage();
await b.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await session(b);
await b.waitForTimeout(2500);
v('le second onglet n’a pas demandé le mot de passe', await coffreDemande(b), false);
/*
   Attente tolérante, et la raison vaut d'être écrite : un sabotage de contrôle
   a montré que ce `waitFor` faisait **planter** l'essai au lieu de l'échouer,
   avalant les contrôles suivants. Un essai qui s'écrase ne dit pas ce qui ne
   va pas ; il dit seulement qu'il s'est arrêté.
*/
await b.locator('#temoin-coffre').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
v(
  'et son témoin dit « session »',
  (await b.textContent('#temoin-coffre-libelle').catch(() => null))?.trim() ?? '(témoin absent)',
  'Coffre ouvert (session)',
);

/* --- B. Le négatif : sans onglet vivant, le disque ne suffit pas --------- */
/*
   Un contexte neuf partage l'origine mais pas la sessionStorage, et surtout
   n'a aucun onglet donneur du contexte précédent. Si la clé passait par le
   disque, ce contrôle serait vert là où il doit être rouge.
*/

console.log('\n  B — sans onglet donneur, rien ne s’ouvre');

const seul = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const c = await seul.newPage();
await c.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await session(c);
await c.waitForTimeout(2500);
v('un contexte sans donneur redemande le mot de passe', await coffreDemande(c), true);
await seul.close();

/* --- C. Fermer dans un onglet ferme dans l'autre ------------------------- */

console.log('\n  C — fermer ici ferme là-bas');

await a.bringToFront();
await a.click('#temoin-coffre-fermer');
await a.waitForTimeout(1200);
v('l’onglet qui a fermé est fermé', await a.isVisible('#temoin-coffre'), false);
await b.waitForTimeout(800);
v('et l’autre onglet aussi', await b.isVisible('#temoin-coffre'), false);
v(
  'sa clé d’onglet a disparu',
  await b.evaluate(() => sessionStorage.getItem('cyclades.coffre')),
  null,
);

/* --- D. Case décochée : la portée reste l'onglet ------------------------- */

console.log('\n  D — case décochée : la portée reste l’onglet');

const seul2 = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const d = await seul2.newPage();
await d.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await session(d);
await d.locator('#mdp-coffre').waitFor({ state: 'visible', timeout: 25000 });
await d.uncheck('#coffre-session');
await d.fill('#mdp-coffre', MDP);
await d.click('#ouvrir-coffre');
await d.locator('#coffre-ferme').waitFor({ state: 'hidden', timeout: 25000 });

const e = await seul2.newPage();
await e.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await session(e);
await e.waitForTimeout(2500);
v('un onglet neuf redemande le mot de passe', await coffreDemande(e), true);
await seul2.close();

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
