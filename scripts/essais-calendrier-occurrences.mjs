/**
 * Les tâches prévues sur le calendrier — prompt 39, phase 5b, anomalie A-8.
 *
 *   npm run essais:calendrier-occurrences
 *
 * Le moteur d'occurrences est éprouvé ailleurs, et purement
 * (`essais:occurrences-fenetre`). Ce contrôle-ci éprouve la **chaîne** :
 * de la tâche créée à l'écran jusqu'à ce que le calendrier en montre, et
 * jusqu'à ce qu'un pointage fait depuis le calendrier écrive en base.
 *
 * C'est le contrôle qui manquait à la phase 4 : `tsc`, la construction et
 * les essais de module étaient tous verts pendant que l'écran des tâches
 * ne s'affichait plus. Seul un essai qui part d'une route voit cela.
 *
 * Quatre choses s'éprouvent :
 *
 * - **le calendrier montre les occurrences**, sous les événements et non
 *   mêlées à eux — c'est l'anomalie A-8, ouverte depuis le prompt 38 ;
 * - **un jour qui ne porte qu'une occurrence n'est plus sauté en vue
 *   mois.** Il l'était, et c'était la forme visible du défaut : un mois
 *   entier affiché vide alors qu'une séance y était prévue chaque jour ;
 * - **pointer depuis le calendrier écrit la même chose que pointer depuis
 *   l'écran des tâches** — une occurrence, pas une clôture ;
 * - **le bouton « Programmer une tâche répétée » emmène** sur l'écran des
 *   tâches avec le jour, la série dépliée et le retour, plutôt que de
 *   monter ici un second formulaire de création.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const TITRE = 'Occurrence vue du calendrier';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(
      `      obtenu  ${JSON.stringify(obtenu)?.slice(0, 260)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 260)}`,
    );
  }
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
const erreursDePage = [];
page.on('pageerror', (e) => erreursDePage.push(e.message.slice(0, 200)));

const deverrouiller = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
};
const aller = async (route) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await page.waitForTimeout(800);
};

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

/* ── 1. Une tâche quotidienne, créée depuis l'écran des tâches ─────────── */
console.log('\n\x1b[1mUne tâche quotidienne existe\x1b[0m');

await aller('/odyssee/taches/');
await page.locator('details', { hasText: 'Répéter' }).first().evaluate((d) => d.setAttribute('open', ''));
await page.fill('#titre', TITRE);
await page.selectOption('#champs-serie select[data-regle]', 'jours');
await page.locator('#champs-serie input[type="number"]').first().fill('1');
await page.fill('#echeance', AUJOURDHUI);
await page.click('#ajouter');
await page.waitForTimeout(900);

const creee = (await lireLaBase()).taches.find((t) => t.titre === TITRE);
vrai('la tâche répétée est en base', Boolean(creee));

/* ── 2. Le calendrier la montre, en vue jour ───────────────────────────── */
console.log('\n\x1b[1mLe calendrier montre les tâches prévues — A-8\x1b[0m');

await aller('/odyssee/calendrier/');
await page.locator('[data-vue="jour"]').click();
await page.waitForTimeout(700);

vrai(
  'la liste « Tâches prévues » existe pour aujourd’hui',
  await page.locator(`[data-titre-taches="${AUJOURDHUI}"]`).isVisible(),
);
vrai(
  'et elle porte le titre de la tâche',
  (await page.locator(`[data-taches="${AUJOURDHUI}"]`).innerText()).includes(TITRE),
);
/*
   Deux listes, pas une. Une occurrence n'a ni durée ni lieu : la mêler aux
   événements fausserait les conflits et la surcharge de la journée.
*/
v(
  'l’occurrence n’est pas rangée parmi les événements',
  await page.locator(`[data-taches="${AUJOURDHUI}"] [data-evenement]`).count(),
  0,
);

/* ── 3. Pointer depuis le calendrier ───────────────────────────────────── */
console.log('\n\x1b[1mPointer depuis le calendrier écrit une occurrence\x1b[0m');

await page.locator(`[data-pointer="${creee.id}:${AUJOURDHUI}"]`).click();
await page.waitForTimeout(900);

const apres = await lireLaBase();
const ecrites = apres.occurrences.filter(
  (o) => o.tacheId === creee.id && o.jourPrevu === AUJOURDHUI,
);
v('une occurrence du jour est écrite', ecrites.length, 1);
v('et elle est pointée', ecrites[0]?.etat ?? null, 'pointee');
v(
  'la tâche elle-même n’est pas close : la série continue',
  apres.taches.find((t) => t.id === creee.id)?.faiteLe ?? null,
  null,
);
vrai(
  'le calendrier propose désormais de défaire',
  await page.locator(`[data-depointer="${creee.id}:${AUJOURDHUI}"]`).isVisible(),
);
v(
  'et ne propose plus de pointer',
  await page.locator(`[data-pointer="${creee.id}:${AUJOURDHUI}"]`).count(),
  0,
);

/* ── 4. La vue mois ────────────────────────────────────────────────────── */
console.log('\n\x1b[1mEn vue mois : une ligne compacte, et le jour n’est plus sauté\x1b[0m');

await page.locator('[data-vue="mois"]').click();
await page.waitForTimeout(900);

vrai(
  'le jour d’aujourd’hui a une ligne, alors qu’il n’a aucun événement',
  await page.locator(`section[data-jour="${AUJOURDHUI}"]`).isVisible(),
);
const compacte = page.locator(`[data-compacte-taches="${AUJOURDHUI}"]`);
vrai('il porte une ligne compacte', await compacte.isVisible());
vrai('qui compte les tâches', (await compacte.innerText()).includes('tâche'));
/* La liste détaillée n'est PAS en vue mois : elle noierait les rendez-vous. */
v(
  'et pas la liste détaillée',
  await page.locator(`[data-taches="${AUJOURDHUI}"]`).count(),
  0,
);
await compacte.click();
await page.waitForTimeout(700);
vrai(
  'cliquer la ligne compacte ouvre le jour',
  await page.locator(`[data-taches="${AUJOURDHUI}"]`).isVisible(),
);

/* ── 5. Le bouton « Programmer une tâche répétée » ─────────────────────── */
console.log('\n\x1b[1mLe bouton emmène sur l’écran des tâches, préréglé\x1b[0m');

const programmer = page.locator(`[data-programmer="${AUJOURDHUI}"]`).first();
vrai('le bouton est présent en vue jour', await programmer.isVisible());
const lien = await programmer.getAttribute('href');
vrai('il porte le jour', lien.includes(`jour=${AUJOURDHUI}`));
vrai('il déplie la série', lien.includes('serie=1'));
vrai('et il dit par où revenir', lien.includes('retour='));

await page.goto(`${RACINE}${lien}`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForTimeout(800);
v(
  'arrivé sur l’écran des tâches, l’échéance est préremplie',
  await page.inputValue('#echeance'),
  AUJOURDHUI,
);
vrai(
  'et le volet « Répéter » est ouvert',
  await page.locator('#repeter').evaluate((d) => d.hasAttribute('open')),
);

/* ── 6. Aucune erreur de page ──────────────────────────────────────────── */
console.log('\n\x1b[1mLes écrans ne jettent rien\x1b[0m');
v('aucune erreur de page', erreursDePage, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent — A-8 est corrigée.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
