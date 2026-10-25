/**
 * Les captures du prompt 43, lot I — le compteur de visites.
 *
 *   SITE_PASSWORD=… node scripts/captures-prompt-43-i.mjs <avant|apres>
 *
 * Un seul écran change dans ce lot : « Statistiques », qui reçoit la section
 * du compteur. Les captures vont dans « audit/captures/prompt-43-i/ », hors
 * du dépôt.
 *
 * Deux états sont pris, parce que l'écran en a deux et qu'ils ne disent pas la
 * même chose : **coffre fermé**, où le compteur ne peut rien montrer, et
 * **coffre ouvert**, où il montre ce qu'il a compté.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MOMENT = process.argv[2] ?? 'avant';
if (!['avant', 'apres'].includes(MOMENT)) {
  console.error('Usage : node scripts/captures-prompt-43-i.mjs <avant|apres>');
  process.exit(2);
}

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const DOSSIER = `audit/captures/prompt-43-i/${MOMENT}`;

const TAILLES = [
  { nom: '360', viewport: { width: 360, height: 740 }, tactile: true },
  { nom: '390', viewport: { width: 390, height: 844 }, tactile: true },
  { nom: '1280', viewport: { width: 1280, height: 900 }, tactile: false },
];
const MODES = [
  { nom: 'clair', heures: '00:00|23:59' },
  { nom: 'sombre', heures: '03:00|03:01' },
];

mkdirSync(DOSSIER, { recursive: true });

const nav = await chromium.launch({ executablePath: cheminDuNavigateur(), args: ['--no-sandbox'] });
let faites = 0;
const anomalies = [];

for (const taille of TAILLES) {
  for (const mode of MODES) {
    const contexte = await nav.newContext({
      viewport: taille.viewport,
      hasTouch: taille.tactile,
      isMobile: taille.tactile,
      deviceScaleFactor: 2,
    });
    const page = await contexte.newPage();
    const ou = `${taille.nom}/${mode.nom}`;
    page.on('pageerror', (e) => anomalies.push(`${ou} : ${e.message.slice(0, 160)}`));
    await page.addInitScript((heures) => {
      try {
        localStorage.setItem('revinsp.palette', 'egee');
        localStorage.setItem('revinsp.bascule-jour-nuit', 'oui');
        localStorage.setItem('revinsp.heures-bascule', heures);
        localStorage.setItem('revinsp.animations', 'reduites');
      } catch {
        /* navigation privée */
      }
    }, mode.heures);

    const deverrouiller = async () => {
      if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
        await page.fill('#champ-mdp', MDP);
        await page.click('#bouton-verrou');
        await page.waitForLoadState('networkidle');
      }
    };
    const aller = async (route) => {
      await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
      await deverrouiller();
      await page.waitForTimeout(700);
    };
    const prendre = async (nom) => {
      await page.screenshot({ path: `${DOSSIER}/${nom}-${taille.nom}-${mode.nom}.png`, fullPage: true });
      faites += 1;
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (debord > 1) anomalies.push(`${nom} ${ou} : débordement de ${debord} px`);
    };

    await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
    await deverrouiller();
    await franchirInitialisation(page, RACINE, MDP);

    await aller('/statistiques/');
    await prendre('statistiques-coffre-ferme');

    /* Coffre ouvert : on passe par un écran qui l'offre, puis on revient. */
    await aller('/odyssee/corps/');
    const champ = page.locator('#mdp-coffre');
    if (await champ.isVisible().catch(() => false)) {
      await champ.fill(MDP);
      await page.locator('#ouvrir-coffre').click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    /* Quelques visites, pour que le compteur ait quelque chose à montrer. */
    for (const route of ['/revisions/', '/flashcards/', '/revisions/', '/glossaire/']) {
      await aller(route);
    }
    await aller('/statistiques/');
    await prendre('statistiques-coffre-ouvert');

    await contexte.close();
  }
}

await nav.close();
console.log(`\n${faites} captures « ${MOMENT} » dans « ${DOSSIER} » (hors du dépôt).`);
if (anomalies.length) {
  console.log(`\n\x1b[31m${anomalies.length} anomalies :\x1b[0m`);
  for (const a of anomalies) console.log(`  · ${a}`);
  process.exit(1);
}
console.log('\x1b[32mAucune anomalie : aucun débordement, aucune erreur de page.\x1b[0m\n');
