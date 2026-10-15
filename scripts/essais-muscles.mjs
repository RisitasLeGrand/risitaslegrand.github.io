/**
 * Les muscles sollicités — A7 du prompt 37.
 *
 *   npm run essais:muscles
 *
 * Trois constats de l'audit, trois mesures ici.
 *
 *   1. « Interrompre » relançait l'animation au lieu de l'arrêter : le
 *      gestionnaire restituait puis redémarrait aussitôt.
 *   2. L'étape 1 n'allumait rien de visible : on éteignait et on rallumait
 *      dans le même tour de boucle, sans laisser au navigateur l'occasion de
 *      peindre l'état éteint. Les muscles principaux étaient donc déjà de la
 *      bonne couleur quand l'étape 1 « les allumait ».
 *   3. À 390 px, le schéma est plus bas que le pli de la boîte : on animait
 *      hors de vue.
 *
 * **Le cas 2 se mesure image par image**, et c'est la seule façon. Un relevé
 * pris après coup verrait l'état final et ne dirait rien du chemin. On compte
 * donc, à chaque image, le nombre de zones allumées, et l'on exige que la
 * suite passe par zéro — l'état éteint PEINT — avant de remonter.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
};

console.log('\nMUSCLES SOLLICITÉS (A7)');

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await page.goto(`${RACINE}/sport/exercices/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.locator('#vue').waitFor({ state: 'visible', timeout: 25000 });
await page.getByRole('button', { name: 'Ajouter un exercice' }).first().click();
await page.locator('#fenetre-ajout').waitFor({ state: 'visible', timeout: 10000 });

/* On allume deux muscles : sans cela, « s'allumer » n'aurait rien à montrer
   et le contrôle passerait au vert sur un schéma vide. */
const allumes = () =>
  page.evaluate(
    () =>
      document.querySelectorAll('[data-zone][data-etat="principal"], [data-zone][data-etat="secondaire"]')
        .length,
  );
await page.evaluate(() => {
  const zones = [...document.querySelectorAll('[data-zone]')];
  zones[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  zones[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  zones[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const avant = await allumes();
v('deux muscles sont désignés avant l’animation', avant, 2);

console.log('\n  Cas 2 — l’état éteint est peint avant l’étape 1');

/* Le relevé image par image, posé AVANT le clic. */
await page.evaluate(() => {
  window.__suite = [];
  const compter = () =>
    document.querySelectorAll('[data-zone][data-etat="principal"], [data-zone][data-etat="secondaire"]')
      .length;
  let restantes = 40;
  const tour = () => {
    window.__suite.push(compter());
    if (--restantes > 0) requestAnimationFrame(tour);
  };
  requestAnimationFrame(tour);
});
await page.getByRole('button', { name: 'Voir l’animation' }).click();
await page.waitForTimeout(900);

const suite = await page.evaluate(() => window.__suite);
const premierZero = suite.indexOf(0);
const premierAllume = suite.findIndex((n, i) => i > premierZero && n > 0);
v(
  `une image au moins montre tout éteint (suite ${suite.slice(0, 8).join(',')}…)`,
  premierZero >= 0,
  true,
);
v('et l’allumage vient APRÈS cette image', premierZero >= 0 && premierAllume > premierZero, true);

console.log('\n  Cas 3 — le schéma est sous les yeux au lancement');

const place = await page.evaluate(() => {
  const b = document.getElementById('fenetre-ajout').getBoundingClientRect();
  const s = document.querySelector('svg[data-face]').getBoundingClientRect();
  return { dansLaBoite: s.top >= b.top - 1 && s.bottom <= b.bottom + 1, haut: Math.round(s.top), bas: Math.round(s.bottom), boiteBas: Math.round(b.bottom) };
});
v(
  `le schéma tient entièrement dans la boîte (${place.haut}→${place.bas}, boîte jusqu’à ${place.boiteBas})`,
  place.dansLaBoite,
  true,
);

console.log('\n  Cas 1 — « Interrompre » interrompt');

const bouton = page.locator('#voir-animation');
v('le bouton propose bien d’interrompre', (await bouton.textContent())?.trim(), 'Interrompre');
await bouton.click();
await page.waitForTimeout(300);
v('après l’interruption, l’état réel est restitué', await allumes(), 2);
v('le bouton redevient « Voir l’animation »', (await bouton.textContent())?.trim(), 'Voir l’animation');
v('et l’étape suivante n’est plus proposée', await page.locator('#etape-animation').isHidden(), true);

console.log('\n  Décision 1 — la forme complète a disparu');

v('aucun sélecteur de forme', await page.locator('input[name="forme-corps"]').count(), 0);
v('aucun tracé de rechange sur les chemins', await page.locator('svg[data-face] path[data-complete]').count(), 0);

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
