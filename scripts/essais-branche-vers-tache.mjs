/**
 * Le sens branche → tâche, de bout en bout — prompt 39, C2 (A-11).
 *
 *   npm run essais:branche-vers-tache
 *
 * Ce contrôle était demandé en toutes lettres par le prompt : « on fait
 * l'action dans la branche, puis on constate la tâche cochée à l'écran.
 * Commence par la séance de sport. » Il manquait.
 *
 * ## Ce que son absence cachait — anomalie A-16
 *
 * En l'écrivant, j'ai trouvé pire qu'un trou de preuve : **aucune tâche
 * liée ne pouvait exister.** Quatorze endroits lisaient `tache.lien` ;
 * rien ne l'écrivait. `TacheNeuve` ne portait pas le champ, et le
 * formulaire n'offrait pas de choix. Tout le mécanisme branche ↔ tâche —
 * le registre, les écrivains, la dérivation de la phase 2 — était hors
 * d'atteinte d'un utilisateur.
 *
 * Même forme qu'A-9 : des moteurs branchés les uns aux autres, et aucune
 * porte d'entrée. Et comme pour A-9, c'est le contrôle que je déclarais
 * manquant qui l'a montré.
 *
 * ## Ce qui est éprouvé
 *
 * Le parcours entier, par les écrans : créer une tâche répétée **liée à
 * une séance de sport**, aller dans la branche Sport, ouvrir puis clore
 * une séance, revenir à l'écran des tâches et constater que l'occurrence
 * du jour est cochée — **sans l'avoir pointée**, et en portant la mention
 * « faite depuis sa branche ».
 *
 * Rien n'est écrit en base par un chemin détourné : si le parcours passe,
 * c'est qu'un utilisateur peut le faire.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const TITRE = 'Séance de sport, liée';

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
  await page.waitForTimeout(900);
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
    return {
      taches: await lire('odysseeTaches'),
      occurrences: await lire('odysseeOccurrences'),
      seances: await lire('sportSeances'),
    };
  });

await franchirInitialisation(page, RACINE, MDP);

/* ── 1. Le champ existe, et il propose le registre ─────────────────────── */
console.log('\n\x1b[1mUne tâche PEUT viser une branche — A-16\x1b[0m');

await aller('/odyssee/taches/');
vrai('le champ « Relier à » existe', await page.locator('#lien').isVisible());
const valeurs = await page.locator('#lien option').evaluateAll((o) => o.map((e) => e.value));
vrai('il propose « aucune branche » en premier', valeurs[0] === '');
vrai('et la séance de sport', valeurs.includes('sport.seance'));

/* ── 2. Créer la tâche liée, par l'écran ───────────────────────────────── */
await page.locator('details', { hasText: 'Répéter' }).first().evaluate((d) => d.setAttribute('open', ''));
await page.fill('#titre', TITRE);
await page.selectOption('#lien', 'sport.seance');
await page.selectOption('#champs-serie select[data-regle]', 'jours');
await page.locator('#champs-serie input[type="number"]').first().fill('1');
await page.fill('#echeance', AUJOURDHUI);
await page.click('#ajouter');
await page.waitForTimeout(900);

const creee = (await lireLaBase()).taches.find((t) => t.titre === TITRE);
vrai('la tâche est en base', Boolean(creee));
v('et elle porte son lien', creee?.lien, {
  branche: 'sport',
  action: 'sport.seance',
  cible: null,
});

/* ── 3. L'occurrence n'est PAS faite, personne n'a rien fait ───────────── */
console.log('\n\x1b[1mAvant la séance : rien n’est coché\x1b[0m');
vrai(
  'l’écran propose de la pointer',
  await page.locator(`[data-faire="${creee.id}"]`).isVisible(),
);
v(
  'et ne propose pas de la dépointer',
  await page.locator(`[data-depointer="${creee.id}"]`).count(),
  0,
);

/* ── 4. Faire la séance DANS LA BRANCHE ────────────────────────────────── */
console.log('\n\x1b[1mOn fait la séance dans la branche Sport\x1b[0m');

await aller('/sport/seance/');
await page.locator('#commencer').click();
await page.waitForTimeout(900);
await page.locator('#terminer').click();
await page.waitForTimeout(1200);

const apres = await lireLaBase();
v('une séance est enregistrée', apres.seances.length, 1);
/* Le modèle dit `fin` et `statut`, pas `finLe` : lu, et non deviné. */
v('et elle est close', apres.seances[0]?.statut, 'terminee');
vrai('avec son instant de fin', Boolean(apres.seances[0]?.fin));

/* ── 5. LE CŒUR : la tâche est cochée, sans qu'on l'ait pointée ────────── */
console.log('\n\x1b[1mLa tâche est cochée depuis sa branche — C2\x1b[0m');

await aller('/odyssee/taches/');
v(
  'AUCUNE occurrence n’a été écrite : rien ne s’écrit, tout se relit',
  apres.occurrences.filter((o) => o.tacheId === creee.id).length,
  0,
);
v(
  'l’écran ne propose plus de la pointer',
  await page.locator(`[data-faire="${creee.id}"]`).count(),
  0,
);
vrai(
  'il propose de la dépointer',
  await page.locator(`[data-depointer="${creee.id}"]`).isVisible(),
);
v(
  'et le bouton se nomme « Ce n’était pas ça », car la branche en est la source',
  (await page.locator(`[data-depointer="${creee.id}"]`).innerText()).trim(),
  'Ce n’était pas ça',
);
const note = page.locator(`[data-note-pointage="${creee.id}"]`);
v('une ligne explique d’où vient la coche', await note.count(), 1);
vrai(
  'et elle dit que la séance reste comptée',
  (await note.innerText()).includes('la séance reste comptée'),
);

/* ── 6. Le tableau de bord et le calendrier le disent aussi ────────────── */
console.log('\n\x1b[1mLes deux autres écrans disent la même chose\x1b[0m');

await aller('/odyssee/');
v(
  'le tableau de bord dit « faite depuis sa branche »',
  (await page.locator(`[data-etat-occurrence="${creee.id}"]`).innerText()).trim(),
  'faite depuis sa branche',
);

await aller('/odyssee/calendrier/');
await page.locator('[data-vue="jour"]').click();
await page.waitForTimeout(800);
vrai(
  'le calendrier propose de défaire, pas de pointer',
  await page.locator(`[data-depointer="${creee.id}:${AUJOURDHUI}"]`).isVisible(),
);

/* ── 7. Aucune erreur de page ──────────────────────────────────────────── */
console.log('\n\x1b[1mAucun écran ne jette\x1b[0m');
v('aucune erreur de page', erreursDePage, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent — C2 et A-11 sont tenus de bout en bout.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
