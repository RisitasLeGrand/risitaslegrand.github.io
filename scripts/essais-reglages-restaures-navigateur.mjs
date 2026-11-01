/**
 * LES RÉGLAGES RESTAURÉS SONT CONFRONTÉS À CE QUI EST POSSIBLE.
 *
 *   SITE_PASSWORD=… npm run essais:reglages-restaures:navigateur
 *
 * ## Le défaut
 *
 * `chargerReglages` du Quad N-Back restaurait `localStorage` TEL QUEL : ni le
 * type, ni les bornes, ni le pas n'étaient contrôlés. Un réglage enregistré
 * par une version antérieure, ou un stockage retouché, entrait dans l'état et
 * partait au moteur — et rien ne le corrigeait avant un appui sur un bouton.
 *
 * Les bornes ne vivaient que dans les attributs du balisage. Elles sont
 * désormais dans une table que le balisage ET le validateur lisent : écrire un
 * validateur qui les répéterait en aurait fait une troisième source.
 *
 * ## Les trois formes d'invalidité, et ce qu'elles deviennent
 *
 * - HORS BORNES : ramené à la borne. `n: 99` devient le maximum du moteur.
 * - HORS GRILLE : ramené au cran le plus proche. `epreuves: 11`, pas de 2,
 *   devient 12.
 * - MAUVAIS TYPE : retombe sur le défaut, parce qu'on ne devine pas ce qu'un
 *   stockage abîmé voulait dire. Et le type se vérifie par `typeof`, non par
 *   `Number` : `Number(null)` vaut 0, comme `Number('')` et `Number([])` —
 *   trois valeurs qui ne sont pas des nombres deviendraient des nombres
 *   parfaitement valides, et `interference: null` prendrait 0, son minimum,
 *   au lieu de retrouver son défaut.
 *
 * ## ET LE STOCKAGE N'EST PAS RÉÉCRIT
 *
 * La correction vaut pour l'ÉTAT. Réécrire le stockage au chargement
 * effacerait en silence un réglage qu'une version ultérieure saurait peut-être
 * relire — et le ferait sans qu'on ait rien demandé. C'est le dernier constat
 * de cet essai, et c'est celui qu'on oublie.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
/* La constante du moteur, importée : un essai qui écrirait « 12 » cesserait
   de mesurer le jour où le moteur change d'avis. */
import { N_MAXIMAL } from '../src/features/quad-n-back/moteur/nback.js';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const CLE = 'revinsp.nback.reglages';

/* Un stockage abîmé de toutes les façons qui comptent. */
const SEME = {
  n: 99, // hors bornes, très au-delà
  epreuves: 11, // hors grille (pas de 2)
  dureeEpreuve: 'beaucoup', // mauvais type : une chaîne
  tauxCorrespondance: -5, // hors bornes, en dessous
  interference: null, // mauvais type, et piège de coercition
  /*
     « motif » est gardé À DESSEIN : son sélecteur de source n'est rendu que
     si cette dimension est active. Sans elle, mon premier essai lisait
     `null` et appelait cela un défaut du validateur — c'était le défaut de
     mon semis.
  */
  dimensions: ['position', 'motif', 'inconnue'],
  sourceMotif: 'nimporte-quoi', // hors catalogue
  /*
     ZÉRO, ET NON « true ».

     Les deux interrupteurs ont `true` pour défaut. Semer une chaîne ne
     distinguerait donc rien : la coercition la rendrait vraie, le validateur
     rendrait le défaut, et les deux donneraient « allumé ». L'assertion
     n'aurait pu échouer d'aucune façon.

     `0` est FAUX par coercition et son défaut est VRAI : si personne ne
     contrôlait le type, l'interrupteur serait éteint, et le constat le dirait.
  */
  grille3D: 0,
  progression: { active: 0, seuilMontee: 1000, partiesMontee: 0 },
};

/* Ce que chacun doit devenir. Les défauts sont ceux du composant. */
const ATTENDU = {
  'niveau-n': N_MAXIMAL, // 99 borné au maximum du moteur
  'nb-epreuves': 12, // 11 ramené sur la grille
  duree: 2500, // chaîne → défaut
  'taux-corr': 10, // −5 borné au minimum
  interf: 20, // null → défaut, et NON 0
};

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
}
const vrai = (quoi, condition) => verifier(quoi, condition, true);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

await page.addInitScript((paire) => {
  try {
    localStorage.setItem(paire[0], paire[1]);
  } catch {
    /* La prémisse ci-dessous le dira. */
  }
}, [CLE, JSON.stringify(SEME)]);

await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/cog-training/quad-n-back/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#niveau-n', { timeout: 40000, state: 'attached' }).catch(() => {});
/* Les réglages vivent dans des dépliants : on les ouvre, sinon on mesure des
   curseurs que la page n'a pas encore rendus. */
const replis = await page.locator('details:not([open]) summary').count();
for (let i = 0; i < replis; i += 1) {
  await page.locator('details:not([open]) summary').first().click({ timeout: 2000 }).catch(() => {});
}
await page.waitForTimeout(600);

console.log('\nUN STOCKAGE ABÎMÉ NE PASSE PAS DANS L’ÉTAT\n');

vrai(
  'prémisse : le stockage semé a bien été lu',
  (await page.evaluate((c) => localStorage.getItem(c) !== null, CLE)) === true,
);
vrai('prémisse : les neuf curseurs sont rendus', (await page.locator('input[type=range]').count()) === 9);

console.log('LES CINQ CURSEURS PRINCIPAUX');
for (const [id, attendu] of Object.entries(ATTENDU)) {
  verifier(
    `${id} vaut ${attendu}`,
    Number(await page.locator(`#${id}`).inputValue()),
    attendu,
  );
}

console.log('\nLE RESTE, PAR SON TYPE');
/*
   ON LIT L'ÉCRAN SUR DES ANCRES QUI ONT UN SENS, et non sur des
   identifiants ajoutés pour la commodité d'un essai : trois des quatre que
   j'avais supposés n'existaient pas, et les inventer dans le code de
   production aurait été écrire la page pour l'essai.

   Les dimensions sont des boutons `aria-pressed` ; la grille 3D se désigne
   par l'`aria-describedby` de son avertissement, qui est unique ; la
   progression, par le texte de son étiquette.
*/
const etat = await page.evaluate(() => {
  /*
     LE PREMIER SPAN, et non tout le texte du bouton : chaque dimension porte
     son libellé puis sa description, et `textContent` les colle — mon premier
     constat obtenait « Position La case occupée » et rougissait pour la
     mauvaise raison.
  */
  const dimensions = [...document.querySelectorAll('button[aria-pressed]')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => (b.querySelector('span')?.textContent ?? '').replace(/[☑☐]/g, '').trim());
  const grille = document.querySelector('input[aria-describedby="avertissement-rotation"]');
  const etiquetteProgression = [...document.querySelectorAll('label')].find((l) =>
    (l.textContent ?? '').includes('Ajuster n automatiquement'),
  );
  return {
    dimensions,
    motif: document.getElementById('source-motif')?.value ?? null,
    grille3D: grille instanceof HTMLInputElement ? grille.checked : null,
    progressionActive:
      etiquetteProgression?.querySelector('input[type=checkbox]')?.checked ?? null,
  };
});

vrai(
  `prémisse : les dimensions se lisent (${JSON.stringify(etat.dimensions)})`,
  etat.dimensions.length > 0,
);
/*
   Semé : ['position', 'inconnue']. « inconnue » n'est pas une clé du moteur,
   donc aucun bouton ne la porte — ce qu'on mesure, c'est que l'état ne garde
   QUE la clé valide, et non qu'il retombe sur les quatre par défaut.
*/
verifier(
  'seules les dimensions valides du semis restent actives',
  etat.dimensions,
  ['Position', 'Motif'],
);
vrai(
  `le motif hors catalogue retombe sur un motif connu (${etat.motif})`,
  etat.motif === 'voronoi' || etat.motif === 'generatif',
);
verifier('un 0 enregistré n’éteint pas la grille 3D par coercition', etat.grille3D, true);
verifier('ni la progression', etat.progressionActive, true);

console.log('\nET LE STOCKAGE N’EST PAS RÉÉCRIT AVANT LE PREMIER GESTE');

/*
   LE CONSTAT QU'ON OUBLIE — et que j'ai littéralement oublié : il avait
   disparu de ce fichier. En réécrivant la section précédente, j'avais défini
   la tranche à remplacer entre deux ancres, et cette tranche contenait AUSSI
   celle-ci. Le sabotage qui réécrit le stockage au chargement passait donc au
   vert, faute d'être mesuré par quoi que ce soit.

   Puis, en voulant la rendre, j'ai gardé l'écriture derrière un `assert` sur
   le mot « STOCKAGE » — qui figure dans l'en-tête de ce fichier. Le garde-fou
   a donc refusé une écriture nécessaire, et la section est restée absente un
   tour de plus. Un garde-fou doit viser ce qu'il protège : ici l'ASSERTION,
   pas un mot du commentaire.

   Ce que ce constat garde : la correction vaut pour l'ÉTAT. Réécrire le
   stockage au chargement effacerait en silence un réglage qu'une version
   ultérieure saurait peut-être relire, et le ferait sans qu'on ait rien
   demandé.
*/
const stocke = JSON.parse(await page.evaluate((c) => localStorage.getItem(c), CLE));
verifier('le stockage porte encore la valeur hors bornes', stocke.n, 99);
verifier('et la valeur hors grille', stocke.epreuves, 11);
verifier('et la chaîne', stocke.dureeEpreuve, 'beaucoup');

verifier('aucune erreur de page', erreurs.slice(0, 3), []);

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('Un stockage abîmé est corrigé dans l’état, et laissé tel quel sur le disque.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
