/**
 * L'écran « Qui lit mon budget », dans un vrai navigateur — phase 4.
 *
 * Ce que les essais purs ne peuvent pas dire, et qui est tout l'intérêt de
 * cet écran : que l'aperçu affiché **est** la projection, et pas une
 * paraphrase écrite à côté. Une promesse de confidentialité vérifiée sur un
 * module mais démentie par l'écran qui la montre ne vaudrait rien.
 *
 * Il vérifie aussi les deux choses que le plan impose et qu'un écran de
 * permissions rate presque toujours : que les réglages survivent au
 * rechargement, et qu'un lecteur fermé n'affiche pas « rien » tout en
 * calculant quand même.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
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
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 280)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 280)}`);
};
const vrai = (t, c) => v(t, c, true);
const faux = (t, c) => v(t, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 300)); });

const sorties = [];
await page.route('**/*', (r) => {
  const u = r.request().url();
  if (!u.startsWith(RACINE) && !u.startsWith('data:') && !u.startsWith('blob:')) sorties.push(u);
  return r.continue();
});

await franchirInitialisation(page, RACINE, MDP);

async function aller() {
  await page.goto(`${RACINE}/odyssee/qui-lit-mon-budget/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });
}

/*
   Le coffre reste ouvert d'une page à l'autre dans le même onglet : c'est
   voulu, et c'est pourquoi on ne ressaisit le mot de passe que si le bloc
   est encore là. Le ressaisir aveuglément faisait échouer l'essai sur un
   comportement parfaitement correct.
*/
async function ouvrirSiBesoin() {
  if (!(await page.locator('#pour-les-apercus').isVisible().catch(() => false))) return;
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  await page.waitForTimeout(1500);
}

await aller();

console.log('\nLES SEPT LIGNES, ET CE QU’ELLES PROMETTENT');

{
  const ids = await page.$$eval('[data-consommateur]', (e) => e.map((x) => x.dataset.consommateur));
  v('les sept consommateurs sont là', ids,
    ['agenda', 'quoiMaintenant', 'objectifs', 'habitudes', 'quetes', 'veille', 'ia']);
  const promesses = await page.$$eval('[data-voit]', (e) => e.map((x) => x.textContent.trim()));
  vrai('chacun dit ce qu’il voit', promesses.every((p) => p.length > 10));
  vrai('les habitudes annoncent « Aucun montant »',
    promesses.some((p) => p.includes('Aucun montant')));
  vrai('la veille dit « Jamais un écart au budget »',
    promesses.some((p) => p.includes('Jamais un écart au budget')));
  vrai('et l’IA dit « sauf si vous cochez à chaque fois »',
    promesses.some((p) => p.includes('à chaque fois')));
}

console.log('\nLES INTERRUPTEURS SE RÈGLENT SANS LE COFFRE');

{
  vrai('le coffre est encore fermé', await page.locator('#pour-les-apercus').isVisible());
  const etats = await page.$$eval('[data-interrupteur]', (e) =>
    e.map((x) => [x.dataset.interrupteur, x.checked]));
  v('les cinq premiers sont ouverts, les deux derniers fermés', etats,
    [['agenda', true], ['quoiMaintenant', true], ['objectifs', true],
     ['habitudes', true], ['quetes', true], ['veille', false], ['ia', false]]);
  vrai('et les cases sont manipulables coffre fermé',
    await page.locator('[data-interrupteur="agenda"]').isEnabled());
}

{
  /* L'aperçu, lui, demande le coffre — et le dit au lieu de rester vide. */
  await page.click('[data-apercu="agenda"]');
  const texte = await page.textContent('[data-zone-apercu="agenda"]');
  vrai('l’aperçu dit qu’il faut le coffre', texte.includes('Ouvrez le coffre'), texte);
  vrai('en précisant que l’interrupteur, lui, n’en a pas besoin',
    texte.includes('se règle sans'), texte);
}

console.log('\nUN RÉGLAGE SURVIT AU RECHARGEMENT');

await ouvrirSiBesoin();

{
  faux('le coffre ouvert, le bloc disparaît', await page.locator('#pour-les-apercus').isVisible());
  await page.uncheck('[data-interrupteur="agenda"]');
  await page.check('[data-interrupteur="veille"]');
  await page.waitForTimeout(1200);
  await aller();
  await ouvrirSiBesoin();
  const etats = await page.$$eval('[data-interrupteur]', (e) =>
    e.map((x) => [x.dataset.interrupteur, x.checked]));
  v('l’agenda est resté fermé', etats.find((e) => e[0] === 'agenda'), ['agenda', false]);
  v('et la veille ouverte', etats.find((e) => e[0] === 'veille'), ['veille', true]);
  v('les autres n’ont pas bougé', etats.find((e) => e[0] === 'quetes'), ['quetes', true]);
}

console.log('\nUN LECTEUR FERMÉ NE REÇOIT RIEN, ET LE MONTRE');

{
  await page.click('[data-apercu="agenda"]');
  await page.waitForTimeout(400);
  const texte = await page.textContent('[data-zone-apercu="agenda"]');
  vrai('l’aperçu d’un lecteur fermé dit « Rien »', texte.includes('Rien.'), texte);
  vrai('et dit qu’aucune donnée n’est calculée',
    texte.includes('aucune donnée ne lui est calculée'), texte);
  vrai('le marqueur est posé',
    (await page.$$eval('[data-rien]', (e) => e.length)) > 0);
}

console.log('\nUN LECTEUR SANS MONTANT N’EN MONTRE AUCUN');

{
  /*
     Le cœur de l'écran : « Habitudes » promet « Aucun montant ». L'aperçu
     affiche ce qu'il reçoit réellement, et on y cherche un symbole d'euro.
  */
  await page.click('[data-apercu="habitudes"]');
  await page.waitForTimeout(400);
  const texte = await page.textContent('[data-zone-apercu="habitudes"]');
  faux('aucun euro dans l’aperçu des habitudes', texte.includes('€'));
  vrai('mais il dit quelque chose', texte.length > 30, texte);
  vrai('et il explique que c’est la forme qui le garantit',
    (await page.$$eval('[data-sans-montant]', (e) => e.map((x) => x.dataset.sansMontant)))
      .includes('habitudes'));

  await page.click('[data-apercu="veille"]');
  await page.waitForTimeout(400);
  const veille = await page.textContent('[data-zone-apercu="veille"]');
  faux('aucun euro dans l’aperçu de la veille', veille.includes('€'));
  vrai('et elle annonce qu’elle ne compare pas au budget',
    veille.includes('aucune comparaison au budget'), veille);

  await page.click('[data-apercu="quoiMaintenant"]');
  await page.waitForTimeout(400);
  const quoi = await page.textContent('[data-zone-apercu="quoiMaintenant"]');
  faux('ni dans « Que faire maintenant »', quoi.includes('€'));
  vrai('qui ne dit qu’un nombre', /\d+ opération/.test(quoi), quoi);
}

console.log('\nLES DEUX RÈGLES QUI NE SE RÈGLENT PAS SONT ÉCRITES');

{
  const texte = await page.textContent('#vue');
  vrai('le budget serré est un choix, pas un signal de santé',
    texte.includes('Un budget serré est un choix'), '');
  vrai('et l’accord de janvier ne couvre pas novembre',
    texte.includes('ne peut pas couvrir un envoi fait en novembre'), '');
}

console.log('\nRIEN NE SORT DU SITE');
v('aucune requête externe', sorties, []);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de « Qui lit mon budget » passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
