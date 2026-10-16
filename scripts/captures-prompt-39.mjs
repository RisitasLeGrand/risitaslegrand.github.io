/**
 * Les captures du prompt 39 — données synthétiques seulement.
 *
 *   npm run captures:39
 *
 * Elles vont dans « audit/captures/prompt-39/ », hors du dépôt public :
 * une capture montre l'état d'une base, et cette base ne sort pas de la
 * machine.
 *
 * Les données sont semées **par les écrans eux-mêmes** — le formulaire des
 * tâches, le bouton de pointage —, jamais par une écriture détournée en
 * base. Une capture d'un état que l'application ne sait pas produire ne
 * prouverait rien.
 *
 * Quatre écrans, aux deux largeurs demandées : 390 × 844 et 1280 × 800.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const DOSSIER = 'audit/captures/prompt-39';
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

const faites = [];

const ouvrir = async (page, route) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
  await page.waitForTimeout(900);
};

/** Sème deux tâches répétées, par le formulaire, et en pointe une. */
async function semer(page) {
  const ajouter = async (titre) => {
    await page
      .locator('details', { hasText: 'Répéter' })
      .first()
      .evaluate((d) => d.setAttribute('open', ''));
    await page.fill('#titre', titre);
    await page.selectOption('#champs-serie select[data-regle]', 'jours');
    await page.locator('#champs-serie input[type="number"]').first().fill('1');
    await page.fill('#echeance', AUJOURDHUI);
    await page.click('#ajouter');
    await page.waitForTimeout(800);
  };
  await ouvrir(page, '/odyssee/taches/');
  await ajouter('Trente minutes de lecture');
  await ajouter('Marche du matin');

  /* Une seule pointée : une capture où tout est fait ne montre pas l'écart. */
  const premier = page.locator('[data-faire]').first();
  if (await premier.count()) {
    await premier.click();
    await page.waitForTimeout(900);
  }
}

for (const [nom, taille] of [
  ['390', { width: 390, height: 844 }],
  ['1280', { width: 1280, height: 800 }],
]) {
  const contexte = await nav.newContext({ viewport: taille, deviceScaleFactor: 2 });
  const page = await contexte.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await semer(page);

  const prendre = async (suffixe) => {
    const fichier = `${DOSSIER}/${suffixe}-${nom}.png`;
    await page.screenshot({ path: fichier, fullPage: true });
    faites.push(fichier);
    console.log(`  ✓ ${fichier}`);
  };

  await ouvrir(page, '/odyssee/taches/');
  await prendre('taches');

  await ouvrir(page, '/odyssee/calendrier/');
  await page.locator('[data-vue="jour"]').click();
  await page.waitForTimeout(800);
  await prendre('calendrier-jour');

  await page.locator('[data-vue="mois"]').click();
  await page.waitForTimeout(900);
  await prendre('calendrier-mois');

  await ouvrir(page, '/odyssee/');
  await prendre('tableau-de-bord');

  await ouvrir(page, '/odyssee/revue/');
  await prendre('revue');

  await contexte.close();
}

await nav.close();
console.log(`\n${faites.length} capture(s) dans ${DOSSIER}/\n`);
