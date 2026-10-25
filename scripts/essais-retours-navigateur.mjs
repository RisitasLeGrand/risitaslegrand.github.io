/**
 * Retours d'action — et le piège de la mise à l'échelle sous mouvement réduit.
 *
 *   npm run essais:retours
 *
 * **Ce que l'A4 demande.** Un retour bref et lisible : bouton pressé, réponse
 * juste ou fausse, carte révisée, enregistrement réussi. Avec deux garde-fous
 * que le prompt pose lui-même : le sens ne repose **jamais** sur l'animation
 * seule ni sur la couleur seule, et la décision 3 veut des célébrations
 * discrètes — une coche, pas de confetti.
 *
 * **Relevé du 14 octobre 2026, avant correctif.** Sur 282 boutons, **aucun**
 * ne donne de retour à la pression : 180 portent une classe `transition`, mais
 * pour le survol seulement. L'unique occurrence de `active:` trouvée dans le
 * code est une propriété de quête sans rapport avec l'état CSS.
 *
 * En revanche, deux exigences étaient **déjà tenues avant ce lot**, et le
 * relevé le dit plutôt que de se les attribuer : la correction de QCM pose un
 * signe `✓` ou `✗` doublé d'un texte pour lecteur d'écran (`marquerOption`
 * dans `ui.ts`), et les quatre boutons de notation des flashcards portent leur
 * libellé en toutes lettres. Le sens n'y a jamais reposé sur la couleur.
 *
 * **Le piège, et c'est le même qu'aux phases précédentes à un étage de plus.**
 * Le socle de mouvement réduit ramène les *durées* à 0,01 ms. Une mise à
 * l'échelle au doigt posé n'en serait pas supprimée pour autant : elle
 * sauterait instantanément à sa valeur, donc le bouton **se déplacerait quand
 * même**, sans transition. Or l'interdit n° 3 proscrit tout déplacement, pas
 * seulement les déplacements lents. Il faut donc annuler la transformation
 * elle-même, et pas sa durée. Le contrôle D le vérifie.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/** Interdit n° 5 : 300 ms au plus, sauf retour explicite d'un succès (600 ms). */
const PLAFOND_MS = 300;
const PLAFOND_SUCCES_MS = 600;

const secondes = (brut) => Number.parseFloat(String(brut)) || 0;

const INTERDITES = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding'];
const fautives = (liste) =>
  String(liste)
    .split(',')
    .map((x) => x.trim())
    .filter((x) => INTERDITES.some((i) => x === i || x.startsWith(`${i}-`)));

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};

console.log('\nRETOURS D’ACTION');

const ouvrirLaPage = async (page, route, attendu) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  const verrou = page.locator('#champ-mdp');
  if (await verrou.isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.locator(attendu).first().waitFor({ state: 'visible', timeout: 20000 });
};

/*
   Relève la transformation d'un bouton au repos, puis doigt posé. On passe par
   la souris plutôt que par une classe ajoutée à la main : `:active` est un état
   du navigateur, et le simuler reviendrait à mesurer sa propre simulation.
*/
const transformationSousLeDoigt = async (page, selecteur) => {
  const bouton = page.locator(selecteur).first();
  await bouton.scrollIntoViewIfNeeded();
  const boite = await bouton.boundingBox();
  const lire = () =>
    bouton.evaluate((e) => {
      const c = getComputedStyle(e);
      return { transformation: c.transform, duree: c.transitionDuration, props: c.transitionProperty };
    });

  const repos = await lire();
  await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const presse = await lire();
  await page.mouse.up();
  return { repos, presse };
};

/* --- A. Le bouton pressé ------------------------------------------------ */

console.log('\n  A — le bouton pressé');

const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await ouvrirLaPage(p, '/glossaire/', '#bouton-theme');
const theme = await transformationSousLeDoigt(p, '#bouton-theme');

v(
  `la pression change la transformation (${theme.repos.transformation} → ${theme.presse.transformation})`,
  theme.presse.transformation !== theme.repos.transformation,
  true,
);
v(
  `et le retour est bref (${theme.repos.duree} ≤ ${PLAFOND_MS} ms)`,
  Math.max(...String(theme.repos.duree).split(',').map(secondes)) * 1000 <= PLAFOND_MS,
  true,
);
v('aucune propriété de mise en page', fautives(theme.repos.props), []);

/* --- B. La réponse juste ou fausse -------------------------------------- */
/*
   Deux choses distinctes, et il ne faut pas les confondre : que le sens soit
   porté autrement que par l'animation et la couleur — c'était vrai avant ce
   lot —, et qu'un retour bref accompagne l'apparition de la marque, ce que
   l'A4 ajoute.
*/

console.log('\n  B — la réponse juste ou fausse');

/*
   Deux choses distinctes, vérifiées par deux moyens différents.

   La première — que le sens soit porté autrement que par la couleur et
   l'animation — était vraie AVANT ce lot : `marquerOption` pose un signe, le
   masque aux lecteurs d'écran, et leur donne un texte à la place. On la
   vérifie en lisant la source, parce que c'est elle qui pourrait changer ; la
   reconstituer à la main dans le navigateur ne prouverait que ma copie.

   La seconde — qu'un retour bref accompagne l'apparition de la marque — est ce
   que l'A4 ajoute, et elle se mesure sur l'écran.
*/
{
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/lib/ui.ts', 'utf8');
  v('la marque porte un signe ✓ pour une bonne réponse', source.includes("signe: '✓'"), true);
  v('et ✗ pour une réponse fausse', source.includes("signe: '✗'"), true);
  v(
    'le signe est masqué aux lecteurs d’écran',
    /signe\.setAttribute\('aria-hidden', 'true'\)/.test(source),
    true,
  );
  v('un texte le dit à leur place', /dit\.className = 'sr-only'/.test(source), true);

  const anime = await p.evaluate(() => {
    const e = document.createElement('span');
    e.dataset.marque = 'juste';
    e.textContent = '✓';
    document.body.append(e);
    const c = getComputedStyle(e);
    const lu = { nom: c.animationName, duree: c.animationDuration };
    e.remove();
    return lu;
  });
  v('la marque paraît par une animation', anime.nom !== 'none', true);
  v(
    `brève (${anime.duree} ≤ ${PLAFOND_MS} ms)`,
    secondes(anime.duree) * 1000 <= PLAFOND_MS && secondes(anime.duree) > 0,
    true,
  );
}

/* --- C. L'enregistrement réussi ----------------------------------------- */
/*
   Décision 3 : discrètes. Une coche, pas de confetti. On provoque un vrai
   message de succès — le changement de parcours en produit un.
*/

console.log('\n  C — l’enregistrement réussi');

{
  await ouvrirLaPage(p, '/glossaire/', '#selecteur-parcours');
  const options = await p.$$eval('#selecteur-parcours option', (o) => o.map((x) => x.value));
  const courant = await p.$eval('#selecteur-parcours', (e) => e.value);
  const autre = options.find((o) => o && o !== courant);
  v('il existe un second parcours pour provoquer un succès', Boolean(autre), true);

  if (autre) {
    await p.selectOption('#selecteur-parcours', autre);
    /*
       E6 du prompt 43 : la liste CHOISIT, le bouton APPLIQUE. Changer la
       valeur n'écrit plus rien et ne recharge plus — la bulle paraît après
       l'appui, au rechargement qui suit.
    */
    await p.click('#appliquer-parcours');
    const bulle = p.locator('.bulle-notification').first();
    await bulle.waitFor({ state: 'visible', timeout: 10000 });
    const lu = await bulle.evaluate((e) => ({
      coche: e.querySelector('[data-coche]')?.textContent ?? null,
      texte: (e.textContent ?? '').replace('✓', '').trim().length,
      duree: getComputedStyle(e).transitionDuration,
    }));
    v('le succès porte une coche', lu.coche, '✓');
    v('et le message garde son texte', lu.texte > 0, true);
    v(
      `la durée reste sous le plafond du succès (${lu.duree} ≤ ${PLAFOND_SUCCES_MS} ms)`,
      Math.max(...String(lu.duree).split(',').map(secondes)) * 1000 <= PLAFOND_SUCCES_MS,
      true,
    );
  }
}

/* --- D. Sous mouvement réduit, rien ne se déplace ------------------------ */
/*
   LE point de cette phase. Neutraliser la durée ne suffit pas : une mise à
   l'échelle sauterait à sa valeur en 0,01 ms, et le bouton se déplacerait tout
   de même. L'interdit n° 3 proscrit le déplacement, pas sa lenteur. On vérifie
   donc que la transformation ne change PAS, et non qu'elle change vite.
*/

console.log('\n  D — sous mouvement réduit, le bouton ne bouge pas');

{
  const sobre = await nav.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  const s = await sobre.newPage();
  await ouvrirLaPage(s, '/glossaire/', '#bouton-theme');
  const mesure = await transformationSousLeDoigt(s, '#bouton-theme');
  v(
    `la transformation est inchangée sous le doigt (${mesure.presse.transformation})`,
    mesure.presse.transformation,
    mesure.repos.transformation,
  );
  await sobre.close();
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
