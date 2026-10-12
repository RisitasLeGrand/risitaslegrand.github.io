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
};

export const GROUPES: readonly GroupeDeMagasins[] = [
  {
    id: 'revisions',
    libelle: 'Révisions',
    description: 'Flashcards, fiches lues, quiz de cours, pointages quotidiens.',
    magasins: ['cartes', 'fiches', 'quiz', 'jours'],
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
