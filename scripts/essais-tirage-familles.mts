/**
 * La règle de tirage : jamais deux questions d'une même famille dans une épreuve.
 *
 * ## Pourquoi l'essai porte sur la boucle et non sur `composerSession`
 *
 * `qcm.ts` importe `ui.ts`, qui lit `import.meta.env` — un objet qui n'existe
 * que dans une construction Astro. Aucun essai ne peut donc importer
 * `composerSession` sous `tsx`, et c'est la raison pour laquelle la boucle de
 * sélection a été sortie dans `qcm-familles.ts`, qui ne dépend de rien.
 *
 * Ce déplacement n'est pas un arrangement pour faire passer un essai : une
 * règle qu'on ne peut pas éprouver n'est pas une règle, c'est une intention.
 * Le branchement de la boucle dans `composerSession` tient en cinq lignes et
 * passe `astro check` ; c'est la BOUCLE qui porte la logique, et c'est elle qui
 * est éprouvée ici — exhaustivement, ce que trois cents tirages au hasard
 * n'auraient pas donné.
 *
 * ## Les deux invariants
 *
 * Jamais deux éléments d'un même lien, quel que soit l'ordre dans lequel le
 * tireur les propose. Et, quand la règle est intenable, le compte est tenu
 * quand même : une épreuve plus courte que son titre est un défaut plus grave
 * qu'un doublon.
 */
import {
  LIENS,
  indexerLesExclusions,
  tirerSansDeuxDuMemeLien,
  type LienDeQuestions,
} from '../src/lib/qcm-familles';

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
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

const el = (id: string) => ({ id });

/* Un décor à soi, pour éprouver la boucle sans dépendre du relevé réel. */
const DECOR: LienDeQuestions[] = [
  { identifiants: ['a1', 'a2'], type: 'doublon-franc', pourquoi: 'même réponse' },
  { identifiants: ['b1', 'b2', 'b3'], type: 'famille', pourquoi: 'un triplet' },
];
const EXCL = indexerLesExclusions(DECOR);

/** Combien d'éléments d'un même lien se retrouvent dans un même tirage. */
const pire = (ids: string[], liens: readonly LienDeQuestions[] = DECOR) =>
  Math.max(0, ...liens.map((l) => l.identifiants.filter((id) => ids.includes(id)).length));

/* --- 1. L'invariant, pour TOUS les ordres de proposition ---------------- */

/*
 * Le tireur prend le i-ième élément de ce qu'on lui donne. En faisant varier i,
 * on couvre tous les ordres de préférence plutôt qu'un échantillon : s'il
 * existe un ordre qui fait sortir deux questions liées, il est trouvé.
 */
const candidats = [el('a1'), el('a2'), el('b1'), el('b2'), el('b3'), el('libre1'), el('libre2')];

/*
 * LA BORNE, et il faut la poser avec soin — la première version de cet essai
 * demandait « aucun ordre ne fait sortir deux éléments liés », ce qui est faux
 * dès qu'on demande plus de questions qu'une sélection sans lien n'en contient.
 *
 * Les sept candidats comptent deux liens : la paire a1/a2 et le triplet
 * b1/b2/b3. Une sélection sans aucun lien prend donc au plus un a, un b, et
 * les deux libres : QUATRE. Jusqu'à quatre demandés, la règle doit être tenue
 * parfaitement ; au-delà, elle devient arithmétiquement intenable, et c'est la
 * complétude qui prime.
 */
const SANS_LIEN_AU_PLUS = 4;
let pireSousLaBorne = 0;
let courtsVus = 0;
for (let i = 0; i < candidats.length; i += 1) {
  for (let combien = 1; combien <= candidats.length; combien += 1) {
    const tires = tirerSansDeuxDuMemeLien(
      candidats,
      combien,
      (parmi) => parmi[i % parmi.length],
      new Set<string>(),
      EXCL,
    );
    if (combien <= SANS_LIEN_AU_PLUS) {
      pireSousLaBorne = Math.max(pireSousLaBorne, pire(tires.map((t) => t.id)));
    }
    if (tires.length !== combien) courtsVus += 1;
  }
}
verifier(
  `jusqu’à ${SANS_LIEN_AU_PLUS} demandés, aucun ordre ne fait sortir deux éléments liés`,
  pireSousLaBorne,
  1,
);
verifier('le compte demandé est toujours tenu, au-delà de la borne comme en dessous', courtsVus, 0);

/* --- 2. Le cas simple, vérifié à la main -------------------------------- */

verifier(
  'deux éléments liés, un seul sort quand il y a de quoi choisir',
  pire(
    tirerSansDeuxDuMemeLien(
      [el('a1'), el('a2'), el('libre1'), el('libre2')],
      2,
      (parmi) => parmi[0],
      new Set<string>(),
      EXCL,
    ).map((t) => t.id),
  ),
  1,
);

verifier(
  'un triplet ne donne qu’un seul de ses membres quand il reste du libre',
  pire(
    tirerSansDeuxDuMemeLien(
      [el('b1'), el('b2'), el('b3'), el('libre1'), el('libre2')],
      3,
      (parmi) => parmi[0],
      new Set<string>(),
      EXCL,
    ).map((t) => t.id),
  ),
  1,
);

/* --- 3. Quand la règle est intenable, la complétude l'emporte ----------- */

const sansEchappatoire = tirerSansDeuxDuMemeLien(
  [el('b1'), el('b2'), el('b3')],
  3,
  (parmi) => parmi[0],
  new Set<string>(),
  EXCL,
);
verifier('une source entièrement liée rend quand même le compte', sansEchappatoire.length, 3);
verifier(
  'et elle rend bien les trois éléments, sans doublon',
  new Set(sansEchappatoire.map((t) => t.id)).size,
  3,
);

/* --- 4. Les interdits traversent les appels ----------------------------- */

/*
 * C'est ainsi qu'une épreuve composée rubrique par rubrique respecte un lien
 * qui traverse deux rubriques : le même ensemble d'interdits sert aux deux
 * appels.
 */
{
  const interdits = new Set<string>();
  const premiere = tirerSansDeuxDuMemeLien([el('a1'), el('libre1')], 1, (p) => p[0], interdits, EXCL);
  const seconde = tirerSansDeuxDuMemeLien([el('a2'), el('libre2')], 1, (p) => p[0], interdits, EXCL);
  verifier(
    'un lien entre deux appels est respecté',
    [premiere[0]?.id, seconde[0]?.id],
    ['a1', 'libre2'],
  );
}

/* --- 5. Les cas dégénérés ne tournent pas en boucle --------------------- */

verifier(
  'demander zéro ne rend rien',
  tirerSansDeuxDuMemeLien([el('a1')], 0, (p) => p[0], new Set<string>(), EXCL),
  [],
);
verifier(
  'une source vide ne rend rien',
  tirerSansDeuxDuMemeLien([], 5, (p) => p[0], new Set<string>(), EXCL),
  [],
);
verifier(
  'un tireur qui ne rend rien arrête le tirage',
  tirerSansDeuxDuMemeLien([el('a1')], 5, () => undefined, new Set<string>(), EXCL),
  [],
);
verifier(
  'un tireur qui rend un élément étranger n’enferme pas la boucle',
  tirerSansDeuxDuMemeLien([el('a1')], 5, () => el('intrus'), new Set<string>(), EXCL).length,
  1,
);

/* --- 6. Le relevé réel est bien celui que la boucle appliquera ---------- */

const reel = indexerLesExclusions();
verifier('le relevé réel porte des liens', LIENS.length > 0, true);
verifier(
  'les deux questions sur la déflation s’excluent dans le relevé réel',
  [
    reel.get('19f09ec04938c194')?.has('6822c423fd237d88') ?? false,
    reel.get('6822c423fd237d88')?.has('19f09ec04938c194') ?? false,
  ],
  [true, true],
);
verifier(
  'et le tirage ne les sort pas ensemble',
  pire(
    tirerSansDeuxDuMemeLien(
      [el('19f09ec04938c194'), el('6822c423fd237d88'), el('libre1'), el('libre2')],
      2,
      (parmi) => parmi[0],
      new Set<string>(),
      reel,
    ).map((t) => t.id),
    LIENS,
  ),
  1,
);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
