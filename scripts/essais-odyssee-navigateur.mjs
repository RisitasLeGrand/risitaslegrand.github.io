/**
 * La migration v15, sur une base déjà remplie.
 *
 * C'est la seule chose qu'aucun essai pur ne peut couvrir, et c'est celle qui
 * compte : une migration ne tourne jamais sur une base vide chez quelqu'un qui
 * utilise déjà le site. L'essai sème donc une base **en version 14**, à la
 * main, puis laisse le site l'ouvrir et vérifie que rien n'a été perdu en
 * chemin — ni les séances, ni l'identifiant d'appareil, qui départage les
 * horloges et ne doit jamais être régénéré.
 *
 * Les écritures, le journal et la projection de faits ne sont **pas** ici :
 * « astro preview » sert un site construit, où les modules du dépôt ne sont
 * pas adressables, et les exposer sur `window` pour les besoins d'un essai
 * ajouterait au site une porte qui n'existe que pour lui. La projection est
 * devenue pure (`projeterFaitsOdyssee`) et se vérifie dans
 * `essais:odyssee` ; les écritures se vérifieront par les écrans, quand ils
 * existeront.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { MAGASINS_V14, schemaV14 } from './lib/base-ancienne.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

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

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

async function deverrouiller() {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

/* ════════════════════════════════════════════════════════════════════════
   1. La migration v15 sur une base déjà remplie
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA MIGRATION N’OUBLIE RIEN');

await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

/*
   On ouvre d'abord la base **à la version 14**, à la main, et on y sème des
   données. C'est ce qui rend l'essai honnête : migrer une base vide ne prouve
   rien, puisque le bloc v15 est additif et que le risque est ailleurs — qu'une
   migration additive fasse perdre ce qui était là.
*/
const seme = await page.evaluate(
  (source) =>
    new Promise((ok, ko) => {
      const demande = indexedDB.open('revinsp', 14);
      demande.onupgradeneeded = () => {
        // Le schéma **entier** de la v14 : voir « lib/base-ancienne.mjs ».
        new Function('base', `(${source})(base)`)(demande.result);
      };
      demande.onerror = () => ko(demande.error);
      demande.onsuccess = () => {
        const base = demande.result;
        const tx = base.transaction(['etat', 'seances'], 'readwrite');
        tx.objectStore('etat').put('APPAREIL-ESSAI', 'appareil');
        tx.objectStore('seances').put({
          id: 'SEANCE-AVANT-MIGRATION',
          theme: 'economie',
          jour: '2026-10-01',
          statut: 'terminee',
          termineeLe: '2026-10-01T18:00:00.000Z',
          secondes: 1800,
          fiches: [],
        });
        tx.oncomplete = () => {
          const noms = [...base.objectStoreNames];
          base.close();
          ok(noms);
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
  schemaV14.toString(),
);
v('une base complète en version 14 est semée', [...seme].sort(), [...MAGASINS_V14].sort());

await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await deverrouiller();
await franchirInitialisation(page, RACINE, MDP);

const apres = await page.evaluate(
  () =>
    new Promise((ok, ko) => {
      const demande = indexedDB.open('revinsp');
      demande.onerror = () => ko(demande.error);
      demande.onsuccess = () => {
        const base = demande.result;
        const magasins = [...base.objectStoreNames];
        const tx = base.transaction(['seances', 'etat'], 'readonly');
        const seances = tx.objectStore('seances').getAll();
        const appareil = tx.objectStore('etat').get('appareil');
        tx.oncomplete = () => {
          const resultat = {
            version: base.version,
            magasins,
            seances: seances.result.map((s) => s.id),
            appareil: appareil.result,
          };
          base.close();
          ok(resultat);
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
);

v('la base est passée en version 15', apres.version, 15);
v(
  'les cinq magasins d’Odyssée existent',
  apres.magasins.filter((m) => m.startsWith('odyssee')).sort(),
  ['odysseeEvenements', 'odysseeFocus', 'odysseeQuetes', 'odysseeRevues', 'odysseeTaches'],
);
/*
   Et aucun des anciens n'a disparu. C'est ce que « additive » veut dire, et
   c'est la seule formulation qui attrape une migration qui recréerait le
   schéma au lieu de l'étendre.
*/
v(
  'et les dix-neuf magasins d’avant sont tous là',
  MAGASINS_V14.filter((m) => !apres.magasins.includes(m)),
  [],
);
v('la séance d’avant la migration est toujours là', apres.seances, ['SEANCE-AVANT-MIGRATION']);
/*
   L'identifiant d'appareil est la chose qu'une migration ne doit jamais
   régénérer : il départage deux horloges égales, et le perdre ferait de cette
   machine un appareil inconnu pour tous les autres.
*/
v('et l’identifiant d’appareil n’a pas bougé', apres.appareil, 'APPAREIL-ESSAI');

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
