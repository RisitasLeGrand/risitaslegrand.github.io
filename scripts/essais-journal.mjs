/**
 * Le journal d'erreurs, par l'interface réelle.
 *
 * Ce qui est vérifié ici est la **règle de sortie**, parce que c'est elle qui
 * fait tout le travail et qu'une erreur y serait invisible : l'entrée
 * disparaîtrait simplement un peu trop tôt, et le point faible avec elle.
 *
 * Le parcours passe par une flashcard : c'est le seul item dont la reprise
 * offre un bouton déterministe (« Je savais »), là où un QCM demanderait de
 * connaître la bonne option avant de cliquer.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { annonceDe, attendreEnBase, devientVisible } from './lib/post-condition.mjs';

const MDP = motDePasseEssais();

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext({ viewport: { width: 1100, height: 950 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

let echecs = 0;
const v = (t, o, a) => {
  const ok = JSON.stringify(o) === JSON.stringify(a);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${t}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(o)}, attendu ${JSON.stringify(a)}`);
};

const journal = () =>
  page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    return await new Promise((ok) => {
      const r = base.transaction('journal').objectStore('journal').getAll();
      r.onsuccess = () => ok(r.result);
    });
  });

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    /* Le départ du champ est le témoin du déverrouillage, et c'est un changement. */
    await devientVisible(page, '#champ-mdp', false, { delai: 30000 });
  }
};

// Base propre.
await page.goto('http://localhost:4321/robots.txt');
await page.evaluate(
  () => new Promise((ok) => {
    const r = indexedDB.deleteDatabase('revinsp');
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  }),
);

console.log('\nUNE CARTE OUBLIÉE OUVRE UNE ENTRÉE');
await page.goto('http://localhost:4321/flashcards', { waitUntil: 'networkidle' });
await connecter();
/*
   CHAQUE ATTENTE DEVANT UN CLIC EST LE BOUTON LUI-MÊME. Quatre
   temporisations se suivaient ici, et chacune précédait un geste sur un
   élément qui n'existait pas encore. Les attendre un par un n'est pas plus
   long : c'est plus court, puisque chacune rend la main dès que son bouton
   est là au lieu d'épuiser son pari.

   Et un `click()` de Playwright attend déjà l'élément. Ce que ces attentes
   couvraient réellement, c'est le cas où il n'arrive JAMAIS : sans elles,
   le clic expirait sur son propre délai en disant « locator timeout », loin
   de l'assertion qui aurait dû accuser. Les rendre explicites fait accuser
   l'étape, pas le clic.
*/
const demarrer = page.getByRole('button', { name: /Commencer|Démarrer|Réviser/i }).first();
await demarrer.waitFor({ state: 'visible', timeout: 30000 });
await demarrer.click();
const carte = page.locator('#carte, #zone-question').first();
await carte.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
await carte.click().catch(() => {});
const oublie = page.getByRole('button', { name: /^Oublié/ }).first();
await oublie.waitFor({ state: 'visible', timeout: 30000 });
await oublie.click();
/*
   LA DERNIÈRE N'EST PAS UN BOUTON MAIS UNE ÉCRITURE EN BASE : c'est le
   magasin `journal` que les quatre assertions lisent, et non l'écran. On
   attend donc l'entrée, là où elle arrive.
*/
await attendreEnBase(page, 'journal', (tout) => tout.length === 1, { delai: 30000 });

let entrees = await journal();
v('une entrée est ouverte', entrees.length, 1);
v('elle vient d’une flashcard', entrees[0]?.genre, 'flashcard');
v('aucune reprise acquise', entrees[0]?.reussites, 0);
v('elle n’est pas refermée', entrees[0]?.fermeeLe, undefined);
const cible = entrees[0]?.id;

console.log('\nLA PAGE DU JOURNAL LA MONTRE');
await page.goto('http://localhost:4321/journal', { waitUntil: 'networkidle' });
await connecter();
/*
   Deux faits, deux attentes : le total s'écrit, et le bouton de reprise
   paraît. Ce sont les deux assertions qui suivent, et rien ne garantit
   qu'ils arrivent ensemble.
*/
await annonceDe(page, '#total', { delai: 30000 });
await devientVisible(page, '#reviser', true, { delai: 30000 });
v('le total annonce une entrée', (await page.locator('#total').textContent())?.includes('1'), true);
v('le bouton de reprise est offert', await page.locator('#reviser').isVisible(), true);

// Chaque clic sur « Reprendre maintenant » ouvre une session distincte : c'est
// ce que la règle de sortie exige entre deux réussites.
const reprendreUneFois = async (verdict = 'Je savais') => {
  /*
     ON RELÈVE L'ÉTAT AVANT LE VERDICT, parce que l'appelant lit la base
     juste après et qu'on ne sait pas ici ce qu'il attend : selon le verdict,
     `reussites` monte, ou retombe à zéro et `erreurs` monte. Ce qui est
     commun aux deux, c'est que l'entrée CHANGE — et c'est cela qu'on attend.

     Nommer une valeur précise ici obligerait chaque appelant à la passer, et
     une aide qui réclame la réponse pour pouvoir l'attendre ne sert à rien.
  */
  await devientVisible(page, '#reviser', true, { delai: 30000 });
  await page.locator('#reviser').click();
  const reponse = page.getByRole('button', { name: /Voir la réponse/ });
  await reponse.waitFor({ state: 'visible', timeout: 30000 });
  const avant = JSON.stringify(await journal());
  await reponse.click();
  const bouton = page.getByRole('button', { name: new RegExp(`^${verdict}$`) });
  await bouton.waitFor({ state: 'visible', timeout: 30000 });
  await bouton.click();
  await attendreEnBase(page, 'journal', (tout) => JSON.stringify(tout) !== avant, { delai: 30000 });
};

console.log('\nPREMIÈRE REPRISE RÉUSSIE — L’ENTRÉE RESTE OUVERTE');
await reprendreUneFois();
entrees = await journal();
v('une reprise est acquise', entrees[0]?.reussites, 1);
v('mais l’entrée reste ouverte', entrees[0]?.fermeeLe, undefined);
v('une seule réussite ne suffit pas', Boolean(entrees[0]?.fermeeLe), false);

console.log('\nUNE REPRISE MANQUÉE REMET LE COMPTEUR À ZÉRO');
// C'est le chemin qui compte : une entrée déjà créditée d'une reprise et qu'on
// manque doit repartir de zéro, sans quoi une réussite ancienne et une réussite
// tardive suffiraient à la refermer — exactement ce que la règle refuse.
await page.reload({ waitUntil: 'networkidle' });
/* `reprendreUneFois` attend désormais son bouton elle-même : rien à faire ici. */
await reprendreUneFois('Je ne savais pas');
entrees = await journal();
v('le compteur est revenu à zéro', entrees[0]?.reussites, 0);
v('les erreurs sont cumulées', entrees[0]?.erreurs, 2);
v('l’entrée est toujours ouverte', entrees[0]?.fermeeLe, undefined);

console.log('\nDEUX REPRISES RÉUSSIES DANS DES SESSIONS DISTINCTES — ELLE SE REFERME');
await reprendreUneFois();
entrees = await journal();
v('une reprise acquise', entrees[0]?.reussites, 1);
v('toujours ouverte', entrees[0]?.fermeeLe, undefined);
await reprendreUneFois();
entrees = await journal();
v('deux reprises acquises', entrees[0]?.reussites, 2);
v('l’entrée est refermée', typeof entrees[0]?.fermeeLe, 'string');
v('l’identifiant est bien celui d’origine', entrees[0]?.id, cible);

await page.reload({ waitUntil: 'networkidle' });
/*
   LE COMPLÉMENT POSITIF D'UNE ASSERTION NÉGATIVE. La seconde assertion
   attend que `#reviser` NE SOIT PLUS là ; prise seule, elle serait vraie
   avant même que la page ait fini de se peindre. Mais le bouton ÉTAIT
   visible juste avant ce rechargement : son départ est donc un changement
   réel, et c'est lui qu'on attend.

   Le total, lui, passe de « 1 » à « Aucune » : on l'attend aussi, pour que
   la première assertion ne lise pas l'ancien texte.
*/
await devientVisible(page, '#reviser', false, { delai: 30000 });
await page.waitForFunction(
  () => /Aucune/.test(document.getElementById('total')?.textContent ?? ''),
  undefined,
  { timeout: 30000 },
);
v('le journal est vide', (await page.locator('#total').textContent())?.includes('Aucune'), true);
v('plus de bouton de reprise', await page.locator('#reviser').isVisible(), false);

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
process.exit(echecs ? 1 : 0);
