#!/usr/bin/env node
/**
 * Construit `content/sante/bibliographie.json` — la copie figée et datée de
 * la **partie bibliographique** de NooTopics.
 *
 * ## Ce qui est repris, et ce qui ne l'est pas
 *
 * Repris : ce qui **décrit une référence** — titre, adresse, revue, année,
 * type d'étude, portail d'origine, identifiant externe (PMID, DOI), thème et
 * sous-thèmes, composés cités, et la date d'ajout à la bibliothèque.
 *
 * Écarté, et la liste est la partie importante de ce fichier :
 *
 *  - **les pseudonymes** de ceux qui ont partagé chaque référence. Le
 *    propriétaire de la base autorise la reprise, mais Cyclades n'a aucun
 *    besoin de savoir qui a posté quoi, et une liste de qui s'intéresse à
 *    quelle molécule est exactement le genre de chose qu'on ne recopie pas
 *    « au cas où » ;
 *  - **les extraits d'articles** (colonne 8 de la source), qui sont des
 *    citations d'abstracts. Elles n'appartiennent ni à Cyclades ni à
 *    NooTopics mais aux éditeurs et aux auteurs des articles : l'accord reçu
 *    ne les couvre pas, et le lien y mène de toute façon ;
 *  - **les témoignages** (`anec`) et leurs auteurs (`anecAuthors`). Ils
 *    appartiennent bien à NooTopics — la question des droits est réglée —
 *    mais ce sont des rapports non vérifiés, dont des doses, et la règle de
 *    la branche Santé est de ne rien afficher comme un fait qui n'en est pas
 *    un ;
 *  - **les salons et serveurs** d'origine (colonnes 13 et 14) : provenance
 *    communautaire, sans intérêt pour chercher un article ;
 *  - **les colonnes dont je ne sais pas ce qu'elles veulent dire** (9, 11,
 *    12, 15, 18, 20). Les recopier sous un nom inventé serait pire que de
 *    les laisser : un champ mal nommé finit par être lu de travers.
 *
 * ## Pourquoi une copie figée, et datée
 *
 * Une bibliographie qu'on consulte hors ligne doit dire de quand elle date,
 * sinon elle se fait passer pour à jour. Le fichier porte `genereLe` et les
 * bornes de la source (`premierPartage`, `dernierPartage`), et l'écran les
 * affiche. Le lien vers la version vivante reste à un clic.
 *
 * ## Usage
 *
 *     node scripts/construire-bibliographie.mjs <chemin-du-fichier-source>
 *
 * Comme pour le registre de molécules, le fichier source se lit **hors du
 * dépôt** et ne s'y copie jamais. Ce script ne télécharge rien : lui donner
 * une adresse en ferait un aspirateur, et une copie figée se fait une fois,
 * à la main, en sachant qu'on la fait.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error(
    'Usage : node scripts/construire-bibliographie.mjs <chemin-du-fichier-source>\n\n' +
      'Le fichier source est la page de la bibliothèque, téléchargée à la main dans un\n' +
      'dossier temporaire hors du dépôt. Ce script ne télécharge rien.',
  );
  process.exit(2);
}
if (path.resolve(source).startsWith(path.resolve('.') + path.sep)) {
  console.error(
    `✗ « ${source} » est dans le dépôt. Le fichier source se lit hors du dépôt, et ne s’y\n` +
      '  copie jamais. Mets-le dans un dossier temporaire.',
  );
  process.exit(1);
}

const brut = await readFile(source, 'utf8');
const debut = brut.indexOf('<script type="application/json" id="data">');
if (debut === -1) {
  console.error('✗ Aucun bloc de données trouvé : le format de la page a changé.');
  process.exit(1);
}
const d = JSON.parse(brut.slice(brut.indexOf('>', debut) + 1, brut.indexOf('</script>', debut)));

/*
   Le format de la source est un tableau de colonnes sans nom. Il est donc
   vérifié avant d'être lu : une colonne qui se décale d'un cran écrirait des
   titres dans les adresses sans que rien ne proteste.
*/
const LARGEUR = 21;
const problemes = [];
if (!Array.isArray(d.rows) || !d.rows.length) problemes.push('« rows » absent ou vide');
else if (d.rows.some((r) => !Array.isArray(r) || r.length !== LARGEUR)) {
  problemes.push(`toutes les lignes n’ont pas ${LARGEUR} colonnes`);
}
for (const [nom, attendu] of [
  ['topics', 'array'],
  ['subtopics', 'object'],
  ['sources', 'array'],
  ['studyTypes', 'array'],
  ['compounds', 'array'],
]) {
  const v = d[nom];
  const sorte = Array.isArray(v) ? 'array' : typeof v;
  if (sorte !== attendu) problemes.push(`« ${nom} » attendu ${attendu}, trouvé ${sorte}`);
}
if (d.rows?.[0] && !/^https?:\/\//.test(d.rows[0][1])) {
  problemes.push('la colonne 1 ne contient pas une adresse : les colonnes ont bougé');
}
if (problemes.length) {
  console.error('✗ Le format de la source a changé, rien n’est écrit :');
  for (const p of problemes) console.error(`  - ${p}`);
  process.exit(1);
}

/** Les colonnes lues, nommées une fois pour toutes. */
const TITRE = 0;
const URL = 1;
const THEME = 2;
const SOUS_THEMES = 3;
const AJOUTE_LE = 4;
const PORTAIL = 5;
const TYPE_ETUDE = 7;
const IDENTIFIANT = 10;
const COMPOSES = 16;
const ANNEE = 17;
const REVUE = 19;

const texte = (v) => (typeof v === 'string' ? v.trim() : '');
const entier = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const listeEntiers = (v) => (Array.isArray(v) ? v.filter((x) => Number.isInteger(x) && x >= 0) : []);

/*
   Les thèmes de la source sont des paires « grand thème / sous-thème ». On
   les garde telles quelles : les aplatir en une chaîne rendrait le filtre
   par grand thème impossible.
*/
const themes = d.topics.map((t) => (Array.isArray(t) ? [texte(t[0]), texte(t[1])] : [texte(t), '']));

const references = [];
let sansAdresse = 0;
for (const r of d.rows) {
  const url = texte(r[URL]);
  if (!/^https?:\/\//.test(url)) {
    sansAdresse += 1;
    continue;
  }
  references.push({
    titre: texte(r[TITRE]),
    url,
    theme: entier(r[THEME]),
    sousThemes: listeEntiers(r[SOUS_THEMES]),
    ajouteLe: texte(r[AJOUTE_LE]),
    portail: entier(r[PORTAIL]),
    typeEtude: entier(r[TYPE_ETUDE]),
    identifiant: texte(r[IDENTIFIANT]),
    composes: listeEntiers(r[COMPOSES]),
    annee: Number.isInteger(r[ANNEE]) && r[ANNEE] > 1800 && r[ANNEE] < 2100 ? r[ANNEE] : null,
    revue: texte(r[REVUE]),
  });
}

const paquet = {
  genereLe: new Date().toISOString().slice(0, 10),
  attribution: 'NooTopics',
  premierPartage: texte(d.meta?.first),
  dernierPartage: texte(d.meta?.last),
  themes,
  sousThemes: d.subtopics,
  portails: d.sources.map(texte),
  typesEtude: d.studyTypes.map(texte),
  composes: d.compounds.map((c) => (Array.isArray(c) ? texte(c[0]) : texte(c))),
  references,
};

/*
   Garde-fou de sortie : rien de ce qui est écarté ne doit se retrouver dans
   le paquet par un chemin détourné. Le contrôle porte sur le JSON produit,
   et non sur l'intention du code au-dessus.
*/
const rendu = JSON.stringify(paquet);
const pseudos = (d.anecAuthors ?? []).map(texte).filter((p) => p.length > 4);
const fuites = pseudos.filter((p) => rendu.includes(`"${p}"`));
if (fuites.length) {
  console.error(`✗ ${fuites.length} pseudonyme(s) dans la sortie. Rien n’est écrit.`);
  process.exit(1);
}

const dossier = path.join('content', 'sante');
await mkdir(dossier, { recursive: true });
await writeFile(path.join(dossier, 'bibliographie.json'), JSON.stringify(paquet) + '\n');

const octets = Buffer.byteLength(rendu);
console.log(`
  lignes dans la source          ${d.rows.length}
  retenues                       ${references.length}
  écartées (adresse absente)     ${sansAdresse}
  thèmes                         ${themes.length}
  composés nommés                ${paquet.composes.length}
  portails / types d’étude       ${paquet.portails.length} / ${paquet.typesEtude.length}
  partages du ${paquet.premierPartage} au ${paquet.dernierPartage}
  poids du fichier               ${(octets / 1024 / 1024).toFixed(2)} Mo

  Écartés : pseudonymes, extraits d’articles, témoignages, salons et serveurs,
  et les six colonnes dont le sens n’est pas établi.
`);
