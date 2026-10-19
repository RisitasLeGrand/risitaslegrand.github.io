/**
 * La fiche d'une molécule s'affiche — reliquat des prompts 30 et 31.
 *
 *   npm run essais:molecule:navigateur
 *
 * ## Pourquoi cet essai existe
 *
 * `astro check` signalait, parmi ses neuf erreurs, que la ligne
 * `$('vers-bibliographie').setAttribute('href', lien(…))` appelait un
 * `HTMLAnchorElement`. Ce n'était pas une plainte de typage : une
 * constante locale `lien` masquait l'aide `lien()` importée en tête de
 * module, et l'appel levait. Tout ce qui suit dans la fonction — le
 * journal, le masquage de « chargement », l'affichage de la fiche — ne
 * s'exécutait jamais.
 *
 * Le build ne pouvait pas le voir : un script de page est empaqueté, pas
 * typé. Cet essai, lui, ouvre la page et regarde.
 *
 * ## Ce qu'il ne prouve pas
 *
 * Le contenu de la fiche. On arrive sans traitement connu, donc la page
 * se rabat sur « Molécule » — c'est son chemin dégradé, et c'est celui
 * qui souffrait du défaut au même titre que l'autre. Le registre et le
 * journal ont leurs propres contrôles.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();

/*
   Deux canaux, et il faut les deux. `pageerror` ne voit que ce qui
   remonte ; or `auDeverrouillage` **attrape** l'exception du rendu, la
   journalise et affiche un pavé d'échec dans la zone de chargement. Le
   défaut était donc visible à l'écran mais muet pour `pageerror`, et une
   sonde qui n'aurait écouté que lui aurait dit « aucune erreur » devant
   une page en panne.
*/
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') erreurs.push(`console: ${m.text().slice(0, 120)}`);
});

await franchirInitialisation(page, RACINE, MDP);

const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
};

console.log('\n\x1b[1mLA FICHE D’UNE MOLÉCULE S’AFFICHE\x1b[0m');

/*
   Le COFFRE d'abord, et pas seulement le mot de passe du site : ce sont
   deux verrous distincts, et la fiche d'une molécule vit sous le second.
   Ma première version ne l'ouvrait pas ; la page affichait donc son
   écran « coffre fermé », où la sonde « chargement a disparu » passait
   au vert pour une raison qui n'avait rien à voir. Une prémisse d'essai
   se lit, elle ne se devine pas — et on l'affirme avant de mesurer.
*/
await aller('/odyssee/corps/');
if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
}
await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
vrai(
  'le coffre est ouvert avant de mesurer quoi que ce soit',
  await page.evaluate(
    () => !document.getElementById('temoin-coffre')?.classList.contains('hidden'),
  ),
);

await aller('/odyssee/molecule/?nom=Zorbitrex');

/*
   On attend l'état FINAL de la fonction fautive — la fiche visible —
   plutôt qu'un délai fixe : un délai lit une page à moitié peinte, et
   c'est une faute que j'ai déjà commise sur ce chantier.
*/
const vue = await page
  .waitForSelector('#fiche:not(.hidden)', { timeout: 30000 })
  .then(() => true)
  .catch(() => false);
vrai('la fiche est affichée', vue);
v('« chargement » a disparu', await page.locator('#chargement').isVisible(), false);
v('et l’écran « coffre fermé » n’est pas celui qu’on mesure', await page.locator('#coffre-ferme').isVisible(), false);

/*
   Le lien dont l'affectation levait. On exige un `href` réel : un attribut
   absent rend `null`, et c'est exactement ce que le défaut produisait.
*/
const href = await page.getAttribute('#vers-bibliographie', 'href');
vrai(`le lien vers la bibliographie porte une adresse (${href})`, typeof href === 'string' && href.includes('/odyssee/bibliographie/'));

/* ══════════════════════════════════════════════════════════════════════════
   M-20 — le nom d'une molécule ne sort pas du coffre par le titre ni par
   l'adresse
   ══════════════════════════════════════════════════════════════════════════

   L'interdit 1 du prompt 41 : « coffre fermé, aucun texte en clair de plus
   qu'aujourd'hui, y compris dans un titre de page ». Le titre d'onglet
   portait « <molécule> · Cyclades », et le nom venait du magasin scellé
   quand on ouvrait la fiche depuis un traitement déclaré. Il restait dans
   l'onglet, dans la liste des onglets et dans l'historique — après la
   fermeture du coffre comprise.

   On mesure donc les deux sorties possibles : le titre, et l'adresse. */
{
  const titre = await page.title();
  v('le titre d’onglet ne porte aucun nom de molécule', titre, 'Molécule · Cyclades');

  await aller('/odyssee/molecule/');
  await page.waitForSelector('#index-molecules:not(.hidden)', { timeout: 30000 });
  const entrees = await page.locator('#liste-catalogue button').count();
  vrai(`l’index propose les fiches du catalogue (${entrees})`, entrees > 0);
  v(
    'ses entrées sont des boutons et non des liens',
    await page.locator('#liste-catalogue a').count(),
    0,
  );

  await page.locator('#liste-catalogue button').first().click();
  await page.waitForSelector('#fiche:not(.hidden)', { timeout: 30000 });
  v(
    'ouvrir une fiche depuis l’index n’écrit aucun nom dans l’adresse',
    new URL(page.url()).search,
    '',
  );
  v(
    'et le titre d’onglet reste muet',
    await page.title(),
    'Molécule · Cyclades',
  );
  vrai(
    'la fiche ouverte depuis l’index affiche bien son nom DANS la page',
    ((await page.textContent('#titre-molecule')) ?? '').trim().length > 0,
  );
}

console.log('\n\x1b[1mLES INTERACTIONS SOURCÉES SONT À L’ÉCRAN\x1b[0m');

/*
   LE DÉFAUT QUE CETTE SECTION GARDE, et il a vécu trois jours : onze
   interactions du Thésaurus de l'ANSM existaient dans le code depuis le
   16 octobre, et AUCUN écran ne les montrait. L'en-tête de cette page
   affirmait même « aucune interaction n'a pu être sourcée ».

   Un essai de Node prouve que la liaison calcule juste. Seul celui-ci prouve
   que le résultat arrive jusqu'à la page — c'est exactement la distance qui
   manquait.
*/
{
  const ouvrirLaFiche = async (nom) => {
    await page.goto(`${RACINE}/odyssee/molecule/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#index-molecules:not(.hidden)', { timeout: 30000 });
    await page.locator('#liste-catalogue button', { hasText: nom }).first().click();
    await page.waitForTimeout(900);
  };

  await ouvrirLaFiche('Caféine');
  const paires = await page.locator('#interactions li').count();
  v('la caféine montre ses sept interactions', paires, 7);

  const etat = (await page.textContent('#interactions-etat')) ?? '';
  vrai('l’écran dit combien et d’où elles viennent', etat.includes('7 interactions') && etat.includes('ANSM'));

  /*
     L'ORDRE EST CELUI DE LA GRAVITÉ : une association déconseillée en bas de
     liste est une ligne qu'on ne lit pas. C'est la hiérarchie anti-fatigue
     de la décision 3.10 rendue visible.
  */
  const niveaux = await page.locator('#interactions [data-niveau]').evaluateAll((n) =>
    n.map((e) => e.dataset.niveau),
  );
  v('la plus grave est en tête', niveaux[0], 'Association déconseillée');
  v('et la dernière est la moins grave', niveaux[niveaux.length - 1], 'À prendre en compte');

  /*
     CHAQUE GRAVITÉ PORTE SA SOURCE ET SA PAGE. Une gravité sans source
     serait la valeur non sourcée que tout ce domaine empêche — et ici elle
     porterait sur une association médicamenteuse.
  */
  const premiere = (await page.locator('#interactions li').first().textContent()) ?? '';
  vrai('la première cite le Thésaurus', premiere.includes('Thésaurus des interactions'));
  vrai('avec sa version', premiere.includes('septembre 2023'));
  vrai('et la page où la relire', /p\. \d+/.test(premiere));

  /* Ce que la liste ne dit pas, dit une fois sous la liste. */
  const limite = (await page.textContent('#interactions-source')) ?? '';
  vrai('l’écran dit que le document n’est plus à jour', limite.includes('plus mis à jour'));
  vrai('et qu’une absence n’est pas une innocuité', limite.includes('n’est pas une interaction inexistante'));

  /*
     SOUS QUEL NOM. Le document ne traite pas la testostérone mais la classe
     « androgènes » : l'afficher sans le dire laisserait croire que l'entrée
     vise cet ester-là.
  */
  await ouvrirLaFiche('Testostérone énantate');
  const sous = (await page.textContent('#interactions-sous')) ?? '';
  vrai('la testostérone dit sous quel nom le document la traite', sous.includes('androgènes'));
  v('et montre ses deux paires', await page.locator('#interactions li').count(), 2);

  /*
     LES DEUX ÉTATS QUI SE RESSEMBLENT ET NE SE DISENT PAS PAREIL.
     N-acétylcystéine a été CHERCHÉE dans le document, qui ne la traite pas.
     Ce n'est pas « aucune interaction » : c'est une absence de document.
  */
  await ouvrirLaFiche('N-acétylcystéine');
  v('une molécule absente du document n’affiche aucune paire', await page.locator('#interactions li').count(), 0);
  const absente = (await page.textContent('#interactions-etat')) ?? '';
  vrai('et l’écran dit que c’est une absence de document', absente.includes('absence de document'));
  vrai('sans affirmer une absence d’interaction', !absente.includes('aucune interaction'));
  v('elle ne cite aucun nom d’entrée', await page.locator('#interactions-sous:not(.hidden)').count(), 0);
}

v('aucune erreur de script', erreurs, []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
