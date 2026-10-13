/**
 * L'instantané pris avant migration, et le retour arrière.
 *
 * Deux propriétés, et la seconde est celle qui compte vraiment :
 *
 *  1. une migration en attente laisse un instantané de la base **d'avant** ;
 *  2. revenir à cet instantané rend la base exactement comme elle était —
 *     version, magasins, enregistrements, y compris les clés hors-ligne du
 *     magasin « etat », qui sont celles qu'un export naïf perd.
 *
 * Le troisième essai est celui du piège : une base **neuve** ne doit pas
 * produire d'instantané, et surtout ne doit pas se faire migrer « de 1 vers 12 »
 * — ce qui sauterait le premier bloc de migration et la moitié des magasins.
 *
 * ⚠ La liste des magasins attendus est écrite **à la main**, et c'est
 * délibéré : une liste dérivée du schéma ne détecterait pas un magasin
 * disparu, puisqu'elle disparaîtrait avec lui. Le prix est qu'il faut
 * l'allonger à chaque migration — et qu'il faut donc relancer cet essai
 * après chaque changement de schéma, ce qui n'a pas été fait entre les
 * versions 21 et 23.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const VERSION = Number(
  /const VERSION = (\d+)/.exec(readFileSync('src/lib/db.ts', 'utf8'))?.[1] ?? '0',
);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext()).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 400)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 400)}`);
  }
};

const CARTE = {
  id: 'carte-temoin',
  ficheId: 'fiche-a',
  matiere: 'Économie',
  du: '2026-02-01',
  derniereRevision: '2026-01-11T07:30:00.000Z',
  intervalle: 21,
  revisions: 7,
  oublis: 1,
  fsrs: {
    due: '2026-02-01',
    stability: 12.5,
    difficulty: 5.2,
    elapsed_days: 9,
    scheduled_days: 21,
    learning_steps: 0,
    reps: 7,
    lapses: 1,
    state: 2,
    last_review: '2026-01-11T07:30:00.000Z',
  },
};
/* Le profil vit dans « etat », un magasin **sans keyPath** : sa clé est
   hors-ligne. C'est exactement ce qu'un instantané écrit à la légère perd. */
const PROFIL = { xp: 4210, niveau: 7, serie: 12, serieRecord: 19 };

const creerV11 = async (page, carte, profil) =>
  page.evaluate(
    async ([carte, profil]) => {
      await new Promise((ok) => {
        const r = indexedDB.deleteDatabase('revinsp');
        r.onsuccess = r.onerror = r.onblocked = () => ok();
      });
      await new Promise((ok) => {
        const r = indexedDB.deleteDatabase('revinsp-instantanes');
        r.onsuccess = r.onerror = r.onblocked = () => ok();
      });
      const base = await new Promise((ok, ko) => {
        const r = indexedDB.open('revinsp', 11);
        r.onupgradeneeded = () => {
          const b = r.result;
          b.createObjectStore('etat');
          const c = b.createObjectStore('cartes', { keyPath: 'id' });
          c.createIndex('du', 'du');
          c.createIndex('matiere', 'matiere');
          b.createObjectStore('fiches', { keyPath: 'id' });
          b.createObjectStore('quiz', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
          b.createObjectStore('jours', { keyPath: 'jour' });
          b.createObjectStore('nback', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
          const s = b.createObjectStore('seances', { keyPath: 'id', autoIncrement: true });
          s.createIndex('jour', 'jour');
          s.createIndex('theme', 'theme');
          b.createObjectStore('qcmDgfip', { keyPath: 'id' }).createIndex('rubriqueId', 'rubriqueId');
          b.createObjectStore('qcmSessions', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
          b.createObjectStore('relationnel', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
          b.createObjectStore('vmSeuils', { keyPath: 'id' }).createIndex('famille', 'famille');
          b.createObjectStore('vmSessions', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
          b.createObjectStore('journal', { keyPath: 'id' }).createIndex('matiere', 'matiere');
          b.createObjectStore('competences', { keyPath: 'clef' }).createIndex('matiere', 'matiere');
          b.createObjectStore('difficultes', { keyPath: 'id' });
          const a = b.createObjectStore('aides', { keyPath: 'id', autoIncrement: true });
          a.createIndex('le', 'le');
          a.createIndex('itemId', 'itemId');
          b.createObjectStore('notes', { keyPath: 'seanceId' });
        };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
      await new Promise((ok, ko) => {
        const tx = base.transaction(['cartes', 'etat', 'seances'], 'readwrite');
        tx.objectStore('cartes').put(carte);
        tx.objectStore('etat').put(profil, 'profil');
        tx.objectStore('seances').put({
          id: 1,
          theme: 'economie',
          jour: '2026-01-10',
          statut: 'terminee',
          secondes: 3600,
          etendue: false,
        });
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      const sortie = { version: base.version, magasins: [...base.objectStoreNames].length };
      base.close();
      return sortie;
    },
    [carte, profil],
  );

const lire = (page) =>
  page.evaluate(async () => {
    const ouvrir = (nom) =>
      new Promise((ok, ko) => {
        const r = indexedDB.open(nom);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
    const base = await ouvrir('revinsp');
    const tout = (nom) =>
      new Promise((ok) => {
        const q = base.transaction(nom).objectStore(nom).getAll();
        q.onsuccess = () => ok(q.result);
      });
    const clef = (nom, c) =>
      new Promise((ok) => {
        const q = base.transaction(nom).objectStore(nom).get(c);
        q.onsuccess = () => ok(q.result);
      });
    const sortie = {
      version: base.version,
      magasins: [...base.objectStoreNames].sort(),
      cartes: await tout('cartes'),
      profil: await clef('etat', 'profil'),
      seances: await tout('seances'),
      revisions: base.objectStoreNames.contains('revisions') ? await tout('revisions') : null,
    };
    base.close();

    const inst = await ouvrir('revinsp-instantanes');
    sortie.instantanes = inst.objectStoreNames.contains('instantanes')
      ? await new Promise((ok) => {
          const q = inst.transaction('instantanes').objectStore('instantanes').getAll();
          q.onsuccess = () => ok(q.result);
        })
      : [];
    inst.close();
    return sortie;
  });

const ouvrirApplication = async () => {
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(3500);
  }
  await page.waitForTimeout(1500);
};

/* ── 1. Une migration en attente laisse un instantané ────────────────────── */

console.log('\nUNE MIGRATION EN ATTENTE LAISSE UN INSTANTANÉ');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
const depart = await creerV11(page, CARTE, PROFIL);
v('base de départ en version 11', depart.version, 11);

await ouvrirApplication();
const apres = await lire(page);

v(`la base est migrée en version ${VERSION}`, apres.version, VERSION);
v('un instantané exactement', apres.instantanes.length, 1);
v('pris depuis la version 11', apres.instantanes[0]?.deVersion, 11);
v(`vers la version ${VERSION}`, apres.instantanes[0]?.versVersion, VERSION);
v(
  'il contient la carte telle qu’elle était',
  apres.instantanes[0]?.magasins?.cartes?.[0]?.valeur,
  CARTE,
);
v(
  'et le profil AVEC sa clé hors-ligne',
  apres.instantanes[0]?.magasins?.etat?.[0],
  { clef: 'profil', valeur: PROFIL },
);
v(
  'il ne contient pas les magasins de la nouvelle version',
  Object.keys(apres.instantanes[0]?.magasins ?? {}).includes('revisions'),
  false,
);
v('et il est pesé', typeof apres.instantanes[0]?.octets, 'number');

/* ── 2. Le retour arrière rend la base d'avant ───────────────────────────── */

console.log('\nLE RETOUR ARRIÈRE REND LA BASE D’AVANT');

// Il s'exerce par l'écran, d'où l'utilisateur le déclenchera : un chemin
// d'essai qui contournerait la page ne prouverait rien du bouton.
await page.goto(`${RACINE}/stockage/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#migration:not(.hidden)', { timeout: 20000 });
const detail = await page.textContent('#migration-detail');
v('la section « Dernière migration » nomme la version d’avant', detail.includes('11'), true);

page.once('dialog', (d) => d.accept());
await page.click('#revenir-migration');
await page.waitForSelector('#message-migration:not(.hidden)', { timeout: 30000 });
const message = await page.textContent('#message-migration');
v('le message annonce le retour', message.includes('revenue'), true);

const defait = await lire(page);
v('la base est de nouveau en version 11', defait.version, 11);
v(
  'les magasins de la nouvelle version ont disparu',
  defait.magasins.includes('revisions') || defait.magasins.includes('operations'),
  false,
);
v('la carte est exactement celle d’avant', defait.cartes, [CARTE]);
v('le profil aussi, clé hors-ligne comprise', defait.profil, PROFIL);
v('et la séance', defait.seances.length, 1);
v('l’instantané reste disponible', defait.instantanes.length, 1);

// Et la migration se rejoue : c'est ce qui fait du retour arrière un recours et
// non une sortie sans issue.
await ouvrirApplication();
const remigre = await lire(page);
v(`l’application remigre en version ${VERSION}`, remigre.version, VERSION);
v('un socle est de nouveau posé', remigre.revisions?.length, 1);
v('et il ne reste que les instantanés gardés', remigre.instantanes.length <= 2, true);

console.log('\nUNE BASE NEUVE NE PRODUIT PAS D’INSTANTANÉ');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
await page.evaluate(async () => {
  for (const nom of ['revinsp', 'revinsp-instantanes']) {
    await new Promise((ok) => {
      const r = indexedDB.deleteDatabase(nom);
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    });
  }
});
await ouvrirApplication();
const neuve = await lire(page);

v(`une base neuve naît directement en version ${VERSION}`, neuve.version, VERSION);
v('aucun instantané', neuve.instantanes.length, 0);
v(
  'et tous les magasins sont là : le premier bloc de migration n’a pas sauté',
  neuve.magasins,
  [
    'aides', 'cartes', 'competences', 'difficultes', 'etat', 'fiches', 'journal',
    'jours', 'nback', 'notes', 'operations', 'qcmDgfip', 'qcmSessions', 'quiz',
    'relationnel', 'revisions', 'seances', 'vmSeuils', 'vmSessions',
    // Odyssée, depuis la version 15.
    'odysseeTaches', 'odysseeQuetes', 'odysseeEvenements', 'odysseeFocus', 'odysseeRevues',
    // Sport, depuis la version 16, et ses programmes depuis la 17.
    'sportExercices', 'sportSeances', 'sportPhases', 'sportBlessures', 'sportProgrammes',
    // Le domaine Corps d'Odyssée, depuis la version 18.
    'odysseePesees', 'odysseeMesures', 'odysseeNuits', 'odysseeRepas', 'odysseeBoissons',
    'odysseeSante', 'odysseeTrajectoires',
    // Scellés depuis la décision 3.
    'odysseeMedicaments', 'odysseeHormonal',
    // Psyché, scellée, depuis la version 21.
    'odysseeCheckins', 'odysseeHebdos', 'odysseeJournal',
    // Finances, scellées, depuis la version 22.
    'odysseeComptes', 'odysseeValorisations', 'odysseeOperations', 'odysseeLignesBudget',
    // Les rapprochements, depuis la phase 3 de Finances.
    'odysseeRapprochements',
    // Et « Qui lit mon budget », depuis la phase 4.
    'odysseeConsommateurs',
    // Le pointage par type de vendeur, depuis la phase 3 bis.
    'odysseeVendeurs', 'odysseeReglesPointage', 'odysseePointages', 'odysseeTaxonomie',
    /*
       La veille, depuis la version 23. Le journal d'usage n'est pas scellé —
       un magasin scellé ne s'écrit que coffre ouvert, donc rarement, et le
       journal n'enregistrerait qu'un échantillon biaisé. Voir
       `SENSIBLES_EN_CLAIR` dans `noyau/coffre.ts`.
    */
    'odysseeUsage', 'odysseeVeilleBases',
    // Le cycle de vie des repères, depuis la version 24. Scellés tous les deux.
    'odysseeVeilleSignaux', 'odysseeVeilleReglages',
    // Les échelles, depuis la version 25. Scellées.
    'odysseePassations',
  ].sort(),
);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m' : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
await nav.close();
process.exit(echecs === 0 ? 0 : 1);
