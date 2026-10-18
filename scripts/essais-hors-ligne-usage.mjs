/**
 * M8 — les écrans quotidiens s'ouvrent et enregistrent hors ligne.
 *
 *   npm run essais:hors-ligne-usage
 *
 * ## Pourquoi ce fichier s'ajoute à `essais:hors-ligne`
 *
 * L'essai existant garde le **contrat du cache** : le worker s'enregistre,
 * `cle.json` n'y est jamais, un cache d'une autre publication est effacé, la
 * coquille s'ouvre encore. Tout cela peut être vrai pendant que l'usage
 * réel est impossible — et il l'était. Le prompt 41 demande autre chose :
 * « Les écrans quotidiens s'ouvrent **et enregistrent** hors ligne, et le
 * retour du réseau ne perd ni ne double rien. » C'est cela qu'on mesure
 * ici, du premier geste au dernier.
 *
 * ## Ce qui était cassé, mesuré le 18 octobre avant correction
 *
 * Déverrouillé en ligne, clé mémorisée présente. Passage en mode avion et
 * rechargement : la page s'ouvrait (HTTP 200, le cache fait son office) mais
 * **la clé mémorisée avait disparu**, et l'écran redemandait le mot de
 * passe. Le mode avion ne bloquait pas seulement la lecture : il détruisait
 * la session, et il fallait retaper le mot de passe au retour du réseau.
 *
 * Trois causes, que le prompt 43 avait devinées et que le code a
 * confirmées :
 *
 * 1. le worker garde sa publication dans une variable de module, et un
 *    service worker est arrêté dès qu'il se tait — au réveil il ne savait
 *    plus quel cache servir, et hors ligne la page qui le lui aurait dit ne
 *    pouvait pas se charger sans lui ;
 * 2. `cle.json` n'est jamais mis en cache — à raison, c'est lui qui porte la
 *    preuve de sa propre fraîcheur — donc illisible hors ligne ;
 * 3. `obtenirCle()` enveloppait tout dans un `try` dont le `catch` effaçait
 *    le stockage. L'échec de lecture de `cle.json` y tombait, et une clé
 *    valide était effacée parce que le réseau manquait.
 *
 * ## Ce que l'essai ne prouve pas
 *
 * Il ne prouve pas que le **contenu chiffré** (fiches, manifestes) est
 * lisible hors ligne : il ne l'est que s'il a été gardé exprès par
 * « cyclades:garder », et c'est une autre question que celle de M8. Ce qui
 * est mesuré ici, ce sont les écrans quotidiens, dont les données vivent
 * dans IndexedDB.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const TITRE = 'Écrite en mode avion';

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
const ctx = await nav.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();

const taches = () =>
  page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const q = r.result.transaction('odysseeTaches').objectStore('odysseeTaches').getAll();
          q.onsuccess = () => ok(q.result.map((t) => t.titre));
          q.onerror = () => ok(null);
        };
        r.onerror = () => ok(null);
      }),
  );

const cleMemorisee = () =>
  page.evaluate(() => {
    try {
      return Boolean(localStorage.getItem('revinsp.cle') || sessionStorage.getItem('revinsp.cle'));
    } catch {
      return false;
    }
  });

/* ---- 1. En ligne : on déverrouille et on mémorise ----------------------- */

console.log('\nEN LIGNE');
await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
/*
   La prémisse, et elle est tout sauf décorative : si la clé n'est pas
   mémorisée en ligne, la suite mesurerait la disparition d'une chose qui
   n'a jamais été là, et passerait au vert pour la pire des raisons.
*/
verifier('la clé est mémorisée après déverrouillage', await cleMemorisee(), true);
const avant = await taches();
verifier('la base des tâches est lisible', Array.isArray(avant), true);

const worker = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return Boolean(r?.active);
});
verifier('le service worker est actif', worker, true);

/* ---- 2. Mode avion ------------------------------------------------------ */

console.log('\nEN MODE AVION');
await ctx.setOffline(true);

/*
   ARRÊTER LE WORKER AVANT DE RECHARGER — c'est la première cause, et sans
   ce geste elle ne serait pas éprouvée du tout.

   Un service worker est arrêté dès qu'il se tait, et relancé au premier
   événement. Un essai qui enchaîne les gestes en quelques secondes ne lui
   en laisse jamais le temps : il garde sa publication en mémoire d'un bout
   à l'autre, et l'essai passerait au vert sur un worker qui n'a jamais
   redémarré. On provoque donc l'arrêt par le protocole de débogage, qui
   est le seul moyen de le demander — aucune API de page ne le permet.
*/
const debogueur = await ctx.newCDPSession(page);
let arretDemande = false;
try {
  await debogueur.send('ServiceWorker.enable');
  await debogueur.send('ServiceWorker.stopAllWorkers');
  arretDemande = true;
} catch {
  /* Rapporté juste après : un arrêt qu'on n'a pas obtenu ne se suppose pas. */
}
verifier('le worker a été arrêté avant le rechargement', arretDemande, true);
const reponse = await page
  .goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'load', timeout: 60000 })
  .then((r) => r?.status() ?? 0, () => 0);
verifier('l’écran s’ouvre à froid, servi par le cache', reponse, 200);
/*
   S'ARRÊTER SI LA NAVIGATION A ÉCHOUÉ — trouvé par le sabotage de la
   première cause. Une navigation qui échoue ne vide pas l'onglet : la page
   PRÉCÉDENTE y reste, déverrouillée et complète. Les contrôles suivants la
   mesuraient donc elle, et passaient au vert alors que rien ne s'était
   ouvert — un seul rouge là où tout devait l'être. On s'arrête, et l'on dit
   que le reste n'a pas été mesuré plutôt que de le déclarer bon.
*/
if (reponse !== 200) {
  console.log(
    '\x1b[31m✗\x1b[0m la suite n’est pas mesurée : sans rechargement, elle porterait sur la page précédente',
  );
  rouges += 1;
  await nav.close();
  console.log(`\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
  process.exit(1);
}
await page.waitForTimeout(4000);

verifier('et la clé mémorisée a SURVÉCU au passage hors ligne', await cleMemorisee(), true);

const ecran = await page.evaluate(() => ({
  vue: !document.getElementById('vue')?.classList.contains('hidden'),
  /* `offsetParent` à null = l'élément est masqué : le verrou n'est pas affiché. */
  verrou: Boolean(document.getElementById('champ-mdp')?.offsetParent),
}));
verifier('l’écran est rendu, pas le verrou', ecran, { vue: true, verrou: false });

/*
   LES HUIT AUTRES ÉCRANS QUOTIDIENS. Le prompt dit « les écrans
   quotidiens », au pluriel : n'en éprouver qu'un laisserait les autres sans
   garantie, et c'est justement sur les deux qui lisent du contenu chiffré —
   Flashcards et Révisions — qu'on aurait pu croire le hors-ligne
   impossible. Mesuré le 18 octobre : les neuf s'ouvrent, verrou masqué,
   contenu rendu.
*/
const AUTRES = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/flashcards/',
  '/revisions/',
  '/sport/seance/',
  '/sport/',
];
for (const chemin of AUTRES) {
  const st = await page
    .goto(`${RACINE}${chemin}`, { waitUntil: 'load', timeout: 60000 })
    .then((r) => r?.status() ?? 0, () => 0);
  if (st !== 200) {
    console.log(`\x1b[31m✗\x1b[0m ${chemin} — ne s’ouvre pas hors ligne (${st})`);
    rouges += 1;
    continue;
  }
  await page.waitForTimeout(3000);
  const rendu = await page.evaluate(() => ({
    verrou: Boolean(document.getElementById('champ-mdp')?.offsetParent),
    /* Le volume du texte rendu : un écran vide s'ouvrirait sans rien dire. */
    signes: (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').trim().length,
  }));
  verifier(`${chemin} — s’ouvre, verrou masqué, contenu rendu`, {
    verrou: rendu.verrou,
    garni: rendu.signes > 100,
  }, { verrou: false, garni: true });
}

/* On revient à l'écran des tâches pour y écrire. */
await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);

/* L'écriture, qui est la moitié oubliée de « s'ouvrir hors ligne ». */
const champ = page.locator('#titre');
if (!(await champ.isVisible().catch(() => false))) {
  console.log('\x1b[31m✗\x1b[0m le formulaire d’ajout est absent : rien n’a pu être écrit');
  rouges += 1;
} else {
  const n = (await taches())?.length ?? -1;
  await champ.fill(TITRE);
  await page.locator('#ajout button[type=submit]').click();
  await page.waitForTimeout(2500);
  const apres = await taches();
  verifier('une tâche écrite hors ligne est enregistrée', (apres?.length ?? -1) - n, 1);
  verifier('et c’est bien la nôtre', apres?.includes(TITRE), true);
}

/* ---- 3. Le retour du réseau --------------------------------------------- */

console.log('\nAU RETOUR DU RÉSEAU');
await ctx.setOffline(false);
await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
const final = await taches();
verifier('la tâche écrite hors ligne est toujours là', final?.includes(TITRE), true);
/*
   Ni perdue, ni doublée : le prompt demande les deux, et c'est le
   doublement qui se voit le moins. On compte les occurrences du titre.
*/
verifier(
  'et elle n’a pas été doublée',
  (final ?? []).filter((t) => t === TITRE).length,
  1,
);
verifier('la clé est toujours mémorisée', await cleMemorisee(), true);

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
