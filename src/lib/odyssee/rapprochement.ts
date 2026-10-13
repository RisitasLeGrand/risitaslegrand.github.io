/**
 * Le rapprochement — Finances, phase 3.
 *
 * `appariement.ts` **propose** ; ce module **décide, conserve et mesure**. La
 * séparation n'est pas cosmétique : elle permet de rejouer un appariement sur
 * des réglages modifiés sans toucher à une seule décision déjà prise.
 *
 * Trois choses vivent ici.
 *
 * ## 1. Les décisions
 *
 * Un `Rapprochement` relie une opération à une occurrence, et porte **qui** a
 * décidé. C'est la seule donnée qui compte lors d'un conflit : deux appareils
 * qui rapprochent la même opération différemment gardent les deux décisions,
 * et **la décision confirmée l'emporte sur la décision automatique, quelle
 * que soit l'heure**. « Le dernier gagne » laisserait une machine défaire un
 * choix humain au prochain import — c'est exactement ce qu'il ne faut pas.
 *
 * ## 2. Le rapprochement de solde, et la recherche de causes
 *
 * `reconcilier()` (dans `finances.ts`) dit *qu'il y a* un écart. Savoir cela
 * sans savoir d'où il vient ne sert à rien : un écart de 43,90 € sur trois
 * cents opérations est un message qui dit « cherchez ». Ce module cherche à
 * la place, et propose des causes vérifiables une par une.
 *
 * ## 3. Les écarts par ligne, catégorie et mois
 *
 * Le prévu moins le réel, agrégé sur trois axes. Avec une règle qui n'est pas
 * un détail : **une occurrence future n'est pas un écart**. Une ligne de loyer
 * dont l'échéance du 5 novembre n'est pas encore arrivée n'est pas « en
 * avance de 780 € » ; elle n'est pas encore due. Compter les occurrences non
 * échues ferait de chaque début de mois une alerte généralisée.
 */
import { euros, type Centimes, type OperationBancaire } from './finances';
import {
  largeurTolerance,
  type LigneBudget,
  type Occurrence,
  type Tolerance,
} from './budget';
import { normaliser } from './appariement';

/* ══════════════════════════════════════════════════════════════════════════
   Les décisions
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Comment la décision a été prise.
 *
 * - `automatique` : le système était certain, il a appliqué et annoncé.
 * - `confirme` : la personne a validé une proposition.
 * - `manuel` : la personne a rattaché elle-même, sans proposition.
 * - `refuse` : la personne a dit non. Conservé, et pour une raison : sans
 *   trace du refus, le prochain import reproposerait le même appariement, et
 *   le refus devrait être répété à chaque fois.
 * - `horsBudget` : l'opération existe, mais n'entre dans aucune ligne.
 */
export type TypeDeRapprochement =
  | 'automatique'
  | 'confirme'
  | 'manuel'
  | 'refuse'
  | 'horsBudget';

/** Les types où la personne a parlé. Ils gagnent tout conflit. */
export const TYPES_HUMAINS: readonly TypeDeRapprochement[] = [
  'confirme',
  'manuel',
  'refuse',
  'horsBudget',
];

export const humain = (t: TypeDeRapprochement): boolean => TYPES_HUMAINS.includes(t);

export interface Rapprochement {
  /** `<operationId>→<occurrenceId>`, ou `<operationId>→∅` hors budget. */
  id: string;
  operationId: string;
  /** `null` pour un hors-budget ou un refus sans cible. */
  occurrenceId: string | null;
  ligneId: string | null;
  type: TypeDeRapprochement;
  /** La part de l'opération affectée à cette occurrence, signée. */
  centimes: Centimes;
  /** L'écart au prévu conservé, signé. `null` quand il n'y a pas de prévu. */
  ecartAuPrevu: Centimes | null;
  /** L'appareil qui a décidé, pour nommer un conflit plutôt que le taire. */
  appareil: string;
  decideLe: string;
  majLe: string;
}

export function identifiantDeRapprochement(
  operationId: string,
  occurrenceId: string | null,
): string {
  return `${operationId}→${occurrenceId ?? '∅'}`;
}

export function controlerRapprochement(r: Rapprochement): string[] {
  const problemes: string[] = [];
  if (r.id !== identifiantDeRapprochement(r.operationId, r.occurrenceId)) {
    problemes.push('L’identifiant d’un rapprochement se dérive de ses deux bouts.');
  }
  if (r.occurrenceId !== null && r.ligneId === null) {
    problemes.push('Un rapprochement vers une occurrence porte sa ligne : les écarts se rangent par ligne.');
  }
  if (r.type === 'horsBudget' && r.occurrenceId !== null) {
    problemes.push('« Hors budget » et une occurrence ensemble ne veulent rien dire.');
  }
  if (!Number.isInteger(r.centimes)) {
    problemes.push('Les montants sont des centimes entiers.');
  }
  return problemes;
}

/**
 * Deux décisions sur la même opération : laquelle vaut.
 *
 * L'ordre est : **humain avant machine**, puis la plus récente des deux. Il
 * ne regarde l'heure qu'entre décisions de même rang, et c'est tout l'objet :
 * un appareil qui réimporte un relevé le lendemain ne doit pas pouvoir
 * écraser ce qui a été confirmé la veille.
 *
 * Rend aussi le `conflit`, parce qu'un désaccord silencieusement résolu reste
 * un désaccord : l'écran le signale, les deux décisions sont conservées.
 */
export interface Arbitrage {
  retenu: Rapprochement;
  ecarte: Rapprochement;
  conflit: boolean;
  raison: string;
}

export function arbitrer(a: Rapprochement, b: Rapprochement): Arbitrage {
  const memeCible = a.occurrenceId === b.occurrenceId && a.type === b.type;
  const conflit = !memeCible && a.appareil !== b.appareil;

  if (humain(a.type) !== humain(b.type)) {
    const [retenu, ecarte] = humain(a.type) ? [a, b] : [b, a];
    return {
      retenu,
      ecarte,
      conflit,
      raison:
        'Une décision prise par vous l’emporte sur une décision automatique, quelle que soit l’heure.',
    };
  }
  const [retenu, ecarte] = a.decideLe >= b.decideLe ? [a, b] : [b, a];
  return {
    retenu,
    ecarte,
    conflit,
    raison:
      humain(a.type)
        ? 'Deux décisions prises par vous : la plus récente vaut.'
        : 'Deux décisions automatiques : la plus récente vaut.',
  };
}

/**
 * Réduit un paquet de rapprochements à l'état retenu, et liste les conflits.
 *
 * Le regroupement se fait par **opération**, pas par paire : le conflit à
 * nommer est « cette opération a été rangée à deux endroits », et le voir
 * demande de comparer des cibles différentes.
 *
 * Une exception, et elle est nécessaire : une opération **divisée** porte
 * plusieurs rapprochements légitimes vers des occurrences différentes. On les
 * reconnaît à ce qu'ils ne couvrent pas chacun l'opération entière, et on les
 * garde tous.
 */
export interface EtatDesRapprochements {
  retenus: readonly Rapprochement[];
  conflits: readonly { operationId: string; raison: string; decisions: readonly Rapprochement[] }[];
}

export function resoudre(
  rapprochements: readonly Rapprochement[],
  operations: readonly OperationBancaire[],
): EtatDesRapprochements {
  const montantDe = new Map(operations.map((o) => [o.id, o.centimes]));
  const parOperation = new Map<string, Rapprochement[]>();
  for (const r of rapprochements) {
    const liste = parOperation.get(r.operationId) ?? [];
    liste.push(r);
    parOperation.set(r.operationId, liste);
  }

  const retenus: Rapprochement[] = [];
  const conflits: { operationId: string; raison: string; decisions: Rapprochement[] }[] = [];

  for (const [operationId, liste] of [...parOperation].sort((x, y) => x[0].localeCompare(y[0]))) {
    if (liste.length === 1) {
      retenus.push(liste[0]);
      continue;
    }
    const total = montantDe.get(operationId);
    const somme = liste.reduce((s, r) => s + r.centimes, 0);
    const divisee =
      total !== undefined && somme === total && liste.every((r) => r.centimes !== total);
    if (divisee) {
      retenus.push(...liste);
      continue;
    }
    let courant = liste[0];
    let raison = '';
    let conflit = false;
    for (const suivant of liste.slice(1)) {
      const a = arbitrer(courant, suivant);
      courant = a.retenu;
      raison = a.raison;
      conflit ||= a.conflit;
    }
    retenus.push(courant);
    if (conflit) conflits.push({ operationId, raison, decisions: liste });
  }

  return { retenus, conflits };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le rapprochement de solde, et la recherche de causes
   ══════════════════════════════════════════════════════════════════════════ */

export type NatureDeCause =
  | 'operationEnDouble'
  | 'montantAuSigneInverse'
  | 'operationManquante'
  | 'chiffresIntervertis'
  | 'virguleDeplacee';

export interface Cause {
  nature: NatureDeCause;
  /** Ce qu'il faudrait corriger, en une phrase vérifiable. */
  phrase: string;
  /** Les opérations à regarder. Vide quand la cause est une absence. */
  operationIds: readonly string[];
  /** De combien cette cause expliquerait l'écart. */
  expliquerait: Centimes;
  /** Vrai quand elle l'explique **entièrement**. */
  suffit: boolean;
}

const abs = Math.abs;

/** Deux nombres dont les chiffres se répondent à une transposition près. */
function transpositionDe(a: number, b: number): boolean {
  const ca = String(abs(a));
  const cb = String(abs(b));
  if (ca.length !== cb.length || ca === cb) return false;
  const differents = [...ca].map((c, i) => (c === cb[i] ? -1 : i)).filter((i) => i >= 0);
  if (differents.length !== 2) return false;
  const [i, j] = differents;
  return ca[i] === cb[j] && ca[j] === cb[i];
}

/**
 * D'où vient l'écart de solde.
 *
 * Cinq natures, et elles ne sont pas choisies au hasard : ce sont les cinq
 * accidents qu'un relevé lu par une machine produit réellement. Un doublon
 * quand deux imports se chevauchent, un signe inversé quand une colonne
 * « crédit » est prise pour un débit, une opération perdue quand un caractère
 * de marge décale une ligne — celle-là a coûté onze opérations sur 278 lors
 * de l'écriture de l'analyseur, sans rien signaler, et c'est le solde seul
 * qui l'a dit. Les deux dernières, chiffres intervertis et virgule déplacée,
 * sont les fautes de la saisie à la main.
 *
 * **Aucune cause n'est appliquée.** Chacune est une hypothèse à vérifier sur
 * le relevé papier. Corriger automatiquement un solde en inventant une
 * opération serait fabriquer la concordance au lieu de la constater.
 */
export function chercherLesCauses(
  operations: readonly OperationBancaire[],
  ecart: Centimes,
): Cause[] {
  if (ecart === 0) return [];
  const causes: Cause[] = [];

  /*
     Un doublon : la banque dit **moins** que nos opérations, d'exactement le
     montant d'une opération présente deux fois.
  */
  const vues = new Map<string, OperationBancaire[]>();
  for (const o of operations) {
    const cle = `${o.jour}|${o.centimes}|${normaliser(o.libelle)}`;
    vues.set(cle, [...(vues.get(cle) ?? []), o]);
  }
  for (const [, liste] of vues) {
    if (liste.length < 2) continue;
    const enTrop = liste[0].centimes * (liste.length - 1);
    if (-enTrop === ecart) {
      causes.push({
        nature: 'operationEnDouble',
        phrase:
          `« ${liste[0].libelle} » du ${liste[0].jour} apparaît ${liste.length} fois pour ` +
          `${euros(liste[0].centimes)}. Une seule suffirait à faire boucler le compte.`,
        operationIds: liste.map((o) => o.id),
        expliquerait: -enTrop,
        suffit: true,
      });
    }
  }

  /*
     Un signe inversé déplace le solde de **deux fois** le montant : l'écart
     cherché est donc pair, et la moitié doit se retrouver sur le relevé.
  */
  if (ecart % 2 === 0) {
    for (const o of operations) {
      if (o.centimes !== -ecart / 2) continue;
      causes.push({
        nature: 'montantAuSigneInverse',
        phrase:
          `« ${o.libelle} » du ${o.jour} vaut ${euros(o.centimes)}. Au signe inverse, ` +
          'le compte boucle : vérifiez la colonne débit ou crédit sur le relevé.',
        operationIds: [o.id],
        expliquerait: ecart,
        suffit: true,
      });
    }
  }

  /*
     Chiffres intervertis et virgule déplacée : on cherche l'opération dont la
     correction vaudrait exactement l'écart. `juste = o.centimes + ecart`.
  */
  for (const o of operations) {
    const juste = o.centimes + ecart;
    if (juste === 0 || juste === o.centimes) continue;
    if (transpositionDe(o.centimes, juste)) {
      causes.push({
        nature: 'chiffresIntervertis',
        phrase:
          `« ${o.libelle} » du ${o.jour} est enregistrée à ${euros(o.centimes)}. ` +
          `À ${euros(juste)} — deux chiffres échangés — le compte boucle.`,
        operationIds: [o.id],
        expliquerait: ecart,
        suffit: true,
      });
    } else if (juste === o.centimes * 10 || juste * 10 === o.centimes) {
      causes.push({
        nature: 'virguleDeplacee',
        phrase:
          `« ${o.libelle} » du ${o.jour} est enregistrée à ${euros(o.centimes)}. ` +
          `À ${euros(juste)} — la virgule d’un rang — le compte boucle.`,
        operationIds: [o.id],
        expliquerait: ecart,
        suffit: true,
      });
    }
  }

  /*
     Et le cas qui reste, qui est aussi le plus fréquent : il manque une
     opération. On ne peut rien montrer — c'est une absence — mais on peut
     dire son montant et son sens exacts, ce qui suffit à la retrouver sur le
     relevé en quelques secondes.
  */
  causes.push({
    nature: 'operationManquante',
    phrase:
      `Une opération de ${euros(ecart)} manquerait à l’appel. ` +
      (ecart > 0
        ? 'La banque compte plus que nos opérations : cherchez une entrée non lue.'
        : 'La banque compte moins que nos opérations : cherchez une sortie en trop.'),
    operationIds: [],
    expliquerait: ecart,
    suffit: true,
  });

  const rang: Record<NatureDeCause, number> = {
    operationEnDouble: 0,
    montantAuSigneInverse: 1,
    chiffresIntervertis: 2,
    virguleDeplacee: 3,
    operationManquante: 4,
  };
  return causes.sort((a, b) => rang[a.nature] - rang[b.nature]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les écarts par ligne, catégorie et mois
   ══════════════════════════════════════════════════════════════════════════ */

export interface EcartDeLigne {
  ligneId: string;
  libelle: string;
  categorie: string;
  /** La somme des occurrences **échues** de la période. Toujours positive. */
  prevu: Centimes;
  /**
   * Ce qui a été rapproché sur ces occurrences, **dans le sens de la ligne**.
   *
   * Donc positif pour une charge payée, positif pour une ressource encaissée
   * — et **négatif** quand une ligne de charge a reçu plus de remboursements
   * qu'elle n'a coûté. Ce dernier cas est la raison d'être de la règle : j'y
   * prenais d'abord la valeur absolue, ce qui faisait lire un remboursement
   * net de 20 € comme 20 € dépensés, soit un écart de 40 € dans le mauvais
   * sens sur la seule ligne où la personne avait récupéré de l'argent.
   */
  reel: Centimes;
  /** Réel moins prévu. Positif : dépensé plus que prévu sur une charge. */
  ecart: Centimes;
  /** `null` quand il n'y a rien de prévu : on ne divise pas par zéro. */
  ecartRelatif: number | null;
  /** Hors de la tolérance de la ligne. */
  horsTolerance: boolean;
  /** Occurrences de la période pas encore échues : montant, pour mémoire. */
  aVenir: Centimes;
  /** Occurrences échues sans aucun rapprochement. */
  nonRapprochees: number;
}

/**
 * Le prévu contre le réel, ligne par ligne.
 *
 * `arreteAu` est le jour jusqu'auquel on compte les échéances comme dues. Il
 * est **un paramètre**, et pas `new Date()` lu à l'intérieur : un calcul qui
 * lit l'horloge ne peut être ni rejoué ni testé à midi comme à minuit.
 */
export function ecartsParLigne(
  lignes: readonly LigneBudget[],
  occurrences: readonly Occurrence[],
  rapprochements: readonly Rapprochement[],
  tolerance: Tolerance,
  arreteAu: string,
): EcartDeLigne[] {
  const parLigne = new Map<string, LigneBudget>(lignes.map((l) => [l.id, l]));
  const partsParOccurrence = new Map<string, Centimes>();
  for (const r of rapprochements) {
    if (r.occurrenceId === null || r.type === 'refuse' || r.type === 'horsBudget') continue;
    partsParOccurrence.set(
      r.occurrenceId,
      (partsParOccurrence.get(r.occurrenceId) ?? 0) + r.centimes,
    );
  }

  const sorties = new Map<string, EcartDeLigne>();
  for (const occ of occurrences) {
    const ligne = parLigne.get(occ.ligneId);
    if (!ligne) continue;
    let e = sorties.get(occ.ligneId);
    if (!e) {
      e = {
        ligneId: occ.ligneId,
        libelle: ligne.libelle,
        categorie: ligne.categorie || 'Sans catégorie',
        prevu: 0,
        reel: 0,
        ecart: 0,
        ecartRelatif: null,
        horsTolerance: false,
        aVenir: 0,
        nonRapprochees: 0,
      };
      sorties.set(occ.ligneId, e);
    }
    const attendu = abs(occ.montant);
    if (occ.jour > arreteAu) {
      e.aVenir += attendu;
      continue;
    }
    e.prevu += attendu;
    const part = partsParOccurrence.get(occ.id);
    if (part === undefined) e.nonRapprochees += 1;
    else e.reel += occ.signe * part;
  }

  for (const e of sorties.values()) {
    e.ecart = e.reel - e.prevu;
    e.ecartRelatif = e.prevu === 0 ? null : e.ecart / e.prevu;
    e.horsTolerance = abs(e.ecart) > largeurTolerance(e.prevu, tolerance);
  }
  return [...sorties.values()].sort((a, b) => a.ligneId.localeCompare(b.ligneId));
}

export interface EcartAgrege {
  cle: string;
  prevu: Centimes;
  reel: Centimes;
  ecart: Centimes;
  ecartRelatif: number | null;
}

function agreger(ecarts: readonly EcartDeLigne[], cleDe: (e: EcartDeLigne) => string): EcartAgrege[] {
  const par = new Map<string, EcartAgrege>();
  for (const e of ecarts) {
    const cle = cleDe(e);
    const a = par.get(cle) ?? { cle, prevu: 0, reel: 0, ecart: 0, ecartRelatif: null };
    a.prevu += e.prevu;
    a.reel += e.reel;
    par.set(cle, a);
  }
  for (const a of par.values()) {
    a.ecart = a.reel - a.prevu;
    a.ecartRelatif = a.prevu === 0 ? null : a.ecart / a.prevu;
  }
  return [...par.values()].sort((x, y) => x.cle.localeCompare(y.cle));
}

export const ecartsParCategorie = (ecarts: readonly EcartDeLigne[]): EcartAgrege[] =>
  agreger(ecarts, (e) => e.categorie);

/**
 * Par mois, sur la même règle d'échéance.
 *
 * Le mois d'un écart est celui de l'**occurrence**, jamais celui de
 * l'opération qui l'a soldée. Un loyer de novembre payé le 29 octobre reste
 * une charge de novembre : le ranger en octobre ferait un mois à deux loyers
 * et un mois à zéro, deux fois par an, pour un fait sans conséquence.
 */
export function ecartsParMois(
  lignes: readonly LigneBudget[],
  occurrences: readonly Occurrence[],
  rapprochements: readonly Rapprochement[],
  tolerance: Tolerance,
  arreteAu: string,
): EcartAgrege[] {
  const mois = [...new Set(occurrences.map((o) => o.jour.slice(0, 7)))].sort();
  return mois.map((m) => {
    const duMois = occurrences.filter((o) => o.jour.slice(0, 7) === m);
    const lignesDuMois = ecartsParLigne(lignes, duMois, rapprochements, tolerance, arreteAu);
    const total = lignesDuMois.reduce(
      (s, e) => ({ prevu: s.prevu + e.prevu, reel: s.reel + e.reel }),
      { prevu: 0, reel: 0 },
    );
    return {
      cle: m,
      prevu: total.prevu,
      reel: total.reel,
      ecart: total.reel - total.prevu,
      ecartRelatif: total.prevu === 0 ? null : (total.reel - total.prevu) / total.prevu,
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerLeRapprochement(): string[] {
  const problemes: string[] = [];

  /*
     La règle du conflit est la seule chose de ce module dont une erreur se
     verrait des mois plus tard : un import mensuel qui défait, à chaque fois
     et sans bruit, ce qui a été confirmé le mois d'avant. On la vérifie donc
     ici, sur un cas monté exprès où la machine a parlé **après** la personne.
  */
  const base = {
    operationId: 'o1',
    ligneId: 'l1',
    centimes: -1000,
    ecartAuPrevu: 0,
    majLe: '2026-10-01T00:00:00.000Z',
  };
  const personne: Rapprochement = {
    ...base,
    id: identifiantDeRapprochement('o1', 'a'),
    occurrenceId: 'a',
    type: 'confirme',
    appareil: 'portable',
    decideLe: '2026-10-01T08:00:00.000Z',
  };
  const machine: Rapprochement = {
    ...base,
    id: identifiantDeRapprochement('o1', 'b'),
    occurrenceId: 'b',
    type: 'automatique',
    appareil: 'bureau',
    decideLe: '2026-11-30T23:59:00.000Z',
  };
  const a = arbitrer(personne, machine);
  if (a.retenu.type !== 'confirme') {
    problemes.push(
      'Une décision automatique postérieure l’emporte sur une confirmation : à chaque import, ' +
        'la machine déferait ce qui a été rangé à la main.',
    );
  }
  if (!a.conflit) {
    problemes.push('Un désaccord résolu sans être signalé reste un désaccord.');
  }
  if (!TYPES_HUMAINS.includes('refuse')) {
    problemes.push(
      'Un refus qui ne vaut pas décision serait reproposé au prochain import, indéfiniment.',
    );
  }
  return problemes;
}

/** Utilisé par l'écran : la fenêtre d'une occurrence, en clair. */
export const fenetreDe = (occ: Occurrence): string =>
  occ.du === occ.au ? `le ${occ.jour}` : `du ${occ.du} au ${occ.au}`;
