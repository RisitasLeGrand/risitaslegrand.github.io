/**
 * Le témoin du coffre et les deux cases — phase 2 du prompt 35.
 *
 *   npm run essais:coffre-temoin
 *
 * **Ce que ce contrôle doit prouver.**
 *
 * *Que l'interdit 6 est tenu partout.* « Un bouton Fermer le coffre visible
 * partout où le coffre est ouvert. » Le relevé du 14 octobre montrait six
 * pages sous coffre sur dix sans bouton — et rien du tout sur les pages hors
 * coffre, où le coffre peut pourtant être ouvert. Le contrôle ouvre donc le
 * coffre, part sur une page qui n'a rien à voir, et exige d'y trouver le
 * bouton. C'est le cas que l'ancienne disposition ne couvrait pas.
 *
 * *Que le témoin ne ment pas sur la portée.* Un témoin qui annoncerait
 * « mémorisé sur cet appareil » à qui n'a rien mémorisé serait pire que pas
 * de témoin.
 *
 * *Que « Mémoriser » tient sa promesse ET que rien n'est en clair.* On relit
 * donc dans un contexte neuf — un navigateur qui n'a jamais vu cet onglet —
 * et on inspecte `localStorage` : ce qui y est rangé ne doit pas être
 * utilisable comme clé.
 *
 * *Que « Fermer » et « Oublier » ne promettent pas la même chose.* Fermer
 * laisse la mémorisation ; oublier l'efface. Les confondre ferait croire
 * effacé ce qui ne l'est pas.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { devientVisible } from './lib/post-condition.mjs';

/*
   « Cette clé de stockage a disparu. »

   Post-condition de ce qu'un geste efface SANS marque d'écran. Les options de
   `waitForFunction` sont au TROISIÈME argument, le second étant la valeur
   passée à la fonction : une borne écrite au second serait ignorée en silence,
   et le relevé d'A en a trouvé seize dans ce cas.
*/
const clePartie = (ou, cle, delai = 15000) =>
  page
    .waitForFunction(
      ([magasin, nom]) => !(magasin === 'local' ? localStorage : sessionStorage).getItem(nom),
      [ou, cle],
      { timeout: delai },
    )
    .then(() => true)
    .catch(() => false);

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
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 200)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 200)}`);
  }
};

console.log('\nCOFFRE — LE TÉMOIN ET LES DEUX CASES');

const session = async (p) => {
  if (await p.locator('#champ-mdp').isVisible().catch(() => false)) {
    await p.fill('#champ-mdp', MDP);
    await p.click('#bouton-verrou');
  }
};

const ouvrir = async (p, { memoriser = false } = {}) => {
  await p.locator('#mdp-coffre').waitFor({ state: 'visible', timeout: 25000 });
  await p.fill('#mdp-coffre', MDP);
  if (memoriser) await p.check('#coffre-appareil');
  await p.click('#ouvrir-coffre');
  await p.locator('#coffre-ferme').waitFor({ state: 'hidden', timeout: 25000 });
};

/* --- A. Les deux cases, et la seconde qui dépend de la première ---------- */

console.log('\n  A — les deux cases');

const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await session(page);
await page.locator('#mdp-coffre').waitFor({ state: 'visible', timeout: 25000 });

v('la case de session est cochée par défaut', await page.isChecked('#coffre-session'), true);
v('la case de l’appareil est décochée par défaut', await page.isChecked('#coffre-appareil'), false);
v('et elle est visible tant que la première est cochée', await page.isVisible('#ligne-coffre-appareil'), true);

await page.uncheck('#coffre-session');
v(
  'décocher la première cache la seconde : mémoriser sans garder ouvert n’a pas de sens',
  await page.isVisible('#ligne-coffre-appareil'),
  false,
);
await page.check('#coffre-session');

const avertissement = await page.textContent('#ligne-coffre-appareil');
v(
  'l’avertissement dit qui pourra ouvrir le coffre',
  /pourra alors ouvrir le coffre sans le connaître/.test(avertissement ?? ''),
  true,
);

/* --- B. Le témoin, et l'interdit 6 hors des pages du coffre -------------- */

console.log('\n  B — le témoin, et fermer depuis n’importe où');

await ouvrir(page);
await page.locator('#temoin-coffre').waitFor({ state: 'visible', timeout: 10000 });
v(
  'le témoin dit « session » et non « mémorisé »',
  (await page.textContent('#temoin-coffre-libelle'))?.trim(),
  'Coffre ouvert (session)',
);
v('et il n’offre pas « Oublier » puisqu’il n’y a rien à oublier', await page.isVisible('#temoin-coffre-oublier'), false);

/* LE cas que l'ancienne disposition ne couvrait pas. */
await page.goto(`${RACINE}/glossaire/`, { waitUntil: 'networkidle' });
await session(page);
await page.locator('#temoin-coffre').waitFor({ state: 'visible', timeout: 15000 });
v(
  'sur une page SANS coffre, le témoin est là et le bouton de fermeture aussi',
  await page.isVisible('#temoin-coffre-fermer'),
  true,
);

/*
   DEUX FAITS, DEUX POST-CONDITIONS : le témoin se cache, et la clé de l'onglet
   s'efface. Une temporisation les couvrait tous deux par accident ; en la
   retirant, il faut nommer chacun.
*/
await page.click('#temoin-coffre-fermer');
v('fermer depuis cette page cache le témoin', await devientVisible(page, '#temoin-coffre', false), true);
v('et la clé de l’onglet s’efface', await clePartie('session', 'cyclades.coffre'), true);
v(
  'et la clé de l’onglet a disparu',
  await page.evaluate(() => sessionStorage.getItem('cyclades.coffre')),
  null,
);

/* --- C. Mémoriser sur cet appareil --------------------------------------- */

console.log('\n  C — mémoriser sur cet appareil');

await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await session(page);
await ouvrir(page, { memoriser: true });
await page.locator('#temoin-coffre').waitFor({ state: 'visible', timeout: 10000 });
v(
  'le témoin dit maintenant « mémorisé sur cet appareil »',
  (await page.textContent('#temoin-coffre-libelle'))?.trim(),
  'Coffre ouvert (mémorisé sur cet appareil)',
);
v('et « Oublier » est proposé', await page.isVisible('#temoin-coffre-oublier'), true);

const range = await page.evaluate(() => localStorage.getItem('cyclades.coffre.appareil'));
v('quelque chose est mémorisé', Boolean(range), true);
const utilisable = await page.evaluate(async () => {
  const t = localStorage.getItem('cyclades.coffre.appareil');
  try {
    await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(atob(t), (c) => c.charCodeAt(0)),
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt'],
    );
    return true;
  } catch {
    return false;
  }
});
v('mais ce n’est pas une clé utilisable : interdit 2 tenu', utilisable, false);

/* --- D. Fermer n'est pas oublier ----------------------------------------- */

console.log('\n  D — fermer n’est pas oublier');

/*
   La post-condition est l'effet VISIBLE du clic — le témoin s'en va. Ce qui
   suit affirme qu'une chose N'A PAS bougé, et aucune attente ne peut le
   prouver : il faut seulement s'assurer que le geste a eu lieu avant de lire.
*/
await page.click('#temoin-coffre-fermer');
await devientVisible(page, '#temoin-coffre', false);
v(
  'après « Fermer », la mémorisation est toujours là',
  Boolean(await page.evaluate(() => localStorage.getItem('cyclades.coffre.appareil'))),
  true,
);

await page.reload({ waitUntil: 'networkidle' });
await session(page);
v(
  'et le coffre se rouvre SANS mot de passe',
  await devientVisible(page, '#mdp-coffre', false, { delai: 30000 }),
  true,
);

await page.locator('#temoin-coffre-oublier').waitFor({ state: 'visible', timeout: 10000 });
await page.click('#temoin-coffre-oublier');
v('« Oublier » efface la mémorisation', await clePartie('local', 'cyclades.coffre.appareil'), true);
v(
  'après « Oublier », plus rien n’est mémorisé',
  await page.evaluate(() => localStorage.getItem('cyclades.coffre.appareil')),
  null,
);
v('et le coffre est fermé', await page.isVisible('#temoin-coffre'), false);

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
