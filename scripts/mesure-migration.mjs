/**
 * Combien de temps la migration de la phase 1 prend-elle, sur cinq ans ?
 *
 * Le plan en fait un critère de sortie, et c'est justifié : une migration qui
 * tient cinq secondes sur une base pleine donne un chargement muet et
 * inquiétant, et c'est le moment où la tentation serait d'ajouter un écran
 * d'attente plutôt que de se demander pourquoi elle est lente.
 *
 * On mesure séparément ce qui coûte : l'instantané, qui lit et réécrit toute la
 * base dans une base voisine, et la migration elle-même, qui recrée sept
 * magasins et remappe les notes.
 *
 *   node scripts/mesure-migration.mjs [--annees 5]
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { engendrer } from './lib/donnees-synthetiques.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const ANNEES = Number(process.argv[process.argv.indexOf('--annees') + 1]) || 5;
const VERSION = Number(
  /const VERSION = (\d+)/.exec(readFileSync('src/lib/db.ts', 'utf8'))?.[1] ?? '0',
);

/* Les magasins que la version 12 connaissait, avec leur forme d'alors : clé
   auto-incrémentée pour les sept qui vont changer. */
const SCHEMA_12 = [
  ['etat', null, []],
  ['cartes', 'id', [['du', 'du'], ['matiere', 'matiere']]],
  ['fiches', 'id', []],
  ['quiz', 'id+', [['le', 'le']]],
  ['jours', 'jour', []],
  ['nback', 'id+', [['le', 'le']]],
  ['seances', 'id+', [['jour', 'jour'], ['theme', 'theme']]],
  ['qcmDgfip', 'id', [['rubriqueId', 'rubriqueId']]],
  ['qcmSessions', 'id+', [['le', 'le']]],
  ['relationnel', 'id+', [['le', 'le']]],
  ['vmSeuils', 'id', [['famille', 'famille']]],
  ['vmSessions', 'id+', [['le', 'le']]],
  ['journal', 'id', [['matiere', 'matiere']]],
  ['competences', 'clef', [['matiere', 'matiere']]],
  ['difficultes', 'id', []],
  ['aides', 'id+', [['le', 'le'], ['itemId', 'itemId']]],
  ['notes', 'seanceId', []],
  ['revisions', 'id', [['carteId', 'carteId'], ['le', 'le']]],
  ['operations', 'id', [['hlc', 'hlc'], ['cible', 'cible'], ['lot', 'lot']]],
];

console.log(`\nJeu synthétique sur ${ANNEES} ans…`);
const jeu = engendrer({ annees: ANNEES, graine: 1 });
const compte = Object.fromEntries(
  Object.entries(jeu)
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([k, v]) => [k, v.length]),
);
const total = Object.values(compte).reduce((s, n) => s + n, 0);
console.log(`${total.toLocaleString('fr-FR')} enregistrements :`);
for (const [nom, n] of Object.entries(compte).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${nom.padEnd(14)} ${n.toLocaleString('fr-FR').padStart(8)}`);
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext()).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });

console.log('\nSemis d’une base version 12…');
const semis = await page.evaluate(
  async ([schema, donnees]) => {
    for (const nom of ['revinsp', 'revinsp-instantanes']) {
      await new Promise((ok) => {
        const r = indexedDB.deleteDatabase(nom);
        r.onsuccess = r.onerror = r.onblocked = () => ok();
      });
    }
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp', 12);
      r.onupgradeneeded = () => {
        for (const [nom, clef, index] of schema) {
          const magasin =
            clef === null
              ? r.result.createObjectStore(nom)
              : r.result.createObjectStore(nom, {
                  keyPath: clef.replace('+', ''),
                  ...(clef.endsWith('+') ? { autoIncrement: true } : {}),
                });
          for (const [nomIndex, champ] of index) magasin.createIndex(nomIndex, champ);
        }
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const depart = performance.now();
    for (const [nom, enregistrements] of Object.entries(donnees)) {
      if (!Array.isArray(enregistrements) || !enregistrements.length) continue;
      if (!base.objectStoreNames.contains(nom)) continue;
      // Par paquets : une transaction unique sur 20 000 écritures tient, mais
      // la mesure qui compte est plus loin et on ne veut pas la polluer.
      for (let i = 0; i < enregistrements.length; i += 2000) {
        const paquet = enregistrements.slice(i, i + 2000);
        await new Promise((ok, ko) => {
          const tx = base.transaction(nom, 'readwrite');
          const magasin = tx.objectStore(nom);
          for (const e of paquet) {
            if (nom === 'etat') magasin.put(e.valeur ?? e, e.clef ?? 'profil');
            else magasin.put(e);
          }
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
        });
      }
    }
    const sortie = { version: base.version, secondes: (performance.now() - depart) / 1000 };
    base.close();
    return sortie;
  },
  [SCHEMA_12, jeu],
);
console.log(`  base en version ${semis.version}, semée en ${semis.secondes.toFixed(1)} s`);

console.log('\nMigration par l’application…');

/*
   Le déverrouillage d'abord, et complètement : la première version de ce script
   vérifiait la présence du champ de mot de passe sur « domcontentloaded », ne
   la trouvait pas encore, ne déverrouillait donc rien — et mesurait 0,40 s sur
   une base restée en version 12. Une mesure fausse qui a l'air plausible est
   pire que pas de mesure.
*/
await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#champ-mdp', { timeout: 30000 });
await page.fill('#champ-mdp', MDP);

const version = () =>
  page.evaluate(async () => {
    const liste = await indexedDB.databases();
    return liste.find((d) => d.name === 'revinsp')?.version ?? 0;
  });

/*
   L'attente est pilotée depuis Node et non par « waitForFunction » : avec un
   prédicat asynchrone, celui-ci se satisfaisait de la promesse — qui est
   toujours vraie — au lieu de sa valeur, et rendait la main aussitôt. La
   granularité est de 50 ms, ce qui suffit pour une mesure qu'on attend en
   secondes.
*/
const debut = Date.now();
await page.click('#bouton-verrou');
let atteinte = await version();
while (atteinte < VERSION && Date.now() - debut < 300000) {
  await new Promise((ok) => setTimeout(ok, 50));
  atteinte = await version();
}
const duree = (Date.now() - debut) / 1000;
if (atteinte < VERSION) {
  console.error(`\nLa base est restée en version ${atteinte} : la migration n’a pas eu lieu.`);
  await nav.close();
  process.exit(1);
}

const apres = await page.evaluate(async () => {
  const ouvrir = (nom) =>
    new Promise((ok, ko) => {
      const r = indexedDB.open(nom);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  const base = await ouvrir('revinsp');
  const compter = (nom) =>
    new Promise((ok) => {
      const q = base.transaction(nom).objectStore(nom).count();
      q.onsuccess = () => ok(q.result);
    });
  const premier = (nom) =>
    new Promise((ok) => {
      const q = base.transaction(nom).objectStore(nom).getAllKeys(undefined, 1);
      q.onsuccess = () => ok(q.result[0]);
    });
  const sortie = {
    version: base.version,
    seances: await compter('seances'),
    notes: await compter('notes'),
    quiz: await compter('quiz'),
    revisions: await compter('revisions'),
    clefSeance: await premier('seances'),
    clefNote: await premier('notes'),
  };
  base.close();

  const inst = await ouvrir('revinsp-instantanes');
  sortie.instantanes = inst.objectStoreNames.contains('instantanes')
    ? await new Promise((ok) => {
        const q = inst.transaction('instantanes').objectStore('instantanes').getAll();
        q.onsuccess = () => ok(q.result.map((i) => ({ octets: i.octets, de: i.deVersion })));
      })
    : [];
  inst.close();

  const estimation = await navigator.storage.estimate();
  sortie.usage = estimation.usage ?? 0;
  return sortie;
});

const mio = (o) => `${(o / 1024 / 1024).toFixed(2)} Mio`;

console.log(`
RÉSULTAT

  Version atteinte        ${apres.version}
  Durée totale            ${duree.toFixed(2)} s
                          (instantané + migration + chargement de la page)

  Séances migrées         ${apres.seances.toLocaleString('fr-FR')}
  Notes remappées         ${apres.notes.toLocaleString('fr-FR')}
  Quiz migrés             ${apres.quiz.toLocaleString('fr-FR')}
  Socles FSRS posés       ${apres.revisions.toLocaleString('fr-FR')}${
  apres.revisions === 0
    ? '\n                          (zéro est attendu : la base est semée en v12,\n                           qui porte déjà le journal — le socle est posé par\n                           la migration 12, mesurée en partant d\u2019une v11)'
    : ''
}

  Première clé de séance  ${apres.clefSeance}
  Première clé de note    ${apres.clefNote}

  Instantané              ${apres.instantanes.map((i) => `${mio(i.octets)} depuis la v${i.de}`).join(', ') || 'aucun'}
  Occupation réelle       ${mio(apres.usage)}
`);

await nav.close();
