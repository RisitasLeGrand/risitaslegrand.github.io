/**
 * L'estimation de niveau, par l'interface réelle.
 *
 * Le calcul est éprouvé ailleurs (scripts/essais-niveau.mts) ; ce qui se vérifie
 * ici est le **raccord** : qu'une réponse donnée dans une page alimente bien les
 * trois granularités, que le seuil d'affichage tienne, et surtout que le réglage
 * de source coupe réellement l'alimentation — un réglage sans effet serait pire
 * que pas de réglage du tout.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';

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

const lire = (magasin) =>
  page.evaluate(async (nom) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    return await new Promise((ok) => {
      const r = base.transaction(nom).objectStore(nom).getAll();
      r.onsuccess = () => ok(r.result);
    });
  }, magasin);

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', 'EFN67');
    await page.click('#bouton-verrou');
    await page.waitForTimeout(3000);
  }
};

await page.goto('http://localhost:4321/robots.txt');
await page.evaluate(
  () => new Promise((ok) => {
    const r = indexedDB.deleteDatabase('revinsp');
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  }),
);

console.log('\nUN QUIZ ALIMENTE LES TROIS GRANULARITÉS');
await page.goto('http://localhost:4321/quiz/cours', { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2000);
// On fixe la matière : un tirage libre peut tomber sur le cas pratique ou sur
// une fiche de méthodologie, que l'estimation écarte volontairement — l'essai
// ne mesurerait alors plus rien, et échouerait sans qu'aucun défaut existe.
await page.waitForFunction(
  () => Boolean(document.querySelector('#quiz-matiere option[value="Économie"]')),
  null,
  { timeout: 30000 },
);
await page.selectOption('#quiz-matiere', 'Économie');
await page.waitForTimeout(800);
await page.locator('#lancer-quiz').click();
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i += 1) {
  const option = page.locator('#quiz-options button').first();
  if (!(await option.isVisible().catch(() => false))) break;
  await option.click();
  await page.waitForTimeout(700);
  const suivant = page.locator('#quiz-suivant');
  if (await suivant.isVisible().catch(() => false)) await suivant.click();
  await page.waitForTimeout(700);
}
let competences = await lire('competences');
const portees = new Set(competences.map((c) => c.portee));
v('les trois portées sont alimentées', [...portees].sort(), ['fascicule', 'fiche', 'matiere']);
v('des difficultés d’items sont estimées', (await lire('difficultes')).length > 0, true);
const matiere = competences.find((c) => c.portee === 'matiere');
v('la note a bougé depuis 1200', matiere.note !== 1200, true);
v('les observations sont comptées', matiere.observations > 0, true);

console.log('\nLE TABLEAU DE BORD RESTE PRUDENT');
await page.goto('http://localhost:4321/statistiques', { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2500);
const texte = await page.locator('#niveaux').textContent();
v('les matières sont listées', (await page.locator('#niveaux details').count()) > 0, true);
v(
  'aucun chiffre n’est annoncé sous le seuil',
  matiere.observations < 5 ? texte.includes('pas encore assez de données') : true,
  true,
);
v('une amorce est proposée', texte.includes('situez-vous'), true);

console.log('\nL’AMORCE SE POSE, PUIS S’EFFACE DEVANT LES OBSERVATIONS');
const avantAmorce = (await lire('competences')).filter((c) => c.calibree).length;
// Le détail d'une matière est replié par défaut : on l'ouvre, comme le ferait
// quelqu'un qui vient chercher son niveau sur une matière précise.
await page.evaluate(() => {
  for (const d of document.querySelectorAll('#niveaux details')) d.open = true;
});
await page.waitForTimeout(400);
await page.getByRole('button', { name: /^Je suis à l’aise$/ }).first().click();
await page.waitForTimeout(1200);
const calibrees = (await lire('competences')).filter((c) => c.calibree);
v('une amorce a été enregistrée', calibrees.length > avantAmorce, true);
v('elle ne compte aucune observation', calibrees[0]?.observations, 0);

console.log('\nLE RÉGLAGE DE SOURCE COUPE VRAIMENT L’ALIMENTATION');
await page.goto('http://localhost:4321/progression', { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2000);
const cases = page.locator('#sources input[type=checkbox]');
/*
 * Cinq, et non quatre : le prétest est devenu une source à part entière quand
 * la note d'entrée a été séparée du niveau acquis. L'essai comptait encore
 * quatre cases et échouait depuis.
 */
v('cinq sources proposées', await cases.count(), 5);
v('le QCM-DGFiP est décoché par défaut', await cases.nth(3).isChecked(), false);
await cases.nth(0).uncheck();
await page.waitForTimeout(800);

const avant = await lire('competences');
await page.goto('http://localhost:4321/quiz/cours', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.locator('#lancer-quiz').click();
await page.waitForTimeout(2500);
for (let i = 0; i < 4; i += 1) {
  const option = page.locator('#quiz-options button').first();
  if (!(await option.isVisible().catch(() => false))) break;
  await option.click();
  await page.waitForTimeout(700);
  const suivant = page.locator('#quiz-suivant');
  if (await suivant.isVisible().catch(() => false)) await suivant.click();
  await page.waitForTimeout(700);
}
const apres = await lire('competences');
const observationsAvant = avant.reduce((n, c) => n + c.observations, 0);
const observationsApres = apres.reduce((n, c) => n + c.observations, 0);
v('aucune observation nouvelle', observationsApres, observationsAvant);
v('les données déjà enregistrées sont conservées', apres.length >= avant.length, true);

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
process.exit(echecs ? 1 : 0);
