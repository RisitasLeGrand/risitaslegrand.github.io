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
import { repondreALaBoite } from './lib/boite-essais.mjs';

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
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  acceptDownloads: true,
});
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

/* ── 4. Le même invariant sur le chemin « .cyclades » — B-1 du 58 ────────── */

/*
 * Pourquoi cette seconde moitié existe.
 *
 * Tout ce qui précède éprouve `importerTout`, le chemin de l'ancien fichier
 * JSON. Le chemin d'archive, celui que la personne utilise vraiment depuis
 * la phase 2d, est `.cyclades` → `restaurer()` → `remplacerMagasins()`. Or
 * il ne portait PAS l'invariant : `remplacerMagasins` vidait toute la
 * progression hors transaction, puis réécrivait magasin par magasin, une
 * transaction par magasin. Une coupure à la vingtième écriture laissait donc
 * la base vidée, quelques magasins remplis, et le reste perdu — c'est-à-dire
 * le pire des deux états, puisque ni l'ancien ni le nouveau n'est là.
 *
 * L'essai part de la route, fabrique une vraie sauvegarde par le bouton,
 * change la base, puis restaure la sauvegarde avec une coupure armée.
 */

console.log('\nLE CHEMIN « .CYCLADES » — UNE VRAIE SAUVEGARDE');

// On repart d'une base saine : la coupure précédente a été posée sur le
// prototype, et elle resterait armée pour la suite.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const cartesAvant = await cartesEnBase();
verifier('la base porte bien l’état d’avant', cartesAvant, ['avant-1', 'avant-2']);

await page.fill('#mdp-sauvegarde', MDP);
const attendu = page.waitForEvent('download', { timeout: 120000 });
await page.click('#sauvegarder');
const fichier = await attendu;
const { readFile } = await import('node:fs/promises');
const octets = await readFile(await fichier.path());
verifier('la sauvegarde est bien un fichier non vide', octets.byteLength > 0, true);
verifier('et porte l’extension .cyclades', /\.cyclades$/.test(fichier.suggestedFilename()), true);

/*
   COMBIEN D'ÉCRITURES, AU FAIT ?

   L'audit parlait d'une coupure « à la vingtième écriture ». Sur une base
   d'essai, il n'y en a pas vingt, et une coupure armée à vingt ne coupe
   jamais : l'essai passerait au vert sans avoir rien éprouvé. Le seuil est
   donc DÉRIVÉ — on restaure une première fois en comptant, puis on coupe à
   la moitié. Et si la restauration tient en moins de quatre écritures,
   l'essai refuse de juger plutôt que de se déclarer vert.
*/
const restaurerCyclades = async () => {
  await page.locator('#fichier-cyclades').setInputFiles({
    name: 'essai.cyclades',
    mimeType: 'application/octet-stream',
    buffer: octets,
  });
  await page.waitForSelector('#apercu-cyclades:not(.hidden)', { timeout: 60000 });
  await page.fill('#mdp-restauration', MDP);
  /*
     Sans instantané : il appelle `fabriquer()`, qui écrit la date de dernière
     sauvegarde — donc des écritures de plus, et le seuil cesserait de dire ce
     qu'il dit. L'instantané a son propre essai.
  */
  await page.locator('#avec-instantane').uncheck();
  await page.click('#appliquer-cyclades');
  /*
     La boîte commune : remplacer toute la progression est destructeur, donc
     l'écran demande. Un essai qui ne répond pas ne restaure rien — et c'est
     ce qui a d'abord fait croire que la restauration tenait en zéro écriture.
  */
  /*
     G-5 ET G-6 DU 58 — LA BOÎTE EST LUE AVANT D'Y RÉPONDRE.

     C'est la confirmation la plus dangereuse des deux : un effacement se voit
     venir, une restauration se présente comme un gain. Elle annonçait la
     somme de trois magasins — « ce navigateur en porte 31 » à quelqu'un qui en
     portait quatre mille. On vérifie donc qu'elle énumère les rubriques et
     qu'elle donne un total, avant de confirmer.
  */
  await page.waitForSelector('dialog.boite', { timeout: 20000 });
  const texteDeLaBoite = ((await page.locator('dialog.boite').textContent()) ?? '').replace(
    /\s+/g,
    ' ',
  );
  verifier('la confirmation énumère les rubriques', /rubrique par rubrique/.test(texteDeLaBoite), true);
  verifier(
    'et elle donne un total de toutes les rubriques',
    /enregistrement\(s\) en tout/.test(texteDeLaBoite),
    true,
  );
  await repondreALaBoite(page, 'Remplacer', { delai: 20000 });
  await page.waitForTimeout(5000);
};

const compteur = async () =>
  page.evaluate(`
    (() => {
      let vues = 0;
      const vraiPut = IDBObjectStore.prototype.put;
      window.__puts = () => vues;
      IDBObjectStore.prototype.put = function (...args) {
        vues += 1;
        return vraiPut.apply(this, args);
      };
      return 'posé';
    })();
  `);

await compteur();
await restaurerCyclades();
const total = Number(await page.evaluate('window.__puts()'));
console.log(`      écritures d’une restauration complète : ${total}`);
verifier('une restauration complète fait au moins quatre écritures', total >= 4, true);
const seuil = Math.max(2, Math.floor(total / 2));
console.log(`      la coupure sera armée à l’écriture n° ${seuil}`);

/* L'état d'APRÈS : c'est lui qu'une restauration coupée ne doit pas abîmer. */
console.log('\nUN ÉTAT DIFFÉRENT, QUE LA COUPURE NE DOIT PAS ABÎMER');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('input[name="mode"][value="remplacement"]').check();
await page.locator('#fichier').setInputFiles({
  name: 'essai.json',
  mimeType: 'application/json',
  buffer: Buffer.from(sauvegarde(['pendant-1', 'pendant-2']), 'utf8'),
});
await page.waitForTimeout(1800);
verifier('la base porte l’état intermédiaire', await cartesEnBase(), ['pendant-1', 'pendant-2']);

console.log('\nLA COUPURE AU MILIEU DE LA RESTAURATION');
const armee = await page.evaluate(`
  (() => {
    let vues = 0;
    const vraiPut = IDBObjectStore.prototype.put;
    window.__putsCyclades = () => vues;
    IDBObjectStore.prototype.put = function (...args) {
      vues += 1;
      if (vues === ${seuil}) throw new DOMException('Coupure de l’essai.', 'AbortError');
      return vraiPut.apply(this, args);
    };
    return 'posée';
  })();
`);
verifier('la coupure est armée', armee, 'posée');

await restaurerCyclades();

const puts = Number(await page.evaluate('window.__putsCyclades()'));
verifier(
  'la coupure a bien coupé au milieu, et non avant la première écriture',
  puts >= seuil,
  true,
);

console.log('\nL’ÉTAT INTERMÉDIAIRE EST INTACT');
const apresCyclades = await cartesEnBase();
verifier('les deux cartes d’avant la restauration sont là', apresCyclades, [
  'pendant-1',
  'pendant-2',
]);
verifier(
  'et rien de la sauvegarde restaurée n’est passé',
  apresCyclades.filter((id) => id.startsWith('avant-')),
  [],
);
verifier('la base n’est pas vide', apresCyclades.length > 0, true);

const ditCyclades = (await page.locator('#message-cyclades').textContent()) ?? '';
console.log(`      écran : ${ditCyclades.replace(/\s+/g, ' ').slice(0, 140)}`);
/*
   Ce que l'écran doit dire, et ce qu'on ne lui demande pas encore.

   Il ne doit en aucun cas annoncer une réussite : c'est le contrôle qui
   compte, et celui-là est tenu. En revanche il affiche aujourd'hui le
   message brut de l'erreur, et c'est le constat G-13 du même audit — « ne
   jamais montrer un Error.message à l'écran ». Il se corrige à son tour,
   pas ici, et cet essai ne prétend donc pas le couvrir.
*/
verifier(
  'l’écran n’annonce surtout pas une réussite',
  /restauration faite/i.test(ditCyclades),
  false,
);
verifier('et il dit quelque chose', ditCyclades.trim().length > 0, true);

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
