/**
 * La liste des tâches n'avale plus les gestes — A5 du prompt 37.
 *
 *   npm run essais:taches-gestes
 *
 * **Ce que l'audit a constaté, et ce que j'ai mesuré en le reprenant.**
 *
 * Quand une tâche est close, la liste se repeint et les cartes glissent vers
 * leur nouvelle place. Le glissement était confié à `startViewTransition`.
 * Pendant cette transition, l'écran montre une photographie et **le contenu
 * réel n'est plus testable au pointeur** : `elementFromPoint`, au centre exact
 * d'un bouton « Faite », renvoyait l'élément racine à 40, 100 et 200 ms après
 * la première action, puis le bouton de nouveau à 1 200 ms. Un appui tombé
 * dans cet intervalle était perdu sans trace.
 *
 * **Deux pistes essayées et écartées, par mesure.**
 *   • `skipTransition()` au `pointerdown`, que le prompt proposait : le test
 *     d'impact a déjà eu lieu quand le gestionnaire s'exécute. Mesuré avec la
 *     correction en place : l'appui restait perdu, une tâche close sur deux.
 *   • `::view-transition { pointer-events: none }`, au cas où la couche
 *     intercepterait : aucun effet. Ce n'est pas elle.
 *
 * Reste l'animation des vraies cartes, que le prompt autorisait aussi.
 *
 * **Ce contrôle mesure les deux choses qui comptent**, et dans cet ordre :
 * d'abord que le bouton est ATTEIGNABLE pendant le glissement — c'est la
 * cause —, ensuite que les deux tâches sont bien closes — c'est l'effet. Un
 * contrôle qui ne regarderait que le second passerait au vert le jour où les
 * deux appuis se feraient par hasard hors de la fenêtre d'animation.
 *
 * **Les données sont semées par l'écran lui-même**, trois tâches ajoutées par
 * le formulaire : rien n'est écrit dans la base par un chemin détourné, et le
 * contrôle ne mesure donc pas ce qu'il a lui-même fabriqué.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
/** L'intervalle entre les deux appuis, au cœur de la fenêtre d'animation. */
const INTERVALLE = 100;

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

console.log('\nLISTE DES TÂCHES — LES GESTES PENDANT LE GLISSEMENT (A5)');

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.locator('#vue').waitFor({ state: 'visible', timeout: 25000 });

/*
   HUIT CENTS MILLISECONDES, ET NON QUATRE CENTS.

   Cette préparation attendait 400 ms entre deux créations, et n'obtenait que
   deux tâches sur trois. Ce n'était pas un défaut du site : `unSeulGeste`
   impose un repos de 600 ms après la fin d'une action, parce qu'un rebond de
   pouce arrive en moins de 300 ms (mesuré, `src/lib/geste.ts`). La troisième
   frappe tombait dans ce repos et était écartée — exactement ce que le
   garde-fou doit faire.

   L'essai se faisait donc rattraper par la règle qu'il est venu vérifier. On
   attend au-delà du repos, comme une personne qui relit son écran entre deux
   ajouts.
*/
for (const titre of ['Alpha', 'Beta', 'Gamma']) {
  await page.fill('#titre', titre);
  await page.press('#titre', 'Enter');
  await page.waitForTimeout(800);
}
v('trois tâches ouvertes au départ', await page.locator('[data-faire]').count(), 3);

/*
   LE DÉFILEMENT EST INSTANTANÉ, ET C'EST UNE CORRECTION.

   Le socle pose `scroll-behavior: smooth`. Mes premières sondes lisaient la
   position du bouton juste après un `scrollIntoView` : le défilement n'avait
   pas encore eu lieu, le bouton était relevé à y = 843 — sous la barre
   d'onglets —, et le « clic sur le bouton » atteignait en fait la barre et
   changeait de page. Trois mesures fausses avant de m'en apercevoir.
*/
const centrerLePremierBouton = async () => {
  await page.evaluate(() => {
    document.querySelector('[data-faire]')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(150);
};

/** Ce que le doigt atteindrait au centre du premier bouton « Faite ». */
const viser = () =>
  page.evaluate(() => {
    const bouton = document.querySelector('[data-faire]');
    if (!bouton) return null;
    const r = bouton.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const touche = document.elementFromPoint(x, y);
    return { x, y, leBouton: Boolean(touche?.closest?.('[data-faire]')) };
  });

await centrerLePremierBouton();
const premier = await viser();
v('au repos, le centre du bouton atteint bien le bouton', premier?.leBouton, true);
await page.mouse.click(premier.x, premier.y);

await page.waitForTimeout(INTERVALLE);
const pendant = await viser();
v(
  `à ${INTERVALLE} ms, pendant le glissement, le bouton reste atteignable`,
  pendant?.leBouton,
  true,
);
if (pendant) await page.mouse.click(pendant.x, pendant.y);

await page.waitForTimeout(2500);
const etats = await page
  .locator('[data-tache]')
  .evaluateAll((n) => n.map((e) => e.dataset.etat));
v('les DEUX tâches sont closes', etats.filter((e) => e === 'faite').length, 2);
v('et la troisième est intacte', etats.filter((e) => e === 'ouverte').length, 1);

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
