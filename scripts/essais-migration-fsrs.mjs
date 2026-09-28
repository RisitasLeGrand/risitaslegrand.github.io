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

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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

console.log('\nOUVERTURE PAR L’APPLICATION');
await page.goto('http://localhost:4321/progression', { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', 'EFN67');
  await page.click('#bouton-verrou');
  await page.waitForTimeout(2500);
}

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

// Le schéma a continué d'avancer depuis la migration FSRS : version 8 pour le
// journal d'erreurs, version 9 pour les compétences et les difficultés d'items.
// Ce que l'essai surveille reste le même — la base s'ouvre sans rien perdre.
verifier('la base est à la version courante', apres.version, 9);
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
await page.waitForTimeout(1500);
const demarrer = page.getByRole('button', { name: /Commencer|Démarrer|Réviser/i }).first();
if (await demarrer.isVisible().catch(() => false)) {
  await demarrer.click();
  await page.waitForTimeout(1200);
  await page.locator('#carte, #zone-question').first().click().catch(() => {});
  await page.waitForTimeout(600);
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
  await page.waitForTimeout(1200);
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
  console.log('  ✗ aucune session de flashcards à démarrer');
}

await nav.close();
console.log(`\n${echecs ? `✖ ${echecs} échec(s)` : '✓ tout passe'}\n`);
process.exit(echecs ? 1 : 0);
