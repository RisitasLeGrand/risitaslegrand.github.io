/**
 * M10 — la carte des écrans : aucune route orpheline, aucune au-delà de trois appuis.
 *
 *   npm run essais:carte-ecrans
 *
 * ## Pourquoi ce contrôle existe
 *
 * `essais:orphelins` dit qu'un **module** est importé par un écran. Il ne dit
 * rien d'un **écran** que rien ne relie : le 16 octobre 2026,
 * `/odyssee/molecule/` a été livrée avec ses essais verts, sa fiche, ses
 * sources — et aucun lien vers elle nulle part. On ne pouvait l'ouvrir qu'en
 * tapant l'adresse. Une fonction qu'on ne trouve pas n'existe pas.
 *
 * ## Pourquoi il mesure au navigateur et non dans le code
 *
 * Une première version lisait les chaînes littérales de `src/`. Elle
 * déclarait 53 routes sur 54 inatteignables, parce que la barre du bas vient
 * du registre et que ses liens s'assemblent à l'exécution. Pire : elle aurait
 * accusé à tort les trois modules de Cog-Training, dont le `href` se
 * construit par concaténation. Un contrôle qui accuse à tort se fait
 * désactiver, et c'est ainsi qu'on perd un garde-fou.
 *
 * Il ouvre donc chaque écran et relève les liens **rendus**, ce qui est la
 * seule définition qui compte : ce sur quoi un doigt peut appuyer.
 *
 * ## Le coût d'un lien
 *
 * Un appui, sauf dans la feuille « Plus » de la barre du bas, qu'il faut
 * ouvrir d'abord : ses liens coûtent deux. Sans cette distinction, le
 * contrôle dirait que tout est à un appui, ce qui est faux au doigt.
 *
 * ## Le coffre
 *
 * Ouvert avant de mesurer. Un balayage coffre fermé relève les liens d'un
 * écran vide, et c'est l'erreur du 14 octobre.
 */
import { chromium } from 'playwright-core';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const PLAFOND = 3;

/**
 * Les exceptions, chacune avec sa raison.
 *
 * Une exception **permanente** est un choix qu'on assume ; une exception
 * **datée** est une dette qu'on compte. Pas de troisième sorte, et surtout
 * pas la liste qu'on allonge sans la lire.
 */
const EXCEPTIONS_ORPHELINES = [
  {
    route: '/initialisation/',
    permanente: true,
    pourquoi:
      'On y arrive par redirection depuis « / » tant que l’initialisation ' +
      'n’a pas eu lieu, et on n’y revient jamais ensuite. Un lien permanent ' +
      'vers elle proposerait de refaire ce qui est fait.',
  },
  {
    route: '/404/',
    permanente: true,
    pourquoi:
      'On y arrive en se trompant d’adresse, ce qu’aucun lien ne peut ' +
      'proposer. L’hébergeur la sert à la place de la page demandée ; un ' +
      'lien vers elle inviterait à visiter l’erreur. Elle porte en revanche ' +
      'la flèche de retour et un lien vers l’accueil, et « essais:404-hors-ligne » ' +
      'le vérifie — c’est la SORTIE qui compte pour une page d’erreur, pas ' +
      'l’entrée.',
  },
  {
    route: '/hors-ligne/',
    permanente: true,
    pourquoi:
      'Le service worker la sert à la place de l’écran demandé quand le ' +
      'réseau manque et que rien n’est gardé : son entrée est une panne, pas ' +
      'un lien. Y mener depuis un écran serait proposer de consulter la page ' +
      'hors ligne alors qu’on est en ligne. Mêmes sorties que la 404, mêmes ' +
      'contrôles dans « essais:404-hors-ligne ».',
  },
];

/** Les écrans du quotidien : deux appuis, et non trois. */
const QUOTIDIENS = [
  '/odyssee/',
  '/odyssee/revue/',
  '/odyssee/taches/',
  '/odyssee/calendrier/',
  '/odyssee/corps/',
  '/flashcards/',
  '/revisions/',
  '/sport/seance/',
  '/notifications/',
];

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};

/** Les routes, déduites du dossier des pages. */
function routes() {
  const base = resolve(ICI, '..', 'src', 'pages');
  const out = [];
  const parcourir = (d, prefixe) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourir(c, `${prefixe}${e}/`);
      else if (e.endsWith('.astro')) {
        out.push(e === 'index.astro' ? prefixe : `${prefixe}${e.replace('.astro', '')}/`);
      }
    }
  };
  parcourir(base, '/');
  return out.sort();
}

const ROUTES = routes();
const EST_ROUTE = new Set(ROUTES);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

// La prémisse se lit, elle ne se devine pas.
await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
}
await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
verifier(
  'le coffre est ouvert avant de relever le moindre lien',
  await page.evaluate(() => !document.getElementById('temoin-coffre')?.classList.contains('hidden')),
  true,
);

/*
   ══ LA RÉPONSE AU SEXE, DONNÉE PAR LA PORTE PRINCIPALE ══════════════════

   Depuis la décision d'Alexis du 19 octobre, `/odyssee/corps/suivi/`
   n'apparaît que pour un sexe féminin déclaré. Un balayage fait sur un profil
   vierge trouve donc la ligne masquée, et déclare la route ORPHELINE — ce
   qu'elle n'est pas : elle est conditionnelle.

   Deux façons de régler cela, et une seule est bonne.

   La mauvaise aurait été d'inscrire cette route dans une liste d'exceptions :
   le contrôle aurait cessé de la mesurer, et le jour où la ligne de Corps
   serait réellement cassée, rien ne l'aurait dit.

   Celle-ci RÉPOND À LA QUESTION, en appuyant sur le bouton que la personne
   appuierait, sur l'écran où elle est posée. C'est la même règle que
   `franchir-initialisation.mjs` énonce pour l'initialisation : « Un essai qui
   passerait par la porte de service cesserait de remarquer que la porte
   principale est cassée. » Écrire la réponse directement en base aurait été
   cette porte de service.

   Conséquence voulue : si la question disparaît de Corps, ou si répondre
   « Féminin » ne montre plus la ligne, ce contrôle rougit — en annonçant la
   route orpheline. Le message ne nommera pas la cause, mais il montrera
   l'effet, et c'est déjà ce qu'il sait faire de mieux.
*/
const boutonFeminin = page.locator('#reponses-sexe button[data-sexe="feminin"]');
if (await boutonFeminin.isVisible().catch(() => false)) {
  await boutonFeminin.click();
  await page
    .waitForFunction(
      () => document.getElementById('ligne-du-suivi')?.classList.contains('hidden') === false,
      { timeout: 20000 },
    )
    .catch(() => {});
}
verifier(
  'la réponse « Féminin » est donnée, donc le suivi est atteignable',
  await page.evaluate(
    () => document.getElementById('ligne-du-suivi')?.classList.contains('hidden') === false,
  ),
  true,
);

/*
   LE BALAYAGE SE FAIT DEUX FOIS, SOUS DEUX PARCOURS.

   Depuis que le registre permet à un écran de ne valoir que pour certains
   parcours — « Organigrammes » pour les trois concours de la DGFiP —, un seul
   balayage ne suffit plus. Sous le parcours par défaut, l'INSP, le lien vers
   cet écran est écrit dans le HTML puis CACHÉ par le script du pied de page :
   la carte le déclarerait orphelin, c'est-à-dire inatteignable, là où il n'y a
   qu'un public.

   Et REMPLACER le parcours balayé serait l'erreur inverse : un écran propre à
   l'INSP sortirait du balayage à son tour. On balaye donc l'INSP, puis
   « dgfip-a », et les liens trouvés s'additionnent — une page n'est orpheline
   que si elle l'est sous les deux. Le coût retenu pour un lien est le plus
   PETIT des deux : un écran atteignable en un appui pour un parcours est
   atteignable, et la profondeur ne doit pas punir l'autre parcours.
*/
const PARCOURS_BALAYES = ['insp', 'dgfip-a'];

/** route → Map(cible → coût du lien) */
const liens = new Map();

/**
 * L'aperçu répond-il ? Demandé à Node, et non au navigateur.
 *
 * C'EST LA SEULE GARDE QUI ATTRAPE CE QUI EST ARRIVÉ, et les deux premières
 * que j'avais écrites étaient inertes. Elles guettaient un `goto` rejeté,
 * puis une page sans aucune ancre. Ni l'un ni l'autre ne se produit, et le
 * sabotage l'a montré deux fois : avec l'aperçu ARRÊTÉ au milieu du passage
 * — « Stopped preview server (pid 4189) », plus rien n'écoutant sur le port —
 * les pages continuaient de se rendre, avec leurs ancres, et les verdicts
 * s'affichaient.
 *
 * La raison est le SERVICE WORKER. `franchirInitialisation` ouvre
 * l'application, qui l'enregistre, et il sert ensuite les pages depuis son
 * cache : c'est son office, et c'est ce que le site promet hors ligne.
 * Vérifié : dans un contexte NEUF, sans service worker, la même navigation
 * est rejetée par « net::ERR_CONNECTION_REFUSED ».
 *
 * L'essai mesurait donc un site HORS LIGNE sans le savoir, sur des pages
 * mises en cache à des moments différents — d'où un graphe troué, vingt-
 * quatre routes « à l'infini », et trois verdicts qui accusaient la carte du
 * site d'un défaut qui n'existe pas. Il a coûté une heure de diagnostic le
 * 25 octobre, sur un rouge du socle que j'avais provoqué moi-même en
 * reconstruisant pendant le passage.
 *
 * Le navigateur ne peut donc pas répondre à la question : par construction,
 * il ne la distingue pas. Node, lui, n'a pas de service worker.
 */
const apercuRepond = () =>
  fetch(`${RACINE}/robots.txt`, { signal: AbortSignal.timeout(10_000) })
    .then((r) => r.ok)
    .catch(() => false);

/*
   UNE NAVIGATION QUI ÉCHOUE NE DOIT PAS ÊTRE AVALÉE, ET ELLE L'ÉTAIT.

   Le `goto` portait un `.catch(() => {})`. Conséquence : une route qui ne
   répond pas ne rend aucun lien, et le graphe se referme sans rien dire —
   les écrans qu'elle seule atteignait deviennent « à l'infini », et l'essai
   accuse la carte du site d'un défaut qui n'existe pas.

   C'est arrivé le 25 octobre, et c'est moi qui l'ai provoqué : j'ai
   reconstruit et redémarré l'aperçu PENDANT que le socle tournait. Cet
   essai était le seizième sur vingt-six. Il a rendu « /sport/force/ sans
   lien entrant » et quatre routes de sport à l'infini. Relancé sur un
   aperçu stable, tout est vert — la navigation rend bien les six liens de
   la branche sport depuis « /sport/ ».

   Une heure de diagnostic pour une cause qui n'était pas dans le code. Les
   échecs sont donc COMPTÉS, et l'essai refuse plutôt que de juger sur un
   graphe troué : mieux vaut « je n'ai pas pu mesurer » que « votre site est
   mal relié ».
*/
const injoignables = [];
/*
   LES DEUX CORRECTIONS DE CE BLOC SE SONT CROISÉES, ET ELLES TIENNENT
   ENSEMBLE.

   Celle du train ajoute la garde qui manquait : l'aperçu peut être arrêté au
   milieu du passage sans que rien ne s'en aperçoive, parce que le service
   worker sert les pages depuis son cache — l'essai mesurait un site hors
   ligne sans le savoir. Celle-ci dédouble le balayage, parce qu'un écran peut
   désormais ne valoir que pour certains parcours.

   Les deux sont gardées : la garde encadre le passage, le passage se fait deux
   fois.
*/
for (const parcoursBalaye of PARCOURS_BALAYES) {
await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' }).catch(() => {});
await page
  .evaluate((id) => localStorage.setItem('revinsp.parcours', id), parcoursBalaye)
  .catch(() => {});

for (const route of ROUTES) {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' }).catch((e) => {
    injoignables.push(`${route} — ${String(e?.message ?? e).split('\n')[0]}`);
  });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(500);

  /*
     ON REND UN OBJET, ET NON UN TABLEAU PORTANT UNE PROPRIÉTÉ.

     Première écriture : `const out = []` puis `out.ancres = …`. En JavaScript
     c'est licite, et `page.evaluate` l'a pourtant perdu — la valeur traverse
     la frontière en JSON, et JSON.stringify d'un tableau ne garde que ses
     indices. `trouves.ancres` valait donc `undefined` du côté de Node, le
     refus ne se déclenchait jamais, et le sabotage l'a dit.
  */
  const trouves = await page.evaluate(() => {
    const out = [];
    const ancres = document.querySelectorAll('a[href]').length;
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('/') && !href.startsWith(location.origin)) continue;
      let chemin = href.replace(location.origin, '').split('?')[0].split('#')[0];
      if (!chemin) continue;
      if (!chemin.endsWith('/')) chemin += '/';
      // La feuille « Plus » doit être ouverte : ses liens coûtent un appui de plus.
      out.push({ chemin, cout: a.closest('#feuille-plus') ? 2 : 1 });
    }
    return { ancres, liens: out };
  });

  /*
     LE VRAI SIGNE D'UNE PAGE QUI N'A PAS RENDU, et non l'échec du `goto`.

     Le refus posé plus bas guettait d'abord un `goto` rejeté. Le sabotage l'a
     démenti : en coupant l'aperçu au milieu du passage, aucune navigation
     n'est rejetée — elle réussit, sur une page qui ne porte rien. Les
     verdicts s'affichaient donc quand même, avec vingt-quatre routes « à
     l'infini » et trois contrôles rouges, pour une cause extérieure au site.

     Le signe sûr est ailleurs : CHAQUE écran de ce site porte la barre de
     navigation, donc au moins une ancre. Zéro ancre veut dire que la page
     n'a pas rendu, et c'est mesurable sans rien supposer du contenu.
  */
  if (trouves.ancres === 0) injoignables.push(`${route} — aucune ancre rendue`);

  const m = liens.get(route) ?? new Map();
  for (const { chemin, cout } of trouves.liens) {
    if (!EST_ROUTE.has(chemin) || chemin === route) continue;
    const a = m.get(chemin);
    if (a === undefined || cout < a) m.set(chemin, cout);
  }
  liens.set(route, m);
}
}

await contexte.close();
await nav.close();

/*
   L'APERÇU RÉPONDAIT-IL ENCORE À LA FIN ? S'il est tombé en route, tout ce
   qui précède a été relevé sur le cache du service worker, et le graphe ne
   dit rien du site.
*/
if (!(await apercuRepond())) {
  console.log(
    `\n\x1b[31m✗ REFUS\x1b[0m — l’aperçu ne répond plus sur ${RACINE}.\n` +
      '  Les pages ont continué de se rendre : le service worker les sert depuis son\n' +
      '  cache, et c’est son office. Mais le graphe relevé est alors celui d’un site\n' +
      '  hors ligne, mis en cache à des moments différents — il ne dit rien de la\n' +
      '  carte du site. Ne reconstruisez pas et ne redémarrez pas l’aperçu pendant\n' +
      '  un passage.',
  );
  process.exit(1);
}

if (injoignables.length > 0) {
  console.log(
    `\n\x1b[31m✗ REFUS\x1b[0m — ${injoignables.length} route${injoignables.length > 1 ? 's' : ''} ` +
      `n’${injoignables.length > 1 ? 'ont' : 'a'} pas répondu. Le graphe serait troué, et les\n` +
      '  écrans qu’elles seules atteignent passeraient pour inatteignables. Vérifiez que\n' +
      '  l’aperçu est bien en ligne et qu’il n’a pas été redémarré pendant le passage.',
  );
  for (const r of injoignables.slice(0, 10)) console.log(`      ${r}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */

const entrants = new Map(ROUTES.map((r) => [r, new Set()]));
for (const [source, cibles] of liens) {
  for (const cible of cibles.keys()) entrants.get(cible)?.add(source);
}

// Profondeur : Dijkstra, les liens de la feuille « Plus » coûtant deux.
const profondeur = new Map([['/', 0]]);
let bouge = true;
while (bouge) {
  bouge = false;
  for (const [source, cibles] of liens) {
    const d = profondeur.get(source);
    if (d === undefined) continue;
    for (const [cible, cout] of cibles) {
      const n = d + cout;
      if (!profondeur.has(cible) || profondeur.get(cible) > n) {
        profondeur.set(cible, n);
        bouge = true;
      }
    }
  }
}

const exceptee = (r) => EXCEPTIONS_ORPHELINES.some((e) => e.route === r);
const orphelines = ROUTES.filter((r) => r !== '/' && entrants.get(r).size === 0 && !exceptee(r));
const trop = ROUTES.filter((r) => (profondeur.get(r) ?? 99) > PLAFOND && !exceptee(r)).map(
  (r) => `${r} (${profondeur.get(r) ?? '∞'})`,
);
const quotidiensTrop = QUOTIDIENS.filter((r) => (profondeur.get(r) ?? 99) > 2).map(
  (r) => `${r} (${profondeur.get(r) ?? '∞'})`,
);

console.log('');
verifier('M10a — aucune route sans lien entrant', orphelines, []);
verifier(`M10b — aucune route au-delà de ${PLAFOND} appuis`, trop, []);
verifier('M10c — les écrans du quotidien tiennent en deux appuis', quotidiensTrop, []);

const mesurees = ROUTES.map((r) => profondeur.get(r)).filter((d) => d !== undefined);
console.log(
  `\n  ${ROUTES.length} routes · profondeur max ${Math.max(...mesurees)} · ` +
    `moyenne ${(mesurees.reduce((a, b) => a + b, 0) / mesurees.length).toFixed(2)}`,
);
for (const e of EXCEPTIONS_ORPHELINES) {
  console.log(`  exception ${e.permanente ? 'permanente' : `datée ${e.depuis}`} : ${e.route}`);
}

process.exit(rouges === 0 ? 0 : 1);
