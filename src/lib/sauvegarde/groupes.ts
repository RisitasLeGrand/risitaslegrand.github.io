/**
 * Les magasins, groupés en domaines lisibles, et datés.
 *
 * ## À quoi sert ce regroupement
 *
 * Trois choses en dépendent et doivent parler le même langage : l'export
 * lisible, l'effacement ciblé, et plus tard la sauvegarde partielle. Un nom de
 * magasin comme `vmSeuils` ne veut rien dire pour la personne qui choisit ce
 * qu'elle exporte ou efface ; « Cog-Training » veut dire quelque chose.
 *
 * ## La date de chaque magasin est déclarée, pas devinée
 *
 * Un effacement par période demande de savoir, pour chaque magasin, **quel
 * champ porte sa date**. Ils n'ont pas le même : `le` pour les sessions, `jour`
 * pour les pointages, `majLe` pour les niveaux, `ouverteLe` pour le journal
 * d'erreurs. Deviner par tâtonnement — « s'il y a un champ qui ressemble à une
 * date » — marcherait jusqu'au jour où un champ ajouté ressemblerait à une date
 * sans en être une, et effacerait le mauvais intervalle.
 *
 * Un magasin sans date déclarée ne porte **pas d'historique** : il porte un état
 * courant, qu'une période ne découpe pas. L'effacement par période le refuse
 * donc explicitement, au lieu de l'épargner en silence.
 */

/** Un groupe de magasins, tel qu'il s'affiche. */
export interface GroupeDeMagasins {
  id: string;
  libelle: string;
  description: string;
  magasins: readonly string[];
}

/**
 * Le champ portant la date d'un enregistrement, par magasin.
 *
 * `null` veut dire « état courant, sans historique » : le magasin ne se découpe
 * pas par période.
 */
export const CHAMP_DATE: Record<string, string | null> = {
  // Journaux et historiques : une ligne par événement, donc une date.
  quiz: 'le',
  nback: 'le',
  relationnel: 'le',
  vmSessions: 'le',
  qcmSessions: 'le',
  aides: 'le',
  jours: 'jour',
  seances: 'jour',
  notes: 'majLe',
  journal: 'ouverteLe',
  revisions: 'le',
  /* Le marqueur de lecture d'une actualité est daté : il s'élague comme le
     reste de la progression, et une lecture d'il y a trois ans n'a plus
     d'intérêt que pour le volume qu'elle occupe. */
  actualitesLues: 'luLe',
  /*
     Le journal d'opérations ne porte pas de champ de date : son instant vit
     dans son identifiant et dans son horloge logique. Il serait découpable par
     préfixe d'horloge, mais pas par le mécanisme générique d'ici, qui compare
     des dates ISO — et prétendre le contraire ferait silencieusement passer un
     découpage à côté. Surtout : effacer une tranche du journal rendrait
     irrecalculables les états dérivés qui en dépendent. La compaction du
     journal est un sujet à elle seule, prévue en phase 5, avec sa règle propre
     — ne jamais compacter au-delà de ce que tous les appareils ont vu.
  */
  operations: null,
  // États courants : une ligne par chose suivie, pas par événement. Les dates
  // qu'ils portent disent « vu la dernière fois le… », et découper là-dessus
  // effacerait l'état d'une carte sous prétexte qu'elle est ancienne.
  cartes: null,
  fiches: null,
  competences: null,
  difficultes: null,
  qcmDgfip: null,
  vmSeuils: null,
  etat: null,
  /*
     Odyssée. Trois magasins portent un historique, deux portent un état.

     Une **tâche** et une **quête** sont des objets qu'on garde : une tâche
     close l'an dernier n'est pas un événement de l'an dernier à effacer, c'est
     une ligne de l'inventaire — et la quête, surtout, porte *dans* l'objet la
     liste de ses jours tenus. Les découper par période effacerait cinq ans de
     série pour avoir voulu effacer un mois. Elles sont donc des états.

     Les **événements**, le **focus** et les **revues** sont au contraire une
     ligne par chose arrivée, à une date : ils se découpent.
  */
  odysseeTaches: null,
  /*
     Les exceptions des séries (prompt 38). Elles se découpent, contrairement
     à la tâche qui les porte : une occurrence est **une ligne par chose
     arrivée, à une date**, exactement comme une revue.

     Les deux magasins en clair se découpent sur `jourPrevu`, le jour logique
     que la règle prévoyait.

     LES DEUX SCELLÉS SE DÉCOUPENT SUR `majLe`, ET C'EST UNE APPROXIMATION
     ASSUMÉE. Leur jour logique est **dans le chiffré** — c'est tout l'objet
     de la décision 3 —, donc inatteignable coffre fermé, donc inutilisable
     pour découper. `majLe` est la seule date qu'ils exposent en clair : elle
     dit quand la ligne a été écrite, non quand la chose a eu lieu. Les deux
     coïncident presque toujours, et l'écart ne peut jouer que sur une
     exception pointée longtemps après coup.

     L'autre choix aurait été `null` — « jamais découpée ». Il aurait fait
     passer le contrôle tout aussi bien, et laissé des exceptions scellées
     derrière un effacement qui se dit complet. Une approximation qu'on écrit
     vaut mieux qu'un oubli qui se tait.
  */
  odysseeOccurrences: 'jourPrevu',
  odysseeEtapesCochees: 'jourPrevu',
  odysseeExceptionsScellees: 'majLe',
  /*
     `null` — « jamais découpé », et pour une fois ce n'est pas une
     approximation. Un report ne porte AUCUNE date : en mettre une en clair
     dirait qu'un geste a eu lieu ce jour-là (A-6, option D). Un pli ne se
     découpe donc pas par l'âge, il se supprime au moment du report. Un
     magasin qui ne grossit que le temps d'un coffre fermé n'a pas besoin de
     rétention.
  */
  odysseeReports: null,
  odysseeQuetes: null,
  odysseeEvenements: 'debut',
  odysseeFocus: 'debut',
  odysseeRevues: 'jour',
  /*
     Sport. La bibliothèque d'exercices est un **état** : effacer les exercices
     d'il y a trois ans rendrait illisibles les séances qui y renvoient. Les
     séances, les phases et les blessures, elles, sont datées.
  */
  sportExercices: null,
  sportSeances: 'jour',
  sportPhases: 'debut',
  sportBlessures: 'debut',
  sportProgrammes: null,
  odysseePesees: 'jour',
  odysseeMesures: 'jour',
  odysseeNuits: 'jour',
  odysseeRepas: 'jour',
  odysseeBoissons: 'jour',
  odysseeSante: 'debut',
  odysseeTrajectoires: 'debut',
  odysseeMedicaments: 'jour',
  odysseeHormonal: 'debut',
  /* Santé, phase 1 : les trois datés s'élaguent, les deux qui durent non.

     La phrase ci-dessus était écrite depuis la phase 1 ; les deux qui durent
     n'avaient jamais été inscrites, et « essais:effacement » les réclamait.
     Un traitement et une condition déclarée sont des **états** : ils ont un
     début et parfois une fin, et élaguer « ce qui date de plus de N » y
     effacerait un traitement en cours commencé il y a trois ans. */
  odysseePrelevements: 'jour',
  odysseeResultats: null,
  odysseeSymptomes: 'jour',
  odysseeTraitements: null,
  odysseeConditions: null,
  /* Un ressenti est daté du jour où on l'écrit : il s'élague comme un
     symptôme, et pour la même raison — c'est un événement, pas un état. */
  odysseeRessentis: 'jour',
  odysseeCheckins: 'jour',
  odysseeValorisations: 'jour',
  odysseeOperations: 'jour',
  /*
     Oubliés à la phase 1 de Finances, et rattrapés ici : un compte et une
     ligne de budget sont des **états**, pas des événements. Les élaguer par
     date rendrait illisibles les opérations et les valorisations qui y
     renvoient.
  */
  odysseeComptes: null,
  odysseeLignesBudget: null,
  /*
     Un rapprochement est un **état** lui aussi : il dit où une opération est
     rangée. L'élaguer par date laisserait une opération conservée sans sa
     décision, c'est-à-dire de retour dans « à rapprocher » des années après
     avoir été classée.
  */
  odysseeRapprochements: null,
  // Sept interrupteurs : un état, et un seul enregistrement.
  odysseeConsommateurs: null,
  /*
     Le pointage, depuis la phase 3 bis. Des **états**, tous les quatre :
     un vendeur, une règle, un classement et une taxonomie se remplacent,
     ils ne s'accumulent pas par date. Élaguer un pointage laisserait une
     opération conservée sans son classement, c'est-à-dire de retour dans
     la file des années après avoir été rangée.
  */
  odysseeVendeurs: null,
  odysseeReglesPointage: null,
  odysseePointages: null,
  odysseeTaxonomie: null,
  odysseeHebdos: 'semaine',
  odysseeJournal: 'jour',
  /*
     Le journal d'usage s'élague à 180 jours, comme `JOURS_CONSERVES` le dit
     dans `odyssee/usage.ts` : la ligne de base en demande 56, la fenêtre 14,
     et garder cinq ans d'horodatages pour en utiliser deux mois serait
     conserver sans raison la donnée la moins protégée de l'application.
  */
  odysseeUsage: 'jour',
  /* Une ligne de base est un état, pas un événement : elle se remplace.
     Le magasin est **vide par conception** — la veille recalcule ses bases à
     la demande plutôt que de les ranger ; voir « db.ts », déclaration de
     « odysseeVeilleBases ». La règle reste écrite pour le jour où elle
     servirait. */
  odysseeVeilleBases: null,
  // Un repère est daté : il s'élague comme le journal qui l'a produit.
  odysseeVeilleSignaux: 'jour',
  odysseeVeilleReglages: null,
  // Une passation est datée, et n'est jamais remplacée : on en refait une.
  odysseePassations: 'jour',
};

export const GROUPES: readonly GroupeDeMagasins[] = [
  {
    id: 'revisions',
    libelle: 'Révisions',
    description: 'Flashcards, fiches lues, actualités lues, quiz de cours, pointages quotidiens.',
    magasins: ['cartes', 'fiches', 'quiz', 'jours', 'actualitesLues'],
  },
  {
    id: 'seances',
    libelle: 'Séances et notes',
    description: 'Séances de révision et le texte que vous y avez écrit.',
    magasins: ['seances', 'notes'],
  },
  {
    id: 'cog-training',
    libelle: 'Cog-Training',
    description: 'Quad n-back, Relational Reasoning, Veridical Mapping.',
    magasins: ['nback', 'relationnel', 'vmSeuils', 'vmSessions'],
  },
  {
    id: 'qcm-dgfip',
    libelle: 'QCM DGFiP',
    description: 'Historique de la banque de questions et des sessions.',
    magasins: ['qcmDgfip', 'qcmSessions'],
  },
  {
    id: 'niveau',
    libelle: 'Niveau estimé',
    description: 'Notes par matière, par fascicule et par fiche, difficulté des items.',
    magasins: ['competences', 'difficultes'],
  },
  {
    id: 'journal',
    libelle: 'Journal d’erreurs',
    description: 'Entrées ouvertes et fermées de la file de rattrapage.',
    magasins: ['journal'],
  },
  {
    id: 'assistant',
    libelle: 'Demandes à l’IA',
    description: 'Mémoire des questions posées à un assistant. Aucun effet sur la progression.',
    magasins: ['aides'],
  },
  {
    id: 'journaux',
    libelle: 'Journaux de synchronisation',
    description:
      'L’histoire des révisions et le journal d’opérations. Ce qui rend les états ' +
      'recalculables et la synchronisation possible.',
    magasins: ['revisions', 'operations'],
  },
  {
    id: 'odyssee',
    libelle: 'Odyssée',
    description: 'Tâches, quêtes, agenda, temps de concentration et revues.',
    magasins: [
      'odysseeTaches',
      'odysseeOccurrences',
      'odysseeEtapesCochees',
      'odysseeExceptionsScellees',
      'odysseeReports',
      'odysseeQuetes',
      'odysseeEvenements',
      'odysseeFocus',
      'odysseeRevues',
      'odysseePesees',
      'odysseeMesures',
      'odysseeNuits',
      'odysseeRepas',
      'odysseeBoissons',
      'odysseeSante',
      'odysseeTrajectoires',
      'odysseeMedicaments',
      'odysseeHormonal',
      'odysseeTraitements',
      'odysseePrelevements',
      'odysseeResultats',
      'odysseeSymptomes',
      'odysseeConditions',
      'odysseeRessentis',
      'odysseeCheckins',
      'odysseeComptes',
      'odysseeValorisations',
      'odysseeOperations',
      'odysseeLignesBudget',
      'odysseeHebdos',
      'odysseeJournal',
      'odysseeUsage',
      'odysseeVeilleBases',
      'odysseeVeilleSignaux',
      'odysseeVeilleReglages',
      'odysseePassations',
      'odysseeRapprochements',
      'odysseeConsommateurs',
      'odysseeVendeurs',
      'odysseeReglesPointage',
      'odysseePointages',
      'odysseeTaxonomie',
    ],
  },
  {
    id: 'sport',
    libelle: 'Sport',
    description: 'Exercices, séances et séries, phases d’entraînement, blessures déclarées.',
    magasins: ['sportExercices', 'sportSeances', 'sportPhases', 'sportBlessures', 'sportProgrammes'],
  },
  {
    id: 'reglages',
    libelle: 'Réglages et profil',
    description: 'XP, série, badges, rotation, plafonds de session, parcours.',
    magasins: ['etat'],
  },
];

export const groupe = (id: string): GroupeDeMagasins | undefined =>
  GROUPES.find((g) => g.id === id);

/** Le groupe auquel appartient un magasin, s'il en a un. */
export function groupeDuMagasin(nom: string): GroupeDeMagasins | undefined {
  return GROUPES.find((g) => g.magasins.includes(nom));
}

/** Un magasin peut-il se découper par période ? */
export const dateDecoupable = (nom: string): string | null => CHAMP_DATE[nom] ?? null;

/**
 * La date d'un enregistrement, ramenée à `AAAA-MM-JJ`.
 *
 * Les magasins mélangent les formes : `2026-03-04` pour un jour, un horodatage
 * ISO complet pour une session. Les dix premiers signes des deux donnent la
 * même chose, et c'est la seule granularité qu'une période demande.
 */
export function dateDe(magasin: string, enregistrement: unknown): string | null {
  const champ = CHAMP_DATE[magasin];
  if (!champ) return null;
  const brut = (enregistrement as Record<string, unknown>)?.[champ];
  if (typeof brut !== 'string' || brut.length < 10) return null;
  const jour = brut.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : null;
}
