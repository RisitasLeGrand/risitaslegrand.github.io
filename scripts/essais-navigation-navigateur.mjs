/**
 * La navigation : atteindre un écran, et savoir où l'on est.
 *
 * ## Ce que mesurait la critique
 *
 * À 1280 px, la barre de Révisions disposait de **517 px pour 1 261 px** de
 * contenu : sept écrans sur douze invisibles, sans flèche ni barre de
 * défilement pour l'indiquer. À 390 px, **8 px pour 550 px** : rien du tout,
 * et le seul chemin vers un autre écran passait par le pied de page, deux à
 * cinq mille pixels plus bas, parmi trente-huit liens.
 *
 * Une fonction qu'on ne voit pas n'existe pas. Ce contrôle vérifie donc une
 * chose simple et dure : **chaque onglet d'une branche est atteignable**, à
 * 1280 comme à 390 px — soit directement, soit en ouvrant un groupe ou la
 * feuille « Plus ».
 *
 * ## Deux surfaces, et non une
 *
 * Depuis M15 (17 octobre), au-dessus de 1024 px et avec un pointeur fin, le
 * ruban horizontal cède la place à une **barre latérale** : `global.css`
 * cache l'un (`.sans-laterale`) et montre l'autre. Le contrôle ne regardait
 * que le ruban, et déclarait donc les vingt-neuf onglets des trois branches
 * inatteignables à 1280 px — alors qu'ils sont tous là, à gauche. Un contrôle
 * qui accuse à tort se fait désactiver.
 *
 * Il relève maintenant les deux surfaces, et vérifie en plus ce que M15
 * promet dans son propre commentaire : « le même registre que le ruban
 * horizontal, dans le même ordre ». Deux navigations qui diffèrent d'un écran
 * à l'autre font deux applications.
 *
 * ## Et l'ordre des branches
 *
 * Il changeait d'une page à l'autre, la courante passant en tête. Le contrôle
 * compare les trois branches : la suite doit être identique partout, et la
 * courante marquée plutôt que déplacée.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { BRANCHES } from '../src/lib/branches.ts';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const v = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `  \x1b[31m✗\x1b[0m ${quoi}\n      attendu ${JSON.stringify(attendu)}\n      obtenu  ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

async function ouvrir(taille, tactile) {
  const contexte = await nav.newContext({
    viewport: taille,
    hasTouch: tactile,
    isMobile: tactile,
  });
  const page = await contexte.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  return { contexte, page };
}

async function deverrouiller(page, chemin) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(700);
  }
}

/** branche → ce que rendent les deux surfaces, à 1280 px et pointeur fin. */
const surfaceFine = new Map();

console.log('\n\x1b[1mN2 — À 1280 PX, TOUS LES ONGLETS SONT ATTEIGNABLES\x1b[0m\n');
{
  const { contexte, page } = await ouvrir({ width: 1280, height: 900 }, false);
  for (const b of BRANCHES) {
    await deverrouiller(page, b.racine);
    /* On déplie tous les groupes : c'est ce que fait quelqu'un qui cherche. */
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('nav#navigation-principale details')) d.open = true;
    });
    await page.waitForTimeout(200);
    const releve = await page.evaluate(() => {
      const lire = (sel) =>
        [...document.querySelectorAll(`${sel} a`)]
          .filter((a) => a.getClientRects().length > 0)
          .map((a) => new URL(a.href).pathname.replace(/\/$/, '') || '/');
      return { ruban: lire('nav#navigation-principale'), laterale: lire('nav#barre-laterale') };
    });
    const atteignables = [...releve.ruban, ...releve.laterale];
    // Un essai qui parcourt zéro élément ne prouve rien : il faut qu'au moins
    // l'une des deux surfaces ait répondu.
    v(`${b.libelle} : une navigation de branche est rendue`, atteignables.length > 0, true);
    const manquants = b.onglets
      .map((o) => o.chemin.replace(/\/$/, '') || '/')
      .filter((c) => !atteignables.includes(c));
    v(`${b.libelle} : ses ${b.onglets.length} onglets sont atteignables`, manquants, []);
    surfaceFine.set(b.id, releve);
  }

  /* Et la barre elle-même ne déborde plus de son conteneur. */
  await deverrouiller(page, '/revisions/');
  const debord = await page.evaluate(() => {
    const n = document.getElementById('navigation-principale');
    return n ? n.scrollWidth - n.clientWidth : -1;
  });
  v(`la barre ne déborde pas (débordement ${debord} px)`, debord <= 0, true);
  await contexte.close();
}

console.log('\n\x1b[1mN2 bis — LES DEUX SURFACES DISENT LA MÊME CHOSE\x1b[0m\n');
{
  /*
     La promesse écrite de M15 : « le même registre que le ruban horizontal,
     dans le même ordre ». Elle ne pouvait pas se vérifier dans un seul
     contexte, puisque `global.css` n'en montre jamais qu'une à la fois — le
     ruban sous pointeur grossier, la barre latérale sous pointeur fin. On
     ouvre donc la MÊME largeur deux fois, et on compare.
  */
  const { contexte, page } = await ouvrir({ width: 1280, height: 900 }, true);
  for (const b of BRANCHES) {
    await deverrouiller(page, b.racine);
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('nav#navigation-principale details')) d.open = true;
    });
    await page.waitForTimeout(200);
    const ruban = await page.evaluate(() =>
      [...document.querySelectorAll('nav#navigation-principale a')]
        .filter((a) => a.getClientRects().length > 0)
        .map((a) => new URL(a.href).pathname.replace(/\/$/, '') || '/'),
    );
    const laterale = surfaceFine.get(b.id)?.laterale ?? [];
    const sien = (c) => b.onglets.some((o) => (o.chemin.replace(/\/$/, '') || '/') === c);
    v(`${b.libelle} : la barre latérale a répondu`, laterale.length > 0, true);
    v(`${b.libelle} : le ruban a répondu`, ruban.length > 0, true);
    v(
      `${b.libelle} : les deux portent ses onglets dans le même ordre`,
      laterale.filter(sien),
      ruban.filter(sien),
    );
  }
  await contexte.close();
}

console.log('\n\x1b[1mN3 — L’ORDRE DES BRANCHES NE BOUGE PAS\x1b[0m\n');
{
  const { contexte, page } = await ouvrir({ width: 1280, height: 900 }, false);
  const ordres = [];
  for (const b of BRANCHES) {
    await deverrouiller(page, b.racine);
    ordres.push(
      await page.evaluate(() =>
        [...document.querySelectorAll('header a[data-branche]')].map((a) => a.dataset.branche),
      ),
    );
    const marquee = await page.evaluate(
      () => document.querySelector('header a[data-branche][aria-current]')?.dataset.branche,
    );
    v(`${b.libelle} se marque elle-même`, marquee, b.id);
  }
  v('le même ordre sur les trois branches', new Set(ordres.map((o) => o.join('|'))).size, 1);
  await contexte.close();
}

console.log('\n\x1b[1mN1 — SUR TÉLÉPHONE, LA BARRE DU BAS\x1b[0m\n');
{
  const { contexte, page } = await ouvrir({ width: 390, height: 844 }, true);
  await deverrouiller(page, '/revisions/');

  const cibles = await page.evaluate(() =>
    [...document.querySelectorAll('#barre-du-bas > a, #barre-du-bas > button')].map((e) => ({
      texte: e.textContent.trim(),
      hauteur: Math.round(e.getBoundingClientRect().height),
    })),
  );
  v('cinq destinations, dont « Plus »', cibles.length, 5);
  v(
    'toutes au moins 44 px de haut',
    cibles.filter((c) => c.hauteur < 44),
    [],
  );
  v('la barre est visible', await page.locator('#barre-du-bas').isVisible(), true);

  await page.click('#ouvrir-plus');
  await page.waitForTimeout(300);
  v('« Plus » ouvre la feuille', await page.locator('#feuille-plus').isVisible(), true);
  const dansLaFeuille = await page.evaluate(() =>
    [...document.querySelectorAll('#feuille-plus a')].map(
      (a) => new URL(a.href).pathname.replace(/\/$/, '') || '/',
    ),
  );
  const revisions = BRANCHES.find((b) => b.id === 'revisions');
  v(
    'elle liste les douze onglets de la branche',
    revisions.onglets
      .map((o) => o.chemin.replace(/\/$/, '') || '/')
      .filter((c) => !dansLaFeuille.includes(c)),
    [],
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  v('la touche d’échappement la referme', await page.locator('#feuille-plus').isVisible(), false);
  await contexte.close();
}

console.log('\n\x1b[1mN5 — UN NOM PAR ÉCRAN, LE MÊME PARTOUT\x1b[0m\n');
{
  const { contexte, page } = await ouvrir({ width: 1280, height: 900 }, false);
  const ecarts = [];
  for (const b of BRANCHES) {
    for (const o of b.onglets) {
      await deverrouiller(page, o.chemin);
      const titre = await page.title();
      if (!titre.startsWith(o.nom)) ecarts.push(`${o.chemin} : « ${titre} » ne commence pas par « ${o.nom} »`);
    }
  }
  v('le titre de chaque écran commence par son nom', ecarts, []);
  await contexte.close();
}

await nav.close();

if (rouges > 0) {
  console.log(`\n\x1b[31m${rouges} constat(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mTous les essais passent.\x1b[0m');
