/**
 * La taxonomie des types de vendeur — Finances, phase 3 bis.
 *
 * ## Une seule taxonomie, et ses catégories sont celles du budget
 *
 * C'est ce qui rend la comparaison prévu / réalisé cohérente **par
 * construction** plutôt que par un tableau de correspondance — un tableau que
 * personne ne tient à jour, et qui diverge au troisième type ajouté. Un type
 * de vendeur pointe vers une catégorie de budget ; les deux côtés de la
 * comparaison parlent donc du même mot.
 *
 * `controlerLaTaxonomie()` vérifie qu'aucun type ne vise une catégorie
 * inconnue, et `categoriesOrphelines()` signale l'inverse — une catégorie de
 * budget que la taxonomie n'alimente jamais. Le plan l'exige : signalée, pas
 * ignorée. Une catégorie qu'aucun vendeur ne peut remplir affichera
 * éternellement un réalisé de zéro face à un prévu, et ce zéro ressemble à
 * une économie.
 *
 * ## Le niveau de finesse, et sur quel critère il a été choisi
 *
 * **Un type doit pouvoir porter une décision différente d'un autre.**
 * « Boulangerie » et « supermarché » se séparent parce qu'on peut vouloir
 * pointer l'un automatiquement et pas l'autre. « Boulangerie » et
 * « pâtisserie » ne se séparent pas, parce qu'on n'en ferait jamais rien — et
 * chaque type de plus est une ligne de plus dans l'écran des réglages.
 *
 * Douze familles, quarante-six types. Modifiable : la taxonomie livrée est un
 * point de départ, et `odysseeTaxonomie` porte les modifications.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Les catégories de budget
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les catégories communes au budget et au pointage.
 *
 * Le catalogue est **modifiable** — une ligne de budget peut porter une
 * catégorie qui n'est pas ici, et ce n'est pas une faute. Mais elle est
 * alors signalée, parce que rien ne pourra jamais la remplir.
 */
export const CATEGORIES_BUDGET: readonly string[] = [
  'Alimentation',
  'Restauration',
  'Transports',
  'Logement',
  'Énergie',
  'Télécoms',
  'Santé',
  'Assurances',
  'Abonnements',
  'Vie courante',
  'Banque',
  'Impôts et taxes',
  'Revenus',
  'Épargne',
  'Crédits',
  'Sans catégorie',
];

/* ══════════════════════════════════════════════════════════════════════════
   Les familles et les types
   ══════════════════════════════════════════════════════════════════════════ */

export type IdFamille =
  | 'alimentation'
  | 'restauration'
  | 'transports'
  | 'logement'
  | 'energie'
  | 'telecoms'
  | 'sante'
  | 'abonnements'
  | 'commerce'
  | 'banque'
  | 'administrations'
  | 'revenus';

export const FAMILLES: Record<IdFamille, string> = {
  alimentation: 'Alimentation',
  restauration: 'Restauration',
  transports: 'Transports',
  logement: 'Logement',
  energie: 'Énergie et eau',
  telecoms: 'Télécoms',
  sante: 'Assurances et santé',
  abonnements: 'Abonnements',
  commerce: 'Commerce',
  banque: 'Banque',
  administrations: 'Administrations',
  revenus: 'Revenus et épargne',
};

export interface TypeDeVendeur {
  id: string;
  famille: IdFamille;
  libelle: string;
  categorie: string;
  /**
   * Vrai pour un type qui ne peut **jamais** être pointé automatiquement,
   * quel que soit le préréglage.
   *
   * Deux raisons distinctes, et il importe de ne pas les confondre :
   * l'ambiguïté (un hypermarché vend de tout, le libellé ne dit pas quoi)
   * et la sensibilité (une pharmacie pointée sans qu'on la regarde fait
   * entrer un fait médical dans une catégorie).
   */
  jamaisAuto: boolean;
  /** Vrai pour un type dont la seule présence est une information sensible. */
  sensible: boolean;
}

const T = (t: TypeDeVendeur): TypeDeVendeur => t;

export const TYPES: readonly TypeDeVendeur[] = [
  /* ── Alimentation ─────────────────────────────────────────────────── */
  T({ id: 'supermarche', famille: 'alimentation', libelle: 'Supermarché', categorie: 'Alimentation', jamaisAuto: false, sensible: false }),
  T({ id: 'superette', famille: 'alimentation', libelle: 'Supérette', categorie: 'Alimentation', jamaisAuto: false, sensible: false }),
  T({ id: 'boulangerie', famille: 'alimentation', libelle: 'Boulangerie', categorie: 'Alimentation', jamaisAuto: false, sensible: false }),
  T({ id: 'boucherie', famille: 'alimentation', libelle: 'Boucherie', categorie: 'Alimentation', jamaisAuto: false, sensible: false }),
  T({ id: 'primeur', famille: 'alimentation', libelle: 'Primeur', categorie: 'Alimentation', jamaisAuto: false, sensible: false }),
  T({ id: 'marche', famille: 'alimentation', libelle: 'Marché', categorie: 'Alimentation', jamaisAuto: false, sensible: false }),
  T({ id: 'epicerie-specialisee', famille: 'alimentation', libelle: 'Épicerie spécialisée', categorie: 'Alimentation', jamaisAuto: false, sensible: false }),
  T({ id: 'livraison-repas', famille: 'alimentation', libelle: 'Livraison de repas', categorie: 'Restauration', jamaisAuto: false, sensible: false }),

  /* ── Restauration ─────────────────────────────────────────────────── */
  T({ id: 'restaurant', famille: 'restauration', libelle: 'Restaurant', categorie: 'Restauration', jamaisAuto: false, sensible: false }),
  T({ id: 'cafe-bar', famille: 'restauration', libelle: 'Café et bar', categorie: 'Restauration', jamaisAuto: false, sensible: false }),
  T({ id: 'restauration-rapide', famille: 'restauration', libelle: 'Restauration rapide', categorie: 'Restauration', jamaisAuto: false, sensible: false }),
  T({ id: 'cantine', famille: 'restauration', libelle: 'Cantine', categorie: 'Restauration', jamaisAuto: false, sensible: false }),

  /* ── Transports ───────────────────────────────────────────────────── */
  T({ id: 'carburant', famille: 'transports', libelle: 'Carburant', categorie: 'Transports', jamaisAuto: false, sensible: false }),
  T({ id: 'peage', famille: 'transports', libelle: 'Péage', categorie: 'Transports', jamaisAuto: false, sensible: false }),
  T({ id: 'stationnement', famille: 'transports', libelle: 'Stationnement', categorie: 'Transports', jamaisAuto: false, sensible: false }),
  T({ id: 'transport-public', famille: 'transports', libelle: 'Transport public', categorie: 'Transports', jamaisAuto: false, sensible: false }),
  T({ id: 'train', famille: 'transports', libelle: 'Train', categorie: 'Transports', jamaisAuto: false, sensible: false }),
  T({ id: 'avion', famille: 'transports', libelle: 'Avion', categorie: 'Transports', jamaisAuto: false, sensible: false }),
  T({ id: 'taxi-vtc', famille: 'transports', libelle: 'Taxi et VTC', categorie: 'Transports', jamaisAuto: false, sensible: false }),
  T({ id: 'location-vehicule', famille: 'transports', libelle: 'Location de véhicule', categorie: 'Transports', jamaisAuto: false, sensible: false }),
  T({ id: 'entretien-auto', famille: 'transports', libelle: 'Entretien automobile', categorie: 'Transports', jamaisAuto: false, sensible: false }),

  /* ── Logement ─────────────────────────────────────────────────────── */
  T({ id: 'loyer', famille: 'logement', libelle: 'Loyer', categorie: 'Logement', jamaisAuto: false, sensible: false }),
  T({ id: 'charges-copropriete', famille: 'logement', libelle: 'Charges de copropriété', categorie: 'Logement', jamaisAuto: false, sensible: false }),
  T({ id: 'travaux-bricolage', famille: 'logement', libelle: 'Travaux et bricolage', categorie: 'Logement', jamaisAuto: false, sensible: false }),
  T({ id: 'ameublement', famille: 'logement', libelle: 'Ameublement', categorie: 'Logement', jamaisAuto: false, sensible: false }),

  /* ── Énergie et eau ───────────────────────────────────────────────── */
  T({ id: 'electricite-gaz', famille: 'energie', libelle: 'Électricité et gaz', categorie: 'Énergie', jamaisAuto: false, sensible: false }),
  T({ id: 'eau', famille: 'energie', libelle: 'Eau', categorie: 'Énergie', jamaisAuto: false, sensible: false }),
  T({ id: 'combustibles', famille: 'energie', libelle: 'Combustibles', categorie: 'Énergie', jamaisAuto: false, sensible: false }),

  /* ── Télécoms ─────────────────────────────────────────────────────── */
  T({ id: 'operateur-mobile', famille: 'telecoms', libelle: 'Opérateur mobile', categorie: 'Télécoms', jamaisAuto: false, sensible: false }),
  T({ id: 'acces-internet', famille: 'telecoms', libelle: 'Accès internet', categorie: 'Télécoms', jamaisAuto: false, sensible: false }),

  /* ── Assurances et santé ──────────────────────────────────────────── */
  T({ id: 'assurance', famille: 'sante', libelle: 'Assurance', categorie: 'Assurances', jamaisAuto: false, sensible: false }),
  T({ id: 'mutuelle', famille: 'sante', libelle: 'Mutuelle', categorie: 'Assurances', jamaisAuto: true, sensible: true }),
  T({ id: 'pharmacie', famille: 'sante', libelle: 'Pharmacie', categorie: 'Santé', jamaisAuto: true, sensible: true }),
  T({ id: 'praticien', famille: 'sante', libelle: 'Praticien', categorie: 'Santé', jamaisAuto: true, sensible: true }),
  T({ id: 'laboratoire', famille: 'sante', libelle: 'Laboratoire', categorie: 'Santé', jamaisAuto: true, sensible: true }),
  T({ id: 'hopital', famille: 'sante', libelle: 'Hôpital', categorie: 'Santé', jamaisAuto: true, sensible: true }),

  /* ── Abonnements ──────────────────────────────────────────────────── */
  T({ id: 'streaming-video', famille: 'abonnements', libelle: 'Streaming vidéo', categorie: 'Abonnements', jamaisAuto: false, sensible: false }),
  T({ id: 'musique', famille: 'abonnements', libelle: 'Musique', categorie: 'Abonnements', jamaisAuto: false, sensible: false }),
  T({ id: 'presse', famille: 'abonnements', libelle: 'Presse', categorie: 'Abonnements', jamaisAuto: false, sensible: false }),
  T({ id: 'logiciel', famille: 'abonnements', libelle: 'Logiciel', categorie: 'Abonnements', jamaisAuto: false, sensible: false }),
  T({ id: 'salle-de-sport', famille: 'abonnements', libelle: 'Salle de sport', categorie: 'Abonnements', jamaisAuto: false, sensible: false }),

  /* ── Commerce ─────────────────────────────────────────────────────── */
  T({ id: 'commerce-en-ligne', famille: 'commerce', libelle: 'Commerce en ligne', categorie: 'Vie courante', jamaisAuto: false, sensible: false }),
  T({ id: 'habillement', famille: 'commerce', libelle: 'Habillement', categorie: 'Vie courante', jamaisAuto: false, sensible: false }),
  T({ id: 'equipement', famille: 'commerce', libelle: 'Équipement', categorie: 'Vie courante', jamaisAuto: false, sensible: false }),
  T({ id: 'culture-loisirs', famille: 'commerce', libelle: 'Culture et loisirs', categorie: 'Vie courante', jamaisAuto: false, sensible: false }),
  T({ id: 'animalerie', famille: 'commerce', libelle: 'Animalerie', categorie: 'Vie courante', jamaisAuto: false, sensible: false }),

  /* ── Banque ───────────────────────────────────────────────────────── */
  T({ id: 'frais-bancaires', famille: 'banque', libelle: 'Frais bancaires', categorie: 'Banque', jamaisAuto: false, sensible: false }),
  T({ id: 'interets', famille: 'banque', libelle: 'Intérêts', categorie: 'Banque', jamaisAuto: false, sensible: false }),
  /*
     Un retrait n'est jamais pointé automatiquement : le billet sorti du
     distributeur ne dit pas ce qu'il a payé, et le classer en « banque »
     ferait disparaître une dépense réelle dans une catégorie technique.
  */
  T({ id: 'retrait', famille: 'banque', libelle: 'Retrait d’espèces', categorie: 'Banque', jamaisAuto: true, sensible: false }),
  T({ id: 'remboursement-credit', famille: 'banque', libelle: 'Remboursement de crédit', categorie: 'Crédits', jamaisAuto: false, sensible: false }),

  /* ── Administrations ──────────────────────────────────────────────── */
  T({ id: 'impots-taxes', famille: 'administrations', libelle: 'Impôts et taxes', categorie: 'Impôts et taxes', jamaisAuto: false, sensible: false }),
  T({ id: 'organisme-social', famille: 'administrations', libelle: 'Organisme social', categorie: 'Impôts et taxes', jamaisAuto: true, sensible: true }),
  T({ id: 'amende', famille: 'administrations', libelle: 'Amende', categorie: 'Impôts et taxes', jamaisAuto: false, sensible: false }),
  T({ id: 'administration', famille: 'administrations', libelle: 'Administration', categorie: 'Impôts et taxes', jamaisAuto: false, sensible: false }),

  /* ── Revenus et épargne ───────────────────────────────────────────── */
  T({ id: 'employeur', famille: 'revenus', libelle: 'Employeur', categorie: 'Revenus', jamaisAuto: false, sensible: false }),
  T({ id: 'prestation-sociale', famille: 'revenus', libelle: 'Prestation sociale', categorie: 'Revenus', jamaisAuto: true, sensible: true }),
  T({ id: 'pension', famille: 'revenus', libelle: 'Pension', categorie: 'Revenus', jamaisAuto: false, sensible: false }),
  T({ id: 'virement-epargne', famille: 'revenus', libelle: 'Virement d’épargne', categorie: 'Épargne', jamaisAuto: false, sensible: false }),
  T({ id: 'placement', famille: 'revenus', libelle: 'Placement', categorie: 'Épargne', jamaisAuto: false, sensible: false }),
];

/* ══════════════════════════════════════════════════════════════════════════
   Les deux types qui ne sont pas des familles mais des états
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un hypermarché vend de l'alimentation, du carburant et de
 * l'électroménager ; le libellé ne dit pas lequel.
 *
 * Trois conduites étaient possibles. Tout ranger en « alimentation » est faux,
 * et faux systématiquement. Laisser « à classer » est correct et
 * insupportable — c'est le vendeur le plus fréquent d'un relevé. On garde
 * donc un type à part, en « proposer », avec la catégorie la plus fréquente
 * chez vous pour ce vendeur, et le fractionnement offert.
 */
export const MULTI_CATEGORIES = T({
  id: 'commerce-multi-categories',
  famille: 'commerce',
  libelle: 'Commerce multi-catégories',
  categorie: 'Vie courante',
  jamaisAuto: true,
  sensible: false,
});

/** « PAYPAL *QUELQUE CHOSE » quand le vendeur final ne se lit pas. */
export const INTERMEDIAIRE = T({
  id: 'intermediaire-de-paiement',
  famille: 'banque',
  libelle: 'Intermédiaire de paiement',
  categorie: 'Sans catégorie',
  jamaisAuto: true,
  sensible: false,
});

/** Le choix explicite « je ne sais pas ce que c'est », qui est valide. */
export const A_IDENTIFIER = T({
  id: 'a-identifier',
  famille: 'commerce',
  libelle: 'À identifier',
  categorie: 'Sans catégorie',
  jamaisAuto: true,
  sensible: false,
});

export const TOUS_LES_TYPES: readonly TypeDeVendeur[] = [
  ...TYPES,
  MULTI_CATEGORIES,
  INTERMEDIAIRE,
  A_IDENTIFIER,
];

const PAR_ID = new Map(TOUS_LES_TYPES.map((t) => [t.id, t]));
export const typeDe = (id: string): TypeDeVendeur | undefined => PAR_ID.get(id);

export const typesDeLaFamille = (f: IdFamille) => TOUS_LES_TYPES.filter((t) => t.famille === f);

/* ══════════════════════════════════════════════════════════════════════════
   Les modifications
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La taxonomie est modifiable : un type peut changer de catégorie.
 *
 * Ce qui ne se modifie pas, et c'est délibéré : `jamaisAuto` et `sensible`.
 * Pouvoir déclarer qu'une pharmacie n'est pas sensible offrirait un geste
 * dont le seul usage serait de défaire une protection par inadvertance.
 */
export interface ModificationDeType {
  typeId: string;
  categorie: string;
}

export interface EtatDeLaTaxonomie {
  id: 'taxonomie';
  modifications: readonly ModificationDeType[];
  majLe: string;
}

export const CLEF_TAXONOMIE = 'taxonomie' as const;

export function categorieDuType(
  typeId: string,
  modifications: readonly ModificationDeType[] = [],
): string {
  const modifiee = modifications.find((m) => m.typeId === typeId);
  if (modifiee) return modifiee.categorie;
  return PAR_ID.get(typeId)?.categorie ?? 'Sans catégorie';
}

/* ══════════════════════════════════════════════════════════════════════════
   Les garde-fous
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les catégories de budget qu'aucun type n'alimente.
 *
 * Signalées, pas ignorées : une catégorie qu'aucun vendeur ne peut remplir
 * affichera éternellement un réalisé de zéro face à un prévu, et ce zéro
 * ressemble à une économie.
 */
export function categoriesOrphelines(
  categoriesDuBudget: readonly string[] = CATEGORIES_BUDGET,
  modifications: readonly ModificationDeType[] = [],
): string[] {
  const alimentees = new Set(TOUS_LES_TYPES.map((t) => categorieDuType(t.id, modifications)));
  return categoriesDuBudget.filter((c) => c !== 'Sans catégorie' && !alimentees.has(c));
}

/** Les catégories visées par un type mais absentes du catalogue du budget. */
export function categoriesInconnues(
  modifications: readonly ModificationDeType[] = [],
): string[] {
  const connues = new Set(CATEGORIES_BUDGET);
  return [
    ...new Set(
      TOUS_LES_TYPES.map((t) => categorieDuType(t.id, modifications)).filter(
        (c) => !connues.has(c),
      ),
    ),
  ].sort();
}

export function controlerLaTaxonomie(): string[] {
  const problemes: string[] = [];

  const vus = new Set<string>();
  for (const t of TOUS_LES_TYPES) {
    if (vus.has(t.id)) problemes.push(`Le type « ${t.id} » est déclaré deux fois.`);
    vus.add(t.id);
    if (!t.libelle.trim()) problemes.push(`Le type « ${t.id} » n’a pas de libellé.`);
    if (!FAMILLES[t.famille]) problemes.push(`Le type « ${t.id} » vise une famille inconnue.`);
    if (t.sensible && !t.jamaisAuto) {
      problemes.push(
        `Le type « ${t.libelle} » est sensible mais pointable automatiquement. Un fait de ` +
          'santé classé sans que personne le regarde est précisément ce qu’on évite.',
      );
    }
  }

  const inconnues = categoriesInconnues();
  if (inconnues.length) {
    problemes.push(
      `Des types visent des catégories hors du catalogue : ${inconnues.join(', ')}. ` +
        'La comparaison prévu / réalisé ne serait plus cohérente par construction.',
    );
  }

  /*
     Chaque famille porte au moins un type : une famille vide s'affiche dans
     l'écran des réglages comme une rubrique qu'on ne peut pas ouvrir.
  */
  for (const f of Object.keys(FAMILLES) as IdFamille[]) {
    if (!typesDeLaFamille(f).length) problemes.push(`La famille « ${FAMILLES[f]} » est vide.`);
  }

  /* Les trois types d'état ne sont jamais automatiques. C'est leur raison d'être. */
  for (const t of [MULTI_CATEGORIES, INTERMEDIAIRE, A_IDENTIFIER]) {
    if (!t.jamaisAuto) {
      problemes.push(`« ${t.libelle} » doit rester hors du pointage automatique.`);
    }
  }
  if (!typeDe('retrait')?.jamaisAuto) {
    problemes.push(
      'Un retrait d’espèces serait pointé automatiquement. Le billet sorti du distributeur ne ' +
        'dit pas ce qu’il a payé, et le ranger en « banque » ferait disparaître une dépense.',
    );
  }
  return problemes;
}
