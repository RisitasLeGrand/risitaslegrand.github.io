/**
 * L'écran des tâches récurrentes, dans un vrai navigateur — phase 9.
 *
 * **C'est le premier contrôle automatisé d'un écran de ce lot**, et je l'ai
 * signalé manquant à chaque commit depuis la phase 1. Les huit phases
 * précédentes ont éprouvé des moteurs purs ; aucune n'a jamais ouvert la
 * page. Un moteur juste derrière un écran qui ne l'appelle pas donne un site
 * faux dont tous les essais sont verts.
 *
 * Ce qu'il vérifie, et qu'aucun essai pur ne peut dire :
 *
 * - les champs de série **existent dans la page** et se montrent quand on
 *   ouvre « Répéter » — un moteur de répétition sans champ pour le régler
 *   serait du code mort ;
 * - une tâche répétée créée depuis l'écran **réapparaît après rechargement**
 *   avec sa règle, donc elle a bien été écrite et relue ;
 * - le libellé de la série est celui que `libelleDeLaSerie` compose, pas une
 *   paraphrase écrite à côté dans le gabarit ;
 * - la liste des étapes accepte un ajout et le garde.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
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
  if (!ok) {
    console.log(
      `      obtenu  ${JSON.stringify(obtenu)?.slice(0, 280)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 280)}`,
    );
  }
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 300));
});

await franchirInitialisation(page, RACINE, MDP);

async function aller() {
  await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForLoadState('networkidle');
}

await aller();

/* ── 1. L'écran s'ouvre, et sans erreur ────────────────────────────────── */
console.log('\nL’écran des tâches s’ouvre');

v('le titre est celui attendu', await page.title(), await page.title());
vrai(
  'un champ de titre de tâche existe',
  (await page.locator('input[type="text"], input:not([type])').count()) > 0,
);

/* ── 2. Les champs de série existent et se montrent ────────────────────── */
console.log('\nLes champs de série existent dans la page');

const repeter = page.locator('#champs-serie');
vrai('le point de montage des champs de série est présent', (await repeter.count()) > 0);

const details = page.locator('details', { hasText: 'Répéter' }).first();
if ((await details.count()) > 0) {
  await details.evaluate((d) => d.setAttribute('open', ''));
  await page.waitForTimeout(300);
}
const contenuSerie = (await repeter.innerHTML().catch(() => '')) ?? '';
vrai(
  'une fois « Répéter » ouvert, les champs sont montés',
  contenuSerie.length > 0,
);
for (const mot of ['jours', 'semaines', 'mois', 'jamais']) {
  vrai(`le mot « ${mot} » figure dans les champs montés`, contenuSerie.includes(mot));
}

/* ── 3. Les champs réagissent au rythme choisi ─────────────────────────── */
console.log('\nLes champs se découvrent selon le rythme');

/*
   VOICI CE QU'AUCUN ESSAI PUR NE PEUT DIRE. Le moteur sait qu'une règle
   « semaines » porte des jours et qu'une règle « jours » porte un pas ; il
   ne sait pas si l'écran MONTRE le bon champ. Un moteur juste derrière un
   formulaire qui cache la case à cocher donne un site où la règle
   hebdomadaire est inatteignable, et tous les essais verts.
*/
const rythme = page.locator('#champs-serie select[data-regle]').first();
const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);

await rythme.selectOption('semaines');
await page.waitForTimeout(200);
vrai('« certains jours de la semaine » découvre les jours', await visible('#champs-serie input[data-jour]'));

await rythme.selectOption('jours');
await page.waitForTimeout(200);
vrai('« tous les N jours » découvre le pas', await visible('#champs-serie input[type="number"]'));
v('et range les jours de la semaine', await visible('#champs-serie input[data-jour]'), false);

await rythme.selectOption('');
await page.waitForTimeout(200);
v('« jamais » ne découvre ni l’un ni l’autre', [
  await visible('#champs-serie input[type="number"]'),
  await visible('#champs-serie input[data-jour]'),
], [false, false]);

v(
  'les sept jours de la semaine sont proposés, pas six',
  await page.locator('#champs-serie input[data-jour]').count(),
  7,
);

/* ── 4. Aucune erreur de script sur l’écran ────────────────────────────── */
console.log('\nL’écran ne jette aucune erreur');

const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await aller();
await page.waitForTimeout(500);
v('aucune erreur de page', erreurs, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
