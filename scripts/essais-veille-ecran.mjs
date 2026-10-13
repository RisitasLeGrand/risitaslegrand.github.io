/**
 * L'écran du repère de rythme de vie, dans un vrai navigateur.
 *
 * Ce que cet essai couvre et que les essais purs ne peuvent pas couvrir :
 * que l'écran est **éteint par défaut**, que le coffre le garde, que les
 * ressources d'urgence s'affichent sans condition, et qu'aucun chiffre ne
 * s'affiche sur la carte alors que « Pourquoi ce repère » en porte.
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
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 220)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 220)}`);
};
const vrai = (t, c) => v(t, c, true);
const faux = (t, c) => v(t, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250)); });

const sorties = [];
await page.route('**/*', (route) => {
  const url = route.request().url();
  if (!url.startsWith(RACINE) && !url.startsWith('data:') && !url.startsWith('blob:')) sorties.push(url);
  return route.continue();
});

await franchirInitialisation(page, RACINE, MDP);

async function aller() {
  await page.goto(`${RACINE}/odyssee/veille/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });
}

console.log('\nLE COFFRE GARDE L’ÉCRAN, LA DOCUMENTATION RESTE LISIBLE');

await aller();
vrai('le coffre est fermé au départ', await page.locator('#coffre-ferme').isVisible());
faux('et les réglages sont hors d’atteinte', await page.locator('#coffre-ouvert').isVisible());
vrai('« Ce que la veille regarde » reste lisible sans le coffre',
  await page.locator('text=Ce que la veille regarde').isVisible());
vrai('« À propos » aussi',
  await page.getByRole('heading', { name: 'À propos' }).isVisible());

console.log('\nLES RESSOURCES SONT LÀ, SANS CONDITION');

{
  const numeros = await page.$$eval('[data-ressource]', (els) => els.map((e) => e.dataset.ressource));
  vrai('le 3114 est affiché, coffre fermé', numeros.includes('3114'));
  vrai('le 15 aussi', numeros.includes('15'));
  vrai('et le 112', numeros.includes('112'));
}

console.log('\nLES VINGT-TROIS REPÈRES SONT DÉCLARÉS, AVEC LEUR NIVEAU DE PREUVE');

{
  const declares = await page.$$eval('[data-indicateur]', (els) => els.map((e) => e.dataset.indicateur));
  v('vingt-trois repères', declares.length, 23);
  const texte = await page.textContent('#vue');
  faux('aucun n’est annoncé « solide »', /Solide —/.test(texte));
  vrai('les repères non alimentés sont signalés comme tels',
    texte.includes('pas encore alimenté'));
  vrai('le domaine d’appoint dit qu’il ne déclenche jamais',
    texte.includes('ne le déclenche jamais'));
}

console.log('\nAUCUN VOCABULAIRE DE DÉPISTAGE SUR L’ÉCRAN');

{
  /*
     Le contrôle porte sur les **textes fabriqués** — statut et carte —, pas
     sur la page entière. La distinction est volontaire : « il n'existe aucun
     taux de détection » est précisément la mise en garde qu'on veut lire, et
     interdire le mot partout obligerait à l'écrire en périphrase, c'est-à-dire
     à dire moins clairement la seule chose qui compte. C'est la même leçon
     que le contrôle de vocabulaire des finances, qui s'était piégé lui-même
     en refusant « aucun conseil en investissement ».
  */
  const fabrique = (
    (await page.textContent('#statut')) + (await page.textContent('#carte'))
  ).toLowerCase();
  for (const mot of ['dépist', 'détect', 'prévention', 'risque de', 'probabilité', 'alerte']) {
    faux(`« ${mot} » n’apparaît dans aucun texte fabriqué`, fabrique.includes(mot));
  }

  const page_entiere = (await page.textContent('body')).toLowerCase();
  vrai('« aucun diagnostic, aucun dépistage » est bien la mise en garde',
    page_entiere.includes('aucun diagnostic, aucun dépistage'));
  vrai('et l’absence de taux de détection est dite, pas tue',
    page_entiere.includes('aucun taux de détection'));
}

console.log('\nÉTEINTE PAR DÉFAUT');

await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });

faux('la case d’activation est décochée', await page.isChecked('#activer'));
faux('les réglages fins sont masqués', await page.locator('#reglages-actifs').isVisible());
vrai('le statut dit que rien n’est observé',
  (await page.textContent('#statut')).includes('désactivée'));
faux('aucune carte', await page.locator('#carte').isVisible());
vrai('et le journal dit que l’absence de repère ne vaut pas bulletin de santé',
  (await page.textContent('#aucun-repere')).includes('ne signifie pas que tout va bien'));

console.log('\nACTIVER NE SUFFIT PAS : IL FAUT DES DONNÉES');

await page.check('#activer');
await page.waitForFunction(
  () => !document.getElementById('reglages-actifs').classList.contains('hidden'),
  { timeout: 15000 },
);
vrai('les réglages fins apparaissent', await page.locator('#reglages-actifs').isVisible());
vrai('le statut annonce des données insuffisantes',
  (await page.textContent('#statut')).includes('insuffisantes'));
vrai('et nomme ce qui manque', await page.locator('#manques').isVisible());
faux('toujours aucune carte', await page.locator('#carte').isVisible());

console.log('\nLES TROIS SENSIBILITÉS, ET LA PAUSE');

{
  const choisi = async () =>
    page.$$eval('[data-sensibilite]', (els) =>
      els.filter((e) => e.dataset.choisi === 'true').map((e) => e.dataset.sensibilite));
  v('« standard » est le défaut', await choisi(), ['standard']);
  await page.click('[data-sensibilite="discrete"]');
  await page.waitForFunction(
    () => document.querySelector('[data-sensibilite="discrete"]').dataset.choisi === 'true',
    { timeout: 15000 });
  v('le choix se retient', await choisi(), ['discrete']);
  /*
     Et le choix relance réellement l'évaluation. Il ne la relançait pas : la
     règle « une évaluation par jour » bloquait, et l'écran répondait « la
     veille a déjà regardé aujourd'hui ». Un réglage sans effet visible est
     pire qu'un réglage absent.
  */
  faux('changer de sensibilité relance l’évaluation, au lieu d’attendre demain',
    (await page.textContent('#statut')).includes('déjà regardé'));
}

{
  await page.fill('#pause-jusquau', '2030-01-01');
  await page.click('#poser-pause');
  await page.waitForFunction(
    () => document.getElementById('statut').textContent.includes('pause'), { timeout: 15000 });
  vrai('la pause se pose et se dit', (await page.textContent('#statut')).includes('en pause'));
  await page.click('#lever-pause');
  await page.waitForFunction(
    () => !document.getElementById('statut').textContent.includes('pause'), { timeout: 15000 });
  faux('et se lève', (await page.textContent('#statut')).includes('en pause'));
}

console.log('\nLE REJEU NE TOUCHE À RIEN');

{
  const statutAvant = await page.textContent('#statut');
  await page.click('#rejouer');
  await page.waitForSelector('#rejeu-resultat:not(.hidden)', { timeout: 30000 });

  vrai('les trois réglages sont rejoués',
    (await page.$$eval('[data-rejeu]', (e) => e.map((x) => x.dataset.rejeu))).length === 3);
  vrai('sans historique, il le dit au lieu de rassurer',
    (await page.textContent('#rejeu-phrase')).includes('pas encore assez d’historique'));
  vrai('une empreinte comparable est affichée, en quatre groupes de quatre',
    /^[0-9A-F]{4}( · [0-9A-F]{4}){3}$/.test((await page.textContent('#rejeu-empreinte')).trim()));
  vrai('et ce qui en est écarté est nommé',
    (await page.textContent('#rejeu-ecartes')).includes('journal d’usage'));

  /*
     Le point qui vaut cet essai : le rejeu est une lecture. S'il écrivait
     quoi que ce soit — un repère, un « evalueeLe » avancé —, il deviendrait
     une façon détournée de recevoir des cartes en retard, et le statut
     changerait sous les yeux.
  */
  v('le statut n’a pas bougé', await page.textContent('#statut'), statutAvant);
  faux('aucune carte n’est apparue', await page.locator('#carte').isVisible());
  vrai('et le journal des repères est toujours vide',
    (await page.textContent('#aucun-repere')).includes('ne signifie pas'));
}

console.log('\nLA SYNTHÈSE MÉDECIN');

{
  faux('le téléchargement n’est proposé qu’une fois le document composé',
    await page.locator('#telecharger-synthese').isVisible());

  await page.click('#composer-synthese');
  await page.waitForSelector('#synthese:not(.hidden)', { timeout: 20000 });

  const sections = await page.$$eval('[data-section]', (e) => e.map((x) => x.dataset.section));
  v('les sept sections sont rendues', sections.length, 7);
  vrai('dont celle qui dit ce qui est tu',
    sections.includes('Ce que ce document ne contient pas'));

  const texte = await page.textContent('#synthese');
  vrai('le document dit qu’il ne dépiste rien', texte.includes('ne dépiste rien'));
  vrai('et qu’il n’existe ni sensibilité ni spécificité',
    texte.includes('ni sensibilité, ni spécificité'));
  vrai('et que l’absence de repère ne rassure pas',
    texte.includes('L’absence de repère ne signifie pas que tout va bien'));
  vrai('il porte des chiffres, à la différence de la carte', /\d/.test(texte));
  vrai('il nomme le réglage en vigueur', texte.includes('Réglage en vigueur'));
  faux('aucun score d’échelle n’y figure',
    texte.includes('PHQ') || texte.includes('GAD') || texte.includes('WHO-5'));

  vrai('l’enregistrement est maintenant proposé',
    await page.locator('#telecharger-synthese').isVisible());

  // Composer deux fois ne doit pas empiler deux documents.
  await page.click('#composer-synthese');
  await page.waitForTimeout(500);
  v('composer deux fois ne duplique rien',
    (await page.$$eval('[data-section]', (e) => e.length)), 7);
}

console.log('\nÉTEINDRE N’EFFACE RIEN ET NE RATTRAPE RIEN');

await page.uncheck('#activer');
await page.waitForFunction(
  () => document.getElementById('statut').textContent.includes('désactivée'), { timeout: 15000 });
vrai('le message le dit explicitement',
  (await page.textContent('#reglages-dit')).includes('rien ne sera rattrapé'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });
await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });
faux('après rechargement, la veille est toujours éteinte', await page.isChecked('#activer'));

console.log('\nRIEN N’EST SORTI DU SITE');
v('aucune requête extérieure', sorties, []);

console.log(echecs ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m` : '\n\x1b[32m✓ tout passe\x1b[0m');
await nav.close();
process.exit(echecs ? 1 : 0);
