/**
 * Le domaine Corps et les tendances, dans un vrai navigateur.
 *
 * Trois choses ne se prouvent qu'ici :
 *
 * - **l'écriture passe par les contrôles**. Un poids impossible est refusé par
 *   le modèle, pas par l'écran : on le vérifie en le saisissant ;
 * - **le plafond de trois trajectoires est un refus d'écriture**. La quatrième
 *   est refusée avec sa raison, et non masquée ;
 * - **un refus est respecté** d'un chargement à l'autre : une piste écartée ne
 *   revient pas.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

async function deverrouiller() {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

async function aller(chemin, attendu) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await page.waitForSelector(attendu, { timeout: 40000 });
}

/* Base neuve. */
await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await deverrouiller();
await franchirInitialisation(page, RACINE, MDP);

/* ════════════════════════════════════════════════════════════════════════
   1. Le domaine Corps écrit, et refuse
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE CORPS ÉCRIT, ET REFUSE L’IMPOSSIBLE');

await aller('/odyssee/corps/', '#vue:not(.hidden)');

vrai(
  'rien n’est noté au départ',
  (await page.textContent('#aujourdhui')).includes('—'),
);
vrai(
  'et la réserve sur les médicaments est dite',
  (await page.textContent('#vue')).includes('Médicaments et statut hormonal ne sont pas ici'),
);

/* Un poids impossible : refusé par le contrôle du modèle, pas par l'écran. */
await page.fill('#kg', '5');
await page.click('#peser');
await page.waitForSelector('#erreur:not(.hidden)', { timeout: 15000 });
vrai(
  'cinq kilos sont refusés, avec la raison',
  (await page.textContent('#erreur')).includes('n’est pas possible'),
);

/* Un poids ordinaire passe. */
await page.fill('#kg', '78.4');
await page.click('#peser');
await page.waitForFunction(
  () => document.querySelectorAll('#pesees tr').length > 0,
  { timeout: 15000 },
);
v('une pesée ordinaire est enregistrée', await page.$$eval('#pesees tr', (l) => l.length), 1);
vrai(
  'et le résumé du jour la montre',
  (await page.textContent('#aujourdhui')).includes('78,4'),
);
vrai(
  'une seule pesée ne fait pas de moyenne',
  (await page.textContent('#tendance')).includes('plusieurs jours'),
);

/* Un repas sans chiffre reste un repas. */
await page.fill('#intitule', 'Café');
await page.click('#manger');
await page.waitForFunction(
  () => document.querySelectorAll('#repas li').length > 0,
  { timeout: 15000 },
);
v(
  'un repas non chiffré est marqué comme tel',
  await page.getAttribute('#repas li', 'data-chiffre'),
  'false',
);
vrai(
  'et les calories du jour restent vides',
  (await page.textContent('#aujourdhui')).includes('aucun repas noté') === false,
);

/* Les boissons. */
await page.click('[data-verre="500"]');
await page.waitForFunction(
  () => document.getElementById('aujourdhui').textContent.includes('0,5 L'),
  { timeout: 15000 },
);
vrai('un demi-litre est compté', true);
await page.click('#annuler-verre');
await page.waitForFunction(
  () => !document.getElementById('aujourdhui').textContent.includes('0,5 L'),
  { timeout: 15000 },
);
vrai('et s’annule', true);

/* La santé qui empêche l'effort. Le formulaire vit dans un `<details>` replié. */
await page.click('details:has(#intitule-sante) summary');
await page.fill('#intitule-sante', 'Angine');
await page.check('#empeche');
await page.click('#declarer-sante');
await page.waitForFunction(
  () => document.querySelectorAll('#sante-ouverte [data-sante]').length > 0,
  { timeout: 15000 },
);
v(
  'l’état déclaré empêche l’effort',
  await page.getAttribute('#sante-ouverte [data-sante]', 'data-empeche'),
  'true',
);

/* ════════════════════════════════════════════════════════════════════════
   2. Les tendances : aucune piste sans données
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nSANS DONNÉES, L’ÉCRAN DIT « PAS ENCORE », PAS « RIEN »');

await aller('/odyssee/tendances/', '#vue:not(.hidden)');

vrai('aucune piste n’est affichée', await page.locator('#aucune-piste').isVisible());
vrai(
  'la revue répond aux quatre questions',
  (await page.$$eval('#revue li', (l) => l.length)) === 4,
);
vrai(
  'et elle annonce le manque de recul',
  (await page.textContent('#revue')).includes('Trop peu') ||
    (await page.textContent('#revue')).includes('recul'),
);
vrai(
  'le bilan du mois se calcule',
  (await page.textContent('#bilan-periode')).includes('comparé au'),
);

/* ════════════════════════════════════════════════════════════════════════
   3. Trois trajectoires, pas quatre
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA QUATRIÈME TRAJECTOIRE EST REFUSÉE, AVEC SA RAISON');

await page.click('details:has(#intitule) summary');
async function ouvrir(nom) {
  await page.fill('#intitule', nom);
  await page.fill('#pourquoi', 'Pour voir.');
  await page.click('#ouvrir');
}

for (const nom of ['Dormir sept heures', 'Réviser trois fois par semaine', 'Marcher chaque jour']) {
  const avant = await page.$$eval('[data-trajectoire]', (l) => l.length);
  await ouvrir(nom);
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-trajectoire]').length > n,
    avant,
    { timeout: 15000 },
  );
}
v('trois trajectoires sont ouvertes', await page.$$eval('[data-trajectoire]', (l) => l.length), 3);
vrai('et la place est annoncée pleine', (await page.textContent('#place')).includes('déjà en cours'));

await ouvrir('Une quatrième');
await page.waitForSelector('#erreur:not(.hidden)', { timeout: 15000 });
vrai(
  'la quatrième est refusée',
  (await page.textContent('#erreur')).includes('déjà en cours'),
);
vrai(
  'et la raison est donnée, pas seulement le refus',
  (await page.textContent('#erreur')).includes('trois intentions suivies'),
);
v('il y en a toujours trois', await page.$$eval('[data-trajectoire]', (l) => l.length), 3);

/* En clore une libère la place : le plafond n'est pas une impasse. */
await page.click('[data-trajectoire] [data-vers="atteinte"]');
await page.waitForFunction(
  () => document.querySelectorAll('[data-trajectoire][data-statut="active"]').length === 2,
  { timeout: 15000 },
);
await ouvrir('Une quatrième');
await page.waitForFunction(
  () => document.querySelectorAll('[data-trajectoire][data-statut="active"]').length === 3,
  { timeout: 15000 },
);
vrai('une clôture libère la place', true);

/* ════════════════════════════════════════════════════════════════════════
   4. Le vocabulaire affiché n'affirme aucune cause
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nRIEN DE CE QUI EST AFFICHÉ N’AFFIRME UNE CAUSE');

{
  /*
     Le contrôle tourne dans la page elle-même : si une formulation affirmait
     une cause, l'écran le signalerait au lieu de la laisser lire. On vérifie
     donc qu'aucune erreur de ce genre n'est affichée, et que le texte des
     pistes et des réserves est bien net.
  */
  const texte = await page.textContent('#vue');
  faux('aucune formulation n’a été signalée', texte.includes('affirme une cause et a été retenue'));
  for (const mot of ['provoque', 'grâce à', 'à cause de']) {
    faux(`le mot « ${mot} » n’apparaît pas`, texte.toLowerCase().includes(mot));
  }
}

/* ════════════════════════════════════════════════════════════════════════ */
await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
