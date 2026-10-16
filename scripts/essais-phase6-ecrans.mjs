/**
 * Le tableau de bord, la Revue et « Reprendre la série » — prompt 39, C4.
 *
 *   npm run essais:phase6-ecrans
 *
 * Trois écrans, trois façons différentes de mentir sur la même donnée :
 *
 * - **le tableau de bord pointerait.** L'option B dit qu'il montre et ne
 *   pointe pas. Un bouton « Faite » y signifierait la même chose en
 *   apparence et moins en vérité : sans portée, sans avertissement, sans
 *   report coffre fermé. L'essai vérifie l'ABSENCE du bouton, ce qu'aucun
 *   essai de module ne saurait faire ;
 * - **la Revue reposerait ce qui est déjà fait.** Une occurrence pointée
 *   doit rejoindre « Déjà fait » et quitter la liste de ce qui reste dû ;
 * - **« Reprendre la série » ferait remonter le passé.** La série repart
 *   au prochain jour prévu ; ce qui était prévu pendant la pause n'est ni
 *   dû ni en retard, et l'écran doit le dire avant le geste.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const TITRE = 'Tâche vue des trois écrans';

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
    return { taches: await lire('odysseeTaches'), occurrences: await lire('odysseeOccurrences') };
  });

await franchirInitialisation(page, RACINE, MDP);

/* ── 1. Une tâche quotidienne, pointée aujourd'hui ─────────────────────── */
console.log('\n\x1b[1mUne tâche quotidienne, pointée\x1b[0m');

await aller('/odyssee/taches/');
await page.locator('details', { hasText: 'Répéter' }).first().evaluate((d) => d.setAttribute('open', ''));
await page.fill('#titre', TITRE);
await page.selectOption('#champs-serie select[data-regle]', 'jours');
await page.locator('#champs-serie input[type="number"]').first().fill('1');
await page.fill('#echeance', AUJOURDHUI);
await page.click('#ajouter');
await page.waitForTimeout(900);

const creee = (await lireLaBase()).taches.find((t) => t.titre === TITRE);
vrai('la tâche est en base', Boolean(creee));

/* ── 2. Le tableau de bord MONTRE, et ne pointe pas ────────────────────── */
console.log('\n\x1b[1mLe tableau de bord — option B\x1b[0m');

await aller('/odyssee/');
vrai('le bloc « Tâches prévues » est là', await page.locator('#bloc-occurrences').isVisible());
vrai(
  'il porte la tâche',
  (await page.locator('#occurrences').innerText()).includes(TITRE),
);
vrai(
  'et un compte qui dit le total',
  (await page.locator('#compte-occurrences').innerText()).includes('sur 1'),
);
/*
   LE CŒUR DE L'OPTION B. Aucun bouton de pointage ici, et c'est une
   absence qu'il faut éprouver : rien dans un module ne l'empêcherait.
*/
v(
  'aucun bouton « Faite » sur le tableau de bord',
  await page.locator('#bloc-occurrences button').count(),
  0,
);
v(
  'ni aucun bouton de pointage nommé',
  await page.locator('#bloc-occurrences [data-pointer]').count(),
  0,
);
vrai(
  'mais un lien vers l’écran qui, lui, pointe',
  await page.locator('#lien-taches').isVisible(),
);
v(
  'l’état du jour est dit « dans la journée » tant que rien n’est fait',
  (await page.locator(`[data-etat-occurrence="${creee.id}"]`).innerText()).trim(),
  'dans la journée',
);

/* ── 3. La Revue compte, et ne repose pas ce qui est fait ──────────────── */
console.log('\n\x1b[1mLa Revue compte les occurrences\x1b[0m');

await aller('/odyssee/revue/');
vrai(
  'le compte des tâches répétées est affiché',
  (await page.locator('#compte-occurrences').innerText()).includes('Tâches répétées'),
);
vrai(
  'et elle figure parmi ce qui reste dû',
  (await page.locator('#occurrences-dues').innerText()).includes(TITRE),
);

/* On la pointe depuis l'écran des tâches, puis on revient. */
await aller('/odyssee/taches/');
await page.locator(`[data-faire="${creee.id}"]`).click();
await page.waitForTimeout(900);

await aller('/odyssee/revue/');
v(
  'une fois faite, elle quitte la liste de ce qui reste dû',
  (await page.locator('#occurrences-dues').innerText()).includes(TITRE),
  false,
);
vrai(
  'et rejoint « Déjà fait »',
  (await page.locator('#deja-servi-liste').innerText()).includes(TITRE),
);
vrai(
  'le compte le dit : 1 faite sur 1',
  (await page.locator('#compte-occurrences').innerText()).includes('1 faite sur 1'),
);

/* ── 4. Le tableau de bord suit ────────────────────────────────────────── */
console.log('\n\x1b[1mLe tableau de bord suit le pointage\x1b[0m');

await aller('/odyssee/');
v(
  'l’état affiché est « faite »',
  (await page.locator(`[data-etat-occurrence="${creee.id}"]`).innerText()).trim(),
  'faite',
);

/* ── 5. « Reprendre la série » ─────────────────────────────────────────── */
console.log('\n\x1b[1m« Reprendre la série » — la série repart devant\x1b[0m');

/*
   On clôt la tâche à la main, en base, avec une ancre ANCIENNE : c'est la
   situation que la règle vise — une série close depuis des semaines, dont
   la reprise ne doit pas faire remonter les occurrences de la pause.
*/
await page.evaluate(async (id) => {
  const db = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const t = await new Promise((ok) => {
    const r = db.transaction('odysseeTaches').objectStore('odysseeTaches').get(id);
    r.onsuccess = () => ok(r.result);
  });
  t.faiteLe = '2026-09-20T18:00:00.000Z';
  t.serie = { ...t.serie, depuis: '2026-09-01' };
  await new Promise((ok) => {
    const r = db.transaction('odysseeTaches', 'readwrite').objectStore('odysseeTaches').put(t);
    r.onsuccess = () => ok();
  });
}, creee.id);

await aller('/odyssee/taches/');
const bouton = page.locator(`[data-rouvrir="${creee.id}"]`);
v('le bouton se nomme « Reprendre la série »', (await bouton.innerText()).trim(), 'Reprendre la série');
/*
   On compte AVANT de lire. Première écriture, cette assertion lisait
   directement le texte : quand le sabotage retirait la ligne, l'essai
   mourait sur un délai de trente secondes au lieu de dire laquelle des
   vingt assertions était rouge. Un contrôle qui s'effondre renseigne
   moins qu'un contrôle qui accuse.
*/
const ligneDite = page.locator(`[data-dit-reprise="${creee.id}"]`);
const combienDeLignes = await ligneDite.count();
v('l’écran porte la ligne qui explique la reprise', combienDeLignes, 1);
v(
  'et elle dit AVANT le geste que la pause n’est pas un retard',
  combienDeLignes ? (await ligneDite.innerText()).includes('ni dû ni en retard') : false,
  true,
);

await bouton.click();
await page.waitForTimeout(900);

const reprise = (await lireLaBase()).taches.find((t) => t.id === creee.id);
v('la tâche n’est plus close', reprise?.faiteLe ?? null, null);
v(
  'et sa série repart aujourd’hui, pas le 1ᵉʳ septembre',
  reprise?.serie?.depuis,
  AUJOURDHUI,
);
v('la règle elle-même n’a pas bougé', reprise?.serie?.repetition, { type: 'jours', tous: 1 });

/* ── 6. Aucune erreur de page ──────────────────────────────────────────── */
console.log('\n\x1b[1mLes trois écrans ne jettent rien\x1b[0m');
v('aucune erreur de page', erreursDePage, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent — phase 6 branchée.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
