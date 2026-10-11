/**
 * La migration des clés auto-incrémentées vers des identifiants stables.
 *
 * C'est la migration destructrice de la phase 1 : elle réécrit sept magasins et
 * les clés d'un huitième. Et le huitième est « notes », qui porte **la seule
 * donnée irremplaçable du site** — du texte écrit à la main. Les fiches se
 * reconstruisent depuis le dépôt, la progression FSRS se refait en révisant ;
 * une note de séance perdue est perdue.
 *
 * D'où la forme de cet essai : il ne vérifie pas que « ça marche », il vérifie
 * au signe près que rien n'a bougé d'autre que les clés. Avec les cas tordus
 * qu'une base réelle contient — une restitution qui renvoie à une séance
 * supprimée, une note orpheline, une date illisible.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const VERSION = Number(
  /const VERSION = (\d+)/.exec(readFileSync('src/lib/db.ts', 'utf8'))?.[1] ?? '0',
);
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 500)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 500)}`);
  }
};

const NOTE_1 = 'Première note de séance.\n\nDeux paragraphes, des accents : hiérarchie des normes.';
const NOTE_3 = 'Troisième note, plus courte.';

/* Trois séances, dont une **supprimée** : la séance 2 n'existe pas, mais la
   restitution de la séance 3 y renvoie. C'est le cas qui fait perdre du texte
   quand on remappe à la légère. */
const SEANCES = [
  { id: 1, theme: 'economie', jour: '2026-01-05', statut: 'terminee',
    termineeLe: '2026-01-05T18:00:00.000Z', secondes: 3600, fiches: ['f-a'], etendue: false },
  { id: 3, theme: 'economie', jour: '2026-01-12', statut: 'terminee',
    termineeLe: '2026-01-12T19:30:00.000Z', secondes: 2700, fiches: ['f-b'], etendue: false },
  { id: 4, theme: 'droit-public', jour: '2026-01-13', statut: 'prevue', secondes: 0, etendue: false },
  // Date de clôture illisible : la migration ne doit pas lever, et le contenu
  // doit être conservé.
  { id: 5, theme: 'economie', jour: 'pas-une-date', statut: 'terminee',
    termineeLe: 'n’importe quoi', secondes: 60, etendue: false },
];
const NOTES = [
  { seanceId: 1, note: NOTE_1, restitutions: {}, majLe: '2026-01-05T18:05:00.000Z' },
  // Renvoie à la séance 1 (qui existe) ET à la séance 2 (supprimée).
  { seanceId: 3, note: NOTE_3, restitutions: { 1: 'Ce dont je me souvenais de la 1.', 2: 'Et de la 2, disparue.' },
    majLe: '2026-01-12T19:40:00.000Z' },
  // Note orpheline : sa séance n'existe pas. Le texte doit survivre.
  { seanceId: 99, note: 'Note orpheline, dont la séance a disparu.', restitutions: {}, majLe: '2026-01-01T08:00:00.000Z' },
];
const QUIZ = [
  { id: 1, ficheId: 'f-a', matiere: 'Économie', le: '2026-01-05T17:00:00.000Z', bonnes: 8, total: 10 },
  { id: 2, ficheId: 'f-b', matiere: 'Économie', le: '2026-01-12T17:00:00.000Z', bonnes: 6, total: 10 },
];
const AIDES = [
  { id: 1, le: '2026-01-05T17:30:00.000Z', provenance: '/fiche/f-a', itemId: 'q-1', intention: 'expliquer' },
];

console.log(`\nFABRICATION D’UNE BASE VERSION ${VERSION - 1}`);

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
const depart = await page.evaluate(
  async ([seances, notes, quiz, aides, version]) => {
    for (const nom of ['revinsp', 'revinsp-instantanes']) {
      await new Promise((ok) => {
        const r = indexedDB.deleteDatabase(nom);
        r.onsuccess = r.onerror = r.onblocked = () => ok();
      });
    }
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp', version);
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
        const rev = b.createObjectStore('revisions', { keyPath: 'id' });
        rev.createIndex('carteId', 'carteId');
        rev.createIndex('le', 'le');
        const ops = b.createObjectStore('operations', { keyPath: 'id' });
        ops.createIndex('hlc', 'hlc');
        ops.createIndex('cible', 'cible');
        ops.createIndex('lot', 'lot');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    await new Promise((ok, ko) => {
      const tx = base.transaction(['seances', 'notes', 'quiz', 'aides', 'etat'], 'readwrite');
      for (const s of seances) tx.objectStore('seances').put(s);
      for (const n of notes) tx.objectStore('notes').put(n);
      for (const q of quiz) tx.objectStore('quiz').put(q);
      for (const a of aides) tx.objectStore('aides').put(a);
      tx.objectStore('etat').put('TEMOIN00', 'appareil');
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    const sortie = { version: base.version };
    base.close();
    return sortie;
  },
  [SEANCES, NOTES, QUIZ, AIDES, VERSION - 1],
);
v(`base de départ en version ${VERSION - 1}`, depart.version, VERSION - 1);

console.log('\nL’APPLICATION MIGRE');

await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
  await page.waitForTimeout(3500);
}
await page.waitForTimeout(2000);

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
  const parIndex = (nom, index) =>
    new Promise((ok) => {
      const q = base.transaction(nom).objectStore(nom).index(index).getAll();
      q.onsuccess = () => ok(q.result.length);
    });
  const sortie = {
    version: base.version,
    seances: await tout('seances'),
    notes: await tout('notes'),
    quiz: await tout('quiz'),
    aides: await tout('aides'),
    // Les index doivent avoir survécu à la recréation des magasins.
    indexJour: await parIndex('seances', 'jour'),
    indexTheme: await parIndex('seances', 'theme'),
    indexLeQuiz: await parIndex('quiz', 'le'),
    indexItemAides: await parIndex('aides', 'itemId'),
  };
  base.close();
  return sortie;
});

v(`la base est en version ${VERSION}`, apres.version, VERSION);

console.log('\nAUCUN ENREGISTREMENT PERDU, AUCUN CHAMP ABÎMÉ');

v('les quatre séances sont là', apres.seances.length, 4);
v('les deux quiz aussi', apres.quiz.length, 2);
v('et la demande d’aide', apres.aides.length, 1);
const parJour = new Map(apres.seances.map((s) => [s.jour, s]));
v('le thème est intact', parJour.get('2026-01-05')?.theme, 'economie');
v('la durée est intacte', parJour.get('2026-01-05')?.secondes, 3600);
v('les fiches couvertes sont intactes', parJour.get('2026-01-05')?.fiches, ['f-a']);
v('la date de clôture est intacte', parJour.get('2026-01-05')?.termineeLe, '2026-01-05T18:00:00.000Z');
v('la séance à date illisible est conservée', parJour.get('pas-une-date')?.secondes, 60);
v('le quiz garde ses scores', apres.quiz.map((q) => `${q.bonnes}/${q.total}`).sort(), ['6/10', '8/10']);

console.log('\nLES CLÉS SONT DES ULID');

const idsSeances = apres.seances.map((s) => s.id);
v('toutes les séances portent un ULID', idsSeances.every((i) => ULID.test(i)), true);
v('tous distincts', new Set(idsSeances).size, 4);
v('les quiz aussi', apres.quiz.every((q) => ULID.test(q.id)), true);
v('les aides aussi', apres.aides.every((a) => ULID.test(a.id)), true);

console.log('\nL’ORDRE CHRONOLOGIQUE EST CONSERVÉ DANS LES CLÉS');

// La propriété qui justifie d'avoir trié avant d'attribuer : l'ordre
// lexicographique des nouvelles clés est l'ordre des faits.
const chronologie = apres.seances
  .filter((s) => s.jour !== 'pas-une-date')
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((s) => s.jour);
v('les séances triées par clé sont triées par jour', chronologie, [
  '2026-01-05',
  '2026-01-12',
  '2026-01-13',
]);
const quizChrono = [...apres.quiz].sort((a, b) => a.id.localeCompare(b.id)).map((q) => q.ficheId);
v('et les quiz par horodatage', quizChrono, ['f-a', 'f-b']);

console.log('\nLES INDEX ONT SURVÉCU À LA RECRÉATION DES MAGASINS');

v('index « jour » sur les séances', apres.indexJour, 4);
v('index « theme » sur les séances', apres.indexTheme, 4);
v('index « le » sur les quiz', apres.indexLeQuiz, 2);
v('index « itemId » sur les aides', apres.indexItemAides, 1);

console.log('\nLE TEXTE DES SÉANCES : AU SIGNE PRÈS');

v('les trois notes sont là, orpheline comprise', apres.notes.length, 3);
const seance1 = parJour.get('2026-01-05').id;
const seance3 = parJour.get('2026-01-12').id;
const parSeance = new Map(apres.notes.map((n) => [n.seanceId, n]));
v('la note de la séance du 5 est rattachée à sa nouvelle clé', parSeance.get(seance1)?.note, NOTE_1);
v('celle du 12 aussi', parSeance.get(seance3)?.note, NOTE_3);
v(
  'la restitution qui renvoyait à la séance 1 pointe sur sa nouvelle clé',
  parSeance.get(seance3)?.restitutions?.[seance1],
  'Ce dont je me souvenais de la 1.',
);
v(
  'et celle qui renvoyait à une séance disparue garde son texte',
  Object.values(parSeance.get(seance3)?.restitutions ?? {}).includes('Et de la 2, disparue.'),
  true,
);
v(
  'la note orpheline a survécu, avec son texte',
  apres.notes.some((n) => n.note === 'Note orpheline, dont la séance a disparu.'),
  true,
);
v(
  'et elle porte un ULID, pas l’ancien 99',
  apres.notes.every((n) => ULID.test(n.seanceId)),
  true,
);
v(
  'la date de mise à jour des notes est intacte',
  parSeance.get(seance1)?.majLe,
  '2026-01-05T18:05:00.000Z',
);

console.log('\nUN INSTANTANÉ A ÉTÉ PRIS AVANT');

const instantane = await page.evaluate(async () => {
  const base = await new Promise((ok, ko) => {
    const r = indexedDB.open('revinsp-instantanes');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  if (!base.objectStoreNames.contains('instantanes')) {
    base.close();
    return [];
  }
  const tout = await new Promise((ok) => {
    const q = base.transaction('instantanes').objectStore('instantanes').getAll();
    q.onsuccess = () => ok(q.result);
  });
  base.close();
  return tout;
});
v('un instantané existe', instantane.length >= 1, true);
v(
  'il garde les anciennes clés numériques',
  instantane[0]?.magasins?.seances?.map((s) => s.valeur.id).sort(),
  [1, 3, 4, 5],
);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m' : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
await nav.close();
process.exit(echecs === 0 ? 0 : 1);
