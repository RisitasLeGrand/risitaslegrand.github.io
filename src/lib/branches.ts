/**
 * Les branches de Cyclades.
 *
 * Cyclades est l'application ; une branche en est un domaine d'usage, avec ses
 * écrans, ses données et ses règles. Trois sont prévues :
 *
 * - **Révisions** — la préparation aux concours, ce qui s'appelait RevINSP ;
 * - **Odyssée** — le pilotage de la vie ;
 * - **Sport** — la musculation et le cardio.
 *
 * ## Pourquoi déclarer des branches qui n'existent pas encore
 *
 * Parce que le socle partagé a besoin de les nommer avant qu'elles aient des
 * écrans : un fait porte la branche qui l'émet, et la matrice de lecture
 * inter-branches se déclare entre identifiants. Les déclarer maintenant évite
 * que ces identifiants soient inventés deux fois, à deux endroits, avec deux
 * orthographes.
 *
 * ## Mais on n'affiche que ce qui existe
 *
 * `disponible` est faux tant qu'une branche n'a pas d'écrans, et la navigation
 * ne montre que les branches disponibles. Un onglet qui mène à une page vide
 * ne renseigne personne : il promet.
 *
 * **Odyssée s'est ouverte le 12 octobre 2026**, et la barre est devenue le
 * sélecteur annoncé ; **Sport le même jour**, une fois ses six écrans en
 * place. Les trois branches sont donc ouvertes, et `disponible` reste ce
 * qu'il était : l'interrupteur qui empêche d'annoncer ce qui n'existe pas.
 *
 * ## Chaque branche porte ses onglets
 *
 * Ils étaient écrits en dur dans la mise en page, parce qu'il n'y avait qu'une
 * branche. Les mettre ici est ce que la phase 8 appelait « registre complété :
 * icône, routes, navigation » : la mise en page ne décide plus de rien, elle
 * affiche les onglets de la branche courante. La prochaine branche n'aura donc
 * aucune ligne à ajouter dans `Base.astro`.
 */

import type { NomDIcone } from './icones';
export interface Branche {
  id: string;
  /** Le nom affiché : « Révisions », jamais « Cyclades · Révisions ». */
  libelle: string;
  /*
     Un NOM du catalogue, et non un dessin.

     C'était « string » du temps où ce champ portait un émoji. Le type est
     resserré sur le catalogue : une faute de frappe échoue maintenant au
     typage, et non plus seulement à la construction. Le refus du composant
     reste utile pour les noms qui viennent d'ailleurs.
  */
  icone: NomDIcone;
  /** Une phrase, pour l'écran de choix et les info-bulles. */
  description: string;
  /**
   * Racine de ses pages.
   *
   * Aucune branche n'occupe `/` : c'est le **menu**, depuis la section 0.1 du
   * prompt complémentaire. Les autres écrans de Révisions gardent en revanche
   * leurs chemins propres (`/flashcards/`, `/quiz/`), parce qu'ils en portent
   * déjà de distincts et qu'un renommage massif de chemins casse en silence une
   * ressource chiffrée dont le chemin est écrit dans un manifeste.
   */
  racine: string;
  /** La branche a-t-elle des écrans aujourd'hui ? */
  disponible: boolean;
  /** Ses onglets, dans l'ordre d'affichage. */
  onglets: readonly Onglet[];
  /**
   * Le regroupement de la barre, sur les écrans larges.
   *
   * Un identifiant d'onglet qui n'apparaît dans aucun groupe s'affiche seul,
   * à sa place dans `onglets`. Un identifiant cité par un groupe inexistant
   * fait échouer le contrôle du registre : une barre qui perd silencieusement
   * un écran est exactement ce qu'on vient de corriger.
   */
  groupes?: readonly GroupeOnglets[];
  /**
   * Les quatre destinations de la barre du bas, sur téléphone.
   *
   * Quatre, et une cinquième entrée « Plus » qui ouvre le reste. Ce n'est pas
   * un chiffre rond choisi pour faire joli : à 390 px, cinq cibles de 44 px
   * avec leur libellé tiennent, six se touchent.
   */
  principaux?: readonly string[];
  /**
   * Ses écrans **sans onglet**.
   *
   * Tout écran n'en mérite pas un : la barre d'onglets est un budget
   * d'attention, et l'y ajouter se paie sur les douze autres. Mais un écran
   * sans onglet n'est pas pour autant un écran sans branche — « Qui lit mon
   * budget » appartient à Odyssée, « QCM — DGFiP » à Révisions, et le pied
   * de page est l'endroit où on peut les nommer sans rien coûter à la barre.
   *
   * Sans cette liste, ils vivaient dans une colonne « Cet espace » affichée
   * sur **toutes** les pages : les QCM de Révisions s'offraient depuis une
   * séance de musculation, et les trois écrans de finances n'étaient nulle
   * part. Les rattacher ici les range là où ils sont utiles, et seulement là.
   */
  annexes?: readonly Onglet[];
}

export interface Onglet {
  id: string;
  /**
   * **Le** nom de l'écran. Un seul, partout.
   *
   * L'onglet disait « Cours », le titre de la page « Bibliothèque », le pied
   * de page encore autre chose. Trois mots pour un écran, c'est trois écrans
   * pour qui cherche — et pour qui pilote à la voix, c'est un onglet qu'on
   * n'atteint pas. Ce champ est donc la seule source : barre, `<h1>`,
   * `<title>` et pied de page le reprennent tel quel, et un essai le vérifie.
   */
  nom: string;
  /**
   * Une version plus courte, **uniquement** pour la barre du bas sur
   * téléphone, où quatre destinations se partagent 390 px.
   *
   * Elle doit être un **préfixe** de `nom` : « Tableau » pour « Tableau de
   * bord ». C'est la règle de WCAG 2.5.3 appliquée d'avance — le nom
   * accessible commence par ce qu'on lit — et un essai la vérifie.
   */
  court?: string;
  /** Une phrase d'info-bulle. Jamais un second nom. */
  description?: string;
  /** Chemin absolu **sans** la base du site, qu'ajoute la mise en page. */
  chemin: string;
  /*
     Un NOM du catalogue, et non un dessin.

     C'était « string » du temps où ce champ portait un émoji. Le type est
     resserré sur le catalogue : une faute de frappe échoue maintenant au
     typage, et non plus seulement à la construction. Le refus du composant
     reste utile pour les noms qui viennent d'ailleurs.
  */
  icone: NomDIcone;
  /**
   * Les parcours auxquels cet écran s'adresse. Absent = tous.
   *
   * ## Pourquoi ce champ existe, et pourquoi il ne peut pas filtrer au build
   *
   * « Organigrammes » ne vaut que pour les concours de la DGFiP : l'offrir à
   * qui prépare l'INSP serait un lien vers une page vide, c'est-à-dire une
   * promesse non tenue à chaque page du site.
   *
   * Mais le pied de page est rendu à la CONSTRUCTION, et le parcours courant
   * vit dans « localStorage » — il n'existe que dans le navigateur. Le lien
   * est donc écrit pour tout le monde, puis **caché côté client** quand le
   * parcours ouvert ne le sert pas, et réévalué à chaque changement de
   * parcours. C'est le même compromis que le sélecteur de parcours lui-même.
   *
   * Conséquence assumée : le lien existe dans le HTML servi. Ce n'est pas un
   * secret — le nom d'un écran n'en est pas un —, c'est une question de ne
   * pas proposer ce qui ne sert à rien.
   */
  parcours?: readonly string[];
}

/**
 * Un groupe d'onglets, déplié au survol ou au clic.
 *
 * ## Pourquoi grouper
 *
 * Douze onglets ne tiennent pas. Mesuré : à 1280 px, la barre de Révisions
 * disposait de 517 px pour 1 261 px de contenu — sept entrées sur douze
 * invisibles, sans flèche ni barre de défilement pour le dire. Sur téléphone
 * c'était pire : 8 px de large pour 550 px de contenu, donc rien.
 *
 * Une fonction qu'on ne voit pas n'existe pas. Cinq entrées dont trois
 * dépliantes montrent les douze ; douze entrées dont sept cachées n'en
 * montrent que cinq.
 */
export interface GroupeOnglets {
  id: string;
  nom: string;
  /*
     Un NOM du catalogue, et non un dessin.

     C'était « string » du temps où ce champ portait un émoji. Le type est
     resserré sur le catalogue : une faute de frappe échoue maintenant au
     typage, et non plus seulement à la construction. Le refus du composant
     reste utile pour les noms qui viennent d'ailleurs.
  */
  icone: NomDIcone;
  /** Les identifiants d'onglets rassemblés, dans l'ordre. */
  membres: readonly string[];
}

export const BRANCHES: Branche[] = [
  {
    id: 'revisions',
    libelle: 'Révisions',
    icone: 'revisions',
    description: 'Préparation aux concours : cours, flashcards, quiz, planification.',
    racine: '/revisions/',
    disponible: true,
    /*
       Les écrans de Révisions gardent leurs chemins propres — `/flashcards/`,
       `/quiz/` — et ne sont pas sous `/revisions/` : ils en portaient déjà de
       distincts, et un renommage massif casserait en silence une ressource
       chiffrée dont le chemin est écrit dans un manifeste.
    */
    onglets: [
      { id: 'accueil', nom: 'Tableau de bord', court: 'Tableau', chemin: '/revisions/', icone: 'tableau-de-bord' },
      { id: 'planification', nom: 'Planning', description: 'La planification des révisions.', chemin: '/planification/', icone: 'planning' },
      { id: 'bibliotheque', nom: 'Cours', description: 'La bibliothèque des fiches.', chemin: '/bibliotheque/', icone: 'cours' },
      { id: 'flashcards', nom: 'Cartes', description: 'Les cartes de rappel espacé.', chemin: '/flashcards/', icone: 'cartes' },
      { id: 'quiz', nom: 'Quiz', chemin: '/quiz/', icone: 'quiz' },
      { id: 'positionnement', nom: 'Niveau', description: 'Le prétest de positionnement.', chemin: '/positionnement/', icone: 'niveau' },
      { id: 'journal', nom: 'Erreurs', description: 'Le journal des erreurs à reprendre.', chemin: '/journal/', icone: 'erreurs' },
      { id: 'recherche', nom: 'Recherche', chemin: '/recherche/', icone: 'recherche' },
      { id: 'statistiques', nom: 'Statistiques', chemin: '/statistiques/', icone: 'statistiques' },
      { id: 'glossaire', nom: 'Glossaire', chemin: '/glossaire/', icone: 'glossaire' },
    ],
    /*
       Cinq entrées au lieu de douze. Le découpage suit ce qu'on vient faire :
       on planifie, on apprend, on se mesure, on cherche. « Sauvegarde » quitte
       la barre pour le menu « Cet espace » — ce n'est pas une activité de
       révision, c'est de l'entretien, et il est le même dans les trois
       branches.
    */
    groupes: [
      { id: 'apprendre', nom: 'Apprendre', icone: 'cours', membres: ['bibliotheque', 'flashcards', 'quiz'] },
      { id: 'mesurer', nom: 'Mesurer', icone: 'statistiques', membres: ['positionnement', 'journal', 'statistiques'] },
      { id: 'outils', nom: 'Outils', icone: 'outils', membres: ['recherche', 'glossaire'] },
    ],
    principaux: ['accueil', 'bibliotheque', 'flashcards', 'quiz'],
    annexes: [
      /*
         « Sauvegarde » a quitté la barre (N2).

         Ce n'est pas une activité de révision, c'est de l'entretien, et il
         est le même dans les trois branches : sa place est le menu « Cet
         espace », qui est partout. Dans la barre, il occupait la largeur
         d'un onglet pour un écran qu'on ouvre une fois par mois, et cette
         largeur manquait aux onze autres.
      */
      { id: 'progression', nom: 'Sauvegarde', description: 'Sauvegarder et restaurer.', chemin: '/progression/', icone: 'sauvegarde' },
      { id: 'actualites', nom: 'Actualités', chemin: '/actualites/', icone: 'actualites' },
      { id: 'quiz-cours', nom: 'Quiz du cours', chemin: '/quiz/cours/', icone: 'quiz' },
      { id: 'quiz-dgfip', nom: 'QCM — DGFiP', chemin: '/quiz/dgfip/', icone: 'concours' },
      /*
         EN ANNEXE, ET NON EN ONGLET. La barre d'onglets est un budget
         d'attention : Révisions en porte déjà dix, et un onglet de plus se
         paierait sur les dix autres pour un écran qu'on consulte, non qu'on
         pratique. Le pied de page le nomme, et c'est assez pour le trouver.
      */
      {
        id: 'organigrammes',
        nom: 'Organigrammes',
        description: 'Les organigrammes de l’administration, datés et sourcés.',
        chemin: '/organigrammes/',
        /*
           L'ÉMOJI DEVIENT UN NOM DU CATALOGUE, et le nom est à revoir d'un mot.

           Cette entrée portait un émoji de boîte à fiches. Le catalogue de
           A ne nomme aucun « organigramme » ; « ranger » est le sens
           littéral de l'émoji choisi, donc le plus proche de l'intention.
           Si A ou B préfère autre chose, c'est un mot à changer ici.
        */
        icone: 'ranger',
        parcours: ['dgfip-b', 'dgfip-a', 'dgfip-ap'],
      },
    ],
  },
  {
    id: 'odyssee',
    libelle: 'Odyssée',
    icone: 'odyssee',
    description: 'Pilotage de la vie : domaines, calendrier, tâches, quêtes, tendances.',
    racine: '/odyssee/',
    disponible: true,
    onglets: [
      { id: 'accueil', nom: 'Tableau de bord', court: 'Tableau', chemin: '/odyssee/', icone: 'tableau-de-bord' },
      { id: 'calendrier', nom: 'Agenda', description: 'Mon calendrier.', chemin: '/odyssee/calendrier/', icone: 'planning' },
      { id: 'taches', nom: 'Tâches', chemin: '/odyssee/taches/', icone: 'taches' },
      { id: 'quetes', nom: 'Quêtes', chemin: '/odyssee/quetes/', icone: 'quetes' },
      { id: 'revue', nom: 'Revue', court: 'Revue', chemin: '/odyssee/revue/', icone: 'revue' },
      { id: 'corps', nom: 'Corps', chemin: '/odyssee/corps/', icone: 'corps' },
      { id: 'psyche', nom: 'Psyché', chemin: '/odyssee/psyche/', icone: 'psyche' },
      { id: 'veille', nom: 'Repère de rythme de vie', court: 'Repère', chemin: '/odyssee/veille/', icone: 'rythme-de-vie' },
      { id: 'echelles', nom: 'Échelles', chemin: '/odyssee/echelles/', icone: 'echelles' },
      { id: 'finances', nom: 'Finances', chemin: '/odyssee/finances/', icone: 'finances' },
      { id: 'tendances', nom: 'Tendances', chemin: '/odyssee/tendances/', icone: 'tendances' },
      { id: 'syntheses', nom: 'Synthèses', chemin: '/syntheses/', icone: 'syntheses' },
    ],
    groupes: [
      { id: 'faire', nom: 'Faire', icone: 'taches', membres: ['taches', 'quetes', 'revue'] },
      { id: 'moi', nom: 'Moi', icone: 'corps', membres: ['corps', 'psyche', 'echelles', 'veille'] },
      { id: 'compter', nom: 'Compter', icone: 'finances', membres: ['finances', 'tendances', 'syntheses'] },
    ],
    principaux: ['accueil', 'calendrier', 'taches', 'corps'],
    annexes: [
      /*
         Santé est une annexe et non un onglet, et c'est la décision 3.1 du
         plan appliquée à la barre : le corps se note tous les jours, la santé
         s'ouvre par épisodes — un bilan par trimestre, une déclaration de
         traitement. Un treizième onglet se paierait sur les douze autres, pour
         un écran qu'on ouvre huit fois par an. Le pied de page le nomme, et
         « Mon corps » y mène.
      */
      { id: 'sante', nom: 'Santé', description: 'Santé et traitements.', chemin: '/odyssee/sante/', icone: 'sante' },
      { id: 'rapprocher', nom: 'À rapprocher', description: 'Les opérations à rapprocher.', chemin: '/odyssee/rapprocher/', icone: 'rapprocher' },
      { id: 'regles', nom: 'Mes règles', description: 'Les règles de pointage.', chemin: '/odyssee/mes-regles/', icone: 'regles' },
      { id: 'lecteurs-budget', nom: 'Qui lit mon budget', chemin: '/odyssee/qui-lit-mon-budget/', icone: 'qui-lit' },
    ],
  },
  {
    id: 'sport',
    libelle: 'Sport',
    icone: 'sport',
    description: 'Musculation et cardio : exercices, séances, suivi de la force.',
    racine: '/sport/',
    disponible: true,
    onglets: [
      { id: 'accueil', nom: 'Tableau de bord', court: 'Tableau', chemin: '/sport/', icone: 'tableau-de-bord' },
      { id: 'seance', nom: 'Séance', chemin: '/sport/seance/', icone: 'seance' },
      { id: 'exercices', nom: 'Exercices', chemin: '/sport/exercices/', icone: 'echelles' },
      { id: 'programmes', nom: 'Programmes', chemin: '/sport/programmes/', icone: 'programmes' },
      { id: 'force', nom: 'Force', description: 'Le suivi de la force.', chemin: '/sport/force/', icone: 'statistiques' },
      /*
         « Phases et blessures », et non « Mon corps » : Odyssée porte déjà un
         écran de ce nom — poids, sommeil, repas — et deux onglets homonymes
         dans deux branches se confondraient à la lecture. Celui-ci ne traite
         que de ce qui contextualise l'entraînement.
      */
      { id: 'etat', nom: 'Phases et blessures', court: 'Phases', chemin: '/sport/corps/', icone: 'erreurs' },
    ],
    /*
       Six onglets tenaient à 1280 px, mais pas à 660 : « Force » y était
       coupé et « Blessures » absent. Deux groupes suffisent à les rendre
       tous atteignables sans toucher à l'ordre.
    */
    groupes: [
      { id: 'preparer', nom: 'Préparer', icone: 'programmes', membres: ['exercices', 'programmes'] },
      { id: 'suivre', nom: 'Suivre', icone: 'statistiques', membres: ['force', 'etat'] },
    ],
    principaux: ['accueil', 'seance', 'exercices', 'force'],
  },
  /*
     LA QUATRIÈME BRANCHE — consigne du pilote relayée le 18/10 : « Branche
     "Entraînement cognitif" à part entière : 4ᵉ entrée de BRANCHES, sortie
     de Révisions > Outils. » Deux consignes antérieures — la rattacher à
     Odyssée, puis en faire un écran commun — sont annulées par celle-ci.

     ## Pourquoi elle sort de Révisions

     Elle y était un onglet du groupe « Outils », à côté de la recherche et
     du glossaire. Or ce n'est pas un outil au service des révisions : ces
     trois exercices ne touchent pas au programme du concours, ne lisent
     aucune fiche, et leur propre accueil le dit — « indépendants du
     programme ». Un outil sert la branche qui le loge ; celui-ci ne servait
     que lui-même.

     ## Les chemins ne bougent pas

     `/cog-training/` et ses trois écrans gardent leur adresse. Elle est
     écrite dans des manifestes chiffrés et dans des faits déjà enregistrés ;
     la renommer pour faire joli casserait en silence ce qui existe. La
     racine d'une branche n'a pas à ressembler à son nom.

     ## Les noms viennent de l'accueil, pas de l'anglais

     L'accueil nomme déjà les trois exercices par ce qu'ils travaillent :
     « Mémoire de travail », « Raisonnement relationnel », « Correspondance
     perceptive ». Ce sont ces noms-là qui montent dans la barre — les
     titres anglais restent sur chaque écran, où ils désignent le protocole.
     Chaque nom court est un préfixe de son nom, comme le registre l'exige.

     ## Pas de groupes

     Quatre onglets tiennent dans la barre du bas sans repli. Un groupe pour
     deux exercices n'ajouterait qu'un niveau à traverser.
  */
  {
    id: 'cognitif',
    libelle: 'Entraînement cognitif',
    icone: 'cognitif',
    description:
      'Mémoire de travail, raisonnement relationnel, correspondance perceptive. ' +
      'Indépendant du programme du concours.',
    racine: '/cog-training/',
    disponible: true,
    onglets: [
      { id: 'accueil', nom: 'Tableau de bord', court: 'Tableau', chemin: '/cog-training/', icone: 'tableau-de-bord' },
      {
        id: 'memoire',
        nom: 'Mémoire de travail',
        court: 'Mémoire',
        description: 'Quad N-Back : quatre flux en parallèle.',
        chemin: '/cog-training/quad-n-back/',
        icone: 'memoire',
      },
      {
        id: 'raisonnement',
        nom: 'Raisonnement relationnel',
        court: 'Raisonnement',
        description: 'Inférer une règle qu’aucun énoncé ne nomme.',
        chemin: '/cog-training/relational-reasoning/',
        icone: 'raisonnement',
      },
      {
        id: 'correspondance',
        nom: 'Correspondance perceptive',
        court: 'Correspondance',
        description: 'Mettre deux échelles perceptives en vis-à-vis.',
        chemin: '/cog-training/veridical-mapping/',
        icone: 'niveau',
      },
    ],
    principaux: ['accueil', 'memoire', 'raisonnement', 'correspondance'],
  },
];

/**
 * Les écrans qui n'appartiennent à **aucune** branche.
 *
 * Le profil, les appareils, le stockage, l'export et l'import : ils servent
 * Cyclades entier, et aucune branche ne peut se les approprier sans mentir.
 * Ils sont donc listés une fois, ici, et le pied de page les montre partout —
 * c'est la seule colonne qui ne dépende pas d'où l'on se trouve.
 *
 * `/apparier/` n'y figure pas : c'est une étape du parcours d'appairage, qu'on
 * atteint depuis « Appareils ». Un lien de pied de page vers le milieu d'un
 * parcours ne mène nulle part de compréhensible.
 */
export const ECRANS_COMMUNS: readonly Onglet[] = [
  {
    id: 'parametres',
    nom: 'Paramètres',
    description: 'Tous les réglages du site, au même endroit.',
    chemin: '/parametres/',
    icone: 'parametres',
  },
  { id: 'profil', nom: 'Mon profil', chemin: '/profil/', icone: 'profil' },
  { id: 'appareils', nom: 'Appareils', description: 'Appareils et synchronisation.', chemin: '/appareils/', icone: 'appareils' },
  { id: 'stockage', nom: 'Stockage', chemin: '/stockage/', icone: 'stockage' },
  {
    id: 'notifications',
    nom: 'Notifications',
    description: 'Ce que le système affiche, source par source.',
    chemin: '/notifications/',
    icone: 'notifications',
  },
  { id: 'exporter-ia', nom: 'Exporter pour une IA', chemin: '/exporter-ia/', icone: 'exporter' },
  { id: 'importer-analyse', nom: 'Importer une analyse', chemin: '/importer-analyse/', icone: 'importer' },
];

export const ID_BRANCHE_PAR_DEFAUT = 'revisions';

export const branche = (id: string): Branche | undefined => BRANCHES.find((b) => b.id === id);

export const branchesDisponibles = (): Branche[] => BRANCHES.filter((b) => b.disponible);

/**
 * La branche à laquelle appartient un chemin.
 *
 * Par le préfixe, et Révisions par défaut. Ce n'est pas une approximation :
 * les écrans de Révisions sont dispersés par héritage — `/flashcards/`,
 * `/quiz/` — et les lister ici pour les reconnaître ferait une seconde liste à
 * tenir, qui divergerait de la première. Les branches nouvelles, elles, vivent
 * toutes sous leur racine, et la règle du préfixe suffit.
 *
 * Les écrans communs — `/profil/`, `/syntheses/`, `/exporter-ia/` — tombent
 * donc dans Révisions, qui est la branche d'accueil. Un écran commun n'a pas
 * de branche propre, et lui en inventer une n'aiderait personne.
 */
export function brancheDuChemin(chemin: string): Branche {
  /*
     `includes` et non `startsWith` : le site est servi sous une base — sur
     GitHub Pages, les chemins commencent par le nom du dépôt. Comparer au
     début obligerait à connaître la base ici, c'est-à-dire à la passer depuis
     chaque appel, pour distinguer des racines qui ne se ressemblent pas.
  */
  for (const b of BRANCHES) {
    if (b.id === ID_BRANCHE_PAR_DEFAUT) continue;
    if (chemin.includes(b.racine)) return b;
  }
  return branche(ID_BRANCHE_PAR_DEFAUT)!;
}

/**
 * La branche qui **déclare** un écran, par correspondance exacte de chemin.
 *
 * `brancheDuChemin` répond par le préfixe, et c'est ce qu'il faut à l'en-tête :
 * `/cog-training/quad-n-back/` n'est pas un onglet, et appartient pourtant à
 * Révisions. Mais le préfixe se trompe sur les écrans dispersés : `/syntheses/`
 * est déclaré **onglet d'Odyssée** et tombe dans Révisions, faute de vivre sous
 * `/odyssee/`.
 *
 * Cette fonction-ci ne devine pas : elle lit la déclaration. Elle rend `null`
 * quand aucune branche ne revendique l'écran — le menu, le profil, l'export —,
 * ce qui est une réponse et non un échec. Et elle n'ajoute **aucune liste** :
 * elle relit celle que le registre tient déjà.
 */
export function brancheDUnOnglet(chemin: string): Branche | null {
  const propre = `${chemin.replace(/\/+$/, '')}/`;
  for (const b of BRANCHES) {
    for (const o of [...b.onglets, ...(b.annexes ?? [])]) {
      if (propre.endsWith(o.chemin)) return b;
    }
  }
  return null;
}

/** Le nom complet d'un écran : « Cyclades · Révisions ». */
export function nomComplet(nomProduit: string, id = ID_BRANCHE_PAR_DEFAUT): string {
  const b = branche(id);
  return b ? `${nomProduit} · ${b.libelle}` : nomProduit;
}

/* ══════════════════════════════════════════════════════════════════════════
   Ce que la barre affiche
   ══════════════════════════════════════════════════════════════════════════ */

/** Une entrée de barre : un onglet seul, ou un groupe dépliant. */
export type EntreeDeBarre =
  | { sorte: 'onglet'; onglet: Onglet }
  | { sorte: 'groupe'; groupe: GroupeOnglets; membres: readonly Onglet[] };

/**
 * Les entrées de la barre d'une branche, dans l'ordre.
 *
 * Un onglet cité par un groupe n'apparaît qu'à la place du groupe ; les
 * autres gardent la leur. L'ordre des entrées suit donc celui de `onglets`,
 * le groupe prenant la place de son **premier** membre — ce qui conserve
 * l'ordre qu'on connaît plutôt que d'en inventer un.
 */
export function entreesDeLaBarre(b: Branche): EntreeDeBarre[] {
  const groupes = b.groupes ?? [];
  const parMembre = new Map<string, GroupeOnglets>();
  for (const g of groupes) for (const m of g.membres) parMembre.set(m, g);

  const sortie: EntreeDeBarre[] = [];
  const poses = new Set<string>();
  for (const onglet of b.onglets) {
    const g = parMembre.get(onglet.id);
    if (!g) {
      sortie.push({ sorte: 'onglet', onglet });
      continue;
    }
    if (poses.has(g.id)) continue;
    poses.add(g.id);
    sortie.push({
      sorte: 'groupe',
      groupe: g,
      membres: g.membres
        .map((id) => b.onglets.find((o) => o.id === id))
        .filter((o): o is Onglet => Boolean(o)),
    });
  }
  return sortie;
}

/** Les destinations de la barre du bas, sur téléphone. */
export const ongletsPrincipaux = (b: Branche): Onglet[] =>
  (b.principaux ?? b.onglets.slice(0, 4).map((o) => o.id))
    .map((id) => b.onglets.find((o) => o.id === id))
    .filter((o): o is Onglet => Boolean(o));

/** Le nom court d'un onglet, pour la barre du bas. */
export const nomCourt = (o: Onglet): string => o.court ?? o.nom;

/**
 * Le contrôle du registre lui-même.
 *
 * Trois choses qu'une relecture laisse passer et qu'un écran ne signale pas :
 * un groupe qui cite un onglet disparu — l'écran devient inatteignable sans
 * que rien ne proteste —, un nom court qui n'est pas un préfixe du nom — la
 * commande vocale échoue —, et deux écrans qui portent le même nom — on ne
 * sait plus lequel on ouvre.
 */
export function controlerBranches(): string[] {
  const problemes: string[] = [];
  const nomsVus = new Map<string, string>();

  for (const b of BRANCHES) {
    const ids = new Set(b.onglets.map((o) => o.id));
    for (const g of b.groupes ?? []) {
      for (const m of g.membres) {
        if (!ids.has(m)) {
          problemes.push(`${b.libelle} : le groupe « ${g.nom} » cite l’onglet absent « ${m} ».`);
        }
      }
    }
    for (const id of b.principaux ?? []) {
      if (!ids.has(id)) {
        problemes.push(`${b.libelle} : « ${id} » est une destination principale mais pas un onglet.`);
      }
    }
    for (const o of [...b.onglets, ...(b.annexes ?? [])]) {
      if (o.court && !o.nom.toLowerCase().startsWith(o.court.toLowerCase())) {
        problemes.push(
          `« ${o.court} » n’est pas un préfixe de « ${o.nom} » : la commande vocale échouerait.`,
        );
      }
      /*
         L'unicité se juge **dans une branche**, pas sur tout le site.

         Les trois branches ont chacune leur tableau de bord, et c'est le bon
         nom pour les trois : ce sont trois écrans du même genre, dans trois
         contextes que l'en-tête affiche déjà. Exiger trois noms différents
         aurait produit trois périphrases pour éviter une collision qui n'en
         est pas une. Le `<title>` de la page, lui, porte la branche, et c'est
         là que l'unicité compte — « essais:structure » la vérifie.
      */
      const clef = `${b.id}|${o.nom.toLowerCase()}`;
      const ailleurs = nomsVus.get(clef);
      if (ailleurs && ailleurs !== o.chemin) {
        problemes.push(
          `Deux écrans de ${b.libelle} portent le nom « ${o.nom} » : ${ailleurs} et ${o.chemin}.`,
        );
      }
      nomsVus.set(clef, o.chemin);
    }
  }
  for (const o of ECRANS_COMMUNS) {
    if (o.court && !o.nom.toLowerCase().startsWith(o.court.toLowerCase())) {
      problemes.push(`« ${o.court} » n’est pas un préfixe de « ${o.nom} ».`);
    }
  }
  return problemes;
}
