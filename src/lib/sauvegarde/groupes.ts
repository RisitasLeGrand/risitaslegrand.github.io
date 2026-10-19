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
  /**
   * Les seules clés visées, **par magasin** — anomalie B-3 du 58.
   *
   * Un magasin absent de cette table est désigné **entier**, et c'est le cas
   * de tous sauf `etat`. `etat` est un magasin clé-valeur fourre-tout : il
   * porte à la fois des réglages qui appartiennent à la personne, des clés
   * qui appartiennent à un domaine, et des clés techniques sans lesquelles
   * l'application ne sait plus qui elle est.
   *
   * La table est indexée par magasin, et non posée à plat sur le groupe,
   * parce qu'un groupe comme « Odyssée » désigne quarante-quatre magasins
   * entiers **et** quatre clés d'`etat` : une liste unique aurait restreint
   * les quarante-quatre aux quatre.
   */
  clefs?: Readonly<Record<string, ClefsVisees>>;
}

/**
 * Les clés d'un magasin que vise un groupe : des noms exacts, et des
 * préfixes pour les clés dont le nom contient une variable.
 */
export interface ClefsVisees {
  exactes: readonly string[];
  prefixes?: readonly string[];
}

/* ══════════════════════════════════════════════════════════════════════════
   Les clés d'« etat », et pourquoi elles ne se valent pas — B-3 du 58
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les clés d'`etat` que la personne peut effacer et exporter.
 *
 * ## Le défaut que cette liste corrige
 *
 * Le groupe « Réglages et profil » désignait le magasin `etat` **entier**.
 * Mesuré le 19 octobre sur une base neuve, `etat` porte exactement deux
 * clés : `appareil` et `horloge`. Autrement dit, un écran qui promettait
 * d'effacer « XP, série, badges, rotation, plafonds de session, parcours »
 * retirait l'identité de l'appareil et son horloge logique — et, dès que le
 * coffre avait servi, l'enveloppe de sa clé. Le coffre ne se rouvrait plus,
 * avec le bon mot de passe, et rien ne prévenait.
 *
 * ## Pourquoi une liste BLANCHE, et non une liste noire
 *
 * Les deux erreurs possibles ne se valent pas. Une liste blanche qui oublie
 * une clé personnelle laisse une donnée non effacée : « Tout effacer » la
 * reprendra, et l'écran peut le dire. Une liste noire qui oublie une clé
 * technique condamne le coffre, sans recours. On choisit donc l'erreur qui
 * se rattrape.
 *
 * Une clé absente de cette liste n'est **pas** effacée par l'effacement
 * ciblé et n'est **pas** exportée. C'est délibéré, et c'est dit à l'écran.
 */
export const CLEFS_PERSONNELLES_ETAT: readonly string[] = [
  'profil',
  'reglagesSession',
  'reglagesContenu',
  'reglagesNiveau',
  'planification',
];

/**
 * Les réglages dont le nom porte une variable.
 *
 * `selection:<exercice>` : un réglage d'entraînement par exercice cognitif.
 * Une liste de noms exacts l'aurait manqué, et l'aurait manqué en silence.
 */
export const PREFIXES_PERSONNELS_ETAT: readonly string[] = ['selection:'];

/**
 * Les clés d'`etat` qui appartiennent à un domaine, et non aux réglages.
 *
 * Elles s'effacent et s'exportent avec leur domaine — « Odyssée » — parce
 * que c'est là qu'une personne les cherche : l'activation de Santé n'est pas
 * un réglage de séance, et le socle d'activité est de la progression.
 */
export const CLEFS_ODYSSEE_ETAT: readonly string[] = [
  'sante.active',
  'socleActivite',
  'dossier-releves',
  'dossier-releves-vus',
];

/**
 * Les clés techniques, nommées pour que l'oubli se voie.
 *
 * Cette liste ne filtre pas — ce sont les listes blanches qui filtrent — mais
 * elle **contrôle** : un essai vérifie qu'aucune d'elles n'a glissé dans une
 * liste blanche, et qu'aucune clé écrite par le code n'échappe aux deux
 * classements. Le jour où une clé nouvelle apparaîtra sans être rangée, la
 * batterie le dira avant la personne qui efface.
 *
 * Pourquoi chacune est intouchable :
 * - `appareil` : l'identité de cet appareil, portée par les opérations déjà
 *   écrites ; en changer rend leur ordre de fusion incohérent ;
 * - `horloge` : l'horloge logique hybride, qui ne doit jamais reculer ;
 * - `appairage`, `certification`, `dossier-partage`, `appareilsVus`,
 *   `lotsRecus`, `derniereVeille` : l'appairage et son état, dont le secret
 *   partagé — G-8 du 58 : il ne doit pas non plus sortir dans un export ;
 * - `reglagesSync` : le registre versionné des réglages. Il n'est pas un
 *   réglage : c'est la machinerie qui les fait converger. L'effacement y
 *   retire les entrées des clés effacées, plutôt que de jeter le registre ;
 * - `derniereSauvegarde` : la date de la dernière sauvegarde réussie. Ce
 *   n'est pas un réglage mais un constat, et l'effacer ferait croire qu'on
 *   n'a jamais sauvegardé — ou, pire, en remettrait la bannière à zéro au
 *   moment précis où l'on vient de perdre des données ;
 * - `fusionEnCours` : la liste du travail qu'une fusion interrompue a laissé
 *   en chemin (B-4 du 58). L'effacer perdrait la seule trace de ce qui reste
 *   à matérialiser, et personne ne saurait même quelles cibles manquent ;
 * - préfixe `coffre.` : `coffre.sel`, `coffre.sel-enveloppe`,
 *   `coffre.enveloppe`, `coffre.migration`, et le délai de verrouillage
 *   automatique. C'est le cœur de la B-3 : les effacer condamnait le coffre,
 *   avec le bon mot de passe, sans recours ;
 * - préfixe `boite.` : `boite.privee` et `boite.publique`, la paire de clés de
 *   la boîte aux lettres de cet appareil, la privée scellée sous la clé du
 *   coffre. Les effacer rend les plis en attente illisibles — définitivement,
 *   et c'est une perte, pas une gêne.
 */
export const PREFIXES_TECHNIQUES_ETAT: readonly string[] = ['coffre.', 'boite.'];
export const CLEFS_TECHNIQUES_ETAT: readonly string[] = [
  'appareil',
  'horloge',
  'appairage',
  'certification',
  'dossier-partage',
  'appareilsVus',
  'lotsRecus',
  'derniereVeille',
  'reglagesSync',
  'derniereSauvegarde',
  'fusionEnCours',
];

/** Une clé d'`etat` est-elle technique, c'est-à-dire intouchable à la carte ? */
export const estTechnique = (clef: string): boolean =>
  CLEFS_TECHNIQUES_ETAT.includes(clef) ||
  PREFIXES_TECHNIQUES_ETAT.some((prefixe) => clef.startsWith(prefixe));

/** Une clé tombe-t-elle dans ce que vise un groupe ? */
export const clefVisee = (clef: string, visees: ClefsVisees): boolean =>
  visees.exactes.includes(clef) ||
  (visees.prefixes ?? []).some((prefixe) => clef.startsWith(prefixe));

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
  /*
     L'ÉCOUTE EN COURS : UN SIGNET, PAS UN HISTORIQUE.

     Le magasin porte une ligne par fiche, réécrite à chaque écoute, et son
     `majLe` dit quand on l'a touchée pour la dernière fois. On pourrait donc
     le découper par période — et c'est tentant, puisque la date existe.

     Il reste à `null`, et le motif est l'asymétrie du risque. Si ce choix est
     mauvais, un effacement par période laisse les signets ET LE DIT, par le
     refus que l'écran affiche. Si l'autre choix l'était, il détruirait des
     signets que personne ne pensait désigner. Un refus visible coûte une
     phrase ; une destruction silencieuse coûte la donnée.

     C'est une décision prise à la fusion de claude/p46-55, faute de
     déclaration dans la branche. Elle se renverse d'une ligne si l'agent C ou
     le pilote la juge mauvaise.
  */
  podcastPositions: null,
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
  /*
     `null` aussi, et pour une raison propre : la rétention du centre n'est
     pas celle des sauvegardes. Elle vit dans le centre lui-même (30 jours
     pour archiver, 180 pour supprimer, réglables — décision 7), et elle
     refuse de toucher une question ouverte, ce qu'un découpage par date
     ferait sans le savoir.
  */
  centreElements: null,
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
  /*
     LES CRÉNEAUX MARQUÉS — une ligne par traitement, par jour et par heure.

     C'est un historique, et non un état courant : « Prévu à 8 h, noté à
     8 h 12 » est un constat daté, qui ne se réécrit pas. Le champ est `jour`,
     le jour LOGIQUE du créneau, comme chez ses voisins de Santé
     (`odysseeMedicaments`, `odysseePrelevements`, `odysseeSymptomes`) — et non
     `le`, qui porte l'instant réel du geste. Une période se demande sur le
     jour du traitement, pas sur la minute où la case a été cochée.

     Déclaré à la fusion de claude/p52-mol, où il manquait. Relevé par l'agent
     C sur `main`, par l'essai d'effacement que le socle contient désormais.
  */
  odysseeCreneaux: 'jour',
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
    description:
      'Flashcards, fiches lues, écoutes en cours, actualités lues, quiz de cours, ' +
      'pointages quotidiens.',
    magasins: ['cartes', 'fiches', 'quiz', 'jours', 'actualitesLues', 'podcastPositions'],
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
    /*
       LA DESCRIPTION DISAIT LE QUART DE CE QUE LE GROUPE EMPORTE.

       Elle s'arrêtait à « Tâches, quêtes, agenda, temps de concentration et
       revues » — l'Odyssée des premiers jours. Depuis, le groupe a gagné le
       corps, la santé et les traitements, Psyché, les finances et la veille :
       quarante-quatre magasins. Or c'est cette phrase que l'écran
       d'effacement montre. Une personne qui voulait retirer ses tâches
       emportait ses analyses sans que rien ne l'en avertisse.

       Écart relevé par le pilote le 19 octobre, corrigé avec G-5 et G-6,
       puisque c'est le même principe : l'écran doit dire ce qu'il efface.
    */
    description:
      'Tâches, quêtes, agenda, temps de concentration et revues ; le corps ' +
      '(poids, mesures, nuits, repas, boissons) ; la santé, les traitements, les ' +
      'prélèvements et leurs résultats ; Psyché (journal, ressentis, échelles) ; ' +
      'les finances (comptes, opérations, budget, pointage) ; et la veille du ' +
      'rythme de vie.',
    magasins: [
      'odysseeTaches',
      'odysseeOccurrences',
      'odysseeEtapesCochees',
      'odysseeExceptionsScellees',
      'odysseeReports',
      'centreElements',
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
      'odysseeCreneaux',
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
      'etat',
    ],
    clefs: { etat: { exactes: CLEFS_ODYSSEE_ETAT } },
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
    description:
      'Votre profil, vos réglages de séance, de contenu, de niveau et ' +
      'd’entraînement, votre planification. L’identité de cet appareil, son ' +
      'appairage et la clé de votre coffre ne sont pas touchés : ce ne sont ' +
      'pas des réglages.',
    magasins: ['etat'],
    clefs: {
      etat: { exactes: CLEFS_PERSONNELLES_ETAT, prefixes: PREFIXES_PERSONNELS_ETAT },
    },
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
