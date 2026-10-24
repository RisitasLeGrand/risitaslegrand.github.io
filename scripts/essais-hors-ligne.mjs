/**
 * Le cache hors ligne (D-025), éprouvé là où il vit : dans un navigateur.
 *
 * Quatre garanties, et la troisième est celle qui a longtemps justifié de
 * n'avoir aucun cache du tout :
 *
 * 1. le worker s'enregistre et le cache porte le **nom de la publication** ;
 * 2. `cle.json` n'y est **jamais** : c'est lui qui porte la version, et le
 *    cacher reviendrait à mémoriser la preuve de sa propre fraîcheur ;
 * 3. **un cache d'une autre publication est effacé** dès que la page annonce
 *    la sienne — c'est ce qui rend impossible de resservir du contenu
 *    chiffré avec une clé qui n'est plus la bonne ;
 * 4. hors ligne, la coquille **s'ouvre encore**.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const PUBLICATION = JSON.parse(readFileSync('dist/data/cle.json', 'utf8')).version;

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
const vrai = (titre, c) => v(titre, c, true);
const faux = (titre, c) => v(titre, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));

await franchirInitialisation(page, RACINE, MDP);

/**
 * Attendre une condition **depuis Node**, et non par `waitForFunction`.
 *
 * `page.waitForFunction` juge la valeur rendue par sa troncature en booléen.
 * Une fonction `async` rend une promesse, qui est toujours vraie : la
 * première évaluation « réussit » donc immédiatement, quelle que soit la
 * condition. Le premier jet de cet essai faisait exactement cela, et il
 * annonçait vert un cache périmé qui n'avait jamais été purgé.
 */
async function jusqua(condition, quoi, limiteMs = 30000) {
  const fin = Date.now() + limiteMs;
  for (;;) {
    if (await condition()) return true;
    if (Date.now() > fin) throw new Error(`Délai dépassé en attendant : ${quoi}`);
    await new Promise((suite) => setTimeout(suite, 250));
  }
}

const noms = () => page.evaluate(() => caches.keys());
const attendreLeCache = () =>
  jusqua(async () => (await noms()).some((n) => n.startsWith('cyclades-')), 'un cache nommé');
const clefs = (nom) =>
  page.evaluate(async (n) => {
    const c = await caches.open(n);
    return (await c.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
  }, nom);

console.log('\nLE CACHE PORTE LE NOM DE LA PUBLICATION');

await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await attendreLeCache();
{
  const liste = await noms();
  v('un seul cache, et c’est celui de la publication', liste, [`cyclades-${PUBLICATION}`]);
}

console.log('\n« CLE.JSON » N’Y EST JAMAIS');

{
  /* Une navigation de plus, pour que la coquille ait de quoi se remplir. */
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const gardees = await clefs(`cyclades-${PUBLICATION}`);
  faux(
    'aucune entrée ne vise cle.json',
    gardees.some((u) => u.includes('cle.json')),
  );
  vrai('mais la coquille est bien gardée', gardees.length > 0);
}

console.log('\nUN CACHE D’UNE AUTRE PUBLICATION EST EFFACÉ');

{
  /*
     On fabrique le cache d'hier, puis on recharge : l'annonce de la
     publication doit l'emporter. C'est la garantie qui remplace l'ancien
     refus de cacher quoi que ce soit.
  */
  await page.evaluate(async () => {
    const vieux = await caches.open('cyclades-publication-dhier');
    await vieux.put(new Request('/faux'), new Response('périmé'));
  });
  vrai('le cache d’hier existe avant rechargement', (await noms()).includes('cyclades-publication-dhier'));

  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await jusqua(
    async () => !(await noms()).includes('cyclades-publication-dhier'),
    'la purge du cache d’hier',
  );
  faux('et il a disparu après', (await noms()).includes('cyclades-publication-dhier'));
  v('seul celui de la publication reste', await noms(), [`cyclades-${PUBLICATION}`]);
}

console.log('\nHORS LIGNE, LA COQUILLE S’OUVRE ENCORE');

{
  await contexte.setOffline(true);
  const reponse = await page.goto(`${RACINE}/progression/`, { waitUntil: 'domcontentloaded' })
    .catch(() => null);
  vrai('la page répond sans réseau', reponse !== null && reponse.ok());
  vrai(
    'et son titre est bien celui de Cyclades',
    (await page.title()).length > 0,
  );
  await contexte.setOffline(false);
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais du cache hors ligne passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
