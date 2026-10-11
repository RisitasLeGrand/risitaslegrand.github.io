/**
 * Le fait : l'unité de donnée que les branches publient et que le cœur sert.
 *
 * ## La règle qui justifie tout ce module
 *
 * Une branche n'accède **jamais** aux magasins d'une autre. Elle publie des
 * faits, et elle lit ceux que la matrice de permissions l'autorise à lire
 * (`permissions.ts`). Sans cette règle, Sport finirait par ouvrir la table des
 * check-ins psychiques « juste pour la fatigue », et plus personne ne saurait
 * qui lit quoi.
 *
 * ## Pourquoi un catalogue de types, et pas des chaînes libres
 *
 * Un type de fait déclaré porte avec lui tout ce dont les autres couches ont
 * besoin : son propriétaire, son domaine, son unité, ses plages plausibles, sa
 * sensibilité. Avec des chaînes libres, chacune de ces questions se reposerait
 * à chaque appel, et se répondrait différemment selon l'appelant.
 *
 * Le catalogue est aussi ce qui rend vérifiable une propriété qu'on ne peut pas
 * lire dans le code : **un type de fait n'a qu'un propriétaire**. Deux branches
 * qui écriraient le même type produiraient deux vérités, et c'est le genre de
 * divergence qu'on découvre après des mois d'historique.
 *
 * ## Les noms de champs sont en camelCase
 *
 * Le schéma du prompt écrit `jour_logique`. Le code du site écrit `majLe`,
 * `derniereRevision`, `ficheId` : du camelCase partout, sauf dans les fichiers
 * de contenu, qui sont du YAML écrit à la main. Un fait est une donnée interne,
 * il suit donc la convention interne — mélanger les deux obligerait à se
 * rappeler, champ par champ, de quel côté de la frontière on se trouve.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Le fait
   ══════════════════════════════════════════════════════════════════════════ */

/** D'où vient la donnée. */
export type Source = 'auto' | 'manuel' | 'import' | 'derive';

/**
 * Ce qu'on sait de son exactitude.
 *
 * - `confirme` : mesuré ou saisi par la personne, et non contredit.
 * - `estime` : déduit, arrondi, ou saisi de mémoire.
 * - `a-verifier` : invraisemblable, ou contredit par une autre source. Un fait
 *   dans cet état **compte quand même** — on ne jette pas une donnée parce
 *   qu'elle surprend — mais il dégrade la fiabilité des analyses qui s'en
 *   servent, et il reste visible jusqu'à ce que la personne tranche.
 */
export type Fiabilite = 'confirme' | 'estime' | 'a-verifier';

/** Un fait publié par une branche. */
export interface Fait {
  id: string;
  /** La branche qui l'a émis. */
  branche: string;
  /** Le domaine d'Odyssée auquel il se rattache. */
  domaine: string;
  /** Son type, tel que le catalogue le déclare. */
  type: string;
  /** Début de l'événement, horodatage ISO. */
  debut: string;
  /** Fin, pour ce qui a une durée. */
  fin?: string;
  /** Le jour logique auquel il compte (voir `jour-logique.ts`). */
  jourLogique: string;
  valeur?: number | string | boolean;
  unite?: string;
  source: Source;
  fiabilite: Fiabilite;
  /** La branche propriétaire du type. Égale à `branche`, sauf anomalie. */
  proprietaire: string;
  /** Incrémentée à chaque modification. Commence à 1. */
  version: number;
  modifieLe: string;
  /** Ce que le type porte en plus de sa valeur. Jamais interprété par le cœur. */
  details?: Record<string, unknown>;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le catalogue des types
   ══════════════════════════════════════════════════════════════════════════ */

/** Ce que porte la valeur d'un fait. */
export type Nature = 'nombre' | 'duree' | 'texte' | 'booleen' | 'aucune';

export interface Plage {
  /** En dehors de ces bornes, la saisie est **refusée** : elle est impossible. */
  possible?: { min?: number; max?: number };
  /**
   * En dehors de ces bornes, la saisie est **acceptée mais marquée
   * `a-verifier`** : elle est invraisemblable, pas impossible.
   *
   * La distinction est le cœur de B.3. Un poids de 300 kg est invraisemblable ;
   * le refuser serait dire à la personne qu'elle se trompe sur son propre
   * corps. Un poids de −5 kg est impossible, et le refuser est juste.
   */
  plausible?: { min?: number; max?: number };
}

export interface TypeDeFait {
  id: string;
  libelle: string;
  /** La branche qui l'écrit. Une seule, toujours. */
  proprietaire: string;
  domaine: string;
  nature: Nature;
  unite?: string;
  plage?: Plage;
  /**
   * Donnée sensible au sens de E.5 : santé, psyché, finances, substances.
   *
   * Un type sensible est **exclu par défaut** du partage, des prompts d'IA et
   * de la lecture par les autres branches. Le drapeau est ici, sur le type,
   * pour qu'aucune couche n'ait à redevenir le juge de ce qui est sensible.
   */
  sensible?: boolean;
  /** Ce que le type dit en une phrase, pour la documentation et les écrans. */
  description: string;
}

const T = (t: TypeDeFait): TypeDeFait => t;

/**
 * Le catalogue initial.
 *
 * Il couvre ce que le prompt attribue aux trois branches en B.1. Les types de
 * Sport et d'Odyssée sont déclarés **avant** que leurs branches existent : c'est
 * voulu, et c'est la raison d'être d'un socle. Un type déclaré sans écrivain ne
 * produit aucun fait et ne coûte rien ; un type inventé au moment d'écrire le
 * premier fait aurait été inventé deux fois.
 */
export const TYPES: readonly TypeDeFait[] = [
  /* --- Révisions publie ---------------------------------------------------- */
  T({
    id: 'revision.seance',
    libelle: 'Séance de révision',
    proprietaire: 'revisions',
    domaine: 'connaissances',
    nature: 'duree',
    unite: 'secondes',
    plage: { possible: { min: 0 }, plausible: { max: 8 * 3600 } },
    description: 'Une séance terminée, avec sa durée, sa matière et son parcours.',
  }),
  T({
    id: 'revision.flashcards',
    libelle: 'Flashcards revues',
    proprietaire: 'revisions',
    domaine: 'connaissances',
    nature: 'nombre',
    unite: 'cartes',
    plage: { possible: { min: 0 }, plausible: { max: 500 } },
    description: 'Nombre de cartes notées dans la journée logique.',
  }),
  T({
    id: 'revision.fiche',
    libelle: 'Fiche travaillée',
    proprietaire: 'revisions',
    domaine: 'connaissances',
    nature: 'duree',
    unite: 'secondes',
    plage: { possible: { min: 0 }, plausible: { max: 6 * 3600 } },
    description: 'Une fiche de cours marquée terminée, avec le temps passé dessus.',
  }),
  T({
    id: 'revision.pretest',
    libelle: 'Prétest tenté',
    proprietaire: 'revisions',
    domaine: 'connaissances',
    nature: 'aucune',
    description: 'Un prétest de fiche tenté, avant la première lecture.',
  }),
  T({
    id: 'revision.qcm',
    libelle: 'Résultat de QCM',
    proprietaire: 'revisions',
    domaine: 'connaissances',
    nature: 'nombre',
    unite: 'points',
    description: 'Score d’une session de QCM, avec son barème dans les détails.',
  }),
  T({
    id: 'revision.niveau',
    libelle: 'Niveau estimé',
    proprietaire: 'revisions',
    domaine: 'connaissances',
    nature: 'nombre',
    unite: 'points Elo',
    plage: { possible: { min: 0, max: 4000 } },
    description: 'Note de niveau par matière ou par fascicule, à une date donnée.',
  }),
  T({
    id: 'revision.retention',
    libelle: 'Rétention FSRS',
    proprietaire: 'revisions',
    domaine: 'cognition',
    nature: 'nombre',
    unite: 'part',
    plage: { possible: { min: 0, max: 1 } },
    description: 'Part des cartes dont la rétention prédite dépasse la cible.',
  }),
  T({
    id: 'revision.cog-training',
    libelle: 'Session de Cog-Training',
    proprietaire: 'revisions',
    domaine: 'cognition',
    nature: 'duree',
    unite: 'secondes',
    plage: { possible: { min: 0 }, plausible: { max: 3 * 3600 } },
    description: 'Une session de quad n-back, de Relational Reasoning ou de Veridical Mapping.',
  }),

  /* --- Sport publie -------------------------------------------------------- */
  T({
    id: 'sport.seance',
    libelle: 'Séance de sport',
    proprietaire: 'sport',
    domaine: 'corps',
    nature: 'duree',
    unite: 'secondes',
    plage: { possible: { min: 0 }, plausible: { max: 5 * 3600 } },
    description: 'Une séance, avec sa durée, son volume, ses muscles et sa difficulté perçue.',
  }),
  T({
    id: 'sport.serie',
    libelle: 'Série',
    proprietaire: 'sport',
    domaine: 'corps',
    nature: 'nombre',
    unite: 'kg',
    plage: { possible: { min: 0, max: 600 } },
    description: 'Une série : charge, répétitions, échec atteint, répétitions en réserve.',
  }),
  T({
    id: 'sport.record',
    libelle: 'Record',
    proprietaire: 'sport',
    domaine: 'corps',
    nature: 'nombre',
    unite: 'kg',
    plage: { possible: { min: 0, max: 600 } },
    description: 'Charge maximale estimée ou meilleure série, par exercice et plage de répétitions.',
  }),
  T({
    id: 'sport.phase',
    libelle: 'Phase d’entraînement',
    proprietaire: 'sport',
    domaine: 'corps',
    nature: 'texte',
    description: 'Prise de masse, sèche, maintien, déload : une période déclarée.',
  }),
  T({
    id: 'sport.blessure',
    libelle: 'Blessure déclarée',
    proprietaire: 'sport',
    domaine: 'corps',
    nature: 'texte',
    sensible: true,
    description: 'Une blessure ou une douleur localisée, avec sa période.',
  }),

  /* --- Odyssée possède ----------------------------------------------------- */
  T({
    id: 'odyssee.focus',
    libelle: 'Temps focus',
    proprietaire: 'odyssee',
    domaine: 'cognition',
    nature: 'duree',
    unite: 'secondes',
    plage: { possible: { min: 0 }, plausible: { max: 6 * 3600 } },
    description: 'Un minuteur de concentration, rattaché à un domaine et à une tâche.',
  }),
  T({
    id: 'odyssee.tache',
    libelle: 'Tâche close',
    proprietaire: 'odyssee',
    domaine: 'ordre',
    nature: 'aucune',
    description: 'Une tâche terminée, avec son domaine et son échéance.',
  }),
  T({
    id: 'odyssee.quete',
    libelle: 'Quête accomplie',
    proprietaire: 'odyssee',
    domaine: 'ordre',
    nature: 'aucune',
    description: 'Une quête du jour ou de la semaine, accomplie.',
  }),
  T({
    id: 'odyssee.evenement',
    libelle: 'Événement d’agenda',
    proprietaire: 'odyssee',
    domaine: 'ordre',
    nature: 'duree',
    unite: 'secondes',
    description: 'Un événement du calendrier, avec son domaine et son lieu.',
  }),
  T({
    id: 'odyssee.poids',
    libelle: 'Poids',
    proprietaire: 'odyssee',
    domaine: 'corps',
    nature: 'nombre',
    unite: 'kg',
    // 300 kg est invraisemblable, pas impossible ; 0 kg est impossible.
    plage: { possible: { min: 20, max: 400 }, plausible: { min: 35, max: 250 } },
    sensible: true,
    description: 'Une pesée. Odyssée en est le propriétaire ; Sport la lit.',
  }),
  T({
    id: 'odyssee.mesure',
    libelle: 'Mesure corporelle',
    proprietaire: 'odyssee',
    domaine: 'corps',
    nature: 'nombre',
    unite: 'cm',
    plage: { possible: { min: 0, max: 300 } },
    sensible: true,
    description: 'Tour de taille ou autre mesure, avec son historique.',
  }),
  T({
    id: 'odyssee.sommeil',
    libelle: 'Sommeil',
    proprietaire: 'odyssee',
    domaine: 'corps',
    nature: 'duree',
    unite: 'secondes',
    plage: { possible: { min: 0, max: 24 * 3600 }, plausible: { min: 2 * 3600, max: 14 * 3600 } },
    description: 'Coucher, lever, durée, qualité perçue.',
  }),
  T({
    id: 'odyssee.repas',
    libelle: 'Repas',
    proprietaire: 'odyssee',
    domaine: 'corps',
    nature: 'nombre',
    unite: 'kcal',
    plage: { possible: { min: 0, max: 20000 } },
    sensible: true,
    description: 'Un repas pris, avec ses macros en option.',
  }),
  T({
    id: 'odyssee.hydratation',
    libelle: 'Hydratation',
    proprietaire: 'odyssee',
    domaine: 'corps',
    nature: 'nombre',
    unite: 'mL',
    plage: { possible: { min: 0, max: 15000 } },
    description: 'Volume bu dans la journée logique.',
  }),
  T({
    id: 'odyssee.medicament',
    libelle: 'Médicament ou complément',
    proprietaire: 'odyssee',
    domaine: 'corps',
    nature: 'texte',
    sensible: true,
    description: 'Enregistrement seul : nom, dose, heure, voie, motif. Aucun conseil, aucune dose proposée.',
  }),
  T({
    id: 'odyssee.statut-hormonal',
    libelle: 'Statut hormonal ou substance',
    proprietaire: 'odyssee',
    domaine: 'corps',
    nature: 'texte',
    sensible: true,
    description: 'Période déclarative. Odyssée en est le propriétaire ; Sport la lit et la contextualise.',
  }),
  T({
    id: 'odyssee.sante',
    libelle: 'Santé générale',
    proprietaire: 'odyssee',
    domaine: 'corps',
    nature: 'texte',
    sensible: true,
    description: 'Maladie, symptômes, douleurs. Alimente Sport.',
  }),
  T({
    id: 'odyssee.checkin',
    libelle: 'Check-in psychique',
    proprietaire: 'odyssee',
    domaine: 'psyche',
    nature: 'nombre',
    unite: 'échelle',
    plage: { possible: { min: 0, max: 10 } },
    sensible: true,
    description: 'Humeur, énergie, stress, motivation. Jamais de qualification clinique.',
  }),
  T({
    id: 'odyssee.charge-percue',
    libelle: 'Charge perçue',
    proprietaire: 'odyssee',
    domaine: 'psyche',
    nature: 'nombre',
    unite: 'échelle',
    plage: { possible: { min: 0, max: 10 } },
    /*
     * Dérivé des check-ins, et volontairement **non sensible** : un nombre de 0
     * à 10, sans texte, sans détail, sans la question dont il vient. C'est ce
     * qui permet à Sport de connaître la fatigue sans approcher la psyché.
     *
     * Le mécanisme ne tient pas à une discipline mais à la forme du type : même
     * si quelqu'un ajoute demain un champ aux check-ins, ce champ ne passera
     * pas par ici.
     */
    description:
      'Fatigue et stress ramenés à un nombre, dérivés des check-ins. Lisible par Sport et Révisions ; les check-ins eux-mêmes ne le sont pas.',
  }),
  T({
    id: 'odyssee.journal',
    libelle: 'Entrée de journal',
    proprietaire: 'odyssee',
    domaine: 'psyche',
    nature: 'texte',
    sensible: true,
    description: 'Texte libre. Ne sort jamais de l’appareil, ni vers une autre branche.',
  }),
  T({
    id: 'odyssee.operation',
    libelle: 'Opération financière',
    proprietaire: 'odyssee',
    domaine: 'finances',
    nature: 'nombre',
    unite: 'EUR',
    sensible: true,
    description: 'Une opération, catégorisée par des règles locales. Jamais d’IBAN ni de numéro de compte.',
  }),
  T({
    id: 'odyssee.valorisation',
    libelle: 'Valorisation de compte',
    proprietaire: 'odyssee',
    domaine: 'finances',
    nature: 'nombre',
    unite: 'EUR',
    sensible: true,
    description: 'Valeur datée d’un compte ou d’un actif, saisie à la main.',
  }),
  T({
    id: 'odyssee.apport-externe',
    libelle: 'Apport de connaissance externe',
    proprietaire: 'odyssee',
    domaine: 'connaissances',
    nature: 'duree',
    unite: 'secondes',
    plage: { possible: { min: 0 }, plausible: { max: 12 * 3600 } },
    description: 'Lecture, cours, conférence, podcast : saisi à la main, marqué « manuel ».',
  }),
  T({
    id: 'odyssee.interaction',
    libelle: 'Interaction avec un proche',
    proprietaire: 'odyssee',
    domaine: 'lien',
    nature: 'duree',
    unite: 'secondes',
    description: 'Temps passé ou contact entretenu. Domaine désactivé par défaut.',
  }),
  T({
    id: 'odyssee.revue',
    libelle: 'Revue périodique',
    proprietaire: 'odyssee',
    domaine: 'psyche',
    nature: 'aucune',
    description: 'Une revue hebdomadaire, mensuelle, trimestrielle ou annuelle, tenue.',
  }),
];

const PAR_ID = new Map(TYPES.map((t) => [t.id, t]));

export const typeDeFait = (id: string): TypeDeFait | undefined => PAR_ID.get(id);

/** Les types qu'une branche possède. */
export const typesDe = (branche: string): TypeDeFait[] =>
  TYPES.filter((t) => t.proprietaire === branche);

/** Les types sensibles au sens de E.5. */
export const typesSensibles = (): TypeDeFait[] => TYPES.filter((t) => t.sensible);

/* ══════════════════════════════════════════════════════════════════════════
   Validation
   ══════════════════════════════════════════════════════════════════════════ */

export type GraviteProbleme = 'refus' | 'doute';

export interface Probleme {
  gravite: GraviteProbleme;
  /** Le champ en cause, quand il y en a un. */
  champ?: string;
  message: string;
}

export interface Verdict {
  /** Rien n'interdit d'enregistrer ce fait. */
  recevable: boolean;
  problemes: Probleme[];
  /**
   * La fiabilité à retenir, qui peut être plus basse que celle demandée.
   *
   * Un fait invraisemblable est enregistré en `a-verifier`, et non refusé : le
   * refuser serait dire à la personne qu'elle se trompe sur son propre corps,
   * son propre compte en banque ou sa propre journée.
   */
  fiabilite: Fiabilite;
}

/** Rend l'instant d'une date ISO lisible, ou `null`. */
function instantDe(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}


/**
 * Valide un fait avant de l'enregistrer.
 *
 * Trois catégories, et la frontière entre les deux dernières est le cœur de
 * B.3 :
 *
 * 1. **Incohérent** — un type inconnu, une date illisible, une fin avant le
 *    début, un propriétaire qui n'est pas celui du type. Refusé : ce n'est pas
 *    une donnée douteuse, c'est une donnée fausse.
 * 2. **Impossible** — hors des bornes physiques du type. Refusé.
 * 3. **Invraisemblable** — hors des bornes habituelles. Accepté, et marqué
 *    `a-verifier`.
 */
export function valider(fait: Partial<Fait>): Verdict {
  const problemes: Probleme[] = [];
  const refus = (message: string, champ?: string) =>
    problemes.push({ gravite: 'refus', message, champ });
  const doute = (message: string, champ?: string) =>
    problemes.push({ gravite: 'doute', message, champ });

  const t = fait.type ? typeDeFait(fait.type) : undefined;
  if (!t) {
    refus(
      `Type de fait inconnu : « ${fait.type ?? '(absent)'} ». Un type doit être déclaré dans le catalogue avant d’être publié.`,
      'type',
    );
  }

  const debut = instantDe(fait.debut);
  if (debut === null) refus('La date de début est absente ou illisible.', 'debut');
  if (fait.fin !== undefined) {
    const fin = instantDe(fait.fin);
    if (fin === null) refus('La date de fin est illisible.', 'fin');
    else if (debut !== null && fin < debut) refus('La fin précède le début.', 'fin');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fait.jourLogique ?? '')) {
    refus('Le jour logique est absent ou mal formé.', 'jourLogique');
  }

  /*
   * Le propriétaire n'est pas une information que l'appelant fournit : c'est
   * une propriété du type. Un fait qui en annonce un autre est le signe qu'une
   * branche écrit chez une autre, c'est-à-dire exactement ce que le socle
   * interdit.
   */
  if (t && fait.proprietaire && fait.proprietaire !== t.proprietaire) {
    refus(
      `« ${t.id} » appartient à ${t.proprietaire} ; ce fait se dit publié par ${fait.proprietaire}. Une branche n’écrit jamais chez une autre.`,
      'proprietaire',
    );
  }
  if (t && fait.branche && fait.branche !== t.proprietaire) {
    refus(
      `« ${t.id} » ne peut être émis que par ${t.proprietaire}, et non par ${fait.branche}.`,
      'branche',
    );
  }

  if (typeof fait.version === 'number' && fait.version < 1) {
    refus('La version d’un fait commence à 1.', 'version');
  }

  if (t && t.nature !== 'aucune' && fait.valeur === undefined) {
    doute(`« ${t.libelle} » attend une valeur, et n’en porte pas.`, 'valeur');
  }

  if (t && typeof fait.valeur === 'number') {
    const p = t.plage;
    const n = fait.valeur;
    if (!Number.isFinite(n)) refus('La valeur n’est pas un nombre fini.', 'valeur');
    if (p?.possible) {
      const { min, max } = p.possible;
      if (min !== undefined && n < min) {
        refus(`${n} ${t.unite ?? ''} est impossible : le minimum est ${min}.`.trim(), 'valeur');
      }
      if (max !== undefined && n > max) {
        refus(`${n} ${t.unite ?? ''} est impossible : le maximum est ${max}.`.trim(), 'valeur');
      }
    }
    if (p?.plausible) {
      const { min, max } = p.plausible;
      if (min !== undefined && n < min) {
        doute(
          `${n} ${t.unite ?? ''} est inhabituellement bas. La valeur est conservée, à confirmer.`.trim(),
          'valeur',
        );
      }
      if (max !== undefined && n > max) {
        doute(
          `${n} ${t.unite ?? ''} est inhabituellement haut. La valeur est conservée, à confirmer.`.trim(),
          'valeur',
        );
      }
    }
  }

  const recevable = !problemes.some((p) => p.gravite === 'refus');
  const demandee = fait.fiabilite ?? 'confirme';
  const fiabilite: Fiabilite = problemes.some((p) => p.gravite === 'doute')
    ? 'a-verifier'
    : demandee;

  return { recevable, problemes, fiabilite };
}
