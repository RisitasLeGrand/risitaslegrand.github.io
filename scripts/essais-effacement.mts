/**
 * Les invariants de l'export lisible et de l'effacement ciblé, hors navigateur.
 *
 * Les deux modules ont une partie pure — l'aplatissement, le CSV, le choix des
 * magasins, la lecture des dates — et c'est elle qui décide de ce qui part ou
 * de ce qui s'efface. Elle est donc éprouvée ici, en une seconde, plutôt que
 * dans un navigateur où chaque cas coûte dix secondes.
 *
 * L'effacement lui-même touche IndexedDB et se vérifie dans
 * `essais-effacement-navigateur.mjs`.
 */
import { aplatir, versCsv, BOM } from '../src/lib/sauvegarde/export-lisible';
import {
  CHAMP_DATE,
  GROUPES,
  dateDe,
  dateDecoupable,
  groupe,
  groupeDuMagasin,
} from '../src/lib/sauvegarde/groupes';
import { MAGASINS_PROGRESSION } from '../src/lib/db';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

console.log('\nLES GROUPES COUVRENT TOUS LES MAGASINS, UNE FOIS CHACUN');

/*
 * C'est l'invariant qui compte le plus ici. Un magasin qu'aucun groupe ne
 * nomme devient invisible : il ne s'exporte pas, il ne s'efface pas, et
 * personne ne s'en aperçoit avant d'avoir cherché pourquoi une donnée
 * « effacée » est toujours là.
 */
const couverts = GROUPES.flatMap((g) => [...g.magasins]);
v(
  'aucun magasin n’est oublié',
  MAGASINS_PROGRESSION.filter((nom) => !couverts.includes(nom)),
  [],
);
v(
  'aucun magasin n’est dans deux groupes',
  couverts.filter((nom, i) => couverts.indexOf(nom) !== i),
  [],
);
v(
  'aucun groupe ne nomme un magasin qui n’existe pas',
  couverts.filter((nom) => !MAGASINS_PROGRESSION.includes(nom as never)),
  [],
);
v(
  'chaque magasin a une date déclarée, ou un « null » explicite',
  MAGASINS_PROGRESSION.filter((nom) => !(nom in CHAMP_DATE)),
  [],
);
v('les identifiants de groupe sont uniques', new Set(GROUPES.map((g) => g.id)).size, GROUPES.length);
for (const nom of MAGASINS_PROGRESSION) {
  v(`« ${nom} » retrouve son groupe`, groupeDuMagasin(nom)?.magasins.includes(nom), true);
}

console.log('\nLA DATE EST LUE DANS LE CHAMP DÉCLARÉ, ET NULLE PART AILLEURS');

v('une session se date par « le »', dateDe('nback', { le: '2026-03-04T10:00:00.000Z' }), '2026-03-04');
v('un pointage par « jour »', dateDe('jours', { jour: '2026-03-04' }), '2026-03-04');
v('une note par « majLe »', dateDe('notes', { majLe: '2026-03-04T10:00:00.000Z' }), '2026-03-04');
v('le journal par « ouverteLe »', dateDe('journal', { ouverteLe: '2026-03-04T08:00:00.000Z' }), '2026-03-04');

/*
 * Le point délicat : une carte porte « derniereRevision » et « du », qui
 * ressemblent à des dates. Les prendre pour la date de l'enregistrement
 * effacerait l'état d'une carte sous prétexte qu'elle n'a pas été revue
 * récemment — c'est-à-dire exactement les cartes qu'il faut garder.
 */
v(
  'une carte n’a pas de date, malgré ses champs qui en ont l’air',
  dateDe('cartes', { derniereRevision: '2026-03-04T10:00:00.000Z', du: '2026-04-01' }),
  null,
);
v('ni une compétence, malgré « majLe »', dateDe('competences', { majLe: '2026-03-04T10:00:00.000Z' }), null);
v('ni une question de la banque, malgré « derniereLe »', dateDe('qcmDgfip', { derniereLe: '2026-03-04T10:00:00.000Z' }), null);

v('un champ absent ne donne pas de date', dateDe('nback', {}), null);
v('un champ qui n’est pas une date non plus', dateDe('nback', { le: 'hier' }), null);
v('une date trop courte non plus', dateDe('nback', { le: '2026-03' }), null);

v('les magasins découpables le disent', dateDecoupable('seances'), 'jour');
v('les autres rendent null', dateDecoupable('cartes'), null);

console.log('\nAPLATISSEMENT');

v('un objet simple donne ses colonnes', aplatir({ a: 1, b: 'x' }), { a: '1', b: 'x' });
v(
  'un objet imbriqué donne « parent.enfant »',
  aplatir({ id: 'c', fsrs: { stability: 42.5, reps: 7 } }),
  { id: 'c', 'fsrs.stability': '42.5', 'fsrs.reps': '7' },
);
v('un tableau tient dans une cellule', aplatir({ fiches: ['a', 'b'] }), { fiches: '["a","b"]' });
v('null devient une cellule vide', aplatir({ a: null }), { a: '' });
v('undefined aussi', aplatir({ a: undefined }), { a: '' });
v('un booléen est rendu', aplatir({ lu: true }), { lu: 'true' });

{
  // Les restitutions d'une séance : un dictionnaire de longs textes, qui n'a
  // pas de colonnes stables et doit rester un bloc.
  const long = 'x'.repeat(200);
  v(
    'un dictionnaire de longs textes reste un bloc',
    Object.keys(aplatir({ restitutions: { '1': long, '2': long } })),
    ['restitutions'],
  );
  // Un dictionnaire de valeurs courtes, lui, s'étale : ce sont des colonnes.
  v(
    'un dictionnaire de valeurs courtes s’étale',
    Object.keys(aplatir({ scores: { maths: 12, francais: 14 } })),
    ['scores.maths', 'scores.francais'],
  );
}

console.log('\nCSV AUX CONVENTIONS FRANÇAISES');

{
  const csv = versCsv([{ id: 1, note: 12.5 }]);
  v('le fichier commence par un BOM', csv.startsWith(BOM), true);
  v('le séparateur est le point-virgule', csv.includes('id;note'), true);
  v('la décimale est une virgule', csv.includes('"12,5"'), true);
  v('les lignes se terminent en CRLF', csv.includes('\r\n'), true);
}

{
  const csv = versCsv([
    { id: 1, texte: 'avec ; un séparateur' },
    { id: 2, texte: 'avec "des guillemets"' },
    { id: 3, texte: 'avec\nun saut' },
  ]);
  v('un point-virgule dans une valeur est cité', csv.includes('"avec ; un séparateur"'), true);
  v('les guillemets sont doublés', csv.includes('"avec ""des guillemets"""'), true);
  v('un saut de ligne est cité', csv.includes('"avec\nun saut"'), true);
}

{
  /*
   * Les colonnes sont l'union de toutes les clés, et non celles du premier
   * enregistrement. Un champ optionnel absent de la première ligne — comme
   * « pretesteeLe » sur une fiche jamais prétestée — disparaîtrait sinon pour
   * tout le monde.
   */
  const csv = versCsv([{ id: 'a' }, { id: 'b', pretesteeLe: '2026-03-04' }]);
  v('un champ optionnel garde sa colonne', csv.split('\r\n')[0], `${BOM}id;pretesteeLe`);
  v('et la ligne qui ne l’a pas laisse la cellule vide', csv.split('\r\n')[1], 'a;');
}

v('un magasin vide ne produit rien', versCsv([]), '');

console.log('\nLES LIBELLÉS SONT UTILISABLES TELS QUELS');

for (const g of GROUPES) {
  v(`« ${g.id} » a un libellé et une description`, Boolean(g.libelle && g.description), true);
  v(`« ${g.id} » nomme au moins un magasin`, g.magasins.length > 0, true);
}
v('un groupe inconnu ne se résout pas', groupe('inexistant'), undefined);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
