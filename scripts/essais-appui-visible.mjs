/**
 * M7 — le doigt obtient une réponse avant que l'écriture ait lieu.
 *
 *   npm run essais:appui-visible
 *
 * ## Ce que le prompt demande
 *
 * « Ce lot ne traite que ce qui est lent au doigt : **retour visuel immédiat
 * à l'appui**, pas d'écran blanc pendant une lecture. »
 *
 * ## Pourquoi un contrôle, alors que la règle existe déjà
 *
 * `global.css` pose `button:active { transform: scale(0.97) }` depuis une
 * phase antérieure, et je l'avais d'abord rapporté comme **lu dans le
 * code** — ce qui ne prouve rien. Une sonde textuelle prouve qu'un
 * garde-fou est cité, jamais qu'il agit : la règle pourrait être écrasée
 * par une classe utilitaire, annulée par un `transform` concurrent sur le
 * même élément, ou ne jamais s'appliquer parce que le bouton réel est un
 * `<a>` sans `role="button"`.
 *
 * Ce contrôle appuie vraiment — `mouse.down()` — et lit la transformation
 * calculée **pendant** que le doigt est posé. C'est la différence entre
 * citer une règle et constater son effet.
 *
 * ## Le revers, qui compte autant
 *
 * Sous mouvement réduit, la transformation doit disparaître — pas durer
 * moins longtemps, disparaître. Le commentaire de `global.css` explique
 * pourquoi : ramener la durée à 0,01 ms ferait sauter le bouton à sa taille
 * réduite instantanément, donc le déplacerait plus brutalement encore.
 * L'essai vérifie les deux sens.
 *
 * ## Le bridage
 *
 * Processeur ralenti 4 fois : le retour visuel doit tenir sur un téléphone
 * moyen, pas sur une machine de bureau. Et il ne dépend d'aucun script —
 * c'est du CSS —, ce qui est précisément la raison pour laquelle il tient
 * même quand le fil principal est occupé à déchiffrer.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/** Les boutons de quelques-uns des dix gestes de M1, pris là où ils vivent. */
const APPUIS = [
  { nom: 'Tâches — « Ajouter »', chemin: '/odyssee/taches/', cible: '#ajout button[type=submit]' },
  { nom: 'Corps — un verre d’eau', chemin: '/odyssee/corps/', cible: '[data-verre]' },
  { nom: 'Corps — « J’ai dormi »', chemin: '/odyssee/corps/', cible: '#dormir' },
  { nom: 'Sport — « Commencer la séance »', chemin: '/sport/seance/', cible: '#commencer' },
  { nom: 'Calendrier — « Aujourd’hui »', chemin: '/odyssee/calendrier/', cible: '#aujourdhui' },
];

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
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

/**
 * Appuie sur une cible et rend la transformation calculée pendant l'appui.
 *
 * `mouse.down()` sans `up()` : c'est le seul moyen de lire l'état `:active`,
 * qui ne dure qu'entre les deux. Un `click()` ordinaire relâcherait avant
 * qu'on ait pu regarder, et l'essai conclurait « aucun retour » sur un
 * bouton qui en donne un.
 */
async function transformationSousLeDoigt(page, selecteur) {
  const cible = page.locator(selecteur).first();
  if (!(await cible.isVisible().catch(() => false))) return { absent: true };
  /*
     AMENER LE BOUTON DANS L'ÉCRAN AVANT D'APPUYER — correction de mon propre
     essai. `boundingBox()` rend des coordonnées relatives à la fenêtre : un
     bouton situé plus bas que 740 px donnait un `y` hors du champ, la souris
     n'appuyait sur rien, et l'essai rapportait « le bouton ne s'enfonce
     pas » sur « un verre d'eau » et « J'ai dormi » — deux boutons sains.
     Un contrôle qui accuse à tort se fait désactiver, et on perd les cinq.
  */
  await cible.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const boite = await cible.boundingBox();
  if (!boite) return { absent: true };
  /*
     Et l'on vérifie que rien ne recouvre le point visé : la barre du bas et
     l'en-tête collant sont fixes, et un appui qui tomberait sur eux
     mesurerait leur réaction, pas celle du bouton.
  */
  const x = boite.x + boite.width / 2;
  const y = boite.y + boite.height / 2;
  const dessus = await page.evaluate(
    ([px, py, sel]) => {
      const n = document.elementFromPoint(px, py);
      return Boolean(n && (n.matches(sel) || n.closest(sel)));
    },
    [x, y, selecteur],
  );
  if (!dessus) return { recouvert: true };
  const avant = await cible.evaluate((n) => getComputedStyle(n).transform);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const pendant = await cible.evaluate((n) => getComputedStyle(n).transform);
  await page.mouse.up();
  await page.waitForTimeout(250);
  const apres = await cible.evaluate((n) => getComputedStyle(n).transform);
  return { avant, pendant, apres };
}

/** « matrix(0.97, 0, 0, 0.97, 0, 0) » ou plus petit : le bouton s'enfonce. */
const estReduit = (transformation) => {
  if (!transformation || transformation === 'none') return false;
  const nombres = transformation.match(/-?\d+(\.\d+)?/g);
  if (!nombres || nombres.length < 4) return false;
  return Number(nombres[0]) < 0.999 && Number(nombres[3]) < 0.999;
};

async function passe(mouvementReduit) {
  const ctx = await nav.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    reducedMotion: mouvementReduit ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await franchirInitialisation(page, RACINE, MDP);
  /*
     La prémisse : `reducedMotion` du contexte doit réellement arriver à la
     page. Sans cette vérification, une passe « mouvement réduit » qui ne le
     serait pas rapporterait « la transformation a bien disparu » alors
     qu'elle n'aurait jamais dû être là.
  */
  const vuParLaPage = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (vuParLaPage !== mouvementReduit) {
    console.log(
      `\x1b[31m✗\x1b[0m PRÉMISSE — mouvement réduit demandé : ${mouvementReduit}, vu par la page : ${vuParLaPage}`,
    );
    rouges += 1;
    await ctx.close();
    return;
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  for (const appui of APPUIS) {
    await page.goto(`${RACINE}${appui.chemin}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(3500);
    const r = await transformationSousLeDoigt(page, appui.cible);
    if (r.absent) {
      console.log(`\x1b[31m✗\x1b[0m ${appui.nom} — cible absente (${appui.cible}) : rien n’a été appuyé`);
      rouges += 1;
      continue;
    }
    if (r.recouvert) {
      console.log(`\x1b[31m✗\x1b[0m ${appui.nom} — un autre élément recouvre le point visé : l’appui ne porterait pas sur le bouton`);
      rouges += 1;
      continue;
    }
    if (mouvementReduit) {
      verifier(`${appui.nom} — sous mouvement réduit, le bouton ne bouge pas`, estReduit(r.pendant), false);
      continue;
    }
    verifier(`${appui.nom} — le bouton s’enfonce sous le doigt`, estReduit(r.pendant), true);
    /*
       Et il se relève : un bouton resté enfoncé après le relâchement
       signalerait un geste encore en cours alors qu'il est fini.
    */
    verifier(`${appui.nom} — et il se relève au relâchement`, estReduit(r.apres), false);
  }
  await ctx.close();
}

console.log('\nLE BOUTON RÉPOND AU DOIGT — processeur ÷ 4');
await passe(false);
console.log('\nET SOUS MOUVEMENT RÉDUIT, IL NE BOUGE PAS');
await passe(true);

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
