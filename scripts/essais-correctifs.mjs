/**
 * Les quatre correctifs, par l'interface réelle.
 *
 * 1. Un jour peut être mis au repos — aucune révision n'y est programmée, et la
 *    série de jours n'en est pas rompue.
 * 2. La matière « Cas pratique » est écartée de l'estimation de niveau.
 * 3. Les fiches de méthodologie sont écartées de l'estimation et des files.
 * 4. L'accueil annonce les cartes **à revoir**, pas les cartes inédites.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
let echecs = 0;
const v = (t, o, a) => { const ok = JSON.stringify(o) === JSON.stringify(a); if (!ok) echecs += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${t}`); if (!ok) console.log(`      obtenu ${JSON.stringify(o)}, attendu ${JSON.stringify(a)}`); };
const B = 'http://localhost:4321';

await page.goto(`${B}/robots.txt`);
await page.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('revinsp'); r.onsuccess = r.onerror = r.onblocked = () => ok(); }));
await page.goto(`${B}/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', 'EFN67');
  await page.click('#bouton-verrou');
  await page.waitForTimeout(3000);
}

/* ══ 4. « À revoir », et non « à réviser » ═══════════════════════════════ */
console.log('\nACCUEIL — LE COMPTEUR DOIT ÊTRE TENABLE');
await page.waitForFunction(() => document.getElementById('dues')?.textContent !== '—', null, { timeout: 20000 });
const libelle = await page.evaluate(() => document.getElementById('dues').previousElementSibling.textContent.trim());
v('le libellé annonce « à revoir »', libelle, "À revoir aujourd'hui");
const dues = Number(await page.locator('#dues').textContent());
// Base neuve : aucune carte n'a jamais été vue, donc aucune n'est à revoir.
// C'est précisément ce que l'ancien compteur affichait à des milliers.
v('sur une base neuve, rien à revoir', dues, 0);
v('le compteur reste sous le millier', dues < 1000, true);

/* ══ 2 et 3. Contenus écartés de l'estimation ════════════════════════════ */
console.log('\nRÉGLAGES — CE QUI EST ÉCARTÉ PAR DÉFAUT');
await page.goto(`${B}/progression/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#contenus label', { timeout: 20000 });
const etats = await page.$$eval('#contenus label', (ls) =>
  ls.map((l) => [l.querySelector('span > span')?.textContent ?? '', l.querySelector('input').checked]));
v('la RCP est décochée', etats.find(([n]) => n.includes('cas pratique'))?.[1], false);
v('la méthodologie est décochée pour l’estimation', etats.find(([n]) => n.includes('estimation'))?.[1], false);
v('la méthodologie est décochée pour les révisions', etats.find(([n]) => n.includes('révisions'))?.[1], false);

console.log('\nSTATISTIQUES — PAS D’AUTO-ESTIMATION EN CAS PRATIQUE');
await page.goto(`${B}/statistiques/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => (document.getElementById('niveaux')?.children.length ?? 0) > 0, null, { timeout: 60000 });
// Les blocs sont des <details> repliés : on les ouvre, sinon les boutons
// d'amorce sont bien dans le DOM mais invisibles, et le compte mentirait.
await page.$$eval('#niveaux > details', (ds) => ds.forEach((d) => (d.open = true)));
const bloc = page.locator('#niveaux > details', { hasText: 'Cas pratique' }).first();
v('le bloc dit que la matière est écartée',
  (await bloc.textContent()).includes("écartée de l'estimation"), true);
v('aucun bouton d’amorce n’y est proposé', await bloc.getByRole('button', { name: 'Je découvre' }).count(), 0);
const autre = page.locator('#niveaux > details', { hasText: 'Économie' }).first();
v('les autres matières gardent l’amorce', await autre.getByRole('button', { name: 'Je découvre' }).count(), 1);

/* ══ 3 bis. Les fiches de méthodologie hors des files ════════════════════ */
console.log('\nFLASHCARDS — LA MÉTHODOLOGIE RESTE DEHORS');
// Économie porte deux fiches taguées « méthodologie » (méthode de la note,
// lecture des graphiques) et leurs cartes. La mesure est différentielle : on
// compte les inédites, on réintègre la méthodologie, on recompte. Si le filtre
// ne faisait rien, les deux nombres seraient égaux.
const inedites = async () => {
  await page.goto(`${B}/flashcards/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(document.querySelector('#choix-matiere option[value="Économie"]')), null, { timeout: 30000 });
  await page.selectOption('#choix-matiere', 'Économie');
  await page.waitForFunction(() => document.getElementById('nb-neuves')?.textContent !== '—', null, { timeout: 30000 });
  await page.waitForTimeout(600);
  return Number(await page.locator('#nb-neuves').textContent());
};
const sansMethodo = await inedites();
v('des cartes inédites sont proposées en économie', sansMethodo > 0, true);

await page.goto(`${B}/progression/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#contenus label', { timeout: 20000 });
await page.locator('#contenus label', { hasText: 'révisions' }).locator('input').check();
await page.waitForTimeout(800);
const avecMethodo = await inedites();
v('réintégrer la méthodologie ajoute des cartes', avecMethodo > sansMethodo, true);

// On remet le réglage à sa valeur par défaut pour la suite.
await page.goto(`${B}/progression/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#contenus label', { timeout: 20000 });
await page.locator('#contenus label', { hasText: 'révisions' }).locator('input').uncheck();
await page.waitForTimeout(800);

/* ══ 1. Jour de repos ════════════════════════════════════════════════════ */
console.log('\nPLANIFICATION — METTRE UN JOUR AU REPOS');
await page.goto(`${B}/planification/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#grille-rotation select', { timeout: 20000 });
const options = await page.$$eval('#grille-rotation select:first-of-type option', (os) => os.map((o) => o.value));
v('« repos » est proposé dans la rotation', options.includes('repos'), true);

// On met au repos le jour de la semaine qui tombe aujourd'hui.
const index = await page.evaluate(() => new Date().getDay());
await page.selectOption(`#rotation-${index}`, 'repos');
await page.waitForTimeout(1200);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => document.getElementById('titre-jour')?.textContent?.trim(), null, { timeout: 20000 });
v('la séance du jour annonce le repos',
  (await page.locator('#titre-jour').textContent()).includes('Repos'), true);
v('l’étiquette le dit aussi',
  (await page.locator('#etiquette-jour').textContent()).trim(), 'Aucune révision prévue');
v('le résumé parle de la série',
  (await page.locator('#resume-jour').textContent()).includes('série'), true);

console.log('\nSÉANCE — RIEN N’Y EST PROGRAMMÉ');
await page.goto(`${B}/planification/seance/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#seance:not(.hidden)', { timeout: 20000 });
v('le bandeau de repos est visible', await page.locator('#bandeau-repos').isVisible(), true);
v('aucune fiche du jour n’est proposée',
  (await page.locator('#fiches-jour a').count()) + (await page.locator('#contenu-jour a').count()), 0);

console.log("\nACCUEIL — LA CARTE DE SÉANCE SUIT");
await page.goto(`${B}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.getElementById('seance-titre')?.textContent?.trim(), null, { timeout: 20000 });
v('la carte annonce le repos',
  (await page.locator('#seance-etiquette').textContent()).trim(), 'Aucune révision prévue');
v('aucun prétest n’est proposé un jour de repos',
  await page.locator('#bloc-pretest').isHidden().catch(() => true), true);

console.log(echecs ? `\n\x1b[31m✖ ${echecs} échec(s)\x1b[0m` : '\n\x1b[32m✓ tout passe\x1b[0m');
await nav.close();
process.exit(echecs ? 1 : 0);
