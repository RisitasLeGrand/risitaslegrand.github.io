/**
 * La compaction : la seule opération du chantier qui retire des entrées.
 *
 * Elle mérite donc les mêmes égards que la fusion. Trois questions, et les
 * essais qui suivent n'en traitent pas d'autres.
 *
 * 1. **Efface-t-elle seulement ce qu'elle doit ?** Jamais une carte vivante,
 *    jamais une opération au-delà de la borne, jamais un compactage.
 * 2. **Est-elle déterministe ?** Deux appareils aux mêmes journaux et à la même
 *    borne doivent calculer le même plan, sans quoi leurs empreintes ne se
 *    rejoindraient jamais.
 * 3. **Converge-t-elle ?** Un appareil en retard renvoie ce qu'il n'a pas vu
 *    effacer. Le compactage voyage, l'autre l'applique, et les deux journaux
 *    redeviennent identiques. C'est la propriété qui compte le plus, et c'est
 *    celle qu'aucun raisonnement ne suffit à garantir.
 */
import fc from 'fast-check';
import {
  bornePartagee,
  compactagesDeclares,
  couverte,
  horsPerimetre,
  perimetre,
  planifier,
  vide,
  CIBLE_COMPACTION,
  TYPE_COMPACTION,
  type AppareilBornable,
  type Compactage,
} from '../src/lib/sync/compaction';
import { fusionner, TYPE_SUPPRESSION, type EtatSynchronisable } from '../src/lib/noyau/fusion';
import { operation, SANS_LOT, type Operation } from '../src/lib/noyau/operations';
import type { EntreeRevision } from '../src/lib/noyau/revisions';

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

function propriete<T>(intitule: string, arbitraire: fc.Arbitrary<T>, verifier: (x: T) => boolean) {
  try {
    fc.assert(fc.property(arbitraire, verifier), { numRuns: 300 });
    console.log(`  ✓ ${intitule}`);
  } catch (erreur) {
    echecs += 1;
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error(
      `  ✗ ${intitule}\n${message
        .split('\n')
        .slice(0, 12)
        .map((l) => `      ${l}`)
        .join('\n')}`,
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Fabriques
   ══════════════════════════════════════════════════════════════════════════ */

/** Une horloge lisible : « 000000000000003-0000 » se trie comme elle se lit. */
const h = (n: number): string => `${String(n).padStart(15, '0')}-0000`;

let compteur = 0;
const op = (
  champs: Partial<Operation> & { hlc: string; cible: string },
): Operation =>
  Object.freeze({
    id: `op-${String((compteur += 1)).padStart(4, '0')}`,
    appareil: 'AAAA1111',
    type: 'revision',
    lot: SANS_LOT,
    charge: {},
    ...champs,
  }) as Operation;

const pierre = (cible: string, hlc: string, appareil = 'AAAA1111'): Operation =>
  op({ type: TYPE_SUPPRESSION, cible, hlc, appareil, charge: {} });

const compactage = (jusqua: string, cibles: string[], hlc = h(900)): Operation =>
  op({ type: TYPE_COMPACTION, cible: CIBLE_COMPACTION, hlc, charge: { jusqua, cibles } });

const revision = (carteId: string, hlc: string): EntreeRevision =>
  ({
    id: `rev-${String((compteur += 1)).padStart(4, '0')}`,
    carteId,
    ficheId: 'f-1',
    matiere: 'eco',
    le: '2026-10-11T08:00:00.000Z',
    appareil: 'AAAA1111',
    hlc,
    lot: SANS_LOT,
    genre: 'notation',
    note: 3,
  }) as unknown as EntreeRevision;

const appareil = (
  id: string,
  reconnuJusqua?: string,
  nom?: string,
): AppareilBornable => ({ id, nom, soi: false, reconnuJusqua });
const moi: AppareilBornable = { id: 'AAAA1111', soi: true };

/* ══════════════════════════════════════════════════════════════════════════
   1. La borne partagée
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLa borne partagée');

{
  const borne = bornePartagee([moi], h(50));
  v('seul au registre, la borne est l’horloge courante', borne, {
    possible: true,
    jusqua: h(50),
    seul: true,
  });
}

{
  const borne = bornePartagee([moi, appareil('BBBB2222', undefined, 'Téléphone')], h(50));
  v('un appareil qui n’a jamais accusé réception refuse la compaction', borne, {
    possible: false,
    motif: 'appareil-jamais-vu',
    attendus: ['Téléphone'],
  });
}

{
  const borne = bornePartagee([moi, appareil('BBBB2222')], h(50));
  v('faute de nom, l’identifiant est nommé', borne, {
    possible: false,
    motif: 'appareil-jamais-vu',
    attendus: ['BBBB2222'],
  });
}

{
  const borne = bornePartagee(
    [moi, appareil('BBBB2222', h(30)), appareil('CCCC3333', h(12))],
    h(50),
  );
  v('la borne est la plus petite reconnue : l’appareil en retard commande', borne, {
    possible: true,
    jusqua: h(12),
    seul: false,
  });
}

{
  const borne = bornePartagee([moi, appareil('BBBB2222', h(90))], h(50));
  v('un appareil qui en sait plus que notre horloge ne la dépasse pas', borne, {
    possible: true,
    jusqua: h(50),
    seul: false,
  });
}

propriete(
  'l’ordre des appareils ne change pas la borne',
  fc.array(fc.integer({ min: 1, max: 99 }), { minLength: 1, maxLength: 6 }),
  (bornes) => {
    const appareils = bornes.map((n, i) => appareil(`AP${i}`, h(n)));
    const a = bornePartagee([moi, ...appareils], h(99));
    const b = bornePartagee([moi, ...[...appareils].reverse()], h(99));
    return JSON.stringify(a) === JSON.stringify(b);
  },
);

propriete(
  'un seul appareil jamais vu suffit à refuser, où qu’il soit dans la liste',
  fc.array(fc.integer({ min: 1, max: 99 }), { minLength: 0, maxLength: 5 }),
  (bornes) => {
    const appareils = [
      ...bornes.map((n, i) => appareil(`AP${i}`, h(n))),
      appareil('MUET'),
    ];
    return bornePartagee([moi, ...appareils], h(99)).possible === false;
  },
);

/* ══════════════════════════════════════════════════════════════════════════
   2. Le plan
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLe plan de compaction');

{
  const journaux = {
    operations: [op({ cible: 'c-1', hlc: h(3) }), op({ cible: 'c-2', hlc: h(4) })],
    revisions: [revision('c-1', h(3))],
  };
  const plan = planifier(journaux, h(50));
  vrai('rien de supprimé, rien à faire', vide(plan));
  v('aucune cible déclarée', plan.cibles, []);
}

{
  const journaux = {
    operations: [
      op({ cible: 'c-1', hlc: h(3) }),
      pierre('c-1', h(5)),
      op({ cible: 'c-2', hlc: h(6) }),
    ],
    revisions: [revision('c-1', h(4)), revision('c-2', h(6))],
  };
  const plan = planifier(journaux, h(50));
  v('la cible supprimée est déclarée', plan.cibles, ['c-1']);
  v('ses deux opérations partent', plan.operations.length, 2);
  v('sa pierre tombale est comptée', plan.pierresTombales, 1);
  v('sa révision part', plan.revisions.length, 1);
  v('la cible vivante est intacte', plan.reportees, []);
  vrai(
    'aucune opération de la cible vivante n’est touchée',
    plan.operations.every((o) => o.cible === 'c-1'),
  );
  vrai(
    'aucune révision de la carte vivante n’est touchée',
    plan.revisions.every((r) => (r as unknown as EntreeRevision).carteId === 'c-1'),
  );
}

{
  const journaux = {
    operations: [op({ cible: 'c-1', hlc: h(3) }), pierre('c-1', h(80))],
    revisions: [],
  };
  const plan = planifier(journaux, h(50));
  v('une pierre tombale au-delà de la borne reporte la cible entière', plan.reportees, [
    'c-1',
  ]);
  vrai('et ne retire rien', vide(plan));
}

{
  const journaux = {
    operations: [op({ cible: 'c-1', hlc: h(3) }), pierre('c-1', h(5))],
    revisions: [revision('c-1', h(90))],
  };
  const plan = planifier(journaux, h(50));
  v('une révision au-delà de la borne reporte aussi la cible', plan.reportees, ['c-1']);
  vrai('et ne retire rien', vide(plan));
}

{
  const journaux = {
    operations: [pierre('c-1', h(5)), compactage(h(4), ['c-0'], h(6))],
    revisions: [],
  };
  const plan = planifier(journaux, h(50));
  vrai(
    'une opération de compaction n’est jamais dans le plan',
    plan.operations.every((o) => o.type !== TYPE_COMPACTION),
  );
  v('la cible supprimée l’est tout de même', plan.cibles, ['c-1']);
}

{
  const journaux = {
    operations: [pierre('c-2', h(5)), pierre('c-1', h(6))],
    revisions: [],
  };
  const plan = planifier(journaux, h(50));
  v('les cibles déclarées sont triées, donc reproductibles', plan.cibles, ['c-1', 'c-2']);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Déterminisme
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLe déterminisme du plan');

const journauxArbitraires = fc
  .array(
    fc.record({
      cible: fc.constantFrom('c-1', 'c-2', 'c-3'),
      hlc: fc.integer({ min: 1, max: 99 }),
      supprime: fc.boolean(),
      revision: fc.boolean(),
    }),
    { minLength: 0, maxLength: 20 },
  )
  .map((entrees) => {
    const operations: Operation[] = [];
    const revisions: EntreeRevision[] = [];
    for (const e of entrees) {
      if (e.supprime) operations.push(pierre(e.cible, h(e.hlc)));
      else if (e.revision) revisions.push(revision(e.cible, h(e.hlc)));
      else operations.push(op({ cible: e.cible, hlc: h(e.hlc) }));
    }
    return { operations, revisions };
  });

const idsDe = (plan: ReturnType<typeof planifier>) =>
  [...plan.operations.map((o) => o.id), ...plan.revisions.map((r) => r.id)].sort().join(',');

propriete('le plan ne dépend pas de l’ordre de lecture', journauxArbitraires, (journaux) => {
  const direct = planifier(journaux, h(60));
  const inverse = planifier(
    { operations: [...journaux.operations].reverse(), revisions: [...journaux.revisions].reverse() },
    h(60),
  );
  return (
    idsDe(direct) === idsDe(inverse) &&
    direct.cibles.join(',') === inverse.cibles.join(',') &&
    direct.reportees.join(',') === inverse.reportees.join(',')
  );
});

propriete(
  'une cible n’est jamais à la fois déclarée et reportée',
  journauxArbitraires,
  (journaux) => {
    const plan = planifier(journaux, h(60));
    return plan.cibles.every((c) => !plan.reportees.includes(c));
  },
);

propriete(
  'rien de ce que le plan retire ne dépasse la borne',
  journauxArbitraires,
  (journaux) => {
    const plan = planifier(journaux, h(60));
    return [...plan.operations, ...plan.revisions].every((e) => e.hlc <= h(60));
  },
);

propriete(
  'rien de ce que le plan retire ne concerne une cible vivante',
  journauxArbitraires,
  (journaux) => {
    const plan = planifier(journaux, h(60));
    const supprimees = new Set(
      journaux.operations.filter((o) => o.type === TYPE_SUPPRESSION).map((o) => o.cible),
    );
    return (
      plan.operations.every((o) => supprimees.has(o.cible)) &&
      plan.revisions.every((r) =>
        supprimees.has((r as unknown as EntreeRevision).carteId),
      )
    );
  },
);

propriete(
  'une borne plus haute ne retire jamais moins',
  journauxArbitraires,
  (journaux) => {
    const petit = planifier(journaux, h(30));
    const grand = planifier(journaux, h(99));
    const dedans = new Set(idsDe(grand).split(','));
    return idsDe(petit)
      .split(',')
      .filter(Boolean)
      .every((id) => dedans.has(id));
  },
);

/* ══════════════════════════════════════════════════════════════════════════
   4. Le périmètre
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLe périmètre');

{
  const lu = compactagesDeclares([
    compactage(h(10), ['c-1', 'c-2'], h(11)),
    op({ cible: 'c-3', hlc: h(12) }),
    op({ type: TYPE_COMPACTION, cible: CIBLE_COMPACTION, hlc: h(13), charge: { cibles: ['x'] } }),
    op({ type: TYPE_COMPACTION, cible: CIBLE_COMPACTION, hlc: h(14), charge: null }),
  ]);
  v('un compactage sans borne est ignoré', lu.length, 1);
  v('la borne et les cibles sont lues', lu[0], { jusqua: h(10), cibles: ['c-1', 'c-2'] });
}

{
  const lu = compactagesDeclares([
    compactage(h(20), ['b'], h(21)),
    compactage(h(10), ['a'], h(22)),
  ]);
  v('les compactages sont rendus triés par borne', lu.map((c) => c.jusqua), [h(10), h(20)]);
}

{
  const p = perimetre([
    { jusqua: h(10), cibles: ['c-1'] },
    { jusqua: h(30), cibles: ['c-1', 'c-2'] },
  ]);
  v('l’union garde la borne la plus haute par cible', [...p.entries()].sort(), [
    ['c-1', h(30)],
    ['c-2', h(30)],
  ]);
}

propriete(
  'le périmètre ne dépend pas de l’ordre des compactages',
  fc.array(
    fc.record({
      jusqua: fc.integer({ min: 1, max: 99 }),
      cibles: fc.array(fc.constantFrom('c-1', 'c-2', 'c-3'), { maxLength: 3 }),
    }),
    { maxLength: 6 },
  ),
  (brut) => {
    const compactages: Compactage[] = brut.map((c) => ({ jusqua: h(c.jusqua), cibles: c.cibles }));
    const direct = [...perimetre(compactages).entries()].sort();
    const inverse = [...perimetre([...compactages].reverse()).entries()].sort();
    return JSON.stringify(direct) === JSON.stringify(inverse);
  },
);

{
  const p = perimetre([{ jusqua: h(10), cibles: ['c-1'] }]);
  vrai('une entrée sous la borne est couverte', couverte({ hlc: h(5) }, 'c-1', p));
  vrai('une entrée au-dessus ne l’est pas', !couverte({ hlc: h(11) }, 'c-1', p));
  vrai('la borne elle-même est incluse', couverte({ hlc: h(10) }, 'c-1', p));
  vrai('une cible hors périmètre ne l’est pas', !couverte({ hlc: h(1) }, 'c-9', p));
  vrai(
    'une opération de compaction n’est jamais couverte',
    !couverte({ type: TYPE_COMPACTION, hlc: h(1) }, 'c-1', p),
  );
}

{
  const entrees = [
    op({ cible: 'c-1', hlc: h(5) }),
    op({ cible: 'c-1', hlc: h(40) }),
    op({ cible: 'c-2', hlc: h(5) }),
  ];
  const p = perimetre([{ jusqua: h(10), cibles: ['c-1'] }]);
  const premier = horsPerimetre(entrees, p, (o) => o.cible);
  v('seule l’entrée couverte part', premier.retirees.length, 1);
  const second = horsPerimetre(premier.gardees, p, (o) => o.cible);
  v('appliquer deux fois ne retire rien de plus', second.retirees.length, 0);
  v('et garde exactement les mêmes', second.gardees.length, premier.gardees.length);
}

{
  const entrees = [op({ cible: 'c-1', hlc: h(5) })];
  const resultat = horsPerimetre(entrees, new Map(), (o) => o.cible);
  v('un périmètre vide ne retire rien', resultat.retirees.length, 0);
  v('et rend le journal entier', resultat.gardees.length, 1);
}

/* ══════════════════════════════════════════════════════════════════════════
   5. La convergence — un appareil en retard
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLa convergence avec un appareil en retard');

/** Ce que fait le service : fusionner, puis réappliquer le périmètre réuni. */
function fusionnerPuisCompacter(
  a: EtatSynchronisable,
  b: EtatSynchronisable,
): EtatSynchronisable {
  const union = fusionner(a, b).etat;
  const p = perimetre(compactagesDeclares(union.operations));
  return {
    operations: horsPerimetre([...union.operations], p, (o) => o.cible).gardees,
    reglages: union.reglages,
  };
}

const ids = (etat: EtatSynchronisable) =>
  etat.operations
    .map((o) => o.id)
    .sort()
    .join(',');

{
  // L'histoire commune : deux faits sur c-1, un sur c-2, et c-1 supprimée.
  const communes = [
    op({ cible: 'c-1', hlc: h(3) }),
    op({ cible: 'c-1', hlc: h(4) }),
    pierre('c-1', h(5)),
    op({ cible: 'c-2', hlc: h(6) }),
  ];
  const enRetard: EtatSynchronisable = { operations: communes, reglages: {} };

  // L'appareil à jour compacte : il retire le plan et déclare le compactage.
  const plan = planifier({ operations: communes, revisions: [] }, h(50));
  const retires = new Set(plan.operations.map((o) => o.id));
  const declare = compactage(plan.jusqua, plan.cibles, h(51));
  const aJour: EtatSynchronisable = {
    operations: [...communes.filter((o) => !retires.has(o.id)), declare],
    reglages: {},
  };

  v('l’appareil à jour ne garde que le fait vivant et le compactage', aJour.operations.length, 2);

  const chezLeRetard = fusionnerPuisCompacter(enRetard, aJour);
  const chezLAJour = fusionnerPuisCompacter(aJour, enRetard);
  v('l’appareil en retard réefface ce qu’il renvoyait', ids(chezLeRetard), ids(aJour));
  v('et l’appareil à jour ne ressuscite rien', ids(chezLAJour), ids(aJour));
  v('les deux journaux sont identiques après la rencontre', ids(chezLeRetard), ids(chezLAJour));

  const encore = fusionnerPuisCompacter(chezLeRetard, chezLAJour);
  v('une seconde rencontre ne change plus rien', ids(encore), ids(chezLeRetard));
}

{
  // Un fait saisi après la borne sur l'appareil en retard : il doit survivre.
  const communes = [op({ cible: 'c-1', hlc: h(3) }), pierre('c-1', h(5))];
  const tardif = op({ cible: 'c-1', hlc: h(80), appareil: 'BBBB2222' });
  const enRetard: EtatSynchronisable = { operations: [...communes, tardif], reglages: {} };
  const declare = compactage(h(50), ['c-1'], h(51));
  const aJour: EtatSynchronisable = { operations: [declare], reglages: {} };

  const apres = fusionnerPuisCompacter(enRetard, aJour);
  v(
    'un fait postérieur à la borne survit au compactage, même sur une cible déclarée',
    apres.operations.map((o) => o.id).sort(),
    [declare.id, tardif.id].sort(),
  );
}

propriete(
  'fusionner puis compacter est commutatif',
  fc
    .tuple(journauxArbitraires, fc.integer({ min: 1, max: 99 }))
    .map(([journaux, borne]) => {
      const plan = planifier(journaux, h(borne));
      const retires = new Set(plan.operations.map((o) => o.id));
      return {
        a: { operations: journaux.operations, reglages: {} } as EtatSynchronisable,
        b: {
          operations: [
            ...journaux.operations.filter((o) => !retires.has(o.id)),
            ...(plan.cibles.length ? [compactage(plan.jusqua, plan.cibles, h(99))] : []),
          ],
          reglages: {},
        } as EtatSynchronisable,
      };
    }),
  ({ a, b }) => ids(fusionnerPuisCompacter(a, b)) === ids(fusionnerPuisCompacter(b, a)),
);

propriete(
  'un compactage reçu est idempotent : le rejouer ne retire rien de plus',
  fc
    .tuple(journauxArbitraires, fc.integer({ min: 1, max: 99 }))
    .map(([journaux, borne]) => {
      const plan = planifier(journaux, h(borne));
      return {
        etat: {
          operations: [
            ...journaux.operations,
            ...(plan.cibles.length ? [compactage(plan.jusqua, plan.cibles, h(99))] : []),
          ],
          reglages: {},
        } as EtatSynchronisable,
      };
    }),
  ({ etat }) => {
    const une = fusionnerPuisCompacter(etat, { operations: [], reglages: {} });
    const deux = fusionnerPuisCompacter(une, { operations: [], reglages: {} });
    return ids(une) === ids(deux);
  },
);

console.log(
  echecs === 0 ? '\nTous les essais de compaction passent.\n' : `\n${echecs} échec(s).\n`,
);
process.exit(echecs === 0 ? 0 : 1);
