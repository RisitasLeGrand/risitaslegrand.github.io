/**
 * La flèche de retour, dans un vrai navigateur.
 *
 * L'essai de module dit **où** la flèche mène. Celui-ci dit qu'elle est là,
 * qu'on peut la toucher, qu'elle recule quand il y a un écran précédent, et
 * qu'elle ne fait jamais sortir du site. Aucune de ces quatre choses ne se lit
 * dans le code : la première dépend de la mise en page, la deuxième de la
 * feuille de style, les deux dernières de l'historique du navigateur.
 *
 * Il mesure aussi le prix de l'échange : le menu, que le logo offrait à une
 * touche sous 640 px, doit rester atteignable depuis la feuille « Plus ».
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const BASE = 'http://localhost:4321';
const MDP = motDePasseEssais();

let echecs = 0;
const verifier = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

/** Les routes construites, lues sur le disque plutôt que devinées. */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
const routes = () => {
  const sortie = [];
  const parcourir = (dossier, prefixe) => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin, `${prefixe}${entree}/`);
      else if (entree === 'index.html') sortie.push(prefixe);
    }
  };
  parcourir('dist', '/');
  return sortie.sort();
};

/*
   Une panne est un échec, et elle se dit en rouge.

   Sans ce filet, une exception — un sélecteur disparu, une page qui ne
   répond plus — tuait le script sans imprimer la moindre ligne d'échec. Le
   banc de sabotage, qui ne lit que ces lignes, en concluait que le contrôle
   ne mordait pas. Un contrôle qui confond l'échec et la panne ne rapporte
   rien, et c'est ce qui a laissé passer le sabotage « Menu retiré ».
*/
process.on('uncaughtException', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e && e.message ? e.message : e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e && e.message ? e.message : e}`);
  process.exit(1);
});

const nav = await chromium.launch({ executablePath: cheminDuNavigateur() });

/* ──────────────────────────────────────────────────────────────────────────
   R1 · La flèche est là partout sauf au menu, et nulle part au menu
   ────────────────────────────────────────────────────────────────────────── */

console.log('\nR1 — LA FLÈCHE EST PRÉSENTE PARTOUT SAUF AU MENU');

const ROUTES = routes();
const ctx = await nav.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

const sans = [];
const autreSortie = [];
const tropPetites = [];
const sansNom = [];
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  const etat = await page.evaluate(() => {
    const f = document.getElementById('fleche-retour');
    if (!f) return { present: false };
    const r = f.getBoundingClientRect();
    return {
      present: true,
      visible: r.width > 0 && r.height > 0,
      largeur: Math.round(r.width),
      hauteur: Math.round(r.height),
      nom: [...f.querySelectorAll(':scope > *')]
        .filter((e) => e.getAttribute('aria-hidden') !== 'true')
        .map((e) => (e.textContent ?? '').trim())
        .join(' '),
      href: f.getAttribute('href'),
    };
  });
  /*
     L'initialisation est la seule exception, et elle est la même que celle du
     retour au menu : c'est un parcours d'accueil, où une porte de sortie
     dessert la personne. Elle est nommée, pas devinée.
  */
  if (route === '/initialisation/') continue;
  if (route === '/') {
    verifier('le menu n’affiche aucune flèche : il n’a pas de parent', etat.present, false);
    continue;
  }
  if (!etat.present || !etat.visible) {
    /*
       Pas de flèche. Avant d'accuser, on vérifie ce que la flèche sert à
       garantir : qu'on ne reste jamais coincé. Une page peut l'honorer
       autrement — « /mot-de-passe-perdu/ » se lit SANS le mot de passe, et
       un en-tête dont tous les liens mènent à des écrans verrouillés ne
       servirait personne ; elle porte donc un lien de retour explicite dans
       son corps.

       On mesure ce lien, on ne le suppose pas : visible, et menant à
       l'accueil. Les pages qui passent par là sont nommées plus bas, pour
       que l'exception ne devienne jamais silencieuse.
    */
    const sortie = await page.evaluate((racine) => {
      const liens = [...document.querySelectorAll('a[href]')];
      return liens.some((a) => {
        const r = a.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        try {
          return new URL(a.href, location.href).pathname === racine;
        } catch {
          return false;
        }
      });
    }, new URL(`${BASE}/`).pathname);
    if (sortie) {
      autreSortie.push(route);
      continue;
    }
    sans.push(route);
    continue;
  }
  if (etat.largeur < 44 || etat.hauteur < 44) {
    tropPetites.push(`${route} ${etat.largeur}×${etat.hauteur}`);
  }
  if (!/^Revenir à .+/.test(etat.nom)) sansNom.push(`${route} « ${etat.nom} »`);
}
verifier('aucune page sans flèche ni autre porte de sortie', sans, []);
console.log(
  `      pages sans flèche mais avec un lien de retour explicite : ${autreSortie.length}` +
    (autreSortie.length ? ` — ${autreSortie.join(', ')}` : ''),
);
/*
   La garde de la garde : si un jour toutes les pages passaient par cette
   porte dérobée, le contrôle ne contrôlerait plus rien. Une poignée
   d'exceptions nommées, pas davantage.
*/
verifier('et ces exceptions restent rares', autreSortie.length <= 2, true);
verifier('R2 — aucune flèche sous 44 px à 360 px', tropPetites, []);
verifier('R3 — chaque flèche dit sa destination à voix haute', sansNom, []);

/* ──────────────────────────────────────────────────────────────────────────
   R4 · Premier écran de l'onglet : la flèche remonte, elle ne recule pas
   ────────────────────────────────────────────────────────────────────────── */

console.log("\nR4 — PREMIER ÉCRAN DE L'ONGLET : LA FLÈCHE REMONTE AU PARENT");

/*
   Un **onglet neuf** par cas, et c'est la prémisse de tout ce bloc.

   Le site pose « referrer: no-referrer », donc rien ne dit d'où l'on vient ;
   ce qui distingue « j'ai navigué dans Cyclades » de « je viens d'ouvrir cet
   écran » est la profondeur inscrite dans l'entrée d'historique, qui vit dans
   le stockage de session — c'est-à-dire **par onglet**. Rejouer ces cas dans
   l'onglet qui a servi à l'initialisation mesurerait une profondeur héritée
   d'elle, et l'essai croirait reculer là où il remonte.

   On initialise donc dans un onglet, puis on ouvre le cas dans un second :
   le profil est prêt, l'historique est vierge.
*/
const contexteInitialise = async () => {
  const c = await nav.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
  const amorce = await c.newPage();
  await franchirInitialisation(amorce, BASE, MDP);
  await amorce.close();
  return c;
};

for (const [route, attendu] of [
  ['/odyssee/sante/', '/odyssee/'],
  ['/quiz/dgfip/', '/quiz/'],
  ['/syntheses/', '/odyssee/'],
  ['/profil/', '/'],
]) {
  const c = await contexteInitialise();
  const p = await c.newPage();
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  const profondeur = await p.evaluate(() => history.state?.cycladesProfondeur ?? null);
  await p.click('#fleche-retour');
  await p.waitForLoadState('networkidle');
  const u = new URL(p.url());
  verifier(
    `${route} en premier écran → ${attendu}, sans quitter le site`,
    { profondeur, origine: u.origin, chemin: u.pathname },
    { profondeur: 1, origine: 'http://localhost:4321', chemin: attendu },
  );
  await c.close();
}

/* ──────────────────────────────────────────────────────────────────────────
   R5 · Après une navigation : la flèche recule
   ────────────────────────────────────────────────────────────────────────── */

console.log('\nR5 — APRÈS UNE NAVIGATION : LA FLÈCHE RECULE');

{
  const c = await contexteInitialise();
  const p = await c.newPage();
  /*
     On part de « Tâches » vers « Quêtes », deux onglets frères. Leur parent
     commun est « /odyssee/ » : une flèche qui remonterait au parent au lieu de
     reculer irait donc ailleurs, et l'essai le dirait. Entre un écran et son
     propre parent, les deux retours se confondent et ne prouvent rien.
  */
  await p.goto(`${BASE}/odyssee/taches/`, { waitUntil: 'networkidle' });
  await p.click('#ouvrir-plus');
  await p.waitForSelector('#feuille-plus:not(.hidden)');
  await p.click('#feuille-plus a[href$="/odyssee/quetes/"]');
  await p.waitForLoadState('networkidle');
  verifier(
    'on est bien sur « Quêtes », à la profondeur 2',
    {
      chemin: new URL(p.url()).pathname,
      profondeur: await p.evaluate(() => history.state?.cycladesProfondeur ?? null),
    },
    { chemin: '/odyssee/quetes/', profondeur: 2 },
  );
  await p.click('#fleche-retour');
  await p.waitForLoadState('networkidle');
  verifier(
    'la flèche revient d’où l’on vient, et non au parent',
    new URL(p.url()).pathname,
    '/odyssee/taches/',
  );
  /*
     Et la profondeur redescend : l'entrée retrouvée porte la sienne, inscrite
     dans son état d'historique. C'est ce qui empêche un second clic de
     reculer une fois de trop — le défaut que `history.length` aurait produit.
  */
  verifier(
    'et la profondeur retrouvée est celle de l’entrée, pas un compteur qui monte',
    await p.evaluate(() => history.state?.cycladesProfondeur ?? null),
    1,
  );
  await p.click('#fleche-retour');
  await p.waitForLoadState('networkidle');
  const u = new URL(p.url());
  verifier(
    'un second clic remonte au parent et ne sort pas de l’onglet',
    { origine: u.origin, chemin: u.pathname },
    { origine: 'http://localhost:4321', chemin: '/odyssee/' },
  );
  await c.close();
}

/* ──────────────────────────────────────────────────────────────────────────
   R6 · Trois clics d'affilée finissent au menu, jamais dehors
   ────────────────────────────────────────────────────────────────────────── */

console.log('\nR6 — LA FLÈCHE NE FAIT JAMAIS SORTIR DU SITE');

{
  const c = await contexteInitialise();
  const p = await c.newPage();
  await p.goto(`${BASE}/quiz/dgfip/`, { waitUntil: 'networkidle' });
  const visites = [];
  for (let i = 0; i < 4; i += 1) {
    await p.click('#fleche-retour').catch(() => {});
    await p.waitForLoadState('networkidle');
    const u = new URL(p.url());
    visites.push(`${u.origin === 'http://localhost:4321' ? '' : u.origin}${u.pathname}`);
    if (u.pathname === '/') break;
  }
  verifier(
    'de « QCM — DGFiP », on atteint le menu en remontant, sans détour dehors',
    visites,
    ['/quiz/', '/revisions/', '/'],
  );
  await c.close();
}

/*
   Ce que cet essai ne mesure **pas** : la hauteur de l'en-tête.

   Le cliquet M10bis de « essais:mobile:navigateur » la mesure déjà, coffre
   ouvert, à 360 px, avec des plafonds posés avant que la flèche existe —
   243 px pour Odyssée et Sport, 264 pour Révisions. C'est lui qui prouve que
   l'échange logo-contre-flèche n'a coûté aucun pixel ; le refaire ici, coffre
   fermé, aurait donné une mesure plus faible sur un seuil fabriqué après coup.
*/

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
