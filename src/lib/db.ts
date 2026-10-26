/**
 * Persistance locale (IndexedDB via « idb »).
 * Toute la progression reste dans le navigateur : aucun serveur, aucun compte.
 * L'export/import JSON (page « Progression ») sert à synchroniser manuellement
 * plusieurs appareils.
 */
import { createEmptyCard, type Card } from 'ts-fsrs';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
/*
   Le signal d'écriture regroupée : un module sans dépendance, sans effet tant
   que personne ne s'y abonne, et qui n'est abonné que par la veille de
   synchronisation — c'est-à-dire sur un appareil certifié, une fois la
   session ouverte. Sur toutes les autres pages, l'appel coûte un test de
   taille d'ensemble.
*/
import { signalerEcriture } from './sync/signal-ecriture';
/*
   Imports de **types seulement** : « noyau/revisions.ts » importe « fsrsNeuf »
   d'ici, et un import de valeur dans l'autre sens formerait un cycle au
   chargement. Les types, eux, sont effacés à la compilation.
*/
import type { EntreeRevision } from './noyau/revisions';
import type { EpreuveEnCours } from './noyau/epreuve-en-cours';
import { CLE_EPREUVE_EN_COURS } from './noyau/epreuve-en-cours';
import type { AnnulationEnAttente } from './noyau/annulation-en-attente';
import type { ReglagesDuCycle, SaisieDuCycle } from './odyssee/cycle';
import type { SexeEnregistre } from './odyssee/sexe';
import type {
  Evenement,
  EtapeCochee,
  ExceptionScellee,
  Focus,
  Occurrence,
  Quete,
  ReportEnAttente,
} from './odyssee/modele';
import type { ElementDuCentre } from './notifications/modele';
import type {
  Revue,
  Tache,
} from './odyssee/modele';
import type { Blessure, Exercice, Phase, Seance as SeanceSport } from './sport/modele';
import type { Programme as ProgrammeSport } from './sport/programmes';
import type { Trajectoire } from './odyssee/trajectoires';
import type { Prise, StatutHormonal } from './odyssee/sensible';
import type {
  ConditionDeclaree,
  MarqueDeCreneau,
  Prelevement,
  Ressenti,
  Resultat,
  Symptome,
  Traitement,
} from './odyssee/sante';
import type { Checkin, CheckinHebdo, Entree } from './odyssee/psyche';
import type { Visite } from './visites';
import type { Session } from './odyssee/usage';
import type { LigneDeBase } from './odyssee/veille';
import type { ReglagesVeille, SignalEnregistre } from './odyssee/signal-veille';
import type { Passation } from './odyssee/echelles';
import type { Compte, OperationBancaire, Valorisation } from './odyssee/finances';
import type { LigneBudget } from './odyssee/budget';
import type { Rapprochement } from './odyssee/rapprochement';
import type { EtatDesConsommateurs } from './odyssee/consommateurs';
import type { Pointage } from './odyssee/pointage';
import type { RegleDePointage, Vendeur } from './odyssee/vendeurs';
import type { EtatDeLaTaxonomie } from './odyssee/taxonomie';
import type {
  Boisson,
  EtatDeSante,
  MesureCorporelle,
  Nuit,
  Pesee,
  Repas as RepasCorps,
} from './odyssee/corps';
import type { Operation } from './noyau/operations';
import { socleDe } from './noyau/revisions';
import { idAppareilNeuf } from './noyau/operations';
import { fabriqueUlid, ulid } from './noyau/ulid';
import {
  instantanerSiMigration,
  revenirA,
  type Instantane,
  type ResultatInstantane,
} from './noyau/instantane';

/**
 * Les quatre niveaux de notation d'une flashcard.
 *
 * FSRS attend Again / Hard / Good / Easy. « Oublié » n'est pas un quatrième cran
 * ajouté au confort de l'interface : l'échec alimente une grandeur distincte du
 * modèle — les rechutes —, là où les trois autres notes règlent la vitesse.
 * C'est aussi le mot employé par le cahier des charges.
 */
export type Note = 'oublie' | 'difficile' | 'correct' | 'facile';

export interface EtatCarte {
  id: string;
  ficheId: string;
  matiere: string;
  /** Prochaine échéance, au format AAAA-MM-JJ : c'est la clé de l'index « du ». */
  du: string;
  derniereRevision: string | null;
  /** Intervalle courant, en jours. */
  intervalle: number;
  /** Nombre de notations reçues, toutes notes confondues. */
  revisions: number;
  /** Nombre de fois où la carte a été notée « oublié ». */
  oublis: number;
  /** L'état du modèle FSRS. Voir `src/lib/srs.ts`. */
  fsrs: CarteFsrs;
}

/**
 * L'état FSRS tel qu'il est stocké : les champs de `Card` de la bibliothèque,
 * dates au format ISO.
 *
 * Les noms restent ceux de `ts-fsrs`, sans traduction. Renommer en français
 * aurait créé une table de correspondance à maintenir entre notre modèle et le
 * sien, à chaque montée de version — et c'est là que les erreurs se logent. Les
 * champs que le reste du site lit (`du`, `intervalle`, `revisions`, `oublis`)
 * gardent en revanche leur nom et leur sens.
 *
 * Les dates sont des chaînes et non des `Date` pour que la sauvegarde JSON et la
 * base rendent exactement la même forme : un `Date` stocké dans IndexedDB
 * revient en `Date`, mais revient en chaîne après un export puis un import.
 */
export interface CarteFsrs {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  last_review?: string;
}

/** Met l'état rendu par la bibliothèque sous la forme que l'on stocke. */
export function serialiserFsrs(carte: Card): CarteFsrs {
  return {
    due: carte.due.toISOString(),
    stability: carte.stability,
    difficulty: carte.difficulty,
    elapsed_days: carte.elapsed_days,
    scheduled_days: carte.scheduled_days,
    learning_steps: carte.learning_steps,
    reps: carte.reps,
    lapses: carte.lapses,
    state: carte.state as 0 | 1 | 2 | 3,
    ...(carte.last_review ? { last_review: carte.last_review.toISOString() } : {}),
  };
}

/** Un état FSRS neuf, celui d'une carte jamais vue. */
export function fsrsNeuf(maintenant = new Date()): CarteFsrs {
  return serialiserFsrs(createEmptyCard(maintenant));
}

export interface ResultatQuiz {
  /**
   * Identifiant stable (ULID), posé à l'écriture.
   *
   * C'était une clé auto-incrémentée. Deux appareils produisaient alors tous
   * deux un « id: 1 » pour deux événements différents : la collision n'était
   * pas un risque, c'était une certitude dès la première synchronisation.
   */
  id?: string;
  ficheId: string;
  matiere: string;
  le: string;
  bonnes: number;
  total: number;
}

export interface EtatFiche {
  id: string;
  matiere: string;
  lu: boolean;
  derniereOuverture: string | null;
  secondes: number;
  /**
   * Date à laquelle le prétest de la fiche a été **tenté**. Il ne revient plus
   * ensuite : son effet tient à ce qu'il précède la première lecture.
   */
  pretesteeLe?: string;
  /**
   * Jour où le prétest a été **passé** sans répondre. Il ne revient pas le même
   * jour — le bouton « passer » existe pour qu'une consultation rapide ne soit
   * pas bloquée —, mais il revient un autre jour : passer n'est pas répondre, et
   * consommer définitivement le prétest pour un coup d'œil serait le perdre pour
   * la vraie séance de travail.
   */
  pretestPasseLe?: string;
  /**
   * Identifiants des questions de prétest déjà servies pour cette fiche.
   *
   * Le prétest tire quelques questions d'un vivier : les retenir permet de
   * servir des questions inédites si le prétest est reproposé. C'est aussi la
   * raison d'être du vivier — une progression effacée par accident ne doit pas
   * rejouer exactement les mêmes questions, faute de quoi la seconde amorce ne
   * mesurerait plus qu'un souvenir de la première.
   */
  pretestVues?: string[];
}

/**
 * Une entrée du journal d'erreurs.
 *
 * Toute réponse fausse en quiz ou en QCM-DGFiP, et tout « oublié » sur une
 * flashcard, ouvre une entrée ici — une file de révision **séparée**, qui
 * s'ajoute au passage normalement programmé de l'item et ne le remplace pas.
 *
 * L'entrée ne se referme qu'après **deux réussites lors de sessions
 * distinctes** du journal : une seule réussite peut être un coup de chance, et
 * la refermer là-dessus reviendrait à effacer le signal qu'on cherchait à
 * garder. Une nouvelle erreur remet le compteur à zéro, pour la même raison.
 */
export interface EntreeJournal {
  /** L'identifiant de l'item fautif : carte, question de quiz ou de QCM. */
  id: string;
  genre: 'flashcard' | 'quiz' | 'dgfip';
  /** Matière de rattachement ; « QCM DGFiP » pour la banque, qui n'en a pas. */
  matiere: string;
  fascicule?: string;
  ficheId?: string;
  rubriqueId?: string;
  ouverteLe: string;
  derniereErreurLe: string;
  erreurs: number;
  /** Réussites comptées, chacune dans une session de journal différente. */
  reussites: number;
  /** Session où la dernière réussite a été comptée, pour les exiger séparées. */
  derniereSession: string | null;
  /** Renseignée à la fermeture ; l'entrée reste alors comme trace. */
  fermeeLe?: string;
}

/**
 * Le niveau estimé sur un sujet — matière, fascicule ou fiche.
 *
 * La note est une note de type Elo : elle monte quand on réussit ce qui était
 * prévu difficile, et descend quand on échoue sur ce qui était prévu facile.
 * Voir `src/lib/niveau.ts` pour le détail et les raisons.
 */
export interface Competence {
  /** `matiere:<nom>`, `fascicule:<matiere>|<nom>` ou `fiche:<id>`. */
  clef: string;
  portee: 'matiere' | 'fascicule' | 'fiche';
  /** Libellé lisible : nom de la matière, du fascicule ou de la fiche. */
  libelle: string;
  /** Matière de rattachement, pour regrouper à l'affichage. */
  matiere: string;
  note: number;
  observations: number;
  majLe: string;
  /**
   * Vraie lorsque la note vient d'une auto-estimation initiale et non encore
   * d'observations. Elle sert d'amorce : la première réponse réelle la déplace
   * comme n'importe quelle autre, et rien ne distingue plus ensuite une note
   * amorcée d'une note gagnée.
   */
  calibree?: boolean;
}

/**
 * La difficulté estimée d'un item — question de quiz, de QCM, ou flashcard.
 *
 * Elle bouge au même titre que le niveau de la personne : un item que tout le
 * monde rate devient difficile, comme un joueur qui gagne monte au classement.
 * C'est ce qui permet de parler de zone proximale sans avoir à étiqueter chaque
 * question à la main.
 */
export interface DifficulteItem {
  id: string;
  note: number;
  observations: number;
  majLe: string;
}

export interface SessionNBack {
  /**
   * Identifiant stable (ULID), posé à l'écriture.
   *
   * C'était une clé auto-incrémentée. Deux appareils produisaient alors tous
   * deux un « id: 1 » pour deux événements différents : la collision n'était
   * pas un risque, c'était une certitude dès la première synchronisation.
   */
  id?: string;
  le: string;
  /** Identifiant du mode joué : sert à ne comparer que des parties similaires. */
  titre?: string;
  /**
   * « terminee » pour une partie jouée, « jalon » pour la marque posée lors
   * d'un changement de niveau — elle empêche de recompter les mêmes parties.
   */
  statut?: 'terminee' | 'jalon';
  /** Profondeur jouée (n-back). */
  n: number;
  /** Dimensions actives lors de la partie. */
  dimensions: string[];
  nombreEpreuves: number;
  /** Précision équilibrée, de 0 à 1. */
  taux: number;
  reperees: number;
  aReperer: number;
  erreurs: number;
  secondes: number;
}

/**
 * Session de Relational Reasoning.
 *
 * Le détail par item est conservé — un enregistrement par question, avec son
 * moteur et son système — et non le seul total. C'est ce qui permet au tableau
 * de bord de montrer la force par moteur, et surtout à la phase de progression
 * de se **recalculer** au lieu d'être stockée : une phase mémorisée se
 * désynchroniserait d'un import de sauvegarde, alors qu'un décompte se refait.
 */
export interface SessionRelationnelle {
  /**
   * Identifiant stable (ULID), posé à l'écriture.
   *
   * C'était une clé auto-incrémentée. Deux appareils produisaient alors tous
   * deux un « id: 1 » pour deux événements différents : la collision n'était
   * pas un risque, c'était une certitude dès la première synchronisation.
   */
  id?: string;
  le: string;
  /**
   * Note de 0 à 1 par item, et non un booléen : les questions à sélection
   * multiple admettent des réponses partiellement justes, qui valent plus
   * qu'une erreur et moins qu'une réponse exacte. Un booléen aurait forcé à
   * ranger ces réponses dans l'une des deux cases, et avec elles l'échelon de
   * difficulté qui s'en déduit.
   */
  items: { moteur: string; systeme: string; note: number }[];
  tentes: number;
  /** Items entièrement réussis — les notes intermédiaires n'y comptent pas. */
  reussis: number;
  secondes: number;
}

/**
 * Seuil de discrimination d'une paire de dimensions, dans un sens donné.
 *
 * L'état complet de l'escalier est conservé, et pas seulement le seuil : une
 * procédure adaptative se poursuit d'une session à l'autre, et repartir de
 * l'écart initial à chaque session gâcherait la moitié des essais à redescendre
 * vers un seuil déjà connu.
 */
export interface SeuilVeridical {
  /** « taille>intensite » — la direction compte, la bidirectionnalité se mesure. */
  id: string;
  famille: string;
  de: string;
  vers: string;
  /** La paire franchit la frontière des familles de Stevens. */
  horsFamille: boolean;
  /** Les deux dimensions n'ont pas la même modalité : vision ↔ audition. */
  transmodale: boolean;
  escalier: {
    delta: number;
    bonnesDeSuite: number;
    inversions: number[];
    derniereDirection: 'resserre' | 'elargit' | null;
    essais: number;
    reussis: number;
  };
  /** Seuil en pas, comparable d'une dimension à l'autre. Null tant qu'il manque des inversions. */
  seuil: number | null;
  statut: 'jamais' | 'en-cours' | 'converge';
  majLe: string;
}

/** Une session de Veridical Mapping. */
export interface SessionVeridical {
  /**
   * Identifiant stable (ULID), posé à l'écriture.
   *
   * C'était une clé auto-incrémentée. Deux appareils produisaient alors tous
   * deux un « id: 1 » pour deux événements différents : la collision n'était
   * pas un risque, c'était une certitude dès la première synchronisation.
   */
  id?: string;
  le: string;
  famille: string;
  mode: string;
  charge: number;
  essais: number;
  reussis: number;
  /** Les arêtes travaillées. */
  paires: string[];
  /** Seuil médian des arêtes travaillées, en pas. */
  seuilMedian: number | null;
  secondes: number;
}

/**
 * Séance de révision planifiée.
 *
 * Une séance porte sur UN thème de planification et un jour donné. C'est elle,
 * et non un décompte calendaire, qui sert à retrouver les séances n-1 et n-2
 * d'une matière (voir src/lib/planification.ts).
 *
 * ## La note et les restitutions vivent ailleurs, et c'est mesuré
 *
 * Elles étaient dans cet objet. Une note de séance pèse une à deux pages, et
 * ses restitutions autant : huit kilo-octets par séance, 11,6 Mio après cinq
 * ans. Or presque toutes les lectures de ce magasin ne veulent que le thème, le
 * jour et le statut — la rotation, le planning, l'historique, la série. Elles
 * chargeaient onze mégaoctets de prose pour lire trois champs, et un balayage
 * complet coûtait 259 ms, répété quatre fois par peinture du tableau de bord.
 *
 * Le texte vit donc dans le magasin `notes`, chargé à la demande. Les chiffres
 * et la démonstration sont dans `docs/cyclades/budget-stockage.md`.
 */
export interface Seance {
  /**
   * Identifiant stable (ULID), posé à l'écriture.
   *
   * C'était une clé auto-incrémentée. Deux appareils produisaient alors tous
   * deux un « id: 1 » pour deux événements différents : la collision n'était
   * pas un risque, c'était une certitude dès la première synchronisation.
   */
  id?: string;
  /** Identifiant du thème de planification. */
  theme: string;
  /** Jour de la séance, au format AAAA-MM-JJ. */
  jour: string;
  statut: 'prevue' | 'terminee';
  termineeLe?: string | null;
  secondes: number;
  /**
   * Identifiants des fiches réellement couvertes pendant la séance.
   *
   * C'est ce qui permet, aux séances suivantes, de proposer un rappel par
   * flashcards et par QCM portant sur le contenu vraiment vu ce jour-là,
   * et non sur la matière entière.
   */
  fiches?: string[];
  /**
   * Les PARTIES réellement couvertes, quand la séance n'a porté que sur
   * certaines d'entre elles (prompt 46, P5).
   *
   * Facultatif, et son absence a un sens précis : **la fiche entière**. Une
   * séance enregistrée avant ce prompt n'a pas ce champ, et vaut donc pour la
   * fiche entière — ce qui est exactement ce qui s'est passé, puisque les
   * séances par partie n'existaient pas. Rien à migrer, et surtout rien à
   * inventer : remplir ce champ pour les séances anciennes aurait fabriqué un
   * passé plus précis que le vrai.
   *
   * Une fiche peut figurer dans `fiches` sans figurer ici : c'est le cas
   * normal d'une fiche travaillée en entier.
   */
  parties?: { fiche: string; partie: string }[];
  /** Séance étendue du 1er du mois : rappel n-1 à n-4. */
  etendue: boolean;
}

/**
 * La note de séance, et les restitutions à blanc qui l'accompagnent.
 *
 * Magasin à part, clé par l'identifiant de la séance. Un enregistrement n'existe
 * que si quelque chose a été écrit : une séance sans note n'a pas de ligne ici,
 * et c'est la bonne économie — la majorité des séances anciennes n'en auront
 * jamais.
 *
 * `majLe` est la première date de dernière modification du modèle. Elle est
 * posée ici parce que c'est ce que la fusion de deux appareils réclamera
 * (`docs/cyclades/sauvegarde.md`), et parce qu'un texte rédigé est précisément
 * la donnée qu'il ne faut pas écraser à l'aveugle.
 */
/**
 * Où l'on s'est arrêté dans une fiche audio (prompt 46, P3).
 *
 * Une entrée par fiche, et seulement pour une écoute EN COURS : la fin de
 * l'écoute la supprime, comme l'ancienne clé `localStorage` le faisait. Le
 * magasin dit donc « ce qui est commencé », jamais « ce qui a été écouté » —
 * et c'est ce qui permet à « Écoutes en cours » de n'être pas, par ricochet,
 * la liste des fiches qu'on a entendues.
 */
export interface PositionPodcast {
  /** Identifiant de la fiche. Clé du magasin. */
  fiche: string;
  /** Position de lecture, en secondes depuis le début. */
  secondes: number;
  /**
   * Durée totale de la fiche audio, en secondes, telle que le lecteur l'a
   * connue. Facultative : un navigateur qui n'a pas encore lu les
   * métadonnées ne la donne pas, et « reste 6 min » se taira plutôt que de
   * se tromper.
   */
  duree?: number | null;
  /** Dernière écriture, en ISO. Sert à ordonner « Écoutes en cours ». */
  majLe: string;
}

export interface NoteSeance {
  /** L'identifiant stable de la séance. Voir « Seance.id ». */
  seanceId: string;
  /** Note de séance rédigée par la personne (1 à 2 pages visées). */
  note: string;
  /**
   * Restitutions à blanc des séances antérieures, indexées par l'identifiant
   * de la séance restituée.
   */
  restitutions: Record<string, string>;
  majLe: string;
}

export interface Jour {
  jour: string;
  xp: number;
  cartes: number;
  quiz: number;
  bonnes: number;
  reponses: number;
  secondes: number;
}

/**
 * Historique d'une question de la banque « QCM - DGFiP ».
 * Sert à pondérer le tirage : une question ratée doit revenir plus vite
 * qu'une question sue, sans jamais disparaître complètement du hasard.
 */
export interface EtatQuestionDgfip {
  id: string;
  rubriqueId: string;
  vues: number;
  bonnes: number;
  mauvaises: number;
  abstentions: number;
  derniereLe: string;
}

/** Score par rubrique à l'intérieur d'une session. */
export interface ScoreRubriqueDgfip {
  rubriqueId: string;
  rubrique: string;
  posees: number;
  bonnes: number;
  mauvaises: number;
  abstentions: number;
  points: number;
}

export interface SessionDgfip {
  /**
   * Identifiant stable (ULID), posé à l'écriture.
   *
   * C'était une clé auto-incrémentée. Deux appareils produisaient alors tous
   * deux un « id: 1 » pour deux événements différents : la collision n'était
   * pas un risque, c'était une certitude dès la première synchronisation.
   */
  id?: string;
  le: string;
  posees: number;
  bonnes: number;
  mauvaises: number;
  abstentions: number;
  /** Total au barème +1 / −0,5 / 0, arrondi au demi-point. */
  points: number;
  /** Maximum atteignable sur cette session (= nombre de questions posées). */
  maximum: number;
  parRubrique: ScoreRubriqueDgfip[];
  /**
   * La présentation employée. Absente : « une question à la fois ».
   *
   * Trois champs facultatifs, et AUCUNE migration : une épreuve enregistrée
   * avant le prompt 49 n'en porte aucun, et s'affiche comme avant. C'est la
   * condition posée par l'interdit n° 5.
   */
  format?: 'copie';
  /**
   * Les zones de la feuille, telles qu'elles ont été remplies.
   *
   * Nécessaire pour que rouvrir une épreuve passée réaffiche sa feuille. On y
   * garde l'identifiant de la question ET son ordre d'affichage : sans
   * l'ordre, une case cochée perdrait son sens, puisque la case 1 ne désigne
   * pas l'option 0. Le texte des questions, lui, n'est pas recopié — il vit
   * dans la banque, et le dupliquer ici le figerait.
   */
  zones?: ZoneEnregistree[];
  /** Le temps réellement passé sur la copie, en secondes. */
  secondes?: number;
}

/** Une zone de la feuille de réponse, rangée dans l'historique. */
export interface ZoneEnregistree {
  /** L'identifiant de la question, pour la retrouver dans la banque. */
  id: string;
  /** L'ordre d'affichage de ses propositions. */
  ordre: number[];
  premiere: { cases: number[]; ann: boolean };
  seconde: { cases: number[]; ann: boolean };
}

/**
 * Une actualité marquée comme lue (D-039).
 *
 * ## Pourquoi un magasin, et pas un champ
 *
 * Les actualités ne sont pas des données locales : elles sont publiées,
 * chiffrées, et relues à chaque visite. Rien dans l'item ne peut porter l'état
 * de lecture, qui appartient à la personne et non au bulletin.
 *
 * ## Pourquoi la clef ne contient pas le titre
 *
 * `id` vaut « <période>:<empreinte du titre> ». La période reste lisible —
 * savoir que quelqu'un a lu quelque chose la semaine 40 n'apprend rien — mais
 * le titre est réduit à une empreinte : IndexedDB n'est pas chiffré pour les
 * données de Révisions, et une liste de titres d'actualités en clair sur le
 * disque dirait ce que la personne lit. L'empreinte suffit à retrouver la
 * ligne ; elle ne se relit pas.
 *
 * ## Ce que ce magasin ne fait pas
 *
 * Il n'est **pas scellé**. Un marqueur de lecture qui ne fonctionnerait que
 * coffre ouvert serait absurde sur une liste d'actualités, et son contenu
 * n'est pas de la nature de ce que le coffre protège. Il part avec la
 * progression, dans le groupe « Révisions », à côté des fiches lues.
 */
export interface ActualiteLue {
  /** « <période>:<empreinte du titre> ». Voir `cleActualite`. */
  id: string;
  /** Horodatage du marquage, pour que la rétention sache l'élaguer. */
  luLe: string;
}

export interface Profil {
  xp: number;
  streakCourante: number;
  streakRecord: number;
  dernierJourEtudie: string | null;
  badges: string[];
  creeLe: string;
  /**
   * Le jour où le JOUR DE GRÂCE a servi pour la dernière fois (prompt 43, F3).
   *
   * Un oubli par semaine ne remet plus la série à un. Le champ dit quand la
   * grâce a été consommée, et c'est tout ce qu'il faut pour savoir si elle
   * est de nouveau disponible : une semaine après, elle l'est.
   *
   * **Facultatif, et sans migration.** Un profil écrit avant ce lot n'a pas
   * ce champ ; il vaut alors « jamais utilisée », ce qui est exactement la
   * vérité. Aucune donnée n'est réécrite, aucun schéma n'est levé — c'est
   * l'interdit 2 du 43.
   */
  graceUtiliseeLe?: string | null;
}

/**
 * Une demande d'aide à un assistant, enregistrée pour mémoire.
 *
 * Elle n'a **aucun effet** sur le score, l'XP, le niveau estimé ni la file de
 * révision, et c'est délibéré : demander de l'aide n'est pas une faute, et le
 * compter comme telle découragerait précisément le geste qu'on veut rendre
 * facile. Elle sert à une seule chose — pouvoir se dire, en revoyant le
 * journal, « sur celle-là j'avais déjà demandé », ce qui est une information
 * utile et non une sanction.
 */
export interface AideDemandee {
  /**
   * Identifiant stable (ULID), posé à l'écriture.
   *
   * C'était une clé auto-incrémentée. Deux appareils produisaient alors tous
   * deux un « id: 1 » pour deux événements différents : la collision n'était
   * pas un risque, c'était une certitude dès la première synchronisation.
   */
  id?: string;
  /** Horodatage ISO. */
  le: string;
  /** L'écran d'où partait la demande. */
  provenance: string;
  /** L'item concerné, quand il en existe un : question, carte, terme. */
  itemId?: string;
  matiere?: string;
  /** Le préréglage choisi. */
  intention: string;
}

interface SchemaRevinsp extends DBSchema {
  etat: { key: string; value: unknown };
  cartes: { key: string; value: EtatCarte; indexes: { du: string; matiere: string } };
  fiches: { key: string; value: EtatFiche };
  journal: { key: string; value: EntreeJournal; indexes: { matiere: string } };
  competences: { key: string; value: Competence; indexes: { matiere: string } };
  difficultes: { key: string; value: DifficulteItem };
  quiz: { key: string; value: ResultatQuiz; indexes: { le: string } };
  jours: { key: string; value: Jour };
  nback: { key: string; value: SessionNBack; indexes: { le: string } };
  seances: { key: string; value: Seance; indexes: { jour: string; theme: string } };
  notes: { key: string; value: NoteSeance };
  podcastPositions: { key: string; value: PositionPodcast };
  qcmDgfip: { key: string; value: EtatQuestionDgfip; indexes: { rubriqueId: string } };
  qcmSessions: { key: string; value: SessionDgfip; indexes: { le: string } };
  epreuveDgfipEnCours: { key: string; value: EpreuveEnCours };
  /*
     Les intentions d'actions annulables (M6, 0.2). SCELLÉ : le genre d'une
     intention dirait « une prise de médicament a été notée », et c'est
     précisément ce que la décision 3 protège. Seul l'identifiant reste en
     clair, parce qu'une clé primaire ne peut pas être scellée — il est donc
     opaque, et ne porte ni le genre ni la cible.

     Pas d'index : on lit toujours TOUT le magasin, au démarrage, et il est
     presque toujours vide. Un index sur l'échéance coûterait plus qu'il ne
     servirait, et l'échéance est scellée de toute façon.
  */
  annulationsEnAttente: { key: string; value: AnnulationEnAttente };
  relationnel: { key: string; value: SessionRelationnelle; indexes: { le: string } };
  vmSeuils: { key: string; value: SeuilVeridical; indexes: { famille: string } };
  vmSessions: { key: string; value: SessionVeridical; indexes: { le: string } };
  aides: { key: string; value: AideDemandee; indexes: { le: string; itemId: string } };
  revisions: {
    key: string;
    value: EntreeRevision;
    indexes: { carteId: string; le: string };
  };
  operations: {
    key: string;
    value: Operation;
    indexes: { hlc: string; cible: string; lot: string };
  };
  /*
     Les magasins d'Odyssée. Leurs formes sont déclarées dans la branche qui
     les possède — « odyssee/modele.ts » — et non ici : « db.ts » n'a besoin
     que du nom et des index pour ouvrir la base.
  */
  odysseeTaches: { key: string; value: Tache; indexes: { echeance: string; faiteLe: string } };
  /*
     Prompt 38. Les occurrences ordinaires sont CALCULÉES et ne sont jamais
     écrites : seules les exceptions existent ici — pointée, abandonnée,
     déplacée, modifiée.
  */
  odysseeOccurrences: {
    key: string;
    value: Occurrence;
    indexes: { tacheId: string; jourPrevu: string };
  };
  odysseeEtapesCochees: {
    key: string;
    value: EtapeCochee;
    indexes: { tacheId: string; jourPrevu: string };
  };
  /*
     Les mêmes, pour les tâches liées à une branche sous coffre (décision 3).
     Aucun index : un index se lit en clair, et c'est précisément le rythme
     qu'il faudrait indexer qu'on cherche à cacher. Ce magasin ne porte que
     les exceptions des tâches sensibles — il reste petit, et un parcours
     complet y coûte moins qu'une fuite.
  */
  odysseeExceptionsScellees: { key: string; value: ExceptionScellee };
  odysseeReports: { key: string; value: ReportEnAttente };
  centreElements: { key: string; value: ElementDuCentre };
  /*
     Le suivi personnel (phases 2 à 5 du plan profil/cycle). Scellés dès leur
     création, pour la raison déjà écrite deux fois ici : une donnée sensible
     écrite en clair reste en clair dans les instantanés de migration déjà
     pris, et on ne la rattrape pas.

     AUCUN INDEX SUR LE JOURNAL, et c'est le point de ce magasin. Sa clé est
     l'empreinte du jour ; un index sur `jour` réécrirait en clair exactement
     ce que la clé cache, et la liste des clés redirait le rythme.
  */
  odysseeCycleJournal: { key: string; value: SaisieDuCycle };
  odysseeCycleReglages: { key: string; value: ReglagesDuCycle };
  /*
     LE SEXE DÉCLARÉ — décision d'Alexis du 19 octobre.

     Un enregistrement, sous clé fixe, scellé. Aucun index : il n'y a rien à
     parcourir, et un index sur la réponse donnerait le sexe en clair à
     quiconque lit le schéma de la base.
  */
  odysseeSexe: { key: string; value: SexeEnregistre };
  odysseeQuetes: { key: string; value: Quete };
  odysseeEvenements: { key: string; value: Evenement; indexes: { debut: string } };
  odysseeFocus: { key: string; value: Focus; indexes: { debut: string } };
  odysseeRevues: { key: string; value: Revue; indexes: { jour: string } };
  /* Les magasins de Sport. Mêmes principes : les formes vivent dans la branche. */
  sportExercices: { key: string; value: Exercice };
  sportSeances: { key: string; value: SeanceSport; indexes: { jour: string; statut: string } };
  sportPhases: { key: string; value: Phase; indexes: { debut: string } };
  sportBlessures: { key: string; value: Blessure; indexes: { debut: string } };
  sportProgrammes: { key: string; value: ProgrammeSport };
  odysseePesees: { key: string; value: Pesee; indexes: { jour: string } };
  odysseeMesures: { key: string; value: MesureCorporelle; indexes: { jour: string } };
  odysseeNuits: { key: string; value: Nuit; indexes: { jour: string } };
  odysseeRepas: { key: string; value: RepasCorps; indexes: { jour: string } };
  odysseeBoissons: { key: string; value: Boisson; indexes: { jour: string } };
  odysseeSante: { key: string; value: EtatDeSante; indexes: { debut: string } };
  odysseeTrajectoires: { key: string; value: Trajectoire; indexes: { statut: string } };
  /*
     Les deux magasins **scellés** du domaine Corps. Leur valeur n'est pas le
     type déclaré mais un enregistrement dont la plus grande part est chiffrée :
     voir `noyau/coffre.ts`. Le type reste écrit ici parce que c'est ce qu'on
     obtient après ouverture, et qu'un `unknown` ferait perdre la vérification
     exactement là où la donnée est la plus sensible.
  */
  odysseeMedicaments: { key: string; value: Prise; indexes: { jour: string } };
  odysseeHormonal: { key: string; value: StatutHormonal; indexes: { debut: string } };
  /*
     Santé, phase 1 (D-024). Scellés dès leur création, comme les deux
     précédents, et pour la même raison : une donnée de santé écrite en clair
     reste en clair dans les instantanés de migration déjà pris.

     Les index sont ceux des seules lectures prévues : les traitements d'une
     période, les prélèvements d'une fenêtre de jours, les résultats d'un
     prélèvement, les symptômes d'un jour. Les conditions n'en ont pas : elles
     se comptent sur les doigts d'une main, et un index les coûterait plus
     qu'il ne les servirait.
  */
  odysseeTraitements: { key: string; value: Traitement; indexes: { debut: string } };
  odysseePrelevements: { key: string; value: Prelevement; indexes: { jour: string } };
  odysseeResultats: { key: string; value: Resultat; indexes: { prelevementId: string } };
  odysseeSymptomes: { key: string; value: Symptome; indexes: { jour: string } };
  /* Les actualités marquées lues (D-039). Pas scellé : voir « ActualiteLue ». */
  actualitesLues: { key: string; value: ActualiteLue; indexes: Record<string, never> };
  odysseeConditions: { key: string; value: ConditionDeclaree; indexes: Record<string, never> };
  odysseeRessentis: { key: string; value: Ressenti; indexes: { traitementId: string } };
  /*
     Les créneaux marqués (Santé, phase 4). **Aucun index**, et c'est le
     point : ce qu'il faudrait indexer — le traitement, le jour, l'heure —
     est précisément ce que le scellement cache, et un index se lit en clair.
     On ouvre le magasin entier et on filtre ; il se compte en milliers sur
     une vie, soit une fraction de seconde (voir la mesure du plan, 3.7).
  */
  odysseeCreneaux: { key: string; value: MarqueDeCreneau; indexes: Record<string, never> };
  /*
     Le compteur de visites par écran (prompt 43, lot I).

     Aucun index, et la clé ne dit rien : elle est tirée au hasard, la route
     vit dans la charge scellée. Un index — ou une clé parlante — aurait
     rendu lisible, sans ouvrir le coffre, la liste des écrans fréquentés.
  */
  visites: { key: string; value: Visite; indexes: Record<string, never> };
  odysseeCheckins: { key: string; value: Checkin; indexes: { jour: string } };
  odysseeHebdos: { key: string; value: CheckinHebdo; indexes: { semaine: string } };
  odysseeJournal: { key: string; value: Entree; indexes: { jour: string } };
  /*
     Finances, depuis la phase 1. Scellés tous les quatre : un solde et un
     intitulé de compte se lisent d'un coup d'œil, et les opérations racontent
     une vie entière, jour par jour.

     Les **occurrences** du budget n'ont pas de magasin, et c'est délibéré :
     elles se recalculent à l'identique depuis les lignes, donc deux appareils
     qui les enregistreraient fusionneraient un cache au lieu de recalculer un
     état. Voir l'en-tête de `odyssee/budget.ts`.
  */
  odysseeComptes: { key: string; value: Compte; indexes: Record<string, never> };
  odysseeValorisations: { key: string; value: Valorisation; indexes: { compteId: string } };
  odysseeOperations: { key: string; value: OperationBancaire; indexes: { jour: string; compteId: string } };
  odysseeLignesBudget: { key: string; value: LigneBudget; indexes: Record<string, never> };
  /*
     La veille du rythme de vie, depuis la phase 1.

     `odysseeUsage` est le seul magasin de donnée personnelle **non scellé** de
     tout Odyssée, et la raison est écrite dans `SENSIBLES_EN_CLAIR` : scellé,
     il n'enregistrerait que les sessions où le coffre est ouvert, c'est-à-dire
     un échantillon biaisé par ce qu'on cherche à mesurer. Ce qui en est
     dérivé, lui, est scellé.
  */
  odysseeUsage: { key: string; value: Session; indexes: { jour: string } };
  /**
   * Les lignes de base de la veille — **déclaré, scellé, et jamais écrit**.
   *
   * Ce n'est ni un oubli ni un reste : c'est une conception qui a trouvé plus
   * simple en cours de route, et le magasin reste pour une raison précise.
   *
   * Le magasin existait pour **figer** une ligne de base pendant qu'un signal
   * est actif : sans figement, la dégradation en cours se fondrait dans la
   * base à laquelle on la compare, et le signal s'éteindrait tout seul. La
   * phase 3 a obtenu le même figement **autrement** : `ligneDeBase()` prend
   * `arreteeAu` en paramètre, et on la recalcule avec la date d'avant le
   * signal. Une base recalculée à la demande, de façon déterministe, à partir
   * de mesures qui ne bougent pas, est strictement équivalente à une base
   * rangée — et elle ne peut pas se désynchroniser de ses mesures, ce qu'une
   * base rangée ferait au premier rejeu.
   *
   * **Pourquoi ne pas le retirer, alors.** Supprimer un magasin d'IndexedDB
   * est une migration de schéma, qui doit réussir du premier coup sur la
   * seule installation qui compte, pour un gain nul — le magasin est vide.
   * Il reste donc déclaré, scellé (`coffre.ts`) et couvert par la rétention
   * (`sauvegarde/groupes.ts`) : si la veille se remettait un jour à persister
   * ses bases, elles seraient protégées dès la première écriture plutôt
   * qu'après qu'on y ait repensé.
   *
   * Ce qu'il ne faut pas en conclure : que l'application garde des lignes de
   * base. Elle n'en garde aucune. C'est précisément ce que ce commentaire
   * existe pour dire, et ce que son absence laissait croire.
   */
  odysseeVeilleBases: { key: string; value: LigneDeBase; indexes: Record<string, never> };
  /*
     Le cycle de vie des repères, depuis la phase 3. Scellés : un repère dit
     que telle personne s'écarte de son habitude sur le sommeil et
     l'engagement, ce qui est une information sur elle et sur rien d'autre.

     Les réglages le sont aussi, et pour une raison moins évidente : savoir
     que quelqu'un a *activé* une veille du rythme de vie est déjà une
     information sur lui.
  */
  odysseeVeilleSignaux: { key: string; value: SignalEnregistre; indexes: { jour: string } };
  odysseeVeilleReglages: { key: string; value: ReglagesVeille & { id: string } };
  /*
     Les passations d'échelles, depuis la phase « échelles ». Scellées : un
     score de PHQ-9 daté est l'une des données les plus sensibles que cette
     application puisse contenir.
  */
  odysseePassations: { key: string; value: Passation; indexes: { jour: string; echelle: string } };
  /*
     Les rapprochements, depuis la phase 3 de Finances. L'index porte sur
     l'opération parce que c'est la seule lecture chaude : « cette opération
     est-elle déjà rangée ? », posée une fois par ligne de relevé importée.

     L'index ne porte **pas** sur l'occurrence, et c'est délibéré : les
     identifiants d'occurrence sont dérivés et se recalculent, indexer une
     clé qui peut changer de forme à la prochaine version du moteur de
     périodicité fabriquerait un index silencieusement faux.
  */
  odysseeRapprochements: { key: string; value: Rapprochement; indexes: { operationId: string } };
  /*
     Qui lit le budget, depuis la phase 4 de Finances. Un seul enregistrement,
     de clé fixe : ce n'est pas une suite d'événements mais un **état**, et
     sept interrupteurs se remplacent en bloc.
  */
  odysseeConsommateurs: { key: string; value: EtatDesConsommateurs };
  /*
     Le pointage par vendeur, depuis la phase 3 bis de Finances.

     Quatre magasins, et un seul index : celui du pointage sur son
     opération, qui est la seule lecture chaude — « cette opération est-elle
     déjà classée ? », posée une fois par ligne importée. Les vendeurs et
     les règles se lisent en entier, parce qu'il y en a des dizaines et non
     des milliers, et qu'un index sur un magasin de cette taille coûte plus
     qu'il ne rend.
  */
  odysseeVendeurs: { key: string; value: Vendeur };
  odysseeReglesPointage: { key: string; value: RegleDePointage };
  odysseePointages: { key: string; value: Pointage; indexes: { operationId: string } };
  odysseeTaxonomie: { key: string; value: EtatDeLaTaxonomie };
}

const NOM_BASE = 'revinsp';
/*
   42, ET NON 36 — ET LE SAUT EST VOULU.

   Les numéros sont attribués par branche, et le train d'intégration les tient
   tous : **36 au constructeur**, **37 à 40 à l'agent B**, **41 à l'agent C**,
   **42 à l'agent A**. Deux migrations portant le même numéro ne se verraient
   ni en revue ni à l'exécution — une base déjà montée par l'un
   des chemins ne rejouerait jamais l'autre bloc, et le magasin manquant ne se
   signalerait qu'au premier « getAll », loin de sa cause.

   Elles coexistent à la fusion sans se gêner : chaque bloc est gardé par
   son propre « vers(n) », qui compare l'ancienne version à la sienne. Une
   base arrêtée à 35 rejouera dans l'ordre tous les blocs attribués ; une base
   déjà montée à 41 ne rejouera que la 42. La seule chose qui doit être vraie
   est que la constante VERSION vaille le PLUS GRAND des numéros attribués —
   c'est 42, et cela reste vrai à mesure que les blocs 36 à 40 entrent dans
   le train.
*/
const VERSION = 43;

let promesse: Promise<IDBPDatabase<SchemaRevinsp>> | null = null;

/**
 * Ce que la dernière ouverture a fait d'une migration, s'il y en avait une.
 *
 * Lu par l'écran de stockage pour proposer le retour arrière. Il n'est pas
 * affiché de force : une migration réussie ne doit pas interrompre, et une
 * migration dont l'instantané a échoué doit être **dite** sans empêcher de
 * travailler.
 */
export let derniereMigration: (ResultatInstantane & { echec?: string }) | null = null;

/**
 * Ouvre la base, après avoir pris un instantané si une migration attend.
 *
 * L'instantané est pris **avant** l'ouverture et non dans la transaction de
 * migration : on ne peut pas écrire dans une autre base depuis une transaction
 * « versionchange » sans la faire valider d'office. C'est aussi pourquoi
 * « instantanerSiMigration » interroge la version sans ouvrir la base à l'aveugle
 * — ouvrir sans version créerait une base vide en version 1 et ferait sauter le
 * premier bloc de migration.
 */
async function ouvrir(): Promise<IDBPDatabase<SchemaRevinsp>> {
  derniereMigration = await instantanerSiMigration(NOM_BASE, VERSION);
  const base = await ouvrirAuSchema(NOM_BASE, VERSION);
  /* A8 : retenue pour pouvoir la fermer si un autre onglet veut migrer. */
  baseOuverte = base;
  return base;
}

export function db() {
  promesse ??= ouvrir();
  return promesse;
}

/**
 * L'ouverture proprement dite, à une version donnée.
 *
 * Paramétrée par la version pour que le retour arrière puisse recréer les
 * magasins d'une version antérieure : les blocs ci-dessous sont écrits pour
 * s'appliquer à une base neuve, donc ouvrir à la version 11 produit exactement
 * le schéma de la version 11. Aucune description d'ancien schéma n'est
 * conservée ailleurs, et c'est voulu — elle divergerait.
 */
function ouvrirAuSchema(nom: string, version: number) {
  return openDB<SchemaRevinsp>(nom, version, {
    /*
       « ancienneVersion » vaut 0 pour une base neuve. Chaque bloc est donc
       écrit pour s'appliquer aussi bien à une création qu'à une mise à niveau,
       sans jamais toucher aux données déjà enregistrées.

       Chaque bloc est gardé par « vers(n) », qui vérifie **les deux bornes**.
       La version précédente ne regardait que la borne basse : ouvrir une base
       neuve à la version 11 — ce que fait le retour arrière — exécutait alors
       le bloc 12, puisque 0 < 12. Le schéma produit n'était pas celui de la
       version demandée, et la migration suivante échouait en voulant créer un
       magasin déjà là. Le symptôme tombait très loin de la cause, et la
       propriété sur laquelle repose le retour arrière — « ouvrir à la version N
       produit exactement le schéma de la version N » — était simplement
       fausse.

       ════════════════════════════════════════════════════════════════════
       LA RÈGLE DES NUMÉROS, validée par le pilote le 26 octobre.

           Un palier ne se réserve que STRICTEMENT AU-DESSUS de la
           « VERSION » de main au moment de la fusion.

       Réserver un numéro dans un TROU situé sous la version en vigueur donne
       un palier que personne d'ancien ne rejouera jamais. « vers(n) » exige
       « ancienneVersion < n » : une base déjà montée à 42 ne redescend pas
       chercher un bloc 39. Et une base déjà à la version courante qu'on
       rouvre à la même version ne déclenche AUCUNE migration. Mesuré :

           base neuve ouverte à 42      migration OUI, ancienne version 0
           MÊME base rouverte à 42      migration NON
           la même base ouverte à 43    migration OUI, ancienne version 42

       Le magasin existerait donc chez qui installe le site aujourd'hui, et
       jamais chez qui l'a déjà ouvert. Sans un mot, et sans un essai rouge :
       un essai part d'un profil NEUF, qui va de zéro à la version courante
       et rejoue tous les paliers, y compris ceux qui dorment. La seule base
       qui révèle le défaut est une base ancienne, et aucun essai n'en a.

       EN PRATIQUE. Un agent écrit dans sa branche le numéro provisoire qui
       lui a été attribué ; le constructeur le DÉPLACE à la fusion, au-dessus
       de la « VERSION » de main, et monte « VERSION » d'autant. C'est ce qui
       a été fait pour la 34, la 35, puis pour la 39 devenue 43.

       « npm run essais:migrations » tient cette règle, au socle, pour qu'elle
       ne repose pas sur la mémoire : il compare les paliers de l'arbre
       courant à ceux d'« origin/main », exige que tout palier neuf soit
       au-dessus de la version publiée, et que « VERSION » soit égale au plus
       haut palier.
       ════════════════════════════════════════════════════════════════════
    */
    async upgrade(base, ancienneVersion, nouvelle, transaction) {
      const vers = (n: number) => ancienneVersion < n && (nouvelle ?? VERSION) >= n;
      if (vers(1)) {
        base.createObjectStore('etat');
        const cartes = base.createObjectStore('cartes', { keyPath: 'id' });
        cartes.createIndex('du', 'du');
        cartes.createIndex('matiere', 'matiere');
        base.createObjectStore('fiches', { keyPath: 'id' });
        const quiz = base.createObjectStore('quiz', { keyPath: 'id', autoIncrement: true });
        quiz.createIndex('le', 'le');
        base.createObjectStore('jours', { keyPath: 'jour' });
      }
      if (vers(2)) {
        // Sessions d'entraînement cognitif (Quad N-Back).
        const nback = base.createObjectStore('nback', { keyPath: 'id', autoIncrement: true });
        nback.createIndex('le', 'le');
      }
      if (vers(3)) {
        // Séances de révision planifiées.
        const seances = base.createObjectStore('seances', { keyPath: 'id', autoIncrement: true });
        seances.createIndex('jour', 'jour');
        seances.createIndex('theme', 'theme');
      }
      if (vers(4)) {
        // Banque « QCM - DGFiP » : historique par question et par session.
        const dgfip = base.createObjectStore('qcmDgfip', { keyPath: 'id' });
        dgfip.createIndex('rubriqueId', 'rubriqueId');
        const sessions = base.createObjectStore('qcmSessions', { keyPath: 'id', autoIncrement: true });
        sessions.createIndex('le', 'le');
      }
      if (vers(5)) {
        // Sessions de Relational Reasoning, qui remplace Syllogismes.
        const relationnel = base.createObjectStore('relationnel', {
          keyPath: 'id',
          autoIncrement: true,
        });
        relationnel.createIndex('le', 'le');
      }
      if (vers(6)) {
        // Veridical Mapping : un seuil par arête du hub, et le journal des
        // sessions.
        const seuils = base.createObjectStore('vmSeuils', { keyPath: 'id' });
        seuils.createIndex('famille', 'famille');
        const sessions = base.createObjectStore('vmSessions', {
          keyPath: 'id',
          autoIncrement: true,
        });
        sessions.createIndex('le', 'le');
      }
      if (vers(8)) {
        // Journal d'erreurs : une file de révision séparée, indexée par matière
        // parce que c'est par matière que les séances viennent y puiser.
        const journal = base.createObjectStore('journal', { keyPath: 'id' });
        journal.createIndex('matiere', 'matiere');
      }
      if (vers(9)) {
        // Estimation de niveau : la note de la personne par sujet d'un côté,
        // la difficulté des items de l'autre. Les deux bougent ensemble.
        const competences = base.createObjectStore('competences', { keyPath: 'clef' });
        competences.createIndex('matiere', 'matiere');
        base.createObjectStore('difficultes', { keyPath: 'id' });
      }
      if (vers(10)) {
        // Demandes d'aide à un assistant. Indexées par item pour que le journal
        // puisse dire « sur celle-là, tu avais déjà demandé » sans parcourir
        // tout l'historique.
        const aides = base.createObjectStore('aides', { keyPath: 'id', autoIncrement: true });
        aides.createIndex('le', 'le');
        aides.createIndex('itemId', 'itemId');
      }
      if (vers(11)) {
        /*
         * Les notes de séance quittent l'enregistrement de séance.
         *
         * Le déplacement se fait ici, dans la transaction de migration, et non
         * à la première lecture : une migration paresseuse aurait laissé deux
         * formes coexister indéfiniment, et c'est le genre de dette qu'on
         * découvre en lisant un champ absent trois mois plus tard.
         *
         * Rien n'est perdu et rien n'est inventé : une séance sans note ne
         * crée pas de ligne dans `notes`, et une séance dont la note est vide
         * n'en crée pas davantage.
         */
        base.createObjectStore('notes', { keyPath: 'seanceId' });

        const seances = transaction.objectStore('seances');
        const notes = transaction.objectStore('notes');
        let curseur = await seances.openCursor();
        const maintenant = new Date().toISOString();
        while (curseur) {
          const ancienne = curseur.value as Seance & {
            note?: string;
            restitutions?: Record<string, string>;
          };
          const { note, restitutions, ...sansTexte } = ancienne;
          const aQuelqueChose =
            Boolean(note?.trim()) ||
            Object.values(restitutions ?? {}).some((r) => r.trim());
          if (aQuelqueChose && typeof ancienne.id === 'number') {
            await notes.put({
              seanceId: ancienne.id,
              note: note ?? '',
              restitutions: restitutions ?? {},
              majLe: maintenant,
            });
          }
          await curseur.update(sansTexte as Seance);
          curseur = await curseur.continue();
        }
      }
      if (vers(12)) {
        /*
         * Le journal d'opérations et le journal de révisions.
         *
         * Migration **additive** : aucune donnée existante n'est réécrite. Les
         * cartes gardent leur état, et reçoivent en plus une entrée de socle
         * qui porte cet état — c'est ce qui rend recalculable tout ce qui
         * viendra après, sans inventer ce qui n'a jamais été écrit avant. Voir
         * « noyau/revisions.ts » pour pourquoi un socle plutôt qu'un journal
         * reconstitué.
         */
        const revisions = base.createObjectStore('revisions', { keyPath: 'id' });
        revisions.createIndex('carteId', 'carteId');
        revisions.createIndex('le', 'le');

        const operations = base.createObjectStore('operations', { keyPath: 'id' });
        // L'horloge encodée se trie comme elle se compare : l'index permet de
        // lire un intervalle d'horloge sans désérialiser une seule opération.
        operations.createIndex('hlc', 'hlc');
        operations.createIndex('cible', 'cible');
        operations.createIndex('lot', 'lot');

        /*
         * L'identifiant de cet appareil, tiré une fois et conservé. Il départage
         * deux horloges égales, donc il doit être stable : le régénérer à chaque
         * ouverture ferait de chaque session un appareil distinct, et l'ordre de
         * fusion cesserait d'être reproductible.
         */
        const etat = transaction.objectStore('etat');
        const connu = (await etat.get('appareil')) as string | undefined;
        const appareil = connu ?? idAppareilNeuf();
        if (!connu) await etat.put(appareil, 'appareil');

        /*
         * Une seule fabrique d'ULID pour tous les socles : elle garantit qu'ils
         * sont ordonnés entre eux et, l'horloge n'étant pas figée, antérieurs à
         * toute notation ultérieure.
         */
        const prochainId = fabriqueUlid();
        const cartes = transaction.objectStore('cartes');
        let carte = await cartes.openCursor();
        /*
           L'horloge logique d'un socle est **dérivée de sa propre date** et non
           tirée de l'horloge vivante. Deux raisons. La migration tourne dans une
           transaction « versionchange », où attendre une écriture dans un autre
           magasin la ferait valider d'office. Et surtout : un socle décrit un
           état constitué au fil des mois ; lui donner l'instant de la migration
           le placerait après des révisions qui l'ont précédé.
        */
        let compteurSocle = 0;
        while (carte) {
          const date = Date.parse(
            carte.value.derniereRevision ?? carte.value.fsrs.last_review ?? carte.value.fsrs.due,
          );
          const ms = Number.isFinite(date) ? date : Date.now();
          const hlc = `${String(ms).padStart(15, '0')}-${(compteurSocle % (36 ** 4))
            .toString(36)
            .toUpperCase()
            .padStart(4, '0')}`;
          compteurSocle += 1;
          await revisions.put(socleDe(carte.value, prochainId(), appareil, hlc));
          carte = await carte.continue();
        }
      }
      if (vers(13)) {
        /*
         * Les clés auto-incrémentées deviennent des identifiants stables.
         *
         * C'est la migration **destructrice** de la phase 1 : elle réécrit sept
         * magasins et les clés d'un huitième. Elle est précédée d'un instantané
         * automatique et réversible — voir « noyau/instantane.ts ».
         *
         * ## Pourquoi il faut en passer par là
         *
         * Une clé auto-incrémentée est un compteur local. Deux appareils
         * produisent tous deux un « id: 1 » pour deux séances différentes : à la
         * première fusion, l'une écrase l'autre. Ce n'est pas un risque de
         * collision, c'est une certitude. Et aucune horloge logique ne répare
         * cela, puisque le conflit porte sur l'identité même des objets.
         *
         * ## L'ordre est conservé, et c'est délibéré
         *
         * Les enregistrements sont triés par leur date **avant** de recevoir
         * leur identifiant, et la fabrique d'ULID reçoit cette date pour
         * horloge. L'ULID porte donc l'instant réel de l'événement : l'ordre
         * lexicographique des nouvelles clés est l'ordre chronologique des
         * faits, exactement comme pour les opérations à venir. Tirer des
         * identifiants au hasard aurait marché aussi, et aurait perdu cette
         * propriété pour toujours.
         *
         * ## Le vrai danger : « notes »
         *
         * Le texte des séances est la seule donnée irremplaçable du site. Son
         * magasin est indexé par identifiant de séance, **et** ses valeurs
         * contiennent un dictionnaire de restitutions lui-même indexé par
         * identifiant de séance. Les deux niveaux sont remappés. Une note dont
         * la séance a disparu n'est pas supprimée : elle reçoit un identifiant
         * neuf et reste orpheline, ce que le contrôle d'intégrité continue de
         * signaler. Perdre du texte pour faire propre serait le pire des
         * échanges.
         */
        const A_MIGRER = [
          { nom: 'quiz', index: [['le', 'le']] },
          { nom: 'nback', index: [['le', 'le']] },
          { nom: 'seances', index: [['jour', 'jour'], ['theme', 'theme']] },
          { nom: 'qcmSessions', index: [['le', 'le']] },
          { nom: 'relationnel', index: [['le', 'le']] },
          { nom: 'vmSessions', index: [['le', 'le']] },
          { nom: 'aides', index: [['le', 'le'], ['itemId', 'itemId']] },
        ] as const;

        /** L'instant d'un enregistrement, pour l'ordre et pour l'ULID. */
        const instantDe = (e: Record<string, unknown>): number => {
          const brut =
            (typeof e.le === 'string' && e.le) ||
            (typeof e.termineeLe === 'string' && e.termineeLe) ||
            // Une séance non terminée n'a que son jour : midi, faute de mieux,
            // et non minuit — minuit ferait basculer la séance d'un jour à
            // l'autre selon le fuseau de lecture.
            (typeof e.jour === 'string' && `${e.jour}T12:00:00.000Z`) ||
            '';
          const instant = Date.parse(brut);
          // Une date illisible ne doit pas faire échouer la migration entière :
          // l'enregistrement prend l'instant de la migration, perd son rang
          // chronologique, et garde tout son contenu.
          return Number.isFinite(instant) ? instant : Date.now();
        };

        /** Les séances, pour remapper « notes » ensuite. */
        const nouvellesSeances = new Map<string, string>();

        /*
           La boucle traite sept magasins de formes différentes, dont elle n'a
           besoin de connaître ni les champs ni les index. Le typage précis
           d'« idb » n'apporte rien ici — il n'y a aucun champ nommé dans ce
           code — et il empêche d'écrire la boucle, puisque le nom de magasin
           est une union. D'où cette vue permissive, bornée à ce bloc et
           nommée, plutôt que des « as » dispersés sur chaque ligne.
        */
        type MagasinLibre = {
          getAll(): Promise<Record<string, unknown>[]>;
          getAllKeys(): Promise<(number | string)[]>;
          put(valeur: Record<string, unknown>): Promise<unknown>;
          createIndex(nom: string, champ: string): unknown;
        };
        const libre = (valeur: unknown) => valeur as unknown as MagasinLibre;

        for (const { nom, index } of A_MIGRER) {
          const ancien = libre(transaction.objectStore(nom));
          const enregistrements = await ancien.getAll();
          const clefs = await ancien.getAllKeys();
          const couples = enregistrements.map((valeur, i) => ({
            valeur,
            ancienneClef: clefs[i],
            instant: instantDe(valeur),
          }));
          // Tri croissant : la fabrique d'ULID n'avance alors jamais à
          // reculons, ce qui lui permet de rester monotone sans artifice.
          couples.sort(
            (a, b) =>
              a.instant - b.instant ||
              String(a.ancienneClef).localeCompare(String(b.ancienneClef), 'en', {
                numeric: true,
              }),
          );

          base.deleteObjectStore(nom);
          const neuf = libre(base.createObjectStore(nom, { keyPath: 'id' }));
          for (const [nomIndex, champ] of index) neuf.createIndex(nomIndex, champ);

          let horloge = 0;
          const prochain = fabriqueUlid(() => horloge);
          for (const { valeur, ancienneClef, instant } of couples) {
            horloge = instant;
            const identifiant = prochain();
            if (nom === 'seances') nouvellesSeances.set(String(ancienneClef), identifiant);
            await neuf.put({ ...valeur, id: identifiant });
          }
        }

        /* Les notes : la clé du magasin et les clés internes des restitutions. */
        const notes = (await libre(transaction.objectStore('notes')).getAll()) as unknown as (
          NoteSeance & { seanceId: unknown }
        )[];
        base.deleteObjectStore('notes');
        const neufNotes = libre(base.createObjectStore('notes', { keyPath: 'seanceId' }));
        const orphelines = fabriqueUlid();
        for (const note of notes) {
          const ancienne = String(note.seanceId);
          const restitutions: Record<string, string> = {};
          for (const [clef, texte] of Object.entries(note.restitutions ?? {})) {
            // Une restitution qui renvoie à une séance disparue garde sa clé
            // d'origine : l'écran ne la retrouvera pas, mais le texte est là et
            // un export le rend.
            restitutions[nouvellesSeances.get(clef) ?? clef] = texte;
          }
          await neufNotes.put({
            ...note,
            seanceId: nouvellesSeances.get(ancienne) ?? orphelines(),
            restitutions,
          } as unknown as Record<string, unknown>);
        }
      }
      if (vers(14)) {
        /*
         * Le journal de révisions devient journalisable.
         *
         * Il a été créé à la version 12, avant que celui des opérations
         * n'existe, et il portait donc sa propre forme : un identifiant, une
         * date ISO, un appareil — mais ni horloge logique, ni lot. Deux journaux
         * de formes différentes auraient voulu dire deux règles de fusion, deux
         * empreintes et deux politiques de rétention ; cette migration les
         * ramène à une seule.
         *
         * L'horloge est **dérivée de la date de chaque entrée**, et non tirée de
         * l'horloge vivante. Une entrée de l'an dernier doit porter l'instant
         * logique de l'an dernier, sans quoi elle se rangerait après des
         * révisions qu'elle a précédées, et le recalcul FSRS en sortirait faux.
         */
        const revisions = transaction.objectStore('revisions');
        let curseur = await revisions.openCursor();
        let rang = 0;
        while (curseur) {
          const entree = curseur.value as EntreeRevision & {
            hlc?: string;
            lot?: string;
          };
          if (!entree.hlc) {
            const date = Date.parse(entree.le);
            const ms = Number.isFinite(date) ? date : Date.now();
            // Le compteur départage deux entrées de même milliseconde, ce qui
            // arrive dans une rafale de révisions.
            const compteur = (rang % 36 ** 4).toString(36).toUpperCase().padStart(4, '0');
            await curseur.update({
              ...entree,
              hlc: `${String(ms).padStart(15, '0')}-${compteur}`,
              lot: entree.lot ?? '',
            });
          }
          rang += 1;
          curseur = await curseur.continue();
        }
      }
      if (vers(15)) {
        /*
         * Les magasins d'Odyssée.
         *
         * Migration **purement additive** : cinq magasins vides apparaissent,
         * et pas une ligne existante n'est lue. C'est ce qui permet de l'écrire
         * sans instantané de sécurité particulier — il n'y a rien à perdre.
         *
         * ## Pourquoi des index, et lesquels
         *
         * Un index ne se rajoute qu'en montant encore la version : autant poser
         * tout de suite ceux dont les écrans auront besoin. `echeance` et
         * `faiteLe` servent à l'arriéré et au compte des clôtures ; `debut` au
         * calendrier et au focus, qui lisent tous deux un intervalle de temps ;
         * `jour` aux revues. Les quêtes n'en ont pas : elles se comptent en
         * dizaines, jamais en milliers, et un index sur un magasin qui tient
         * en mémoire coûte plus qu'il ne rend.
         *
         * Les quêtes portent leurs jours tenus dans un tableau plutôt que dans
         * un magasin de « tenues » : voir « odyssee/modele.ts ». Un index
         * multiEntry sur ce tableau aurait permis de chercher « qui a été tenu
         * le 3 mars », mais aucun écran ne pose cette question — ils demandent
         * tous l'inverse, « cette quête, quels jours ? », à quoi l'objet
         * répond seul.
         */
        const taches = base.createObjectStore('odysseeTaches', { keyPath: 'id' });
        taches.createIndex('echeance', 'echeance');
        taches.createIndex('faiteLe', 'faiteLe');

        base.createObjectStore('odysseeQuetes', { keyPath: 'id' });

        const evenements = base.createObjectStore('odysseeEvenements', { keyPath: 'id' });
        evenements.createIndex('debut', 'debut');

        const focus = base.createObjectStore('odysseeFocus', { keyPath: 'id' });
        focus.createIndex('debut', 'debut');

        const revues = base.createObjectStore('odysseeRevues', { keyPath: 'id' });
        revues.createIndex('jour', 'jour');
      }
      if (vers(16)) {
        /*
         * Les magasins de Sport. Additive, comme la v15.
         *
         * `sportSeances` porte un index sur `statut` et non seulement sur le
         * jour : la reprise d'une séance interrompue cherche « y a-t-il une
         * séance en cours ? », et c'est la toute première question que pose
         * l'écran au chargement. Sans index, elle lirait l'historique entier à
         * chaque ouverture, pour trouver au plus une ligne.
         *
         * Les séries vivent **dans** leur séance et non dans un magasin à
         * elles. Une série isolée n'a pas de sens, on ne la lit jamais sans sa
         * séance, et la sauvegarde à chaque série écrit alors un seul
         * enregistrement — ce qui est exactement ce qu'il faut pour qu'une
         * reprise soit sûre.
         */
        base.createObjectStore('sportExercices', { keyPath: 'id' });

        const seances = base.createObjectStore('sportSeances', { keyPath: 'id' });
        seances.createIndex('jour', 'jour');
        seances.createIndex('statut', 'statut');

        base.createObjectStore('sportPhases', { keyPath: 'id' }).createIndex('debut', 'debut');
        base.createObjectStore('sportBlessures', { keyPath: 'id' }).createIndex('debut', 'debut');
      }
      if (vers(17)) {
        /*
         * Les programmes, arrivés une version après le reste de Sport.
         *
         * Sans index : on les lit tous, toujours. Il y en a une poignée, et un
         * index sur `actif` coûterait son écriture à chaque enregistrement pour
         * épargner le parcours de cinq lignes.
         *
         * Les séances types vivent **dans** leur programme, comme les séries
         * dans leur séance : on ne lit jamais une séance type sans le programme
         * qui lui donne son rang et sa cadence.
         */
        base.createObjectStore('sportProgrammes', { keyPath: 'id' });
      }
      if (vers(18)) {
        /*
         * Le domaine Corps d'Odyssée. Additive, comme les trois précédentes.
         *
         * Six magasins et non un seul « corps » fourre-tout : chacun porte une
         * forme différente, et les mélanger obligerait chaque lecture à filtrer
         * sur un champ `sorte` — c'est-à-dire à parcourir cinq fois trop de
         * lignes pour tracer une courbe de poids.
         *
         * Index sur `jour` partout, parce que **toutes** les lectures sont par
         * jour ou par fenêtre de jours : le résumé d'une journée, la moyenne
         * mobile sur sept jours, la détection de désaccords. `odysseeSante`
         * porte le sien sur `debut`, puisqu'un état de santé dure.
         *
         * Ni médicaments ni statut hormonal : la décision 3, sur le chiffrement
         * au repos, n'est pas tranchée, et on ne rattrape pas une donnée
         * sensible déjà écrite en clair dans un instantané de migration.
         */
        for (const nom of [
          'odysseePesees',
          'odysseeMesures',
          'odysseeNuits',
          'odysseeRepas',
          'odysseeBoissons',
        ] as const) {
          base.createObjectStore(nom, { keyPath: 'id' }).createIndex('jour', 'jour');
        }
        base.createObjectStore('odysseeSante', { keyPath: 'id' }).createIndex('debut', 'debut');
      }
      if (vers(19)) {
        /*
         * Les trajectoires. Index sur `statut`, parce que la question posée
         * avant chaque écriture est « combien sont actives ? » — le plafond de
         * trois est un refus d'écriture, pas un avertissement d'écran, et il
         * se vérifie à chaque fois.
         */
        base.createObjectStore('odysseeTrajectoires', { keyPath: 'id' }).createIndex(
          'statut',
          'statut',
        );
      }
      if (vers(20)) {
        /*
         * Médicaments et statut hormonal, retenus depuis la phase 6 par la
         * décision 3 — prise le 12 octobre 2026. Ils arrivent **chiffrés dès
         * leur création** : c'est tout l'intérêt d'avoir attendu. Une migration
         * qui aurait eu à chiffrer après coup aurait laissé la version en clair
         * dans les instantanés de migration, et on ne rattrape pas cela.
         *
         * Les index portent sur des champs laissés en clair à dessein (`jour`,
         * `debut`), et c'est la fuite que la décision 3 nomme : qu'on ait écrit
         * quelque chose ce jour-là se voit ; ce qu'on a écrit, non.
         */
        base.createObjectStore('odysseeMedicaments', { keyPath: 'id' }).createIndex('jour', 'jour');
        base.createObjectStore('odysseeHormonal', { keyPath: 'id' }).createIndex('debut', 'debut');
      }
      if (vers(21)) {
        /*
         * Psyché. Scellés dès leur création, comme les deux précédents — la
         * décision 3 les nomme explicitement, et c'est le domaine où une fuite
         * coûte le plus cher.
         *
         * Le check-in est indexé par jour, le point de semaine par semaine :
         * les deux lectures sont « celui d'aujourd'hui » et « celui de cette
         * semaine », et elles doivent rester immédiates même scellées.
         */
        base.createObjectStore('odysseeCheckins', { keyPath: 'id' }).createIndex('jour', 'jour');
        base.createObjectStore('odysseeHebdos', { keyPath: 'id' }).createIndex('semaine', 'semaine');
        base.createObjectStore('odysseeJournal', { keyPath: 'id' }).createIndex('jour', 'jour');
      }
      if (vers(22)) {
        /*
         * Finances, phase 1. Quatre magasins, tous scellés.
         *
         * Les index sont ceux des lectures réelles et d'elles seules : les
         * opérations d'un jour, celles d'un compte, les valorisations d'un
         * compte. Tout autre champ est chiffré, donc inindexable — et c'est
         * la contrainte qui a décidé de la forme, pas l'inverse.
         */
        base.createObjectStore('odysseeComptes', { keyPath: 'id' });
        base
          .createObjectStore('odysseeValorisations', { keyPath: 'id' })
          .createIndex('compteId', 'compteId');
        const operations = base.createObjectStore('odysseeOperations', { keyPath: 'id' });
        operations.createIndex('jour', 'jour');
        operations.createIndex('compteId', 'compteId');
        base.createObjectStore('odysseeLignesBudget', { keyPath: 'id' });
      }
      if (vers(23)) {
        /*
         * La veille du rythme de vie, phase 1.
         *
         * Le journal d'usage est indexé par jour logique, parce que la seule
         * lecture qu'on en fait est « les sessions de ce jour-là ». Il ne
         * porte aucun autre champ, et `controlerSession()` le vérifie.
         *
         * Les lignes de base sont scellées et sans index : on les lit par
         * identifiant d'indicateur, jamais par valeur — et leur valeur est
         * chiffrée, donc inindexable de toute façon.
         */
        base.createObjectStore('odysseeUsage', { keyPath: 'id' }).createIndex('jour', 'jour');
        base.createObjectStore('odysseeVeilleBases', { keyPath: 'id' });
      }
      if (vers(24)) {
        /*
         * La veille, phase 3 : le journal des repères et les réglages.
         *
         * Les deux sont scellés. L'index sur le jour sert la seule lecture
         * réelle — « les repères de cette période » pour le journal — et il
         * porte sur un champ laissé en clair à dessein : qu'un repère ait été
         * levé tel jour se voit, ce qu'il disait non.
         */
        base
          .createObjectStore('odysseeVeilleSignaux', { keyPath: 'id' })
          .createIndex('jour', 'jour');
        base.createObjectStore('odysseeVeilleReglages', { keyPath: 'id' });
      }
      if (vers(25)) {
        /*
         * Les échelles WHO-5, PHQ-9 et GAD-7.
         *
         * Un seul magasin pour les trois : une passation porte l'identifiant
         * de son échelle. Les deux index servent les deux lectures réelles —
         * l'historique d'une échelle, et ce qui a été rempli un jour donné.
         * Le reste, réponses comprises, est chiffré.
         */
        const passations = base.createObjectStore('odysseePassations', { keyPath: 'id' });
        passations.createIndex('jour', 'jour');
        passations.createIndex('echelle', 'echelle');
      }
      if (vers(26)) {
        /*
         * Les rapprochements — Finances, phase 3.
         *
         * Scellé : un rapprochement dit « cette opération de 112,40 € est
         * mon électricité », ce qui est à la fois un montant et un fait de
         * vie. L'identifiant et l'horodatage restent en clair, comme partout
         * ailleurs, pour que la fusion puisse travailler sans la clé.
         */
        base
          .createObjectStore('odysseeRapprochements', { keyPath: 'id' })
          .createIndex('operationId', 'operationId');
      }
      if (vers(27)) {
        /*
         * Qui lit mon budget — Finances, phase 4.
         *
         * Scellé comme le reste du domaine : savoir que quelqu'un a ouvert
         * son budget à « Demander à l'IA » est une information sur lui, de
         * la même nature que savoir qu'il a activé une veille.
         */
        base.createObjectStore('odysseeConsommateurs', { keyPath: 'id' });
      }
      if (vers(28)) {
        /*
         * Le pointage par type de vendeur — Finances, phase 3 bis.
         *
         * Scellés tous les quatre. Un type de vendeur peut révéler une
         * santé, une adhésion, un don : le prompt les classe comme données
         * sensibles, et la liste des vendeurs d'une personne en dit plus
         * long sur elle que la plupart de ce que cette base contient.
         */
        base.createObjectStore('odysseeVendeurs', { keyPath: 'id' });
        base.createObjectStore('odysseeReglesPointage', { keyPath: 'id' });
        base
          .createObjectStore('odysseePointages', { keyPath: 'id' })
          .createIndex('operationId', 'operationId');
        base.createObjectStore('odysseeTaxonomie', { keyPath: 'id' });
      }
      if (vers(29)) {
        /*
         * Santé, phase 1 — la **forme** du prompt 25, sous la ligne D-024.
         *
         * Cinq magasins neufs, scellés dès leur création. Aucune reprise de
         * données : `odysseeMedicaments` garde ses prises telles quelles, et
         * gagne seulement un champ facultatif `traitementId`. C'était le
         * choix à faire au point d'arrêt A2 — réécrire des prises déjà
         * saisies pour les rattacher à des traitements qui n'existent pas
         * encore aurait été une migration destructive sans contrepartie,
         * alors qu'un champ absent se lit « pas rattachée », ce qui est
         * exactement la vérité.
         *
         * Les valeurs, elles, n'arrivent pas avec la forme : le catalogue de
         * molécules est vide et le dit. Voir `odyssee/sante.ts`.
         */
        base.createObjectStore('odysseeTraitements', { keyPath: 'id' }).createIndex(
          'debut',
          'debut',
        );
        base.createObjectStore('odysseePrelevements', { keyPath: 'id' }).createIndex(
          'jour',
          'jour',
        );
        base.createObjectStore('odysseeResultats', { keyPath: 'id' }).createIndex(
          'prelevementId',
          'prelevementId',
        );
        base.createObjectStore('odysseeSymptomes', { keyPath: 'id' }).createIndex('jour', 'jour');
        base.createObjectStore('odysseeConditions', { keyPath: 'id' });
      }
      if (vers(30)) {
        /*
         * Le journal de ressentis (2.3 du prompt bibliothèque).
         *
         * Scellé, comme tout ce que Santé écrit. Ce qu'on ressent sous un
         * traitement est au moins aussi parlant que le traitement lui-même :
         * lu par un tiers, « moins net qu'au début » accolé à un nom de
         * molécule raconte une histoire complète.
         *
         * Les traitements déjà saisis n'ont pas de champ « sporadique » :
         * absent se lit « non », ce qui est exactement ce qu'ils sont. Aucune
         * réécriture, donc — une migration qui touche des lignes pour y poser
         * une valeur par défaut déjà lisible ne fait que risquer de les
         * abîmer.
         */
        base
          .createObjectStore('odysseeRessentis', { keyPath: 'id' })
          .createIndex('traitementId', 'traitementId');
      }
      if (vers(31)) {
        /*
         * Le marqueur « lu » des actualités (D-039).
         *
         * Un seul magasin, sans index : on le lit entier au chargement de
         * l'archive — quelques centaines de lignes au pire — et on y écrit
         * une ligne par clic. Un index sur la date coûterait plus qu'il ne
         * rapporterait.
         *
         * Aucune reprise de données : avant aujourd'hui, rien n'était marqué,
         * et un magasin vide se lit « rien n'est lu », ce qui est exactement
         * la vérité. Une migration qui aurait marqué « lu » l'historique
         * existant aurait inventé un passé.
         */
        base.createObjectStore('actualitesLues', { keyPath: 'id' });
      }
      if (vers(32)) {
        /*
         * Les tâches récurrentes, leurs étapes et le report coffre fermé
         * (prompt 38, phase 2).
         *
         * **Aucune reprise de données, et c'est une propriété, pas un oubli.**
         * Les quatre champs ajoutés à `Tache` — `serie`, `etapes`, `lien`,
         * `reporter` — sont facultatifs : une tâche écrite avant aujourd'hui
         * reste valide telle quelle, et `undefined` s'y lit « tâche simple ».
         * Réécrire chaque tâche pour y poser des valeurs vides aurait été une
         * migration destructive sans contrepartie.
         *
         * Les quatre magasins naissent vides. Un magasin vide se lit « aucune
         * exception », ce qui est exactement la vérité : avant ce lot, aucune
         * série n'existait, donc aucune occurrence ne s'en écartait.
         *
         * Les deux magasins en clair portent un index sur `tacheId` et un sur
         * `jourPrevu` : l'écran des tâches lit par tâche, le calendrier lit
         * par jour, et sans index chacun parcourrait toute la table.
         *
         * Les deux magasins scellés n'ont aucun index. Un index se lit en
         * clair — c'est tout son intérêt — et ici ce qu'il faudrait indexer
         * est justement ce qu'on cache.
         */
        const occurrences = base.createObjectStore('odysseeOccurrences', { keyPath: 'id' });
        occurrences.createIndex('tacheId', 'tacheId');
        occurrences.createIndex('jourPrevu', 'jourPrevu');

        const cochees = base.createObjectStore('odysseeEtapesCochees', { keyPath: 'id' });
        cochees.createIndex('tacheId', 'tacheId');
        cochees.createIndex('jourPrevu', 'jourPrevu');

        base.createObjectStore('odysseeExceptionsScellees', { keyPath: 'id' });
        base.createObjectStore('odysseeReports', { keyPath: 'id' });
      }
      /*
         v33 — le centre de notifications (prompt 32, phase 2).

         Aucun index : le magasin porte quelques centaines de lignes et se
         lit en entier. Un index sur `source` ou sur `creeLe` serait en
         clair, et le § 4.1 l'interdit — « ni domaine, ni source, ni date
         fine » dans les index.
      */
      if (vers(33)) {
        base.createObjectStore('centreElements', { keyPath: 'id' });
      }
      if (vers(34)) {
        /*
           Où l'on s'est arrêté dans une fiche audio (prompt 46, P3).

           La position vivait dans `localStorage`, sous
           « revinsp.podcast.position ». Elle y était seule : ni synchronisée,
           ni sauvegardée, donc perdue au changement d'appareil et absente
           d'une restauration. La voici dans la base, avec le reste de la
           progression.

           Le magasin naît vide, et la reprise de l'ancienne clé ne se fait
           PAS ici. Une transaction « versionchange » n'a pas le droit de
           lire `localStorage` de façon fiable — et surtout, migrer à
           l'ouverture de la base ferait porter à chaque démarrage le coût
           d'une reprise qui n'a lieu qu'une fois. Elle se fait donc à
           l'installation du lecteur, dans `podcast.ts`, qui lit la clé,
           écrit ce qu'elle contenait, puis la retire.
        */
        base.createObjectStore('podcastPositions', { keyPath: 'fiche' });
      }
      /*
         RÉSOLU À LA FUSION : LES DEUX MIGRATIONS COEXISTENT.

         Le conflit ne portait que sur la place, pas sur le fond : l'agent C
         crée `podcastPositions` en 34, l'agent B `odysseeCreneaux` en 35, et
         B avait vérifié l'attribution de la 34 dans la branche de C plutôt
         que de la supposer. Les deux blocs se suivent donc, et la version
         monte à 35 — une base arrêtée à 33 rejoue les deux, une base à 34
         ne rejoue que la seconde.
      */
      if (vers(35)) {
        /*
         * Les créneaux marqués — Santé, phase 4, P2.
         *
         * **La 34 est attribuée à l'agent C**, qui y crée `podcastPositions`
         * sur `claude/p46-55` — vérifié dans sa branche, pas supposé. Deux
         * migrations portant le même numéro ne se verraient pas en revue et
         * ne se verraient pas non plus à l'exécution : une base déjà montée
         * à 34 par l'un des deux chemins ne rejouerait jamais l'autre bloc,
         * et le magasin manquant ne se signalerait qu'au premier `getAll`,
         * loin de sa cause. D'où cette 35, arbitrée par le pilote.
         *
         * **Aucune reprise de données.** Avant ce lot, aucun traitement
         * n'avait de schéma prévu, donc aucun créneau n'existait, donc
         * aucune réponse ne pouvait avoir été donnée. Un magasin vide se lit
         * « rien n'est noté », ce qui est exactement la vérité — et c'est
         * aussi la condition qui fait partir le rappel d'oubli, de sorte
         * qu'une migration qui aurait inventé des marques aurait inventé des
         * silences.
         *
         * Pas d'index : voir le type. La clé est une empreinte, donc muette.
         */
        base.createObjectStore('odysseeCreneaux', { keyPath: 'id' });
      }
      /*
         RÉSOLU LE 19 OCTOBRE AU SOIR, PUIS REPRIS PAR LE TRAIN : SIX
         MIGRATIONS COEXISTENT.

         `main` apportait la 34 (`podcastPositions`, agent C) et la 35
         (`odysseeCreneaux`, agent B, prompt 52) ; cette branche apporte la 37
         et la 38 ; le train y ajoute la 41 et la 42, venues de l'agent A. Les
         six blocs se suivent dans l'ordre des numéros, et la version vaut le
         plus grand d'entre eux, 42 : une base arrêtée à 33 rejoue les six, une
         base à 41 ne rejoue que la dernière. Le conflit ne portait que sur la
         place, les trois fois.

         La 36 reste au constructeur et n'est pas encore sur `main`. Son
         absence ne gêne pas : les numéros doivent croître, ils n'ont pas à
         être contigus.

         37 — le suivi personnel. Le numéro est celui que le pilote a
         attribué ; 34 à 36 sont pris par d'autres branches en vol, et
         commencer en haut d'une plage la rendrait inutilisable puisque les
         numéros doivent croître.

         Deux magasins et non un : les réglages doivent pouvoir être lus pour
         décider ce qu'un écran propose, alors que le journal ne doit être
         ouvert que par l'écran du suivi. Les mélanger obligerait à ouvrir le
         journal pour savoir si le module est actif.
      */
      if (vers(37)) {
        base.createObjectStore('odysseeCycleJournal', { keyPath: 'id' });
        base.createObjectStore('odysseeCycleReglages', { keyPath: 'id' });
      }
      /*
         LE SEXE DÉCLARÉ, version 38.

         Un magasin à part et non un champ des réglages du suivi, pour une
         raison de dépendance : la réponse décide si le suivi est MONTRÉ, donc
         elle se lit avant lui et sans lui. La ranger dans les réglages du
         module obligerait à ouvrir le module pour savoir s'il faut l'ouvrir.

         Aucune reprise de données : rien n'était stocké avant, `sexe` valait
         `null` partout. La question se posera à qui ne l'a pas encore vue.
      */
      if (vers(38)) {
        base.createObjectStore('odysseeSexe', { keyPath: 'id' });
      }
      /*
         LES INTENTIONS D'ACTIONS ANNULABLES, version 43.

         **B l'avait écrite en 39, et c'est moi qui l'ai déplacée en 43**, à la
         fusion. Le numéro 39 lui était bien attribué — la convention de ce
         fichier réserve 37 à 40 à l'agent B, 37 et 38 étaient pris, et j'ai
         balayé les 57 branches distantes : personne d'autre ne revendiquait
         la 39. Le numéro était libre. Il était seulement INATTEIGNABLE.

         POURQUOI. « vers(n) » vaut « ancienneVersion < n et nouvelle >= n ».
         La version du schéma était déjà 42 : une base montée à 42 ne rejoue
         donc jamais un palier 39. Et une base déjà à 42 qu'on rouvre à 42 ne
         déclenche AUCUNE migration. Mesuré dans le navigateur, et non déduit :

           base neuve ouverte à 42      migration OUI, ancienne version 0
           MÊME base rouverte à 42      migration NON
           la même base ouverte à 43    migration OUI, ancienne version 42

         Le magasin aurait donc été créé chez qui installe le site aujourd'hui,
         et JAMAIS chez qui l'a déjà ouvert — Alexis le premier. La fonction
         aurait été absente sans un mot, et les essais seraient restés verts :
         ils partent d'un profil neuf, qui va de 0 à 42 et rejoue tout.

         C'est exactement le travail que la convention du palier 41 confie à
         l'intégrateur — « c'est au constructeur de les ordonner à la fusion,
         comme il l'a fait pour la 34 et la 35 ». La 39 et la 40 restent donc
         libres pour qui en aura besoin SOUS une version future ; ce lot-ci,
         lui, a besoin d'être au-dessus de 42.

         Rien d'autre n'est touché : ni le magasin, ni sa clé, ni le
         raisonnement de B ci-dessous, qui est le bon.

         POURQUOI UN MAGASIN, ET NON UNE CLÉ DE « etat ». Parce qu'il faut le
         SCELLER, et que `etat` ne l'est pas : une intention y écrirait en
         clair le genre de l'action, donc « une prise a été notée ». Et parce
         qu'il peut y en avoir plusieurs en même temps — deux écrans, deux
         actions retardées —, là où `etat` tient une valeur par clé.

         Aucune reprise de données, et rien à reprendre : avant ce lot, une
         action annulable quittée pendant son délai était simplement perdue.
         Un magasin vide se lit « aucune action en attente », ce qui est la
         vérité.
      */
      if (vers(43)) {
        base.createObjectStore('annulationsEnAttente', { keyPath: 'id' });
      }
      if (vers(41)) {
        /*
         * L'épreuve DGFiP laissée en cours — C3 du prompt 43.
         *
         * **La 41 m'est attribuée par le pilote**, et les numéros 36 à 40
         * sont réservés à d'autres branches en cours : le saut est voulu, et
         * il est sans effet. Une base montée à 41 par ce chemin ne rejouera
         * jamais les blocs 36 à 40 quand ils arriveront — c'est au
         * constructeur de les ordonner à la fusion, comme il l'a fait pour
         * la 34 et la 35.
         *
         * **Aucune reprise de données, et rien à reprendre** : avant ce lot,
         * une épreuve quittée en cours était perdue, et aucun magasin n'en
         * gardait trace. Un magasin vide se lit « aucune épreuve gardée »,
         * ce qui est la vérité.
         *
         * Pas d'index : il n'y a qu'un enregistrement, de clé fixe.
         */
        base.createObjectStore('epreuveDgfipEnCours', { keyPath: 'id' });
      }
      if (vers(42)) {
        /*
         * Le compteur de visites par écran — prompt 43, lot I, point 1.
         *
         * Il naît vide, et rien n'est repris : un compteur reconstitué
         * depuis une autre source dirait un passé qu'on n'a pas mesuré.
         *
         * Pas d'index, et la clé est tirée au hasard. Une clé parlante — la
         * route, ou son empreinte — aurait rendu la liste des écrans
         * fréquentés lisible sans ouvrir le coffre ; et soixante routes
         * publiques se retrouvent par force brute derrière une empreinte.
         */
        base.createObjectStore('visites', { keyPath: 'id' });
      }
      if (ancienneVersion >= 1 && ancienneVersion < 7) {
        // FSRS remplace SM-2. Les cartes déjà vues repartent d'un état de
        // modèle neuf : convertir un historique SM-2 en stabilité et difficulté
        // FSRS aurait produit des nombres d'allure savante et sans contenu,
        // puisque les deux algorithmes ne mesurent pas la même chose.
        //
        // Leur échéance, en revanche, est conservée. Une migration n'a pas à
        // rendre sept mille cartes exigibles le même jour, et rien n'oblige à
        // jeter ce qui a été acquis : le compte des révisions et des oublis est
        // de l'histoire, pas de l'état du modèle.
        const magasin = transaction.objectStore('cartes');
        let curseur = await magasin.openCursor();
        const maintenant = new Date();
        while (curseur) {
          const ancienne = curseur.value as unknown as Partial<EtatCarte> & { id: string };
          await curseur.update({
            id: ancienne.id,
            ficheId: ancienne.ficheId ?? '',
            matiere: ancienne.matiere ?? '',
            du: ancienne.du ?? jourISO(maintenant),
            derniereRevision: ancienne.derniereRevision ?? null,
            intervalle: ancienne.intervalle ?? 0,
            revisions: ancienne.revisions ?? 0,
            oublis: ancienne.oublis ?? 0,
            fsrs: fsrsNeuf(maintenant),
          });
          curseur = await curseur.continue();
        }
      }
    },

    /* ══════════════════════════════════════════════════════════════════
       A8 DU 43 — QUAND DEUX ONGLETS NE S'ENTENDENT PAS
       ══════════════════════════════════════════════════════════════════

       IndexedDB ne sait pas changer de version pendant qu'une autre
       connexion est ouverte. Deux situations, symétriques, et sans
       gestionnaire elles se vivaient toutes deux comme une panne muette.

       `blocked` : NOUS voulons migrer, un autre onglet tient encore la
       base à l'ancienne version. L'ouverture ne rejette pas : elle
       **attend**, indéfiniment. L'écran reste sur « Déchiffrement en
       cours… » et rien ne dit pourquoi — c'est exactement le symptôme que
       le prompt 22 avait traqué ailleurs, et il pouvait revenir par là.

       `blocking` : un AUTRE onglet veut migrer, et c'est nous qui tenons la
       base. Si nous ne lâchons pas, c'est l'autre onglet qui attend
       indéfiniment. On ferme donc notre connexion — l'autre peut passer —
       et on le dit, parce qu'une page dont la base vient d'être fermée ne
       peut plus rien écrire sans recharger.

       `terminated` : le navigateur a coupé la connexion de lui-même (mise
       en veille sur iOS, éviction de mémoire). Le dire plutôt que de
       laisser la prochaine écriture échouer sans contexte.

       POURQUOI PASSER PAR LA PORTE COMMUNE. Ces trois cas arrivent hors de
       tout geste : aucun écran n'a de zone pour eux. `direLEchec` sans
       zone pose la région commune, avec son rôle d'alerte — c'est
       précisément ce pour quoi elle existe.

       L'import est dynamique : `db.ts` est chargé par des essais de module
       qui tournent sous Node, sans `document`. Un import statique de la
       porte les ferait tomber à la lecture du fichier.
    */
    blocked(versionActuelle, versionVoulue) {
      void direEnDehorsDeTouteAction(
        `Cyclades doit mettre sa base à jour (version ${versionActuelle ?? '?'} vers ` +
          `${versionVoulue ?? VERSION}), mais un autre onglet l’utilise encore. ` +
          'Fermez les autres onglets de Cyclades, puis rechargez cette page. ' +
          'Rien n’a été modifié.',
      );
    },

    blocking(versionActuelle, versionVoulue) {
      void direEnDehorsDeTouteAction(
        `Un autre onglet met la base à jour (version ${versionActuelle ?? '?'} vers ` +
          `${versionVoulue ?? VERSION}). Cette page a fermé sa connexion pour le ` +
          'laisser passer : rechargez-la avant de continuer, sinon rien ne ' +
          's’enregistrera.',
      );
      /*
         Fermer, et vider le cache d'ouverture. Sans le second, `db()`
         rendrait indéfiniment la promesse d'une base fermée, et chaque
         écriture échouerait sur « InvalidStateError » sans que rien ne
         relie cette erreur à la cause.
      */
      try {
        baseOuverte?.close();
      } catch {
        /* déjà fermée : rien à faire */
      }
      promesse = null;
    },

    terminated() {
      void direEnDehorsDeTouteAction(
        'Le navigateur a fermé la base de Cyclades, probablement pour libérer de ' +
          'la mémoire. Rechargez la page : rien n’est perdu de ce qui était déjà ' +
          'enregistré, mais rien de nouveau ne s’enregistrera avant.',
      );
      promesse = null;
    },
  });
}

/**
 * La connexion courante, pour pouvoir la fermer quand un autre onglet migre.
 *
 * Tenue à part de `promesse` : au moment où `blocking` se déclenche, il faut
 * fermer **tout de suite**, sans attendre une promesse qui peut déjà être
 * résolue ailleurs.
 */
let baseOuverte: IDBPDatabase<SchemaRevinsp> | null = null;

/**
 * Dire quelque chose qui n'arrive pendant aucun geste.
 *
 * Les trois cas d'A8 surviennent hors de toute action : personne n'a cliqué,
 * aucun écran n'a de zone pour eux. La porte commune pose alors sa région,
 * avec son rôle d'alerte.
 *
 * Silencieuse hors navigateur : `db.ts` est chargé par des essais de module
 * qui tournent sous Node, et un `document` manquant ne doit pas les faire
 * tomber.
 */
async function direEnDehorsDeTouteAction(message: string): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    const { direLEchec } = await import('./agir');
    direLEchec(message);
  } catch {
    /* la porte n'a pas pu être chargée : au moins la console en gardera trace */
    console.warn(message);
  }
}

/**
 * Défait la dernière migration à partir d'un instantané.
 *
 * Le cache d'ouverture est vidé, sans quoi l'application continuerait de parler
 * à une base supprimée : « db() » rendrait une poignée vers un objet mort, et
 * les écritures échoueraient sans message clair.
 */
export async function revenirAvantMigration(instantane: Instantane): Promise<void> {
  /*
     Le cache d'ouverture est **remplacé** et non vidé, et c'est le cœur de la
     correction. Le vider laissait « db() » libre de rouvrir à la version
     courante pendant le retour arrière : la base revenait en version 11, puis
     un appel concurrent la remigrait aussitôt en 12 — le retour arrière était
     défait dans la seconde, et l'erreur qui finissait par apparaître (« object
     store already exists ») tombait très loin de sa cause.

     En pointant « promesse » sur la séquence de retour arrière, tout appel
     concurrent attend celle-ci et reçoit la base d'alors. L'application
     continue de fonctionner sur la version antérieure jusqu'au rechargement,
     que l'écran demande.
  */
  const precedente = promesse;
  promesse = (async () => {
    if (precedente) (await precedente).close();
    await revenirA(NOM_BASE, instantane, async (nom, version) => {
      // On recrée le schéma d'alors en ouvrant à cette version, puis on
      // referme : c'est « revenirA » qui réécrit les enregistrements, et il le
      // fait sur une base brute, sans dépendre de « idb ».
      (await ouvrirAuSchema(nom, version)).close();
    });
    return ouvrirAuSchema(NOM_BASE, instantane.deVersion);
  })();
  await promesse;
  derniereMigration = null;
}

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
export function jourISO(date = new Date()): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00`);
  d.setDate(d.getDate() + n);
  return jourISO(d);
}

export function ecartJours(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.round(ms / 86400000);
}

const PROFIL_PAR_DEFAUT: Profil = {
  xp: 0,
  streakCourante: 0,
  streakRecord: 0,
  dernierJourEtudie: null,
  badges: [],
  creeLe: new Date().toISOString(),
  graceUtiliseeLe: null,
};

export async function lireProfil(): Promise<Profil> {
  const base = await db();
  const stocke = (await base.get('etat', 'profil')) as Partial<Profil> | undefined;
  return { ...PROFIL_PAR_DEFAUT, ...(stocke ?? {}) };
}

export async function ecrireProfil(profil: Profil) {
  const base = await db();
  await base.put('etat', profil, 'profil');
}

export async function lireJour(jour: string): Promise<Jour> {
  const base = await db();
  return (
    (await base.get('jours', jour)) ?? {
      jour,
      xp: 0,
      cartes: 0,
      quiz: 0,
      bonnes: 0,
      reponses: 0,
      secondes: 0,
    }
  );
}

export async function majJour(jour: string, delta: Partial<Omit<Jour, 'jour'>>) {
  const base = await db();
  const actuel = await lireJour(jour);
  await base.put('jours', {
    ...actuel,
    xp: actuel.xp + (delta.xp ?? 0),
    cartes: actuel.cartes + (delta.cartes ?? 0),
    quiz: actuel.quiz + (delta.quiz ?? 0),
    bonnes: actuel.bonnes + (delta.bonnes ?? 0),
    reponses: actuel.reponses + (delta.reponses ?? 0),
    secondes: actuel.secondes + (delta.secondes ?? 0),
  });
}

export async function tousLesJours(): Promise<Jour[]> {
  const base = await db();
  return (await base.getAll('jours')).sort((a, b) => a.jour.localeCompare(b.jour));
}

export async function toutesLesCartes(): Promise<EtatCarte[]> {
  return (await db()).getAll('cartes');
}

export async function lireCarte(id: string): Promise<EtatCarte | undefined> {
  return (await db()).get('cartes', id);
}

export async function ecrireCarte(carte: EtatCarte) {
  await (await db()).put('cartes', carte);
}

/**
 * Pose un identifiant stable sur un enregistrement qui n'en a pas.
 *
 * À appeler devant **chaque** écriture dans les sept magasins qui portaient une
 * clé auto-incrémentée. Le compteur de la base les dotait d'une clé toute
 * seule ; il n'existe plus, et un enregistrement sans « id » est désormais
 * refusé par IndexedDB — pas par le compilateur, puisque le champ est
 * optionnel. C'est pourquoi ce passage est nommé plutôt qu'écrit à la main :
 * un « ulid() » oublié dans un coin ne se verrait qu'à l'usage.
 */
function identifie<T extends object>(enregistrement: T): T & { id: string } {
  // La contrainte est « object » et non « { id?: string } » : les chemins
  // d'import retirent l'identifiant par déstructuration, et le type qui en
  // résulte n'a plus de champ « id » du tout — une contrainte plus étroite les
  // refuserait, qui sont précisément les appels les plus nécessaires.
  const existant = (enregistrement as { id?: unknown }).id;
  return { ...enregistrement, id: typeof existant === 'string' ? existant : ulid() };
}

/* --- Réglages synchronisés ------------------------------------------------ */

/**
 * Les réglages qui voyagent d'un appareil à l'autre, et ceux qui ne voyagent
 * pas. La liste est ici, nommée, plutôt que dispersée dans les appelants.
 *
 * | Clé | Synchronisé | Pourquoi |
 * |---|---|---|
 * | `planification` | oui | la rotation hebdomadaire est une décision, pas un état |
 * | `reglagesSession` | oui | les plafonds de session aussi |
 * | `selection:*` | oui | ce qu'on a choisi d'entraîner |
 * | `derniereSauvegarde` | oui | avoir sauvegardé depuis le téléphone compte ici |
 * | `profil` | **non** | XP, niveau et série sont des **états dérivés** |
 * | `appareil` | **non** | l'identité de cet appareil-ci |
 * | `horloge` | **non** | idem : l'horloge logique est propre à l'appareil |
 *
 * Le profil est le cas qui mérite d'être expliqué. Un dernier-écrivain-gagne
 * sur l'XP ferait perdre celle gagnée sur l'autre appareil, et l'additionner la
 * compterait deux fois. Ni l'un ni l'autre n'est acceptable : l'XP se
 * **recalcule** depuis les journaux, comme l'état FSRS. Tant que ce recalcul
 * n'existe pas, le profil reste local, et c'est la seule réponse honnête.
 */
export const REGLAGES_SYNCHRONISES = [
  'planification',
  'reglagesSession',
  'derniereSauvegarde',
] as const;

/** `selection:<exercice>` est synchronisé, quel que soit l'exercice. */
export const estReglageSynchronise = (champ: string): boolean =>
  (REGLAGES_SYNCHRONISES as readonly string[]).includes(champ) ||
  champ.startsWith('selection:');

/**
 * Note la nouvelle valeur d'un réglage dans le registre versionné.
 *
 * Appelée **après** l'écriture ordinaire, de sorte que les lecteurs existants
 * ne changent pas : le registre est une copie annotée d'une horloge, pas une
 * seconde source de vérité. Si l'une des deux écritures échoue, c'est la copie
 * annotée qui manque — le réglage reste juste localement et ne voyagera pas,
 * ce qui est très préférable à l'inverse.
 *
 * L'import de l'horloge est **dynamique** et c'est délibéré : « horloge-locale »
 * importe ce module, et un import statique en sens inverse formerait un cycle
 * au chargement. Au moment où cette fonction s'exécute, « db.ts » est
 * entièrement initialisé, donc l'import ne pose aucun problème.
 */
export async function noterReglageSynchronise(champ: string, valeur: unknown): Promise<void> {
  if (!estReglageSynchronise(champ)) return;
  const { prochaineHlc } = await import('./sync/horloge-locale');
  const base = await db();
  const registre =
    ((await base.get('etat', 'reglagesSync')) as Record<string, unknown> | undefined) ?? {};
  registre[champ] = { valeur, hlc: await prochaineHlc(), appareil: await lireAppareil() };
  await base.put('etat', registre, 'reglagesSync');
}

/**
 * Écrit un réglage **sans** le tamponner d'une horloge locale.
 *
 * C'est le chemin qu'emprunte l'application d'un réglage reçu d'un autre
 * appareil. Passer par l'écriture ordinaire aurait ré-horodaté la valeur au nom
 * de cet appareil-ci, et le piège aurait été joli : la valeur reçue repartirait
 * vers son émetteur avec une horloge plus récente, qui repartirait encore, et
 * le registre n'aurait jamais fini de changer — donc les deux appareils ne se
 * seraient **jamais** déclarés identiques, alors qu'ils portent la même valeur.
 *
 * Les clés du registre versionné sont exactement les clés du magasin `etat`,
 * ce qui permet à cette fonction de rester générique plutôt que d'énumérer.
 */
export async function ecrireReglageBrut(champ: string, valeur: unknown): Promise<void> {
  await (await db()).put('etat', valeur as never, champ as never);
}

/**
 * Supprime un réglage, sans le tamponner — A7 du 58.
 *
 * Le pendant de la fonction ci-dessus, pour une **pierre tombale** reçue d'un
 * autre appareil : un effacement ciblé qui se propage. On supprime la clé au
 * lieu d'y ranger `null`, parce qu'un réglage absent et un réglage valant
 * `null` ne veulent pas dire la même chose pour les lecteurs.
 */
export async function effacerReglageBrut(champ: string): Promise<void> {
  await (await db()).delete('etat', champ as never);
}

/* --- Journal de révisions et journal d'opérations -------------------------- */

/**
 * L'identifiant de cet appareil.
 *
 * Posé par la migration v12 ; relu ici. Il n'est **jamais** régénéré après
 * coup : les opérations déjà écrites le portent, et en changer rendrait leur
 * ordre de fusion incohérent avec celui des opérations suivantes.
 */
export async function lireAppareil(): Promise<string> {
  const base = await db();
  const connu = (await base.get('etat', 'appareil')) as string | undefined;
  if (connu) return connu;
  // Une base créée avant que ce champ existe, ou vidée : on en pose un plutôt
  // que de rendre une valeur par défaut, qui serait la même sur deux appareils.
  const neuf = idAppareilNeuf();
  await base.put('etat', neuf, 'appareil');
  return neuf;
}

export async function ecrireEntreeRevision(entree: EntreeRevision) {
  await (await db()).put('revisions', entree);
  signalerEcriture();
}

/** Le journal d'une carte, dans l'ordre des identifiants, donc du temps. */
export async function revisionsDeCarte(carteId: string): Promise<EntreeRevision[]> {
  const entrees = await (await db()).getAllFromIndex('revisions', 'carteId', carteId);
  return entrees.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export async function toutesLesRevisions(): Promise<EntreeRevision[]> {
  return (await db()).getAll('revisions');
}

export async function ecrireOperation(op: Operation) {
  await (await db()).put('operations', op);
  signalerEcriture();
}

export async function toutesLesOperations(): Promise<Operation[]> {
  return (await db()).getAll('operations');
}

/**
 * Les identifiants seuls, pour l'empreinte d'état.
 *
 * `getAllKeys` ne charge pas les charges utiles : sur un journal de dizaines de
 * milliers d'opérations, c'est la différence entre lire quelques centaines de
 * kio de clés et désérialiser plusieurs mégaoctets pour n'en garder que l'`id`.
 */
export async function idsDesOperations(): Promise<string[]> {
  return (await db()).getAllKeys('operations');
}

/** Les opérations d'un lot de fusion, pour pouvoir l'annuler. */
export async function operationsDuLot(lot: string): Promise<Operation[]> {
  return (await db()).getAllFromIndex('operations', 'lot', lot);
}

export async function toutesLesCompetences(): Promise<Competence[]> {
  return (await db()).getAll('competences');
}

export async function lireCompetence(clef: string): Promise<Competence | undefined> {
  return (await db()).get('competences', clef);
}

export async function ecrireCompetence(competence: Competence) {
  await (await db()).put('competences', competence);
}

export async function lireDifficultes(ids: readonly string[]): Promise<Map<string, DifficulteItem>> {
  const base = await db();
  const tx = base.transaction('difficultes');
  const magasin = tx.objectStore('difficultes');
  const trouvees = new Map<string, DifficulteItem>();
  await Promise.all(
    ids.map(async (id) => {
      const valeur = await magasin.get(id);
      if (valeur) trouvees.set(id, valeur);
    }),
  );
  await tx.done;
  return trouvees;
}

export async function ecrireDifficulte(item: DifficulteItem) {
  await (await db()).put('difficultes', item);
}

export async function toutesLesEntreesJournal(): Promise<EntreeJournal[]> {
  return (await db()).getAll('journal');
}

export async function lireEntreeJournal(id: string): Promise<EntreeJournal | undefined> {
  return (await db()).get('journal', id);
}

export async function ecrireEntreeJournal(entree: EntreeJournal) {
  await (await db()).put('journal', entree);
}

export async function lireEtatFiche(id: string): Promise<EtatFiche | undefined> {
  return (await db()).get('fiches', id);
}

export async function tousLesEtatsFiches(): Promise<EtatFiche[]> {
  return (await db()).getAll('fiches');
}

/**
 * Journalise un enregistrement qui vient d'être écrit.
 *
 * L'import est **dynamique**, et c'est la seule façon correcte de le faire ici :
 * le journalisateur a besoin de l'horloge logique, qui a besoin de cette base.
 * Deux imports de valeurs en sens inverse formeraient un cycle au chargement —
 * les modules ES savent le tolérer quand il ne s'agit que de fonctions
 * hoistées, mais c'est une propriété fragile du code appelé, pas une garantie.
 * Le même raisonnement que pour « noyau/revisions.ts », et la même prudence.
 *
 * Silencieux en cas d'échec : l'enregistrement de la personne est déjà écrit, et
 * « soclerFaitsDomaine » rattrape ce qui n'a pas pu être journalisé. Une erreur
 * de journal ne doit pas faire perdre une séance.
 */
async function journaliser(magasin: string, enregistrement: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('./sync/faits-domaine');
    await journaliserEnregistrement(magasin, enregistrement as Record<string, unknown>);
  } catch {
    // Volontairement muet : voir ci-dessus.
  }
}

/** Journalise une suppression, pour qu'elle voyage. Muette pour la même raison. */
async function journaliserSuppression(cibles: readonly string[]): Promise<void> {
  try {
    const { journaliserSuppressions } = await import('./sync/faits-domaine');
    await journaliserSuppressions(cibles);
  } catch {
    // Volontairement muet : voir ci-dessus.
  }
}

/**
 * Ce qui, dans l'état d'une fiche, mérite d'entrer au journal.
 *
 * Pas tout : `ecrireEtatFiche` est appelée **à chaque ouverture** de fiche, pour
 * poser `derniereOuverture`. Journaliser à chaque fois ferait une opération par
 * consultation — des milliers en cinq ans, jamais dédoublonnables puisque
 * l'heure change à chaque fois. Or ce qui doit voyager est l'histoire de la
 * fiche, pas le compte de ses visites : lue ou non, prétestée ou non, quelles
 * questions de prétest ont déjà été servies.
 *
 * La comparaison porte donc sur cette projection, et la date d'ouverture voyage
 * seulement quand elle accompagne un changement réel.
 */
const partieJournalisable = (etat: Partial<EtatFiche> | undefined) =>
  JSON.stringify([
    etat?.lu ?? false,
    etat?.matiere ?? '',
    etat?.pretesteeLe ?? null,
    etat?.pretestPasseLe ?? null,
    [...(etat?.pretestVues ?? [])].sort(),
  ]);

export async function ecrireEtatFiche(etat: EtatFiche) {
  const base = await db();
  const avant = await base.get('fiches', etat.id);
  await base.put('fiches', etat);
  if (!avant || partieJournalisable(avant) !== partieJournalisable(etat)) {
    await journaliser('fiches', etat);
  }
}

export async function ajouterResultatQuiz(resultat: ResultatQuiz) {
  const avecId = identifie(resultat);
  await (await db()).add('quiz', avecId);
  await journaliser('quiz', avecId);
}

export async function tousLesResultatsQuiz(): Promise<ResultatQuiz[]> {
  return (await db()).getAll('quiz');
}

export async function ajouterSessionNBack(session: SessionNBack) {
  const avecId = identifie(session);
  await (await db()).add('nback', avecId);
  await journaliser('nback', avecId);
}

export async function toutesLesSessionsNBack(): Promise<SessionNBack[]> {
  return (await db()).getAll('nback');
}

export async function ajouterSessionRelationnelle(session: SessionRelationnelle) {
  const avecId = identifie(session);
  await (await db()).add('relationnel', avecId);
  await journaliser('relationnel', avecId);
}

export async function toutesLesSessionsRelationnelles(): Promise<SessionRelationnelle[]> {
  return (await db()).getAll('relationnel');
}

export async function tousLesSeuilsVeridical(): Promise<SeuilVeridical[]> {
  return (await db()).getAll('vmSeuils');
}

export async function ecrireSeuilVeridical(seuil: SeuilVeridical) {
  await (await db()).put('vmSeuils', seuil);
}

export async function ajouterSessionVeridical(session: SessionVeridical) {
  const avecId = identifie(session);
  await (await db()).add('vmSessions', avecId);
  await journaliser('vmSessions', avecId);
}

export async function toutesLesSessionsVeridical(): Promise<SessionVeridical[]> {
  return (await db()).getAll('vmSessions');
}

/* --- Séances de révision -------------------------------------------------- */

// --- Banque « QCM - DGFiP » -------------------------------------------------

export async function etatsQuestionsDgfip(): Promise<EtatQuestionDgfip[]> {
  return (await db()).getAll('qcmDgfip');
}

/**
 * Enregistre en une transaction le passage d'une session : l'historique de
 * chaque question posée, puis la session elle-même.
 */
export async function enregistrerSessionDgfip(
  session: SessionDgfip,
  reponses: { id: string; rubriqueId: string; issue: 'bonne' | 'mauvaise' | 'abstention' }[],
): Promise<string> {
  const base = await db();
  const tx = base.transaction(['qcmDgfip', 'qcmSessions'], 'readwrite');
  const magasin = tx.objectStore('qcmDgfip');
  for (const reponse of reponses) {
    const ancien = await magasin.get(reponse.id);
    const etat: EtatQuestionDgfip = ancien ?? {
      id: reponse.id,
      rubriqueId: reponse.rubriqueId,
      vues: 0,
      bonnes: 0,
      mauvaises: 0,
      abstentions: 0,
      derniereLe: session.le,
    };
    etat.rubriqueId = reponse.rubriqueId;
    etat.vues += 1;
    if (reponse.issue === 'bonne') etat.bonnes += 1;
    else if (reponse.issue === 'mauvaise') etat.mauvaises += 1;
    else etat.abstentions += 1;
    etat.derniereLe = session.le;
    await magasin.put(etat);
  }
  const { id: _ignore, ...sansId } = session;
  const avecId = identifie(sansId);
  await tx.objectStore('qcmSessions').add(avecId as SessionDgfip);
  await tx.done;
  await journaliser('qcmSessions', avecId);
  return avecId.id;
}

export async function toutesLesSessionsDgfip(): Promise<SessionDgfip[]> {
  return (await db()).getAll('qcmSessions');
}

/* ══════════════════════════════════════════════════════════════════════════
   L'épreuve DGFiP gardée pour plus tard (C3 du prompt 43)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Lit l'épreuve gardée, ou `null`.
 *
 * Rend ce que le magasin porte, sans le contrôler : c'est
 * `estLisible` — dans le noyau, donc éprouvable sans base — qui décide si la
 * forme tient, et l'écran qui décide quoi en faire. Séparer les deux permet à
 * l'essai de fabriquer une forme abîmée sans avoir à l'écrire en base.
 */
export async function lireEpreuveEnCours(): Promise<EpreuveEnCours | null> {
  return (await (await db()).get('epreuveDgfipEnCours', CLE_EPREUVE_EN_COURS)) ?? null;
}

/**
 * Garde une épreuve pour plus tard. Il n'y en a qu'une : celle-ci remplace
 * la précédente.
 *
 * **Non journalisée, et c'est délibéré.** Un brouillon existe pour être
 * consommé ou jeté ; le journal est un registre qui ne s'élague pas.
 * Journaliser l'épreuve en cours garderait pour toujours la trace de chaque
 * tentative abandonnée, et ferait traverser le réseau à un état qui n'a de
 * sens que sur l'appareil où l'on s'est arrêté — reprendre une épreuve sur un
 * autre téléphone n'est promis par personne. Arbitré avec le pilote le
 * 19 octobre.
 */
export async function ecrireEpreuveEnCours(
  epreuve: Omit<EpreuveEnCours, 'id' | 'majLe'>,
): Promise<void> {
  await (await db()).put('epreuveDgfipEnCours', {
    ...epreuve,
    id: CLE_EPREUVE_EN_COURS,
    majLe: new Date().toISOString(),
  });
}

/**
 * Efface l'épreuve gardée.
 *
 * Trois chemins y mènent, et ils ne se confondent pas : l'épreuve terminée —
 * elle devient une `SessionDgfip` —, l'abandon, et la reprise refusée parce
 * que la banque a changé. Dans les trois cas il ne doit rien rester, et
 * l'essai le lit dans la base plutôt que de croire cette fonction.
 */
export async function effacerEpreuveEnCours(): Promise<void> {
  await (await db()).delete('epreuveDgfipEnCours', CLE_EPREUVE_EN_COURS);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les intentions d'actions annulables (M6, 0.2)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Toutes les intentions encore en base.
 *
 * Rend ce que le magasin porte, sans contrôler la forme : c'est
 * `pourquoiNonRejouable` — dans le noyau, donc éprouvable sans base — qui
 * décide si une intention est rejouable, et l'appelant qui décide quoi en
 * faire. Un enregistrement abîmé se fabrique ainsi dans un essai pur.
 */
export async function lesAnnulationsEnAttente(): Promise<AnnulationEnAttente[]> {
  return (await db()).getAll('annulationsEnAttente');
}

/**
 * Écrit une intention. C'est la PREMIÈRE écriture d'une action annulable, et
 * elle doit être attendue avant de laisser la personne quitter l'écran.
 *
 * **Non journalisée, et délibérément.** Une intention existe pour être
 * consommée dans les secondes qui suivent ; la journaliser ferait traverser
 * la synchronisation à un état transitoire, et garderait pour toujours la
 * trace d'une suppression annulée — c'est-à-dire d'un geste que la personne a
 * repris. C'est l'action elle-même qui se journalise, quand elle part.
 */
export async function ecrireUneAnnulationEnAttente(
  intention: Omit<AnnulationEnAttente, 'majLe'>,
): Promise<void> {
  await (await db()).put('annulationsEnAttente', {
    ...intention,
    majLe: new Date().toISOString(),
  });
}

/**
 * Efface une intention, par son identifiant.
 *
 * Trois chemins y mènent, et ils ne se confondent pas : l'action partie à
 * l'échéance, l'annulation, et l'application au démarrage. Dans les trois cas
 * il ne doit rien rester, et l'essai le lit dans la base plutôt que de croire
 * cette fonction.
 */
export async function effacerUneAnnulationEnAttente(id: string): Promise<void> {
  await (await db()).delete('annulationsEnAttente', id);
}

export async function toutesLesSeances(): Promise<Seance[]> {
  const seances = await (await db()).getAll('seances');
  // Les identifiants sont des ULID : leur ordre lexicographique est l'ordre de
  // création, ce qui départage deux séances du même jour comme le faisait la
  // soustraction des anciennes clés numériques.
  return seances.sort(
    (a, b) => a.jour.localeCompare(b.jour) || (a.id ?? '').localeCompare(b.id ?? ''),
  );
}

/* --- Notes de séance ------------------------------------------------------ */

/** La note d'une séance, ou `null` si rien n'y a été écrit. */
export async function lireNoteSeance(seanceId: string): Promise<NoteSeance | null> {
  return (await (await db()).get('notes', seanceId)) ?? null;
}

/**
 * Écrit la note et les restitutions d'une séance.
 *
 * Une note vide **et** des restitutions vides suppriment l'enregistrement : il
 * n'y a aucune raison de garder une ligne qui ne dit rien, et une ligne vide se
 * confondrait avec « non encore rédigé » dans tous les décomptes.
 */
export async function ecrireNoteSeance(
  seanceId: string,
  note: string,
  restitutions: Record<string, string> = {},
) {
  const base = await db();
  const vide = !note.trim() && !Object.values(restitutions).some((r) => r.trim());
  if (vide) {
    await base.delete('notes', seanceId);
    await journaliserSuppression([`notes:${seanceId}`]);
    return;
  }
  const enregistrement = { seanceId, note, restitutions, majLe: new Date().toISOString() };
  await base.put('notes', enregistrement);
  await journaliser('notes', enregistrement);
}

/**
 * Les notes de plusieurs séances, en une seule lecture.
 *
 * Pour les écrans qui en affichent un petit nombre — la restitution à blanc en
 * montre deux à quatre. Une boucle de `lireNoteSeance` ouvrirait autant de
 * transactions.
 */
export async function lireNotesSeances(
  seanceIds: readonly string[],
): Promise<Map<string, NoteSeance>> {
  if (!seanceIds.length) return new Map();
  const base = await db();
  const tx = base.transaction('notes');
  const trouvees = await Promise.all(seanceIds.map((id) => tx.store.get(id)));
  await tx.done;
  const sortie = new Map<string, NoteSeance>();
  for (const note of trouvees) if (note) sortie.set(note.seanceId, note);
  return sortie;
}

/**
 * Le volume de texte rédigé par séance, sans charger le texte.
 *
 * Sert aux décomptes — « cette séance a-t-elle une note ? », « combien de
 * signes ? » — que plusieurs écrans faisaient en chargeant les notes entières.
 */
export async function volumesDesNotes(): Promise<Map<string, { note: number; restitutions: number }>> {
  const notes = await (await db()).getAll('notes');
  return new Map(
    notes.map((n) => [
      n.seanceId,
      {
        note: n.note.trim().length,
        restitutions: Object.values(n.restitutions).filter((r) => r.trim().length >= 80).length,
      },
    ]),
  );
}

/**
 * Enregistre une demande d'aide.
 *
 * Volontairement silencieuse en cas d'échec : une base indisponible — mode
 * privé, quota atteint — ne doit pas empêcher de copier un prompt. La trace est
 * un confort, la copie est la fonction.
 */
export async function enregistrerAide(aide: AideDemandee): Promise<void> {
  try {
    await (await db()).add('aides', identifie(aide));
  } catch {
    /* La demande a lieu quand même. */
  }
}

export async function toutesLesAides(): Promise<AideDemandee[]> {
  try {
    return await (await db()).getAll('aides');
  } catch {
    return [];
  }
}

/** Combien de fois j'ai demandé de l'aide sur chacun de ces items. */
export async function aidesParItem(ids: readonly string[]): Promise<Map<string, number>> {
  const comptes = new Map<string, number>();
  if (!ids.length) return comptes;
  const voulus = new Set(ids);
  for (const aide of await toutesLesAides()) {
    if (aide.itemId && voulus.has(aide.itemId)) {
      comptes.set(aide.itemId, (comptes.get(aide.itemId) ?? 0) + 1);
    }
  }
  return comptes;
}

export async function lireSeance(id: string): Promise<Seance | undefined> {
  return (await db()).get('seances', id);
}

/** Crée ou met à jour une séance et retourne son identifiant. */
export async function ecrireSeance(seance: Seance): Promise<string> {
  const base = await db();
  // L'identifiant est posé ici et non par la base : il n'y a plus de compteur
  // auto-incrémenté, et une séance sans identifiant n'aurait pas de clé.
  const avecId = { ...seance, id: seance.id ?? ulid() };
  await base.put('seances', avecId);
  await journaliser('seances', avecId);
  return avecId.id;
}

export async function supprimerSeance(id: string) {
  await (await db()).delete('seances', id);
  /*
     Une suppression est une opération, pas une absence : sans elle, la séance
     reviendrait à la première synchronisation, puisque l'autre appareil porte
     encore son écriture. Sa note part avec elle, pour la même raison.
  */
  await journaliserSuppression([`seances:${id}`, `notes:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les positions d'écoute des fiches audio (prompt 46, P3)
   ══════════════════════════════════════════════════════════════════════════ */

export async function lirePositionPodcast(fiche: string): Promise<PositionPodcast | undefined> {
  return (await db()).get('podcastPositions', fiche);
}

/** Les écoutes en cours, la plus récemment touchée d'abord. */
export async function toutesLesPositionsPodcast(): Promise<PositionPodcast[]> {
  const positions = await (await db()).getAll('podcastPositions');
  return positions.sort((a, b) => (a.majLe < b.majLe ? 1 : a.majLe > b.majLe ? -1 : 0));
}

/**
 * Écrit la position, et décide si elle doit VOYAGER.
 *
 * Les deux ne vont pas ensemble, et c'est tout l'objet de `journaliser` :
 * le lecteur appelle cette fonction toutes les cinq secondes pendant
 * l'écoute, et journaliser chaque appel ferait une opération de
 * synchronisation par tranche de cinq secondes — des centaines par fiche,
 * jamais dédoublonnables puisque la position change à chaque fois. C'est
 * exactement la faute que `partieJournalisable` évite sur l'état d'une
 * fiche, à un rythme dix fois pire.
 *
 * L'écriture locale, elle, a lieu à chaque appel : c'est elle qui fait la
 * reprise après une fermeture brutale de l'onglet.
 *
 * Ce qui voyage est donc la position aux moments où l'écoute S'ARRÊTE —
 * pause, passage en arrière-plan, fermeture de la page —, et c'est
 * précisément ce dont un autre appareil a besoin pour reprendre le fil.
 */
export async function ecrirePositionPodcast(
  position: PositionPodcast,
  options: { journaliser?: boolean } = {},
): Promise<void> {
  await (await db()).put('podcastPositions', position);
  if (options.journaliser) await journaliser('podcastPositions', position);
}

/** L'écoute est terminée : la position n'a plus d'objet et s'en va. */
export async function supprimerPositionPodcast(fiche: string): Promise<void> {
  await (await db()).delete('podcastPositions', fiche);
  /*
     Même raison que pour une séance : sans l'opération de suppression, la
     position reviendrait à la première synchronisation, et une fiche écoutée
     jusqu'au bout se proposerait de nouveau « à reprendre ».
  */
  await journaliserSuppression([`podcastPositions:${fiche}`]);
}

/* --- Réglages de session -------------------------------------------------- */

/**
 * Plafonds de session.
 *
 * Le site est dense : à ce jour plus de deux mille flashcards et neuf cents
 * questions. Présenter d'un coup tout ce qui est « dû » rendrait la moindre
 * reprise décourageante. On plafonne donc chaque session, en servant d'abord
 * les éléments les plus en retard.
 */
export interface ReglagesSession {
  plafondCartes: number;
  plafondQuestions: number;
  /**
   * Le compte à rebours vers les épreuves, sur l'accueil de Révisions.
   *
   * Décision 3 du prompt 56, et décision d'Alexis : « Oui, sur l'accueil de
   * Révisions ». Il est donc allumé par défaut, et se coupe d'ici.
   *
   * POURQUOI DANS CE MAGASIN, ET SANS MIGRATION. `reglagesSession` est un objet
   * stocké sous une clé du magasin `etat` : y ajouter un champ ne change pas le
   * schéma de la base, et `lireReglagesSession` fusionne déjà le défaut avec ce
   * qui est stocké — une base écrite par une version antérieure rend donc le
   * défaut, sans rien réécrire. L'interdit 1 du 56 exclut toute migration, et
   * il n'en faut aucune.
   */
  compteARebours: boolean;
}

export const REGLAGES_SESSION_PAR_DEFAUT: ReglagesSession = {
  plafondCartes: 25,
  plafondQuestions: 20,
  compteARebours: true,
};

export async function lireReglagesSession(): Promise<ReglagesSession> {
  const base = await db();
  const stockes = (await base.get('etat', 'reglagesSession')) as Partial<ReglagesSession> | undefined;
  const fusion = { ...REGLAGES_SESSION_PAR_DEFAUT, ...(stockes ?? {}) };
  // Un réglage aberrant ne doit pas pouvoir vider ou saturer une session.
  return {
    plafondCartes: Math.min(200, Math.max(5, Math.round(fusion.plafondCartes))),
    plafondQuestions: Math.min(200, Math.max(5, Math.round(fusion.plafondQuestions))),
    /* Une valeur d'un autre type — venue d'une version future, ou d'une
       synchronisation — ne doit pas rendre le réglage indécidable. */
    compteARebours: fusion.compteARebours !== false,
  };
}

export async function ecrireReglagesSession(reglages: ReglagesSession) {
  await (await db()).put('etat', reglages, 'reglagesSession');
  await noterReglageSynchronise('reglagesSession', reglages);
}

/* --- Sélection d'entraînement (Cog-Training) ------------------------------- */

/**
 * Ce que la personne a choisi de travailler dans un exercice de Cog-Training.
 *
 * Rangé par **exercice** et non globalement : les trois exercices n'ont pas les
 * mêmes unités à cocher, et une sélection commune n'aurait aucun sens. La clef
 * du magasin `etat` est donc `selection:<exercice>`.
 *
 * Le réglage est une **préférence**, non de la progression : il est mémorisé
 * pour éviter de recocher à chaque session, et il ne compte dans aucun score.
 */
export interface SelectionEntrainement {
  /** Identifiants cochés. Une sélection vide interdit de lancer une session. */
  unites: string[];
  /** Nombre d'items visé pour une session. */
  items: number;
  /** Entrelacé, ou regroupé exercice par exercice. */
  ordre: 'entrelace' | 'par-unite';
  /**
   * Mode libre : tout est sélectionnable, même ce qui n'est pas débloqué.
   *
   * **Sans toucher aux déblocages gagnés** : une unité ouverte en mode libre
   * tourne à son échelon de départ, et la progression continue de se calculer
   * depuis l'historique comme avant. Le mode libre est une permission de
   * s'entraîner, pas un raccourci de progression.
   */
  modeLibre: boolean;
}

export const SELECTION_PAR_DEFAUT: SelectionEntrainement = {
  unites: [],
  items: 12,
  ordre: 'entrelace',
  modeLibre: false,
};

const clefSelection = (exercice: string) => `selection:${exercice}`;

export async function lireSelectionEntrainement(
  exercice: string,
): Promise<SelectionEntrainement> {
  const base = await db();
  const stockee = (await base.get('etat', clefSelection(exercice))) as
    | Partial<SelectionEntrainement>
    | undefined;
  const fusion = { ...SELECTION_PAR_DEFAUT, ...(stockee ?? {}) };
  return {
    unites: Array.isArray(fusion.unites) ? fusion.unites.filter((u) => typeof u === 'string') : [],
    // Un réglage aberrant ne doit pas pouvoir vider ou saturer une session.
    items: Math.min(60, Math.max(3, Math.round(fusion.items))),
    ordre: fusion.ordre === 'par-unite' ? 'par-unite' : 'entrelace',
    modeLibre: Boolean(fusion.modeLibre),
  };
}

export async function ecrireSelectionEntrainement(
  exercice: string,
  selection: SelectionEntrainement,
) {
  await (await db()).put('etat', selection, clefSelection(exercice));
  await noterReglageSynchronise(clefSelection(exercice), selection);
}

/* --- Réglages de planification -------------------------------------------- */

export interface ReglagesPlanification {
  /**
   * Thème proposé pour chaque jour de la semaine, index 0 = dimanche, **par
   * parcours**. La clé est l'identifiant du parcours (`parcours/registre.ts`).
   */
  rotations?: Record<string, string[]>;
  /**
   * Forme antérieure : une rotation unique, du temps où le site ne connaissait
   * que l'INSP. Conservée en lecture seule — `src/lib/rotation.ts` la migre vers
   * `rotations.insp` à chaque lecture, y compris sur une sauvegarde ancienne
   * restaurée longtemps après la mise à jour. Rien ne l'écrit plus.
   */
  rotation?: string[];
  /** Dernier trimestre pour lequel la suggestion a été écartée (ex. « 2026-T1 »). */
  trimestreEcarte: string | null;
  /**
   * Répartir une longue fiche sur plusieurs séances, partie par partie
   * (prompt 46, P5).
   *
   * **Désactivé par défaut** (décision 3), et son absence vaut `false` : une
   * planification existante ne change pas de comportement du jour au
   * lendemain parce qu'un champ est apparu. Qui le veut l'allume.
   */
  decouperParParties?: boolean;
}

export async function lireReglagesPlanification(): Promise<ReglagesPlanification | null> {
  const base = await db();
  return ((await base.get('etat', 'planification')) as ReglagesPlanification | undefined) ?? null;
}

export async function ecrireReglagesPlanification(reglages: ReglagesPlanification) {
  await (await db()).put('etat', reglages, 'planification');
  await noterReglageSynchronise('planification', reglages);
}

/**
 * Tous les magasins qui portent de la progression.
 *
 * **Une seule liste, deux usages** : la remise à zéro complète et le mode
 * « remplacement » de l'import doivent effacer exactement la même chose. Ils
 * avaient divergé — l'import oubliait `nback`, `relationnel`, `vmSeuils` et
 * `vmSessions`, les quatre magasins ajoutés après lui. Comme les sessions y sont
 * ensuite **ajoutées** et non écrasées, restaurer deux fois la même sauvegarde
 * doublait l'historique de Cog-Training, et un seuil local absent de la
 * sauvegarde survivait à un « effacer puis restaurer ».
 *
 * Le remède n'est pas d'allonger la seconde liste mais de n'en avoir qu'une :
 * un magasin ajouté ici est pris en compte partout.
 */
export const MAGASINS_PROGRESSION = [
  'etat',
  'annulationsEnAttente',
  'cartes',
  'fiches',
  'quiz',
  'jours',
  'nback',
  'seances',
  // Le texte des séances : séparé pour la vitesse, inséparable pour le sens.
  'notes',
  /*
     Où l'on s'est arrêté dans une fiche audio (prompt 46, P3). De la
     progression au sens plein : une reprise d'écoute perdue, c'est un cours
     de quarante minutes à retrouver à l'oreille.
  */
  'podcastPositions',
  'qcmDgfip',
  'qcmSessions',
  /*
     L'épreuve DGFiP laissée en cours (C3 du 43). De la progression comme le
     reste du QCM : une épreuve de quarante-cinq questions commencée et
     gardée, c'est une demi-heure de travail. Elle s'efface avec son groupe,
     et elle suit la sauvegarde — restaurer un appareil sans elle ferait
     disparaître l'épreuve en cours sans le dire.
  */
  'epreuveDgfipEnCours',
  'relationnel',
  'vmSeuils',
  'vmSessions',
  'journal',
  'competences',
  'difficultes',
  // Les demandes d'aide annotent la progression : elles s'effacent avec elle.
  'aides',
  /*
     Les deux journaux. Ils font partie de la progression au sens plein : le
     journal de révisions est ce qui rend l'état FSRS recalculable, et une
     sauvegarde qui le laisserait de côté rendrait une base dont les cartes ont
     un état mais plus d'histoire — donc plus de fusion possible.
  */
  'revisions',
  'operations',
  // Les actualités marquées lues : de la progression, comme les fiches lues.
  'actualitesLues',
  /*
     Les magasins d'Odyssée. Ils entrent dans la progression au même titre que
     ceux de Révisions : une sauvegarde qui laisserait de côté les tâches et
     les quêtes rendrait une base amputée de la moitié de ce que la personne y
     a mis, et un effacement qui les oublierait laisserait des données
     derrière lui en disant le contraire.
  */
  'odysseeTaches',
  /*
     Les exceptions des séries (prompt 38). Elles entrent dans la sauvegarde
     pour la même raison que les tâches : une sauvegarde qui oublierait les
     occurrences pointées rendrait une base où tout serait à refaire, et un
     effacement qui les laisserait derrière lui mentirait.
  */
  'odysseeOccurrences',
  'odysseeEtapesCochees',
  'odysseeExceptionsScellees',
  'odysseeReports',
  /*
     Le centre entre ici pour être EFFAÇABLE — l'effacement ne touche que
     les magasins de cette liste —, et il est retiré de la sauvegarde par
     `MAGASINS_HORS_SAUVEGARDE` juste en dessous. La décision 8 du prompt 32
     l'exclut de toute sauvegarde ; le § 1 n° 9 exige que l'effacement d'une
     source emporte ses éléments. Les deux ne tiennent qu'en séparant les
     deux usages de cette liste, qui les confondait.
  */
  /*
     Le suivi personnel entre dans la progression, donc il est EFFAÇABLE et
     SAUVEGARDÉ. Les deux sont voulus : « effacer mes données » qui le
     laisserait derrière lui mentirait, et une sauvegarde qui l'oublierait
     rendrait à la restauration une base amputée en annonçant une
     restauration complète.

     CE COMMENTAIRE DISAIT ENSUITE, AU LOT 4 : « Le fichier est chiffré, et les
     magasins restent scellés à l'intérieur. » C'était vrai du cas chiffré
     seulement, et je l'avais écrit comme si c'était le seul : la case « Ne pas
     chiffrer ce fichier » existe, et son propre avertissement dit que le
     fichier sera lisible par quiconque l'ouvre. Le § 6.9 du prompt 30 refuse
     que le cycle entre dans un tel fichier ; `MAGASINS_HORS_SAUVEGARDE_EN_CLAIR`
     plus bas l'en retire, et cette liste-ci ne décide plus que de
     l'effacement et de la sauvegarde chiffrée.

     Le sexe déclaré suit les mêmes règles, par consigne du pilote.
  */
  'odysseeCycleJournal',
  'odysseeCycleReglages',
  'odysseeSexe',
  'centreElements',
  'odysseeQuetes',
  'odysseeEvenements',
  'odysseeFocus',
  'odysseeRevues',
  'sportExercices',
  'sportSeances',
  'sportPhases',
  'sportBlessures',
  'sportProgrammes',
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
  'odysseeCreneaux',
  'odysseeCheckins',
  'odysseeHebdos',
  'odysseeJournal',
  'odysseeComptes',
  'odysseeValorisations',
  'odysseeOperations',
  'odysseeLignesBudget',
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
  /*
     Le compteur de visites (prompt 43, lot I). Il est ici pour être EFFAÇABLE
     — c'est cette liste qui décide de la remise à zéro et du remplacement —
     et il est écarté des sauvegardes juste en dessous.
  */
  'visites',
] as const;

/**
 * Ce qui est effaçable mais **jamais sauvegardé** — prompt 32, décision 8.
 *
 * `MAGASINS_PROGRESSION` servait aux deux à la fois, et les deux usages ont
 * divergé le jour où un magasin a dû être effaçable sans être sauvegardé.
 * Le centre de notifications est ce cas : il ne porte aucune donnée propre,
 * seulement des références, et **il se recalcule depuis ses sources**. Le
 * sauvegarder reviendrait à restaurer un état lu qui ne correspondrait plus
 * à rien.
 *
 * La liste est volontairement minuscule. Un magasin n'y entre que s'il est
 * reconstructible intégralement : tout autre magasin absent d'une
 * sauvegarde serait une perte.
 *
 * ## Une seconde raison d'y entrer, et il faut la nommer plutôt que l'étendre
 *
 * `visites` n'est PAS reconstructible : un compteur perdu est perdu. Il entre
 * ici pour l'autre motif, qui lui est propre — c'est une mesure de
 * diagnostic, faite pour choisir quoi améliorer d'abord, et sa perte ne coûte
 * rien à la personne. Le prétendre reconstructible aurait élargi le critère
 * en silence ; mieux vaut deux critères écrits qu'un critère élastique.
 *
 * Il y a une conséquence, et elle est voulue : le point I du prompt 43 exige
 * qu'il reste hors des sauvegardes NON CHIFFRÉES. Le tenir hors de TOUTES est
 * plus strict, et évite d'avoir à distinguer les deux cas au moment où l'on
 * écrit le fichier.
 *
 * ## Et un troisième motif, pour `annulationsEnAttente`
 *
 * Une intention n'est ni reconstructible ni un diagnostic : elle entre ici
 * parce que la sauvegarder serait FAUX. Une intention vaut quelques secondes,
 * et une sauvegarde se restaure des mois plus tard : on rejouerait alors une
 * suppression décidée en octobre sur une base de janvier, où la séance visée
 * peut ne plus être la même — ou ne plus être.
 *
 * Et la perte n'en est pas une. Une sauvegarde est un instantané : au moment
 * où elle a été prise, la séance en attente de suppression était encore là.
 * La restaurer rend donc un état COHÉRENT, celui d'avant le geste. Emporter
 * l'intention rendrait, elle, un état incohérent.
 */
export const MAGASINS_HORS_SAUVEGARDE: readonly string[] = [
  'centreElements',
  'visites',
  'annulationsEnAttente',
];

/** Ce qu'une sauvegarde emporte vraiment. */
export const MAGASINS_SAUVEGARDES: readonly string[] = MAGASINS_PROGRESSION.filter(
  (nom) => !MAGASINS_HORS_SAUVEGARDE.includes(nom),
);

/**
 * Ce qu'une sauvegarde **non chiffrée** n'emporte pas.
 *
 * Une sauvegarde est normalement chiffrée par le mot de passe du site, et les
 * magasins scellés restent scellés à l'intérieur : deux serrures. La personne
 * peut refuser le chiffrement (« Ne pas chiffrer ce fichier », écran
 * Progression), et le fichier est alors lisible par quiconque l'ouvre. Pour
 * les magasins scellés, il reste une serrure — la clé du coffre n'y est pas.
 *
 * Pour le suivi personnel, le § 6.9 du prompt 30 ne s'en contente pas : « le
 * cycle n'entre dans aucune sauvegarde non chiffrée ». La raison tient en une
 * ligne : un fichier en clair circule — par courriel, par clé, dans un dossier
 * partagé — et la **présence même** d'un journal de suivi y est une
 * information, avant tout contenu. Deux magasins scellés nommés
 * `odysseeCycle…` dans un fichier ouvert disent déjà quelque chose.
 *
 * ## Pourquoi une liste écrite et non un import
 *
 * `NOMS_DES_MAGASINS_DU_CYCLE` (`odyssee/cycle-confidentialite.ts`) porte
 * exactement ces deux noms. L'importer ici créerait une arête de `db.ts`
 * — que tout le monde charge — vers un module du suivi. La liste est donc
 * recopiée, et `essais:cycle-confidentialite` **vérifie qu'elle est égale**
 * à celle du module : la dérive est tenue par un essai plutôt que par une
 * dépendance.
 *
 * ## Ce que l'exclusion coûte, et qui doit le savoir
 *
 * `remplacerMagasins` vide chaque magasin connu, **même absent du fichier**
 * — c'est le sens de « remplacer », et c'était déjà celui de
 * `viderProgression`. Donc restaurer une sauvegarde non chiffrée **efface le
 * suivi** au lieu de le laisser en place. Je ne change pas cette règle ici :
 * elle est générale, et l'affaiblir pour un module rendrait « remplacer »
 * faux pour tous les autres. C'est l'écran qui le dit, à l'endroit où la
 * personne décoche le chiffrement, parce que c'est là que le choix se fait.
 *
 * La bonne fermeture serait que le fichier **déclare ses exclusions** et que
 * la restauration les respecte. C'est un changement de format, hors de ce
 * lot : il est inscrit dans
 * `docs/cyclades/decisions-en-attente-cycle-2026-10-19.md`.
 */
export const MAGASINS_HORS_SAUVEGARDE_EN_CLAIR: readonly string[] = [
  'odysseeCycleJournal',
  'odysseeCycleReglages',
  /*
     `odysseeSexe` en est aussi, et le pilote l'a posé comme règle : le champ
     `sexe` suit celles du suivi — sous coffre, hors sauvegarde non chiffrée,
     aucun champ d'index en clair qui le révèle.

     La raison vaut peut-être davantage ici : un fichier en clair qui porte un
     magasin nommé `odysseeSexe` avec un seul enregistrement dit déjà que la
     personne a répondu, avant tout contenu.
  */
  'odysseeSexe',
];

/**
 * Les magasins qu'une sauvegarde emporte, selon qu'elle est chiffrée ou non.
 *
 * Un seul endroit décide, et `fabriquer` l'appelle : c'est ce qui empêche
 * qu'un second chemin d'export oublie l'exclusion.
 */
export function magasinsDUneSauvegarde(chiffree: boolean): readonly string[] {
  if (chiffree) return MAGASINS_SAUVEGARDES;
  return MAGASINS_SAUVEGARDES.filter((nom) => !MAGASINS_HORS_SAUVEGARDE_EN_CLAIR.includes(nom));
}

/** Vide tous les magasins de progression, dans une seule transaction. */
async function viderProgression(base: Awaited<ReturnType<typeof db>>) {
  const tx = base.transaction(MAGASINS_PROGRESSION, 'readwrite');
  await Promise.all(MAGASINS_PROGRESSION.map((nom) => tx.objectStore(nom).clear()));
  await tx.done;
}

/* --- Lecture et écriture brutes, pour la sauvegarde `.cyclades` ----------- */

/**
 * Tous les magasins de progression, tels qu'ils sont, sans mise en forme.
 *
 * ## Pourquoi une seconde voie d'export
 *
 * `exporterTout()` ci-dessous produit une forme **choisie** : des champs
 * renommés, un profil extrait, des sélections reconstituées. C'était le bon
 * choix pour un échange entre deux appareils de la même version. C'est le
 * mauvais choix pour une sauvegarde d'archive, qui doit pouvoir être relue par
 * une version future : tout champ que la forme choisie ne connaît pas est
 * perdu, et on ne s'en aperçoit qu'à la restauration.
 *
 * Cette voie-ci ne choisit rien. Elle rend le contenu de chaque magasin, et un
 * magasin ajouté demain y entre sans que ce code change.
 *
 * ## Le cas de « etat »
 *
 * C'est un magasin clé-valeur : la clé vit hors de l'objet, et `getAll` la
 * perdrait. Ses enregistrements sont donc rendus sous la forme
 * `{ clef, valeur }` — la même que celle du générateur de données
 * synthétiques, pour que les deux se relisent du même code.
 */
export async function exporterMagasins(
  noms: readonly string[] = MAGASINS_PROGRESSION,
): Promise<Record<string, unknown[]>> {
  const base = await db();
  const sortie: Record<string, unknown[]> = {};
  for (const nom of noms) {
    const magasin = nom as (typeof MAGASINS_PROGRESSION)[number];
    if (nom === 'etat') {
      const clefs = await base.getAllKeys('etat');
      const valeurs = await base.getAll('etat');
      sortie.etat = clefs.map((clef, i) => ({ clef, valeur: valeurs[i] }));
      continue;
    }
    sortie[nom] = await base.getAll(magasin);
  }
  return sortie;
}

/**
 * Remplace la progression par celle d'une sauvegarde.
 *
 * « Remplacer » veut dire ce qu'il dit : chaque magasin **connu** est vidé puis
 * rempli. Un magasin que cette version ne connaît pas est laissé de côté et
 * compté — une sauvegarde écrite par une version future ne doit pas faire
 * échouer la restauration, et ses magasins inconnus ne doivent pas non plus
 * être écrits à l'aveugle dans une base qui n'a pas de place pour eux.
 *
 * Il n'y a **pas** de mode fusion ici, et c'est délibéré : voir
 * `docs/cyclades/sauvegarde.md`. Fusionner demande une date de dernière
 * modification sur chaque enregistrement, que le modèle ne porte pas encore.
 */
export async function remplacerMagasins(
  magasins: Record<string, unknown[]>,
): Promise<{ ecrits: Record<string, number>; inconnus: string[] }> {
  const base = await db();
  const connus = new Set<string>(MAGASINS_PROGRESSION);
  const inconnus = Object.keys(magasins).filter((nom) => !connus.has(nom));

  /*
     UNE SEULE TRANSACTION, LE VIDAGE COMPRIS — B-1 du 58.

     Ce code vidait toute la progression hors transaction, puis réécrivait
     magasin par magasin, une transaction par magasin. Mesuré : une coupure
     au milieu laissait la base VIDÉE et la sauvegarde à moitié écrite —
     c'est-à-dire le pire des deux états, puisque ni l'ancien ni le nouveau
     n'est là. Une restauration est pourtant le geste qu'on fait quand on a
     déjà perdu quelque chose.

     Tout tient donc dans une transaction unique : si une écriture échoue,
     `abort()` rend la base telle qu'elle était, à l'enregistrement près.
     C'est la garantie qu'IndexedDB sait donner, et la seule qui vaille ici.

     Deux précautions pour qu'elle tienne vraiment :
     - **aucune attente étrangère à la transaction** entre deux écritures.
       Une transaction IndexedDB se valide d'elle-même dès que la boucle
       d'événements tourne sans requête en cours ; un `await` sur autre
       chose qu'une de ses opérations la refermerait au milieu, et le
       vidage serait acquis. C'est pourquoi l'instantané, la relecture du
       fichier et le journal se font AVANT ou APRÈS, jamais ici ;
     - **l'erreur d'origine est relancée**, et non celle de l'abandon : le
       `tx.done` d'une transaction abandonnée échoue lui aussi, et le laisser
       parler remplacerait la cause par sa conséquence.
  */
  const tx = base.transaction(MAGASINS_PROGRESSION, 'readwrite');
  const ecrits: Record<string, number> = {};
  try {
    for (const nom of MAGASINS_PROGRESSION) {
      const magasin = tx.objectStore(nom);
      // « Remplacer » : chaque magasin connu est vidé, même si la sauvegarde
      // ne le mentionne pas. C'était déjà le sens de `viderProgression`.
      await magasin.clear();
      const enregistrements = magasins[nom];
      if (!Array.isArray(enregistrements)) continue;
      for (const enr of enregistrements) {
        if (nom === 'etat') {
          const { clef, valeur } = enr as { clef: string; valeur: unknown };
          if (typeof clef === 'string') await magasin.put(valeur as never, clef);
        } else {
          await magasin.put(enr as never);
        }
      }
      ecrits[nom] = enregistrements.length;
    }
    await tx.done;
  } catch (cause) {
    try {
      tx.abort();
    } catch {
      // Déjà abandonnée ou déjà validée : il n'y a rien de plus à faire.
    }
    // On attend la fin de l'abandon pour que la base soit revenue en arrière
    // avant que l'appelant ne la relise, et on ignore son erreur à elle.
    await tx.done.catch(() => {});
    throw cause;
  }
  return { ecrits, inconnus };
}

/* --- Date de la dernière sauvegarde réussie ------------------------------- */

/**
 * Elle vit dans `etat`, donc elle **part dans la sauvegarde**.
 *
 * Ce qui a une conséquence voulue : restaurer une sauvegarde vieille de trois
 * mois ramène aussi « dernière sauvegarde il y a trois mois », et la bannière
 * de rappel se rallume aussitôt. C'est la vérité — l'état restauré n'a pas été
 * sauvegardé depuis — et c'est exactement le moment où il faut en refaire une.
 */
export async function lireDerniereSauvegarde(): Promise<string | null> {
  return ((await (await db()).get('etat', 'derniereSauvegarde')) as string | undefined) ?? null;
}

export async function ecrireDerniereSauvegarde(quand = new Date().toISOString()) {
  await (await db()).put('etat', quand, 'derniereSauvegarde');
  await noterReglageSynchronise('derniereSauvegarde', quand);
}

/** Sérialise l'intégralité de la progression (export JSON). */
export async function exporterTout() {
  const base = await db();
  return {
    format: 'revinsp-progression',
    version: 1,
    exporteLe: new Date().toISOString(),
    profil: await lireProfil(),
    cartes: await base.getAll('cartes'),
    fiches: await base.getAll('fiches'),
    quiz: await base.getAll('quiz'),
    jours: await base.getAll('jours'),
    nback: await base.getAll('nback'),
    seances: await base.getAll('seances'),
    qcmDgfip: await base.getAll('qcmDgfip'),
    qcmSessions: await base.getAll('qcmSessions'),
    relationnel: await base.getAll('relationnel'),
    vmSeuils: await base.getAll('vmSeuils'),
    vmSessions: await base.getAll('vmSessions'),
    journal: await base.getAll('journal'),
    competences: await base.getAll('competences'),
    difficultes: await base.getAll('difficultes'),
    aides: await base.getAll('aides'),
    planification: await lireReglagesPlanification(),
    reglagesSession: (await base.get('etat', 'reglagesSession')) as ReglagesSession | undefined,
    // Les sélections d'entraînement, une par exercice. Ce sont des préférences
    // et non de la progression, mais les perdre à chaque import obligerait à
    // tout recocher — autant les emporter.
    selections: Object.fromEntries(
      await Promise.all(
        (['relational-reasoning', 'veridical-mapping', 'quad-n-back'] as const).map(
          async (exercice) =>
            [exercice, (await base.get('etat', clefSelection(exercice))) as
              | SelectionEntrainement
              | undefined] as const,
        ),
      ),
    ),
  };
}

export type ExportProgression = Awaited<ReturnType<typeof exporterTout>>;

/**
 * Importe une sauvegarde.
 *  - mode « fusion » : conserve l'état le plus avancé pour chaque élément ;
 *  - mode « remplacement » : écrase toute la progression locale.
 */
export async function importerTout(donnees: ExportProgression, mode: 'fusion' | 'remplacement') {
  if (donnees?.format !== 'revinsp-progression') {
    throw new Error('Ce fichier n\'est pas une sauvegarde de progression valide.');
  }
  const base = await db();

  /*
     ╔══════════════════════════════════════════════════════════════════════╗
     ║  UNE SEULE TRANSACTION — A5 du prompt 43                             ║
     ╚══════════════════════════════════════════════════════════════════════╝

     Avant ce lot, cette fonction vidait la progression puis enchaînait une
     centaine d'écritures **indépendantes**. Une coupure au milieu — l'onglet
     fermé, le téléphone qui s'endort, la base pleine à la soixantième carte —
     laissait la base ni ancienne ni nouvelle : les cartes restaurées, les
     fiches vides, le journal perdu. C'est la pire des trois issues, et c'était
     la plus probable pour un import de cinq ans de révisions.

     Tout passe maintenant par une transaction unique sur `MAGASINS_PROGRESSION`,
     le vidage compris.

     **Et la transaction ne suffit pas.** Mesuré par l'essai, et c'est le genre
     de chose qu'on croit acquis : quand une erreur est levée par *notre* code
     au milieu — une donnée refusée, une base pleine qui remonte par une
     exception, un défaut — IndexedDB n'annule rien. Les requêtes déjà passées
     n'ont plus de requête en attente derrière elles, la transaction se valide
     d'office, et la base garde le vidage plus les quelques écritures faites.
     L'essai a montré exactement cela : une carte restaurée, les deux d'avant
     disparues. Il faut donc **annuler explicitement** — `tx.abort()` — puis
     relancer l'erreur d'origine. Le navigateur annule de lui-même quand c'est
     une *requête* qui échoue ; il ne devine pas nos exceptions.

     **Ce qui en découle, et qu'il faut savoir en lisant la suite** : on
     n'attend plus rien d'autre que les requêtes de cette transaction. Attendre
     une promesse étrangère — un chiffrement, une lecture de fichier — rendrait
     la main au navigateur, qui validerait la transaction d'office et la
     fermerait au milieu. C'est pourquoi les lectures passent par
     `tx.objectStore(...)` et non par `base`, et pourquoi les trois réglages de
     la fin sont écrits ici puis seulement **notés** au registre de
     synchronisation, après la validation.
  */
  const tx = base.transaction(MAGASINS_PROGRESSION, 'readwrite');

  // « Remplacement » veut dire ce qu'il dit : on efface **toute** la progression
  // locale avant de restaurer, sans quoi les magasins non vidés accumuleraient
  // les enregistrements importés par-dessus les anciens. Le vidage est dans la
  // transaction : annulée, il est annulé avec elle.
  if (mode === 'remplacement') {
    await Promise.all(MAGASINS_PROGRESSION.map((nom) => tx.objectStore(nom).clear()));
  }

  /*
     Tout le corps est dans un `try`, et c'est l'annulation qui compte, pas
     l'élégance : une exception de notre côté ne fait rien annuler au
     navigateur, il faut le lui demander.

     La restauration n'est **pas** découpée en une fonction à part, bien que
     cela éviterait d'indenter deux cents lignes : le type de la transaction
     d'`idb` ne se nomme pas sans importer ses génériques, et une signature
     approximative — j'ai essayé — rend vingt-neuf erreurs de typage et perd
     précisément la vérification qui rend ce code lisible. Un cran
     d'indentation est moins cher.
  */
  try {
  const profilLocal: Profil = {
    ...PROFIL_PAR_DEFAUT,
    ...(((await tx.objectStore('etat').get('profil')) as Partial<Profil> | undefined) ?? {}),
  };
  const profilImporte = { ...PROFIL_PAR_DEFAUT, ...(donnees.profil ?? {}) };
  await tx.objectStore('etat').put(
    mode === 'remplacement'
      ? profilImporte
      : {
          ...profilLocal,
          xp: Math.max(profilLocal.xp, profilImporte.xp),
          streakCourante: Math.max(profilLocal.streakCourante, profilImporte.streakCourante),
          streakRecord: Math.max(profilLocal.streakRecord, profilImporte.streakRecord),
          dernierJourEtudie: [profilLocal.dernierJourEtudie, profilImporte.dernierJourEtudie]
            .filter(Boolean)
            .sort()
            .pop() as string | null,
          badges: [...new Set([...profilLocal.badges, ...profilImporte.badges])],
          creeLe: [profilLocal.creeLe, profilImporte.creeLe].filter(Boolean).sort()[0],
          /*
             Le jour de grâce : on garde LE PLUS RÉCENT des deux. Prendre le
             plus ancien — ou laisser tomber celui du fichier — rendrait une
             grâce déjà consommée ailleurs, et la fusion offrirait deux
             oublis par semaine à qui importe une sauvegarde.
          */
          graceUtiliseeLe:
            ([profilLocal.graceUtiliseeLe, profilImporte.graceUtiliseeLe]
              .filter(Boolean)
              .sort()
              .pop() as string | undefined) ?? null,
        },
    'profil',
  );

  for (const carte of donnees.cartes ?? []) {
    const locale = mode === 'fusion' ? await tx.objectStore('cartes').get(carte.id) : undefined;
    // En fusion, on garde la révision la plus récente.
    const gagnante =
      locale && (locale.derniereRevision ?? '') > (carte.derniereRevision ?? '') ? locale : carte;
    await tx.objectStore('cartes').put(gagnante);
  }

  for (const fiche of donnees.fiches ?? []) {
    const locale = mode === 'fusion' ? await tx.objectStore('fiches').get(fiche.id) : undefined;
    await tx.objectStore('fiches').put({
      ...fiche,
      lu: Boolean(locale?.lu || fiche.lu),
      secondes: Math.max(locale?.secondes ?? 0, fiche.secondes ?? 0),
      derniereOuverture: [locale?.derniereOuverture, fiche.derniereOuverture]
        .filter(Boolean)
        .sort()
        .pop() as string | null,
    });
  }

  // Niveaux et difficultés : en fusion, la mise à jour la plus récente gagne.
  // Moyenner deux estimations indépendantes donnerait une note qu'aucune des
  // deux histoires ne justifie.
  for (const competence of donnees.competences ?? []) {
    const locale = mode === 'fusion' ? await tx.objectStore('competences').get(competence.clef) : undefined;
    await tx.objectStore('competences').put(locale && locale.majLe > competence.majLe ? locale : competence,
    );
  }
  for (const item of donnees.difficultes ?? []) {
    const locale = mode === 'fusion' ? await tx.objectStore('difficultes').get(item.id) : undefined;
    await tx.objectStore('difficultes').put(locale && locale.majLe > item.majLe ? locale : item);
  }

  for (const entree of donnees.journal ?? []) {
    const locale = mode === 'fusion' ? await tx.objectStore('journal').get(entree.id) : undefined;
    // En fusion, l'entrée la plus récemment fautive l'emporte — et une entrée
    // encore ouverte d'un côté le reste : perdre un point faible à l'occasion
    // d'une restauration serait perdre précisément ce que le journal garde.
    const gagnante =
      locale && (locale.derniereErreurLe ?? '') > (entree.derniereErreurLe ?? '') ? locale : entree;
    if (locale && (!locale.fermeeLe || !entree.fermeeLe)) {
      const { fermeeLe: _refermee, ...ouverte } = gagnante;
      await tx.objectStore('journal').put({ ...ouverte, reussites: 0, derniereSession: null });
    } else {
      await tx.objectStore('journal').put(gagnante);
    }
  }

  if (mode === 'fusion') {
    // Les résultats de quiz sont des événements : on ne dédoublonne que par
    // couple (fiche, horodatage) pour éviter les doublons d'import répété.
    const existants = new Set((await tx.objectStore('quiz').getAll()).map((q) => `${q.ficheId}|${q.le}`));
    for (const q of donnees.quiz ?? []) {
      if (existants.has(`${q.ficheId}|${q.le}`)) continue;
      const { id: _ignore, ...sansId } = q;
      await tx.objectStore('quiz').add(identifie(sansId) as ResultatQuiz);
    }
    // Les séances sont identifiées par le couple (jour, thème) : deux séances
    // du même thème le même jour sont forcément la même.
    const seancesExistantes = new Set((await tx.objectStore('seances').getAll()).map((s) => `${s.jour}|${s.theme}`));
    for (const seance of donnees.seances ?? []) {
      if (seancesExistantes.has(`${seance.jour}|${seance.theme}`)) continue;
      const { id: _ignore, ...sansId } = seance;
      await tx.objectStore('seances').add(identifie(sansId) as Seance);
    }
    const sessionsExistantes = new Set((await tx.objectStore('nback').getAll()).map((s) => s.le));
    for (const session of donnees.nback ?? []) {
      if (sessionsExistantes.has(session.le)) continue;
      const { id: _ignore, ...sansId } = session;
      await tx.objectStore('nback').add(identifie(sansId) as SessionNBack);
    }
    const relationnellesExistantes = new Set((await tx.objectStore('relationnel').getAll()).map((s) => s.le));
    for (const session of donnees.relationnel ?? []) {
      if (relationnellesExistantes.has(session.le)) continue;
      const { id: _ignore, ...sansId } = session;
      await tx.objectStore('relationnel').add(identifie(sansId) as SessionRelationnelle);
    }
    // Les seuils ne s'additionnent pas : on garde celui dont l'escalier a vu le
    // plus d'essais, puisque c'est lui le mieux estimé.
    for (const seuil of donnees.vmSeuils ?? []) {
      const local = await tx.objectStore('vmSeuils').get(seuil.id);
      if (!local || seuil.escalier.essais > local.escalier.essais) {
        await tx.objectStore('vmSeuils').put(seuil);
      }
    }
    const vmExistantes = new Set((await tx.objectStore('vmSessions').getAll()).map((s) => s.le));
    for (const session of donnees.vmSessions ?? []) {
      if (vmExistantes.has(session.le)) continue;
      const { id: _ignore, ...sansId } = session;
      await tx.objectStore('vmSessions').add(identifie(sansId) as SessionVeridical);
    }
    // QCM DGFiP : les compteurs par question s'additionnent, l'appareil le
    // plus avancé n'étant pas forcément le même selon la question.
    for (const etat of donnees.qcmDgfip ?? []) {
      const local = await tx.objectStore('qcmDgfip').get(etat.id);
      await tx.objectStore('qcmDgfip').put({
        id: etat.id,
        rubriqueId: etat.rubriqueId || local?.rubriqueId || '',
        vues: Math.max(local?.vues ?? 0, etat.vues),
        bonnes: Math.max(local?.bonnes ?? 0, etat.bonnes),
        mauvaises: Math.max(local?.mauvaises ?? 0, etat.mauvaises),
        abstentions: Math.max(local?.abstentions ?? 0, etat.abstentions),
        derniereLe:
          !local || etat.derniereLe > local.derniereLe ? etat.derniereLe : local.derniereLe,
      });
    }
    const sessionsDgfipExistantes = new Set((await tx.objectStore('qcmSessions').getAll()).map((s) => s.le));
    for (const session of donnees.qcmSessions ?? []) {
      if (sessionsDgfipExistantes.has(session.le)) continue;
      const { id: _ignore, ...sansId } = session;
      await tx.objectStore('qcmSessions').add(identifie(sansId) as SessionDgfip);
    }
    for (const j of donnees.jours ?? []) {
      const local = await tx.objectStore('jours').get(j.jour);
      await tx.objectStore('jours').put({
        jour: j.jour,
        xp: Math.max(local?.xp ?? 0, j.xp),
        cartes: Math.max(local?.cartes ?? 0, j.cartes),
        quiz: Math.max(local?.quiz ?? 0, j.quiz),
        bonnes: Math.max(local?.bonnes ?? 0, j.bonnes),
        reponses: Math.max(local?.reponses ?? 0, j.reponses),
        secondes: Math.max(local?.secondes ?? 0, j.secondes),
      });
    }
  } else {
    for (const q of donnees.quiz ?? []) {
      const { id: _ignore, ...sansId } = q;
      await tx.objectStore('quiz').add(identifie(sansId) as ResultatQuiz);
    }
    for (const j of donnees.jours ?? []) await tx.objectStore('jours').put(j);
    for (const session of donnees.nback ?? []) {
      const { id: _ignore, ...sansId } = session;
      await tx.objectStore('nback').add(identifie(sansId) as SessionNBack);
    }
    for (const seance of donnees.seances ?? []) {
      const { id: _ignore, ...sansId } = seance;
      await tx.objectStore('seances').add(identifie(sansId) as Seance);
    }
    for (const etat of donnees.qcmDgfip ?? []) await tx.objectStore('qcmDgfip').put(etat);
    for (const session of donnees.qcmSessions ?? []) {
      const { id: _ignore, ...sansId } = session;
      await tx.objectStore('qcmSessions').add(identifie(sansId) as SessionDgfip);
    }
    for (const session of donnees.relationnel ?? []) {
      const { id: _ignore, ...sansId } = session;
      await tx.objectStore('relationnel').add(identifie(sansId) as SessionRelationnelle);
    }
    for (const seuil of donnees.vmSeuils ?? []) await tx.objectStore('vmSeuils').put(seuil);
    for (const session of donnees.vmSessions ?? []) {
      const { id: _ignore, ...sansId } = session;
      await tx.objectStore('vmSessions').add(identifie(sansId) as SessionVeridical);
    }
  }

  // Les demandes d'aide, dans les deux modes : une trace ne se fusionne pas,
  // elle s'ajoute, et le couple horodatage + item suffit à ne pas la doubler.
  const aidesConnues = new Set(
    (await tx.objectStore('aides').getAll()).map((a) => `${a.le}|${a.itemId ?? ''}`),
  );
  for (const aide of donnees.aides ?? []) {
    if (aidesConnues.has(`${aide.le}|${aide.itemId ?? ''}`)) continue;
    const { id: _ignore, ...sansId } = aide;
    await tx.objectStore('aides').add(identifie(sansId) as AideDemandee);
  }

  /*
     Les trois réglages passent par la transaction, et non par leurs fonctions
     d'écriture : celles-ci ouvrent chacune la leur, ce qui rouvrirait la porte
     qu'on vient de fermer. Leur second geste — la note au registre de
     synchronisation — n'est pas de la progression et attend la validation.
  */
  if (donnees.planification)
    await tx.objectStore('etat').put(donnees.planification, 'planification');
  if (donnees.reglagesSession)
    await tx.objectStore('etat').put(donnees.reglagesSession, 'reglagesSession');
  for (const [exercice, selection] of Object.entries(donnees.selections ?? {})) {
    if (selection) await tx.objectStore('etat').put(selection, clefSelection(exercice));
  }

    /*
       Le point de bascule : tant que cette ligne n'a pas rendu, rien n'est
       acquis ; passée, tout l'est.
    */
    await tx.done;
  } catch (erreur) {
    /*
       L'annulation explicite, et la raison d'origine conservée. `abort()` jette
       si la transaction est déjà close — c'est le cas quand l'échec venait
       d'une requête, que le navigateur a déjà annulée — et ce second échec ne
       doit pas masquer le premier.
    */
    try {
      tx.abort();
    } catch {
      /* déjà annulée, ou déjà validée : rien à faire de plus */
    }
    throw erreur;
  }

  /* Après la validation seulement : les notes au registre de synchronisation. */
  if (donnees.planification) await noterReglageSynchronise('planification', donnees.planification);
  if (donnees.reglagesSession)
    await noterReglageSynchronise('reglagesSession', donnees.reglagesSession);
  for (const [exercice, selection] of Object.entries(donnees.selections ?? {})) {
    if (selection) await noterReglageSynchronise(clefSelection(exercice), selection);
  }
}

/**
 * Efface les seules données de Veridical Mapping.
 *
 * L'outil de référence prévoit un effacement manuel ; on le garde, mais borné à
 * cette rubrique, pour qu'on puisse repartir de zéro sur les seuils sans perdre
 * les fiches, les flashcards et le reste de la progression.
 */
export async function effacerVeridical() {
  const base = await db();
  const tx = base.transaction(['vmSeuils', 'vmSessions'], 'readwrite');
  await Promise.all([tx.objectStore('vmSeuils').clear(), tx.objectStore('vmSessions').clear()]);
  await tx.done;
}

/** Efface toute la progression locale (bouton « tout réinitialiser »). */
export async function toutEffacer() {
  await viderProgression(await db());
}
