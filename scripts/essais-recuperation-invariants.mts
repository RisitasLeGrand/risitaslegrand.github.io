/**
 * LES INVARIANTS DE LA RÉCUPÉRATION DU CORPUS, sans rien construire.
 *
 *   npm run essais:recuperation-invariants
 *
 * ## Pourquoi ces vérifications vivent à part
 *
 * `essais:recuperation-corpus` fait l'aller-retour complet : il construit un
 * corpus, le récupère, le reconstruit, et compare les deux publications. C'est
 * la mesure qui tranche, et elle demande un laboratoire — un `content/` à
 * elle, qu'elle refuse de créer si un autre essai en a déjà un.
 *
 * Cette garde est juste pour tout ce qui construit. Elle est fausse pour ce
 * qui ne construit rien : les deux défauts les plus graves de l'outil de
 * récupération se voient en mémoire, en moins d'une seconde, et n'ont aucune
 * raison d'être sautés parce qu'un essai de laboratoire tourne à côté.
 *
 * Ils sont donc ici, dans un essai qui ne touche ni au disque, ni au réseau,
 * ni à `content/`, et qui peut entrer au socle.
 *
 * ## Les deux défauts que ces lignes tiennent
 *
 * **Le YAML imbriqué.** L'écriture faite à la main rendait
 * `correction.par_option` — une liste d'objets — par la chaîne
 * « [object Object] », et le build refusait le corpus récupéré EN BLOC. Le
 * défaut est passé parce que l'aller-retour ne portait que sur
 * `content-exemple/`, dont les trois fiches n'ont aucune `correction`. Un
 * corpus d'exemple est un échantillon, pas une garantie.
 *
 * **L'empreinte rapide.** La recherche de chemin éprouve des millions de
 * candidats et emploie `node:crypto` au lieu de `crypto.subtle`. Si les deux
 * divergeaient d'un bit, elle chercherait la mauvaise empreinte et ne
 * trouverait plus rien — en silence, sans erreur, en rendant simplement
 * « chemin non certifié » pour les 427 fiches.
 */
import path from 'node:path';

import YAML from 'yaml';

import { idStable } from './lib/crypto.mjs';
import { estDansLeDepot } from './lib/fichier-de-secret.mjs';
import { empreinteRapide } from './lib/chemin-de-fiche.mjs';
import { blocYaml, frontMatter, questionEnSource } from './lib/fiche-en-source.mjs';
import { frontMatterSchema, idsPubliesEnDouble, quizSchema } from './lib/schema.mjs';

let rouges = 0;
const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;
const jaune = (t: string) => `\x1b[33m${t}\x1b[0m`;

function verifier(quoi: string, vrai: boolean, detail = '') {
  if (vrai) {
    console.log(`${vert('✓')} ${quoi}${detail ? ` ${jaune(detail)}` : ''}`);
    return;
  }
  console.log(`${rouge('✗')} ${quoi}${detail ? `\n    ${detail}` : ''}`);
  rouges += 1;
}

console.log('\nLES INVARIANTS DE LA RÉCUPÉRATION');


/*
   L'EMPREINTE RAPIDE DOIT ÊTRE L'EMPREINTE DU DÉPÔT.

   La recherche de chemin éprouve des millions de candidats et ne peut pas
   attendre une promesse par candidat : elle emploie `node:crypto` au lieu de
   `crypto.subtle`. Si les deux divergeaient d'un bit, la recherche
   chercherait la mauvaise empreinte et ne trouverait plus RIEN — en silence,
   sans erreur, en rendant simplement « chemin non certifié » pour les 427
   fiches. Cette ligne est ce qui interdit à l'optimisation de dériver.
*/
for (const texte of [
  'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.md',
  'questions-européennes/fascicule-3/fiche-12-é-à-ü-œ.md',
  '',
]) {
  verifier(
    `« empreinteRapide » = « idStable » pour ${JSON.stringify(texte.slice(0, 40))}`,
    empreinteRapide(texte) === (await idStable(texte)),
  );
}

/*
   UNE CORRECTION IMBRIQUÉE DOIT SURVIVRE À L'ÉCRITURE EN SOURCE.

   C'est le défaut qui a fait refuser le corpus réel en bloc : le YAML écrit à
   la main rendait `par_option` — une liste d'objets — par la chaîne
   « [object Object] », et le build répondait « expected array, received
   string » sur des centaines de fiches. Les trois fiches de
   « content-exemple » n'ont AUCUNE correction : l'aller-retour ne pouvait pas
   le voir, et un corpus d'exemple est un échantillon, pas une garantie.

   On éprouve donc la structure complète ici, contre le schéma du dépôt
   lui-même, sans dépendre de ce que l'exemple contient.
*/
const CORRECTION_COMPLETE = {
  resume: 'Un résumé qui tient en une phrase.',
  par_option: [
    { verdict: 'juste', pourquoi: 'parce que oui' },
    { verdict: 'faux', pourquoi: "parce que non, avec une apostrophe" },
  ],
  detail: 'Un détail plus long, sur plusieurs idées.',
  rappel_de_cours: ['droit-public/fascicule-1/fiche-01-hierarchie-des-normes'],
  sources: [{ nom: 'Une source', url: 'https://example.org/a' }],
  confiance: 'haute',
  visuel: { type: 'aucun', raison_aucun: 'aucun dessin n’aiderait ici' },
};

const questionEcrite = blocYaml([
  questionEnSource({
    question: 'Une question à deux options ?',
    options: ['oui', 'non'],
    bonnes: [0],
    explication: 'Une explication.',
    correction: CORRECTION_COMPLETE,
  }),
]);
verifier(
  'aucun « [object Object] » dans le YAML écrit',
  !questionEcrite.includes('[object Object]'),
  questionEcrite.includes('[object Object]') ? questionEcrite.slice(0, 200) : undefined,
);

const relu = YAML.parse(questionEcrite) as unknown[];
const valide = quizSchema.safeParse(relu[0]);
verifier(
  'le schéma du dépôt accepte la question réécrite',
  valide.success,
  valide.success ? undefined : JSON.stringify(valide.error.issues.slice(0, 3)),
);
if (valide.success) {
  verifier(
    'et « correction » revient structure pour structure',
    JSON.stringify(valide.data.correction) === JSON.stringify(CORRECTION_COMPLETE),
    JSON.stringify(valide.data.correction)?.slice(0, 200),
  );
}

/*
   UN RENVOI « rappel de cours » EST UN CHEMIN DANS LA SOURCE, UN OBJET DANS
   LA PUBLICATION — et le schéma le dit, ce qui justifie de le défaire.
*/
const avecObjet = quizSchema.safeParse({
  question: 'Une question ?',
  options: ['a', 'b'],
  reponse: 0,
  correction: { ...CORRECTION_COMPLETE, rappel_de_cours: [{ id: 'abc', titre: 'Un titre' }] },
});
verifier(
  'le schéma REFUSE un renvoi déjà résolu — défaire la résolution est obligatoire',
  !avecObjet.success,
);

/*
   « id_publie » : LE FILET DES FICHES DONT LE CHEMIN EST PERDU.

   Une cinquantaine de fiches sur 427 n'ont pas pu voir leur chemin certifié.
   Replacées ailleurs, elles recevaient un identifiant neuf — et la
   progression enregistrée pour elles, comme leur fiche audio déjà
   synthétisée, devenait orpheline. Ce champ leur permet de déclarer leur
   identifiant publié.

   Deux fiches sous le même identifiant se confondraient à l'écran et leur
   progression se mélangerait : le doublon doit être REFUSÉ, et un format faux
   aussi, sinon le champ devient une manière d'écrire au lieu d'une réparation.
*/
for (const [valeur, attendu] of [
  ['0123456789abcdef', true],
  ['0123456789ABCDEF', false],
  ['abc', false],
  ['0123456789abcdeg', false],
  ['0123456789abcdef0', false],
] as const) {
  const lu = frontMatterSchema.safeParse({
    matiere: 'M',
    fascicule: 'F',
    titre: 'T',
    id_publie: valeur,
  });
  verifier(
    `« id_publie: ${valeur} » est ${attendu ? 'accepté' : 'refusé'}`,
    lu.success === attendu,
  );
}
verifier(
  'une fiche sans « id_publie » reste valable',
  frontMatterSchema.safeParse({ matiere: 'M', fascicule: 'F', titre: 'T' }).success,
);
verifier(
  'deux fiches sous le même « id_publie » sont signalées',
  idsPubliesEnDouble([
    { chemin: 'a.md', id_publie: '0123456789abcdef' },
    { chemin: 'b.md', id_publie: '0123456789abcdef' },
    { chemin: 'c.md' },
  ]).length === 1,
);
verifier(
  'et des identifiants distincts ne le sont pas',
  idsPubliesEnDouble([
    { chemin: 'a.md', id_publie: '0123456789abcdef' },
    { chemin: 'b.md', id_publie: 'fedcba9876543210' },
  ]).length === 0,
);

/* Le champ n'est écrit QUE pour une fiche au chemin incertain : sur une fiche
   certifiée, il serait du bruit — `idStable` redonne déjà le bon identifiant. */
const entete = { matiere: 'M', fascicule: 'F', titre: 'T', ordre: 1, tags: [] };
verifier(
  'le front-matter porte « id_publie » quand on le lui donne',
  frontMatter({ ...entete, idPublie: '0123456789abcdef' }).includes('id_publie: 0123456789abcdef'),
);
verifier(
  'et ne le porte pas sinon',
  !frontMatter(entete).includes('id_publie'),
);

/*
   UN FICHIER DE MOT DE PASSE DANS LE DÉPÔT EST REFUSÉ.

   Les deux outils du corpus acceptent `--mot-de-passe-fichier`, et tous deux
   refusent un chemin situé dans le dépôt : il serait à un « git add . » de
   devenir public, et ce dépôt est public. La règle vit dans
   `lib/fichier-de-secret.mjs` pour que les deux en aient la MÊME, et c'est
   elle qu'on éprouve ici.

   Rien de tout cela ne demande de secret : un chemin suffit, et le fichier
   n'a même pas besoin d'exister. C'est pourquoi ces lignes sont dans cet
   essai-là, qui ne touche ni au disque ni au réseau.

   Le dernier cas est celui qui mord. `startsWith(racine)` sans le séparateur
   refuserait « …/depot-secrets », un dossier voisin parfaitement légitime, et
   ferait chercher une faute qui n'existe pas.
*/
const RACINE_FEINTE = path.resolve('/tmp/depot');
verifier(
  'un fichier À LA RACINE du dépôt est refusé',
  estDansLeDepot(path.join(RACINE_FEINTE, '.secret'), RACINE_FEINTE),
);
verifier(
  'un fichier dans un sous-dossier du dépôt est refusé',
  estDansLeDepot(path.join(RACINE_FEINTE, 'scripts', 'lib', '.secret'), RACINE_FEINTE),
);
verifier('la racine elle-même est refusée', estDansLeDepot(RACINE_FEINTE, RACINE_FEINTE));
verifier(
  'un « ../ » qui sort puis rentre est refusé',
  estDansLeDepot(path.join(RACINE_FEINTE, '..', 'depot', '.secret'), RACINE_FEINTE),
);
verifier(
  'un fichier hors du dépôt est accepté',
  !estDansLeDepot('/tmp/ailleurs/.secret', RACINE_FEINTE),
);
verifier(
  'et un dossier VOISIN dont le nom commence pareil est accepté',
  !estDansLeDepot('/tmp/depot-secrets/.secret', RACINE_FEINTE),
);

console.log(
  rouges === 0
    ? `\n${vert('Tous les invariants tiennent.')}\n`
    : `\n${rouge(`${rouges} échec(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
