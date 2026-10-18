/**
 * L'installation sur un écran d'accueil : le manifeste et les icônes (M12).
 *
 * ## Ce que cet essai refuse de faire
 *
 * Il ne lit pas le code pour vérifier que les bonnes lignes y figurent. Une
 * sonde textuelle prouverait qu'un manifeste est **cité**, jamais qu'il est
 * valide ni que les fichiers qu'il annonce existent. Trois vérifications
 * réelles à la place :
 *
 * 1. le manifeste construit est du JSON valide, et ses champs portent la
 *    base du site ;
 * 2. **chaque icône annoncée existe, et fait vraiment la taille déclarée** —
 *    mesurée sur le fichier, pas lue dans le manifeste. C'est l'erreur la
 *    plus facile à commettre et la plus invisible : un `512x512` écrit à côté
 *    d'un fichier de 192, et l'icône est refusée sans un mot ;
 * 3. le **navigateur lui-même** analyse le manifeste de la page servie, par
 *    « Page.getAppManifest ». Ce n'est pas mon jugement sur sa validité,
 *    c'est le sien.
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from '/home/user/revinsp/node_modules/sharp/dist/index.cjs';

const BASE = 'http://localhost:4321';
const DIST = path.resolve('dist');

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

console.log('\nLE MANIFESTE CONSTRUIT');

const brut = await readFile(path.join(DIST, 'manifeste.webmanifest'), 'utf8');
let manifeste;
try {
  manifeste = JSON.parse(brut);
} catch (e) {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — le manifeste n’est pas du JSON : ${e.message}`);
  process.exit(1);
}

for (const champ of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
  verifier(`« ${champ} » est présent`, manifeste[champ] !== undefined, true);
}
verifier('« display » vaut « standalone »', manifeste.display, 'standalone');
verifier('« start_url » et « scope » concordent', manifeste.start_url, manifeste.scope);
verifier('« id » aussi, pour que la page de départ puisse changer un jour', manifeste.id, manifeste.start_url);
verifier(
  'les deux couleurs sont posées',
  [typeof manifeste.theme_color, typeof manifeste.background_color],
  ['string', 'string'],
);

console.log('\nLES ICÔNES ANNONCÉES EXISTENT, ET FONT LA TAILLE DITE');

verifier('la liste n’est pas vide', manifeste.icons.length > 0, true);
for (const icone of manifeste.icons) {
  const fichier = path.join(DIST, icone.src.replace(/^\//, ''));
  let presente = false;
  try {
    presente = (await stat(fichier)).isFile();
  } catch {
    presente = false;
  }
  verifier(`« ${icone.src} » existe dans le paquet`, presente, true);
  if (!presente) continue;
  const { width, height } = await sharp(fichier).metadata();
  verifier(
    `« ${icone.src} » mesure bien ${icone.sizes}`,
    `${width}x${height}`,
    icone.sizes,
  );
}
verifier(
  'au moins une icône « maskable », sinon Android rogne dans le dessin',
  manifeste.icons.some((i) => String(i.purpose ?? '').includes('maskable')),
  true,
);
verifier(
  'et au moins une de 512, sinon l’écran de lancement est flou',
  manifeste.icons.some((i) => i.sizes === '512x512' && String(i.purpose ?? '').includes('any')),
  true,
);

console.log('\nCE QUE LE NAVIGATEUR EN DIT, LUI');

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM });
const ctx = await nav.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

const cdp = await ctx.newCDPSession(page);
const vu = await cdp.send('Page.getAppManifest');
console.log(`      url du manifeste vu par le navigateur : ${vu.url}`);
verifier('le navigateur trouve un manifeste depuis la page', Boolean(vu.url), true);
verifier(
  'et il ne lui trouve aucune erreur critique',
  (vu.errors ?? []).filter((e) => e.critical).map((e) => e.message),
  [],
);
const nonCritiques = (vu.errors ?? []).filter((e) => !e.critical);
if (nonCritiques.length) {
  console.log(`      remarques non bloquantes : ${nonCritiques.map((e) => e.message).join(' | ')}`);
}

/* L'icône d'iOS n'est pas dans le manifeste : elle se vérifie à part. */
const toucheApple = await page.evaluate(
  () => document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? null,
);
verifier('la page déclare une icône pour iOS', typeof toucheApple, 'string');
if (toucheApple) {
  const reponse = await page.request.get(`${BASE}${toucheApple}`);
  verifier('et ce fichier est bien servi', reponse.status(), 200);
  const octets = await reponse.body();
  const { width } = await sharp(octets).metadata();
  verifier('à la taille qu’iOS réclame', width, 180);
}

verifier(
  'la page porte aussi « theme-color », pour la barre avant installation',
  await page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  ),
  manifeste.theme_color,
);

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
