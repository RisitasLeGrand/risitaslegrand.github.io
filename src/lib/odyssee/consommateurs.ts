/**
 * Qui lit mon budget — Finances, phase 4.
 *
 * ## Un interrupteur n'est pas une garantie
 *
 * C'est la décision qui tient tout ce module. Un écran qui offre sept
 * interrupteurs et laisse ensuite chaque lecteur puiser dans les mêmes
 * données ne promet rien : il déclare une intention, et la première fonction
 * écrite sans y penser la dément. La ligne « Habitudes — la régularité de la
 * tenue, **aucun montant** » n'est tenue que si Habitudes ne reçoit
 * structurellement aucun montant.
 *
 * Chaque consommateur reçoit donc une **projection** : un objet construit
 * pour lui, qui ne contient que ce que sa ligne promet. L'interrupteur décide
 * si la projection est calculée ; la forme de la projection décide de ce
 * qu'elle peut contenir. Les deux sont nécessaires, et c'est la seconde qui
 * protège.
 *
 * Le garde-fou `controlerLesConsommateurs()` le vérifie **sur des données**,
 * et non sur une relecture : il fabrique un budget aux montants reconnaissables,
 * projette les sept, et refuse si un montant apparaît là où la promesse dit
 * qu'il n'y en a pas. Une promesse qu'aucun essai ne peut lire n'est pas une
 * promesse.
 *
 * ## La veille ne doit jamais s'allumer sur un budget dépassé
 *
 * Le plan y insiste, et c'est la raison d'être du champ
 * `ecartAuBudgetAutorise`. Un budget serré est un **choix**, pas un signal de
 * santé. Confondre les deux ferait d'une période d'économies volontaires une
 * alerte sur l'état de quelqu'un — et apprendrait à cette personne à ignorer
 * la veille, ce qui est la seule façon certaine de la rendre inutile.
 *
 * La veille ne reçoit donc qu'une **cadence de dépenses**, comparable à la
 * propre base de la personne, sans aucune référence au prévu. Elle est
 * décochée par défaut.
 *
 * ## « Demander à l'IA » ne se coche pas une fois pour toutes
 *
 * Les six autres consommateurs restent à l'intérieur de l'appareil ; celui-là
 * fabrique un texte destiné à en sortir. Un consentement donné une fois en
 * janvier ne peut pas couvrir un envoi fait en novembre sur des données que
 * personne n'a relues. D'où `consentementAChaqueFois`, et une projection qui
 * rend `null` tant que le consentement du moment n'est pas passé en paramètre.
 */
import { euros, type Centimes, type OperationBancaire } from './finances';
import {
  totauxMensuels,
  type LigneBudget,
  type Occurrence,
  type Tolerance,
  TOLERANCE_PAR_DEFAUT,
} from './budget';
import {
  ecartsParCategorie,
  ecartsParLigne,
  type Rapprochement,
} from './rapprochement';

/* ══════════════════════════════════════════════════════════════════════════
   Le registre
   ══════════════════════════════════════════════════════════════════════════ */

export type Consommateur =
  | 'agenda'
  | 'quoiMaintenant'
  | 'objectifs'
  | 'habitudes'
  | 'quetes'
  | 'veille'
  | 'ia';

export interface DeclarationDeConsommateur {
  id: Consommateur;
  libelle: string;
  /**
   * Ce qu'il voit, en toutes lettres, tel que l'écran l'affiche.
   *
   * C'est la **promesse**, et elle est faite à la personne. Les trois champs
   * qui suivent en sont la traduction vérifiable.
   */
  voit: string;
  actifParDefaut: boolean;
  /** La projection a-t-elle le droit de porter des montants en euros ? */
  montantsAutorises: boolean;
  /** A-t-elle le droit de porter un écart au prévu ? */
  ecartAuBudgetAutorise: boolean;
  /** Le consentement se redonne-t-il à chaque usage ? */
  consentementAChaqueFois: boolean;
}

/**
 * Les sept consommateurs de la section 8 du plan, dans l'ordre de l'écran.
 *
 * Les libellés et les phrases « voit » sont **repris du plan au mot près** :
 * les reformuler ici créerait deux versions de la même promesse, et la
 * personne ne saurait plus laquelle l'engage.
 */
export const CONSOMMATEURS: readonly DeclarationDeConsommateur[] = [
  {
    id: 'agenda',
    libelle: 'Agenda',
    voit: 'Les dates et les montants des échéances.',
    actifParDefaut: true,
    montantsAutorises: true,
    ecartAuBudgetAutorise: false,
    consentementAChaqueFois: false,
  },
  {
    id: 'quoiMaintenant',
    libelle: 'Que faire maintenant ?',
    voit: 'Le nombre d’opérations à rapprocher.',
    actifParDefaut: true,
    montantsAutorises: false,
    ecartAuBudgetAutorise: false,
    consentementAChaqueFois: false,
  },
  {
    id: 'objectifs',
    libelle: 'Objectifs et planification',
    voit: 'Les objectifs d’épargne, pas les opérations.',
    actifParDefaut: true,
    montantsAutorises: true,
    ecartAuBudgetAutorise: false,
    consentementAChaqueFois: false,
  },
  {
    id: 'habitudes',
    libelle: 'Habitudes',
    voit: 'La régularité de la tenue. Aucun montant.',
    actifParDefaut: true,
    montantsAutorises: false,
    ecartAuBudgetAutorise: false,
    consentementAChaqueFois: false,
  },
  {
    id: 'quetes',
    libelle: 'Quêtes',
    voit: '« Revue du mois faite », oui ou non.',
    actifParDefaut: true,
    montantsAutorises: false,
    ecartAuBudgetAutorise: false,
    consentementAChaqueFois: false,
  },
  {
    id: 'veille',
    libelle: 'Veille du rythme de vie',
    voit:
      'Un changement brusque du rythme de dépenses par rapport à votre propre base. ' +
      'Jamais un écart au budget.',
    actifParDefaut: false,
    montantsAutorises: false,
    ecartAuBudgetAutorise: false,
    consentementAChaqueFois: false,
  },
  {
    id: 'ia',
    libelle: 'Demander à l’IA',
    voit: 'Rien, sauf si vous cochez à chaque fois.',
    actifParDefaut: false,
    montantsAutorises: true,
    ecartAuBudgetAutorise: true,
    consentementAChaqueFois: true,
  },
];

const PAR_ID = new Map(CONSOMMATEURS.map((c) => [c.id, c]));
export const declarationDe = (id: Consommateur) => PAR_ID.get(id)!;

export type ReglagesConsommateurs = Record<Consommateur, boolean>;

/** L'enregistrement rangé en base. Clé fixe : il n'y en a qu'un. */
export interface EtatDesConsommateurs {
  id: 'consommateurs';
  reglages: ReglagesConsommateurs;
  majLe: string;
}

export const CLEF_ETAT = 'consommateurs' as const;

/**
 * Relit des réglages venus de la base, en comblant ce qui manque.
 *
 * Un consommateur ajouté après coup n'est pas dans l'enregistrement, et
 * c'est sa **valeur par défaut** qui s'applique — jamais « activé ». Un
 * nouveau lecteur du budget qui s'allumerait tout seul chez quelqu'un qui
 * avait tout fermé serait la pire façon d'en ajouter un.
 */
export function relireLesReglages(brut: unknown): ReglagesConsommateurs {
  const lu = (brut ?? {}) as Partial<Record<Consommateur, unknown>>;
  return Object.fromEntries(
    CONSOMMATEURS.map((c) => [
      c.id,
      typeof lu[c.id] === 'boolean' ? (lu[c.id] as boolean) : c.actifParDefaut,
    ]),
  ) as ReglagesConsommateurs;
}

export const REGLAGES_PAR_DEFAUT: ReglagesConsommateurs = Object.fromEntries(
  CONSOMMATEURS.map((c) => [c.id, c.actifParDefaut]),
) as ReglagesConsommateurs;

/* ══════════════════════════════════════════════════════════════════════════
   Ce que chacun reçoit
   ══════════════════════════════════════════════════════════════════════════ */

/** Tout ce que Finances sait. Aucune projection ne le rend tel quel. */
export interface SourceFinances {
  lignes: readonly LigneBudget[];
  occurrences: readonly Occurrence[];
  operations: readonly OperationBancaire[];
  rapprochements: readonly Rapprochement[];
  /** Les jours où un relevé a été importé, pour la régularité de la tenue. */
  importsLe: readonly string[];
  /** Les mois dont la revue a été faite, `AAAA-MM`. */
  revuesFaites: readonly string[];
  tolerance: Tolerance;
  /** Le jour d'arrêt. Paramètre, jamais une lecture d'horloge. */
  arreteAu: string;
}

export interface VueAgenda {
  echeances: readonly { jour: string; libelle: string; montant: Centimes; sens: string }[];
}

export interface VueQuoiMaintenant {
  aRapprocher: number;
}

export interface VueObjectifs {
  epargneMensuelle: Centimes;
  tauxEpargne: number | null;
}

export interface VueHabitudes {
  /** Jours écoulés depuis le dernier import. `null` si aucun. */
  joursDepuisLeDernierImport: number | null;
  /** Nombre d'imports sur les 90 derniers jours. */
  importsSurTroisMois: number;
  /** Part des échéances échues qui sont rapprochées, de 0 à 1. `null` si aucune. */
  partRapprochee: number | null;
}

export interface VueQuetes {
  revueDuMoisFaite: boolean;
}

export interface VueVeille {
  /**
   * Le nombre d'opérations sortantes par jour sur la fenêtre récente, et sur
   * la base. Deux cadences, aucun montant, **aucune référence au prévu**.
   */
  sortiesParJourRecent: number | null;
  sortiesParJourDeBase: number | null;
}

export interface VueIa {
  resume: string;
}

export type Projection =
  | { consommateur: 'agenda'; vue: VueAgenda }
  | { consommateur: 'quoiMaintenant'; vue: VueQuoiMaintenant }
  | { consommateur: 'objectifs'; vue: VueObjectifs }
  | { consommateur: 'habitudes'; vue: VueHabitudes }
  | { consommateur: 'quetes'; vue: VueQuetes }
  | { consommateur: 'veille'; vue: VueVeille }
  | { consommateur: 'ia'; vue: VueIa };

const joursEntre = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const ajouter = (jour: string, n: number): string =>
  new Date(Date.parse(`${jour}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** La fenêtre récente de la cadence de dépenses, en jours. */
export const FENETRE_CADENCE = 14;
/** La base à laquelle on la compare, en jours, prise **avant** la fenêtre. */
export const BASE_CADENCE = 56;

function vueAgenda(s: SourceFinances): VueAgenda {
  const parLigne = new Map(s.lignes.map((l) => [l.id, l]));
  return {
    echeances: s.occurrences
      .filter((o) => o.jour >= s.arreteAu)
      .sort((a, b) => a.jour.localeCompare(b.jour) || a.id.localeCompare(b.id))
      .map((o) => ({
        jour: o.jour,
        libelle: parLigne.get(o.ligneId)?.libelle ?? o.ligneId,
        montant: o.montant,
        sens: o.signe === -1 ? 'charge' : 'ressource',
      })),
  };
}

function vueQuoiMaintenant(s: SourceFinances): VueQuoiMaintenant {
  const rangees = new Set(s.rapprochements.map((r) => r.operationId));
  return {
    aRapprocher: s.operations.filter((o) => !o.transfertAvec && !rangees.has(o.id)).length,
  };
}

function vueObjectifs(s: SourceFinances): VueObjectifs {
  const t = totauxMensuels(s.lignes, s.arreteAu);
  return { epargneMensuelle: t.epargne, tauxEpargne: t.tauxEpargne };
}

function vueHabitudes(s: SourceFinances): VueHabitudes {
  const imports = [...s.importsLe].sort();
  const dernier = imports[imports.length - 1];
  const depuisTroisMois = ajouter(s.arreteAu, -90);

  const echues = s.occurrences.filter((o) => o.jour <= s.arreteAu);
  const soldees = new Set(
    s.rapprochements
      .filter((r) => r.occurrenceId !== null && r.type !== 'refuse' && r.type !== 'horsBudget')
      .map((r) => r.occurrenceId as string),
  );
  const combien = echues.filter((o) => soldees.has(o.id)).length;

  return {
    joursDepuisLeDernierImport: dernier ? joursEntre(dernier, s.arreteAu) : null,
    importsSurTroisMois: imports.filter((j) => j >= depuisTroisMois).length,
    /*
       `null` et non zéro quand rien n'est échu : « vous avez rapproché 0 % de
       vos échéances » reproche une négligence à quelqu'un qui n'avait rien à
       faire. Absence n'est pas zéro, ici comme partout ailleurs.
    */
    partRapprochee: echues.length === 0 ? null : combien / echues.length,
  };
}

function vueQuetes(s: SourceFinances): VueQuetes {
  return { revueDuMoisFaite: s.revuesFaites.includes(s.arreteAu.slice(0, 7)) };
}

function vueVeille(s: SourceFinances): VueVeille {
  const sorties = s.operations.filter((o) => !o.transfertAvec && o.centimes < 0);
  const debutRecent = ajouter(s.arreteAu, -FENETRE_CADENCE);
  const debutBase = ajouter(debutRecent, -BASE_CADENCE);

  const recentes = sorties.filter((o) => o.jour > debutRecent && o.jour <= s.arreteAu);
  const deBase = sorties.filter((o) => o.jour > debutBase && o.jour <= debutRecent);

  /*
     On rend `null` plutôt que zéro quand la période n'est pas couverte : une
     cadence de zéro dépense par jour et une absence de données se
     ressemblent dans un nombre, et se distinguent complètement dans ce
     qu'elles autorisent à conclure.
  */
  const couvre = (depuis: string) => s.operations.some((o) => o.jour <= depuis);
  return {
    sortiesParJourRecent: recentes.length ? recentes.length / FENETRE_CADENCE : null,
    sortiesParJourDeBase: couvre(debutRecent) && deBase.length
      ? deBase.length / BASE_CADENCE
      : null,
  };
}

/**
 * Le résumé pour l'IA : **agrégé par catégorie, jamais ligne par ligne**.
 *
 * La première version listait les lignes hors tolérance avec leur intitulé.
 * C'était une fuite, et elle devient évidente dès qu'on se rappelle d'où
 * viennent les intitulés : une ligne déduite du réel porte le nom de
 * l'enseigne, et la liste des lignes est donc une liste de commerçants. Le
 * prompt l'interdit explicitement — « agrégés par type, sans liste de
 * vendeurs » —, et la raison tient en un exemple : « Pharmacie du Centre :
 * 240 € ce mois-ci » dit quelque chose sur une santé, pas sur un budget.
 *
 * Une catégorie, elle, est un mot que la personne a choisi.
 */
function vueIa(s: SourceFinances): VueIa {
  const parCategorie = ecartsParCategorie(
    ecartsParLigne(s.lignes, s.occurrences, s.rapprochements, s.tolerance, s.arreteAu),
  );
  const t = totauxMensuels(s.lignes, s.arreteAu);
  const lignes = parCategorie
    .filter((c) => c.ecart !== 0)
    .map((c) => `- ${c.cle} : prévu ${euros(c.prevu)}, réel ${euros(c.reel)}, écart ${euros(c.ecart)}`);
  return {
    resume: [
      `Ressources mensuelles : ${euros(t.ressources)}.`,
      `Charges fixes : ${euros(t.chargesFixes)}.`,
      `Reste à vivre : ${euros(t.resteAVivre)}.`,
      lignes.length
        ? `Écarts par catégorie :\n${lignes.join('\n')}`
        : 'Aucun écart par catégorie.',
    ].join('\n'),
  };
}

/**
 * La projection d'un consommateur, ou `null`.
 *
 * `null` dans trois cas, et les trois comptent : l'interrupteur est éteint ;
 * le consommateur demande un consentement à chaque fois et on ne le lui a pas
 * donné ; l'identifiant est inconnu. Ce dernier cas est le plus important :
 * un consommateur ajouté sans être déclaré ne reçoit **rien**, plutôt que de
 * recevoir tout par défaut.
 */
export function projeter(
  id: Consommateur,
  source: SourceFinances,
  reglages: ReglagesConsommateurs = REGLAGES_PAR_DEFAUT,
  consentementDuMoment = false,
): Projection | null {
  const d = PAR_ID.get(id);
  if (!d) return null;
  if (!reglages[id]) return null;
  if (d.consentementAChaqueFois && !consentementDuMoment) return null;

  switch (id) {
    case 'agenda': return { consommateur: 'agenda', vue: vueAgenda(source) };
    case 'quoiMaintenant': return { consommateur: 'quoiMaintenant', vue: vueQuoiMaintenant(source) };
    case 'objectifs': return { consommateur: 'objectifs', vue: vueObjectifs(source) };
    case 'habitudes': return { consommateur: 'habitudes', vue: vueHabitudes(source) };
    case 'quetes': return { consommateur: 'quetes', vue: vueQuetes(source) };
    case 'veille': return { consommateur: 'veille', vue: vueVeille(source) };
    case 'ia': return { consommateur: 'ia', vue: vueIa(source) };
    default: return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou, sur des données
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Des montants que rien d'autre ne produirait, pour qu'une fuite se voie.
 *
 * Des chiffres ronds se retrouveraient par hasard dans un pourcentage ou un
 * compte de jours, et le garde-fou crierait au loup. Ceux-là, non.
 */
export const SENTINELLES = {
  loyer: 78_317,
  salaire: 234_571,
  courses: 41_983,
} as const;

function budgetTemoin(): SourceFinances {
  const version = {
    depuis: '2026-01-01',
    jusqua: null,
    nature: 'fixe' as const,
    montantHaut: null,
    periodicite: 'mensuelle' as const,
    tolerance: TOLERANCE_PAR_DEFAUT,
  };
  const lignes: LigneBudget[] = [
    {
      id: 'loyer', libelle: 'Loyer', categorie: 'Logement', sens: 'charge', compteId: null,
      essentielle: true, motifs: [], note: '', majLe: '2026-01-01T00:00:00.000Z',
      versions: [{ ...version, montant: SENTINELLES.loyer, jourAttendu: 5 }],
    },
    {
      id: 'salaire', libelle: 'Salaire', categorie: 'Revenus', sens: 'ressource', compteId: null,
      essentielle: false, motifs: [], note: '', majLe: '2026-01-01T00:00:00.000Z',
      versions: [{ ...version, montant: SENTINELLES.salaire, jourAttendu: 28 }],
    },
    {
      id: 'epargne', libelle: 'Épargne programmée', categorie: 'Épargne', sens: 'charge',
      compteId: null, essentielle: false, motifs: [], note: '', majLe: '2026-01-01T00:00:00.000Z',
      versions: [{ ...version, montant: SENTINELLES.courses, jourAttendu: 2 }],
    },
  ];
  const occurrences: Occurrence[] = [
    {
      id: 'loyer:2026-10-05', ligneId: 'loyer', jour: '2026-10-05', montant: SENTINELLES.loyer,
      signe: -1, du: '2026-10-03', au: '2026-10-07', tolerance: 200,
    },
    {
      id: 'salaire:2026-10-28', ligneId: 'salaire', jour: '2026-10-28',
      montant: SENTINELLES.salaire, signe: 1, du: '2026-10-26', au: '2026-10-30', tolerance: 200,
    },
  ];
  const operations: OperationBancaire[] = [
    {
      id: 'OP1', compteId: 'C1', jour: '2026-10-05', centimes: -SENTINELLES.loyer,
      libelle: 'VIR M DUPONT LOYER', categorie: '', transfertAvec: null,
      majLe: '2026-10-05T10:00:00.000Z',
    },
    {
      id: 'OP2', compteId: 'C1', jour: '2026-10-09', centimes: -SENTINELLES.courses,
      libelle: 'SARL LE PETIT MARCHE', categorie: '', transfertAvec: null,
      majLe: '2026-10-09T10:00:00.000Z',
    },
  ];
  return {
    lignes,
    occurrences,
    operations,
    rapprochements: [],
    importsLe: ['2026-09-30', '2026-10-10'],
    revuesFaites: ['2026-09'],
    tolerance: TOLERANCE_PAR_DEFAUT,
    arreteAu: '2026-10-15',
  };
}

/** Toutes les écritures d'un même montant qu'une projection pourrait porter. */
export function tracesDe(centimes: Centimes): string[] {
  /*
     `euros()` sépare le nombre du symbole par une espace **insécable**. Une
     fuite écrite à la main dans une phrase emploierait une espace ordinaire,
     et ne ressemblerait donc à rien de ce qu'on cherche. Les deux sont
     couvertes — l'essai 3.3 est passé par là.
  */
  const avecEspaceOrdinaire = (c: Centimes) => euros(c).replace(/\u00a0/g, ' ');
  return [
    String(centimes),
    String(-centimes),
    euros(centimes),
    euros(-centimes),
    avecEspaceOrdinaire(centimes),
    avecEspaceOrdinaire(-centimes),
    /*
       nombre non affiché : forme MACHINE voulue. Cette liste énumère toutes
       les écritures possibles d'un montant pour traquer celles qu'une vue
       laisse fuir — lui retirer la forme brute affaiblirait le garde-fou.
    */
    (centimes / 100).toFixed(2),
  ];
}

/**
 * Les montants témoins qu'une vue laisse échapper.
 *
 * Exportée exprès : un garde-fou qu'aucun essai ne peut **faire échouer** ne
 * prouve rien. Celui-ci se nourrit d'une vue fabriquée pour fuir, et doit la
 * refuser — sans quoi son silence sur les vraies projections ne dirait rien
 * non plus.
 */
export function fuitesDe(vue: unknown): string[] {
  const texte = JSON.stringify(vue) ?? '';
  const trouvees: string[] = [];
  for (const [nom, centimes] of Object.entries(SENTINELLES)) {
    for (const trace of tracesDe(centimes)) {
      if (texte.includes(trace)) trouvees.push(`${nom} (${trace})`);
    }
  }
  return trouvees;
}

export const budgetTemoinPourEssais = budgetTemoin;

export function controlerLesConsommateurs(): string[] {
  const problemes: string[] = [];

  /* ── Ce que les déclarations doivent dire ─────────────────────────────── */

  for (const c of CONSOMMATEURS) {
    if (!c.voit.trim()) {
      problemes.push(`« ${c.libelle} » ne dit pas ce qu’il voit. Un interrupteur sans promesse ne se décide pas.`);
    }
    if (c.ecartAuBudgetAutorise && !c.montantsAutorises) {
      problemes.push(`« ${c.libelle} » : un écart au budget est un montant.`);
    }
  }
  const veille = declarationDe('veille');
  if (veille.ecartAuBudgetAutorise) {
    problemes.push(
      'La veille du rythme de vie recevrait un écart au budget. Un budget serré est un choix, ' +
        'pas un signal de santé : une période d’économies volontaires deviendrait une alerte.',
    );
  }
  if (veille.actifParDefaut) {
    problemes.push('La veille du rythme de vie est décochée par défaut (décision 7 du plan).');
  }
  const ia = declarationDe('ia');
  if (!ia.consentementAChaqueFois || ia.actifParDefaut) {
    problemes.push(
      '« Demander à l’IA » est le seul consommateur dont la sortie quitte l’appareil : il se ' +
        'décoche par défaut, et son consentement se redonne à chaque fois.',
    );
  }

  /* ── Et ce que les projections font vraiment ──────────────────────────── */

  const source = budgetTemoin();
  const tous = Object.fromEntries(CONSOMMATEURS.map((c) => [c.id, true])) as ReglagesConsommateurs;

  for (const c of CONSOMMATEURS) {
    const p = projeter(c.id, source, tous, true);
    if (!p) {
      problemes.push(`« ${c.libelle} » ne rend rien alors qu’il est actif et consenti.`);
      continue;
    }
    if (c.montantsAutorises) continue;
    for (const fuite of fuitesDe(p.vue)) {
      problemes.push(
        `« ${c.libelle} » promet « ${c.voit} » et sa projection porte le montant de ${fuite}. ` +
          'La promesse n’est pas tenue par l’interrupteur, elle doit l’être par la forme de ' +
          'ce qui est rendu.',
      );
    }
  }

  /*
     Et l'interrupteur, qui reste nécessaire même s'il ne suffit pas : éteint,
     il ne doit rien rendre du tout.
  */
  const aucun = Object.fromEntries(
    CONSOMMATEURS.map((c) => [c.id, false]),
  ) as ReglagesConsommateurs;
  for (const c of CONSOMMATEURS) {
    if (projeter(c.id, source, aucun, true) !== null) {
      problemes.push(`« ${c.libelle} » rend encore quelque chose une fois éteint.`);
    }
  }

  return problemes;
}
