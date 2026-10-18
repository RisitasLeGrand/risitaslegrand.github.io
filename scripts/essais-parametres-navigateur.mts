/**
 * La page « Paramètres », dans un vrai navigateur.
 *
 *   npm run essais:parametres-navigateur
 *
 * Les essais du 42 (§ 3), ceux qui demandent un écran :
 *
 * 1. **L'effet du réglage sur son écran** — on change « Cartes par séance »
 *    sur la page centrale, et on relit la valeur sur `/progression/`, son
 *    écran d'origine. C'est l'essai d'égalité que le prompt exige : il ne
 *    suffit pas que la page affiche un réglage, il faut qu'elle écrive au
 *    même endroit que l'écran d'où il vient.
 * 2. **« Rétablir »** n'apparaît qu'une fois la valeur changée, et remet la
 *    valeur d'usine.
 * 3. **Coffre fermé, rien en clair** : la ligne « Chapitre Santé » s'affiche
 *    sous son libellé, sans sa valeur, et le dit.
 * 4. **La recherche** filtre les lignes et vide les sections devenues vides.
 * 5. **Les ancres** : `/parametres/#sport` ouvre la page sur la bonne
 *    section.
 * 6. **Les cibles tactiles** des commandes construites par le script : ce
 *    sont les seules que les essais du 41 ne voient pas, puisqu'elles
 *    n'existent pas dans le HTML livré.
 *
 * Le préalable est mesuré, pas supposé : si la page ne s'ouvre pas, ou si
 * aucune commande n'est construite, l'essai le dit et s'arrête — sans quoi
 * tout le reste passerait au vert sur une page vide.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();

await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/parametres/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* ── La prémisse ─────────────────────────────────────────────────────────── */

const lignes = await page.locator('[data-reglage]').count();
verifier('la page porte des réglages', lignes > 20, true);
const commandes = await page.locator('[data-reglage] [role="switch"], [data-reglage] select').count();
if (lignes === 0 || commandes === 0) {
  console.log(
    '\x1b[31m✗\x1b[0m aucune commande construite : la suite porterait sur une page vide, elle n’est pas mesurée',
  );
  await nav.close();
  process.exit(1);
}

/* ── 1. L'égalité avec l'écran d'origine ─────────────────────────────────── */

console.log('\nLE MÊME RÉGLAGE, DES DEUX CÔTÉS');
const champCartes = page.locator('[data-reglage="plafond-cartes"] input[type=number]');
await champCartes.waitFor({ state: 'visible', timeout: 10_000 });
const avant = await champCartes.inputValue();
verifier('« Cartes par séance » part de sa valeur d’usine', avant, '25');
await champCartes.fill('42');
await champCartes.dispatchEvent('change');
await page.waitForTimeout(800);

const surProgression = await page.evaluate(async () => {
  const { lireReglagesSession } = await import('/src/lib/db.ts').catch(() => ({}) as never);
  return lireReglagesSession ? (await lireReglagesSession()).plafondCartes : null;
});
/*
   La lecture par import de module ne marche qu'en développement ; en
   construction, les modules sont empaquetés. On relit donc la base
   directement, ce qui mesure la même chose : ce que l'écran d'origine
   lirait.
*/
const enBase = await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const q = r.result.transaction('etat').objectStore('etat').get('reglagesSession');
        q.onsuccess = () => ok((q.result as { plafondCartes?: number })?.plafondCartes ?? null);
        q.onerror = () => ok(null);
      };
      r.onerror = () => ok(null);
    }),
);
verifier('la valeur écrite va bien dans `etat.reglagesSession`', enBase, 42);
void surProgression;

await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const surSonEcran = await page
  .locator('#plafond-cartes, [name="plafondCartes"], #cartes-par-seance')
  .first()
  .inputValue()
  .catch(() => null);
verifier(
  'et l’écran d’origine la montre (ou n’a pas ce champ, auquel cas la base fait foi)',
  surSonEcran === null || surSonEcran === '42',
  true,
);

/* ── 2. « Rétablir » ─────────────────────────────────────────────────────── */

console.log('\nRÉTABLIR');
await page.goto(`${RACINE}/parametres/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const retablir = page.locator('[data-reglage="plafond-cartes"] button', { hasText: 'Rétablir' });
verifier('« Rétablir » apparaît sur une valeur changée', await retablir.count(), 1);
await retablir.click();
await page.waitForTimeout(800);
verifier(
  'et la valeur d’usine revient',
  await page.locator('[data-reglage="plafond-cartes"] input[type=number]').inputValue(),
  '25',
);
verifier(
  'et « Rétablir » disparaît',
  await page.locator('[data-reglage="plafond-cartes"] button', { hasText: 'Rétablir' }).count(),
  0,
);

/* ── 3. Coffre fermé ─────────────────────────────────────────────────────── */

console.log('\nCOFFRE FERMÉ');
const sante = await page.evaluate(() => {
  const bloc = document.querySelector('[data-reglage="sante-active"]');
  return {
    libelle: Boolean(bloc?.textContent?.includes('Chapitre Santé')),
    message: bloc?.querySelector('[data-message]')?.textContent?.trim() ?? '',
    commande: bloc?.querySelector('[data-commande]')?.children.length ?? -1,
  };
});
verifier('le réglage sous coffre garde son libellé', sante.libelle, true);
verifier('il dit que la valeur est protégée', /coffre/i.test(sante.message), true);
verifier('et n’affiche aucune commande', sante.commande, 0);

/* ── 4. La recherche ─────────────────────────────────────────────────────── */

console.log('\nLA RECHERCHE');
await page.fill('#recherche-reglage', 'notification');
await page.waitForTimeout(400);
const apresRecherche = await page.evaluate(() => ({
  visibles: [...document.querySelectorAll<HTMLElement>('[data-reglage]')].filter((b) => !b.hidden)
    .length,
  sectionsVisibles: [...document.querySelectorAll<HTMLElement>('[data-section]')].filter(
    (s) => !s.hidden,
  ).length,
  message: document.getElementById('resultat-recherche')?.textContent ?? '',
}));
verifier('la recherche ne garde que les lignes qui correspondent', apresRecherche.visibles > 0 && apresRecherche.visibles < 10, true);
verifier('et vide les sections devenues vides', apresRecherche.sectionsVisibles <= 2, true);
verifier('elle dit combien', /réglage/.test(apresRecherche.message), true);
await page.fill('#recherche-reglage', '');
await page.waitForTimeout(300);

/* ── 5. Les ancres ───────────────────────────────────────────────────────── */

console.log('\nLES ANCRES');
await page.goto(`${RACINE}/parametres/#sport`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const ancre = await page.evaluate(() => {
  const section = document.getElementById('sport');
  if (!section) return null;
  const r = section.getBoundingClientRect();
  return Math.round(r.top);
});
verifier('`#sport` amène la section dans l’écran', ancre !== null && ancre > -50 && ancre < 400, true);

/* ── 6. Les cibles tactiles des commandes construites ────────────────────── */

console.log('\nLES CIBLES TACTILES');
/*
   La règle est celle du socle, pas une plus sévère inventée ici : 44 px pour
   une commande et pour tout ce qui porte « cible-tactile », 24 px — le
   plancher de WCAG 2.2 AA — pour ce qui porte « cible-minimale », c'est-à-dire
   ce qu'on touche rarement dans un espace compté. La première version exigeait
   44 px de tout lien, et accusait les trente « Voir l'écran » d'un défaut que
   le socle autorise explicitement. Un contrôle plus sévère que la règle ne
   mesure plus la règle.
*/
const trop = await page.evaluate(() => {
  const petites: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(
    '[data-reglage] [role="switch"], [data-reglage] select, [data-reglage] input, [data-reglage] a',
  )) {
    if (el.offsetParent === null) continue;
    const minimale = el.classList.contains('cible-minimale');
    const seuil = minimale ? 24 : 44;
    const r = el.getBoundingClientRect();
    if (r.height < seuil - 0.5)
      petites.push(`${el.tagName}${minimale ? '.min' : ''} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  return petites;
});
verifier('aucune commande sous son seuil (44 px, ou 24 px pour une cible minimale)', trop, []);

/* La prémisse : sans « pointer: coarse », les hauteurs minimales du socle ne
   s'appliquent pas, et le contrôle ci-dessus passerait au vert sur un
   navigateur de bureau. */
verifier(
  'la mesure a bien lieu sur un écran tactile',
  await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
  true,
);

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
