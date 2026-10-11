/**
 * La migration qui installe les deux journaux, et le socle des cartes.
 *
 * Elle est **additive** : aucune donnée existante n'est réécrite. C'est
 * précisément ce que cet essai doit prouver, et ce n'est pas un détail de
 * confort — une migration qui abîmerait l'état FSRS de cartes révisées depuis
 * des mois ferait perdre des échéances que rien ne reconstitue, puisque le
 * journal qui le permettrait est justement ce qu'on installe.
 *
 * L'essai fabrique une base version 11 avec des cartes de toutes les formes
 * qu'on rencontre — carte neuve jamais revue, carte longuement révisée, carte
 * sans `last_review` —, laisse l'application migrer, puis vérifie que les
 * cartes sont au signe près ce qu'elles étaient, qu'il existe exactement un
 * socle par carte, et que ce socle porte l'état et les compteurs.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

/* La version attendue est lue dans la source : la coder en dur ici condamne
   l'essai à échouer à la migration suivante, pour une raison qui n'a rien à
   voir avec ce qu'il vérifie. */
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
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
};

const fsrs = (p) => ({
  due: '2026-02-01',
  stability: 12.5,
  difficulty: 5.2,
  elapsed_days: 9,
  scheduled_days: 21,
  learning_steps: 0,
  reps: 7,
  lapses: 1,
  state: 2,
  ...p,
});

const CARTES = [
  // Longuement révisée : celle dont la perte coûterait des mois.
  {
    id: 'carte-ancienne',
    ficheId: 'fiche-a',
    matiere: 'Économie',
    du: '2026-02-01',
    derniereRevision: '2026-01-11T07:30:00.000Z',
    intervalle: 21,
    revisions: 7,
    oublis: 1,
    fsrs: fsrs({ last_review: '2026-01-11T07:30:00.000Z' }),
  },
  // Jamais revue : état neuf, aucun `last_review`.
  {
    id: 'carte-neuve',
    ficheId: 'fiche-b',
    matiere: 'Droit public',
    du: '2026-01-11',
    derniereRevision: null,
    intervalle: 0,
    revisions: 0,
    oublis: 0,
    fsrs: fsrs({
      due: '2026-01-11',
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 0,
    }),
  },
  // Révisée mais sans `last_review` dans l'état FSRS : forme qu'une version
  // ancienne a pu écrire. Le socle doit tout de même porter une date.
  {
    id: 'carte-sans-derniere',
    ficheId: 'fiche-c',
    matiere: 'Questions sociales',
    du: '2026-03-15',
    derniereRevision: '2026-01-02T20:00:00.000Z',
    intervalle: 72,
    revisions: 3,
    oublis: 0,
    fsrs: fsrs({ due: '2026-03-15', scheduled_days: 72, reps: 3, lapses: 0 }),
  },
];

console.log('\nFABRICATION D’UNE BASE VERSION 11');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
const avant = await page.evaluate(async (cartes) => {
  await new Promise((ok) => {
    const r = indexedDB.deleteDatabase('revinsp');
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
    const tx = base.transaction('cartes', 'readwrite');
    for (const c of cartes) tx.objectStore('cartes').put(c);
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  const sortie = { version: base.version, magasins: [...base.objectStoreNames] };
  base.close();
  return sortie;
}, CARTES);

v('la base de départ est en version 11', avant.version, 11);
v('et n’a ni « revisions » ni « operations »', [
  avant.magasins.includes('revisions'),
  avant.magasins.includes('operations'),
], [false, false]);

console.log('\nL’APPLICATION MIGRE');

await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
  await page.waitForTimeout(3500);
}
await page.waitForTimeout(1500);

const apres = await page.evaluate(async () => {
  const base = await new Promise((ok, ko) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
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
    magasins: [...base.objectStoreNames],
    cartes: await tout('cartes'),
    revisions: await tout('revisions'),
    operations: await tout('operations'),
    appareil: await clef('etat', 'appareil'),
  };
  base.close();
  return sortie;
});

v(`la base est passée en version ${VERSION}`, apres.version, VERSION);
v('les deux magasins existent', [
  apres.magasins.includes('revisions'),
  apres.magasins.includes('operations'),
], [true, true]);

console.log('\nAUCUNE CARTE RÉÉCRITE');

v('les trois cartes sont là', apres.cartes.length, 3);
const parId = new Map(apres.cartes.map((c) => [c.id, c]));
for (const attendue of CARTES) {
  v(`« ${attendue.id} » est inchangée, au signe près`, parId.get(attendue.id), attendue);
}

console.log('\nUN SOCLE PAR CARTE, QUI PORTE L’ÉTAT');

v('trois socles', apres.revisions.length, 3);
v(
  'tous marqués comme socle, aucune notation inventée',
  apres.revisions.every((r) => r.genre === 'socle'),
  true,
);
const socles = new Map(apres.revisions.map((r) => [r.carteId, r]));
v('un socle par carte, sans doublon', [...socles.keys()].sort(), [
  'carte-ancienne',
  'carte-neuve',
  'carte-sans-derniere',
]);
v(
  'le socle porte l’état FSRS tel quel',
  socles.get('carte-ancienne')?.etat,
  CARTES[0].fsrs,
);
v('et les compteurs du site', [
  socles.get('carte-ancienne')?.revisions,
  socles.get('carte-ancienne')?.oublis,
], [7, 1]);
v(
  'la fiche et la matière sont reprises',
  [socles.get('carte-neuve')?.ficheId, socles.get('carte-neuve')?.matiere],
  ['fiche-b', 'Droit public'],
);
v(
  'une carte sans « last_review » reçoit tout de même une date',
  socles.get('carte-sans-derniere')?.le,
  '2026-01-02T20:00:00.000Z',
);
v(
  'une carte jamais revue prend l’échéance pour date, faute de mieux',
  socles.get('carte-neuve')?.le,
  '2026-01-11',
);

console.log('\nLES IDENTIFIANTS SONT DES ULID ORDONNÉS');

const ids = apres.revisions.map((r) => r.id);
v(
  'tous au format ULID',
  ids.every((i) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(i)),
  true,
);
v('tous distincts', new Set(ids).size, ids.length);
/* Pas d'essai « ordonnés » ici : « getAll » rend déjà les enregistrements dans
   l'ordre des clés, donc comparer la liste à sa version triée serait vrai quel
   que soit le code. La monotonie de la fabrique est éprouvée là où elle est
   observable, dans « essais:synchronisation » — 5 000 identifiants tirés dans
   une milliseconde figée. Ce qui reste vérifiable ici, c'est qu'ils viennent
   d'une seule migration : même préfixe de temps. */
v(
  'le même instant, ou presque : ils viennent d’une seule migration',
  new Set(ids.map((i) => i.slice(0, 8))).size,
  1,
);
v(
  'et cet instant est celui de la migration, non une date inventée',
  ids.every((i) => {
    const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let ms = 0;
    for (const signe of i.slice(0, 10)) ms = ms * 32 + A.indexOf(signe);
    return Math.abs(Date.now() - ms) < 10 * 60 * 1000;
  }),
  true,
);

console.log('\nL’APPAREIL EST IDENTIFIÉ, ET UNE SEULE FOIS');

v('un identifiant d’appareil est posé', typeof apres.appareil, 'string');
v('de huit signes, sans lettre ambiguë', /^[0-9A-HJKMNP-TV-Z]{8}$/.test(apres.appareil ?? ''), true);
v('tous les socles le portent', new Set(apres.revisions.map((r) => r.appareil)).size, 1);
v(
  'et c’est bien celui de la base',
  apres.revisions[0]?.appareil,
  apres.appareil,
);

console.log('\nLE JOURNAL D’OPÉRATIONS EST VIDE, ET C’EST VOULU');

v(
  'aucune opération fabriquée par la migration',
  apres.operations.length,
  0,
);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m' : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
await nav.close();
process.exit(echecs === 0 ? 0 : 1);
