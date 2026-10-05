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
import { defautsDesDonnees, DONNEES_PAR_TYPE } from './lib/visuels.mjs';

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

/*
 * Deux jalons, et non un seul comme à l'origine : depuis que `visuel.donnees`
 * est validé contre le schéma de son type, une frise d'un seul jalon est
 * refusée — une frise à un point ne montre aucun écart, donc rien. Le jeu
 * d'essai datait de l'époque où `donnees` passait sans contrôle.
 */
const visuelValide = {
  type: 'frise',
  donnees: {
    jalons: [
      { date: '1958', libelle: 'Constitution' },
      { date: '2008', libelle: 'Question prioritaire', marqueur: 'bonne-reponse' },
    ],
  },
  legende: 'Les dates clefs.',
  alt: 'Une frise portant 1958, adoption de la Constitution, et 2008, question prioritaire.',
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
  /*
   * Le contrôle des données remonte jusqu'au bloc complet : une correction dont
   * le visuel est bien formé mais dont les données ne le sont pas est refusée
   * **au build**, et non au rendu devant la personne qui révise.
   */
  verifier(
    'une correction dont les données de visuel sont fautives est refusée',
    correctionSchema.safeParse(
      correction(QUATRE, {
        visuel: { ...visuelValide, donnees: { jalons: [{ date: '1958', libelle: 'seul' }] } },
      }),
    ).success,
    false,
  );
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

console.log('\n\x1b[1mLES DONNÉES DES VISUELS\x1b[0m\n');
{
  /**
   * Ces assertions tiennent un trou refermé : `visuel.donnees` était déclaré
   * `unknown`, et une frise sans jalons ou un schéma citant un nœud absent
   * passaient le build pour n'échouer qu'au rendu — devant la personne qui
   * révise, au moment où elle demande la correction d'une question ratée.
   */
  verifier('les huit types ont un schéma de données', Object.keys(DONNEES_PAR_TYPE).sort(), [
    'courbe',
    'figure',
    'frise',
    'grille',
    'schema',
    'tableau',
    'texte_annote',
    'venn',
  ]);

  const bonneFrise = {
    jalons: [
      { date: 1958, libelle: 'Constitution' },
      { date: 2008, libelle: 'QPC', marqueur: 'bonne-reponse' },
    ],
  };
  verifier('une frise correcte passe', defautsDesDonnees('frise', bonneFrise), []);
  verifier(
    'une frise d’un seul jalon est refusée',
    defautsDesDonnees('frise', { jalons: [{ date: 1958, libelle: 'x' }] }).length > 0,
    true,
  );
  verifier(
    'un marqueur hors vocabulaire est refusé',
    defautsDesDonnees('frise', {
      jalons: [
        { date: 1, libelle: 'a', marqueur: 'surligne' },
        { date: 2, libelle: 'b' },
      ],
    }).length > 0,
    true,
  );

  // Le défaut le plus silencieux d'un tableau : une ligne trop courte.
  verifier(
    'une ligne de tableau mal dimensionnée est refusée',
    defautsDesDonnees('tableau', {
      entetes: ['a', 'b', 'c'],
      lignes: [['1', '2']],
    }).some((m) => m.includes('cellule')),
    true,
  );
  verifier(
    'une marque hors du tableau est refusée',
    defautsDesDonnees('tableau', {
      entetes: ['a', 'b'],
      lignes: [['1', '2']],
      marques: [{ ligne: 5, colonne: 0, marqueur: 'exclu' }],
    }).some((m) => m.includes('hors du tableau')),
    true,
  );

  // Un lien vers un nœud absent ne se voit pas à la relecture, et casse le rendu.
  verifier(
    'un schéma citant un nœud inconnu est refusé',
    defautsDesDonnees('schema', {
      noeuds: [
        { id: 'a', libelle: 'A', niveau: 0 },
        { id: 'b', libelle: 'B', niveau: 1 },
      ],
      liens: [{ de: 'a', a: 'z' }],
    }).some((m) => m.includes('nœud inconnu')),
    true,
  );
  verifier(
    'et deux nœuds de même identifiant aussi',
    defautsDesDonnees('schema', {
      noeuds: [
        { id: 'a', libelle: 'A', niveau: 0 },
        { id: 'a', libelle: 'bis', niveau: 1 },
      ],
    }).some((m) => m.includes('même identifiant')),
    true,
  );

  verifier(
    'un axe dont le maximum ne dépasse pas le minimum est refusé',
    defautsDesDonnees('courbe', {
      axeX: { nom: 'x', min: 0, max: 0 },
      axeY: { nom: 'y', min: 0, max: 10 },
      series: [{ nom: 's', points: [[0, 0], [1, 1]] }],
    }).some((m) => m.includes('max doit dépasser min')),
    true,
  );

  verifier(
    'un Venn à quatre ensembles est refusé',
    defautsDesDonnees('venn', {
      ensembles: [
        { id: 'a', libelle: 'A' },
        { id: 'b', libelle: 'B' },
        { id: 'c', libelle: 'C' },
        { id: 'd', libelle: 'D' },
      ],
    }).length > 0,
    true,
  );
  verifier(
    'et une zone citant un ensemble inconnu aussi',
    defautsDesDonnees('venn', {
      ensembles: [
        { id: 'a', libelle: 'A' },
        { id: 'b', libelle: 'B' },
      ],
      zones: [{ regions: ['a', 'z'], marqueur: 'exclu' }],
    }).some((m) => m.includes('ensemble inconnu')),
    true,
  );

  verifier(
    'une figure dont un segment cite un point absent est refusée',
    defautsDesDonnees('figure', {
      points: [
        { id: 'A', x: 0, y: 0 },
        { id: 'B', x: 1, y: 0 },
      ],
      segments: [{ de: 'A', a: 'C' }],
    }).some((m) => m.includes('point inconnu')),
    true,
  );

  verifier(
    'une case hors grille est refusée',
    defautsDesDonnees('grille', {
      colonnes: 2,
      lignes: 2,
      cases: [{ x: 4, y: 0, valeur: 'x' }],
    }).some((m) => m.includes('hors grille')),
    true,
  );

  /**
   * Un texte annoté dont aucun segment ne porte d'annotation n'apporte rien de
   * plus que le texte : c'est un visuel vide, et le refuser évite d'en remplir
   * la banque pour satisfaire l'obligation de visuel.
   */
  verifier(
    'un texte annoté sans aucune annotation est refusé',
    defautsDesDonnees('texte_annote', {
      segments: [{ texte: 'le chat' }, { texte: 'dort' }],
    }).some((m) => m.includes('aucun segment')),
    true,
  );
  verifier(
    'mais un segment étiqueté suffit',
    defautsDesDonnees('texte_annote', {
      segments: [{ texte: 'le chat', etiquette: 'sujet' }, { texte: 'dort' }],
    }),
    [],
  );

  // Un champ inconnu est refusé : c'est presque toujours une faute de frappe.
  verifier(
    'un champ inconnu est refusé',
    defautsDesDonnees('frise', { ...bonneFrise, jallons: [] }).length > 0,
    true,
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
