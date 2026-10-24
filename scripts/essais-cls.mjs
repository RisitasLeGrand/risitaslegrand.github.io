/**
 * M7 — la page ne saute pas sous le pouce.
 *
 *   npm run essais:cls
 *
 * ## Ce que ce contrôle garde
 *
 * Le seuil du prompt : **CLS sous 0,1 sur les écrans quotidiens**. Mesuré
 * le 18 octobre avant correction, il valait de 0,216 à 0,495 sur les neuf
 * écrans — une seule cause partout, le pied de page peint en plein écran
 * tant que le contenu n'est pas déchiffré, puis chassé de plus de mille
 * cinq cents pixels. La place est désormais réservée (`#contenu-principal`,
 * `min-block-size: 100svh`), et ce contrôle existe pour que personne ne la
 * retire sans s'en apercevoir.
 *
 * ## Pourquoi ce fichier n'est pas `mesure-vitesse`
 *
 * `mesure-vitesse` relève des chiffres et ne juge pas : c'est un banc, qu'on
 * lance avant et après un lot et dont le 40 héritera. Celui-ci tranche : il
 * passe ou il échoue, et il entre dans la batterie. Les deux liraient la
 * même grandeur ; les confondre ferait d'un relevé un verdict, et d'un
 * verdict un relevé.
 *
 * ## Le bridage, et ce qu'il change
 *
 * Processeur ralenti 4 fois, comme le prompt le demande : sans lui, le
 * déchiffrement finit avant la première peinture sur une machine de bureau,
 * et le défaut ne se produit pas. Un contrôle qui ne reproduit pas la
 * lenteur ne verrait jamais le saut qu'elle provoque.
 *
 * ## La marge de mesure
 *
 * Le calendrier a été relevé à 0,086 puis à 0 sur deux passes de la même
 * version : un décalage de 22 px de sa grille apparaît selon l'instant où
 * le mois se peint. Le chiffre n'est donc pas stable au millième, et le
 * contrôle compare au seuil, pas à une valeur de référence.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const SEUIL = 0.1;

const ECRANS = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/taches/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/flashcards/',
  '/revisions/',
  '/sport/seance/',
  '/sport/',
];

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

await page.addInitScript(`
  window.__cls = 0;
  window.__peint = false;
  new PerformanceObserver((liste) => {
    for (const e of liste.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver(() => { window.__peint = true; })
    .observe({ type: 'largest-contentful-paint', buffered: true });
`);

await franchirInitialisation(page, RACINE, MDP);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

console.log(`\nLA PAGE NE SAUTE PAS — CLS sous ${SEUIL}, processeur ÷ 4`);
for (const chemin of ECRANS) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(5000);
  const { cls, peint, pied } = await page.evaluate(() => {
    const f = document.querySelector('footer');
    return {
      cls: window.__cls,
      peint: window.__peint,
      pied: f ? Math.round(f.getBoundingClientRect().top) : null,
    };
  });
  /*
     La prémisse : si rien n'a été peint, l'absence de décalage ne prouve
     rien — une page blanche ne saute pas. Un contrôle qui confond le vide
     et la stabilité ne rapporte rien.
  */
  if (!peint) {
    console.log(`\x1b[31m✗\x1b[0m ${chemin} — rien n’a été peint : la mesure ne porterait sur rien`);
    rouges += 1;
    continue;
  }
  verifier(`${chemin} — CLS ${Math.round(cls * 1000) / 1000} sous ${SEUIL}`, cls < SEUIL, true);
  /*
     Et le revers du remède : la hauteur réservée doit vraiment repousser le
     pied hors de l'écran. S'il revenait dans les 740 px, le saut
     reviendrait avec lui, et ce contrôle passerait encore un temps par
     chance plutôt que par construction.
  */
  if (pied !== null && pied < 740) {
    console.log(
      `\x1b[31m✗\x1b[0m ${chemin} — le pied de page est à ${pied} px, dans l’écran : la hauteur réservée ne joue plus`,
    );
    rouges += 1;
  }
}

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
