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
import { apresLeChangementDeTexte, devientVisible } from './lib/post-condition.mjs';

const MDP = motDePasseEssais();

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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
  await devientVisible(page, '#champ-mdp', false, { delai: 30000 });
}
await page.locator('#accueil-session').waitFor({ state: 'visible', timeout: 30000 });
/*
   L'ATTENTE D'UNE ASSERTION NÉGATIVE SE PREND PAR SON COMPLÉMENT POSITIF,
   et ici le complément est l'opération même qu'on surveille.

   Les deux assertions qui suivent disent qu'AUCUNE fiche n'a été ouverte,
   et que les compteurs sont pourtant remplis. La première est négative :
   trop tôt, elle est vraie d'avance — et pour la pire des raisons, puisque
   le remplissage des compteurs, qui est précisément ce qui ne doit
   déchiffrer aucune fiche, n'a pas encore eu lieu. L'essai mesurerait
   l'absence d'un travail qui n'a pas commencé.

   On attend donc que le remplissage ait EU LIEU : le gabarit écrit « 0 »
   dans `#nb-neuves` (flashcards.astro:52), et `rafraichirCompteurs` y met
   le vrai nombre. Attendre qu'il dépasse zéro est un changement réel, et
   la fenêtre d'observation du négatif contient alors l'opération à
   surveiller.
*/
const compteursRemplis = (delai = 30000) =>
  page.waitForFunction(
    () => Number(document.getElementById('nb-neuves')?.textContent ?? '0') > 0,
    undefined,
    { timeout: delai },
  );
await compteursRemplis();
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
  /*
     LA PARADE, parce que les compteurs sont DÉJÀ remplis : les attendre
     tels quels les trouverait remplis d'avance, et l'assertion négative
     retomberait dans le travers d'au-dessus. On les efface donc soi-même
     AVANT le geste — effacer, agir, attendre —, puis on attend celui que
     `rafraichirCompteurs` réécrit.

     Un changement de matière appelle `majFascicules()` puis
     `rafraichirCompteurs()` (flashcards.astro:651). Rien d'autre n'est
     observable : le nombre peut légitimement être le même d'une matière à
     l'autre, donc attendre qu'il DIFFÈRE expirerait sans défaut. Ce qu'on
     peut affirmer, c'est qu'il est RÉÉCRIT.
  */
  await page.evaluate(() => {
    for (const id of ['nb-dues', 'nb-retard', 'nb-neuves', 'nb-acquises']) {
      const e = document.getElementById(id);
      if (e) e.textContent = '';
    }
  });
  await page.locator('#choix-matiere').selectOption({ index: 1 });
  await compteursRemplis();
}
v('aucune fiche ouverte', compteur(), 0);
v('les compteurs ont suivi la sélection', await compteurRempli(), true);

console.log('\nDÉMARRAGE — seulement ce qui est servi');
await page.evaluate(() => {
  for (const id of ['nb-dues', 'nb-retard', 'nb-neuves', 'nb-acquises']) {
    const e = document.getElementById(id);
    if (e) e.textContent = '';
  }
});
await page.locator('#choix-matiere').selectOption({ index: 0 });
await compteursRemplis();
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
const correct = page.getByRole('button', { name: /^Correct/ }).first();
await correct.waitFor({ state: 'visible', timeout: 30000 });
/*
   NOTER UNE CARTE FAIT AVANCER LE COMPTEUR DE SESSION : « 1/20 » devient
   « 2/20 ». C'est la post-condition de la note, et elle est strictement
   plus forte qu'un délai — si la note n'était pas prise, le compteur ne
   bougerait pas et l'attente accuserait ici, au lieu de laisser la seconde
   session mesurer autre chose que ce qu'elle croit.
*/
await apresLeChangementDeTexte(page, '#compteur', () => correct.click(), { delai: 30000 });
/* Quitter ramène à l'accueil, dont `#lancer` est le témoin : il n'existe
   pas pendant une session, donc son retour est un changement. */
await page.locator('#quitter').click();
await devientVisible(page, '#lancer', true, { delai: 30000 });
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
await devientVisible(page, '#lancer-libre', true, { delai: 30000 });
compteur = depuis();
await page.locator('#lancer-libre').click();
await page.locator('#carte').waitFor({ state: 'visible', timeout: 60000 });
console.log(`      ${compteur()} fiche(s) ouverte(s)`);
v('elle aussi reste économe', compteur() < 10, true);

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
process.exit(echecs ? 1 : 0);
