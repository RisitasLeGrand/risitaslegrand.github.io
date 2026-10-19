/**
 * Le mot de passe est-il vraiment redemandé avant ce qu'on ne rattrape pas ?
 *
 * ## Le défaut visé
 *
 * Trois gestes sans retour ne demandaient qu'un clic : l'effacement de tout le
 * profil, l'effacement ciblé sans sauvegarde, et l'export en clair. Un
 * `window.confirm` protège de la maladresse et de rien d'autre.
 *
 * ## Ce que cet essai fait, et pourquoi ainsi
 *
 * Il n'inspecte pas la page à la recherche d'un dialogue : il **essaie de
 * détruire**, et regarde si quelque chose a été détruit. Un essai qui se
 * contenterait de voir le dialogue apparaître serait vert même si le bouton
 * effaçait d'abord et demandait ensuite.
 *
 * La prémisse est posée à chaque fois : on vérifie qu'il y a quelque chose à
 * perdre avant d'essayer de le perdre. Un profil vide « résisterait » à tous
 * les effacements du monde sans rien prouver.
 */
import { chromium } from 'playwright-core';
import { repondreAuChamp } from './lib/boite-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

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

const nav = await chromium.launch({ executablePath: cheminDuNavigateur() });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

/** Le dialogue de redemande est-il ouvert ? */
const dialogueOuvert = () => page.evaluate(() => Boolean(document.querySelector('dialog[open]')));

/** Saisir dans le dialogue et valider. */
const repondre = async (motDePasse) => {
  await page.fill('dialog[open] input[type="password"]', motDePasse);
  await page.click('dialog[open] button[type="submit"]');
  await page.waitForTimeout(2500);
};

const renoncer = () => page.click('dialog[open] button:not([type="submit"])');

/* ══════════════════════════════════════════════════════════════════════════
   Première scène : l'effacement de tout le profil
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nL’EFFACEMENT DU PROFIL');

await page.goto(`${BASE}/profil/`, { waitUntil: 'networkidle' });

/*
   La prémisse : un profil qui porte au moins un champ. On le pose par l'écran
   lui-même — « Renseigner » sur le premier champ non rempli, dont la question
   passe par une invite du navigateur — et non par une écriture en base : un
   essai qui passe par la porte de service cesse de remarquer que la porte
   principale est cassée.

   Première version fausse, et elle mérite d'être dite : elle cochait
   « réduire les animations », en croyant à un champ de profil. C'est un
   réglage de localStorage. La prémisse était donc fausse, le profil restait
   vide, et « le profil est bien effacé » passait sur un profil qui n'avait
   jamais rien contenu. C'est la garde « le profil n'est pas vide » qui l'a
   signalé.
*/
await page.waitForSelector('#restants button', { timeout: 20000 });
await page.locator('#restants button').first().click();
/*
   LA SAISIE PASSE PAR UN CHAMP, PLUS PAR UN « PROMPT » (C2 du 43).

   « Renseigner » ouvrait un `prompt()` natif, que cet essai remplissait par
   « d.accept('Essai') ». Les deux `prompt()` du site sont devenus des champs
   dans la boîte commune, avec une étiquette visible et non un texte
   d'invite. L'essai ne remplissait donc plus rien : la prémisse « le profil
   n'est pas vide » tombait, et la boîte restée ouverte arrêtait le clic
   suivant sur « Effacer mon profil ».

   C'est exactement le défaut que cette garde a été écrite pour attraper,
   une première fois le 17 octobre : « le profil est bien effacé » peut
   passer sur un profil qui n'a jamais rien contenu.
*/
await repondreAuChamp(page, 'Essai', 'Enregistrer');
await page.waitForTimeout(2500);
const profilVide = () =>
  page.evaluate(() => {
    const e = document.getElementById('aucun-champ');
    return !e || e.classList.contains('hidden') === false;
  });
verifier('prémisse : le profil n’est pas vide', await profilVide(), false);

await page.click('#effacer-profil');
await page.waitForTimeout(600);
verifier('le clic ouvre une redemande au lieu d’effacer', await dialogueOuvert(), true);
verifier('et rien n’a encore été effacé', await profilVide(), false);

await renoncer();
await page.waitForTimeout(600);
verifier('renoncer referme le dialogue', await dialogueOuvert(), false);
verifier('et n’efface rien', await profilVide(), false);

await page.click('#effacer-profil');
await page.waitForTimeout(600);
await repondre(`${MDP}-faux`);
verifier('un mot de passe faux laisse le dialogue ouvert', await dialogueOuvert(), true);
verifier('et n’efface rien', await profilVide(), false);
const refus = await page.textContent('dialog[open] [role="alert"]');
console.log(`      message du refus : ${refus}`);
verifier('le refus dit que rien n’a été fait', /Rien n’a été fait/.test(refus ?? ''), true);

await repondre(MDP);
verifier('le bon mot de passe referme le dialogue', await dialogueOuvert(), false);
verifier('et le profil est bien effacé', await profilVide(), true);

/* ══════════════════════════════════════════════════════════════════════════
   Deuxième scène : l'export en clair
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nL’EXPORT EN CLAIR');

await page.goto(`${BASE}/stockage/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const domaines = await page.locator('input[name="groupe-export"]').count();
verifier('prémisse : il y a des domaines exportables', domaines > 0, true);
await page.locator('input[name="groupe-export"]').first().check();

await page.click('#exporter-csv');
await page.waitForTimeout(600);
verifier('l’export ouvre une redemande', await dialogueOuvert(), true);

/*
   Le vrai test : un mot de passe faux ne doit produire AUCUN fichier. On
   écoute les téléchargements pendant la tentative, et l'absence est ici la
   preuve — raison pour laquelle on vérifie juste après qu'un bon mot de passe,
   lui, en produit un. Sans cette seconde moitié, « aucun fichier » pourrait
   simplement vouloir dire que l'export est cassé.
*/
let fichiers = 0;
page.on('download', () => {
  fichiers += 1;
});
await repondre(`${MDP}-faux`);
verifier('un mot de passe faux ne produit aucun fichier', fichiers, 0);
verifier('et le dialogue reste ouvert', await dialogueOuvert(), true);

await renoncer();
await page.waitForTimeout(500);
verifier('renoncer ne produit aucun fichier non plus', fichiers, 0);
verifier(
  'et l’écran le dit',
  /Rien n’a été exporté/.test((await page.textContent('#message-export')) ?? ''),
  true,
);

await page.click('#exporter-csv');
await page.waitForTimeout(600);
await repondre(MDP);
await page.waitForTimeout(4000);
verifier('le bon mot de passe produit bien un fichier', fichiers >= 1, true);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
