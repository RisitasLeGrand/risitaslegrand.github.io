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
import { apresLeChangementDeTexte, apresLesAnimations } from './lib/post-condition.mjs';

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

/*
   LES ZONES, LUES DANS LE NAVIGATEUR, pour pouvoir les ATTENDRE et pas
   seulement les lire. Même code que `releve`, du côté de la page.
*/
const ZONES = `[...document.querySelectorAll('svg[data-face] [data-zone]')]
  .map((z) => z.dataset.zone + ':' + z.dataset.etat).sort().join('|')`;

/**
 * Attend que les zones satisfassent un prédicat écrit côté page.
 *
 * ATTENTION À CE QU'ON ATTEND : une post-condition ne doit JAMAIS impliquer
 * l'assertion qu'elle précède. Attendre « les zones valent exactement X »
 * avant d'affirmer « les zones valent X » rend l'assertion incapable
 * d'échouer : elle ne peut plus que expirer, en panne et non en rouge nommé.
 * C'est le vert à vide sous une autre forme, et A me l'a montré sur
 * `essais-boite`. Les attentes ci-dessous décrivent donc un CHANGEMENT, ou
 * un état plus faible que ce qui est affirmé, et laissent l'assertion dire
 * quoi exactement.
 */
const attendreZones = (corps, argument = null) =>
  page.waitForFunction(
    new Function('arg', `const zones = ${ZONES}; return (${corps});`),
    argument,
    { timeout: 30000 },
  );

const auRepos = await releve();
v('au repos, rien n’est allumé', auRepos.every((e) => e.endsWith(':aucun')), true);

/* Deux muscles principaux, un secondaire : de quoi distinguer les étapes. */
await page.selectOption('select[data-case="pectoraux"]', 'principal');
await page.selectOption('select[data-case="triceps"]', 'principal');
await page.selectOption('select[data-case="biceps"]', 'secondaire');
/*
   Trois cases renseignées font trois zones allumées : on attend le COMPTE,
   qui passe de zéro à trois. L'assertion, elle, dit lequel — donc elle garde
   quelque chose à vérifier.
*/
await attendreZones("zones.split('|').filter((z) => !z.endsWith(':aucun')).length >= 3");

const avant = await releve();
v(
  'les cases ont bien allumé trois muscles',
  avant.filter((e) => !e.endsWith(':aucun')).length,
  3,
);

/*
   a) RIEN NE DÉMARRE SEUL — et une absence peut quand même s'attendre.

   L'assertion est purement négative : l'état ne doit pas avoir bougé. J'ai
   d'abord cru qu'un tel cas n'admettait qu'une fenêtre d'observation ; A m'a
   montré le contraire sur `essais-boite`, et la méthode s'applique ici
   mieux encore. On n'attend pas l'absence : on attend un ÉTAT POSITIF qui
   l'implique — le registre d'animations du schéma est vide, après deux
   trames d'affichage.

   MA PREMIÈRE VERSION AFFIRMAIT QUE LE REGISTRE D'ANIMATIONS ÉTAIT VIDE.
   L'essai a répondu « obtenu 2 », et il avait raison : les trois cases
   qu'on vient de renseigner ont elles-mêmes déclenché des transitions sur
   les zones. « Aucune animation ne tourne » n'est donc pas un énoncé vrai
   de cet écran au repos, et une assertion qui l'affirme accuse le site
   d'un défaut qu'il n'a pas. J'avais pris un indicateur pour une preuve.

   Ce qui est juste, en revanche, c'est d'attendre que ces animations-là
   FINISSENT. `apresLesAnimations` le fait, et le raisonnement tient
   entièrement : si l'animation explicative avait démarré seule, elle
   serait du nombre, donc attendue elle aussi — et `releve()` différerait
   alors de `avant`, ce que l'assertion dit. L'attente ne décide donc rien
   de ce que l'assertion vérifie ; elle lui garantit seulement que plus
   rien ne bouge au moment où elle lit.
*/
await apresLesAnimations(page, 'svg[data-face]');
v('rien n’a bougé sans qu’on le demande', await releve(), avant);

/* b) À la demande, par étapes. */
/*
   ATTENDRE « UN CHANGEMENT » NE SUFFISAIT PAS, et l'essai me l'a dit tout
   de suite : « obtenu 0, attendu 2 ». L'animation commence par TOUT
   ÉTEINDRE, puis allume les principaux. Le premier changement est donc le
   noir complet, et j'y lisais zéro principal allumé.

   Ce qu'il faut attendre est le temps d'après : les zones ont changé ET
   elles ne sont plus toutes éteintes. Cela dit qu'une étape a allumé
   quelque chose, sans dire quoi — l'assertion garde donc sa charge, qui
   est de vérifier que ce sont exactement les deux principaux, et aucun
   secondaire.
*/
await page.click('#voir-animation');
await attendreZones(
  "zones !== arg && !zones.split('|').every((z) => z.endsWith(':aucun'))",
  avant.join('|'),
);
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

/*
   L'étape suivante change le commentaire : « Étape 1 sur 2 » devient
   « Étape 2 sur 2 ». On attend ce changement, et non l'état des zones —
   l'assertion qui suit affirme que les zones retrouvent `avant`, et
   l'attendre serait l'empêcher d'échouer.
*/
await apresLeChangementDeTexte(
  page,
  '#commentaire-animation',
  () => page.click('#etape-animation'),
  { delai: 30000 },
);
const apres = await releve();

/* c) LA règle qui compte : l'état final est l'état réel. */
v('à la fin, l’écran dit exactement ce qui est enregistré', apres, avant);

const commentaire2 = await page.textContent('#commentaire-animation');
v('le texte a suivi', /Étape 2 sur 2/.test(commentaire2 ?? ''), true);

/* d) Interrompre en cours de route ne laisse pas l'écran faux. */
/*
   INTERROMPRE DEMANDE D'ÊTRE EN VOL, et 80 ms ne le garantissaient pas.

   Ces trois clics interrompent une animation EN COURS. Les 80 ms pariaient
   qu'elle en serait encore à son début ; plus rapide, et l'on interrompait
   une animation déjà finie, c'est-à-dire rien. L'essai serait resté vert
   en ne mesurant plus son sujet.

   LE TÉMOIN EXACT EST LE LIBELLÉ DU BOUTON, et il a fallu instrumenter la
   page pour le savoir. J'avais d'abord attendu « tout est éteint » après
   chaque relance, en me fiant au commentaire du code — « on éteint tout ».
   L'attente a expiré, et le relevé dit pourquoi : la relance éteint tout
   PUIS JOUE L'ÉTAPE 1 dans le même tour de boucle. L'écran noir n'existe
   donc à aucun instant observable, et je l'attendais.

   Le bouton, lui, dit sans ambiguïté dans quel état on est : « Interrompre »
   quand une animation court, « Voir l'animation » quand elle a été rendue.
   C'est exactement la distinction que ces trois clics mettent à l'épreuve,
   et elle n'implique rien de ce que l'assertion finale vérifie.
*/
const boutonDit = (motif) =>
  page.waitForFunction(
    (m) => new RegExp(m).test(document.getElementById('voir-animation')?.textContent ?? ''),
    motif,
    { timeout: 30000 },
  );
await page.click('#voir-animation'); // relance : une animation court
await boutonDit('Interrompre');
await page.click('#voir-animation'); // interrompt : l'état réel est rendu
await boutonDit('Voir');
await page.click('#voir-animation'); // relance proprement
await boutonDit('Interrompre');
await apresLeChangementDeTexte(
  page,
  '#commentaire-animation',
  () => page.click('#etape-animation'),
  { delai: 30000 },
);
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
