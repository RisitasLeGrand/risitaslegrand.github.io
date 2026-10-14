/**
 * Apparition et disparition — et le piège du « display ».
 *
 *   npm run essais:apparition
 *
 * **Le problème que cette phase doit résoudre.** Cyclades montre et cache
 * presque tout en basculant `display` : l'attribut `hidden` sur le menu de
 * thème, la classe `.hidden` de Tailwind ailleurs — 43 fichiers au relevé du
 * 14 octobre 2026. Or `display: none` → `display: block` **ne se transitionne
 * pas** : l'élément paraît d'un coup. Écrire une transition d'opacité sur un
 * tel élément ne produit rien du tout, et un contrôle naïf serait vert parce
 * qu'il ne regarde pas au bon endroit.
 *
 * La parade mesurée le 14 octobre, sur Chromium 141 : `transition-behavior:
 * allow-discrete` avec `@starting-style`. L'élément transitionne alors son
 * opacité **pendant** que `display` change. Relevé de la sonde :
 * `transitionrun` déclenché sur `opacity`, opacité à 0,87 après 120 ms.
 * Sans ce mécanisme — navigateur plus ancien — l'élément paraît d'un coup,
 * comme aujourd'hui : la dégradation est silencieuse et sans dommage.
 *
 * **Ce que cet essai mesure, et pourquoi pas autre chose.** Il n'interroge pas
 * la feuille de style : il provoque l'ouverture et la fermeture sur les écrans
 * réels, et relève l'événement `transitionrun`, seul à dire qu'une transition
 * a effectivement démarré. Une règle écrite mais inopérante — c'est exactement
 * ce qui s'est produit en phase 1, où Astro émettait une feuille invalide — le
 * laisserait rouge.
 *
 * Quatre contrôles :
 *
 *   A — le menu de thème (attribut `hidden`) ;
 *   B — la feuille « Plus » de la navigation sur téléphone (classe `.hidden`) ;
 *   C — la fermeture est plus brève que l'ouverture (exigence de l'A2) ;
 *   D — interdit n° 4 : aucune propriété de mise en page transitionnée.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/** Chromium rend les durées en secondes (« 0.2s ») : on compare un nombre. */
const secondes = (brut) => Number.parseFloat(String(brut)) || 0;

/** Les propriétés que l'interdit n° 4 proscrit : elles recalculent la mise en page. */
const INTERDITES = [
  'width',
  'height',
  'top',
  'left',
  'right',
  'bottom',
  'margin',
  'padding',
  'inset',
  'block-size',
  'inline-size',
];

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

console.log('\nAPPARITION ET DISPARITION');

/*
   Le verrou de session masque toute la page : sans lui, les boutons existent
   dans le DOM mais `click` attend indéfiniment un élément invisible. Relevé le
   14 octobre 2026, au premier lancement de cet essai.
*/
const ouvrirLaPage = async (page, route) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  const verrou = page.locator('#champ-mdp');
  if (await verrou.isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.locator('#bouton-theme').waitFor({ state: 'visible', timeout: 20000 });
};

/*
   Relève ce qui se passe quand on bascule un élément : la transition a-t-elle
   démarré, sur quelle propriété, et quelle durée l'élément porte-t-il dans
   l'état où il arrive. On pose le témoin AVANT de cliquer, et on laisse au
   navigateur une image pour démarrer.
*/
const observer = async (page, selecteur, action) => {
  await page.evaluate((s) => {
    const e = document.querySelector(s);
    window.__vues = [];
    e.addEventListener('transitionrun', (ev) => window.__vues.push(ev.propertyName));
  }, selecteur);
  await action();
  await page.waitForTimeout(80);
  return page.evaluate((s) => {
    const e = document.querySelector(s);
    const c = getComputedStyle(e);
    return {
      transitions: [...new Set(window.__vues ?? [])].sort(),
      duree: c.transitionDuration,
      proprietes: c.transitionProperty,
      affichage: c.display,
    };
  }, selecteur);
};

/* --- A. Le menu de thème, piloté par l'attribut « hidden » --------------- */

console.log('\n  A — le menu de thème');

const bureau = await nav.newContext({ viewport: { width: 1280, height: 800 } });
const p = await bureau.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
await ouvrirLaPage(p, '/glossaire/');

const ouvertureTheme = await observer(p, '#menu-theme', () => p.click('#bouton-theme'));
/* On exige l'opacité, pas un ensemble exact : « display » et « transform »
   courent aussi, et c'est voulu. Le relevé complet est affiché pour qu'une
   dérive se voie. */
v(
  `l'ouverture démarre une transition d'opacité (${ouvertureTheme.transitions.join(', ')})`,
  ouvertureTheme.transitions.includes('opacity'),
  true,
);
v('le menu est bien affiché après ouverture', ouvertureTheme.affichage !== 'none', true);

const fermetureTheme = await observer(p, '#menu-theme', () => p.click('#bouton-theme'));
v(
  `la fermeture démarre une transition d'opacité (${fermetureTheme.transitions.join(', ')})`,
  fermetureTheme.transitions.includes('opacity'),
  true,
);

/* --- B. La feuille « Plus », pilotée par la classe « .hidden » ----------- */

console.log('\n  B — la feuille « Plus » de la navigation sur téléphone');

const tel = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const t = await tel.newPage();
t.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
await ouvrirLaPage(t, '/glossaire/');

const ouvertureFeuille = await observer(t, '#feuille-plus', () => t.click('#ouvrir-plus'));
v(
  `l'ouverture démarre une transition d'opacité (${ouvertureFeuille.transitions.join(', ')})`,
  ouvertureFeuille.transitions.includes('opacity'),
  true,
);
v('la feuille est bien affichée après ouverture', ouvertureFeuille.affichage !== 'none', true);

/* --- C. La fermeture est plus brève que l'ouverture ---------------------- */
/*
   Exigence explicite de l'A2. On compare les durées que l'élément porte dans
   chacun des deux états : ouvert, il porte celle de l'ouverture ; fermé, celle
   de la fermeture. Un seul chiffre pour les deux signerait l'oubli.
*/

console.log('\n  C — la fermeture est plus brève que l’ouverture');

v(
  `menu de thème : ${fermetureTheme.duree} < ${ouvertureTheme.duree}`,
  secondes(fermetureTheme.duree) < secondes(ouvertureTheme.duree) &&
    secondes(fermetureTheme.duree) > 0,
  true,
);

const feuilleFermee = await observer(t, '#feuille-plus', () =>
  t.keyboard.press('Escape').catch(() => t.click('#ouvrir-plus')),
);
v(
  `feuille « Plus » : ${feuilleFermee.duree} < ${ouvertureFeuille.duree}`,
  secondes(feuilleFermee.duree) < secondes(ouvertureFeuille.duree) &&
    secondes(feuilleFermee.duree) > 0,
  true,
);

/* --- D. Interdit n° 4 : rien qui recalcule la mise en page --------------- */

console.log('\n  D — aucune propriété de mise en page transitionnée');

const fautives = (liste) =>
  String(liste)
    .split(',')
    .map((x) => x.trim())
    .filter((x) => INTERDITES.some((i) => x === i || x.startsWith(`${i}-`)));

v('menu de thème', fautives(ouvertureTheme.proprietes), []);
v('feuille « Plus »', fautives(ouvertureFeuille.proprietes), []);

/* --- E. Mouvement réduit : aucun déplacement ----------------------------- */
/*
   L'interdit n° 3 ne tolère, sous mouvement réduit, qu'un fondu très court ou
   rien. Le socle de la phase 0 ramène toute durée à 0,01 ms ; on vérifie que
   ces nouvelles transitions ne lui échappent pas — une règle portant
   « !important » ou une durée en ligne y échapperait.
*/

console.log('\n  E — sous mouvement réduit, rien ne bouge');

const sobre = await nav.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'reduce',
});
const s = await sobre.newPage();
await ouvrirLaPage(s, '/glossaire/');
await s.click('#bouton-theme');
await s.waitForTimeout(50);
const sousSobre = await s.evaluate(() => {
  const c = getComputedStyle(document.querySelector('#menu-theme'));
  return { duree: c.transitionDuration, opacite: c.opacity };
});
v('la durée est neutralisée', secondes(sousSobre.duree) <= 0.001, true);
v("le menu est à pleine opacité d'emblée", Number(sousSobre.opacite), 1);

/* --- F. Le message de confirmation -------------------------------------- */
/*
   `notifier()` animait déjà, mais avec ses durées écrites en dur (300 ms à
   l'aller comme au retour) hors de l'échelle de la phase 0, et sans la
   dissymétrie que l'A2 demande. La durée vit maintenant dans la feuille de
   style, et le script la relit. On provoque un vrai message — le changement de
   parcours en produit un — plutôt que de fabriquer une bulle qui ressemblerait
   à la vraie.
*/

console.log('\n  F — le message de confirmation');

{
  const options = await p.$$eval('#selecteur-parcours option', (o) => o.map((x) => x.value));
  const courant = await p.$eval('#selecteur-parcours', (e) => e.value);
  const autre = options.find((o) => o && o !== courant);

  if (!autre) {
    v('il existe un second parcours pour provoquer un message', false, true);
  } else {
    await p.selectOption('#selecteur-parcours', autre);
    const bulle = p.locator('.bulle-notification').first();
    const parue = await bulle
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    v('un message paraît', parue, true);

    if (parue) {
      const mesure = await bulle.evaluate((e) => {
        const c = getComputedStyle(e);
        return {
          ouverture: c.transitionDuration,
          proprietes: c.transitionProperty,
          sortante: (() => {
            e.classList.remove('parue');
            e.classList.add('sortante');
            return getComputedStyle(e).transitionDuration;
          })(),
        };
      });
      v(
        `sa sortie est plus brève que son entrée : ${mesure.sortante} < ${mesure.ouverture}`,
        secondes(mesure.sortante) < secondes(mesure.ouverture) && secondes(mesure.sortante) > 0,
        true,
      );
      v('aucune propriété de mise en page', fautives(mesure.proprietes), []);
    }
  }
}

/* --- G. Dépliants et boîtes de dialogue --------------------------------- */
/*
   Le dépliant est la réserve annoncée au plan : sa **hauteur** ne s'anime pas,
   l'interdit n° 4 l'exclut. Seul son contenu paraît en fondu. On vérifie donc
   exactement cela — une animation sur le contenu, et rien sur la hauteur —
   plutôt que de prétendre à un dépliage fluide qu'on n'a pas livré.
*/

console.log('\n  G — dépliants et boîtes de dialogue');

{
  await ouvrirLaPage(p, '/stockage/');
  const deplie = await p.evaluate(() => {
    const d = document.querySelector('details');
    if (!d) return null;
    const contenu = [...d.children].find((e) => e.tagName !== 'SUMMARY');
    if (!contenu) return null;
    d.open = true;
    const c = getComputedStyle(contenu);
    return { nom: c.animationName, duree: c.animationDuration };
  });
  v('un dépliant existe sur cet écran', deplie !== null, true);
  if (deplie) {
    v('son contenu paraît en fondu', deplie.nom, 'paraitre');
    v('et le fondu est court', secondes(deplie.duree) > 0 && secondes(deplie.duree) <= 0.2, true);
  }

  await ouvrirLaPage(p, '/sport/exercices/');
  const boite = await p.evaluate(() => {
    const d = document.querySelector('dialog');
    if (!d) return null;
    const c = getComputedStyle(d);
    return { fermee: c.transitionDuration, proprietes: c.transitionProperty };
  });
  v('une boîte de dialogue existe sur cet écran', boite !== null, true);
  if (boite) {
    v('elle porte une transition', secondes(boite.fermee) > 0, true);
    v('aucune propriété de mise en page', fautives(boite.proprietes), []);
  }
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
