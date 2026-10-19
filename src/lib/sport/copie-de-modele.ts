/**
 * Faire d'un modèle une copie à soi, et recalculer ses cibles.
 *
 * ## Une copie, et pas une référence
 *
 * « Utiliser ce modèle » ne branche rien sur le catalogue : il en tire un
 * `Programme` ordinaire, modifiable, que plus rien ne relie au modèle. C'est
 * la seule forme qui tienne la promesse du prompt 48 — « Cyclades en fait une
 * copie à soi, modifiable, et rien d'autre ne change » : un programme qui
 * resterait lié au modèle se verrait réécrit le jour où le modèle bouge, et
 * les modifications de la personne passeraient par-dessus bord.
 *
 * ## Les cibles sont recalculées, et l'écart est dit
 *
 * Le dossier donne des cibles par muscle. Elles ne sont **pas** reprises :
 * son classement des muscles est une convention écrite sans accès à
 * `BIBLIOTHEQUE`, et il le dit lui-même. Les cibles d'une copie sont donc
 * calculées depuis les exercices réels — ceux de la personne, pas ceux du
 * dossier, puisqu'elle a pu les modifier.
 *
 * Le calcul passe par `volumePrevu`, et c'est délibéré : réimplémenter la
 * pondération ici donnerait deux formules à tenir d'accord, et la
 * comparaison prévu/réalisé de l'écran mesurerait alors leur divergence
 * autant que celle de la personne. C'est l'argument déjà écrit en tête de
 * `programmes.ts`, et il vaut deux fois ici.
 *
 * `ecartsDeCibles` rend la différence avec le dossier, muscle par muscle.
 * Elle est **signalée**, jamais rattrapée en silence : c'est la décision 7
 * du 18 octobre, et c'est aussi la seule conduite honnête quand une valeur
 * sourcée et une valeur calculée ne disent pas la même chose.
 *
 * ## Rien n'est écrit ici
 *
 * Ce module est pur. Il ne touche ni `sportProgrammes` ni — surtout —
 * `sportSeances` : un modèle prépare une séance, il n'en crée jamais.
 */
import {
  COEFFICIENT_SECONDAIRE,
  MUSCLES,
  identiteDeComparaison,
  musclesEmpeches,
  type Blessure,
  type Exercice,
} from './modele';
import { volumePrevu, type BlocPrevu, type Programme, type SeanceType } from './programmes';
import {
  EXERCICES_DES_MODELES,
  MODELES_DE_PROGRAMMES,
  identiteDeLExercice,
  type BlocDeModele,
  type ExerciceDuModele,
  type IdentiteExercice,
  type ModeleDeProgramme,
} from './modeles-programmes';

/* ══════════════════════════════════════════════════════════════════════════
   Retrouver les exercices du modèle parmi ceux de la personne
   ══════════════════════════════════════════════════════════════════════════ */

export interface ExercicesDuModele {
  /** Le libellé du dossier → l'exercice de la personne qui lui correspond. */
  resolus: Map<string, Exercice>;
  /**
   * Les identités qu'aucun exercice de la personne ne porte.
   *
   * Ce sont celles qu'une copie devra créer. Elles sont rendues plutôt
   * qu'ajoutées : ce module ne décide pas d'écrire.
   */
  manquants: { libelle: string; identite: IdentiteExercice }[];
  /**
   * Les libellés que le catalogue n'a pas su rattacher à une identité.
   *
   * Normalement vide — `essais:modeles-sport` le vérifie. Non vide, c'est une
   * faute de transcription, et il vaut mieux la rendre qu'inventer un
   * exercice au nom approximatif.
   */
  orphelins: string[];
}

/**
 * Associe chaque bloc du modèle à un exercice de la personne.
 *
 * L'appariement se fait sur l'**identité de comparaison** — nom, équipement,
 * variante, normalisés — et non sur le nom seul. C'est ce qui évite de créer
 * un second « développé couché » à côté de celui qui porte déjà une
 * progression.
 */
export function exercicesDuModele(
  modele: ModeleDeProgramme,
  exercices: readonly Exercice[],
  substitutions: Map<string, string> = new Map(),
): ExercicesDuModele {
  const parIdentite = new Map(exercices.map((e) => [identiteDeComparaison(e), e]));
  const resolus = new Map<string, Exercice>();
  const manquants: ExercicesDuModele['manquants'] = [];
  const orphelins: string[] = [];
  const vus = new Set<string>();

  for (const seance of modele.seances) {
    for (const bloc of seance.blocs) {
      /*
         Le libellé EFFECTIF, après adaptation au matériel : c'est celui-là
         qu'il faut retrouver ou créer. Résoudre le libellé d'origine ferait
         créer un exercice à la barre pour quelqu'un qui n'en a pas.
      */
      const libelle = substitutions.get(bloc.exercice) ?? bloc.exercice;
      if (vus.has(libelle)) continue;
      vus.add(libelle);
      const identite = identiteDeLExercice(libelle);
      if (!identite) {
        orphelins.push(libelle);
        continue;
      }
      const existant = parIdentite.get(identiteDeComparaison(identite));
      if (existant) resolus.set(libelle, existant);
      else manquants.push({ libelle, identite });
    }
  }
  return { resolus, manquants, orphelins };
}

/* ══════════════════════════════════════════════════════════════════════════
   Du bloc du modèle au bloc prévu
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La mention qui s'adresse au documentaliste et non à la personne.
 *
 * Le dossier marque « Exercice à ajouter (R4). » les blocs dont l'exercice
 * n'était pas encore dans la bibliothèque. Une fois l'exercice ajouté, la
 * mention n'apprend plus rien à qui s'entraîne — et elle est du jargon de
 * chantier, ce que la section G interdit à l'écran. Elle est retirée **ici**,
 * à la copie, et non dans la transcription : l'essai de conformité doit
 * pouvoir la retrouver dans le catalogue.
 */
const MENTION_DE_CHANTIER = /\s*Exercice à ajouter \(R4\)\.\s*/g;

/**
 * La note d'un bloc prévu : celle du dossier, plus le RIR visé.
 *
 * Le RIR est présenté comme une **aide**, jamais comme une mesure : il est
 * sous-estimé de près d'une répétition en moyenne (H04-11). Il va dans la
 * note plutôt que dans un champ propre parce que `BlocPrevu` n'en a pas, et
 * que lui en ajouter un obligerait à migrer tous les programmes existants —
 * ce que le prompt interdit.
 */
export function noteDuBloc(bloc: BlocDeModele): string {
  const duDossier = bloc.note.replace(MENTION_DE_CHANTIER, ' ').replace(/\s+/g, ' ').trim();
  const aide =
    bloc.rir === null
      ? ''
      : `Garder ${bloc.rir} répétitions en réserve, à titre indicatif.`;
  return [duDossier, aide].filter(Boolean).join(' ');
}

const blocPrevu = (bloc: BlocDeModele, exerciceId: string): BlocPrevu => ({
  exerciceId,
  series: bloc.series,
  repetitionsMin: bloc.repetitionsMin,
  repetitionsMax: bloc.repetitionsMax,
  repos: bloc.repos,
  /*
     Aucune charge de départ : le dossier n'en donne pas, et en inventer une
     serait proposer un poids qu'aucune source ne soutient. La personne la
     saisit à la première séance, où elle la connaît mieux que nous.
  */
  chargeIndicative: null,
  note: noteDuBloc(bloc),
});

/**
 * Les séances types d'un modèle, dans l'ordre du programme.
 *
 * L'ordre est celui du dossier (A, B, C…) : les séances s'enchaînent, et
 * c'est la décision 8 du 18 octobre. Un bloc dont l'exercice n'a pas été
 * résolu est **omis** plutôt que rendu avec un identifiant vide, qui ferait
 * échouer `controlerProgramme` sur un message incompréhensible.
 */
export function seancesDuModele(
  modele: ModeleDeProgramme,
  resolus: Map<string, Exercice>,
  substitutions: Map<string, string> = new Map(),
): SeanceType[] {
  return modele.seances.map((seance, rang) => ({
    id: `${modele.cle}-${rang + 1}`,
    nom: seance.nom,
    blocs: seance.blocs
      .map((bloc) => {
        const exercice = resolus.get(substitutions.get(bloc.exercice) ?? bloc.exercice);
        return exercice ? blocPrevu(bloc, exercice.id) : null;
      })
      .filter((b): b is BlocPrevu => b !== null),
  }));
}

/* ══════════════════════════════════════════════════════════════════════════
   Les cibles, recalculées
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les cibles hebdomadaires d'un modèle, calculées depuis les exercices réels.
 *
 * Le détour par un `Programme` provisoire n'est pas une maladresse : c'est ce
 * qui garantit que la cible et le « prévu » de l'écran sortent du **même**
 * calcul. Deux chemins donneraient deux nombres, et la colonne « écart »
 * deviendrait illisible.
 */
export function ciblesDuModele(
  modele: ModeleDeProgramme,
  resolus: Map<string, Exercice>,
  exercices: readonly Exercice[],
  coefficient = COEFFICIENT_SECONDAIRE,
  substitutions: Map<string, string> = new Map(),
): Record<string, number> {
  const provisoire: Programme = {
    id: 'provisoire',
    nom: modele.nom,
    description: '',
    seances: seancesDuModele(modele, resolus, substitutions),
    parSemaine: modele.parSemaine,
    actif: false,
    ciblesParMuscle: {},
    majLe: new Date(0).toISOString(),
  };
  const { series } = volumePrevu(provisoire, exercices, coefficient);
  /*
     Les dix-huit muscles sont déclarés, y compris ceux à zéro.

     Un muscle absent de `ciblesParMuscle` vaut « aucun jugement » dans
     `comparerVolumes` ; un muscle à zéro vaut « on sait qu'il n'est pas
     travaillé ». La différence compte : quatre des sept modèles laissent les
     adducteurs à zéro une fois recalculés, et c'est une information, pas une
     absence d'information.
  */
  const cibles: Record<string, number> = {};
  for (const m of MUSCLES) cibles[m.id] = series[m.id] ?? 0;
  return cibles;
}

/**
 * Les muscles qu'aucun exercice du modèle ne travaille.
 *
 * ## Pourquoi c'est dit AVANT la copie
 *
 * Recalculées depuis la bibliothèque, les cibles de certains modèles tombent
 * à zéro sur un muscle que le dossier croyait travaillé : les adducteurs sur
 * quatre des sept modèles, parce que la bibliothèque ne les compte ni au
 * squat, ni aux fentes, ni à la presse à cuisses. `musclesAbsents()` le
 * signale déjà une fois le programme écrit — mais après la copie, et sur un
 * autre écran. La carte du modèle le dit donc avant, pour que le choix se
 * fasse en connaissance de cause (décision du pilote, 19 octobre, dans le
 * cadre de la décision 12 : on le dit, on n'ajoute pas de bloc).
 *
 * Le calcul porte sur les exercices **de la personne**, après adaptation au
 * matériel : un modèle de salle réduit aux haltères ne travaille plus les
 * mêmes muscles, et lui annoncer la liste de la salle serait faux.
 */
export function musclesNonTravailles(
  modele: ModeleDeProgramme,
  exercices: readonly Exercice[],
  substitutions: Map<string, string> = new Map(),
): string[] {
  const { resolus } = exercicesDuModele(modele, exercices, substitutions);
  const touches = new Set<string>();
  for (const exercice of resolus.values()) {
    for (const m of [...exercice.principaux, ...exercice.secondaires]) touches.add(m);
  }
  return MUSCLES.filter((m) => !touches.has(m.id)).map((m) => m.id);
}

export interface LigneDEcart {
  muscle: string;
  /** La cible annoncée par le dossier. */
  dossier: number;
  /** La cible calculée depuis les exercices réels. */
  calcule: number;
  /** `calcule − dossier`, arrondi au centième. */
  ecart: number;
}

/**
 * L'écart entre les cibles du dossier et celles du code, muscle par muscle.
 *
 * Rendu pour être **affiché et consigné**, pas pour être corrigé. Le dossier
 * annonce lui-même la sensibilité de ses cibles à la convention de muscles ;
 * l'écart la mesure.
 */
export function ecartsDeCibles(
  modele: ModeleDeProgramme,
  resolus: Map<string, Exercice>,
  exercices: readonly Exercice[],
  coefficient = COEFFICIENT_SECONDAIRE,
): LigneDEcart[] {
  const calculees = ciblesDuModele(modele, resolus, exercices, coefficient);
  const lignes: LigneDEcart[] = [];
  for (const m of MUSCLES) {
    const dossier = modele.ciblesDuDossier[m.id] ?? 0;
    const calcule = calculees[m.id] ?? 0;
    if (dossier === calcule) continue;
    lignes.push({
      muscle: m.id,
      dossier,
      calcule,
      ecart: Math.round((calcule - dossier) * 100) / 100,
    });
  }
  return lignes;
}

/* ══════════════════════════════════════════════════════════════════════════
   La copie
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le nom d'une copie : « <modèle> (copie) ».
 *
 * Le prompt le fixe mot pour mot. Il dit aussi que la copie est modifiable
 * comme tout programme : ce nom est un point de départ, pas une étiquette.
 */
export const nomDeLaCopie = (modele: ModeleDeProgramme): string => `${modele.nom} (copie)`;

export interface OptionsDeCopie {
  /** Le matériel dont on dispose. Par défaut, la salle : le modèle tel quel. */
  equipement?: Equipement;
  /** Les blessures ouvertes, pour le signalement. Jamais pour retirer. */
  blessures?: readonly Blessure[];
  coefficient?: number;
  maintenant?: Date;
}

export type Copie =
  | {
      /**
       * La copie n'est pas prête : ces exercices manquent à la bibliothèque
       * de la personne et doivent être créés d'abord.
       *
       * Ce n'est pas un détail de forme. Calculer les cibles sans eux
       * donnerait des nombres **faux et plausibles** — un modèle Maison dont
       * les pompes manquent afficherait des pectoraux à zéro —, et rien à
       * l'écran ne dirait que le compte est incomplet. Mieux vaut un état
       * « pas encore » explicite qu'un programme discrètement faux.
       */
      pret: false;
      aCreer: { libelle: string; identite: IdentiteExercice }[];
      orphelins: string[];
    }
  | {
      pret: true;
      /** Le programme à écrire. Il n'est **pas** actif. */
      programme: Omit<Programme, 'id' | 'majLe'>;
      orphelins: string[];
      /** Ce que le matériel choisi a fait changer, à dire à l'écran. */
      adaptation: AdaptationALEquipement;
      /** Les exercices qui touchent une zone blessée. Signalés, pas retirés. */
      blessures: SignalementDeBlessure[];
    };

/**
 * Prépare la copie d'un modèle. N'écrit rien.
 *
 * ## Deux temps, et pourquoi
 *
 * L'appelant passe les exercices de la personne. S'il en manque, il reçoit la
 * liste de ceux à créer, les crée, relit la bibliothèque, et rappelle cette
 * fonction. C'est un aller-retour de plus, et il achète la seule chose qui
 * compte : des cibles calculées sur les exercices qui seront **réellement**
 * dans le programme.
 *
 * ## La copie n'est jamais active
 *
 * Le programme précédent reste celui que l'on suit, et un bouton propre
 * propose d'en changer. Créer un programme actif à l'insu de la personne
 * reviendrait à décider de son entraînement du lendemain depuis une carte de
 * catalogue.
 */
export function preparerLaCopie(
  modele: ModeleDeProgramme,
  exercices: readonly Exercice[],
  options: OptionsDeCopie = {},
): Copie {
  const {
    equipement = 'salle',
    blessures = [],
    coefficient = COEFFICIENT_SECONDAIRE,
    maintenant = new Date(),
  } = options;

  /*
     L'adaptation au matériel passe AVANT la résolution : c'est elle qui dit
     quel exercice il faudra retrouver ou créer. Résoudre d'abord créerait des
     exercices à la barre pour quelqu'un qui n'en a pas, et les laisserait
     dans sa bibliothèque.
  */
  const adaptation = adapterALEquipement(modele, equipement);
  const { resolus, manquants, orphelins } = exercicesDuModele(
    modele,
    exercices,
    adaptation.substitutions,
  );
  if (manquants.length) return { pret: false, aCreer: manquants, orphelins };
  return {
    pret: true,
    programme: {
      nom: nomDeLaCopie(modele),
      description: modele.description,
      seances: seancesDuModele(modele, resolus, adaptation.substitutions),
      parSemaine: modele.parSemaine,
      actif: false,
      ciblesParMuscle: ciblesDuModele(
        modele,
        resolus,
        exercices,
        coefficient,
        adaptation.substitutions,
      ),
    },
    orphelins,
    adaptation,
    blessures: signalerLesBlessures(modele, resolus, exercices, blessures, maintenant),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   L'équipement dont on dispose
   ══════════════════════════════════════════════════════════════════════════ */

export type Equipement = 'salle' | 'maison-complete' | 'maison-halteres';

export const EQUIPEMENTS: readonly { id: Equipement; libelle: string; detail: string }[] = [
  {
    id: 'salle',
    libelle: 'Salle',
    detail: 'Barres, haltères, poulies, machines, banc, barres parallèles, barre de traction.',
  },
  {
    id: 'maison-complete',
    libelle: 'Maison avec barre de traction et banc',
    detail: 'Une paire d’haltères, le poids du corps, un banc et une barre de traction.',
  },
  {
    id: 'maison-halteres',
    libelle: 'Maison avec haltères seulement',
    detail: 'Une paire d’haltères, le poids du corps, un sol, une chaise ou une marche.',
  },
];

/**
 * Ce qu'un matériel demande.
 *
 * La lecture se fait sur l'équipement **du dossier** (« haltères, banc
 * incliné ») et non sur celui de la bibliothèque (« haltères »), parce que
 * le dossier seul distingue un développé incliné — qui demande un banc —
 * d'un curl, qui n'en demande pas. C'est exactement la question 2 du
 * dossier : avec un banc, le développé incliné et les écartés deviennent
 * possibles ; avec une barre fixe, les tractions.
 */
type Materiel = 'rien' | 'halteres' | 'banc' | 'traction' | 'salle';

const MATERIEL: Record<string, Materiel> = {
  'poids du corps': 'rien',
  sol: 'rien',
  appui: 'rien',
  marche: 'rien',
  haltères: 'halteres',
  haltère: 'halteres',
  banc: 'banc',
  'banc incliné': 'banc',
  'barre fixe': 'traction',
  barre: 'salle',
  'barre EZ': 'salle',
  support: 'salle',
  poulie: 'salle',
  'poulie basse': 'salle',
  'poulie haute': 'salle',
  machine: 'salle',
  'barres parallèles': 'salle',
};

const DISPONIBLE: Record<Equipement, Materiel[]> = {
  salle: ['rien', 'halteres', 'banc', 'traction', 'salle'],
  'maison-complete': ['rien', 'halteres', 'banc', 'traction'],
  'maison-halteres': ['rien', 'halteres'],
};

/**
 * Les matériels qu'un exercice demande, lus dans la colonne du dossier.
 *
 * Les parenthèses sont retirées d'abord : « appui (chaise, banc) » porte des
 * virgules qui ne séparent pas des matériels, et découper dessus ferait
 * croire qu'un rowing à un bras demande un banc.
 */
function materielsDe(exercice: ExerciceDuModele): Materiel[] {
  return exercice.equipement
    .replace(/\([^)]*\)/g, '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => MATERIEL[t] ?? 'salle');
}

export const estPossibleAvec = (exercice: ExerciceDuModele, equipement: Equipement): boolean =>
  materielsDe(exercice).every((m) => DISPONIBLE[equipement].includes(m));

/**
 * Le matériel de chaque exercice, tous modèles confondus.
 *
 * La colonne « équipement » du dossier est **identique d'un modèle à
 * l'autre** pour les trente-quatre exercices — vérifié par
 * `essais:modeles-sport` —, contrairement aux remplaçants, qui diffèrent à
 * dessein. Une table globale est donc exacte ici, et elle est nécessaire :
 * un remplaçant cité par un modèle n'est pas toujours décrit dans son propre
 * tableau, et sans cette table il serait accepté sans vérification. C'est le
 * défaut que l'essai de navigateur a trouvé : un squat remplacé par une barre
 * au front, sur un programme censé ne demander que des haltères.
 */
const MATERIEL_PAR_LIBELLE: Map<string, Materiel[]> = new Map(
  MODELES_DE_PROGRAMMES.flatMap((m) => m.exercices).map((e) => [e.libelle, materielsDe(e)]),
);

/** Ce libellé est-il faisable avec ce matériel ? `false` s'il est inconnu. */
export function libelleEstPossibleAvec(libelle: string, equipement: Equipement): boolean {
  const materiels = MATERIEL_PAR_LIBELLE.get(libelle);
  /*
     Un libellé inconnu n'est pas réputé faisable. Dans le doute, le
     remplacement ne se fait pas : un exercice gardé et signalé se corrige,
     un exercice impossible glissé dans un programme ne se voit pas.
  */
  if (!materiels) return false;
  return materiels.every((m) => DISPONIBLE[equipement].includes(m));
}

/**
 * Le libellé d'exercice qu'une phrase de remplacement désigne, s'il y en a un.
 *
 * Le dossier écrit ses remplaçants en prose : « tirage vertical (poulie) sans
 * barre fixe ». On y reconnaît le libellé le plus long qui commence la
 * phrase. Quand rien ne se reconnaît — « pas d'équivalent présent », « fentes
 * avec le pied arrière sur une chaise » —, la phrase reste un conseil, et
 * l'exercice n'est **pas** remplacé : inventer un remplaçant approximatif
 * serait pire que de dire qu'on n'en a pas.
 */
export function remplacantReconnu(phrase: string | null): string | undefined {
  if (!phrase) return undefined;
  return [...EXERCICES_DES_MODELES]
    .filter((libelle) => phrase.startsWith(libelle))
    .sort((a, b) => b.length - a.length)[0];
}

export interface Remplacement {
  /** L'exercice du modèle qui ne passe pas. */
  libelle: string;
  /** Le libellé qui le remplace, ou `null` : aucun remplaçant reconnu. */
  par: string | null;
  /** Ce que le dossier propose, en toutes lettres. */
  conseil: string | null;
}

export interface AdaptationALEquipement {
  /** Libellé d'origine → libellé de remplacement, pour les blocs. */
  substitutions: Map<string, string>;
  /** Ce qui a été remplacé, à dire à l'écran. */
  remplaces: Remplacement[];
  /**
   * Ce qui ne passe pas et n'a pas de remplaçant reconnu.
   *
   * Ces blocs sont **gardés**, avec le conseil du dossier. Les retirer en
   * silence ferait disparaître un muscle du programme sans que rien ne le
   * dise, et c'est précisément ce que la branche ne fait jamais.
   */
  sansRemplacant: Remplacement[];
}

/**
 * Adapte un modèle au matériel dont on dispose.
 *
 * Le remplaçant du dossier est **propre à chaque modèle** : le modèle Maison
 * propose un remplaçant de maison, les modèles de salle un remplaçant de
 * salle. Trois exercices divergent ainsi d'un modèle à l'autre, et une table
 * globale donnerait la presse à cuisses à quelqu'un qui s'entraîne dans son
 * salon.
 *
 * Un remplaçant lui-même impossible avec le matériel choisi n'est pas retenu :
 * remplacer une machine par une autre machine ne résout rien.
 */
export function adapterALEquipement(
  modele: ModeleDeProgramme,
  equipement: Equipement,
): AdaptationALEquipement {
  const substitutions = new Map<string, string>();
  const remplaces: Remplacement[] = [];
  const sansRemplacant: Remplacement[] = [];

  for (const exercice of modele.exercices) {
    if (estPossibleAvec(exercice, equipement)) continue;
    const candidat = remplacantReconnu(exercice.siPasLeMateriel);
    const utilisable = candidat !== undefined && libelleEstPossibleAvec(candidat, equipement);
    const ligne: Remplacement = {
      libelle: exercice.libelle,
      par: utilisable ? candidat! : null,
      conseil: exercice.siPasLeMateriel,
    };
    if (utilisable) {
      substitutions.set(exercice.libelle, candidat!);
      remplaces.push(ligne);
    } else {
      sansRemplacant.push(ligne);
    }
  }
  return { substitutions, remplaces, sansRemplacant };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les blessures en cours
   ══════════════════════════════════════════════════════════════════════════ */

export interface SignalementDeBlessure {
  libelle: string;
  /** Les muscles sous blessure ouverte que cet exercice sollicite. */
  muscles: string[];
  /** Le remplaçant reconnu, ou `null`. */
  par: string | null;
  /** Ce que le dossier propose en cas de gêne, en toutes lettres. */
  conseil: string | null;
}

/**
 * Les exercices du modèle qui touchent une zone blessée.
 *
 * ## Signalés, jamais retirés
 *
 * C'est la règle de la branche, et elle vaut ici comme ailleurs : Sport ne
 * propose jamais de progresser sur un muscle douloureux, mais il n'efface
 * rien non plus. Un exercice retiré en silence ferait disparaître un muscle
 * du programme sans que la personne sache pourquoi, et elle ne pourrait pas
 * décider le contraire.
 *
 * ## Les muscles viennent de la bibliothèque, pas du dossier
 *
 * `resolus` porte les exercices réels — ceux de la personne, qu'elle a pu
 * modifier. Un signalement calculé sur la convention du dossier dirait qu'un
 * squat n'engage pas les ischio-jambiers, alors que la bibliothèque les y
 * compte : la gêne passerait inaperçue sur le mouvement le plus lourd du
 * programme.
 *
 * Le conseil vient de la colonne « gêne articulaire courante » du dossier.
 * Ce **n'est ni un diagnostic ni une prescription** : c'est une autre façon
 * de solliciter le muscle, et la personne choisit.
 */
export function signalerLesBlessures(
  modele: ModeleDeProgramme,
  resolus: Map<string, Exercice>,
  exercices: readonly Exercice[],
  blessures: readonly Blessure[],
  maintenant = new Date(),
): SignalementDeBlessure[] {
  const { muscles: empeches, general } = musclesEmpeches(blessures, maintenant);
  if (!empeches.size && !general) return [];

  const parLibelle = new Map(modele.exercices.map((e) => [e.libelle, e]));
  const parIdentite = new Map(exercices.map((e) => [identiteDeComparaison(e), e]));
  /**
   * L'exercice réel qu'un libellé du dossier désigne, où qu'il soit.
   *
   * `resolus` ne porte que les exercices des blocs du modèle. Un remplaçant
   * cité par la colonne « gêne articulaire » n'y est pas forcément — l'écarté
   * couché est proposé par M1 sans qu'aucun de ses blocs l'emploie. Le
   * chercher dans `resolus` seul le rendait introuvable, donc réputé sûr,
   * donc proposé : un remplaçant qu'on n'a pas vérifié, présenté comme
   * vérifié.
   */
  const reelDe = (libelle: string): Exercice | undefined => {
    const deja = resolus.get(libelle);
    if (deja) return deja;
    const identite = identiteDeLExercice(libelle);
    return identite ? parIdentite.get(identiteDeComparaison(identite)) : undefined;
  };

  const signalements: SignalementDeBlessure[] = [];

  for (const exercice of modele.exercices) {
    const reel = resolus.get(exercice.libelle);
    if (!reel) continue;
    /*
       Une blessure sans muscle est générale — une grippe, une fatigue
       extrême. Elle couvre tout, et c'est `musclesEmpeches` qui le dit ; la
       traiter comme « aucun muscle concerné » laisserait proposer un squat
       le jour où l'on est au lit.
    */
    const touches = general
      ? [...reel.principaux, ...reel.secondaires]
      : [...reel.principaux, ...reel.secondaires].filter((m) => empeches.has(m));
    if (!touches.length) continue;

    const conseil = parLibelle.get(exercice.libelle)?.siGene ?? null;
    const candidat = remplacantReconnu(conseil);
    signalements.push({
      libelle: exercice.libelle,
      muscles: touches,
      /*
          Un remplaçant qui touche lui aussi un muscle blessé n'en est pas un.
          Le proposer reviendrait à déplacer la douleur en disant l'avoir
          évitée.
       */
      par: candidat && estSansRisque(reelDe(candidat), empeches, general) ? candidat : null,
      conseil,
    });
  }
  return signalements;
}

/**
 * Ce remplaçant évite-t-il la zone blessée ?
 *
 * Un exercice **introuvable** n'est pas sans risque : on n'en sait rien, et
 * dans le doute le garde-fou retient plutôt qu'il ne laisse passer — c'est la
 * même règle que `musclesEmpeches` applique à l'arrondi des dates. Une
 * blessure générale ne laisse rien passer non plus.
 */
const estSansRisque = (
  exercice: Exercice | undefined,
  empeches: Set<string>,
  general: boolean,
): boolean => {
  if (general || !exercice) return false;
  return ![...exercice.principaux, ...exercice.secondaires].some((m) => empeches.has(m));
};
