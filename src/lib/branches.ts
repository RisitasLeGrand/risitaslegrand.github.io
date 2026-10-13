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
export interface Branche {
  id: string;
  /** Le nom affiché : « Révisions », jamais « Cyclades · Révisions ». */
  libelle: string;
  icone: string;
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
}

export interface Onglet {
  id: string;
  /** Le nom complet : lecteurs d'écran, info-bulle. */
  libelle: string;
  /** La version affichée à côté de l'icône sur les grands écrans. */
  court: string;
  /** Chemin absolu **sans** la base du site, qu'ajoute la mise en page. */
  chemin: string;
  icone: string;
}

export const BRANCHES: Branche[] = [
  {
    id: 'revisions',
    libelle: 'Révisions',
    icone: '🎓',
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
      { id: 'accueil', libelle: 'Tableau de bord', court: 'Accueil', chemin: '/revisions/', icone: '🏠' },
      { id: 'planification', libelle: 'Planification des révisions', court: 'Planning', chemin: '/planification/', icone: '🗓️' },
      { id: 'bibliotheque', libelle: 'Bibliothèque', court: 'Cours', chemin: '/bibliotheque/', icone: '📚' },
      { id: 'flashcards', libelle: 'Flashcards', court: 'Cartes', chemin: '/flashcards/', icone: '🃏' },
      { id: 'quiz', libelle: 'Quiz', court: 'Quiz', chemin: '/quiz/', icone: '🎯' },
      { id: 'positionnement', libelle: 'Prétest de positionnement', court: 'Niveau', chemin: '/positionnement/', icone: '🧭' },
      { id: 'journal', libelle: 'Journal d’erreurs', court: 'Erreurs', chemin: '/journal/', icone: '🩹' },
      { id: 'cog-training', libelle: 'Cog-Training — entraînement cognitif', court: 'Cog-Training', chemin: '/cog-training/', icone: '🧩' },
      { id: 'recherche', libelle: 'Recherche', court: 'Recherche', chemin: '/recherche/', icone: '🔎' },
      { id: 'statistiques', libelle: 'Statistiques', court: 'Stats', chemin: '/statistiques/', icone: '📈' },
      { id: 'glossaire', libelle: 'Glossaire', court: 'Glossaire', chemin: '/glossaire/', icone: '📖' },
      { id: 'progression', libelle: 'Sauvegarde et synchronisation', court: 'Sauvegarde', chemin: '/progression/', icone: '💾' },
    ],
  },
  {
    id: 'odyssee',
    libelle: 'Odyssée',
    icone: '🧭',
    description: 'Pilotage de la vie : domaines, calendrier, tâches, quêtes, tendances.',
    racine: '/odyssee/',
    disponible: true,
    onglets: [
      { id: 'accueil', libelle: 'Tableau de bord', court: 'Accueil', chemin: '/odyssee/', icone: '🏠' },
      { id: 'calendrier', libelle: 'Mon calendrier', court: 'Agenda', chemin: '/odyssee/calendrier/', icone: '🗓️' },
      { id: 'taches', libelle: 'Mes tâches', court: 'Tâches', chemin: '/odyssee/taches/', icone: '✅' },
      { id: 'quetes', libelle: 'Mes quêtes', court: 'Quêtes', chemin: '/odyssee/quetes/', icone: '🔁' },
      { id: 'revue', libelle: 'Revue du soir', court: 'Revue', chemin: '/odyssee/revue/', icone: '🌙' },
      { id: 'corps', libelle: 'Mon corps', court: 'Corps', chemin: '/odyssee/corps/', icone: '🫀' },
      { id: 'psyche', libelle: 'Ma psyché', court: 'Psyché', chemin: '/odyssee/psyche/', icone: '🫧' },
      { id: 'veille', libelle: 'Repère de rythme de vie', court: 'Repère', chemin: '/odyssee/veille/', icone: '🧭' },
      { id: 'finances', libelle: 'Mes finances', court: 'Finances', chemin: '/odyssee/finances/', icone: '💶' },
      { id: 'tendances', libelle: 'Mes tendances', court: 'Tendances', chemin: '/odyssee/tendances/', icone: '🔭' },
      { id: 'syntheses', libelle: 'Mes synthèses', court: 'Synthèses', chemin: '/syntheses/', icone: '📈' },
    ],
  },
  {
    id: 'sport',
    libelle: 'Sport',
    icone: '🏋️',
    description: 'Musculation et cardio : exercices, séances, suivi de la force.',
    racine: '/sport/',
    disponible: true,
    onglets: [
      { id: 'accueil', libelle: 'Tableau de bord', court: 'Accueil', chemin: '/sport/', icone: '🏠' },
      { id: 'seance', libelle: 'Ma séance', court: 'Séance', chemin: '/sport/seance/', icone: '🏋️' },
      { id: 'exercices', libelle: 'Mes exercices', court: 'Exercices', chemin: '/sport/exercices/', icone: '📋' },
      { id: 'programmes', libelle: 'Mes programmes', court: 'Programmes', chemin: '/sport/programmes/', icone: '🗂️' },
      { id: 'force', libelle: 'Mon suivi de la force', court: 'Force', chemin: '/sport/force/', icone: '📈' },
      /*
         « Phases et blessures », et non « Mon corps » : Odyssée porte déjà un
         écran de ce nom — poids, sommeil, repas — et deux onglets homonymes
         dans deux branches se confondraient à la lecture. Celui-ci ne traite
         que de ce qui contextualise l'entraînement.
      */
      { id: 'etat', libelle: 'Mes phases et mes blessures', court: 'Blessures', chemin: '/sport/corps/', icone: '🩹' },
    ],
  },
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

/** Le nom complet d'un écran : « Cyclades · Révisions ». */
export function nomComplet(nomProduit: string, id = ID_BRANCHE_PAR_DEFAUT): string {
  const b = branche(id);
  return b ? `${nomProduit} · ${b.libelle}` : nomProduit;
}
