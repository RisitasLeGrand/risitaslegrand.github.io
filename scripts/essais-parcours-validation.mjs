/**
 * Choisir un parcours n'est pas l'appliquer — prompt 43, E6.
 *
 *   npm run essais:parcours-validation
 *
 * ## Le défaut
 *
 * Le sélecteur de parcours écrivait la préférence et rechargeait la page sur
 * l'événement `change` de la liste. Une liste déroulante se parcourt au
 * clavier : chaque flèche sur une liste fermée change la valeur, donc
 * changeait le parcours préparé et rechargeait tout le site avant même d'avoir
 * vu les autres choix.
 *
 * ## Comment l'essai le mesure, et pourquoi ainsi
 *
 * Il pose un MARQUEUR sur la page (`window.__marqueur`), puis change la liste
 * au clavier. Si la page s'était rechargée, le marqueur aurait disparu : c'est
 * la seule façon honnête de constater l'absence d'un rechargement, puisqu'un
 * rechargement ne laisse aucune trace derrière lui.
 *
 * Il lit ensuite la préférence LÀ OÙ ELLE VIT — « revinsp.parcours » dans
 * localStorage —, pas ce que l'écran en dit.
 *
 * Playwright n'est pas une dépendance du projet : lancez « astro preview »
 * avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const CLE = 'revinsp.parcours';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(
      `      obtenu  ${String(JSON.stringify(obtenu)).slice(0, 200)}\n      attendu ${String(JSON.stringify(attendu)).slice(0, 200)}`,
    );
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log(`PAGEERROR: ${e.message.slice(0, 200)}`));

const deverrouiller = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
};

const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await page.waitForTimeout(500);
};

const parcoursStocke = () => page.evaluate((cle) => localStorage.getItem(cle), CLE);
const poserLeMarqueur = () => page.evaluate(() => ((window).__marqueur = 'ici'));
const marqueurIntact = () => page.evaluate(() => (window).__marqueur === 'ici');

try {
  await aller('/');
  await franchirInitialisation(page, RACINE, MDP);
  await aller('/revisions/');

  const liste = page.locator('#selecteur-parcours');
  const appliquer = page.locator('#appliquer-parcours');
  vrai('prémisse : le sélecteur est dans l’en-tête', await liste.isVisible().catch(() => false));

  const options = await liste.locator('option').evaluateAll((os) => os.map((o) => o.value));
  vrai('prémisse : il offre au moins deux parcours', options.length >= 2);

  const depart = await parcoursStocke();
  const autre = options.find((o) => o !== (depart ?? options[0])) ?? options[1];

  console.log('\nE6 — CHOISIR NE CHANGE RIEN');
  faux('le bouton d’application est caché au départ', await appliquer.isVisible().catch(() => false));

  await poserLeMarqueur();
  /* Au CLAVIER, par le chemin qui déclenchait le défaut : la liste prend le
     focus, puis la flèche change la valeur. */
  await liste.focus();
  await liste.selectOption(autre);
  await page.waitForTimeout(600);

  vrai('la page ne s’est PAS rechargée', await marqueurIntact());
  v('la préférence n’a pas bougé', await parcoursStocke(), depart);
  vrai('le bouton d’application est apparu', await appliquer.isVisible().catch(() => false));
  /* Lecture bornée et rattrapée : quand le bouton n'existe pas — c'était
     l'état d'avant ce point —, l'essai doit rendre un rouge lisible, et non
     une panne d'outillage trente secondes plus tard. */
  const nomDuBouton =
    (await appliquer.getAttribute('aria-label', { timeout: 2000 }).catch(() => null)) ?? '';
  vrai(
    'et il dit quel parcours il appliquerait',
    nomDuBouton.length > 'Appliquer le parcours'.length,
  );

  console.log('\nE6 — REVENIR SUR SON CHOIX LE REFERME');
  await liste.selectOption(depart ?? options[0]);
  await page.waitForTimeout(400);
  faux('le bouton a disparu', await appliquer.isVisible().catch(() => false));
  vrai('et la page n’a toujours pas bougé', await marqueurIntact());

  console.log('\nE6 — QUITTER SANS VALIDER NE GARDE RIEN');
  await liste.selectOption(autre);
  await page.waitForTimeout(300);
  await aller('/revisions/');
  v('la préférence est restée celle d’avant', await parcoursStocke(), depart);
  v(
    'et la liste s’y est remise',
    await page.locator('#selecteur-parcours').inputValue(),
    depart ?? options[0],
  );

  console.log('\nE6 — C’EST LE BOUTON QUI APPLIQUE');
  await poserLeMarqueur();
  await page.locator('#selecteur-parcours').selectOption(autre);
  await page.waitForTimeout(300);
  await page.locator('#appliquer-parcours').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  faux('la page s’est rechargée', await marqueurIntact());
  v('et la préférence a changé', await parcoursStocke(), autre);
  vrai(
    'le changement est annoncé après le rechargement',
    (await page.locator('body').innerText()).toLowerCase().includes('parcours changé'),
  );

  /* On repose le parcours de départ : un essai ne laisse pas la base dans un
     état qu'il a choisi pour lui-même. */
  await page.evaluate(
    ([cle, valeur]) => localStorage.setItem(cle, valeur),
    [CLE, depart ?? options[0]],
  );
} finally {
  await contexte.close();
  await nav.close();
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les contrôles sont verts.\x1b[0m\n'
    : `\n\x1b[31m${echecs} contrôle${echecs > 1 ? 's' : ''} rouge${echecs > 1 ? 's' : ''}.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
