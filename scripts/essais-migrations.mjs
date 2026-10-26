/**
 * UN PALIER DE MIGRATION NE SE RÉSERVE QU'AU-DESSUS DE LA VERSION EN VIGUEUR.
 *
 *   npm run essais:migrations
 *
 * ## Le défaut qu'aucun autre essai ne pouvait voir
 *
 * Le 26 octobre, une branche a ajouté un magasin au palier 39 alors que la
 * version du schéma valait déjà 42. Le numéro était LIBRE — balayage des
 * cinquante-sept branches distantes, personne ne le revendiquait — et il était
 * pourtant INATTEIGNABLE.
 *
 * « vers(n) » vaut « ancienneVersion < n et nouvelle >= n ». Mesuré dans le
 * navigateur, et non déduit du code :
 *
 *     base neuve ouverte à 42      migration OUI, ancienne version 0
 *     MÊME base rouverte à 42      migration NON
 *     la même base ouverte à 43    migration OUI, ancienne version 42
 *
 * Le magasin aurait donc été créé chez qui installe le site aujourd'hui, et
 * JAMAIS chez qui l'a déjà ouvert. La fonction aurait été absente sans un mot.
 *
 * ET AUCUN ESSAI N'AURAIT ROUGI. C'est la raison d'être de cette garde : un
 * essai part d'un profil NEUF, qui va de zéro à la version courante et rejoue
 * donc tous les paliers, y compris ceux qui dorment sous la version. La seule
 * base qui révèle le défaut est une base ANCIENNE, et aucun essai n'en a. Le
 * vert était sincère et ne prouvait rien sur ce point.
 *
 * ## La règle, validée par le pilote
 *
 *     Un palier de migration ne se réserve que STRICTEMENT AU-DESSUS de la
 *     « VERSION » de main au moment de la fusion.
 *
 * Les agents écrivent un numéro provisoire dans leur branche ; le constructeur
 * le déplace à la fusion. Cette garde-ci tient la règle à la place de la
 * mémoire.
 *
 * ## Ce qu'elle compare, et pourquoi à « origin/main »
 *
 * Un palier n'est « nouveau » que relativement à ce qui est déjà publié. La
 * référence est donc « origin/main », et non le dernier commit local : c'est
 * contre le schéma déjà en circulation que la question se pose, puisque ce
 * sont ces bases-là qui ne rejoueront rien.
 *
 * Sur main lui-même, aucun palier n'est nouveau, et la garde se réduit à son
 * second contrôle — la version égale au plus haut palier. C'est voulu : elle
 * doit rester verte là où il n'y a rien à ordonner.
 *
 * ## Ce qu'elle ne fait pas
 *
 * Elle ne juge ni le contenu d'un palier, ni l'ordre des magasins, ni la
 * reprise de données. Elle tient trois choses mesurables : qu'aucun palier
 * neuf ne dorme sous la version publiée, que la version courante soit bien le
 * plus haut palier, et qu'aucun numéro ne serve deux fois.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { sansCommentaires } from './lib/sans-commentaires.mjs';
import { nonMesurable } from './lib/non-mesurable.mjs';

const racine = path.resolve(import.meta.dirname, '..');
const FICHIER = 'src/lib/db.ts';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
};
const vrai = (titre, obtenu) => v(titre, obtenu, true);

/* ══════════════════════════════════════════════════════════════════════════
   La lecture, et elle ignore les commentaires

   Un palier cité en PROSE n'est pas un palier. Ce fichier-ci en cite
   plusieurs — « le palier 39 », « la 34 et la 35 » —, et le commentaire qui
   explique la règle en nomme forcément. Les compter rendrait la garde
   fausse de la façon la plus bête : elle accuserait la documentation.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les numéros de palier réellement gardés par du code.
 *
 * « sansCommentaires » rend un TABLEAU de lignes — il garde les positions pour
 * que les numéros de ligne restent justes —, donc on le recoud avant de
 * chercher. Je l'ai appelé comme s'il rendait une chaîne, et il me l'a dit
 * tout de suite ; c'est le genre de contrat qu'on lit plutôt qu'on devine.
 */
export const paliersDuTexte = (texte) =>
  [...sansCommentaires(texte).join('\n').matchAll(/\bvers\(\s*(\d+)\s*\)/g)]
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);

/** La version du schéma déclarée par le code. */
export const versionDuTexte = (texte) => {
  const m = sansCommentaires(texte).join('\n').match(/\bVERSION\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
};

console.log('\n1. LA LECTURE SAIT CE QU’ELLE LIT');

vrai(
  'un palier gardé par du code est vu',
  JSON.stringify(paliersDuTexte('if (vers(12)) { base.x(); }')) === '[12]',
);
vrai(
  'un palier cité dans un commentaire de bloc ne compte pas',
  JSON.stringify(paliersDuTexte('/* on parle de vers(12) ici */')) === '[]',
);
vrai(
  'ni dans un commentaire de ligne',
  JSON.stringify(paliersDuTexte('// vers(12) un jour')) === '[]',
);
vrai(
  'ni dans la ligne étoilée d’un vrai bloc',
  JSON.stringify(paliersDuTexte('/**\n * la 12 est prise, voir vers(12)\n */')) === '[]',
);
/*
   Et le contre-cas, parce que ma première rédaction s'était trompée là : une
   ligne « * … » SANS ouvrant n'est pas un commentaire, c'est du texte. Le
   balayeur a raison de la lire, et c'est pour cela qu'il faut l'éprouver dans
   les deux sens plutôt que de supposer qu'une étoile suffit.
*/
vrai(
  'une ligne étoilée orpheline, elle, n’est pas prise pour un commentaire',
  JSON.stringify(paliersDuTexte(' * vers(12) sans ouvrant')) === '[12]',
);
vrai(
  'du code APRÈS la fermeture d’un commentaire est bien vu',
  JSON.stringify(paliersDuTexte('/* vers(11) */ if (vers(12)) {}')) === '[12]',
);
vrai(
  'les espaces dans l’appel ne le cachent pas',
  JSON.stringify(paliersDuTexte('if (vers( 7 )) {}')) === '[7]',
);
v('la version est lue', versionDuTexte('const VERSION = 43;'), 43);
v('une version commentée n’est pas lue', versionDuTexte('/* const VERSION = 99; */'), null);

/* ══════════════════════════════════════════════════════════════════════════
   2. L'arbre courant contre « origin/main »
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n2. AUCUN PALIER NEUF NE DORT SOUS LA VERSION PUBLIÉE');

const texteCourant = readFileSync(path.join(racine, FICHIER), 'utf8');
const paliersCourants = paliersDuTexte(texteCourant);
const versionCourante = versionDuTexte(texteCourant);

let texteDeMain;
try {
  texteDeMain = execFileSync('git', ['show', `origin/main:${FICHIER}`], {
    cwd: racine,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch {
  texteDeMain = null;
}

if (texteDeMain === null) {
  /*
     Sans référence publiée, la question « ce palier est-il nouveau ? » n'a
     pas de sens. On ne devine pas, et on ne se compte pas vert : c'est
     exactement l'état que la convention du code 3 décrit.
  */
  nonMesurable(
    `« origin/main:${FICHIER} » lisible, pour savoir quels paliers sont nouveaux`,
    'git ne rend pas cette version — dépôt sans « origin », sans cette branche, ' +
      'ou sans ce fichier à cet endroit. Les contrôles de lecture ci-dessus, eux, ' +
      'viennent de passer',
    'récupérer « origin/main » (git fetch origin main), puis relancer',
  );
}

const paliersDeMain = paliersDuTexte(texteDeMain);
const versionDeMain = versionDuTexte(texteDeMain);
const dejaPublies = new Set(paliersDeMain);
const nouveaux = paliersCourants.filter((n) => !dejaPublies.has(n));

console.log(
  `  (main : version ${versionDeMain}, ${paliersDeMain.length} paliers · ` +
    `ici : version ${versionCourante}, ${paliersCourants.length} paliers)`,
);

vrai('main déclare bien une version', typeof versionDeMain === 'number');
vrai('l’arbre courant déclare bien une version', typeof versionCourante === 'number');

v(
  'tout palier NOUVEAU est strictement au-dessus de la version de main',
  nouveaux.filter((n) => n <= versionDeMain),
  [],
);

/*
   Cette ligne-ci a menti une fois, et c'est pour cela qu'elle est écrite
   ainsi. Elle annonçait « tous au-dessus de N » sans regarder, et elle l'a
   donc annoncé pendant que l'assertion juste au-dessus rougissait sur le
   contraire. Un récapitulatif qui contredit son propre verdict est pire
   qu'un récapitulatif absent : on croit le texte, pas la croix.
*/
if (nouveaux.length === 0) {
  console.log('  (aucun palier neuf : rien à ordonner, et c’est le cas sur main)');
} else {
  const dorment = nouveaux.filter((n) => n <= versionDeMain);
  console.log(
    `  (paliers neufs : ${nouveaux.join(', ')} — version publiée ${versionDeMain} ; ` +
      `${dorment.length === 0 ? 'aucun ne dort sous elle' : `DORMENT sous elle : ${dorment.join(', ')}`})`,
  );
}

console.log('\n3. LA VERSION EST LE PLUS HAUT PALIER');

/*
   Pourquoi l'ÉGALITÉ et non « au moins ». Une version plus basse que le plus
   haut palier laisse ce palier endormi — c'est le défaut du 39. Une version
   plus haute qu'aucun palier n'atteint est un trou en l'air : la base monte
   d'un cran sans que rien ne s'exécute, et le cran suivant qu'on écrira sous
   elle sera à son tour inatteignable. Les deux sens se tiennent donc.
*/
v(
  'la version courante vaut le plus haut palier',
  versionCourante,
  paliersCourants[paliersCourants.length - 1],
);

console.log('\n4. AUCUN NUMÉRO NE SERT DEUX FOIS');

const vus = new Set();
const doubles = [];
for (const n of paliersCourants) {
  if (vus.has(n)) doubles.push(n);
  vus.add(n);
}
v('aucun palier en double', doubles, []);

console.log(
  echecs === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${echecs} rouge(s).\x1b[0m`,
);
process.exit(echecs > 0 ? 1 : 0);
