/**
 * La bibliothèque peinte : l'arbre de l'INSP ne porte pas la matière commune.
 *
 *   npm run essais:filtre-parcours:navigateur
 *
 * ## Pourquoi un essai de navigateur en plus de celui de nœud
 *
 * `essais:filtre-parcours` mesure la fonction : un manifeste entre, un
 * manifeste réduit sort. Il ne dit pas que l'écran l'emploie. Entre les deux,
 * il y a `chargerManifeste`, quatorze écrans qui l'appellent, et la possibilité
 * qu'un seul d'entre eux lise le manifeste autrement. La bibliothèque est
 * l'écran où le défaut se voyait — des fiches d'« Organisation de la DGFiP »
 * dans l'arbre de l'INSP —, donc c'est là qu'il faut regarder.
 *
 * ## Les deux sens, et pourquoi les deux
 *
 * Un filtre qui retire tout passerait le premier contrôle. L'essai vérifie
 * donc que l'INSP ne voit PAS la matière commune **et** que DGFiP A la voit,
 * sur le même site, à la même minute. Si le corpus de ce conteneur ne portait
 * pas de fiche sous `commun/`, le premier constat serait vrai sans rien
 * prouver : l'essai le dit et rougit, plutôt que de passer au vert sur le vide.
 *
 * ## Ce qu'il lit
 *
 * Le menu « Filtrer par matière » est peuplé depuis le manifeste, une option
 * par matière : c'est la lecture la plus directe de ce que l'écran a reçu.
 * L'arbre lui-même est lu en second, parce qu'une matière pourrait figurer au
 * menu sans apparaître dans la liste.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const MATIERE_COMMUNE = 'Organisation de la DGFiP';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1100 } });
const page = await ctx.newPage();

const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
  }
};

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(2500);
  }
};

await franchirInitialisation(page, RACINE, MDP);

/** Ouvre la bibliothèque sur un parcours donné et rend ce qu'elle montre. */
async function ouvrirLaBibliotheque(idParcours) {
  await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
  await page.evaluate((id) => localStorage.setItem('revinsp.parcours', id), idParcours);
  await page.goto(`${RACINE}/bibliotheque/`, { waitUntil: 'networkidle' });
  await connecter();
  await page.waitForFunction(
    () => document.getElementById('chargement')?.classList.contains('hidden') === true,
    null,
    { timeout: 30000 },
  );
  return page.evaluate(() => ({
    matieresDuMenu: [...document.querySelectorAll('#filtre-matiere option')]
      .map((o) => o.value)
      .filter((x) => x !== ''),
    texteDeLArbre: document.getElementById('liste')?.textContent ?? '',
  }));
}

console.log('\nLA MATIÈRE COMMUNE EST SERVIE AUX PARCOURS DGFIP, ET À EUX SEULS');

const pourA = await ouvrirLaBibliotheque('dgfip-a');
/*
   LE TÉMOIN D'ABORD. Sans fiche sous « commun/ » dans ce conteneur, l'absence
   constatée ensuite chez l'INSP ne prouverait rien du tout.
*/
v(
  `DGFiP A : la matière « ${MATIERE_COMMUNE} » est au menu — sinon l'essai suivant ne prouve rien`,
  pourA.matieresDuMenu.includes(MATIERE_COMMUNE),
  true,
);
v(
  'DGFiP A : et elle apparaît dans l’arbre',
  pourA.texteDeLArbre.includes(MATIERE_COMMUNE),
  true,
);
v(
  'DGFiP A : il ne voit pas « Droit public », qui est une matière de l’INSP',
  pourA.matieresDuMenu.includes('Droit public'),
  false,
);

const pourInsp = await ouvrirLaBibliotheque('insp');
v(
  `INSP : la matière « ${MATIERE_COMMUNE} » n’est plus au menu`,
  pourInsp.matieresDuMenu.includes(MATIERE_COMMUNE),
  false,
);
v(
  'INSP : ni dans l’arbre',
  pourInsp.texteDeLArbre.includes(MATIERE_COMMUNE),
  false,
);
v(
  'INSP : et il voit toujours ses propres matières',
  pourInsp.matieresDuMenu.includes('Droit public'),
  true,
);

console.log('\nET AUCUNE ERREUR DE PAGE N’A ÉTÉ AVALÉE');
v('aucune erreur levée par les deux écrans', erreurs.slice(0, 3), []);

await nav.close();
console.log(
  echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} rouge${echecs > 1 ? 's' : ''}\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
