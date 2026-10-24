/**
 * Animations explicatives — ce qu'elles montrent, et ce qu'elles ne cassent pas.
 *
 *   npm run essais:explicatives
 *
 * **Les règles de l'A7, et pourquoi chacune est contrôlée.**
 *
 * *À la demande, jamais en boucle.* Une animation qui démarre seule sur un
 * écran de travail est une distraction, pas une explication. On vérifie donc
 * qu'au repos **rien n'a bougé**.
 *
 * *Avançable pas à pas.* Une explication qu'on ne peut pas arrêter ne
 * s'explique qu'à ceux qui lisent vite.
 *
 * *L'état final est lisible sans l'animation.* C'est la règle la plus facile à
 * enfreindre sans s'en apercevoir : une animation qui laisse l'écran dans un
 * état intermédiaire a transformé une aide en mensonge. Le contrôle relève
 * donc l'état AVANT et APRÈS, et exige qu'ils soient identiques.
 *
 * *Un texte dit la même chose.* Sans quoi l'animation serait la seule source
 * de l'information, ce que l'interdit sur le sens porté par le mouvement
 * proscrit.
 *
 * **Ce qui n'est pas contrôlé ici, et pourquoi.** Le cas 3 de l'A7 (une jauge
 * qui se remplit) n'est pas livré : le composant que le prompt nomme,
 * `BarreProgression.astro`, est la barre de chargement de la page et n'a
 * aucune valeur à atteindre ; les vraies jauges animeraient `width`, que
 * l'interdit n° 4 proscrit. Soumis à Alexis plutôt que tranché seul.
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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

console.log('\nANIMATIONS EXPLICATIVES');

const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await page.goto(`${RACINE}/sport/exercices/`, { waitUntil: 'networkidle' });
const verrou = page.locator('#champ-mdp');
if (await verrou.isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.locator('#vue').waitFor({ state: 'visible', timeout: 25000 });
await page.getByRole('button', { name: /Ajouter un exercice/i }).first().click();
await page.locator('svg[data-face]').first().waitFor({ state: 'visible', timeout: 25000 });

/* --- Cas 1 : les muscles sollicités s'allument --------------------------- */

console.log('\n  Cas 1 — les muscles s’allument sur le schéma');

/* On pose un état réel par les CASES, pas par le schéma : c'est la source que
   l'animation prétend refléter, et s'en servir prouve qu'elle la lit vraiment
   au lieu de se contenter de ce qu'elle a elle-même écrit. */
const releve = () =>
  page.$$eval('svg[data-face] [data-zone]', (zones) =>
    zones.map((z) => `${z.dataset.zone}:${z.dataset.etat}`).sort(),
  );

const auRepos = await releve();
v('au repos, rien n’est allumé', auRepos.every((e) => e.endsWith(':aucun')), true);

/* Deux muscles principaux, un secondaire : de quoi distinguer les étapes. */
await page.selectOption('select[data-case="pectoraux"]', 'principal');
await page.selectOption('select[data-case="triceps"]', 'principal');
await page.selectOption('select[data-case="biceps"]', 'secondaire');
await page.waitForTimeout(150);

const avant = await releve();
v(
  'les cases ont bien allumé trois muscles',
  avant.filter((e) => !e.endsWith(':aucun')).length,
  3,
);

/* a) Rien ne démarre seul. */
await page.waitForTimeout(400);
v('rien n’a bougé sans qu’on le demande', await releve(), avant);

/* b) À la demande, par étapes. */
await page.click('#voir-animation');
await page.waitForTimeout(120);
const etape1 = await releve();
v(
  'la première étape n’allume que les principaux',
  etape1.filter((e) => e.endsWith(':principal')).length,
  2,
);
v('et pas encore les secondaires', etape1.filter((e) => e.endsWith(':secondaire')).length, 0);

const commentaire1 = await page.textContent('#commentaire-animation');
v('un texte dit où l’on en est', /Étape 1 sur 2/.test(commentaire1 ?? ''), true);
v('et combien de muscles', /principaux\s*:\s*2/.test(commentaire1 ?? ''), true);

await page.click('#etape-animation');
await page.waitForTimeout(120);
const apres = await releve();

/* c) LA règle qui compte : l'état final est l'état réel. */
v('à la fin, l’écran dit exactement ce qui est enregistré', apres, avant);

const commentaire2 = await page.textContent('#commentaire-animation');
v('le texte a suivi', /Étape 2 sur 2/.test(commentaire2 ?? ''), true);

/* d) Interrompre en cours de route ne laisse pas l'écran faux. */
await page.click('#voir-animation'); // relance : tout s'éteint
await page.waitForTimeout(80);
await page.click('#voir-animation'); // interrompt
await page.waitForTimeout(80);
await page.click('#voir-animation'); // relance proprement
await page.click('#etape-animation');
await page.waitForTimeout(120);
v('après une interruption, l’état réel est retrouvé', await releve(), avant);

/* --- Cas 2 : le déroulé de la correction -------------------------------- */
/*
   Le composant est lu dans sa source : il n'est monté que dans une correction
   détaillée, derrière une séance de QCM qu'il faudrait jouer entièrement pour
   l'atteindre. Ce que le contrôle vérifie, c'est que la règle existe ET
   qu'elle est bien neutralisée sous mouvement réduit — les deux points où
   cette phase pouvait fauter.
*/

console.log('\n  Cas 2 — le déroulé révèle chaque étape');

{
  const source = readFileSync('src/features/correction/composants/Deroule.svelte', 'utf8');
  v('chaque étape est révélée par une animation', /\.etape-revelee\s*\{[^}]*animation:/.test(source), true);
  v(
    'qui joue un fondu et un glissement',
    /@keyframes etape-parait[\s\S]*opacity: 0[\s\S]*translateX/.test(source),
    true,
  );
  v(
    'un bloc « key » la relance à chaque pas',
    /\{#key visibles\}/.test(source),
    true,
  );
  v(
    'sous mouvement réduit, l’animation est SUPPRIMÉE, pas raccourcie',
    /prefers-reduced-motion: reduce\)\s*\{\s*\.etape-revelee\s*\{\s*animation: none/.test(source),
    true,
  );
  v(
    'et l’interrupteur de l’application la supprime aussi',
    /data-animations='reduites'\]\)\s*\.etape-revelee\s*\{\s*animation: none/.test(source),
    true,
  );
  v(
    'le texte de l’étape reste annoncé aux lecteurs d’écran',
    /aria-live="polite"/.test(source),
    true,
  );
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
