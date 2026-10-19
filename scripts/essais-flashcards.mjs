/**
 * Le coût d'une session de flashcards, par l'interface réelle.
 *
 * Le défaut corrigé ici était un défaut de **coût**, pas de résultat : la page
 * affichait les bons nombres, lançait les bonnes cartes, et déchiffrait pour
 * cela les 262 fiches du site — soit tout le contenu — à chaque ouverture et à
 * chaque changement de menu. Rien dans les essais ne pouvait le voir, puisque
 * tout était juste. D'où cet essai, qui compte les fiches réellement
 * téléchargées : c'est la seule chose qui distingue l'avant de l'après.
 *
 * Les seuils sont larges à dessein. Ils ne mesurent pas une performance, ils
 * interdisent un retour au chargement de masse.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext({ viewport: { width: 1100, height: 950 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

let echecs = 0;
const v = (t, o, a) => {
  const ok = JSON.stringify(o) === JSON.stringify(a);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${t}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(o)}, attendu ${JSON.stringify(a)}`);
};

let fiches = 0;
page.on('response', (r) => {
  if (/\/fiches\/[^/]+\.json/.test(r.url())) fiches += 1;
});
const depuis = () => {
  const debut = fiches;
  return () => fiches - debut;
};

await page.goto('http://localhost:4321/robots.txt');
await page.evaluate(
  () => new Promise((ok) => {
    const r = indexedDB.deleteDatabase('revinsp');
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  }),
);

console.log('\nOUVERTURE DE LA PAGE — rien ne doit être déchiffré');
let compteur = depuis();
await page.goto('http://localhost:4321/flashcards', { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
  await page.waitForTimeout(3000);
}
await page.locator('#accueil-session').waitFor({ state: 'visible', timeout: 30000 });
await page.waitForTimeout(1500);
v('aucune fiche ouverte', compteur(), 0);
/*
   LE COMPTEUR REGARDÉ A CHANGÉ DE SENS (prompt 43, F5), ET CET ESSAI SUIT.

   « #nb-dues » comptait les cartes exigibles, inédites comprises : sur une
   base neuve, il valait donc le site entier. Il dit maintenant « à revoir
   aujourd'hui », c'est-à-dire les cartes DÉJÀ VUES dont l'échéance tombe
   ce jour — zéro sur une base qui n'a jamais rien révisé, et c'est la
   vérité, pas un défaut.

   Ce que cet essai mesure n'a pas bougé d'un pouce : les compteurs se
   remplissent SANS déchiffrer une seule fiche. Sur une base neuve, celui
   qui porte ce nombre est « jamais révisées ».
*/
const compteurRempli = async () =>
  Number(await page.locator('#nb-neuves').textContent()) > 0;
v('les compteurs sont pourtant remplis', await compteurRempli(), true);

console.log('\nCHANGEMENT DE MENU — pas davantage');
compteur = depuis();
const matieres = await page.locator('#choix-matiere option').count();
if (matieres > 1) {
  await page.locator('#choix-matiere').selectOption({ index: 1 });
  await page.waitForTimeout(1500);
}
v('aucune fiche ouverte', compteur(), 0);
v('les compteurs ont suivi la sélection', await compteurRempli(), true);

console.log('\nDÉMARRAGE — seulement ce qui est servi');
await page.locator('#choix-matiere').selectOption({ index: 0 });
await page.waitForTimeout(800);
await page.locator('#choix-taille').selectOption('20');
/*
   LE PLAFOND NE PEUT PAS SERVIR PLUS QUE CE QUI EXISTE.

   L'assertion disait « /20 » en dur. Elle est donc fausse partout où la
   banque compte moins de vingt cartes — ce qui est le cas de tout
   conteneur d'essai, où « content/ » n'est qu'un échantillon : mesuré
   ici, treize cartes, et le compteur affiche « 1/13 ». Ce rouge-là ne
   vient pas du lot F ; il vient de l'environnement, et il attendait qu'on
   le regarde.

   Le plafond se vérifie contre ce qui est offert : la session sert vingt
   cartes, ou tout ce qu'il y a s'il y en a moins. Une file qui déborderait
   le plafond rougit toujours.
*/
const offertes =
  Number(await page.locator('#nb-dues').textContent()) +
  Number(await page.locator('#nb-retard').textContent()) +
  Number(await page.locator('#nb-neuves').textContent());
compteur = depuis();
const debut = Date.now();
await page.locator('#lancer').click();
await page.locator('#session').waitFor({ state: 'visible', timeout: 60000 });
await page.locator('#carte').waitFor({ state: 'visible', timeout: 60000 });
const ms = Date.now() - debut;
const ouvertes = compteur();
console.log(`      ${ouvertes} fiche(s) ouverte(s) en ${ms} ms`);
v('moins de dix fiches pour vingt cartes', ouvertes < 10, true);
v('moins de cinq secondes', ms < 5000, true);
v(
  'la session sert le plafond, ou tout ce qui existe si c’est moins',
  (await page.locator('#compteur').textContent())?.endsWith(`/${Math.min(20, offertes)}`),
  true,
);

console.log('\nUNE CARTE NOTÉE, PUIS UNE SECONDE SESSION');
await page.locator('#carte').click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /^Correct/ }).first().click();
await page.waitForTimeout(1200);
await page.locator('#quitter').click();
await page.waitForTimeout(800);
compteur = depuis();
const debut2 = Date.now();
await page.locator('#lancer').click();
await page.locator('#carte').waitFor({ state: 'visible', timeout: 60000 });
const ms2 = Date.now() - debut2;
console.log(`      ${compteur()} fiche(s) ouverte(s) en ${ms2} ms`);
v('le chemin des cartes déjà vues reste économe', compteur() < 10, true);
v('et rapide', ms2 < 5000, true);

console.log('\nRÉVISION HORS ÉCHÉANCE');
await page.locator('#quitter').click();
await page.waitForTimeout(800);
compteur = depuis();
await page.locator('#lancer-libre').click();
await page.locator('#carte').waitFor({ state: 'visible', timeout: 60000 });
console.log(`      ${compteur()} fiche(s) ouverte(s)`);
v('elle aussi reste économe', compteur() < 10, true);

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
process.exit(echecs ? 1 : 0);
