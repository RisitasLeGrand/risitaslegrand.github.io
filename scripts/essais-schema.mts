/**
 * Le schéma de la base : un numéro par migration, et pas deux.
 *
 *   npm run essais:schema
 *
 * ## Pourquoi ce contrôle existe, et ce qu'il aurait évité
 *
 * Le 19 octobre, deux branches ont pris le **même numéro de version** sans
 * se voir : l'agent C créait `podcastPositions` en 34 sur `claude/p46-55`,
 * et moi `odysseeCreneaux` en 34 sur `claude/p52-mol`. Chacune était juste
 * seule ; ensemble, elles cassaient la base de tout le monde.
 *
 * Et le défaut ne se voit ni en revue ni à l'exécution. Une base déjà montée
 * à 34 par l'un des deux chemins ne rejoue jamais l'autre bloc : le magasin
 * manquant ne se signale qu'au premier `getAll`, c'est-à-dire sur un écran
 * sans rapport, longtemps après sa cause. C'est exactement le genre de
 * panne qu'un essai doit attraper et qu'un relecteur ne peut pas.
 *
 * C'est le pilote qui a vu la collision et attribué les numéros. Ce contrôle
 * ne remplace pas cette coordination — il la rend **vérifiable** : le jour
 * où deux blocs porteront le même numéro sur une même branche, il rougira
 * avant la fusion.
 *
 * ## Ce qu'il lit, et pourquoi la source plutôt que la base
 *
 * Il lit `db.ts`, pas une base ouverte. Une base n'a qu'une version — la
 * sienne —, et ne dit rien des numéros que le code prétend connaître. La
 * duplication est dans la SOURCE, c'est donc la source qu'il faut lire.
 *
 * La migration elle-même — qu'une vieille base monte et que les magasins
 * neufs y soient — est éprouvée ailleurs, dans
 * `essais:odyssee:navigateur`, qui sème une base en version 14 et la fait
 * migrer pour de bon. Les deux se complètent : celui-ci garde les numéros,
 * celui-là garde le résultat.
 *
 * ## Pourquoi la seconde moitié ne nomme aucun magasin
 *
 * Sa première version, sur `claude/p52-mol`, vérifiait les trois
 * déclarations du seul `odysseeCreneaux`, en dur. Un contrôle qui nomme sa
 * cible ne garde que sa cible : il serait resté vert pendant que le magasin
 * suivant naissait sans déclaration de coffre, et il aurait fallu penser à
 * ajouter trois lignes à chaque magasin — c'est-à-dire se souvenir de
 * vérifier, ce qui est précisément ce qu'un essai sert à ne plus avoir à
 * faire.
 *
 * Il compare donc les trois ENSEMBLES, et l'écart est le défaut. Mesuré sur
 * `main` avant d'être écrit : 68 magasins créés, 68 dans la liste de
 * progression, 33 déclarés scellés, et les quatre écarts vides. Il naît
 * vert sur un invariant qui tient déjà, et il tiendra pour les magasins du
 * cycle sans qu'on ait à l'y inviter.
 */
import { readFileSync } from 'node:fs';
import { MAGASINS_SCELLES } from '../src/lib/noyau/coffre';
import { CHAMP_DATE } from '../src/lib/sauvegarde/groupes';

/**
 * Les commentaires sont retirés AVANT toute extraction.
 *
 * Deux fois dans ce chantier un contrôle a mordu sur un commentaire qui
 * citait ce qu'il interdisait : la prohibition d'un verbe de prescription, et
 * ici un commentaire qui explique l'histoire de `vers(34)`. Un relevé qui
 * compte les commentaires mesure ce que le code DIT de lui-même, pas ce
 * qu'il fait.
 */
const sansCommentaires = (texte: string) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SOURCE = sansCommentaires(readFileSync('src/lib/db.ts', 'utf8'));
const COFFRE = sansCommentaires(readFileSync('src/lib/noyau/coffre.ts', 'utf8'));
const GROUPES = sansCommentaires(readFileSync('src/lib/sauvegarde/groupes.ts', 'utf8'));

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

console.log('\nUN NUMÉRO PAR MIGRATION, ET PAS DEUX');

const declaree = Number(/^const VERSION = (\d+);$/m.exec(SOURCE)?.[1]);
v('la version courante est déclarée', Number.isInteger(declaree) && declaree > 0, true);

const numeros = [...SOURCE.matchAll(/^\s*if \(vers\((\d+)\)\) \{$/gm)].map((m) => Number(m[1]));
v('il y a des blocs de migration', numeros.length > 0, true);

const doublons = numeros.filter((n, i) => numeros.indexOf(n) !== i);
v('aucun numéro n’est pris deux fois', [...new Set(doublons)], []);

const auDela = numeros.filter((n) => n > declaree);
v('aucun bloc ne dépasse la version déclarée', auDela, []);

/*
   LA VERSION COURANTE A SON BLOC. Monter le numéro sans écrire la migration
   est le défaut inverse, et il est tout aussi muet : la base s'ouvre, le
   magasin neuf n'existe pas, et on ne l'apprend qu'à la première lecture.
*/
v('et la version courante en a un', numeros.includes(declaree), true);

console.log('\nQUATRE DÉCLARATIONS PAR MAGASIN, ET AUCUNE QUI MANQUE');

/**
 * Les magasins qu'une migration crée.
 *
 * Deux formes, et la seconde est la raison d'être de cette fonction : la
 * migration 18 en crée cinq dans une boucle, `createObjectStore(nom)` où
 * `nom` est une variable. Un relevé qui ne lit que les littéraux les
 * déclarerait absents — ma première sonde l'a fait, et j'ai failli signaler
 * trois défauts qui n'existaient pas.
 */
const magasinsCrees = (): Set<string> => {
  const vus = new Set([...SOURCE.matchAll(/createObjectStore\('([^']+)'/g)].map((m) => m[1]));
  for (const boucle of SOURCE.matchAll(
    /for \(const \w+ of \[([^\]]+)\][^)]*\)\s*\{\s*base\.createObjectStore\(/g,
  )) {
    for (const nom of boucle[1].matchAll(/'([^']+)'/g)) vus.add(nom[1]);
  }
  return vus;
};

/** Le contenu d'une liste exportée de noms de magasins. */
const listeDeclaree = (nom: string): Set<string> => {
  const debut = SOURCE.indexOf(`export const ${nom}`);
  if (debut < 0) return new Set();
  const corps = SOURCE.slice(debut, SOURCE.indexOf('];', debut));
  return new Set([...corps.matchAll(/'([^']+)'/g)].map((m) => m[1]));
};

const crees = magasinsCrees();
const scelles = new Set([...COFFRE.matchAll(/magasin: '([^']+)'/g)].map((m) => m[1]));
const progression = listeDeclaree('MAGASINS_PROGRESSION');

const moins = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x)).sort();

v('des magasins sont créés', crees.size > 0, true);
v('des magasins sont déclarés scellés', scelles.size > 0, true);

/*
   LES QUATRE ÉCARTS, ET CHACUN EST UNE PANNE DIFFÉRENTE.

   Un magasin scellé mais jamais créé : `sceller()` lève à la première
   écriture, sur un écran que rien ne rattache à la cause.

   Un magasin scellé hors de la liste de progression : il n'est ni effacé par
   « effacer mes données » ni porté par une sauvegarde. Les deux mentent — le
   premier laisse derrière lui ce qu'il dit avoir retiré, le second rend une
   base amputée en annonçant une restauration.

   Un magasin listé mais jamais créé : la sauvegarde et l'effacement
   parcourent un nom qui n'existe pas.

   Un magasin créé hors de la liste : le même mensonge que le second, pour un
   magasin en clair au lieu d'un magasin scellé.
*/
v('aucun magasin scellé n’est dépourvu de migration', moins(scelles, crees), []);
v('aucun magasin scellé n’échappe à l’effacement et à la sauvegarde', moins(scelles, progression), []);
v('aucun nom listé ne désigne un magasin inexistant', moins(progression, crees), []);
v('aucun magasin créé n’échappe à l’effacement et à la sauvegarde', moins(crees, progression), []);

/*
   LE QUATRIÈME ENDROIT, et je ne le connaissais pas en écrivant la première
   version de ce contrôle.

   `essais:effacement` l'a trouvé pour moi au lot suivant : deux magasins
   neufs, déclarés aux trois endroits que ce contrôle gardait, et pourtant
   quatre rouges — l'écran d'effacement range les magasins par GROUPES, et un
   magasin sans groupe n'est ni effacé ni restitué par cet écran. Un magasin
   a aussi besoin d'une ligne dans `CHAMP_DATE`, qui dit par quel champ une
   rétention le découpe, ou d'un `null` qui dit qu'elle ne le découpe pas.

   Le contrôle les garde maintenant, pour que le prochain magasin n'ait pas à
   le redécouvrir par un essai voisin.
*/
const dansUnGroupe = new Set(
  [...GROUPES.matchAll(/magasins: \[([^\]]*)\]/g)].flatMap((bloc) =>
    [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
  ),
);
const avecChampDate = new Set(
  [...GROUPES.matchAll(/^\s{2}(\w+): (?:'[^']*'|null),$/gm)].map((m) => m[1]),
);

v('aucun magasin créé n’échappe à un groupe d’effacement', moins(crees, dansUnGroupe), []);
v('aucun magasin créé ne manque sa règle de rétention', moins(crees, avecChampDate), []);

console.log('\nUN MAGASIN SCELLÉ NE SE DÉCOUPE QUE SUR UNE DATE QU’IL EXPOSE');

/*
   LE GARDE-FOU QUI MANQUAIT, ET LE DÉFAUT QU'IL ATTRAPE.

   `dateDe(magasin, enregistrement)` lit `CHAMP_DATE[magasin]` sur la ligne
   BRUTE, telle que `getAll` la rend — donc avant tout déchiffrement. Pour un
   magasin scellé, cela n'a de sens que si le champ nommé figure dans
   `clairs` : sinon il est à l'intérieur du scellé, `dateDe` rend `null`,
   `dansLaPeriode` rend `false`, et l'effacement par période passe à côté de
   CHAQUE enregistrement en annonçant « 0 visé ». Un effacement qui se dit
   fait et qui n'efface rien.

   Ce n'était pas une hypothèse : `odysseeCreneaux` était dans cet état,
   `CHAMP_DATE` à `jour` et `clairs: ['id', 'majLe']`. Aucun essai ne
   rougissait, parce qu'aucun ne rapprochait les deux tables — chacune était
   juste seule. Celui-ci les rapproche, et il aurait signalé le défaut à la
   seconde où il a été écrit.

   Il lit les vraies tables plutôt que la source : un `grep` sur du texte
   dirait que le champ est cité quelque part, pas qu'il est dans `clairs`.
*/
for (const scelle of MAGASINS_SCELLES) {
  const champ = CHAMP_DATE[scelle.magasin];
  /*
     L'intitulé dit le FAIT, pas la conclusion. Écrire « qui est en clair »
     dans la ligne qui échoue ferait affirmer à l'essai l'inverse de ce qu'il
     mesure, et un journal qui se contredit ne sert plus à diagnostiquer.
  */
  v(
    `${scelle.magasin} : ${
      champ === null || champ === undefined
        ? 'jamais découpé'
        : `découpé sur « ${champ} », qui doit être dans clairs [${scelle.clairs.join(', ')}]`
    }`,
    champ === null || champ === undefined || scelle.clairs.includes(champ),
    true,
  );
}

/*
   L'autre sens : un magasin qui se découpe doit nommer un champ que la ligne
   porte vraiment. Le contrôle ne peut pas le vérifier sans enregistrement,
   mais il peut au moins refuser un nom vide.
*/
const champsVides = Object.entries(CHAMP_DATE).filter(([, c]) => c === '');
v('aucun champ de découpage n’est la chaîne vide', champsVides.map(([m]) => m), []);

console.log(
  echecs === 0
    ? `\n\x1b[32mLe schéma est en version ${declaree}, ${numeros.length} migrations, aucun doublon. ` +
        `${crees.size} magasins, dont ${scelles.size} scellés, tous déclarés aux quatre endroits.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
