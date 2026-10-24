/**
 * M5 — les barres collantes ne prennent pas plus de 15 % de 360 × 740.
 *
 *   npm run essais:entetes-collants
 *
 * ## Le défaut visé
 *
 * Relevé le 18 octobre, avant correction, sur un écran de 360 × 740 :
 *
 *     écran            collant en haut   avec le coffre ouvert
 *     /odyssee/            138 px            243 px  (32,8 %)
 *     /revisions/          159 px            264 px  (35,7 %)
 *
 * Un tiers de l'écran perdu en permanence, pour une rangée de navigation
 * qui passait à la ligne trois fois et un bandeau de coffre qui en prenait
 * 105 à lui seul. Le plafond de M5 est d'environ 15 %, soit 111 px.
 *
 * ## Ce que l'essai mesure, et pourquoi au navigateur
 *
 * Il ne lit pas les classes : il ouvre chaque écran et relève **tout**
 * élément dont la position calculée vaut `fixed` ou `sticky`, qui est
 * visible, et qui touche le haut ou le bas de la fenêtre. C'est la seule
 * définition qui compte — ce qui vole de la place au contenu, quel que soit
 * le composant qui l'a posé. Une sonde textuelle dirait qu'un garde-fou est
 * cité ; elle ne dirait pas qu'il agit.
 *
 * Il prend l'**enveloppe** et non la somme : deux barres emboîtées ne volent
 * pas la place deux fois. Et il écarte ce qui couvre plus de 80 % de la
 * hauteur, parce qu'un calque n'est pas une barre.
 *
 * ## Les deux états du coffre
 *
 * Fermé **et** ouvert. C'est ouvert que le défaut était le pire, et c'est
 * l'état dans lequel on passe toutes ses soirées sur Odyssée. Un essai qui
 * ne mesure que le coffre fermé laisse passer les 105 px du bandeau — et
 * c'est exactement l'angle mort de l'audit du 17 octobre.
 *
 * ## La barre du bas n'est pas jugée
 *
 * Elle est relevée et affichée, parce qu'elle compte dans ce qui reste au
 * doigt, mais l'interdit 3 du prompt 43 défend d'en changer le contenu et
 * M5 ne parle que des en-têtes. On la mesure pour savoir, pas pour juger.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const LARGEUR = 360;
const HAUTEUR = 740;
/** « Environ 15 % » : 111 px sur 740. */
const PLAFOND = Math.round(HAUTEUR * 0.15);

/** Les écrans quotidiens, ceux de la carte des écrans, plus la progression. */
const ECRANS = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/taches/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/flashcards/',
  '/revisions/',
  '/sport/',
  '/sport/seance/',
  '/progression/',
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

/**
 * Relève l'enveloppe collante, en haut et en bas, de la page affichée.
 *
 * **Après défilement, et c'est capital.** Une première version mesurait à
 * `scrollY = 0`. Depuis que le bandeau du coffre est au-dessus de l'en-tête,
 * l'en-tête n'y touche pas encore le haut de la fenêtre : la sonde ne voyait
 * plus rien et annonçait « 0 px » sur les dix écrans, coffre ouvert. Elle
 * passait au vert en ne mesurant rien, ce qui est pire que de rouge.
 *
 * Ce qu'une barre collante coûte, c'est ce qu'elle coûte **pendant qu'on
 * lit**, donc après avoir défilé. D'où le `scrollTo` de l'appelant, et le
 * relevé de ce qui est effectivement venu se coller en haut.
 */
function releverLesBarres() {
  const H = window.innerHeight;
  const hauts = [];
  const bas = [];
  for (const e of document.querySelectorAll('body *')) {
    const s = getComputedStyle(e);
    if (s.position !== 'fixed' && s.position !== 'sticky') continue;
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') continue;
    const r = e.getBoundingClientRect();
    if (r.height < 1 || r.width < 1) continue;
    if (r.height > H * 0.8) continue;
    const quoi = `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}`;
    if (r.top <= 2) hauts.push({ quoi, bas: Math.round(r.bottom) });
    else if (r.bottom >= H - 2) bas.push({ quoi, haut: Math.round(r.top) });
  }
  return {
    haut: hauts.length ? Math.max(...hauts.map((x) => x.bas)) : 0,
    basse: bas.length ? H - Math.min(...bas.map((x) => x.haut)) : 0,
    qui: hauts.map((x) => x.quoi),
  };
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: LARGEUR, height: HAUTEUR },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

/** Relève les dix écrans et rend la liste de ceux qui dépassent. */
async function tournee() {
  const releve = [];
  for (const route of ECRANS) {
    await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(500);
    /* On descend : c'est collé en haut que l'en-tête coûte sa hauteur. */
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(250);
    const m = await page.evaluate(releverLesBarres);
    releve.push({ route, defile: await page.evaluate(() => Math.round(window.scrollY)), ...m });
  }
  return releve;
}

const montrer = (titre, releve) => {
  console.log(`\n  ${titre}`);
  for (const r of releve) {
    const pc = ((r.haut / HAUTEUR) * 100).toFixed(1);
    const marque = r.haut > PLAFOND ? '\x1b[31m!\x1b[0m' : ' ';
    console.log(
      `  ${marque} ${r.route.padEnd(22)} haut ${String(r.haut).padStart(4)} px (${pc.padStart(5)} %)` +
        `   bas ${String(r.basse).padStart(3)} px   défilé ${String(r.defile).padStart(4)} px`,
    );
  }
};

/**
 * Les écrans où la sonde n'a vu aucun en-tête collant.
 *
 * Un essai qui parcourt zéro élément ne prouve rien : si l'en-tête n'est pas
 * venu se coller — page trop courte, ou sonde en panne — il faut le dire,
 * et non compter 0 px comme une réussite.
 */
const nonMesures = (releve) =>
  releve.filter((r) => !r.qui.includes('header#entete-principal')).map((r) => `${r.route} (défilé ${r.defile} px)`);

/* ---- 1. Le coffre fermé ------------------------------------------------ */

console.log('\nLES BARRES COLLANTES À 360 × 740 — COFFRE FERMÉ');
const ferme = await tournee();
montrer(`plafond ${PLAFOND} px (15 % de ${HAUTEUR})`, ferme);
verifier('les dix écrans ont bien montré leur en-tête collé en haut', nonMesures(ferme), []);
verifier(
  `M5a — aucun en-tête collant au-dessus de ${PLAFOND} px, coffre fermé`,
  ferme.filter((r) => r.haut > PLAFOND).map((r) => `${r.route} ${r.haut} px`),
  [],
);

/* ---- 2. Le coffre ouvert — l'état où le défaut était le pire ----------- */

await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
}
await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
// La prémisse se lit, elle ne se devine pas : sans bandeau visible, la
// seconde moitié de l'essai mesurerait deux fois le coffre fermé.
verifier(
  'la prémisse — le bandeau du coffre est bien affiché avant de remesurer',
  await page.evaluate(() => {
    const t = document.getElementById('temoin-coffre');
    return !!t && !t.classList.contains('hidden') && t.getBoundingClientRect().height > 1;
  }),
  true,
);

console.log('\nLES MÊMES, COFFRE OUVERT ET BANDEAU AFFICHÉ');
const ouvert = await tournee();
montrer(`plafond ${PLAFOND} px`, ouvert);
verifier('les dix écrans l’ont montré aussi, coffre ouvert', nonMesures(ouvert), []);
verifier(
  `M5b — aucun en-tête collant au-dessus de ${PLAFOND} px, coffre ouvert`,
  ouvert.filter((r) => r.haut > PLAFOND).map((r) => `${r.route} ${r.haut} px`),
  [],
);

/* ---- 3. Ce que l'on ne veut pas perdre en gagnant de la hauteur -------- */

console.log('\nCE QUI NE DOIT PAS AVOIR ÉTÉ SACRIFIÉ');
await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const garde = await page.evaluate(() => {
  const vu = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.height > 0 && r.width > 0 && getComputedStyle(e).visibility !== 'hidden';
  };
  const dansLeCollant = (e) => {
    for (let n = e; n; n = n.parentElement) {
      if (getComputedStyle(n).position === 'sticky' || getComputedStyle(n).position === 'fixed') return true;
    }
    return false;
  };
  const cadenas = document.getElementById('cadenas-coffre');
  /*
     Les deux dimensions, et non la seule hauteur.

     La hauteur ne peut pas tomber : `global.css` pose déjà
     `button { min-height: 2.75rem }` sous pointeur grossier, et un contrôle
     saboté à `h-7` ressortait à 44 px — l'essai passait au vert sur un
     défaut réel. C'est la LARGEUR qui cède, et c'est ce que dit déjà le
     commentaire de `.cible-tactile-pleine` : une icône fait trente pixels
     de large, et aucune hauteur ne rattrape une largeur de trente.
  */
  const petites = [...document.querySelectorAll('#entete-principal a, #entete-principal button')]
    .filter((e) => vu(e) && e.id !== 'nom-de-la-page')
    .map((e) => {
      const r = e.getBoundingClientRect();
      return {
        q: e.id || (e.textContent || '').trim().slice(0, 20),
        h: Math.round(r.height),
        l: Math.round(r.width),
      };
    })
    .filter((x) => x.h < 44 || x.l < 44);
  return {
    cadenasVisible: vu(cadenas),
    cadenasCollant: cadenas ? dansLeCollant(cadenas) : false,
    fermerAuMenu: !!document.getElementById('cadenas-fermer'),
    souscibles: petites,
    debordement: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
verifier('le cadenas du coffre est visible quand le coffre est ouvert', garde.cadenasVisible, true);
verifier('et il est DANS la zone collante — c’est lui qui tient l’interdit 4', garde.cadenasCollant, true);
verifier('son menu porte toujours « Fermer le coffre »', garde.fermerAuMenu, true);
verifier('aucune cible de l’en-tête n’est passée sous 44 px, en hauteur ni en largeur', garde.souscibles, []);
verifier('et la page ne déborde pas horizontalement', garde.debordement, false);

await contexte.close();
await nav.close();
process.exit(rouges === 0 ? 0 : 1);
