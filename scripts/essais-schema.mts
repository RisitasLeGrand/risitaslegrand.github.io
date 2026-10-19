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
 */
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync('src/lib/db.ts', 'utf8');

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

/*
   Les blocs `vers(n)`. On prend les appels, pas les commentaires : un
   commentaire qui cite « vers(34) » pour expliquer l'histoire ne doit pas
   compter comme un bloc.
*/
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

console.log('\nLE MAGASIN DE LA PHASE 4 DE SANTÉ EST DÉCLARÉ PARTOUT');

/*
   Trois déclarations pour un magasin, et en oublier une ne se voit pas tout
   de suite : sans la liste de progression il n'est ni effacé ni sauvegardé,
   sans la déclaration de coffre `sceller()` lève à la première écriture.
*/
v('il naît dans une migration', SOURCE.includes("createObjectStore('odysseeCreneaux'"), true);
v('il est dans la liste des magasins effaçables et sauvegardés', SOURCE.includes("'odysseeCreneaux',"), true);
const coffre = readFileSync('src/lib/noyau/coffre.ts', 'utf8');
v('et il est déclaré scellé', coffre.includes("magasin: 'odysseeCreneaux'"), true);

console.log(
  echecs === 0
    ? `\n\x1b[32mLe schéma est en version ${declaree}, ${numeros.length} migrations, aucun doublon.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
