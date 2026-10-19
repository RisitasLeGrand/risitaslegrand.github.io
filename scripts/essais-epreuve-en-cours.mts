/**
 * L'épreuve gardée pour plus tard : la décision de la reprendre (C3 du 43).
 *
 *   npm run essais:epreuve-en-cours
 *
 * Les deux cas que le pilote demande — **question retirée** et **question
 * absente** — plus la forme illisible, qui est le troisième et que personne
 * n'avait nommé : l'enregistrement vient de la base, donc peut-être d'une
 * version antérieure, et une forme qui ne tient pas n'est pas une erreur à
 * afficher mais une épreuve qu'on ne peut pas reprendre.
 */
import {
  estLisible,
  questionsDeLEpreuve,
  refusDeReprise,
  type EpreuveEnCours,
} from '../src/lib/noyau/epreuve-en-cours.ts';

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
const vrai = (quoi: string, condition: boolean) => v(quoi, condition, true);

const gardee = (sur: Partial<EpreuveEnCours> = {}): EpreuveEnCours => ({
  id: 'courante',
  le: '2026-10-19T09:00:00.000Z',
  majLe: '2026-10-19T09:20:00.000Z',
  formatId: 'dgfip-b',
  parcoursId: 'dgfip-b',
  questionIds: ['q1', 'q2', 'q3'],
  ordres: [
    [2, 0, 1],
    [0, 1, 2],
    [1, 2, 0],
  ],
  choix: [[2], [], [0, 1]],
  position: 1,
  ...sur,
});

const TOUTES = new Set(['q1', 'q2', 'q3']);

console.log('\n1. UNE ÉPREUVE INTACTE SE REPREND');
v('aucun refus', refusDeReprise(gardee(), TOUTES, TOUTES), null);
vrai('et sa forme est lisible', estLisible(gardee()));

console.log('\n2. UNE QUESTION ABSENTE DE LA BANQUE');
/* La banque rechargée ne connaît plus « q2 » : l'épreuve ne peut pas être
   recomposée, et l'écran ne doit pas en composer une autre à la place. */
v(
  'la reprise refuse',
  refusDeReprise(gardee(), new Set(['q1', 'q3']), new Set(['q1', 'q3'])),
  'question-absente',
);

console.log('\n3. UNE QUESTION RETIRÉE DU PARCOURS');
/* La banque la connaît encore — elle est servie à un autre parcours, ou sa
   date de service est passée — mais pas ici. Le motif diffère du précédent,
   et c'est l'essai qui en a besoin, pas la personne. */
v(
  'la reprise refuse aussi',
  refusDeReprise(gardee(), TOUTES, new Set(['q1', 'q3'])),
  'question-retiree',
);

console.log('\n4. UNE FORME QUI NE TIENT PAS');
v('rien du tout', refusDeReprise(null, TOUTES, TOUTES), 'forme-illisible');
v(
  'une position hors des questions',
  refusDeReprise(gardee({ position: 9 }), TOUTES, TOUTES),
  'forme-illisible',
);
v(
  'autant d’ordres que de questions, sinon rien',
  refusDeReprise(gardee({ ordres: [[0, 1, 2]] }), TOUTES, TOUTES),
  'forme-illisible',
);
v(
  'autant de réponses que de questions, sinon rien',
  refusDeReprise(gardee({ choix: [[0]] }), TOUTES, TOUTES),
  'forme-illisible',
);
v(
  'aucune question gardée n’est pas une épreuve',
  refusDeReprise(gardee({ questionIds: [], ordres: [], choix: [], position: 0 }), TOUTES, TOUTES),
  'forme-illisible',
);

console.log('\n5. LA REPRISE REND LES QUESTIONS DANS L’ORDRE, AVEC LEUR MÉLANGE');

const banque = new Map(
  ['q1', 'q2', 'q3'].map((id) => [
    id,
    {
      id,
      rubrique: 'R',
      rubriqueId: 'r',
      question: `énoncé ${id}`,
      options: ['a', 'b', 'c'],
      bonnes: [0],
      explication: '',
    },
  ]),
);
const reprises = questionsDeLEpreuve(gardee(), banque)!;
v('les trois questions, dans l’ordre de l’épreuve', reprises.map((q) => q.id), ['q1', 'q2', 'q3']);
/* LE DÉTAIL QUI FAIT TOUT : l'ordre des propositions est celui du tirage, et
   non un nouveau mélange. Sans lui, l'épreuve reprise aurait les mêmes
   questions et un autre écran, avec des cases cochées qui sembleraient avoir
   bougé toutes seules. */
v('et chacune garde le mélange de ses propositions', reprises.map((q) => q.ordre), [
  [2, 0, 1],
  [0, 1, 2],
  [1, 2, 0],
]);
v(
  'une question manquante rend « rien », et non une épreuve amputée',
  questionsDeLEpreuve(gardee(), new Map([...banque].filter(([id]) => id !== 'q2'))),
  null,
);

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
