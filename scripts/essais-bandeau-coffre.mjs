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
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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

/*
   Ce que « Masquer » rend, c'est la place AVANT LE CONTENU, et non la
   hauteur de l'en-tête.

   Depuis M5 (18 octobre), le bandeau est au-dessus de l'en-tête collant et
   non dedans : le masquer ne change plus la hauteur de l'en-tête, qui reste
   à 103 px. L'ancienne mesure comparait donc 103 à 103 et accusait à tort
   une correction qui a, en vrai, rendu 105 px d'écran — 48 de bandeau et 57
   de collant. On mesure maintenant d'où commence à lire le contenu, ce qui
   est la seule chose dont dépend qui lit.
*/
const placeAvantLeContenu = () =>
  page.evaluate(() => {
    const c = document.getElementById('contenu-principal') ?? document.querySelector('main');
    // `window.scrollY` et non un `scrollTo` : le défilement est animé
    // (`scroll-behavior: smooth`), et une mesure prise juste après rendait
    // la position d'avant — −3015 px au lieu de 148.
    return c ? Math.round(c.getBoundingClientRect().top + window.scrollY) : -1;
  });
const hauteurAvant = await placeAvantLeContenu();

/* ── « Masquer » : l’onglet, et pas au-delà ────────────────────────── */

await page.click('#temoin-coffre-masquer');
await page.waitForTimeout(300);
verifier('« Masquer » retire le bandeau', await page.locator('#temoin-coffre').isVisible(), false);
verifier(
  'mais pas le cadenas, qui porte le geste',
  await page.locator('#cadenas-coffre').isVisible(),
  true,
);

const hauteurApres = await placeAvantLeContenu();
verifier(
  `le haut de page rend la place du bandeau (${hauteurAvant} → ${hauteurApres} px)`,
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
  /*
     L'écran qui se lit SANS le mot de passe n'a pas d'en-tête, donc pas de
     cadenas — et il ne peut pas en avoir.

     « Mot de passe perdu » est rendu avec `sansNavigation`, ce qui retire
     l'en-tête entier : c'est tout son objet, puisqu'on y arrive depuis
     l'écran de saisie, avant d'être entré. Un cadenas « Fermer le coffre »
     sur une page qu'on lit justement parce qu'on ne peut rien ouvrir n'aurait
     aucun sens. L'interdit 6 vise les écrans de l'application, pas la notice
     de secours.

     Bornée à une seule : si la liste s'allonge, c'est que l'interdit cède,
     et l'essai doit le dire.
  */
  const EXCEPTIONS = [
    {
      route: '/mot-de-passe-perdu/',
      pourquoi:
        'rendue sans en-tête (`sansNavigation`) parce qu’elle se lit avant ' +
        'd’être entré ; il n’y a donc aucun coffre à y fermer.',
    },
  ];
  const exceptee = (r) => EXCEPTIONS.some((e) => e.route === r);
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
    if (!offert && !exceptee(r)) sans.push(r);
  }
  verifier(
    'INTERDIT 6 — « Fermer le coffre » reste offert sur chaque route, bandeau masqué',
    sans,
    [],
  );
  verifier('et les exceptions restent au nombre d’une', EXCEPTIONS.length, 1);
  for (const e of EXCEPTIONS) console.log(`    exception : ${e.route} — ${e.pourquoi}`);
}

/* ── Le retour du bandeau à la réouverture ─────────────────────────── */

await page.evaluate(() => sessionStorage.clear());
await ouvrirLeCoffre();
verifier(
  'un masquage de session ne survit pas à la session',
  await page.locator('#temoin-coffre').isVisible(),
  true,
);

/* ── Le bandeau tient sur UNE rangée, et ce qui n'y tient pas est ailleurs ─ */

/*
   M5, 18 octobre. À 360 px le bandeau faisait 105 px : ses cinq libellés
   passaient à la ligne deux fois. Sous 640 px il n'en porte plus que deux —
   « Fermer le coffre » et « Masquer » — et les deux autres vivent dans le
   menu du cadenas. L'essai le vérifie dans les deux sens : une seule rangée
   ici, et le geste retrouvé là-bas.
*/
verifier(
  'le bandeau tient sur une seule rangée sous 640 px',
  await page.evaluate(() => {
    const rangee = document.querySelector('#temoin-coffre > div');
    if (!rangee) return null;
    const visibles = [...rangee.children].filter((c) => c.getBoundingClientRect().height > 0);
    if (!visibles.length) return null;
    /*
       Le nombre de rangées se déduit de la hauteur, et non des `top`.
       Compter les `top` distincts donnait 2 sur une rangée unique, tout
       simplement parce qu'un libellé de 15 px et un bouton de 44 px centrés
       l'un à côté de l'autre ne commencent pas à la même ordonnée.
    */
    const st = getComputedStyle(rangee);
    const interieur =
      rangee.getBoundingClientRect().height -
      parseFloat(st.paddingTop) -
      parseFloat(st.paddingBottom);
    const plusHaut = Math.max(...visibles.map((c) => c.getBoundingClientRect().height));
    return Math.max(1, Math.round(interieur / plusHaut));
  }),
  1,
);
verifier(
  '« Masquer indéfiniment » n’y est plus proposé sur téléphone',
  await page.locator('#temoin-coffre-masquer-toujours').isVisible(),
  false,
);

/* ── « Masquer indéfiniment » : il survit au rechargement ──────────── */

await page.click('#cadenas-coffre-bouton');
await page.waitForTimeout(200);
verifier(
  'mais le menu du cadenas le porte',
  await page.locator('#cadenas-masquer-toujours').isVisible(),
  true,
);
await page.click('#cadenas-masquer-toujours');
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
