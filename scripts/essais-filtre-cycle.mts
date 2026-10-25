/**
 * Le filtre du cycle : ce qu'il écarte, et surtout ce qu'il écarte par défaut.
 *
 *   npm run essais:filtre-cycle
 *
 * Le § 1 n° 3 du prompt 32 exige ce filtre « testé dès la phase 1, même si
 * le module de cycle n'est pas construit ». Il ne l'est pas : AUCUNE des
 * sources de cycle n'existe encore dans le code. Ces contrôles portent donc
 * sur un refus qui ne s'exerce aujourd'hui sur rien — et c'est exactement
 * l'intérêt. Le jour où le module naîtra, il n'y aura rien à ajouter ici,
 * donc rien à oublier.
 *
 * Le contrôle central est celui du DÉFAUT. Une source inconnue est exclue.
 * Une source oubliée au registre ne s'affiche pas — c'est gênant, c'est
 * visible, cela se corrige en une ligne. L'inverse ferait passer un signal
 * de cycle dans le compteur sans que personne ne s'en aperçoive, et cela ne
 * se corrige pas après coup : c'est vu.
 */
import { readFileSync } from 'node:fs';
import {
  CLASSES_DU_CYCLE,
  PORTES_GARDEES,
  SOURCES_DECLAREES,
  admis,
  sourceDeclaree,
  suitLaSensibiliteDuCycle,
} from '../src/lib/notifications/filtre-cycle';

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

/* ── 1. Le défaut : l'ignorance exclut ─────────────────────────────────── */
console.log('\nUne source inconnue est écartée');

v('une source jamais déclarée', suitLaSensibiliteDuCycle({ source: 'source.inventee' }), true);
v('une source vide', suitLaSensibiliteDuCycle({ source: '' }), true);
v(
  'et une source déclarée passe',
  suitLaSensibiliteDuCycle({ source: 'rappel-de-sauvegarde' }),
  false,
);

/* ── 2. Les sources du cycle, qui n'existent pas encore ────────────────── */
console.log('\nLes sources du cycle sont écartées, bien qu’aucune n’existe');

for (const id of ['journal-du-cycle', 'statut-du-cycle']) {
  v(`${id} est écartée`, suitLaSensibiliteDuCycle({ source: id }), true);
  v(`${id} est déclarée comme telle`, sourceDeclaree(id)?.suitLeCycle, true);
}

/* ── 3. La sensibilité se transmet par ce qui est visé ─────────────────── */
console.log('\nUne correction anodine qui vise le cycle est écartée');

v(
  'une question à trancher ordinaire passe',
  suitLaSensibiliteDuCycle({ source: 'question-a-trancher', viseLaSource: 'rappel-de-prise' }),
  false,
);
v(
  'la même, visant le journal du cycle, est écartée',
  suitLaSensibiliteDuCycle({ source: 'question-a-trancher', viseLaSource: 'journal-du-cycle' }),
  true,
);
v(
  'et visant une source inconnue, écartée aussi',
  suitLaSensibiliteDuCycle({ source: 'question-a-trancher', viseLaSource: 'source.inventee' }),
  true,
);

/* ── 4. La classe de la molécule, pas le type du signal ────────────────── */
console.log('\nUn rappel de prise n’est admis que si la classe est connue');

/*
   CETTE ASSERTION DISAIT L'INVERSE, ET ELLE MESURAIT LE TROU.

   Elle affirmait qu'« un rappel de prise sans molécule nommée passe », ce qui
   était bien le comportement du code — et c'était le défaut. L'exception
   écrite juste à côté (« admis, SAUF pour une molécule de classe du cycle »)
   reposait sur `classeMolecule`, et AUCUNE molécule ne porte de classe : le
   registre n'a pas cette notion, et rien ne pourra la renseigner avant qu'un
   RCP lu la fournisse. La condition ne se déclenchait donc jamais, et un
   rappel de prise de contraceptif entrait au centre sous le libellé
   « Rappels de prise ».

   Le trou était dans la **donnée manquante**, pas dans la logique : la façon
   la plus sûre de ne pas se faire voir, et un essai qui affirmait le
   comportement sans interroger sa prémisse l'a tenu en place.

   Option (a), arbitrée par le pilote le 19 octobre à 12 h 46 : l'ignorance
   exclut. L'assertion garde donc le même objet — ce que fait un rappel sans
   classe — avec la réponse inverse, et son exigence n'est pas abaissée : elle
   est retournée.
*/
v(
  'un rappel de prise sans classe connue est ÉCARTÉ',
  suitLaSensibiliteDuCycle({ source: 'rappel-de-prise' }),
  true,
);
v(
  'et une classe explicitement nulle ne vaut pas mieux qu’absente',
  suitLaSensibiliteDuCycle({ source: 'rappel-de-prise', classeMolecule: null }),
  true,
);
v(
  'une chaîne vide non plus',
  suitLaSensibiliteDuCycle({ source: 'rappel-de-prise', classeMolecule: '' }),
  true,
);
v(
  'la source le déclare, plutôt que la logique de nommer la source',
  sourceDeclaree('rappel-de-prise')?.exigeUneClasse,
  true,
);
v(
  'et elle est la seule à l’exiger aujourd’hui',
  SOURCES_DECLAREES.filter((s) => s.exigeUneClasse).map((s) => s.id),
  ['rappel-de-prise'],
);

/*
   LA CONSÉQUENCE, MESURÉE : aucune molécule ne porte de classe, donc AUCUN
   rappel de prise n'entre au centre aujourd'hui. C'est une fonction en moins,
   et il faut la dire à la personne plutôt que la laisser constater.

   Cette assertion rougira le jour où une classe apparaîtra dans le registre —
   et ce jour-là il faudra relire tout ce bloc, ce qui est exactement ce qu'on
   veut : c'est le moment où le filtre recommence à pouvoir se tromper.
*/
const registreDesMolecules = readFileSync('src/lib/odyssee/molecules.ts', 'utf8');
v(
  'le registre des molécules ne porte toujours aucune notion de classe',
  /\bclasse\s*[?:]/.test(registreDesMolecules),
  false,
);
v(
  'un rappel pour une molécule ordinaire passe',
  suitLaSensibiliteDuCycle({ source: 'rappel-de-prise', classeMolecule: 'antalgique' }),
  false,
);
for (const classe of CLASSES_DU_CYCLE) {
  v(
    `un rappel pour une molécule de classe « ${classe} » est écarté`,
    suitLaSensibiliteDuCycle({ source: 'rappel-de-prise', classeMolecule: classe }),
    true,
  );
}
v('les deux classes sont bien celles du prompt', CLASSES_DU_CYCLE, [
  'contraceptif',
  'hormone-sexuelle',
]);

/* ── 5. Le tri d'un lot ────────────────────────────────────────────────── */
console.log('\nLe tri d’un lot ne laisse passer que le déclaré');

const lot = [
  { source: 'rappel-de-sauvegarde' },
  { source: 'journal-du-cycle' },
  { source: 'source.inventee' },
  { source: 'rappel-de-prise', classeMolecule: 'contraceptif' },
  { source: 'pointage-a-reporter' },
];
v('deux admis sur cinq', admis(lot).map((s) => s.source), [
  'rappel-de-sauvegarde',
  'pointage-a-reporter',
]);

/* ── 6. Le registre se tient ───────────────────────────────────────────── */
console.log('\nLe registre se tient');

v(
  'aucun identifiant en double',
  SOURCES_DECLAREES.length,
  new Set(SOURCES_DECLAREES.map((s) => s.id)).size,
);
v(
  'chaque source dit pourquoi, en une phrase non vide',
  SOURCES_DECLAREES.filter((s) => !s.pourquoi || s.pourquoi.length < 20).map((s) => s.id),
  [],
);
v(
  'deux sources seulement suivent le cycle à ce jour',
  SOURCES_DECLAREES.filter((s) => s.suitLeCycle).map((s) => s.id),
  ['journal-du-cycle', 'statut-du-cycle'],
);
v('les trois portes gardées sont nommées', PORTES_GARDEES, [
  'centre',
  'compteur',
  'notification',
]);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
