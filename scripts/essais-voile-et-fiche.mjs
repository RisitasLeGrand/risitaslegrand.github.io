/**
 * Le voile et la fiche « mot de passe perdu ».
 *
 * Deux garde-fous de nature opposée, et le même défaut en face : une
 * protection qui ne s'applique pas au moment où elle servirait.
 *
 * - **Le voile** doit couvrir la page dès qu'elle cesse d'être au premier
 *   plan. Un voile qui n'arrive qu'au retour ne cache rien : c'est la
 *   vignette du sélecteur d'applications qu'il s'agit de noircir.
 * - **La fiche** doit se lire SANS le mot de passe. Une notice de secours
 *   enfermée derrière ce dont elle explique la sortie est le piège classique,
 *   et il ne se voit qu'en essayant de l'ouvrir fermé.
 *
 * ## Ce que l'essai ne prouve pas
 *
 * Il mesure le voile sur un onglet mis en arrière-plan par le navigateur de
 * pilotage. Il ne mesure pas — et ne peut pas mesurer ici — si le système
 * d'un téléphone prend sa vignette avant ou après. Cette limite est écrite
 * dans le module et dans la fiche ; l'essai ne la contredit pas, il ne
 * l'atteint pas.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const BASE = 'http://localhost:4321';
const MDP = process.env.SITE_PASSWORD;
if (!MDP) {
  console.error('SITE_PASSWORD manquant.');
  process.exit(1);
}

let echecs = 0;
const verifier = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
process.on('uncaughtException', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

/* ══════════════════════════════════════════════════════════════════════════
   Le voile
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLE VOILE SUR L’ÉCRAN QUITTÉ');

await page.goto(`${BASE}/progression/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const etatDuVoile = () =>
  page.evaluate(() => {
    const v = document.getElementById('voile-confidentialite');
    return {
      present: Boolean(v),
      opaque: v ? getComputedStyle(v).backgroundColor : null,
      visibilite: document.visibilityState,
    };
  });

const auDepart = await etatDuVoile();
verifier('prémisse : la page est au premier plan', auDepart.visibilite, 'visible');
verifier('et elle n’est pas voilée', auDepart.present, false);

/*
   Ici une limite du banc, et il faut la dire avant la mesure.

   On voulait passer la page en arrière-plan pour de vrai, en amenant un
   second onglet devant. Mesuré : le navigateur de pilotage, en mode sans
   affichage, garde TOUS ses onglets à « visible » — « bringToFront » ne
   bascule rien. La garde de prémisse l'a signalé, et sans elle les trois
   lignes suivantes auraient été vertes en ne prouvant rien du tout.

   On simule donc ce que fait le navigateur quand la page part en
   arrière-plan : l'état « hidden », puis l'événement. Ce que cet essai
   éprouve est donc le **branchement et la pose du voile**, pas la promesse
   du navigateur d'émettre « visibilitychange » — celle-là est au standard,
   et ce n'est pas à moi de la vérifier.
*/
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(400);

const enArriere = await etatDuVoile();
verifier('prémisse : la page se dit cachée', enArriere.visibilite, 'hidden');
verifier('le voile couvre l’écran quitté', enArriere.present, true);
console.log(`      fond du voile : ${enArriere.opaque}`);
verifier(
  'et il est opaque, pas translucide',
  enArriere.opaque !== null && !/rgba\([^)]*,\s*0?\.\d+\)/.test(enArriere.opaque),
  true,
);

await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(400);
const auRetour = await etatDuVoile();
verifier('au retour, la page se dit visible', auRetour.visibilite, 'visible');
verifier('et le voile s’est retiré', auRetour.present, false);

/*
   Et le second chemin, celui de la perte de focus : sur un ordinateur, passer
   à une autre fenêtre ne change pas toujours la visibilité, mais émet
   toujours « blur ». Deux chemins pour un même geste, parce qu'aucun des deux
   ne couvre tous les systèmes.
*/
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(300);
verifier('la perte de focus voile aussi', (await etatDuVoile()).present, true);
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
await page.waitForTimeout(300);
verifier('et le retour du focus dévoile', (await etatDuVoile()).present, false);

/* ══════════════════════════════════════════════════════════════════════════
   La fiche « mot de passe perdu »
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLA FICHE SE LIT SANS LE MOT DE PASSE');

/*
   Un contexte neuf, donc aucune clé mémorisée : c'est l'état de quelqu'un qui
   n'arrive pas à entrer. Sans ce contexte neuf, l'essai lirait la fiche avec
   une session déjà ouverte et ne prouverait rien.
*/
const ctxFerme = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const fermee = await ctxFerme.newPage();

await fermee.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await fermee.waitForTimeout(1200);
verifier(
  'prémisse : sans mot de passe, l’écran d’entrée est bien affiché',
  await fermee.evaluate(() => {
    const e = document.getElementById('ecran-verrou');
    return Boolean(e) && !e.classList.contains('hidden');
  }),
  true,
);
verifier(
  'et il porte le lien « Mot de passe perdu ? »',
  await fermee.evaluate(() =>
    [...document.querySelectorAll('#ecran-verrou a')].some((a) =>
      /Mot de passe perdu/.test(a.textContent ?? ''),
    ),
  ),
  true,
);

await fermee.click('#ecran-verrou a');
await fermee.waitForLoadState('networkidle');
await fermee.waitForTimeout(1000);

verifier(
  'la fiche s’ouvre sans qu’on ait saisi quoi que ce soit',
  await fermee.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? ''),
  'Mot de passe perdu',
);
verifier(
  'aucun écran de verrou ne la recouvre',
  await fermee.evaluate(() => Boolean(document.getElementById('ecran-verrou'))),
  false,
);
verifier(
  'et son texte est bien là, pas une coquille vide',
  await fermee.evaluate(() => (document.body.textContent ?? '').length > 2000),
  true,
);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
