/**
 * D-038 — la taille du texte, mesurée avant d'être discutée.
 *
 * La critique relevait que le texte courant est petit. « Petit » n'est pas
 * une mesure : ce script compte, écran par écran, **combien de caractères**
 * sont rendus à chaque taille. Pondérer par les caractères et non par les
 * éléments est le point : une page peut porter cinquante étiquettes de 11 px
 * et trois paragraphes de 14 px, et c'est pourtant le paragraphe qu'on lit.
 *
 *   npm run build && npm run mesure:tailles
 *
 * Il ne change rien. Il écrit un tableau, et c'est tout.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

const ECRANS = [
  '/revisions/',
  '/bibliotheque/',
  '/fiche/',
  '/glossaire/',
  '/actualites/',
  '/statistiques/',
  '/quiz/',
  '/quiz/dgfip/',
  '/progression/',
  '/profil/',
  '/planification/',
  '/odyssee/',
  '/odyssee/corps/',
  '/odyssee/finances/',
  '/sport/',
  '/sport/exercices/',
  '/recherche/',
  '/syntheses/',
];

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Les caractères visibles, par taille de police arrondie au pixel. */
const RELEVE = `(() => {
  const parTaille = new Map();
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let noeud;
  while ((noeud = marcheur.nextNode())) {
    const texte = (noeud.nodeValue ?? '').trim();
    if (!texte) continue;
    const parent = noeud.parentElement;
    if (!parent || !parent.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) continue;
    if (parent.closest('.sr-only, [aria-hidden="true"], #ecran-verrou')) continue;
    const taille = Math.round(parseFloat(getComputedStyle(parent).fontSize));
    parTaille.set(taille, (parTaille.get(taille) ?? 0) + texte.length);
  }
  return [...parTaille.entries()].sort((a, b) => a[0] - b[0]);
})()`;

for (const [largeur, hauteur, tactile] of [
  [1280, 900, false],
  [390, 844, true],
]) {
  const contexte = await nav.newContext({
    viewport: { width: largeur, height: hauteur },
    hasTouch: tactile,
    isMobile: tactile,
  });
  const page = await contexte.newPage();
  await franchirInitialisation(page, RACINE, MDP);

  const total = new Map();
  const parEcran = [];
  for (const ecran of ECRANS) {
    await page.goto(`${RACINE}${ecran}`, { waitUntil: 'networkidle' });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MDP);
      await page.click('#bouton-verrou');
      await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(900);
    const releve = await page.evaluate(RELEVE);
    let signes = 0;
    let petits = 0;
    for (const [taille, n] of releve) {
      total.set(taille, (total.get(taille) ?? 0) + n);
      signes += n;
      if (taille < 16) petits += n;
    }
    parEcran.push({ ecran, signes, petits });
  }
  await contexte.close();

  const signesTotal = [...total.values()].reduce((a, b) => a + b, 0);
  console.log(`\n\x1b[1m${largeur} × ${hauteur}\x1b[0m — ${signesTotal} caractères visibles sur ${ECRANS.length} écrans\n`);
  console.log('  taille   caractères     part   cumulé');
  let cumul = 0;
  for (const [taille, n] of [...total.entries()].sort((a, b) => a[0] - b[0])) {
    cumul += n;
    console.log(
      `  ${String(taille).padStart(4)} px ${String(n).padStart(11)} ${((n / signesTotal) * 100).toFixed(1).padStart(7)} % ${((cumul / signesTotal) * 100).toFixed(1).padStart(7)} %`,
    );
  }
  const sous16 = [...total.entries()].filter(([t]) => t < 16).reduce((a, [, n]) => a + n, 0);
  const sous14 = [...total.entries()].filter(([t]) => t < 14).reduce((a, [, n]) => a + n, 0);
  console.log(
    `\n  Sous 16 px : ${((sous16 / signesTotal) * 100).toFixed(1)} % du texte lu. Sous 14 px : ${((sous14 / signesTotal) * 100).toFixed(1)} %.`,
  );
  console.log('\n  Les cinq écrans dont le texte est le plus petit :');
  for (const e of parEcran
    .filter((e) => e.signes > 0)
    .sort((a, b) => b.petits / b.signes - a.petits / a.signes)
    .slice(0, 5)) {
    console.log(`    ${e.ecran.padEnd(24)} ${((e.petits / e.signes) * 100).toFixed(0)} % sous 16 px (${e.signes} caractères)`);
  }
}

await nav.close();
