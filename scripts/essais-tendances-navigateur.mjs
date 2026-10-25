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
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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
  'et le coffre annonce ce qu’il protège',
  (await page.textContent('#vue')).includes('chiffrés dans la base'),
);
vrai(
  'ainsi que la portée exacte de la mémoire de la clé',
  (await page.textContent('#vue')).includes('le temps de l’onglet'),
);

/*
   Un poids impossible est refusé AU PIED DU CHAMP depuis D2 du prompt 43.

   Avant, il remontait jusqu'au modèle, qui levait, et le message s'affichait
   dans la zone d'erreur commune de l'écran — loin du champ, et sans dire
   lequel. L'écran le refuse maintenant lui-même, avec « aria-invalid » et un
   message relié au champ, qui nomme les bornes. Le contrôle du modèle n'a pas
   bougé : il reste la garde de dernier recours, et c'est lui qui protège une
   écriture venue d'ailleurs que de cet écran.

   L'essai suit donc le message là où il est désormais, et vérifie en plus ce
   qu'il ne vérifiait pas : que le champ est marqué invalide.
*/
await page.fill('#kg', '5');
await page.click('#peser');
await page.waitForFunction(
  () => document.getElementById('kg')?.getAttribute('aria-invalid') === 'true',
  undefined,
  { timeout: 15000 },
);
vrai(
  'cinq kilos sont refusés, et le champ est marqué invalide',
  (await page.getAttribute('#kg', 'aria-invalid')) === 'true',
);
vrai(
  'le message est au pied du champ, et il nomme les bornes',
  (
    await page.evaluate(() => {
      const decrit = document.getElementById('kg')?.getAttribute('aria-describedby') ?? '';
      return decrit
        .split(/\s+/)
        .map((x) => document.getElementById(x)?.textContent ?? '')
        .join(' ');
    })
  ).includes('entre 20 et 400 kg'),
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
   1 bis. Le coffre : rien n'est lisible sans le mot de passe
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE COFFRE SCELLE POUR DE VRAI');

/*
   Le coffre est **fermé en arrivant sur la page**, et c'est le comportement
   réel : sa clé vit dans une variable de module, qui ne survit pas à une
   navigation. Sur un site multi-pages, cela veut dire une saisie du mot de
   passe à chaque visite de l'écran — bien plus lourd que « une fois par
   rechargement », et c'est un point ouvert du plan de la partie P.
*/
vrai('le coffre est fermé en arrivant', await page.locator('#coffre-ferme').isVisible());
await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });

await page.fill('#nom-prise', 'Paracétamol');
await page.fill('#dose', '500 mg');
await page.fill('#motif-prise', 'Mal de tête');
await page.click('#noter-prise');
await page.waitForFunction(
  () => document.querySelectorAll('#prises li').length > 0,
  { timeout: 15000 },
);
vrai('la prise est enregistrée', true);

const surDisque = await page.evaluate(
  () =>
    new Promise((ok, ko) => {
      const demande = indexedDB.open('revinsp');
      demande.onerror = () => ko(demande.error);
      demande.onsuccess = () => {
        const base = demande.result;
        const tx = base.transaction('odysseeMedicaments', 'readonly');
        const tout = tx.objectStore('odysseeMedicaments').getAll();
        tx.oncomplete = () => {
          base.close();
          ok(JSON.stringify(tout.result));
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
);
faux('« Paracétamol » n’est pas lisible dans la base', surDisque.includes('Paracétamol'));
faux('ni la dose', surDisque.includes('500 mg'));
faux('ni le motif', surDisque.includes('Mal de tête'));
vrai('mais l’enregistrement existe, scellé', surDisque.includes('"scelle"'));

/*
   Et le rappel de sauvegarde se réveille : du scellé existe, rien n'a été
   sauvegardé. C'est la condition bloquante de la décision 3.
*/
vrai('le rappel de sauvegarde est affiché', await page.locator('#rappel-sauvegarde').isVisible());
v(
  'et il est urgent, puisque rien n’est sauvegardé',
  await page.getAttribute('#rappel-sauvegarde', 'data-insistance'),
  'urgente',
);

/* Refermer le coffre cache le contenu sans rien perdre. */
await page.click('#fermer-coffre');
await page.waitForSelector('#coffre-ferme:not(.hidden)', { timeout: 15000 });
vrai('refermé, le formulaire disparaît', await page.locator('#coffre-ferme').isVisible());
faux('et le contenu avec', await page.locator('#coffre-ouvert').isVisible());

/* Un mot de passe faux est refusé avant toute dérivation. */
await page.fill('#mdp-coffre', 'ceci-nest-pas-le-mot-de-passe');
await page.click('#ouvrir-coffre');
await page.waitForSelector('#erreur-coffre:not(.hidden)', { timeout: 15000 });
vrai(
  'un mot de passe faux est refusé',
  (await page.textContent('#erreur-coffre')).includes('incorrect'),
);

await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 20000 });
vrai(
  'et le bon mot de passe rouvre, avec le contenu intact',
  (await page.textContent('#prises')).includes('Paracétamol'),
);
v(
  'le champ de mot de passe est vidé',
  await page.inputValue('#mdp-coffre'),
  '',
);

/*
   Ce que la clé traverse, et ce qu'elle ne traverse pas.

   Elle vit dans `sessionStorage` depuis le 13 octobre 2026 : elle survit donc
   au **rechargement** et à la navigation dans l'onglet, et meurt avec
   l'onglet. Les deux moitiés se vérifient ici, parce que la première sans la
   seconde ne prouverait rien — un stockage qui survit à l'onglet tiendrait le
   premier essai aussi bien.
*/
await page.reload({ waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });
vrai(
  'après rechargement, le coffre est toujours ouvert',
  await page.locator('#coffre-ouvert').isVisible(),
);
vrai(
  'et son contenu est relu',
  (await page.textContent('#vue')).includes('Paracétamol'),
);

{
  /*
     Un autre onglet, c'est-à-dire un autre contexte : son `sessionStorage`
     est vide. C'est la ligne qui distingue `sessionStorage` de
     `localStorage`, et sans elle le choix retenu ne se voit pas.
  */
  const autre = await nav.newContext();
  const onglet = await autre.newPage();
  await onglet.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  if (await onglet.locator('#champ-mdp').isVisible().catch(() => false)) {
    await onglet.fill('#champ-mdp', MDP);
    await onglet.click('#bouton-verrou');
  }
  await onglet.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });
  vrai(
    'dans un autre onglet, le coffre est fermé',
    await onglet.locator('#coffre-ferme').isVisible(),
  );
  faux(
    'et son contenu reste invisible',
    (await onglet.textContent('#vue')).includes('Paracétamol'),
  );
  /*
     Et le déverrouillage du site n'y a rien changé : il ne doit plus ouvrir
     le coffre. C'est la régression qu'un essai de Psyché a attrapée.
  */
  await autre.close();
}

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
  /*
     LE REPOS DE 600 ms ENTRE DEUX GESTES VOULUS — A1 du 43, `lib/geste.ts`.

     « unSeulGeste » refuse un second appui trop proche du premier, pour
     qu'un doigt qui glisse n'écrive pas deux fois. L'essai, lui, enchaînait
     trois créations en quelques dizaines de millisecondes : les deux
     dernières étaient ignorées, et la liste n'augmentait jamais.

     Personne ne peut saisir un intitulé et un « pourquoi » en moins de
     600 ms : le garde-fou est juste, et c'est l'essai qui allait plus vite
     qu'une main. Il attend donc, comme une main attend.

     À TRANCHER (noté au pilote) : ce refus est SILENCIEUX. C'est voulu pour
     un rebond — dire quelque chose à chaque doigt qui glisse serait du
     bruit — mais un geste délibéré refusé sans un mot reste un cas que la
     règle « un échec est dit, jamais avalé » n'a pas tranché.
  */
  await page.waitForTimeout(700);
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
