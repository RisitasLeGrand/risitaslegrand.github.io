/**
 * Les séances par partie (prompt 46, P5).
 *
 *   npm run essais:seances-parties
 *
 * ## Ce que cet essai constate
 *
 * P5 tient sur quatre promesses, et trois d'entre elles sont des promesses de
 * **compatibilité** — c'est-à-dire exactement le genre de chose qu'on croit
 * tenue jusqu'au jour où l'on ouvre une vieille séance :
 *
 * 1. « Toute la fiche » reste le choix par défaut, et ne restreint rien ;
 * 2. une séance ancienne, sans champ `parties`, vaut pour la fiche entière —
 *    et continue donc de nourrir les rappels comme avant ;
 * 3. une carte sans `partie` fonctionne comme aujourd'hui ;
 * 4. une partie trop pauvre en cartes est complétée depuis la fiche, et
 *    l'écran le DIT.
 *
 * L'essai éprouve aussi l'interdit 3 du prompt, qui ne se voit pas dans ces
 * règles mais qui les gouverne : réviser une partie ne crée ni copie de carte
 * ni second état. C'est pour cela que la restriction rend les cartes
 * **elles-mêmes**, par identité d'objet, et non des copies — une copie serait
 * la première marche vers un second état FSRS.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne monte aucun navigateur et ne construit aucun site : il n'éprouve que
 * des règles. Ce que l'écran en fait — les cases à cocher sous une fiche, le
 * libellé du complément, le suivi des parties vues — est l'affaire de
 * l'essai de navigateur des séances.
 */
import {
  analyserParties,
  dureeEstimeeDeLaPartie,
  direLeCiblage,
  encoderParties,
  partiesAProposer,
  partiesDeLaFiche,
  restreindreAuxParties,
  SEUIL_CARTES,
  SEUIL_QUESTIONS,
  suiviDesParties,
  type SeanceLue,
} from '../src/lib/seance-parties';

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
   L'aller-retour par l'adresse
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE COUPLE (FICHE, PARTIE) PASSE PAR UNE ADRESSE SANS S’ABÎMER');

const COUPLES = [
  { fiche: 'abc123', partie: 'i-le-bloc-de-legalite' },
  { fiche: 'abc123', partie: 'ii-le-controle' },
  { fiche: 'def456', partie: 'i-le-bloc-de-legalite' },
];
verifier(
  'ce qui est encodé se relit à l’identique',
  JSON.stringify(analyserParties(encoderParties(COUPLES))) === JSON.stringify(COUPLES),
  encoderParties(COUPLES),
);
/*
   Le point qui justifie que la fiche soit dans le couple : les identifiants
   de partie viennent des ancres, donc « i-le-bloc-de-legalite » existe dans
   deux fiches différentes ici, et doit rester distinct.
*/
verifier(
  'deux fiches peuvent porter une partie de même identifiant',
  partiesDeLaFiche(COUPLES, 'abc123').size === 2 && partiesDeLaFiche(COUPLES, 'def456').size === 1,
);
verifier('aucune partie pour une fiche absente', partiesDeLaFiche(COUPLES, 'zzz').size === 0);
verifier('une adresse vide ne donne aucune partie', analyserParties('').length === 0);
verifier('une adresse absente non plus', analyserParties(null).length === 0);
verifier(
  'un morceau mal formé est ignoré, la page ne tombe pas',
  JSON.stringify(analyserParties('nimportequoi,abc:i-un,:x,y:')) ===
    JSON.stringify([{ fiche: 'abc', partie: 'i-un' }]),
  JSON.stringify(analyserParties('nimportequoi,abc:i-un,:x,y:')),
);
/* Un identifiant contenant un « : » doit survivre : on coupe au DERNIER. */
verifier(
  'un identifiant qui contient un deux-points survit',
  JSON.stringify(analyserParties(encoderParties([{ fiche: 'a:b', partie: 'c' }]))) ===
    JSON.stringify([{ fiche: 'a:b', partie: 'c' }]),
);

/* ══════════════════════════════════════════════════════════════════════════
   Le choix des cartes
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLES CARTES D’UNE PARTIE, ET LE SEUIL');

/** Huit cartes : quatre sur la partie I, deux sur la II, deux sans partie. */
const CARTES = [
  { id: 'c1', partie: 'i' },
  { id: 'c2', partie: 'i' },
  { id: 'c3', partie: 'i' },
  { id: 'c4', partie: 'i' },
  { id: 'c5', partie: 'ii' },
  { id: 'c6', partie: 'ii' },
  { id: 'c7' },
  { id: 'c8' },
];

const toutes = restreindreAuxParties(CARTES, new Set(), SEUIL_CARTES);
verifier(
  'aucune partie cochée : la fiche entière, et rien de « complété »',
  toutes.retenus.length === 8 && toutes.complement === 0,
  `${toutes.retenus.length} retenues, ${toutes.complement} de complément`,
);
verifier('et le libellé se tait', direLeCiblage(toutes, 'carte') === '', direLeCiblage(toutes, 'carte'));

/* Partie I : quatre cartes, donc sous le seuil de cinq → une de complément. */
const partieI = restreindreAuxParties(CARTES, new Set(['i']), SEUIL_CARTES);
verifier(
  'une partie sous le seuil est complétée jusqu’au seuil',
  partieI.retenus.length === SEUIL_CARTES && partieI.cibles === 4 && partieI.complement === 1,
  `${partieI.retenus.length} retenues, ${partieI.cibles} ciblées, ${partieI.complement} de complément`,
);
verifier(
  'le complément ne reprend aucune carte déjà retenue',
  new Set(partieI.retenus.map((c) => c.id)).size === partieI.retenus.length,
  partieI.retenus.map((c) => c.id).join(),
);
verifier(
  'et l’écran le dit, sans « (s) »',
  direLeCiblage(partieI, 'carte') === '4 cartes sur cette sélection, complétées par 1 de la fiche.',
  direLeCiblage(partieI, 'carte'),
);

/* Deux parties ensemble : six cartes, au-dessus du seuil → aucun complément. */
const deux = restreindreAuxParties(CARTES, new Set(['i', 'ii']), SEUIL_CARTES);
verifier(
  'deux parties au-dessus du seuil ne sont pas complétées',
  deux.retenus.length === 6 && deux.complement === 0,
  `${deux.retenus.length} retenues, ${deux.complement} de complément`,
);
verifier('le libellé se tait alors aussi', direLeCiblage(deux, 'carte') === '');

/* Une partie sans aucune carte rattachée : tout vient du complément. */
const vide = restreindreAuxParties(CARTES, new Set(['iii']), SEUIL_CARTES);
verifier(
  'une partie sans carte rattachée reçoit le seuil entier en complément',
  vide.cibles === 0 && vide.retenus.length === SEUIL_CARTES && vide.complement === SEUIL_CARTES,
  `${vide.cibles} ciblées, ${vide.complement} de complément`,
);

/*
   L'INTERDIT 3, éprouvé par l'identité d'objet. La restriction doit rendre
   LES CARTES ELLES-MÊMES : une copie serait la première marche vers un
   second état FSRS pour la même carte.
*/
verifier(
  'les cartes retenues sont les cartes elles-mêmes, jamais des copies',
  partieI.retenus.every((c) => CARTES.includes(c)),
);

/* Une carte sans partie : elle n'est jamais ciblée, et c'est le sens de P4. */
verifier(
  'une carte sans partie n’est jamais ciblée par une partie',
  !restreindreAuxParties(CARTES, new Set(['i']), 99)
    .retenus.slice(0, 4)
    .some((c) => !c.partie),
);

const questions = restreindreAuxParties(CARTES, new Set(['ii']), SEUIL_QUESTIONS);
verifier(
  'le seuil des questions est plus bas que celui des cartes',
  SEUIL_QUESTIONS < SEUIL_CARTES && questions.retenus.length === SEUIL_QUESTIONS,
  `${SEUIL_QUESTIONS} < ${SEUIL_CARTES}`,
);

/* ══════════════════════════════════════════════════════════════════════════
   Ce que les séances prouvent
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nUNE SÉANCE ANCIENNE VAUT POUR LA FICHE ENTIÈRE');

const ANCIENNE: SeanceLue = { fiches: ['f1'], statut: 'terminee' };
const PAR_PARTIE: SeanceLue = {
  fiches: ['f1'],
  parties: [{ fiche: 'f1', partie: 'i' }],
  statut: 'terminee',
};

const ancienne = suiviDesParties([ANCIENNE], 'f1');
verifier(
  'sans champ « parties », la fiche entière est vue',
  ancienne.ficheEntiere,
  JSON.stringify([...ancienne.vues]),
);
/*
   LE DÉFAUT QU'ON NE VEUT PAS. Lire l'absence de « parties » comme « aucune
   partie vue » effacerait d'un coup tout l'historique : des centaines de
   séances redeviendraient « rien de vu ».
*/
verifier(
  'et non « aucune partie vue », ce qui effacerait l’historique',
  ancienne.ficheEntiere !== false,
);

const parPartie = suiviDesParties([PAR_PARTIE], 'f1');
verifier(
  'une séance par partie ne prouve que ses parties',
  !parPartie.ficheEntiere && parPartie.vues.has('i') && parPartie.vues.size === 1,
  `entière=${parPartie.ficheEntiere}, vues=${[...parPartie.vues].join()}`,
);

const melange = suiviDesParties([PAR_PARTIE, ANCIENNE], 'f1');
verifier(
  'une séance entière après une séance par partie emporte tout',
  melange.ficheEntiere,
);
verifier(
  'une séance qui ne porte pas sur la fiche ne prouve rien d’elle',
  !suiviDesParties([{ fiches: ['autre'], parties: [{ fiche: 'autre', partie: 'i' }] }], 'f1')
    .ficheEntiere,
);
verifier(
  'deux séances par partie cumulent leurs parties',
  suiviDesParties(
    [PAR_PARTIE, { fiches: ['f1'], parties: [{ fiche: 'f1', partie: 'ii' }] }],
    'f1',
  ).vues.size === 2,
);

/* ══════════════════════════════════════════════════════════════════════════
   La durée d'une partie
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA DURÉE D’UNE PARTIE S’ESTIME, ET PRÉFÈRE LA MESURE');

verifier(
  'entre deux repères, la durée est la différence — mesurée, pas estimée',
  dureeEstimeeDeLaPartie({ mots: 9999, debut: 26.5, debutSuivante: 64.9 }) === 38,
  String(dureeEstimeeDeLaPartie({ mots: 9999, debut: 26.5, debutSuivante: 64.9 })),
);
verifier(
  'la dernière partie va jusqu’à la fin de l’audio',
  dureeEstimeeDeLaPartie({ mots: 9999, debut: 100, dureeTotale: 153.8 }) === 54,
  String(dureeEstimeeDeLaPartie({ mots: 9999, debut: 100, dureeTotale: 153.8 })),
);
verifier(
  'sans repère, on retombe sur le nombre de mots',
  dureeEstimeeDeLaPartie({ mots: 540 }) === 180,
  String(dureeEstimeeDeLaPartie({ mots: 540 })),
);
/* Un repère qui ne précède pas sa fin est une incohérence : on n'en tire rien. */
verifier(
  'un repère incohérent ne produit pas une durée négative',
  dureeEstimeeDeLaPartie({ mots: 540, debut: 100, debutSuivante: 50 }) === 180,
  String(dureeEstimeeDeLaPartie({ mots: 540, debut: 100, debutSuivante: 50 })),
);

/* ══════════════════════════════════════════════════════════════════════════
   Le découpage d'une longue fiche
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nUNE LONGUE FICHE SE RÉPARTIT, DANS L’ORDRE DU COURS');

/* Quatre parties de 10 minutes : une séance de 25 minutes en prend deux. */
const LONGUE = [
  { id: 'i', secondes: 600 },
  { id: 'ii', secondes: 600 },
  { id: 'iii', secondes: 600 },
  { id: 'iv', secondes: 600 },
];

verifier(
  'une séance prend les premières parties, jusqu’à la durée visée',
  partiesAProposer(LONGUE, new Set(), 1500).join() === 'i,ii',
  partiesAProposer(LONGUE, new Set(), 1500).join(),
);
verifier(
  'la séance suivante reprend là où l’on s’était arrêté',
  partiesAProposer(LONGUE, new Set(['i', 'ii']), 1500).join() === 'iii,iv',
  partiesAProposer(LONGUE, new Set(['i', 'ii']), 1500).join(),
);
/*
   Dans l'ORDRE du cours, et non les plus courtes d'abord : proposer la
   partie III avant la II ferait lire la conclusion avant l'argument.
*/
verifier(
  'l’ordre du cours est tenu, même si une partie courte suivait',
  partiesAProposer(
    [
      { id: 'i', secondes: 1400 },
      { id: 'ii', secondes: 60 },
      { id: 'iii', secondes: 60 },
    ],
    new Set(),
    1500,
  ).join() === 'i,ii',
);
/*
   Une partie plus longue que la séance entière doit tout de même être
   proposée : sans cela, la fiche resterait bloquée là pour toujours.
*/
verifier(
  'une partie plus longue que la séance est quand même proposée',
  partiesAProposer([{ id: 'i', secondes: 9999 }, { id: 'ii', secondes: 10 }], new Set(), 60).join() ===
    'i',
  partiesAProposer([{ id: 'i', secondes: 9999 }, { id: 'ii', secondes: 10 }], new Set(), 60).join(),
);
verifier(
  'rien à découper quand tout tient dans une séance',
  partiesAProposer(LONGUE, new Set(), 99999).length === 0,
);
verifier(
  'rien à proposer quand toutes les parties ont été vues',
  partiesAProposer(LONGUE, new Set(['i', 'ii', 'iii', 'iv']), 1500).length === 0,
);

console.log(
  rouges === 0
    ? `\n${vert('Tout est vert.')}`
    : `\n${rouge(`${rouges} rouge${rouges > 1 ? 's' : ''}.`)}`,
);
process.exit(rouges === 0 ? 0 : 1);
