/**
 * Rien de technique ne doit se faire entendre (prompt 43, lot 2, point a).
 *
 *   npm run essais:scripts-parles
 *
 * ## Pourquoi ce contrôle existe
 *
 * Un script parlé est lu par une synthèse qui ne saute rien. Tout ce qui
 * reste de la syntaxe du Markdown, du HTML ou de l'en-tête d'une fiche sera
 * **prononcé** : « accolade dièse », « deux astérisques », « http deux
 * points slash slash ». Et la personne qui écoute n'a aucun moyen de savoir
 * que c'est une coquille et non une phrase du cours — à la différence du
 * texte à l'écran, où une balise qui dépasse se voit.
 *
 * Pire : l'audio est synthétisé une fois, chiffré, publié. Une fuite
 * découverte après coup ne se corrige pas sans régénérer, c'est-à-dire sans
 * des heures de machine. Le bon moment pour l'attraper est donc **avant la
 * synthèse**, et c'est pour cela que la même règle garde aussi la
 * construction : `scripts/podcasts.mjs` refuse de produire un audio à
 * partir d'un script fautif.
 *
 * ## Les deux parties, et ce que chacune prouve
 *
 * 1. **La règle elle-même**, sur des cas écrits à la main. Un contrôle qui
 *    ne trouve rien sur un corpus propre ne prouve rien du tout : il faut
 *    lui montrer des fuites et le voir les nommer. On lui montre aussi des
 *    phrases françaises parfaitement normales, parce qu'un garde-fou trop
 *    large est pire qu'absent — il finirait par être désactivé.
 * 2. **Le corpus entier**, les 427 scripts que les fiches produisent
 *    aujourd'hui. Aucune fuite au moment où ces lignes sont écrites ; ce
 *    contrôle est là pour le jour où une fiche nouvelle en apportera une.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne synthétise rien, ne touche à aucun audio, et n'écrit aucun fichier.
 * Il relit le contenu et appelle la même fonction d'écriture que la chaîne
 * de production.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import YAML from 'yaml';
import { decouperSections } from './lib/markdown.mjs';
import { ecrireScript, fuitesDuScript, MOTIFS_DE_FUITE } from './lib/podcast.mjs';

const DOSSIER = 'content';

let rouges = 0;
const v = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};

/* ── 1. La règle, sur des fuites fabriquées ─────────────────────────────── */

console.log('\n\x1b[1mCE QUI NE DOIT JAMAIS SE FAIRE ENTENDRE\x1b[0m\n');

const FUITES = [
  ['un attribut d’accolade', 'La hiérarchie des normes {#hierarchie} structure l’ordre juridique.'],
  ['un attribut de classe', 'Le principe est clair {:.important} et il tient.'],
  ['un commentaire HTML', 'Un point de méthode. <!-- vérifier le chiffre -->'],
  ['une balise HTML', 'Le contrôle est <strong>obligatoire</strong> depuis 1958.'],
  ['un dièse de titre', 'Premier point.\n## Le contrôle de constitutionnalité'],
  ['des astérisques de gras', 'La règle est **impérative** et sans exception.'],
  ['un accent grave', 'La valeur de `budget_initial` est fixée en loi de finances.'],
  ['un lien Markdown', 'Voir la fiche [sur la QPC](/fiches/qpc/) pour le détail.'],
  ['des crochets doubles', 'Le renvoi [[fiche-12]] complète ce point.'],
  ['une adresse web', 'Le texte figure sur https://www.legifrance.gouv.fr intégralement.'],
  ['un séparateur de tableau', 'Délai | Texte\n|--- | ---\n3 ans | L. 169'],
  ['une barre de tableau', 'IR et IS | 3 ans | article L. 169 du LPF'],
  ['un conteneur de bloc', '::: attention\nLe délai court du 31 décembre.\n:::'],
  ['un chevron de citation', '> La loi ne dispose que pour l’avenir.'],
  ['une clé d’en-tête', 'titre: La hiérarchie des normes\nmatiere: droit-public'],
];

for (const [quoi, texte] of FUITES) {
  const fuites = fuitesDuScript([texte]);
  v(`${quoi} est refusé`, fuites.length > 0, true);
  if (fuites.length) v(`  … et le paragraphe fautif est situé`, fuites[0].rang, 0);
}

/* ── 2. Ce que la règle doit laisser passer ─────────────────────────────── */

console.log('\n\x1b[1mCE QUI EST DU FRANÇAIS, ET DOIT PASSER\x1b[0m\n');

/*
   La typographie française met une espace avant le deux-points. « Sources :
   Insee » n'a donc rien d'une clé d'en-tête, qui s'écrit « sources: » —
   minuscules, collée, en tête de ligne. C'est la distinction qui a coûté la
   première version de ce garde-fou : il accusait huit paragraphes de huit
   fiches, tous irréprochables.
*/
const DICIBLES = [
  'Le principe est simple : la norme supérieure prime sur l’inférieure.',
  'Sources : projets de loi de finances et de loi de règlement.',
  'Source : Banque mondiale.',
  'Trois conditions : un acte, un préjudice, un lien entre les deux.',
  'Le Conseil d’État l’a jugé en 1989, dans l’arrêt Nicolo.',
  'Deuxième partie, sur trois : le contrôle de constitutionnalité.',
  'Le déficit atteint 5,5 % du produit intérieur brut en 2024.',
  'Précisons ce terme : la gouvernance, c’est l’ensemble des règles de pilotage.',
  'L’article L 169 du livre des procédures fiscales fixe un délai de trois ans.',
  'Il y a aussi la reconnaissance mutuelle, et elle change tout.',
];

for (const texte of DICIBLES) {
  const fuites = fuitesDuScript([texte]);
  v(
    `« ${texte.slice(0, 52)}${texte.length > 52 ? '…' : ''} » passe`,
    fuites.map((f) => f.nom),
    [],
  );
}

v('la table des motifs est non vide', MOTIFS_DE_FUITE.length > 0, true);

/* ── 3. Le corpus entier ────────────────────────────────────────────────── */

console.log('\n\x1b[1mLES SCRIPTS QUE LES FICHES PRODUISENT AUJOURD’HUI\x1b[0m\n');

async function lister(dossier) {
  const trouves = [];
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith('.')) continue;
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) trouves.push(...(await lister(complet)));
    else if (entree.name.endsWith('.md')) trouves.push(complet);
  }
  return trouves;
}

if (!existsSync(DOSSIER)) {
  console.log(
    `  \x1b[33m—\x1b[0m pas de dossier « ${DOSSIER} » ici : seule la règle a été éprouvée.\n` +
      '      Les fiches en clair ne sont jamais commitées ; ce contrôle ne peut donc\n' +
      '      lire le corpus que sur la machine où il est fabriqué, et il le dit.',
  );
} else {
  let glossaire = [];
  for (const nom of ['glossaire.yml', 'glossaire.yaml']) {
    const chemin = path.join(DOSSIER, nom);
    if (existsSync(chemin)) {
      glossaire = YAML.parse(await readFile(chemin, 'utf8')) ?? [];
      break;
    }
  }

  let fiches = 0;
  let scripts = 0;
  const coupables = [];

  for (const chemin of await lister(DOSSIER)) {
    const { data, content } = matter(await readFile(chemin, 'utf8'));
    if (!data?.titre) continue;
    fiches += 1;
    const { sections } = decouperSections(content);
    const script = ecrireScript({
      titre: data.titre,
      matiere: data.matiere,
      fascicule: data.fascicule,
      cours: sections.cours,
      glossaire,
    });
    if (!script) continue;
    scripts += 1;
    for (const fuite of fuitesDuScript(script.paragraphes)) {
      coupables.push(`${chemin} §${fuite.rang} — ${fuite.nom} — … ${fuite.extrait}`);
    }
  }

  console.log(`      ${fiches} fiches lues, ${scripts} scripts parlés examinés`);
  if (coupables.length) {
    for (const ligne of coupables.slice(0, 20)) console.log(`      ${ligne}`);
    if (coupables.length > 20) console.log(`      … et ${coupables.length - 20} autres`);
  }
  v('aucune fuite technique dans les scripts parlés', coupables.length, 0);
  v('et le corpus en porte bien plusieurs centaines', scripts > 300, true);
}

console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m\n'
    : `\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m\n`,
);
process.exit(rouges === 0 ? 0 : 1);
