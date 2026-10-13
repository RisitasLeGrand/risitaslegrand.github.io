/**
 * Deux faits de structure que l'œil ne contrôle pas : le titre de niveau 1, et
 * l'unicité du titre d'onglet.
 *
 * ## Pourquoi un `<h1>` par écran, et pourquoi celui du verrou ne compte pas
 *
 * Chaque page porte déjà le `<h1>` « Espace privé » de l'écran de verrouillage.
 * Il est réel dans le HTML, et c'est précisément ce qui rend le défaut
 * invisible à un compteur naïf : une page sans titre propre **a quand même un
 * `<h1>`**. Une fois le mot de passe saisi, l'écran de verrouillage est masqué
 * et la page se retrouve sans titre pour qui navigue au clavier ou au lecteur
 * d'écran. Ce contrôle écarte donc le bloc `#ecran-verrou` avant de compter.
 *
 * ## Pourquoi l'unicité du `<title>`
 *
 * Deux onglets ouverts sur deux écrans différents doivent se distinguer, et un
 * historique de navigation où trois entrées s'appellent « Quiz » ne se relit
 * pas. L'unicité n'est pas une convention d'esthétique : c'est la seule chose
 * qui rende l'historique utilisable.
 *
 * ## Ce que le contrôle ne couvre pas
 *
 * Les pages de redirection produites par Astro (un `<meta http-equiv>` et rien
 * d'autre) sont écartées : elles n'ont pas d'écran. Un titre changé par du
 * JavaScript après l'affichage lui échappe également — il lit le HTML
 * construit, pas la page vivante.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = 'dist';

function pages(dossier) {
  const sortie = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...pages(chemin));
    else if (nom.endsWith('.html')) sortie.push(chemin);
  }
  return sortie;
}

/**
 * Le bloc du verrou, retiré avant de compter : son `<h1>` n'est pas celui de
 * l'écran.
 *
 * Le découpage compte les `<div>` ouvertes et fermées plutôt que de chercher
 * une suite de balises fermantes : une expression régulière s'arrête à la
 * première qui ressemble à la fin, et emporte alors la moitié de la page — ce
 * qui donne un contrôle qui accuse des écrans parfaitement titrés.
 */
function sansVerrou(html) {
  const debut = html.indexOf('<div id="ecran-verrou"');
  if (debut === -1) return html;
  const balise = /<div\b|<\/div>/g;
  balise.lastIndex = debut;
  let profondeur = 0;
  let m;
  while ((m = balise.exec(html)) !== null) {
    profondeur += m[0] === '</div>' ? -1 : 1;
    if (profondeur === 0) return html.slice(0, debut) + ' ' + html.slice(balise.lastIndex);
  }
  return html.slice(0, debut);
}

const estRedirection = (html) => /<meta http-equiv="refresh"/i.test(html);

/**
 * Les écrans sans `<h1>` qui sont **connus**, et attendent une réponse.
 *
 * Une exception nommée n'est pas un défaut pardonné : elle est annoncée à
 * chaque exécution, avec la ligne de décision qui la tient ouverte. Elle
 * disparaît de cette liste le jour où la décision est prise — dans un sens ou
 * dans l'autre.
 */
const CONNUS = new Map([['dist/revisions/index.html', 'D-037']]);

let fautes = 0;
let rappels = 0;
const titres = new Map();
let examinees = 0;

for (const page of pages(RACINE)) {
  const html = readFileSync(page, 'utf8');
  if (estRedirection(html)) continue;
  examinees += 1;

  if (!/<h1[\s>]/.test(sansVerrou(html))) {
    const connu = CONNUS.get(page.split('\\').join('/'));
    if (connu) {
      console.log(`· ${page} : aucun <h1> hors du verrou — connu, ${connu}, en attente.`);
      rappels += 1;
    } else {
      console.log(`✗ ${page} : aucun <h1> hors de l'écran de verrouillage.`);
      fautes += 1;
    }
  }

  /*
     Un identifiant en double ne lève aucune erreur, et c'est ce qui le rend
     dangereux : « getElementById » rend simplement le premier du document, et
     le code qui cherchait l'autre écrit au mauvais endroit. Un lien
     d'évitement posé sur le <main> avec un identifiant déjà pris par l'écran
     de fiche a suffi à faire écrire le cours par-dessus la page.
  */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const vus = new Set();
  for (const id of ids) {
    if (vus.has(id)) {
      console.log(`✗ ${page} : identifiant « ${id} » en double.`);
      fautes += 1;
    }
    vus.add(id);
  }

  const titre = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  if (titres.has(titre)) {
    console.log(`✗ ${page} : même <title> que ${titres.get(titre)} — « ${titre} ».`);
    fautes += 1;
  } else titres.set(titre, page);
}

if (fautes > 0) {
  console.log(`\n${fautes} défaut(s) de structure.`);
  process.exit(1);
}
console.log(
  `✓ ${examinees} écrans : un <h1> propre chacun, et ${titres.size} titres distincts` +
    (rappels > 0 ? `, ${rappels} exception(s) déclarée(s) ci-dessus.` : '.'),
);
