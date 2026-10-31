/**
 * LA BARRE LATÉRALE SE REPLIE EN RAIL, ET N'Y PERD AUCUN NOM (M15 bis).
 *
 *   SITE_PASSWORD=… npm run essais:laterale:navigateur
 *
 * ## Le défaut que le rail aurait créé si personne ne mesurait
 *
 * Le nom accessible des douze entrées venait du TEXTE de leur `<span>`. Le
 * rail masque ce texte — c'est tout le rail. Masqué, le nom disparaissait
 * avec lui, et la barre repliée devenait douze icônes anonymes : pire que pas
 * de repli du tout. D'où l'`aria-label` porté en permanence, et d'où cet
 * essai, qui compare les noms dans les DEUX états au lieu de les lire dans un
 * seul.
 *
 * ## Ce qu'il mesure
 *
 * 1. **La prémisse** : la barre paraît. Elle ne vit que sous
 *    `(min-width: 1024px) and (pointer: fine)`, et un contexte Playwright avec
 *    `hasTouch` rendrait la médiarequête fausse — on mesurerait alors une
 *    barre absente et on appellerait cela un succès. C'est la leçon du lot
 *    E8, où tous les planchers de cible vivaient sous `pointer: coarse`.
 * 2. **Les noms survivent au repli**, un par un, et les deux groupes gardent
 *    leur nom bien que l'intitulé soit masqué — `aria-labelledby` vers un
 *    élément en `display: none` est censé fournir son texte, et c'est ici
 *    vérifié plutôt que supposé.
 * 3. **`aria-expanded` bascule**, et le libellé du bouton suit : un bouton
 *    nommé « Replier » qui déplie mentirait.
 * 4. **L'état est retenu** après rechargement, par appareil.
 * 5. **La barre est OUVERTE si le stockage lève** — le bon défaut : une
 *    navigation qu'on ne voit pas est une navigation qu'on ne cherche pas.
 * 6. **Aucun saut de mise en page** : l'état est posé avant le premier rendu,
 *    donc le décalage du contenu est le même au DOMContentLoaded et après le
 *    chargement complet. Posé après l'hydratation, il déplacerait la page de
 *    douze rem sous les yeux, à chaque navigation.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
/* Une page longue, et qui porte la barre complète : l'en-tête « leger » de
   l'accueil n'en a pas, et une page courte ne dirait rien d'un saut. */
const PAGE = '/planification/';

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
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}` +
      `\n      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`,
  );
}
const vrai = (quoi, condition) => verifier(quoi, condition, true);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Ouvre une page, coffre franchi, et rend de quoi l'interroger. */
async function ouvrir({ sabotageStockage = false, rail = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  /* Quatre fois plus lent, comme `essais:cls` : sur une machine rapide, un
     saut de douze rem se résorbe avant d'être enregistré. */
  const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(
    ([casse, enRail]) => {
      if (enRail) {
        try {
          localStorage.setItem('revinsp.laterale', 'rail');
        } catch {}
      }
      if (casse) {
        /* On casse `localStorage` POUR DE VRAI, et pas seulement la lecture :
           c'est ce que fait un navigateur en mode privé restreint. */
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() {
            throw new Error('stockage refusé');
          },
        });
      }
      /*
         LE SAUT SE MESURE PAR L'API D'INSTABILITÉ, et non par une comparaison
         tôt/tard — un sabotage me l'a appris. Je relevais le décalage au
         `DOMContentLoaded` : or les scripts de module s'exécutent AVANT cet
         événement, donc déplacer l'état du script d'avant-rendu vers le script
         client ne changeait rien à ce que je lisais. L'essai restait vert sur
         un saut réel.

         `layout-shift` avec `buffered: true` rend les décalages SURVENUS AVANT
         l'installation de l'observateur : c'est le seul instrument qui voie un
         saut au premier rendu. Le dépôt s'en sert déjà dans `essais:cls`.
      */
      window.__saut = 0;
      new PerformanceObserver((liste) => {
        for (const e of liste.getEntries()) if (!e.hadRecentInput) window.__saut += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    },
    [sabotageStockage, rail],
  );
  await franchirInitialisation(page, RACINE, MDP);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`${RACINE}${PAGE}`, { waitUntil: 'load' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#barre-laterale', { state: 'attached', timeout: 40000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

/** Les noms accessibles des entrées, et ceux des deux groupes. */
const releve = (page) =>
  page.evaluate(() => {
    const barre = document.getElementById('barre-laterale');
    /*
       `innerText` ET NON `textContent`, et c'est un sabotage qui l'a appris :
       `textContent` rend le texte du DOM, qu'il soit affiché ou non. L'essai
       calculait donc un nom là où le navigateur n'en voit plus, et retirer
       l'`aria-label` des douze onglets le laissait VERT — un faux vert sur la
       garantie même qui justifie ce lot. `innerText` ne rend que le texte
       RENDU : masqué, il est vide, et le nom manquant se voit.
    */
    const nomDe = (e) => (e.getAttribute('aria-label') || e.innerText || '').trim();
    /*
       Pour un GROUPE, au contraire, `textContent` est juste : le nom vient de
       `aria-labelledby`, et la spécification veut qu'un élément référencé
       fournisse son texte même masqué. C'est précisément ce qu'on vérifie —
       que le nom survive au `display: none` de l'intitulé.
    */
    const nomDuGroupe = (g) => {
      const id = g.getAttribute('aria-labelledby');
      const e = id ? document.getElementById(id) : null;
      return (e?.textContent ?? g.getAttribute('aria-label') ?? '').trim();
    };
    return {
      visible: barre ? getComputedStyle(barre).display !== 'none' : false,
      largeur: barre ? Math.round(barre.getBoundingClientRect().width) : 0,
      entrees: [...barre.querySelectorAll('a')].map(nomDe),
      groupes: [...barre.querySelectorAll('[role="group"]')].map(nomDuGroupe),
      separateurVisible: (() => {
        const h = barre.querySelector('.separateur-laterale');
        return h ? getComputedStyle(h).display !== 'none' : false;
      })(),
      bouton: (() => {
        const b = document.getElementById('replier-laterale');
        return b
          ? {
              deplie: b.getAttribute('aria-expanded'),
              controle: b.getAttribute('aria-controls'),
              nom: b.getAttribute('aria-label'),
              infobulle: b.getAttribute('title'),
            }
          : null;
      })(),
      decalage: (() => {
        const a = document.getElementById('application');
        return a ? getComputedStyle(a).paddingLeft : null;
      })(),
      saut: window.__saut ?? null,
    };
  });

console.log('\nLA BARRE LATÉRALE, ET SON RAIL\n');

/* ── 1. Dépliée : la prémisse, puis les noms ───────────────────────────── */

console.log('1. DÉPLIÉE');
const { ctx: c1, page: p1 } = await ouvrir();
const deplie = await releve(p1);

vrai('prémisse : la barre paraît (largeur ≥ 1024 px, pointeur fin)', deplie.visible);
if (!deplie.visible) {
  console.log('      (rien de ce qui suit ne se mesure : on lirait une barre absente)');
}
vrai(`prémisse : elle est large (${deplie.largeur} px)`, deplie.largeur >= 200);
vrai(`prémisse : ${deplie.entrees.length} entrées`, deplie.entrees.length >= 10);
verifier('toutes les entrées sont nommées', deplie.entrees.filter((n) => !n), []);
verifier('les deux groupes sont nommés', deplie.groupes.filter((n) => !n), []);
verifier('deux groupes, et deux seulement', deplie.groupes.length, 2);
vrai('dépliée, le filet décoratif ne paraît pas', !deplie.separateurVisible);
verifier('le bouton se dit déplié', deplie.bouton?.deplie, 'true');
verifier('et il dit ce qu’il contrôle', deplie.bouton?.controle, 'barre-laterale');
vrai(
  `son nom parle de replier (« ${deplie.bouton?.nom} »)`,
  /replier/i.test(deplie.bouton?.nom ?? ''),
);
verifier('et l’infobulle dit la même chose que le nom', deplie.bouton?.infobulle, deplie.bouton?.nom);

/* ── 2. Le repli : les noms survivent ─────────────────────────────────── */

console.log('\n2. REPLIÉE EN RAIL — LES NOMS SURVIVENT');
await p1.click('#replier-laterale');
await p1.waitForTimeout(400);
const rail = await releve(p1);

vrai(`le rail est étroit (${rail.largeur} px, contre ${deplie.largeur})`, rail.largeur <= 60);
vrai('la barre reste visible', rail.visible);
verifier(
  'LES MÊMES NOMS, un par un, texte masqué ou non',
  rail.entrees,
  deplie.entrees,
);
verifier('et les deux groupes gardent les leurs', rail.groupes, deplie.groupes);
vrai('le filet décoratif prend le relais à l’œil', rail.separateurVisible);
verifier('le bouton se dit replié', rail.bouton?.deplie, 'false');
vrai(
  `et son nom parle de déplier (« ${rail.bouton?.nom} »)`,
  /déplier/i.test(rail.bouton?.nom ?? ''),
);
verifier('l’infobulle suit le nom', rail.bouton?.infobulle, rail.bouton?.nom);
vrai(
  `le contenu se rapproche du bord (${rail.decalage} contre ${deplie.decalage})`,
  parseFloat(rail.decalage) < parseFloat(deplie.decalage),
);

/* ── 3. L'état est retenu ─────────────────────────────────────────────── */

console.log('\n3. L’ÉTAT EST RETENU, ET SANS SAUT DE MISE EN PAGE');
await p1.reload({ waitUntil: 'load' });
if (await p1.locator('#champ-mdp').isVisible().catch(() => false)) {
  await p1.fill('#champ-mdp', MDP);
  await p1.click('#bouton-verrou');
}
await p1.waitForTimeout(600);
const apresRechargement = await releve(p1);
vrai(`le rail est retenu (${apresRechargement.largeur} px)`, apresRechargement.largeur <= 60);
verifier('le bouton le dit toujours', apresRechargement.bouton?.deplie, 'false');
/*
   LE SAUT, mesuré. Le seuil du dépôt est 0,1 (`essais:cls`) ; ici on en
   demande beaucoup plus, parce qu'un rail posé après le rendu déplace le
   contenu de douze rem d'un coup — un décalage énorme, pas un frémissement.
   Le processeur est ralenti quatre fois pour rendre le saut observable, comme
   dans `essais:cls` : sans cela, la machine est trop rapide pour qu'il se
   voie.
*/
vrai(
  `aucun saut au chargement en rail (instabilité ${Math.round((apresRechargement.saut ?? 0) * 1000) / 1000})`,
  (apresRechargement.saut ?? 1) < 0.02,
);
await c1.close();

/* ── 4. Le stockage refusé laisse la barre OUVERTE ────────────────────── */

console.log('\n4. LE STOCKAGE REFUSÉ');
const { ctx: c2, page: p2 } = await ouvrir({ sabotageStockage: true });
const sansStockage = await releve(p2);
vrai(
  `la barre est OUVERTE malgré tout (${sansStockage.largeur} px)`,
  sansStockage.largeur >= 200,
);
verifier('et le bouton se dit déplié', sansStockage.bouton?.deplie, 'true');
/* Et le repli marche quand même, pour la session en cours : ce qu'on perd,
   c'est la mémoire, pas la fonction. */
await p2.click('#replier-laterale');
await p2.waitForTimeout(400);
const replieSansStockage = await releve(p2);
vrai(
  `le repli fonctionne tout de même (${replieSansStockage.largeur} px)`,
  replieSansStockage.largeur <= 60,
);
verifier('les noms y survivent aussi', replieSansStockage.entrees, deplie.entrees);
await c2.close();

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('La barre se replie en rail sans perdre un nom, et sans faire sauter la page.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
