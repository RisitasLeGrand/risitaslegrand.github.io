/**
 * Les mots collés, dans le texte **rendu**.
 *
 * ## Pourquoi un second contrôle
 *
 * `essais:espaces` lit le HTML construit, et c'est sa force : il voit les
 * gabarits de toutes les pages sans ouvrir de navigateur. Mais il a deux
 * angles morts, et les deux cas que la critique du 14 octobre a relevés
 * tombaient l'un dans chacun.
 *
 * Il ne connaît pas le `display` **calculé** : un `<label class="flex …">` est
 * un bloc, et un mot collé à un bloc ne se voit pas. Lui faire deviner
 * produisait un faux positif immédiat.
 *
 * Et il ne voit pas ce que le **code écrit à l'affichage**. Les libellés de
 * Psyché — « Humeur » suivi de « Comment vous sentez-vous ? » — sont posés
 * dans le DOM par le gabarit, mais un écran qui composerait son texte en
 * JavaScript lui échapperait entièrement.
 *
 * Celui-ci ouvre les pages, lit le DOM, et demande au navigateur quels
 * éléments sont réellement en ligne. Il est plus lent et moins exhaustif : il
 * ne couvre que les routes qu'on lui donne. Les deux se complètent, aucun ne
 * remplace l'autre.
 */
import { chromium } from 'playwright-core';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/**
 * Ce qu'on accepte collé, et pourquoi.
 *
 * La liste est **motivée, pas commode** : chaque entrée dit ce qu'elle laisse
 * passer. Une exception sans raison serait une façon polie de désactiver le
 * contrôle.
 */
const EXCEPTIONS = [
  /** Une unité suit son nombre sans espace : « 12h », « 80% ». */
  /^\d+$/,
  /** Une apostrophe colle à bon droit : « l'IA ». */
  /['’]$/,
  /** Une ouvrante aussi : « (voir », « «&nbsp; ». */
  /[([«]$/,
  /** Un tiret de composition : « sous-jacent ». */
  /-$/,
];

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      ${JSON.stringify(obtenu)?.slice(0, 600)}`);
};

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

const contexte = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contexte.newPage();

/** Cherche, dans le DOM rendu, un texte collé à un élément réellement en ligne. */
const CHERCHER = (exceptions) => {
  const motifs = exceptions.map((m) => new RegExp(m));
  const trouves = [];
  const enLigne = (e) => getComputedStyle(e).display.startsWith('inline');
  for (const el of document.querySelectorAll('body *')) {
    if (!enLigne(el)) continue;
    const avant = el.previousSibling;
    if (!avant || avant.nodeType !== Node.TEXT_NODE) continue;
    const gauche = avant.textContent ?? '';
    const droite = el.textContent ?? '';
    if (!gauche.trim() || !droite.trim()) continue;
    if (/\s$/.test(gauche) || /^\s/.test(droite)) continue;
    const dernier = gauche.trimEnd().slice(-1);
    if (motifs.some((m) => m.test(dernier))) continue;
    trouves.push(`${gauche.trimEnd().slice(-18)}|${droite.trimStart().slice(0, 18)}`);
  }
  return trouves;
};

const sources = EXCEPTIONS.map((r) => r.source);
const colles = [];
/**
 * Évalue dans la page, en survivant à une navigation qui tombe au même instant.
 *
 * ## Le rouge que cette fonction existe pour empêcher
 *
 * Le déverrouillage peut recharger la page. L'attente fixe de 900 ms qui le
 * suivait tenait presque toujours — et pas toujours : sous la charge d'une
 * batterie complète, la navigation est tombée pendant l'`evaluate`, qui a
 * rendu « Execution context was destroyed, most likely because of a
 * navigation ». L'essai s'est arrêté net au bout de cinq secondes, sur une
 * exception, sans avoir mesuré une seule route.
 *
 * C'est le pire genre de rouge : il n'apprend rien sur le site, il coûte une
 * batterie de douze minutes, et il pousse à conclure « flake » — ce qui n'est
 * pas une cause. La cause est ici : une attente par durée là où il fallait
 * attendre un ÉVÉNEMENT.
 *
 * On attend donc que le chargement se calme, et si le contexte a malgré tout
 * été détruit, on réessaie une fois après ce même calme. Une seconde
 * destruction serait un vrai défaut de la page, et elle remonte.
 */
const evaluerMalgreUneNavigation = async (fn, arg) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  try {
    return await page.evaluate(fn, arg);
  } catch (erreur) {
    if (!/Execution context was destroyed/.test(String(erreur?.message ?? erreur))) throw erreur;
    await page.waitForLoadState('networkidle').catch(() => {});
    return await page.evaluate(fn, arg);
  }
};

for (const r of routes) {
  await page.goto(`${RACINE}${r}`, { waitUntil: 'networkidle', timeout: 20000 });
  const verrou = page.locator('#champ-mdp');
  if (await verrou.isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(900);
  }
  const trouves = await evaluerMalgreUneNavigation(CHERCHER, sources);
  for (const t of trouves) colles.push(`${r} → ${t}`);
}

console.log(`\nLES MOTS COLLÉS, DANS LE TEXTE RENDU (${routes.length} routes, coffre ouvert)`);
v('aucun mot collé à un élément réellement en ligne', colles, []);

await nav.close();
console.log(
  echecs === 0 ? '\n\x1b[32mTout est vert.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
