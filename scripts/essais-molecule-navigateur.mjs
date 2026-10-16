/**
 * La fiche d'une molécule s'affiche — reliquat des prompts 30 et 31.
 *
 *   npm run essais:molecule:navigateur
 *
 * ## Pourquoi cet essai existe
 *
 * `astro check` signalait, parmi ses neuf erreurs, que la ligne
 * `$('vers-bibliographie').setAttribute('href', lien(…))` appelait un
 * `HTMLAnchorElement`. Ce n'était pas une plainte de typage : une
 * constante locale `lien` masquait l'aide `lien()` importée en tête de
 * module, et l'appel levait. Tout ce qui suit dans la fonction — le
 * journal, le masquage de « chargement », l'affichage de la fiche — ne
 * s'exécutait jamais.
 *
 * Le build ne pouvait pas le voir : un script de page est empaqueté, pas
 * typé. Cet essai, lui, ouvre la page et regarde.
 *
 * ## Ce qu'il ne prouve pas
 *
 * Le contenu de la fiche. On arrive sans traitement connu, donc la page
 * se rabat sur « Molécule » — c'est son chemin dégradé, et c'est celui
 * qui souffrait du défaut au même titre que l'autre. Le registre et le
 * journal ont leurs propres contrôles.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();

/*
   Deux canaux, et il faut les deux. `pageerror` ne voit que ce qui
   remonte ; or `auDeverrouillage` **attrape** l'exception du rendu, la
   journalise et affiche un pavé d'échec dans la zone de chargement. Le
   défaut était donc visible à l'écran mais muet pour `pageerror`, et une
   sonde qui n'aurait écouté que lui aurait dit « aucune erreur » devant
   une page en panne.
*/
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') erreurs.push(`console: ${m.text().slice(0, 120)}`);
});

await franchirInitialisation(page, RACINE, MDP);

const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
};

console.log('\n\x1b[1mLA FICHE D’UNE MOLÉCULE S’AFFICHE\x1b[0m');

/*
   Le COFFRE d'abord, et pas seulement le mot de passe du site : ce sont
   deux verrous distincts, et la fiche d'une molécule vit sous le second.
   Ma première version ne l'ouvrait pas ; la page affichait donc son
   écran « coffre fermé », où la sonde « chargement a disparu » passait
   au vert pour une raison qui n'avait rien à voir. Une prémisse d'essai
   se lit, elle ne se devine pas — et on l'affirme avant de mesurer.
*/
await aller('/odyssee/corps/');
if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
}
await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
vrai(
  'le coffre est ouvert avant de mesurer quoi que ce soit',
  await page.evaluate(
    () => !document.getElementById('temoin-coffre')?.classList.contains('hidden'),
  ),
);

await aller('/odyssee/molecule/?nom=Zorbitrex');

/*
   On attend l'état FINAL de la fonction fautive — la fiche visible —
   plutôt qu'un délai fixe : un délai lit une page à moitié peinte, et
   c'est une faute que j'ai déjà commise sur ce chantier.
*/
const vue = await page
  .waitForSelector('#fiche:not(.hidden)', { timeout: 30000 })
  .then(() => true)
  .catch(() => false);
vrai('la fiche est affichée', vue);
v('« chargement » a disparu', await page.locator('#chargement').isVisible(), false);
v('et l’écran « coffre fermé » n’est pas celui qu’on mesure', await page.locator('#coffre-ferme').isVisible(), false);

/*
   Le lien dont l'affectation levait. On exige un `href` réel : un attribut
   absent rend `null`, et c'est exactement ce que le défaut produisait.
*/
const href = await page.getAttribute('#vers-bibliographie', 'href');
vrai(`le lien vers la bibliographie porte une adresse (${href})`, typeof href === 'string' && href.includes('/odyssee/bibliographie/'));

v('aucune erreur de script', erreurs, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
