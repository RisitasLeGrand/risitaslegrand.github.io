/**
 * Listes qui changent — et le mouvement réduit que les transitions ignoraient.
 *
 *   npm run essais:listes
 *
 * **Deux choses, et la seconde n'était pas prévue au plan.**
 *
 * *La première.* Quand une liste se réordonne, ses éléments doivent glisser
 * vers leur nouvelle place au lieu de sauter (A3). Le plan annonçait
 * `animate:flip` de Svelte. **Le relevé du 14 octobre 2026 l'écarte** : les
 * listes que l'A3 nomme ne sont pas des composants Svelte. Les tâches
 * d'Odyssée sont peintes par `innerHTML` dans le script de la page ; le centre
 * de notifications n'existe pas ; les flashcards montrent une carte à la fois.
 * `animate:flip` n'a donc aucune prise. L'équivalent natif, et déjà adopté par
 * la décision 1, est `document.startViewTransition()` avec un
 * `view-transition-name` stable par élément : le navigateur apparie l'ancien
 * et le nouveau par leur nom, et fait glisser. Cela traverse même un
 * `innerHTML = ''`, puisque l'appariement se fait par nom, pas par identité
 * d'objet.
 *
 * *La seconde, trouvée en chemin et mesurée.* Le socle de mouvement réduit
 * (phase 0) ramène toute durée à 0,01 ms par un sélecteur `*`. Or `*` **ne
 * sélectionne pas** les pseudo-éléments `::view-transition-*`. Les transitions
 * de page livrées en phase 1 jouaient donc leur animation complète sous
 * `prefers-reduced-motion: reduce` : **246 ms mesurés, contre 245 ms en mode
 * normal**. C'est ma régression de la phase 1, et l'interdit n° 3 ne tolère
 * qu'un fondu de 100 ms au plus. Le contrôle A la fige pour qu'elle ne
 * revienne pas.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/** L'interdit n° 3 : sous mouvement réduit, un fondu très court, ou rien. */
const PLAFOND_SOBRE_MS = 100;

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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};

console.log('\nLISTES QUI CHANGENT');

/* --- A. La transition de page sous mouvement réduit ---------------------- */
/*
   On chronomètre la transition elle-même, par la promesse `finished` que
   l'API expose, plutôt que de relire une durée dans la feuille de style : le
   plafond de l'interdit n° 3 porte sur ce que l'utilisateur subit, pas sur ce
   qui est écrit.
*/

console.log('\n  A — la transition de page respecte le mouvement réduit');

const chronometrerUneNavigation = async (mouvement) => {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: mouvement,
  });
  await ctx.addInitScript(() => {
    window.addEventListener(
      'pagereveal',
      (e) => {
        const noter = (valeur) => {
          try {
            sessionStorage.setItem('essai.duree', String(valeur));
          } catch {
            /* sans sessionStorage, l'absence de relevé vaut échec */
          }
        };
        if (!e.viewTransition) return noter(0);
        const debut = performance.now();
        e.viewTransition.finished.then(() => noter(Math.round(performance.now() - debut)));
      },
      { once: true },
    );
  });
  const page = await ctx.newPage();
  await page.goto(`${RACINE}/glossaire/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.location.href = '/recherche/';
  });
  await page.waitForURL('**/recherche/', { timeout: 15000 });
  await page.waitForTimeout(900);
  const lu = Number(await page.evaluate(() => sessionStorage.getItem('essai.duree')));
  await ctx.close();
  return lu;
};

const normal = await chronometrerUneNavigation('no-preference');
const sobre = await chronometrerUneNavigation('reduce');

/* Sans ce premier contrôle, le second serait vert sur un site où plus rien ne
   bouge du tout — et on ne le saurait pas. */
v(`en mode normal, la transition joue (${normal} ms)`, normal > PLAFOND_SOBRE_MS, true);
v(
  `sous mouvement réduit, elle est écourtée (${sobre} ms ≤ ${PLAFOND_SOBRE_MS} ms)`,
  sobre <= PLAFOND_SOBRE_MS,
  true,
);

/* --- La liste des tâches ------------------------------------------------- */

const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });

/* On intercepte `startViewTransition` avant tout script de la page : c'est le
   seul moyen de savoir que la repeinte y passe, sans modifier l'application
   pour les besoins de l'essai. L'original est appelé derrière, pour ne rien
   changer au comportement observé. */
await ctx.addInitScript(() => {
  window.__transitionsLancees = 0;
  const original = document.startViewTransition?.bind(document);
  if (original) {
    document.startViewTransition = (...args) => {
      window.__transitionsLancees += 1;
      return original(...args);
    };
  }
});

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
const session = page.locator('#champ-mdp');
if (await session.isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.locator('#ajout').waitFor({ state: 'visible', timeout: 20000 });

/* Trois tâches synthétiques — aucune donnée réelle, interdit n° 7. Trois pour
   qu'en clore une déplace vraiment les autres ; avec une seule, rien ne
   glisserait et le contrôle serait vert sans objet. */
console.log('\n  B — les cartes portent un nom de transition stable');

for (const titre of ['Essai — alpha', 'Essai — bêta', 'Essai — gamma']) {
  await page.fill('#titre', titre);
  await page.click('#ajout button[type="submit"]');
  await page.waitForTimeout(250);
}

const cartes = page.locator('[data-tache]');
const combien = await cartes.count();
v('trois tâches synthétiques sont en place', combien >= 3, true);

const noms = await page.$$eval('[data-tache]', (e) =>
  e.map((x) => getComputedStyle(x).viewTransitionName),
);
v(
  'chaque carte porte un nom',
  noms.every((n) => n && n !== 'none'),
  true,
);
v('et les noms sont tous distincts', new Set(noms).size, noms.length);

/* --- C. Clore une tâche passe par une transition ------------------------- */

console.log('\n  C — clore une tâche fait glisser la liste');

await page.evaluate(() => {
  window.__transitionsLancees = 0;
});
await page.click('[data-faire]');
await page.waitForTimeout(700);
v(
  'la repeinte passe par une transition de même document',
  await page.evaluate(() => window.__transitionsLancees),
  1,
);
v(
  'la tâche a bien changé de zone',
  await page.locator('#closes [data-tache]').count(),
  1,
);

/* --- D. Et sous mouvement réduit, rien ne glisse ------------------------- */

console.log('\n  D — sous mouvement réduit, la liste ne glisse pas');

/*
   **Ce qu'on chronomètre, et ce que l'interdit gouverne.** La promesse
   `finished` couvre l'animation ET le travail de l'API autour d'elle : prendre
   les photographies, attendre une image, écrire le DOM. Relevé le 14 octobre :
   108 ms sous mouvement réduit, alors que les animations y durent 0,01 ms.
   Opposer le plafond de 100 ms à ce chiffre reviendrait à reprocher à
   l'implémentation un surcoût qu'elle ne gouverne pas — c'était ma première
   écriture, et elle était fausse.
   On compare donc les deux modes sur le MÊME geste : ce qui disparaît entre
   les deux est l'animation, et c'est elle que l'interdit n° 3 vise. Relire la
   feuille de style aurait été plus simple et n'aurait rien prouvé : la phase 1
   a montré ce que vaut une règle écrite mais inopérante.
*/
const chronometrerUneCloture = async (mouvement) => {
  const c = await nav.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: mouvement,
  });
  await c.addInitScript(() => {
    window.__dureeListe = null;
    const original = document.startViewTransition?.bind(document);
    if (original) {
      document.startViewTransition = (...args) => {
        const debut = performance.now();
        const t = original(...args);
        t.finished
          .then(() => {
            window.__dureeListe = Math.round(performance.now() - debut);
          })
          .catch(() => {});
        return t;
      };
    }
  });
  const q = await c.newPage();
  await q.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
  const verrou = q.locator('#champ-mdp');
  if (await verrou.isVisible().catch(() => false)) {
    await q.fill('#champ-mdp', MDP);
    await q.click('#bouton-verrou');
  }
  await q.locator('#ajout').waitFor({ state: 'visible', timeout: 20000 });

  await q.fill('#titre', `Essai — ${mouvement}`);
  await q.click('#ajout button[type="submit"]');
  await q.locator('[data-faire]').first().waitFor({ state: 'visible', timeout: 20000 });

  await q.evaluate(() => {
    window.__dureeListe = null;
  });
  await q.click('[data-faire]');
  await q.waitForTimeout(900);
  const lu = await q.evaluate(() => window.__dureeListe);
  await c.close();
  return lu;
};

{
  const listeNormale = await chronometrerUneCloture('no-preference');
  const listeSobre = await chronometrerUneCloture('reduce');

  v('la transition de liste a bien lieu dans les deux modes', [
    listeNormale !== null,
    listeSobre !== null,
  ], [true, true]);

  /* Le seuil est posé sur l'écart, pas sur une valeur absolue : l'animation
     ordinaire dure 250 ms, le surcoût de l'API une centaine. Si le mouvement
     réduit n'enlevait pas au moins la moitié du total, c'est que l'animation
     jouerait encore. */
  v(
    `sous mouvement réduit, le geste est moitié plus court (${listeSobre} ms contre ${listeNormale} ms)`,
    listeSobre !== null && listeNormale !== null && listeSobre * 2 <= listeNormale,
    true,
  );
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
