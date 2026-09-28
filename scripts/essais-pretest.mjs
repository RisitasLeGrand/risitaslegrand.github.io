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
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
let echecs = 0;
const v = (t, o, a) => { const ok = JSON.stringify(o) === JSON.stringify(a); if (!ok) echecs += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${t}`); if (!ok) console.log(`      obtenu ${JSON.stringify(o)}, attendu ${JSON.stringify(a)}`); };

// Base propre, pour être dans la situation d'une première lecture.
await page.goto('http://localhost:4321/robots.txt');
await page.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('revinsp'); r.onsuccess = r.onerror = r.onblocked = () => ok(); }));

await page.goto('http://localhost:4321/bibliotheque', { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(()=>false)) { await page.fill('#champ-mdp','EFN67'); await page.click('#bouton-verrou'); await page.waitForTimeout(3000); }

const AVEC = '/fiche/?id=d9cb5790881e26fa';   // Questions sociales F3, fiche 1 : a un prétest
const idSans = await ficheSansPretest();
if (!idSans) {
  console.log('\n\x1b[33m⚠ toutes les fiches ont un prétest : le témoin « sans prétest » est sans objet.\x1b[0m');
}
const SANS = `/fiche/?id=${idSans ?? ''}`;
await page.goto('http://localhost:4321' + AVEC, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log('\nFICHE VISÉE :', await page.locator('#titre').textContent());

console.log('\nPRÉTEST AVANT LA PREMIÈRE LECTURE');
v('le panneau est affiché', await page.locator('#pretest section').isVisible().catch(()=>false), true);
v('son titre annonce l’avant-lecture', (await page.locator('#pretest h2').textContent().catch(()=>'')).trim(), 'Avant de lire');
v('le cours est masqué', await page.locator('#contenu').isHidden().catch(()=>null), true);
const nbQuestions = await page.locator('#pretest section > div > div').count();
v('trois questions', nbQuestions, 3);
v('le bouton « passer » est visible', await page.getByRole('button', { name: /Passer et lire/ }).isVisible(), true);

console.log('\nUNE TENTATIVE');
await page.locator('#pretest button').filter({ hasText: 'Le niveau de chômage réduit' }).first().click();
await page.getByRole('button', { name: /Valider mes réponses/ }).click();
await page.waitForTimeout(1200);
v('la correction s’affiche', (await page.locator('#pretest p').last().textContent() ?? '').includes('Rien n’a été compté') || (await page.locator('#pretest').textContent() ?? '').includes('Rien n’a été compté'), true);
const etatApres = await page.evaluate(async () => {
  const base = await new Promise((ok) => { const r = indexedDB.open('revinsp'); r.onsuccess = () => ok(r.result); });
  const fiches = await new Promise((ok) => { const r = base.transaction('fiches').objectStore('fiches').getAll(); r.onsuccess = () => ok(r.result); });
  const profil = await new Promise((ok) => { const r = base.transaction('etat').objectStore('etat').get('profil'); r.onsuccess = () => ok(r.result); });
  return { fiche: fiches[0], xp: profil?.xp ?? 0 };
});
v('la fiche est marquée prétestée', typeof etatApres.fiche?.pretesteeLe, 'string');
v('la fiche n’est pas marquée lue', etatApres.fiche?.lu, false);
v('une récompense forfaitaire a été versée', etatApres.xp > 0, true);
console.log(`      XP après prétest : ${etatApres.xp}`);

await page.getByRole('button', { name: /Lire le cours/ }).click();
await page.waitForTimeout(600);
v('le cours est révélé', await page.locator('#contenu').isVisible(), true);
v('le panneau a disparu', await page.locator('#pretest section').count(), 0);

console.log('\nIL NE REVIENT PAS');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
v('aucun prétest au rechargement', await page.locator('#pretest section').count(), 0);
v('le cours est visible d’emblée', await page.locator('#contenu').isVisible(), true);

if (idSans) {
console.log('\nUNE FICHE SANS PRÉTEST N’EN AFFICHE PAS');
await page.goto('http://localhost:4321' + SANS, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
v('pas de panneau', await page.locator('#pretest section').count(), 0);
v('le cours est visible', await page.locator('#contenu').isVisible(), true);
}

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
