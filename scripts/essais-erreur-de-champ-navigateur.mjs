/**
 * Une erreur au pied du champ, et reliée à lui (D2 du prompt 43).
 *
 *   npx astro preview &  CHROMIUM=… SITE_PASSWORD=… npm run essais:erreur-de-champ:navigateur
 *
 * Quatre promesses, et aucune ne se lit dans le code :
 *
 * - le message est **sous le champ fautif**, et il dit comment corriger ;
 * - il est **relié** au champ — « aria-invalid » et « aria-describedby » —,
 *   sans quoi un lecteur d'écran annonce un champ ordinaire ;
 * - la validation se fait **à la sortie**, jamais pendant la frappe, et
 *   l'erreur s'efface **dès la correction** ;
 * - la saisie n'est jamais perdue, et le focus revient au champ fautif.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({ executablePath: cheminDuNavigateur(), args: ['--no-sandbox'] });

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
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

async function aller(chemin, attendu) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (await page.locator('#activer').isVisible().catch(() => false)) {
    await page.click('#activer');
    await page.waitForTimeout(800);
  }
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  if (attendu) await page.waitForSelector(attendu, { timeout: 40000 });
}

/** Ce que le champ donne à lire d'une erreur : son état, et le texte lié. */
const etatDuChamp = (id) =>
  page.evaluate((cle) => {
    const champ = document.getElementById(cle);
    const decrit = (champ?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    const zones = decrit.map((x) => document.getElementById(x)).filter(Boolean);
    return {
      invalide: champ?.getAttribute('aria-invalid') ?? null,
      /* Le message doit être APRÈS le champ dans le document : « au pied »,
         et non au-dessus ni ailleurs dans la page. */
      apres: zones.every(
        (z) => champ.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      role: zones[0]?.getAttribute('role') ?? null,
      texte: zones.map((z) => z.textContent?.trim()).join(' '),
      saisie: champ instanceof HTMLInputElement ? champ.value : null,
    };
  }, id);

/* Une base neuve. */
await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      try {
        localStorage.clear();
      } catch {
        /* rien */
      }
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await page.fill('#champ-mdp', MDP);
await page.click('#bouton-verrou');
await franchirInitialisation(page, RACINE, MDP);

/* ════════════════════════════════════════════════════════════════════════
   1. L'erreur se dit à la sortie du champ, et nulle part avant
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nÀ LA SORTIE DU CHAMP, JAMAIS PENDANT LA FRAPPE');

await aller('/odyssee/corps/', '#kg');
const kg = page.locator('#kg');

await kg.click();
await kg.type('7');
{
  const etat = await etatDuChamp('kg');
  /* « 7 » n'est pas un poids invalide : c'est le début de « 72,5 ». Reprocher
     une saisie inachevée est précisément ce que la décision 2 interdit. */
  v('pendant la frappe, aucun reproche', etat.invalide, null);
  v('et aucun message', etat.texte, '');
}

await kg.fill('abc');
await kg.blur();
{
  const etat = await etatDuChamp('kg');
  v('à la sortie, le champ est marqué invalide', etat.invalide, 'true');
  vrai('le message est relié au champ', etat.texte.length > 0);
  vrai('il est au pied du champ, et non ailleurs', etat.apres);
  v('il est annoncé', etat.role, 'alert');
  v(
    'et il dit comment corriger, avec les bornes et la virgule',
    etat.texte,
    'Indiquez un poids entre 20 et 400 kg. La virgule est acceptée.',
  );
  faux(
    'jamais le texte brut d’une exception',
    /Error|undefined|NaN|\bat \w+\(/.test(etat.texte),
  );
  v('et la saisie n’est pas perdue', etat.saisie, 'abc');
}

/* ════════════════════════════════════════════════════════════════════════
   2. L'erreur s'efface dès la correction
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’ERREUR S’EFFACE DÈS LA CORRECTION');

await kg.click();
await kg.fill('72,5');
{
  const etat = await etatDuChamp('kg');
  v('le champ n’est plus marqué invalide, sans attendre la sortie', etat.invalide, null);
  v('et le message est retiré', etat.texte, '');
}

/* ════════════════════════════════════════════════════════════════════════
   3. Hors bornes, et à l'envoi : le focus revient au champ
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nÀ L’ENVOI, LE FOCUS REVIENT AU CHAMP FAUTIF');

await kg.fill('900');
await kg.blur();
v('une valeur hors bornes est refusée à la sortie', (await etatDuChamp('kg')).invalide, 'true');

await kg.fill('');
await page.locator('#peser').click();
{
  const etat = await etatDuChamp('kg');
  v('un champ vide à l’envoi est dit', etat.invalide, 'true');
  v(
    'le focus est revenu sur le champ',
    await page.evaluate(() => document.activeElement?.id),
    'kg',
  );
}

/* ════════════════════════════════════════════════════════════════════════
   4. Et la virgule passe jusqu'au journal
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA VIRGULE PASSE JUSQU’AU JOURNAL');

await kg.fill('72,5');
await page.locator('#peser').click();
/* L'écriture passe par le coffre : on attend le fait, et non un délai.
   Un délai fixe aurait rendu cet essai capricieux sur une machine chargée. */
await page
  .waitForFunction(() => document.getElementById('kg')?.value === '', undefined, {
    timeout: 20000,
  })
  .catch(() => undefined);
v('le champ est vidé : la pesée est passée', await kg.inputValue(), '');
v('et plus aucune erreur ne reste', (await etatDuChamp('kg')).invalide, null);
vrai(
  'la valeur écrite est bien 72,5 et non 725 ni 0',
  (await page.locator('#contenu-principal').innerText()).includes('72,5'),
);

/* ════════════════════════════════════════════════════════════════════════
   5. L'échec du coffre est annoncé, et non seulement affiché
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’ÉCHEC DU COFFRE EST ANNONCÉ');

v(
  'la zone d’erreur du coffre porte « role=alert »',
  await page.evaluate(() => {
    const p = document.getElementById('erreur-coffre');
    return p ? p.getAttribute('role') : 'absente';
  }),
  'alert',
);

await contexte.close();
await nav.close();
console.log(echecs ? `\n\x1b[31m${echecs} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(echecs ? 1 : 0);
