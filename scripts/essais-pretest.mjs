/**
 * Le prétest, par l'interface réelle.
 *
 * On vérifie ce qui se voit : le panneau paraît avant la première lecture et
 * masque le cours — le laisser visible derrière viderait l'exercice de son
 * sens —, une tentative marque la fiche et verse la récompense forfaitaire sans
 * rien noter, le prétest ne revient pas, et une fiche écrite avant cette phase
 * n'en affiche aucun.
 *
 * Cet essai a servi : il a révélé que le prétest, pourtant produit et chiffré
 * par le build, n'arrivait jamais au navigateur.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { idStable } from './lib/crypto.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();

/**
 * Une fiche dépourvue de prétest, trouvée dans le contenu.
 *
 * Elle était figée en dur, et l'essai s'est mis à échouer le jour où cette
 * fiche-là a reçu son prétest : le témoin ne témoignait plus de rien. On la
 * cherche donc à chaque passage. Le jour où toutes les fiches en auront un,
 * l'essai le dira franchement au lieu de tester une fiche au hasard.
 */
async function ficheSansPretest(racine = 'content') {
  const entrees = await readdir(racine, { withFileTypes: true, recursive: true });
  for (const e of entrees) {
    if (!e.isFile() || !e.name.endsWith('.md') || e.name.endsWith('.podcast.md')) continue;
    const complet = path.join(e.parentPath ?? e.path, e.name);
    const texte = await readFile(complet, 'utf8');
    if (texte.includes('## Prétest')) continue;
    return await idStable(path.relative(racine, complet));
  }
  return null;
}
const nav = await chromium.launch({ executablePath: cheminDuNavigateur(), args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
let echecs = 0;
const v = (t, o, a) => { const ok = JSON.stringify(o) === JSON.stringify(a); if (!ok) echecs += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${t}`); if (!ok) console.log(`      obtenu ${JSON.stringify(o)}, attendu ${JSON.stringify(a)}`); };

// Base propre, pour être dans la situation d'une première lecture.
await page.goto('http://localhost:4321/robots.txt');
await page.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('revinsp'); r.onsuccess = r.onerror = r.onblocked = () => ok(); }));

/*
   La porte d'initialisation se franchit avant tout le reste.

   Sans cela, l'écran de fiche se déverrouille puis **redirige** vers
   « /initialisation/ », où il n'y a pas de « #titre » : l'essai attendait
   trente secondes un élément qui ne viendrait jamais, et échouait sur un
   délai plutôt que sur ce qu'il teste. Les autres essais d'écran passent
   tous par là ; celui-ci avait été écrit avant que la porte existe.
*/
await franchirInitialisation(page, 'http://localhost:4321', MDP);
await page.goto('http://localhost:4321/bibliotheque/', { waitUntil: 'networkidle' });
/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET POURQUOI AUCUNE N'EST UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Six temporisations à
   l'aveugle, dont trois de 2 500 ms devant une fiche à déchiffrer et une de
   3 000 ms devant le verrou.

   Deux post-conditions suffisent à les remplacer toutes. Le TITRE de la
   fiche, écrit par le script une fois le contenu déchiffré : il part vide, et
   « non vide » est donc une vraie transition. Et le PANNEAU du prétest, qui
   est ce que la plupart des constats lisent — présent, ou disparu.

   Pour les deux constats NÉGATIFS — « aucun prétest au rechargement », « pas
   de panneau sur une fiche qui n'en a pas » —, on attend le titre : il dit
   que la fiche est là, donc que l'absence du panneau est une absence et non
   un retard.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;

/** Attend que la fiche soit déchiffrée : son titre est écrit par le script. */
const attendreLaFiche = () =>
  page
    .waitForFunction(
      () => (document.getElementById('titre')?.textContent ?? '').trim() !== '',
      undefined,
      { timeout: DELAI },
    )
    .catch(() => {});

if (await page.locator('#champ-mdp').isVisible().catch(()=>false)) {
  await page.fill('#champ-mdp',MDP);
  await page.click('#bouton-verrou');
  /* La bibliothèque paraît quand la clé est posée : c'est la marque, et c'est
     ce que « ficheSansPretest » va lire juste après. */
  await page
    .waitForFunction(() => document.getElementById('champ-mdp') === null ||
      document.getElementById('champ-mdp').getBoundingClientRect().height === 0,
      undefined, { timeout: DELAI })
    .catch(() => {});
}

const AVEC = '/fiche/?id=d9cb5790881e26fa';   // Questions sociales F3, fiche 1 : a un prétest
const idSans = await ficheSansPretest();
if (!idSans) {
  console.log('\n\x1b[33m⚠ toutes les fiches ont un prétest : le témoin « sans prétest » est sans objet.\x1b[0m');
}
const SANS = `/fiche/?id=${idSans ?? ''}`;
await page.goto('http://localhost:4321' + AVEC, { waitUntil: 'networkidle' });
await attendreLaFiche();
console.log('\nFICHE VISÉE :', await page.locator('#titre').textContent());

console.log('\nPRÉTEST AVANT LA PREMIÈRE LECTURE');
v('le panneau est affiché', await page.locator('#pretest section').isVisible().catch(()=>false), true);
v('son titre annonce l’avant-lecture', (await page.locator('#pretest h2').textContent().catch(()=>'')).trim(), 'Avant de lire');
v('le cours est masqué', await page.locator('#contenu').isHidden().catch(()=>null), true);
const nbQuestions = await page.locator('#pretest section > div > div').count();
v('trois questions', nbQuestions, 3);
v('le bouton « passer » est visible', await page.getByRole('button', { name: /Passer et lire/ }).isVisible(), true);

console.log('\nUNE TENTATIVE');
/*
 * Une option désignée par son texte était un pari sur le tirage : depuis que
 * les questions de prétest sont tirées d'un vivier, celle qui portait « Le
 * niveau de chômage réduit » n'est présente qu'une fois sur plusieurs, et
 * l'essai échouait au hasard. Ce qu'il vérifie — qu'une tentative se corrige,
 * se récompense et alimente la note d'entrée — ne dépend d'aucune option
 * particulière : la première de la première question suffit.
 */
await page
  .locator('#pretest section > div > div')
  .first()
  .locator('button')
  .first()
  .click();
await page.getByRole('button', { name: /Valider mes réponses/ }).click();
/*
   LA CORRECTION EST LA DERNIÈRE CHOSE ÉCRITE par la validation, après les
   écritures en base que les constats suivants relisent — la fiche prétestée,
   la récompense, les trois notes d'entrée. L'attendre couvre donc aussi
   celles-là.
*/
await page
  .waitForFunction(
    () =>
      (document.getElementById('pretest')?.textContent ?? '').includes(
        'Rien n’est compté comme une erreur',
      ),
    undefined,
    { timeout: DELAI },
  )
  .catch(() => {});
v('la correction s’affiche', (await page.locator('#pretest').textContent() ?? '').includes('Rien n’est compté comme une erreur'), true);
const etatApres = await page.evaluate(async () => {
  const lireTout = (base, magasin) => new Promise((ok) => { const r = base.transaction(magasin).objectStore(magasin).getAll(); r.onsuccess = () => ok(r.result); });
  const base = await new Promise((ok) => { const r = indexedDB.open('revinsp'); r.onsuccess = () => ok(r.result); });
  const fiches = await lireTout(base, 'fiches');
  const competences = await lireTout(base, 'competences');
  const difficultes = await lireTout(base, 'difficultes');
  const profil = await new Promise((ok) => { const r = base.transaction('etat').objectStore('etat').get('profil'); r.onsuccess = () => ok(r.result); });
  return { fiche: fiches[0], xp: profil?.xp ?? 0, competences, difficultes };
});
v('la fiche est marquée prétestée', typeof etatApres.fiche?.pretesteeLe, 'string');
v('la fiche n’est pas marquée lue', etatApres.fiche?.lu, false);
v('une récompense forfaitaire a été versée', etatApres.xp > 0, true);
console.log(`      XP après prétest : ${etatApres.xp}`);

// Le prétest mesure, mais il mesure **ailleurs**. Ces trois vérifications sont
// l'invariant de la phase : une note d'entrée est écrite, le niveau acquis ne
// bouge pas, et la difficulté des items reste intacte — une réponse donnée
// avant le cours ne dit rien de la difficulté d'une question pour qui l'a lu.
console.log('\nLA MESURE VA DANS LA NOTE D’ENTRÉE, PAS DANS LE NIVEAU ACQUIS');
v('une note d’entrée a été écrite', etatApres.competences.some((c) => c.clef.startsWith('entree:')), true);
v('aux trois portées', etatApres.competences.filter((c) => c.clef.startsWith('entree:')).length, 3);
v('aucun niveau acquis n’a été créé', etatApres.competences.some((c) => !c.clef.startsWith('entree:')), false);
v('aucune difficulté d’item n’a été touchée', etatApres.difficultes.length, 0);

await page.getByRole('button', { name: /Lire le cours/ }).click();
/* Le cours démasqué est ce que le constat lit ; le panneau parti est la suite
   du même geste. */
await page.locator('#contenu').waitFor({ state: 'visible', timeout: DELAI }).catch(() => {});
v('le cours est révélé', await page.locator('#contenu').isVisible(), true);
v('le panneau a disparu', await page.locator('#pretest section').count(), 0);

console.log('\nIL NE REVIENT PAS');
await page.reload({ waitUntil: 'networkidle' });
await attendreLaFiche();
v('aucun prétest au rechargement', await page.locator('#pretest section').count(), 0);
v('le cours est visible d’emblée', await page.locator('#contenu').isVisible(), true);

if (idSans) {
console.log('\nUNE FICHE SANS PRÉTEST N’EN AFFICHE PAS');
await page.goto('http://localhost:4321' + SANS, { waitUntil: 'networkidle' });
await attendreLaFiche();
v('pas de panneau', await page.locator('#pretest section').count(), 0);
v('le cours est visible', await page.locator('#contenu').isVisible(), true);
}

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
