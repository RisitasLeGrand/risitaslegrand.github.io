/**
 * Mouvement réduit — ce que le socle neutralise vraiment.
 *
 *   npm run essais:mouvement-reduit
 *
 * **Pourquoi cet essai existe.** Le bloc `prefers-reduced-motion` de
 * `global.css` met les *durées* à 0,01 ms. C'est suffisant pour une animation
 * qui joue une fois : elle s'achève avant d'être vue. Ça ne l'est pas pour une
 * animation **infinie** — elle ne s'arrête pas, elle tourne 0,01 ms par cycle,
 * indéfiniment. L'interdit n° 3 du prompt 34 proscrit le clignotement ; une
 * durée nulle répétée sans fin est exactement cela.
 *
 * **Pourquoi il ne se contente pas de balayer les routes.** Les animations
 * infinies de ce site sont **conditionnelles** : elles n'apparaissent pas au
 * repos. Un balayage des pages chargées ne verrait rien et serait vert sans
 * rien mesurer. Les contrôles A et B provoquent donc l'état au lieu de
 * l'attendre.
 *
 * Trois contrôles, du plus direct au plus large :
 *
 *   A — la règle elle-même, sur un témoin injecté. C'est ce que corrige la
 *       phase 0, et c'est donc la mesure qui doit virer au vert.
 *   B — l'écran réel : le bouton de capture de touche du quad n-back porte
 *       `animate-pulse`, infinie, sans garde locale. On le met en capture et
 *       on mesure.
 *   C — le balayage au repos, en filet : aucune route ne doit porter une
 *       animation infinie qui tourne sans qu'on l'ait demandée.
 *
 * Relevé du 14 octobre 2026, avant correctif : `Grille.svelte` se protège
 * lui-même (`@media (prefers-reduced-motion: reduce) { .tourne { animation:
 * none } }`), il n'est donc pas en cause. `BarreProgression.astro` et
 * `Deroule.svelte` ont également leur garde. Reste `animate-pulse`.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/** Chromium rend les durées en secondes (« 1e-05s ») : on compare un nombre. */
const secondes = (brut) => Number.parseFloat(String(brut)) || 0;

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 400)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 400)}`);
  }
};

const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  reducedMotion: 'reduce',
});
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

console.log('\nMOUVEMENT RÉDUIT');

/* --- Le drapeau est-il bien posé ? -------------------------------------- */
/* Sans cela, les trois contrôles mesureraient le mode normal et seraient
   verts pour la pire des raisons. */

await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
const reduit = await page.evaluate(
  () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
);
v('le navigateur est bien en mouvement réduit', reduit, true);

/* --- A. La règle, sur un témoin injecté --------------------------------- */

console.log('\n  A — la règle');

const temoin = await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent =
    '@keyframes essai-pulsation { from { opacity: 1 } to { opacity: .4 } }' +
    '.essai-infinie { animation: essai-pulsation 2s linear infinite }';
  document.head.append(style);
  const e = document.createElement('div');
  e.className = 'essai-infinie';
  document.body.append(e);
  const c = getComputedStyle(e);
  const lu = {
    nom: c.animationName,
    duree: c.animationDuration,
    repetitions: c.animationIterationCount,
  };
  e.remove();
  style.remove();
  return lu;
});

v('la durée est bien neutralisée', secondes(temoin.duree) <= 0.001, true);
v(
  'le nombre de répétitions est ramené à 1',
  temoin.repetitions,
  '1',
);

/* --- B. L'écran réel : la capture de touche du quad n-back -------------- */

console.log('\n  B — le bouton de capture de touche');

/* L'écran est derrière le coffre : sans déverrouillage, les boutons existent
   dans le DOM mais restent masqués, et le contrôle mesurerait une coquille. */
await page.goto(`${RACINE}/cog-training/quad-n-back/`, {
  waitUntil: 'networkidle',
  timeout: 30000,
});
const verrou = page.locator('#champ-mdp');
if (await verrou.isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}

/* On attend que le bouton paraisse, au lieu de parier sur un délai fixe : le
   déchiffrement puis le montage de l'exercice ne durent pas toujours pareil,
   et un essai qui court après l'écran mesure sa propre impatience. */
const capture = page.locator('button[aria-label^="Changer la touche"]').first();
const atteignable = await capture
  .waitFor({ state: 'visible', timeout: 20000 })
  .then(() => true)
  .catch(() => false);
v('le bouton de capture est atteignable', atteignable, true);

if (atteignable) {
  await capture.click();
  await page.waitForTimeout(150);

  const mesure = await capture.evaluate((e) => {
    const c = getComputedStyle(e);
    return {
      classe: e.className.includes('animate-pulse'),
      nom: c.animationName,
      duree: c.animationDuration,
      repetitions: c.animationIterationCount,
    };
  });

  v('le bouton est bien passé en capture', mesure.classe, true);
  v(
    'sa pulsation ne se répète pas indéfiniment',
    mesure.repetitions,
    '1',
  );
}

/* --- C. Le balayage au repos, en filet ---------------------------------- */

console.log('\n  C — balayage de toutes les routes, au repos');

{
  const { readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const routes = [];
  const parcourir = (d, prefixe) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourir(c, `${prefixe}${e}/`);
      else if (e === 'index.html') routes.push(prefixe);
    }
  };
  parcourir('dist', '/');
  routes.sort();

  const fautives = [];
  for (const r of routes) {
    await page.goto(`${RACINE}${r}`, { waitUntil: 'networkidle', timeout: 25000 });
    const trouvees = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .filter((e) => {
          const c = getComputedStyle(e);
          return c.animationName !== 'none' && c.animationIterationCount === 'infinite';
        })
        .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`)
        .slice(0, 3),
    );
    if (trouvees.length) fautives.push({ route: r, trouvees });
  }

  v(
    `aucune des ${routes.length} routes ne joue une animation infinie au repos`,
    fautives,
    [],
  );
}

/* --- D. L'interrupteur de l'application, système au repos --------------- */
/*
   Décision 4 : le réglage de l'application s'ajoute à celui du système. Ce
   contrôle se fait donc dans un contexte où le système ne demande **rien** —
   sans quoi on ne saurait pas lequel des deux a agi.
*/

console.log("\n  D — l'interrupteur de l'application, système au repos");

{
  const normal = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'no-preference',
  });
  const p = await normal.newPage();

  await p.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  v(
    'le système ne demande pas de mouvement réduit',
    await p.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    false,
  );

  // Sans réglage enregistré, rien ne doit être neutralisé.
  const avant = await p.evaluate(() => {
    const s = document.createElement('style');
    s.textContent =
      '@keyframes essai-d { from { opacity: 1 } to { opacity: .4 } }' +
      '.essai-d { animation: essai-d 2s linear infinite }';
    document.head.append(s);
    const e = document.createElement('div');
    e.className = 'essai-d';
    document.body.append(e);
    const lu = getComputedStyle(e).animationIterationCount;
    e.remove();
    s.remove();
    return lu;
  });
  v('par défaut, les animations jouent normalement', avant, 'infinite');

  // Le réglage est écrit, puis la page rechargée : c'est le script d'amorçage
  // qui doit poser l'attribut, avant le premier rendu.
  await p.evaluate(() => localStorage.setItem('revinsp.animations', 'reduites'));
  await p.reload({ waitUntil: 'networkidle' });

  v(
    "l'attribut est posé dès l'amorçage",
    await p.evaluate(() => document.documentElement.getAttribute('data-animations')),
    'reduites',
  );

  const apres = await p.evaluate(() => {
    const s = document.createElement('style');
    s.textContent =
      '@keyframes essai-d { from { opacity: 1 } to { opacity: .4 } }' +
      '.essai-d { animation: essai-d 2s linear infinite }';
    document.head.append(s);
    const e = document.createElement('div');
    e.className = 'essai-d';
    document.body.append(e);
    const c = getComputedStyle(e);
    const lu = { duree: c.animationDuration, repetitions: c.animationIterationCount };
    e.remove();
    s.remove();
    return lu;
  });
  v("l'interrupteur neutralise la durée", secondes(apres.duree) <= 0.001, true);
  v("l'interrupteur neutralise les répétitions", apres.repetitions, '1');

  // Et la case de l'écran des préférences reflète bien cet état.
  await p.goto(`${RACINE}/profil/`, { waitUntil: 'networkidle' });
  const verrouProfil = p.locator('#champ-mdp');
  if (await verrouProfil.isVisible().catch(() => false)) {
    await p.fill('#champ-mdp', MDP);
    await p.click('#bouton-verrou');
    await p.waitForTimeout(400);
  }
  const coche = p.locator('#reduire-animations');
  v('la case existe dans les préférences', await coche.count(), 1);
  if (await coche.count()) {
    v('la case reflète le réglage enregistré', await coche.isChecked(), true);
  }

  await normal.close();
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
