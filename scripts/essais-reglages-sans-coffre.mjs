/**
 * Effacer « Réglages et profil » ne doit pas condamner le coffre — B-3 du 58.
 *
 * ## L'anomalie que cet essai constate
 *
 * Le groupe « Réglages et profil » désignait le magasin `etat` **entier**.
 * Or `etat` ne porte pas que des réglages : il porte le sel et l'enveloppe
 * de la clé du coffre, l'identité de l'appareil, son horloge logique et la
 * paire de clés de sa boîte aux lettres. Un écran qui annonçait « votre
 * profil, vos réglages de séance » retirait donc la clé du coffre, et le
 * coffre ne se rouvrait plus — **avec le bon mot de passe**, sans un mot
 * d'avertissement, et sans recours.
 *
 * ## Pourquoi un essai de navigateur, et pas un essai de liste
 *
 * `essais-effacement.mts` compare des listes : il dit qu'aucune clé
 * technique n'a glissé dans une liste blanche. C'est de la mécanique, et
 * c'est utile. Mais la mécanique ne prouve pas le comportement : seule
 * compte la question « le coffre se rouvre-t-il ? », et elle ne se pose
 * qu'à un vrai coffre, dans un vrai navigateur, avec un vrai mot de passe.
 *
 * L'essai part donc d'une route, clique ce que la personne clique, et
 * constate le résultat à l'écran.
 *
 * ## Le dernier contrôle, qui vaut pour l'avenir
 *
 * Il relève toutes les clés réellement présentes dans `etat` et vérifie que
 * chacune est classée : réglage, clé d'un domaine, ou clé technique. Le jour
 * où une clé nouvelle apparaîtra sans classement, cet essai le dira — avant
 * la personne qui efface.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaRedemande } from './lib/boite-essais.mjs';
import {
  CLEFS_ODYSSEE_ETAT,
  CLEFS_PERSONNELLES_ETAT,
  PREFIXES_PERSONNELS_ETAT,
  estTechnique,
} from '../src/lib/sauvegarde/groupes.ts';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1100 }, acceptDownloads: true });
const page = await ctx.newPage();
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

/** Toutes les clés du magasin `etat`, telles qu'elles sont. */
const clefsEtat = () =>
  page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          const q = base.transaction('etat').objectStore('etat').getAllKeys();
          q.onsuccess = () => {
            base.close();
            ok(q.result.map(String).sort());
          };
        };
      }),
  );

/* ── Un coffre ouvert, et des réglages à effacer ──────────────────────── */

console.log('\nUN COFFRE OUVERT, ET DES RÉGLAGES À EFFACER');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

/*
   Le coffre se crée au premier déverrouillage. On passe par un écran qui le
   demande — Psyché est sous coffre — plutôt que par un appel direct : c'est
   le geste de la personne, et c'est lui qui pose le sel et l'enveloppe.
*/
const ouvrirLeCoffre = async () => {
  const champ = page.locator('#mdp-coffre');
  await champ.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await champ.isVisible().catch(() => false))) return false;
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  await page.locator('#coffre-ferme').waitFor({ state: 'hidden', timeout: 20000 });
  return true;
};

await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await connecter();
v('le coffre demande son mot de passe', await ouvrirLeCoffre(), true);

const avant = await clefsEtat();
v(
  'le coffre a posé son sel dans « etat »',
  avant.some((c) => c.startsWith('coffre.')),
  true,
);

// Des réglages à effacer : un profil, et un réglage à nom variable.
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const base = r.result;
        const tx = base.transaction('etat', 'readwrite');
        const etat = tx.objectStore('etat');
        etat.put({ prenom: 'Essai', majLe: '2026-10-19T10:00:00.000Z' }, 'profil');
        etat.put({ unites: ['a'], items: 12, ordre: 'entrelace', modeLibre: false }, 'selection:nback');
        /* Le registre versionné, tel que la synchronisation le tient. */
        etat.put(
          {
            profil: {
              valeur: { prenom: 'Essai' },
              hlc: '0000000000001-0000-ESSAI',
              appareil: 'ESSAI',
            },
          },
          'reglagesSync',
        );
        tx.oncomplete = () => {
          base.close();
          ok();
        };
      };
    }),
);

const pose = await clefsEtat();
v('« profil » est en place', pose.includes('profil'), true);
v('« selection:nback » est en place', pose.includes('selection:nback'), true);

/* ── L'export lisible ne sort plus le sel ─────────────────────────────── */

console.log('\nL’EXPORT LISIBLE NE SORT PLUS LE SEL — G-8');

/*
   La même déclaration sert à l'export : un groupe qui ne désigne que des
   clés n'exporte que celles-là. Avant, « Réglages et profil » exportait le
   magasin `etat` entier, donc le sel du coffre, ses enveloppes et le secret
   d'appairage — en clair, sur le disque. C'est le constat G-8, et il se
   règle par la liste, pas par un filtre séparé qu'il aurait fallu tenir à
   jour deux fois.
*/
await page.goto(`${RACINE}/stockage/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForSelector('#groupes-export input[value="reglages"]', { timeout: 20000 });
await page.check('#groupes-export input[value="reglages"]');
const attendu = page.waitForEvent('download', { timeout: 60000 });
await page.click('#exporter-json');
await repondreALaRedemande(page, MDP);
const fichier = await attendu;
const { readFile } = await import('node:fs/promises');
const json = await readFile(await fichier.path(), 'utf8');

v('le profil est bien exporté', json.includes('"profil"'), true);
v('le réglage à nom variable aussi', json.includes('selection:nback'), true);
v('le sel du coffre ne sort pas', /coffre\.sel/.test(json), false);
v('les enveloppes du coffre ne sortent pas', /coffre\.enveloppe|sel-enveloppe/.test(json), false);
v('la clé privée de la boîte ne sort pas', /boite\.privee/.test(json), false);
v('l’identité de l’appareil ne sort pas', /"appareil"/.test(json), false);

/* ── L'effacement, depuis l'écran ─────────────────────────────────────── */

console.log('\nL’EFFACEMENT, DEPUIS L’ÉCRAN');

await page.goto(`${RACINE}/stockage/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForSelector('#groupes-effacement input[value="reglages"]', { timeout: 20000 });

const caseReglages = page.locator('#groupes-effacement input[value="reglages"]');
v('« Réglages et profil » est proposé à l’effacement', await caseReglages.isDisabled(), false);
await caseReglages.check();

/*
   D'abord une période, parce que la liste blanche ne doit pas la court-
   circuiter. `etat` porte un état courant et non un historique : une période
   ne le découpe pas, et le magasin doit être laissé entier — comme avant la
   B-3. Compter les clés visées sans regarder la période aurait effacé TOUS
   les réglages sous prétexte qu'on en demandait une tranche.
*/
await page.fill('#depuis', '2024-01-01');
await page.fill('#jusqua', '2024-12-31');
await page.click('#compter');
await page.waitForSelector('#decompte:not(.hidden)', { timeout: 15000 });
const refus = ((await page.locator('#decompte-refus').textContent()) ?? '').trim();
v('une période laisse « etat » entier', /laissés entiers\s*:\s*etat/i.test(refus), true);
v(
  'et l’écran annonce que rien ne serait effacé',
  ((await page.locator('#decompte-total').textContent()) ?? '').trim(),
  'Rien ne serait effacé avec ce choix.',
);
await page.fill('#depuis', '');
await page.fill('#jusqua', '');

await page.click('#compter');
await page.waitForSelector('#decompte:not(.hidden)', { timeout: 15000 });

const annonce = ((await page.locator('#decompte-detail').textContent()) ?? '').trim();
console.log(`      annoncé : ${annonce.replace(/\s+/g, ' ').slice(0, 160)}`);
/*
   Le compte annoncé doit être celui des clés visées, et non celui du magasin
   entier. Deux réglages sont posés ; les clés techniques ne comptent pas.
*/
v('le décompte annonce 2 enregistrements visés', /\b2\b/.test(annonce), true);

await page.click('#effacer-sans');
await repondreALaRedemande(page, MDP);
await page.waitForFunction(
  () => (document.getElementById('message-effacement')?.textContent ?? '').includes('effacés'),
  undefined,
  { timeout: 20000 },
);
console.log(
  `      message : ${((await page.locator('#message-effacement').textContent()) ?? '').trim()}`,
);

const apres = await clefsEtat();
v('« profil » est parti', apres.includes('profil'), false);
v('« selection:nback » est parti', apres.includes('selection:nback'), false);
v(
  'le sel et l’enveloppe du coffre sont restés',
  apres.filter((c) => c.startsWith('coffre.')).length,
  avant.filter((c) => c.startsWith('coffre.')).length,
);
v('l’identité de l’appareil est restée', apres.includes('appareil'), true);
/*
   Et le contrôle qui ne dépend pas du scénario : toute clé technique qui
   était là avant est encore là. Nommer `horloge` en dur aurait fait échouer
   l'essai pour une mauvaise raison — elle n'est écrite qu'à la première
   opération journalisée, et ce scénario n'en fait aucune.
*/
v(
  'aucune clé technique présente n’a disparu',
  pose.filter(estTechnique).filter((c) => !apres.includes(c)),
  [],
);

/* ── L'effacement ciblé se propage — A7 du 58 ─────────────────────────── */

console.log('\nL’EFFACEMENT CIBLÉ POSE UNE PIERRE TOMBALE');

/*
   Sans pierre tombale, l'effacement ne se propageait pas. Le registre
   versionné est fusionné champ par champ : un champ absent chez l'un se prend
   simplement chez l'autre, donc le profil effacé revenait à la première
   synchronisation, avec sa valeur et son horloge. Retirer l'entrée ne suffit
   pas ; il faut une marque horodatée, qui gagne par l'horloge.
*/
const registre = await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const base = r.result;
        const q = base.transaction('etat').objectStore('etat').get('reglagesSync');
        q.onsuccess = () => {
          base.close();
          ok(q.result ?? null);
        };
      };
    }),
);
v('le registre existe toujours', registre !== null, true);
v('l’entrée du profil n’est pas retirée', 'profil' in (registre ?? {}), true);
v('elle porte la marque d’effacement', registre?.profil?.efface, true);
v('elle ne transporte plus aucune valeur', registre?.profil?.valeur, null);
v(
  'et son horloge a avancé',
  (registre?.profil?.hlc ?? '') > '0000000000001-0000-ESSAI',
  true,
);

/* ── Et c'est la seule question qui compte ────────────────────────────── */

console.log('\nLE COFFRE SE ROUVRE AVEC LE BON MOT DE PASSE');

/*
   On referme le coffre, puis on le rouvre avec le bon mot de passe. C'est le
   geste du lendemain matin, et c'est celui qui échouait : sans `coffre.sel`
   ni enveloppe, la clé ne se redérive plus, et aucun mot de passe ne la
   retrouve.

   Un second onglet n'aurait rien prouvé : le relais lui passe la clé déjà
   ouverte (`coffre-relais.ts`), donc il ne redemande rien et ne redérive
   rien.
*/
await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForSelector('#fermer-coffre', { timeout: 20000 });
await page.click('#fermer-coffre');
await page.locator('#coffre-ferme').waitFor({ state: 'visible', timeout: 15000 });
v('le coffre est bien refermé', await page.locator('#mdp-coffre').isVisible(), true);

await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
const rouvert = await page
  .locator('#coffre-ferme')
  .waitFor({ state: 'hidden', timeout: 20000 })
  .then(() => true)
  .catch(() => false);
v('le coffre se rouvre avec le bon mot de passe', rouvert, true);

const ecran = ((await page.locator('body').textContent()) ?? '').replace(/\s+/g, ' ');
v(
  'aucun message d’échec de déverrouillage',
  /mot de passe (incorrect|ne correspond)|impossible de déchiffrer|coffre illisible/i.test(ecran),
  false,
);
v(
  'la clé de session est rangée de nouveau',
  await page.evaluate(() => sessionStorage.getItem('cyclades.coffre') !== null),
  true,
);

/* ── Toute clé d'« etat » est classée ─────────────────────────────────── */

console.log('\nTOUTE CLÉ D’« ETAT » EST CLASSÉE');

const visee = (clef) =>
  CLEFS_PERSONNELLES_ETAT.includes(clef) ||
  CLEFS_ODYSSEE_ETAT.includes(clef) ||
  PREFIXES_PERSONNELS_ETAT.some((p) => clef.startsWith(p));

const finales = await clefsEtat();
console.log(`      clés présentes : ${finales.join(', ')}`);
v(
  'aucune clé d’« etat » n’échappe au classement',
  finales.filter((c) => !visee(c) && !estTechnique(c)),
  [],
);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
process.exit(echecs === 0 ? 0 : 1);
