/**
 * Le compte à rebours, sur l'écran où il vit.
 *
 *   npx astro preview &  CHROMIUM=… npm run essais:compte-a-rebours:navigateur
 *
 * Le mot de passe ne se donne PAS sur la ligne de commande : elle reste en
 * clair dans le journal du terminal. Il se pose dans `.env.local`, ignoré
 * par Git, et `motDePasseEssais()` l'y lit — c'est la source unique.
 *
 *   printf 'SITE_PASSWORD=…\n' > .env.local
 *
 * L'essai pur (`essais:compte-a-rebours`) garde l'arithmétique : les jours
 * comptés sur des minuits UTC, les semaines au-delà de huit, les valeurs
 * impossibles écartées. Il ne peut rien dire de ce qui suit, et c'est ce que
 * la décision 3 promet vraiment :
 *
 * - que la ligne apparaisse sur l'accueil de Révisions, et nulle part ailleurs ;
 * - qu'un réglage la fasse **disparaître** — pas la griser, pas la vider ;
 * - qu'elle ne montre rien tant que le coffre est fermé (interdit 4 du 56) ;
 * - qu'elle ne porte aucune couleur d'alerte (interdit 3).
 *
 * Les dates sont calculées à partir d'aujourd'hui, jamais écrites en dur :
 * un essai qui épinglerait « 15 mars 2027 » passerait au rouge tout seul le
 * jour venu, et on le relâcherait au lieu de le lire.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreAuxDates } from './lib/boite-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
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

/* ── Les dates de l'essai, calculées depuis aujourd'hui ─────────────────── */

const jourISO = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dansNJours = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return jourISO(d);
};
/* 150 jours : au-delà des huit semaines, donc la ligne doit parler en
   semaines — 150 / 7 arrondi, soit 21. */
const LOIN = dansNJours(150);
const PASSEE = dansNJours(-10);
const diteEnFrancais = (iso) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));

async function deverrouiller() {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
}

/** L'accueil de Révisions, une fois son tableau de bord montré. */
const allerALAccueil = () => aller('/revisions/', '#tableau:not(.hidden)');

/** Ce que le bloc dit, espaces normalisés. */
const texteDuBloc = async () =>
  ((await page.locator('#rebours').textContent()) ?? '').replace(/\s+/g, ' ').trim();

/**
 * Pose les dates d'épreuves depuis « Mon profil ».
 *
 * Le champ vit dans le bloc repliable de la branche Révisions, et ce bloc est
 * fermé tant qu'il ne porte aucune réponse : on l'ouvre comme la personne
 * l'ouvrirait, en cliquant son titre. Un essai qui forcerait `open` à vrai
 * cesserait de voir le jour où le titre n'ouvre plus rien.
 *
 * ON PASSE DES DATES PAR ÉTIQUETTE, ET NON UNE CHAÎNE JSON. Cet essai tapait
 * « {"insp":"2027-03-24"} » dans la boîte, et il est mort sur « Malformed
 * value » le 25 octobre : la section C du 43 a retiré le JSON de cette
 * saisie, qui porte désormais un champ de date par parcours. Demander du JSON
 * à une personne était le défaut que ce lot a corrigé ; l'essai ne doit pas
 * être le dernier à le réclamer.
 *
 * L'étiquette est celle qui s'affiche — « INSP » —, pas l'identifiant du
 * parcours : c'est ce que la personne lit, et c'est ce qui est à l'écran.
 */
async function poserLesDates(dates) {
  await aller('/profil/', '[data-branche="revisions"]');
  const branche = page.locator('details[data-branche="revisions"]');
  if (!(await branche.evaluate((e) => e.open))) await branche.locator('summary').click();
  await page.waitForSelector('[data-carte="datesEpreuves"]', { timeout: 20000 });
  await page
    .locator('[data-carte="datesEpreuves"] button', { hasText: /Renseigner|Modifier/ })
    .first()
    .click();
  await repondreAuxDates(page, dates, 'Enregistrer');
  await page.waitForTimeout(500);
}

/* Une base neuve : aucune date n'a jamais été donnée. */
await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      try {
        localStorage.clear();
      } catch {
        /* rien à faire */
      }
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

/* ════════════════════════════════════════════════════════════════════════
   1. Coffre fermé : rien, et c'est l'interdit 4
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nCOFFRE FERMÉ, RIEN N’APPARAÎT');

await page.goto(`${RACINE}/revisions/`, { waitUntil: 'networkidle' });
/* On ne déverrouille PAS : c'est tout l'objet de cette section. */
await page.waitForSelector('#champ-mdp', { timeout: 20000 });
vrai(
  'le tableau de bord reste caché tant que le verrou tient',
  await page.locator('#tableau').evaluate((e) => e.classList.contains('hidden')),
);
vrai(
  'le bloc du compte à rebours aussi',
  await page.locator('#bloc-rebours').evaluate((e) => e.classList.contains('hidden')),
);
v('et il ne porte aucun texte', await texteDuBloc(), '');

/*
   L'initialisation ensuite : une base vierge y mène avant de voir le tableau
   de bord. Cet essai mesure le compte à rebours, pas la garde — qui a ses
   propres essais. « Terminer maintenant » laisse les dates d'épreuves sans
   réponse, ce qui est exactement l'état que la section suivante mesure.
*/
await franchirInitialisation(page, RACINE, MDP);

/* ════════════════════════════════════════════════════════════════════════
   2. Aucune date donnée : une invitation, et pas un reproche
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nSANS DATE, UNE INVITATION');

await allerALAccueil();
await page.waitForSelector('#bloc-rebours:not(.hidden)', { timeout: 20000 });
v(
  'le bloc dit que les dates manquent, et propose de les donner',
  await texteDuBloc(),
  'Vous n’avez pas dit quand sont vos épreuves.Les renseigner',
);
v(
  'le lien mène à « Mon profil »',
  new URL(await page.locator('#rebours a').getAttribute('href'), RACINE).pathname.replace(
    /\/$/,
    '',
  ),
  '/profil',
);
vrai(
  'et il atteint le plancher de 44 px',
  (await page.locator('#rebours a').boundingBox()).height >= 44,
);
faux(
  'aucun mot de pression : ni « plus que », ni « reste », ni « attention »',
  /plus que|il reste|attention|urgent/i.test(await texteDuBloc()),
);

/* ════════════════════════════════════════════════════════════════════════
   3. Une date donnée : une ligne, sans couleur
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE DATE DONNÉE, UNE LIGNE');

await poserLesDates({ INSP: LOIN });
await allerALAccueil();
await page.waitForSelector('#rebours li', { timeout: 20000 });
v('une ligne, et une seule', await page.locator('#rebours li').count(), 1);
v(
  'elle nomme le parcours, la date en toutes lettres, et le délai en semaines',
  await texteDuBloc(),
  `INSP : ${diteEnFrancais(LOIN)}, dans 21 semaines`,
);
/* L'interdit 3 se vérifie sur les classes, et non à l'œil : une couleur
   d'alerte posée demain par inadvertance se verrait ici. */
const classes = await page
  .locator('#bloc-rebours')
  .evaluate((e) => [e, ...e.querySelectorAll('*')].map((x) => x.className).join(' '));
faux('aucune classe d’alerte : ni rouge, ni ambre', /\b(red|amber|rose|orange)-/.test(classes));
faux('et aucun lien de phrase ne porte « cible-tactile » (D-041)', /cible-tactile/.test(classes));

/* ════════════════════════════════════════════════════════════════════════
   4. Le réglage le fait disparaître
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE RÉGLAGE COUPÉ, LE BLOC DISPARAÎT');

/* L'interrupteur des paramètres est un `button[role="switch"]`, et non une
   case : on le lit sur `aria-checked`, qui est ce qu'un lecteur d'écran lit. */
const interrupteur = () =>
  page.locator('[data-reglage="compte-a-rebours"] button[role="switch"]').first();
const allume = async () => (await interrupteur().getAttribute('aria-checked')) === 'true';

await aller('/parametres/', '[data-reglage="compte-a-rebours"] button[role="switch"]');
vrai('le réglage est allumé par défaut', await allume());
await interrupteur().click();
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-reglage="compte-a-rebours"] button[role="switch"]')
      ?.getAttribute('aria-checked') === 'false',
  undefined,
  { timeout: 20000 },
);

await allerALAccueil();
await page.waitForTimeout(1500);
vrai(
  'le bloc est caché',
  await page.locator('#bloc-rebours').evaluate((e) => e.classList.contains('hidden')),
);
v('et vidé : rien ne reste dans le document', await texteDuBloc(), '');

await aller('/parametres/', '[data-reglage="compte-a-rebours"] button[role="switch"]');
faux('et le réglage s’en souvient d’un écran à l’autre', await allume());
await interrupteur().click();
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-reglage="compte-a-rebours"] button[role="switch"]')
      ?.getAttribute('aria-checked') === 'true',
  undefined,
  { timeout: 20000 },
);
await allerALAccueil();
await page.waitForSelector('#rebours li', { timeout: 20000 });
vrai('rallumé, il revient avec sa ligne', (await texteDuBloc()).startsWith('INSP : '));

/* ════════════════════════════════════════════════════════════════════════
   5. Une date passée : on propose de la mettre à jour
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE DATE PASSÉE, UNE MISE À JOUR PROPOSÉE');

await poserLesDates({ INSP: PASSEE });
await allerALAccueil();
await page.waitForSelector('#bloc-rebours:not(.hidden)', { timeout: 20000 });
v(
  'le bloc le dit sans le reprocher',
  await texteDuBloc(),
  'Les dates d’épreuves que vous avez données sont passées.Les mettre à jour',
);
v('et plus aucune ligne d’échéance', await page.locator('#rebours li').count(), 0);

/* ════════════════════════════════════════════════════════════════════════
   6. Le compte à rebours ne déborde pas de son écran
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nIL NE VIT QUE SUR L’ACCUEIL DE RÉVISIONS');

await poserLesDates({ INSP: LOIN });
for (const [nom, route] of [
  ['la planification', '/planification/'],
  ['la progression', '/progression/'],
]) {
  /* Pas de sélecteur d'attente : le bloc est dans le document ou il n'y est
     pas, et c'est du balisage, pas un rendu. Attendre un « h1 » ferait
     mesurer autre chose — celui de l'écran du verrou, resté caché. */
  await aller(route);
  v(`${nom} ne porte pas le bloc`, await page.locator('#bloc-rebours').count(), 0);
  faux(
    `${nom} ne dit rien des épreuves`,
    /dans \d+ semaines|vos épreuves/i.test((await page.locator('body').textContent()) ?? ''),
  );
}

await contexte.close();
await nav.close();
console.log(
  echecs ? `\n\x1b[31m${echecs} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m',
);
process.exit(echecs ? 1 : 0);
