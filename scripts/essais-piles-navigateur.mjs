/**
 * Les piles par onglet, dans un vrai navigateur, à la largeur d'un téléphone.
 *
 * Le raisonnement est éprouvé ailleurs, sans navigateur
 * (`essais-piles.mts`). Ce qui se mesure ici est ce que ce fichier-là ne peut
 * pas voir : le branchement sur la barre du bas, le stockage, et le fait que
 * les deux gestes atterrissent où ils disent.
 *
 * On travaille dans **une seule branche**, et c'est une correction : la barre
 * du bas porte les onglets de la branche courante, pas les trois branches.
 * Un essai qui aurait tapé « Sport » depuis Odyssée aurait cherché un bouton
 * qui n'est pas là.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const BASE = 'http://localhost:4321';
const MDP = process.env.SITE_PASSWORD;
if (!MDP) {
  console.error('SITE_PASSWORD manquant.');
  process.exit(1);
}

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

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM });
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

const chemin = () => new URL(page.url()).pathname;
const appuyer = async (racine) => {
  await page.click(`#barre-du-bas a[data-onglet="${racine}"]`);
  await page.waitForTimeout(1200);
};

console.log('\nLA PRÉMISSE : LA BARRE DU BAS EXISTE ET PORTE SES ONGLETS');

await page.goto(`${BASE}/odyssee/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
verifier(
  'la barre du bas est visible à 390 px',
  await page.evaluate(() => {
    const b = document.getElementById('barre-du-bas');
    return Boolean(b) && b.getBoundingClientRect().height > 0;
  }),
  true,
);
const onglets = await page.evaluate(() =>
  [...document.querySelectorAll('#barre-du-bas a[data-onglet]')].map((a) => a.dataset.onglet),
);
console.log(`      onglets de la barre : ${onglets.join(', ')}`);
verifier('ils portent bien leur racine, pas leur identifiant', onglets.includes('/odyssee/'), true);

console.log('\nUN ONGLET REPREND LÀ OÙ ON L’A LAISSÉ');

await page.goto(`${BASE}/odyssee/bibliographie/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
verifier('prémisse : on est bien dans une page profonde', chemin(), '/odyssee/bibliographie/');

/* On quitte l'onglet « accueil » pour un autre onglet de la même branche. */
await appuyer('/odyssee/calendrier/');
verifier('prémisse : on a bien changé d’onglet', chemin(), '/odyssee/calendrier/');

await appuyer('/odyssee/');
verifier(
  'l’onglet « accueil » rouvre sur la page profonde, pas sur sa racine',
  chemin(),
  '/odyssee/bibliographie/',
);

console.log('\nET LE SECOND APPUI REMONTE À LA RACINE');

await appuyer('/odyssee/');
verifier('un second appui remonte', chemin(), '/odyssee/');

await appuyer('/odyssee/');
verifier('un troisième ne fait rien, et ne recharge pas', chemin(), '/odyssee/');

console.log('\nLA PILE EST PROPRE À L’ONGLET DU NAVIGATEUR');

const neuf = await ctx.newPage();
await neuf.goto(`${BASE}/odyssee/calendrier/`, { waitUntil: 'networkidle' });
await neuf.waitForTimeout(900);
await neuf.click('#barre-du-bas a[data-onglet="/odyssee/"]');
await neuf.waitForTimeout(1200);
verifier(
  'un onglet neuf du navigateur part d’une pile vide',
  new URL(neuf.url()).pathname,
  '/odyssee/',
);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
