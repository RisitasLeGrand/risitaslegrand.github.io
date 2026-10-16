/**
 * M10 — la carte des écrans : aucune route orpheline, aucune au-delà de trois appuis.
 *
 *   npm run essais:carte-ecrans
 *
 * ## Pourquoi ce contrôle existe
 *
 * `essais:orphelins` dit qu'un **module** est importé par un écran. Il ne dit
 * rien d'un **écran** que rien ne relie : le 16 octobre 2026,
 * `/odyssee/molecule/` a été livrée avec ses essais verts, sa fiche, ses
 * sources — et aucun lien vers elle nulle part. On ne pouvait l'ouvrir qu'en
 * tapant l'adresse. Une fonction qu'on ne trouve pas n'existe pas.
 *
 * ## Pourquoi il mesure au navigateur et non dans le code
 *
 * Une première version lisait les chaînes littérales de `src/`. Elle
 * déclarait 53 routes sur 54 inatteignables, parce que la barre du bas vient
 * du registre et que ses liens s'assemblent à l'exécution. Pire : elle aurait
 * accusé à tort les trois modules de Cog-Training, dont le `href` se
 * construit par concaténation. Un contrôle qui accuse à tort se fait
 * désactiver, et c'est ainsi qu'on perd un garde-fou.
 *
 * Il ouvre donc chaque écran et relève les liens **rendus**, ce qui est la
 * seule définition qui compte : ce sur quoi un doigt peut appuyer.
 *
 * ## Le coût d'un lien
 *
 * Un appui, sauf dans la feuille « Plus » de la barre du bas, qu'il faut
 * ouvrir d'abord : ses liens coûtent deux. Sans cette distinction, le
 * contrôle dirait que tout est à un appui, ce qui est faux au doigt.
 *
 * ## Le coffre
 *
 * Ouvert avant de mesurer. Un balayage coffre fermé relève les liens d'un
 * écran vide, et c'est l'erreur du 14 octobre.
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
const PLAFOND = 3;

/**
 * Les exceptions, chacune avec sa raison.
 *
 * Une exception **permanente** est un choix qu'on assume ; une exception
 * **datée** est une dette qu'on compte. Pas de troisième sorte, et surtout
 * pas la liste qu'on allonge sans la lire.
 */
const EXCEPTIONS_ORPHELINES = [
  {
    route: '/initialisation/',
    permanente: true,
    pourquoi:
      'On y arrive par redirection depuis « / » tant que l’initialisation ' +
      'n’a pas eu lieu, et on n’y revient jamais ensuite. Un lien permanent ' +
      'vers elle proposerait de refaire ce qui est fait.',
  },
];

/** Les écrans du quotidien : deux appuis, et non trois. */
const QUOTIDIENS = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/taches/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/flashcards/',
  '/revisions/',
  '/sport/seance/',
  '/notifications/',
];

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

/** Les routes, déduites du dossier des pages. */
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

const ROUTES = routes();
const EST_ROUTE = new Set(ROUTES);

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

// La prémisse se lit, elle ne se devine pas.
await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
}
await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
verifier(
  'le coffre est ouvert avant de relever le moindre lien',
  await page.evaluate(() => !document.getElementById('temoin-coffre')?.classList.contains('hidden')),
  true,
);

/** route → Map(cible → coût du lien) */
const liens = new Map();

for (const route of ROUTES) {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(500);

  const trouves = await page.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('/') && !href.startsWith(location.origin)) continue;
      let chemin = href.replace(location.origin, '').split('?')[0].split('#')[0];
      if (!chemin) continue;
      if (!chemin.endsWith('/')) chemin += '/';
      // La feuille « Plus » doit être ouverte : ses liens coûtent un appui de plus.
      out.push({ chemin, cout: a.closest('#feuille-plus') ? 2 : 1 });
    }
    return out;
  });

  const m = liens.get(route) ?? new Map();
  for (const { chemin, cout } of trouves) {
    if (!EST_ROUTE.has(chemin) || chemin === route) continue;
    const a = m.get(chemin);
    if (a === undefined || cout < a) m.set(chemin, cout);
  }
  liens.set(route, m);
}

await contexte.close();
await nav.close();

/* ------------------------------------------------------------------ */

const entrants = new Map(ROUTES.map((r) => [r, new Set()]));
for (const [source, cibles] of liens) {
  for (const cible of cibles.keys()) entrants.get(cible)?.add(source);
}

// Profondeur : Dijkstra, les liens de la feuille « Plus » coûtant deux.
const profondeur = new Map([['/', 0]]);
let bouge = true;
while (bouge) {
  bouge = false;
  for (const [source, cibles] of liens) {
    const d = profondeur.get(source);
    if (d === undefined) continue;
    for (const [cible, cout] of cibles) {
      const n = d + cout;
      if (!profondeur.has(cible) || profondeur.get(cible) > n) {
        profondeur.set(cible, n);
        bouge = true;
      }
    }
  }
}

const exceptee = (r) => EXCEPTIONS_ORPHELINES.some((e) => e.route === r);
const orphelines = ROUTES.filter((r) => r !== '/' && entrants.get(r).size === 0 && !exceptee(r));
const trop = ROUTES.filter((r) => (profondeur.get(r) ?? 99) > PLAFOND && !exceptee(r)).map(
  (r) => `${r} (${profondeur.get(r) ?? '∞'})`,
);
const quotidiensTrop = QUOTIDIENS.filter((r) => (profondeur.get(r) ?? 99) > 2).map(
  (r) => `${r} (${profondeur.get(r) ?? '∞'})`,
);

console.log('');
verifier('M10a — aucune route sans lien entrant', orphelines, []);
verifier(`M10b — aucune route au-delà de ${PLAFOND} appuis`, trop, []);
verifier('M10c — les écrans du quotidien tiennent en deux appuis', quotidiensTrop, []);

const mesurees = ROUTES.map((r) => profondeur.get(r)).filter((d) => d !== undefined);
console.log(
  `\n  ${ROUTES.length} routes · profondeur max ${Math.max(...mesurees)} · ` +
    `moyenne ${(mesurees.reduce((a, b) => a + b, 0) / mesurees.length).toFixed(2)}`,
);
for (const e of EXCEPTIONS_ORPHELINES) {
  console.log(`  exception ${e.permanente ? 'permanente' : `datée ${e.depuis}`} : ${e.route}`);
}

process.exit(rouges === 0 ? 0 : 1);
