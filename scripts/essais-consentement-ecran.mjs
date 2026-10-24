/**
 * L'écran du consentement, et le parcours de révocation — A-13.
 *
 *   npm run essais:consentement-ecran
 *
 * Ce que la partie structurelle ne peut pas dire : **qu'un utilisateur
 * peut effectivement autoriser, et révoquer.** C'est la leçon d'A-16 —
 * un mécanisme sans porte d'entrée n'existe pas, et seul un essai qui
 * part d'une route le montre.
 *
 * Quatre choses s'éprouvent, et chacune est une façon de mentir sur un
 * consentement :
 *
 * - **le défaut est le refus.** Un écran qui s'ouvrirait « autorisé »
 *   rendrait le consentement acquis par défaut ;
 * - **l'adaptation dit la vraie raison de son silence.** « Aucun écart »
 *   serait un constat ; la vérité est qu'aucun écart ne PEUT être trouvé ;
 * - **le texte est cité, pas résumé.** Les trois paragraphes doivent
 *   apparaître mot pour mot ;
 * - **ce qui n'existe pas est dit à l'écran**, et pas seulement dans un
 *   commentaire que personne ne lit.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

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
      `      obtenu  ${JSON.stringify(obtenu)?.slice(0, 240)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 240)}`,
    );
  }
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
const erreursDePage = [];
page.on('pageerror', (e) => erreursDePage.push(e.message.slice(0, 200)));

const aller = async () => {
  await page.goto(`${RACINE}/profil/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
  await page.waitForTimeout(1200);
};

/** Les entrées du journal du consentement, lues comme un autre appareil. */
const lireLeJournal = () =>
  page.evaluate(async () => {
    const db = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const ops = await new Promise((ok) => {
      const r = db.transaction('operations').objectStore('operations').getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok([]);
    });
    return ops
      .filter((o) => o.type === 'consentement.apprentissage-etendu')
      .map((o) => ({ type: o.charge?.type, remplace: o.charge?.remplace ?? null }));
  });

await franchirInitialisation(page, RACINE, MDP);
await aller();

/* ── 1. Le défaut est le refus ─────────────────────────────────────────── */
console.log('\n\x1b[1mLe défaut est le refus\x1b[0m');
vrai(
  'l’état dit que rien n’a été autorisé',
  (await page.locator('#consentement-etat').innerText()).includes('Jamais autorisé'),
);
vrai('le bouton « Autoriser » est offert', await page.locator('#consentement-accorder').isVisible());
v(
  'et « Révoquer » ne l’est pas : il n’y a rien à révoquer',
  await page.locator('#consentement-revoquer').isVisible(),
  false,
);
v('le journal est vide', await lireLeJournal(), []);

/* ── 2. L'adaptation dit la VRAIE raison de son silence ────────────────── */
console.log('\n\x1b[1mL’adaptation ne déguise pas l’absence de permission\x1b[0m');
const avant = await page.locator('#adaptation-etat').innerText();
vrai(
  'elle dit que l’apprentissage n’est pas autorisé',
  avant.includes('n’est pas autorisé'),
);
v(
  'et ne prétend PAS qu’aucun écart n’a été trouvé',
  avant.includes('Aucun écart') || avant.includes('aucun écart n’a'),
  false,
);

/* ── 3. Le texte est cité, pas résumé ──────────────────────────────────── */
console.log('\n\x1b[1mLes trois paragraphes sont cités\x1b[0m');
await page.locator('#consentement-texte').evaluate((d) => d.setAttribute('open', ''));
await page.waitForTimeout(400);
for (const cle of ['ceQueCycladesLit', 'ceQuiNeChangeJamais', 'commentArreter']) {
  vrai(`« ${cle} » est présent`, await page.locator(`[data-paragraphe="${cle}"]`).isVisible());
}
vrai(
  'et la phrase qui engage y figure mot pour mot',
  (await page.locator('[data-paragraphe="ceQuiNeChangeJamais"]').innerText()).includes(
    'vous n’avez jamais à l’autoriser pour que le reste de Cyclades fonctionne',
  ),
);
vrai(
  'ce qui n’existe pas est dit À L’ÉCRAN',
  (await page.locator('#consentement-manques').innerText()).includes('Ce qui n’existe pas encore'),
);

/* ── 4. Autoriser, puis révoquer ───────────────────────────────────────── */
console.log('\n\x1b[1mAutoriser, puis révoquer\x1b[0m');
await page.locator('#consentement-accorder').click();
await page.waitForTimeout(1000);
vrai(
  'l’état dit « autorisé »',
  (await page.locator('#consentement-etat').innerText()).includes('Autorisé depuis'),
);
v('un accord est au journal', (await lireLeJournal()).map((e) => e.type), ['accord']);
v(
  'un premier accord ne nomme aucune révocation',
  (await lireLeJournal())[0].remplace,
  null,
);
vrai(
  'et l’adaptation ne parle plus de permission',
  !(await page.locator('#adaptation-etat').innerText()).includes('n’est pas autorisé'),
);

await page.locator('#consentement-revoquer').click();
await page.waitForTimeout(1000);
vrai(
  'révoqué, l’état le dit avec sa date',
  (await page.locator('#consentement-etat').innerText()).includes('Révoqué le'),
);
v('et le journal garde les deux gestes', (await lireLeJournal()).map((e) => e.type), [
  'accord',
  'revocation',
]);

/* ── 5. Réautoriser NOMME la révocation ────────────────────────────────── */
console.log('\n\x1b[1mRéautoriser nomme la révocation qu’on lève\x1b[0m');
await page.locator('#consentement-accorder').click();
await page.waitForTimeout(1000);
const journal = await lireLeJournal();
v('trois gestes au journal', journal.map((e) => e.type), ['accord', 'revocation', 'accord']);
vrai(
  'et la reprise NOMME la révocation — sans quoi un appareil hors ligne la ressusciterait',
  Boolean(journal[2].remplace),
);
vrai(
  'l’état est de nouveau autorisé',
  (await page.locator('#consentement-etat').innerText()).includes('Autorisé depuis'),
);

/* ── 6. Rien ne jette ──────────────────────────────────────────────────── */
console.log('\n\x1b[1mL’écran ne jette rien\x1b[0m');
v('aucune erreur de page', erreursDePage, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent — A-13 a sa porte d’entrée.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
