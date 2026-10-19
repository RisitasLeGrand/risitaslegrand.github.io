/**
 * Des étiquettes visibles, et « (facultatif) » (D1 et D5 du prompt 43).
 *
 *   npx astro preview &  CHROMIUM=… SITE_PASSWORD=… npm run essais:etiquettes:navigateur
 *
 * ## Ce qu'un relevé de fichiers ne pourrait pas dire
 *
 * Qu'une étiquette est **visible**. Un `aria-label` passe tous les contrôles
 * automatiques d'accessibilité et ne s'affiche jamais ; un `placeholder`
 * s'affiche et disparaît à la première frappe. Les deux étaient employés comme
 * étiquettes sur Santé et Molécule : on savait ce qu'on remplissait tant qu'on
 * n'avait rien tapé, et plus après.
 *
 * Cet essai calcule donc l'étiquette **dans la page** : un élément `label`
 * associé, qui porte du texte, et qui occupe une hauteur à l'écran.
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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 400)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 200)}`);
  }
};

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

/**
 * Relève, dans la page, ce que chaque contrôle d'un formulaire donne à lire.
 *
 * « Visible » se mesure, et ne se déduit pas d'une classe : une étiquette
 * posée en `sr-only`, en `hidden`, ou repliée a une hauteur nulle, et cet
 * essai la compte comme absente — ce qu'elle est, pour qui regarde.
 */
const releve = (selecteurFormulaire) =>
  page.evaluate((sel) => {
    const sortie = [];
    for (const form of document.querySelectorAll(sel)) {
      for (const champ of form.querySelectorAll('input, select, textarea')) {
        if (champ.type === 'hidden' || champ.offsetParent === null) continue;
        const etiquette = champ.labels?.[0] ?? champ.closest('label');
        const visible = etiquette ? etiquette.getBoundingClientRect().height > 0 : false;
        const texte = ((etiquette?.textContent ?? '').replace(/\s+/g, ' ').trim());
        sortie.push({
          formulaire: form.id,
          champ: champ.id || champ.name || champ.type,
          type: champ.type,
          obligatoire: champ.required,
          etiquette: visible ? texte : '',
          indicatif: champ.getAttribute('placeholder') ?? '',
          /* Un champ qui porte une valeur d'usine — l'intensité à 5 — ne
             manque jamais : le marquer « (facultatif) » dirait qu'on peut le
             laisser vide, alors qu'il ne l'est pas. C'est la même raison qui
             dispense les cases et les listes déroulantes. Le relevé se fait
             sur un formulaire vierge : une valeur présente à cet instant est
             une valeur d'usine, posée dans le balisage ou par le script, et
             non une saisie. */
          parDefaut: champ.value !== '',
          ariaLabel: champ.getAttribute('aria-label') ?? '',
        });
      }
    }
    return sortie;
  }, selecteurFormulaire);

async function aller(chemin, attendu) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  /*
     Deux portes avant les formulaires d'Odyssée, et elles ne se confondent
     pas. La première est l'ACTIVATION : Santé et Molécule sont fermées tant
     qu'on ne les demande pas, et elles ne se synchronisent pas d'un appareil
     à l'autre. La seconde est le COFFRE. On les franchit comme on les
     franchirait, par leurs boutons.
  */
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

/**
 * Les trois règles, sur un relevé : une étiquette visible pour chaque champ ;
 * « (facultatif) » sur ce qui ne l'est pas ; et aucun astérisque.
 */
async function aucunBoutonGrise(ecran, formulaires) {
  const grises = await page.evaluate(
    (ids) =>
      ids
        .flatMap((id) => [
          ...(document.getElementById(id)?.querySelectorAll('button[type="submit"]') ?? []),
        ])
        .filter((b) => b.disabled)
        .map((b) => b.textContent?.trim()),
    formulaires,
  );
  v(`${ecran} · aucun bouton d’envoi n’est grisé`, grises, []);
}

function controler(ecran, champs) {
  v(
    `${ecran} · chaque champ porte une étiquette visible`,
    champs.filter((c) => !c.etiquette).map((c) => c.champ),
    [],
  );
  v(
    `${ecran} · aucun champ ne s’étiquette par son texte indicatif seul`,
    champs.filter((c) => !c.etiquette && c.indicatif).map((c) => c.champ),
    [],
  );
  v(
    `${ecran} · ni par un « aria-label » que personne ne voit`,
    champs.filter((c) => c.ariaLabel && !c.etiquette).map((c) => c.champ),
    [],
  );
  /* D5 : « (facultatif) », sans astérisque. Les cases à cocher et les listes
     déroulantes en sont dispensées : une case non cochée et une liste à valeur
     par défaut ne manquent jamais. */
  const aMarquer = champs.filter(
    (c) =>
      !c.obligatoire &&
      c.type !== 'checkbox' &&
      c.type !== 'radio' &&
      c.type !== 'select-one' &&
      !c.parDefaut,
  );
  v(
    `${ecran} · les champs facultatifs le disent`,
    aMarquer.filter((c) => !c.etiquette.includes('(facultatif)')).map((c) => c.champ),
    [],
  );
  v(
    `${ecran} · et les obligatoires ne le disent pas`,
    champs.filter((c) => c.obligatoire && c.etiquette.includes('(facultatif)')).map((c) => c.champ),
    [],
  );
  v(
    `${ecran} · aucun astérisque`,
    champs.filter((c) => /[*＊]/.test(c.etiquette)).map((c) => c.champ),
    [],
  );
}

/* ════════════════════════════════════════════════════════════════════════
   1. L'écran du verrou : le premier formulaire de tous
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nESPACE PRIVÉ');

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
await page.waitForSelector('#champ-mdp', { timeout: 20000 });
{
  const champs = (await releve('#formulaire-verrou')).filter((c) => c.type !== 'checkbox');
  v('le champ du mot de passe porte une étiquette visible', champs.map((c) => c.etiquette), [
    'Mot de passe du site',
  ]);
  v('et plus de texte indicatif en guise d’étiquette', champs.map((c) => c.indicatif), ['']);
}

/* L'initialisation ensuite : sans elle, les écrans d'Odyssée n'ont pas de
   coffre à ouvrir, et leurs formulaires restent hors de l'écran. */
await franchirInitialisation(page, RACINE, MDP);

/* ════════════════════════════════════════════════════════════════════════
   2. Santé : quatre formulaires, quatorze champs
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nSANTÉ');

await aller('/odyssee/sante/', '#form-traitement');
controler('santé', await releve('#form-traitement, #form-prelevement, #form-symptome, #form-condition'));
/* D5, sur place : un bouton d'envoi ne se grise pas pour dire qu'il manque
   quelque chose — il le dit. On le constate sur le formulaire tel qu'il
   s'ouvre, vide. */
await aucunBoutonGrise('santé', [
  'form-traitement',
  'form-prelevement',
  'form-symptome',
  'form-condition',
]);

/* ════════════════════════════════════════════════════════════════════════
   3. Molécule
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nMOLÉCULE');

/*
   L'écran d'une molécule n'existe que pour un traitement déclaré : sans lui,
   il n'a rien à montrer et ne montre rien. On en déclare donc un par le
   formulaire de Santé — ce qui mesure au passage que ce formulaire s'envoie
   —, puis on suit le lien que la liste pose vers la fiche.
*/
await aller('/odyssee/sante/', '#form-traitement');
await page.fill('#t-nom', 'Paracétamol');
await page.fill('#t-debut', new Date().toISOString().slice(0, 10));
await page.locator('#form-traitement button[type="submit"]').click();
await page.waitForSelector('#traitements a[href*="molecule"]', { timeout: 20000 });
v('santé · le traitement déclaré apparaît dans la liste', await page.locator('#traitements a[href*="molecule"]').count() > 0, true);

await page.locator('#traitements a[href*="molecule"]').first().click();
await page.waitForSelector('#form-ressenti', { timeout: 40000 });
controler('molécule', await releve('#form-ressenti'));
await aucunBoutonGrise('molécule', ['form-ressenti']);

await contexte.close();
await nav.close();
console.log(echecs ? `\n\x1b[31m${echecs} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(echecs ? 1 : 0);
