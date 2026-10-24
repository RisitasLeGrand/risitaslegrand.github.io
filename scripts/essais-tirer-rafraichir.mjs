/**
 * M6 — le tirer-pour-rafraîchir ne fait pas perdre une saisie.
 *
 *   npm run essais:tirer-rafraichir
 *
 * ## Ce que cet essai mesure, et ce qu'il ne mesure pas
 *
 * Le tirer-pour-rafraîchir appartient au navigateur, pas à la page. Chrome
 * sans tête ne l'implémente pas, et aucune API de pilotage ne le déclenche :
 * `Input.synthesizeScrollGesture` produit un défilement, jamais le
 * rechargement. **Cet essai ne constate donc pas le geste.** Il constate la
 * propriété qui le gouverne : `overscroll-behavior-y` sur l'élément qui
 * défile. Tant que cette propriété vaut `contain` ou `none`, Chrome Android
 * n'arme pas le geste ; dès qu'elle revient à `auto`, il le réarme.
 *
 * C'est donc une mesure de la règle, pas de l'effet, et il faut la lire
 * ainsi : elle attrape la régression — quelqu'un qui retire la ligne de
 * `global.css`, ou un écran qui remet `auto` sur sa racine — sans jamais
 * prouver qu'un pouce réel ne recharge pas la page.
 *
 * ## Pourquoi la mesure se fait écran par écran
 *
 * Une règle posée une fois sur `html` suffit en théorie. En pratique, un
 * écran peut poser son propre `overflow` sur un conteneur et déplacer
 * l'élément qui défile : la règle de la racine ne gouverne alors plus rien.
 * On relève donc, sur chaque écran quotidien, la propriété de
 * `document.scrollingElement` — celui que le navigateur fait vraiment
 * défiler — et non celle d'un `html` qui ne défilerait pas.
 *
 * ## Et la contrepartie
 *
 * `contain` et non `none` : les zones qui défilent sur elles-mêmes doivent
 * garder leur propre comportement. L'essai vérifie que la feuille du bas
 * défile toujours, sinon le remède vaudrait le mal.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/** Les écrans quotidiens, plus ceux où l'on tape le plus longtemps. */
const ECRANS = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/taches/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/odyssee/psyche/',
  '/odyssee/quetes/',
  '/sport/seance/',
  '/flashcards/',
  '/revisions/',
];

/** Les deux valeurs qui désarment le geste du navigateur. */
const SUFFISANTES = ['contain', 'none'];

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
await franchirInitialisation(page, RACINE, MDP);

console.log('\nLE GESTE DE RAFRAÎCHISSEMENT NE PEUT PAS RECHARGER');
for (const chemin of ECRANS) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const releve = await page.evaluate(() => {
    const defilant = document.scrollingElement ?? document.documentElement;
    return {
      balise: defilant.tagName.toLowerCase(),
      regle: getComputedStyle(defilant).overscrollBehaviorY,
    };
  });
  /*
     La prémisse d'abord : si l'élément qui défile n'est pas celui qu'on
     croit, la mesure porterait sur une règle sans effet.
  */
  if (releve.balise !== 'html') {
    console.log(
      `\x1b[31m✗\x1b[0m ${chemin} — l’élément qui défile est <${releve.balise}>, pas <html> : la règle de la racine ne le gouverne pas`,
    );
    rouges += 1;
    continue;
  }
  verifier(`${chemin} — overscroll-behavior-y désarme le geste`, SUFFISANTES.includes(releve.regle), true);
}

/*
   LA CONTREPARTIE. `contain` ne doit pas figer les zones qui défilent sur
   elles-mêmes : on ouvre la feuille du bas et on vérifie qu'elle défile
   encore. Un remède qui casse la feuille serait pire que le mal.
*/
console.log('\nET LA FEUILLE DU BAS DÉFILE TOUJOURS');
await page.goto(`${RACINE}/odyssee/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const plus = page.locator('#ouvrir-plus');
if (!(await plus.isVisible().catch(() => false))) {
  console.log('\x1b[31m✗\x1b[0m prémisse manquante : le bouton « Plus » n’est pas visible');
  rouges += 1;
} else {
  await plus.click();
  await page.waitForTimeout(600);
  const defile = await page.evaluate(() => {
    const feuille = document.querySelector('.feuille-sure, .boite-feuille, #feuille-plus');
    if (!feuille) return { trouvee: false };
    const style = getComputedStyle(feuille);
    return {
      trouvee: true,
      peutDefiler: ['auto', 'scroll'].includes(style.overflowY),
      regle: style.overscrollBehaviorY,
    };
  });
  verifier('la feuille du bas existe et garde son propre défilement', defile.trouvee && defile.peutDefiler, true);
}

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
