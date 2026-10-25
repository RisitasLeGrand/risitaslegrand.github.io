/**
 * À qui un repère sourcé s'applique : le moteur, et le fait qu'il soit à vide.
 *
 *   npm run essais:population
 *
 * ## Ce que cet essai garde, et ce qu'il ne peut pas garder
 *
 * Il garde le **moteur** : les trois verdicts, leur précédence, et surtout le
 * défaut — ne rien savoir ne vaut jamais « applicable ». C'est la seule
 * partie de la phase 2 qui ne demande aucune source, et elle est
 * entièrement éprouvable sur des fixtures.
 *
 * Il garde aussi, et c'est le point le plus utile, le fait que **tous les
 * repères du dépôt rendent aujourd'hui `indeterminable`**. Cette assertion
 * est écrite pour échouer : le jour où une population sera lue dans un
 * document, elle rougira, et il faudra la changer à la main. C'est voulu —
 * l'alternative serait un essai qui ne remarque pas qu'une population est
 * arrivée, et une population arrivée est précisément ce qu'on veut voir.
 *
 * Il ne garde pas les **valeurs**, puisqu'il n'y en a aucune : le Thésaurus
 * de l'ANSM est dans `sources/`, absent de ce conteneur, et les manuels du
 * PHQ-9 et du GAD-7 ne sont pas atteignables.
 */
import {
  applicabilite,
  controlerPopulation,
  populationLue,
  populationNonLue,
  type PopulationVisee,
} from '../src/lib/noyau/population';
import type { Contexte } from '../src/lib/noyau/registre-usages';
import { ECHELLES } from '../src/lib/odyssee/echelles';
import { THESAURUS } from '../src/lib/odyssee/molecules';

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
const verdict = (p: PopulationVisee, c: Contexte) => applicabilite(p, c).verdict;

/* ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. UNE POPULATION NON LUE NE TRANCHE RIEN');

const nonLue = populationNonLue('le document est hors de portée de ce conteneur');
v('contexte vide', verdict(nonLue, {}), 'indeterminable');
v('contexte complet', verdict(nonLue, { majeur: 'oui', sexe_physio: 'femme' }), 'indeterminable');
v(
  'et la raison du document est reprise telle quelle',
  applicabilite(nonLue, {}).pourquoi.includes('hors de portée de ce conteneur'),
  true,
);

console.log('\n2. LA MAJORITÉ');

const majeurs = populationLue({ majeurSeulement: true }, 'Adults 18 and older.');
v('déclarée majeure', verdict(majeurs, { majeur: 'oui' }), 'applicable');
v('déclarée mineure', verdict(majeurs, { majeur: 'non' }), 'non_applicable');
v('inconnue', verdict(majeurs, { majeur: 'inconnu' }), 'indeterminable');
/*
   LA CLÉ ABSENTE N'EST PAS 'inconnu', et la différence est celle que le
   registre tient : « tu n'as pas le droit de savoir » n'est pas « personne
   ne sait ». Les deux empêchent de trancher, donc le verdict est le même —
   mais il ne faut pas que l'un passe pour l'autre par accident.
*/
v('clé absente du contexte', verdict(majeurs, {}), 'indeterminable');

console.log('\n3. LE SEXE, ET UN CRITÈRE ABSENT NE RESTREINT RIEN');

const femmes = populationLue({ sexes: ['femme'] }, 'Women of reproductive age.');
v('sexe couvert', verdict(femmes, { sexe_physio: 'femme' }), 'applicable');
v('sexe non couvert', verdict(femmes, { sexe_physio: 'homme' }), 'non_applicable');
v('intersexe ou autre, non couvert', verdict(femmes, { sexe_physio: 'intersexe_ou_autre' }), 'non_applicable');
v('sexe inconnu', verdict(femmes, { sexe_physio: 'inconnu' }), 'indeterminable');
/*
   La population ne parle pas de majorité : un contexte qui ne porte que le
   sexe suffit. Une source qui ne restreint pas ne doit pas se mettre à
   restreindre parce qu'une donnée manque ailleurs.
*/
v('la majorité, dont la source ne parle pas, n’est pas exigée', verdict(femmes, { sexe_physio: 'femme', majeur: 'inconnu' }), 'applicable');

console.log('\n4. LA TRANCHE D’ÂGE, DANS LE VOCABULAIRE DU CONSOMMATEUR');

const adultes = populationLue({ tranches: ['18-39', '40-64'] }, 'Ages 18 to 64.');
v('tranche couverte', verdict(adultes, { tranche_age: '18-39' }), 'applicable');
v('tranche non couverte', verdict(adultes, { tranche_age: '65 et plus' }), 'non_applicable');
v('tranche indécidable', verdict(adultes, { tranche_age: 'inconnu' }), 'indeterminable');
/*
   UNE ÉTIQUETTE D'UN AUTRE VOCABULAIRE EST « NON APPLICABLE », ET C'EST LE
   BON SENS DE L'ERREUR. Si le consommateur déclare des bornes qui ne
   produisent pas les étiquettes de la source, le repère ne s'affiche pas.
   Rendre « applicable » serait afficher un repère dont personne n'a vérifié
   qu'il couvre la personne.
*/
v('étiquette d’un autre découpage', verdict(adultes, { tranche_age: 'moins de 30' }), 'non_applicable');

console.log('\n5. LA PRÉCÉDENCE : « NON » L’EMPORTE SUR « ON NE SAIT PAS »');

const femmesMajeures = populationLue(
  { sexes: ['femme'], majeurSeulement: true },
  'Adult women.',
);
/*
   Un critère tranche contre, un autre manque. Dire « on ne sait pas »
   laisserait croire qu'une réponse de plus rendrait le repère applicable, ce
   qui est faux : il est déjà exclu.
*/
v('sexe exclu, majorité inconnue', verdict(femmesMajeures, { sexe_physio: 'homme' }), 'non_applicable');
v('majorité exclue, sexe inconnu', verdict(femmesMajeures, { majeur: 'non' }), 'non_applicable');
v('les deux manquent', verdict(femmesMajeures, {}), 'indeterminable');
v(
  'et les deux manques sont nommés, pas comptés',
  applicabilite(femmesMajeures, {}).pourquoi.includes('votre majorité et votre sexe'),
  true,
);

console.log('\n6. LE CONTRÔLE ATTRAPE LES DEUX PIÈGES MUETS');

v(
  'une population déclarée sans aucun critère',
  controlerPopulation(populationLue({}, 'Tout le monde.'), 'ici').length,
  1,
);
v(
  'une population déclarée sans la phrase de la source',
  controlerPopulation(populationLue({ majeurSeulement: true }, '  '), 'ici').length,
  1,
);
v(
  'une absence de population sans raison',
  controlerPopulation(populationNonLue(''), 'ici').length,
  1,
);
v(
  'une population complète ne pose aucun problème',
  controlerPopulation(majeurs, 'ici'),
  [],
);

console.log('\n7. LIVRÉ À VIDE : AUCUN REPÈRE DU DÉPÔT NE PORTE DE POPULATION');

/*
   CETTE SECTION EST ÉCRITE POUR ÉCHOUER UN JOUR. Elle nomme chaque repère
   sourcé du dépôt et affirme qu'aucun ne sait à qui il s'applique. Le jour
   où une population sera lue dans un document, elle rougira — et c'est le
   signal qu'on veut, parce qu'une population qui arrive doit se voir.
*/
const repères: readonly { quoi: string; population: PopulationVisee }[] = [
  { quoi: 'Thésaurus de l’ANSM', population: THESAURUS.populationVisee },
  ...ECHELLES.filter((e) => e.paliers.length).map((e) => ({
    quoi: `paliers de ${e.id}`,
    population: e.populationDesPaliers,
  })),
];

v('trois repères sourcés sont recensés', repères.length, 3);
v(
  'aucun ne déclare de population',
  repères.filter((r) => r.population.declaree).map((r) => r.quoi),
  [],
);
v(
  'chacun dit pourquoi, et sa raison est affichable',
  repères.filter((r) => r.population.declaree || r.population.pourquoi.trim().length < 20).map((r) => r.quoi),
  [],
);
v(
  'et tous rendent « indeterminable », quel que soit le contexte',
  repères
    .filter((r) => verdict(r.population, { majeur: 'oui', sexe_physio: 'femme', tranche_age: '18-39' }) !== 'indeterminable')
    .map((r) => r.quoi),
  [],
);
v(
  'aucun repère ne pose de problème de cohérence',
  repères.flatMap((r) => controlerPopulation(r.population, r.quoi)),
  [],
);

console.log(
  echecs === 0
    ? `\n\x1b[32m${repères.length} repères sourcés, aucun ne porte de population, tous rendent ` +
        `« indeterminable ».\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
