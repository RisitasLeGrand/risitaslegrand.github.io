/**
 * Ce qu'Odyssée possède en propre.
 *
 * ## Pourquoi un fichier de types séparé de « db.ts »
 *
 * `db.ts` porte le schéma de Révisions depuis le premier jour, et il fait déjà
 * mille sept cents lignes. Y verser cinq magasins de plus mêlerait deux
 * branches dans le fichier que tout le site importe. Les formes sont donc
 * déclarées ici, dans la branche qui les possède ; `db.ts` ne connaît que leur
 * nom et leurs index, ce qui est le minimum pour ouvrir la base.
 *
 * ## Le vocabulaire, et pourquoi il n'est pas interchangeable
 *
 * | Objet | Ce qui le distingue |
 * |---|---|
 * | **Tâche** | Une chose à faire **une fois**. Elle a une échéance, elle se clôt. |
 * | **Quête** | Une chose à refaire **à chaque jour ou à chaque semaine**. Elle ne se clôt pas, elle se tient ou non. |
 * | **Événement** | Une chose qui occupe un **moment donné**. Elle vient souvent d'un agenda. |
 * | **Focus** | Un **temps mesuré** de concentration, rattaché à un domaine. |
 * | **Revue** | Un **rendez-vous avec soi-même**, hebdomadaire ou plus long. |
 *
 * Confondre tâche et quête serait la première erreur, et elle coûterait cher :
 * une quête close disparaîtrait, une tâche répétée s'accumulerait. Le plancher
 * du jour se calcule sur les quêtes ; l'arriéré, sur les tâches.
 *
 * ## Les dates
 *
 * Un **jour logique** (`AAAA-MM-JJ`) partout où la chose appartient à une
 * journée — une quête tenue, un plancher atteint. Un **instant ISO** partout où
 * elle a une heure — un événement, un focus. Mélanger les deux obligerait
 * chaque lecture à deviner, et le jour logique bascule à 4 h : « hier soir à
 * 2 h » appartient à la veille, et seule la conversion explicite le sait.
 */
import type { IdDomaine } from '../noyau/domaines';
import { problemesDeLaSerie, type Serie } from './repetition';

/** L'identité commune : un ULID, et de quoi fusionner. */
export interface Possede {
  id: string;
  /** Instant ISO de la dernière écriture, pour l'affichage — la fusion, elle, lit l'horloge logique. */
  majLe: string;
}

/* ════════════════════════════════════════════════════════════════════════
   Les tâches
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Une tâche.
 *
 * `faiteLe` porte le **jour logique** de la clôture, et `null` tant qu'elle
 * est ouverte. Un booléen aurait suffi à l'affichage et aurait perdu la seule
 * information qui compte ensuite : **quand**. Sans elle, aucun indicateur ne
 * peut dire combien de tâches ont été closes la semaine dernière.
 */
export interface Tache extends Possede {
  titre: string;
  domaine: IdDomaine;
  /** Jour logique d'échéance, ou `null` : une tâche sans date n'est pas en retard. */
  echeance: string | null;
  faiteLe: string | null;
  /**
   * Jour logique de l'abandon, ou `null`.
   *
   * Renoncer n'est pas oublier. Une tâche abandonnée quitte l'arriéré — elle
   * ne reparaît plus dans « Que faire maintenant ? » — **sans** être
   * supprimée : elle compte dans le suivi du plan tenu, du côté de ce qui
   * n'a pas été fait, et la supprimer ferait remonter le taux de réalisation
   * à chaque renoncement. C'est exactement l'inverse de ce qu'un suivi doit
   * faire.
   */
  abandonneeLe: string | null;
  /** Pourquoi on y a renoncé. Exigé à l'abandon, `null` sinon. */
  motifAbandon: MotifNonFait | null;
  /** Texte libre, jamais obligatoire. */
  note: string;
  creeeLe: string;

  /* --- Prompt 38 : la répétition, les étapes, le lien de branche ---------
     Les quatre champs sont FACULTATIFS, et c'est ce qui rend la migration
     inutile : une tâche écrite avant ce lot reste valide telle quelle, et
     `undefined` s'y lit « tâche simple, sans étapes, sans lien ». Les rendre
     obligatoires aurait imposé de réécrire chaque ligne existante pour y
     poser des valeurs vides — une migration destructive pour rien. */

  /**
   * La série qui engendre les occurrences, ou rien pour une tâche unique.
   *
   * Nommée `serie` et non `repetition` : le type `Serie` porte déjà un champ
   * `repetition` qui est la **règle**, et `tache.repetition.repetition.type`
   * aurait été illisible. La série est le tout — ancre, règle, fin, heure ;
   * la répétition n'en est que la règle.
   *
   * **Une tâche à série laisse `echeance` à `null`.** Les deux porteraient la
   * même information sous deux formes, et la première qui change ferait
   * mentir l'autre. L'échéance d'une tâche répétée est celle de chacune de
   * ses occurrences, calculée, jamais stockée.
   */
  serie?: Serie | null;

  /**
   * Les étapes à cocher, dans l'ordre. Vide ou absent pour une tâche simple.
   *
   * Portées **par la tâche** et non par un magasin : une étape n'existe pas
   * sans sa tâche, elle n'a pas de vie propre, et la liste se lit toujours
   * entière. Ce qui est journalisé à part, c'est le **cochage** — parce que
   * lui dépend de l'occurrence, et que deux appareils peuvent en cocher
   * chacun un.
   */
  etapes?: readonly Etape[];

  /** Le lien vers une branche, ou rien. Voir `LienDeBranche`. */
  lien?: LienDeBranche | null;

  /**
   * Une occurrence manquée est-elle rattrapable ?
   *
   * Décision 3 du prompt 38 : par défaut une occurrence manquée passe « non
   * faite » et **ne s'accumule pas** — trente occurrences manquées ne font
   * pas trente tâches en retard. Ce drapeau est l'exception par tâche, pour
   * celles qu'il faut vraiment rattraper.
   */
  reporter?: boolean;
}

/**
 * Une étape d'une tâche à étapes.
 *
 * `rang` plutôt que l'ordre du tableau : réordonner par déplacement dans le
 * tableau ferait de chaque réordonnancement une réécriture complète de la
 * tâche, donc un conflit garanti dès que deux appareils en réordonnent une.
 * Un rang par étape laisse la fusion travailler champ par champ.
 */
export interface Etape {
  /** ULID, stable pour la vie de l'étape : c'est lui que le cochage vise. */
  id: string;
  intitule: string;
  /** Croissant. Pas forcément contigu — on insère entre deux. */
  rang: number;
}

/**
 * Le lien d'une tâche vers une branche, et ce que « pointer » y veut dire.
 *
 * `action` est l'identifiant d'un geste de la branche (« séance de sport »,
 * « check-in »), pas une phrase. Les paramètres figés à la création du lien
 * viendront en phase 5 ; ils ne sont pas ici parce qu'aucune décision ne les
 * a encore définis, et qu'un champ inventé d'avance est un champ qu'on
 * remplit mal.
 */
export interface LienDeBranche {
  /** L'identifiant de la branche, tel que les faits le portent. */
  branche: string;
  /** Le geste visé dans cette branche. */
  action: string;
  /**
   * L'objet précis que le geste touche, quand la branche en exige un.
   *
   * Une quête se tient : encore faut-il savoir **laquelle**. Sans cible, le
   * pointage ne choisit pas au hasard, il ne fait rien et le dit. Le champ
   * est optionnel parce que la plupart des actions n'en ont pas besoin —
   * une séance de sport se crée sans viser une séance existante.
   */
  cible?: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les occurrences — prompt 38
   ══════════════════════════════════════════════════════════════════════════ */

/** Ce qui est arrivé à une occurrence, et qui justifie de l'enregistrer. */
export type EtatDOccurrence = 'pointee' | 'abandonnee' | 'deplacee' | 'modifiee';

/**
 * Une **exception** d'une série : la seule chose qu'on enregistre.
 *
 * Les occurrences ordinaires sont **calculées** par `odyssee/repetition.ts` et
 * ne touchent jamais la base. N'existent ici que celles qui s'écartent de la
 * règle — pointée, abandonnée, déplacée, modifiée.
 *
 * ## Pourquoi un enregistrement à part, et non un champ de la série
 *
 * Si les exceptions vivaient **dans** la tâche, « l'appareil A déplace
 * l'occurrence du 12 » et « l'appareil B change l'heure de la série »
 * seraient deux écritures sur la **même cible**, et la seconde effacerait la
 * première en silence, sans conflit levé. Deux cibles distinctes, deux
 * écritures qui survivent.
 *
 * ## Pourquoi l'identifiant est déterministe, et non un ULID
 *
 * `id` vaut `«tacheId»/«jourPrevu»`. C'est la contrepartie exacte du
 * raisonnement ci-dessus : deux appareils qui pointent **la même** occurrence
 * doivent viser la **même** cible, sans quoi la fusion garderait deux lignes
 * pour un seul geste et l'écran afficherait deux fois « fait ». La règle de
 * fusion — pour chaque cible, la dernière opération l'emporte et porte tout
 * l'enregistrement — fait alors exactement ce qu'il faut.
 *
 * C'est une dérogation assumée à l'ULID de `Possede` : l'identifiant est ici
 * une **clé métier**, parce que la cible de fusion doit l'être.
 *
 * ## Aucun texte libre, et c'est une contrainte, pas un oubli
 *
 * Décision 3 du prompt 38 : les occurrences voyagent « en clair et sans
 * libellé ». Un champ de note suffirait à faire fuiter ce que le magasin
 * scellé protège. `motifAbandon` est une énumération fermée, pas du texte.
 */
export interface Occurrence extends Possede {
  tacheId: string;
  /** Le jour logique où la règle la prévoyait. Avec `tacheId`, la clé. */
  jourPrevu: string;
  etat: EtatDOccurrence;
  /** « Déplacée » : le jour logique d'arrivée. `null` sinon. */
  jourPorte: string | null;
  /** « Modifiée » : l'heure murale qui remplace celle de la série. `null` sinon. */
  heure: string | null;
  /** L'instant du geste — pointage ou abandon. `null` pour un simple déplacement. */
  le: string | null;
  /** Exigé à l'abandon, `null` sinon. Une énumération, jamais du texte. */
  motifAbandon: MotifNonFait | null;
}

/**
 * Une étape cochée, pour **une occurrence donnée**.
 *
 * « Chaque occurrence repart d'une liste décochée » : c'est ce que dit le
 * prompt, et c'est ce que cette forme impose. Le cochage ne vit pas dans
 * l'étape — qui est portée par la tâche et vaut pour toutes les occurrences —
 * mais dans un enregistrement qui porte le jour.
 *
 * Identifiant déterministe, pour la même raison que l'occurrence :
 * `«tacheId»/«jourPrevu»/«etapeId»`.
 */
export interface EtapeCochee extends Possede {
  tacheId: string;
  jourPrevu: string;
  etapeId: string;
  /** L'instant du cochage. */
  le: string;
}

/**
 * Une exception d'une tâche liée à une branche **sous coffre**.
 *
 * Décision 3 du prompt 38, dans la variante retenue : les occurrences voyagent
 * en clair et sans libellé, **sauf** celles des tâches liées à une branche
 * scellée, qui sont scellées aussi — une occurrence quotidienne à 8 h liée à
 * une branche sensible révèle un rythme, même sans libellé.
 *
 * ## Pourquoi un seul magasin pour deux formes
 *
 * Le scellement est déclaré **par magasin**, jamais par enregistrement :
 * `sceller()` lève si le magasin n'est pas déclaré scellé, et tout ce qui
 * n'est pas listé clair part dans le chiffré. Il faut donc un magasin à part
 * pour ce qui doit être scellé — mais **un seul suffit pour les deux formes**,
 * puisque tout, sauf `id` et `majLe`, finit dans le même bloc chiffré opaque.
 * Deux magasins scellés auraient dupliqué la déclaration, le contrôle et la
 * sauvegarde pour une distinction que le chiffrement efface.
 *
 * ## Ce que ce scellement NE protège PAS, et il faut le dire
 *
 * L'identifiant reste en clair — c'est la clé, `controlerCoffre()` l'exige —
 * et il vaut `«tacheId»/«jourPrevu»`. Il révèle donc qu'il s'est passé quelque
 * chose pour cette tâche ce jour-là.
 *
 * **Ce n'est pas une fuite nouvelle** : la tâche elle-même vit en clair dans
 * `odysseeTaches`, avec son titre et son lien de branche. Autrement dit, la
 * protection apportée ici est **partielle par construction**, et le maillon
 * faible est la tâche, pas son occurrence. Le dire est plus utile que de
 * bâtir une clé opaque qui protégerait une porte en en laissant une autre
 * grande ouverte à côté. C'est une ligne pour le tableau suivant.
 */
export type ExceptionScellee =
  | ({ genre: 'occurrence' } & Occurrence)
  | ({ genre: 'etape' } & EtapeCochee);

/**
 * Un pointage retenu **coffre fermé**, à reporter à son ouverture.
 *
 * Décision 5 du prompt 38 : pointer doit rester un geste, même quand la
 * branche visée est scellée et que le coffre est fermé. Le pointage est donc
 * gardé ici, avec son heure, et reporté dans la branche à la prochaine
 * ouverture.
 *
 * Ce magasin est **scellé** : il porte, par construction, le fait qu'un geste
 * a été fait dans une branche sensible. Le laisser en clair annulerait la
 * décision qu'il sert.
 */
export interface ReportEnAttente extends Possede {
  tacheId: string;
  jourPrevu: string;
  /** L'instant du geste. C'est lui qu'on garde — « fait à 8 h 05 ». */
  le: string;
  /** La branche où l'écriture devra avoir lieu. */
  branche: string;
  /** L'instant du report effectif, ou `null` tant qu'il attend. */
  reporteLe: string | null;
}

/* ════════════════════════════════════════════════════════════════════════
   Les quêtes
   ════════════════════════════════════════════════════════════════════════ */

export type Cadence = 'jour' | 'semaine';

export const CADENCES: readonly Cadence[] = ['jour', 'semaine'];

/**
 * Une quête : ce qu'on se propose de tenir, et non de finir.
 *
 * `tenues` est la liste des jours logiques où elle l'a été — pour une quête
 * hebdomadaire, le jour où la semaine a été validée. Garder la liste plutôt
 * qu'un compteur coûte quelques octets et permet tout le reste : la série, le
 * plancher du jour, la tendance, et la correction d'une erreur de saisie. Un
 * compteur ne se corrige pas, il se croit.
 *
 * `active` plutôt qu'une suppression : une quête qu'on cesse de tenir garde son
 * histoire, et la roue d'équilibre ne doit pas voir un trou là où il y a eu un
 * renoncement assumé.
 */
export interface Quete extends Possede {
  titre: string;
  domaine: IdDomaine;
  cadence: Cadence;
  active: boolean;
  /** Jours logiques où la quête a été tenue, triés, sans doublon. */
  tenues: string[];
  creeeLe: string;
}

/* ════════════════════════════════════════════════════════════════════════
   Les événements
   ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
   Le relevé : ce qui était prévu a-t-il eu lieu ?
   ════════════════════════════════════════════════════════════════════════ */

/**
 * L'écart entre le plan et le réel, dit par la personne.
 *
 * ## Pourquoi `inconnu` est une valeur et non une absence
 *
 * Un agenda dit ce qui était **prévu**. Sans relevé, le site ne peut que le
 * supposer vécu — et c'est ce qu'il faisait, en marquant les faits `estime`.
 * Mais « je ne sais pas » et « ce n'était pas fait » sont deux choses
 * différentes, et les confondre fabriquerait un taux de réalisation faux dans
 * les deux sens : à la baisse si l'on compte tout ce qui n'est pas relevé
 * comme non fait, à la hausse si l'on compte tout comme fait.
 *
 * `inconnu` est donc la valeur de départ, elle est **comptée à part**, et le
 * taux de réalisation ne porte que sur ce qui a été relevé.
 *
 * ## Pourquoi « partiel » existe
 *
 * Sans lui, une séance de deux heures écourtée à vingt minutes obligerait à
 * mentir dans un sens ou dans l'autre. Et c'est le cas le plus fréquent : la
 * plupart des plans ne sont ni tenus ni abandonnés, ils sont rognés.
 */
export type Realisation = 'inconnu' | 'fait' | 'partiel' | 'non-fait';

export const REALISATIONS: readonly Realisation[] = ['inconnu', 'fait', 'partiel', 'non-fait'];

export const LIBELLE_REALISATION: Record<Realisation, string> = {
  inconnu: 'Pas encore dit',
  fait: 'Fait',
  partiel: 'En partie',
  'non-fait': 'Pas fait',
};

/* ════════════════════════════════════════════════════════════════════════
   Pourquoi cela n'a pas eu lieu
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Les motifs d'un plan non tenu.
 *
 * ## Pourquoi une liste déclarée, et pas seulement un texte libre
 *
 * Un texte libre dit tout et ne se compte pas. « Odyssée doit savoir
 * pourquoi » ne veut rien dire si la réponse n'est lisible que par un humain
 * qui relirait trois ans de notes : il faut que la raison dominante se
 * **calcule**. La liste est donc fermée — et le texte libre existe à côté,
 * pour ce que la liste ne dit pas.
 *
 * ## Pourquoi ces motifs-là
 *
 * Ils couvrent les causes réelles d'un plan qui tombe, et ils sont rangés du
 * plus extérieur au plus intérieur. Deux choix méritent d'être défendus :
 *
 * **`trop-ambitieux` met en cause le plan, pas la personne.** C'est le motif
 * le plus utile de la liste, parce que c'est celui qui débouche sur une
 * correction — planifier moins —, là où « je n'ai pas réussi » ne débouche sur
 * rien. Sans lui, tout échec de planification se lirait comme un échec de
 * volonté.
 *
 * **`sans-envie` existe, et il est dit sans détour.** L'omettre forcerait à
 * choisir un motif faux, et un suivi qu'on remplit de travers ne vaut rien.
 * Il n'est pas plus mal noté qu'un autre : aucun motif ne l'est, parce que ce
 * relevé n'est pas une note.
 */
export type MotifNonFait =
  | 'imprevu'
  | 'annule-par-autrui'
  | 'manque-de-temps'
  | 'trop-ambitieux'
  | 'sante'
  | 'fatigue'
  | 'sans-envie'
  | 'priorite-changee'
  | 'oubli'
  | 'autre';

export interface Motif {
  id: MotifNonFait;
  libelle: string;
  /** Ce qu'il recouvre, pour que deux motifs voisins ne soient pas confondus. */
  precision: string;
}

export const MOTIFS: readonly Motif[] = [
  {
    id: 'imprevu',
    libelle: 'Un imprévu',
    precision: 'Quelque chose d’autre s’est imposé, hors de votre main.',
  },
  {
    id: 'annule-par-autrui',
    libelle: 'Annulé par quelqu’un d’autre',
    precision: 'Ce n’est pas vous qui avez renoncé.',
  },
  {
    id: 'manque-de-temps',
    libelle: 'Pas eu le temps',
    precision: 'La journée était pleine ; rien ne s’est substitué en particulier.',
  },
  {
    id: 'trop-ambitieux',
    libelle: 'Le plan était trop chargé',
    precision: 'Ce n’était pas tenable au départ. C’est le plan qu’il faut revoir.',
  },
  {
    id: 'sante',
    libelle: 'Santé',
    precision: 'Douleur, maladie, rendez-vous médical.',
  },
  {
    id: 'fatigue',
    libelle: 'Trop fatigué',
    precision: 'Possible sur le papier, hors d’atteinte ce jour-là.',
  },
  {
    id: 'sans-envie',
    libelle: 'Pas eu envie',
    precision: 'Dit sans détour : un suivi qu’on remplit de travers ne vaut rien.',
  },
  {
    id: 'priorite-changee',
    libelle: 'Ce n’était plus la priorité',
    precision: 'Vous avez fait autre chose, et c’était le bon choix.',
  },
  {
    id: 'oubli',
    libelle: 'Oublié',
    precision: 'Jamais revenu à l’esprit au bon moment.',
  },
  {
    id: 'autre',
    libelle: 'Autre',
    precision: 'À préciser en deux mots.',
  },
];

const MOTIF_PAR_ID = new Map(MOTIFS.map((m) => [m.id, m]));

export const motif = (id: string): Motif | undefined =>
  MOTIF_PAR_ID.get(id as MotifNonFait);

export const libelleDuMotif = (id: string): string => MOTIF_PAR_ID.get(id as MotifNonFait)?.libelle ?? id;

/**
 * Un événement d'agenda.
 *
 * `uidIcs` est l'identifiant que porte l'événement dans le fichier dont il
 * vient. Il n'est pas décoratif : réimporter le même agenda doit **mettre à
 * jour** les événements déjà connus, pas les dupliquer. Un événement saisi à
 * la main n'en a pas, et c'est ce qui le protège d'être écrasé par un import.
 *
 * `realise` porte le relevé — voir `Realisation`. Il n'est **jamais** déduit :
 * un événement passé reste `inconnu` tant que la personne n'a pas répondu.
 */
export interface Evenement extends Possede {
  titre: string;
  domaine: IdDomaine;
  /** Instant ISO de début. */
  debut: string;
  /** Instant ISO de fin. Jamais antérieur au début — « controlerEvenement » le vérifie. */
  fin: string;
  /** Vrai pour un événement qui occupe la journée entière : les heures n'ont alors pas de sens. */
  journeeEntiere: boolean;
  lieu: string;
  note: string;
  uidIcs: string | null;
  realise: Realisation;
  /** Instant du relevé, pour distinguer « répondu » de « jamais ouvert ». */
  releveLe: string | null;
  /**
   * Pourquoi cela n'a pas eu lieu, ou pas entièrement.
   *
   * Exigé quand `realise` vaut `non-fait` — c'est tout l'intérêt du relevé —,
   * proposé sans être exigé quand il vaut `partiel`, et nécessairement `null`
   * sinon : un motif de non-réalisation sur un événement fait serait une
   * contradiction que personne ne remarquerait avant de compter.
   */
  motif: MotifNonFait | null;
  /** Les deux mots qui précisent le motif. Jamais obligatoires. */
  motifLibre: string;
}

/* ════════════════════════════════════════════════════════════════════════
   Le focus
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Une session de concentration mesurée.
 *
 * `secondes` est le temps **réellement** écoulé, pas la durée visée : un
 * Pomodoro de vingt-cinq minutes interrompu au bout de neuf en vaut neuf.
 * Compter la durée visée gonflerait l'indicateur de temps focus exactement les
 * jours où l'on s'est le moins concentré.
 */
export interface Focus extends Possede {
  domaine: IdDomaine;
  tacheId: string | null;
  debut: string;
  fin: string;
  secondes: number;
  /** Vrai si la session a été arrêtée avant son terme. */
  interrompue: boolean;
}

/* ════════════════════════════════════════════════════════════════════════
   Les revues
   ════════════════════════════════════════════════════════════════════════ */

export type TypeDeRevue = 'soir' | 'semaine' | 'mois' | 'trimestre' | 'annee';

export const TYPES_DE_REVUE: readonly TypeDeRevue[] = [
  'soir',
  'semaine',
  'mois',
  'trimestre',
  'annee',
];

/**
 * Une revue tenue.
 *
 * `reponses` est un dictionnaire libre : les questions d'une revue changeront,
 * et un schéma figé obligerait à migrer l'historique à chaque changement de
 * formulation. Ce qui ne change pas, c'est la **période** couverte.
 */
export interface Revue extends Possede {
  type: TypeDeRevue;
  /** Jour logique de la revue. */
  jour: string;
  reponses: Record<string, string>;
}

/* ════════════════════════════════════════════════════════════════════════
   Les contrôles de forme
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Les contrôles ne rendent pas un booléen mais la liste de ce qui cloche.
 *
 * Un écran qui dit « invalide » n'aide personne. Et ces mêmes messages servent
 * à l'import ICS, où le fichier vient du dehors et où il faut pouvoir dire
 * **quelle ligne** a été écartée, et pourquoi.
 */
export function controlerTache(t: Tache): string[] {
  const problemes: string[] = [];
  if (!t.titre.trim()) problemes.push('Une tâche a besoin d’un titre.');
  /*
     Faite **et** abandonnée est contradictoire, et ce n'est pas une subtilité :
     le suivi du plan tenu compterait la même tâche des deux côtés.
  */
  if (t.faiteLe && t.abandonneeLe) {
    problemes.push('Une tâche ne peut pas être à la fois faite et abandonnée.');
  }
  /*
     Un abandon sans motif ne serait qu'une disparition. La contrainte est ici,
     dans le contrôle, et non dans l'écran : un écran se contourne, un contrôle
     refuse l'écriture.
  */
  if (t.abandonneeLe && !t.motifAbandon) {
    problemes.push('Dire pourquoi vous y renoncez fait partie du renoncement.');
  }
  if (!t.abandonneeLe && t.motifAbandon) {
    problemes.push('Une tâche qui n’est pas abandonnée ne porte pas de motif d’abandon.');
  }
  if (t.echeance !== null && !/^\d{4}-\d{2}-\d{2}$/.test(t.echeance)) {
    problemes.push('L’échéance doit être un jour au format AAAA-MM-JJ.');
  }
  if (t.faiteLe !== null && !/^\d{4}-\d{2}-\d{2}$/.test(t.faiteLe)) {
    problemes.push('La date de clôture doit être un jour au format AAAA-MM-JJ.');
  }

  /* --- Prompt 38 ---------------------------------------------------------- */

  if (t.serie) {
    problemes.push(...problemesDeLaSerie(t.serie));
    /*
       L'échéance et la série porteraient la même information sous deux
       formes, et la première qui change ferait mentir l'autre. L'échéance
       d'une tâche répétée est celle de chacune de ses occurrences, calculée.
    */
    if (t.echeance !== null) {
      problemes.push('Une tâche répétée ne porte pas d’échéance : ses occurrences en tiennent lieu.');
    }
  }

  if (t.etapes?.length) {
    const vus = new Set<string>();
    for (const e of t.etapes) {
      if (!e.intitule.trim()) problemes.push('Une étape a besoin d’un intitulé.');
      if (vus.has(e.id)) problemes.push(`Deux étapes portent l’identifiant « ${e.id} ».`);
      vus.add(e.id);
      if (!Number.isFinite(e.rang)) problemes.push('Le rang d’une étape doit être un nombre.');
    }
  }

  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les clés déterministes des exceptions — prompt 38
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La clé d'une occurrence : `«tacheId»/«jourPrevu»`.
 *
 * Déterministe **à dessein**, et c'est ce qui fait tenir la fusion : deux
 * appareils qui pointent la même occurrence doivent viser la même cible. Un
 * ULID tiré au hasard de chaque côté en aurait fait deux, et l'écran aurait
 * affiché deux fois « fait » pour un seul geste.
 *
 * La barre oblique sépare sans ambiguïté : un ULID n'en contient pas, un jour
 * logique non plus.
 */
export const idOccurrence = (tacheId: string, jourPrevu: string): string =>
  `${tacheId}/${jourPrevu}`;

/** La clé d'un cochage : `«tacheId»/«jourPrevu»/«etapeId»`. Même raison. */
export const idEtapeCochee = (tacheId: string, jourPrevu: string, etapeId: string): string =>
  `${tacheId}/${jourPrevu}/${etapeId}`;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function controlerOccurrence(o: Occurrence): string[] {
  const problemes: string[] = [];
  if (o.id !== idOccurrence(o.tacheId, o.jourPrevu)) {
    problemes.push('L’identifiant d’une occurrence est « tâche/jour » : il n’est pas libre.');
  }
  if (!JOUR.test(o.jourPrevu)) problemes.push('Le jour prévu doit être au format AAAA-MM-JJ.');
  if (o.etat === 'deplacee' && !o.jourPorte) {
    problemes.push('Une occurrence déplacée dit où elle est portée.');
  }
  if (o.etat !== 'deplacee' && o.jourPorte) {
    problemes.push('Seule une occurrence déplacée porte un jour d’arrivée.');
  }
  if (o.etat === 'modifiee' && !o.heure) {
    problemes.push('Une occurrence modifiée dit quelle heure remplace celle de la série.');
  }
  /* Même exigence que pour la tâche : renoncer sans dire pourquoi n'est qu'une
     disparition. */
  if (o.etat === 'abandonnee' && !o.motifAbandon) {
    problemes.push('Dire pourquoi vous y renoncez fait partie du renoncement.');
  }
  if (o.etat !== 'abandonnee' && o.motifAbandon) {
    problemes.push('Une occurrence qui n’est pas abandonnée ne porte pas de motif d’abandon.');
  }
  if ((o.etat === 'pointee' || o.etat === 'abandonnee') && !o.le) {
    problemes.push('Un pointage et un abandon ont une heure : c’est ce qu’ils gardent.');
  }
  return problemes;
}

export function controlerEtapeCochee(c: EtapeCochee): string[] {
  const problemes: string[] = [];
  if (c.id !== idEtapeCochee(c.tacheId, c.jourPrevu, c.etapeId)) {
    problemes.push('L’identifiant d’un cochage est « tâche/jour/étape » : il n’est pas libre.');
  }
  if (!JOUR.test(c.jourPrevu)) problemes.push('Le jour prévu doit être au format AAAA-MM-JJ.');
  if (!c.le) problemes.push('Un cochage a une heure.');
  return problemes;
}

export function controlerQuete(q: Quete): string[] {
  const problemes: string[] = [];
  if (!q.titre.trim()) problemes.push('Une quête a besoin d’un titre.');
  if (!CADENCES.includes(q.cadence)) problemes.push('La cadence est « jour » ou « semaine ».');
  if (q.tenues.some((j) => !/^\d{4}-\d{2}-\d{2}$/.test(j))) {
    problemes.push('Les jours tenus doivent être au format AAAA-MM-JJ.');
  }
  const uniques = new Set(q.tenues);
  if (uniques.size !== q.tenues.length) {
    problemes.push('Un même jour ne peut être tenu deux fois.');
  }
  return problemes;
}

export function controlerEvenement(e: Evenement): string[] {
  const problemes: string[] = [];
  if (!e.titre.trim()) problemes.push('Un événement a besoin d’un titre.');
  if (!REALISATIONS.includes(e.realise)) {
    problemes.push('Le relevé doit être « inconnu », « fait », « partiel » ou « non-fait ».');
  }
  if (e.realise === 'non-fait' && !e.motif) {
    problemes.push('Dire que cela n’a pas eu lieu demande d’en dire la raison.');
  }
  if ((e.realise === 'fait' || e.realise === 'inconnu') && e.motif) {
    problemes.push('Un motif de non-réalisation n’a pas de sens ici.');
  }
  if (e.motif && !MOTIF_PAR_ID.has(e.motif)) {
    problemes.push(`Motif inconnu : « ${e.motif} ».`);
  }
  const debut = Date.parse(e.debut);
  const fin = Date.parse(e.fin);
  if (Number.isNaN(debut)) problemes.push('La date de début est illisible.');
  if (Number.isNaN(fin)) problemes.push('La date de fin est illisible.');
  /*
     Fin **avant** début est refusé ; fin **égale** à début ne l'est pas. Un
     agenda exporté note couramment un rappel ou un jalon avec une durée nulle,
     et le refuser ferait perdre à l'import des entrées parfaitement valides.
  */
  if (!Number.isNaN(debut) && !Number.isNaN(fin) && fin < debut) {
    problemes.push('Un événement ne peut pas finir avant d’avoir commencé.');
  }
  return problemes;
}

/** Les secondes qu'occupe un événement. Une journée entière en vaut 24 h. */
export function dureeDeLEvenement(e: Evenement): number {
  if (e.journeeEntiere) return 24 * 3600;
  const debut = Date.parse(e.debut);
  const fin = Date.parse(e.fin);
  if (Number.isNaN(debut) || Number.isNaN(fin)) return 0;
  return Math.max(0, Math.round((fin - debut) / 1000));
}

/**
 * Deux événements se chevauchent-ils ?
 *
 * Le contact simple n'est pas un chevauchement : une réunion qui finit à 10 h
 * et une autre qui commence à 10 h se suivent, elles ne se superposent pas.
 * Les signaler toutes les deux rendrait l'avertissement inutilisable, puisque
 * c'est ainsi qu'une journée bien remplie est normalement construite.
 */
export function seChevauchent(a: Evenement, b: Evenement): boolean {
  if (a.journeeEntiere || b.journeeEntiere) return false;
  const debutA = Date.parse(a.debut);
  const finA = Date.parse(a.fin);
  const debutB = Date.parse(b.debut);
  const finB = Date.parse(b.fin);
  if ([debutA, finA, debutB, finB].some(Number.isNaN)) return false;
  return debutA < finB && debutB < finA;
}

/** Les paires d'événements qui se chevauchent, chacune une seule fois. */
export function chevauchements(evenements: readonly Evenement[]): [Evenement, Evenement][] {
  const paires: [Evenement, Evenement][] = [];
  const tries = [...evenements].sort((x, y) => x.debut.localeCompare(y.debut));
  for (let i = 0; i < tries.length; i += 1) {
    for (let j = i + 1; j < tries.length; j += 1) {
      /*
         Les événements sont triés par début : dès que le suivant commence
         après la fin du courant, aucun de ceux d'après ne peut le chevaucher.
         Sans cette sortie, une année d'agenda coûterait un carré d'itérations
         pour trouver une poignée de paires.
      */
      if (!tries[i].journeeEntiere && tries[j].debut >= tries[i].fin) break;
      if (seChevauchent(tries[i], tries[j])) paires.push([tries[i], tries[j]]);
    }
  }
  return paires;
}
