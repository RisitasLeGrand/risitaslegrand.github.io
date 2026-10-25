/**
 * H4 — LE CATALOGUE D'ICÔNES, ET LES MODÈLES QUE LES SCRIPTS COPIENT.
 *
 * ## Les trois défauts que cet essai est né pour attraper
 *
 * **Un nom qui n'existe pas.** `Icone.astro` refuse à la construction, donc ce
 * cas-là est déjà tenu — tant que le nom est écrit dans un fichier que la
 * construction traverse. Ce contrôle existe pour la régression inverse : un nom
 * RETIRÉ du catalogue alors qu'un gabarit l'emploie encore. Le générateur ne
 * sait pas qui se sert de ses sorties.
 *
 * **Une icône vide.** Un `<template>` dont le contenu n'est pas un SVG — parce
 * qu'on y a mis un commentaire, un espace, ou deux éléments — rend une copie
 * qui ne dessine rien. Et une icône vide ne se remarque pas : le libellé reste
 * à côté, juste, et la ligne a l'air normale.
 *
 * **Un modèle absent de la page qui l'emploie.** Celui-là est le vrai danger,
 * et c'est pour lui que cet essai lit les paquets construits.
 *
 * Cinq écrans fabriquent leurs lignes en JavaScript et prennent leur icône
 * dans un `<template>` du gabarit. Rien, dans le typage, ne relie
 * `iconeDuGabarit('gabarit-alerte')` au fait que la page porte ce modèle :
 * l'un est une chaîne dans un script, l'autre un élément du HTML. Déplacer le
 * modèle, renommer l'identifiant, ou employer la fonction depuis un écran qui
 * n'a pas le modèle — et la ligne lève une erreur dans la console du
 * navigateur, là où personne ne regarde.
 *
 * ## Pourquoi il lit « dist/ » et non « src/ »
 *
 * La question posée est « cette page-là porte-t-elle le modèle que SES scripts
 * réclament ? ». Elle ne se répond pas dans les sources : les scripts d'une
 * page Astro sont regroupés en paquets partagés, un modèle peut venir de la
 * mise en page, d'un composant, ou de la page elle-même, et c'est la
 * construction qui décide de tout cela. On mesure donc le résultat.
 *
 * Aucun navigateur n'est nécessaire : tout est dans les fichiers produits.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const DIST = 'dist';

const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

let echecs = 0;
function verifier(quoi, vrai, detail = '') {
  if (vrai) console.log(`  ${vert('✓')} ${quoi}`);
  else {
    echecs += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Tous les fichiers d'une extension sous une racine. */
function fichiers(racine, suffixe) {
  const sortie = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin, suffixe));
    else if (chemin.endsWith(suffixe)) sortie.push(chemin);
  }
  return sortie;
}

/* ── Le catalogue, lu dans le fichier engendré ────────────────────────── */

const catalogue = readFileSync('src/lib/icones.ts', 'utf8');
const NOMS = new Set([...catalogue.matchAll(/^ {2}'([a-z0-9-]+)': \{$/gm)].map((m) => m[1]));

console.log(`\n${gras('1. LE CATALOGUE')}\n`);
console.log(`  ${NOMS.size} icônes lues dans « src/lib/icones.ts »`);
verifier('la lecture du catalogue a bien abouti', NOMS.size >= 40);

/* ── Les noms employés dans les sources ───────────────────────────────── */

const sources = [
  ...fichiers('src', '.astro'),
  ...fichiers('src', '.ts'),
  ...fichiers('src', '.svelte'),
];

/*
   On ne relève que les noms ÉCRITS EN CLAIR sur une balise `<Icone>`. Les
   noms calculés, `nom={o.icone}`, viennent d'un fichier de données et sont
   tenus par le typage : `NomDIcone` au lieu de `string`, ce qui est
   précisément le resserrement qu'on a fait. Les relever ici demanderait
   d'évaluer le code.

   La balise est exigée, et pas le seul attribut : un `nom="…"` traîne dans
   bien d'autres chaînes. La première version de cet essai relevait
   `nom="${p.nom}"` dans un gabarit d'appareil et refusait un nom qui n'était
   pas celui d'une icône.
*/
const employes = new Map();
for (const chemin of sources) {
  for (const m of readFileSync(chemin, 'utf8').matchAll(/<Icone\b[^>]*?\snom="([^"]+)"/g)) {
    if (!employes.has(m[1])) employes.set(m[1], []);
    employes.get(m[1]).push(chemin);
  }
}

console.log(`\n${gras('2. LES NOMS ÉCRITS EN CLAIR DANS LES ÉCRANS')}\n`);
const inconnus = [...employes.keys()].filter((n) => !NOMS.has(n));
verifier(
  `les ${employes.size} noms écrits en clair sont tous au catalogue`,
  inconnus.length === 0,
  inconnus.map((n) => `« ${n} » (${employes.get(n)[0]})`).join(', '),
);

/* ── Les modèles, dans les pages construites ──────────────────────────── */

const pages = fichiers(DIST, '.html');

console.log(`\n${gras('3. CE QUE CHAQUE MODÈLE CONTIENT')}\n`);

let modelesVus = 0;
let modelesMalFormes = [];
const declaresPar = new Map();

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const ids = new Set();
  for (const m of html.matchAll(
    /<template id="(gabarit-[a-z0-9-]+)">([\s\S]*?)<\/template>/g,
  )) {
    const [, id, dedans] = m;
    ids.add(id);
    modelesVus += 1;
    /*
       UN SEUL SVG, ET IL EST MUET.

       Un modèle qui contiendrait deux éléments ne rendrait que le premier à la
       copie — `firstElementChild` —, et la moitié de l'icône disparaîtrait sans
       bruit. Un modèle qui porterait un `aria-label` ferait annoncer l'icône en
       plus du libellé : la décision 5 du 43 l'interdit.
    */
    const svgs = dedans.match(/<svg\b/g) ?? [];
    const propre =
      svgs.length === 1 &&
      /aria-hidden="true"/.test(dedans) &&
      !/aria-label/.test(dedans) &&
      dedans.trim().startsWith('<svg');
    if (!propre) {
      modelesMalFormes.push(
        `${id} dans ${page} (${svgs.length} svg, ` +
          `${/aria-hidden="true"/.test(dedans) ? 'muet' : 'NON muet'})`,
      );
    }
  }
  declaresPar.set(page, ids);
}

console.log(`  ${modelesVus} modèles servis dans ${pages.length} pages construites`);
verifier('des modèles sont bien servis', modelesVus > 0);
verifier(
  'chacun porte un seul SVG, muet, et rien d’autre',
  modelesMalFormes.length === 0,
  modelesMalFormes.join(' ; '),
);

/* ── Le contrôle qui compte : la page porte ce que ses scripts réclament ── */

console.log(`\n${gras('4. CHAQUE PAGE PORTE LES MODÈLES QUE SES SCRIPTS RÉCLAMENT')}\n`);

/** Les paquets qu'une page charge, suivis en profondeur par leurs imports. */
function paquetsDe(page, html) {
  const vus = new Set();
  const aLire = [];
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) aLire.push(m[1]);
  /* Un `modulepreload` annonce les paquets importés par les premiers. */
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) {
    aLire.push(m[1]);
  }
  const base = dirname(page);
  while (aLire.length) {
    const brut = aLire.pop();
    /* Les chemins servis sont absolus (« /_astro/… ») ; on les ramène à dist/. */
    const chemin = brut.startsWith('/') ? join(DIST, brut) : join(base, brut);
    if (vus.has(chemin)) continue;
    vus.add(chemin);
    let texte;
    try {
      texte = readFileSync(chemin, 'utf8');
    } catch {
      continue;
    }
    /* Les imports statiques du paquet lui-même, pour suivre la chaîne. */
    for (const m of texte.matchAll(/from"(\.{1,2}\/[^"]+\.js)"/g)) {
      aLire.push(join(dirname(chemin), m[1]));
    }
    for (const m of texte.matchAll(/import"(\.{1,2}\/[^"]+\.js)"/g)) {
      aLire.push(join(dirname(chemin), m[1]));
    }
  }
  return vus;
}

const manquants = [];
let couples = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const declares = declaresPar.get(page);
  const reclames = new Set();
  for (const paquet of paquetsDe(page, html)) {
    let texte;
    try {
      texte = readFileSync(paquet, 'utf8');
    } catch {
      continue;
    }
    for (const m of texte.matchAll(/["'`](gabarit-[a-z0-9-]+)["'`]/g)) reclames.add(m[1]);
  }
  for (const id of reclames) {
    couples += 1;
    if (!declares.has(id)) manquants.push(`${page} réclame « ${id} » sans le porter`);
  }
}

console.log(`  ${couples} liens page → modèle relevés dans les paquets construits`);
/*
   LE TÉMOIN. Sans lui, un essai qui ne trouverait AUCUN lien — parce que la
   lecture des paquets a changé de forme, ou que les modèles ont changé de
   préfixe — passerait au vert sans avoir rien vérifié. Un vert à vide est
   plus dangereux qu'un rouge : on cesse de regarder.
*/
verifier('des pages réclament bien des modèles', couples > 0);
verifier(
  'aucune page ne réclame un modèle qu’elle ne porte pas',
  manquants.length === 0,
  manquants.slice(0, 6).join(' ; ') + (manquants.length > 6 ? ` (et ${manquants.length - 6} autres)` : ''),
);

console.log(
  echecs ? `\n${rouge(`${echecs} essai(s) en échec.`)}\n` : `\n${vert('Tous les essais passent.')}\n`,
);
process.exit(echecs ? 1 : 0);
