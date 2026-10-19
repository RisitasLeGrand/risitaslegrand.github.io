/**
 * Des fiches audio plaisantes, qui aident à mémoriser (prompt 55).
 *
 *   npm run essais:fiches-audio
 *
 * ## Ce que cet essai constate, et en trois temps
 *
 * **1. Les règles d'écriture**, sur les « avant / après » de l'audit. Chaque
 * proposition de N°1 à N°12 y a au moins un cas, écrit comme l'audit l'écrit,
 * et l'on vérifie que la sortie est bien l'« après ». Un cas « avant » qui
 * passerait déjà ne prouverait rien : les cas sont donc pris là où la mesure
 * sur les fiches réelles avait montré un défaut.
 *
 * **2. Ce qui ne doit jamais arriver.** Le script est produit deux fois de
 * suite et doit être identique. Aucune phrase de plan, de récapitulatif ou de
 * question ne doit contenir un mot qui ne vienne pas de la fiche ou de ses
 * cartes. Le marqueur de silence ne doit jamais être prononçable. Il ne doit
 * y avoir qu'une seule hausse de `VERSION_SCRIPT`.
 *
 * **3. Le son lui-même**, mesuré à l'oreille de ffmpeg et non raisonné : la
 * sonie à −16 LUFS, la pause de partie à 1,4 s, et les repères du prompt 46
 * toujours justes à 0,1 s près malgré les paragraphes que N°3 intercale.
 *
 * La voix est remplacée par une voix de laboratoire — le modèle Kokoro pèse
 * 325 Mo et n'est pas dans le dépôt. Tout le reste est le code livré : le
 * découpage en paragraphes, les silences, le cumul des échantillons,
 * l'encodage et son filtre de sonie. C'est ce code-là qu'on éprouve ; la
 * qualité de la diction n'entre pas dans la mesure d'une pause.
 *
 * ## Ce qu'il ne touche pas
 *
 * Il travaille dans un dossier temporaire et n'écrit rien dans `content/`.
 * Le contenu réel n'est ni lu ni régénéré.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ecrireScript,
  fuitesDuScript,
  MOTIFS_DE_FUITE,
  parler,
  SIGLES_FISCAUX,
  SILENCE_QUESTION_MS,
  VERSION_SCRIPT,
} from './lib/podcast.mjs';
import config from '../site.config.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let rouges = 0;
const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;

function verifier(quoi: string, vrai: boolean, detail = '') {
  if (vrai) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    rouges += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   1. LES RÈGLES D'ÉCRITURE — les « avant / après » de l'audit
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nN°7 — LA PRONONCIATION, ET LES SIGLES FISCAUX');

verifier(
  'un article du LPF perd son point : « L. 169 » se dit « L 169 »',
  parler('aux articles L. 169 et L. 176') === 'aux articles L 169 et L 176',
  parler('aux articles L. 169 et L. 176'),
);
verifier(
  '« N+3 » se dit « N plus 3 »',
  parler("l'exercice N+3") === "l'exercice N plus 3",
  parler("l'exercice N+3"),
);
verifier(
  '« Partie 2 » se dit « Partie deux »',
  parler('Partie 2 : le contrôle') === 'Partie deux : le contrôle',
  parler('Partie 2 : le contrôle'),
);
/*
   Et SEULEMENT après un mot qui désigne un morceau de cours : « article 55 »
   doit rester « article 55 », que la synthèse dit très bien, et une date
   encore plus.
*/
verifier(
  'mais « article 55 » reste « article 55 »',
  parler('article 55 de la Constitution') === 'article 55 de la Constitution',
  parler('article 55 de la Constitution'),
);
verifier(
  'et une date n’est pas mise en lettres',
  parler('la révision de 1958') === 'la révision de 1958',
  parler('la révision de 1958'),
);

verifier(
  'la table des sigles est close, et c’est celle du prompt',
  [...SIGLES_FISCAUX.keys()].join(',') === 'IR,IS,TVA,CGI,LPF,CE,QPC',
  [...SIGLES_FISCAUX.keys()].join(','),
);
/* Décision 5 : en entier la première fois, épelé ensuite. */
const scriptSigles = ecrireScript({
  titre: 'Les impositions',
  matiere: 'Finances publiques',
  fascicule: 'F1',
  cours: `### I. Le cadre {#i-cadre}

Le calcul de l'IR suit un barème. L'IR est progressif, et l'IR se déclare.
`,
  glossaire: [],
  flashcards: [],
})!;
const ditSigles = scriptSigles.paragraphes.join(' ');
verifier(
  'la première occurrence d’un sigle est dite en entier, puis épelée',
  ditSigles.includes("l'impôt sur le revenu, l'I.R."),
  ditSigles.slice(0, 160),
);
verifier(
  'les occurrences suivantes sont seulement épelées',
  (ditSigles.match(/I\.R\./g) ?? []).length >= 3 &&
    (ditSigles.match(/impôt sur le revenu/g) ?? []).length === 1,
  `entier ×${(ditSigles.match(/impôt sur le revenu/g) ?? []).length}, épelé ×${(ditSigles.match(/I\.R\./g) ?? []).length}`,
);
/*
   DGFiP, IFiP, LOLF et OMS restent lus comme aujourd'hui : le prompt les
   nomme, et les épeler les rendrait moins clairs, non plus.
*/
verifier(
  'DGFiP, LOLF et OMS ne sont pas touchés',
  parler('La DGFiP applique la LOLF, et l’OMS alerte.') ===
    'La DGFiP applique la LOLF, et l’OMS alerte.',
  parler('La DGFiP applique la LOLF, et l’OMS alerte.'),
);

console.log('\nN°10 — LES PARENTHÈSES DEVIENNENT DES INCISES, SANS COUPURE');

const avecParenthese = ecrireScript({
  titre: 'Le contrôle',
  matiere: 'Droit public',
  fascicule: 'F1',
  cours: `### I. Le juge {#i-juge}

Le juge ordinaire l'a admis (Jacques Vabre, 1975 pour la Cour de cassation ; Nicolo, 1989 pour le Conseil d'État) et la règle a tenu.
`,
  glossaire: [],
  flashcards: [],
})!;
const ditParenthese = avecParenthese.paragraphes.join(' ');
verifier(
  'plus aucune parenthèse dans le texte dit',
  !/[()]/.test(ditParenthese),
  ditParenthese.slice(0, 120),
);
/*
   LE DÉFAUT MESURÉ SUR UNE FICHE RÉELLE. Le point-virgule interne devenait
   un POINT, et l'on entendait « …pour la Cour de cassation. Nicolo, 1989… » :
   une chute de voix en plein milieu d'une incise, donc une phrase qui semble
   finie et ne l'est pas.
*/
verifier(
  'et aucune coupure de phrase à l’intérieur de l’incise',
  !/cassation\.\s*Nicolo/.test(ditParenthese),
  ditParenthese.slice(0, 200),
);
verifier(
  'aucune virgule ne traîne contre un point',
  !/,\s*\./.test(ditParenthese),
  ditParenthese.slice(0, 200),
);

console.log('\nN°11 — UNE ÉNUMÉRATION LONGUE SE COUPE APRÈS LES DEUX-POINTS');

const longue = ecrireScript({
  titre: 'Le bloc',
  matiere: 'Droit public',
  fascicule: 'F1',
  cours: `### I. Le sommet {#i-sommet}

Au sommet figure le bloc de constitutionnalité, dont la composition a été progressivement élargie par le Conseil constitutionnel : Constitution du 4 octobre 1958, Déclaration des droits de l'homme et du citoyen de 1789, Préambule de 1946, Charte de l'environnement depuis 2005.
`,
  glossaire: [],
  flashcards: [],
})!;
verifier(
  'l’annonce et l’énumération font deux phrases',
  longue.paragraphes.some((p) => /Conseil constitutionnel\.\s+Constitution du 4/.test(p)),
  longue.paragraphes.find((p) => p.includes('Conseil constitutionnel'))?.slice(0, 150) ?? '',
);

console.log('\nN°5 — LES LISTES DISENT LEUR NOMBRE AU-DELÀ DE QUATRE');

const cinqPoints = ecrireScript({
  titre: 'Les limites',
  matiere: 'Droit public',
  fascicule: 'F1',
  cours: `### I. Les limites {#i-limites}

- la première limite
- la deuxième limite
- la troisième limite
- la quatrième limite
- la cinquième limite
`,
  glossaire: [],
  flashcards: [],
})!;
verifier(
  'cinq éléments : le nombre est annoncé',
  cinqPoints.paragraphes.some((p) => /Cinq points, dans l’ordre\./.test(p)),
  cinqPoints.paragraphes.join(' | ').slice(0, 160),
);
const troisPoints = ecrireScript({
  titre: 'Les limites',
  matiere: 'Droit public',
  fascicule: 'F1',
  cours: `### I. Les limites {#i-limites}

- la première limite
- la deuxième limite
- la troisième limite
`,
  glossaire: [],
  flashcards: [],
})!;
verifier(
  'trois éléments : on se tait, le compte n’apprend rien',
  !troisPoints.paragraphes.some((p) => /points, dans l’ordre/.test(p)),
);
verifier(
  'un renvoi « ci-dessus » est réécrit, sans avaler son article',
  parler('La liste ci-dessous récapitule.') === 'La liste qui suit récapitule.',
  parler('La liste ci-dessous récapitule.'),
);

console.log('\nN°6 — LES RELANCES, ET LE « \\b » QUI NE MARCHAIT PAS');

/*
   LE DÉFAUT MESURÉ. « /\b(par|à|avec|dans)$/ » : en JavaScript sans le
   drapeau `u`, « \b » est une limite de mot ASCII et « à » n'en est pas un
   caractère. Le motif ne correspondait donc JAMAIS, et l'amorce la plus
   fréquente de sa famille produisait « Venons-en maintenant à : une crise
   qui recompose… » dans des fiches réelles.
*/
const relances = ecrireScript({
  titre: 'La crise',
  matiere: 'Questions internationales',
  fascicule: 'F3',
  cours: `### I. Le cadre ancien {#i-cadre}

Du texte.

### II. Une crise qui recompose les rapports {#ii-crise}

Du texte.

### III. Vers une refondation {#iii-refondation}

Du texte.
`,
  glossaire: [],
  flashcards: [],
})!;
verifier(
  'aucune préposition suivie de deux-points',
  !/\b(?:à|par|avec|dans)\s*:/.test(relances.paragraphes.join(' ')),
  relances.paragraphes.filter((p) => /:/.test(p)).join(' | ').slice(0, 180),
);

console.log('\nN°2 — LE PLAN À L’OUVERTURE, LE RANG À CHAQUE PARTIE (décision 2)');

verifier(
  'le rang est dit sous la forme de la décision 2',
  relances.paragraphes.some((p) => /Deuxième partie,? sur trois/.test(p)),
  relances.paragraphes.filter((p) => /partie/.test(p)).join(' | ').slice(0, 200),
);
verifier(
  'la première partie ne dit pas « on passe à »',
  !relances.paragraphes.some((p) => /On passe à la première/.test(p)),
);
verifier(
  'la pause de partie est réglée à 1 400 ms',
  config.podcast.silencePartieMs === 1400,
  String(config.podcast.silencePartieMs),
);

console.log('\nN°3 — RÉCAPITULATIF ET QUESTION DE RAPPEL (décision 1)');

const coursRappel = `### I. Le premier point {#i-un}

Un paragraphe sur le premier point.

> La règle : tout acte doit être conforme.

### II. Le second point {#ii-deux}

Du texte sur le second point.
`;
const avecCartes = ecrireScript({
  titre: 'Essai',
  matiere: 'Droit',
  fascicule: 'F1',
  cours: coursRappel,
  glossaire: [],
  flashcards: [
    { partie: 'i-un', question: 'Quelle est la règle ?', reponse: 'Tout acte doit être conforme.' },
    /* Trop longue pour l'oreille : elle doit être OMISE, pas tronquée. */
    { partie: 'ii-deux', question: `Et ceci ? ${'mot '.repeat(40)}`, reponse: 'Une réponse.' },
  ],
})!;
verifier(
  'un récapitulatif reprend le titre de la partie et son exergue',
  avecCartes.paragraphes.some(
    (p) => p.startsWith('Récapitulatif : le premier point.') && p.includes('tout acte doit être conforme'),
  ),
  avecCartes.paragraphes.find((p) => p.startsWith('Récapitulatif')) ?? '',
);
verifier(
  'la question est posée, puis la réponse',
  avecCartes.paragraphes.some((p) => p.startsWith('Question :')) &&
    avecCartes.paragraphes.some((p) => p.startsWith('Réponse :')),
);
verifier(
  'un silence de 4 s est déclaré avant la réponse',
  avecCartes.silences.length === 1 &&
    avecCartes.silences[0].ms === SILENCE_QUESTION_MS &&
    avecCartes.paragraphes[avecCartes.silences[0].paragraphe].startsWith('Réponse :'),
  JSON.stringify(avecCartes.silences),
);
verifier(
  'une question de plus de trente mots est omise',
  avecCartes.questionsPosees.join() === 'i-un',
  avecCartes.questionsPosees.join(),
);
/* Une partie sans exergue garde un récapitulatif réduit à son titre. */
verifier(
  'une partie sans exergue a un récapitulatif réduit à son titre',
  avecCartes.paragraphes.includes('Récapitulatif : le second point.'),
  avecCartes.paragraphes.filter((p) => p.startsWith('Récapitulatif')).join(' | '),
);

const sansCartes = ecrireScript({
  titre: 'Essai',
  matiere: 'Droit',
  fascicule: 'F1',
  cours: coursRappel,
  glossaire: [],
  flashcards: [],
})!;
verifier(
  'PAS DE CARTE RATTACHÉE, PAS DE QUESTION',
  !sansCartes.paragraphes.some((p) => p.startsWith('Question :')) &&
    sansCartes.silences.length === 0,
  JSON.stringify(sansCartes.questionsPosees),
);
verifier(
  'mais le récapitulatif reste : il ne dépend pas des cartes',
  sansCartes.paragraphes.some((p) => p.startsWith('Récapitulatif :')),
);
/* Une carte rattachée à une partie qui n'existe pas ne crée pas de question. */
verifier(
  'une carte rattachée à une partie absente ne crée aucune question',
  ecrireScript({
    titre: 'Essai',
    matiere: 'Droit',
    fascicule: 'F1',
    cours: coursRappel,
    glossaire: [],
    flashcards: [{ partie: 'xx-absente', question: 'Et ça ?', reponse: 'Non.' }],
  })!.questionsPosees.length === 0,
);

console.log('\nN°1 — LE GLOSSAIRE : ACCENTS RECONNUS, MOTS COURANTS ÉPARGNÉS');

const GLOSSAIRE = [
  { terme: 'hiérarchie des normes', definition: 'Principe d’organisation de l’ordre juridique.' },
  { terme: 'gouvernance', definition: 'Ensemble des règles de pilotage.' },
  { terme: 'contrôle administratif', formes: ['CAS'], definition: 'Procédure de vérification.' },
];
const avecAccents = ecrireScript({
  titre: 'Les normes',
  matiere: 'Droit public',
  fascicule: 'F1',
  cours: `### I. Le sommet {#i-sommet}

La hiérarchie des normes structure l'ordre juridique, et la gouvernance s'y lit.
`,
  glossaire: GLOSSAIRE,
  flashcards: [],
})!;
const ditAccents = avecAccents.paragraphes.join(' ');
/*
   LE DÉFAUT MESURÉ SUR LES FICHES D'EXEMPLE. L'index du glossaire est bâti
   sur des formes DÉSACCENTUÉES et était cherché dans le texte ACCENTUÉ :
   aucun terme accentué n'était donc jamais expliqué, c'est-à-dire la plupart
   d'entre eux. « gouvernance » l'était, « hiérarchie des normes » non.
*/
verifier(
  'un terme ACCENTUÉ est enfin expliqué',
  ditAccents.includes('hiérarchie des normes, c’est le principe'),
  ditAccents.slice(0, 220),
);
verifier(
  'et un terme sans accent l’est toujours',
  ditAccents.includes('gouvernance, c’est l’ensemble'),
  ditAccents.slice(0, 260),
);
/* N°1, second volet : « les cas » ne doit pas déclencher la glose de « CAS ». */
const motCourant = ecrireScript({
  titre: 'Les cas',
  matiere: 'Droit public',
  fascicule: 'F1',
  cours: `### I. Les cas {#i-cas}

Dans bien des cas, la règle vaut, et les cas d'espèce le montrent.
`,
  glossaire: GLOSSAIRE,
  flashcards: [],
})!;
verifier(
  'un mot courant n’est plus pris pour un sigle : « cas » n’est pas « CAS »',
  !motCourant.paragraphes.join(' ').includes('rocédure de vérification'),
  motCourant.paragraphes.join(' | ').slice(0, 200),
);
verifier(
  'mais le sigle écrit en majuscules est bien reconnu',
  ecrireScript({
    titre: 'Le sigle',
    matiere: 'Droit public',
    fascicule: 'F1',
    cours: `### I. Le sigle {#i-sigle}

Le CAS s'applique ici.
`,
    glossaire: GLOSSAIRE,
    flashcards: [],
  })!
    .paragraphes.join(' ')
    .includes('rocédure de vérification'),
);

console.log('\nN°9 — LE GÉNÉRIQUE (décisions 3 et 6)');

/*
   Cinq accueils de quinze mots au plus. Le compte se vérifie sur la phrase
   d'accueil seule, pas sur l'ouverture entière : la matière et l'invitation
   la suivent.
*/
const accueils = new Set<string>();
for (let i = 0; i < 60; i++) {
  const s = ecrireScript({
    titre: `Titre ${i}`,
    matiere: 'Droit public',
    fascicule: `F${i}`,
    cours: `### I. Un point {#i-un}\n\nDu texte.\n`,
    glossaire: [],
    flashcards: [],
  })!;
  accueils.add(s.paragraphes[0].split(/(?<=[.!?])\s/)[0]);
}
verifier(
  'cinq accueils différents au moins',
  accueils.size >= 5,
  `${accueils.size} formes`,
);
verifier(
  'chacun fait quinze mots au plus',
  [...accueils].every((a) => a.split(/\s+/).filter(Boolean).length <= 15),
  [...accueils].map((a) => `${a.split(/\s+/).length}`).join(' '),
);
/* DÉCISION 6 : la formule « sans rien noter » est remplacée. */
const ouvertures = new Set<string>();
for (let i = 0; i < 60; i++) {
  const s = ecrireScript({
    titre: `Titre ${i}`,
    matiere: 'Droit public',
    fascicule: `F${i}`,
    cours: `### I. Un point {#i-un}\n\nDu texte.\n`,
    glossaire: [],
    flashcards: [],
  })!;
  ouvertures.add(s.paragraphes[0]);
}
verifier(
  '« sans rien noter » a disparu de toutes les ouvertures',
  ![...ouvertures].some((o) => /sans rien noter|sans crayon/.test(o)),
);
verifier(
  'et la formule qui la remplace vaut à chaque écoute',
  [...ouvertures].every((o) => /Laissez-vous porter/.test(o)),
);

console.log('\nN°12 — LE CONTENU QUE L’AUDIO NE PEUT PAS LIRE (décision 7)');

const avecSchemas = ecrireScript({
  titre: 'Le circuit',
  matiere: 'Finances publiques',
  fascicule: 'F1',
  cours: `### I. Le premier {#i-un}

Du texte.

![Un schéma du circuit](schema.png)

Encore du texte.

### II. Le second {#ii-deux}

![Un second schéma](autre.png)

Du texte.
`,
  glossaire: [],
  flashcards: [],
})!;
verifier(
  'la phrase du schéma est dite',
  avecSchemas.paragraphes.some((p) => p.includes('un schéma : vous le retrouverez à l’écran')),
  avecSchemas.paragraphes.join(' | ').slice(0, 200),
);
verifier(
  'UNE SEULE FOIS, même avec deux schémas',
  avecSchemas.paragraphes.filter((p) => p.includes('vous le retrouverez à l’écran')).length === 1,
);
verifier(
  'une fiche sans image ne dit rien d’un schéma',
  !troisPoints.paragraphes.some((p) => p.includes('schéma')),
);

/* ══════════════════════════════════════════════════════════════════════════
   2. CE QUI NE DOIT JAMAIS ARRIVER
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE SCRIPT RESTE DÉTERMINISTE');

const entree = {
  titre: 'Essai',
  matiere: 'Droit',
  fascicule: 'F1',
  cours: coursRappel,
  glossaire: GLOSSAIRE,
  flashcards: [
    { partie: 'i-un', question: 'Quelle est la règle ?', reponse: 'Tout acte doit être conforme.' },
  ],
};
const premier = ecrireScript(entree)!;
const second = ecrireScript(entree)!;
verifier(
  'deux productions de suite donnent le même script',
  JSON.stringify(premier) === JSON.stringify(second),
);

console.log('\nLE MARQUEUR DE SILENCE N’EST JAMAIS PRONONÇABLE');

/*
   LE POINT DE MÉTHODE. Le prompt propose un marqueur dans le texte, « par
   exemple [[silence 4000]] ». Le garde-fou anti-fuite du prompt 43 refuse
   déjà les crochets doubles — et il a raison, puisque tout ce qui reste
   dans le texte sera PRONONCÉ. Le silence est donc déclaré à part, par rang
   de paragraphe : il ne peut pas être dit, parce qu'il n'est jamais un mot.

   L'essai le vérifie des deux côtés : aucun chiffre de silence dans le
   texte, et la table anti-fuite intacte — aucune exception n'y a été
   percée pour les crochets doubles.
*/
verifier(
  'aucun marqueur de silence dans le texte dit',
  !avecCartes.paragraphes.some((p) => /\[\[|silence\s*\d/i.test(p)),
  avecCartes.paragraphes.filter((p) => /silence/i.test(p)).join(' | '),
);
verifier(
  'le silence vit dans une déclaration à part, par rang de paragraphe',
  avecCartes.silences.every(
    (s) => typeof s.paragraphe === 'number' && typeof s.ms === 'number',
  ) && avecCartes.silences.length > 0,
);
verifier(
  'et la table anti-fuite refuse toujours les crochets doubles',
  MOTIFS_DE_FUITE.some((m) => m.motif.test('[[silence 4000]]')),
);
verifier(
  'aucune fuite technique dans aucun des scripts de cet essai',
  [premier, avecCartes, avecSchemas, relances, longue, ditSigles ? scriptSigles : scriptSigles]
    .flatMap((s) => fuitesDuScript(s.paragraphes))
    .length === 0,
);

console.log('\nRIEN N’EST INVENTÉ (interdit 1)');

/*
   Chaque mot « de fond » d'un récapitulatif ou d'une question doit se
   retrouver dans la fiche ou dans ses cartes. On écarte les mots de liaison
   et les mots du gabarit — « récapitulatif », « question », « réponse » —,
   qui sont la forme et non le fond.
*/
const GABARIT = new Set([
  'récapitulatif', 'question', 'réponse', 'partie', 'sur', 'de', 'du', 'des', 'la', 'le',
  'les', 'et', 'en', 'un', 'une', 'dans', 'à', 'au', 'aux', 'ce', 'qui', 'que', 'est',
  'doit', 'être', 'il', 'elle', 'on', 'premier', 'second', 'deuxième', 'première',
  'troisième', 'trois', 'deux', 'points', 'ordre', 'dit', "d'", 'pour', 'avec', 'par',
]);
const sourceAutorisee = `${coursRappel} Quelle est la règle ? Tout acte doit être conforme.`.toLowerCase();
const motsInventes = avecCartes.paragraphes
  .filter((p) => /^(Récapitulatif|Question|Réponse)\s*:/.test(p))
  .flatMap((p) => p.toLowerCase().split(/[^a-zà-ÿ’']+/))
  .filter(Boolean)
  .filter((m) => m.length > 3 && !GABARIT.has(m) && !sourceAutorisee.includes(m));
verifier(
  'aucun mot de fond inventé dans un récapitulatif ou une question',
  motsInventes.length === 0,
  motsInventes.join(' '),
);

console.log('\nUNE SEULE HAUSSE DE VERSION_SCRIPT');

/*
   Le 46 (P2) avait porté la version à 5. Le prompt 55 n'a droit qu'à UNE
   hausse pour ses douze règles — son interdit 3. Elle vaut donc 6, et le
   jour où quelqu'un la pousse à 7 sans demander, cet essai rougit.
*/
verifier(
  'la version du réécriveur vaut 6 : une seule hausse au-dessus du 46',
  VERSION_SCRIPT === 6,
  String(VERSION_SCRIPT),
);
verifier(
  'et une seule déclaration de cette version dans le code',
  (readFileSync(path.join(racine, 'scripts', 'lib', 'podcast.mjs'), 'utf8').match(
    /VERSION_SCRIPT\s*=\s*\d+/g,
  ) ?? []).length === 1,
);
verifier(
  'la sonie est réglée à −16 LUFS, et elle entre dans l’empreinte',
  config.podcast.sonie === -16 &&
    readFileSync(path.join(racine, 'scripts', 'podcasts.mjs'), 'utf8').includes(
      'config.podcast.sonie',
    ),
  String(config.podcast.sonie),
);

/* ══════════════════════════════════════════════════════════════════════════
   3. LE SON LUI-MÊME
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE SON MESURÉ — sonie, pause de partie, repères');

const atelier = mkdtempSync(path.join(tmpdir(), 'cyclades-55-'));
try {
  /*
     LA VOIX DE LABORATOIRE. Elle émet, pour chaque paragraphe, une seconde
     de ton pur — de quoi mesurer une sonie et retrouver le bord d'un
     silence. Tout le reste est le code livré : le découpage, les silences,
     le cumul des échantillons, l'encodage et son filtre de sonie.
  */
  const fausseVoix = `
import sys, types, math
faux = types.ModuleType("onnxruntime")
class _O:
    def __init__(self):
        self.intra_op_num_threads = 1
        self.inter_op_num_threads = 1
faux.SessionOptions = _O
faux.InferenceSession = object
sys.modules["onnxruntime"] = faux

sys.path.insert(0, ${JSON.stringify(path.join(racine, 'scripts'))})
import importlib.util
spec = importlib.util.spec_from_file_location("sv", ${JSON.stringify(path.join(racine, 'scripts', 'synthese-voix.py'))})
sv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sv)

TAUX = 24000
class VoixDEssai:
    taux = TAUX
    def phrases(self, paragraphe):
        # Une seconde de ton pur par paragraphe, à amplitude connue.
        n = TAUX
        ech = bytearray()
        for i in range(n):
            v = int(12000 * math.sin(2 * math.pi * 220 * i / TAUX))
            ech += int(v).to_bytes(2, "little", signed=True)
        yield bytes(ech)

class Args:
    silence_paragraphe = ${config.podcast.silenceParagrapheMs}
    silence_phrase = ${config.podcast.silencePhraseMs}
    silence_partie = ${config.podcast.silencePartieMs}
    sonie = ${config.podcast.sonie}

paragraphes = ["un", "deux", "trois", "quatre"]
# La partie commence au paragraphe 2 ; un silence déclaré de 4 s avant le 3.
parties = [{"id": "p", "paragraphe": 2}]
silences = {3: 4000.0}
brut, reperes = sv.synthetiser(VoixDEssai(), paragraphes, Args(), parties, silences)
sv.encoder("ffmpeg", brut, TAUX, ${JSON.stringify(path.join(atelier, 'essai.opus'))}, "16k", "opus", Args.sonie)
import json
print(json.dumps({"reperes": reperes, "echantillons": len(brut) // 2, "taux": TAUX}))
`;
  const chemin = path.join(atelier, 'voix.py');
  writeFileSync(chemin, fausseVoix);
  const sortie = execFileSync('python3', ['-I', '-B', chemin], { encoding: 'utf8', cwd: atelier });
  const mesure = JSON.parse(sortie.trim().split('\n').pop()!);

  /*
     La pause de partie se calcule sur les échantillons : quatre paragraphes
     d'une seconde, une respiration ordinaire, une pause de partie, un
     silence déclaré de quatre secondes.
  */
  const attendu =
    4 +
    config.podcast.silenceParagrapheMs / 1000 +
    config.podcast.silencePartieMs / 1000 +
    4;
  const duree = mesure.echantillons / mesure.taux;
  verifier(
    'la pause de partie mesurée vaut 1,4 s',
    Math.abs(duree - attendu) < 0.05,
    `durée ${duree.toFixed(3)} s, attendue ${attendu.toFixed(3)} s`,
  );
  /*
     LE REPÈRE DE PARTIE, à 0,1 s près (interdit 5). Il tombe après la
     respiration qui précède la partie : 2 paragraphes d'une seconde, plus
     une respiration ordinaire, plus la pause de partie.
     Et la pause de partie compte DANS le repère — c'est ce que l'interdit
     appelle « pause de partie comprise ».
  */
  const repereAttendu = 2 + config.podcast.silenceParagrapheMs / 1000 + config.podcast.silencePartieMs / 1000;
  verifier(
    'le repère de partie reste juste à 0,1 s près, pause de partie comprise',
    Math.abs(mesure.reperes[0].debut - repereAttendu) <= 0.1,
    `repère ${mesure.reperes[0].debut} s, attendu ${repereAttendu.toFixed(2)} s`,
  );

  /* La sonie, mesurée par ffmpeg sur le fichier encodé. */
  /*
     `loudnorm` écrit son rapport sur la sortie d'ERREUR, et ffmpeg rend 0 :
     il n'y a donc pas d'exception à rattraper, et c'est stderr qu'il faut
     lire. La première version de cet essai ne lisait stderr que dans un
     `catch` qui ne se déclenchait jamais, et concluait « la sonie n'a pas pu
     être mesurée » sur un fichier parfaitement mesurable.

     `input_i` est la sonie du fichier TEL QU'IL EST — c'est-à-dire après que
     la chaîne de production lui a appliqué son filtre. C'est bien ce qu'on
     veut vérifier : ce que l'oreille recevra.
  */
  let mesuree: number | null = null;
  /*
     `2>&1` n'est pas une facilité : `execFileSync` rend la sortie STANDARD,
     et ffmpeg écrit tout son rapport — dont le JSON de `loudnorm` — sur la
     sortie d'ERREUR, en rendant 0. Sans la fusion, on lit une chaîne vide et
     l'on conclut que la sonie n'est pas mesurable sur un fichier qui l'est
     parfaitement. C'est ce qu'a fait la première version de cet essai.
  */
  const journal = execFileSync(
    'sh',
    [
      '-c',
      `ffmpeg -i ${JSON.stringify(path.join(atelier, 'essai.opus'))} ` +
        '-af loudnorm=print_format=json -f null - 2>&1',
    ],
    { encoding: 'utf8' },
  );
  const trouve = /"input_i"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/.exec(journal);
  if (trouve) mesuree = Number(trouve[1]);
  if (mesuree === null) {
    console.log(`  ${rouge('✗')} la sonie n’a pas pu être mesurée`);
    rouges += 1;
  } else {
    verifier(
      'la sonie du fichier encodé est de −16 LUFS (± 1)',
      Math.abs(mesuree - config.podcast.sonie) <= 1,
      `${mesuree} LUFS`,
    );
  }
} finally {
  rmSync(atelier, { recursive: true, force: true });
}

console.log(
  rouges === 0
    ? `\n${vert('Tout est vert.')}`
    : `\n${rouge(`${rouges} rouge${rouges > 1 ? 's' : ''}.`)}`,
);
process.exit(rouges === 0 ? 0 : 1);
