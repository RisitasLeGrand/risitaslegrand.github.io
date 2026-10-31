/**
 * L'ALLER-RETOUR DE LA BANQUE « QCM — DGFiP », sur les cas qui mordent.
 *
 *   npm run essais:qcm-source
 *
 * ## Pourquoi cet essai existe, et ce qu'il refuse d'être
 *
 * L'outil `qcm:vers-source` prouve l'aller-retour sur la banque réelle, à
 * chaque exécution, avant d'écrire. C'est la bonne mesure, et elle ne suffit
 * pas : la banque réelle n'a **aucun renvoi « rappel de cours »**, **aucune
 * question à plusieurs bonnes réponses** et **aucune option en double**. Une
 * preuve verte sur ce corpus-là ne dit rien de ces trois cas, et c'est
 * exactement l'erreur qui a fait refuser le corpus récupéré en bloc la
 * première fois : l'aller-retour ne portait que sur `content-exemple/`, dont
 * les fiches n'ont pas de correction.
 *
 * Un corpus est un échantillon, pas une garantie. Cet essai écrit donc les cas
 * que la banque n'a pas, et le fera encore quand elle les aura.
 *
 * ## Comment la mesure est montée
 *
 * Elle part de la SOURCE, pas de la publication, et elle emploie les outils du
 * dépôt à chaque étape — le chargeur du build pour lire, `resoudreRappels` du
 * build pour résoudre les renvois. Un essai qui refabriquerait la forme
 * publiée à la main mesurerait ce que l'essai croit que le build produit.
 *
 *   1. une source écrite à la main, avec les cas durs
 *   2. le CHARGEUR DU BUILD la lit            → la banque chargée
 *   3. `resoudreRappels` résout les renvois    → la banque PUBLIÉE
 *   4. le convertisseur la ramène en source    → la source réécrite
 *   5. le chargeur relit                       → la banque rechargée
 *   6. (3) et (5) doivent coïncider champ pour champ
 *
 * Puis l'inverse, qui compte autant : des sabotages, pour que « zéro écart »
 * veuille dire quelque chose. Une comparaison qui ne sait pas voir un énoncé
 * déplacé d'une espace déclarerait identiques deux banques dont les
 * identifiants diffèrent — et une progression orpheline ne se retrouve pas.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { chargerBanqueDgfip } from './lib/banque-dgfip.mjs';
import { resoudreRappels } from './lib/rappels.mjs';
import {
  banqueEnSource,
  defaireLesRenvois,
  differencesDeBanque,
  nomDeFichier,
} from './lib/qcm-dgfip-en-source.mjs';

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

console.log('\nL\'ALLER-RETOUR DE LA BANQUE « QCM — DGFiP »');

/* --- 1. Une source avec les cas que la banque réelle n'a pas ------------- */

/*
   LES SIX CAS DURS, ET POURQUOI CHACUN EST LÀ.

   1. DEUX OPTIONS AU TEXTE IDENTIQUE, clefée sur la seconde. C'est le cas qui
      interdit de réécrire la réponse par son texte : « reponse: les deux » ne
      saurait pas laquelle. La publication ne porte que le rang ; la source
      réécrite doit le porter aussi.
   2. PLUSIEURS BONNES RÉPONSES. La source écrit alors « reponses: », au
      pluriel, et non « reponse: ». Un convertisseur qui n'aurait vu que la
      banque réelle n'aurait jamais écrit cette ligne.
   3. DES OPTIONS NUMÉRIQUES. Le schéma les accepte et les rend en chaînes :
      l'aller-retour ne rend donc pas la source d'origine, mais doit rendre la
      même PUBLICATION. C'est la bonne exigence, et il faut qu'elle soit dite.
   4. UN RENVOI « rappel de cours ». La publication le porte résolu en
      « { id, titre } », le schéma le refuse sous cette forme : c'est le seul
      champ que l'aller-retour doit défaire, et le défaut qui a fait échouer la
      première récupération en bloc.
   5. LES CINQ TEMPORALITÉS, avec leurs dates obligatoires et leurs dates
      interdites. Un champ oublié ici ne se verrait qu'au jour où une question
      périmée resterait servie.
   6. UNE RUBRIQUE ACCENTUÉE, dont le nom de fichier décide de l'ordre de
      lecture. « Français » trié par octets passe après « Logique ».
*/
const correctionComplete = (verdicts: ('juste' | 'faux')[], rappels: string[] = []) => ({
  resume: 'Un résumé qui tient en une phrase.',
  par_option: verdicts.map((verdict, i) => ({ verdict, pourquoi: `parce que l'option ${i + 1}` })),
  detail: 'Un détail plus long, qui développe le raisonnement sur deux idées.',
  ...(rappels.length ? { rappel_de_cours: rappels } : {}),
  sources: [{ nom: 'Une source', url: 'https://example.org/a' }],
  confiance: 'haute',
  visuel: {
    type: 'tableau',
    donnees: {
      entetes: ['Terme', 'Sens'],
      lignes: [['Un terme', 'Son sens'], ['Un autre', 'Un autre sens']],
    },
    legende: 'Deux termes, deux sens.',
    alt: 'Tableau à deux colonnes : un terme et son sens, sur deux lignes.',
  },
});

const SOURCE_A: Record<string, unknown> = {
  'francais.yml': {
    rubrique: 'Français',
    ordre: 1,
    questions: [
      {
        /* Cas 1 : deux options identiques, clefée sur la seconde par son rang. */
        question: 'Laquelle de ces graphies est correcte ?',
        options: ['La Cour d’appel', 'la cour d’appel', 'La Cour d’appel'],
        reponse: 1,
        explication: 'La juridiction s’écrit en minuscules hors début de phrase.',
        source: 'RevINSP — rédaction originale',
        categorie_origine: 'maison',
        correction: correctionComplete(['faux', 'juste', 'faux']),
      },
      {
        /* Cas 2 : plusieurs bonnes réponses. */
        question: 'Quels mots prennent deux « n » ?',
        options: ['honneur', 'honorer', 'sonnerie'],
        reponses: [0, 2],
        explication: 'Deux des trois doublent la consonne.',
        categorie_origine: 'maison',
      },
      {
        /* Cas 4 : un renvoi « rappel de cours », donné par son chemin. */
        question: 'Qu’est-ce qu’un accord de proximité ?',
        options: ['Un accord avec le plus proche', 'Un accord au masculin'],
        reponse: 0,
        explication: 'L’accord se fait avec le terme le plus proche.',
        categorie_origine: 'B',
        correction: correctionComplete(['juste', 'faux'], [
          'droit-public/fascicule-1/fiche-01-hierarchie-des-normes',
        ]),
      },
    ],
  },
  'logique.yml': {
    rubrique: 'Logique',
    ordre: 3,
    questions: [
      {
        /* Cas 3 : des options numériques, rendues en chaînes par le schéma. */
        question: 'Quelle est la suite : 2, 4, 8, … ?',
        options: [16, 12, 10],
        reponse: 16,
        explication: 'La suite double à chaque rang.',
        categorie_origine: 'A',
      },
      /* Cas 5 : les cinq temporalités. */
      {
        question: 'Une règle qui ne dépend d’aucune date ?',
        options: ['oui', 'non'],
        reponse: 0,
        explication: 'Intemporelle.',
        categorie_origine: 'maison',
        temporalite: { nature: 'intemporelle', a_reverifier_le: '2027-01-15' },
      },
      {
        question: 'Un fait daté, définitivement passé ?',
        options: ['oui', 'non'],
        reponse: 0,
        explication: 'Historique.',
        categorie_origine: 'maison',
        temporalite: { nature: 'historique' },
      },
      {
        question: 'Un état du droit vrai aujourd’hui ?',
        options: ['oui', 'non'],
        reponse: 0,
        explication: 'Actuelle.',
        categorie_origine: 'maison',
        temporalite: { nature: 'actuelle', date_de_reference: '2026-10-25' },
      },
      {
        question: 'Un état du droit dépassé, qu’il faut cesser de servir ?',
        options: ['oui', 'non'],
        reponse: 0,
        explication: 'Passée, non historique.',
        categorie_origine: 'maison',
        temporalite: { nature: 'passee-non-historique', expire_le: '2026-12-31' },
      },
      {
        question: 'Une règle qui n’entrera en vigueur que plus tard ?',
        options: ['oui', 'non'],
        reponse: 0,
        explication: 'À venir.',
        categorie_origine: 'maison',
        incertain: 'Le décret d’application n’est pas publié.',
        temporalite: {
          nature: 'a-venir',
          date_de_reference: '2027-01-01',
          expire_le: '2027-06-30',
        },
      },
    ],
  },
};

const laboratoire = await mkdtemp(path.join(os.tmpdir(), 'essais-qcm-source-'));
const dossierA = path.join(laboratoire, 'a');
const dossierB = path.join(laboratoire, 'b');

const YAML = (await import('yaml')).default;

async function ecrire(dossier: string, fichiers: { nom: string; texte: string }[]) {
  await rm(dossier, { recursive: true, force: true });
  await (await import('node:fs/promises')).mkdir(dossier, { recursive: true });
  for (const f of fichiers) await writeFile(path.join(dossier, f.nom), f.texte, 'utf8');
}

/*
   LES AVERTISSEMENTS DU CHARGEUR SONT GARDÉS, PAS JETÉS.

   Le chargeur écarte en silence une question dont l'identifiant est déjà pris,
   et il ne le dit QUE par un avertissement. Un essai qui les jetterait verrait
   « neuf questions » là où la source en écrit dix, sans savoir laquelle a
   disparu ni pourquoi — c'est arrivé à l'écriture de cet essai, et c'est ce
   qui a montré qu'il fallait les garder.
*/
const avertissements: string[] = [];
const chargeur = {
  echouer: (m: string) => {
    throw new Error(m);
  },
  avertir: (m: string) => avertissements.push(m),
};

try {
  await ecrire(
    dossierA,
    Object.entries(SOURCE_A).map(([nom, corps]) => ({
      nom,
      texte: YAML.stringify(corps, { lineWidth: 0 }),
    })),
  );

  /* --- 2. Le chargeur du build lit la source écrite à la main ------------ */
  const ATTENDU = Object.values(SOURCE_A).reduce(
    (n, r) => n + (r as { questions: unknown[] }).questions.length,
    0,
  );
  const chargee = await chargerBanqueDgfip(dossierA, chargeur);
  verifier(
    'la source des cas durs est acceptée en entier par le chargeur du build',
    chargee.questions.length === ATTENDU &&
      chargee.rubriques.length === Object.keys(SOURCE_A).length &&
      avertissements.length === 0,
    `${chargee.questions.length}/${ATTENDU} question(s), ` +
      `${chargee.rubriques.length} rubrique(s)` +
      (avertissements.length ? `, écartée(s) : ${avertissements.join(' ; ')}` : ''),
  );

  /* --- 3. La résolution des renvois, par le résolveur du build ----------- */
  const FICHE_VISEE = {
    id: '0123456789abcdef',
    titre: 'La hiérarchie des normes',
    chemin: 'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.md',
  };
  const index = new Map([
    [FICHE_VISEE.chemin, FICHE_VISEE],
    [FICHE_VISEE.chemin.replace(/\.md$/, ''), FICHE_VISEE],
  ]);
  let defautsDeResolution = 0;
  for (const q of chargee.questions) {
    defautsDeResolution += resoudreRappels(q.correction, index, 'essai').length;
  }
  const publiee = chargee;
  const avecRenvoi = publiee.questions.filter(
    (q) => (q.correction as { rappel_de_cours?: unknown[] })?.rappel_de_cours?.length,
  );
  verifier(
    'les renvois « rappel de cours » sont résolus comme le build les publie',
    defautsDeResolution === 0 &&
      avecRenvoi.length === 1 &&
      (avecRenvoi[0].correction as { rappel_de_cours: { id: string }[] }).rappel_de_cours[0].id ===
        FICHE_VISEE.id,
    `${avecRenvoi.length} question(s) à renvoi, ${defautsDeResolution} défaut(s)`,
  );

  /* --- 4 et 5. L'aller-retour ------------------------------------------- */
  const cheminParId = new Map([[FICHE_VISEE.id, FICHE_VISEE.chemin]]);
  const fichiersB = banqueEnSource(publiee, {
    cheminDeLaFiche: (id: string) => cheminParId.get(id),
  });
  await ecrire(dossierB, fichiersB);
  const rechargee = await chargerBanqueDgfip(dossierB, chargeur);

  const ecarts = differencesDeBanque(publiee, rechargee, { cheminParId });
  verifier(
    'ALLER-RETOUR À L’IDENTIQUE sur les six cas durs',
    ecarts.length === 0,
    ecarts.length ? ecarts.slice(0, 6).join('\n    ') : `${publiee.questions.length} question(s)`,
  );

  /* La source réécrite porte bien ce que la banque réelle ne porte pas : on le
     vérifie DANS LE TEXTE, parce qu'un aller-retour vert pourrait aussi
     signifier que les deux côtés ont perdu la même chose. */
  const texteFrancais = await readFile(path.join(dossierB, 'francais.yml'), 'utf8');
  verifier(
    '« reponses: » au pluriel est écrit pour une question à plusieurs clefs',
    /\n *reponses:\n/.test(texteFrancais),
  );
  verifier(
    'la clef revient par son RANG, et non par le texte de l’option',
    /\n *reponse: 1\n/.test(texteFrancais),
    'deux options au texte identique rendraient le texte ambigu',
  );
  verifier(
    'le renvoi « rappel de cours » est redevenu un chemin',
    texteFrancais.includes('droit-public/fascicule-1/fiche-01-hierarchie-des-normes') &&
      !texteFrancais.includes('0123456789abcdef'),
  );
  const texteLogique = await readFile(path.join(dossierB, 'logique.yml'), 'utf8');
  verifier(
    'les cinq temporalités sont réécrites avec leurs dates',
    ['intemporelle', 'historique', 'actuelle', 'passee-non-historique', 'a-venir'].every((n) =>
      texteLogique.includes(`nature: ${n}`),
    ) &&
      texteLogique.includes('a_reverifier_le: 2027-01-15') &&
      texteLogique.includes('expire_le: 2026-12-31'),
  );

  /* L'idempotence : reconvertir la banque rechargée doit rendre le MÊME texte.
     Sans elle, chaque passage de l'outil produirait un diff, et le lot de
     corrections suivant serait illisible. */
  const fichiersC = banqueEnSource(rechargee, {
    cheminDeLaFiche: (id: string) => cheminParId.get(id),
  });
  verifier(
    'une seconde conversion rend un texte IDENTIQUE, octet pour octet',
    fichiersC.length === fichiersB.length &&
      fichiersC.every((c, i) => c.nom === fichiersB[i].nom && c.texte === fichiersB[i].texte),
  );

  /* --- 6. Les sabotages : « zéro écart » doit vouloir dire quelque chose -- */
  const copie = () => JSON.parse(JSON.stringify(rechargee));

  const unEspace = copie();
  unEspace.questions[0].question += ' ';
  verifier(
    'SABOTAGE — un énoncé déplacé d’une espace est vu',
    differencesDeBanque(publiee, unEspace, { cheminParId }).length > 0,
    'c’est le cas qui rend une progression orpheline',
  );

  const clefDeplacee = copie();
  clefDeplacee.questions[0].bonnes = [0];
  verifier(
    'SABOTAGE — une clef de réponse déplacée est vue',
    differencesDeBanque(publiee, clefDeplacee, { cheminParId }).length > 0,
  );

  const sourcePerdue = copie();
  delete sourcePerdue.questions[0].source;
  verifier(
    'SABOTAGE — un champ « source » perdu est vu',
    differencesDeBanque(publiee, sourcePerdue, { cheminParId }).length > 0,
  );

  const renvoiPerdu = copie();
  for (const q of renvoiPerdu.questions) {
    if (q.correction?.rappel_de_cours?.length) q.correction.rappel_de_cours = [];
  }
  verifier(
    'SABOTAGE — un renvoi « rappel de cours » perdu est vu',
    differencesDeBanque(publiee, renvoiPerdu, { cheminParId }).length > 0,
    'le champ est le seul que la comparaison doit normaliser, pas ignorer',
  );

  const renvoiDevie = copie();
  for (const q of renvoiDevie.questions) {
    if (q.correction?.rappel_de_cours?.length) {
      q.correction.rappel_de_cours = ['economie/fascicule-2/fiche-03-une-autre'];
    }
  }
  verifier(
    'SABOTAGE — un renvoi qui pointe vers une AUTRE fiche est vu',
    differencesDeBanque(publiee, renvoiDevie, { cheminParId }).length > 0,
  );

  const temporalitePerdue = copie();
  for (const q of temporalitePerdue.questions) delete q.temporalite;
  verifier(
    'SABOTAGE — les temporalités perdues sont vues',
    differencesDeBanque(publiee, temporalitePerdue, { cheminParId }).length > 0,
  );

  const ordreInverse = copie();
  ordreInverse.questions.reverse();
  const ecartsOrdre = differencesDeBanque(publiee, ordreInverse, { cheminParId });
  verifier(
    'SABOTAGE — le même contenu dans un autre ORDRE est vu, et nommé comme tel',
    ecartsOrdre.some((e) => e.startsWith('ORDRE')),
    ecartsOrdre[0]?.slice(0, 100),
  );

  const uneEnMoins = copie();
  uneEnMoins.questions.pop();
  const ecartsManque = differencesDeBanque(publiee, uneEnMoins, { cheminParId });
  verifier(
    'SABOTAGE — une question manquante est signalée par ses IDENTIFIANTS d’abord',
    ecartsManque.some((e) => e.startsWith('IDENTIFIANTS')),
    ecartsManque[0]?.slice(0, 100),
  );

  /* --- 7. Les refus du convertisseur ------------------------------------ */
  let refuse = false;
  try {
    defaireLesRenvois(
      { rappel_de_cours: [{ id: 'inconnu0123456', titre: 'Une fiche absente' }] },
      () => undefined,
      'essai',
    );
  } catch {
    refuse = true;
  }
  verifier(
    'un renvoi dont le chemin est inconnu fait ÉCHOUER la conversion',
    refuse,
    'le laisser tomber en silence enlèverait le lien sans que personne le sache',
  );

  verifier(
    'un renvoi déjà écrit comme un chemin passe tel quel',
    (
      defaireLesRenvois({ rappel_de_cours: ['a/b/c'] }, () => undefined, 'essai') as {
        rappel_de_cours: string[];
      }
    ).rappel_de_cours[0] === 'a/b/c',
  );

  let collision = false;
  try {
    banqueEnSource({
      rubriques: [],
      questions: [
        { rubrique: 'Union européenne', question: 'q1', options: ['a', 'b'], bonnes: [0], explication: 'e', categorie_origine: 'maison' },
        { rubrique: 'Union Européenne', question: 'q2', options: ['a', 'b'], bonnes: [0], explication: 'e', categorie_origine: 'maison' },
      ],
    } as never);
  } catch {
    collision = true;
  }
  verifier(
    'deux rubriques qui donneraient le même nom de fichier sont REFUSÉES',
    collision,
    'la seconde écraserait la première, et la banque perdrait une rubrique entière',
  );

  /* Le nom de fichier décide de l'ordre de lecture, donc de l'ordre publié :
     les accents doivent en sortir, sinon « Français » passe après « Logique ». */
  verifier(
    'le nom de fichier retire les accents, les ligatures et la ponctuation',
    nomDeFichier('Français') === 'francais.yml' &&
      nomDeFichier('Union européenne') === 'union-europeenne.yml' &&
      nomDeFichier('Œuvres & cætera') === 'oeuvres-caetera.yml' &&
      nomDeFichier('Environnement administratif et financier') ===
        'environnement-administratif-et-financier.yml',
  );
  verifier(
    'et il trie « Français » AVANT « Logique », comme la publication l’attend',
    nomDeFichier('Français') < nomDeFichier('Logique'),
  );
} finally {
  await rm(laboratoire, { recursive: true, force: true });
}

console.log(
  rouges === 0
    ? `\n${vert('L’aller-retour tient sur tous les cas éprouvés.')}\n`
    : `\n${rouge(`${rouges} échec(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
