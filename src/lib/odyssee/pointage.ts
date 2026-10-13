/**
 * La politique de pointage — Finances, phase 3 bis c.
 *
 * `vendeurs.ts` **reconnaît** ; ce module **décide**. La séparation permet
 * de rejouer une reconnaissance sur un dictionnaire mis à jour sans toucher
 * à une seule décision déjà prise, et de changer un préréglage sans
 * réécrire le moteur.
 *
 * ## L'automatique ne devient jamais invisible
 *
 * C'est la contrainte qui tient tout le reste. Une opération pointée seule
 * est **annonçée**, **expliquée** et **annulable** — opération par
 * opération, vendeur par vendeur, règle par règle, ou import entier. Un
 * classement automatique qu'on ne peut plus voir ne peut plus être
 * contesté, et c'est pire qu'un classement qu'il aurait fallu confirmer.
 *
 * ## Les trois préréglages ne diffèrent que sur un axe
 *
 * Le plafond, et la liste des types en mode automatique. Les anomalies et
 * la règle du montant habituel sont **identiques partout**.
 *
 * La règle vient d'une mesure faite ailleurs : dans la veille du rythme de
 * vie, trois réglages qui variaient sur deux axes à la fois en avaient
 * rendu un aveugle et un contre-productif, et il a fallu les mesurer pour
 * s'en apercevoir. Un réglage qui change deux choses ne se raisonne pas.
 *
 * ## Les valeurs sont des points de départ, pas des lois
 *
 * Le plafond, le nombre d'occurrences, le facteur de dispersion : tous sont
 * à mesurer sur l'usage. Ce qui est promis ici n'est pas qu'ils soient
 * justes, mais qu'ils soient **mesurés et publiés**, y compris mauvais.
 */
import type { Centimes, OperationBancaire } from './finances';
import { TOUS_LES_TYPES, typeDe } from './taxonomie';
import type { Certitude, Reconnaissance } from './vendeurs';

/* ══════════════════════════════════════════════════════════════════════════
   Les préréglages
   ══════════════════════════════════════════════════════════════════════════ */

export type Prereglage = 'prudent' | 'standard' | 'rapide';

export interface Reglage {
  libelle: string;
  /** Plafond pour un vendeur dont on a un historique suffisant. */
  plafond: Centimes;
  /** Plafond à la première occurrence, quand le montant habituel est inconnu. */
  plafondSansHistorique: Centimes;
  /** Les types que ce préréglage pointe automatiquement. */
  typesEnAuto: readonly string[];
}

/** Les familles en auto, par préréglage. Un type en hérite de sa famille. */
const FAMILLES_AUTO: Record<Prereglage, readonly string[]> = {
  prudent: ['abonnements', 'telecoms', 'energie'],
  standard: ['abonnements', 'telecoms', 'energie', 'alimentation', 'transports', 'banque'],
  rapide: [
    'abonnements', 'telecoms', 'energie', 'alimentation', 'transports', 'banque',
    'restauration', 'commerce',
  ],
};

function typesAuto(familles: readonly string[]): string[] {
  /*
     Un type `jamaisAuto` n'entre dans aucun préréglage, même quand sa
     famille y est. C'est ce qui garde la santé et les retraits hors de
     l'automatisme **y compris en Rapide** — une décision qui dépasse ce que
     le prompt demandait, et qui tient à ceci : une pharmacie classée sans
     que personne la regarde fait entrer un fait médical dans une catégorie.
  */
  return TOUS_LES_TYPES.filter((t) => familles.includes(t.famille) && !t.jamaisAuto)
    .map((t) => t.id)
    .sort();
}

export function reglageDe(p: Prereglage): Reglage {
  const plafonds: Record<Prereglage, [Centimes, Centimes]> = {
    prudent: [5_000, 2_000],
    standard: [15_000, 6_000],
    rapide: [40_000, 15_000],
  };
  const libelles: Record<Prereglage, string> = {
    prudent: 'Prudent', standard: 'Standard', rapide: 'Rapide',
  };
  const [plafond, plafondSansHistorique] = plafonds[p];
  return {
    libelle: libelles[p],
    plafond,
    plafondSansHistorique,
    typesEnAuto: typesAuto(FAMILLES_AUTO[p]),
  };
}

export const PREREGLAGE_PAR_DEFAUT: Prereglage = 'standard';

/** Combien d'occurrences font un « historique ». Trois, comme ailleurs. */
export const OCCURRENCES_POUR_HISTORIQUE = 3;

/**
 * De combien d'écarts absolus médians un montant peut s'écarter.
 *
 * Et le plancher qui va avec : un vendeur toujours à 9,99 € a une
 * dispersion de zéro, et sans plancher le moindre centime de plus serait
 * aberrant. Le même piège que la veille, et la même parade.
 */
export const FACTEUR_DE_DISPERSION = 4;
export const PLANCHER_DE_DISPERSION: Centimes = 500;

/**
 * La hausse d'abonnement se mesure autrement, et il a fallu un essai pour
 * s'en apercevoir.
 *
 * Un abonnement est par nature à prix fixe. Lui appliquer la bande
 * généreuse du « montant habituel » — quatre écarts médians, plancher de
 * cinq euros — donne une marge de vingt euros, qui avale une hausse de
 * 13,49 € à 19,99 €. C'est pourtant exactement le cas que le plan veut
 * voir : une augmentation silencieuse, petite en euros et considérable en
 * proportion.
 *
 * On mesure donc en **relatif**, avec un petit plancher absolu pour ne pas
 * crier sur un arrondi de TVA.
 */
export const HAUSSE_RELATIVE = 0.05;
export const HAUSSE_PLANCHER: Centimes = 100;

/* ══════════════════════════════════════════════════════════════════════════
   Les anomalies
   ══════════════════════════════════════════════════════════════════════════ */

export type NatureDAnomalie =
  | 'montantInhabituel'
  | 'vendeurInconnu'
  | 'doublonProbable'
  | 'deviseInhabituelle'
  | 'fraisBancaires'
  | 'hausseDAbonnement';

export interface Anomalie {
  nature: NatureDAnomalie;
  phrase: string;
}

/** L'historique d'un vendeur, réduit à ce dont la politique a besoin. */
export interface HistoriqueDuVendeur {
  /** Les montants déjà vus, en valeur absolue. */
  montants: readonly Centimes[];
  comptes: readonly string[];
}

export const HISTORIQUE_VIDE: HistoriqueDuVendeur = { montants: [], comptes: [] };

function mediane(valeurs: readonly number[]): number {
  if (!valeurs.length) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}

export interface Tolerance {
  bas: Centimes;
  haut: Centimes;
  mediane: Centimes;
}

/** La fourchette habituelle d'un vendeur, ou `null` sans historique suffisant. */
export function montantHabituel(h: HistoriqueDuVendeur): Tolerance | null {
  if (h.montants.length < OCCURRENCES_POUR_HISTORIQUE) return null;
  const m = mediane(h.montants);
  const dispersion = Math.max(
    mediane(h.montants.map((x) => Math.abs(x - m))),
    PLANCHER_DE_DISPERSION,
  );
  const marge = dispersion * FACTEUR_DE_DISPERSION;
  return { bas: Math.max(0, m - marge), haut: m + marge, mediane: m };
}

/**
 * Ce qui cloche, signalé et jamais pointé.
 *
 * L'application **ne détecte pas la fraude** et ne le prétend pas : elle
 * signale des écarts à ce qu'elle a déjà vu. La distinction n'est pas une
 * précaution de langage — un outil qui promettrait la fraude serait cru, et
 * son silence vaudrait pour une absence de fraude.
 */
export function anomaliesDe(
  operation: OperationBancaire,
  r: Reconnaissance,
  h: HistoriqueDuVendeur,
  memeJour: readonly OperationBancaire[],
): Anomalie[] {
  const sorties: Anomalie[] = [];
  const montant = Math.abs(operation.centimes);

  if (r.certitude === 'inconnu') {
    sorties.push({
      nature: 'vendeurInconnu',
      phrase: 'Ce vendeur n’est ni dans vos règles, ni dans le dictionnaire, ni dans votre historique.',
    });
  }

  const habituel = montantHabituel(h);
  if (habituel && (montant < habituel.bas || montant > habituel.haut)) {
    sorties.push({
      nature: 'montantInhabituel',
      phrase:
        `Montant inhabituel pour ce vendeur : vos ${h.montants.length} opérations tournent ` +
        `autour de ${(habituel.mediane / 100).toFixed(2).replace('.', ',')} €.`,
    });
  }

  const doublons = memeJour.filter(
    (o) => o.id !== operation.id && o.centimes === operation.centimes
      && o.compteId === operation.compteId && o.jour === operation.jour,
  );
  if (doublons.length) {
    sorties.push({
      nature: 'doublonProbable',
      phrase:
        `${doublons.length + 1} opérations du même montant, le même jour, sur le même compte. ` +
        'Ce peut être un doublon d’import comme deux achats réels.',
    });
  }

  if (h.comptes.length && !h.comptes.includes(operation.compteId)) {
    sorties.push({
      nature: 'deviseInhabituelle',
      phrase: 'Compte inhabituel pour ce vendeur.',
    });
  }

  if (r.typeId === 'frais-bancaires') {
    sorties.push({
      nature: 'fraisBancaires',
      phrase: 'Des frais bancaires : ils valent d’être regardés une fois plutôt que classés.',
    });
  }

  /*
     La hausse d'abonnement : un montant **supérieur** à l'habituel sur un
     type d'abonnement. Elle double parfois « montant inhabituel », et c'est
     voulu : la phrase n'est pas la même, et c'est la phrase qui sert.
  */
  const t = typeDe(r.typeId ?? '');
  const seuilDeHausse = habituel
    ? habituel.mediane + Math.max(habituel.mediane * HAUSSE_RELATIVE, HAUSSE_PLANCHER)
    : null;
  if (t?.famille === 'abonnements' && habituel && seuilDeHausse && montant > seuilDeHausse) {
    sorties.push({
      nature: 'hausseDAbonnement',
      phrase:
        `Cet abonnement coûte plus qu’avant : ${(montant / 100).toFixed(2).replace('.', ',')} € ` +
        `contre ${(habituel.mediane / 100).toFixed(2).replace('.', ',')} € habituellement.`,
    });
  }
  return sorties;
}

/* ══════════════════════════════════════════════════════════════════════════
   La décision
   ══════════════════════════════════════════════════════════════════════════ */

export type StatutDePointage = 'a-pointer' | 'pointee-auto' | 'pointee-par-moi' | 'a-revoir';

export interface Decision {
  statut: StatutDePointage;
  /** Pourquoi, en une phrase affichable — c'est « Pourquoi ce pointage ? ». */
  pourquoi: string;
  anomalies: readonly Anomalie[];
  /** Vrai quand c'est le plafond sans historique qui s'est appliqué. */
  surLePlafondSansHistorique: boolean;
}

export interface ContexteDeDecision {
  prereglage: Prereglage;
  historique: HistoriqueDuVendeur;
  /** Les opérations du même jour, pour le doublon. */
  memeJour: readonly OperationBancaire[];
  /** Vrai si la personne a déjà pointé cette opération : rien ne la touche. */
  dejaPointeeParMoi?: boolean;
}

/**
 * Pointer ou non, et pourquoi.
 *
 * Une opération **pointée par vous n'est jamais modifiée** par une règle ni
 * par une mise à jour du dictionnaire. C'est la première condition
 * examinée, avant même de regarder ce qui a été reconnu.
 */
export function decider(
  operation: OperationBancaire,
  r: Reconnaissance,
  contexte: ContexteDeDecision,
): Decision {
  const anomalies = anomaliesDe(operation, r, contexte.historique, contexte.memeJour);

  if (contexte.dejaPointeeParMoi) {
    return {
      statut: 'pointee-par-moi',
      pourquoi: 'Vous avez pointé cette opération. Aucune règle ne la modifie.',
      anomalies,
      surLePlafondSansHistorique: false,
    };
  }

  if (anomalies.length) {
    return {
      statut: 'a-revoir',
      pourquoi: anomalies[0].phrase,
      anomalies,
      surLePlafondSansHistorique: false,
    };
  }

  const type = typeDe(r.typeId ?? '');
  if (!type || r.certitude !== 'certain') {
    return {
      statut: 'a-pointer',
      pourquoi:
        r.certitude === 'probable'
          ? `Vendeur probable — ${r.parQuoi ?? 'reconnaissance approchée'}. Un geste pour confirmer.`
          : 'Vendeur non reconnu.',
      anomalies,
      surLePlafondSansHistorique: false,
    };
  }

  const reglage = reglageDe(contexte.prereglage);
  if (type.jamaisAuto) {
    return {
      statut: 'a-pointer',
      pourquoi: `« ${type.libelle} » n’est jamais pointé automatiquement.`,
      anomalies,
      surLePlafondSansHistorique: false,
    };
  }
  if (!reglage.typesEnAuto.includes(type.id)) {
    return {
      statut: 'a-pointer',
      pourquoi: `« ${type.libelle} » n’est pas en mode automatique sur le préréglage ${reglage.libelle}.`,
      anomalies,
      surLePlafondSansHistorique: false,
    };
  }

  const montant = Math.abs(operation.centimes);
  const habituel = montantHabituel(contexte.historique);
  const sansHistorique = habituel === null;
  const plafond = sansHistorique ? reglage.plafondSansHistorique : reglage.plafond;

  if (montant > plafond) {
    return {
      statut: 'a-pointer',
      pourquoi:
        `Au-dessus du plafond de ${(plafond / 100).toFixed(2).replace('.', ',')} €` +
        (sansHistorique ? ', abaissé faute d’historique pour ce vendeur.' : '.'),
      anomalies,
      surLePlafondSansHistorique: sansHistorique,
    };
  }

  return {
    statut: 'pointee-auto',
    pourquoi:
      `${r.parQuoi ?? 'vendeur certain'} · ` +
      (sansHistorique
        ? `première occurrence, sous le plafond de ${(plafond / 100).toFixed(2).replace('.', ',')} €`
        : `montant habituel (${contexte.historique.montants.length} opérations)`) +
      ` · type « ${type.libelle} » en automatique.`,
    anomalies,
    surLePlafondSansHistorique: sansHistorique,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le contrôle par sondage
   ══════════════════════════════════════════════════════════════════════════ */

/** En deçà, pas de sondage : vérifier trois lignes n'apprend rien. */
export const SONDAGE_A_PARTIR_DE = 10;
export const SONDAGE_PLUS_GROS = 3;
export const SONDAGE_AU_HASARD = 2;

/**
 * Un petit échantillon des pointées automatiquement, à vérifier d'un coup
 * d'œil.
 *
 * Les plus gros montants **et** quelques tirées au sort : les gros seuls
 * laisseraient passer une règle qui se trompe systématiquement sur des
 * petites sommes, et le hasard seul manquerait l'erreur qui coûte.
 *
 * Le tirage est **déterministe**, dérivé des identifiants : deux appareils
 * qui recalculent le même import proposent le même sondage, et un sondage
 * qui change à chaque ouverture ne se termine jamais.
 */
export function sondage(
  pointees: readonly { id: string; centimes: Centimes }[],
): string[] {
  if (pointees.length < SONDAGE_A_PARTIR_DE) return [];
  const parMontant = [...pointees].sort(
    (a, b) => Math.abs(b.centimes) - Math.abs(a.centimes) || a.id.localeCompare(b.id),
  );
  const retenus = parMontant.slice(0, SONDAGE_PLUS_GROS).map((o) => o.id);

  const reste = parMontant.slice(SONDAGE_PLUS_GROS);
  /* Une empreinte stable par identifiant, pour un tirage reproductible. */
  const graine = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const tires = [...reste]
    .sort((a, b) => graine(a.id) - graine(b.id) || a.id.localeCompare(b.id))
    .slice(0, SONDAGE_AU_HASARD)
    .map((o) => o.id);

  return [...retenus, ...tires];
}

/* ══════════════════════════════════════════════════════════════════════════
   La rétrogradation d'une règle
   ══════════════════════════════════════════════════════════════════════════ */

/** À partir de cette part de corrections, une règle cesse de pointer seule. */
export const PART_DE_CORRECTIONS = 0.25;
/** Et pas avant d'avoir été appliquée ce nombre de fois. */
export const APPLICATIONS_AVANT_JUGEMENT = 4;

export interface Verdict {
  retrograder: boolean;
  phrase: string;
}

/**
 * Une règle souvent corrigée cesse de pointer toute seule.
 *
 * Le seuil n'est pas « une correction suffit » : on se trompe aussi en
 * corrigeant, et une règle juste rétrogradée au premier accident coûterait
 * plus qu'elle ne rapporte. Il n'est pas non plus « la moitié » : une règle
 * fausse une fois sur trois a déjà mal classé des dizaines d'opérations.
 */
export function jugerLaRegle(appliquee: number, corrigee: number): Verdict {
  if (appliquee < APPLICATIONS_AVANT_JUGEMENT) {
    return { retrograder: false, phrase: 'Trop peu appliquée pour être jugée.' };
  }
  const part = corrigee / appliquee;
  if (part < PART_DE_CORRECTIONS) {
    return {
      retrograder: false,
      phrase: `Appliquée ${appliquee} fois, corrigée ${corrigee} fois.`,
    };
  }
  return {
    retrograder: true,
    phrase:
      `Corrigée ${corrigee} fois sur ${appliquee} applications : elle cesse de pointer seule ` +
      'et se contente désormais de proposer.',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerLaPolitique(): string[] {
  const problemes: string[] = [];
  const p = reglageDe('prudent');
  const s = reglageDe('standard');
  const r = reglageDe('rapide');

  if (!(p.plafond < s.plafond && s.plafond < r.plafond)) {
    problemes.push('Les plafonds des trois préréglages doivent croître.');
  }
  if (!(p.plafondSansHistorique < s.plafondSansHistorique
    && s.plafondSansHistorique < r.plafondSansHistorique)) {
    problemes.push('Les plafonds de première occurrence doivent croître eux aussi.');
  }
  for (const x of [p, s, r]) {
    if (x.plafondSansHistorique >= x.plafond) {
      problemes.push(
        `Le préréglage ${x.libelle} n’abaisse pas le plafond à la première occurrence, alors ` +
          'que c’est justement là qu’on ne sait rien du montant habituel.',
      );
    }
  }
  /*
     Chaque préréglage doit contenir le précédent. Trois réglages dont l'un
     n'est pas plus permissif que l'autre ne se raisonnent pas — c'est
     exactement la faute mesurée sur la veille, où « Discrète » s'était
     trouvée plus aveugle que prévu en variant sur deux axes.
  */
  if (!p.typesEnAuto.every((t) => s.typesEnAuto.includes(t))) {
    problemes.push('Standard ne contient pas tout ce que Prudent pointe.');
  }
  if (!s.typesEnAuto.every((t) => r.typesEnAuto.includes(t))) {
    problemes.push('Rapide ne contient pas tout ce que Standard pointe.');
  }

  /* Et aucun type `jamaisAuto` dans aucun préréglage, pas même Rapide. */
  for (const x of [p, s, r]) {
    for (const id of x.typesEnAuto) {
      if (typeDe(id)?.jamaisAuto) {
        problemes.push(`Le préréglage ${x.libelle} pointerait « ${id} », qui ne doit jamais l’être.`);
      }
      if (typeDe(id)?.sensible) {
        problemes.push(`Le préréglage ${x.libelle} pointerait un type sensible : « ${id} ».`);
      }
    }
  }
  if (!r.typesEnAuto.length) {
    problemes.push('Le préréglage Rapide ne pointe rien : la taxonomie n’est pas branchée.');
  }

  if (FACTEUR_DE_DISPERSION < 2) {
    problemes.push('Un facteur de dispersion inférieur à 2 rendrait aberrante toute variation.');
  }
  if (PLANCHER_DE_DISPERSION <= 0) {
    problemes.push(
      'Sans plancher, un vendeur toujours au même prix rendrait le moindre centime aberrant.',
    );
  }
  if (OCCURRENCES_POUR_HISTORIQUE < 3) {
    problemes.push('Moins de trois occurrences ne font pas un montant habituel.');
  }
  if (HAUSSE_RELATIVE >= 0.2) {
    problemes.push(
      'Un seuil de hausse d’abonnement à 20 % laisserait passer la plupart des augmentations.',
    );
  }
  if (PART_DE_CORRECTIONS <= 0 || PART_DE_CORRECTIONS >= 0.5) {
    problemes.push(
      'Une règle se rétrograde entre « une correction suffit » et « la moitié » : les deux ' +
        'bornes sont fausses.',
    );
  }
  return problemes;
}
