/**
 * Migration v6 → v7 : le passage de SM-2 à FSRS ne doit rien perdre.
 *
 * L'essai fabrique une base **version 6** complète, avec une carte à l'ancienne
 * forme, puis laisse l'application l'ouvrir en version 7 et vérifie ce qui en
 * ressort. C'est le seul point de cette phase où une erreur détruirait des
 * données réelles : l'historique de révision de la personne. Un essai unitaire
 * ne peut pas le couvrir, parce que la migration vit dans le `upgrade` d'une
 * base IndexedDB — il faut un vrai navigateur, et une vraie base d'avant.
 *
 * La base est créée depuis `robots.txt` : un document de même origine, mais sans
 * le JavaScript du site, sinon l'application ouvrirait la base en version 7
 * avant que l'on ait pu y écrire quoi que ce soit.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { attendreEnBase } from './lib/post-condition.mjs';

const MDP = motDePasseEssais();

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1000, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

let echecs = 0;
const verifier = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};

const ANCIENNE = {
  id: 'carte-heritee',
  ficheId: 'droit-public/fascicule-1/fiche-01',
  matiere: 'Droit public',
  repetitions: 4,
  intervalle: 15,
  facilite: 2.6,
  du: '2026-12-25',
  derniereRevision: '2026-02-10T08:30:00.000Z',
  oublis: 2,
  revisions: 9,
};

console.log('\nFABRICATION D’UNE BASE VERSION 6');
await page.goto('http://localhost:4321/robots.txt', { waitUntil: 'load' });
const cree = await page.evaluate(async (ancienne) => {
  await new Promise((ok) => {
    const r = indexedDB.deleteDatabase('revinsp');
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  });
  const base = await new Promise((ok, ko) => {
    const r = indexedDB.open('revinsp', 6);
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
      const seances = b.createObjectStore('seances', { keyPath: 'id', autoIncrement: true });
      seances.createIndex('jour', 'jour');
      seances.createIndex('theme', 'theme');
      b.createObjectStore('qcmDgfip', { keyPath: 'id' }).createIndex('rubriqueId', 'rubriqueId');
      b.createObjectStore('qcmSessions', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
      b.createObjectStore('relationnel', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
      b.createObjectStore('vmSeuils', { keyPath: 'id' }).createIndex('famille', 'famille');
      b.createObjectStore('vmSessions', { keyPath: 'id', autoIncrement: true }).createIndex('le', 'le');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  await new Promise((ok) => {
    const r = base.transaction('cartes', 'readwrite').objectStore('cartes').put(ancienne);
    r.onsuccess = r.onerror = () => ok();
  });
  // Un repère hors du magasin « cartes », pour vérifier que la migration ne
  // touche que ce qu'elle doit toucher.
  await new Promise((ok) => {
    const r = base
      .transaction('nback', 'readwrite')
      .objectStore('nback')
      .add({ le: '2026-02-01T00:00:00.000Z', n: 3, taux: 0.8, statut: 'terminee', secondes: 90 });
    r.onsuccess = r.onerror = () => ok();
  });
  const version = base.version;
  base.close();
  return version;
}, ANCIENNE);
verifier('base créée en version 6', cree, 6);

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET POURQUOI AUCUNE N'EST UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Cinq temporisations à
   l'aveugle. La plus importante est la première : 2 500 ms couvraient
   l'OUVERTURE DE LA BASE PAR L'APPLICATION, donc la migration de la version 6
   vers la version courante. C'est tout l'objet de l'essai, et la mesurer par
   une durée voulait dire la mesurer par la vitesse de la machine.

   La post-condition est dans la base : la carte migrée porte un état FSRS, et
   les champs SM-2 ont disparu. C'est exactement ce que les constats lisent, et
   `attendreEnBase` du module partagé l'interroge jusqu'à ce qu'elle réponde.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;

console.log('\nOUVERTURE PAR L’APPLICATION');
await page.goto('http://localhost:4321/progression', { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
  /*
     DEUX POST-CONDITIONS, DANS CET ORDRE, et l'ordre est la leçon.

     D'abord le VERROU qui s'en va : la dérivation de la clé est ce que les
     2 500 ms couvraient d'abord. Ma première conversion attendait directement
     l'état migré en base — or le magasin des cartes se lit sans la clé, donc
     la condition était satisfaite pendant que le déverrouillage courait
     encore. L'essai partait alors sur « /flashcards » avant que la session
     n'existe, et retombait sur l'écran d'entrée : « aucune session de
     flashcards à démarrer », sur une application parfaitement saine.

     Ensuite la MIGRATION, qui est l'objet de l'essai.
  */
  await page
    .waitForFunction(
      () => {
        const champ = document.getElementById('champ-mdp');
        return champ === null || champ.getBoundingClientRect().height === 0;
      },
      undefined,
      { timeout: DELAI },
    )
    .catch(() => {});
}
/* La migration est faite quand la carte porte son état FSRS. */
await attendreEnBase(page, 'cartes', (tout) => tout.some((c) => typeof c.fsrs === 'object'), {
  delai: DELAI,
});

const apres = await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const lire = (n, clef) =>
    new Promise((ok) => {
      const r = clef
        ? base.transaction(n).objectStore(n).get(clef)
        : base.transaction(n).objectStore(n).getAll();
      r.onsuccess = () => ok(r.result);
    });
  return {
    version: base.version,
    magasins: [...base.objectStoreNames].sort(),
    carte: await lire('cartes', 'carte-heritee'),
    nback: (await lire('nback')).length,
  };
});

/*
 * Le schéma a continué d'avancer depuis la migration FSRS : 8 pour le journal
 * d'erreurs, 9 pour les compétences et les difficultés d'items, 10 pour les
 * demandes d'aide. Le numéro était recopié ici, et l'essai échouait à chaque
 * magasin ajouté — en signalant une régression là où il n'y avait qu'une
 * constante oubliée. Il est désormais lu dans `db.ts`, qui en est la source :
 * une base qui s'ouvre sur une version plus ancienne reste une vraie
 * régression, et c'est bien ce qui est surveillé.
 */
const VERSION_ATTENDUE = Number(
  /const VERSION = (\d+)/.exec(await readFile('src/lib/db.ts', 'utf8'))?.[1],
);
verifier('la base est à la version courante', apres.version, VERSION_ATTENDUE);
verifier('aucun magasin perdu', apres.magasins.length >= 12, true);
verifier('les autres magasins sont intacts', apres.nback, 1);

console.log('\nCE QUE LA CARTE DEVIENT');
const c = apres.carte ?? {};
verifier('la carte existe encore', Boolean(apres.carte), true);
verifier('la fiche est conservée', c.ficheId, ANCIENNE.ficheId);
verifier('la matière est conservée', c.matiere, ANCIENNE.matiere);
verifier('l’échéance acquise est conservée', c.du, ANCIENNE.du);
verifier('l’intervalle est conservé', c.intervalle, ANCIENNE.intervalle);
verifier('l’histoire est conservée', [c.revisions, c.oublis], [9, 2]);
verifier('la dernière révision est conservée', c.derniereRevision, ANCIENNE.derniereRevision);
verifier('un état FSRS est présent', typeof c.fsrs, 'object');
verifier('cet état est neuf', [c.fsrs?.state, c.fsrs?.reps, c.fsrs?.lapses], [0, 0, 0]);
verifier('sa date est une chaîne ISO', typeof c.fsrs?.due, 'string');
verifier('les champs SM-2 ont disparu', [c.facilite, c.repetitions], [undefined, undefined]);

console.log('\nUNE SESSION DE FLASHCARDS À QUATRE BOUTONS');
await page.goto('http://localhost:4321/flashcards', { waitUntil: 'networkidle' });
/*
   L'ÉCRAN PROPOSE DE COMMENCER, ou il n'a rien à réviser : les deux cas sont
   prévus plus bas, donc l'attente porte sur l'un OU l'autre et n'impose rien.
*/
await page
  .waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some((b) =>
        /Commencer|Démarrer|Réviser/i.test(b.textContent ?? ''),
      ) || document.querySelector('[data-rien-a-reviser], #rien-a-reviser') !== null,
    undefined,
    { timeout: DELAI },
  )
  .catch(() => {});
const demarrer = page.getByRole('button', { name: /Commencer|Démarrer|Réviser/i }).first();
if (await demarrer.isVisible().catch(() => false)) {
  await demarrer.click();
  /* La carte posée, on la retourne : le clic attend son élément de lui-même. */
  await page
    .locator('#carte, #zone-question')
    .first()
    .waitFor({ state: 'visible', timeout: DELAI })
    .catch(() => {});
  await page.locator('#carte, #zone-question').first().click().catch(() => {});
  /* Retournée, la carte montre ses quatre appuis avec leurs délais. */
  await page
    .waitForFunction(() => document.querySelector('[data-delai-correct]') !== null, undefined, {
      timeout: DELAI,
    })
    .catch(() => {});
  const notes = ['oublie', 'difficile', 'correct', 'facile'];
  const libelles = [];
  for (const note of notes) {
    libelles.push(await page.locator(`[data-delai-${note}]`).textContent().catch(() => null));
  }
  verifier('les quatre boutons existent', libelles.every((t) => t !== null), true);
  verifier('et annoncent tous un délai', libelles.every((t) => (t ?? '').trim().length > 0), true);
  console.log(`      délais affichés : ${libelles.map((t) => `« ${t} »`).join(', ')}`);

  const avant = await page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    return await new Promise((ok) => {
      const r = base.transaction('cartes').objectStore('cartes').getAll();
      r.onsuccess = () => ok(r.result.length);
    });
  });
  await page.getByRole('button', { name: /^Correct/ }).first().click();
  /* La note part en base : la carte la plus récemment révisée porte une
     répétition de plus. C'est ce que le constat suivant relit. */
  await attendreEnBase(page, 'cartes', (tout) => tout.some((c) => (c.fsrs?.reps ?? 0) > 0), {
    delai: DELAI,
  });
  const notee = await page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const toutes = await new Promise((ok) => {
      const r = base.transaction('cartes').objectStore('cartes').getAll();
      r.onsuccess = () => ok(r.result);
    });
    const recente = toutes
      .filter((c) => c.id !== 'carte-heritee' && c.revisions > 0)
      .sort((a, b) => String(b.derniereRevision).localeCompare(String(a.derniereRevision)))[0];
    return { total: toutes.length, recente };
  });
  verifier('une carte a été enregistrée', notee.total > avant || Boolean(notee.recente), true);
  verifier('elle porte un état FSRS', typeof notee.recente?.fsrs, 'object');
  verifier('son état n’est plus « nouveau »', notee.recente?.fsrs?.state !== 0, true);
  verifier('elle est programmée au-delà d’aujourd’hui', notee.recente?.intervalle >= 1, true);
  verifier('« du » suit l’échéance du modèle', notee.recente?.du, String(notee.recente?.fsrs?.due).slice(0, 10));
} else {
  echecs += 1;
  /*
     DIT CE QU'ON A VU, et pas seulement qu'on n'a pas vu ce qu'on cherchait :
     un rouge muet sur cette branche se cherche à l'aveugle, et il m'a coûté
     deux passages.
  */
  const vus = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[role="button"], a.cible-tactile')]
      .filter((e) => e.getBoundingClientRect().height > 0)
      .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40))
      .slice(0, 12),
  );
  console.log(`      appuis visibles : ${vus.map((v) => `« ${v} »`).join(', ') || '— aucun'}`);
  console.log(`      chemin : ${new URL(page.url()).pathname}`);
  console.log('  ✗ aucune session de flashcards à démarrer');
}

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
process.exit(echecs ? 1 : 0);
