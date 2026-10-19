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
  CLEFS_ODYSSEE_ETAT,
  CLEFS_PERSONNELLES_ETAT,
  CLEFS_TECHNIQUES_ETAT,
  GROUPES,
  PREFIXES_PERSONNELS_ETAT,
  PREFIXES_TECHNIQUES_ETAT,
  clefVisee,
  dateDe,
  dateDecoupable,
  estTechnique,
  groupe,
  groupeDuMagasin,
  type ClefsVisees,
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
/*
 * Depuis la B-3 du 58, un magasin PEUT appartenir à deux groupes — mais
 * seulement si chacun n'y désigne que des clés, et des clés disjointes.
 * `etat` est dans ce cas : « Réglages et profil » y prend les réglages,
 * « Odyssée » y prend l'activation de Santé et le socle d'activité. Deux
 * groupes qui prendraient le même magasin entier, en revanche, le
 * compteraient deux fois à l'export et l'effaceraient deux fois.
 */
const partages = [...new Set(couverts.filter((nom, i) => couverts.indexOf(nom) !== i))];
v(
  'un magasin partagé n’est jamais pris entier par deux groupes',
  partages.filter((nom) =>
    GROUPES.filter((g) => g.magasins.includes(nom)).some((g) => !g.clefs?.[nom]),
  ),
  [],
);
const chevauchements: string[] = [];
for (const nom of partages) {
  const visees = GROUPES.filter((g) => g.magasins.includes(nom)).map(
    (g) => [g.id, g.clefs?.[nom]] as const,
  );
  for (const [idA, a] of visees) {
    for (const [idB, b] of visees) {
      if (idA >= idB || !a || !b) continue;
      // Une clé exacte de l'un ne doit tomber ni dans les clés ni dans les
      // préfixes de l'autre, et réciproquement.
      for (const clef of a.exactes) if (clefVisee(clef, b)) chevauchements.push(`${nom}/${clef}`);
      for (const clef of b.exactes) if (clefVisee(clef, a)) chevauchements.push(`${nom}/${clef}`);
    }
  }
}
v('deux groupes ne visent jamais la même clé', chevauchements, []);
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

console.log('\nLES CLÉS D’« ETAT » : AUCUNE CLÉ TECHNIQUE DANS UNE LISTE BLANCHE');

/*
 * L'anomalie B-3 du 58, et le contrôle qui l'empêche de revenir.
 *
 * « Réglages et profil » désignait le magasin `etat` entier. Or `etat` porte
 * aussi le sel et l'enveloppe de la clé du coffre, l'identité de l'appareil,
 * son horloge logique et la paire de clés de sa boîte aux lettres. Effacer
 * « ses réglages » rendait donc le coffre illisible — avec le bon mot de
 * passe, et sans un mot d'avertissement.
 *
 * Ces contrôles sont de la mécanique pure : ils comparent des listes. Le
 * contrôle qui prouve le comportement est dans
 * `essais-reglages-sans-coffre.mjs`, où l'on efface vraiment, puis où l'on
 * rouvre vraiment le coffre.
 */
const blanches = [...CLEFS_PERSONNELLES_ETAT, ...CLEFS_ODYSSEE_ETAT];
v('aucune clé technique n’a glissé dans une liste blanche', blanches.filter(estTechnique), []);
v(
  'aucun préfixe personnel n’attrape une clé technique',
  CLEFS_TECHNIQUES_ETAT.filter((clef) =>
    PREFIXES_PERSONNELS_ETAT.some((prefixe) => clef.startsWith(prefixe)),
  ),
  [],
);
v(
  'aucun préfixe personnel ne recoupe un préfixe technique',
  PREFIXES_PERSONNELS_ETAT.filter((p) =>
    PREFIXES_TECHNIQUES_ETAT.some((t) => p.startsWith(t) || t.startsWith(p)),
  ),
  [],
);
v('aucune clé blanche n’est déclarée deux fois', new Set(blanches).size, blanches.length);

/*
 * Les quatre clés dont la perte est irréparable, nommées une à une. Une liste
 * qui se contente de « il y a des clés techniques » laisserait passer le jour
 * où l'une d'elles sort du classement.
 */
for (const clef of [
  'coffre.sel',
  'coffre.enveloppe',
  'coffre.sel-enveloppe',
  'boite.privee',
  'appareil',
  'horloge',
]) {
  v(`« ${clef} » est technique`, estTechnique(clef), true);
}

/*
 * Et le piège inverse : un réglage dont le nom porte une variable. Une liste
 * de noms exacts aurait manqué `selection:nback`, en silence.
 */
const reglages = groupe('reglages');
const viseesReglages = reglages?.clefs?.etat as ClefsVisees;
v('« selection:nback » est un réglage visé', clefVisee('selection:nback', viseesReglages), true);
v('« coffre.sel » n’est pas visé par les réglages', clefVisee('coffre.sel', viseesReglages), false);
v(
  '« socleActivite » n’est pas visé par les réglages',
  clefVisee('socleActivite', viseesReglages),
  false,
);
v(
  '« socleActivite » est visé par Odyssée',
  clefVisee('socleActivite', groupe('odyssee')?.clefs?.etat as ClefsVisees),
  true,
);

console.log('\nAUCUNE CLÉ ÉCRITE DANS LE CODE N’ÉCHAPPE AU CLASSEMENT');

/*
 * Le contrôle qui a trouvé `derniereSauvegarde`, oubliée des deux listes.
 *
 * Il balaie les sources à la recherche des clés d'`etat` écrites EN TOUTES
 * LETTRES — `base.put('etat', valeur, 'profil')` — et vérifie que chacune
 * est classée. Les clés nommées par une constante lui échappent, et c'est
 * dit : celles-là sont couvertes par `essais:reglages-sans-coffre`, qui
 * relève les clés réellement présentes dans une base vivante. Les deux
 * contrôles se complètent ; aucun ne suffit seul.
 */
const { readFileSync } = await import('node:fs');
const { globSync } = await import('node:fs');
const sources = globSync('src/**/*.{ts,astro}');
const litterales = new Set<string>();
for (const chemin of sources) {
  const texte = readFileSync(chemin, 'utf8');
  for (const m of texte.matchAll(/\b(?:get|put|delete)\(\s*'etat'\s*,[^;]*?'([A-Za-z][\w.:-]*)'\s*\)/g)) {
    litterales.add(m[1]);
  }
}
v('le balayage trouve bien des clés', litterales.size > 0, true);
v(
  'chaque clé écrite en toutes lettres est classée',
  [...litterales].filter((clef) => !estTechnique(clef) && !clefVisee(clef, viseesReglages)).sort(),
  [],
);

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
