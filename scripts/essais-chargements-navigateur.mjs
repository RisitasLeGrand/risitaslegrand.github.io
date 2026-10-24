/**
 * Chargements — ce qui arrive après l'attente, et comment il arrive.
 *
 *   npm run essais:chargements
 *
 * **Relevé du 14 octobre 2026, avant correctif.** Deux choses, dont une bonne.
 *
 * *La bonne, et je la dis plutôt que de me l'attribuer* : l'exigence « aucun
 * indicateur qui tourne indéfiniment sans texte » était **déjà tenue**. Il n'y
 * a pas d'indicateur tournant du tout — zéro occurrence de `animate-spin` —
 * et toutes les attentes sont annoncées par du texte : « Déchiffrement du
 * glossaire… », « Chargement de l'exercice… ».
 *
 * *Ce qui manquait* : l'arrivée. La convention du site est régulière —
 * `id="chargement"` sur 24 pages, puis `chargement` caché et `vue` montrée,
 * 30 et 20 occurrences — et le contenu **saute** à l'écran au terme du
 * déchiffrement. C'est précisément le saut que l'A5 veut remplacer par un
 * fondu.
 *
 * **Pourquoi une animation et non une transition.** Au contraire des menus de
 * la phase 2, qui vont et viennent, le contenu n'arrive qu'une fois. Un
 * élément qui passe de `display: none` à visible **relance ses animations** :
 * pas besoin ici de `@starting-style` ni de `allow-discrete`, qui servaient à
 * faire *disparaître* en douceur. La règle est posée sur les identifiants de
 * la convention, qui sont uniques par page, donc une règle couvre tout le site
 * sans toucher aux 24 fichiers — et sans dépendre de la mémoire de celui qui
 * écrira la vingt-cinquième page.
 *
 * **Ce qui n'est pas fait, et pourquoi.** L'A5 propose « un squelette OU un
 * fondu d'arrivée ». Un squelette demande, par écran, un gabarit qui imite la
 * forme du contenu à venir : du balisage sur 46 pages, à tenir à jour quand
 * chaque écran change. Le fondu couvre le même besoin — ne pas sauter — pour
 * un coût sans commune mesure. Le squelette reste possible plus tard, là où
 * une attente est longue au point de le mériter.
 *
 * **Et la couverture est partielle, ce que le contrôle affiche lui-même.** Des
 * 46 pages qui annoncent une attente, **22 seulement** révèlent ensuite un
 * conteneur `vue` ; les 24 autres rendent dans un conteneur déjà présent — le
 * glossaire en est le cas type — et n'offrent aucun instant unique où
 * accrocher une arrivée sans toucher à chacune. Sur celles-là, seule la
 * **disparition** du texte d'attente est adoucie. C'est moins que « tous les
 * chargements paraissent en fondu », et je préfère l'écrire que de le laisser
 * croire.
 */
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const PLAFOND_MS = 300;

const secondes = (brut) => Number.parseFloat(String(brut)) || 0;

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

console.log('\nCHARGEMENTS');

/* --- A. Aucun indicateur qui tourne sans texte --------------------------- */
/*
   Déjà vrai avant ce lot. On le fige : la règle est facile à enfreindre d'une
   classe Tailwind, et l'enfreindre ne casserait rien de visible.
*/

console.log('\n  A — aucun indicateur tournant');

{
  const fichiers = [];
  const parcourir = (d) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourir(c);
      else if (/\.(astro|svelte|ts)$/.test(e)) fichiers.push(c);
    }
  };
  parcourir('src');
  const tournants = fichiers.filter((f) => readFileSync(f, 'utf8').includes('animate-spin'));
  v(`aucun « animate-spin » dans les ${fichiers.length} fichiers de src/`, tournants, []);
}

/* --- B. Le contenu paraît au lieu de sauter ------------------------------ */
/*
   On observe le moment exact où l'application révèle la vue, par un
   observateur posé avant tout script de la page. Attendre et regarder après
   coup ne dirait rien : l'animation serait déjà finie.
*/

console.log('\n  B — à l’arrivée, le contenu paraît');

/* La couverture, établie depuis la source et affichée : un contrôle qui ne
   dirait que « ça marche sur la page que j'ai choisie » cacherait l'essentiel. */
{
  const pages = [];
  const parcourirPages = (d) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourirPages(c);
      else if (e.endsWith('.astro')) pages.push(c);
    }
  };
  parcourirPages('src/pages');
  const attente = pages.filter((f) => readFileSync(f, 'utf8').includes('id="chargement'));
  const avecVue = attente.filter((f) => readFileSync(f, 'utf8').includes('id="vue"'));
  console.log(
    `     ${attente.length} pages annoncent une attente ; ${avecVue.length} révèlent un conteneur « vue »`,
  );
  v('au moins une page révèle un conteneur « vue »', avecVue.length > 0, true);
}

const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  window.__arrivee = null;
  window.__depart = null;
  const guetter = () => {
    const vue = document.getElementById('vue');
    const attente = document.getElementById('chargement');
    if (!vue && !attente) return false;
    if (vue) {
      new MutationObserver(() => {
        if (vue.classList.contains('hidden') || window.__arrivee) return;
        const c = getComputedStyle(vue);
        window.__arrivee = { nom: c.animationName, duree: c.animationDuration };
      }).observe(vue, { attributes: true, attributeFilter: ['class'] });
    }
    if (attente) {
      new MutationObserver(() => {
        if (!attente.classList.contains('hidden') || window.__depart) return;
        const c = getComputedStyle(attente);
        window.__depart = { duree: c.transitionDuration, props: c.transitionProperty };
      }).observe(attente, { attributes: true, attributeFilter: ['class'] });
    }
    return true;
  };
  if (!guetter()) document.addEventListener('DOMContentLoaded', guetter);
});

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

const ouvrir = async (route, attendu) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  const verrou = page.locator('#champ-mdp');
  if (await verrou.isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.locator(attendu).waitFor({ state: 'visible', timeout: 25000 });
};

await ouvrir('/sport/', '#vue');
const arrivee = await page.evaluate(() => window.__arrivee);

v('la révélation de la vue a été observée', arrivee !== null, true);
if (arrivee) {
  v(`elle porte une animation (${arrivee.nom})`, arrivee.nom !== 'none', true);
  v(
    `brève (${arrivee.duree} ≤ ${PLAFOND_MS} ms)`,
    secondes(arrivee.duree) * 1000 <= PLAFOND_MS && secondes(arrivee.duree) > 0,
    true,
  );
}

/* --- B bis. Et le texte d'attente s'efface, partout --------------------- */
/*
   Celui-là vaut sur les 46 pages, « vue » ou non : c'est le seul élément que
   toutes partagent. On le mesure sur le glossaire, précisément parce que
   c'est une page SANS conteneur « vue » — mesurer sur une page qui en a un ne
   prouverait rien pour les 24 autres.
*/

console.log('\n  B bis — le texte d’attente s’efface, même sans conteneur « vue »');

await ouvrir('/glossaire/', '#glossaire');
const depart = await page.evaluate(() => window.__depart);
v('la disparition du texte d’attente a été observée', depart !== null, true);
if (depart) {
  /*
     CE CONTRÔLE A CHANGÉ D'INVARIANT, ET C'EST UNE DÉCISION, PAS UN
     RELÂCHEMENT.

     Il exigeait que la disparition soit EN FONDU : durée strictement
     supérieure à zéro. L'A1 du prompt 37 a retiré ce fondu, parce qu'il
     reposait sur « allow-discrete » et gardait le texte dans le flux pendant
     120 ms, décalant tout ce qui le suivait — 0,119 à 0,614 de CLS mesurés
     selon la page. Entre une petite douceur et un décalage de 0,6, le choix
     n'était pas douteux.

     Exiger encore le fondu reviendrait à exiger le défaut. Ce qui survit et
     se vérifie ici : le texte d'attente DISPARAÎT bien (c'est la ligne
     au-dessus), et sa disparition ne dépasse pas le plafond — zéro compris.
     Que la page ne décale plus est mesuré ailleurs, par « essais:decalage »,
     qui est l'essai écrit pour cela.
  */
  v(
    `sa disparition tient dans le plafond, zéro compris (${depart.duree} ≤ ${PLAFOND_MS} ms)`,
    Math.max(...String(depart.duree).split(',').map(secondes)) * 1000 <= PLAFOND_MS,
    true,
  );
}

/* --- C. Et ce que l'animation touche ------------------------------------- */
/*
   L'interdit n° 4 : rien qui recalcule la mise en page. On lit les étapes de
   l'animation nommée, plutôt que de faire confiance à son nom.
*/

console.log('\n  C — l’animation ne touche que l’opacité et la transformation');

if (arrivee?.nom && arrivee.nom !== 'none') {
  const proprietes = await page.evaluate((nom) => {
    const vues = new Set();
    for (const feuille of document.styleSheets) {
      let regles;
      try {
        regles = [...feuille.cssRules];
      } catch {
        continue;
      }
      for (const r of regles) {
        if (r.type !== CSSRule.KEYFRAMES_RULE || r.name !== nom) continue;
        for (const etape of r.cssRules) {
          for (const p of etape.style) vues.add(p);
        }
      }
    }
    return [...vues].sort();
  }, arrivee.nom);
  v(`les propriétés animées (${proprietes.join(', ')})`, proprietes, ['opacity']);
}

/* --- D. Sous mouvement réduit ------------------------------------------- */

console.log('\n  D — sous mouvement réduit, aucune apparition progressive');

{
  const sobre = await nav.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const s = await sobre.newPage();
  // Une page qui révèle bien un conteneur « vue » : le glossaire n'en a pas,
  // et l'y chercher mesurerait une absence.
  await s.goto(`${RACINE}/sport/`, { waitUntil: 'networkidle' });
  const vs = s.locator('#champ-mdp');
  if (await vs.isVisible().catch(() => false)) {
    await s.fill('#champ-mdp', MDP);
    await s.click('#bouton-verrou');
  }
  await s.locator('#vue').waitFor({ state: 'visible', timeout: 25000 });
  const lu = await s.evaluate(() => {
    const c = getComputedStyle(document.getElementById('vue'));
    return { duree: c.animationDuration, opacite: c.opacity };
  });
  v('la durée est neutralisée', secondes(lu.duree) <= 0.001, true);
  v('et la vue est à pleine opacité', Number(lu.opacite), 1);
  await sobre.close();
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
