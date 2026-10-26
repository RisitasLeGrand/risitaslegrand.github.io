/**
 * La page « Stockage » : ce qu'elle affiche, et ce qu'elle refuse de faire.
 *
 * Deux choses sont vérifiées, et la seconde compte autant que la première :
 * que les mesures s'affichent, et que **le contrôle d'intégrité ne répare
 * rien**. Un contrôle qui corrigerait de lui-même une base qu'il ne comprend
 * pas transformerait une anomalie bénigne en perte, et c'est le genre de
 * gentillesse qu'on ajoute un jour de fatigue.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 220)));

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(3000);
  }
};

const lire = (magasin) =>
  page.evaluate(async (nom) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const res = await new Promise((ok) => {
      const q = base.transaction(nom).objectStore(nom).getAll();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return res;
  }, magasin);

console.log('\nUNE BASE AVEC UNE ANOMALIE CONNUE');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
/*
 * La base est créée en passant par un écran qui la lit : /stockage/ n'ouvre
 * qu'IndexedDB par `navigator.storage` et ne la crée pas. Un `indexedDB.open`
 * brut l'aurait créée en version 1, sans aucun magasin — c'est ce qui a fait
 * échouer la première version de cet essai, et c'était l'essai qui avait tort.
 */
await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2500);

/*
 * Une note rattachée à une séance qui n'existe pas : exactement ce qu'une
 * restauration partielle peut laisser derrière elle.
 */
await page.evaluate(
  () =>
    new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const base = r.result;
        const tx = base.transaction(['seances', 'notes'], 'readwrite');
        tx.objectStore('seances').put({
          id: 1,
          theme: 'droit-public',
          jour: '2026-02-02',
          statut: 'terminee',
          secondes: 1200,
          etendue: false,
        });
        tx.objectStore('notes').put({
          seanceId: 1,
          note: 'Une note qui a bien sa séance.',
          restitutions: {},
          majLe: '2026-02-02T10:00:00.000Z',
        });
        tx.objectStore('notes').put({
          seanceId: 999,
          note: 'Une note orpheline, dont la séance a disparu.',
          restitutions: {},
          majLe: '2026-02-02T10:00:00.000Z',
        });
        tx.oncomplete = () => {
          base.close();
          ok();
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
);
v('deux notes sont en base', (await lire('notes')).length, 2);

console.log('\nLA PAGE S’OUVRE ET AFFICHE L’OCCUPATION');

await page.goto(`${RACINE}/stockage/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForSelector('#stockage', { state: 'visible', timeout: 60000 });
const occupation = (await page.locator('#occupation').textContent()) ?? '';
v('l’occupation est chiffrée', /Occupé/.test(occupation), true);
v('le quota est annoncé', /Quota estimé/.test(occupation), true);
v('la part est annoncée', /Part utilisée/.test(occupation), true);
v(
  'aucune alerte de quota sur une base minuscule',
  await page.locator('#alerte-quota').isVisible(),
  false,
);

console.log('\nLE RISQUE EST NOMMÉ AVANT LES CHIFFRES');

const corps = (await page.locator('#stockage').textContent()) ?? '';
v('la perte est nommée comme le risque réel', /Le risque réel est la/.test(corps), true);
v('la sauvegarde est désignée comme la seule protection', /seule chose protège/.test(corps), true);
v('le plafond de sept jours de WebKit est expliqué', /sept jours/.test(corps), true);
v(
  'et la réserve sur la documentation d’Apple est écrite',
  /Apple ne documente pas/.test(corps),
  true,
);

console.log('\nLA PERSISTANCE EST DEMANDÉE, ET UN REFUS NE CASSE RIEN');

const etatAvant = (await page.locator('#etat-persistance').textContent())?.trim();
v('l’état de la persistance est affiché', Boolean(etatAvant), true);
if (await page.locator('#demander-persistance').isVisible()) {
  await page.click('#demander-persistance');
  await page.waitForTimeout(1500);
  const msg = (await page.locator('#message-persistance').textContent()) ?? '';
  v('la réponse est expliquée dans les deux cas', msg.length > 30, true);
  v(
    'un refus ne présente pas la persistance comme une protection suffisante',
    /Refusé/.test(msg) ? /sauvegarde reste la vraie protection/.test(msg) : true,
    true,
  );
  v('la page reste utilisable', await page.locator('#stockage').isVisible(), true);
}

console.log('\nLE DÉTAIL PAR MAGASIN SE PÈSE SUR DEMANDE');

v('le détail est masqué au départ', await page.locator('#detail').isVisible(), false);
await page.click('#peser');
await page.waitForSelector('#detail', { state: 'visible', timeout: 60000 });
const detail = (await page.locator('#detail').textContent()) ?? '';
/*
   LA TABLE DIT LE NOM FRANÇAIS, PAS L'IDENTIFIANT.

   Ces deux lignes cherchaient « notes » et « seances », c'est-à-dire les noms
   techniques des magasins, qui étaient affichés tels quels. Elles cherchent
   maintenant les étiquettes de « src/lib/intitules-magasins.ts ». Ce n'est pas
   un assouplissement : l'essai mesurait l'ancien défaut et le déclarait
   conforme.
*/
v('les notes de séance apparaissent dans le tableau', /Notes prises en séance/.test(detail), true);
v('les séances de révision aussi', /Séances de révision/.test(detail), true);
/*
   Et le groupe les situe, en sous-titre. Sans ce contrôle, retirer le
   sous-titre ne se verrait nulle part.
*/
v('le groupe est donné sous l’étiquette', /Séances et notes/.test(detail), true);
/*
   AUCUN IDENTIFIANT EN CASSE DE CHAMEAU. On ne peut pas exiger l'absence de
   TOUS les noms techniques — « quiz » et « notes » sont aussi des mots
   français, et des étiquettes les portent légitimement. Ceux-là, en revanche,
   ne peuvent venir que du code.
*/
for (const technique of [
  'odysseeEtapesCochees',
  'vmSeuils',
  'epreuveDgfipEnCours',
  'podcastPositions',
  'sportProgrammes',
]) {
  v(`« ${technique} » n’est pas affiché`, detail.includes(technique), false);
}
/* Et la ligne garde son identifiant en attribut, pour être désignée. */
v(
  'la ligne des notes porte son magasin en attribut',
  await page.locator('[data-magasin="notes"]').count(),
  1,
);
v('le rapport au disque est expliqué', /comprime/.test(detail), true);

console.log('\nLE CONTRÔLE D’INTÉGRITÉ NOMME L’ANOMALIE');

await page.click('#controler');
await page.waitForSelector('#integrite', { state: 'visible', timeout: 60000 });
const integrite = (await page.locator('#integrite').textContent()) ?? '';
v('la note orpheline est signalée', /ne se rattachent à aucune séance/.test(integrite), true);
v('le compte est donné', /\(1\)/.test(integrite), true);
v('il est dit que rien n’est réparé', /Signalé, pas réparé/.test(integrite), true);

console.log('\nET IL N’A RIEN RÉPARÉ, NI RIEN EFFACÉ');

const notesApres = await lire('notes');
v('les deux notes sont toujours là', notesApres.length, 2);
v(
  'l’orpheline n’a pas été supprimée',
  notesApres.some((n) => n.seanceId === 999),
  true,
);
v('la séance est toujours là', (await lire('seances')).length, 1);

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
