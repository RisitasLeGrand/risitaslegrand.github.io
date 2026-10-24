/**
 * Deux onglets qui veulent la base en même temps (A8 du prompt 43).
 *
 *   npm run essais:base-concurrente
 *
 * ## Le défaut
 *
 * IndexedDB ne change pas de version pendant qu'une autre connexion est
 * ouverte, et il le signale par trois rappels qu'aucun code ne branchait :
 *
 * - `blocked` : nous voulons migrer, un autre onglet tient l'ancienne version.
 *   L'ouverture **ne rejette pas** : elle attend, indéfiniment. L'écran reste
 *   sur « Déchiffrement en cours… » sans jamais rien dire — le symptôme même
 *   que le prompt 22 avait traqué ailleurs.
 * - `blocking` : un autre onglet veut migrer, et c'est nous qui tenons la base.
 *   Sans gestionnaire, nous ne lâchons rien et c'est l'autre onglet qui attend
 *   pour toujours.
 * - `terminated` : le navigateur a coupé la connexion de lui-même.
 *
 * ## Ce que cet essai éprouve, et comment
 *
 * Deux parcours en navigateur, chacun dans son contexte — donc sa propre base.
 *
 * 1. **`blocking`** : la page de l'application tient la base en version
 *    courante ; on ouvre depuis elle une connexion brute à la version
 *    suivante, ce qu'un onglet mis à jour ferait. Deux constats : l'écran dit
 *    ce qui se passe, ET l'ouverture brute aboutit — preuve que la connexion
 *    de l'application a réellement été fermée. Sans fermeture, cette seconde
 *    ouverture resterait bloquée, et l'essai le verrait par son délai.
 * 2. **`blocked`** : un onglet quelconque du même site tient une base en
 *    version 32 ; l'application s'ouvre ensuite et doit donc migrer vers 33.
 *    Elle attend — c'est le comportement d'IndexedDB, pas un défaut — mais
 *    elle doit le DIRE. L'onglet qui tient est une page vide servie sur la
 *    même origine : la seule chose qui compte est qu'elle tienne une
 *    connexion, et une page de l'application l'aurait migrée d'elle-même.
 *
 * ## Ce que cet essai ne peut pas éprouver
 *
 * `terminated` : aucun moyen, depuis une page, de faire couper la connexion
 * par le navigateur. Il n'est que **lu dans le code**, et l'essai le dit tel
 * quel au lieu de faire croire qu'il l'a vu.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
process.on('uncaughtException', (e: unknown) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

/* La version du schéma est lue dans la source : elle montera encore. */
const source = readFileSync('src/lib/db.ts', 'utf8');
const VERSION = Number(/const VERSION = (\d+);/.exec(source)?.[1]);
if (!Number.isInteger(VERSION) || VERSION < 1) {
  console.log('\x1b[31m✗\x1b[0m PANNE — version du schéma illisible dans src/lib/db.ts.');
  process.exit(1);
}
const ID_REGION = '#echec-de-page';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Déverrouille si le coffre est demandé, et attend que la page vive. */
async function deverrouiller(page: import('playwright-core').Page) {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(2500);
  }
}

/* ══ 1. blocking : nous tenons la base, un autre onglet veut migrer ══════ */

console.log('\n\x1b[1mQUAND UN AUTRE ONGLET VEUT MIGRER, CELUI-CI LÂCHE ET LE DIT\x1b[0m\n');

{
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  /* La page doit vraiment tenir la base avant qu'on la bouscule. */
  await page.waitForSelector('#sauvegarder', { timeout: 40000 });

  /*
     Une ouverture brute à la version suivante, comme le ferait un onglet
     chargé après une mise à jour du site. Elle rend l'un de trois mots :
     « ouverte » (notre connexion a lâché), « bloquee » (elle n'a pas lâché),
     ou « erreur ». Le délai de 8 s distingue les deux premiers : sans
     gestionnaire, rien ne se passe jamais.
  */
  const issue = await page.evaluate(`(async () => {
    const demande = indexedDB.open('revinsp', ${VERSION + 1});
    return await new Promise((resoudre) => {
      let bloquee = false;
      demande.onblocked = () => { bloquee = true; };
      demande.onsuccess = () => { demande.result.close(); resoudre('ouverte'); };
      demande.onerror = () => resoudre('erreur : ' + (demande.error?.name ?? '?'));
      setTimeout(() => resoudre(bloquee ? 'bloquee' : 'rien'), 8000);
    });
  })()`);

  const visible = await page.locator(ID_REGION).isVisible().catch(() => false);
  const texte = visible ? ((await page.locator(ID_REGION).textContent()) ?? '') : '';

  v('l’écran dit qu’un autre onglet met la base à jour', /autre onglet met la base à jour/.test(texte), true);
  v('et il dit qu’il faut recharger avant de continuer', /rechargez/i.test(texte), true);
  v('la connexion a été lâchée : l’autre ouverture aboutit', issue, 'ouverte');

  await ctx.close();
}

/* ══ 2. blocked : un autre onglet tient l'ancienne version ═══════════════ */

console.log('\n\x1b[1mQUAND UN AUTRE ONGLET TIENT L’ANCIENNE VERSION, L’ATTENTE EST DITE\x1b[0m\n');

{
  const ctx = await nav.newContext();
  /*
     Une page vide sur la même origine, donc la même base : l'onglet qui
     tient n'a pas besoin d'être une page de l'application — et ne doit même
     pas l'être, puisqu'une page de l'application migrerait la base d'office.
  */
  await ctx.route('**/essai-onglet-qui-tient', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>onglet</title>' }),
  );
  const tenu = await ctx.newPage();
  await tenu.goto(`${RACINE}/essai-onglet-qui-tient`);

  const prete = await tenu.evaluate(`(async () => {
    await new Promise((resoudre) => {
      const effacement = indexedDB.deleteDatabase('revinsp');
      effacement.onsuccess = () => resoudre(null);
      effacement.onerror = () => resoudre(null);
      effacement.onblocked = () => resoudre(null);
    });
    return await new Promise((resoudre) => {
      const demande = indexedDB.open('revinsp', ${VERSION - 1});
      demande.onupgradeneeded = () => {
        if (!demande.result.objectStoreNames.contains('etat')) {
          demande.result.createObjectStore('etat');
        }
      };
      demande.onsuccess = () => {
        /* Tenue ouverte, et SANS gestionnaire de « versionchange » : c'est un
           onglet qui ne lâchera pas de lui-même. */
        globalThis.__tenue = demande.result;
        resoudre(demande.result.version);
      };
      demande.onerror = () => resoudre('erreur : ' + (demande.error?.name ?? '?'));
    });
  })()`);
  v(`l’onglet tient bien une base en version ${VERSION - 1}`, prete, VERSION - 1);

  const page = await ctx.newPage();
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'domcontentloaded' });
  await deverrouiller(page);
  /*
     On attend le message, pas la page : l'ouverture est bloquée, donc la page
     ne finira pas de se charger — c'est exactement la situation à dire.
  */
  const vu = await page
    .waitForSelector(`${ID_REGION}:visible`, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  const texte = vu ? ((await page.locator(ID_REGION).textContent()) ?? '') : '';

  v('l’attente est dite au lieu d’être subie', vu, true);
  v('le message nomme l’autre onglet', /un autre onglet l’utilise encore/.test(texte), true);
  v('il dit quoi faire', /Fermez les autres onglets[\s\S]*rechargez/i.test(texte), true);
  v('et il rassure sur les données', /Rien n’a été modifié/.test(texte), true);
  v(
    'il nomme les deux versions en jeu',
    new RegExp(`${VERSION - 1}[^0-9]{0,20}${VERSION}`).test(texte),
    true,
  );

  await ctx.close();
}

await nav.close();

/* ══ 3. Ce qui n'est que lu dans le code ═════════════════════════════════ */

console.log('\n\x1b[1mLU DANS LE CODE, NON ÉPROUVÉ EN NAVIGATEUR\x1b[0m\n');

{
  /* Aucune page ne peut faire couper la connexion par le navigateur. */
  const corps = /terminated\(\)\s*\{([\s\S]*?)\n    \},/.exec(source)?.[1] ?? '';
  v('« terminated » est branché', corps.length > 0, true);
  v('il dit ce qui est arrivé', /direEnDehorsDeTouteAction/.test(corps), true);
  v('et il vide le cache d’ouverture', /promesse = null/.test(corps), true);
  console.log(
    '      \x1b[33mnon éprouvé\x1b[0m : le navigateur seul déclenche « terminated ».',
  );
}

console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m\n'
    : `\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m\n`,
);
process.exit(rouges === 0 ? 0 : 1);
