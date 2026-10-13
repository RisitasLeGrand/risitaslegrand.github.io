/**
 * L'appariement — Finances, phase 3.
 *
 * Relier ce qui était prévu, une **occurrence** de ligne de budget, à ce qui
 * s'est passé, une **opération** de relevé. Déterministe, local, sans IA.
 *
 * ## Pourquoi chaque proposition doit dire pourquoi
 *
 * Un appariement qu'on ne peut pas contester se confirme sans être lu, et la
 * file devient un bouton « oui » répété quatorze fois. Chaque proposition
 * porte donc ses trois critères, chiffrés : l'écart au montant, l'écart à la
 * date, le motif reconnu. C'est la seule façon de rendre le refus possible,
 * et un rapprochement qu'on ne peut pas refuser n'est pas un rapprochement.
 *
 * ## Les certaines s'appliquent toutes seules
 *
 * Faire confirmer ce dont on est sûr dépense l'attention là où elle ne sert à
 * rien — or le budget d'attention est précisément ce qui fait abandonner un
 * rapprochement mensuel. Les certaines sont donc appliquées, annoncées, et
 * annulables d'un geste.
 *
 * ## Un montant différent se rapproche quand même
 *
 * Une facture de 112,40 € prévue à 95 € est rapprochée, **et l'écart est
 * conservé**. Refuser de la rapprocher produirait deux anomalies — une ligne
 * en retard et une opération orpheline — pour un fait parfaitement ordinaire.
 * L'écart, lui, est la vraie information : il nourrit la révision du budget.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne décide rien. Il **propose**, avec un niveau et une phrase. Appliquer,
 * refuser, diviser, créer une ligne : ce sont des gestes, et ils vivent
 * ailleurs. Mélanger la proposition et la décision rendrait impossible de
 * rejouer un appariement sans toucher aux données.
 */
import {
  ajouterJours,
  largeurTolerance,
  type Occurrence,
  type Tolerance,
} from './budget';
import type { Centimes, OperationBancaire } from './finances';

/* ══════════════════════════════════════════════════════════════════════════
   Les motifs
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un fragment de libellé déjà vu sur une ligne, et combien de fois.
 *
 * **Des fragments, pas des égalités.** Une banque change « PRLV EDF » en
 * « PRLV EDF CLIENTS SA » du jour au lendemain, et une correspondance exacte
 * cesserait alors de reconnaître douze mois d'historique. Le fragment, lui,
 * survit.
 */
export interface Motif {
  ligneId: string;
  /** Normalisé : majuscules, sans accent, espaces réduits. */
  fragment: string;
  /** Combien de fois ce fragment a été confirmé sur cette ligne. */
  vu: number;
}

export const normaliser = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Les mots d'un libellé qui valent d'être retenus comme motif. */
export const MOTS_SANS_VALEUR: readonly string[] = [
  'PRLV', 'VIR', 'CB', 'CARTE', 'PAIEMENT', 'VIREMENT', 'PRELEVEMENT',
  'SEPA', 'DE', 'DU', 'LA', 'LE', 'LES', 'ET', 'SARL', 'SAS', 'SA',
];

/**
 * Les fragments candidats d'un libellé.
 *
 * On retire les mots de plomberie bancaire — `PRLV`, `VIR`, `SEPA` — qui
 * apparaissent sur la moitié des lignes et ne distinguent rien. Garder
 * « VIR » comme motif ferait reconnaître tous les virements comme le loyer.
 */
export function fragmentsDe(libelle: string): string[] {
  return normaliser(libelle)
    .split(' ')
    .filter((m) => m.length >= 3 && !MOTS_SANS_VALEUR.includes(m) && !/^\d+$/.test(m));
}

/** Le motif le mieux établi d'une ligne pour ce libellé, s'il y en a un. */
export function motifReconnu(
  libelle: string,
  ligneId: string,
  motifs: readonly Motif[],
): Motif | null {
  const nette = normaliser(libelle);
  return (
    motifs
      .filter((m) => m.ligneId === ligneId && nette.includes(m.fragment))
      .sort((a, b) => b.vu - a.vu || b.fragment.length - a.fragment.length)[0] ?? null
  );
}

/**
 * Enrichit les motifs d'une ligne après une confirmation.
 *
 * C'est ce qui fait que le dispositif apprend sans qu'on lui demande rien :
 * confirmer « PRLV EDF CLIENTS » sur Électricité ajoute « EDF » et
 * « CLIENTS » au compteur de cette ligne, et le mois suivant la proposition
 * est certaine au lieu d'être probable.
 */
export function apprendre(
  motifs: readonly Motif[],
  ligneId: string,
  libelle: string,
): Motif[] {
  const sortie = motifs.map((m) => ({ ...m }));
  for (const fragment of fragmentsDe(libelle)) {
    const connu = sortie.find((m) => m.ligneId === ligneId && m.fragment === fragment);
    if (connu) connu.vu += 1;
    else sortie.push({ ligneId, fragment, vu: 1 });
  }
  return sortie;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les trois critères
   ══════════════════════════════════════════════════════════════════════════ */

export interface Critere {
  /** Vrai quand le critère est rempli dans sa tolérance. */
  dans: boolean;
  /** De combien on dépasse. Zéro quand on est dedans. */
  ecart: number;
  /** La phrase qui le dit, chiffres compris. */
  phrase: string;
}

const joursEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00.000Z`) - Date.parse(`${a}T12:00:00.000Z`)) / 86_400_000);

const eurosCourt = (c: Centimes) =>
  `${(Math.abs(c) / 100).toFixed(2).replace('.', ',')} €`;

export function critereDeMontant(
  attendu: Centimes,
  constate: Centimes,
  tolerance: Centimes,
): Critere {
  const ecart = Math.abs(Math.abs(constate) - Math.abs(attendu));
  if (ecart <= tolerance) {
    return {
      dans: true,
      ecart: 0,
      phrase: ecart === 0
        ? 'Montant exact.'
        : `Montant dans la tolérance, à ${eurosCourt(ecart)} près.`,
    };
  }
  return {
    dans: false,
    ecart,
    phrase: `Montant hors tolérance de ${eurosCourt(ecart)}.`,
  };
}

export function critereDeDate(occurrence: Occurrence, jour: string): Critere {
  if (jour >= occurrence.du && jour <= occurrence.au) {
    return { dans: true, ecart: 0, phrase: 'Date dans la fenêtre.' };
  }
  const ecart = jour < occurrence.du
    ? joursEntre(jour, occurrence.du)
    : joursEntre(occurrence.au, jour);
  const largeur = joursEntre(occurrence.du, occurrence.au);
  return {
    dans: false,
    ecart,
    phrase: `Date à ${ecart} jour${ecart > 1 ? 's' : ''} hors de la fenêtre de ${largeur}.`,
  };
}

export function critereDeMotif(
  libelle: string,
  ligneId: string,
  motifs: readonly Motif[],
): Critere {
  const motif = motifReconnu(libelle, ligneId, motifs);
  if (!motif) return { dans: false, ecart: 1, phrase: 'Aucun libellé déjà vu sur cette ligne.' };
  return {
    dans: true,
    ecart: 0,
    phrase: `Libellé « ${motif.fragment} » déjà vu ${motif.vu} fois sur cette ligne.`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   La proposition
   ══════════════════════════════════════════════════════════════════════════ */

export type Niveau = 'certain' | 'probable' | 'incertain';

export interface Proposition {
  operationId: string;
  occurrenceId: string;
  ligneId: string;
  niveau: Niveau;
  montant: Critere;
  date: Critere;
  motif: Critere;
  /** L'écart conservé, signé : positif si l'on a payé plus que prévu. */
  ecartAuPrevu: Centimes;
  /** Vrai quand c'est un remboursement sur une ligne de charge. */
  remboursement: boolean;
  /** Les trois critères, en une phrase. */
  explication: string;
}

/**
 * Le niveau d'une proposition.
 *
 * | Niveau | Condition |
 * |---|---|
 * | certain | les trois critères remplis |
 * | probable | deux sur trois, et le troisième recevable |
 * | incertain | le reste |
 *
 * **Le montant n'a pas de borne de proximité, et la date en a une.** La
 * dissymétrie est voulue, et elle a coûté un essai pour être vue.
 *
 * Quand la date et le motif concordent, l'identification est faite : c'est
 * bien ce prélèvement-là, sur cette ligne-là. Le montant n'identifie plus
 * rien, il *informe* — une facture d'électricité varie, c'est sa nature. Une
 * borne sur l'écart de montant écarterait donc précisément le cas que le
 * plan donne en exemple, 112,40 € pour 95 € prévus, et qu'il range
 * explicitement dans les probables. Le garde-fou n'est pas un seuil : c'est
 * la phrase, qui dit « Montant hors tolérance de 17,40 € » et laisse refuser.
 *
 * Une date, elle, a un « presque » naturel : un prélèvement décalé de quatre
 * jours reste le même prélèvement, décalé de quatre mois non. La borne
 * s'applique donc là, et là seulement.
 */
export const FACTEUR_DE_PROXIMITE = 2;

export function niveauDe(
  montant: Critere,
  date: Critere,
  motif: Critere,
  largeurFenetre: number,
): Niveau {
  const remplis = [montant.dans, date.dans, motif.dans].filter(Boolean).length;
  if (remplis === 3) return 'certain';
  if (remplis < 2) return 'incertain';
  /*
     Le motif n'a pas de « presque » non plus : un libellé est déjà vu ou il
     ne l'est pas, et prétendre qu'il est « presque reconnu » serait inventer
     une gradation qui n'existe pas.
  */
  if (!montant.dans) return 'probable';
  if (!date.dans) {
    return date.ecart <= Math.max(1, largeurFenetre) * FACTEUR_DE_PROXIMITE
      ? 'probable'
      : 'incertain';
  }
  return 'probable';
}

export interface ReglagesAppariement {
  tolerance: Tolerance;
  motifs: readonly Motif[];
  /** Lignes de charge : une opération positive y est un remboursement. */
  sensParLigne: Readonly<Record<string, 'charge' | 'ressource'>>;
}

export function proposer(
  occurrence: Occurrence,
  operation: OperationBancaire,
  reglages: ReglagesAppariement,
): Proposition {
  const toleranceMontant = occurrence.tolerance
    || largeurTolerance(occurrence.montant, reglages.tolerance);
  const montant = critereDeMontant(occurrence.montant, operation.centimes, toleranceMontant);
  const date = critereDeDate(occurrence, operation.jour);
  const motif = critereDeMotif(operation.libelle, occurrence.ligneId, reglages.motifs);
  const largeur = joursEntre(occurrence.du, occurrence.au);
  const niveau = niveauDe(montant, date, motif, largeur);

  /*
     Un remboursement est une opération **positive** sur une ligne de charge.
     Il réduit le réel de cette ligne au lieu de gonfler les ressources :
     compter le remboursement d'une mutuelle comme un revenu ferait croire à
     une rentrée d'argent là où il y a un aller-retour.
  */
  const sens = reglages.sensParLigne[occurrence.ligneId] ?? 'charge';
  const remboursement = sens === 'charge' && operation.centimes > 0;

  /*
     L'écart se compte **dans le sens de la ligne**, et non en valeur absolue.

     Sur une ligne de charge, une opération sortante de 112,40 € pour 95 €
     prévus fait un écart de +17,40 € ; une rentrée de 45 € sur cette même
     ligne fait un écart de −140 €, parce qu'on a dépensé quarante-cinq euros
     de moins que rien. Prendre la valeur absolue, comme je l'avais d'abord
     écrit, rendait +50 € — un remboursement se lisait comme un dépassement.
  */
  const sensSigne = sens === 'charge' ? -1 : 1;
  const ecartAuPrevu = sensSigne * operation.centimes - Math.abs(occurrence.montant);

  return {
    operationId: operation.id,
    occurrenceId: occurrence.id,
    ligneId: occurrence.ligneId,
    niveau,
    montant,
    date,
    motif,
    ecartAuPrevu,
    remboursement,
    explication: [montant.phrase, date.phrase, motif.phrase].join(' '),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   La file
   ══════════════════════════════════════════════════════════════════════════ */

export interface File {
  /** Appliquées d'office, annonçées et annulables. */
  certaines: readonly Proposition[];
  /** Un geste chacune. */
  probables: readonly Proposition[];
  /** Aucune ligne ne correspond. */
  aClasser: readonly OperationBancaire[];
}

/**
 * La file d'un lot d'opérations.
 *
 * Une opération ne reçoit qu'**une** proposition, la meilleure, et une
 * occurrence n'en reçoit qu'une aussi. Sans cette exclusivité, la même
 * opération apparaîtrait sous trois lignes différentes et la file deviendrait
 * illisible — et surtout, confirmer les trois produirait un triple comptage.
 *
 * L'attribution se fait par ordre de qualité décroissante, ce qui est un
 * glouton : l'optimum global n'est pas garanti. C'est assumé. Un appariement
 * optimal mais inexplicable vaudrait moins qu'un appariement correct dont on
 * comprend l'ordre — et la personne peut toujours réattribuer à la main.
 */
export function construireLaFile(
  occurrences: readonly Occurrence[],
  operations: readonly OperationBancaire[],
  reglages: ReglagesAppariement,
): File {
  const rang = { certain: 0, probable: 1, incertain: 2 };
  const toutes: Proposition[] = [];
  for (const occ of occurrences) {
    for (const op of operations) {
      // Un virement interne n'est pas une dépense : il n'entre pas au budget.
      if (op.transfertAvec) continue;
      const p = proposer(occ, op, reglages);
      if (p.niveau !== 'incertain') toutes.push(p);
    }
  }

  toutes.sort(
    (a, b) =>
      rang[a.niveau] - rang[b.niveau] ||
      a.montant.ecart - b.montant.ecart ||
      a.date.ecart - b.date.ecart ||
      a.operationId.localeCompare(b.operationId),
  );

  const prisesOp = new Set<string>();
  const prisesOcc = new Set<string>();
  const retenues: Proposition[] = [];
  for (const p of toutes) {
    if (prisesOp.has(p.operationId) || prisesOcc.has(p.occurrenceId)) continue;
    prisesOp.add(p.operationId);
    prisesOcc.add(p.occurrenceId);
    retenues.push(p);
  }

  return {
    certaines: retenues.filter((p) => p.niveau === 'certain'),
    probables: retenues.filter((p) => p.niveau === 'probable'),
    aClasser: operations.filter((o) => !o.transfertAvec && !prisesOp.has(o.id)),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Un vers plusieurs, et plusieurs vers un
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un loyer payé en deux virements : l'occurrence accepte plusieurs opérations.
 *
 * Elle est rapprochée quand **leur somme** entre dans la tolérance. On ne
 * cherche pas le meilleur sous-ensemble parmi tous les possibles — ce serait
 * un problème de sac à dos, et un résultat qu'on ne saurait pas expliquer. On
 * prend les opérations du même compte dans la fenêtre, par date, tant que la
 * somme n'a pas atteint le prévu.
 */
export interface Groupe {
  occurrenceId: string;
  operationIds: readonly string[];
  somme: Centimes;
  critere: Critere;
}

export function grouperVers(
  occurrence: Occurrence,
  operations: readonly OperationBancaire[],
  tolerance: Tolerance,
): Groupe | null {
  const tolere = occurrence.tolerance || largeurTolerance(occurrence.montant, tolerance);
  const candidates = operations
    .filter((o) => !o.transfertAvec && o.jour >= occurrence.du && o.jour <= occurrence.au)
    .sort((a, b) => a.jour.localeCompare(b.jour) || a.id.localeCompare(b.id));

  const retenues: OperationBancaire[] = [];
  let somme = 0;
  for (const o of candidates) {
    if (Math.abs(somme) >= Math.abs(occurrence.montant) - tolere) break;
    retenues.push(o);
    somme += o.centimes;
  }
  if (retenues.length < 2) return null;
  const critere = critereDeMontant(occurrence.montant, somme, tolere);
  if (!critere.dans) return null;
  return {
    occurrenceId: occurrence.id,
    operationIds: retenues.map((o) => o.id),
    somme,
    critere,
  };
}

export interface PartDOperation {
  operationId: string;
  occurrenceId: string;
  centimes: Centimes;
}

/**
 * Un prélèvement groupé qu'on répartit sur plusieurs occurrences.
 *
 * Les parts **somment exactement** à l'opération : le reste de la division
 * va à la dernière. Sans cela, un prélèvement de 100 € réparti en trois
 * laisserait un centime orphelin, et le rapprochement de solde refuserait de
 * boucler pour une raison que personne ne comprendrait.
 */
export function diviser(
  operation: OperationBancaire,
  parts: readonly { occurrenceId: string; centimes: Centimes }[],
): PartDOperation[] {
  if (!parts.length) throw new Error('Diviser une opération demande au moins une part.');
  const somme = parts.reduce((s, p) => s + p.centimes, 0);
  const sorties = parts.map((p) => ({
    operationId: operation.id,
    occurrenceId: p.occurrenceId,
    centimes: p.centimes,
  }));
  const reste = operation.centimes - somme;
  if (reste !== 0) sorties[sorties.length - 1].centimes += reste;
  return sorties;
}

export function controlerParts(
  operation: OperationBancaire,
  parts: readonly PartDOperation[],
): string[] {
  const problemes: string[] = [];
  const somme = parts.reduce((s, p) => s + p.centimes, 0);
  if (somme !== operation.centimes) {
    problemes.push(
      `Les parts font ${eurosCourt(somme)} pour une opération de ` +
        `${eurosCourt(operation.centimes)}. Une division qui ne somme pas à l’opération ` +
        'ferait échouer le rapprochement de solde sans dire pourquoi.',
    );
  }
  if (parts.some((p) => p.centimes === 0)) {
    problemes.push('Une part de zéro n’est pas une part.');
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerAppariement(): string[] {
  const problemes: string[] = [];
  if (FACTEUR_DE_PROXIMITE <= 1) {
    problemes.push('Un facteur de proximité de 1 ferait de « probable » un synonyme de « certain ».');
  }
  if (FACTEUR_DE_PROXIMITE > 4) {
    problemes.push(
      'Un facteur de proximité au-delà de 4 ferait couvrir par « probable » tout ce qui n’est ' +
        'pas certain, et viderait « à classer » au prix de rapprochements faux.',
    );
  }
  /*
     Les mots de plomberie bancaire ne doivent jamais devenir des motifs :
     « VIR » reconnaîtrait tous les virements comme le loyer.
  */
  for (const mot of ['VIR', 'PRLV', 'CB', 'SEPA']) {
    if (fragmentsDe(`${mot} QUELQUE CHOSE`).includes(mot)) {
      problemes.push(`« ${mot} » peut devenir un motif. Il apparaît sur la moitié des lignes.`);
    }
  }
  return problemes;
}
