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
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET LEUR COMPLÉMENT POSITIF

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Cinq temporisations à
   l'aveugle, dont trois de 2 500 ms devant un constat NÉGATIF — « l'onglet
   n'a pas demandé le mot de passe » — qui est vrai dès le chargement et le
   resterait si le cadenas paraissait une seconde plus tard.

   Chacune a son complément positif, et il était déjà dans le fichier : le
   TÉMOIN du coffre ouvert. Il suffisait de l'attendre AVANT de lire l'absence
   du cadenas, et non après. Là où le cadenas DOIT paraître — un contexte sans
   onglet donneur —, c'est lui qu'on attend.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;

/** Attend le témoin du coffre ouvert, ou le cadenas. */
const attendreLEtatDuCoffre = (p, ouvert) =>
  p
    .waitForFunction(
      (veutOuvert) => {
        const vu = (id) => {
          const e = document.getElementById(id);
          return Boolean(e) && e.getBoundingClientRect().height > 0;
        };
        return veutOuvert ? vu('temoin-coffre') : vu('mdp-coffre');
      },
      ouvert,
      { timeout: DELAI },
    )
    .catch(() => {});

const b = await ctx.newPage();
await b.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await session(b);
/*
   LE TÉMOIN D'ABORD, LE CONSTAT NÉGATIF ENSUITE. L'attente était déjà là,
   quatre lignes plus bas ; elle est seulement remontée avant la lecture
   qu'elle rend sensée.

   Elle reste TOLÉRANTE, et la raison vaut d'être gardée : un sabotage de
   contrôle a montré qu'un `waitFor` sec faisait planter l'essai au lieu de
   l'échouer, avalant les contrôles suivants. Un essai qui s'écrase ne dit pas
   ce qui ne va pas ; il dit seulement qu'il s'est arrêté.
*/
await attendreLEtatDuCoffre(b, true);
v('le second onglet n’a pas demandé le mot de passe', await coffreDemande(b), false);
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
/* Ici le cadenas DOIT paraître : c'est lui qu'on attend. */
await attendreLEtatDuCoffre(c, false);
v('un contexte sans donneur redemande le mot de passe', await coffreDemande(c), true);
await seul.close();

/* --- C. Fermer dans un onglet ferme dans l'autre ------------------------- */

console.log('\n  C — fermer ici ferme là-bas');

await a.bringToFront();
await a.click('#temoin-coffre-fermer');
/* Le témoin s'en va ici, puis là-bas : les deux sont ce que les constats
   lisent, et le second passe par le relais entre onglets. */
await a.locator('#temoin-coffre').waitFor({ state: 'hidden', timeout: DELAI }).catch(() => {});
v('l’onglet qui a fermé est fermé', await a.isVisible('#temoin-coffre'), false);
await b.locator('#temoin-coffre').waitFor({ state: 'hidden', timeout: DELAI }).catch(() => {});
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
await attendreLEtatDuCoffre(e, false);
v('un onglet neuf redemande le mot de passe', await coffreDemande(e), true);
await seul2.close();

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
