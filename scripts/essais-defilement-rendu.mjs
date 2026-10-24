/**
 * M5 — la position de défilement est rendue au retour sur une liste.
 *
 *   npm run essais:defilement-rendu
 *
 * ## Le défaut visé, mesuré le 18 octobre à 360 × 740
 *
 *     liste               descendu   revenu
 *     /bibliotheque/         900       900     rendue
 *     /actualites/           900         0     PERDUE
 *     /quiz/                 900         0     PERDUE
 *     /progression/          900         0     PERDUE
 *     /statistiques/         900         0     PERDUE
 *
 * Le navigateur restaure très bien, mais au moment où il rend la page —
 * avant que le script ait reconstruit la liste. Le document ne fait alors
 * que quelques centaines de pixels, la position demandée est hors bornes, et
 * elle est rabattue à zéro. `/bibliotheque/` s'en sortait parce qu'elle garde
 * une ossature de la bonne hauteur.
 *
 * ## Pourquoi l'ouverture se fait par une navigation et non par un clic
 *
 * La décision 1 du prompt 34 pose des transitions en CSS seul, sans routeur
 * client : un clic sur un lien est une navigation de document ordinaire,
 * exactement ce que fait `goto`. Une première version cliquait, et passait
 * son temps à tomber sur des cartes où le lien n'est pas l'élément au point
 * du milieu — des pannes de banc qui ne disaient rien du défaut visé.
 *
 * ## Et les listes sans lien sortant
 *
 * Trois en ont aucun (`/glossaire/`, `/sport/exercices/`, `/journal/`). Le
 * geste reste le même — on quitte, on revient —, on passe donc par un écran
 * de repli. Les déclarer « non mesurées » aurait laissé trois listes sans
 * garde-fou pour une raison qui n'en est pas une.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const DESCENTE = 900;
/** Quelques pixels de jeu : l'arrondi, et la dernière ligne qui s'ajoute. */
const TOLERANCE = 80;
const REPLI = '/progression/';

const LISTES = [
  '/bibliotheque/',
  '/actualites/',
  '/glossaire/',
  '/quiz/',
  '/sport/exercices/',
  '/progression/',
  '/journal/',
  '/statistiques/',
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
const contexte = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
}
await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
verifier(
  'la prémisse — le coffre est ouvert, les listes sont pleines',
  await page.evaluate(() => !document.getElementById('temoin-coffre')?.classList.contains('hidden')),
  true,
);

const perdues = [];
const courtes = [];
console.log('\n  LISTE                 hauteur  descendu  revenu');
for (const route of LISTES) {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
  // Une liste qui tient dans l'écran n'a pas de position à rendre : la
  // mesurer renverrait toujours zéro, et zéro égale zéro prouve zéro.
  if (hauteur < DESCENTE + 740) {
    courtes.push(`${route} (${hauteur} px)`);
    continue;
  }
  await page.evaluate((y) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
  }, DESCENTE);
  await page.waitForTimeout(400);
  const descendu = await page.evaluate(() => Math.round(window.scrollY));
  const vers =
    (await page.evaluate(() => {
      for (const a of document.querySelectorAll('#contenu-principal a[href]')) {
        const u = new URL(a.href, location.href);
        if (u.origin !== location.origin || u.pathname === location.pathname) continue;
        if (a.getBoundingClientRect().height < 10) continue;
        return u.pathname + u.search;
      }
      return null;
    })) ?? REPLI;
  await page.goto(`${RACINE}${vers}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.goBack({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const revenu = await page.evaluate(() => Math.round(window.scrollY));
  const ok = Math.abs(revenu - descendu) <= TOLERANCE;
  console.log(
    `  ${ok ? ' ' : '\x1b[31m!\x1b[0m'} ${route.padEnd(20)} ${String(hauteur).padStart(7)}  ` +
      `${String(descendu).padStart(8)}  ${String(revenu).padStart(6)}`,
  );
  if (!ok) perdues.push(`${route} : ${descendu} → ${revenu}`);
}
console.log('');

// Un essai qui parcourt zéro élément ne prouve rien.
verifier('au moins cinq listes étaient assez longues pour être mesurées', LISTES.length - courtes.length >= 5, true);
if (courtes.length) console.log(`    trop courtes, non mesurées : ${courtes.join(', ')}`);
verifier('M5c — la position est rendue au retour sur chaque liste', perdues, []);

await contexte.close();
await nav.close();
process.exit(rouges === 0 ? 0 : 1);
