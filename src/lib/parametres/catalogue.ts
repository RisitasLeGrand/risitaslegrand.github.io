/**
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║  LE CATALOGUE DES RÉGLAGES — ce que la page « Paramètres » affiche     ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 *
 * Un réglage par entrée : son nom en français, ce à quoi il sert, sa portée,
 * sa valeur par défaut, et l'écran d'où il vient. **Rien d'exécutable** : ce
 * fichier est lu à la construction du site, pour écrire le HTML de la page.
 * La lecture et l'écriture sont dans `acces.ts`, que seul le script de
 * l'écran charge, parce qu'elles touchent IndexedDB et le coffre.
 *
 * ## Ce que le catalogue ne contient pas
 *
 * L'inventaire mécanique relève 58 clés ; toutes ne sont pas des réglages.
 * L'identifiant d'appareil, l'horloge logique, la clé de session, la pile de
 * navigation, la position de défilement sont de l'**état technique** : rien
 * ne s'y règle. `essais:reglages-orphelins` compare l'inventaire et ce
 * catalogue, et exige que chaque clé absente figure dans sa liste d'état
 * technique, avec sa raison. Une clé oubliée fait échouer la batterie ; une
 * clé déclarée « technique » à tort se discute, mais elle se voit.
 *
 * ## Les sections
 *
 * Celles du prompt 42, corrigées d'après l'inventaire : « Entraînement
 * cognitif » s'ajoute, puisque la branche existe depuis `ada37f5`.
 */
import { REGLAGES_CONTENU_PAR_DEFAUT, REGLAGES_NIVEAU_PAR_DEFAUT } from '../niveau';
import { PLAFOND_JOURS, PLANCHER_JOURS } from '../notifications/retention';
import { RETENTION_PAR_DEFAUT } from '../notifications/modele';
import { COUCHER_PAR_DEFAUT, LEVER_PAR_DEFAUT, THEMES } from '../themes';
import { CLE_VITESSE, VITESSE_PAR_DEFAUT, VITESSES } from '../podcast-noyau';
import { PRESENTATION_PAR_DEFAUT } from '../presentation-dgfip';
import type { Reglage, Section } from './modele';

/** « 07:00 » se dit « 7 h » : l'heure ronde ne porte pas ses minutes (P7). */
const enHeureDite = (heure: string): string => {
  const [h, m] = heure.split(':');
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
};

export const SECTIONS: Section[] = [
  {
    id: 'affichage',
    titre: 'Affichage',
    propos: 'Le thème, le mode, les animations et la façon dont les fiches s’ouvrent.',
    icone: 'affichage',
  },
  {
    id: 'journee',
    titre: 'Ma journée',
    propos: 'Les heures qui donnent son rythme au site : lever, coucher, revue.',
    icone: 'journee',
  },
  {
    id: 'coffre',
    titre: 'Coffre et confidentialité',
    propos: 'Ce qui est protégé, pour combien de temps, et ce qui ne sort pas de l’appareil.',
    icone: 'coffre-ferme',
  },
  {
    id: 'notifications',
    titre: 'Notifications',
    propos: 'Ce que le site a le droit de signaler, et ce qu’il en garde.',
    icone: 'notifications',
  },
  {
    id: 'revisions',
    titre: 'Révisions et concours',
    propos: 'Ce qui compte pour le niveau, ce qui entre dans les séances, et leur taille.',
    icone: 'revisions',
  },
  {
    id: 'odyssee',
    titre: 'Odyssée',
    propos: 'Les branches du quotidien : santé, veille du rythme de vie, budget.',
    icone: 'odyssee',
  },
  {
    id: 'sport',
    titre: 'Sport',
    propos: 'Les séances, et ce qui les accompagne.',
    icone: 'sport',
  },
  {
    id: 'cognitif',
    titre: 'Entraînement cognitif',
    propos: 'Les trois exercices, indépendants du programme du concours.',
    icone: 'cognitif',
  },
  {
    id: 'appareils',
    titre: 'Appareils et synchronisation',
    propos: 'Les appareils connus, et ce qui voyage entre eux.',
    icone: 'appareils',
  },
  {
    id: 'donnees',
    titre: 'Données',
    propos: 'Le stockage, les sauvegardes, les exports — et l’effacement.',
    icone: 'sauvegarde',
  },
];

const interrupteur = { genre: 'interrupteur' } as const;

/** Les cinq sources du niveau, décrites une fois. */
const SOURCES_DU_NIVEAU = [
  ['quiz', 'Les quiz comptent pour le niveau', 'Les QCM des fiches.'],
  ['flashcards', 'Les flashcards comptent', 'Les cartes de rappel.'],
  ['rappels', 'Les rappels de séance comptent', 'Cartes et questions servies en séance.'],
  [
    'dgfip',
    'Les QCM DGFiP comptent',
    'Exclus par défaut : leurs rubriques — français, culture générale, logique, maths — ne recouvrent pas les matières du concours.',
  ],
  [
    'pretest',
    'Les prétests comptent',
    'Ils alimentent la note d’entrée, celle qui oriente vers les cours de la zone proximale.',
  ],
] as const;

const CONTENUS_DU_NIVEAU = [
  [
    'casPratique',
    'Le cas pratique compte pour le niveau',
    'Il s’évalue sur une note rédigée, pas sur des questions fermées.',
  ],
  [
    'methodologie',
    'La méthodologie compte pour le niveau',
    'Savoir qu’une note fait huit pages ne situe pas un niveau en économie.',
  ],
  [
    'reviserMethodologie',
    'Réviser les fiches de méthodologie',
    'Les faire entrer dans les files de révision.',
  ],
] as const;

export const REGLAGES: Reglage[] = [
  /* ── Affichage ─────────────────────────────────────────────────────────── */
  {
    id: 'theme',
    libelle: 'Thème',
    aQuoiCaSert: 'Les couleurs de tout le site. Quatorze au choix ; Égée par défaut.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.palette',
    nature: {
      genre: 'choix',
      options: THEMES.map((t) => ({ valeur: t.id, libelle: t.nom, detail: t.description })),
    },
    defaut: 'egee',
  },
  {
    id: 'bascule-jour-nuit',
    libelle: 'Clair le jour, sombre la nuit',
    aQuoiCaSert: 'Le mode suit l’heure : clair au lever, sombre au coucher.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.bascule-jour-nuit',
    nature: interrupteur,
    defaut: true,
  },
  {
    id: 'heure-clair',
    libelle: 'Passer au clair à',
    aQuoiCaSert:
      'Laissez vide pour suivre votre heure de lever, dans « Ma journée ». Une heure donnée ici ne vaut que sur cet appareil, et fixe aussi celle du sombre.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.heures-bascule',
    nature: { genre: 'heure' },
    /* Le défaut est le vide, et « Rétablir » rend donc la main à « Ma
       journée » au lieu d'inscrire 7 h sur cet appareil (P10). */
    defaut: '',
    siVide: `Votre heure de lever est utilisée, ou ${enHeureDite(LEVER_PAR_DEFAUT)} si elle n’est pas renseignée.`,
  },
  {
    id: 'heure-sombre',
    libelle: 'Passer au sombre à',
    aQuoiCaSert:
      'Laissez vide pour suivre votre heure de coucher, dans « Ma journée ». Une heure donnée ici ne vaut que sur cet appareil, et fixe aussi celle du clair.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.heures-bascule',
    nature: { genre: 'heure' },
    defaut: '',
    siVide: `Votre heure de coucher est utilisée, ou ${enHeureDite(COUCHER_PAR_DEFAUT)} si elle n’est pas renseignée.`,
  },
  {
    id: 'mode',
    libelle: 'Mode, quand la bascule est arrêtée',
    aQuoiCaSert: 'Clair, sombre, ou celui de votre téléphone.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.theme',
    nature: {
      genre: 'choix',
      options: [
        { valeur: 'clair', libelle: 'Clair' },
        { valeur: 'sombre', libelle: 'Sombre' },
        { valeur: 'systeme', libelle: 'Système', detail: 'Suit votre appareil' },
      ],
    },
    defaut: 'sombre',
  },
  {
    id: 'animations',
    libelle: 'Réduire les animations',
    aQuoiCaSert:
      'Supprime les fondus et les glissements. Le réglage de votre téléphone s’applique de son côté : le plus sobre des deux l’emporte.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.animations',
    nature: interrupteur,
    defaut: false,
    ecran: '/profil/',
  },
  {
    id: 'laterale',
    libelle: 'Replier la barre latérale',
    aQuoiCaSert:
      'Sur un ordinateur, la navigation de gauche se réduit à une colonne d’icônes et rend sa place au contenu. Les entrées restent toutes atteignables, et le bouton de la barre fait la même chose.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.laterale',
    nature: interrupteur,
    defaut: false,
  },
  {
    id: 'serie-xp',
    libelle: 'Afficher la série et l’XP',
    aQuoiCaSert:
      'Le compteur de jours d’affilée et les points d’expérience. Éteint, ils disparaissent des écrans ; rien n’est perdu, et le calcul continue.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.serie-xp',
    nature: interrupteur,
    defaut: true,
  },
  {
    id: 'vue-fiche',
    libelle: 'Ouvrir les fiches en lecture continue',
    aQuoiCaSert: 'Plutôt que repliées section par section.',
    section: 'affichage',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.vue-fiche',
    nature: interrupteur,
    defaut: false,
    ecran: '/fiche/',
  },
  {
    id: 'vitesse-ecoute',
    libelle: 'Vitesse des fiches audio',
    aQuoiCaSert: 'La diction des fiches écoutées. 1 = la voix telle qu’elle a été produite.',
    section: 'affichage',
    /*
       Par APPAREIL, et c'est un choix. On n'écoute pas à la même vitesse sur
       un téléphone dans la rue et au casque à son bureau ; synchroniser ce
       réglage imposerait l'un des deux à l'autre.
    */
    portee: 'appareil',
    stockage: `localStorage::${CLE_VITESSE}`,
    nature: {
      genre: 'choix',
      options: VITESSES.map((v) => ({
        valeur: String(v),
        /* « × 1,25 » : virgule décimale française, jamais un point. */
        libelle: `× ${new Intl.NumberFormat('fr-FR').format(v)}`,
      })),
    },
    defaut: String(VITESSE_PAR_DEFAUT),
    ecran: '/fiche/',
  },

  /* ── Ma journée ────────────────────────────────────────────────────────── */
  {
    id: 'lever',
    libelle: 'Heure de lever',
    /* M4 du 56 : la journée ne change pas de date à l'heure du lever, mais
       UNE HEURE AVANT, bornée entre 2 h et 6 h. L'ancienne phrase annonçait
       la bascule à l'heure du lever, ce que le code n'a jamais fait. */
    aQuoiCaSert:
      'Votre journée change de date une heure avant votre lever, entre 2 h et 6 h : une séance finie à minuit trente compte pour la soirée écoulée.',
    section: 'journee',
    portee: 'tous',
    stockage: 'IndexedDB/etat::profil',
    nature: { genre: 'heure' },
    /* Le défaut déclaré est le vide, et non 7 h : « Rétablir » retire la
       réponse au lieu d'écrire au journal une heure que personne n'a donnée
       (P10). La phrase ci-dessous dit ce que Cyclades fait à défaut. */
    defaut: '',
    siVide: `Non renseigné : ${enHeureDite(LEVER_PAR_DEFAUT)} par défaut.`,
    ecran: '/profil/',
  },
  {
    id: 'coucher',
    libelle: 'Heure de coucher',
    aQuoiCaSert: 'Elle sert à la revue du soir et à la bascule entre le thème clair et le thème sombre.',
    section: 'journee',
    portee: 'tous',
    stockage: 'IndexedDB/etat::profil',
    nature: { genre: 'heure' },
    defaut: '',
    siVide: `Non renseigné : ${enHeureDite(COUCHER_PAR_DEFAUT)} par défaut.`,
    ecran: '/profil/',
  },
  {
    id: 'moment-revue',
    /* Décision 4 du 56 : le même nom et les mêmes libellés qu'à
       l'initialisation et dans « Mon profil ». Trois écrans qui nomment
       différemment la même donnée font croire à trois réglages. */
    libelle: 'Moment de ma revue (Odyssée)',
    aQuoiCaSert: 'Le matin, la revue porte sur la veille ; le soir, sur la journée qui s’achève.',
    section: 'journee',
    portee: 'tous',
    stockage: 'IndexedDB/etat::profil',
    nature: {
      genre: 'choix',
      options: [
        { valeur: 'matin', libelle: 'Le matin (sur la veille)' },
        { valeur: 'soir', libelle: 'Le soir (sur la journée)' },
      ],
    },
    defaut: 'soir',
    ecran: '/profil/',
  },

  /* ── Coffre et confidentialité ─────────────────────────────────────────── */
  {
    id: 'delai-verrou',
    libelle: 'Refermer le coffre après',
    aQuoiCaSert: 'Le temps d’inactivité au bout duquel le coffre se referme seul.',
    section: 'coffre',
    portee: 'appareil',
    stockage: 'IndexedDB/etat::coffre.verrou-automatique.delai',
    nature: { genre: 'nombre', min: 1, max: 120, unite: 'minutes' },
    defaut: 15,
  },
  {
    id: 'memorisation-coffre',
    libelle: 'Coffre retenu sur ce téléphone',
    aQuoiCaSert:
      'Évite de retaper le mot de passe à chaque session. Le décocher l’oublie et referme le coffre ; pour le remettre, cochez la case au moment d’ouvrir le coffre — fabriquer l’enveloppe demande le mot de passe.',
    section: 'coffre',
    portee: 'appareil',
    stockage: 'localStorage::cyclades.coffre.appareil',
    nature: interrupteur,
    defaut: false,
  },
  {
    id: 'mot-de-passe-coffre',
    libelle: 'Mot de passe du coffre',
    aQuoiCaSert: 'Le changer rechiffre les enveloppes de cet appareil.',
    section: 'coffre',
    portee: 'appareil',
    stockage: 'IndexedDB/etat::coffre.sel',
    nature: { genre: 'ailleurs', vers: '/coffre/bascule/', texte: 'Changer le mot de passe' },
    defaut: null,
    ecran: '/coffre/bascule/',
  },

  /* ── Notifications ─────────────────────────────────────────────────────── */
  {
    id: 'retention-archiver',
    libelle: 'Archiver les notifications après',
    aQuoiCaSert: 'Archivées, elles restent consultables mais sortent de la liste du jour.',
    section: 'notifications',
    portee: 'appareil',
    stockage: 'localStorage::cyclades.notifications.retention',
    nature: { genre: 'nombre', min: PLANCHER_JOURS, max: PLAFOND_JOURS, unite: 'jours' },
    defaut: RETENTION_PAR_DEFAUT.archiverApres,
    ecran: '/notifications/',
  },
  {
    id: 'retention-supprimer',
    libelle: 'Supprimer les notifications après',
    aQuoiCaSert: 'Passé ce délai, elles sont effacées pour de bon.',
    section: 'notifications',
    portee: 'appareil',
    stockage: 'localStorage::cyclades.notifications.retention',
    nature: { genre: 'nombre', min: PLANCHER_JOURS, max: PLAFOND_JOURS, unite: 'jours' },
    defaut: RETENTION_PAR_DEFAUT.supprimerApres,
    ecran: '/notifications/',
  },
  {
    id: 'sources-notifications',
    libelle: 'Sources autorisées',
    aQuoiCaSert:
      'Quelles branches ont le droit d’envoyer une notification système. Chaque source demande la permission du téléphone à son tour.',
    section: 'notifications',
    portee: 'appareil',
    stockage: 'localStorage::cyclades.notifications.sources',
    nature: { genre: 'ailleurs', vers: '/notifications/', texte: 'Choisir les sources' },
    defaut: [],
    ecran: '/notifications/',
  },

  /* ── Révisions et concours ─────────────────────────────────────────────── */
  ...SOURCES_DU_NIVEAU.map(([nom, libelle, aQuoiCaSert]) => ({
    id: `niveau-${nom}`,
    libelle,
    aQuoiCaSert,
    section: 'revisions',
    portee: 'appareil' as const,
    stockage: 'IndexedDB/etat::reglagesNiveau',
    nature: interrupteur,
    defaut: REGLAGES_NIVEAU_PAR_DEFAUT[nom],
    ecran: '/progression/',
  })),
  ...CONTENUS_DU_NIVEAU.map(([nom, libelle, aQuoiCaSert]) => ({
    id: `contenu-${nom}`,
    libelle,
    aQuoiCaSert,
    section: 'revisions',
    portee: 'appareil' as const,
    stockage: 'IndexedDB/etat::reglagesContenu',
    nature: interrupteur,
    defaut: REGLAGES_CONTENU_PAR_DEFAUT[nom],
    ecran: '/progression/',
  })),
  {
    id: 'compte-a-rebours',
    libelle: 'Compte à rebours vers mes épreuves',
    aQuoiCaSert:
      'Une ligne par épreuve à venir sur l’accueil de Révisions, avec la date et le temps qui reste. Sans date renseignée, une invitation à les donner.',
    section: 'revisions',
    portee: 'tous',
    stockage: 'IndexedDB/etat::reglagesSession',
    nature: interrupteur,
    defaut: true,
    ecran: '/revisions/',
  },
  {
    id: 'plafond-cartes',
    libelle: 'Cartes par séance, au plus',
    aQuoiCaSert: 'Au-delà, la séance s’arrête : mieux vaut finir que renoncer.',
    section: 'revisions',
    portee: 'tous',
    stockage: 'IndexedDB/etat::reglagesSession',
    nature: { genre: 'nombre', min: 5, max: 200, unite: 'cartes' },
    defaut: 25,
    ecran: '/progression/',
  },
  {
    id: 'plafond-questions',
    libelle: 'Questions par séance, au plus',
    aQuoiCaSert: 'Même principe que pour les cartes.',
    section: 'revisions',
    portee: 'tous',
    stockage: 'IndexedDB/etat::reglagesSession',
    nature: { genre: 'nombre', min: 5, max: 200, unite: 'questions' },
    defaut: 20,
    ecran: '/progression/',
  },
  {
    id: 'decouper-par-parties',
    libelle: 'Répartir une longue fiche sur plusieurs séances',
    aQuoiCaSert:
      'Partie par partie, plutôt qu’une fiche entière d’un bloc. Désactivé par défaut.',
    section: 'revisions',
    portee: 'tous',
    stockage: 'IndexedDB/etat::planification',
    nature: interrupteur,
    defaut: false,
    ecran: '/planification/',
  },
  {
    id: 'rotation',
    libelle: 'Thème proposé chaque jour',
    aQuoiCaSert: 'Sept thèmes, un par jour de la semaine, propres à chaque parcours.',
    section: 'revisions',
    portee: 'tous',
    stockage: 'IndexedDB/etat::planification',
    nature: { genre: 'ailleurs', vers: '/planification/', texte: 'Régler la rotation' },
    defaut: null,
    ecran: '/planification/',
  },
  {
    id: 'parcours',
    libelle: 'Parcours suivi',
    aQuoiCaSert: 'Le concours préparé : il décide des matières, des thèmes et des rotations.',
    section: 'revisions',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.parcours',
    nature: { genre: 'ailleurs', vers: '/revisions/', texte: 'Changer de parcours' },
    defaut: 'insp',
    ecran: '/revisions/',
  },
  {
    id: 'assistant-options',
    libelle: 'Contexte joint à « Demander à l’IA »',
    aQuoiCaSert:
      'Ce que le presse-papiers emporte avec la question. Rien n’est envoyé par le site : c’est vous qui collez.',
    section: 'revisions',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.assistant.options',
    nature: { genre: 'ailleurs', vers: '/fiche/', texte: 'Régler dans le volet « Demander à l’IA »' },
    defaut: null,
  },
  {
    id: 'presentation-dgfip',
    libelle: 'Présentation de l’épreuve DGFiP',
    aQuoiCaSert:
      'Ce qui est proposé au départ. La copie reproduit la feuille du concours et son chronomètre ; l’autre présentation pose une question par écran, sans minuterie.',
    section: 'revisions',
    portee: 'appareil',
    stockage: 'localStorage::cyclades.dgfip.presentation',
    nature: {
      genre: 'choix',
      options: [
        {
          valeur: 'copie',
          libelle: 'Copie de concours',
          detail: 'Le sujet entier, sa feuille de réponse à deux lignes, et le temps qui court.',
        },
        {
          valeur: 'une-a-la-fois',
          libelle: 'Une question à la fois',
          detail: 'Un écran par question, sans chronomètre. Le format d’avant.',
        },
      ],
    },
    defaut: PRESENTATION_PAR_DEFAUT,
    ecran: '/quiz/dgfip/',
  },

  /* ── Odyssée ───────────────────────────────────────────────────────────── */
  {
    id: 'sante-active',
    libelle: 'Chapitre Santé',
    aQuoiCaSert:
      'Ouvre le suivi des traitements, des symptômes et des prélèvements. Les données y sont sous coffre ; l’interrupteur lui-même reste sur cet appareil, parce qu’un consentement ne se synchronise pas.',
    section: 'odyssee',
    /*
       « Ce téléphone seulement », et non « Protégé par le coffre » : le
       drapeau vit en clair dans `etat` (voir `donnees-sante.ts`). Le dire
       autrement serait une promesse que le stockage ne tient pas. La page
       le masque tout de même coffre fermé — `sousCoffre` ci-dessous —,
       parce que savoir que le chapitre Santé est ouvert en dit déjà trop.
    */
    portee: 'appareil',
    stockage: 'IndexedDB/etat::sante.active',
    nature: interrupteur,
    defaut: false,
    sousCoffre: true,
    ecran: '/odyssee/sante/',
  },
  {
    id: 'veille',
    libelle: 'Veille du rythme de vie',
    aQuoiCaSert:
      'Signale les écarts de rythme. Inactive par défaut : un dispositif qui observe sans qu’on l’ait demandé n’a pas sa place.',
    section: 'odyssee',
    portee: 'coffre',
    stockage: 'IndexedDB/odysseeVeilleReglages::(clé portée par l’objet)',
    nature: { genre: 'ailleurs', vers: '/odyssee/veille/', texte: 'Régler la veille' },
    defaut: false,
    sousCoffre: true,
    ecran: '/odyssee/veille/',
  },
  {
    id: 'consommateurs',
    libelle: 'Qui lit mon budget',
    aQuoiCaSert: 'Les écrans autorisés à lire les finances, un par un.',
    section: 'odyssee',
    portee: 'coffre',
    stockage: 'IndexedDB/odysseeConsommateurs::(clé portée par l’objet)',
    nature: {
      genre: 'ailleurs',
      vers: '/odyssee/qui-lit-mon-budget/',
      texte: 'Voir et régler les lecteurs',
    },
    defaut: null,
    sousCoffre: true,
    ecran: '/odyssee/qui-lit-mon-budget/',
  },

  /* ── Sport ─────────────────────────────────────────────────────────────── */
  {
    id: 'theme-seance',
    libelle: 'Thème Séance pendant les séances',
    aQuoiCaSert:
      'Très grands chiffres et contraste maximal pendant une séance, puis retour au thème choisi.',
    section: 'sport',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.theme-seance',
    nature: interrupteur,
    defaut: true,
  },
  {
    id: 'ecran-allume',
    libelle: 'Garder l’écran allumé en séance',
    aQuoiCaSert:
      'Le téléphone ne s’éteint pas entre deux séries. Sans effet si le navigateur le refuse.',
    section: 'sport',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.ecran-allume',
    nature: interrupteur,
    defaut: true,
  },
  {
    id: 'refus-sport',
    libelle: 'Exercices écartés aujourd’hui',
    aQuoiCaSert: 'Ce que vous avez refusé pour la journée : la liste se vide d’elle-même demain.',
    section: 'sport',
    portee: 'appareil',
    stockage: 'localStorage::cyclades.sport.refus',
    nature: { genre: 'ailleurs', vers: '/sport/seance/', texte: 'Voir la séance du jour' },
    defaut: null,
    ecran: '/sport/seance/',
  },

  /* ── Entraînement cognitif ─────────────────────────────────────────────── */
  {
    id: 'nback-reglages',
    libelle: 'Réglages du Quad N-Back',
    aQuoiCaSert: 'Le n, les flux actifs, la durée d’une partie. Réglés sur l’exercice lui-même.',
    section: 'cognitif',
    portee: 'appareil',
    stockage: 'localStorage::revinsp.nback.reglages',
    nature: {
      genre: 'ailleurs',
      vers: '/cog-training/quad-n-back/',
      texte: 'Ouvrir l’exercice',
    },
    defaut: null,
    ecran: '/cog-training/quad-n-back/',
  },
  {
    id: 'rr-tutoriels',
    libelle: 'Tutoriels du raisonnement relationnel',
    aQuoiCaSert: 'Les explications affichées avant un système nouveau.',
    section: 'cognitif',
    portee: 'appareil',
    stockage: 'localStorage::revinsp:rr:tutoriels',
    nature: interrupteur,
    defaut: true,
    ecran: '/cog-training/relational-reasoning/',
  },
  {
    id: 'selection-entrainement',
    libelle: 'Moteurs entraînés',
    aQuoiCaSert: 'Les familles d’énoncés tirées au sort dans une séance.',
    section: 'cognitif',
    portee: 'tous',
    stockage: 'IndexedDB/etat::selection:*',
    nature: {
      genre: 'ailleurs',
      vers: '/cog-training/relational-reasoning/',
      texte: 'Choisir les moteurs',
    },
    defaut: null,
    ecran: '/cog-training/relational-reasoning/',
  },

  /* ── Appareils et synchronisation ──────────────────────────────────────── */
  {
    id: 'appareils',
    libelle: 'Appareils connus',
    aQuoiCaSert: 'Ceux avec lesquels Cyclades sait échanger, et leur dernière rencontre.',
    section: 'appareils',
    portee: 'appareil',
    stockage: 'IndexedDB/etat::appareilsVus',
    nature: { genre: 'ailleurs', vers: '/appareils/', texte: 'Voir les appareils' },
    defaut: null,
    ecran: '/appareils/',
  },
  {
    id: 'dossier-partage',
    libelle: 'Dossier partagé',
    aQuoiCaSert: 'Le dossier par lequel deux appareils s’échangent leurs paquets.',
    section: 'appareils',
    portee: 'appareil',
    stockage: 'IndexedDB/etat::dossier-partage',
    nature: { genre: 'ailleurs', vers: '/appareils/', texte: 'Régler le dossier' },
    defaut: null,
    ecran: '/appareils/',
  },

  /* ── Données ───────────────────────────────────────────────────────────── */
  {
    id: 'stockage',
    libelle: 'Stockage et rétention',
    aQuoiCaSert: 'Ce que chaque magasin occupe, et ce qui est conservé combien de temps.',
    section: 'donnees',
    portee: 'appareil',
    stockage: 'IndexedDB/etat::derniereSauvegarde',
    nature: { genre: 'ailleurs', vers: '/stockage/', texte: 'Voir le stockage' },
    defaut: null,
    ecran: '/stockage/',
  },
  {
    id: 'export-ia',
    libelle: 'Export pour une IA',
    aQuoiCaSert: 'Les huit fichiers, leur manifeste, et ce qui en est exclu par défaut.',
    section: 'donnees',
    portee: 'appareil',
    stockage: 'IndexedDB/etat::profil',
    nature: { genre: 'ailleurs', vers: '/exporter-ia/', texte: 'Préparer un export' },
    defaut: null,
    ecran: '/exporter-ia/',
  },
];

export const reglagesDe = (section: string) => REGLAGES.filter((r) => r.section === section);
