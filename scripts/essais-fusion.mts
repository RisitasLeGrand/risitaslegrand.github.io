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

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
