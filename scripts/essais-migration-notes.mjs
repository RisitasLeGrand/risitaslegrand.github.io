/**
 * La migration qui sort les notes de séance de leur enregistrement.
 *
 * C'est la migration la plus risquée du projet jusqu'ici, parce qu'elle touche
 * à la **seule donnée irremplaçable** du site : du texte écrit à la main. Les
 * fiches de cours se reconstruisent depuis le dépôt, la progression FSRS se
 * refait en révisant. Une note de séance perdue est perdue.
 *
 * L'essai fabrique donc une base version 10 avec des séances de toutes les
 * formes qu'on peut rencontrer — note pleine, note vide, restitutions seules,
 * rien du tout — puis laisse l'application migrer, et vérifie au signe près.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const VERSION = Number(
  /const VERSION = (\d+)/.exec(readFileSync('src/lib/db.ts', 'utf8'))?.[1] ?? '0',
);

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext()).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};

/** Les quatre formes qu'une séance version 10 pouvait avoir. */
const NOTE_LONGUE = 'Une note de séance de plusieurs paragraphes.\n\nAvec un second paragraphe.';
const SEANCES = [
  {
    id: 1,
    theme: 'droit-public',
    jour: '2026-01-05',
    statut: 'terminee',
    termineeLe: '2026-01-05T18:00:00.000Z',
    secondes: 3600,
    note: NOTE_LONGUE,
    restitutions: { '0': 'Ce dont je me souvenais.' },
    fiches: ['fiche-a'],
    etendue: false,
  },
  // Note vide, restitutions vides : rien à déplacer.
  {
    id: 2,
    theme: 'economie',
    jour: '2026-01-06',
    statut: 'prevue',
    secondes: 0,
    note: '',
    restitutions: {},
    fiches: [],
    etendue: false,
  },
  // Restitution seule, sans note : il y a quelque chose à sauver.
  {
    id: 3,
    theme: 'finances-publiques',
    jour: '2026-01-07',
    statut: 'terminee',
    termineeLe: '2026-01-07T18:00:00.000Z',
    secondes: 1800,
    note: '   ',
    restitutions: { '1': 'Je me rappelle surtout de la hiérarchie des normes.' },
    fiches: [],
    etendue: false,
  },
  // Aucun champ de texte du tout : une séance écrite par une version encore
  // plus ancienne, ou tronquée. La migration ne doit pas lever.
  {
    id: 4,
    theme: 'questions-sociales',
    jour: '2026-01-08',
    statut: 'prevue',
    secondes: 0,
    etendue: false,
  },
];

console.log('\nFABRICATION D’UNE BASE VERSION 10');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
const avant = await page.evaluate(async (seances) => {
  await new Promise((ok) => {
    const r = indexedDB.deleteDatabase('revinsp');
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  });
  const base = await new Promise((ok, ko) => {
    const r = indexedDB.open('revinsp', 10);
    r.onupgradeneeded = () => {
      const b = r.result;
      b.createObjectStore('etat');
      const cartes = b.createObjectStore('cartes', { keyPath: 'id' });
      cartes.createIndex('du', 'du');
      cartes.createIndex('matiere', 'matiere');
      b.createObjectStore('fiches', { keyPath: 'id' });
      b.createObjectStore('quiz', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
      b.createObjectStore('jours', { keyPath: 'jour' });
      b.createObjectStore('nback', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
      const seancesStore = b.createObjectStore('seances', { keyPath: 'id', autoIncrement: true });
      seancesStore.createIndex('jour', 'jour');
      seancesStore.createIndex('theme', 'theme');
      b.createObjectStore('qcmDgfip', { keyPath: 'id' }).createIndex('rubriqueId', 'rubriqueId');
      b.createObjectStore('qcmSessions', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
      b.createObjectStore('relationnel', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
      b.createObjectStore('vmSeuils', { keyPath: 'id' }).createIndex('famille', 'famille');
      b.createObjectStore('vmSessions', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
      b.createObjectStore('journal', { keyPath: 'id' }).createIndex('matiere', 'matiere');
      b.createObjectStore('competences', { keyPath: 'clef' }).createIndex('matiere', 'matiere');
      b.createObjectStore('difficultes', { keyPath: 'id' });
      const aides = b.createObjectStore('aides', { keyPath: 'id', autoIncrement: true });
      aides.createIndex('le', 'le');
      aides.createIndex('itemId', 'itemId');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  await new Promise((ok, ko) => {
    const tx = base.transaction('seances', 'readwrite');
    for (const s of seances) tx.objectStore('seances').put(s);
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  const version = base.version;
  const magasins = [...base.objectStoreNames];
  base.close();
  return { version, magasins };
}, SEANCES);

v('la base de départ est en version 10', avant.version, 10);
v('et n’a pas de magasin « notes »', avant.magasins.includes('notes'), false);

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
  const sortie = {
    version: base.version,
    aNotes: [...base.objectStoreNames].includes('notes'),
    seances: await tout('seances'),
    notes: await tout('notes'),
  };
  base.close();
  return sortie;
});

/* La version attendue est lue dans la source. Elle était codée en dur, et la
   migration suivante a fait échouer cet essai pour une raison qui n'avait rien
   à voir avec ce qu'il vérifie — le texte des séances. */
v(`la base est passée en version ${VERSION}`, apres.version, VERSION);
v('le magasin « notes » existe', apres.aNotes, true);

console.log('\nAUCUNE SÉANCE PERDUE, AUCUN CHAMP DE PILOTAGE ABÎMÉ');

v('les quatre séances sont là', apres.seances.length, 4);
/* Les séances sont indexées par leur **jour** et non par leur identifiant : la
   migration 13 a remplacé les clés numériques par des ULID, et un essai qui
   cherche « la séance 1 » ne trouve plus rien. Le jour est ce que cet essai
   connaît vraiment de ses séances. */
const parId = new Map(apres.seances.map((s) => [s.jour, s]));
v('le thème est intact', parId.get('2026-01-05')?.theme, 'droit-public');
v('le jour est intact', parId.get('2026-01-05')?.jour, '2026-01-05');
v('le statut est intact', parId.get('2026-01-05')?.statut, 'terminee');
v('la durée est intacte', parId.get('2026-01-05')?.secondes, 3600);
v('les fiches couvertes sont intactes', parId.get('2026-01-05')?.fiches, ['fiche-a']);
v('la date de clôture est intacte', parId.get('2026-01-05')?.termineeLe, '2026-01-05T18:00:00.000Z');

console.log('\nLE TEXTE N’EST PLUS DANS LA SÉANCE');

v('plus de champ « note »', 'note' in (parId.get('2026-01-05') ?? {}), false);
v('plus de champ « restitutions »', 'restitutions' in (parId.get('2026-01-05') ?? {}), false);

console.log('\nLE TEXTE EST DANS « NOTES », AU SIGNE PRÈS');

/* Les notes sont retrouvées par le jour de leur séance, pour la même raison que
   les séances : leurs clés sont des ULID depuis la migration 13. */
const jourDeLaNote = new Map(apres.seances.map((s) => [s.id, s.jour]));
const notes = new Map(apres.notes.map((n) => [jourDeLaNote.get(n.seanceId), n]));
v('deux séances seulement ont du texte', apres.notes.length, 2);
v('la note longue est intacte', notes.get('2026-01-05')?.note, NOTE_LONGUE);
v('sa restitution est intacte', Object.values(notes.get('2026-01-05')?.restitutions ?? {}), [
  'Ce dont je me souvenais.',
]);
v('la séance vide n’a pas de ligne', notes.has('2026-01-06'), false);
v('la séance sans champ de texte non plus', notes.has('2026-01-08'), false);
v(
  'la restitution seule a été sauvée',
  Object.values(notes.get('2026-01-07')?.restitutions ?? {}),
  ['Je me rappelle surtout de la hiérarchie des normes.'],
);
v('chaque note porte une date de modification', apres.notes.every((n) => Boolean(n.majLe)), true);

console.log('\nLA MIGRATION EST IDEMPOTENTE');

/*
 * Rouvrir la base ne doit rien refaire : une migration qui rejouerait
 * écraserait les notes déplacées par des champs désormais absents, c'est-à-dire
 * par du vide.
 */
await page.reload({ waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(1500);
const encore = await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const notes = await new Promise((ok) => {
    const q = base.transaction('notes').objectStore('notes').getAll();
    q.onsuccess = () => ok(q.result);
  });
  base.close();
  return notes;
});
v('les notes sont toujours deux', encore.length, 2);
v(
  'et la longue est toujours intacte',
  encore.some((n) => n.note === NOTE_LONGUE),
  true,
);

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
