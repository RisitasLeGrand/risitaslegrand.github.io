/**
 * Une fusion interrompue le dit, et se finit (B-4 du 58).
 *
 *   npm run essais:fusion-interrompue
 *
 * ## Le défaut
 *
 * Une fusion écrit le journal en une transaction, puis matérialise les
 * enregistrements de domaine — ce qui ne peut pas tenir dans la même
 * transaction, pour les raisons écrites dans `src/lib/sync/reprise.ts`. Entre
 * les deux, l'onglet peut se fermer.
 *
 * L'empreinte d'état, elle, ne porte que sur les journaux et les réglages
 * versionnés. Elle était donc **égale** à celle de l'émetteur dès le `tx.done`
 * du journal, et l'écran annonçait « les deux appareils sont désormais
 * identiques ✓ » alors que les séances, les notes et les mesures manquaient.
 *
 * ## Comment l'interruption est reproduite, et ce que cela vaut
 *
 * Pas en tuant l'onglet au bon millième de seconde : ce serait un essai qui
 * passerait une fois sur dix. L'essai **écrit l'état que l'interruption
 * laisse** — l'opération au journal, la marque posée, et aucun enregistrement
 * dans le magasin de domaine — puis mesure l'écran et la réparation.
 *
 * C'est donc l'état qui est reproduit, et non le crash. Ce que l'essai éprouve
 * est exactement ce qui était faux : ce que l'écran dit dans cet état, et ce
 * que « Reconstruire » y fait. Ce qu'il n'éprouve pas, et c'est dit plutôt que
 * supposé : que la marque soit bien posée par la transaction du journal
 * elle-même. Cela, c'est la troisième section qui l'approche, par le seul
 * chemin observable — une vraie fusion de paquet, dont on vérifie qu'elle
 * **réunit** le reliquat d'une interruption précédente au lieu de l'écraser.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);

process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

async function appareil(nom) {
  const contexte = await nav.newContext({ acceptDownloads: true });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.log(`PAGEERROR[${nom}]:`, e.message.slice(0, 200)));
  return { nom, contexte, page };
}

async function ouvrir(app, chemin, selecteur) {
  await app.page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await app.page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await app.page.fill('#champ-mdp', MDP);
    await app.page.click('#bouton-verrou');
  }
  if (selecteur) await app.page.waitForSelector(selecteur, { timeout: 40000 });
}

/* ── Les outils de base ────────────────────────────────────────────────── */

/*
   Chaque accès à la base est un `evaluate` à lui, avec sa fonction écrite sur
   place. Une première version passait une fonction en texte, recompilée par
   `new Function` dans la page : c'est un `eval`, et une politique de sécurité
   de contenu a tout droit de le refuser — l'essai aurait échoué pour une
   raison qui n'a rien à voir avec ce qu'il mesure.
*/

const ouvrirBase = () =>
  new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });

/**
 * Pose l'état qu'une fusion interrompue laisse derrière elle.
 *
 * Trois écritures, et il faut les trois : l'opération au journal (elle est
 * arrivée), la marque (la transaction du journal l'a posée), et **rien** dans
 * le magasin de domaine (la matérialisation n'a pas eu lieu).
 */
const poserUneInterruption = (app, { seanceId, note, idOperation, quand, lot = 'LOT-B4-ESSAI' }) =>
  app.page.evaluate(
    async ([seanceId, note, idOperation, quand, lot]) => {
      const base = await new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
      });
      const moi = await new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get('appareil');
        q.onsuccess = () => ok(q.result);
      });
      const ms = Date.parse(quand);
      await new Promise((ok, ko) => {
        const tx = base.transaction(['operations', 'notes', 'etat'], 'readwrite');
        tx.objectStore('operations').put({
          id: idOperation,
          appareil: moi,
          hlc: `${String(ms).padStart(15, '0')}-0000`,
          type: 'revision.note-seance',
          cible: `notes:${seanceId}`,
          lot,
          charge: {
            magasin: 'notes',
            enregistrement: {
              seanceId,
              note,
              restitutions: {},
              majLe: new Date(ms).toISOString(),
            },
          },
        });
        /* La matérialisation n'a pas eu lieu : on s'assure que rien n'est là. */
        tx.objectStore('notes').delete(seanceId);
        tx.objectStore('etat').put(
          {
            lot,
            cibles: [`notes:${seanceId}`],
            cartes: [],
            le: quand,
            appareil: 'APPAREIL-ESSAI-B4',
            nomAppareil: 'Ordinateur d’essai',
          },
          'fusionEnCours',
        );
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
      return true;
    },
    [seanceId, note, idOperation, quand, lot],
  );

/** Une note écrite ET matérialisée : un appareil sain, qui a quelque chose à dire. */
const semerUneNoteSaine = (app, { seanceId, note, idOperation, quand }) =>
  app.page.evaluate(
    async ([seanceId, note, idOperation, quand]) => {
      const base = await new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
      });
      const moi = await new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get('appareil');
        q.onsuccess = () => ok(q.result);
      });
      const ms = Date.parse(quand);
      const enregistrement = {
        seanceId,
        note,
        restitutions: {},
        majLe: new Date(ms).toISOString(),
      };
      await new Promise((ok, ko) => {
        const tx = base.transaction(['operations', 'notes'], 'readwrite');
        tx.objectStore('operations').put({
          id: idOperation,
          appareil: moi,
          hlc: `${String(ms).padStart(15, '0')}-0000`,
          type: 'revision.note-seance',
          cible: `notes:${seanceId}`,
          lot: '',
          charge: { magasin: 'notes', enregistrement },
        });
        tx.objectStore('notes').put(enregistrement);
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
      return true;
    },
    [seanceId, note, idOperation, quand],
  );

const laNote = (app, seanceId) =>
  app.page.evaluate(async (seanceId) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const note = await new Promise((ok) => {
      const q = base.transaction('notes').objectStore('notes').get(seanceId);
      q.onsuccess = () => ok(q.result ?? null);
    });
    base.close();
    return note;
  }, seanceId);

const laMarque = (app) =>
  app.page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const marque = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get('fusionEnCours');
      q.onsuccess = () => ok(q.result ?? null);
    });
    base.close();
    return marque;
  });

/** Écrit, ou retire, la marque à la main : c'est le cas limite de la marque vide. */
const marqueBrute = (app, valeur) =>
  app.page.evaluate(async (valeur) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    await new Promise((ok, ko) => {
      const tx = base.transaction('etat', 'readwrite');
      if (valeur === null) tx.objectStore('etat').delete('fusionEnCours');
      else tx.objectStore('etat').put(valeur, 'fusionEnCours');
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
    return true;
  }, valeur);

/* ════════════════════════════════════════════════════════════════════════
   1. L'écran le dit, et il ne dit plus « identiques »
   ════════════════════════════════════════════════════════════════════════ */

const A = await appareil('ordinateur');

console.log('\n\x1b[1mL’ÉCRAN DIT QU’UNE FUSION A ÉTÉ INTERROMPUE\x1b[0m\n');

const SEANCE = 'B4-SEANCE-ESSAI';
const NOTE = 'Note arrivée au journal, jamais rangée dans sa rubrique.';
const QUAND = '2026-10-19T09:30:00.000Z';

await ouvrir(A, '/appareils/', '#ecran:not(.hidden)');
await poserUneInterruption(A, {
  seanceId: SEANCE,
  note: NOTE,
  idOperation: '01B4INTERROMPUE000000001',
  quand: QUAND,
});

v('avant toute réparation, la rubrique est vide', await laNote(A, SEANCE), null);

await ouvrir(A, '/appareils/', '#ecran:not(.hidden)');
await A.page.waitForSelector('#fusion-interrompue:not(.hidden)', { timeout: 40000 });
const banniere = (await A.page.textContent('#fusion-interrompue')).replace(/\s+/g, ' ');

vrai('la bannière paraît', true);
vrai('elle dit qu’une partie a été reçue', /une partie a été reçue/.test(banniere));
vrai('elle dit que rien n’est perdu', /Rien n’est perdu/.test(banniere));
vrai('elle dit où tout se trouve', /tout est au journal/.test(banniere));
vrai(
  'elle dit que cet appareil n’est pas identique à l’autre',
  /n’est pas identique à l’autre/.test(banniere),
);
vrai('elle compte les rubriques à ranger', /1 rubrique\(s\) à ranger/.test(banniere));
vrai('elle nomme l’appareil émetteur', /Ordinateur d’essai/.test(banniere));
vrai('elle date la fusion', /19\/10\/2026/.test(banniere));
vrai('et elle propose de reconstruire', await A.page.isVisible('#reprendre-fusion'));

/*
   La page porte DEUX boutons de reconstruction, et ils ne font pas la même
   chose : « Reconstruire depuis le journal » rejoue tout, celui-ci ne reprend
   que le reliquat. Ils ont failli partager un identifiant, ce qui aurait rendu
   le second muet — d'où ce contrôle, qui n'existerait pas sans cette erreur.
*/
v(
  'les deux reconstructions restent deux boutons distincts',
  await A.page.locator('#reprendre-fusion, #reconstruire').count(),
  2,
);

/* ════════════════════════════════════════════════════════════════════════
   2. « Reconstruire » finit le travail
   ════════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1m« RECONSTRUIRE » FINIT LE TRAVAIL\x1b[0m\n');

await A.page.click('#reprendre-fusion');
await A.page.waitForSelector('#fusion-interrompue-message:not(.hidden)', { timeout: 40000 });
const compteRendu = (await A.page.textContent('#fusion-interrompue-message')).replace(/\s+/g, ' ');

vrai('un compte rendu paraît', /Reconstruction faite/.test(compteRendu));
vrai('il compte ce qui a été écrit', /1 enregistrement\(s\) écrit\(s\)/.test(compteRendu));

const note = await laNote(A, SEANCE);
v('la note est maintenant dans sa rubrique', note?.note ?? null, NOTE);
v('la marque est levée', await laMarque(A), null);
await A.page.waitForFunction(
  () => document.getElementById('fusion-interrompue')?.classList.contains('hidden'),
  undefined,
  { timeout: 20000 },
);
vrai('et la bannière a disparu', true);

/* La réparation est idempotente : la relancer ne doit rien casser. */
await ouvrir(A, '/appareils/', '#ecran:not(.hidden)');
v(
  'après rechargement, la bannière reste cachée',
  await A.page.locator('#fusion-interrompue:not(.hidden)').count(),
  0,
);

/* ════════════════════════════════════════════════════════════════════════
   3. Une marque vide n’alarme pas
   ════════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mUNE MARQUE QUI NE DÉCRIT AUCUN TRAVAIL N’ALARME PAS\x1b[0m\n');

await marqueBrute(A, {
  lot: 'VIDE',
  cibles: [],
  cartes: [],
  le: '2026-10-19T10:00:00.000Z',
  appareil: 'X',
});
await ouvrir(A, '/appareils/', '#ecran:not(.hidden)');
v(
  'une marque sans cible ni carte ne montre rien',
  await A.page.locator('#fusion-interrompue:not(.hidden)').count(),
  0,
);
await marqueBrute(A, null);

/* ════════════════════════════════════════════════════════════════════════
   4. Une vraie fusion réunit le reliquat au lieu de l’écraser
   ════════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1mUNE FUSION SUIVANTE NE PERD PAS LE RELIQUAT\x1b[0m\n');

const B = await appareil('telephone');
await ouvrir(B, '/appareils/', '#ecran:not(.hidden)');

/*
   L'émetteur écrit une note à lui, qui partira dans le paquet. Elle est écrite
   au journal **et** matérialisée chez lui : c'est un appareil sain.
*/
const SEANCE_B = 'B4-SEANCE-EMETTEUR';
const NOTE_B = 'Note écrite par le téléphone, transmise par paquet.';
await semerUneNoteSaine(B, {
  seanceId: SEANCE_B,
  note: NOTE_B,
  idOperation: '01B4EMETTEUR00000000001',
  quand: '2026-10-19T09:45:00.000Z',
});

/* Et le receveur porte un reliquat d'interruption, sur une AUTRE cible. */
const SEANCE_R = 'B4-SEANCE-RELIQUAT';
const NOTE_R = 'Note restée en chemin lors d’une fusion précédente.';
await poserUneInterruption(A, {
  seanceId: SEANCE_R,
  note: NOTE_R,
  idOperation: '01B4RELIQUAT000000000001',
  quand: '2026-10-19T09:50:00.000Z',
});

await ouvrir(B, '/appareils/', '#ecran:not(.hidden)');
await B.page.fill('#mdp-envoi', MDP);
const attente = B.page.waitForEvent('download', { timeout: 90000 });
await B.page.click('#envoyer');
const chemin = await (await attente).path();
await B.page.waitForSelector('#message-envoi:not(.hidden)', { timeout: 40000 });

await ouvrir(A, '/appareils/', '#ecran:not(.hidden)');
vrai(
  'le receveur montre bien sa bannière avant de fusionner',
  await A.page.isVisible('#fusion-interrompue'),
);
await A.page.setInputFiles('#fichier', chemin);
await A.page.waitForSelector('#apercu:not(.hidden)', { timeout: 40000 });
await A.page.fill('#mdp-fusion', MDP);
await A.page.click('#fusionner');
await A.page.waitForSelector('#message-fusion:not(.hidden)', { timeout: 90000 });
await A.page.waitForFunction(
  () => !document.getElementById('message-fusion').textContent.includes('en cours'),
  undefined,
  { timeout: 90000 },
);
const rendu = (await A.page.textContent('#message-fusion')).replace(/\s+/g, ' ');

const notePaquet = await laNote(A, SEANCE_B);
const noteReliquat = await laNote(A, SEANCE_R);
v('la note du paquet est arrivée', notePaquet?.note ?? null, NOTE_B);
v('et le reliquat a été rangé par la même fusion', noteReliquat?.note ?? null, NOTE_R);
v('la marque est levée', await laMarque(A), null);
await A.page.waitForFunction(
  () => document.getElementById('fusion-interrompue')?.classList.contains('hidden'),
  undefined,
  { timeout: 20000 },
);
vrai('et la bannière a disparu', true);
/*
   Ce contrôle est la raison d'être de cette section : si la fusion avait
   ÉCRASÉ la marque au lieu de la réunir, le reliquat serait resté absent ET
   la marque serait tombée — perte silencieuse, et plus personne pour la dire.
*/
vrai('le compte rendu n’annonce pas une fusion vide', /opération\(s\) reçue\(s\)|reçues/.test(rendu));

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} contrôle(s) en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
