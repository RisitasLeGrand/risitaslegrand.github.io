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
  materialiser,
  operationSocle,
} from '../src/lib/noyau/enregistrements';
import { TYPE_SUPPRESSION } from '../src/lib/noyau/fusion';
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

/** Une opération d'enregistrement, à la main. */
const ecriture = (
  magasin: string,
  clef: string,
  champs: Record<string, unknown>,
  ms: number,
  appareil = 'portable',
): Operation =>
  operation({
    id: `01OP${String(ms).padStart(20, '0')}`,
    appareil,
    hlc: { ms, compteur: 0 },
    type: 'revision.qcm',
    cible: cibleDe(magasin, clef),
    lot: SANS_LOT,
    charge: { magasin, enregistrement: { id: clef, ...champs } },
  });

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

v('aucun problème de catalogue', controlerMagasins(), []);
v(
  'chaque magasin annonce un type déclaré',
  MAGASINS_JOURNALISES.filter((m) => !typeDeFait(m.type)).map((m) => m.magasin),
  [],
);
v('cinq magasins pour l’instant', MAGASINS_JOURNALISES.length, 5);
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

console.log('\nLES PROPRIÉTÉS, SUR DES JOURNAUX ENGENDRÉS');

const journalArbitraire = fc
  .array(
    fc.record({
      magasin: fc.constantFrom('quiz', 'nback', 'vmSessions', 'relationnel', 'qcmSessions'),
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
