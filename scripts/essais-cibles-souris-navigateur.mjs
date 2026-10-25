/**
 * LES CIBLES ATTEIGNENT 24 px À LA SOURIS (E8 du prompt 43).
 *
 *   SITE_PASSWORD=… npm run essais:cibles-souris:navigateur
 *
 * ## Le trou que cet essai ferme
 *
 * `essais:mobile:navigateur` déclare `hasTouch: true` et `isMobile: true`, et
 * son en-tête dit pourquoi : « sans ces deux-là, `pointer: coarse` est faux et
 * les hauteurs minimales du site ne s'appliquent pas ». C'est juste, et c'est
 * la moitié du sujet : il ne mesure **que** le pointeur grossier.
 *
 * Or WCAG 2.5.8 (AA) ne parle pas de l'organe de pointage. Il demande 24 × 24
 * px, avec quatre exemptions — le lien posé dans une phrase, la cible contrôlée
 * par l'agent utilisateur, l'essentiel, et l'espacement suffisant. Un bouton
 * d'en-tête et un lien de liste n'en relèvent d'aucune.
 *
 * Et les planchers du site vivaient TOUS sous `@media (pointer: coarse)` : à la
 * souris, une cible valait exactement ce que son contenu lui donnait.
 *
 * ## Ce que la mesure a donné avant le correctif
 *
 * Pointeur fin, corpus réel, le 25 octobre : **64 cibles sous 24 px sur
 * `/parametres/`** seul, 29 sur l'accueil, 29 sur `/revisions/`. Le 🔔 du
 * centre de notifications faisait 20 × 24, la flèche de retour 18 × 18, et les
 * liens de liste 214 × 23 — un pixel de trop peu, répété des dizaines de fois.
 * Personne ne pouvait le voir : aucun essai ne mesurait de ce côté.
 *
 * ## Pourquoi un essai à lui, et non un bloc de plus dans l'essai mobile
 *
 * Parce qu'un pointeur fin n'est pas un téléphone. Le ranger là aurait fait
 * d'« essais:mobile » le fourre-tout des cibles, et son contexte déclare
 * l'inverse de ce qu'il faut ici — on ne mélange pas deux prémisses opposées
 * dans un même fichier pour économiser un nom.
 *
 * ## Les deux prémisses, affirmées avant toute mesure
 *
 * Le pointeur est bien **fin**, et il y a bien des cibles à mesurer. Sans la
 * première, on mesurerait les 44 px du confort tactile et tout passerait ;
 * sans la seconde, « aucune cible sous 24 px » serait vrai d'une page vide.
 * C'est la leçon du balayage mobile, qui a rendu « aucun débordement » sur deux
 * pages qui débordaient, parce qu'elles étaient vides, coffre fermé.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

/** Le plancher de WCAG 2.5.8 AA, en pixels CSS. */
const PLANCHER = 24;

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;

function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
}

/* Les routes se trouvent en parcourant « dist/ », et non dans une liste écrite
   à la main : une liste oublie l'écran ajouté hier. */
const routes = [];
const parcourir = (dossier, prefixe) => {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) parcourir(chemin, `${prefixe}${entree}/`);
    else if (entree === 'index.html') routes.push(prefixe);
  }
};
parcourir('dist', '/');
routes.sort();

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/* NI « hasTouch » NI « isMobile » : c'est tout l'objet de cet essai. La largeur
   est celle d'un ordinateur, parce que c'est là qu'on tient une souris. */
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

console.log(`\nLES CIBLES À LA SOURIS — ${routes.length} routes, plancher ${PLANCHER} px\n`);

await franchirInitialisation(page, RACINE, MDP);

verifier(
  'prémisse : le pointeur est bien FIN',
  await page.evaluate(() => ({
    fin: window.matchMedia('(pointer: fine)').matches,
    grossier: window.matchMedia('(pointer: coarse)').matches,
  })),
  { fin: true, grossier: false },
);

/* Le coffre est ouvert, sans quoi les branches scellées — Corps, Psyché,
   Finances, Santé — ne seraient mesurées que vides. L'essai mobile a payé
   cette leçon : un commentaire affirmait l'ouvrir, et le code ne le faisait
   pas. */
await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  await page.waitForTimeout(1200);
}
verifier(
  'prémisse : le coffre est ouvert',
  await page.locator('#mdp-coffre').isVisible().catch(() => false),
  false,
);

const petites = [];
let mesurees = 0;

for (const route of routes) {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(250);

  const m = await page.evaluate((plancher) => {
    /* Le périmètre est celui des trois classes de cible, et c'est voulu : un
       contrôle et la règle qu'il surveille se lisent ensemble. Prendre tous les
       boutons accuserait des cibles que la feuille de style ne prétend pas
       tenir — et un contrôle qui accuse à tort finit par être désactivé. */
    const cibles = [
      ...document.querySelectorAll('.cible-tactile, .cible-tactile-pleine, .cible-minimale'),
    ].filter((e) => e.getClientRects().length > 0);
    const nom = (e) =>
      `${e.tagName.toLowerCase()}#${e.id || '(sans id)'}` +
      `.${String(e.className).split(/\s+/).filter(Boolean).slice(0, 2).join('.')}`;
    return {
      total: cibles.length,
      fautives: cibles
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.height < plancher || r.width < plancher)
        .map(({ e, r }) => `${nom(e)} ${Math.round(r.width)}×${Math.round(r.height)}`),
    };
  }, PLANCHER);

  mesurees += m.total;
  for (const f of m.fautives) petites.push(`${route} ${f}`);
}

verifier(
  `prémisse : des cibles ont été mesurées (${mesurees} sur ${routes.length} routes)`,
  mesurees > 300,
  true,
);
verifier(`aucune cible sous ${PLANCHER} px à la souris`, petites.slice(0, 12), []);
if (petites.length > 12) console.log(`      … et ${petites.length - 12} autre(s).`);

/*
   LES DEUX ICÔNES NOMMÉES PAR E8, à part : le point les désigne, et un
   constat nominatif survit à un refactor qui changerait les classes.
*/
await page.goto(`${RACINE}/parametres/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
  await page.waitForTimeout(900);
}
for (const [quoi, selecteur] of [
  ['🔔 le centre de notifications', '#centre-bouton'],
  ['↩ la flèche de retour', '#fleche-retour'],
]) {
  const boite = await page
    .locator(selecteur)
    .first()
    .boundingBox()
    .catch(() => null);
  if (!boite) {
    console.log(`  (${quoi} : absent de cet écran, non mesuré)`);
    continue;
  }
  verifier(
    `${quoi} atteint ${PLANCHER} px dans les deux dimensions`,
    Math.round(boite.width) >= PLANCHER && Math.round(boite.height) >= PLANCHER,
    true,
  );
}

verifier('aucune erreur de page pendant le balayage', erreurs.slice(0, 3), []);

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('Toutes les cibles atteignent le plancher, souris comprise.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
