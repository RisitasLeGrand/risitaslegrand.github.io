/**
 * Trois constats d'accessibilité, tenus par la mesure : le lien d'évitement
 * (A1), le nom accessible des onglets (A2) et les champs sans étiquette (A3).
 *
 * ## A1 — combien de tabulations avant le contenu
 *
 * Sans lien d'évitement, atteindre le contenu de Révisions au clavier
 * demandait dix-neuf arrêts : le logo, trois branches, douze onglets, la
 * liste de parcours, le thème et le verrou. Le contrôle compte les arrêts
 * réels, en tabulant, et vérifie que le premier est bien le lien.
 *
 * ## A2 — « Étiquette dans le nom » (WCAG 2.5.3, niveau A)
 *
 * Un onglet qui affiche « Cartes » et s'appelle « Flashcards » ne répond pas
 * à qui dit « cliquer Cartes ». Le contrôle compare le texte visible au nom
 * accessible, et exige que le second contienne le premier.
 *
 * ## A3 — les champs sans étiquette programmatique
 *
 * ## Pourquoi un placeholder ne compte pas
 *
 * Un texte d'exemple dans un champ disparaît dès la première frappe, n'est pas
 * toujours lu par les technologies d'assistance, et n'existe pas du tout pour
 * la commande vocale. Un champ dont le seul nom est son placeholder est, pour
 * qui ne le voit pas, un champ sans nom. Ce contrôle ne le compte donc pas.
 *
 * Ce qui compte : un `<label>` associé, un `aria-label`, un `aria-labelledby`
 * qui désigne un texte existant, ou, à défaut, un `title`. L'étiquette peut
 * être visuellement masquée (`sr-only`) : ce n'est pas la même chose
 * qu'absente.
 *
 * ## Ce que le contrôle ne couvre pas
 *
 * Les champs que du JavaScript crée après coup, et ceux qui vivent derrière
 * une porte — un formulaire qui n'apparaît qu'après un clic. Il visite les
 * écrans et lit ce qui s'y trouve une fois déverrouillé, rien de plus.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/** Les écrans publiés, déduits de « dist ». */
function ecrans(dossier = 'dist', sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) ecrans(chemin, sortie);
    else if (nom === 'index.html') sortie.push(`/${relative('dist', dossier).replace(/\\/g, '/')}/`.replace('//', '/'));
  }
  return sortie;
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

let rouges = 0;
let nus = 0;
let champs = 0;
let visites = 0;

const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(`\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`);
    rouges += 1;
  }
};

console.log('\n\x1b[1mA1 — LE LIEN D’ÉVITEMENT\x1b[0m\n');
{
  await page.goto(`${RACINE}/revisions/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(600);
  }
  await page.keyboard.press('Tab');
  const premier = await page.evaluate(() => {
    const a = document.activeElement;
    return { texte: a?.textContent?.trim() ?? '', cible: a?.getAttribute('href') ?? '' };
  });
  verifier('le premier arrêt de tabulation est « Aller au contenu »', premier, {
    texte: 'Aller au contenu',
    cible: '#contenu-principal',
  });
  verifier(
    'et il est visible une fois atteint',
    await page.locator('a[href="#contenu-principal"]').first().isVisible(),
    true,
  );
  verifier('son ancre existe', await page.locator('main#contenu-principal').count(), 1);

  // Combien d'arrêts séparaient le haut de page du contenu, sans le lien.
  const avant = await page.evaluate(() => {
    const principal = document.querySelector('main#contenu-principal');
    const focalisables = [...document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((e) => e.offsetParent !== null || e.getClientRects().length > 0);
    return focalisables.findIndex((e) => principal?.contains(e));
  });
  // Le lien compris : c'est le premier des arrêts comptés ici, et il mène
  // directement au contenu. Les autres restent ce qu'ils étaient.
  console.log(`  (${avant} arrêts avant le contenu, dont ce lien en premier)`);
}

console.log('\n\x1b[1mA2 — LE NOM ACCESSIBLE COMMENCE PAR LE LIBELLÉ VISIBLE\x1b[0m\n');
{
  const ecarts = await page.evaluate(() => {
    /*
       Le nom accessible n'est **pas** `textContent` : un `<span
       aria-hidden>` — l'icône — en fait partie dans le texte brut et pas
       dans le nom. Le calculer ainsi faisait échouer le contrôle sur des
       onglets parfaitement conformes, ce qui est la pire sorte de contrôle.
    */
    const nomAccessible = (el) => {
      const etiquette = el.getAttribute('aria-label');
      if (etiquette?.trim()) return etiquette.trim();
      return [...el.querySelectorAll('span')]
        .filter((s) => !s.closest('[aria-hidden="true"]'))
        .map((s) => s.textContent.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    const sortie = [];
    for (const a of document.querySelectorAll(
      'nav[aria-label="Navigation principale"] a, nav[aria-label="Navigation principale"] summary',
    )) {
      const visible = [...a.querySelectorAll('span')]
        .filter((s) => !s.hasAttribute('aria-hidden') && !s.classList.contains('sr-only'))
        .map((s) => s.textContent.trim())
        .join(' ')
        .trim();
      const nom = nomAccessible(a);
      if (visible && !nom.toLowerCase().startsWith(visible.toLowerCase())) {
        sortie.push({ visible, nom });
      }
    }
    return sortie;
  });
  verifier('aucun onglet dont le nom ne commence pas par son libellé', ecarts, []);
}

console.log('\n\x1b[1mA3 — LES CHAMPS SANS ÉTIQUETTE\x1b[0m\n');

for (const ecran of ecrans()) {
  const reponse = await page.goto(`${RACINE}${ecran}`, { waitUntil: 'networkidle' }).catch(() => null);
  if (!reponse) continue;
  // Les pages de redirection n'ont pas d'écran.
  if (await page.locator('meta[http-equiv="refresh"]').count()) continue;
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(500);
  }
  visites += 1;

  const trouves = await page.evaluate(() => {
    const nom = (el) => {
      if (el.getAttribute('aria-label')?.trim()) return true;
      const par = el.getAttribute('aria-labelledby');
      if (par && par.split(/\s+/).some((id) => document.getElementById(id)?.textContent?.trim())) return true;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true;
      if (el.closest('label')) return true;
      if (el.getAttribute('title')?.trim()) return true;
      return false;
    };
    const sortie = [];
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (el.type === 'hidden') continue;
      // Un champ dans un bloc masqué compte quand même : il s'affichera.
      sortie.push({
        nu: !nom(el),
        quoi: `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''}#${el.id || '(sans id)'}`,
        exemple: el.getAttribute('placeholder') ?? '',
      });
    }
    return sortie;
  });

  for (const c of trouves) {
    champs += 1;
    if (c.nu) {
      console.log(`✗ ${ecran} ${c.quoi}${c.exemple ? ` — exemple « ${c.exemple} »` : ''}`);
      nus += 1;
    }
  }
}

await contexte.close();
await nav.close();

if (nus > 0) console.log(`\n${nus} champ(s) sans étiquette sur ${champs}, ${visites} écrans visités.`);
else console.log(`\x1b[32m✓\x1b[0m ${champs} champs sur ${visites} écrans : tous nommés.`);

if (rouges + nus > 0) {
  console.log(`\n\x1b[31m${rouges + nus} constat(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mTous les essais passent.\x1b[0m');
