/**
 * Santé, en navigateur : la porte, le coffre, et le bandeau.
 *
 * Trois garanties que le modèle seul ne peut pas donner, et qui sont celles
 * de la phase 1 :
 *
 * - **l'espace est fermé tant qu'on ne l'ouvre pas.** Un onglet « Santé »
 *   garni de champs vides est une invitation à y mettre la catégorie de
 *   données la plus coûteuse de l'application ;
 * - **l'activation ne suffit pas** : le coffre reste à ouvrir, et rien n'est
 *   lisible avant ;
 * - **le bandeau des valeurs non sourcées s'affiche**, parce qu'il est le
 *   livrable de la phase et non sa note de bas de page.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
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
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, c) => v(titre, c, true);
const faux = (titre, c) => v(titre, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

/* Aucune requête ne doit sortir du site : une donnée de santé encore moins
   qu'une autre. */
const sorties = [];
page.on('request', (r) => {
  if (!r.url().startsWith(RACINE) && !r.url().startsWith('data:')) sorties.push(r.url());
});

await franchirInitialisation(page, RACINE, MDP);

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

console.log('\nL’ESPACE EST FERMÉ TANT QU’ON NE L’OUVRE PAS');

await aller('/odyssee/sante/', '#pas-active');
{
  vrai('l’écran annonce qu’il est fermé', await page.locator('#pas-active').isVisible());
  faux('le coffre n’est même pas demandé', await page.locator('#coffre-ferme').isVisible());
  faux('et rien n’est saisissable', await page.locator('#coffre-ouvert').isVisible());
  const texte = await page.textContent('#pas-active');
  vrai(
    'il dit ce qu’il permettrait, plutôt que de se taire',
    texte.includes('traitement') && texte.includes('prélèvement'),
  );
  vrai(
    'et que l’activation ne se synchronise pas',
    texte.includes('ne se synchronise pas') || texte.includes('reste fermé sur vos autres'),
  );
}

console.log('\nACTIVER NE SUFFIT PAS : LE COFFRE RESTE À OUVRIR');

{
  await page.click('#activer');
  await page.waitForSelector('#coffre-ferme', { state: 'visible', timeout: 20000 });
  vrai('le coffre est annoncé fermé', await page.locator('#coffre-ferme').isVisible());
  faux('et rien n’est encore lisible', await page.locator('#coffre-ouvert').isVisible());
}

console.log('\nCOFFRE OUVERT : LE BANDEAU, PUIS LA SAISIE');

{
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  await page.waitForSelector('#coffre-ouvert', { state: 'visible', timeout: 20000 });

  const bandeau = await page.textContent('#bandeau-catalogue');
  vrai(
    'le bandeau dit qu’aucune fiche n’est publiée',
    bandeau.includes('Aucune fiche de molécule'),
  );
  vrai(
    'et pourquoi : les sources primaires manquent',
    bandeau.includes('sources') && bandeau.includes('primaires'),
  );
  vrai(
    'tout en disant qu’on peut déclarer un traitement sans attendre',
    bandeau.includes('sans attendre'),
  );
}

{
  await page.fill('#t-nom', 'Exemple de traitement');
  await page.fill('#t-posologie', '1 le matin');
  await page.click('#form-traitement button[type="submit"]');
  await page.waitForTimeout(1200);
  const lignes = await page.$$eval('#traitements li', (e) => e.map((x) => x.textContent));
  v('le traitement est rangé et relu', lignes.length, 1);
  vrai('avec son nom', lignes[0].includes('Exemple de traitement'));
  vrai('sa posologie en toutes lettres', lignes[0].includes('1 le matin'));
  /*
     Le point qui compte : aucune prise n'est enregistrée, et l'écran doit le
     dire ainsi — « 0 h » dirait qu'on vient d'en prendre une.
  */
  vrai('et « aucune prise enregistrée » plutôt que « il y a 0 h »', 
    lignes[0].includes('aucune prise enregistrée'));
}

{
  await page.fill('#s-intitule', 'Fatigue');
  await page.fill('#s-intensite', '7');
  await page.click('#form-symptome button[type="submit"]');
  await page.waitForTimeout(1200);
  const lignes = await page.$$eval('#symptomes li', (e) => e.map((x) => x.textContent));
  v('le symptôme est rangé', lignes.length, 1);
  vrai('et son intensité est dite déclarée', lignes[0].includes('intensité déclarée 7/10'));
}

console.log('\nCE QUI EST ÉCRIT EST CHIFFRÉ, ET LE RESTE');

{
  /*
     La garantie qui vaut le détour par le navigateur : ce qui est dans la
     base ne contient pas le nom du traitement. Le lire ici, c'est lire ce
     qu'une extension ou un curieux lirait.
  */
  const brut = await page.evaluate(
    () =>
      new Promise((resoudre, rejeter) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => rejeter(d.error);
        d.onsuccess = () => {
          const base = d.result;
          const tx = base.transaction('odysseeTraitements', 'readonly');
          const tout = tx.objectStore('odysseeTraitements').getAll();
          tout.onsuccess = () => resoudre(JSON.stringify(tout.result));
          tout.onerror = () => rejeter(tout.error);
        };
      }),
  );
  faux('le nom du traitement n’est pas lisible dans la base', brut.includes('Exemple de traitement'));
  faux('ni la posologie', brut.includes('1 le matin'));
  vrai('mais l’enregistrement existe bien', brut.length > 50);
}

console.log('\nREFERMER LE COFFRE REFERME L’ÉCRAN');

{
  /*
     La clé du coffre vit dans `sessionStorage`, jamais dans `localStorage` :
     c'est la décision du module, et la vider ici est exactement ce que fait
     la fermeture de l'onglet.
  */
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#coffre-ferme', { state: 'visible', timeout: 20000 });
  faux('rien n’est lisible après rechargement', await page.locator('#coffre-ouvert').isVisible());
  faux('et l’espace reste activé', await page.locator('#pas-active').isVisible());
}

v('aucune requête n’est sortie du site', sorties, []);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de santé en navigateur passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
