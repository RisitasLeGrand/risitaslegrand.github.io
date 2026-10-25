/**
 * La persistance est réellement demandée à l’ouverture — G-10 du 58.
 *
 *   npm run essais:persistance:navigateur
 *
 * ## Pourquoi un essai de plus, alors que essais:persistance existe
 *
 * Celui-là éprouve la FONCTION : devant un navigateur simulé, elle demande au
 * bon moment et se tait aux quatre autres. Il est juste, et il ne dit rien du
 * défaut que le 58 relève.
 *
 * Car le défaut est le même qu’en A4, un cran plus loin : « le code était là ;
 * la demande n’avait pas lieu ». `assurerLaPersistance()` n’était appelée que
 * dans le fil d’une sauvegarde confirmée, sur un seul écran. Quelqu’un qui ne
 * sauvegarde jamais n’était donc jamais protégé contre l’éviction de sa base —
 * et c’est justement celui qui n’a pas de sauvegarde qui a le plus à perdre.
 *
 * Un essai de fonction ne peut pas voir cela. Il faut ouvrir la page et
 * regarder si l’appel part.
 *
 * ## Comment on observe un appel qu’on ne doit pas déclencher pour de vrai
 *
 * `navigator.storage.persist()` montrerait une invite du navigateur et
 * changerait l’état du profil. On le remplace donc, AVANT tout script de page,
 * par un double qui compte les appels et répond « non ». `addInitScript`
 * garantit l’ordre : le double est en place avant que la mise en page ne
 * s’exécute.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\u001b[32m✓\u001b[0m' : '\u001b[31m✗\u001b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1100, height: 900 } });

/*
   Le double, posé avant tout script de page.

   LE COMPTEUR VIT DANS `sessionStorage`, ET C’EST LE POINT DÉLICAT DE CET
   ESSAI. `addInitScript` rejoue à CHAQUE document : une variable globale
   repart à zéro dès que la page navigue, et l’appel qu’on veut observer est
   justement suivi d’une navigation — le déverrouillage mène à
   l’initialisation. Compté dans une globale, l’essai lisait 0 et accusait un
   défaut qui n’existait pas. `sessionStorage` traverse les navigations du
   même onglet.
*/
const CLE_COMPTEUR = 'essai.demandes-de-persistance';

await ctx.addInitScript((cle) => {
  const lu = () => Number(sessionStorage.getItem(cle)) || 0;
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      persist: async () => {
        sessionStorage.setItem(cle, String(lu() + 1));
        return false;
      },
      persisted: async () => false,
      estimate: async () => ({ usage: 0, quota: 1_000_000 }),
    },
  });
}, CLE_COMPTEUR);

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

const compte = () => page.evaluate((cle) => Number(sessionStorage.getItem(cle)) || 0, CLE_COMPTEUR);

const ouvrir = async (route) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForTimeout(2500);
};

console.log('\nELLE EST DEMANDÉE À L’OUVERTURE, SUR UN ÉCRAN QUI N’EST PAS PROGRESSION');

await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () => new Promise((ok) => {
    const r = indexedDB.deleteDatabase('revinsp');
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  }),
);
await page.evaluate(() => { try { localStorage.clear(); } catch { /* fenêtre privée */ } });

await ouvrir('/');
await franchirInitialisation(page, RACINE);
await page.waitForTimeout(1500);

/*
   La racine, et non /progression/ : c’est tout l’objet de G-10. L’ancien code
   aurait rendu 0 ici, et serait resté vert sur Progression.
*/
v('la demande est partie', (await compte()) >= 1, true);

console.log('\nET ELLE NE SE RÉPÈTE PAS À CHAQUE PAGE');

/*
   Le garde-fou des sept jours. Sans lui, l’appel à chaque ouverture serait une
   invite à chaque page — exactement le défaut inverse de celui qu’on corrige.
*/
const apresPremiere = await compte();
await ouvrir('/stockage/');
await ouvrir('/parametres/');
v('deux écrans de plus ne redemandent rien', (await compte()) - apresPremiere, 0);

await nav.close();
console.log(echecs === 0 ? '\n\u001b[32m✓ tout passe\u001b[0m' : `\n\u001b[31m✗ ${echecs} en échec\u001b[0m`);
process.exit(echecs === 0 ? 0 : 1);
