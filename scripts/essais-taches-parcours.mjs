/**
 * Le parcours complet d'une tâche répétée — le contrôle qui manquait.
 *
 *   npm run essais:taches-parcours
 *
 * **Ce contrôle est rouge, et il doit l'être.** Il n'éprouve pas un moteur :
 * il éprouve la chaîne entière, de l'écran jusqu'à ce qui est écrit en base.
 * Je l'avais déclaré manquant au compte rendu de la phase 9 — « aucun
 * parcours complet : créer une tâche répétée, la pointer, vérifier
 * l'occurrence écrite » — et l'écrire a montré ce que son absence cachait :
 *
 * > Les phases 5, 6 et 7 du prompt 38 — `pointage-partage.ts`,
 * > `retour-de-branche.ts`, `coffre-ferme.ts` et le registre
 * > `liaison-branches.ts` — **ne sont appelées par aucun écran**. Leurs
 * > essais sont verts et leur code est mort.
 *
 * Conséquence visible, et c'est ce que les assertions ci-dessous mesurent :
 * le bouton « Faite » appelle `clore(tache.id, true)` quelle que soit la
 * tâche. Une tâche répétée pointée une fois porte dès lors un `faiteLe`,
 * sort de la liste des ouvertes et **n'y revient jamais** ; aucune
 * occurrence n'est écrite ; aucun fait n'est rendu à la branche.
 *
 * Les assertions disent donc ce qui **devrait** être, pas ce qui est. C'est
 * délibéré : figer le comportement observé en assertion verte est l'erreur
 * exacte que la phase 5 avait commise avec A-4, et que la phase 6 avait dû
 * défaire. Un contrôle qui se contente de décrire le défaut ne le signale
 * plus.
 *
 * Il passera au vert quand l'anomalie A-9 sera corrigée — pas avant, et
 * aucune de ses lignes ne doit être assouplie pour l'y aider.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

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
    console.log(
      `      obtenu  ${JSON.stringify(obtenu)?.slice(0, 220)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 220)}`,
    );
  }
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

const deverrouiller = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
};
const allerAuxTaches = async () => {
  await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await page.waitForTimeout(700);
};

/** Lit les deux magasins en base, comme le ferait un autre onglet. */
const lireLaBase = () =>
  page.evaluate(async () => {
    const db = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const lire = (m) =>
      new Promise((ok) => {
        if (![...db.objectStoreNames].includes(m)) return ok([]);
        const r = db.transaction(m).objectStore(m).getAll();
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ok([]);
      });
    return { taches: await lire('odysseeTaches'), occurrences: await lire('odysseeOccurrences') };
  });

await franchirInitialisation(page, RACINE, MDP);
await allerAuxTaches();

/* ── 1. Créer une tâche répétée depuis l'écran ─────────────────────────── */
console.log('\n\x1b[1mCréer une tâche « chaque jour » depuis l’écran\x1b[0m');

await page.locator('details', { hasText: 'Répéter' }).first().evaluate((d) => d.setAttribute('open', ''));
await page.fill('#titre', 'Parcours bout en bout');
await page.selectOption('#champs-serie select[data-regle]', 'jours');
await page.locator('#champs-serie input[type="number"]').first().fill('1');
await page.fill('#echeance', AUJOURDHUI);
await page.click('#ajouter');
await page.waitForTimeout(900);

v('aucune erreur d’ajout', (await page.locator('#erreur-ajout').textContent()).trim(), '');
const apresAjout = await lireLaBase();
const creee = apresAjout.taches.find((t) => t.titre === 'Parcours bout en bout');
vrai('la tâche est en base', Boolean(creee));
v('elle porte sa règle de répétition', creee?.serie?.repetition, { type: 'jours', tous: 1 });
vrai('la liste des ouvertes la montre', (await page.locator('#ouvertes').innerText()).includes('Parcours bout en bout'));

/* ── 2. La pointer ─────────────────────────────────────────────────────── */
console.log('\n\x1b[1mPointer l’occurrence du jour\x1b[0m');

await page.locator(`[data-faire="${creee.id}"]`).click();
await page.waitForTimeout(900);
const apresPointage = await lireLaBase();
const pointee = apresPointage.taches.find((t) => t.id === creee.id);

/*
   LE CŒUR DU CONTRÔLE. Pointer une tâche répétée est un geste sur UNE
   occurrence, pas sur la série. Deux choses doivent se produire, et aucune
   ne se produit aujourd'hui.
*/
v(
  'une occurrence du jour est écrite',
  apresPointage.occurrences.filter((o) => o.tacheId === creee.id && o.jour === AUJOURDHUI).length,
  1,
);
v('et la tâche elle-même n’est PAS close : la série continue', pointee?.faiteLe ?? null, null);

/* ── 3. Elle revient demain ────────────────────────────────────────────── */
console.log('\n\x1b[1mLa série survit au pointage\x1b[0m');

await allerAuxTaches();
const ouvertesApres = await page.locator('#ouvertes').innerText();
vrai(
  'la tâche répétée est toujours dans les ouvertes après rechargement',
  ouvertesApres.includes('Parcours bout en bout'),
);
v(
  'et elle n’est pas rangée dans les closes',
  (await page.locator('#closes').innerText()).includes('Parcours bout en bout'),
  false,
);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent — A-9 est corrigée.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s) — A-9 tient toujours, et c’est ce que ce contrôle dit.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
