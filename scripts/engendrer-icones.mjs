/**
 * LE CATALOGUE D'ICÔNES, ENGENDRÉ DEPUIS LES TRACÉS DE LUCIDE.
 *
 * ## Pourquoi un générateur, et pas un fichier écrit à la main
 *
 * Les tracés de Lucide sont des suites de courbes de Bézier : « M 15 21 v -8 a
 * 1 1 0 0 0 -1 -1 h -4 … ». Recopiées à la main, elles seraient fausses d'un
 * chiffre sans que personne le voie, et la montée de version serait un
 * cauchemar. Le catalogue est donc ENGENDRÉ depuis les fichiers d'origine, et
 * ce script garde la trace de la correspondance : un sens de Cyclades, un nom
 * de Lucide.
 *
 * Aucune dépendance n'est ajoutée au projet. Lucide n'est pas installé : on
 * récupère l'archive, on l'extrait ailleurs, on copie ce qu'on emploie, et la
 * licence ISC part avec, comme elle l'exige.
 *
 *     npm pack lucide-static
 *     tar -xzf lucide-static-<version>.tgz -C <dossier>
 *     node scripts/engendrer-icones.mjs <dossier>/package
 *
 * ## Ce que le générateur refuse
 *
 * Un nom de Lucide qui n'existe pas. C'est le garde-fou qui compte : une faute
 * de frappe dans la table ci-dessous donnerait une icône vide, et une icône
 * vide ne se remarque pas tout de suite — surtout dans une barre d'onglets où
 * le libellé reste visible à côté, comme la décision 5 du 43 l'exige.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/*
   LA TABLE DES SENS.

   À gauche le nom employé dans Cyclades, à droite celui de Lucide. Les noms de
   gauche sont en français et disent un SENS, pas un dessin : « sauvegarde » et
   non « disquette », pour que l'icône puisse changer sans que le code suive.

   « pleine » dit si la forme supporte un remplissage pour marquer l'état actif.
   Elle est renseignée à la main, forme par forme : une maison, une cloche ou
   une cible se remplissent bien ; une loupe, un lien ou une règle non — leur
   tracé est ouvert, et le remplissage y fait une tache. Pour celles-là, l'actif
   garde le marqueur E1, sans dessin inventé.
*/
const SENS = [
  /* ── Les cinq branches ───────────────────────────────────────────────── */
  ['revisions', 'graduation-cap', false],
  ['odyssee', 'compass', false],
  ['sport', 'dumbbell', false],
  ['cognitif', 'puzzle', true],

  /* ── Les onglets ─────────────────────────────────────────────────────── */
  ['tableau-de-bord', 'house', true],
  ['planning', 'calendar-days', false],
  ['cours', 'book-open', false],
  ['cartes', 'layers', true],
  ['quiz', 'target', true],
  ['niveau', 'sliders-horizontal', false],
  ['erreurs', 'bandage', false],
  ['recherche', 'search', false],
  ['statistiques', 'trending-up', false],
  ['glossaire', 'book-marked', false],
  ['outils', 'wrench', false],
  ['sauvegarde', 'save', false],
  ['actualites', 'newspaper', false],
  ['concours', 'landmark', false],
  ['taches', 'list-checks', false],
  ['quetes', 'repeat', false],
  ['revue', 'moon', true],
  ['corps', 'heart-pulse', false],
  ['psyche', 'waves', false],
  ['rythme-de-vie', 'activity', false],
  ['echelles', 'clipboard-list', false],
  ['finances', 'euro', false],
  ['tendances', 'telescope', false],
  ['syntheses', 'receipt-text', false],
  ['sante', 'stethoscope', false],
  ['rapprocher', 'link', false],
  ['regles', 'ruler', false],
  ['qui-lit', 'eye', true],
  ['seance', 'dumbbell', false],
  ['programmes', 'folder-tree', false],
  ['memoire', 'puzzle', true],
  ['raisonnement', 'brain', false],
  ['parametres', 'settings', false],
  ['profil', 'id-card', false],
  ['appareils', 'smartphone', false],
  ['stockage', 'database', false],
  ['notifications', 'bell', true],
  ['exporter', 'upload', false],
  ['importer', 'download', false],
  ['fiches-audio', 'headphones', false],

  /* ── L'en-tête ───────────────────────────────────────────────────────── */
  ['retour', 'arrow-left', false],
  ['coffre-ferme', 'lock', true],
  ['coffre-ouvert', 'unlock', false],

  /* ── Les actions récurrentes ─────────────────────────────────────────── */
  ['ajouter', 'plus', false],
  ['modifier', 'pencil', false],
  ['supprimer', 'trash-2', false],
  ['fermer', 'x', false],
  ['filtrer', 'filter', true],
  ['restaurer', 'repeat', false],
  ['alerte', 'triangle-alert', true],
];

const source = process.argv[2];
if (!source) {
  console.error(
    'Usage : node scripts/engendrer-icones.mjs <dossier de lucide-static/package>\n' +
      '  npm pack lucide-static && tar -xzf lucide-static-*.tgz -C /tmp/lucide',
  );
  process.exit(2);
}

const dossierIcones = path.join(source, 'icons');
const manifeste = path.join(source, 'package.json');
if (!existsSync(dossierIcones) || !existsSync(manifeste)) {
  console.error(`✗ ${source} ne ressemble pas à lucide-static : « icons/ » ou « package.json » manque.`);
  process.exit(1);
}
const version = JSON.parse(readFileSync(manifeste, 'utf8')).version;

/**
 * Le dedans d'un SVG de Lucide, sur une ligne.
 *
 * On ne garde PAS l'enveloppe : la largeur, le « viewBox », la couleur de
 * trait et les jointures sont les mêmes pour toutes les icônes, et le composant
 * les pose une fois. Recopier l'enveloppe quarante fois, c'est quarante
 * occasions d'en faire diverger une.
 */
function dedansDe(fichier) {
  const brut = readFileSync(fichier, 'utf8');
  const dedans = brut.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return dedans
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('');
}

const absents = [];
const entrees = [];
for (const [sens, lucide, pleine] of SENS) {
  const fichier = path.join(dossierIcones, `${lucide}.svg`);
  if (!existsSync(fichier)) {
    absents.push(`${sens} → « ${lucide} » n'existe pas dans Lucide ${version}`);
    continue;
  }
  entrees.push({ sens, lucide, pleine, corps: dedansDe(fichier) });
}

if (absents.length > 0) {
  console.error(`\n✗ REFUS — ${absents.length} nom(s) de Lucide introuvable(s) :`);
  for (const a of absents) console.error(`    ${a}`);
  console.error('\nRien n’est écrit. Corrigez la table des sens.\n');
  process.exit(1);
}

/* Deux sens peuvent viser le même dessin — « quetes » et « restaurer » sont
   tous deux une flèche qui tourne —, mais deux fois le même SENS serait une
   faute de table. */
const vus = new Set();
const doubles = entrees.filter((e) => (vus.has(e.sens) ? true : (vus.add(e.sens), false)));
if (doubles.length > 0) {
  console.error(`✗ REFUS — sens en double : ${doubles.map((d) => d.sens).join(', ')}`);
  process.exit(1);
}

const aujourdhui = new Date().toISOString().slice(0, 10);

const sortie = `/**
 * LE CATALOGUE DES ICÔNES — ENGENDRÉ, NE PAS MODIFIER À LA MAIN.
 *
 * Produit par « scripts/engendrer-icones.mjs » depuis les tracés de Lucide
 * ${version}, copiés le ${aujourdhui}. La licence ISC est à côté, dans
 * « icones-LICENCE-lucide.txt », comme elle l'exige.
 *
 * Aucune dépendance n'a été ajoutée : les tracés sont COPIÉS, pas importés.
 *
 * Pour ajouter une icône, on modifie la table des sens du générateur et on le
 * relance — jamais ce fichier. Il refuse un nom de Lucide qui n'existe pas,
 * parce qu'une faute de frappe donnerait une icône VIDE, et une icône vide ne
 * se remarque pas tout de suite.
 *
 * Les noms de gauche disent un SENS et non un dessin — « sauvegarde » et non
 * « disquette » —, pour que le dessin puisse changer sans que le code suive.
 */

/** Une icône du catalogue. */
export interface Icone {
  /** Le dedans du SVG : les tracés, sans l'enveloppe. */
  corps: string;
  /**
   * La forme supporte-t-elle un remplissage pour marquer l'état actif ?
   *
   * Une maison, une cloche ou une cible se remplissent bien. Une loupe, un
   * lien ou une règle non : leur tracé est ouvert, et le remplissage y fait une
   * tache. Pour celles-là, l'actif garde le marqueur E1 — fond et trait de
   * 2 px — sans qu'on invente un second dessin.
   */
  pleine: boolean;
  /** Le nom d'origine chez Lucide, pour retrouver le tracé à la montée. */
  lucide: string;
}

export const ICONES = {
${entrees
  .map(
    (e) =>
      `  '${e.sens}': {\n` +
      `    corps: '${e.corps.replace(/'/g, "\\'")}',\n` +
      `    pleine: ${e.pleine},\n` +
      `    lucide: '${e.lucide}',\n` +
      `  },`,
  )
  .join('\n')}
} as const satisfies Record<string, Icone>;

export type NomDIcone = keyof typeof ICONES;

/** Les noms du catalogue, pour les essais et les messages d'erreur. */
export const NOMS_DICONES = Object.keys(ICONES) as NomDIcone[];

/** La version de Lucide d'où viennent les tracés, et le jour de la copie. */
export const PROVENANCE = { lucide: '${version}', copie: '${aujourdhui}' } as const;
`;

const cible = path.join(process.cwd(), 'src', 'lib', 'icones.ts');
writeFileSync(cible, sortie, 'utf8');

const licence = readFileSync(path.join(source, 'LICENSE'), 'utf8');
writeFileSync(
  path.join(process.cwd(), 'src', 'lib', 'icones-LICENCE-lucide.txt'),
  `Les tracés de « src/lib/icones.ts » viennent de Lucide ${version},\n` +
    `copiés le ${aujourdhui} depuis le paquet « lucide-static ».\n` +
    'Aucune dépendance npm n’a été ajoutée : les tracés sont copiés.\n\n' +
    `${'─'.repeat(70)}\n\n${licence}`,
  'utf8',
);

console.log(`\n✓ ${entrees.length} icône(s) écrite(s) dans src/lib/icones.ts`);
console.log(`  Lucide ${version}, copiées le ${aujourdhui}`);
console.log(`  dont ${entrees.filter((e) => e.pleine).length} avec variante pleine`);
console.log('  licence ISC dans src/lib/icones-LICENCE-lucide.txt\n');
