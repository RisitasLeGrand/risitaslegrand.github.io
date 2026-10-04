/**
 * Le prétest de positionnement, par l'interface réelle.
 *
 * Les essais hors navigateur couvrent le calcul : périmètres, fraîcheur du
 * tirage, justesse, bande de zone proximale. Ce qu'ils ne peuvent pas couvrir,
 * et qui est précisément ce qui a cassé une fois déjà sur le prétest de fiche,
 * c'est la chaîne complète : déchiffrement de plusieurs fiches, écriture dans
 * IndexedDB, et surtout **l'endroit** où la mesure atterrit.
 *
 * L'invariant central est vérifié ici et nulle part ailleurs :
 *
 *  - une note d'entrée est écrite, aux trois portées ;
 *  - aucun niveau acquis n'est créé — sinon chaque positionnement ferait
 *    silencieusement baisser le niveau affiché, puisqu'un prétest échoue par
 *    construction ;
 *  - aucune difficulté d'item n'est touchée — sinon toutes les questions
 *    deviendraient artificiellement dures, et c'est cette difficulté qui sert
 *    ensuite à calibrer les exercices ;
 *  - les questions servies sont retenues, pour que le prétest de la fiche ne
 *    les repose pas.
 *
 * Prérequis : « npx astro build » puis « npx astro preview » sur le port 4321.
 */
import { chromium } from 'playwright-core';

const RACINE = 'http://localhost:4321';
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM,
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1100, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

let echecs = 0;
const v = (t, o, a) => {
  const ok = JSON.stringify(o) === JSON.stringify(a);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${t}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(o)}, attendu ${JSON.stringify(a)}`);
};

// Base propre : on veut la situation d'une première arrivée sur le site, celle
// où l'orientation compte le plus et où rien n'est encore mesuré.
await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

await page.goto(`${RACINE}/positionnement/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', 'EFN67');
  await page.click('#bouton-verrou');
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(2500);

console.log('\nLE CHOIX DU PÉRIMÈTRE');
v('le bloc de choix est affiché', await page.locator('#choix').isVisible().catch(() => false), true);
const nbPerimetres = await page.locator('#perimetre option').count();
v('des fascicules sont proposés', nbPerimetres > 0, true);
console.log(`      ${nbPerimetres} fascicule(s) positionnable(s)`);
const premier = (await page.locator('#perimetre option').first().textContent()) ?? '';
v('chaque entrée annonce son nombre de fiches', /fiches? interrogeables?/.test(premier), true);
console.log(`      premier : ${premier.trim()}`);

console.log('\nLE QUESTIONNAIRE');
await page.locator('#lancer').click();
await page.waitForTimeout(6000);
v(
  'le questionnaire est affiché',
  await page.locator('#questionnaire section').isVisible().catch(() => false),
  true,
);
const blocs = page.locator('#questionnaire section > div > div');
const nbQuestions = await blocs.count();
v('au moins quatre questions', nbQuestions >= 4, true);
v('jamais plus que la cible', nbQuestions <= 12, true);
console.log(`      ${nbQuestions} question(s) posée(s)`);
v('le bloc de choix s’est effacé', await page.locator('#choix').isHidden(), true);

// On répond à tout : la justesse importe peu ici, c'est le trajet de la mesure
// qu'on éprouve. Premier choix de chaque question.
for (let i = 0; i < nbQuestions; i += 1) {
  await blocs.nth(i).locator('button').first().click();
}

console.log('\nLE BILAN ET L’ORIENTATION');
await page.getByRole('button', { name: /Valider et me situer/ }).click();
await page.waitForTimeout(3000);
const bilan = (await page.locator('#bilan').textContent()) ?? '';
v('le bilan est affiché', await page.locator('#bilan').isVisible(), true);
v('il annonce une note d’entrée', bilan.includes('Votre niveau d’entrée'), true);
v(
  'il dit que cette note ne compte pas dans le niveau acquis',
  /ne compte pas dans votre niveau acquis|affiché pour mémoire/.test(bilan),
  true,
);
v(
  'il nomme la zone proximale ou dit pourquoi il ne peut pas situer',
  /zone proximale|Pas encore situées/.test(bilan),
  true,
);
v(
  'la correction a bien été affichée',
  await page.locator('#questionnaire button[disabled]').count() > 0,
  true,
);

const etat = await page.evaluate(async () => {
  const lireTout = (base, magasin) =>
    new Promise((ok) => {
      const r = base.transaction(magasin).objectStore(magasin).getAll();
      r.onsuccess = () => ok(r.result);
    });
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  return {
    competences: await lireTout(base, 'competences'),
    difficultes: await lireTout(base, 'difficultes'),
    fiches: await lireTout(base, 'fiches'),
  };
});

console.log('\nLA MESURE ATTERRIT AU BON ENDROIT');
const entrees = etat.competences.filter((c) => c.clef.startsWith('entree:'));
v('des notes d’entrée ont été écrites', entrees.length > 0, true);
v(
  'une par matière interrogée',
  entrees.filter((c) => c.portee === 'matiere').length,
  1,
);
v(
  'une par fascicule interrogé',
  entrees.filter((c) => c.portee === 'fascicule').length,
  1,
);
v('et une par fiche interrogée', entrees.filter((c) => c.portee === 'fiche').length > 0, true);
v(
  'le total des observations correspond aux questions posées',
  entrees.find((c) => c.portee === 'fascicule')?.observations,
  nbQuestions,
);
v('aucun niveau acquis n’a été créé', etat.competences.some((c) => !c.clef.startsWith('entree:')), false);
v('aucune difficulté d’item n’a été touchée', etat.difficultes.length, 0);

console.log('\nLES QUESTIONS SERVIES SONT RETENUES');
const avecVues = etat.fiches.filter((f) => (f.pretestVues ?? []).length > 0);
v('les fiches interrogées ont mémorisé leurs questions', avecVues.length > 0, true);
v(
  'autant de questions retenues que posées',
  avecVues.reduce((somme, f) => somme + f.pretestVues.length, 0),
  nbQuestions,
);
v('aucune fiche n’a été marquée prétestée', etat.fiches.some((f) => f.pretesteeLe), false);
v('aucune fiche n’a été marquée lue', etat.fiches.some((f) => f.lu), false);

console.log('\nLE NIVEAU AFFICHÉ IGNORE LA NOTE D’ENTRÉE');
await page.goto(`${RACINE}/statistiques/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const niveaux = (await page.locator('#niveaux').textContent()) ?? '';
// On cherche l'absence d'une note Elo, qui est toujours un nombre à quatre
// chiffres autour de 1200 — et non une formule particulière, que le libellé de
// la page pourrait changer sans que l'invariant bouge. L'invariant lui-même est
// vérifié plus haut, directement en base, ce qui est plus solide : ici on
// s'assure seulement que rien ne fuit jusqu'à l'affichage.
v(
  'aucune note chiffrée n’apparaît après le seul positionnement',
  /\b1[0-9]{3}\b/.test(niveaux),
  false,
);
v('la page des niveaux répond bien', niveaux.length > 0, true);

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
process.exit(echecs ? 1 : 0);
