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
  type Exercice,
} from './modele';
import { volumePrevu, type BlocPrevu, type Programme, type SeanceType } from './programmes';
import {
  identiteDeLExercice,
  type BlocDeModele,
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
): ExercicesDuModele {
  const parIdentite = new Map(exercices.map((e) => [identiteDeComparaison(e), e]));
  const resolus = new Map<string, Exercice>();
  const manquants: ExercicesDuModele['manquants'] = [];
  const orphelins: string[] = [];
  const vus = new Set<string>();

  for (const seance of modele.seances) {
    for (const bloc of seance.blocs) {
      if (vus.has(bloc.exercice)) continue;
      vus.add(bloc.exercice);
      const identite = identiteDeLExercice(bloc.exercice);
      if (!identite) {
        orphelins.push(bloc.exercice);
        continue;
      }
      const existant = parIdentite.get(identiteDeComparaison(identite));
      if (existant) resolus.set(bloc.exercice, existant);
      else manquants.push({ libelle: bloc.exercice, identite });
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
): SeanceType[] {
  return modele.seances.map((seance, rang) => ({
    id: `${modele.cle}-${rang + 1}`,
    nom: seance.nom,
    blocs: seance.blocs
      .map((bloc) => {
        const exercice = resolus.get(bloc.exercice);
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
): Record<string, number> {
  const provisoire: Programme = {
    id: 'provisoire',
    nom: modele.nom,
    description: '',
    seances: seancesDuModele(modele, resolus),
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
  coefficient = COEFFICIENT_SECONDAIRE,
): Copie {
  const { resolus, manquants, orphelins } = exercicesDuModele(modele, exercices);
  if (manquants.length) return { pret: false, aCreer: manquants, orphelins };
  return {
    pret: true,
    programme: {
      nom: nomDeLaCopie(modele),
      description: modele.description,
      seances: seancesDuModele(modele, resolus),
      parSemaine: modele.parSemaine,
      actif: false,
      ciblesParMuscle: ciblesDuModele(modele, resolus, exercices, coefficient),
    },
    orphelins,
  };
}
