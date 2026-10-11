/**
 * Le banc de mesure du stockage : peser avant d'optimiser.
 *
 * Le prompt « stockage » est explicite — « commencer par mesurer, sans
 * présupposer », et « le plan doit dire si la compression est un gain réel ou
 * marginal pour chaque magasin ». Ce script produit les chiffres de cette
 * décision. Il n'optimise rien et ne modifie aucune donnée réelle.
 *
 * ## Deux mesures, qui ne disent pas la même chose
 *
 *  1. **Hors navigateur** (toujours) : la taille des enregistrements sérialisés,
 *     et ce que gzip en fait, magasin par magasin. C'est la mesure du *modèle de
 *     données*. Elle est reproductible, rapide, et elle **sous-estime** le
 *     stockage réel — IndexedDB ajoute ses propres en-têtes et ses index.
 *
 *  2. **Dans le navigateur** (avec `--navigateur`) : l'occupation rapportée par
 *     `navigator.storage.estimate()` après écriture du jeu dans la vraie base,
 *     et le temps de chargement réel des écrans. C'est la mesure qui compte pour
 *     le budget, et la seule qui dise quelque chose du temps de démarrage.
 *
 * Les deux sont affichées côte à côte, et l'écart entre elles est lui-même une
 * information : c'est le coût de la structure, qu'aucune compression de contenu
 * ne réduira.
 *
 * ## Usage
 *
 *     npm run bench-storage                 mesure du modèle, hors navigateur
 *     npm run bench-storage -- --navigateur ajoute la mesure réelle
 *     npm run bench-storage -- --annees 10  change l'horizon
 *
 * La mesure navigateur demande un site construit et servi sur le port 4321
 * (`npm run build` puis `npx astro preview`), et le mot de passe du site dans
 * l'environnement ou dans `.env.local`.
 */
import { gzipSync } from 'node:zlib';
import { engendrer, HYPOTHESES } from './lib/donnees-synthetiques.mjs';

const args = process.argv.slice(2);
const aOption = (nom) => args.includes(`--${nom}`);
const valeur = (nom, defaut) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : defaut;
};

const ANNEES = valeur('annees', HYPOTHESES.annees);
const GRAINE = valeur('graine', 7);

/* ══════════════════════════════════════════════════════════════════════════
   Mise en forme
   ══════════════════════════════════════════════════════════════════════════ */

const octets = (n) => {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Kio`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mio`;
};

const pourcent = (x) => `${(x * 100).toFixed(0)} %`;

function tableau(entetes, lignes) {
  const largeurs = entetes.map((e, i) =>
    Math.max(e.length, ...lignes.map((l) => String(l[i]).length)),
  );
  const ligne = (cells) =>
    cells.map((c, i) => (i === 0 ? String(c).padEnd(largeurs[i]) : String(c).padStart(largeurs[i]))).join('  ');
  console.log(`  ${ligne(entetes)}`);
  console.log(`  ${largeurs.map((l) => '─'.repeat(l)).join('  ')}`);
  for (const l of lignes) console.log(`  ${ligne(l)}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   1. Mesure du modèle de données
   ══════════════════════════════════════════════════════════════════════════ */

console.log(`\n\x1b[1mBANC DE MESURE DU STOCKAGE\x1b[0m — ${ANNEES} ans d’usage, graine ${GRAINE}\n`);

console.log('HYPOTHÈSES');
tableau(
  ['hypothèse', 'valeur'],
  [
    ['fiches de cours', HYPOTHESES.fiches],
    ['flashcards par fiche', HYPOTHESES.cartesParFiche],
    ['questions de la banque DGFiP', HYPOTHESES.questionsDgfip],
    ['note de séance (signes)', `${HYPOTHESES.noteMin}–${HYPOTHESES.noteMax}`],
    ['restitution à blanc (signes)', `${HYPOTHESES.restitutionMin}–${HYPOTHESES.restitutionMax}`],
    ['révisions par jour étudié', HYPOTHESES.revisionsParJour],
    ['part de jours étudiés', pourcent(HYPOTHESES.partJoursEtudies)],
  ],
);

const depart = Date.now();
const jeu = engendrer({ annees: ANNEES, graine: GRAINE });
const msGeneration = Date.now() - depart;

/** Un magasin pesé : taille sérialisée, taille gzip, et ce que ça donne par enregistrement. */
function peser(nom, enregistrements) {
  // Un objet JSON par ligne : c'est la forme de la charge utile de sauvegarde,
  // et une forme que gzip traite comme il traitera les segments compressés.
  const ndjson = enregistrements.map((e) => JSON.stringify(e)).join('\n');
  const brut = Buffer.byteLength(ndjson, 'utf8');
  const comprime = enregistrements.length ? gzipSync(ndjson, { level: 6 }).length : 0;
  return {
    nom,
    nombre: enregistrements.length,
    brut,
    comprime,
    gain: brut ? 1 - comprime / brut : 0,
    parEnregistrement: enregistrements.length ? brut / enregistrements.length : 0,
  };
}

const magasins = Object.entries(jeu)
  .filter(([nom]) => nom !== 'projection')
  .map(([nom, v]) => peser(nom, v))
  .sort((a, b) => b.brut - a.brut);

const projections = Object.entries(jeu.projection).map(([nom, v]) => peser(nom, v));

console.log('\nMAGASINS EXISTANTS');
tableau(
  ['magasin', 'enreg.', 'sérialisé', 'par enreg.', 'gzip', 'gain'],
  magasins.map((m) => [
    m.nom,
    m.nombre.toLocaleString('fr-FR'),
    octets(m.brut),
    `${Math.round(m.parEnregistrement)} o`,
    octets(m.comprime),
    pourcent(m.gain),
  ]),
);

const totalBrut = magasins.reduce((s, m) => s + m.brut, 0);
const totalComprime = magasins.reduce((s, m) => s + m.comprime, 0);
const totalEnreg = magasins.reduce((s, m) => s + m.nombre, 0);

tableau(
  ['', '', '', '', '', ''],
  [
    [
      'TOTAL',
      totalEnreg.toLocaleString('fr-FR'),
      octets(totalBrut),
      '',
      octets(totalComprime),
      pourcent(1 - totalComprime / totalBrut),
    ],
  ],
);

console.log('\nMAGASINS QUI N’EXISTENT PAS ENCORE');
console.log(
  '  Le modèle actuel ne journalise pas les révisions FSRS : « cartes » ne porte\n' +
    '  que l’état courant. Or l’optimisation personnalisée des paramètres FSRS a\n' +
    '  besoin de l’historique complet des notations. Voici ce qu’il coûterait.\n',
);
tableau(
  ['magasin', 'enreg.', 'sérialisé', 'par enreg.', 'gzip', 'gain'],
  projections.map((m) => [
    m.nom,
    m.nombre.toLocaleString('fr-FR'),
    octets(m.brut),
    `${Math.round(m.parEnregistrement)} o`,
    octets(m.comprime),
    pourcent(m.gain),
  ]),
);

const totalAvecProjection = totalBrut + projections.reduce((s, m) => s + m.brut, 0);

console.log('\nCE QUE LA COMPRESSION RAPPORTE, MAGASIN PAR MAGASIN');
console.log(
  '  Un gain ne vaut d’être pris que s’il porte sur un volume qui compte. La\n' +
    '  colonne « économie » est le nombre d’octets réellement épargnés ; c’est elle\n' +
    '  qui décide, pas le pourcentage.\n',
);
const parEconomie = [...magasins, ...projections]
  .map((m) => ({ ...m, economie: m.brut - m.comprime }))
  .sort((a, b) => b.economie - a.economie);
tableau(
  ['magasin', 'économie', 'gain', 'part de l’économie totale'],
  parEconomie.map((m) => {
    const economieTotale = parEconomie.reduce((s, x) => s + x.economie, 0);
    return [m.nom, octets(m.economie), pourcent(m.gain), pourcent(m.economie / economieTotale)];
  }),
);

console.log('\nSYNTHÈSE HORS NAVIGATEUR');
tableau(
  ['grandeur', 'valeur'],
  [
    ['enregistrements', totalEnreg.toLocaleString('fr-FR')],
    ['sérialisé, magasins existants', octets(totalBrut)],
    ['sérialisé, avec le journal FSRS', octets(totalAvecProjection)],
    ['gzip, magasins existants', octets(totalComprime)],
    ['temps de génération', `${msGeneration} ms`],
  ],
);

/* ══════════════════════════════════════════════════════════════════════════
   2. Mesure réelle dans le navigateur
   ══════════════════════════════════════════════════════════════════════════ */

if (!aOption('navigateur')) {
  console.log(
    '\n\x1b[33mMesure navigateur non exécutée.\x1b[0m Elle seule donne l’occupation réelle\n' +
      'd’IndexedDB et le temps de chargement des écrans :\n\n' +
      '  npm run build && npx astro preview &\n' +
      '  npm run bench-storage -- --navigateur\n',
  );
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const { motDePasseEssais } = await import('./lib/mot-de-passe-essais.mjs');
const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(3000);
  }
};

console.log('\nMESURE DANS LE NAVIGATEUR');

/*
 * La base est créée par l'application elle-même, et non à la main : c'est ce
 * qui garantit que les index mesurés sont les vrais. Les écrire à la main
 * aurait mesuré un schéma inventé pour l'occasion.
 */
await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(1500);

const vide = await page.evaluate(async () => {
  const e = await navigator.storage.estimate();
  return e.usage ?? 0;
});
console.log(`  base vide (contenu du site compris) : ${octets(vide)}`);

/* Écriture par lots : un seul `evaluate` par magasin ferait passer plusieurs
   mégaoctets d'un coup dans le pont, et le pont n'est pas fait pour ça. */
const LOT = 2000;
const depotDepart = Date.now();
for (const [nom, enregistrements] of Object.entries(jeu)) {
  if (nom === 'projection') continue;
  for (let i = 0; i < enregistrements.length; i += LOT) {
    const tranche = enregistrements.slice(i, i + LOT);
    await page.evaluate(
      async ({ nom, tranche }) => {
        const base = await new Promise((ok, ko) => {
          const r = indexedDB.open('revinsp');
          r.onsuccess = () => ok(r.result);
          r.onerror = () => ko(r.error);
        });
        await new Promise((ok, ko) => {
          const tx = base.transaction(nom, 'readwrite');
          const magasin = tx.objectStore(nom);
          for (const enr of tranche) {
            // « etat » est un magasin clé-valeur : la clé est hors de l'objet.
            if (nom === 'etat') magasin.put(enr.valeur, enr.clef);
            else magasin.put(enr);
          }
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
          tx.onabort = () => ko(tx.error);
        });
        base.close();
      },
      { nom, tranche },
    );
  }
}
const msDepot = Date.now() - depotDepart;

const plein = await page.evaluate(async () => {
  const e = await navigator.storage.estimate();
  return e.usage ?? 0;
});

const persistant = await page.evaluate(async () => {
  const dejaAccorde = await navigator.storage.persisted();
  return { dejaAccorde, apresDemande: dejaAccorde || (await navigator.storage.persist()) };
});

console.log(`  base pleine                        : ${octets(plein)}`);
console.log(`  données de Révisions, cinq ans     : ${octets(plein - vide)}`);
/*
 * L'écart peut être négatif, et il l'est : Chromium comprime les valeurs
 * d'IndexedDB sans qu'on lui demande rien. C'est l'information la plus
 * importante de tout ce banc, parce qu'elle change la décision — une couche de
 * compression ajoutée par-dessus ne gagnerait pas ce que la mesure du modèle
 * laissait espérer.
 */
const ecart = plein - vide - totalBrut;
console.log(
  `  écart avec le sérialisé            : ${ecart >= 0 ? '+' : '−'}${octets(Math.abs(ecart))} ` +
    `(${((plein - vide) / totalBrut).toFixed(2)}× le sérialisé)`,
);
console.log(`  temps de dépôt par le pont         : ${(msDepot / 1000).toFixed(1)} s`);
console.log(`  stockage persistant                : ` +
  `${persistant.dejaAccorde ? 'déjà accordé' : persistant.apresDemande ? 'accordé sur demande' : 'refusé'}`);

console.log('\nCOÛT D’UN BALAYAGE COMPLET, MAGASIN PAR MAGASIN');
console.log(
  '  Plusieurs écrans relisent un magasin entier à chaque peinture, parfois\n' +
    '  quatre ou cinq fois de suite. C’est ce coût unitaire qui dira si le modèle\n' +
    '  tient, bien avant que le quota du navigateur soit en jeu.\n',
);

const balayages = await page.evaluate(async (noms) => {
  const base = await new Promise((ok, ko) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  const sortie = [];
  for (const nom of noms) {
    const t0 = performance.now();
    const n = await new Promise((ok, ko) => {
      const q = base.transaction(nom).objectStore(nom).getAll();
      q.onsuccess = () => ok(q.result.length);
      q.onerror = () => ko(q.error);
    });
    sortie.push({ nom, n, ms: Math.round(performance.now() - t0) });
  }
  base.close();
  return sortie;
}, magasins.filter((m) => m.nom !== 'etat').map((m) => m.nom));

tableau(
  ['magasin', 'enreg.', 'un balayage'],
  [...balayages]
    .sort((a, b) => b.ms - a.ms)
    .map((b) => [b.nom, b.n.toLocaleString('fr-FR'), `${b.ms} ms`]),
);

console.log('\nTEMPS DE CHARGEMENT DES ÉCRANS, BASE PLEINE');

/**
 * Charge un écran et attend son premier contenu, en mesurant le délai.
 *
 * Les sélecteurs sont attendus **en concurrence**, et non réunis par une
 * virgule. La première version les réunissait, et `waitForSelector` ne regarde
 * alors que la première correspondance dans l'ordre du document : elle attendait
 * la bannière « planification indisponible », qui reste masquée pour un parcours
 * qui a ses thèmes, et concluait que l'écran n'était jamais prêt. L'écran
 * s'affichait en moins de cinq secondes. Une mesure qui se trompe de cette
 * façon-là est pire que pas de mesure : elle accuse le code à tort.
 */
async function mesurerEcran(chemin, selecteurs) {
  const PLAFOND = 120000;
  const t0 = Date.now();
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'domcontentloaded' });
  await connecter();
  try {
    await Promise.any(
      selecteurs.map((s) => page.waitForSelector(s, { state: 'visible', timeout: PLAFOND })),
    );
  } catch {
    return { chemin, ms: null, plafond: PLAFOND };
  }
  return { chemin, ms: Date.now() - t0 };
}

/*
 * Le sélecteur d'attente est le point délicat de cette mesure. Attendre « main »
 * rend des durées flatteuses et fausses : le gabarit est là avant que la moindre
 * donnée soit lue. Chaque écran attend donc l'élément que son code **révèle**
 * après avoir fini de lire la base — c'est le moment où la personne voit
 * quelque chose.
 */
const ecrans = [
  ['/', ['#tableau']],
  ['/statistiques/', ['#stats']],
  ['/planification/', ['#planification', '#sans-referentiel']],
  ['/flashcards/', ['#accueil-session', '#rien-a-faire']],
  ['/journal/', ['#journal']],
];

const mesures = [];
for (const [chemin, selecteurs] of ecrans) {
  mesures.push(await mesurerEcran(chemin, selecteurs));
}

tableau(
  ['écran', 'prêt en'],
  mesures.map((m) => [
    m.chemin,
    m.ms === null ? `non atteint en ${m.plafond / 1000} s` : `${(m.ms / 1000).toFixed(2)} s`,
  ]),
);

console.log(
  '\n  Ces durées comprennent le déverrouillage de la session et le déchiffrement\n' +
    '  du manifeste : ce n’est pas le coût d’IndexedDB seul, c’est le temps que la\n' +
    '  personne attend. C’est bien celui-là qui doit tenir un budget.\n',
);

await nav.close();
