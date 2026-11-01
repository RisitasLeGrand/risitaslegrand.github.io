/**
 * LE RAPPEL DE PRISE NE NOMME NI LA MOLÉCULE NI SA CLASSE.
 *
 *   npm run essais:rappel-de-prise-muet
 *
 * ## La règle, et d'où elle vient
 *
 * Le pilote l'a arbitrée le 31 octobre, en reprenant la condition que j'avais
 * posée à l'option (1) : `exigeUneClasse` reste sur `rappel-de-prise`, la
 * classe voyage jusqu'au filtre — et **ce qui est déposé au centre ne nomme ni
 * la molécule ni sa classe**. Le centre est un objet qu'on ouvre devant
 * quelqu'un ; un nom de molécule y est une information de santé qui se lit
 * par-dessus l'épaule.
 *
 * ## Pourquoi cet essai existe alors que trois gardes le tiennent déjà
 *
 * Trois choses l'empêchent aujourd'hui, et aucune ne se périme toute seule :
 * `ElementDuCentre` est une interface FERMÉE — y écrire une classe est une
 * erreur de compilation, B l'a mesuré ; le libellé affiché est une constante
 * de `sources.ts` ; et la classe ne voyage que dans une `Map` de contextes,
 * jamais dans l'élément.
 *
 * **Il reste une porte, et c'est celle que cet essai garde.** `refSource` est
 * du texte libre du point de vue du centre, qui ne l'ouvre jamais. Elle est
 * construite par `refDuCreneau(traitementId, jour, heure)`. Or un traitement
 * porte aussi un `nom`, écrit par la personne — et ce nom EST, le plus
 * souvent, celui de la molécule. Le jour où quelqu'un trouvera plus lisible de
 * composer la référence avec le nom plutôt qu'avec l'identifiant, rien ne
 * lèvera : le centre affichera son libellé constant, les trois gardes
 * ci-dessus tiendront toujours, et un nom de molécule sera entré dans le
 * magasin du centre par la seule porte qui restait ouverte.
 *
 * C'est donc un essai de PORTE, et non de symptôme.
 *
 * ## Ce qu'il mesure, et ce qu'il ne prétend pas mesurer
 *
 * Il est pur : ni base, ni coffre, ni navigateur. Il ne dit rien du chemin
 * « classe connue » parcouru à l'écran, parce qu'aucun écran ne transmet
 * encore de classe — le registre des molécules n'a pas cette notion, et
 * `filtre-cycle.ts` le dit lui-même. Cette lacune est remontée au pilote
 * plutôt que déguisée en garantie.
 */
import { CLASSES_DU_CYCLE, suitLaSensibiliteDuCycle } from '../src/lib/notifications/filtre-cycle';
import { intentionsDOubli } from '../src/lib/notifications/alimentation';
import { refDuCreneau } from '../src/lib/odyssee/rappels';
import { routeDeLaSource } from '../src/lib/notifications/sources';

const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;

let echecs = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
    return;
  }
  echecs += 1;
  console.log(
    `  ${rouge('✗')} ${quoi}\n      attendu : ${JSON.stringify(attendu)}\n      obtenu  : ${JSON.stringify(obtenu)}`,
  );
};

/*
   LE JEU D'ESSAI. Un nom de molécule qui se reconnaît à l'œil dans n'importe
   quelle sortie, et une classe qui n'est PAS du cycle — donc un rappel que le
   filtre admet. C'est le seul cas où quelque chose est déposé, et c'est donc
   le seul où une fuite peut avoir lieu.
*/
const NOM_DE_MOLECULE = 'testostérone';
const CLASSE = 'androgenes';
const TRAITEMENT_ID = '01M69ABCDEF0123456789';
const JOUR = '2026-10-31';
const HEURE = '15:09';

console.log('\nLA RÉFÉRENCE DÉPOSÉE NE PORTE QUE DES IDENTIFIANTS');

const ref = refDuCreneau(TRAITEMENT_ID, JOUR, HEURE);
v('elle se compose de l’identifiant, du jour et de l’heure', ref, `${TRAITEMENT_ID}|${JOUR}|${HEURE}`);
/*
   LE CONTRÔLE QUI COMPTE, et il est écrit sur la RÉFÉRENCE et non sur son
   motif : un essai qui vérifierait la forme « trois champs séparés par une
   barre » resterait vert si le premier champ devenait le nom.
*/
v('elle ne contient pas le nom de la molécule', ref.toLowerCase().includes(NOM_DE_MOLECULE), false);
v('elle ne contient pas la classe', ref.toLowerCase().includes(CLASSE), false);
/*
   Et le contre-exemple, pour que le contrôle ci-dessus ne soit pas un vert à
   vide : si la référence était composée du nom, il DOIT rougir. On le prouve
   en appelant la même fonction avec le nom à la place de l'identifiant.
*/
v(
  'sabotage : une référence composée du nom serait bien vue',
  refDuCreneau(NOM_DE_MOLECULE, JOUR, HEURE).toLowerCase().includes(NOM_DE_MOLECULE),
  true,
);

console.log('\nL’INTENTION PORTE LA CLASSE, ET RIEN QUE POUR LE FILTRE');

const [intention] = intentionsDOubli([{ refSource: ref, classeMolecule: CLASSE }]);
v('la classe est transmise', intention.classeMolecule, CLASSE);
v('la référence est intacte', intention.refSource, ref);
/*
   LES CHAMPS DE L'INTENTION, NOMMÉS ET NON COMPTÉS. Un contrôle sur le nombre
   de champs resterait vert si l'un était renommé ; celui-ci dit lesquels, donc
   un champ ajouté se voit et se discute.
*/
v(
  'et elle ne porte rien d’autre',
  Object.keys(intention).sort(),
  ['classeMolecule', 'genre', 'refSource', 'regroupement'],
);

console.log('\nLE LIBELLÉ AFFICHÉ EST UNE CONSTANTE, ET ELLE EST MUETTE');

const declaree = routeDeLaSource('rappel-de-prise');
v('la source est déclarée, et son libellé est celui attendu', declaree.libelle, 'Rappels de prise');
const libelle = declaree.libelle.toLowerCase();
v('le libellé ne nomme pas la molécule', libelle.includes(NOM_DE_MOLECULE), false);
v('le libellé ne nomme aucune classe du cycle', CLASSES_DU_CYCLE.some((c) => libelle.includes(c)), false);
v('le libellé ne nomme pas la classe transmise', libelle.includes(CLASSE), false);

console.log('\nET LE FILTRE, SUR LE CHEMIN QU’AUCUN ÉCRAN NE PARCOURT ENCORE');

/*
   Ces deux-ci disent ce que la décision du 19 octobre fait d'une classe
   CONNUE. B les mesure déjà dans « essais:filtre-cycle » avec sabotage ; elles
   sont ici parce que tout le reste de ce fichier n'a de sens que si le premier
   cas DÉPOSE quelque chose. Sans elles, cet essai garderait une porte qui ne
   mène nulle part, et il serait vert pour cette raison-là.
*/
v(
  'classe hors cycle : le rappel est admis',
  suitLaSensibiliteDuCycle({ source: 'rappel-de-prise', classeMolecule: CLASSE }),
  false,
);
v(
  'classe du cycle : le rappel est écarté',
  suitLaSensibiliteDuCycle({ source: 'rappel-de-prise', classeMolecule: CLASSES_DU_CYCLE[0] }),
  true,
);
v(
  'classe inconnue : écarté, et c’est la décision du 19 octobre',
  suitLaSensibiliteDuCycle({ source: 'rappel-de-prise' }),
  true,
);

console.log(
  echecs === 0
    ? `\n${vert('✓')} le rappel de prise ne nomme ni la molécule ni sa classe.\n`
    : `\n${rouge('✗')} ${echecs} ${echecs === 1 ? 'contrôle' : 'contrôles'} en échec.\n`,
);
process.exit(echecs > 0 ? 1 : 0);
