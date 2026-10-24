/**
 * L'export pour une IA et les données du coffre — phase 5 du prompt 35.
 *
 *   npm run essais:export-coffre
 *
 * **Une fuite que la phase 4 a ouverte, et que celle-ci referme.**
 *
 * Depuis que Finances publie ses faits comme les autres branches, ils entrent
 * d'office dans la fenêtre d'indicateurs — donc dans la synthèse, donc dans
 * le fichier produit. Sans filtre, le coffre sortait **sans que personne ait
 * coché quoi que ce soit**, ce que l'interdit 4 proscrit mot pour mot :
 * « rien ne sort sans mon geste ».
 *
 * Le contrôle porte donc d'abord sur le **négatif** — ce qui ne doit PAS
 * sortir — et sur un garde structurel : aucun appel à `rassembler` dans le
 * module d'export ne doit se passer de `sources`. Un contrôle qui se
 * contenterait de vérifier que la case marche laisserait revenir la fuite au
 * premier appel oublié.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)?.slice(0, 220)} / attendu ${JSON.stringify(attendu)?.slice(0, 220)}`);
};

console.log('\nEXPORT POUR UNE IA — LES DONNÉES DU COFFRE');

/* --- A. Le garde structurel --------------------------------------------- */

console.log('\n  A — aucun appel à « rassembler » sans « sources »');

{
  const src = readFileSync('src/lib/export-ia.ts', 'utf8');
  const appels = [...src.matchAll(/rassembler\(([^)]*)\)/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
  console.log(`     ${appels.length} appel(s) : ${appels.map((a) => a.slice(0, 54)).join(' | ')}`);
  v('il y a bien des appels à contrôler', appels.length > 0, true);
  v(
    'tous passent « sources »',
    appels.filter((a) => !a.includes('sources')),
    [],
  );

  const sansCase = /const sources = \[[\s\S]*?\];/.exec(src)?.[0] ?? '';
  v(
    'les deux branches sous coffre y sont conditionnées à leur case',
    /categories\.includes\('psyche'\)/.test(sansCase) && /categories\.includes\('finances'\)/.test(sansCase),
    true,
  );
  v(
    'et les quatre branches ordinaires y sont sans condition',
    ['revisions', 'odyssee', 'corps', 'sport'].every((b) => sansCase.includes(`'${b}'`)),
    true,
  );
}

/* --- B. Les catégories sous coffre sont déclarées, pas devinées ---------- */

console.log('\n  B — les catégories sous coffre');

{
  const src = readFileSync('src/lib/odyssee/export-ia.ts', 'utf8');
  v(
    'la liste est déclarée',
    /CATEGORIES_SOUS_COFFRE[^=]*=\s*\['psyche', 'finances'\]/.test(src),
    true,
  );
  v(
    'et les deux restent décochées par défaut',
    (src.match(/sensible: true,\s*\n\s*parDefaut: false,/g) ?? []).length >= 2,
    true,
  );
  v(
    'les descriptions ne disent plus « rien de tout cela n’existe encore »',
    /Rien de tout cela n’existe encore/.test(src.split("id: 'sante'")[0] + src.split("id: 'psyche'")[1]),
    false,
  );
  v(
    'et celle des finances exclut explicitement le libellé',
    /Jamais le libellé d’une opération/.test(src),
    true,
  );
}

/* --- C. À l'écran, coffre fermé ----------------------------------------- */

console.log('\n  C — à l’écran, coffre fermé');

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 180)));

await page.goto(`${RACINE}/exporter-ia/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.locator('[data-categorie="finances"]').waitFor({ state: 'attached', timeout: 25000 });
await page.waitForTimeout(600);

const etat = (id) =>
  page.$eval(`[data-categorie="${id}"]`, (e) => ({
    desactivee: e.disabled,
    cochee: e.checked,
    texte: e.closest('label')?.textContent ?? '',
  }));

const fin = await etat('finances');
const psy = await etat('psyche');
v('« Finances » n’est pas cochable', fin.desactivee, true);
v('« Psyché » non plus', psy.desactivee, true);
v('et ni l’une ni l’autre n’est cochée', [fin.cochee, psy.cochee], [false, false]);
v(
  'le manque est NOMMÉ, pas une case grise muette',
  /Coffre fermé : cette catégorie ne peut pas être exportée/.test(fin.texte),
  true,
);

/* Et une catégorie ordinaire reste disponible : le refus est ciblé. */
const ordinaire = await page.$$eval('[data-categorie]', (cases) =>
  cases.filter((c) => !c.disabled).map((c) => c.dataset.categorie),
);
v('les catégories hors coffre restent disponibles', ordinaire.length > 0, true);

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
