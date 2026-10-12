/**
 * Le menu de garde et « Mon profil », en navigateur.
 *
 * Ce que cet essai couvre : que la racine soit bien un **menu** et non le
 * tableau de bord de Révisions, que l'accueil de Révisions ait suivi à
 * `/revisions/`, que le menu n'affiche **aucune** donnée personnelle hors le
 * prénom, qu'un champ de profil se pose, se restreigne et se supprime, et que
 * la salutation suive.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
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

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

/**
 * La réponse à la prochaine invite du navigateur.
 *
 * L'écran « Mon profil » saisit par `window.prompt` et confirme par
 * `window.confirm` — assumé et provisoire, l'écran d'initialisation portera les
 * vrais champs. Playwright referme toute boîte par défaut, ce qui vaudrait
 * « annuler » : l'essai répond donc explicitement, et l'oubli se verrait.
 */
let reponse = null;
page.on('dialog', async (d) => {
  if (d.type() === 'prompt') await d.accept(reponse ?? '');
  else if (reponse === false) await d.dismiss();
  else await d.accept();
});

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

console.log('\nLA RACINE EST UN MENU, PAS UNE BRANCHE');

await aller('/', '[data-branche="revisions"]');

{
  const cartes = await page.$$eval('[data-branche]', (els) =>
    els.map((e) => ({
      branche: e.dataset.branche,
      cliquable: e.tagName === 'A',
      texte: e.textContent.replace(/\s+/g, ' ').trim(),
    })),
  );
  v('trois branches sont proposées', cartes.length, 3);
  v(
    'Révisions est la seule ouverte',
    cartes.filter((c) => c.cliquable).map((c) => c.branche),
    ['revisions'],
  );
  vrai(
    'les deux autres annoncent « Bientôt »',
    cartes.filter((c) => !c.cliquable).every((c) => c.texte.includes('Bientôt')),
  );
  vrai(
    'et elles ne sont pas des liens',
    await page.evaluate(
      () => !document.querySelector('a[data-branche="sport"], a[data-branche="odyssee"]'),
    ),
  );

  // Aucune donnée personnelle : ni XP, ni série, ni carte de séance.
  const texte = await page.locator('main').textContent();
  vrai('aucune XP au menu', !/\bXP\b/.test(texte));
  vrai('aucune série', !/série/i.test(texte));
  vrai('aucune carte due', !/carte/i.test(texte));
  v('la salutation est neutre tant que le prénom est inconnu', (await page.textContent('#salutation')).trim(), 'Bonjour.');

  vrai('le menu mène à « Mon profil »', await page.locator('a[href$="/profil/"]').isVisible());
  vrai('aux appareils', await page.locator('a[href$="/appareils/"]').isVisible());
}

console.log('\nL’ACCUEIL DE RÉVISIONS A SUIVI À /revisions/');

await page.click('a[data-branche="revisions"]');
await page.waitForSelector('#seance-titre', { timeout: 40000 });
v('la branche s’ouvre sur son tableau de bord', new URL(page.url()).pathname, '/revisions/');
vrai(
  'et l’en-tête ramène au menu',
  await page.locator('header a[href="/"]').first().isVisible(),
);
await page.click('header a[href="/"]');
await page.waitForSelector('[data-branche="revisions"]', { timeout: 40000 });
v('le menu revient', new URL(page.url()).pathname, '/');

console.log('\nUN CHAMP SE POSE, ET LA SALUTATION SUIT');

await aller('/profil/', '#avancement');

{
  const avancement = await page.textContent('#avancement');
  vrai('l’avancement est annoncé', avancement.includes('0 réponse(s) sur 16'));
  vrai('et le prénom est signalé comme attendu', avancement.includes('prénom'));
  const restants = await page.$$eval('#restants > div', (els) => els.length);
  v('les seize champs du socle restent à poser', restants, 16);
}

reponse = 'Alexis';
await page.locator('#restants button', { hasText: 'Renseigner' }).first().click();
await page.waitForTimeout(1500);

{
  const champs = await page.$$eval('#champs > div', (els) =>
    els.map((e) => ({ champ: e.dataset.champ, texte: e.textContent.replace(/\s+/g, ' ') })),
  );
  v('le prénom est désormais renseigné', champs.map((c) => c.champ), ['prenom']);
  vrai('avec sa valeur', champs[0].texte.includes('Alexis'));
  vrai('déclaré, et en version 1', champs[0].texte.includes('déclaré') && champs[0].texte.includes('version 1'));
  vrai(
    'et l’écran dit qu’aucune branche ne le lit',
    champs[0].texte.includes('aucune branche'),
  );
  const restants = await page.$$eval('#restants > div', (els) => els.length);
  v('quinze champs restent', restants, 15);
}

await aller('/', '#salutation');
v('le menu salue par le prénom', (await page.textContent('#salutation')).trim(), 'Bonjour Alexis.');

console.log('\nLA PORTÉE SE RESTREINT, ET ELLE TIENT');

await aller('/profil/', '#champs > div');

{
  // On ouvre le prénom à Révisions : la case de cette branche se coche.
  const case_ = page.locator('#champs > div[data-champ="prenom"] input[data-branche="revisions"]');
  v('la case de Révisions est décochée au départ', await case_.isChecked(), false);
  await case_.check();
  await page.waitForTimeout(1500);
  v('elle reste cochée après repeinture', await case_.isChecked(), true);

  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#champs > div', { timeout: 40000 });
  const apres = page.locator('#champs > div[data-champ="prenom"] input[data-branche="revisions"]');
  v('et après rechargement, la portée a bien été enregistrée', await apres.isChecked(), true);
  const texte = await page.textContent('#champs');
  vrai('l’écran nomme désormais Révisions comme lectrice', texte.includes('Utilisé par : Révisions'));
  vrai('et la version a augmenté', texte.includes('version 2'));
}

console.log('\nUN CHAMP SE SUPPRIME, ET REVIENT DANS LES RESTANTS');

reponse = true;
await page.locator('#champs > div[data-champ="prenom"] button', { hasText: 'Supprimer' }).click();
await page.waitForTimeout(1500);

{
  const champs = await page.$$eval('#champs > div', (els) => els.length);
  v('plus aucun champ renseigné', champs, 0);
  vrai('l’écran le dit', await page.locator('#aucun-champ').isVisible());
  const restants = await page.$$eval('#restants > div', (els) => els.length);
  v('et les seize champs sont à nouveau à poser', restants, 16);

  await aller('/', '#salutation');
  v('le menu ne salue plus par le prénom', (await page.textContent('#salutation')).trim(), 'Bonjour.');
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de profil en navigateur passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
