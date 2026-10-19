/**
 * « Tout effacer sur cet appareil » efface les quatre endroits — A7 et G-2
 * du 58.
 *
 * ## D'où vient cet essai
 *
 * D'une sonde faite à la main le 19 octobre, qui a montré que le bouton ne
 * vidait que les magasins de la base `revinsp` : `localStorage` intact, Cache
 * Storage intact, les autres bases IndexedDB intactes — alors que la phrase
 * de confirmation annonçait « les réglages enregistrés dans ce navigateur ».
 * La sonde devient donc un essai, pour que le constat ne se reperde pas.
 *
 * ## Les deux moitiés du contrôle
 *
 * Un effacement a deux manières de se tromper, et les deux sont graves :
 *
 * - **ne pas assez effacer**, et c'est le défaut corrigé ici ;
 * - **trop effacer**, en emportant ce qui n'appartient pas à ce site. Un
 *   témoin étranger est donc posé à côté de chaque témoin à nous, et il doit
 *   survivre.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaBoite } from './lib/boite-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 220)));

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(3000);
  }
};

/** Pose les témoins, et rend l'état de départ. */
const poser = () =>
  page.evaluate(async () => {
    // À nous : deux vraies clés du site, et une étrangère à côté.
    localStorage.setItem('revinsp.theme', 'sombre');
    localStorage.setItem('cyclades.sport.refus', '{"temoin":true}');
    localStorage.setItem('autre-site.reglage', 'ne-pas-toucher');
    sessionStorage.setItem('cyclades.coffre.temoin', 'x');

    // Un cache à nous, un cache étranger.
    const aNous = await caches.open('cyclades-sonde');
    await aNous.put(new Request('https://exemple.test/a-nous'), new Response('x'));
    const etranger = await caches.open('autre-cache');
    await etranger.put(new Request('https://exemple.test/etranger'), new Response('x'));

    // Les deux bases annexes du site, et une base étrangère.
    const creer = (nom) =>
      new Promise((ok) => {
        const r = indexedDB.open(nom, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('t');
        r.onsuccess = () => {
          r.result.close();
          ok();
        };
        r.onerror = () => ok();
      });
    await creer('revinsp-instantanes');
    await creer('cyclades-cles');
    await creer('autre-base');

    return 'posés';
  });

/** Relève les quatre endroits, sans rien toucher. */
const relever = () =>
  page.evaluate(async () => {
    const bases = typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases()).map((b) => b.name).filter(Boolean).sort()
      : ['(liste indisponible)'];
    return {
      locales: Object.keys(localStorage).sort(),
      session: Object.keys(sessionStorage).sort(),
      caches: (await caches.keys()).sort(),
      bases,
    };
  });

/* ── Les témoins, posés dans les quatre endroits ──────────────────────── */

console.log('\nLES TÉMOINS, POSÉS DANS LES QUATRE ENDROITS');

await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2500);
v('les témoins sont posés', await poser(), 'posés');

const avant = await relever();
console.log(`      locales : ${avant.locales.join(', ')}`);
console.log(`      caches  : ${avant.caches.join(', ')}`);
console.log(`      bases   : ${avant.bases.join(', ')}`);
v('un réglage à nous est en place', avant.locales.includes('revinsp.theme'), true);
v('un cache à nous est en place', avant.caches.includes('cyclades-sonde'), true);
v('les deux bases annexes sont en place',
  ['revinsp-instantanes', 'cyclades-cles'].filter((b) => !avant.bases.includes(b)),
  []);

/* ── Le libellé dit la portée ─────────────────────────────────────────── */

console.log('\nLE LIBELLÉ DIT LA PORTÉE');

const libelle = ((await page.locator('#reinitialiser').textContent()) ?? '').trim();
v('le bouton s’appelle « Tout effacer sur cet appareil »', libelle, 'Tout effacer sur cet appareil');

/* ── L'effacement, depuis l'écran ─────────────────────────────────────── */

console.log('\nL’EFFACEMENT, DEPUIS L’ÉCRAN');

await page.click('#reinitialiser');
const titre = await page
  .locator('dialog.boite[open] .boite-titre')
  .textContent({ timeout: 30000 });
v('la boîte nomme l’appareil', (titre ?? '').trim(), 'Tout effacer sur cet appareil ?');

const dit = ((await page.locator('dialog.boite[open]').textContent()) ?? '').replace(/\s+/g, ' ');
v('elle annonce les réglages de ce navigateur', /réglages de ce navigateur/.test(dit), true);
v('elle annonce les pages gardées hors ligne', /hors ligne/.test(dit), true);
v('elle annonce les instantanés', /instantanés/.test(dit), true);
v('elle annonce les clés du coffre', /clés de votre coffre/.test(dit), true);

await repondreALaBoite(page, 'Tout effacer', { delai: 30000 });
await page.waitForFunction(
  () => !document.getElementById('message-effacement-total')?.classList.contains('hidden'),
  undefined,
  { timeout: 30000 },
);
console.log(
  `      message : ${((await page.locator('#message-effacement-total').textContent()) ?? '').trim()}`,
);

/* ── Les quatre endroits sont vides, et seulement eux ─────────────────── */

console.log('\nLES QUATRE ENDROITS SONT VIDES, ET SEULEMENT EUX');

const apres = await relever();
console.log(`      locales : ${apres.locales.join(', ') || '(aucune)'}`);
console.log(`      caches  : ${apres.caches.join(', ') || '(aucun)'}`);
console.log(`      bases   : ${apres.bases.join(', ') || '(aucune)'}`);

v('aucun réglage de ce site ne survit',
  apres.locales.filter((c) => c.startsWith('revinsp') || c.startsWith('cyclades')),
  []);
v('aucune clé de session de ce site ne survit',
  apres.session.filter((c) => c.startsWith('revinsp') || c.startsWith('cyclades')),
  []);
v('aucun cache de ce site ne survit',
  apres.caches.filter((c) => c.startsWith('cyclades-')),
  []);
v('les deux bases annexes sont parties',
  apres.bases.filter((b) => b === 'revinsp-instantanes' || b === 'cyclades-cles'),
  []);

console.log('\nET CE QUI N’EST PAS À NOUS EST INTACT');
v('le réglage étranger est intact', apres.locales.includes('autre-site.reglage'), true);
v('le cache étranger est intact', apres.caches.includes('autre-cache'), true);
v('la base étrangère est intacte', apres.bases.includes('autre-base'), true);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
process.exit(echecs === 0 ? 0 : 1);
