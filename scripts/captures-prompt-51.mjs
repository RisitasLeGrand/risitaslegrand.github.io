/**
 * Les captures du prompt 51 — Entraînement cognitif après le lot.
 *
 *   SITE_PASSWORD=… npm run captures:51
 *
 * Elles vont dans « audit/captures/prompt-51/ », hors du dépôt : une capture
 * montre l'état d'une base, et cette base ne sort pas de la machine.
 *
 * ## Ce que ces captures sont, et ce qu'elles ne sont pas
 *
 * Ce sont les captures d'APRÈS. Celles d'avant n'ont pas été prises au début du
 * lot et l'état d'avant n'existe plus : il manque donc la moitié de ce que le
 * § 4 demande, et le compte rendu le dit sans l'arranger.
 *
 * ## Les écrans retenus
 *
 * Ceux que l'audit cite, et seulement eux : l'accueil de la branche, les trois
 * écrans de réglages — où vivent le résumé, « Essayer d'abord » et le
 * glossaire —, et le glossaire ouvert sur une entrée, qui est le seul endroit
 * où P9 se voit.
 *
 * Aux trois tailles du 41 et dans les deux modes d'Égée.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const DOSSIER = 'audit/captures/prompt-51';

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
  { nom: 'accueil', route: '' },
  { nom: 'memoire', route: 'quad-n-back/' },
  { nom: 'raisonnement', route: 'relational-reasoning/' },
  { nom: 'correspondance', route: 'veridical-mapping/' },
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
    page.on('pageerror', (e) =>
      anomalies.push(`${taille.nom}/${mode.nom} : ${e.message.slice(0, 160)}`),
    );

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

    await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
    await deverrouiller();
    await franchirInitialisation(page, RACINE, MDP);

    for (const ecran of ECRANS) {
      await page.goto(`${RACINE}/cog-training/${ecran.route}`, { waitUntil: 'networkidle' });
      await deverrouiller();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `${DOSSIER}/${ecran.nom}-${taille.nom}-${mode.nom}.png`,
        fullPage: true,
      });
      faites += 1;

      /*
         Un contrôle au passage, qui vaut mieux qu'un œil sur vingt-quatre
         images : la page ne doit pas déborder en largeur. C'est ainsi que le
         débordement de la barre de jeu s'est fait prendre.
      */
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (debord > 1) {
        anomalies.push(`${ecran.nom} ${taille.nom}/${mode.nom} : débordement de ${debord} px`);
      }
    }

    /* Le glossaire ouvert sur une entrée : le seul endroit où P9 se voit. */
    await page.goto(`${RACINE}/cog-training/veridical-mapping/`, { waitUntil: 'networkidle' });
    await deverrouiller();
    const terme = page.locator('button[data-terme]').first();
    if (await terme.count()) {
      await terme.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${DOSSIER}/glossaire-ouvert-${taille.nom}-${mode.nom}.png`,
        fullPage: true,
      });
      faites += 1;
    } else {
      anomalies.push(`${taille.nom}/${mode.nom} : aucun terme cliquable à capturer`);
    }

    await contexte.close();
  }
}

await nav.close();

console.log(`\n${faites} captures dans « ${DOSSIER} » (hors du dépôt).`);
if (anomalies.length) {
  console.log(`\n\x1b[31m${anomalies.length} anomalies :\x1b[0m`);
  for (const a of anomalies) console.log(`  · ${a}`);
  process.exit(1);
}
console.log('\x1b[32mAucune anomalie : aucun débordement, aucune erreur de page.\x1b[0m\n');
