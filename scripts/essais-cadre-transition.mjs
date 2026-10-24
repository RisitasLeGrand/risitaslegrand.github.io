/**
 * Le cadre reste immobile pendant une transition de page — A12 du prompt 37.
 *
 *   npm run essais:cadre
 *
 * **Le constat.** Pendant le fondu entre deux pages, la photographie de la
 * page sortante et celle de la page entrante sont toutes deux à l'écran. Comme
 * l'en-tête et la barre d'onglets font partie de la capture « root », ils y
 * figurent deux fois : le cadre se dédouble le temps du fondu.
 *
 * **La correction, et ce qui se vérifie.** Leur donner un nom de transition
 * les sort de « root » et en fait des groupes à part, appariés d'une page à
 * l'autre. Ce contrôle regarde deux choses :
 *
 *   A. le style CALCULÉ du cadre — un nom sur les pages ordinaires, aucun sur
 *      les pages sous coffre, que la décision 2 exclut explicitement ;
 *   B. une VRAIE navigation, observée par l'événement « pagereveal » : les
 *      groupes nommés doivent exister dans l'arbre des pseudo-éléments.
 *
 * Le point B est le seul qui prouve quelque chose du comportement ; le point A
 * dit où la règle s'applique et où elle ne s'applique pas. Lire la feuille de
 * style n'aurait dit ni l'un ni l'autre.
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

console.log('\nLE CADRE PENDANT UNE TRANSITION DE PAGE (A12)');

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

const ouvrir = async (route) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(600);
  }
};

const nomsDuCadre = () =>
  page.evaluate(() => {
    const lire = (id) => {
      const e = document.getElementById(id);
      return e ? getComputedStyle(e).viewTransitionName : 'absent';
    };
    return { entete: lire('entete-principal'), barre: lire('barre-du-bas') };
  });

console.log('\n  A — où la règle s’applique');

await ouvrir('/odyssee/taches/');
v('page ordinaire : l’en-tête est nommé', (await nomsDuCadre()).entete, 'entete-principal');
v('page ordinaire : la barre du bas est nommée', (await nomsDuCadre()).barre, 'barre-du-bas');

await ouvrir('/odyssee/psyche/');
const sousCoffre = await nomsDuCadre();
v('page sous coffre : aucun nom sur l’en-tête', sousCoffre.entete, 'none');
v('page sous coffre : aucun nom sur la barre', sousCoffre.barre, 'none');

console.log('\n  B — une vraie navigation, observée');

/*
   On écoute « pagereveal » dans la page ENTRANTE : c'est le seul moment où la
   transition entre documents existe et où l'on peut regarder l'arbre des
   pseudo-éléments. Le relevé est déposé sur `window`, puis lu après coup.
*/
/*
   L'ÉCOUTEUR EST POSÉ DANS CHAQUE DOCUMENT, et c'est une correction. Ma
   première écriture l'installait dans la page sortante : il ne survit pas à
   la navigation, et le contrôle rapportait « aucune transition » alors qu'il
   n'avait simplement rien écouté.
*/
await page.addInitScript(() => {
  window.addEventListener(
    'pagereveal',
    (e) => {
      if (!e.viewTransition) return;
      sessionStorage.setItem('essai-cadre', '["transition-sans-groupes"]');
      e.viewTransition.ready.then(() => {
        const noms = document
          .getAnimations()
          .map((a) => a.effect?.pseudoElement ?? '')
          .filter((n) => n.startsWith('::view-transition'));
        sessionStorage.setItem('essai-cadre', JSON.stringify(noms));
      });
    },
    { once: true },
  );
});

await ouvrir('/odyssee/');

/*
   UN LIEN VISIBLE, et c'est un piège rencontré : à 390 px de large, le premier
   lien de ce chemin dans le document est celui de la barre latérale de bureau,
   masquée. Playwright attendait sa visibilité jusqu'à expiration. Et surtout,
   une navigation déclenchée par le pilote (`goto`) ne produit PAS de transition
   entre documents — seule une navigation de la page elle-même en produit une.
*/
await page.locator('a[href$="/odyssee/taches/"]:visible').first().click();
await page.waitForURL('**/odyssee/taches/', { timeout: 15000 });
await page.waitForTimeout(1200);

const releve = await page.evaluate(() => sessionStorage.getItem('essai-cadre'));
let noms = [];
try {
  noms = JSON.parse(releve ?? '[]');
} catch {
  noms = [];
}

v('une transition entre documents a bien eu lieu', releve !== null, true);

/*
   CE QUE JE DEMANDE ICI, ET POURQUOI PAS AUTRE CHOSE.

   Ma première version exigeait de trouver « ::view-transition-group(entete-
   principal) » parmi les animations en cours. C'était un contresens : avec la
   correction, ce groupe ne s'anime justement PAS — l'ancien est retiré, le
   nouveau est immobile, et la géométrie ne change pas. `getAnimations()` ne
   liste que ce qui court. L'assertion échouait donc sur le succès.

   Ce qui distingue réellement les deux états est l'inverse : AUCUNE animation
   ne doit porter sur le cadre. Avant la correction, l'en-tête et la barre
   faisaient partie de « root » et se fondaient avec lui — deux exemplaires à
   l'écran. Après, ils n'apparaissent dans aucune animation, et c'est
   précisément ce qu'« immobile » veut dire.

   On exige quand même que « root » s'anime : sans cela le contrôle serait vert
   sur une page où rien ne se passe, ce qui est le piège de ce lot entier.
*/
const anime = (motif) => noms.some((n) => n.includes(motif));
v('le corps de page, lui, se fond bien', anime('view-transition-group(root)'), true);
v('aucune animation ne porte sur l’en-tête', anime('entete-principal'), false);
v('ni sur la barre du bas', anime('barre-du-bas'), false);

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
