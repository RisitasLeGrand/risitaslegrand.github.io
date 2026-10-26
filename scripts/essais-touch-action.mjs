/**
 * 0.5 — le délai du double appui, retiré des commandes et d'elles seules.
 *
 *   npm run essais:touch-action
 *
 * ## Ce que mesure cet essai
 *
 * Un navigateur tactile attend environ trois cents millisecondes après un
 * appui, au cas où un second viendrait former un double appui — le geste qui
 * grossit la page. `touch-action: manipulation` dit « ici, pas de double
 * appui » et rend ces trois dixièmes de seconde.
 *
 * La partie qui compte dans ce point n'est pas la règle : c'est le
 * **seulement**. Posée sur `body`, la même règle retirerait le double appui
 * de la page entière — or le double appui sur un paragraphe est **la façon
 * dont on grossit un texte** sur un téléphone. On aurait payé un geste
 * d'accessibilité pour gagner trois dixièmes sur des boutons. L'essai mesure
 * donc les deux moitiés : les commandes l'ont, le reste ne l'a pas.
 *
 * ## Ce qu'il ne mesure pas
 *
 * Il ne mesure pas le délai lui-même. Chrome sans tête n'a pas de pouce, et
 * aucune API de pilotage ne rend « le temps écoulé avant que l'appui ne
 * parte ». C'est un constat sur la propriété calculée, c'est-à-dire sur la
 * règle qui gouverne le geste, et il faut le lire ainsi : l'essai attrape la
 * régression — une règle retirée, ou étendue à `body` par commodité — sans
 * prouver qu'un pouce réel gagne ces trois dixièmes.
 *
 * ## La contrepartie, elle, est mesurable
 *
 * `manipulation` vaut `pan-x pan-y pinch-zoom` : le défilement et le
 * pincement restent. Ce qui les tuerait, c'est `none`. L'essai vérifie donc
 * qu'**aucun élément** de ces écrans ne calcule `none` — la valeur qui
 * transformerait le remède en mal.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/** Des écrans de genres différents : accueil, quotidien, saisie, lecture. */
const ECRANS = ['/', '/odyssee/', '/odyssee/taches/', '/sport/seance/', '/progression/'];

/**
 * Ce qui est une commande, dit en sélecteurs.
 *
 * `label` n'y est pas, et c'est délibéré : dans ce dépôt les étiquettes sont
 * du texte à côté d'un champ, pas des rangées qu'on touche — aucune ne porte
 * « cible-tactile » (vérifié). Leur retirer le double appui coûterait le
 * grossissement d'un texte pour rien.
 */
const COMMANDES = 'button, [role="button"], a[href], input, select, textarea, summary';

/** Ce qui ne doit PAS l'avoir : la page elle-même, et le texte. */
const TEXTES = 'p, h1, h2, h3, li, td';

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
/*
   LA PRÉMISSE TACTILE N'EST PAS UN DÉTAIL. Hors d'un contexte tactile, un
   moteur peut rendre `touch-action` sans que la propriété gouverne quoi que
   ce soit — et le référentiel de l'application mobile rappelle qu'un essai
   qui oublie cette prémisse mesure un écran de bureau étroit.
*/
const ctx = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
await franchirInitialisation(page, RACINE, MDP);

console.log('\nLES COMMANDES RENDENT LES TROIS DIXIÈMES DE SECONDE');

for (const chemin of ECRANS) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const releve = await page.evaluate(
    ([selecteurCommandes, selecteurTextes]) => {
      const visible = (e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const commandes = [...document.querySelectorAll(selecteurCommandes)].filter(visible);
      const manquantes = commandes
        .filter((e) => getComputedStyle(e).touchAction !== 'manipulation')
        .slice(0, 5)
        .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} → ${getComputedStyle(e).touchAction}`);

      const textes = [...document.querySelectorAll(selecteurTextes)].filter(visible);
      const textesPris = textes
        .filter((e) => getComputedStyle(e).touchAction === 'manipulation')
        .slice(0, 5)
        .map((e) => `${e.tagName.toLowerCase()} → manipulation`);

      /* `none` tuerait le défilement et le pincement : on le cherche partout. */
      const figes = [...document.querySelectorAll('*')]
        .filter((e) => getComputedStyle(e).touchAction === 'none')
        .slice(0, 5)
        .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}`);

      return {
        combienDeCommandes: commandes.length,
        combienDeTextes: textes.length,
        manquantes,
        textesPris,
        figes,
        racine: getComputedStyle(document.documentElement).touchAction,
        corps: getComputedStyle(document.body).touchAction,
      };
    },
    [COMMANDES, TEXTES],
  );

  /*
     LA PRÉMISSE AVANT LE VERDICT : un écran sans commande visible rendrait
     « aucune manquante » sans rien avoir mesuré, et ce vert serait un
     mensonge.
  */
  if (releve.combienDeCommandes === 0) {
    console.log(`\x1b[31m✗\x1b[0m ${chemin} — aucune commande visible : rien n’a été mesuré`);
    rouges += 1;
    continue;
  }

  verifier(
    `${chemin} — les ${releve.combienDeCommandes} commandes visibles portent « manipulation »`,
    releve.manquantes,
    [],
  );

  /* L'autre moitié du point, et la plus facile à perdre. */
  if (releve.combienDeTextes > 0) {
    verifier(`${chemin} — et le texte garde son double appui`, releve.textesPris, []);
  }
  verifier(`${chemin} — la racine n’est pas prise`, releve.racine, 'auto');
  verifier(`${chemin} — le corps non plus`, releve.corps, 'auto');
  verifier(`${chemin} — rien ne calcule « none », qui figerait le défilement`, releve.figes, []);
}

await nav.close();
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
