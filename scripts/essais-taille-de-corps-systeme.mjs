/**
 * 0.7 — la taille de corps choisie par la personne, sur iOS.
 *
 *   npm run essais:taille-de-corps-systeme
 *
 * ## Le défaut
 *
 * iOS porte un réglage de taille de texte qui vaut pour tout l'appareil, et
 * les applications natives le suivent. Un site ne le suit que s'il le demande,
 * et Cyclades ne le demandait pas : la personne qui a grossi son texte dans
 * ses réglages retrouvait ici la taille d'un site ordinaire.
 *
 * `font: -apple-system-body` est le mot-clé par lequel WebKit livre cette
 * taille. Il livre aussi la famille système, qu'on reprend aussitôt : seule
 * la taille nous intéresse, et un site sans sa police n'est plus le même.
 *
 * ## Ce que cet essai NE PEUT PAS mesurer, et pourquoi il le dit en premier
 *
 * `-apple-system-body` appartient à WebKit. Le moteur des essais ne le
 * reconnaît pas, donc `@supports` y est faux et **la règle ne s'applique
 * pas ici**. Aucun essai de ce dépôt ne peut constater l'effet : il faudrait
 * un iPhone, un réglage changé à la main, et un œil.
 *
 * L'essai commence donc par PROUVER cette impossibilité, au lieu de la
 * supposer — `CSS.supports` rend faux, et c'est écrit noir sur blanc. Ce qui
 * suit est alors honnête : un constat sur la règle publiée et sur ce qu'elle
 * ne casse pas, pas une mesure de son effet.
 *
 * ## Et ce qu'il garde, qui n'est pas rien
 *
 * Trois régressions, toutes vues ailleurs dans ce dépôt :
 *
 * 1. la règle disparue de la feuille publiée — un `@supports` est invisible
 *    partout sauf chez ceux qu'il sert, donc personne ne s'en apercevrait ;
 * 2. la famille non rendue : `font: -apple-system-body` seul remplace la
 *    police du site par celle du système, sur tout iOS, sans un mot ;
 * 3. la règle sortie de son `@supports` et posée pour tous — ce qui serait
 *    l'option C de D-038, construite, mesurée et écartée le 14 octobre.
 */
import { chromium } from 'playwright-core';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
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
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 } })).newPage();

/*
   L'écran de verrouillage suffit : la feuille de styles est la même partout,
   et il n'y a rien à déchiffrer pour lire une règle CSS. Un essai qui
   déverrouille sans en avoir besoin se donne une raison de rougir.
*/
await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });

console.log('\nD’ABORD, LA PREUVE QUE CE MOTEUR NE PEUT PAS MESURER L’EFFET');

const reconnu = await page.evaluate(() => CSS.supports('font', '-apple-system-body'));
verifier(
  'ce moteur ne reconnaît pas « -apple-system-body » : la règle n’y est pas appliquée',
  reconnu,
  false,
);

console.log('\nLA RÈGLE EST BIEN DANS LA FEUILLE PUBLIÉE');

/*
   On lit les feuilles telles qu'elles sont SERVIES, et non le fichier source :
   une règle qu'une étape de construction écarterait passerait inaperçue, et
   c'est précisément le genre de perte qu'un `@supports` rend muette.
*/
const feuilles = await page.evaluate(() =>
  [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
);
verifier('la page sert au moins une feuille de styles', feuilles.length > 0, true);

let texte = '';
for (const url of feuilles) {
  const reponse = await page.request.get(url);
  if (reponse.ok()) texte += '\n' + (await reponse.text());
}
/* Les styles en ligne comptent aussi : Astro en pose. */
texte += '\n' + (await page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')));

const sansEspace = texte.replace(/\s+/g, '');

verifier(
  'elle déclare « font:-apple-system-body »',
  sansEspace.includes('font:-apple-system-body'),
  true,
);
verifier(
  'et elle le fait sous « @supports(font:-apple-system-body) »',
  sansEspace.includes('@supports(font:-apple-system-body)'),
  true,
);

/*
   LA FAMILLE RENDUE, ET DANS LE BON ORDRE. Le raccourci « font » remplace la
   famille ; la ligne qui la rend doit venir APRÈS, sinon elle ne sert à rien.
   On mesure donc la distance entre les deux dans le texte, et non leur simple
   présence — deux déclarations correctes dans le mauvais ordre forment une
   règle fausse.
*/
const ou = sansEspace.indexOf('font:-apple-system-body');
const apres = ou === -1 ? '' : sansEspace.slice(ou, ou + 160);
verifier(
  'la famille du site est rendue juste après, et non laissée au système',
  apres.includes('font-family:var(--font-sans)'),
  true,
);

console.log('\nET RIEN NE CHANGE POUR LES AUTRES NAVIGATEURS');

/*
   L'option B de D-038 passe par l'échelle des tailles, pas par la racine. Si
   la racine se mettait à bouger hors du `@supports`, ce serait l'option C —
   écartée parce qu'elle grossit aussi les marges, pour deux fois moins de
   texte gagné.
*/
const racine = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
verifier('la taille de la racine reste celle du navigateur', racine, '16px');

await nav.close();
console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
