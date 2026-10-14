/**
 * « Qui utilise mon âge et mon sexe », au navigateur.
 *
 * L'écran promet trois choses qu'un essai statique ne peut pas vérifier : que
 * la liste est **complète** (rien ne lit ces champs sans y figurer), que les
 * états sont **distincts** (coupé, inconnu, en attente d'une source ne se
 * confondent pas), et que la simulation **ne modifie rien**. La troisième est
 * la plus facile à casser sans s'en apercevoir : un bouton qui écrit au lieu
 * de simuler effacerait une donnée pour montrer ce qui se passe sans elle.
 */
import { chromium } from 'playwright-core';
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
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);

const contexte = await nav.newContext({
  viewport: { width: 360, height: 780 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

async function ouvrir(chemin) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  const verrou = page.locator('#champ-mdp');
  if (await verrou.isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

console.log('\nQUI UTILISE MON ÂGE ET MON SEXE');

await ouvrir('/qui-utilise-mon-age/');
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });

/* --- 1. La liste est complète et lisible -------------------------------- */

const lignes = await page.locator('#liste li[data-usage]').count();
v('les onze usages déclarés sont listés', lignes, 11);

const premiere = page.locator('#liste li[data-usage]').first();
const texte = await premiere.innerText();
vrai('chaque ligne dit ce qu’elle lit', texte.includes('Lit :'));
vrai('…ce que la personne verra', texte.includes('Vous verrez :'));
vrai('…et ce qui se passe sans la donnée', texte.includes('Si la donnée manque :'));

/* --- 2. Les états ne se confondent pas ---------------------------------- */

const etats = await page.locator('#liste li[data-usage] span.rounded-full').allInnerTexts();
const distincts = [...new Set(etats)].sort();
vrai(
  'au moins deux états distincts sont rendus',
  distincts.length >= 2,
);
vrai(
  '« en attente d’une source » est affiché, et non masqué',
  distincts.includes('en attente d’une source'),
);
vrai(
  'aucun usage n’est rendu « actif » sans donnée',
  !etats.includes('actif') || (await page.locator('text=inconnu faute de donnée').count()) > 0,
);

const attentes = await page.locator('#liste li[data-usage]').filter({ hasText: 'Attend :' }).count();
v('les quatre usages sans source disent ce qu’ils attendent', attentes, 4);

/* --- 3. La simulation ne modifie rien ----------------------------------- */

const avant = await page.locator('#liste').innerText();
await page.click('#sans-age');
await page.waitForSelector('#bandeau-simulation:not(.hidden)');
const pendant = await page.locator('#bandeau-simulation').innerText();
vrai('le bandeau dit que rien n’a été modifié', pendant.includes('Rien n’a été modifié'));
await page.click('#fin-simulation');
const apres = await page.locator('#liste').innerText();
v('revenir au réel rend exactement la liste de départ', apres === avant, true);

/* --- 4. L'interrupteur tient au rechargement ---------------------------- */

const premiereCase = page.locator('#liste input[data-couper]').first();
const idCoupe = await premiereCase.getAttribute('data-couper');
await premiereCase.uncheck();
await page.waitForTimeout(400);
await ouvrir('/qui-utilise-mon-age/');
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
const encoreCoupe = await page
  .locator(`#liste input[data-couper="${idCoupe}"]`)
  .isChecked();
v('un usage coupé le reste après rechargement', encoreCoupe, false);
const badgeCoupe = await page
  .locator(`#liste li[data-usage="${idCoupe}"] span.rounded-full`)
  .innerText();
v('et il est montré comme coupé, pas comme absent', badgeCoupe, 'coupé');

/* --- 5. Les usages sensibles sont repliés par défaut -------------------- */

const caseSensibles = page.locator('#afficher-sensibles');
v('la case des usages sensibles est décochée par défaut', await caseSensibles.isChecked(), false);
vrai('et elle existe avant même qu’un usage sensible existe', await caseSensibles.count() === 1);

/* --- 6. Mobile : pas de débordement, cibles atteignables ---------------- */

const debordement = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
v('aucun débordement horizontal à 360 px', debordement <= 0, true);

/* Pour une case à cocher, la cible tapable est son **label**, pas la case :
   mesurer l'`<input>` de 16 px condamnerait un motif correct, et mesurer 24 px
   passerait sous le standard du projet. On mesure donc ce qu'on touche, contre
   les 44 px que D-009 a fixés. */
const trop = await page.evaluate(() =>
  [...document.querySelectorAll('#vue button, #vue a, #vue input[type=checkbox]')]
    .map((e) => (e.type === 'checkbox' ? (e.closest('label') ?? e) : e))
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return r.height > 0 && r.height < 44;
    })
    .map((e) => `${e.tagName}:${Math.round(e.getBoundingClientRect().height)}px`),
);
v('aucune cible tactile sous 44 px', trop, []);

/* --- 7. La question de l'année, à l'initialisation ---------------------- */

console.log('\nL’ANNÉE DE NAISSANCE, À L’INITIALISATION');

const neuf = await nav.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
const p2 = await neuf.newPage();
p2.on('pageerror', (e) => console.log('PAGEERROR[init]:', e.message.slice(0, 200)));
await p2.goto(`${RACINE}/initialisation/`, { waitUntil: 'networkidle' });
if (await p2.locator('#champ-mdp').isVisible().catch(() => false)) {
  await p2.fill('#champ-mdp', MDP);
  await p2.click('#bouton-verrou');
}
if (await p2.locator('#commencer').isVisible().catch(() => false)) await p2.click('#commencer');
await p2.waitForSelector('#question', { timeout: 30000 });

/* Prénom, puis nom : l'année est la troisième question. */
for (let i = 0; i < 6; i += 1) {
  const titre = await p2.locator('#question').innerText();
  if (titre.includes('année de naissance')) break;
  const libre = p2.locator('#saisie input[type=text]');
  if (await libre.count()) await libre.first().fill('Essai');
  if (await p2.locator('#valider').isEnabled()) await p2.click('#valider');
  else await p2.click('#plus-tard');
  await p2.waitForTimeout(200);
}

v('la question de l’année est atteinte', (await p2.locator('#question').innerText()).includes('année de naissance'), true);
v(
  'elle est rendue par une saisie numérique, pas par un champ de texte mort',
  await p2.locator('#saisie input[type=number]').count(),
  1,
);
vrai('« Plus tard » est une sortie offerte', await p2.locator('#plus-tard').isVisible());

await p2.fill('#saisie input[type=number]', '1066');
await p2.waitForTimeout(150);
const avis = await p2.locator('#saisie p[role=status]').innerText();
vrai('une année aberrante se fait remarquer', avis.includes('130 ans'));
vrai('…et n’empêche pas de continuer', await p2.locator('#valider').isEnabled());

await p2.fill('#saisie input[type=number]', '1990');
await p2.waitForTimeout(150);
v(
  'une année plausible ne dit rien',
  await p2.locator('#saisie p[role=status]:not(.hidden)').count(),
  0,
);

/* ----------------------------------------------------------------------- */

await nav.close();
console.log(
  echecs === 0 ? '\n\x1b[32mTout est vert.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
