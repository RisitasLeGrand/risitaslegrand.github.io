/**
 * Essais du rapprochement — Finances, phase 3.
 *
 * Trois choses à tenir, et chacune échoue d'une façon différente.
 *
 *  1. **Le conflit.** Son erreur ne se verrait qu'au bout de plusieurs mois :
 *     un import qui défait, sans bruit, ce qui a été rangé à la main.
 *  2. **La recherche de causes.** Son erreur est d'accuser à tort — une cause
 *     fausse coûte une demi-heure de vérification sur un relevé papier.
 *  3. **Les écarts.** Leur erreur est de compter une échéance non échue comme
 *     un écart, ce qui ferait de chaque début de mois une alerte générale.
 */
import {
  TOLERANCE_PAR_DEFAUT,
  type LigneBudget,
  type Occurrence,
} from '../src/lib/odyssee/budget';
import type { OperationBancaire } from '../src/lib/odyssee/finances';
import { reconcilier } from '../src/lib/odyssee/finances';
import {
  TYPES_HUMAINS,
  arbitrer,
  chercherLesCauses,
  controlerLeRapprochement,
  controlerRapprochement,
  ecartsParCategorie,
  ecartsParLigne,
  ecartsParMois,
  fenetreDe,
  humain,
  identifiantDeRapprochement,
  resoudre,
  type Rapprochement,
  type TypeDeRapprochement,
} from '../src/lib/odyssee/rapprochement';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const rap = (p: Partial<Rapprochement> & { operationId: string; occurrenceId: string | null }): Rapprochement => ({
  id: identifiantDeRapprochement(p.operationId, p.occurrenceId),
  ligneId: p.occurrenceId === null ? null : 'loyer',
  type: 'automatique' as TypeDeRapprochement,
  centimes: -78000,
  ecartAuPrevu: 0,
  appareil: 'bureau',
  decideLe: '2026-10-05T10:00:00.000Z',
  majLe: '2026-10-05T10:00:00.000Z',
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

const ligne = (p: Partial<LigneBudget> = {}): LigneBudget => ({
  id: 'loyer',
  libelle: 'Loyer',
  categorie: 'Logement',
  sens: 'charge',
  compteId: null,
  essentielle: true,
  motifs: [],
  versions: [{
    depuis: '2026-01-01', jusqua: null, montant: 78000, nature: 'fixe',
    montantHaut: null, periodicite: 'mensuelle', jourAttendu: 5,
    tolerance: TOLERANCE_PAR_DEFAUT,
  }],
  note: '',
  majLe: '2026-01-01T00:00:00.000Z',
  ...p,
});

/* ── 1. Les décisions, et la règle du conflit ─────────────────────────── */

console.log('\n1. LA DÉCISION PRISE À LA MAIN L’EMPORTE');

{
  egal('1.1 l’identifiant se dérive des deux bouts',
    identifiantDeRapprochement('OP1', 'loyer:2026-10-05'), 'OP1→loyer:2026-10-05');
  egal('1.2 et un hors-budget n’a pas de cible',
    identifiantDeRapprochement('OP1', null), 'OP1→∅');
}

{
  /*
     Le cas qui compte : la personne a confirmé le 1er octobre, un import du
     30 novembre propose autre chose automatiquement. Si l'heure décidait,
     chaque import mensuel défaire le mois précédent.
  */
  const personne = rap({ operationId: 'OP1', occurrenceId: 'a', type: 'confirme', appareil: 'portable', decideLe: '2026-10-01T08:00:00.000Z' });
  const machine = rap({ operationId: 'OP1', occurrenceId: 'b', type: 'automatique', decideLe: '2026-11-30T23:59:00.000Z' });
  const a = arbitrer(personne, machine);
  egal('1.3 la confirmation l’emporte sur l’automatique postérieur', a.retenu.type, 'confirme');
  verifier('1.4 et l’ordre des arguments ne change rien',
    arbitrer(machine, personne).retenu.type === 'confirme');
  verifier('1.5 le désaccord est signalé, pas tu', a.conflit);
  verifier('1.6 et la raison le dit en clair', a.raison.includes('quelle que soit l’heure'), a.raison);
}

{
  const vieille = rap({ operationId: 'OP1', occurrenceId: 'a', type: 'confirme', decideLe: '2026-10-01T08:00:00.000Z' });
  const recente = rap({ operationId: 'OP1', occurrenceId: 'b', type: 'manuel', appareil: 'portable', decideLe: '2026-10-09T08:00:00.000Z' });
  egal('1.7 entre deux décisions humaines, la plus récente vaut',
    arbitrer(vieille, recente).retenu.occurrenceId, 'b');
}

{
  verifier('1.8 un refus est une décision humaine', humain('refuse'));
  verifier('1.9 un hors-budget aussi', humain('horsBudget'));
  verifier('1.10 l’automatique non', !humain('automatique'));
  egal('1.11 et la liste ne contient rien d’autre', [...TYPES_HUMAINS].sort(),
    ['confirme', 'horsBudget', 'manuel', 'refuse']);
}

{
  const r = rap({ operationId: 'OP1', occurrenceId: 'loyer:2026-10-05' });
  egal('1.12 un rapprochement bien formé ne pose aucun problème', controlerRapprochement(r), []);
  verifier('1.13 un identifiant bricolé est refusé',
    controlerRapprochement({ ...r, id: 'autre-chose' }).length === 1);
  verifier('1.14 une occurrence sans ligne est refusée',
    controlerRapprochement({ ...r, ligneId: null }).some((p) => p.includes('porte sa ligne')));
  verifier('1.15 « hors budget » avec une occurrence est refusé',
    controlerRapprochement({ ...r, type: 'horsBudget' }).some((p) => p.includes('ne veulent rien dire')));
  verifier('1.16 un montant à virgule est refusé',
    controlerRapprochement({ ...r, centimes: 12.5 }).some((p) => p.includes('centimes entiers')));
}

console.log('\n2. UNE OPÉRATION DIVISÉE N’EST PAS UN CONFLIT');

{
  /*
     Deux rapprochements sur la même opération ne sont pas toujours un
     désaccord : un prélèvement groupé en porte un par ligne. On les reconnaît
     à ce que leurs parts somment à l'opération sans qu'aucune la couvre.
  */
  const operations = [op({ id: 'OP9', centimes: -10000 })];
  const parts = [
    rap({ operationId: 'OP9', occurrenceId: 'assurance:2026-10-05', centimes: -6000, ligneId: 'assurance' }),
    rap({ operationId: 'OP9', occurrenceId: 'mutuelle:2026-10-05', centimes: -4000, ligneId: 'mutuelle' }),
  ];
  const e = resoudre(parts, operations);
  egal('2.1 les deux parts sont gardées', e.retenus.length, 2);
  egal('2.2 et rien n’est signalé comme conflit', e.conflits, []);
}

{
  const operations = [op({ id: 'OP1' })];
  const decisions = [
    rap({ operationId: 'OP1', occurrenceId: 'a', type: 'confirme', appareil: 'portable', decideLe: '2026-10-01T08:00:00.000Z' }),
    rap({ operationId: 'OP1', occurrenceId: 'b', decideLe: '2026-11-30T23:59:00.000Z' }),
  ];
  const e = resoudre(decisions, operations);
  egal('2.3 un seul rapprochement est retenu', e.retenus.length, 1);
  egal('2.4 celui de la personne', e.retenus[0].occurrenceId, 'a');
  egal('2.5 le conflit est nommé', e.conflits.length, 1);
  egal('2.6 et les deux décisions sont conservées', e.conflits[0].decisions.length, 2);
}

{
  /* Deux décisions du même appareil ne sont pas un désaccord entre appareils. */
  const decisions = [
    rap({ operationId: 'OP1', occurrenceId: 'a', type: 'confirme', decideLe: '2026-10-01T08:00:00.000Z' }),
    rap({ operationId: 'OP1', occurrenceId: 'b', type: 'confirme', decideLe: '2026-10-02T08:00:00.000Z' }),
  ];
  const e = resoudre(decisions, [op()]);
  egal('2.7 se corriger soi-même n’est pas un conflit', e.conflits, []);
  egal('2.8 et c’est la correction qui vaut', e.retenus[0].occurrenceId, 'b');
}

/* ── 3. Le rapprochement de solde ─────────────────────────────────────── */

console.log('\n3. L’ÉCART DE SOLDE, ET D’OÙ IL VIENT');

{
  const operations = [
    op({ id: 'A', centimes: -310 }),
    op({ id: 'B', centimes: 22500 }),
  ];
  const r = reconcilier(operations, 'C1', 52571 + 22190, 52571);
  verifier('3.1 un compte qui boucle le dit', r.concorde);
  egal('3.2 et l’écart est nul', r.ecart, 0);
  egal('3.3 aucune cause à chercher', chercherLesCauses(operations, r.ecart), []);
}

{
  /*
     Le doublon : deux imports qui se chevauchent écrivent deux fois la même
     opération. La banque compte alors **moins** que nous.
  */
  const operations = [
    op({ id: 'A', centimes: -4390, libelle: 'SARL LE PETIT MARCHE', jour: '2026-10-09' }),
    op({ id: 'B', centimes: -4390, libelle: 'SARL LE PETIT MARCHE', jour: '2026-10-09' }),
    op({ id: 'C', centimes: -1000 }),
  ];
  const causes = chercherLesCauses(operations, 4390);
  egal('3.4 le doublon vient en tête', causes[0].nature, 'operationEnDouble');
  egal('3.5 il montre les deux opérations', causes[0].operationIds, ['A', 'B']);
  verifier('3.6 et la phrase est vérifiable sur le relevé',
    causes[0].phrase.includes('2 fois') && causes[0].phrase.includes('43,90'), causes[0].phrase);
  verifier('3.7 il explique tout l’écart', causes[0].suffit);
}

{
  /*
     Le signe inversé : une colonne « crédit » prise pour un débit déplace le
     solde de **deux fois** le montant.
  */
  const operations = [op({ id: 'A', centimes: -22500, libelle: 'VIR DE M ALEXIS POUSSET' })];
  const causes = chercherLesCauses(operations, 45000);
  const signe = causes.find((c) => c.nature === 'montantAuSigneInverse');
  verifier('3.8 le signe inversé est trouvé', signe !== undefined);
  verifier('3.9 et la phrase renvoie à la colonne du relevé',
    signe?.phrase.includes('débit ou crédit') ?? false, signe?.phrase);
  verifier('3.10 un écart impair exclut le signe inversé',
    !chercherLesCauses(operations, 45001).some((c) => c.nature === 'montantAuSigneInverse'));
}

{
  /* Chiffres intervertis : 4 974 au lieu de 4 794, soit 180 centimes. */
  const operations = [op({ id: 'A', centimes: -4794, libelle: 'CARREFOUR CITY' })];
  const causes = chercherLesCauses(operations, -180);
  const t = causes.find((c) => c.nature === 'chiffresIntervertis');
  verifier('3.11 la transposition est trouvée', t !== undefined, JSON.stringify(causes.map((c) => c.nature)));
  verifier('3.12 et la phrase donne le montant juste',
    t?.phrase.includes('49,74') ?? false, t?.phrase);
}

{
  /* Virgule déplacée : 129,00 saisi pour 12,90. */
  const operations = [op({ id: 'A', centimes: -12900, libelle: 'ABONNEMENT' })];
  const causes = chercherLesCauses(operations, 11610);
  const v = causes.find((c) => c.nature === 'virguleDeplacee');
  verifier('3.13 la virgule déplacée est trouvée', v !== undefined, JSON.stringify(causes.map((c) => c.nature)));
  verifier('3.14 et elle nomme le rang', v?.phrase.includes('la virgule d’un rang') ?? false, v?.phrase);
}

{
  /*
     Et le cas sans coupable : il manque une opération. On ne peut rien
     montrer, mais on peut dire son montant et son sens — ce qui suffit à la
     retrouver sur le relevé.
  */
  const causes = chercherLesCauses([op({ id: 'A', centimes: -1000 })], -4390);
  const m = causes.find((c) => c.nature === 'operationManquante');
  verifier('3.15 l’absence est toujours proposée', m !== undefined);
  egal('3.16 sans accuser aucune opération', m?.operationIds, []);
  verifier('3.17 elle dit dans quel sens chercher',
    m?.phrase.includes('une sortie en trop') ?? false, m?.phrase);
  verifier('3.18 et dans l’autre sens aussi',
    chercherLesCauses([], 4390).some((c) => c.phrase.includes('une entrée non lue')));
}

/* ── 4. Les écarts ────────────────────────────────────────────────────── */

console.log('\n4. LE PRÉVU CONTRE LE RÉEL');

{
  /*
     La règle qui tient tout le reste : au 6 octobre, l'échéance du 5 est due
     et celle du 5 novembre ne l'est pas. Compter la seconde ferait croire à
     une ligne de loyer soldée à moitié chaque début de mois.
  */
  const occurrences = [
    occ({ id: 'loyer:2026-10-05', jour: '2026-10-05' }),
    occ({ id: 'loyer:2026-11-05', jour: '2026-11-05', du: '2026-11-03', au: '2026-11-07' }),
  ];
  const rapprochements = [rap({ operationId: 'OP1', occurrenceId: 'loyer:2026-10-05', type: 'confirme' })];
  const [e] = ecartsParLigne([ligne()], occurrences, rapprochements, TOLERANCE_PAR_DEFAUT, '2026-10-06');
  egal('4.1 seule l’échéance échue est prévue', e.prevu, 78000);
  egal('4.2 celle à venir est annoncée à part', e.aVenir, 78000);
  egal('4.3 le réel la solde', e.reel, 78000);
  egal('4.4 l’écart est nul', e.ecart, 0);
  verifier('4.5 et rien n’est hors tolérance', !e.horsTolerance);
  egal('4.6 aucune occurrence échue n’est en attente', e.nonRapprochees, 0);
}

{
  /* Une facture de 112,40 € prévue à 95 € : rapprochée, et l'écart conservé. */
  const occurrences = [occ({ id: 'elec:2026-10-15', ligneId: 'electricite', jour: '2026-10-15', montant: 9500, du: '2026-10-12', au: '2026-10-18' })];
  const l = ligne({ id: 'electricite', libelle: 'Électricité', categorie: 'Logement' });
  const r = [rap({ operationId: 'OP2', occurrenceId: 'elec:2026-10-15', ligneId: 'electricite', centimes: -11240, type: 'confirme' })];
  const [e] = ecartsParLigne([l], occurrences, r, TOLERANCE_PAR_DEFAUT, '2026-10-31');
  egal('4.7 l’écart est conservé', e.ecart, 1740);
  verifier('4.8 et il est hors tolérance', e.horsTolerance);
  verifier('4.9 l’écart relatif est donné',
    e.ecartRelatif !== null && Math.abs(e.ecartRelatif - 0.1832) < 0.001, String(e.ecartRelatif));
}

{
  /* Rien de prévu : l'écart relatif est null, jamais 0 %. */
  const occurrences = [occ({ jour: '2026-11-05' })];
  const [e] = ecartsParLigne([ligne()], occurrences, [], TOLERANCE_PAR_DEFAUT, '2026-10-06');
  egal('4.10 sans prévu échu, pas d’écart relatif', e.ecartRelatif, null);
  egal('4.11 et le prévu est bien nul', e.prevu, 0);
}

{
  /* Une échéance échue que rien n'a soldée : elle se compte. */
  const occurrences = [occ()];
  const [e] = ecartsParLigne([ligne()], occurrences, [], TOLERANCE_PAR_DEFAUT, '2026-10-31');
  egal('4.12 l’échéance non rapprochée est comptée', e.nonRapprochees, 1);
  egal('4.13 et le réel reste à zéro', e.reel, 0);
  egal('4.14 l’écart dit qu’il manque le loyer entier', e.ecart, -78000);
}

{
  /* Un refus ne solde rien : c'est tout l'objet de le conserver. */
  const r = [rap({ operationId: 'OP1', occurrenceId: 'loyer:2026-10-05', type: 'refuse' })];
  const [e] = ecartsParLigne([ligne()], [occ()], r, TOLERANCE_PAR_DEFAUT, '2026-10-31');
  egal('4.15 un refus laisse l’échéance ouverte', e.nonRapprochees, 1);
  egal('4.16 et le réel à zéro', e.reel, 0);
}

{
  /* 1 → N : deux virements pour un loyer. Le réel est leur somme. */
  const r = [
    rap({ id: 'OPa→loyer:2026-10-05', operationId: 'OPa', occurrenceId: 'loyer:2026-10-05', centimes: -40000, type: 'confirme' }),
    rap({ id: 'OPb→loyer:2026-10-05', operationId: 'OPb', occurrenceId: 'loyer:2026-10-05', centimes: -38000, type: 'confirme' }),
  ];
  const [e] = ecartsParLigne([ligne()], [occ()], r, TOLERANCE_PAR_DEFAUT, '2026-10-31');
  egal('4.17 deux virements soldent une occurrence', e.reel, 78000);
  egal('4.18 l’échéance n’est plus en attente', e.nonRapprochees, 0);
  egal('4.19 et l’écart est nul', e.ecart, 0);
}

{
  const lignes = [
    ligne(),
    ligne({ id: 'electricite', libelle: 'Électricité', categorie: 'Logement' }),
    ligne({ id: 'courses', libelle: 'Courses', categorie: 'Vie courante' }),
  ];
  const occurrences = [
    occ(),
    occ({ id: 'elec:2026-10-15', ligneId: 'electricite', jour: '2026-10-15', montant: 9500 }),
    occ({ id: 'courses:2026-10-01', ligneId: 'courses', jour: '2026-10-01', montant: 40000 }),
  ];
  const r = [
    rap({ operationId: 'OP1', occurrenceId: 'loyer:2026-10-05', type: 'confirme' }),
    rap({ id: 'OP2→elec:2026-10-15', operationId: 'OP2', occurrenceId: 'elec:2026-10-15', ligneId: 'electricite', centimes: -11240, type: 'confirme' }),
    rap({ id: 'OP3→courses:2026-10-01', operationId: 'OP3', occurrenceId: 'courses:2026-10-01', ligneId: 'courses', centimes: -45000, type: 'confirme' }),
  ];
  const parLigne = ecartsParLigne(lignes, occurrences, r, TOLERANCE_PAR_DEFAUT, '2026-10-31');
  const parCategorie = ecartsParCategorie(parLigne);
  egal('4.20 deux catégories', parCategorie.map((c) => c.cle), ['Logement', 'Vie courante']);
  egal('4.21 Logement agrège loyer et électricité', parCategorie[0].prevu, 87500);
  egal('4.22 et son écart est celui de l’électricité seule', parCategorie[0].ecart, 1740);
  egal('4.23 Vie courante porte le sien', parCategorie[1].ecart, 5000);
}

{
  const lignes = [ligne()];
  const occurrences = [
    occ({ id: 'loyer:2026-09-05', jour: '2026-09-05', du: '2026-09-03', au: '2026-09-07' }),
    occ({ id: 'loyer:2026-10-05', jour: '2026-10-05' }),
    occ({ id: 'loyer:2026-11-05', jour: '2026-11-05', du: '2026-11-03', au: '2026-11-07' }),
  ];
  const r = [
    rap({ id: 'OPs→loyer:2026-09-05', operationId: 'OPs', occurrenceId: 'loyer:2026-09-05', type: 'confirme' }),
    rap({ id: 'OPo→loyer:2026-10-05', operationId: 'OPo', occurrenceId: 'loyer:2026-10-05', centimes: -80000, type: 'confirme' }),
  ];
  const mois = ecartsParMois(lignes, occurrences, r, TOLERANCE_PAR_DEFAUT, '2026-10-31');
  egal('4.24 trois mois sont rendus', mois.map((m) => m.cle), ['2026-09', '2026-10', '2026-11']);
  egal('4.25 septembre boucle', mois[0].ecart, 0);
  egal('4.26 octobre porte les 20 € de plus', mois[1].ecart, 2000);
  egal('4.27 novembre n’est pas échu : rien de prévu', mois[2].prevu, 0);
  egal('4.28 et donc aucun écart relatif', mois[2].ecartRelatif, null);
}

{
  /*
     Le mois d'un écart est celui de l'occurrence, pas de l'opération : un
     loyer de novembre payé le 29 octobre reste une charge de novembre.
  */
  const occurrences = [occ({ id: 'loyer:2026-11-05', jour: '2026-11-05', du: '2026-10-29', au: '2026-11-07' })];
  const r = [rap({ operationId: 'OPn', occurrenceId: 'loyer:2026-11-05', type: 'confirme' })];
  const mois = ecartsParMois([ligne()], occurrences, r, TOLERANCE_PAR_DEFAUT, '2026-11-30');
  egal('4.29 un seul mois, et c’est novembre', mois.map((m) => m.cle), ['2026-11']);
  egal('4.30 qui porte le réel', mois[0].reel, 78000);
}

{
  /*
     Le cas qui m'a fait relire : une ligne de charge plus remboursée qu'elle
     n'a coûté. Une mutuelle prélève 60 € et rembourse 80 € le même mois ; le
     réel de cette ligne vaut **moins vingt euros**, et non vingt. Prendre la
     valeur absolue — ce que j'avais écrit — retournait le signe sur la seule
     ligne où de l'argent était rentré.
  */
  const occurrences = [occ({ id: 'mutuelle:2026-10-05', ligneId: 'mutuelle', jour: '2026-10-05', montant: 6000 })];
  const l = ligne({ id: 'mutuelle', libelle: 'Mutuelle', categorie: 'Santé' });
  const r = [
    rap({ id: 'OPc→mutuelle:2026-10-05', operationId: 'OPc', occurrenceId: 'mutuelle:2026-10-05', ligneId: 'mutuelle', centimes: -6000, type: 'confirme' }),
    rap({ id: 'OPr→mutuelle:2026-10-05', operationId: 'OPr', occurrenceId: 'mutuelle:2026-10-05', ligneId: 'mutuelle', centimes: 8000, type: 'confirme' }),
  ];
  const [e] = ecartsParLigne([l], occurrences, r, TOLERANCE_PAR_DEFAUT, '2026-10-31');
  egal('4.31 un remboursement net rend le réel négatif', e.reel, -2000);
  egal('4.32 et l’écart dit qu’on a dépensé 80 € de moins que prévu', e.ecart, -8000);
}

{
  /* Sur une ressource, le sens est l'autre, et le réel reste positif. */
  const occurrences = [occ({ id: 'salaire:2026-10-28', ligneId: 'salaire', jour: '2026-10-28', montant: 230000, signe: 1 })];
  const l = ligne({ id: 'salaire', libelle: 'Salaire', categorie: 'Revenus', sens: 'ressource' });
  const r = [rap({ id: 'OPs2→salaire:2026-10-28', operationId: 'OPs2', occurrenceId: 'salaire:2026-10-28', ligneId: 'salaire', centimes: 235000, type: 'confirme' })];
  const [e] = ecartsParLigne([l], occurrences, r, TOLERANCE_PAR_DEFAUT, '2026-10-31');
  egal('4.33 une ressource encaissée est positive', e.reel, 235000);
  egal('4.34 et le surplus est un écart positif', e.ecart, 5000);
}

/* ── 5. Les garde-fous ────────────────────────────────────────────────── */

console.log('\n5. LES GARDE-FOUS');

{
  egal('5.1 le garde-fou du module ne trouve rien', controlerLeRapprochement(), []);
  egal('5.2 une fenêtre d’un seul jour se dit simplement',
    fenetreDe(occ({ du: '2026-10-05', au: '2026-10-05' })), 'le 2026-10-05');
  egal('5.3 et une fenêtre large aussi',
    fenetreDe(occ()), 'du 2026-10-03 au 2026-10-07');
}

console.log(
  echecs.length
    ? `\n\x1b[31m${reussis} essais réussis, ${echecs.length} échec(s).\x1b[0m\n` +
        echecs.map((e) => `  ✗ ${e}`).join('\n') + '\n'
    : `\n\x1b[32m${reussis} essais réussis, 0 échec.\x1b[0m\n`,
);
process.exit(echecs.length ? 1 : 0);
