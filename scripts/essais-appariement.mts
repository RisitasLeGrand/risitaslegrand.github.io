/**
 * Essais de l'appariement — Finances, phase 3.
 *
 * Les quatre cas que le plan nomme, et qui sont les quatre façons dont un
 * rapprochement naïf se trompe :
 *
 *   1. **1 → N** : un loyer payé en deux virements ;
 *   2. **N → 1** : un prélèvement groupé réparti sur plusieurs lignes ;
 *   3. **débit différé** : la carte, dont le prélèvement mensuel est un
 *      virement interne et ne doit pas compter deux fois ;
 *   4. **remboursements** : une rentrée sur une ligne de charge réduit le
 *      réel, au lieu de gonfler les ressources.
 *
 * Et la règle qui les surplombe : **un montant différent se rapproche quand
 * même**, l'écart étant conservé. Refuser produirait deux anomalies pour un
 * fait ordinaire.
 */
import { TOLERANCE_PAR_DEFAUT, type Occurrence, type Tolerance } from '../src/lib/odyssee/budget';
import type { OperationBancaire } from '../src/lib/odyssee/finances';
import {
  FACTEUR_DE_PROXIMITE,
  apprendre,
  construireLaFile,
  controlerAppariement,
  controlerParts,
  critereDeDate,
  critereDeMontant,
  diviser,
  fragmentsDe,
  grouperVers,
  motifReconnu,
  normaliser,
  proposer,
  type Motif,
  type ReglagesAppariement,
} from '../src/lib/odyssee/appariement';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const occ = (p: Partial<Occurrence> = {}): Occurrence => ({
  id: 'loyer:2026-10-05',
  ligneId: 'loyer',
  jour: '2026-10-05',
  montant: 78000,
  signe: -1,
  du: '2026-10-03',
  au: '2026-10-07',
  tolerance: 200,
  ...p,
});

const op = (p: Partial<OperationBancaire> = {}): OperationBancaire => ({
  id: 'OP1',
  compteId: 'C1',
  jour: '2026-10-05',
  centimes: -78000,
  libelle: 'VIR M DUPONT LOYER',
  categorie: '',
  transfertAvec: null,
  majLe: '2026-10-05T10:00:00.000Z',
  ...p,
});

const reglages = (p: Partial<ReglagesAppariement> = {}): ReglagesAppariement => ({
  tolerance: TOLERANCE_PAR_DEFAUT,
  motifs: [],
  sensParLigne: { loyer: 'charge', electricite: 'charge', salaire: 'ressource' },
  ...p,
});

/* ── 1. Les motifs sont des fragments ─────────────────────────────────── */

egal('1.1 le contrôle passe', controlerAppariement(), []);
egal('1.2 la normalisation retire accents et ponctuation',
  normaliser('Prélèvement EDF-Clients, n°4'), 'PRELEVEMENT EDF CLIENTS N 4');
egal('1.3 les mots de plomberie bancaire ne deviennent pas des motifs',
  fragmentsDe('PRLV SEPA EDF CLIENTS'), ['EDF', 'CLIENTS']);
egal('1.4 ni les nombres nus', fragmentsDe('VIR 123456 SALAIRE'), ['SALAIRE']);
verifier('1.5 « VIR » seul ne produirait aucun motif', fragmentsDe('VIR DU 05').length === 0);

{
  /*
     Le cas que l'égalité stricte raterait : la banque allonge le libellé.
     Douze mois d'historique ne doivent pas cesser d'être reconnus parce que
     « PRLV EDF » est devenu « PRLV EDF CLIENTS SA ».
  */
  const motifs: Motif[] = [{ ligneId: 'electricite', fragment: 'EDF', vu: 11 }];
  verifier('1.6 un libellé allongé reste reconnu',
    motifReconnu('PRLV EDF CLIENTS SA', 'electricite', motifs)?.fragment === 'EDF');
  egal('1.7 mais pas sur une autre ligne',
    motifReconnu('PRLV EDF CLIENTS SA', 'loyer', motifs), null);
}

{
  const apres = apprendre([], 'electricite', 'PRLV EDF CLIENTS');
  egal('1.8 confirmer apprend les fragments utiles',
    apres.map((m) => m.fragment).sort(), ['CLIENTS', 'EDF']);
  const encore = apprendre(apres, 'electricite', 'PRLV EDF AUTRE');
  egal('1.9 et incrémente ce qui revient',
    encore.find((m) => m.fragment === 'EDF')?.vu, 2);
  egal('1.10 sans toucher à ce qui ne revient pas',
    encore.find((m) => m.fragment === 'CLIENTS')?.vu, 1);
}

/* ── 2. Les trois critères, chiffrés ──────────────────────────────────── */

verifier('2.1 un montant exact le dit',
  critereDeMontant(78000, -78000, 200).phrase === 'Montant exact.');
verifier('2.2 un écart dans la tolérance est accepté, et chiffré',
  critereDeMontant(78000, -78150, 200).dans &&
    critereDeMontant(78000, -78150, 200).phrase.includes('1,50 €'));
{
  const c = critereDeMontant(9500, -11240, 200);
  verifier('2.3 un écart hors tolérance est refusé', !c.dans);
  egal('2.4 et l’écart est conservé au centime', c.ecart, 1740);
  verifier('2.5 la phrase le dit en euros', c.phrase.includes('17,40 €'), c.phrase);
}

verifier('2.6 une date dans la fenêtre le dit', critereDeDate(occ(), '2026-10-04').dans);
{
  const c = critereDeDate(occ({ du: '2026-10-03', au: '2026-10-07' }), '2026-10-11');
  verifier('2.7 une date hors fenêtre est refusée', !c.dans);
  egal('2.8 et l’écart compte les jours au-delà de la borne', c.ecart, 4);
  verifier('2.9 la phrase donne la largeur de la fenêtre', c.phrase.includes('fenêtre de 4'));
}

/* ── 3. Les trois niveaux ─────────────────────────────────────────────── */

{
  const motifs: Motif[] = [{ ligneId: 'loyer', fragment: 'DUPONT', vu: 9 }];
  const p = proposer(occ(), op(), reglages({ motifs }));
  egal('3.1 trois critères remplis font une certaine', p.niveau, 'certain');
  verifier('3.2 et l’explication porte les trois',
    p.explication.includes('Montant exact') && p.explication.includes('Date dans la fenêtre')
      && p.explication.includes('déjà vu 9 fois'));
}

{
  // Montant hors tolérance mais proche, date et motif bons.
  const motifs: Motif[] = [{ ligneId: 'electricite', fragment: 'EDF', vu: 11 }];
  const p = proposer(
    occ({ id: 'e:2026-10-15', ligneId: 'electricite', montant: 9500, du: '2026-10-12', au: '2026-10-18' }),
    op({ centimes: -9800, libelle: 'PRLV EDF CLIENTS', jour: '2026-10-15' }),
    reglages({ motifs }),
  );
  egal('3.3 deux sur trois, le troisième proche : probable', p.niveau, 'probable');
}

{
  /*
     La dissymétrie, et elle est volontaire : **le montant n'a pas de borne**.

     Quand la date et le motif concordent, l'identification est faite — c'est
     bien ce prélèvement-là, sur cette ligne-là. Le montant n'identifie plus,
     il informe : une facture d'électricité varie, et une régularisation de
     450 € est exactement le genre d'événement qu'il faut proposer plutôt que
     d'envoyer à « à classer ». Le garde-fou n'est pas un seuil mais la
     phrase, qui dit l'écart en euros et laisse refuser d'un geste.
  */
  const motifs: Motif[] = [{ ligneId: 'electricite', fragment: 'EDF', vu: 11 }];
  const p = proposer(
    occ({ id: 'e:2026-10-15', ligneId: 'electricite', montant: 9500, du: '2026-10-12', au: '2026-10-18' }),
    op({ centimes: -45000, libelle: 'PRLV EDF CLIENTS', jour: '2026-10-15' }),
    reglages({ motifs }),
  );
  egal('3.4 une régularisation reconnue reste probable, quel que soit l’écart', p.niveau, 'probable');
  verifier('3.5 et la phrase dit l’écart en euros, pour qu’on puisse refuser',
    p.montant.phrase.includes('355,00 €'), p.montant.phrase);
}

{
  /*
     La date, elle, a bien une borne : un prélèvement décalé de quatre jours
     reste le même prélèvement, décalé de quatre mois non.
  */
  const motifs: Motif[] = [{ ligneId: 'loyer', fragment: 'DUPONT', vu: 9 }];
  const proche = proposer(occ(), op({ jour: '2026-10-11' }), reglages({ motifs }));
  const loin = proposer(occ(), op({ jour: '2026-12-11' }), reglages({ motifs }));
  egal('3.5 bis une date à quatre jours de la fenêtre reste probable', proche.niveau, 'probable');
  egal('3.5 ter une date à deux mois ne l’est plus', loin.niveau, 'incertain');
  verifier(`3.5 quater la borne est le facteur ${FACTEUR_DE_PROXIMITE}`, FACTEUR_DE_PROXIMITE === 2);
}

{
  const p = proposer(occ(), op({ libelle: 'INCONNU TOTAL' }), reglages());
  egal('3.6 sans motif, montant et date exacts font une probable', p.niveau, 'probable');
  verifier('3.7 et l’explication dit que le libellé est inconnu',
    p.motif.phrase.includes('Aucun libellé'));
}

/* ── 4. L'écart est conservé, et le rapprochement a lieu ──────────────── */

{
  const p = proposer(
    occ({ id: 'e:1', ligneId: 'electricite', montant: 9500, du: '2026-10-12', au: '2026-10-18' }),
    op({ centimes: -11240, jour: '2026-10-15', libelle: 'PRLV EDF' }),
    reglages({ motifs: [{ ligneId: 'electricite', fragment: 'EDF', vu: 11 }] }),
  );
  verifier('4.1 une facture plus chère que prévu est quand même proposée',
    p.niveau !== 'incertain');
  egal('4.2 et l’écart au prévu est conservé, signé', p.ecartAuPrevu, 1740);
  verifier('4.3 positif : on a payé plus que prévu', p.ecartAuPrevu > 0);
}

{
  const p = proposer(
    occ({ id: 'e:1', ligneId: 'electricite', montant: 9500, du: '2026-10-12', au: '2026-10-18' }),
    op({ centimes: -8000, jour: '2026-10-15', libelle: 'PRLV EDF' }),
    reglages({ motifs: [{ ligneId: 'electricite', fragment: 'EDF', vu: 11 }] }),
  );
  verifier('4.4 moins cher que prévu donne un écart négatif', p.ecartAuPrevu < 0);
  egal('4.5 de mille cinq cents centimes', p.ecartAuPrevu, -1500);
}

/* ── 5. Les remboursements ────────────────────────────────────────────── */

{
  /*
     Une opération positive sur une ligne de charge est un remboursement.
     Le compter comme une ressource ferait croire à une rentrée d'argent là
     où il y a un aller-retour.
  */
  const p = proposer(
    occ({ id: 'm:1', ligneId: 'electricite', montant: 9500, du: '2026-10-12', au: '2026-10-18' }),
    op({ centimes: 4500, jour: '2026-10-15', libelle: 'VIR MUTUELLE REMB' }),
    reglages(),
  );
  verifier('5.1 une rentrée sur une ligne de charge est un remboursement', p.remboursement);
  verifier('5.2 et elle réduit le réel plutôt que de le gonfler', p.ecartAuPrevu < 0);
  egal('5.3 de quarante-cinq euros sous le prévu', p.ecartAuPrevu, -14000);
}

{
  const p = proposer(
    occ({ id: 's:1', ligneId: 'salaire', montant: 250000, du: '2026-10-01', au: '2026-10-05' }),
    op({ centimes: 250000, jour: '2026-10-02', libelle: 'VIR SALAIRE' }),
    reglages(),
  );
  verifier('5.4 une rentrée sur une ligne de ressource n’est pas un remboursement',
    !p.remboursement);
  egal('5.5 et l’écart au prévu est nul', p.ecartAuPrevu, 0);
}

/* ── 6. Un vers plusieurs : le loyer en deux virements ────────────────── */

{
  const operations = [
    op({ id: 'A', centimes: -40000, jour: '2026-10-04' }),
    op({ id: 'B', centimes: -38000, jour: '2026-10-06' }),
  ];
  const g = grouperVers(occ(), operations, TOLERANCE_PAR_DEFAUT);
  verifier('6.1 deux virements font le loyer', g !== null);
  egal('6.2 les deux sont retenus', g?.operationIds, ['A', 'B']);
  egal('6.3 et leur somme est exacte', g?.somme, -78000);
  verifier('6.4 le critère de montant est satisfait', g?.critere.dans === true);
}

{
  const operations = [
    op({ id: 'A', centimes: -40000, jour: '2026-10-04' }),
    op({ id: 'B', centimes: -20000, jour: '2026-10-06' }),
  ];
  egal('6.5 deux virements qui ne font pas le compte ne groupent pas',
    grouperVers(occ(), operations, TOLERANCE_PAR_DEFAUT), null);
}

{
  const operations = [op({ id: 'A', centimes: -78000, jour: '2026-10-04' })];
  egal('6.6 une seule opération n’est pas un groupe : c’est un appariement simple',
    grouperVers(occ(), operations, TOLERANCE_PAR_DEFAUT), null);
}

{
  const operations = [
    op({ id: 'A', centimes: -40000, jour: '2026-09-28' }),
    op({ id: 'B', centimes: -38000, jour: '2026-10-06' }),
  ];
  egal('6.7 une opération hors de la fenêtre n’entre pas dans le groupe',
    grouperVers(occ(), operations, TOLERANCE_PAR_DEFAUT), null);
}

/* ── 7. Plusieurs vers un : le prélèvement groupé ─────────────────────── */

{
  const o = op({ id: 'G', centimes: -10000 });
  const parts = diviser(o, [
    { occurrenceId: 'a', centimes: -3333 },
    { occurrenceId: 'b', centimes: -3333 },
    { occurrenceId: 'c', centimes: -3333 },
  ]);
  egal('7.1 les parts somment exactement à l’opération',
    parts.reduce((s, p) => s + p.centimes, 0), -10000);
  egal('7.2 le reste va à la dernière', parts[2].centimes, -3334);
  egal('7.3 et le contrôle est satisfait', controlerParts(o, parts), []);
}

{
  const o = op({ id: 'G', centimes: -10000 });
  const fausses = [
    { operationId: 'G', occurrenceId: 'a', centimes: -5000 },
    { operationId: 'G', occurrenceId: 'b', centimes: -4000 },
  ];
  verifier('7.4 des parts qui ne somment pas sont refusées',
    controlerParts(o, fausses).some((p) => p.includes('somme pas')));
  verifier('7.5 et le message dit la conséquence',
    controlerParts(o, fausses).some((p) => p.includes('rapprochement de solde')));
}

verifier('7.6 une part de zéro est refusée',
  controlerParts(op({ centimes: -100 }), [
    { operationId: 'OP1', occurrenceId: 'a', centimes: -100 },
    { operationId: 'OP1', occurrenceId: 'b', centimes: 0 },
  ]).some((p) => p.includes('part de zéro')));

/* ── 8. Le débit différé, et les virements internes ───────────────────── */

{
  /*
     Le prélèvement mensuel de la carte est un virement interne : il apparie
     deux comptes et ne doit pas entrer au budget. L'y laisser compterait
     deux fois les dépenses du mois — une fois à l'achat, une fois au
     prélèvement.
  */
  const operations = [
    op({ id: 'ACHAT', centimes: -4390, jour: '2026-10-09', libelle: 'SARL LE PETIT MARCHE' }),
    op({ id: 'PRLV', centimes: -4390, jour: '2026-10-31', libelle: 'PRLV CARTE DIFFERE',
      transfertAvec: 'MIROIR' }),
  ];
  const file = construireLaFile(
    [occ({ id: 'c:1', ligneId: 'courses', montant: 4390, du: '2026-10-25', au: '2026-11-05' })],
    operations,
    reglages({ sensParLigne: { courses: 'charge' } }),
  );
  verifier('8.1 le prélèvement de carte n’est jamais proposé',
    ![...file.certaines, ...file.probables].some((p) => p.operationId === 'PRLV'));
  verifier('8.2 ni rangé dans « à classer »',
    !file.aClasser.some((o) => o.id === 'PRLV'));
  verifier('8.3 l’achat, lui, reste à classer', file.aClasser.some((o) => o.id === 'ACHAT'));
}

/* ── 9. La file ───────────────────────────────────────────────────────── */

{
  const motifs: Motif[] = [
    { ligneId: 'loyer', fragment: 'DUPONT', vu: 9 },
    { ligneId: 'electricite', fragment: 'EDF', vu: 11 },
  ];
  const occurrences = [
    occ(),
    occ({ id: 'e:1', ligneId: 'electricite', montant: 9500, jour: '2026-10-15',
      du: '2026-10-12', au: '2026-10-18' }),
  ];
  const operations = [
    op({ id: 'L', centimes: -78000, jour: '2026-10-05', libelle: 'VIR M DUPONT LOYER' }),
    op({ id: 'E', centimes: -11240, jour: '2026-10-12', libelle: 'PRLV EDF CLIENTS' }),
    op({ id: 'X', centimes: -4390, jour: '2026-10-09', libelle: 'SARL LE PETIT MARCHE' }),
  ];
  const file = construireLaFile(occurrences, operations, reglages({ motifs }));
  egal('9.1 une certaine : le loyer exact', file.certaines.map((p) => p.operationId), ['L']);
  egal('9.2 une probable : l’électricité hors tolérance',
    file.probables.map((p) => p.operationId), ['E']);
  egal('9.3 une à classer : rien ne lui correspond',
    file.aClasser.map((o) => o.id), ['X']);
}

{
  /*
     L'exclusivité. Sans elle, la même opération apparaîtrait sous plusieurs
     lignes, et confirmer les deux produirait un double comptage.
  */
  const occurrences = [
    occ({ id: 'a:1', ligneId: 'a', montant: 5000, du: '2026-10-01', au: '2026-10-10' }),
    occ({ id: 'b:1', ligneId: 'b', montant: 5000, du: '2026-10-01', au: '2026-10-10' }),
  ];
  const operations = [op({ id: 'U', centimes: -5000, jour: '2026-10-05', libelle: 'QUELQUE CHOSE' })];
  const file = construireLaFile(occurrences, operations,
    reglages({ sensParLigne: { a: 'charge', b: 'charge' } }));
  const toutes = [...file.certaines, ...file.probables];
  egal('9.4 une opération ne reçoit qu’une proposition', toutes.length, 1);
}

{
  const occurrences = [occ({ id: 'a:1', ligneId: 'a', montant: 5000, du: '2026-10-01', au: '2026-10-10' })];
  const operations = [
    op({ id: 'U', centimes: -5000, jour: '2026-10-05', libelle: 'UN' }),
    op({ id: 'V', centimes: -5000, jour: '2026-10-06', libelle: 'DEUX' }),
  ];
  const file = construireLaFile(occurrences, operations, reglages({ sensParLigne: { a: 'charge' } }));
  egal('9.5 une occurrence non plus', [...file.certaines, ...file.probables].length, 1);
  egal('9.6 et l’autre opération va à classer', file.aClasser.map((o) => o.id), ['V']);
}

{
  const file = construireLaFile([], [op({ id: 'Z' })], reglages());
  egal('9.7 sans aucune ligne, tout est à classer', file.aClasser.map((o) => o.id), ['Z']);
  egal('9.8 et rien n’est proposé', [...file.certaines, ...file.probables], []);
}

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
