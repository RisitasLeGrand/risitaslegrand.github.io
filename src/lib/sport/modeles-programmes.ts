/**
 * Les sept modèles de programmes de Sport, et rien de plus.
 *
 * ## D'où viennent ces valeurs
 *
 * Elles sont **transcrites** de `docs/cyclades/sport/03-modeles.md` (dossier
 * du 18 octobre 2026, complément 47 bis), tableau par tableau. Aucune n'est
 * inventée ici, aucune n'est « améliorée » : le dossier dit lui-même qu'il
 * n'est pas une spécification, et la seule façon de ne pas en faire une est
 * de le recopier sans l'interpréter.
 *
 * Trois transformations, et trois seulement : l'apostrophe droite du dossier
 * devient l'apostrophe typographique, l'emphase Markdown est retirée, et le
 * code entre accents graves passe en guillemets français — cette prose
 * s'affiche telle quelle, les marques resteraient visibles à l'écran.
 *
 * `scripts/essais-modeles-sport.mts` recompare **chaque valeur** de ce
 * fichier au tableau du dossier. Une transcription fautive fait rougir la
 * batterie ; c'est la seule garantie qui vaille, et elle est versionnée.
 *
 * ## Ce que ce module ne fait pas
 *
 * - Il **ne porte aucune cible par muscle à appliquer**. `ciblesDuDossier`
 *   n'est là que pour mémoire et pour le compte rendu des écarts : les cibles
 *   d'une copie sont **recalculées** par le code depuis `BIBLIOTHEQUE` et
 *   `COEFFICIENT_SECONDAIRE`, parce que le classement des muscles du dossier
 *   est une convention écrite sans accès à la bibliothèque réelle. Le dossier
 *   le dit, et l'écart est signalé plutôt que corrigé en silence.
 * - Il **n'écrit rien**. Un modèle prépare un programme ; c'est
 *   `donnees.ts` qui écrit, et rien ici ne touche `sportSeances`.
 * - Il **ne propose aucune cible comme contrainte**. Sport propose, la
 *   personne dispose, et le réel fait foi.
 *
 * ## Le RIR visé n'est pas une mesure
 *
 * Il voyage dans son propre champ plutôt que fondu dans la note, pour que
 * l'essai puisse le comparer à la colonne du dossier. C'est la copie qui le
 * verse dans la note du `BlocPrevu`, et l'écran le présente comme une aide :
 * le RIR est sous-estimé de près d'une répétition en moyenne (H04-11).
 */

/** L'identité de comparaison d'un exercice : nom, équipement, variante. */
export interface IdentiteExercice {
  nom: string;
  equipement: string;
  variante: string;
}

/**
 * Un bloc d'une séance type du modèle.
 *
 * Les répétitions et le repos sont des **cibles**, comme dans `BlocPrevu` :
 * rien ici ne refuse une série hors cible.
 */
export interface BlocDeModele {
  /** Le libellé du dossier. `identiteDeLExercice` en donne l'identité réelle. */
  exercice: string;
  series: number;
  repetitionsMin: number;
  repetitionsMax: number;
  /** Repos visé en secondes, ou `null` si le dossier n'en donne pas. */
  repos: number | null;
  /** Le RIR visé, tel quel (« 2-3 »), ou `null` pour les maintiens. */
  rir: string | null;
  /** Séries du déload : séries du bloc × 0,6 arrondies (point 5 du dossier). */
  deloadSeries: number;
  /** Le RIR du déload, ou `null` pour les maintiens. */
  deloadRir: string | null;
  /**
   * La note du dossier, telle quelle.
   *
   * Elle porte parfois « Exercice à ajouter (R4). », qui s'adresse au
   * documentaliste et non à la personne : c'est l'écran qui l'écarte, pas la
   * transcription — retirer une mention ici rendrait l'essai de conformité
   * incapable de la retrouver.
   */
  note: string;
}

/**
 * Un exercice du modèle, vu du dossier : son matériel et ses remplaçants.
 *
 * L'équipement est celui que **le dossier** écrit (« haltères, banc incliné »),
 * et non le champ `equipement` de la bibliothèque. Il est plus riche, et c'est
 * ce qui permet de dire qu'un développé incliné demande un banc — la
 * bibliothèque, elle, n'en dit rien.
 *
 * Les remplaçants sont **propres à chaque modèle**, et ce n'est pas une
 * redondance : le modèle Maison propose un remplaçant de maison, les modèles
 * de salle un remplaçant de salle. Une table globale donnerait la presse à
 * cuisses à quelqu'un qui s'entraîne dans son salon.
 */
export interface ExerciceDuModele {
  /** Le libellé du dossier, celui qu'emploient les blocs. */
  libelle: string;
  /** Le matériel, tel que le dossier le décrit. */
  equipement: string;
  unilateral: boolean;
  /** Que faire sans le matériel. `null` : le dossier n'en propose pas. */
  siPasLeMateriel: string | null;
  /**
   * Que faire en cas de gêne articulaire sur ce mouvement.
   *
   * Ce n'est **ni un diagnostic ni une prescription** : l'application propose
   * une autre façon de solliciter le muscle, la personne choisit. C'est la
   * formule du dossier, et elle est reprise telle quelle.
   */
  siGene: string | null;
}

export interface SeanceDeModele {
  nom: string;
  /** Minutes estimées hors échauffement : 40 s par série plus repos. */
  minutes: number;
  blocs: BlocDeModele[];
}

export interface ModeleDeProgramme {
  /** « M1 » à « M7 », les clefs du dossier. */
  cle: string;
  nom: string;
  description: string;
  pourQui: string;
  parSemaine: number;
  seriesParSemaine: number;
  equipement: 'salle' | 'maison';
  equipementDetail: string;
  /** La fiche de découpage du dossier : « D01 » à « D09 ». */
  decoupage: string;
  /** « Proposé pour… », ou `null`. Une suggestion, jamais une imposition. */
  propose: string | null;
  /** Les avertissements que le dossier attache à ce modèle. */
  avertissements: string[];
  /** Ce que disent les sources de ce découpage. */
  sources: string;
  /** Ce que le dossier reconnaît comme limites de ce modèle. */
  limites: string;
  /** Ce que la convention de muscles du dossier change, s'il la change. */
  sensibilite: string;
  seances: SeanceDeModele[];
  /** Les exercices du modèle, avec leur matériel et leurs remplaçants. */
  exercices: ExerciceDuModele[];
  /**
   * Les cibles hebdomadaires **du dossier**, pour mémoire.
   *
   * Clefs : les identifiants de `MUSCLES`, comme `ciblesParMuscle` — et non
   * les libellés du dossier, dont ils sont dérivés à la transcription. Ces
   * valeurs ne sont jamais appliquées telles quelles ; voir l'en-tête.
   */
  ciblesDuDossier: Record<string, number>;
}

const B = (
  exercice: string,
  series: number,
  repetitionsMin: number,
  repetitionsMax: number,
  repos: number | null,
  rir: string | null,
  deloadSeries: number,
  deloadRir: string | null,
  note = '',
): BlocDeModele => ({
  exercice,
  series,
  repetitionsMin,
  repetitionsMax,
  repos,
  rir,
  deloadSeries,
  deloadRir,
  note,
});

const E = (
  libelle: string,
  equipement: string,
  unilateral: boolean,
  siPasLeMateriel: string | null,
  siGene: string | null,
): ExerciceDuModele => ({ libelle, equipement, unilateral, siPasLeMateriel, siGene });

/**
 * La règle de progression proposée, commune aux sept modèles (point 4).
 *
 * **Pratique de terrain, non démontrée** : aucune étude lue ne teste ce
 * schéma comme méthode nommée (H06-02). L'écran le dit.
 */
export const PROGRESSION = [
  'Garder la charge tant que le haut de la fourchette de répétitions n’est pas atteint sur toutes les séries au RIR visé, en visant une répétition de plus par série d’une séance à l’autre.',
  'Une fois le haut de la fourchette atteint, monter la charge du plus petit pas disponible — de 2 à 10 % selon la taille du muscle (H06-01) — puis redescendre au bas de la fourchette.',
];

/**
 * Le déload type, commun aux sept modèles (point 5).
 *
 * **Pratique d’entraîneurs, non démontrée par des essais** (H09-12, H09-13),
 * appuyée par un consensus sur la forme (H09-10, H09-11). Il est proposé
 * toutes les 4 à 6 semaines, et chacun peut le refuser.
 */
export const DELOAD = [
  'Proposé toutes les 4 à 6 semaines d’entraînement, si vous le souhaitez.',
  'Une semaine, de 5 à 7 jours.',
  'Les séries du bloc multipliées par 0,6, arrondies.',
  'Un RIR visé de 3 à 4, au lieu de 1 à 3.',
  'Le nombre de séances par semaine ne change pas, et la charge reste la même.',
];

/** Les sept modèles, dans l’ordre du dossier. */
export const MODELES_DE_PROGRAMMES: readonly ModeleDeProgramme[] = [
  {
    cle: 'M1',
    nom: 'Poussée / Tirage / Jambes, 3 jours',
    description: 'Trois séances par semaine : Poussée (pectoraux, épaules, triceps), Tirage (dos, arrière des épaules, biceps) et Jambes. Chaque muscle est travaillé une seule fois par semaine : le volume hebdomadaire d’un muscle repose donc sur une seule séance, ce qui le rapproche du plafond d’environ 10 à 11 séries par séance (triceps, biceps, fessiers).',
    pourQui: 'Novices avancés et intermédiaires qui ne disposent que de trois séances par semaine. L’ACSM 2009 place 3 jours par semaine dans la plage des novices (2 à 3) et des intermédiaires (D01-03).',
    parSemaine: 3,
    seriesParSemaine: 68,
    equipement: 'salle',
    equipementDetail: 'salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe',
    decoupage: 'D01',
    propose: null,
    avertissements: [
      'chaque muscle une fois par semaine, sous le repère de deux',
    ],
    sources: 'Structure : D01-01 (pratique de terrain). Plage de l’ACSM 2009 : D01-03. Plancher de 2 jours par muscle de l’ACSM 2026 : D01-04 ; ce modèle est en dessous (1 passage), alors qu’à volume égal la fréquence n’a pas d’effet mesuré sur l’hypertrophie (D01-06, D01-07) et qu’un essai de 20 hommes entraînés compare 1 et 3 passages (D01-08). Le dossier ne trouve aucune étude qui compare le PPL à un autre découpage (D01, D07).',
    limites: '1 passage par muscle et par semaine (sous le repère ≥ 2 jours, D01-04, D06-14) ; séances de 21 à 25 séries ; triceps à 10,5 séries dans une séance (au plafond d’environ 10 à 11, H01-19). Les muscles de petite taille (mollets, trapèzes, adducteurs) restent sous 10 séries.',
    sensibilite: 'Si la bibliothèque réelle classe les fessiers en muscle principal au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 9 à 13,5 séries par semaine ; les autres cibles ne changent pas.',
    seances: [
      {
        nom: 'Poussée',
        minutes: 54,
        blocs: [
          B('développé couché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('développé incliné (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('dips (barres parallèles)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('développé militaire (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('élévations latérales (haltères)', 5, 12, 20, 75, '1-2', 3, '3-4'),
          B('extension triceps à la poulie', 3, 10, 15, 90, '1-2', 2, '3-4', 'Si la variante existe, bras au-dessus de la tête (H07-11).'),
          B('gainage latéral', 2, 30, 60, 60, null, 1, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. Une série = les deux côtés faits (compte pour 1 série).'),
        ],
      },
      {
        nom: 'Tirage',
        minutes: 50,
        blocs: [
          B('tractions pronation (barre fixe)', 4, 8, 12, 120, '1-2', 2, '3-4'),
          B('rowing buste penché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('tirage horizontal (poulie)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('oiseau (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('curl biceps (haltères)', 3, 10, 15, 90, '1-2', 2, '3-4'),
          B('curl marteau (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('relevés de jambes suspendu (barre fixe)', 3, 8, 15, 60, '1-2', 2, '3-4'),
        ],
      },
      {
        nom: 'Jambes',
        minutes: 63,
        blocs: [
          B('squat (barre)', 4, 6, 10, 150, '2-3', 2, '3-4'),
          B('soulevé de terre jambes tendues (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('presse à cuisses', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('fentes (haltères)', 2, 8, 12, 120, '1-2', 1, '3-4', 'Une série = les deux côtés faits (compte pour 1 série).'),
          B('hip thrust (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('leg curl', 3, 10, 15, 90, '1-2', 2, '3-4', 'Assis plutôt que couché si l’appareil le permet (H07-11).'),
          B('mollets debout (machine)', 5, 10, 20, 90, '1-2', 3, '3-4'),
          B('gainage ventral', 2, 30, 60, 60, null, 1, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade.'),
        ],
      },
    ],
    exercices: [
      E('développé couché (barre)', 'barre, banc', false, 'développé incliné (haltères) si pas de barre ni de support', 'développé incliné (haltères), prise libre'),
      E('développé incliné (haltères)', 'haltères, banc incliné', false, 'développé couché (barre) sans haltères lourds', 'écarté couché (haltères), amplitude réduite'),
      E('dips (barres parallèles)', 'barres parallèles', false, 'développé incliné (haltères) sans barres parallèles', 'extension triceps à la poulie'),
      E('développé militaire (barre)', 'barre', false, 'développé incliné (haltères)', 'élévations latérales (haltères)'),
      E('élévations latérales (haltères)', 'haltères', false, 'pas d’équivalent présent (l’exercice peut se faire à la poulie : variante non présente)', 'développé militaire (barre), en secondaire'),
      E('extension triceps à la poulie', 'poulie', false, 'barre au front (barre EZ)', 'dips (barres parallèles) en secondaire'),
      E('gainage latéral', 'poids du corps', true, 'gainage ventral', 'gainage ventral'),
      E('tractions pronation (barre fixe)', 'barre fixe', false, 'tirage vertical (poulie) sans barre fixe', 'rowing buste penché (barre)'),
      E('rowing buste penché (barre)', 'barre', false, 'tirage horizontal (poulie)', 'tirage vertical (poulie), buste soutenu'),
      E('tirage horizontal (poulie)', 'poulie basse', false, 'rowing buste penché (barre)', 'tirage vertical (poulie)'),
      E('oiseau (haltères)', 'haltères', false, 'tirage horizontal (poulie)', null),
      E('curl biceps (haltères)', 'haltères', false, 'curl marteau (haltères)', 'curl marteau (haltères), prise neutre'),
      E('curl marteau (haltères)', 'haltères', false, 'curl biceps (haltères)', 'curl biceps (haltères)'),
      E('relevés de jambes suspendu (barre fixe)', 'barre fixe', false, 'gainage ventral sans barre fixe', 'gainage ventral'),
      E('squat (barre)', 'barre, support', false, 'presse à cuisses', 'fentes (haltères) ou presse à cuisses'),
      E('soulevé de terre jambes tendues (barre)', 'barre', false, 'hip thrust (barre)', 'leg curl'),
      E('presse à cuisses', 'machine', false, 'squat (barre)', 'fentes (haltères)'),
      E('fentes (haltères)', 'haltères', true, 'presse à cuisses', 'presse à cuisses, charge réduite'),
      E('hip thrust (barre)', 'barre, banc', false, 'soulevé de terre jambes tendues (barre)', 'fentes (haltères)'),
      E('leg curl', 'machine', false, 'soulevé de terre jambes tendues (barre)', null),
      E('mollets debout (machine)', 'machine', false, 'mollets debout à une jambe (haltère) sans machine, à ajouter', null),
      E('gainage ventral', 'poids du corps', false, 'gainage latéral', 'relevés de jambes suspendu (barre fixe)'),
    ],
    ciblesDuDossier: {
      'pectoraux': 9,
      'deltoide-anterieur': 7.5,
      'deltoide-lateral': 6.5,
      'deltoide-posterieur': 6,
      'biceps': 10,
      'triceps': 10.5,
      'avant-bras': 2.5,
      'dorsaux': 10,
      'trapezes': 4.5,
      'lombaires': 1.5,
      'abdominaux': 6,
      'obliques': 3,
      'quadriceps': 9,
      'ischio-jambiers': 7.5,
      'fessiers': 9,
      'adducteurs': 4.5,
      'mollets': 5,
      'cou': 0,
    },
  },
  {
    cle: 'M2',
    nom: 'Poussée / Tirage / Jambes, 6 jours',
    description: 'Six séances : Poussée A, Tirage A, Jambes A, puis Poussée B, Tirage B, Jambes B. Chaque muscle est travaillé deux fois par semaine. Les séances A utilisent surtout des barres libres et des polyarticulaires (fourchettes de répétitions plus basses) ; les séances B ajoutent des variantes aux haltères, à la poulie et aux machines. Chaque séance dure 31 à 42 minutes environ (12 à 18 séries).',
    pourQui: 'Intermédiaires et avancés qui disposent de six jours. Six jours dépassent la plage de 4 à 5 jours des avancés de l’ACSM 2009 (D02-03) ; l’ACSM 2026 demande au moins 2 passages par grand groupe, ce que fait ce modèle (D02-04). Option de rotation « trois jours puis un repos » (D02-02).',
    parSemaine: 6,
    seriesParSemaine: 89,
    equipement: 'salle',
    equipementDetail: 'salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe',
    decoupage: 'D02',
    propose: null,
    avertissements: [
      'au-delà de la fréquence conseillée, récupération non mesurée',
    ],
    sources: 'Structure : D02-01, D02-02 (pratique de terrain). Trois contre six séances par semaine à volume égalisé : adaptations similaires de force et d’épaisseur musculaire dans un essai de 27 hommes entraînés (D02-05) ; masse maigre plus grande à six séances dans un autre essai (n = 28, D02-06). Plancher de 2 jours : D02-04.',
    limites: 'Six jours d’entraînement (aucune étude ne compare ce nombre de séances à l’hypertrophie au long cours) ; peu de repos par semaine ; la personne qui manque une séance a des cibles inférieures sans que le réel soit jugé (règle de Sport). Le volume par séance reste sous le plafond (au plus 8 séries pondérées pour un muscle dans une séance).',
    sensibilite: 'Si la bibliothèque réelle classe les fessiers en muscle principal au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 9,5 à 14,5 séries par semaine ; les autres cibles ne changent pas.',
    seances: [
      {
        nom: 'Poussée A',
        minutes: 29,
        blocs: [
          B('développé couché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('développé militaire (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('élévations latérales (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('extension triceps à la poulie', 2, 10, 15, 90, '1-2', 1, '3-4', 'Si la variante existe, bras au-dessus de la tête (H07-11).'),
        ],
      },
      {
        nom: 'Tirage A',
        minutes: 35,
        blocs: [
          B('tractions pronation (barre fixe)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('rowing buste penché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('oiseau (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('curl biceps (haltères)', 3, 10, 15, 90, '1-2', 2, '3-4'),
          B('relevés de jambes suspendu (barre fixe)', 3, 8, 15, 60, '1-2', 2, '3-4'),
        ],
      },
      {
        nom: 'Jambes A',
        minutes: 41,
        blocs: [
          B('squat (barre)', 4, 6, 10, 150, '2-3', 2, '3-4'),
          B('presse à cuisses', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('leg curl', 3, 10, 15, 90, '1-2', 2, '3-4', 'Assis plutôt que couché si l’appareil le permet (H07-11).'),
          B('mollets debout (machine)', 4, 10, 20, 90, '1-2', 2, '3-4'),
          B('gainage ventral', 3, 30, 60, 60, null, 2, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade.'),
        ],
      },
      {
        nom: 'Poussée B',
        minutes: 30,
        blocs: [
          B('développé incliné (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('dips (barres parallèles)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('écarté couché (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('élévations latérales (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('barre au front (barre EZ)', 2, 10, 15, 90, '1-2', 1, '3-4'),
        ],
      },
      {
        nom: 'Tirage B',
        minutes: 33,
        blocs: [
          B('tirage vertical (poulie)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('tirage horizontal (poulie)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('shrugs (haltères)', 3, 10, 15, 90, '1-2', 2, '3-4'),
          B('curl marteau (haltères)', 3, 10, 15, 90, '1-2', 2, '3-4'),
          B('oiseau (haltères)', 2, 12, 20, 75, '1-2', 1, '3-4'),
        ],
      },
      {
        nom: 'Jambes B',
        minutes: 45,
        blocs: [
          B('soulevé de terre jambes tendues (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('fentes (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série).'),
          B('hip thrust (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('leg curl', 2, 10, 15, 90, '1-2', 1, '3-4', 'Assis plutôt que couché si l’appareil le permet (H07-11).'),
          B('adducteurs à la machine', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('mollets debout (machine)', 4, 10, 20, 90, '1-2', 2, '3-4'),
          B('gainage latéral', 2, 30, 60, 60, null, 1, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. Une série = les deux côtés faits (compte pour 1 série).'),
        ],
      },
    ],
    exercices: [
      E('développé couché (barre)', 'barre, banc', false, 'développé incliné (haltères) si pas de barre ni de support', 'développé incliné (haltères), prise libre'),
      E('développé militaire (barre)', 'barre', false, 'développé incliné (haltères)', 'élévations latérales (haltères)'),
      E('élévations latérales (haltères)', 'haltères', false, 'pas d’équivalent présent (l’exercice peut se faire à la poulie : variante non présente)', 'développé militaire (barre), en secondaire'),
      E('extension triceps à la poulie', 'poulie', false, 'barre au front (barre EZ)', 'dips (barres parallèles) en secondaire'),
      E('tractions pronation (barre fixe)', 'barre fixe', false, 'tirage vertical (poulie) sans barre fixe', 'rowing buste penché (barre)'),
      E('rowing buste penché (barre)', 'barre', false, 'tirage horizontal (poulie)', 'tirage vertical (poulie), buste soutenu'),
      E('oiseau (haltères)', 'haltères', false, 'tirage horizontal (poulie)', null),
      E('curl biceps (haltères)', 'haltères', false, 'curl marteau (haltères)', 'curl marteau (haltères), prise neutre'),
      E('relevés de jambes suspendu (barre fixe)', 'barre fixe', false, 'gainage ventral sans barre fixe', 'gainage ventral'),
      E('squat (barre)', 'barre, support', false, 'presse à cuisses', 'fentes (haltères) ou presse à cuisses'),
      E('presse à cuisses', 'machine', false, 'squat (barre)', 'fentes (haltères)'),
      E('leg curl', 'machine', false, 'soulevé de terre jambes tendues (barre)', null),
      E('mollets debout (machine)', 'machine', false, 'mollets debout à une jambe (haltère) sans machine, à ajouter', null),
      E('gainage ventral', 'poids du corps', false, 'gainage latéral', 'relevés de jambes suspendu (barre fixe)'),
      E('développé incliné (haltères)', 'haltères, banc incliné', false, 'développé couché (barre) sans haltères lourds', 'écarté couché (haltères), amplitude réduite'),
      E('dips (barres parallèles)', 'barres parallèles', false, 'développé incliné (haltères) sans barres parallèles', 'extension triceps à la poulie'),
      E('écarté couché (haltères)', 'haltères, banc', false, 'développé incliné (haltères)', null),
      E('barre au front (barre EZ)', 'barre EZ, banc', false, 'extension triceps à la poulie', 'extension triceps à la poulie'),
      E('tirage vertical (poulie)', 'poulie haute', false, 'tractions pronation (barre fixe)', 'tirage horizontal (poulie)'),
      E('tirage horizontal (poulie)', 'poulie basse', false, 'rowing buste penché (barre)', 'tirage vertical (poulie)'),
      E('shrugs (haltères)', 'haltères', false, 'pas d’équivalent présent', 'tirage horizontal (poulie), en secondaire'),
      E('curl marteau (haltères)', 'haltères', false, 'curl biceps (haltères)', 'curl biceps (haltères)'),
      E('soulevé de terre jambes tendues (barre)', 'barre', false, 'hip thrust (barre)', 'leg curl'),
      E('fentes (haltères)', 'haltères', true, 'presse à cuisses', 'presse à cuisses, charge réduite'),
      E('hip thrust (barre)', 'barre, banc', false, 'soulevé de terre jambes tendues (barre)', 'fentes (haltères)'),
      E('adducteurs à la machine', 'machine', false, 'pas d’équivalent présent', null),
      E('gainage latéral', 'poids du corps', true, 'gainage ventral', 'gainage ventral'),
    ],
    ciblesDuDossier: {
      'pectoraux': 11,
      'deltoide-anterieur': 8.5,
      'deltoide-lateral': 7.5,
      'deltoide-posterieur': 8,
      'biceps': 12,
      'triceps': 11.5,
      'avant-bras': 3,
      'dorsaux': 12,
      'trapezes': 8.5,
      'lombaires': 1.5,
      'abdominaux': 7,
      'obliques': 3.5,
      'quadriceps': 10,
      'ischio-jambiers': 9.5,
      'fessiers': 9.5,
      'adducteurs': 7,
      'mollets': 8,
      'cou': 0,
    },
  },
  {
    cle: 'M3',
    nom: 'Haut / Bas, 4 jours',
    description: 'Quatre séances : Haut A, Bas A, Haut B, Bas B. Chaque muscle est travaillé deux fois par semaine ; la séance A privilégie les exercices lourds (6 à 10 répétitions), la séance B les exercices à répétitions plus élevées. Durée de 40 à 55 minutes environ.',
    pourQui: 'Intermédiaires. L’ACSM 2009 recommande à l’intermédiaire 3 jours en corps entier ou 4 jours en découpage haut/bas pour l’hypertrophie, preuve de catégorie B (D03-01).',
    parSemaine: 4,
    seriesParSemaine: 77,
    equipement: 'salle',
    equipementDetail: 'salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe',
    decoupage: 'D03',
    propose: 'Proposé pour un niveau intermédiaire',
    avertissements: [],
    sources: 'D03-01 (ACSM 2009), D03-02 (ACSM 2026 : au moins 2 fois par semaine, environ 10 séries). Seize séries par semaine en une ou en deux séances : pas de différence (D03-05, essai de 20 hommes entraînés). Plafond d’environ 10 séries par séance (D03-06). Programme public de structure voisine : D03-10 (structure seulement).',
    limites: 'Aucune étude lue ne compare le Haut/Bas au PPL ou au corps entier avec les mêmes exercices ; les trapèzes (4,5) et les obliques (1,5) restent bas.',
    sensibilite: 'Si la bibliothèque réelle classe les fessiers en muscle principal au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 9,5 à 14,5 séries par semaine ; les autres cibles ne changent pas.',
    seances: [
      {
        nom: 'Haut A',
        minutes: 53,
        blocs: [
          B('développé couché (barre)', 4, 6, 10, 150, '2-3', 2, '3-4'),
          B('rowing buste penché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('développé militaire (barre)', 2, 8, 12, 150, '2-3', 1, '3-4'),
          B('tirage vertical (poulie)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('élévations latérales (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('extension triceps à la poulie', 2, 10, 15, 90, '1-2', 1, '3-4', 'Si la variante existe, bras au-dessus de la tête (H07-11).'),
          B('curl biceps (haltères)', 3, 10, 15, 90, '1-2', 2, '3-4'),
        ],
      },
      {
        nom: 'Bas A',
        minutes: 41,
        blocs: [
          B('squat (barre)', 4, 6, 10, 150, '2-3', 2, '3-4'),
          B('soulevé de terre jambes tendues (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('leg curl', 3, 10, 15, 90, '1-2', 2, '3-4', 'Assis plutôt que couché si l’appareil le permet (H07-11).'),
          B('mollets debout (machine)', 4, 10, 20, 90, '1-2', 2, '3-4'),
          B('gainage ventral', 3, 30, 60, 60, null, 2, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade.'),
        ],
      },
      {
        nom: 'Haut B',
        minutes: 52,
        blocs: [
          B('développé incliné (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('tractions pronation (barre fixe)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('dips (barres parallèles)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('tirage horizontal (poulie)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('élévations latérales (haltères)', 2, 12, 20, 75, '1-2', 1, '3-4'),
          B('oiseau (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('barre au front (barre EZ)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('curl marteau (haltères)', 3, 10, 15, 90, '1-2', 2, '3-4'),
        ],
      },
      {
        nom: 'Bas B',
        minutes: 42,
        blocs: [
          B('presse à cuisses', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('fentes (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série).'),
          B('hip thrust (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('adducteurs à la machine', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('mollets debout (machine)', 4, 10, 20, 90, '1-2', 2, '3-4'),
          B('relevés de jambes suspendu (barre fixe)', 3, 8, 15, 60, '1-2', 2, '3-4'),
        ],
      },
    ],
    exercices: [
      E('développé couché (barre)', 'barre, banc', false, 'développé incliné (haltères) si pas de barre ni de support', 'développé incliné (haltères), prise libre'),
      E('rowing buste penché (barre)', 'barre', false, 'tirage horizontal (poulie)', 'tirage vertical (poulie), buste soutenu'),
      E('développé militaire (barre)', 'barre', false, 'développé incliné (haltères)', 'élévations latérales (haltères)'),
      E('tirage vertical (poulie)', 'poulie haute', false, 'tractions pronation (barre fixe)', 'tirage horizontal (poulie)'),
      E('élévations latérales (haltères)', 'haltères', false, 'pas d’équivalent présent (l’exercice peut se faire à la poulie : variante non présente)', 'développé militaire (barre), en secondaire'),
      E('extension triceps à la poulie', 'poulie', false, 'barre au front (barre EZ)', 'dips (barres parallèles) en secondaire'),
      E('curl biceps (haltères)', 'haltères', false, 'curl marteau (haltères)', 'curl marteau (haltères), prise neutre'),
      E('squat (barre)', 'barre, support', false, 'presse à cuisses', 'fentes (haltères) ou presse à cuisses'),
      E('soulevé de terre jambes tendues (barre)', 'barre', false, 'hip thrust (barre)', 'leg curl'),
      E('leg curl', 'machine', false, 'soulevé de terre jambes tendues (barre)', null),
      E('mollets debout (machine)', 'machine', false, 'mollets debout à une jambe (haltère) sans machine, à ajouter', null),
      E('gainage ventral', 'poids du corps', false, 'gainage latéral', 'relevés de jambes suspendu (barre fixe)'),
      E('développé incliné (haltères)', 'haltères, banc incliné', false, 'développé couché (barre) sans haltères lourds', 'écarté couché (haltères), amplitude réduite'),
      E('tractions pronation (barre fixe)', 'barre fixe', false, 'tirage vertical (poulie) sans barre fixe', 'rowing buste penché (barre)'),
      E('dips (barres parallèles)', 'barres parallèles', false, 'développé incliné (haltères) sans barres parallèles', 'extension triceps à la poulie'),
      E('tirage horizontal (poulie)', 'poulie basse', false, 'rowing buste penché (barre)', 'tirage vertical (poulie)'),
      E('oiseau (haltères)', 'haltères', false, 'tirage horizontal (poulie)', null),
      E('barre au front (barre EZ)', 'barre EZ, banc', false, 'extension triceps à la poulie', 'extension triceps à la poulie'),
      E('curl marteau (haltères)', 'haltères', false, 'curl biceps (haltères)', 'curl biceps (haltères)'),
      E('presse à cuisses', 'machine', false, 'squat (barre)', 'fentes (haltères)'),
      E('fentes (haltères)', 'haltères', true, 'presse à cuisses', 'presse à cuisses, charge réduite'),
      E('hip thrust (barre)', 'barre, banc', false, 'soulevé de terre jambes tendues (barre)', 'fentes (haltères)'),
      E('adducteurs à la machine', 'machine', false, 'pas d’équivalent présent', null),
      E('relevés de jambes suspendu (barre fixe)', 'barre fixe', false, 'gainage ventral sans barre fixe', 'gainage ventral'),
    ],
    ciblesDuDossier: {
      'pectoraux': 10,
      'deltoide-anterieur': 7,
      'deltoide-lateral': 6,
      'deltoide-posterieur': 6,
      'biceps': 12,
      'triceps': 11.5,
      'avant-bras': 3,
      'dorsaux': 12,
      'trapezes': 4.5,
      'lombaires': 1.5,
      'abdominaux': 6,
      'obliques': 1.5,
      'quadriceps': 10,
      'ischio-jambiers': 7.5,
      'fessiers': 9.5,
      'adducteurs': 7,
      'mollets': 8,
      'cou': 0,
    },
  },
  {
    cle: 'M4',
    nom: 'Corps entier, 3 jours',
    description: 'Trois séances de corps entier (A, B, C) sur des jours non consécutifs ; chaque muscle est travaillé deux ou trois fois par semaine selon les exercices. Chaque séance compte 19 à 21 séries (environ 50 minutes).',
    pourQui: 'Novices et intermédiaires. L’ACSM 2009 : novices 2 à 3 jours en corps entier, intermédiaires 3 jours en corps entier (D05-01).',
    parSemaine: 3,
    seriesParSemaine: 62,
    equipement: 'salle',
    equipementDetail: 'salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe',
    decoupage: 'D05',
    propose: 'Proposé pour débuter',
    avertissements: [],
    sources: 'D05-01 ; à volume égal, un corps entier à haute fréquence et un découpage donnent des gains de masse maigre et de force semblables (D05-03, essai de 23 hommes bien entraînés) ; 3 contre 6 séances : D05-04. Contre-exemple : un essai de 21 hommes à 4 jours par semaine donne un gain d’épaisseur du vaste latéral plus grand avec un découpage (D05-05). Les programmes publics à 3 séances sont présentés comme temporaires pour les débutants (D05-11).',
    limites: 'Les séries pondérées d’un muscle dans une séance (au plus 4,5) sont loin du plafond par séance ; les ischio-jambiers, fessiers et trapèzes sont sous 10 séries par semaine ; la séance dure environ 50 minutes même avec seulement 3 séries par exercice.',
    sensibilite: 'Si la bibliothèque réelle classe les fessiers en muscle principal au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 6,5 à 11,5 séries par semaine ; les autres cibles ne changent pas.',
    seances: [
      {
        nom: 'Corps entier A',
        minutes: 49,
        blocs: [
          B('squat (barre)', 4, 6, 10, 150, '2-3', 2, '3-4'),
          B('développé couché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('rowing buste penché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('élévations latérales (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('curl biceps (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('extension triceps à la poulie', 2, 10, 15, 90, '1-2', 1, '3-4', 'Si la variante existe, bras au-dessus de la tête (H07-11).'),
          B('gainage ventral', 2, 30, 60, 60, null, 1, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade.'),
        ],
      },
      {
        nom: 'Corps entier B',
        minutes: 53,
        blocs: [
          B('presse à cuisses', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('développé militaire (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('tirage vertical (poulie)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('leg curl', 3, 10, 15, 90, '1-2', 2, '3-4', 'Assis plutôt que couché si l’appareil le permet (H07-11).'),
          B('dips (barres parallèles)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('curl marteau (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('mollets debout (machine)', 4, 10, 20, 90, '1-2', 2, '3-4'),
        ],
      },
      {
        nom: 'Corps entier C',
        minutes: 52,
        blocs: [
          B('soulevé de terre jambes tendues (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('développé incliné (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('tractions pronation (barre fixe)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('fentes (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série).'),
          B('oiseau (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('barre au front (barre EZ)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('relevés de jambes suspendu (barre fixe)', 2, 8, 15, 60, '1-2', 1, '3-4'),
          B('mollets debout (machine)', 3, 10, 20, 90, '1-2', 2, '3-4'),
        ],
      },
    ],
    exercices: [
      E('squat (barre)', 'barre, support', false, 'presse à cuisses', 'fentes (haltères) ou presse à cuisses'),
      E('développé couché (barre)', 'barre, banc', false, 'développé incliné (haltères) si pas de barre ni de support', 'développé incliné (haltères), prise libre'),
      E('rowing buste penché (barre)', 'barre', false, 'tirage horizontal (poulie)', 'tirage vertical (poulie), buste soutenu'),
      E('élévations latérales (haltères)', 'haltères', false, 'pas d’équivalent présent (l’exercice peut se faire à la poulie : variante non présente)', 'développé militaire (barre), en secondaire'),
      E('curl biceps (haltères)', 'haltères', false, 'curl marteau (haltères)', 'curl marteau (haltères), prise neutre'),
      E('extension triceps à la poulie', 'poulie', false, 'barre au front (barre EZ)', 'dips (barres parallèles) en secondaire'),
      E('gainage ventral', 'poids du corps', false, 'gainage latéral', 'relevés de jambes suspendu (barre fixe)'),
      E('presse à cuisses', 'machine', false, 'squat (barre)', 'fentes (haltères)'),
      E('développé militaire (barre)', 'barre', false, 'développé incliné (haltères)', 'élévations latérales (haltères)'),
      E('tirage vertical (poulie)', 'poulie haute', false, 'tractions pronation (barre fixe)', 'tirage horizontal (poulie)'),
      E('leg curl', 'machine', false, 'soulevé de terre jambes tendues (barre)', null),
      E('dips (barres parallèles)', 'barres parallèles', false, 'développé incliné (haltères) sans barres parallèles', 'extension triceps à la poulie'),
      E('curl marteau (haltères)', 'haltères', false, 'curl biceps (haltères)', 'curl biceps (haltères)'),
      E('mollets debout (machine)', 'machine', false, 'mollets debout à une jambe (haltère) sans machine, à ajouter', null),
      E('soulevé de terre jambes tendues (barre)', 'barre', false, 'hip thrust (barre)', 'leg curl'),
      E('développé incliné (haltères)', 'haltères, banc incliné', false, 'développé couché (barre) sans haltères lourds', 'écarté couché (haltères), amplitude réduite'),
      E('tractions pronation (barre fixe)', 'barre fixe', false, 'tirage vertical (poulie) sans barre fixe', 'rowing buste penché (barre)'),
      E('fentes (haltères)', 'haltères', true, 'presse à cuisses', 'presse à cuisses, charge réduite'),
      E('oiseau (haltères)', 'haltères', false, 'tirage horizontal (poulie)', null),
      E('barre au front (barre EZ)', 'barre EZ, banc', false, 'extension triceps à la poulie', 'extension triceps à la poulie'),
      E('relevés de jambes suspendu (barre fixe)', 'barre fixe', false, 'gainage ventral sans barre fixe', 'gainage ventral'),
    ],
    ciblesDuDossier: {
      'pectoraux': 9,
      'deltoide-anterieur': 7.5,
      'deltoide-lateral': 4.5,
      'deltoide-posterieur': 4.5,
      'biceps': 8.5,
      'triceps': 11.5,
      'avant-bras': 2,
      'dorsaux': 9,
      'trapezes': 3,
      'lombaires': 1.5,
      'abdominaux': 4,
      'obliques': 1,
      'quadriceps': 10,
      'ischio-jambiers': 6,
      'fessiers': 6.5,
      'adducteurs': 5,
      'mollets': 7,
      'cou': 0,
    },
  },
  {
    cle: 'M5',
    nom: 'Corps entier, 2 jours',
    description: 'Deux séances de corps entier (A et B) par semaine ; chaque muscle est travaillé une ou deux fois par semaine. Le volume hebdomadaire des grands groupes se situe entre 5 et 8 séries : modèle économe, sous le repère d’environ 10.',
    pourQui: 'Novices (ACSM 2009 : 2 à 3 jours en corps entier, D04-01 et D04-04) ; personnes à temps limité ; cadre de maintien. Un programme public de deux séances par semaine est jugé de volume « plutôt faible » par son auteur pour intermédiaires et avancés (D05-12).',
    parSemaine: 2,
    seriesParSemaine: 39,
    equipement: 'salle',
    equipementDetail: 'salle : barres, haltères, poulies, machines, banc, barres parallèles, barre fixe',
    decoupage: 'D04',
    propose: null,
    avertissements: [
      'petits muscles peu travaillés',
    ],
    sources: 'D04-01, D04-04 (novices, 1 à 3 séries par exercice) ; deux séances contre trois, à volume égal, ont donné les mêmes gains chez des débutants (D04-09, D05-10) ; le volume prime sur la fréquence dans la revue sur l’entraînement économe en temps, au moins 4 séries par groupe et par semaine (D04-06) ; au moins 2 jours non consécutifs par semaine (D04-02). Un passage par semaine peut suffire d’après un consensus d’athlètes (D04-07).',
    limites: 'Cibles hebdomadaires sous le repère d’environ 10 pour la plupart des muscles ; plusieurs muscles restent sous le minimum d’environ 4 (voir le tableau des cibles). Le dossier ne donne ni fréquence ni volume précis pour les « 2 jours » au-delà des lignes citées.',
    sensibilite: 'Si la bibliothèque réelle classe les fessiers en muscle principal au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 4,5 à 7,5 séries par semaine ; les autres cibles ne changent pas.',
    seances: [
      {
        nom: 'Corps entier A',
        minutes: 44,
        blocs: [
          B('squat (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('développé couché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('rowing buste penché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('leg curl', 2, 10, 15, 90, '1-2', 1, '3-4', 'Assis plutôt que couché si l’appareil le permet (H07-11).'),
          B('élévations latérales (haltères)', 2, 12, 20, 75, '1-2', 1, '3-4'),
          B('curl biceps (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('gainage ventral', 2, 30, 60, 60, null, 1, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade.'),
        ],
      },
      {
        nom: 'Corps entier B',
        minutes: 55,
        blocs: [
          B('presse à cuisses', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('développé incliné (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('tirage vertical (poulie)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('soulevé de terre jambes tendues (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('développé militaire (barre)', 2, 8, 12, 150, '2-3', 1, '3-4'),
          B('extension triceps à la poulie', 2, 10, 15, 90, '1-2', 1, '3-4', 'Si la variante existe, bras au-dessus de la tête (H07-11).'),
          B('mollets debout (machine)', 4, 10, 20, 90, '1-2', 2, '3-4'),
          B('relevés de jambes suspendu (barre fixe)', 2, 8, 15, 60, '1-2', 1, '3-4'),
        ],
      },
    ],
    exercices: [
      E('squat (barre)', 'barre, support', false, 'presse à cuisses', 'fentes (haltères) ou presse à cuisses'),
      E('développé couché (barre)', 'barre, banc', false, 'développé incliné (haltères) si pas de barre ni de support', 'développé incliné (haltères), prise libre'),
      E('rowing buste penché (barre)', 'barre', false, 'tirage horizontal (poulie)', 'tirage vertical (poulie), buste soutenu'),
      E('leg curl', 'machine', false, 'soulevé de terre jambes tendues (barre)', null),
      E('élévations latérales (haltères)', 'haltères', false, 'pas d’équivalent présent (l’exercice peut se faire à la poulie : variante non présente)', 'développé militaire (barre), en secondaire'),
      E('curl biceps (haltères)', 'haltères', false, 'curl marteau (haltères)', 'curl marteau (haltères), prise neutre'),
      E('gainage ventral', 'poids du corps', false, 'gainage latéral', 'relevés de jambes suspendu (barre fixe)'),
      E('presse à cuisses', 'machine', false, 'squat (barre)', 'fentes (haltères)'),
      E('développé incliné (haltères)', 'haltères, banc incliné', false, 'développé couché (barre) sans haltères lourds', 'écarté couché (haltères), amplitude réduite'),
      E('tirage vertical (poulie)', 'poulie haute', false, 'tractions pronation (barre fixe)', 'tirage horizontal (poulie)'),
      E('soulevé de terre jambes tendues (barre)', 'barre', false, 'hip thrust (barre)', 'leg curl'),
      E('développé militaire (barre)', 'barre', false, 'développé incliné (haltères)', 'élévations latérales (haltères)'),
      E('extension triceps à la poulie', 'poulie', false, 'barre au front (barre EZ)', 'dips (barres parallèles) en secondaire'),
      E('mollets debout (machine)', 'machine', false, 'mollets debout à une jambe (haltère) sans machine, à ajouter', null),
      E('relevés de jambes suspendu (barre fixe)', 'barre fixe', false, 'gainage ventral sans barre fixe', 'gainage ventral'),
    ],
    ciblesDuDossier: {
      'pectoraux': 6,
      'deltoide-anterieur': 5,
      'deltoide-lateral': 3,
      'deltoide-posterieur': 1.5,
      'biceps': 5,
      'triceps': 6,
      'avant-bras': 1,
      'dorsaux': 6,
      'trapezes': 1.5,
      'lombaires': 1.5,
      'abdominaux': 4,
      'obliques': 1,
      'quadriceps': 6,
      'ischio-jambiers': 5,
      'fessiers': 4.5,
      'adducteurs': 3,
      'mollets': 4,
      'cou': 0,
    },
  },
  {
    cle: 'M6',
    nom: 'Maison, haltères et poids du corps, 3 jours',
    description: 'Trois séances de corps entier (Maison A, B, C) à faire sur des jours non consécutifs, avec une paire d’haltères (idéalement réglables), le poids du corps, un sol, une chaise ou une marche. Les pectoraux, les dorsaux, les cuisses, les fessiers, les deux parties des épaules (avant, côté), les biceps et les triceps sont travaillés trois fois par semaine ; les ischio-jambiers et les mollets deux fois. Les fourchettes de répétitions sont plus hautes qu’en salle (10 à 15, 12 à 20) parce que les haltères sont légers. Le gainage ventral est dans la séance A, le gainage latéral dans la séance B.',
    pourQui: 'Pratiquants sans salle : novices et intermédiaires. Les essais d’hypertrophie au poids du corps ou aux charges légères portent sur des hommes jeunes non entraînés, des femmes sédentaires jeunes et des adultes âgés non entraînés (D08-01, D08-06, D08-14, D08-16) ; pour un avancé, aucun essai d’hypertrophie au poids du corps n’a été trouvé (D08-03 donne de la force seulement).',
    parSemaine: 3,
    seriesParSemaine: 67,
    equipement: 'maison',
    equipementDetail: 'maison : une paire d’haltères (idéalement réglables), le poids du corps, un sol, une chaise ou une marche, un appui (canapé, banc ou chaise)',
    decoupage: 'D08',
    propose: null,
    avertissements: [],
    sources: 'Fiche D08 (point 7.1). Pompes : D08-01, D08-02, D08-04, D08-05. Charge légère menée près de l’échec : D08-14, D08-15, H03-01, H03-02. Unilatéral (fentes, rowing à un bras, mollets à une jambe) : D08-13, D08-31. Fessiers et ischio-jambiers sans machine : D08-35, D08-36, D08-37, D08-39. Mollets : D08-40, D08-41. Épaules et triceps : D08-45, D08-46, D08-47. Corps entier sur 3 jours : D05-01, D05-03. Élastique ou sangle à la place d’un haltère : D08-52.',
    limites: 'Sept exercices sont à ajouter (point 9) et aucun n’a été testé tel quel : le rowing à un bras, le développé d’épaules aux haltères, le soulevé jambes tendues aux haltères, le hip thrust à l’haltère et l’extension du triceps à l’haltère n’ont que des essais voisins (D08-35, D08-43, D08-44, D08-46, D08-47). Pas de tirage vertical sans barre fixe : les dorsaux ne sont travaillés que par le rowing (cibles à 9). Sous le minimum d’environ 4 : avant-bras, lombaires, abdominaux, obliques et cou (voir le tableau des cibles). Avec des haltères légers, les séries doivent s’approcher de l’échec : s’arrêter loin de l’échec à charge très légère a donné un gain faible et non significatif (D08-14) ; la fourchette de répétitions réelle dépend donc de la personne et du poids dont elle dispose. La preuve des pompes est partagée (D08-01, D08-02).',
    sensibilite: 'Si la bibliothèque réelle classe les fessiers en muscle principal au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 10 à 14,5 séries par semaine ; les autres cibles ne changent pas.',
    seances: [
      {
        nom: 'Maison A',
        minutes: 46,
        blocs: [
          B('pompes', 3, 8, 20, 90, '1-2', 2, '3-4', 'choisir la variante qui permet 8 à 20 répétitions (échelle de difficulté : D08-05) Exercice à ajouter (R4).'),
          B('fentes (haltères)', 3, 10, 15, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série).'),
          B('rowing à un bras (haltère)', 3, 10, 15, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4).'),
          B('développé épaules (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4', 'Exercice à ajouter (R4).'),
          B('élévations latérales (haltères)', 2, 12, 20, 75, '1-2', 1, '3-4'),
          B('curl biceps (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('extension triceps au-dessus de la tête (haltère)', 2, 10, 15, 90, '1-2', 1, '3-4', 'Exercice à ajouter (R4).'),
          B('gainage ventral', 2, 30, 60, 60, null, 1, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade.'),
        ],
      },
      {
        nom: 'Maison B',
        minutes: 53,
        blocs: [
          B('soulevé de terre jambes tendues (haltères)', 3, 10, 15, 120, '1-2', 2, '3-4', 'Exercice à ajouter (R4).'),
          B('fentes (haltères)', 3, 10, 15, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série).'),
          B('pompes', 3, 8, 20, 90, '1-2', 2, '3-4', 'choisir la variante qui permet 8 à 20 répétitions (échelle de difficulté : D08-05) Exercice à ajouter (R4).'),
          B('rowing à un bras (haltère)', 3, 10, 15, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4).'),
          B('élévations latérales (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('curl marteau (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('mollets debout à une jambe (haltère)', 4, 12, 20, 90, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4).'),
          B('gainage latéral', 2, 30, 60, 60, null, 1, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade. Une série = les deux côtés faits (compte pour 1 série).'),
        ],
      },
      {
        nom: 'Maison C',
        minutes: 58,
        blocs: [
          B('fentes (haltères)', 3, 10, 15, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série).'),
          B('hip thrust (haltère)', 3, 10, 15, 120, '1-2', 2, '3-4', 'Exercice à ajouter (R4).'),
          B('soulevé de terre jambes tendues (haltères)', 2, 10, 15, 120, '1-2', 1, '3-4', 'Exercice à ajouter (R4).'),
          B('pompes', 3, 8, 20, 90, '1-2', 2, '3-4', 'Exercice à ajouter (R4).'),
          B('rowing à un bras (haltère)', 3, 10, 15, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4).'),
          B('développé épaules (haltères)', 2, 8, 12, 120, '1-2', 1, '3-4', 'Exercice à ajouter (R4).'),
          B('élévations latérales (haltères)', 2, 12, 20, 75, '1-2', 1, '3-4'),
          B('extension triceps au-dessus de la tête (haltère)', 2, 10, 15, 90, '1-2', 1, '3-4', 'Exercice à ajouter (R4).'),
          B('mollets debout à une jambe (haltère)', 4, 12, 20, 90, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4).'),
        ],
      },
    ],
    exercices: [
      E('pompes', 'poids du corps (sol)', false, 'développé incliné (haltères) si un banc est disponible', 'pompes mains surélevées ou à genoux (variantes plus faciles : D08-05)'),
      E('fentes (haltères)', 'haltères', true, 'fentes avec le pied arrière sur une chaise (variante interchangeable pour l’hypertrophie : D08-31) ; presse à cuisses si une machine est disponible', 'fentes (haltères), amplitude réduite'),
      E('rowing à un bras (haltère)', 'haltère, appui (chaise, banc)', true, 'tractions pronation (barre fixe) si une barre fixe est disponible ; tirage horizontal (poulie) si une poulie est disponible', 'rowing à un bras, buste soutenu par l’appui'),
      E('développé épaules (haltères)', 'haltères', false, 'développé militaire (barre) si une barre est disponible', 'élévations latérales (haltères), en secondaire'),
      E('élévations latérales (haltères)', 'haltères', false, 'élévations latérales à l’élastique ou à la sangle (force équivalente : D08-52 ; hypertrophie : non trouvé)', 'développé épaules (haltères), en secondaire'),
      E('curl biceps (haltères)', 'haltères', false, 'curl marteau (haltères)', 'curl marteau (haltères), prise neutre'),
      E('extension triceps au-dessus de la tête (haltère)', 'haltère', false, 'extension triceps à la poulie ou barre au front (barre EZ) si le matériel existe', 'pompes, en secondaire'),
      E('gainage ventral', 'poids du corps', false, 'gainage latéral', 'relevés de jambes suspendu (barre fixe) si une barre fixe est disponible'),
      E('soulevé de terre jambes tendues (haltères)', 'haltères', false, 'soulevé de terre jambes tendues (barre) si une barre est disponible', 'hip thrust (haltère)'),
      E('curl marteau (haltères)', 'haltères', false, 'curl biceps (haltères)', 'curl biceps (haltères)'),
      E('mollets debout à une jambe (haltère)', 'haltère, marche', true, 'mollets debout (machine) si une machine est disponible', null),
      E('gainage latéral', 'poids du corps', true, 'gainage ventral', 'gainage ventral'),
      E('hip thrust (haltère)', 'haltère, appui (canapé, banc, chaise)', false, 'hip thrust (barre) si barre et banc', 'soulevé de terre jambes tendues (haltères)'),
    ],
    ciblesDuDossier: {
      'pectoraux': 9,
      'deltoide-anterieur': 9.5,
      'deltoide-lateral': 9.5,
      'deltoide-posterieur': 4.5,
      'biceps': 8.5,
      'triceps': 11,
      'avant-bras': 2,
      'dorsaux': 9,
      'trapezes': 4.5,
      'lombaires': 2.5,
      'abdominaux': 3,
      'obliques': 3,
      'quadriceps': 9,
      'ischio-jambiers': 6.5,
      'fessiers': 10,
      'adducteurs': 4.5,
      'mollets': 8,
      'cou': 0,
    },
  },
  {
    cle: 'M7',
    nom: 'Haut / Bas, 4 jours, avec bloc de spécialisation des épaules (côté)',
    description: 'Le Haut/Bas 4 jours (M3) auquel s’ajoute un bloc de spécialisation sur les épaules (côté), pris comme exemple de la recette de la fiche D09. La cible hebdomadaire des épaules (côté) passe de 6 à 11 séries fractionnées, en 3 passages (Haut A, Haut B, Bas B) ; elle est financée par −2,5 séries pour les biceps, −1 pour les dorsaux, −1 pour les mollets et −1 pour les abdominaux, et −1 pour les avant-bras (effet de la baisse des curls). Bloc de 6 semaines suivi d’une semaine de déload, renouvelable une fois, puis retour à M3 (choix du dossier, D09-18, D09-19).',
    pourQui: 'Intermédiaires et avancés qui jugent un muscle en retard et ont déjà un volume de base. Les pages de coachs réservent la spécialisation aux personnes avancées, hors déficit calorique (D09-26) ; ne pas proposer en phase « sèche ».',
    parSemaine: 4,
    seriesParSemaine: 77,
    equipement: 'salle',
    equipementDetail: 'salle : comme le Haut/Bas 4 jours',
    decoupage: 'D03, D09',
    propose: null,
    avertissements: [],
    sources: 'Fiche D09 (point 7.2) et recette. Relèvement : +4 à +6 séries (environ +50 %) chez les coachs (D09-09, D09-10) ; ici +5, de 6 à 11 : sous la plage 12 à 18 de la fiche parce que la base de 6 est basse. Essais voisins : D09-02 (volume relevé sans gain d’épaisseur du coude chez 42 entraînés ; exemple du résumé : +4 séries par semaine), D09-03 (16 contre 8 séries, avantage détectable pour l’hypertrophie), D09-05. Réduction ailleurs : D09-11, D09-12, D09-21, H10-08. Structure de base : D03-01, D03-02, D03-05, D03-06.',
    limites: 'Aucune étude ne teste cette phase (D09-01) ; le relèvement de 6 à 11 séries n’est pas démontré, et un volume relevé (exemple : +4 séries par semaine) n’a rien changé chez des entraînés (D09-02). Aucun plafond de volume total sourcé (D09-22). Les baisses ailleurs (−1 à −2,5 séries) sont plus douces que celles de RP (environ 4 séries par muscle, D09-11) et du même ordre que celles d’Alpha (−2, D09-12). La séance Bas B passe à 19 séries avec un bloc de côté de 2 séries ajoutées à la fin.',
    sensibilite: 'Si la bibliothèque réelle classe les fessiers en muscle principal au squat, aux fentes et à la presse à cuisses (au lieu de secondaire), la cible des fessiers de ce modèle passe de 9,5 à 14,5 séries par semaine ; les autres cibles ne changent pas.',
    seances: [
      {
        nom: 'Haut A',
        minutes: 50,
        blocs: [
          B('développé couché (barre)', 4, 6, 10, 150, '2-3', 2, '3-4'),
          B('rowing buste penché (barre)', 3, 6, 10, 150, '2-3', 2, '3-4'),
          B('développé militaire (barre)', 2, 8, 12, 150, '2-3', 1, '3-4'),
          B('tirage vertical (poulie)', 2, 8, 12, 120, '1-2', 1, '3-4'),
          B('élévations latérales (haltères)', 4, 12, 20, 75, '1-2', 2, '3-4'),
          B('extension triceps à la poulie', 2, 10, 15, 90, '1-2', 1, '3-4', 'Si la variante existe, bras au-dessus de la tête (H07-11).'),
          B('curl biceps (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
        ],
      },
      {
        nom: 'Bas A',
        minutes: 39,
        blocs: [
          B('squat (barre)', 4, 6, 10, 150, '2-3', 2, '3-4'),
          B('soulevé de terre jambes tendues (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('leg curl', 3, 10, 15, 90, '1-2', 2, '3-4', 'Assis plutôt que couché si l’appareil le permet (H07-11).'),
          B('mollets debout (machine)', 3, 10, 20, 90, '1-2', 2, '3-4'),
          B('gainage ventral', 3, 30, 60, 60, null, 2, null, 'Répétitions = secondes de maintien ; arrêter avant que la position se dégrade.'),
        ],
      },
      {
        nom: 'Haut B',
        minutes: 54,
        blocs: [
          B('développé incliné (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('tractions pronation (barre fixe)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('dips (barres parallèles)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('tirage horizontal (poulie)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('élévations latérales (haltères)', 4, 12, 20, 75, '1-2', 2, '3-4'),
          B('oiseau (haltères)', 3, 12, 20, 75, '1-2', 2, '3-4'),
          B('barre au front (barre EZ)', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('curl marteau (haltères)', 2, 10, 15, 90, '1-2', 1, '3-4'),
        ],
      },
      {
        nom: 'Bas B',
        minutes: 44,
        blocs: [
          B('presse à cuisses', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('fentes (haltères)', 3, 8, 12, 120, '1-2', 2, '3-4', 'Une série = les deux côtés faits (compte pour 1 série).'),
          B('hip thrust (barre)', 3, 8, 12, 120, '1-2', 2, '3-4'),
          B('adducteurs à la machine', 2, 10, 15, 90, '1-2', 1, '3-4'),
          B('mollets debout (machine)', 4, 10, 20, 90, '1-2', 2, '3-4'),
          B('relevés de jambes suspendu (barre fixe)', 2, 8, 15, 60, '1-2', 1, '3-4'),
          B('élévations latérales (haltères)', 2, 12, 20, 75, '1-2', 1, '3-4', 'séries ajoutées pour le bloc de spécialisation (troisième passage du muscle visé)'),
        ],
      },
    ],
    exercices: [
      E('développé couché (barre)', 'barre, banc', false, 'développé incliné (haltères) si pas de barre ni de support', 'développé incliné (haltères), prise libre'),
      E('rowing buste penché (barre)', 'barre', false, 'tirage horizontal (poulie)', 'tirage vertical (poulie), buste soutenu'),
      E('développé militaire (barre)', 'barre', false, 'développé incliné (haltères)', 'élévations latérales (haltères)'),
      E('tirage vertical (poulie)', 'poulie haute', false, 'tractions pronation (barre fixe)', 'tirage horizontal (poulie)'),
      E('élévations latérales (haltères)', 'haltères', false, 'pas d’équivalent présent (l’exercice peut se faire à la poulie : variante non présente)', 'développé militaire (barre), en secondaire'),
      E('extension triceps à la poulie', 'poulie', false, 'barre au front (barre EZ)', 'dips (barres parallèles) en secondaire'),
      E('curl biceps (haltères)', 'haltères', false, 'curl marteau (haltères)', 'curl marteau (haltères), prise neutre'),
      E('squat (barre)', 'barre, support', false, 'presse à cuisses', 'fentes (haltères) ou presse à cuisses'),
      E('soulevé de terre jambes tendues (barre)', 'barre', false, 'hip thrust (barre)', 'leg curl'),
      E('leg curl', 'machine', false, 'soulevé de terre jambes tendues (barre)', null),
      E('mollets debout (machine)', 'machine', false, 'mollets debout à une jambe (haltère) sans machine, à ajouter', null),
      E('gainage ventral', 'poids du corps', false, 'gainage latéral', 'relevés de jambes suspendu (barre fixe)'),
      E('développé incliné (haltères)', 'haltères, banc incliné', false, 'développé couché (barre) sans haltères lourds', 'écarté couché (haltères), amplitude réduite'),
      E('tractions pronation (barre fixe)', 'barre fixe', false, 'tirage vertical (poulie) sans barre fixe', 'rowing buste penché (barre)'),
      E('dips (barres parallèles)', 'barres parallèles', false, 'développé incliné (haltères) sans barres parallèles', 'extension triceps à la poulie'),
      E('tirage horizontal (poulie)', 'poulie basse', false, 'rowing buste penché (barre)', 'tirage vertical (poulie)'),
      E('oiseau (haltères)', 'haltères', false, 'tirage horizontal (poulie)', null),
      E('barre au front (barre EZ)', 'barre EZ, banc', false, 'extension triceps à la poulie', 'extension triceps à la poulie'),
      E('curl marteau (haltères)', 'haltères', false, 'curl biceps (haltères)', 'curl biceps (haltères)'),
      E('presse à cuisses', 'machine', false, 'squat (barre)', 'fentes (haltères)'),
      E('fentes (haltères)', 'haltères', true, 'presse à cuisses', 'presse à cuisses, charge réduite'),
      E('hip thrust (barre)', 'barre, banc', false, 'soulevé de terre jambes tendues (barre)', 'fentes (haltères)'),
      E('adducteurs à la machine', 'machine', false, 'pas d’équivalent présent', null),
      E('relevés de jambes suspendu (barre fixe)', 'barre fixe', false, 'gainage ventral sans barre fixe', 'gainage ventral'),
    ],
    ciblesDuDossier: {
      'pectoraux': 10,
      'deltoide-anterieur': 7,
      'deltoide-lateral': 11,
      'deltoide-posterieur': 6,
      'biceps': 9.5,
      'triceps': 11.5,
      'avant-bras': 2,
      'dorsaux': 11,
      'trapezes': 4.5,
      'lombaires': 1.5,
      'abdominaux': 5,
      'obliques': 1.5,
      'quadriceps': 10,
      'ischio-jambiers': 7.5,
      'fessiers': 9.5,
      'adducteurs': 7,
      'mollets': 7,
      'cou': 0,
    },
  },
];

/**
 * Le libellé d’un bloc, rendu en identité de bibliothèque.
 *
 * Le dossier écrit « développé couché (barre) » ; la bibliothèque sépare le
 * nom de l’équipement, parce que l’équipement fait partie de l’identité de
 * comparaison (`identiteDeComparaison`, `modele.ts`). Sans cette table, une
 * copie créerait un exercice « développé couché (barre) » à côté du
 * « Développé couché / barre » déjà présent, et couperait la progression en
 * deux sans que rien ne le signale.
 */
const IDENTITES: Record<string, IdentiteExercice> = {
  'adducteurs à la machine': { nom: 'Adducteurs à la machine', equipement: 'machine', variante: '' },
  'barre au front (barre EZ)': { nom: 'Barre au front', equipement: 'barre EZ', variante: '' },
  'curl biceps (haltères)': { nom: 'Curl biceps', equipement: 'haltères', variante: '' },
  'curl marteau (haltères)': { nom: 'Curl marteau', equipement: 'haltères', variante: '' },
  'développé couché (barre)': { nom: 'Développé couché', equipement: 'barre', variante: '' },
  'développé incliné (haltères)': { nom: 'Développé incliné', equipement: 'haltères', variante: '' },
  'développé militaire (barre)': { nom: 'Développé militaire', equipement: 'barre', variante: '' },
  'dips (barres parallèles)': { nom: 'Dips', equipement: 'barres parallèles', variante: '' },
  'écarté couché (haltères)': { nom: 'Écarté couché', equipement: 'haltères', variante: '' },
  'élévations latérales (haltères)': { nom: 'Élévations latérales', equipement: 'haltères', variante: '' },
  'extension triceps à la poulie': { nom: 'Extension triceps à la poulie', equipement: 'poulie', variante: '' },
  'fentes (haltères)': { nom: 'Fentes', equipement: 'haltères', variante: '' },
  'gainage latéral': { nom: 'Gainage latéral', equipement: 'sol', variante: '' },
  'gainage ventral': { nom: 'Gainage ventral', equipement: 'sol', variante: '' },
  'hip thrust (barre)': { nom: 'Hip thrust', equipement: 'barre', variante: '' },
  'leg curl': { nom: 'Leg curl', equipement: 'machine', variante: '' },
  'mollets debout (machine)': { nom: 'Mollets debout', equipement: 'machine', variante: '' },
  'oiseau (haltères)': { nom: 'Oiseau', equipement: 'haltères', variante: '' },
  'presse à cuisses': { nom: 'Presse à cuisses', equipement: 'machine', variante: '' },
  'relevés de jambes suspendu (barre fixe)': { nom: 'Relevés de jambes suspendu', equipement: 'barre fixe', variante: '' },
  'rowing buste penché (barre)': { nom: 'Rowing buste penché', equipement: 'barre', variante: '' },
  'shrugs (haltères)': { nom: 'Shrugs', equipement: 'haltères', variante: '' },
  'soulevé de terre jambes tendues (barre)': { nom: 'Soulevé de terre jambes tendues', equipement: 'barre', variante: '' },
  'squat (barre)': { nom: 'Squat', equipement: 'barre', variante: '' },
  'tirage horizontal (poulie)': { nom: 'Tirage horizontal', equipement: 'poulie', variante: '' },
  'tirage vertical (poulie)': { nom: 'Tirage vertical', equipement: 'poulie', variante: '' },
  'tractions pronation (barre fixe)': { nom: 'Tractions pronation', equipement: 'barre fixe', variante: '' },
  'pompes': { nom: 'Pompes', equipement: 'sol', variante: '' },
  'rowing à un bras (haltère)': { nom: 'Rowing à un bras', equipement: 'haltère', variante: '' },
  'développé épaules (haltères)': { nom: 'Développé épaules', equipement: 'haltères', variante: '' },
  'extension triceps au-dessus de la tête (haltère)': { nom: 'Extension triceps au-dessus de la tête', equipement: 'haltère', variante: '' },
  'soulevé de terre jambes tendues (haltères)': { nom: 'Soulevé de terre jambes tendues', equipement: 'haltères', variante: '' },
  'mollets debout à une jambe (haltère)': { nom: 'Mollets debout à une jambe', equipement: 'haltère', variante: '' },
  'hip thrust (haltère)': { nom: 'Hip thrust', equipement: 'haltère', variante: '' },
};

export const identiteDeLExercice = (libelleDuDossier: string): IdentiteExercice | undefined =>
  IDENTITES[libelleDuDossier];

/** Tous les libellés que les sept modèles emploient. */
export const EXERCICES_DES_MODELES: readonly string[] = Object.keys(IDENTITES);

/** Un modèle par sa clef du dossier. */
export const modeleParCle = (cle: string): ModeleDeProgramme | undefined =>
  MODELES_DE_PROGRAMMES.find((m) => m.cle === cle);
