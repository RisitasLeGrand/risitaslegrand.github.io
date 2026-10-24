/**
 * T2 — les en-têtes de colonnes qui se touchent.
 *
 * ## Ce qui se passe, et pourquoi le gabarit ne le montre pas
 *
 * Une cellule alignée à droite suivie d'une cellule alignée à gauche, sans
 * marge horizontale, met deux mots bout à bout : « CIBLE » et « ÉCART » se
 * lisent « CIBLEÉCART ». Les cellules, elles, sont parfaitement séparées — ce
 * sont les **textes** qui se rejoignent, chacun poussé contre la frontière.
 * Aucune lecture du gabarit ne le révèle : il faut mesurer le rendu.
 *
 * ## Ce que la sonde mesure
 *
 * Pour chaque ligne d'en-tête de chaque tableau, l'écart entre la boîte réelle
 * du texte d'une cellule et celle de la suivante — pas entre les cellules,
 * dont la frontière est invisible. Sous huit pixels, les deux mots se lisent
 * comme un seul.
 *
 * ## Ce qu'elle ne couvre pas
 *
 * Les lignes de **corps**, que le JavaScript peint à partir de données que
 * cette sonde n'a pas : elle visite des écrans vides. Les en-têtes, eux, sont
 * dans le HTML et toujours là. La règle qui les sépare s'applique aussi aux
 * cellules de corps, mais ce contrôle n'en témoigne pas.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
/** Deux mots séparés de moins de ça se lisent comme un seul. */
const ECART_MINIMUM = 8;

/** Les écrans qui portent un tableau. */
const ECRANS = [
  '/statistiques/',
  '/stockage/',
  '/sport/programmes/',
  '/sport/force/',
  '/quiz/dgfip/',
  '/odyssee/veille/',
  '/odyssee/tendances/',
  '/odyssee/corps/',
];

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

let fautes = 0;
let paires = 0;

for (const ecran of ECRANS) {
  await page.goto(`${RACINE}${ecran}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(600);
  }

  const mesures = await page.evaluate(() => {
    /** La boîte des glyphes, et non celle de la cellule : c'est le texte qui touche. */
    const boite = (cellule) => {
      const plage = document.createRange();
      plage.selectNodeContents(cellule);
      const r = plage.getBoundingClientRect();
      return r.width > 0 ? r : null;
    };
    const sortie = [];
    for (const ligne of document.querySelectorAll('thead tr')) {
      if (!ligne.offsetParent && ligne.getClientRects().length === 0) continue;
      const cellules = [...ligne.children];
      for (let i = 0; i < cellules.length - 1; i += 1) {
        const a = boite(cellules[i]);
        const b = boite(cellules[i + 1]);
        if (!a || !b) continue;
        sortie.push({
          gauche: cellules[i].textContent.trim(),
          droite: cellules[i + 1].textContent.trim(),
          ecart: Math.round(b.left - a.right),
        });
      }
    }
    return sortie;
  });

  for (const m of mesures) {
    paires += 1;
    if (m.ecart < ECART_MINIMUM) {
      console.log(`✗ ${ecran} « ${m.gauche} » et « ${m.droite} » : ${m.ecart} px.`);
      fautes += 1;
    }
  }
}

await contexte.close();
await nav.close();

if (fautes > 0) {
  console.log(`\n${fautes} paire(s) d'en-têtes sur ${paires} sous ${ECART_MINIMUM} px.`);
  process.exit(1);
}
console.log(`✓ ${paires} paires d'en-têtes mesurées sur ${ECRANS.length} écrans : toutes ≥ ${ECART_MINIMUM} px.`);
