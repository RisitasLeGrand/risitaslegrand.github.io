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

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET LA SEULE QUI RESTE UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Cinq temporisations à
   l'aveugle, toutes devant une lecture du CHEMIN de la page.

   La post-condition d'un appui sur un onglet est que le chemin CHANGE — et
   non qu'il devienne la racine : tout l'objet de cet essai est qu'un onglet
   rouvre sa page profonde. On relève donc le chemin avant l'appui et l'on
   attend qu'il diffère.

   UN CAS Y ÉCHAPPE, et il est gardé : « un troisième appui ne fait rien ».
   Ce qu'on attend est précisément qu'il ne se passe RIEN, et cela ne se
   remplace pas par une marque — lui en donner une reviendrait à annoncer un
   non-événement. C'est la classe légitime du § 4.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;
/** De quoi laisser une navigation arriver, là où l'on affirme qu'il n'y en a pas. */
const SANS_NAVIGATION_MS = 1200;

const chemin = () => new URL(page.url()).pathname;

/** Appuie sur un onglet, et attend que le chemin ait changé. */
const appuyer = async (racine, { sansChangement = false } = {}) => {
  const avant = chemin();
  await page.click(`#barre-du-bas a[data-onglet="${racine}"]`);
  if (sansChangement) {
    await page.waitForTimeout(SANS_NAVIGATION_MS);
    return;
  }
  await page
    .waitForFunction(
      (cheminDAvant) => window.location.pathname !== cheminDAvant,
      avant,
      { timeout: DELAI },
    )
    .catch(() => {});
};

console.log('\nLA PRÉMISSE : LA BARRE DU BAS EXISTE ET PORTE SES ONGLETS');

await page.goto(`${BASE}/odyssee/`, { waitUntil: 'networkidle' });
/* La barre du bas est ce que les constats mesurent, géométrie comprise. */
await page
  .locator('#barre-du-bas')
  .waitFor({ state: 'visible', timeout: DELAI })
  .catch(() => {});
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
/* Le chemin est celui du document servi : « networkidle » suffit, et la
   prémisse le dit. */
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

await appuyer('/odyssee/', { sansChangement: true });
verifier('un troisième ne fait rien, et ne recharge pas', chemin(), '/odyssee/');

console.log('\nLA PILE EST PROPRE À L’ONGLET DU NAVIGATEUR');

const neuf = await ctx.newPage();
await neuf.goto(`${BASE}/odyssee/calendrier/`, { waitUntil: 'networkidle' });
await neuf
  .locator('#barre-du-bas a[data-onglet="/odyssee/"]')
  .waitFor({ state: 'visible', timeout: DELAI })
  .catch(() => {});
await neuf.click('#barre-du-bas a[data-onglet="/odyssee/"]');
/* L'onglet neuf n'a pas de pile : son appui mène à la racine, donc le chemin
   change. C'est ce que le constat lit. */
await neuf
  .waitForFunction(() => window.location.pathname === '/odyssee/', undefined, { timeout: DELAI })
  .catch(() => {});
verifier(
  'un onglet neuf du navigateur part d’une pile vide',
  new URL(neuf.url()).pathname,
  '/odyssee/',
);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
