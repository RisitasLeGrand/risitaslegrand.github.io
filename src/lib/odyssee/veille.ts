/**
 * La veille du rythme de vie — phase 1 : le registre et la ligne de base.
 *
 * ## Ce que ce module ne fera jamais
 *
 * Poser un diagnostic, nommer une pathologie, chiffrer un risque. Il compare
 * des repères factuels à **l'habitude de la personne**, et rien d'autre : la
 * seule référence admise est elle-même, jamais une norme de population.
 *
 * Et il n'y a **aucune vérité terrain**. Cyclades ne saura jamais si un signal
 * était juste. Il n'existe donc ni sensibilité, ni spécificité, ni taux de
 * détection, et aucune interface n'a le droit d'en laisser croire.
 *
 * ## Le registre est déclaratif
 *
 * Un indicateur se déclare avec sa définition, son sens préoccupant, sa
 * justification et son **statut de preuve**. Une branche future qui produit
 * des faits déclare les siens sans toucher au moteur.
 *
 * Aucun indicateur n'est marqué `solide`, et aucun ne le sera : la
 * littérature disponible porte sur des associations de groupe, pas sur des
 * preuves d'effet individuel. `controlerCatalogue()` refuse qu'un `solide`
 * apparaisse — ce serait la première chose à céder.
 *
 * ## La base est robuste, et elle se fige
 *
 * Médiane et écart absolu médian, pas moyenne et écart-type : une nuit
 * blanche ne doit pas déplacer la référence de toute une personne.
 *
 * Et **tant qu'un signal est actif, la base reste celle d'avant**. Sans cela,
 * une dégradation lente devient la nouvelle normale et le signal s'éteint de
 * lui-même — c'est le défaut qui ruine la plupart des détections par écart, et
 * il est parfaitement silencieux.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Le registre
   ══════════════════════════════════════════════════════════════════════════ */

/** Les six domaines du croisement. `lien` ne compte pas dans les k. */
export type DomaineVeille = 'sommeil' | 'activite' | 'rythme' | 'engagement' | 'lien' | 'corps';

export const DOMAINES: Record<DomaineVeille, { libelle: string; compteDansLeCroisement: boolean }> = {
  sommeil: { libelle: 'Sommeil', compteDansLeCroisement: true },
  activite: { libelle: 'Activité et entraînement', compteDansLeCroisement: true },
  rythme: { libelle: 'Rythme de la journée et usage', compteDansLeCroisement: true },
  engagement: { libelle: 'Travail, révisions, engagement', compteDansLeCroisement: true },
  corps: { libelle: 'Corps et alimentation', compteDansLeCroisement: true },
  /*
     Dégradé en appoint, délibérément. La revue citée dit les résultats sur
     les interactions sociales « mitigés » ; en faire un domaine de plein
     droit donnerait du poids à ce que la littérature ne soutient pas. Il peut
     renforcer un signal, jamais le déclencher.
  */
  lien: { libelle: 'Agenda et lien', compteDansLeCroisement: false },
};

export type Preuve = 'solide' | 'plausible' | 'faible' | 'heuristique';

/** Dans quel sens un écart inquiète. */
export type Sens = 'baisse' | 'hausse' | 'irregularite' | 'rupture';

export type Saisie = 'declarative' | 'observee';

export interface Indicateur {
  id: string;
  domaine: DomaineVeille;
  libelle: string;
  /** Ce qu'on mesure, en une phrase, assez précise pour être recalculée. */
  definition: string;
  unite: string;
  sens: Sens;
  preuve: Preuve;
  /** Pourquoi on le regarde. Vide est refusé. */
  justification: string;
  /** Ce qui peut l'expliquer sans que rien n'aille mal. */
  confusions: readonly string[];
  saisie: Saisie;
  /** Jours valides minimaux dans la fenêtre de 14. */
  joursMinimaux: number;
}

const I = (i: Indicateur): Indicateur => i;

/**
 * Le catalogue proposé : vingt-trois indicateurs, six domaines.
 *
 * Le domaine `rythme` est le seul **entièrement observé** : il ne dépend
 * d'aucune saisie, et c'est lui qui tient quand quelqu'un cesse de remplir.
 * Sans lui la veille s'éteindrait exactement quand elle servirait.
 */
export const CATALOGUE: readonly Indicateur[] = [
  /* ── Sommeil ─────────────────────────────────────────────────────────── */
  I({
    id: 'sommeil.duree',
    domaine: 'sommeil',
    libelle: 'Durée de sommeil',
    definition: 'Médiane des durées de nuit sur la fenêtre.',
    unite: 'heures',
    sens: 'baisse',
    preuve: 'plausible',
    justification:
      'Une revue systématique de 2024 relie un sommeil court à des symptômes de stress, ' +
      'd’anxiété ou de dépression légère, par association et non par prédiction.',
    confusions: ['garde d’enfant', 'travail de nuit', 'voyage'],
    saisie: 'declarative',
    joursMinimaux: 10,
  }),
  I({
    id: 'sommeil.irregularite',
    domaine: 'sommeil',
    libelle: 'Irrégularité du coucher',
    definition: 'Écart absolu médian des heures de coucher sur la fenêtre.',
    unite: 'heures',
    sens: 'irregularite',
    preuve: 'plausible',
    justification:
      'Le seul repère que les deux sources citées font remonter indépendamment. Il a ' +
      'l’avantage d’être insensible au niveau : dormir peu mais régulièrement ne déclenche pas.',
    confusions: ['décalage horaire', 'week-ends', 'astreintes'],
    saisie: 'declarative',
    joursMinimaux: 10,
  }),
  I({
    id: 'sommeil.nuits-courtes',
    domaine: 'sommeil',
    libelle: 'Nuits très courtes',
    definition: 'Nombre de nuits de moins de six heures sur la fenêtre.',
    unite: 'nuits',
    sens: 'hausse',
    preuve: 'plausible',
    justification: 'Même source que la durée, pris en compte d’occurrences plutôt qu’en médiane.',
    confusions: ['garde d’enfant', 'travail de nuit'],
    saisie: 'declarative',
    joursMinimaux: 10,
  }),
  I({
    id: 'sommeil.phase',
    domaine: 'sommeil',
    libelle: 'Heure de coucher',
    definition: 'Médiane de l’heure de coucher sur la fenêtre.',
    unite: 'heures',
    sens: 'hausse',
    preuve: 'faible',
    justification: 'Le décalage de phase est rapporté, mais moins nettement que l’irrégularité.',
    confusions: ['saison', 'charge de travail'],
    saisie: 'declarative',
    joursMinimaux: 10,
  }),

  /* ── Activité ────────────────────────────────────────────────────────── */
  I({
    id: 'sport.frequence',
    domaine: 'activite',
    libelle: 'Séances par semaine',
    definition: 'Nombre de séances de sport terminées, ramené à la semaine.',
    unite: 'séances',
    sens: 'baisse',
    preuve: 'plausible',
    justification: 'La sédentarité accrue fait partie des repères que la revue de 2024 relie.',
    confusions: ['blessure déclarée', 'phase de décharge programmée', 'vacances'],
    saisie: 'declarative',
    joursMinimaux: 10,
  }),
  I({
    id: 'sport.abandons',
    domaine: 'activite',
    libelle: 'Séances abandonnées',
    definition: 'Part des séances commencées et non terminées.',
    unite: 'part',
    sens: 'hausse',
    preuve: 'heuristique',
    justification:
      'Aucune étude ne le soutient : c’est un raisonnement. Commencer puis renoncer diffère ' +
      'de ne pas commencer, et la distinction est visible dans les données.',
    confusions: ['matériel indisponible', 'horaires'],
    /*
       Observé, et non déclaré : une séance se conduit dans l'application, qui
       la voit ouverte puis abandonnée sans que personne ait rien à saisir.
       C'est aussi ce qui donne à l'activité un repère qui survit à l'arrêt
       des saisies — sans lui, le croisement ne tiendrait plus que sur deux
       domaines (voir `controlerCatalogue`).
    */
    saisie: 'observee',
    joursMinimaux: 7,
  }),
  I({
    id: 'sport.rupture',
    domaine: 'activite',
    libelle: 'Arrêt d’une pratique installée',
    definition: 'Arrêt d’au moins quatorze jours d’une pratique tenue huit semaines.',
    unite: 'survenue',
    sens: 'rupture',
    preuve: 'plausible',
    justification: 'Une rupture est plus informative qu’une baisse, parce qu’elle a une date.',
    confusions: ['saison', 'vacances', 'blessure'],
    saisie: 'declarative',
    joursMinimaux: 14,
  }),

  /* ── Rythme et usage — le domaine observé ────────────────────────────── */
  I({
    id: 'usage.heure-tardive',
    domaine: 'rythme',
    libelle: 'Usage nocturne',
    definition: 'Part des sessions commencées entre 1 h et 5 h.',
    unite: 'part',
    sens: 'hausse',
    preuve: 'plausible',
    justification: 'L’usage accru du téléphone fait partie des repères de la revue de 2024.',
    confusions: ['travail de nuit', 'fuseau horaire'],
    saisie: 'observee',
    joursMinimaux: 10,
  }),
  I({
    id: 'usage.duree',
    domaine: 'rythme',
    libelle: 'Durée des sessions',
    definition: 'Durée médiane d’une session d’usage.',
    unite: 'minutes',
    sens: 'hausse',
    preuve: 'faible',
    justification: 'Rapporté, mais sans direction stable : une baisse brusque inquiète aussi.',
    confusions: ['changement d’appareil'],
    saisie: 'observee',
    joursMinimaux: 10,
  }),
  I({
    id: 'usage.fragmentation',
    domaine: 'rythme',
    libelle: 'Nombre de sessions',
    definition: 'Nombre de sessions distinctes par jour, après fusion des sessions proches.',
    unite: 'sessions',
    sens: 'hausse',
    preuve: 'heuristique',
    justification: 'Raisonnement : revenir vingt fois diffère de venir deux fois, à durée égale.',
    confusions: ['notifications', 'usage professionnel'],
    saisie: 'observee',
    joursMinimaux: 10,
  }),
  I({
    id: 'jour.amplitude',
    domaine: 'rythme',
    libelle: 'Amplitude de la journée',
    definition: 'Écart entre la première et la dernière trace du jour.',
    unite: 'heures',
    sens: 'hausse',
    preuve: 'heuristique',
    justification:
      'Raisonnement, mais appuyé : c’est la grandeur la plus proche de l’écart jour / nuit ' +
      'que l’actigraphie mesure, avec les moyens dont on dispose.',
    confusions: ['voyage', 'fuseau'],
    saisie: 'observee',
    joursMinimaux: 10,
  }),
  I({
    id: 'jour.irregularite-debut',
    domaine: 'rythme',
    libelle: 'Irrégularité du début de journée',
    definition: 'Écart absolu médian de l’heure de première trace.',
    unite: 'heures',
    sens: 'irregularite',
    preuve: 'plausible',
    justification: 'Par analogie avec l’irrégularité du coucher, qui est le repère le mieux établi.',
    confusions: ['horaires variables', 'week-ends'],
    saisie: 'observee',
    joursMinimaux: 10,
  }),

  /* ── Engagement ──────────────────────────────────────────────────────── */
  I({
    id: 'focus.minutes',
    domaine: 'engagement',
    libelle: 'Minutes de concentration',
    definition: 'Minutes de focus par jour ouvré.',
    unite: 'minutes',
    sens: 'baisse',
    preuve: 'plausible',
    justification: 'La baisse d’activité dirigée accompagne les états rapportés par la revue.',
    confusions: ['congés', 'charge externe'],
    saisie: 'observee',
    joursMinimaux: 8,
  }),
  I({
    id: 'focus.abandons',
    domaine: 'engagement',
    libelle: 'Pomodoros interrompus',
    definition: 'Part des sessions de focus interrompues avant leur terme.',
    unite: 'part',
    sens: 'hausse',
    preuve: 'heuristique',
    justification: 'Raisonnement : l’interruption est un acte, pas une absence.',
    confusions: ['interruptions extérieures'],
    saisie: 'observee',
    joursMinimaux: 7,
  }),
  I({
    id: 'taches.report',
    domaine: 'engagement',
    libelle: 'Tâches repoussées',
    definition: 'Part des tâches planifiées déplacées à un autre jour.',
    unite: 'part',
    sens: 'hausse',
    preuve: 'plausible',
    justification: 'Le report répété est l’un des comportements les plus souvent rapportés.',
    confusions: ['surcharge ponctuelle', 'imprévu'],
    saisie: 'observee',
    joursMinimaux: 8,
  }),
  I({
    id: 'taches.sans-motif',
    domaine: 'engagement',
    libelle: 'Non-réalisations sans motif',
    definition: 'Part des tâches non faites dont la question « pourquoi » est restée sans réponse.',
    unite: 'part',
    sens: 'hausse',
    preuve: 'heuristique',
    justification:
      'Raisonnement : cesser de répondre à une question qu’on répondait est un changement ' +
      'observable — et non une absence de donnée, puisque la question a été posée et ' +
      'l’écran ouvert.',
    confusions: ['lassitude de l’outil'],
    saisie: 'observee',
    joursMinimaux: 7,
  }),
  I({
    id: 'revisions.regularite',
    domaine: 'engagement',
    libelle: 'Régularité des révisions',
    definition: 'Écart absolu médian de l’intervalle entre deux séances de révision.',
    unite: 'jours',
    sens: 'irregularite',
    preuve: 'heuristique',
    justification: 'Raisonnement, par analogie avec l’irrégularité du sommeil.',
    confusions: ['calendrier d’examens'],
    saisie: 'observee',
    joursMinimaux: 8,
  }),

  /* ── Agenda et lien — appoint seulement ──────────────────────────────── */
  I({
    id: 'agenda.annulations',
    domaine: 'lien',
    libelle: 'Événements annulés',
    definition: 'Part des événements du calendrier annulés.',
    unite: 'part',
    sens: 'hausse',
    preuve: 'plausible',
    justification: 'Le retrait est rapporté, mais la revue dit les résultats sociaux mitigés.',
    confusions: ['annulations subies'],
    saisie: 'observee',
    joursMinimaux: 7,
  }),
  I({
    id: 'agenda.densite',
    domaine: 'lien',
    libelle: 'Événements par semaine',
    definition: 'Nombre d’événements au calendrier, ramené à la semaine.',
    unite: 'événements',
    sens: 'baisse',
    preuve: 'faible',
    justification: 'La revue dit explicitement les résultats sur les interactions mitigés.',
    confusions: ['vacances', 'télétravail', 'agenda tenu ailleurs'],
    saisie: 'declarative',
    joursMinimaux: 10,
  }),
  I({
    id: 'lien.interactions',
    domaine: 'lien',
    libelle: 'Interactions notées',
    definition: 'Durée ou nombre d’interactions enregistrées, ramenés à la semaine.',
    unite: 'interactions',
    sens: 'baisse',
    preuve: 'faible',
    justification: 'Même réserve, et saisie très facultative : il ne peut qu’appuyer.',
    confusions: ['saisie abandonnée'],
    saisie: 'declarative',
    joursMinimaux: 10,
  }),

  /* ── Corps ───────────────────────────────────────────────────────────── */
  I({
    id: 'repas.regularite',
    domaine: 'corps',
    libelle: 'Régularité des repas',
    definition: 'Écart absolu médian de l’heure des repas notés.',
    unite: 'heures',
    sens: 'irregularite',
    preuve: 'plausible',
    justification: 'Le rythme alimentaire suit le rythme général, et se note déjà.',
    confusions: ['horaires variables', 'jeûne volontaire'],
    saisie: 'declarative',
    joursMinimaux: 10,
  }),
  I({
    id: 'repas.sautes',
    domaine: 'corps',
    libelle: 'Repas sautés',
    definition:
      'Repas attendus non notés **les jours où d’autres repas le sont**. Un jour sans ' +
      'aucune saisie n’est pas un jour de jeûne.',
    unite: 'repas',
    sens: 'hausse',
    preuve: 'heuristique',
    justification: 'Raisonnement, et la définition porte la garde contre l’absence.',
    confusions: ['jeûne volontaire', 'repas pris dehors'],
    saisie: 'declarative',
    joursMinimaux: 8,
  }),
  I({
    id: 'poids.variation',
    domaine: 'corps',
    libelle: 'Variation de poids',
    definition: 'Variation sur trente jours, rapportée à la dispersion habituelle.',
    unite: 'écarts',
    sens: 'hausse',
    preuve: 'plausible',
    justification: 'Une variation rapide, dans un sens ou l’autre, accompagne les états rapportés.',
    confusions: ['sport', 'maladie', 'traitement déclaré'],
    saisie: 'declarative',
    joursMinimaux: 8,
  }),
];

/* ══════════════════════════════════════════════════════════════════════════
   Le contrôle du catalogue
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerCatalogue(catalogue: readonly Indicateur[] = CATALOGUE): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();

  for (const i of catalogue) {
    if (vus.has(i.id)) problemes.push(`« ${i.id} » est déclaré deux fois.`);
    vus.add(i.id);
    if (!i.justification.trim()) {
      problemes.push(`« ${i.id} » n’a pas de justification : un indicateur sans raison est écarté.`);
    }
    /*
       Aucun « solide », et c'est la ligne la plus importante du contrôle.
       La littérature disponible porte sur des associations de groupe ; un
       indicateur marqué solide revendiquerait une preuve d'effet individuel
       qui n'existe pas, et c'est la première chose qui céderait.
    */
    if (i.preuve === 'solide') {
      problemes.push(
        `« ${i.id} » est marqué « solide ». Aucun indicateur de cette veille ne peut l’être : ` +
          'les sources disponibles établissent des associations, pas des effets individuels.',
      );
    }
    if (i.preuve === 'heuristique' && !i.justification.toLowerCase().includes('raisonnement')) {
      problemes.push(
        `« ${i.id} » est heuristique mais sa justification ne le dit pas. Un raisonnement ` +
          'doit s’annoncer comme tel, sans quoi il se lit comme une étude.',
      );
    }
    if (!i.confusions.length) {
      problemes.push(`« ${i.id} » ne déclare aucun facteur de confusion : c’est invraisemblable.`);
    }
    if (!(i.domaine in DOMAINES)) problemes.push(`« ${i.id} » vise un domaine inconnu.`);
  }

  /*
     La garde qui décide si cette veille sert à quelque chose.

     Le croisement exige DOMAINES_MINIMAUX domaines comptants. Si moins de
     DOMAINES_MINIMAUX domaines comptants portent un indicateur observé, alors
     une personne qui cesse de saisir fait mécaniquement tomber la veille en
     « données insuffisantes » — elle se tait au moment précis où elle avait
     une chance de servir, et son silence se lira comme une absence de
     problème. C'est le mode de défaillance le plus coûteux de tout le
     dispositif, et il est entièrement silencieux.
  */
  const observes = catalogue.filter((i) => i.saisie === 'observee');
  const domainesObservables = new Set(
    observes.filter((i) => DOMAINES[i.domaine]?.compteDansLeCroisement).map((i) => i.domaine),
  );
  if (domainesObservables.size < DOMAINES_MINIMAUX) {
    problemes.push(
      `Seuls ${domainesObservables.size} domaine(s) comptant(s) portent un indicateur observé, ` +
        `pour ${DOMAINES_MINIMAUX} exigés par le croisement. Quelqu’un qui cesse de saisir ` +
        'ferait alors tomber la veille en « données insuffisantes », c’est-à-dire au silence, ' +
        'au moment où elle aurait servi.',
    );
  }

  /*
     Et au moins un domaine *entièrement* observé : un domaine où aucune
     saisie n'est requise garde toute sa valeur quand les autres s'éteignent.
  */
  const toutObserve = [...new Set(observes.map((i) => i.domaine))].filter((d) =>
    catalogue.filter((i) => i.domaine === d).every((i) => i.saisie === 'observee'),
  );
  if (!toutObserve.length) {
    problemes.push(
      'Aucun domaine n’est entièrement observé. La veille dépendrait alors entièrement de la ' +
        'saisie, et s’éteindrait au moment où quelqu’un cesse de saisir.',
    );
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   La ligne de base
   ══════════════════════════════════════════════════════════════════════════ */

export const JOURS_DE_REFERENCE = 56;
export const JOURS_DE_FENETRE = 14;

export const mediane = (xs: readonly number[]): number | null => {
  if (!xs.length) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/**
 * L'écart absolu médian : la médiane des écarts à la médiane.
 *
 * Et non l'écart-type. Une nuit blanche élève l'écart-type d'une personne
 * régulière au point que plus rien ne dévie jamais ; elle ne bouge presque
 * pas l'écart absolu médian. C'est toute la différence entre une référence
 * qui tient et une référence qu'un seul événement désarme.
 */
export function ecartAbsoluMedian(xs: readonly number[]): number | null {
  const m = mediane(xs);
  if (m === null) return null;
  return mediane(xs.map((x) => Math.abs(x - m)));
}

export interface Mesure {
  jour: string;
  valeur: number;
}

export interface LigneDeBase {
  indicateur: string;
  /** Séparées : un week-end n'a pas le rythme d'un mardi. */
  ouvre: { mediane: number; dispersion: number; jours: number } | null;
  weekEnd: { mediane: number; dispersion: number; jours: number } | null;
  /** Le dernier jour pris en compte — ce qui permet de la figer. */
  arreteeAu: string;
}

const estWeekEnd = (jour: string) => {
  const j = new Date(`${jour}T12:00:00.000Z`).getUTCDay();
  return j === 0 || j === 6;
};

/**
 * La base d'un indicateur sur la période de référence qui précède `arreteeAu`.
 *
 * `arreteeAu` est un paramètre, et c'est **ce qui permet de figer la base**
 * pendant qu'un signal est actif : on la recalcule avec la date d'avant le
 * signal, et la dégradation en cours ne vient pas s'y fondre.
 */
export function ligneDeBase(
  indicateur: string,
  mesures: readonly Mesure[],
  arreteeAu: string,
  joursDeReference = JOURS_DE_REFERENCE,
): LigneDeBase {
  const debut = new Date(Date.parse(`${arreteeAu}T12:00:00.000Z`) - joursDeReference * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const retenues = mesures.filter((m) => m.jour > debut && m.jour <= arreteeAu);

  const resume = (xs: readonly number[]) => {
    const m = mediane(xs);
    const d = ecartAbsoluMedian(xs);
    return m === null || d === null ? null : { mediane: m, dispersion: d, jours: xs.length };
  };

  return {
    indicateur,
    ouvre: resume(retenues.filter((m) => !estWeekEnd(m.jour)).map((m) => m.valeur)),
    weekEnd: resume(retenues.filter((m) => estWeekEnd(m.jour)).map((m) => m.valeur)),
    arreteeAu,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Données suffisantes
   ══════════════════════════════════════════════════════════════════════════ */

export const INDICATEURS_MINIMAUX = 6;
export const DOMAINES_MINIMAUX = 3;
export const JOURS_DE_BASE_MINIMAUX = 28;

export type StatutVeille = 'active' | 'donnees-insuffisantes';

export interface Suffisance {
  statut: StatutVeille;
  eligibles: readonly string[];
  domaines: readonly DomaineVeille[];
  /** Ce qui manque, nommé. Jamais un silence. */
  manques: readonly string[];
  /**
   * Les indicateurs dont aucune donnée n'est jamais arrivée.
   *
   * À part, et non noyés dans `manques` : au premier jour d'usage ils sont
   * vingt-trois, et une liste de vingt-trois lignes ne se lit pas. L'écran
   * en dit le nombre ; mais il le dit, parce qu'un indicateur muet n'est pas
   * un indicateur rassurant.
   */
  jamaisRenseignes: readonly string[];
}

/**
 * La veille a-t-elle de quoi parler ?
 *
 * Elle le dit toujours, et nomme ce qui manque — « le sommeil n'est plus
 * saisi depuis douze jours » plutôt qu'un écran vide. Un silence se lit comme
 * « tout va bien », ce qui est exactement ce qu'il ne faut pas laisser croire.
 */
export function suffisance(
  parIndicateur: Readonly<Record<string, { joursDansLaFenetre: number; joursDeBase: number }>>,
  catalogue: readonly Indicateur[] = CATALOGUE,
): Suffisance {
  const eligibles: string[] = [];
  const manques: string[] = [];

  const jamaisRenseignes: string[] = [];

  for (const i of catalogue) {
    const compte = parIndicateur[i.id];
    if (!compte || (compte.joursDansLaFenetre === 0 && compte.joursDeBase === 0)) {
      jamaisRenseignes.push(i.id);
      continue;
    }
    if (compte.joursDansLaFenetre >= i.joursMinimaux && compte.joursDeBase >= JOURS_DE_BASE_MINIMAUX) {
      eligibles.push(i.id);
      continue;
    }
    if (compte.joursDansLaFenetre < i.joursMinimaux) {
      manques.push(
        `${i.libelle} : ${compte.joursDansLaFenetre} jour(s) sur les ${i.joursMinimaux} attendus.`,
      );
    } else {
      manques.push(
        `${i.libelle} : ${compte.joursDeBase} jour(s) d’historique sur les ` +
          `${JOURS_DE_BASE_MINIMAUX} nécessaires à la ligne de base.`,
      );
    }
  }

  const domaines = [
    ...new Set(
      eligibles
        .map((id) => catalogue.find((i) => i.id === id)?.domaine)
        .filter((d): d is DomaineVeille => d !== undefined)
        .filter((d) => DOMAINES[d].compteDansLeCroisement),
    ),
  ];

  const assez = eligibles.length >= INDICATEURS_MINIMAUX && domaines.length >= DOMAINES_MINIMAUX;
  if (!assez) {
    manques.unshift(
      `${eligibles.length} indicateur(s) éligible(s) sur ${INDICATEURS_MINIMAUX} et ` +
        `${domaines.length} domaine(s) sur ${DOMAINES_MINIMAUX}.`,
    );
  }
  return {
    statut: assez ? 'active' : 'donnees-insuffisantes',
    eligibles,
    domaines,
    manques,
    jamaisRenseignes,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les comptes de jours
   ══════════════════════════════════════════════════════════════════════════ */

/** Les `joursDeFenetre` derniers jours, bornes incluses, jusqu'à `arreteeAu`. */
export function fenetreRecente(
  mesures: readonly Mesure[],
  arreteeAu: string,
  joursDeFenetre = JOURS_DE_FENETRE,
): readonly Mesure[] {
  const debut = new Date(Date.parse(`${arreteeAu}T12:00:00.000Z`) - (joursDeFenetre - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return mesures.filter((m) => m.jour >= debut && m.jour <= arreteeAu);
}

/**
 * Les comptes que `suffisance()` attend, à partir des mesures réellement là.
 *
 * Un jour sans mesure n'entre pas : il n'est **pas** compté comme une valeur
 * basse. C'est la règle qui tient toute la veille — sans elle, quelqu'un qui
 * cesse de saisir produirait mécaniquement l'effondrement de tous ses
 * indicateurs déclaratifs, et la veille crierait au moment précis où elle ne
 * sait plus rien.
 */
export function comptesDeJours(
  mesuresParIndicateur: Readonly<Record<string, readonly Mesure[]>>,
  arreteeAu: string,
  joursDeFenetre = JOURS_DE_FENETRE,
  joursDeReference = JOURS_DE_REFERENCE,
): Record<string, { joursDansLaFenetre: number; joursDeBase: number }> {
  const comptes: Record<string, { joursDansLaFenetre: number; joursDeBase: number }> = {};
  const debutBase = new Date(
    Date.parse(`${arreteeAu}T12:00:00.000Z`) - joursDeReference * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  for (const [id, mesures] of Object.entries(mesuresParIndicateur)) {
    const joursDistincts = (ms: readonly Mesure[]) => new Set(ms.map((m) => m.jour)).size;
    comptes[id] = {
      joursDansLaFenetre: joursDistincts(fenetreRecente(mesures, arreteeAu, joursDeFenetre)),
      joursDeBase: joursDistincts(mesures.filter((m) => m.jour > debutBase && m.jour <= arreteeAu)),
    };
  }
  return comptes;
}
