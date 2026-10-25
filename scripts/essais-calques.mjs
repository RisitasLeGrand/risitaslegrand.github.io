/**
 * Le retour arrière ferme le calque, et ne quitte pas la page (M5).
 *
 * ## Le défaut visé
 *
 * Sur un téléphone, le retour arrière est le premier réflexe pour refermer ce
 * qui vient de s'ouvrir. Il ne fermait rien : la feuille « Plus », le centre
 * de notifications et le menu du cadenas ne touchaient pas à l'historique, si
 * bien que le retour **quittait l'écran** avec le calque encore par-dessus.
 *
 * ## Les deux moitiés, et la seconde est celle qu'on oublie
 *
 * 1. Le retour referme le calque **et** laisse la page en place.
 * 2. Fermer par le bouton visible ne laisse **pas** d'entrée fantôme : le
 *    retour suivant doit quitter l'écran pour de bon, et non être avalé.
 *
 * Un essai qui ne mesure que la première laisse passer un historique qui
 * enfle à chaque ouverture — et c'est un défaut pire que celui qu'il corrige,
 * parce qu'il faut alors reculer trois fois pour sortir d'une page.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const BASE = 'http://localhost:4321';
const MDP = motDePasseEssais();

let echecs = 0;
const verifier = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
process.on('uncaughtException', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({ executablePath: cheminDuNavigateur() });
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

const chemin = () => new URL(page.url()).pathname;
const visible = (id) =>
  page.evaluate((i) => {
    const e = document.getElementById(i);
    if (!e) return false;
    if (e.hidden) return false;
    const r = e.getBoundingClientRect();
    return r.height > 0 && r.width > 0;
  }, id);

console.log('\nLA FEUILLE « PLUS » : LE RETOUR LA FERME, SANS QUITTER L’ÉCRAN');

/* Deux pages d'historique, pour que « quitter » ait un sens observable. */
await page.goto(`${BASE}/odyssee/`, { waitUntil: 'networkidle' });
await page.goto(`${BASE}/odyssee/calendrier/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
verifier('prémisse : on est sur le calendrier', chemin(), '/odyssee/calendrier/');

await page.click('#ouvrir-plus');
await page.waitForTimeout(500);
verifier('la feuille est ouverte', await visible('feuille-plus'), true);

await page.goBack();
await page.waitForTimeout(700);
verifier('le retour la referme', await visible('feuille-plus'), false);
verifier('et la page n’a pas bougé', chemin(), '/odyssee/calendrier/');

console.log('\nET FERMER PAR LE BOUTON NE LAISSE PAS D’ENTRÉE FANTÔME');

await page.click('#ouvrir-plus');
await page.waitForTimeout(500);
verifier('prémisse : la feuille est rouverte', await visible('feuille-plus'), true);
await page.click('#fermer-plus');
await page.waitForTimeout(700);
verifier('le bouton la referme', await visible('feuille-plus'), false);
verifier('la page n’a toujours pas bougé', chemin(), '/odyssee/calendrier/');

await page.goBack();
await page.waitForTimeout(900);
verifier(
  'le retour suivant quitte vraiment l’écran, il n’est pas avalé',
  chemin(),
  '/odyssee/',
);

console.log('\nLE CENTRE DE NOTIFICATIONS, MÊME RÈGLE');

await page.goto(`${BASE}/odyssee/calendrier/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.click('#centre-bouton');
await page.waitForTimeout(600);
verifier('le panneau est ouvert', await visible('centre-panneau'), true);
await page.goBack();
await page.waitForTimeout(700);
verifier('le retour le referme', await visible('centre-panneau'), false);
verifier('et la page reste', chemin(), '/odyssee/calendrier/');

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
