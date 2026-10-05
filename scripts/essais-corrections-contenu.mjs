/**
 * Essais du bloc « correction » de la banque de QCM.
 *
 * L'invariant central est le pendant écrit de celui de Cog-Training : **la
 * correction ne doit pas contredire la clef de réponse**. Une correction qui
 * déclare juste une option que la clef donne fausse est pire qu'une absence de
 * correction, puisqu'elle enseigne le faux avec l'autorité d'un corrigé — et
 * rien, à la lecture, ne le signale.
 *
 * Les deux autres portent sur le visuel : « aucun » doit être une décision
 * motivée, et tout dessin doit porter son alternative textuelle. Sans ces deux
 * contrôles, « aucun » devient le réflexe de qui n'a pas réfléchi, et
 * l'accessibilité se perd une question à la fois.
 */
import {
  TYPES_VISUEL,
  correctionSchema,
  defautsDeLaCorrection,
  questionDgfipSchema,
  quizSchema,
  visuelSchema,
} from './lib/schema.mjs';
import { MATIERES_MIGREES, RUBRIQUES_MIGREES, estMatiereMigree } from './lib/corrections-migrees.mjs';

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

const visuelValide = {
  type: 'frise',
  donnees: { jalons: [{ date: '1958', libelle: 'Constitution' }] },
  legende: 'Les dates clefs.',
  alt: 'Une frise portant 1958, adoption de la Constitution.',
};

function correction(par_option, extra = {}) {
  return {
    resume: 'La réponse est la deuxième option.',
    par_option,
    detail: 'On élimine d’abord les deux options hors sujet, puis on compare les deux restantes.',
    confiance: 'haute',
    visuel: visuelValide,
    ...extra,
  };
}

const QUATRE = [
  { verdict: 'faux', pourquoi: 'hors sujet' },
  { verdict: 'juste', pourquoi: 'c’est la définition exacte' },
  { verdict: 'faux', pourquoi: 'confusion avec une notion voisine' },
  { verdict: 'faux', pourquoi: 'date erronée' },
];

console.log('\n\x1b[1mLE VISUEL EST UNE DÉCISION\x1b[0m\n');
{
  verifier('un visuel complet passe', visuelSchema.safeParse(visuelValide).success, true);
  verifier(
    '« aucun » sans raison est refusé',
    visuelSchema.safeParse({ type: 'aucun' }).success,
    false,
  );
  verifier(
    '« aucun » motivé passe',
    visuelSchema.safeParse({ type: 'aucun', raison_aucun: 'La question porte sur un mot, rien à dessiner.' })
      .success,
    true,
  );
  verifier(
    'un type dessiné sans données est refusé',
    visuelSchema.safeParse({ type: 'courbe', alt: 'Une courbe.' }).success,
    false,
  );
  verifier(
    'un type dessiné sans alternative textuelle est refusé',
    visuelSchema.safeParse({ type: 'courbe', donnees: { points: [] } }).success,
    false,
  );
  verifier(
    'un type inconnu est refusé',
    visuelSchema.safeParse({ type: 'photo', donnees: {}, alt: 'x' }).success,
    false,
  );
  verifier('les neuf types sont déclarés', TYPES_VISUEL.length, 9);
}

console.log('\n\x1b[1mLA CORRECTION NE CONTREDIT PAS LA CLEF\x1b[0m\n');
{
  const options = ['A', 'B', 'C', 'D'];
  verifier(
    'une correction cohérente n’a aucun défaut',
    defautsDeLaCorrection(correction(QUATRE), options, [1]),
    [],
  );
  verifier(
    'un nombre d’entrées différent du nombre d’options est signalé',
    defautsDeLaCorrection(correction(QUATRE.slice(0, 3)), options, [1]).length,
    1,
  );
  verifier(
    'une option donnée juste par la correction et fausse par la clef est signalée',
    defautsDeLaCorrection(correction(QUATRE), options, [2]).length,
    2, // l'option 2 est juste à tort, et l'option 3 fausse à tort
  );
  verifier(
    'le message nomme l’option en cause',
    defautsDeLaCorrection(correction(QUATRE), options, [2])[0].includes('option 2 (« B »)'),
    true,
  );

  // Une question à plusieurs bonnes réponses : deux « juste » sont attendus.
  const deuxJustes = [
    { verdict: 'juste', pourquoi: 'exact' },
    { verdict: 'faux', pourquoi: 'non' },
    { verdict: 'juste', pourquoi: 'exact aussi' },
    { verdict: 'faux', pourquoi: 'non' },
  ];
  verifier(
    'deux bonnes réponses, deux verdicts « juste »',
    defautsDeLaCorrection(correction(deuxJustes), options, [0, 2]),
    [],
  );
  verifier(
    'une bonne réponse oubliée par la correction est signalée',
    defautsDeLaCorrection(correction(QUATRE), options, [1, 3]).length,
    1,
  );
  verifier(
    'sans correction, aucun défaut à signaler',
    defautsDeLaCorrection(undefined, options, [1]),
    [],
  );
}

console.log('\n\x1b[1mLE BLOC COMPLET\x1b[0m\n');
{
  verifier('une correction complète passe', correctionSchema.safeParse(correction(QUATRE)).success, true);
  verifier(
    'un résumé vide est refusé',
    correctionSchema.safeParse(correction(QUATRE, { resume: '' })).success,
    false,
  );
  verifier(
    'un détail absent est refusé',
    correctionSchema.safeParse({ ...correction(QUATRE), detail: undefined }).success,
    false,
  );
  verifier(
    'une confiance hors des deux valeurs est refusée',
    correctionSchema.safeParse(correction(QUATRE, { confiance: 'faible' })).success,
    false,
  );
  verifier(
    'une option sans motif est refusée',
    correctionSchema.safeParse(
      correction([{ verdict: 'faux', pourquoi: '' }, ...QUATRE.slice(1)]),
    ).success,
    false,
  );
  const sansLiens = correctionSchema.safeParse(correction(QUATRE));
  verifier(
    'rappel de cours et sources sont facultatifs et valent liste vide',
    [sansLiens.data.rappel_de_cours, sansLiens.data.sources],
    [[], []],
  );
}

console.log('\n\x1b[1mBRANCHÉ SUR LES DEUX BANQUES\x1b[0m\n');
{
  const base = {
    question: 'Quel texte fonde la Ve République ?',
    options: ['La loi de 1875', 'La Constitution de 1958', 'Le traité de Rome', 'La charte de 1814'],
    reponse: 'La Constitution de 1958',
  };

  verifier(
    'un quiz sans correction reste valide — régime d’inventaire',
    quizSchema.safeParse(base).success,
    true,
  );
  verifier(
    'un quiz avec correction cohérente est valide',
    quizSchema.safeParse({ ...base, correction: correction(QUATRE) }).success,
    true,
  );

  // Le cœur du contrôle : la correction désigne la troisième option comme juste
  // alors que la clef désigne la deuxième.
  const contradictoire = [
    { verdict: 'faux', pourquoi: 'non' },
    { verdict: 'faux', pourquoi: 'non' },
    { verdict: 'juste', pourquoi: 'si' },
    { verdict: 'faux', pourquoi: 'non' },
  ];
  const r = quizSchema.safeParse({ ...base, correction: correction(contradictoire) });
  verifier('un quiz dont la correction contredit la clef est refusé', r.success, false);
  verifier(
    'et le message le dit explicitement',
    r.success ? '' : r.error.issues.some((i) => i.message.includes('par la clef')),
    true,
  );

  const dgfip = {
    question: 'Combien font 7 × 8 ?',
    options: ['54', '56', '48', '64'],
    reponse: '56',
    explication: 'Table de 7.',
  };
  verifier(
    'une question DGFiP sans correction reste valide',
    questionDgfipSchema.safeParse(dgfip).success,
    true,
  );
  verifier(
    'une question DGFiP dont la correction contredit la clef est refusée',
    questionDgfipSchema.safeParse({ ...dgfip, correction: correction(contradictoire) }).success,
    false,
  );
  verifier(
    'la correction survit à la validation, pour être chiffrée ensuite',
    Boolean(
      questionDgfipSchema.safeParse({ ...dgfip, correction: correction(QUATRE) }).data?.correction,
    ),
    true,
  );
}

console.log('\n\x1b[1mLE RÉGIME À DEUX VITESSES\x1b[0m\n');
{
  // Au départ, aucun périmètre n'est migré : le contrôle est en inventaire
  // partout, et le build ne doit pas échouer sur une absence.
  verifier('aucune matière migrée au départ', MATIERES_MIGREES, []);
  verifier('aucune rubrique migrée au départ', RUBRIQUES_MIGREES, []);
  verifier('une matière non listée n’est pas migrée', estMatiereMigree('droit-public'), false);
  // La liste ne fait que croître : on vérifie qu'elle est bien une liste de
  // chaînes, pour qu'une faute de frappe n'y passe pas silencieusement.
  verifier(
    'les périmètres migrés sont des identifiants, non des objets',
    [...MATIERES_MIGREES, ...RUBRIQUES_MIGREES].every((x) => typeof x === 'string'),
    true,
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
