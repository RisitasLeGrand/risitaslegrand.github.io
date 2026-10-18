/**
 * Une restauration coupée ne laisse pas la base à moitié — A5 du prompt 43.
 *
 *   npm run essais:restauration-atomique
 *
 * Le prompt le dit en une ligne : « La restauration est atomique : une
 * transaction, ou une base temporaire. Une coupure laisse l'ancienne base
 * intacte. Un essai coupe au milieu. » Le voici, et il part de la route
 * `/progression/`, par le champ de fichier que la personne utilise vraiment.
 *
 * ## Le scénario, et pourquoi celui-là
 *
 * 1. On restaure une première sauvegarde, de deux cartes, en remplacement.
 *    C'est l'état « d'avant » qu'une coupure ne doit pas abîmer.
 * 2. On fait **échouer la troisième écriture** de la base, et seulement
 *    celle-là : une coupure au milieu, pas un refus d'emblée. Avant ce lot, le
 *    vidage avait déjà eu lieu et deux écritures étaient passées — la base
 *    restait avec le profil et une carte de la nouvelle sauvegarde, et rien de
 *    l'ancienne.
 * 3. On restaure une seconde sauvegarde, de trois cartes aux identifiants
 *    différents. Elle doit échouer **en entier**.
 * 4. On regarde la base : les deux cartes de la première doivent y être, les
 *    trois autres nulle part, et le compte doit valoir exactement deux. Un
 *    mélange est le défaut qu'on corrige ; une base vide en serait un autre.
 *
 * Le seuil de trois n'est pas magique : il faut seulement qu'il tombe après le
 * vidage et avant la fin. Il a d'abord été mis à cinq, et l'essai est passé au
 * vert par erreur — une sauvegarde de trois cartes ne fait que quatre
 * écritures, le profil compris, et la coupure n'arrivait jamais. C'est
 * pourquoi l'essai **vérifie que l'écriture fautive a bien eu lieu** : sans
 * cette assertion, une coupure qui ne coupe pas se lit comme une réussite.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

/** Une sauvegarde minimale, au format que `importerTout` accepte. */
const sauvegarde = (cartes: string[]) =>
  JSON.stringify({
    format: 'revinsp-progression',
    cartes: cartes.map((id) => ({
      id,
      ficheId: 'essai',
      question: 'q',
      reponse: 'r',
      etat: 'nouvelle',
      stabilite: 0,
      difficulte: 5,
      prochaineRevision: '2026-01-01',
      derniereRevision: '2026-01-01',
      repetitions: 0,
      lapses: 0,
    })),
    fiches: [],
    quiz: [],
    jours: [],
    nback: [],
    seances: [],
    qcmDgfip: [],
    qcmSessions: [],
    relationnel: [],
    vmSeuils: [],
    vmSessions: [],
    journal: [],
    competences: [],
    difficultes: [],
    aides: [],
  });

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await ctx.newPage();
await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const restaurer = async (contenu: string) => {
  await page.locator('input[name="mode"][value="remplacement"]').check();
  await page.locator('#fichier').setInputFiles({
    name: 'essai.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contenu, 'utf8'),
  });
  await page.waitForTimeout(1800);
};

const cartesEnBase = () =>
  page.evaluate(
    () =>
      new Promise<string[]>((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const q = r.result.transaction('cartes').objectStore('cartes').getAllKeys();
          q.onsuccess = () => ok((q.result as IDBValidKey[]).map(String).sort());
          q.onerror = () => ok(['(erreur de lecture)']);
        };
        r.onerror = () => ok(['(base inaccessible)']);
      }),
  );

/* ── 1. L'état d'avant ───────────────────────────────────────────────────── */

console.log('\nL’ÉTAT D’AVANT');
await restaurer(sauvegarde(['avant-1', 'avant-2']));
verifier('la première sauvegarde est en base', await cartesEnBase(), ['avant-1', 'avant-2']);

/* ── 2. La coupure au milieu ─────────────────────────────────────────────── */

console.log('\nLA COUPURE AU MILIEU');
const coupe = await page.evaluate(`
  (() => {
    let vues = 0;
    const vraiPut = IDBObjectStore.prototype.put;
    window.__compteurPut = () => vues;
    IDBObjectStore.prototype.put = function (...args) {
      vues += 1;
      if (vues === 3) throw new DOMException('Coupure de l’essai.', 'AbortError');
      return vraiPut.apply(this, args);
    };
    return 'posée';
  })();
`);
verifier('la coupure est armée', coupe, 'posée');

await restaurer(sauvegarde(['apres-1', 'apres-2', 'apres-3']));

const compte = await page.evaluate('window.__compteurPut()');
verifier(
  'la coupure a bien coupé au milieu, et non avant la première écriture',
  typeof compte === 'number' && compte >= 3,
  true,
);

const dit = await page.locator('#message-import').textContent();
verifier('l’écran dit que l’import n’a pas abouti', /impossible/i.test(dit ?? ''), true);

/* ── 3. La base d'avant est intacte ──────────────────────────────────────── */

console.log('\nLA BASE D’AVANT EST INTACTE');
const apres = await cartesEnBase();
verifier('les deux cartes d’avant sont toujours là', apres, ['avant-1', 'avant-2']);
verifier(
  'et rien de la seconde sauvegarde n’est passé',
  apres.filter((id) => id.startsWith('apres-')),
  [],
);

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
