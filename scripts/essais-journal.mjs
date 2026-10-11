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

const MDP = motDePasseEssais();

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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
    await page.waitForTimeout(3000);
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
await page.waitForTimeout(1500);
const demarrer = page.getByRole('button', { name: /Commencer|Démarrer|Réviser/i }).first();
await demarrer.click();
await page.waitForTimeout(1200);
await page.locator('#carte, #zone-question').first().click().catch(() => {});
await page.waitForTimeout(600);
await page.getByRole('button', { name: /^Oublié/ }).first().click();
await page.waitForTimeout(1500);

let entrees = await journal();
v('une entrée est ouverte', entrees.length, 1);
v('elle vient d’une flashcard', entrees[0]?.genre, 'flashcard');
v('aucune reprise acquise', entrees[0]?.reussites, 0);
v('elle n’est pas refermée', entrees[0]?.fermeeLe, undefined);
const cible = entrees[0]?.id;

console.log('\nLA PAGE DU JOURNAL LA MONTRE');
await page.goto('http://localhost:4321/journal', { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2000);
v('le total annonce une entrée', (await page.locator('#total').textContent())?.includes('1'), true);
v('le bouton de reprise est offert', await page.locator('#reviser').isVisible(), true);

// Chaque clic sur « Reprendre maintenant » ouvre une session distincte : c'est
// ce que la règle de sortie exige entre deux réussites.
const reprendreUneFois = async (verdict = 'Je savais') => {
  await page.locator('#reviser').click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Voir la réponse/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: new RegExp(`^${verdict}$`) }).click();
  await page.waitForTimeout(1500);
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
await page.waitForTimeout(2000);
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
await page.waitForTimeout(2000);
v('le journal est vide', (await page.locator('#total').textContent())?.includes('Aucune'), true);
v('plus de bouton de reprise', await page.locator('#reviser').isVisible(), false);

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
process.exit(echecs ? 1 : 0);
