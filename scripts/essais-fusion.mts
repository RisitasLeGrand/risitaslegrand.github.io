/**
 * Le moteur de fusion : les trois garanties, éprouvées plutôt que raisonnées.
 *
 * Commutativité, associativité, idempotence. On peut les démontrer en deux
 * lignes — union d'ensembles et maximum sur un ordre total les possèdent — mais
 * la démonstration porte sur le modèle, pas sur le code. Ce qui peut être faux,
 * c'est l'écart entre les deux : une mutation en place, un tri instable, un
 * départage par défaut qui diffère d'un côté à l'autre. D'où la génération
 * aléatoire, qui cherche ces écarts là où on ne les a pas pensés.
 *
 * `fast-check` rétrécit les contre-exemples : quand une propriété tombe, il
 * rend le plus petit cas qui la casse, et non le premier trouvé — ce qui fait la
 * différence entre un diagnostic et une énigme.
 */
import fc from 'fast-check';
import {
  annulerLot,
  conflits,
  normaliserJournal,
  controlerTypesAConflit,
  fusionner,
  plusRecent,
  supprimees,
  TYPES_A_CONFLIT_EXPLICITE,
  TYPE_SUPPRESSION,
  type EtatSynchronisable,
  type Reglages,
} from '../src/lib/noyau/fusion';
import { operation, SANS_LOT, type Operation } from '../src/lib/noyau/operations';
import {
  diagnostiquer,
  fusionnable,
  MARCHE_A_SUIVRE,
} from '../src/lib/sync/premiere-fusion';
import type { EntreeRevision } from '../src/lib/noyau/revisions';
import { comparerOperations } from '../src/lib/noyau/operations';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  ✓ ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  ✗ ${intitule}\n      attendu ${b}\n      obtenu  ${a}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);

/** Une propriété, avec le contre-exemple rétréci en cas d'échec. */
function propriete<T>(intitule: string, arbitraire: fc.Arbitrary<T>, verifier: (x: T) => boolean) {
  try {
    fc.assert(fc.property(arbitraire, verifier), { numRuns: 300 });
    console.log(`  ✓ ${intitule}`);
  } catch (erreur) {
    echecs += 1;
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error(`  ✗ ${intitule}\n${message.split('\n').slice(0, 12).map((l) => `      ${l}`).join('\n')}`);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Générateurs
   ══════════════════════════════════════════════════════════════════════════ */

const APPAREILS = ['AAAA1111', 'BBBB2222', 'CCCC3333'];
const TYPES = ['revision', 'checkin', 'odyssee.poids', 'odyssee.sante', TYPE_SUPPRESSION];
const CIBLES = ['c-1', 'c-2', 'poids:2026-10-09', 'poids:2026-10-10', 's-1'];

/**
 * Une opération. Son identifiant est tiré d'un petit vivier **exprès** : c'est
 * ce qui fait que deux journaux engendrés indépendamment partagent des
 * opérations, donc que la déduplication soit réellement exercée. Un ULID
 * aléatoire par opération rendrait toute intersection improbable et les essais
 * ne vérifieraient jamais l'idempotence.
 */
const uneOperation: fc.Arbitrary<Operation> = fc
  .record({
    rang: fc.integer({ min: 0, max: 40 }),
    appareil: fc.constantFrom(...APPAREILS),
    ms: fc.integer({ min: 1_700_000_000_000, max: 1_700_000_000_100 }),
    compteur: fc.integer({ min: 0, max: 3 }),
    type: fc.constantFrom(...TYPES),
    cible: fc.constantFrom(...CIBLES),
    valeur: fc.integer({ min: 60, max: 90 }),
  })
  .map(({ rang, appareil, ms, compteur, type, cible, valeur }) =>
    operation({
      id: `01ESSAI${String(rang).padStart(19, '0')}`,
      appareil,
      hlc: { ms, compteur },
      type,
      cible,
      charge: { valeur },
    }),
  );

const unChampRegle = fc.record({
  valeur: fc.oneof(fc.integer(), fc.string(), fc.boolean()),
  hlc: fc
    .integer({ min: 1_700_000_000_000, max: 1_700_000_000_100 })
    .map((ms) => `${String(ms).padStart(15, '0')}-0000`),
  appareil: fc.constantFrom(...APPAREILS),
});

const desReglages: fc.Arbitrary<Reglages> = fc.dictionary(
  fc.constantFrom('bascule', 'fuseau', 'rotation', 'parcours'),
  unChampRegle,
  { maxKeys: 4 },
);

const unEtat: fc.Arbitrary<EtatSynchronisable> = fc.record({
  operations: fc.array(uneOperation, { maxLength: 25 }),
  reglages: desReglages,
});

/** L'état réduit à ce qui doit être identique de part et d'autre. */
const empreinteStructurelle = (e: EtatSynchronisable) =>
  JSON.stringify({
    // Le lot est exclu : il dit *comment* une opération est arrivée, ce qui
    // dépend légitimement du point de vue. Deux appareils synchronisés portent
    // les mêmes opérations, chacun marquant celles qu'il a reçues.
    operations: [...e.operations]
      .sort(comparerOperations)
      .map((o) => [o.id, o.appareil, o.hlc, o.type, o.cible, o.charge]),
    reglages: Object.entries(e.reglages)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([c, r]) => [c, r.valeur, r.hlc, r.appareil]),
  });

/* ══════════════════════════════════════════════════════════════════════════
   Les trois garanties
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLes trois garanties');

propriete(
  'commutativité : fusion(a, b) et fusion(b, a) donnent le même état',
  fc.tuple(unEtat, unEtat),
  ([a, b]) =>
    empreinteStructurelle(fusionner(a, b).etat) === empreinteStructurelle(fusionner(b, a).etat),
);

propriete(
  'associativité : (a∪b)∪c = a∪(b∪c)',
  fc.tuple(unEtat, unEtat, unEtat),
  ([a, b, c]) => {
    const gauche = fusionner(fusionner(a, b).etat, c).etat;
    const droite = fusionner(a, fusionner(b, c).etat).etat;
    return empreinteStructurelle(gauche) === empreinteStructurelle(droite);
  },
);

propriete(
  'idempotence : fusionner deux fois ne change rien',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const une = fusionner(a, b).etat;
    const deux = fusionner(une, b).etat;
    return empreinteStructurelle(une) === empreinteStructurelle(deux);
  },
);

propriete(
  'un paquet rejoué n’apporte rien de neuf la seconde fois',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => fusionner(fusionner(a, b).etat, b).recues.length === 0,
);

propriete(
  'fusionner avec soi-même est l’identité, sur un journal normalisé',
  unEtat,
  (a) => {
    // La comparaison porte sur l'état **normalisé** et non sur l'état brut : un
    // journal qui porte deux fois le même identifiant n'est pas un état valide,
    // et le moteur le normalise — c'est précisément ce qu'on attend de lui.
    const propre = { ...a, operations: normaliserJournal(a.operations).operations };
    return empreinteStructurelle(fusionner(propre, propre).etat) === empreinteStructurelle(propre);
  },
);

/* ══════════════════════════════════════════════════════════════════════════
   Ce que la fusion ne doit jamais faire
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCe que la fusion ne doit jamais faire');

propriete(
  'aucune opération locale n’est perdue',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const apres = new Set(fusionner(a, b).etat.operations.map((o) => o.id));
    return a.operations.every((o) => apres.has(o.id));
  },
);

propriete(
  'aucune opération distante n’est perdue',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const apres = new Set(fusionner(a, b).etat.operations.map((o) => o.id));
    return b.operations.every((o) => apres.has(o.id));
  },
);

propriete(
  'aucune opération n’est inventée',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const connues = new Set([...a.operations, ...b.operations].map((o) => o.id));
    return fusionner(a, b).etat.operations.every((o) => connues.has(o.id));
  },
);

propriete(
  'aucun doublon d’identifiant',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const ops = fusionner(a, b).etat.operations;
    return new Set(ops.map((o) => o.id)).size === ops.length;
  },
);

propriete(
  'la charge d’une opération n’est jamais modifiée',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    // Les charges attendues sont celles des versions **retenues** par la
    // normalisation : sur une collision d'identifiants, une des deux versions
    // est écartée, et la comparer à l'autre ne dirait rien.
    const attendues = new Map(
      normaliserJournal([...a.operations, ...b.operations]).operations.map((o) => [
        o.id,
        JSON.stringify(o.charge),
      ]),
    );
    return fusionner(a, b).etat.operations.every(
      (o) => JSON.stringify(o.charge) === attendues.get(o.id),
    );
  },
);

propriete(
  'le journal rendu est trié par l’ordre total',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const ops = fusionner(a, b).etat.operations;
    return ops.every((o, i) => i === 0 || comparerOperations(ops[i - 1], o) <= 0);
  },
);

/* ══════════════════════════════════════════════════════════════════════════
   Réglages
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nRéglages : dernier écrivain, par champ');

propriete(
  'le gagnant est le même vu des deux côtés',
  fc.tuple(unChampRegle, unChampRegle),
  ([a, b]) => JSON.stringify(plusRecent(a, b)) === JSON.stringify(plusRecent(b, a)),
);

propriete(
  'aucun champ ne disparaît',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const apres = fusionner(a, b).etat.reglages;
    const attendus = new Set([...Object.keys(a.reglages), ...Object.keys(b.reglages)]);
    return [...attendus].every((c) => c in apres);
  },
);

propriete(
  'la valeur retenue est l’une des deux, jamais une troisième',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const apres = fusionner(a, b).etat.reglages;
    return Object.entries(apres).every(([champ, retenu]) => {
      const candidats = [a.reglages[champ], b.reglages[champ]].filter(Boolean);
      return candidats.some((c) => JSON.stringify(c) === JSON.stringify(retenu));
    });
  },
);

/* ══════════════════════════════════════════════════════════════════════════
   Conflits
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nConflits : montrés, jamais résolus');

const op = (
  rang: number,
  appareil: string,
  type: string,
  cible: string,
  charge: unknown,
  ms = 1000,
) =>
  operation({
    id: `01ESSAI${String(rang).padStart(19, '0')}`,
    appareil,
    hlc: { ms, compteur: 0 },
    type,
    cible,
    charge,
  });

{
  const a = op(1, 'AAAA1111', 'odyssee.poids', 'poids:2026-10-09', { kg: 74.2 }, 1000);
  const b = op(2, 'BBBB2222', 'odyssee.poids', 'poids:2026-10-09', { kg: 73.8 }, 2000);
  const trouves = conflits([a, b]);
  v('deux poids différents, deux appareils : un conflit', trouves.length, 1);
  v('les deux valeurs sont conservées', trouves[0]?.operations.length, 2);
  v('la plus récente est la provisoire', trouves[0]?.provisoire.id, b.id);

  const pareil = op(3, 'BBBB2222', 'odyssee.poids', 'poids:2026-10-09', { kg: 74.2 }, 2000);
  v('la même valeur des deux côtés n’est pas un conflit', conflits([a, pareil]).length, 0);

  const memeAppareil = op(4, 'AAAA1111', 'odyssee.poids', 'poids:2026-10-09', { kg: 73.5 }, 3000);
  v(
    'deux écritures du même appareil sont une correction, pas un conflit',
    conflits([a, memeAppareil]).length,
    0,
  );

  const evenement1 = op(5, 'AAAA1111', 'checkin', 'jour:2026-10-09', { humeur: 3 });
  const evenement2 = op(6, 'BBBB2222', 'checkin', 'jour:2026-10-09', { humeur: 5 });
  v(
    'un type événementiel ne produit pas de conflit, même en désaccord',
    conflits([evenement1, evenement2]).length,
    0,
  );

  // La charge comparée structurellement : l'ordre des clés ne doit pas
  // fabriquer un conflit.
  const ordreA = op(7, 'AAAA1111', 'odyssee.sante', 'sante:1', { a: 1, b: 2 }, 1000);
  const ordreB = op(8, 'BBBB2222', 'odyssee.sante', 'sante:1', { b: 2, a: 1 }, 2000);
  v('l’ordre des clés de la charge ne fabrique pas de conflit', conflits([ordreA, ordreB]).length, 0);
}

propriete(
  'un conflit garde toujours au moins deux valeurs',
  fc.array(uneOperation, { maxLength: 30 }),
  (ops) => conflits(ops).every((c) => c.operations.length >= 2),
);

propriete(
  'un conflit ne porte que sur un type à conflit explicite',
  fc.array(uneOperation, { maxLength: 30 }),
  (ops) => conflits(ops).every((c) => TYPES_A_CONFLIT_EXPLICITE.includes(c.type)),
);

propriete(
  'les conflits ne dépendent pas de l’ordre de lecture',
  fc.array(uneOperation, { maxLength: 30 }),
  (ops) => {
    const direct = JSON.stringify(conflits(ops).map((c) => [c.type, c.cible, c.provisoire.id]));
    const inverse = JSON.stringify(
      conflits([...ops].reverse()).map((c) => [c.type, c.cible, c.provisoire.id]),
    );
    return direct === inverse;
  },
);

{
  const problemes = controlerTypesAConflit();
  v('les huit types à conflit sont au catalogue et sensibles', problemes, []);

  /*
     La liste est **épinglée**, et c'est voulu. La décision 6 demandait de
     valider ces huit types « ou d'en ajouter » : un ajout est donc une décision,
     et une décision se prend en voyant cet essai échouer, pas en découvrant six
     mois plus tard qu'un type a glissé dans la liste au passage d'un refactor.
  */
  v(
    'et la liste est exactement celle que la décision 6 a validée',
    [...TYPES_A_CONFLIT_EXPLICITE].sort(),
    [
      'odyssee.medicament',
      'odyssee.mesure',
      'odyssee.operation',
      'odyssee.poids',
      'odyssee.sante',
      'odyssee.statut-hormonal',
      'odyssee.valorisation',
      'sport.blessure',
    ],
  );

  /*
     Et les trois « non » de la décision 6 : des événements, qui s'unissent par
     identifiant sans conflit possible. Leur ajouter une notification
     fabriquerait des conflits qui n'existent pas.
  */
  for (const type of ['odyssee.checkin', 'odyssee.journal', 'odyssee.repas']) {
    vrai(
      `« ${type} » reste hors de la liste : c'est un événement, pas un état`,
      !TYPES_A_CONFLIT_EXPLICITE.includes(type),
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Suppressions
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nSuppressions : des opérations, pas des absences');

propriete(
  'une suppression survit à la fusion : un appareil en retard ne ressuscite rien',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    // Les suppressions attendues sont celles du journal normalisé : une
    // collision d'identifiants peut écarter une suppression au profit d'une
    // autre opération de même identifiant, et c'est alors la collision qui est
    // le problème, signalée comme telle.
    const avant = supprimees(normaliserJournal([...a.operations, ...b.operations]).operations);
    const apres = supprimees(fusionner(a, b).etat.operations);
    return [...avant].every((cible) => apres.has(cible));
  },
);

propriete(
  'une collision d’identifiants est signalée, jamais résorbée en silence',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const toutes = [...a.operations, ...b.operations];
    const parId = new Map<string, Set<string>>();
    for (const o of toutes) {
      const forme = JSON.stringify({ ...o, lot: undefined });
      const vues = parId.get(o.id) ?? new Set<string>();
      vues.add(forme);
      parId.set(o.id, vues);
    }
    const attendues = [...parId.values()].filter((v) => v.size > 1).length;
    return fusionner(a, b).collisions.length >= (attendues > 0 ? 1 : 0);
  },
);

/* ══════════════════════════════════════════════════════════════════════════
   Lots et annulation
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLots : l’annulation est exacte, sans perte et rejouable');

propriete(
  'les opérations reçues portent le lot, les locales non',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const r = fusionner(a, b, { lot: 'LOT1' });
    const locales = new Set(a.operations.map((o) => o.id));
    return r.etat.operations.every((o) =>
      locales.has(o.id) ? o.lot === SANS_LOT : o.lot === 'LOT1' || o.lot !== SANS_LOT,
    );
  },
);

propriete(
  'annuler un lot rend exactement l’état d’avant la fusion',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const fusionne = fusionner(a, b, { lot: 'LOT1' }).etat;
    const defait = annulerLot(fusionne, 'LOT1').etat;
    const idsLocaux = new Set(a.operations.map((o) => o.id));
    // Les opérations restantes sont exactement celles du local : ni plus — le
    // lot est retiré en entier — ni moins : une saisie locale ne porte pas le
    // lot et survit.
    return (
      defait.operations.every((o) => idsLocaux.has(o.id)) &&
      [...idsLocaux].every((id) => defait.operations.some((o) => o.id === id))
    );
  },
);

propriete(
  'annuler deux fois ne retire rien de plus',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const fusionne = fusionner(a, b, { lot: 'LOT1' }).etat;
    const une = annulerLot(fusionne, 'LOT1').etat;
    const deux = annulerLot(une, 'LOT1').etat;
    return empreinteStructurelle(une) === empreinteStructurelle(deux);
  },
);

propriete(
  'le lot annulé revient à la fusion suivante',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const fusionne = fusionner(a, b, { lot: 'LOT1' }).etat;
    const defait = annulerLot(fusionne, 'LOT1').etat;
    const rendu = fusionner(defait, b, { lot: 'LOT2' }).etat;
    return empreinteStructurelle(rendu) === empreinteStructurelle(fusionne);
  },
);

{
  let refus: string | null = null;
  try {
    annulerLot({ operations: [], reglages: {} }, '');
  } catch (erreur) {
    refus = erreur instanceof Error ? erreur.message : String(erreur);
  }
  vrai('le lot vide — les saisies locales — ne s’annule pas', Boolean(refus));
}

/* ══════════════════════════════════════════════════════════════════════════
   Ce que la fusion rend à l'appelant
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nCe que la fusion annonce à l’appelant');

propriete(
  'les cibles à recalculer sont celles des opérations reçues, et pas davantage',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    const r = fusionner(a, b);
    const attendues = new Set(r.recues.map((o) => o.cible));
    return (
      r.aRecalculer.length === attendues.size && r.aRecalculer.every((c) => attendues.has(c))
    );
  },
);

propriete(
  'rien à recalculer quand rien n’est reçu',
  unEtat,
  (a) => fusionner(a, a).aRecalculer.length === 0,
);

propriete(
  '« à envoyer » est exactement ce que le distant n’a pas',
  fc.tuple(unEtat, unEtat),
  ([a, b]) => {
    // L'attente se calcule sur le journal **normalisé** : sur un journal brut
    // portant un doublon, elle annoncerait deux fois la même opération à
    // envoyer.
    const idsDistants = new Set(b.operations.map((o) => o.id));
    const attendu = normaliserJournal(a.operations)
      .operations.filter((o) => !idsDistants.has(o.id))
      .map((o) => o.id);
    return JSON.stringify(fusionner(a, b).aEnvoyer.map((o) => o.id)) === JSON.stringify(attendu);
  },
);

/* ══════════════════════════════════════════════════════════════════════════
   La première fusion : ce qu'on réconcilie, ce qu'on refuse
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nPremière fusion : le danger est le socle concurrent, pas l’absence d’ancêtre');

const ETAT_NEUF = {
  due: '2026-05-01',
  stability: 1,
  difficulty: 5,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0 as const,
};

/** Un socle, c'est-à-dire un état repris tel quel faute de journal antérieur. */
const socle = (id: string, carteId: string, appareil: string): EntreeRevision => ({
  id,
  genre: 'socle',
  carteId,
  ficheId: `fiche-${carteId}`,
  matiere: 'Économie',
  le: '2026-05-01T08:00:00.000Z',
  appareil,
  hlc: '000001746000000-0000',
  lot: SANS_LOT,
  etat: ETAT_NEUF,
  revisions: 0,
  oublis: 0,
});

const notation = (id: string, carteId: string, appareil: string): EntreeRevision => ({
  id,
  genre: 'notation',
  carteId,
  ficheId: `fiche-${carteId}`,
  matiere: 'Économie',
  le: '2026-05-02T08:00:00.000Z',
  appareil,
  hlc: '000001746086400-0000',
  lot: SANS_LOT,
  note: 'correct',
});

const cote = (revisions: EntreeRevision[], operations: Operation[] = []) => ({
  operations,
  revisions,
});

const VIDE = cote([], []);

{
  // Deux appareils installés le même jour, chacun ses cartes : aucun ancêtre
  // commun, et pourtant rien à perdre. C'est le cas que la décision 4, prise à
  // la lettre, aurait interdit.
  const d = diagnostiquer(
    cote([socle('S-A', 'carte-alpha', 'AAAA1111')]),
    cote([socle('S-B', 'carte-beta', 'BBBB2222')]),
  );
  v('deux appareils sans ancêtre commun mais sans objet commun : disjointe', d.verdict, 'disjointe');
  vrai('et la fusion est permise', fusionnable(d));
  v('sans socle concurrent à signaler', d.soclesConcurrents, []);
}

{
  const d = diagnostiquer(
    cote([socle('S-A', 'carte-alpha', 'AAAA1111')]),
    cote([socle('S-A', 'carte-alpha', 'AAAA1111'), notation('N-1', 'carte-alpha', 'BBBB2222')]),
  );
  v('un journal qui recoupe l’autre : histoire commune', d.verdict, 'histoire-commune');
  v('et le nombre d’enregistrements partagés est exact', d.partagees, 1);
}

{
  v('une base vide : la fusion est une copie', diagnostiquer(VIDE, cote([socle('S-B', 'c', 'BBBB2222')])).verdict, 'une-base-vide');
  v('dans un sens comme dans l’autre', diagnostiquer(cote([socle('S-A', 'c', 'AAAA1111')]), VIDE).verdict, 'une-base-vide');
  v('deux bases vides aussi', diagnostiquer(VIDE, VIDE).verdict, 'une-base-vide');
}

{
  // Le danger : deux socles distincts pour la **même** carte.
  const d = diagnostiquer(
    cote([socle('S-A', 'carte-alpha', 'AAAA1111')]),
    cote([socle('S-B', 'carte-alpha', 'BBBB2222')]),
  );
  v('deux socles pour la même carte : irréconciliable', d.verdict, 'irreconciliable');
  vrai('et la fusion est refusée', !fusionnable(d));
  v('la carte en cause est nommée', d.soclesConcurrents, ['carte-alpha']);
  vrai('le motif dit où est le problème', d.message.includes('1 flashcard'));
}

{
  /*
     Et le refus l'emporte même sur une histoire commune : deux appareils
     peuvent s'être synchronisés une fois et avoir migré séparément avant. C'est
     pourquoi les socles sont cherchés dans tous les cas, et non seulement
     quand l'ancêtre commun manque.
  */
  const partage = notation('N-0', 'carte-zeta', 'AAAA1111');
  const d = diagnostiquer(
    cote([partage, socle('S-A', 'carte-alpha', 'AAAA1111')]),
    cote([partage, socle('S-B', 'carte-alpha', 'BBBB2222')]),
  );
  v('une histoire commune ne rend pas deux socles réconciliables', d.verdict, 'irreconciliable');
  v('et le partage est tout de même compté', d.partagees, 1);
}

{
  // Le même socle des deux côtés — l'un l'a reçu de l'autre — n'est pas un
  // conflit : c'est le même fait, vu deux fois.
  const commun = socle('S-A', 'carte-alpha', 'AAAA1111');
  v(
    'le même socle de part et d’autre n’est pas concurrent',
    diagnostiquer(cote([commun]), cote([commun])).verdict,
    'histoire-commune',
  );
}

{
  // Plusieurs cartes en cause : toutes nommées, et dans l'ordre.
  const d = diagnostiquer(
    cote([socle('S-A1', 'carte-beta', 'AAAA1111'), socle('S-A2', 'carte-alpha', 'AAAA1111')]),
    cote([socle('S-B1', 'carte-beta', 'BBBB2222'), socle('S-B2', 'carte-alpha', 'BBBB2222')]),
  );
  v('toutes les cartes en cause sont nommées, triées', d.soclesConcurrents, ['carte-alpha', 'carte-beta']);
  vrai('et le pluriel est accordé', d.message.includes('2 flashcards'));
}

/**
 * Un côté de fusion tiré au sort, socles compris.
 *
 * Les identifiants de socle et les cartes sortent de **petits viviers** : c'est
 * ce qui fait que deux côtés engendrés indépendamment tombent parfois sur la
 * même carte avec des socles différents — le seul cas qui compte ici. Tirer des
 * ULID aléatoires rendrait le verdict « irreconciliable » introuvable, et la
 * propriété ne vérifierait jamais rien du refus.
 */
const SOCLES = ['S-1', 'S-2', 'S-3'];
const CARTES = ['carte-alpha', 'carte-beta'];
const unCote = fc
  .record({
    socles: fc.uniqueArray(
      fc.tuple(fc.constantFrom(...SOCLES), fc.constantFrom(...CARTES)),
      { maxLength: 4, selector: ([id]) => id },
    ),
    notations: fc.uniqueArray(fc.constantFrom('N-1', 'N-2', 'N-3'), { maxLength: 3 }),
    appareil: fc.constantFrom(...APPAREILS),
  })
  .map(({ socles, notations, appareil }) =>
    cote([
      ...socles.map(([id, carte]) => socle(id, carte, appareil)),
      ...notations.map((id) => notation(id, CARTES[0], appareil)),
    ]),
  );

propriete(
  'le diagnostic est symétrique : le verdict ne dépend pas du sens',
  fc.tuple(unCote, unCote),
  ([a, b]) => diagnostiquer(a, b).verdict === diagnostiquer(b, a).verdict,
);

propriete(
  'et les cartes en cause sont les mêmes dans les deux sens',
  fc.tuple(unCote, unCote),
  ([a, b]) =>
    JSON.stringify(diagnostiquer(a, b).soclesConcurrents) ===
    JSON.stringify(diagnostiquer(b, a).soclesConcurrents),
);

/** Les socles d'un côté, par carte — le calcul de référence de la propriété. */
const soclesDe = (revisions: readonly EntreeRevision[]) => {
  const parCarte = new Map<string, Set<string>>();
  for (const e of revisions) {
    if (e.genre !== 'socle') continue;
    parCarte.set(e.carteId, (parCarte.get(e.carteId) ?? new Set<string>()).add(e.id));
  }
  return parCarte;
};

propriete(
  'un côté sain fusionné avec lui-même n’est jamais refusé',
  unCote,
  (a) =>
    [...soclesDe(a.revisions).values()].some((s) => s.size > 1) ||
    fusionnable(diagnostiquer(a, a)),
);

propriete(
  'le refus équivaut exactement à une carte à deux socles dans l’état fusionné',
  fc.tuple(unCote, unCote),
  ([a, b]) => {
    const danger = [...soclesDe([...a.revisions, ...b.revisions]).values()].some(
      (socles) => socles.size > 1,
    );
    return fusionnable(diagnostiquer(a, b)) === !danger;
  },
);

propriete(
  'une base déjà dédoublée est refusée, même face à elle-même',
  unCote,
  (a) =>
    ![...soclesDe(a.revisions).values()].some((s) => s.size > 1) ||
    !fusionnable(diagnostiquer(a, a)),
);

v('la marche à suivre tient en trois étapes', MARCHE_A_SUIVRE.length, 3);
vrai(
  'et la sauvegarde y vient avant l’effacement',
  MARCHE_A_SUIVRE[1].includes('sauvegarde') && MARCHE_A_SUIVRE[2].includes('effacez'),
);

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
