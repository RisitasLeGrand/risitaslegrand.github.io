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
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaBoite, repondreAuChamp } from './lib/boite-essais.mjs';
import { BRANCHES } from '../src/lib/branches.ts';

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
const vrai = (titre, condition) => v(titre, condition, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

/*
   PLUS AUCUNE FENÊTRE NATIVE — section C du prompt 43.

   « Mon profil » saisissait par `window.prompt` et confirmait par
   `window.confirm`. Les deux sont remplacés par la boîte commune
   (`src/lib/boite.ts`), un `<dialog>` ouvert en modal : on y répond par le
   VERBE du bouton, via `scripts/lib/boite-essais.mjs`.

   Le guetteur ci-dessous ne répond plus à la place de l'écran : il signale
   une fenêtre native qui reparaîtrait. Elle arrêterait le modal attendu, et
   l'essai expirerait dix lignes plus loin sans dire pourquoi.
*/
let fenetresNatives = 0;
page.on('dialog', async (d) => {
  fenetresNatives += 1;
  console.log(`FENÊTRE NATIVE INATTENDUE (${d.type()}) : ${d.message().slice(0, 120)}`);
  await d.dismiss().catch(() => undefined);
});

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

/*
   L'initialisation d'abord : depuis la phase C, une base vierge y mène avant de
   voir le menu. Cet essai mesure le menu et « Mon profil », pas la garde — qui
   a ses propres essais.
*/
await franchirInitialisation(page, RACINE, MDP);

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
  /*
     LE COMPTE VIENT DU REGISTRE, PAS D'UN CHIFFRE RECOPIÉ.

     L'essai figeait « trois ». La quatrième branche — Entraînement cognitif,
     consigne du pilote du 18/10 — l'a mis au rouge, alors que le menu la
     proposait correctement : l'essai mesurait la mémoire de son auteur, pas
     l'écran. La référence est donc `BRANCHES`, qui est ce que le menu peint,
     et le contrôle refuse de juger si elle revient vide.
  */
  const attendues = BRANCHES.map((b) => b.id).sort();
  const ouvertes = BRANCHES.filter((b) => b.disponible).map((b) => b.id).sort();
  vrai('le registre des branches a bien été lu', attendues.length > 0);
  v('le menu propose toutes les branches du registre', cartes.map((c) => c.branche).sort(), attendues);
  /*
     Odyssée et Sport se sont ouvertes le 12 octobre 2026, Entraînement
     cognitif est née ouverte. Les branches `disponible` sont donc cliquables,
     et l'essai le vérifie plutôt que de le supposer : c'est exactement la
     ligne qui a rattrapé l'ouverture d'Odyssée, quand les écrans existaient
     et que la navigation n'y menait pas.
  */
  v(
    'les branches ouvertes du registre sont cliquables',
    cartes.filter((c) => c.cliquable).map((c) => c.branche).sort(),
    ouvertes,
  );
  vrai(
    'aucune n’annonce plus « Bientôt »',
    cartes.every((c) => !c.texte.includes('Bientôt')),
  );
  vrai(
    'et Sport est bien un lien',
    await page.evaluate(() => !!document.querySelector('a[data-branche="sport"]')),
  );

  // Aucune donnée personnelle : ni XP, ni série, ni carte de séance.
  const texte = await page.locator('main').textContent();
  vrai('aucune XP au menu', !/\bXP\b/.test(texte));
  vrai('aucune série', !/série/i.test(texte));
  vrai('aucune carte due', !/carte/i.test(texte));
  v('la salutation est neutre tant que le prénom est inconnu', (await page.textContent('#salutation')).trim(), 'Bonjour.');

  /*
     Dans `main`, et non dans la page entière : le pied de page est devenu un
     plan du site et porte lui aussi un lien « Mon profil ». Chercher partout
     en trouverait deux, et l'essai échouerait pour une raison qui n'est pas
     celle qu'il mesure — le menu doit mener au profil, pas être seul à le
     faire.
  */
  vrai('le menu mène à « Mon profil »', await page.locator('main a[href$="/profil/"]').isVisible());
  vrai('aux appareils', await page.locator('main a[href$="/appareils/"]').isVisible());
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

/*
   LE TOTAL EST LU UNE FOIS, PUIS COMPARÉ À LUI-MÊME.

   L'essai figeait dix-sept. Le socle en compte dix-huit depuis que l'année de
   naissance s'est ajoutée, et l'essai est passé au rouge sans qu'aucun écran
   ait cessé de marcher. Ce qui compte n'est pas le chiffre, c'est l'ACCORD
   entre les deux endroits qui l'annoncent : la phrase d'avancement et la liste
   des restants. Un socle qui grandit n'a plus à faire rougir l'essai ; une
   liste qui diverge de sa phrase, si.

   Le mois, la majorité déclarée et les usages coupés ne sont toujours pas des
   questions : ils se demandent au moment du besoin, et les compter rendrait le
   total inatteignable.
*/
let socle = 0;
{
  const avancement = await page.textContent('#avancement');
  const annonce = avancement.match(/0 réponse\(s\) sur (\d+)/);
  vrai('l’avancement est annoncé, et il annonce un total', !!annonce);
  socle = annonce ? Number(annonce[1]) : 0;
  vrai('le total annoncé n’est pas nul', socle > 0);
  vrai('et le prénom est signalé comme attendu', avancement.includes('prénom'));
  const restants = await page.$$eval('#restants > div', (els) => els.length);
  v('autant de questions à poser que le total annoncé', restants, socle);
}

await page.locator('#restants button', { hasText: 'Renseigner' }).first().click();
await repondreAuChamp(page, 'Alexis', 'Enregistrer');
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
  v('une question de moins reste à poser', restants, socle - 1);
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

await page
  .locator('#champs > div[data-champ="prenom"] button', { hasText: 'Supprimer' })
  .first()
  .click();
await repondreALaBoite(page, 'Supprimer ce champ');
await page.waitForTimeout(1500);

{
  const champs = await page.$$eval('#champs > div', (els) => els.length);
  v('plus aucun champ renseigné', champs, 0);
  vrai('l’écran le dit', await page.locator('#aucun-champ').isVisible());
  const restants = await page.$$eval('#restants > div', (els) => els.length);
  v('et tout le socle est à nouveau à poser', restants, socle);

  await aller('/', '#salutation');
  v('le menu ne salue plus par le prénom', (await page.textContent('#salutation')).trim(), 'Bonjour.');
}

v('aucune fenêtre native n’a été ouverte', fenetresNatives, 0);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais de profil en navigateur passent.\x1b[0m\n',
);
await nav.close();
process.exit(echecs ? 1 : 0);
