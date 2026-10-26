/**
 * CE QUE CHAQUE RUBRIQUE DE DONNÉES S'APPELLE, EN FRANÇAIS.
 *
 * ## Le défaut que ce fichier corrige
 *
 * La table « Peser chaque rubrique » de l'écran Stockage affichait le nom
 * TECHNIQUE du magasin : `odysseeEtapesCochees`, `vmSeuils`, `epreuveDgfipEnCours`.
 * Soixante-quinze lignes d'identifiants en chameau, dont personne hors du code
 * ne devine le contenu. L'écran demande de peser ses données pour décider quoi
 * garder : il faut donc pouvoir lire ce qu'on pèse.
 *
 * ## Une étiquette par magasin, et non par groupe
 *
 * Les groupes existent déjà (`sauvegarde/groupes.ts`) et servent à l'export et
 * à l'effacement, où l'on choisit par domaine. Ici, chaque ligne mesure UN
 * magasin : l'étiquetage par groupe donnerait quarante-quatre lignes
 * « Odyssée » et ne dirait rien de plus que le nom technique. Le groupe passe
 * donc en sous-titre, où il situe la rubrique sans la nommer à sa place.
 *
 * ## Un magasin sans étiquette refuse la construction
 *
 * `src/pages/stockage.astro` appelle `magasinsSansIntitule` dans son
 * frontmatter, donc à la CONSTRUCTION. Un magasin ajouté à `db.ts` sans
 * étiquette arrête `astro build` avec son nom.
 *
 * Ce n'est pas excessif : sans ce refus, la ligne s'afficherait avec son nom
 * technique — exactement le défaut qu'on corrige — et seule une relecture de
 * l'écran l'aurait vu. Un refus à la construction se voit tout de suite, par
 * celui qui a ajouté le magasin, qui est précisément la personne qui sait
 * comment l'appeler.
 *
 * ## Comment ces étiquettes ont été écrites
 *
 * Chacune vient du TYPE que le magasin porte dans le schéma de `db.ts` —
 * `SessionNBack`, `MesureCorporelle`, `RegleDePointage` — et non d'une
 * supposition sur son nom. Cinq d'entre elles ont demandé d'aller lire le
 * module qui les définit : une « passation » est celle d'une échelle de
 * Psyché, un « vendeur » est un commerçant appris avec ses alias, la
 * « taxonomie » porte les reclassements de types de vendeurs, les
 * « consommateurs » sont les lecteurs autorisés du budget, et une « marque de
 * créneau » dit qu'une prise de traitement a eu lieu.
 */
import { groupeDuMagasin } from './sauvegarde/groupes';

/**
 * L'étiquette de chaque magasin.
 *
 * L'ordre suit celui du schéma de `db.ts`, pour qu'une comparaison des deux
 * listes se fasse à l'œil. Les étiquettes, elles, se lisent seules : pas de
 * « données de », pas de « table des », pas de parenthèse de pluriel.
 */
export const INTITULES_DES_MAGASINS: Readonly<Record<string, string>> = {
  /* ── Réglages ─────────────────────────────────────────────────────────── */
  etat: 'Réglages et préférences',

  /* ── Révisions ────────────────────────────────────────────────────────── */
  cartes: 'Flashcards et leurs échéances',
  fiches: 'Fiches lues et leur avancement',
  quiz: 'Résultats des quiz de cours',
  jours: 'Pointages quotidiens',
  actualitesLues: 'Actualités marquées lues',
  podcastPositions: 'Position d’écoute des fiches audio',

  /* ── Séances et notes ─────────────────────────────────────────────────── */
  seances: 'Séances de révision',
  notes: 'Notes prises en séance',

  /* ── Niveau estimé ───────────────────────────────────────────────────── */
  competences: 'Niveau estimé par matière',
  difficultes: 'Difficulté mesurée des questions',

  /* ── Entraînement cognitif ───────────────────────────────────────────── */
  nback: 'Sessions de mémoire de travail',
  relationnel: 'Sessions de raisonnement relationnel',
  vmSeuils: 'Seuils de correspondance perceptive',
  vmSessions: 'Sessions de correspondance perceptive',

  /* ── QCM DGFiP ───────────────────────────────────────────────────────── */
  qcmDgfip: 'Suivi des questions du QCM DGFiP',
  qcmSessions: 'Épreuves blanches passées',
  epreuveDgfipEnCours: 'Épreuve blanche gardée pour plus tard',

  /* ── Journaux et assistance ──────────────────────────────────────────── */
  journal: 'File de rattrapage des erreurs',
  aides: 'Questions préparées pour un assistant',
  revisions: 'Histoire des révisions',
  operations: 'Journal des opérations',
  visites: 'Nombre d’ouvertures de chaque écran',
  centreElements: 'Notifications reçues',

  /* ── Odyssée : l'agenda et les tâches ────────────────────────────────── */
  odysseeTaches: 'Tâches',
  odysseeOccurrences: 'Occurrences des tâches répétées',
  odysseeEtapesCochees: 'Étapes cochées',
  odysseeExceptionsScellees: 'Exceptions d’agenda, scellées',
  odysseeReports: 'Reports en attente',
  odysseeQuetes: 'Quêtes',
  odysseeEvenements: 'Événements de l’agenda',
  odysseeFocus: 'Temps de concentration',
  odysseeRevues: 'Revues',

  /* ── Odyssée : le cycle et le sexe déclaré ───────────────────────────── */
  odysseeCycleJournal: 'Journal du cycle',
  odysseeCycleReglages: 'Réglages du suivi du cycle',
  odysseeSexe: 'Sexe déclaré',

  /* ── Sport ───────────────────────────────────────────────────────────── */
  sportExercices: 'Exercices de musculation',
  sportSeances: 'Séances de sport',
  sportPhases: 'Phases d’entraînement',
  sportBlessures: 'Blessures et ménagements',
  sportProgrammes: 'Programmes de sport',

  /* ── Odyssée : le corps ──────────────────────────────────────────────── */
  odysseePesees: 'Pesées',
  odysseeMesures: 'Mesures corporelles',
  odysseeNuits: 'Nuits',
  odysseeRepas: 'Repas',
  odysseeBoissons: 'Boissons',

  /* ── Odyssée : la santé ──────────────────────────────────────────────── */
  odysseeSante: 'État de santé déclaré',
  odysseeTrajectoires: 'Trajectoires de santé',
  odysseeMedicaments: 'Prises de médicaments',
  odysseeHormonal: 'Statut hormonal',
  odysseeTraitements: 'Traitements',
  odysseeCreneaux: 'Créneaux de traitement cochés',
  odysseePrelevements: 'Prélèvements',
  odysseeResultats: 'Résultats d’analyses',
  odysseeSymptomes: 'Symptômes',
  odysseeConditions: 'Conditions déclarées',

  /* ── Odyssée : Psyché ────────────────────────────────────────────────── */
  odysseeRessentis: 'Ressentis',
  odysseeJournal: 'Journal de Psyché',
  odysseeCheckins: 'Points du jour',
  odysseeHebdos: 'Points de la semaine',
  odysseePassations: 'Passations des échelles',

  /* ── Odyssée : les finances ──────────────────────────────────────────── */
  odysseeComptes: 'Comptes bancaires',
  odysseeValorisations: 'Valorisations de patrimoine',
  odysseeOperations: 'Opérations bancaires',
  odysseeLignesBudget: 'Lignes de budget',
  odysseePointages: 'Pointages d’opérations',
  odysseeReglesPointage: 'Règles de pointage automatique',
  odysseeRapprochements: 'Rapprochements entre opérations et budget',
  odysseeVendeurs: 'Vendeurs appris',
  odysseeTaxonomie: 'Reclassements de types de vendeurs',
  odysseeConsommateurs: 'Lecteurs autorisés du budget',

  /* ── Odyssée : le rythme de vie ──────────────────────────────────────── */
  odysseeUsage: 'Temps passé dans Cyclades',
  odysseeVeilleBases: 'Lignes de base du rythme de vie',
  odysseeVeilleSignaux: 'Signaux du rythme de vie',
  odysseeVeilleReglages: 'Réglages de la veille du rythme de vie',
};

/**
 * L'étiquette d'un magasin, ou l'arrêt net.
 *
 * L'arrêt est volontaire : rendre le nom technique en secours ramènerait
 * exactement le défaut qu'on corrige, et en silence. Une page qui affiche une
 * rubrique affiche donc son nom français, ou rien du tout.
 */
export function intituleDuMagasin(nom: string): string {
  const intitule = INTITULES_DES_MAGASINS[nom];
  if (!intitule) {
    throw new Error(
      `Aucun intitulé pour le magasin « ${nom} ». ` +
        'Ajoutez-le dans « src/lib/intitules-magasins.ts » : ce que la rubrique ' +
        'contient, en français, tel que la personne le reconnaîtrait.',
    );
  }
  return intitule;
}

/** Le groupe d'un magasin, pour le sous-titre — ou rien s'il n'en a pas. */
export function groupeLisibleDuMagasin(nom: string): string | null {
  return groupeDuMagasin(nom)?.libelle ?? null;
}

/**
 * Les magasins d'une liste qui n'ont pas d'étiquette.
 *
 * Appelée à la CONSTRUCTION par l'écran Stockage. Rend la liste entière plutôt
 * que le premier manquant : qui ajoute trois magasins d'un coup préfère les
 * trois noms à trois constructions successives.
 */
export function magasinsSansIntitule(noms: readonly string[]): string[] {
  return noms.filter((n) => !INTITULES_DES_MAGASINS[n]);
}
