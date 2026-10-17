/**
 * Le bandeau du coffre : masquable, et l'interdit 6 qui ne cède pas.
 *
 *   npm run essais:bandeau-coffre
 *
 * ## Ce qu'il garde
 *
 * Le bandeau ambre prend 57 px, mesurés, soit 7,7 % d'un écran de téléphone.
 * Alexis a demandé à pouvoir le fermer, pour la session puis « à perpétuelle
 * demeure ». La tentation est de masquer et de passer à autre chose — et
 * c'est exactement là que l'interdit 6 du prompt 35 tomberait : « Fermer le
 * coffre » doit rester atteignable **partout où le coffre est ouvert**.
 *
 * Le relevé du 14 octobre avait montré que six pages sous coffre sur dix
 * n'offraient aucun bouton de fermeture. On ne refait pas ce chemin à
 * l'envers : le balayage ci-dessous rouvre la question sur **toutes** les
 * routes, bandeau masqué.
 *
 * ## Ce qu'il mesure, et non ce qu'il lit
 *
 * Il ne cherche pas la règle dans le code : il masque le bandeau par le
 * geste réel, recharge, et regarde ce que l'écran offre.
 */
import { chromium } from 'playwright-core';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};

function routes() {
  const base = resolve(ICI, '..', 'src', 'pages');
  const out = [];
  const parcourir = (d, prefixe) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourir(c, `${prefixe}${e}/`);
      else if (e.endsWith('.astro')) {
        out.push(e === 'index.astro' ? prefixe : `${prefixe}${e.replace('.astro', '')}/`);
      }
    }
  };
  parcourir(base, '/');
  return out.sort();
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

const ouvrirLeCoffre = async () => {
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await page.waitForSelector('#temoin-coffre', { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(600);
};

await ouvrirLeCoffre();

/* ── La prémisse ───────────────────────────────────────────────────── */

verifier(
  'le bandeau est visible tant qu’on ne l’a pas masqué',
  await page.locator('#temoin-coffre').isVisible(),
  true,
);
verifier(
  'et le cadenas compact l’accompagne dès l’ouverture',
  await page.locator('#cadenas-coffre').isVisible(),
  true,
);

const hauteurAvant = await page.evaluate(
  () => Math.round(document.getElementById('entete-principal')?.getBoundingClientRect().height ?? 0),
);

/* ── « Masquer » : l’onglet, et pas au-delà ────────────────────────── */

await page.click('#temoin-coffre-masquer');
await page.waitForTimeout(300);
verifier('« Masquer » retire le bandeau', await page.locator('#temoin-coffre').isVisible(), false);
verifier(
  'mais pas le cadenas, qui porte le geste',
  await page.locator('#cadenas-coffre').isVisible(),
  true,
);

const hauteurApres = await page.evaluate(
  () => Math.round(document.getElementById('entete-principal')?.getBoundingClientRect().height ?? 0),
);
verifier(
  `l’en-tête rend la place du bandeau (${hauteurAvant} → ${hauteurApres} px)`,
  hauteurApres < hauteurAvant,
  true,
);

verifier(
  'rien n’est écrit dans le stockage durable pour un masquage de session',
  await page.evaluate(() => localStorage.getItem('cyclades.affichage.bandeau-coffre')),
  null,
);

/* ── L’interdit 6, sur TOUTES les routes, bandeau masqué ───────────── */

{
  const sans = [];
  for (const r of routes()) {
    await page.goto(`${RACINE}${r}`, { waitUntil: 'networkidle' }).catch(() => {});
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(250);
    const offert = await page.evaluate(() => {
      const zone = document.getElementById('cadenas-coffre');
      const visible = zone !== null && !zone.classList.contains('hidden');
      const fermer = document.getElementById('cadenas-fermer');
      return visible && fermer !== null;
    });
    if (!offert) sans.push(r);
  }
  verifier(
    'INTERDIT 6 — « Fermer le coffre » reste offert sur chaque route, bandeau masqué',
    sans,
    [],
  );
}

/* ── Le retour du bandeau à la réouverture ─────────────────────────── */

await page.evaluate(() => sessionStorage.clear());
await ouvrirLeCoffre();
verifier(
  'un masquage de session ne survit pas à la session',
  await page.locator('#temoin-coffre').isVisible(),
  true,
);

/* ── « Masquer indéfiniment » : il survit au rechargement ──────────── */

await page.click('#temoin-coffre-masquer-toujours');
await page.waitForTimeout(300);
verifier(
  'le réglage durable est écrit sur l’appareil',
  await page.evaluate(() => localStorage.getItem('cyclades.affichage.bandeau-coffre')),
  'masque',
);

await ouvrirLeCoffre();
verifier(
  'et le bandeau ne revient pas à la réouverture du coffre',
  await page.locator('#temoin-coffre').isVisible(),
  false,
);
verifier(
  'le cadenas, lui, est toujours là',
  await page.locator('#cadenas-coffre').isVisible(),
  true,
);

/* ── Le rétablissement, depuis le menu du cadenas ──────────────────── */

await page.click('#cadenas-coffre-bouton');
await page.waitForTimeout(200);
verifier(
  '« Afficher le bandeau » n’est proposé que lorsqu’il est masqué',
  await page.locator('#cadenas-afficher-bandeau').isVisible(),
  true,
);
await page.click('#cadenas-afficher-bandeau');
await page.waitForTimeout(300);
verifier('il revient aussitôt', await page.locator('#temoin-coffre').isVisible(), true);
verifier(
  'et le réglage durable est levé',
  await page.evaluate(() => localStorage.getItem('cyclades.affichage.bandeau-coffre')),
  null,
);

/* ── Le clavier ────────────────────────────────────────────────────── */

await page.click('#cadenas-coffre-bouton');
await page.waitForTimeout(200);
verifier(
  'le menu s’ouvre et le dit',
  await page.getAttribute('#cadenas-coffre-bouton', 'aria-expanded'),
  'true',
);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
verifier(
  'Échap le referme',
  await page.locator('#cadenas-coffre-menu').isVisible(),
  false,
);
verifier(
  'et rend le focus au cadenas plutôt qu’au corps de la page',
  await page.evaluate(() => document.activeElement?.id ?? ''),
  'cadenas-coffre-bouton',
);

/* ── Coffre fermé, le cadenas disparaît comme le bandeau ───────────── */

await page.click('#cadenas-coffre-bouton');
await page.waitForTimeout(200);
await page.click('#cadenas-fermer');
await page.waitForTimeout(600);
verifier(
  'coffre fermé, le cadenas s’efface',
  await page.locator('#cadenas-coffre').isVisible(),
  false,
);
verifier('et le bandeau aussi', await page.locator('#temoin-coffre').isVisible(), false);

await contexte.close();
await nav.close();
process.exit(rouges === 0 ? 0 : 1);
