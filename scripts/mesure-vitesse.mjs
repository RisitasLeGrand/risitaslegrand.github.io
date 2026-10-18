/**
 * M7 — la vitesse perçue sur téléphone moyen.
 *
 *   npm run mesure:vitesse -- --phase=avant
 *   npm run mesure:vitesse -- --phase=apres
 *
 * ## Ce que le prompt demande
 *
 * « Mesure sur un téléphone moyen simulé (processeur ralenti 4 fois, 4G
 * lente), avec le profil d'un an de données synthétiques : INP sous 200 ms
 * sur les dix gestes de M1, LCP sous 2,5 s et CLS sous 0,1 sur les écrans
 * quotidiens. » Et : « prends tes mesures avant et après, et laisse-les au
 * 40, qui ne les refera pas. »
 *
 * Ce fichier **mesure et rapporte**. Il ne juge pas : un dépassement n'est
 * pas une erreur de l'outil, c'est le constat qui dira quoi corriger. La
 * batterie d'essais reste ailleurs ; ici on relève des chiffres, et on les
 * écrit dans `audit/mesures/`, que Git ignore.
 *
 * ## Le téléphone simulé
 *
 * - **Processeur ralenti 4 fois** : `Emulation.setCPUThrottlingRate`, la
 *   valeur que le prompt donne.
 * - **4G lente** : les valeurs du préréglage « Slow 4G » de DevTools —
 *   1,6 Mbit/s en descente, 750 kbit/s en montée, 150 ms de latence. Je les
 *   écris plutôt que de les nommer, pour que le 40 mesure dans les mêmes
 *   conditions sans avoir à deviner quel préréglage j'avais en tête.
 * - **360 × 740, tactile, densité 3** : le petit Android de M1.
 *
 * ## Le bridage n'est pas posé pendant la préparation
 *
 * Déverrouiller, franchir l'initialisation et déposer un an de données sous
 * un processeur quatre fois plus lent prendrait des minutes et ne mesurerait
 * rien d'utile — la préparation n'est pas un geste du quotidien. Le bridage
 * est donc posé **après** le semis, juste avant la première mesure, et il
 * tient jusqu'à la fin. C'est écrit ici parce qu'un lecteur pourrait croire
 * la préparation bridée elle aussi.
 *
 * ## Ce que chaque chiffre vaut
 *
 * - **LCP** : la dernière entrée `largest-contentful-paint` après un
 *   chargement à froid, cache vidé. C'est bien le LCP, au sens du navigateur.
 * - **CLS** : la somme des `layout-shift` sans geste récent, relevée pendant
 *   cinq secondes après le chargement. C'est le CLS de ces cinq secondes, et
 *   non celui d'une visite entière : un décalage provoqué plus tard par un
 *   geste n'y entre pas.
 * - **INP** : l'INP véritable est un centile sur toute une visite. Ce qu'on
 *   relève ici est la **durée de l'interaction unique** qu'on provoque — la
 *   plus longue entrée `event` de l'appui, du relâchement et du clic. Pour un
 *   seul geste, c'est la même grandeur que celle dont l'INP prend le centile,
 *   et c'est la seule mesurable en pilotage. Je ne l'appelle pas « INP » dans
 *   les tableaux : je l'appelle « durée du geste ».
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { engendrer } from './lib/donnees-synthetiques.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const PHASE = (process.argv.find((a) => a.startsWith('--phase=')) ?? '--phase=avant').slice(8);

/** Les seuils du prompt. Affichés, jamais appliqués comme un verdict. */
const SEUILS = { lcp: 2500, cls: 0.1, geste: 200 };

/** « Slow 4G » de DevTools, en clair. */
const RESEAU = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

/** Les écrans quotidiens — la liste de M5, inchangée. */
const QUOTIDIENS = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/taches/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/flashcards/',
  '/revisions/',
  '/sport/seance/',
  '/sport/',
];

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

/* ---- Préparation, sans bridage ----------------------------------------- */

console.log(`\nPRÉPARATION (sans bridage) — phase « ${PHASE} »`);
await franchirInitialisation(page, RACINE, MDP);

const jeu = engendrer({ annees: 1, graine: 7 });
const LOT = 2000;
let lignes = 0;
for (const [nom, enregistrements] of Object.entries(jeu)) {
  if (nom === 'projection' || !Array.isArray(enregistrements)) continue;
  for (let i = 0; i < enregistrements.length; i += LOT) {
    const tranche = enregistrements.slice(i, i + LOT);
    const pose = await page.evaluate(
      async ({ nom, tranche }) => {
        const base = await new Promise((ok, ko) => {
          const r = indexedDB.open('revinsp');
          r.onsuccess = () => ok(r.result);
          r.onerror = () => ko(r.error);
        });
        if (!base.objectStoreNames.contains(nom)) {
          base.close();
          return 0;
        }
        await new Promise((ok, ko) => {
          const tx = base.transaction(nom, 'readwrite');
          const magasin = tx.objectStore(nom);
          for (const enr of tranche) {
            if (nom === 'etat') magasin.put(enr.valeur, enr.clef);
            else magasin.put(enr);
          }
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
          tx.onabort = () => ko(tx.error);
        });
        base.close();
        return tranche.length;
      },
      { nom, tranche },
    );
    lignes += pose;
  }
}
console.log(`  un an de données synthétiques : ${lignes} lignes déposées`);
/*
   La prémisse : un semis vide mesurerait une base neuve, c'est-à-dire
   l'inverse de ce que le prompt demande. On le dit et on s'arrête.
*/
if (lignes < 1000) {
  console.log(`\x1b[31m✗\x1b[0m PRÉMISSE — le semis n’a posé que ${lignes} lignes ; la mesure porterait sur une base presque vide.`);
  await nav.close();
  process.exit(1);
}

/* ---- Le bridage ---------------------------------------------------------- */

await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Network.emulateNetworkConditions', RESEAU);
console.log('  bridage posé : processeur ÷ 4, 1,6 Mbit/s ↓, 750 kbit/s ↑, 150 ms');

/* ---- LCP et CLS, écran par écran ---------------------------------------- */

/** Installe les observateurs avant toute peinture, par script d'initialisation. */
const SONDE = `
  window.__mesure = { lcp: 0, cls: 0 };
  new PerformanceObserver((liste) => {
    for (const e of liste.getEntries()) window.__mesure.lcp = e.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((liste) => {
    for (const e of liste.getEntries()) if (!e.hadRecentInput) window.__mesure.cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
`;
await page.addInitScript(SONDE);

const ecrans = [];
console.log('\nLCP ET CLS SUR LES ÉCRANS QUOTIDIENS');
console.log(`  seuils : LCP < ${SEUILS.lcp} ms, CLS < ${SEUILS.cls}`);
for (const chemin of QUOTIDIENS) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(5000);
  const m = await page.evaluate(() => ({ ...window.__mesure }));
  const lcp = Math.round(m.lcp);
  const cls = Math.round(m.cls * 1000) / 1000;
  ecrans.push({ chemin, lcp, cls });
  const marqueL = lcp === 0 ? '?' : lcp < SEUILS.lcp ? '·' : '!';
  const marqueC = cls < SEUILS.cls ? '·' : '!';
  console.log(`  ${marqueL}${marqueC} ${chemin.padEnd(22)} LCP ${String(lcp).padStart(5)} ms   CLS ${cls}`);
}

/* ---- La durée des gestes ------------------------------------------------- */

/**
 * Les dix gestes de M1, tels que le pilote les numérote, **corrigés par le
 * code là où le geste n'existe pas**. Chaque correction est dite dans le
 * champ `note`, et M1 l'autorise explicitement.
 */
const GESTES = [
  {
    n: 1,
    nom: 'pointer une tâche',
    chemin: '/odyssee/taches/',
    avant: async (p) => {
      await p.fill('#titre', 'Geste mesuré');
      await p.locator('#ajout button[type=submit]').click();
      await p.waitForTimeout(2000);
    },
    cible: '[data-faire]',
  },
  {
    n: 2,
    nom: 'la Revue du matin',
    chemin: '/odyssee/revue/',
    cible: '#questions button[type=submit]',
    avant: async (p) => {
      await p.fill('#compte', 'Mesuré');
    },
    note:
      'Le matin et le soir partagent le même écran et le même bouton : le moment ' +
      'vient du profil, pas d’un geste. La durée relevée vaut donc pour les deux.',
  },
  { n: 3, nom: 'la Revue du soir', memeQue: 2 },
  {
    n: 4,
    nom: 'noter une dépense',
    chemin: '/odyssee/rapprocher/',
    coffre: true,
    cible: '#tout-confirmer',
    note:
      'CORRECTION DE LA LISTE. Noter une dépense à la main n’existe pas dans ' +
      'Cyclades : les opérations entrent par l’import d’un relevé bancaire, et ' +
      '`ecrireOperations` n’a qu’un seul appelant, le chemin d’import ' +
      '(finances.astro:350). Le geste d’argent fréquent est le pointage de la ' +
      'file « à rapprocher », et c’est lui qui est mesuré.',
  },
  {
    n: 5,
    nom: 'noter une prise',
    chemin: '/odyssee/corps/',
    coffre: true,
    cible: '#noter-prise',
    avant: async (p) => {
      await p.fill('#nom-prise', 'Mesure');
      await p.fill('#dose', '1');
    },
  },
  { n: 6, nom: 'ouvrir le coffre', chemin: '/odyssee/corps/', cible: '#ouvrir-coffre', mdpCoffre: true },
  {
    n: 7,
    nom: 'réviser une carte',
    chemin: '/flashcards/',
    /* « Commencer » n'a pas d'identifiant : on le prend par son libellé. */
    cible: 'button:has-text("Commencer")',
    avant: async (p) => {
      await p.waitForSelector('#accueil-session:not(.hidden)', { timeout: 60000 });
    },
  },
  { n: 8, nom: 'lancer une séance', chemin: '/sport/seance/', cible: '#commencer' },
  { n: 9, nom: 'consulter le jour dans le calendrier', chemin: '/odyssee/calendrier/', cible: '#aujourdhui' },
  { n: 10, nom: 'répondre à une notification', chemin: '/odyssee/', cible: '#centre-bouton' },
];

/** Observe la plus longue entrée `event` provoquée par un geste. */
const SONDE_GESTE = `
  window.__geste = 0;
  new PerformanceObserver((liste) => {
    for (const e of liste.getEntries()) {
      if (e.duration > window.__geste) window.__geste = e.duration;
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
`;

const gestes = [];
console.log('\nDURÉE DU GESTE — la plus longue entrée « event » de l’appui');
console.log(`  seuil du prompt pour l’INP : ${SEUILS.geste} ms`);
/*
   L'ORDRE DE MESURE N'EST PAS L'ORDRE DE M1, et c'est une correction de mon
   propre banc. Première passe : « ouvrir le coffre » n'a pas été mesuré parce
   que « noter une prise », mesuré avant lui, avait déjà ouvert le coffre — et
   le coffre reste ouvert pour l'onglet entier. Le bouton avait disparu, et mon
   banc en a conclu « cible absente » là où il n'y avait qu'une prémisse
   détruite par lui-même. « Ouvrir le coffre » passe donc en premier, et les
   gestes qui ont besoin d'un coffre ouvert viennent après. Les numéros
   affichés restent ceux de M1.
*/
const ORDRE = [6, 1, 2, 3, 5, 4, 7, 8, 9, 10];
const parNumero = new Map(GESTES.map((g) => [g.n, g]));
for (const numero of ORDRE) {
  const geste = parNumero.get(numero);
  if (geste.memeQue) {
    const jumeau = gestes.find((g) => g.n === geste.memeQue);
    gestes.push({ ...geste, ms: jumeau?.ms ?? null, repris: geste.memeQue });
    console.log(`  = ${String(geste.n).padStart(2)}. ${geste.nom} — même bouton que le ${geste.memeQue}`);
    continue;
  }
  await page.goto(`${RACINE}${geste.chemin}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(4000);
  if (geste.coffre) {
    const champ = page.locator('#mdp-coffre');
    if (await champ.isVisible().catch(() => false)) {
      await champ.fill(MDP);
      await page.locator('#ouvrir-coffre').click();
      await page.waitForTimeout(3000);
    }
  }
  if (geste.mdpCoffre) {
    const champ = page.locator('#mdp-coffre');
    if (await champ.isVisible().catch(() => false)) await champ.fill(MDP);
  }
  if (geste.avant) await geste.avant(page).catch(() => {});
  const cible = page.locator(geste.cible).first();
  if (!(await cible.isVisible().catch(() => false))) {
    gestes.push({ ...geste, ms: null, manque: `cible ${geste.cible} absente` });
    console.log(`  ? ${String(geste.n).padStart(2)}. ${geste.nom} — cible absente (${geste.cible}) : non mesuré`);
    continue;
  }
  /*
     L'état du bouton est relevé AVANT l'appui. Un bouton désactivé se laisse
     cliquer sans rien déclencher, et l'observateur ne voit alors aucune
     entrée : on lirait « 0 ms » et on conclurait « très rapide » sur un geste
     qui n'a pas eu lieu. Un contrôle qui confond le vide et la vitesse ne
     rapporte rien.
  */
  const inerte = await cible.isDisabled().catch(() => false);
  await page.evaluate(SONDE_GESTE);
  await cible.click({ force: true });
  await page.waitForTimeout(3000);
  const ms = Math.round(await page.evaluate(() => window.__geste));
  if (ms === 0) {
    const pourquoi = inerte
      ? 'bouton désactivé : il n’y a rien à faire sur cet écran avec ce profil'
      : 'aucune entrée « event » : l’appui n’a rien déclenché de mesurable';
    gestes.push({ ...geste, ms: null, manque: pourquoi });
    console.log(`  ? ${String(geste.n).padStart(2)}. ${geste.nom.padEnd(38)} non mesuré — ${pourquoi}`);
    continue;
  }
  gestes.push({ ...geste, ms });
  console.log(`  ${ms < SEUILS.geste ? '·' : '!'} ${String(geste.n).padStart(2)}. ${geste.nom.padEnd(38)} ${String(ms).padStart(5)} ms`);
}

/* ---- Le relevé, écrit ---------------------------------------------------- */

mkdirSync('audit/mesures', { recursive: true });
const chemin = `audit/mesures/vitesse-${PHASE}.json`;
writeFileSync(
  chemin,
  `${JSON.stringify(
    {
      phase: PHASE,
      le: new Date().toISOString(),
      telephone: { largeur: 360, hauteur: 740, densite: 3, processeur: '÷ 4', reseau: RESEAU },
      lignesSemees: lignes,
      seuils: SEUILS,
      ecrans,
      /* Remis dans l'ordre de M1 : l'ordre de mesure est celui du coffre. */
      gestes: [...gestes]
        .sort((a, b) => a.n - b.n)
        .map(({ n, nom, ms, manque, repris, note }) => ({ n, nom, ms, manque, repris, note })),
    },
    null,
    2,
  )}\n`,
);
console.log(`\nRelevé écrit dans ${chemin}`);

const depassements =
  ecrans.filter((e) => e.lcp >= SEUILS.lcp || e.cls >= SEUILS.cls).length +
  gestes.filter((g) => typeof g.ms === 'number' && g.ms >= SEUILS.geste).length;
const nonMesures = gestes.filter((g) => g.ms === null && !g.repris).length;
console.log(
  `${depassements} dépassement(s) de seuil, ${nonMesures} geste(s) non mesuré(s).` +
    ' Ce relevé constate ; il ne juge pas.',
);

await nav.close();
