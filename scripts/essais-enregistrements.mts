/**
 * Les enregistrements journalisés : le socle déterministe et la matérialisation.
 *
 * Ce que ces essais protègent est invisible et coûteux : qu'un fait de domaine
 * **voyage**, qu'il arrive au bon magasin, que la dernière écriture gagne, qu'une
 * suppression ne soit pas ressuscitée, et surtout que deux appareils migrés
 * séparément produisent **le même** socle — sans quoi leurs journaux resteraient
 * inégaux pour toujours et l'écran dirait « non identiques » sans que rien ne
 * puisse les rapprocher.
 */
import { controlerCoffre, estScelle } from '../src/lib/noyau/coffre';
import fc from 'fast-check';
import {
  APPAREIL_SOCLE,
  HLC_SOCLE,
  MAGASINS_JOURNALISES,
  cibleDe,
  controlerMagasins,
  estSocle,
  idSocle,
  lireCible,
  magasinJournalise,
  materialiser,
  operationSocle,
} from '../src/lib/noyau/enregistrements';
import {
  TYPES_A_CONFLIT_EXPLICITE,
  TYPES_TEXTE_A_CONFLIT,
  TYPE_SUPPRESSION,
  controlerTypesAConflit,
} from '../src/lib/noyau/fusion';
import { operation, SANS_LOT, type Operation } from '../src/lib/noyau/operations';
import { decoderHlc } from '../src/lib/noyau/hlc';
import { typeDeFait } from '../src/lib/noyau/faits';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);

function propriete<T>(intitule: string, arbitraire: fc.Arbitrary<T>, verifier: (x: T) => boolean) {
  try {
    fc.assert(fc.property(arbitraire, verifier), { numRuns: 300 });
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
  } catch (erreur) {
    echecs += 1;
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.log(
      `  \x1b[31m✗\x1b[0m ${intitule}\n${message
        .split('\n')
        .slice(0, 10)
        .map((l) => `      ${l}`)
        .join('\n')}`,
    );
  }
}

/**
 * Une opération d'enregistrement, à la main.
 *
 * Le nom du champ de clé est lu dans la déclaration du magasin, et non supposé :
 * les notes de séance sont clefées par `seanceId`, et un essai qui écrirait `id`
 * partout mesurerait son propre raccourci.
 */
const ecriture = (
  magasin: string,
  clef: string,
  champs: Record<string, unknown>,
  ms: number,
  appareil = 'portable',
): Operation => {
  const declare = magasinJournalise(magasin)!;
  return operation({
    id: `01OP${String(ms).padStart(20, '0')}`,
    appareil,
    hlc: { ms, compteur: 0 },
    type: declare.type,
    cible: cibleDe(magasin, clef),
    lot: SANS_LOT,
    charge: { magasin, enregistrement: { [declare.clef]: clef, ...champs } },
  });
};

const suppression = (magasin: string, clef: string, ms: number, appareil = 'portable'): Operation =>
  operation({
    id: `01SUP${String(ms).padStart(19, '0')}`,
    appareil,
    hlc: { ms, compteur: 0 },
    type: TYPE_SUPPRESSION,
    cible: cibleDe(magasin, clef),
    lot: SANS_LOT,
    charge: {},
  });

console.log('\nLE CATALOGUE DES MAGASINS JOURNALISÉS TIENT');

v('aucun problème sur les deux listes de types à conflit', controlerTypesAConflit(), []);
v(
  'la note de séance est un conflit de texte, pas un conflit de donnée sensible',
  [
    TYPES_TEXTE_A_CONFLIT.includes('revision.note-seance'),
    TYPES_A_CONFLIT_EXPLICITE.includes('revision.note-seance'),
  ],
  [true, false],
);
v(
  'et les deux listes ne se recoupent pas',
  TYPES_TEXTE_A_CONFLIT.filter((t) => TYPES_A_CONFLIT_EXPLICITE.includes(t)),
  [],
);

v('aucun problème de catalogue', controlerMagasins(), []);
v(
  'chaque magasin annonce un type déclaré',
  MAGASINS_JOURNALISES.filter((m) => !typeDeFait(m.type)).map((m) => m.magasin),
  [],
);
/*
   Huit pour Révisions, quatorze pour Odyssée, cinq pour Sport.

   Ce compte s'était **tu** quand les quatre premiers magasins de Sport sont
   entrés au registre : l'essai annonçait treize et personne ne le lançait.
   C'est pourquoi les deux lignes qui suivent nomment les magasins au lieu de
   les compter — un compte qui bouge se corrige sans rien apprendre, une liste
   nommée dit lequel manque.
*/
v('trente-six magasins journalisés', MAGASINS_JOURNALISES.length, 36);
v(
  'et les vingt-trois d’Odyssée y sont',
  MAGASINS_JOURNALISES.filter((m) => m.magasin.startsWith('odyssee')).map((m) => m.magasin),
  [
    'odysseeTaches',
    'odysseeQuetes',
    'odysseeEvenements',
    'odysseeFocus',
    'odysseeRevues',
    // Le domaine Corps, depuis la phase 6.
    'odysseePesees',
    'odysseeMesures',
    'odysseeNuits',
    'odysseeRepas',
    'odysseeBoissons',
    'odysseeSante',
    // Les trajectoires, depuis la phase 9.
    'odysseeTrajectoires',
    // Les deux scellés, depuis la décision 3.
    'odysseeMedicaments',
    'odysseeHormonal',
    // La psyché, depuis la phase 7 — scellée elle aussi.
    'odysseeCheckins',
    'odysseeHebdos',
    'odysseeJournal',
    // Les passations d’échelles, depuis la phase « échelles ».
    'odysseePassations',
    // Finances, depuis la phase 1 — scellés tous les quatre.
    'odysseeComptes',
    'odysseeValorisations',
    'odysseeOperations',
    'odysseeLignesBudget',
    // Et le rapprochement, depuis la phase 3.
    'odysseeRapprochements',
  ],
);
/*
   Les deux magasins que la **décision 3** retient. Les nommer en négatif est
   le seul moyen de s'apercevoir qu'ils sont arrivés sans que la décision ait
   été prise — une absence ne se remarque pas toute seule.
*/
/*
   La décision 3 a été prise le 12 octobre 2026 : les deux magasins existent,
   et ils sont **scellés**. La ligne qui les attendait en négatif devient donc
   son contraire — ils doivent être au catalogue du coffre, sans quoi ils
   voyageraient en clair.
*/
v(
  'les dix magasins sensibles sont scellés',
  [
    'odysseeMedicaments',
    'odysseeHormonal',
    'odysseeCheckins',
    'odysseeHebdos',
    'odysseeJournal',
    'odysseeComptes',
    'odysseeValorisations',
    'odysseeOperations',
    'odysseeLignesBudget',
    'odysseeRapprochements',
  ].filter((m) => !estScelle(m)),
  [],
);
v('et le catalogue du coffre se tient', controlerCoffre(), []);
v(
  'et les cinq de Sport aussi',
  MAGASINS_JOURNALISES.filter((m) => m.magasin.startsWith('sport')).map((m) => m.magasin),
  [
    'sportExercices',
    'sportSeances',
    'sportPhases',
    'sportBlessures',
    'sportProgrammes',
  ],
);
v(
  'un seul porte une règle de combinaison, et c’est l’état d’une fiche',
  MAGASINS_JOURNALISES.filter((m) => m.combiner).map((m) => m.magasin),
  ['fiches'],
);
v(
  'dont les séances et leurs notes, chacune avec sa clé',
  MAGASINS_JOURNALISES.filter((m) => m.magasin === 'seances' || m.magasin === 'notes').map(
    (m) => `${m.magasin}.${m.clef}`,
  ),
  ['seances.id', 'notes.seanceId'],
);
v(
  'et les cartes FSRS n’en sont pas : elles ont déjà leur journal',
  MAGASINS_JOURNALISES.filter((m) => m.magasin === 'cartes' || m.magasin === 'revisions'),
  [],
);

console.log('\nLA CIBLE PORTE LE MAGASIN, ET SE RELIT');

v('la cible compose le magasin et la clé', cibleDe('quiz', 'abc'), 'quiz:abc');
v('et se défait', lireCible('quiz:abc')?.clef, 'abc');
v('le magasin est reconnu', lireCible('quiz:abc')?.magasin.magasin, 'quiz');
v('un magasin inconnu n’est pas une cible d’enregistrement', lireCible('poids:abc'), null);
v('ni une cible sans clé', lireCible('quiz:'), null);
v('ni une chaîne sans séparateur', lireCible('quiz'), null);
/*
 * Le préfixe de magasin dans la cible n'est pas décoratif : trois magasins
 * partagent le type « revision.cog-training », et sans lui une partie de N-Back
 * et une session de Veridical Mapping de même identifiant se matérialiseraient
 * l'une sur l'autre.
 */
vrai(
  'deux magasins de même type ne partagent pas une cible',
  cibleDe('nback', 'x') !== cibleDe('vmSessions', 'x'),
);

console.log('\nLE SOCLE EST DÉTERMINISTE');

{
  const enregistrement = { id: 'Q1', le: '2026-05-01T10:00:00.000Z', bonnes: 7, total: 10 };
  const ici = operationSocle('quiz', enregistrement)!;
  const laBas = operationSocle('quiz', { ...enregistrement })!;
  v('deux appareils produisent la même opération, au signe près', ici, laBas);
  v('son identifiant dérive de la cible', ici.id, idSocle('quiz', 'Q1'));
  v('son appareil n’est pas une machine', ici.appareil, APPAREIL_SOCLE);
  v('son horloge est le plancher', ici.hlc, HLC_SOCLE);
  v('elle est reconnue comme socle', estSocle(ici), true);
  v('une opération ordinaire ne l’est pas', estSocle(ecriture('quiz', 'Q1', {}, 5)), false);
  v('un magasin non journalisé ne produit pas de socle', operationSocle('cartes', { id: 'c1' }), null);
  v('ni un enregistrement sans clé', operationSocle('quiz', { le: 'x' }), null);

  /*
   * Le cas qui justifie tout : deux appareils portant le **même** enregistrement
   * doivent produire une seule opération après union. Deux appareils portant
   * deux contenus différents sous la même clé produisent le même identifiant,
   * et c'est « normaliserJournal » qui signale alors la collision — ce qui est
   * exactement ce qu'on veut qu'il arrive.
   */
  const divergent = operationSocle('quiz', { ...enregistrement, bonnes: 9 })!;
  v('un contenu divergent garde le même identifiant', divergent.id, ici.id);
  vrai('mais pas la même charge', JSON.stringify(divergent.charge) !== JSON.stringify(ici.charge));

  /*
   * Les trois magasins dont l'enregistrement peut légitimement différer d'un
   * appareil à l'autre ont un socle **par appareil**. Avec un socle partagé,
   * les deux versions auraient porté le même identifiant, l'union n'en aurait
   * gardé qu'une — choisie par une règle de départage sans sens métier — et la
   * seconde aurait disparu sans que rien ne le dise.
   */
  v(
    'les magasins mutables ont un socle par appareil',
    MAGASINS_JOURNALISES.filter((m) => m.soclePar === 'appareil').map((m) => m.magasin).sort(),
    ['fiches', 'notes', 'seances'],
  );
  const ficheBureau = operationSocle('fiches', { id: 'eco-1', lu: true }, 'bureau')!;
  const fichePortable = operationSocle('fiches', { id: 'eco-1', lu: false }, 'portable')!;
  vrai('deux appareils produisent deux socles distincts', ficheBureau.id !== fichePortable.id);
  v('qui portent leur appareil', [ficheBureau.appareil, fichePortable.appareil], ['bureau', 'portable']);
  v('sur la même cible', ficheBureau.cible, fichePortable.cible);
  v(
    'et un socle par appareil sans appareil n’est pas écrit',
    operationSocle('fiches', { id: 'eco-1', lu: true }),
    null,
  );
  v(
    'alors qu’un socle partagé n’en demande pas',
    operationSocle('quiz', { id: 'Q9' })?.appareil,
    'socle',
  );
}

console.log('\nLA MATÉRIALISATION DIT CE QUE DIT LE JOURNAL');

{
  const plan = materialiser([ecriture('quiz', 'Q1', { bonnes: 7 }, 10)]);
  v('une écriture devient un enregistrement à écrire', plan.aEcrire.length, 1);
  v('dans son magasin', plan.aEcrire[0].magasin, 'quiz');
  v('avec son contenu', plan.aEcrire[0].enregistrement, { id: 'Q1', bonnes: 7 });
  v('rien à effacer', plan.aEffacer, []);
}

{
  const plan = materialiser([
    ecriture('quiz', 'Q1', { bonnes: 7 }, 10),
    ecriture('quiz', 'Q1', { bonnes: 9 }, 20),
  ]);
  v('la dernière écriture gagne', plan.aEcrire[0].enregistrement, { id: 'Q1', bonnes: 9 });
  v('et il n’y en a qu’une', plan.aEcrire.length, 1);
}

{
  const plan = materialiser([
    ecriture('quiz', 'Q1', { bonnes: 7 }, 10),
    suppression('quiz', 'Q1', 20),
  ]);
  v('une suppression postérieure efface', plan.aEffacer.map((e) => e.clef), ['Q1']);
  v('et rien n’est écrit', plan.aEcrire, []);
}

{
  /*
   * Supprimé puis recréé : l'objet existe. Même raisonnement qu'à la
   * compaction — un fait postérieur à la suppression la dépasse.
   */
  const plan = materialiser([
    ecriture('quiz', 'Q1', { bonnes: 7 }, 10),
    suppression('quiz', 'Q1', 20),
    ecriture('quiz', 'Q1', { bonnes: 3 }, 30),
  ]);
  v('un objet supprimé puis recréé existe', plan.aEcrire[0].enregistrement, { id: 'Q1', bonnes: 3 });
  v('et n’est pas effacé', plan.aEffacer, []);
}

{
  const plan = materialiser([
    ecriture('quiz', 'Q1', { bonnes: 7 }, 10),
    ecriture('nback', 'N1', { n: 3 }, 20),
    ecriture('vmSessions', 'N1', { reussis: 4 }, 30),
  ]);
  v('trois magasins, trois enregistrements', plan.aEcrire.length, 3);
  v(
    'et la clé partagée ne les confond pas',
    plan.aEcrire.map((e) => e.magasin).sort(),
    ['nback', 'quiz', 'vmSessions'],
  );
}

{
  // Les opérations qui ne portent pas d'enregistrement ne sont pas notre affaire.
  const nomAppareil = operation({
    id: '01NOM00000000000000000000',
    appareil: 'portable',
    hlc: { ms: 5, compteur: 0 },
    type: 'appareil.nom',
    cible: 'portable',
    lot: SANS_LOT,
    charge: { nom: 'Téléphone' },
  });
  const plan = materialiser([nomAppareil, ecriture('quiz', 'Q1', {}, 10)]);
  v('un nom d’appareil n’est pas un enregistrement', plan.aEcrire.length, 1);
  v('et ne produit aucun illisible', plan.illisibles, []);
}

{
  const faux = operation({
    id: '01FAUX0000000000000000000',
    appareil: 'portable',
    hlc: { ms: 10, compteur: 0 },
    type: 'revision.qcm',
    cible: cibleDe('quiz', 'Q1'),
    lot: SANS_LOT,
    charge: { magasin: 'quiz' },
  });
  const plan = materialiser([faux]);
  v('une charge sans enregistrement est signalée', plan.illisibles.length, 1);
  v('et rien n’est écrit', plan.aEcrire, []);

  const menteur = operation({
    id: '01MENT0000000000000000000',
    appareil: 'portable',
    hlc: { ms: 10, compteur: 0 },
    type: 'revision.qcm',
    cible: cibleDe('quiz', 'Q1'),
    lot: SANS_LOT,
    charge: { magasin: 'nback', enregistrement: { id: 'Q1' } },
  });
  v(
    'une charge qui annonce un autre magasin que sa cible est refusée',
    materialiser([menteur]).illisibles.length,
    1,
  );

  const clefFausse = operation({
    id: '01CLEF0000000000000000000',
    appareil: 'portable',
    hlc: { ms: 10, compteur: 0 },
    type: 'revision.qcm',
    cible: cibleDe('quiz', 'Q1'),
    lot: SANS_LOT,
    charge: { magasin: 'quiz', enregistrement: { id: 'AUTRE' } },
  });
  v(
    'un enregistrement dont la clé contredit la cible est refusé',
    materialiser([clefFausse]).illisibles.length,
    1,
  );
}

{
  /*
   * Le cas de l'annulation : une cible demandée dont le journal ne dit plus
   * rien doit disparaître du magasin, sans quoi annuler une fusion laisserait
   * derrière elle les QCM de l'autre appareil.
   */
  const plan = materialiser([], { cibles: [cibleDe('quiz', 'Q1')] });
  v('une cible orpheline est effacée', plan.aEffacer.map((e) => e.clef), ['Q1']);

  const garde = materialiser([ecriture('quiz', 'Q1', { bonnes: 7 }, 10)], {
    cibles: [cibleDe('quiz', 'Q1')],
  });
  v('une cible encore au journal est réécrite', garde.aEcrire.length, 1);
  v('et pas effacée', garde.aEffacer, []);

  const horsPerimetre = materialiser([ecriture('quiz', 'Q2', {}, 10)], {
    cibles: [cibleDe('quiz', 'Q1')],
  });
  v('une cible hors du périmètre demandé est ignorée', horsPerimetre.aEcrire, []);
}

console.log('\nUNE RÉPONSE AU CONFLIT COMMANDE CE QUI S’AFFICHE');

{
  /*
   * Deux appareils ont écrit la même note. Tant que personne n'a répondu, la
   * plus récente s'affiche — c'est le provisoire de `fusion.ts`. Une fois la
   * réponse donnée, c'est la version **désignée** qui doit s'écrire, sans quoi
   * répondre ne servirait à rien.
   */
  const ici = ecriture('notes', 'S1', { note: 'version ordinateur' }, 10, 'bureau');
  const laBas = ecriture('notes', 'S1', { note: 'version téléphone' }, 20, 'portable');

  v(
    'sans réponse, la plus récente s’affiche',
    materialiser([ici, laBas]).aEcrire[0].enregistrement,
    { seanceId: 'S1', note: 'version téléphone' },
  );
  v(
    'la réponse « garder celle-ci » l’emporte sur la plus récente',
    materialiser([ici, laBas], {
      retenues: [{ cible: ici.cible, issue: 'retenue', retenue: ici.id }],
    }).aEcrire[0].enregistrement,
    { seanceId: 'S1', note: 'version ordinateur' },
  );
  v(
    '« les deux sont justes » laisse la plus récente, aucune n’ayant été désignée',
    materialiser([ici, laBas], {
      retenues: [{ cible: ici.cible, issue: 'toutes-justes' }],
    }).aEcrire[0].enregistrement,
    { seanceId: 'S1', note: 'version téléphone' },
  );
  v(
    'une réponse qui désigne une opération inconnue est sans effet',
    materialiser([ici, laBas], {
      retenues: [{ cible: ici.cible, issue: 'retenue', retenue: '01INCONNUE' }],
    }).aEcrire[0].enregistrement,
    { seanceId: 'S1', note: 'version téléphone' },
  );
  v(
    'une suppression postérieure à la réponse l’emporte sur elle',
    materialiser([ici, laBas, suppression('notes', 'S1', 30)], {
      retenues: [{ cible: ici.cible, issue: 'retenue', retenue: ici.id }],
    }).aEffacer.map((e) => e.clef),
    ['S1'],
  );
  v(
    'mais une réponse postérieure à la suppression ressuscite la version désignée',
    materialiser([ici, suppression('notes', 'S1', 5), laBas], {
      retenues: [{ cible: ici.cible, issue: 'retenue', retenue: ici.id }],
    }).aEcrire[0].enregistrement,
    { seanceId: 'S1', note: 'version ordinateur' },
  );
}

console.log('\nL’ÉTAT D’UNE FICHE SE COMBINE, ET NE S’ÉCRASE PAS');

{
  /*
   * Lue sur l'ordinateur, prétestée sur le téléphone : les deux doivent tenir.
   * C'est le seul magasin où « la dernière écriture gagne » perdrait une
   * information que personne ne pourrait retrouver.
   */
  const lue = ecriture(
    'fiches',
    'eco-1',
    { matiere: 'Économie', lu: true, derniereOuverture: '2026-05-01T10:00:00.000Z', secondes: 600 },
    10,
    'bureau',
  );
  const pretestee = ecriture(
    'fiches',
    'eco-1',
    {
      matiere: 'Économie',
      lu: false,
      derniereOuverture: '2026-05-02T09:00:00.000Z',
      secondes: 120,
      pretesteeLe: '2026-05-02',
      pretestVues: ['q1', 'q2'],
    },
    20,
    'portable',
  );

  const combine = materialiser([lue, pretestee]).aEcrire[0].enregistrement;
  v('« lue » est un ou logique : elle ne redevient pas non lue', combine.lu, true);
  v('le prétest du téléphone est conservé', combine.pretesteeLe, '2026-05-02');
  v('les questions servies s’unissent', combine.pretestVues, ['q1', 'q2']);
  v('la dernière ouverture est la plus récente', combine.derniereOuverture, '2026-05-02T09:00:00.000Z');
  v('le compteur prend le maximum, jamais la somme', combine.secondes, 600);

  const autresVues = ecriture(
    'fiches',
    'eco-1',
    { matiere: 'Économie', lu: false, pretestVues: ['q2', 'q3'], pretesteeLe: '2026-04-28' },
    30,
    'tablette',
  );
  const trois = materialiser([lue, pretestee, autresVues]).aEcrire[0].enregistrement;
  v('trois appareils s’unissent sans doublon', trois.pretestVues, ['q1', 'q2', 'q3']);
  v('et « prétestée le » garde la plus ancienne date', trois.pretesteeLe, '2026-04-28');
  v('« lue » tient toujours', trois.lu, true);

  /*
   * Deux écritures du même appareil ne sont pas une divergence : la plus
   * récente remplace la précédente, et la combinaison ne voit qu'elle.
   */
  const correction = ecriture(
    'fiches',
    'eco-1',
    { matiere: 'Économie', lu: false, pretestVues: [] },
    40,
    'bureau',
  );
  const apresCorrection = materialiser([lue, correction]).aEcrire[0].enregistrement;
  v('une correction locale efface bien la version d’avant', apresCorrection.lu, false);

  // Supprimée puis recréée : la combinaison ne ressuscite pas l'avant.
  const recreee = materialiser([
    lue,
    pretestee,
    suppression('fiches', 'eco-1', 50),
    ecriture('fiches', 'eco-1', { matiere: 'Économie', lu: false }, 60, 'bureau'),
  ]).aEcrire[0].enregistrement;
  v('après suppression, la combinaison repart de zéro', recreee.lu, false);
  v('et le prétest d’avant n’est pas ressuscité', recreee.pretesteeLe, undefined);

  // Une réponse au conflit l'emporte sur la règle du magasin.
  const designee = materialiser([lue, pretestee], {
    retenues: [{ cible: lue.cible, issue: 'retenue', retenue: lue.id }],
  }).aEcrire[0].enregistrement;
  v('une réponse désigne une version, et la combinaison ne s’applique plus', designee.pretesteeLe, undefined);
  v('c’est bien celle qui a été désignée', designee.derniereOuverture, '2026-05-01T10:00:00.000Z');
}

console.log('\nLES PROPRIÉTÉS, SUR DES JOURNAUX ENGENDRÉS');

const journalArbitraire = fc
  .array(
    fc.record({
      magasin: fc.constantFrom('quiz', 'nback', 'vmSessions', 'relationnel', 'qcmSessions', 'fiches', 'notes', 'seances'),
      clef: fc.constantFrom('A', 'B', 'C'),
      ms: fc.integer({ min: 1, max: 40 }),
      valeur: fc.integer({ min: 0, max: 9 }),
      supprime: fc.boolean(),
      appareil: fc.constantFrom('portable', 'bureau'),
    }),
    { minLength: 0, maxLength: 12 },
  )
  .map((brut) =>
    brut.map((e, i) =>
      e.supprime
        ? suppression(e.magasin, e.clef, e.ms * 10 + i, e.appareil)
        : ecriture(e.magasin, e.clef, { valeur: e.valeur }, e.ms * 10 + i, e.appareil),
    ),
  );

const forme = (ops: Operation[]) => JSON.stringify(materialiser(ops));

propriete('la matérialisation ne dépend pas de l’ordre du journal', journalArbitraire, (ops) => {
  const inverse = [...ops].reverse();
  return forme(ops) === forme(inverse);
});

propriete('elle est idempotente', journalArbitraire, (ops) => forme(ops) === forme([...ops, ...ops]));

propriete(
  'une cible est soit écrite, soit effacée, jamais les deux',
  journalArbitraire,
  (ops) => {
    const plan = materialiser(ops);
    const ecrites = new Set(plan.aEcrire.map((e) => e.cible));
    return plan.aEffacer.every((e) => !ecrites.has(e.cible));
  },
);

propriete(
  'tout enregistrement écrit porte la clé de sa cible',
  journalArbitraire,
  (ops) =>
    materialiser(ops).aEcrire.every((e) => {
      const defaite = lireCible(e.cible)!;
      return e.enregistrement[defaite.magasin.clef] === defaite.clef;
    }),
);

/**
 * Sérialisation **stable** : les clés sont triées.
 *
 * C'est la même règle que celle de `normaliserJournal`, et elle est ici pour la
 * même raison. `JSON.stringify` garde l'ordre d'insertion des clés : deux
 * objets de même contenu écrits dans un ordre différent rendraient deux chaînes
 * différentes. Pour la convergence, cela n'a aucune conséquence — l'union
 * dédoublonne par identifiant, et la collision se juge sur une forme stable —,
 * mais un essai qui comparerait les chaînes brutes mesurerait l'ordre
 * d'écriture plutôt que l'égalité du contenu.
 */
function stable(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(stable).join(',')}]`;
  if (valeur && typeof valeur === 'object') {
    return `{${Object.entries(valeur as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : 1))
      .map(([c, v]) => `${JSON.stringify(c)}:${stable(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(valeur) ?? 'null';
}

propriete(
  'le socle est reproductible à partir de l’enregistrement seul',
  fc.record({
    magasin: fc.constantFrom('quiz', 'nback', 'vmSessions'),
    clef: fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0),
    valeur: fc.integer(),
  }),
  ({ magasin, clef, valeur }) => {
    const a = operationSocle(magasin, { id: clef, valeur });
    const b = operationSocle(magasin, { valeur, id: clef });
    return stable(a) === stable(b) && a!.id === b!.id;
  },
);

console.log('\nL’HORLOGE DU SOCLE PRÉCÈDE TOUTE ÉCRITURE RÉELLE');

{
  const socle = operationSocle('quiz', { id: 'Q1', bonnes: 1 })!;
  const reelle = ecriture('quiz', 'Q1', { bonnes: 2 }, 1);
  vrai('le socle se trie avant', socle.hlc < reelle.hlc);
  v('donc l’écriture réelle gagne', materialiser([socle, reelle]).aEcrire[0].enregistrement, {
    id: 'Q1',
    bonnes: 2,
  });
  v('et l’horloge du socle est bien le zéro', decoderHlc(socle.hlc), { ms: 0, compteur: 0 });
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
