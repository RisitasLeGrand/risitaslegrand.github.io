/**
 * Essais du contrôle « la prose d'un visuel contre ses données ».
 *
 * Ce contrôle REFUSE la construction, donc il doit être précis dans les deux
 * sens : attraper un écart réel, et se taire partout ailleurs. Un contrôle
 * bloquant qui crie à tort arrête le travail de tout le monde.
 *
 * Les essais portent sur les trois formes lues, et surtout sur ce que le
 * contrôle doit LAISSER PASSER : une forme qu'il ne sait pas lire, un visuel
 * sans données, un visuel « aucun ». On ne contrôle que ce qu'on sait lire,
 * parce qu'un contrôle qui devine est pire que pas de contrôle.
 */
import { ecartsDuVisuel } from './lib/decomptes-visuels.mjs';

let echecs = 0;
function verifier(titre, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) {
    echecs += 1;
    console.log(`\x1b[31m✗\x1b[0m ${titre}`);
    console.log(`    attendu : ${JSON.stringify(attendu)}`);
    console.log(`    obtenu  : ${JSON.stringify(obtenu)}`);
  } else {
    console.log(`\x1b[32m✓\x1b[0m ${titre}`);
  }
}

/* --- Le tableau et ses colonnes ---------------------------------------- */

const tableau = (entetes, alt) => ({
  type: 'tableau',
  donnees: { entetes, lignes: [entetes.map((_, i) => `cellule ${i}`)] },
  alt,
});

verifier(
  'un tableau dont la prose dit juste ne produit aucun écart',
  ecartsDuVisuel(tableau(['A', 'B', 'C'], 'Tableau à trois colonnes — A, B et C.')),
  [],
);
verifier(
  'une colonne de moins que la prose est vue',
  ecartsDuVisuel(tableau(['A', 'B'], 'Tableau à trois colonnes — A, B et C.')),
  ['la prose annonce 3 colonne(s) et le tableau en porte 2'],
);
verifier(
  'une colonne de plus que la prose est vue aussi',
  ecartsDuVisuel(tableau(['A', 'B', 'C', 'D'], 'Tableau à trois colonnes.')),
  ['la prose annonce 3 colonne(s) et le tableau en porte 4'],
);
verifier(
  'le nombre peut être écrit en chiffres',
  ecartsDuVisuel(tableau(['A', 'B'], 'Tableau à 3 colonnes.')),
  ['la prose annonce 3 colonne(s) et le tableau en porte 2'],
);
verifier(
  'la légende compte autant que le texte de remplacement',
  ecartsDuVisuel({
    type: 'tableau',
    donnees: { entetes: ['A', 'B'], lignes: [['1', '2']] },
    legende: 'Tableau à quatre colonnes.',
  }),
  ['la prose annonce 4 colonne(s) et le tableau en porte 2'],
);

/* --- Le schéma et ses niveaux ------------------------------------------ */

const schema = (niveaux, alt) => ({
  type: 'schema',
  donnees: { noeuds: niveaux.map((n, i) => ({ id: `n${i}`, libelle: `nœud ${i}`, niveau: n })) },
  alt,
});

verifier(
  'un schéma dont la prose dit juste ne produit aucun écart',
  ecartsDuVisuel(schema([0, 1, 2], 'Schéma à trois niveaux.')),
  [],
);
verifier(
  'ce sont les niveaux DISTINCTS qui comptent, non les nœuds',
  ecartsDuVisuel(schema([0, 1, 1, 1], 'Schéma à deux niveaux.')),
  [],
);
verifier(
  'un schéma à deux niveaux annoncé pour trois est vu',
  ecartsDuVisuel(schema([0, 1, 2], 'Schéma à deux niveaux.')),
  ['la prose annonce 2 niveau(x) et le schéma en porte 3'],
);
verifier(
  'et l’inverse — trois annoncés pour deux — l’est aussi',
  ecartsDuVisuel(schema([0, 1, 0, 1], 'Schéma à trois niveaux.')),
  ['la prose annonce 3 niveau(x) et le schéma en porte 2'],
);

/* --- La frise et ses bornes -------------------------------------------- */

const frise = (dates, alt) => ({
  type: 'frise',
  donnees: { jalons: dates.map((d) => ({ date: d, libelle: String(d) })) },
  alt,
});

verifier(
  'une frise dont les bornes correspondent ne produit aucun écart',
  ecartsDuVisuel(frise([1936, 1956, 1982], 'Frise de 1936 à 1982.')),
  [],
);
verifier(
  'un jalon déplacé déplace la borne, et c’est vu',
  ecartsDuVisuel(frise([1936, 1956, 1975], 'Frise de 1936 à 1982.')),
  ['la prose annonce une frise de 1936 à 1982 et les jalons vont de 1936 à 1975'],
);
verifier(
  'une date en toutes lettres garde son année',
  ecartsDuVisuel(frise(['5 juillet 1974', 'janvier 1975'], 'Frise de 1974 à 1975.')),
  [],
);
verifier(
  'l’ordre des jalons n’a pas d’importance : seules les extrêmes comptent',
  ecartsDuVisuel(frise([1982, 1936, 1956], 'Frise de 1936 à 1982.')),
  [],
);

/* --- CE QUE LE CONTRÔLE DOIT LAISSER PASSER ---------------------------- */

verifier('un visuel absent ne produit rien', ecartsDuVisuel(undefined), []);
verifier('un visuel « aucun » ne produit rien', ecartsDuVisuel({ type: 'aucun', raison_aucun: 'x' }), []);
verifier(
  'un tableau sans entêtes ne produit rien',
  ecartsDuVisuel({ type: 'tableau', donnees: {}, alt: 'Tableau à trois colonnes.' }),
  [],
);
verifier(
  'un schéma dont la prose ne parle pas de niveaux ne produit rien',
  ecartsDuVisuel(schema([0, 1, 2], 'Un schéma qui montre la hiérarchie des normes.')),
  [],
);
verifier(
  'une prose sans aucun décompte ne produit rien',
  ecartsDuVisuel(tableau(['A', 'B'], 'Un tableau comparant deux régimes.')),
  [],
);
verifier(
  'une frise sans bornes annoncées ne produit rien',
  ecartsDuVisuel(frise([1936, 1982], 'Une frise des lois sociales.')),
  [],
);
/* Le mot « colonnes » employé pour autre chose que le tableau lui-même ne doit
   pas être lu comme un décompte d'entêtes. */
verifier(
  'un schéma décrit « en deux colonnes parallèles » n’est pas lu comme un tableau',
  ecartsDuVisuel(schema([0, 1], 'Schéma à deux niveaux, en deux colonnes parallèles.')),
  [],
);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
