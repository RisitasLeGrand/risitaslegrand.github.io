/**
 * Essais du relevé des doublons et des familles de la banque « QCM — DGFiP ».
 *
 * Deux choses à éprouver, et elles ne se confondent pas.
 *
 * ## La logique du relevé
 *
 * La symétrie, d'abord : si A exclut B, B exclut A. Et surtout la NON-
 * transitivité, qui est le choix de conception le plus discutable du module et
 * donc celui qu'il faut figer par un essai. Si A et B sont liés, et B et C,
 * alors A et C restent tirables ensemble. Fermer la relation par transitivité
 * paraîtrait plus sûr, et serait un piège : le relevé finirait par interdire la
 * moitié de la banque dès qu'une question sert de pont entre deux familles
 * étrangères.
 *
 * ## Le relevé LUI-MÊME, confronté à la banque
 *
 * C'est l'essai qui compte le plus, et il porte sur des données, pas sur du
 * code. Un identifiant se calcule sur la rubrique et l'énoncé : retoucher un
 * énoncé change son identifiant, et le relevé désignerait alors une question
 * disparue — sans que rien ne cesse de fonctionner. Le tirage protégerait
 * simplement moins bien qu'on le croit, ce qui est la panne la plus coûteuse
 * parce qu'elle ne se voit pas.
 *
 * Cette confrontation n'est possible que là où la banque existe. Dans un
 * conteneur de travail elle est présente, et l'essai la lit ; ailleurs — une
 * intégration continue sans contenu — il le DIT et passe, au lieu de rendre un
 * rouge qui n'appartient pas au code. Ce qu'il ne fait jamais, c'est se taire :
 * un essai qui ne trouve pas son sujet doit l'annoncer, sinon il rassure à
 * tort.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { idStable } from './lib/crypto.mjs';
import {
  LIENS,
  defautsDuReleve,
  indexerLesExclusions,
  type LienDeQuestions,
} from '../src/lib/qcm-familles';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

/* --- 1. L'index des exclusions ------------------------------------------ */

const DECOR: LienDeQuestions[] = [
  { identifiants: ['aaa', 'bbb'], type: 'doublon-franc', pourquoi: 'même réponse' },
  { identifiants: ['bbb', 'ccc'], type: 'famille', pourquoi: 'même thème' },
  { identifiants: ['ddd', 'eee', 'fff'], type: 'famille', pourquoi: 'un triplet' },
];

const index = indexerLesExclusions(DECOR);

verifier('une paire exclut dans les deux sens', [...(index.get('aaa') ?? [])], ['bbb']);
verifier(
  'une question qui sert de pont porte les deux exclusions',
  [...(index.get('bbb') ?? [])].sort(),
  ['aaa', 'ccc'],
);
verifier(
  'LA NON-TRANSITIVITÉ : aaa et ccc restent tirables ensemble',
  [index.get('aaa')?.has('ccc') ?? false, index.get('ccc')?.has('aaa') ?? false],
  [false, false],
);
verifier(
  'un triplet exclut ses deux autres membres',
  [...(index.get('ddd') ?? [])].sort(),
  ['eee', 'fff'],
);
verifier(
  'une question hors relevé ne porte aucune exclusion',
  index.get('zzz') ?? null,
  null,
);

/* La symétrie, sur le relevé réel et non sur le décor. */
const reel = indexerLesExclusions();
let asymetries = 0;
for (const [id, exclus] of reel) {
  for (const autre of exclus) if (!reel.get(autre)?.has(id)) asymetries += 1;
}
verifier('le relevé réel est symétrique', asymetries, 0);
verifier('le relevé réel n’est pas vide', LIENS.length > 0, true);

/* --- 2. Les défauts du relevé ------------------------------------------- */

verifier(
  'un relevé dont tous les identifiants existent ne produit aucun défaut',
  defautsDuReleve(new Set(['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff']), DECOR),
  [],
);
/*
 * « bbb » figure dans DEUX entrées du décor, et sa disparition en casse donc
 * deux. L'essai attendait un défaut ; il en reçoit deux, et c'est le bon
 * nombre : chaque entrée brisée doit être nommée séparément, puisque chacune
 * demande une décision — celle qu'on répare, celle qu'on retire. Un défaut
 * unique obligerait à relire le relevé pour savoir ce qu'il couvre.
 */
verifier(
  'un identifiant inconnu est signalé dans CHAQUE entrée qui le nomme',
  defautsDuReleve(new Set(['aaa', 'ccc', 'ddd', 'eee', 'fff']), DECOR).length,
  2,
);
verifier(
  'et le défaut nomme l’identifiant en cause',
  /« bbb »/.test(defautsDuReleve(new Set(['aaa', 'ccc', 'ddd', 'eee', 'fff']), DECOR)[0] ?? ''),
  true,
);
verifier(
  'une entrée à un seul identifiant est refusée',
  defautsDuReleve(new Set(['aaa']), [
    { identifiants: ['aaa'], type: 'famille', pourquoi: 'seule' },
  ]).length,
  1,
);
verifier(
  'un identifiant répété dans la même entrée est refusé',
  defautsDuReleve(new Set(['aaa']), [
    { identifiants: ['aaa', 'aaa'], type: 'famille', pourquoi: 'deux fois' },
  ]).some((d) => /deux fois/.test(d)),
  true,
);
verifier(
  'une entrée répétée à l’identique est refusée',
  defautsDuReleve(new Set(['aaa', 'bbb']), [
    { identifiants: ['aaa', 'bbb'], type: 'famille', pourquoi: 'une' },
    { identifiants: ['bbb', 'aaa'], type: 'famille', pourquoi: 'la même, dans l’autre ordre' },
  ]).some((d) => /répétition exacte/.test(d)),
  true,
);
verifier(
  'deux entrées de TYPES différents sur les mêmes questions sont admises',
  defautsDuReleve(new Set(['aaa', 'bbb']), [
    { identifiants: ['aaa', 'bbb'], type: 'doublon-franc', pourquoi: 'même réponse' },
    { identifiants: ['aaa', 'bbb'], type: 'famille', pourquoi: 'et même thème' },
  ]),
  [],
);

/* --- 3. Le relevé réel, confronté à la banque réelle -------------------- */

const dossier = path.join(racine, 'content', 'qcm-dgfip');
if (!existsSync(dossier)) {
  console.log(
    '\x1b[33m!\x1b[0m la banque n’est pas servie dans cet arbre : la confrontation du relevé\n' +
      '    aux identifiants réels est impossible ici, et elle est donc ANNONCÉE non faite.\n' +
      '    Elle tourne dans un conteneur qui porte « content/qcm-dgfip ».',
  );
} else {
  const ids = new Set<string>();
  for (const nom of readdirSync(dossier).sort()) {
    if (!/\.ya?ml$/.test(nom)) continue;
    const corps = YAML.parse(readFileSync(path.join(dossier, nom), 'utf8'));
    for (const q of corps.questions ?? []) {
      ids.add(await idStable(`${corps.rubrique}|${q.question}`, 16));
    }
  }
  const defauts = defautsDuReleve(ids);
  for (const d of defauts) console.log(`    ${d}`);
  verifier(
    `le relevé désigne des questions qui existent (${ids.size} identifiants dans la banque)`,
    defauts,
    [],
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
