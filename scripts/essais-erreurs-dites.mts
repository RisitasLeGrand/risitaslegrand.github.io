/**
 * G-13 — jamais le texte brut d’une panne de plateforme à l’écran.
 *
 *   npm run essais:erreurs-dites
 *
 * Le constat du 58 : « l’erreur brute à l’écran », encore vrai le 19 octobre,
 * `progression.astro` écrivant `dire('message-cyclades', (e as Error).message)`.
 * 62 sites dans 27 fichiers faisaient de même, mesurés le même jour.
 *
 * ## Le discriminant, et pourquoi ce n’est pas le texte
 *
 * Deux sortes d’erreurs arrivent à un écran, et elles ne se traitent pas
 * pareil :
 *
 * - une `DOMException` vient de la PLATEFORME. Son texte est celui du
 *   navigateur — anglais, technique, et souvent trompeur : « Failed to execute
 *   "transaction" on "IDBDatabase" » ne dit à personne quoi faire. Il ne doit
 *   jamais atteindre l’écran ;
 * - une `Error` ordinaire, ici, vient de l’APPLICATION. Son message est
 *   français et a été écrit pour être lu — « Ce fichier n’est pas une
 *   sauvegarde valide ». Le remplacer par une reformulation générique
 *   appauvrirait l’écran.
 *
 * Le type est le seul discriminant fiable. Renifler le texte échouerait dès
 * qu’un navigateur parle une autre langue, et c’est la raison pour laquelle
 * cet essai éprouve le TYPE et jamais la chaîne.
 */
import { estEspacePlein, messageDUneErreur } from '../src/lib/agir.ts';

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\u001b[32m✓\u001b[0m' : '\u001b[31m✗\u001b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};

/* Le texte que le navigateur met dans ces pannes : il ne doit ressortir nulle part. */
const BRUT = 'Failed to execute “transaction” on “IDBDatabase”: boom';

console.log('\nUNE PANNE DE PLATEFORME NE MONTRE JAMAIS SON TEXTE');

const NOMS_ATTENDUS = [
  'AbortError',
  'NotAllowedError',
  'SecurityError',
  'NotFoundError',
  'InvalidStateError',
  'VersionError',
  'ConstraintError',
  'DataCloneError',
  'DataError',
  'TimeoutError',
  'OperationError',
  'NetworkError',
];

const fuites = NOMS_ATTENDUS.filter((nom) =>
  messageDUneErreur(new DOMException(BRUT, nom)).includes('transaction'),
);
v('aucun des douze noms connus ne laisse passer le texte du navigateur', fuites, []);

const muets = NOMS_ATTENDUS.filter((nom) => {
  const dit = messageDUneErreur(new DOMException(BRUT, nom));
  return dit.length < 30;
});
v('chacun rend une phrase, et non un mot', muets, []);

/*
   Un nom que la table ne connaît pas tombe sur la phrase générique. C’est le
   cas qui compte le plus : la table est fermée, donc c’est lui qui garde la
   règle quand un navigateur invente une panne.
*/
const inconnue = messageDUneErreur(new DOMException(BRUT, 'PanneQueNulNeConnait'));
v('un nom inconnu ne laisse pas passer le texte non plus', inconnue.includes('transaction'), false);
v('et il renvoie vers la console pour le détail', inconnue.includes('console'), true);

console.log('\nCE QUI PASSE AVANT LA TABLE');

/*
   L’espace plein est reconnu par son nom ET par deux codes hérités : il doit
   garder sa phrase à lui, qui dit quoi faire, et non celle de la table.
*/
const plein = messageDUneErreur(new DOMException(BRUT, 'QuotaExceededError'));
v('l’espace plein garde sa phrase, qui dit où libérer de la place', plein.includes('Stockage'), true);
v('et il est bien reconnu comme tel', estEspacePlein(new DOMException(BRUT, 'QuotaExceededError')), true);

console.log('\nUN MESSAGE DE DOMAINE RESTE INTACT');

/*
   La moitié qu’il ne faut pas casser. Ces phrases-là sont écrites dans
   src/lib pour être lues ; une reformulation générique les remplacerait par
   quelque chose de moins utile.
*/
const DU_DOMAINE = [
  'Ce fichier n’est pas une sauvegarde Cyclades.',
  'Session verrouillée.',
  'Pli de version 99, inconnue de cette installation.',
];
const abimes = DU_DOMAINE.filter((m) => messageDUneErreur(new Error(m)) !== m);
v('les messages écrits pour être lus ressortent mot pour mot', abimes, []);

console.log('\nLES CAS VIDES');

v(
  'une Error sans message ne rend pas une phrase vide',
  messageDUneErreur(new Error('')).length > 40,
  true,
);
v('une valeur jetée qui n’est pas une erreur est encaissée', typeof messageDUneErreur(null), 'string');
v('y compris une chaîne nue', messageDUneErreur('oups'), 'oups');

console.log('\nLA TABLE ELLE-MÊME');

/*
   Les règles de typographie du site valent pour ces phrases comme pour le
   reste : apostrophe courbe, et jamais de « (s) ». Elles sont vérifiées ici
   parce qu’elles vivent dans un .ts et non dans un gabarit, là où
   essais:typographie regarde.
*/
const toutes = [...NOMS_ATTENDUS.map((n) => messageDUneErreur(new DOMException(BRUT, n))), inconnue];
v('aucune apostrophe droite', toutes.filter((p) => p.includes("'")), []);
v('aucun « (s) »', toutes.filter((p) => /\(s\)/.test(p)), []);
v('chacune se termine par un point', toutes.filter((p) => !p.trim().endsWith('.')), []);

console.log(
  echecs === 0 ? '\n\u001b[32m✓ tout passe\u001b[0m' : `\n\u001b[31m✗ ${echecs} contrôle(s) en échec\u001b[0m`.replace('(s)', 's'),
);
process.exit(echecs === 0 ? 0 : 1);
