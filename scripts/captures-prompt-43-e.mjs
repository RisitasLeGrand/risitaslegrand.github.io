/**
 * Les captures du prompt 43, lot E — clavier, états annoncés, alternatives.
 *
 *   SITE_PASSWORD=… node scripts/captures-prompt-43-e.mjs <avant|apres>
 *
 * Elles vont dans « audit/captures/prompt-43-e/<avant|apres>/ », hors du
 * dépôt : une capture montre l'état d'une base, et cette base ne sort pas de
 * la machine.
 *
 * ## Les écrans retenus
 *
 * Ceux que les points du lot touchent, et seulement eux : les deux files
 * filtrables de « À rapprocher » (E7), les onglets des actualités (E7),
 * les cases « noter » de Psyché (E7), les réglages du Quad N-Back et leurs
 * curseurs (E9), la session de cartes (E5) et l'en-tête qui porte le
 * sélecteur de parcours (E6).
 *
 * ## Ce que ces captures ne montrent pas
 *
 * Rien de ce que le lot corrige ne se voit vraiment sur une image : un nom
 * accessible, un rôle, une touche qui agit au mauvais endroit n'ont pas
 * d'aspect. Les captures servent à constater qu'aucun ÉCRAN n'a bougé là où
 * le lot ne corrige que la façon dont il s'annonce — et le contrôle de
 * débordement, lui, mesure à chaque prise.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MOMENT = process.argv[2] ?? 'avant';
if (!['avant', 'apres'].includes(MOMENT)) {
  console.error('Usage : node scripts/captures-prompt-43-e.mjs <avant|apres>');
  process.exit(2);
}

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const DOSSIER = `audit/captures/prompt-43-e/${MOMENT}`;

const TAILLES = [
  { nom: '360', viewport: { width: 360, height: 740 }, tactile: true },
  { nom: '390', viewport: { width: 390, height: 844 }, tactile: true },
  { nom: '1280', viewport: { width: 1280, height: 900 }, tactile: false },
];

const MODES = [
  { nom: 'clair', heures: '00:00|23:59' },
  { nom: 'sombre', heures: '03:00|03:01' },
];

const ECRANS = [
  { nom: 'rapprocher', route: '/odyssee/rapprocher/' },
  { nom: 'actualites', route: '/actualites/' },
  { nom: 'psyche', route: '/odyssee/psyche/' },
  { nom: 'quad-n-back', route: '/cog-training/quad-n-back/' },
  { nom: 'entete-parcours', route: '/revisions/' },
];

mkdirSync(DOSSIER, { recursive: true });

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

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

    const prendre = async (nom) => {
      await page.screenshot({ path: `${DOSSIER}/${nom}-${taille.nom}-${mode.nom}.png`, fullPage: true });
      faites += 1;
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (debord > 1) anomalies.push(`${nom} ${ou} : débordement de ${debord} px`);
    };

    const aller = async (route) => {
      await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
      await deverrouiller();
      await page.waitForTimeout(600);
    };

    await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
    await deverrouiller();
    await franchirInitialisation(page, RACINE, MDP);

    for (const ecran of ECRANS) {
      await aller(ecran.route);
      await prendre(ecran.nom);
    }

    /* La session de cartes : les raccourcis et la carte elle-même (E5). */
    await aller('/flashcards/');
    const lancer = page.locator('#lancer');
    if (await lancer.isVisible().catch(() => false)) {
      await lancer.click().catch(() => {});
      await page.locator('#session:not(.hidden)').waitFor({ timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(500);
      await prendre('cartes-session');
    } else {
      anomalies.push(`${ou} : impossible de lancer une session de cartes`);
    }

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
