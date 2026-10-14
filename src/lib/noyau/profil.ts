/**
 * Le profil commun : ce que Cyclades sait de la personne, et qui peut le lire.
 *
 * ## Un enregistrement par champ, et c'est la décision du module
 *
 * Un objet unique « profil » aurait tenu en vingt lignes. Un enregistrement par
 * champ en demande cent, et les rend toutes les quatre fois :
 *
 * - **la portée par champ** (A.3 : « l'écran indique qui l'utilise et permet de
 *   restreindre sa portée ») ;
 * - **la suppression par champ** (A.5 : « je peux supprimer un champ ou tout le
 *   profil ») ;
 * - **le versionnement par champ** (A.3 : « modifications versionnées et
 *   journalisées ») ;
 * - **la fusion champ par champ** (A.6), qui est déjà écrite : une opération par
 *   champ, et le dernier écrivain gagne sur l'horloge logique. Avec un objet
 *   unique, modifier le prénom ici et l'heure de lever là aurait été un conflit
 *   sur tout le profil.
 *
 * ## Pas de magasin, et ce n'est pas une économie
 *
 * Le profil **est** son journal. Trente champs font trente opérations, que le
 * journal porte déjà et transporte déjà : y ajouter un magasin aurait fait deux
 * vérités du même champ, exactement ce que le socle interdit ailleurs. La
 * lecture est un repli sur les opérations, et elle coûte une lecture du journal
 * — celle que les écrans de synchronisation font de toute façon.
 *
 * ## Les sujets sensibles ne sont pas ici
 *
 * A.3 est explicite : « les données sensibles restent dans leur domaine
 * (Odyssée), sous la matrice de permissions, et ne passent pas dans le profil
 * commun ». Une blessure connue n'est donc pas un champ de profil : c'est un
 * fait `sport.blessure`. Ce module ne porte **aucun** champ sensible, et le
 * catalogue le vérifie plutôt que de le promettre.
 */
import { comparerOperations, type Operation } from './operations';

/** Le type d'opération qui pose ou change un champ de profil. */
export const TYPE_CHAMP_PROFIL = 'profil.champ';

/** Le préfixe de cible : une cible par champ, pour une fusion par champ. */
export const PREFIXE_CIBLE = 'profil';

export const cibleDuChamp = (champ: string): string => `${PREFIXE_CIBLE}:${champ}`;

export function champDeCible(cible: string): string | null {
  if (!cible.startsWith(`${PREFIXE_CIBLE}:`)) return null;
  const champ = cible.slice(PREFIXE_CIBLE.length + 1);
  return champ || null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le catalogue des champs
   ══════════════════════════════════════════════════════════════════════════ */

/** Ce que porte la valeur d'un champ. */
export type Nature =
  | 'texte'
  | 'nombre'
  | 'booleen'
  /** `HH:MM`, heure murale. */
  | 'heure'
  /** Liste de textes courts. */
  | 'liste'
  /** Dictionnaire de textes vers nombres : les heures par domaine, par exemple. */
  | 'repartition';

/**
 * Qui lit le champ.
 *
 * `toutes` est le défaut des champs du socle : le prénom, la formalité, le
 * rythme servent partout. Une liste nomme les branches, et la personne peut la
 * réduire — jamais l'étendre par inadvertance, puisque le défaut est déclaré ici
 * et non calculé.
 */
export type Portee = 'toutes' | readonly string[];

export interface ChampDeclare {
  champ: string;
  libelle: string;
  nature: Nature;
  /** La question telle que l'initialisation la pose. Voir `questions.md`. */
  question: string;
  porteeParDefaut: Portee;
  /** La branche dont ce champ est l'extension, ou rien pour le socle commun. */
  brancheDOrigine?: string;
  /** Obligatoire à l'initialisation. Un seul champ l'est. */
  obligatoire?: boolean;
  /**
   * Ce champ **n'est pas posé par le parcours** : il est demandé au moment où
   * une fonction en a besoin, et la phrase dit quand.
   *
   * C'est la minimisation rendue mécanique plutôt que promise. Le mois de
   * naissance n'a d'usage qu'à la frontière d'un seuil : le poser à
   * l'initialisation reviendrait à collecter « au cas où », ce que le prompt
   * de profil interdit. Le parcours filtre sur ce champ, et l'essai vérifie
   * qu'il le fait.
   */
  demandeAuBesoin?: string;
  /**
   * Ce que le champ **règle** dans l'application, en français.
   *
   * L'écran « Mon profil » l'affiche : « votre bascule de journée est à 6 h
   * parce que vous vous levez à 7 h ». Un réglage dont on ne voit pas la cause
   * se change au hasard.
   */
  regle?: string;
}

const C = (c: ChampDeclare): ChampDeclare => c;

/**
 * Les champs du socle, puis les extensions de branche.
 *
 * L'ordre est celui de l'initialisation, et il compte : c'est celui de
 * `questions.md`, calibré sur les trois minutes du prompt.
 */
export const CHAMPS: readonly ChampDeclare[] = [
  /* --- Socle commun ------------------------------------------------------- */
  C({
    champ: 'prenom',
    libelle: 'Prénom',
    nature: 'texte',
    question: 'Comment doit-on vous appeler ?',
    // Le menu salue par le prénom ; aucune branche n'a besoin de le lire.
    porteeParDefaut: [],
    obligatoire: true,
    regle: 'La salutation du menu, qui se coupe d’un réglage.',
  }),
  C({
    champ: 'nom',
    libelle: 'Nom',
    nature: 'texte',
    question: 'Et votre nom, si vous voulez le donner ?',
    porteeParDefaut: [],
  }),
  C({
    champ: 'naissanceAnnee',
    libelle: 'Année de naissance',
    nature: 'nombre',
    question: 'Quelle est votre année de naissance ?',
    /* Vide, comme le nom : aucune branche ne lit ce champ par la portée. La
       lecture passe par `contextePersonne()` et le registre des usages, qui
       est plus fin qu'une branche et qui s'affiche à l'écran. */
    porteeParDefaut: [],
    regle:
      'Elle sert à calculer votre âge. Cyclades ne conserve jamais votre jour de ' +
      'naissance, et votre mois seulement si une fonction l’exige à la frontière ' +
      'd’un âge.',
  }),
  C({
    champ: 'naissanceMois',
    libelle: 'Mois de naissance',
    nature: 'nombre',
    question: 'Et le mois ?',
    porteeParDefaut: [],
    demandeAuBesoin:
      'Au moment d’activer une fonction dont le seuil d’âge tombe sur votre année : ' +
      'sans le mois, Cyclades ne peut pas savoir de quel côté du seuil vous êtes, et ' +
      'il reste du côté prudent.',
    regle: 'Il lève l’incertitude d’un an, et seulement quand elle bloque quelque chose.',
  }),
  C({
    champ: 'majeurDeclare',
    libelle: 'Majorité déclarée',
    nature: 'booleen',
    question: 'Êtes-vous majeur(e) ?',
    porteeParDefaut: [],
    demandeAuBesoin:
      'Si vous préférez ne pas donner votre année de naissance : cette réponse seule ' +
      'suffit aux fonctions réservées aux majeurs, et ne stocke aucune année.',
    regle: 'Ignorée si l’année de naissance est connue : c’est elle qui fait foi.',
  }),
  C({
    champ: 'formalite',
    libelle: 'Tutoiement ou vouvoiement',
    nature: 'texte',
    question: 'On se tutoie, ou on se vouvoie ?',
    porteeParDefaut: 'toutes',
    regle: 'La façon dont les écrans s’adressent à vous.',
  }),
  C({
    champ: 'langue',
    libelle: 'Langue',
    nature: 'texte',
    question: 'Français, et heure de Paris : c’est bien ça ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'fuseau',
    libelle: 'Fuseau horaire',
    nature: 'texte',
    question: 'Français, et heure de Paris : c’est bien ça ?',
    porteeParDefaut: 'toutes',
    regle: 'Le fuseau dans lequel le jour logique est compté.',
  }),
  C({
    champ: 'activite',
    libelle: 'Ce que vous faites dans la vie',
    nature: 'texte',
    question: 'Qu’est-ce que vous faites dans la vie ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'lever',
    libelle: 'Heure de lever',
    nature: 'heure',
    question: 'À quelle heure vous levez-vous, d’habitude ?',
    porteeParDefaut: 'toutes',
    regle:
      'L’heure à laquelle votre journée change de date — une séance finie à minuit trente compte pour la soirée écoulée.',
  }),
  C({
    champ: 'coucher',
    libelle: 'Heure de coucher',
    nature: 'heure',
    question: 'Et vous couchez-vous ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'joursTravail',
    libelle: 'Jours de travail',
    nature: 'liste',
    question: 'Quels jours travaillez-vous ?',
    porteeParDefaut: 'toutes',
    regle: 'Les créneaux proposés pour vos séances, et les jours de repos de la rotation.',
  }),
  C({
    champ: 'plagesTravail',
    libelle: 'Plages de travail',
    nature: 'liste',
    question: 'Sur quelles plages ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'objectifsAnnee',
    libelle: 'Objectifs de l’année',
    nature: 'liste',
    question: 'Qu’est-ce que vous voulez obtenir cette année ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'objectifsVie',
    libelle: 'Objectifs de long terme',
    nature: 'liste',
    question: 'Et à plus long terme ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'tempsParSemaine',
    libelle: 'Temps disponible par semaine',
    nature: 'nombre',
    question: 'Combien de temps pouvez-vous y consacrer par semaine ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'domainesActifs',
    libelle: 'Domaines suivis',
    nature: 'liste',
    question: 'Lesquels de ces domaines voulez-vous suivre ?',
    porteeParDefaut: 'toutes',
    regle: 'Les domaines affichés dans la roue d’équilibre et au menu.',
  }),
  C({
    champ: 'tempsParDomaine',
    libelle: 'Temps par domaine',
    nature: 'repartition',
    question: 'Combien de temps par semaine pour chacun ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'styleAccompagnement',
    libelle: 'Style d’accompagnement',
    nature: 'texte',
    question: 'Comment Cyclades doit-il vous accompagner ?',
    porteeParDefaut: 'toutes',
    regle: 'La fréquence et le ton des avis locaux.',
  }),

  /* --- Extension : Révisions ---------------------------------------------- */
  C({
    champ: 'concours',
    libelle: 'Concours préparés',
    nature: 'liste',
    question: 'Quel concours préparez-vous ?',
    porteeParDefaut: ['revisions', 'odyssee'],
    brancheDOrigine: 'revisions',
    regle: 'Les parcours ouverts dans le registre.',
  }),
  C({
    champ: 'datesEpreuves',
    libelle: 'Dates d’épreuves',
    nature: 'repartition',
    question: 'Quand sont les épreuves ?',
    porteeParDefaut: ['revisions', 'odyssee'],
    brancheDOrigine: 'revisions',
  }),
  C({
    champ: 'heuresRevision',
    libelle: 'Heures de révision par semaine',
    nature: 'nombre',
    question: 'Combien d’heures de révision par semaine ?',
    porteeParDefaut: ['revisions', 'odyssee'],
    brancheDOrigine: 'revisions',
  }),
  C({
    champ: 'matieresFortes',
    libelle: 'Matières qui semblent solides',
    nature: 'liste',
    question: 'Quelles matières vous semblent solides ?',
    porteeParDefaut: ['revisions'],
    brancheDOrigine: 'revisions',
  }),
  C({
    champ: 'matieresFaibles',
    libelle: 'Matières qui inquiètent',
    nature: 'liste',
    question: 'Et lesquelles vous inquiètent ?',
    porteeParDefaut: ['revisions'],
    brancheDOrigine: 'revisions',
  }),
  C({
    champ: 'momentRevision',
    libelle: 'Moment de révision préféré',
    nature: 'texte',
    question: 'Préférez-vous travailler le matin ou le soir ?',
    porteeParDefaut: ['revisions', 'odyssee'],
    brancheDOrigine: 'revisions',
  }),

  /* --- Extension : Sport --------------------------------------------------- */
  C({
    champ: 'experienceSport',
    libelle: 'Expérience d’entraînement',
    nature: 'texte',
    question: 'Vous entraînez-vous déjà ?',
    porteeParDefaut: ['sport', 'odyssee'],
    brancheDOrigine: 'sport',
  }),
  C({
    champ: 'objectifsSport',
    libelle: 'Objectifs d’entraînement',
    nature: 'liste',
    question: 'Qu’est-ce que vous cherchez ?',
    porteeParDefaut: ['sport', 'odyssee'],
    brancheDOrigine: 'sport',
  }),
  C({
    champ: 'frequenceSouhaitee',
    libelle: 'Séances par semaine souhaitées',
    nature: 'nombre',
    question: 'Combien de séances par semaine aimeriez-vous tenir ?',
    porteeParDefaut: ['sport', 'odyssee'],
    brancheDOrigine: 'sport',
  }),
  C({
    champ: 'lieuMateriel',
    libelle: 'Lieu et matériel',
    nature: 'texte',
    question: 'Où vous entraînez-vous, et avec quoi ?',
    porteeParDefaut: ['sport'],
    brancheDOrigine: 'sport',
  }),
  C({
    champ: 'phaseSport',
    libelle: 'Phase d’entraînement',
    nature: 'texte',
    question: 'Dans quelle phase êtes-vous ?',
    porteeParDefaut: ['sport', 'odyssee'],
    brancheDOrigine: 'sport',
  }),

  /* --- Extension : Odyssée ------------------------------------------------- */
  C({
    champ: 'ciblesEquilibre',
    libelle: 'Cibles d’équilibre',
    nature: 'repartition',
    question: 'Quel équilibre voulez-vous viser entre vos domaines ?',
    porteeParDefaut: ['odyssee'],
    brancheDOrigine: 'odyssee',
  }),
  C({
    champ: 'frequenceRevues',
    libelle: 'Fréquence des revues',
    nature: 'texte',
    question: 'À quelle fréquence voulez-vous faire le point ?',
    porteeParDefaut: ['odyssee'],
    brancheDOrigine: 'odyssee',
  }),
  C({
    champ: 'frequenceCheckin',
    libelle: 'Fréquence des check-ins',
    nature: 'texte',
    question: 'Voulez-vous un check-in quotidien de moins de 30 secondes ?',
    porteeParDefaut: ['odyssee'],
    brancheDOrigine: 'odyssee',
  }),
  C({
    champ: 'suiviFinances',
    libelle: 'Suivi des finances',
    nature: 'booleen',
    question: 'Voulez-vous suivre des comptes dans Finances ?',
    porteeParDefaut: ['odyssee'],
    brancheDOrigine: 'odyssee',
  }),
  C({
    champ: 'heureRappel',
    libelle: 'Heure de rappel',
    nature: 'heure',
    question: 'À quelle heure voulez-vous être relancé, si vous le voulez ?',
    porteeParDefaut: 'toutes',
    brancheDOrigine: 'odyssee',
    regle: 'L’heure des avis locaux, quand vous en voulez.',
  }),
];

const PAR_CHAMP = new Map(CHAMPS.map((c) => [c.champ, c]));

export const champDeclare = (champ: string): ChampDeclare | undefined => PAR_CHAMP.get(champ);

/** Les champs du socle commun, dans l'ordre de l'initialisation. */
export const champsDuSocle = (): ChampDeclare[] => CHAMPS.filter((c) => !c.brancheDOrigine);

/** Les champs qu'une branche pose à sa première ouverture. */
export const champsDeBranche = (branche: string): ChampDeclare[] =>
  CHAMPS.filter((c) => c.brancheDOrigine === branche);

/* ══════════════════════════════════════════════════════════════════════════
   La valeur d'un champ, telle que le journal la porte
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * D'où vient la valeur. A.3 : « déclaré, observé puis confirmé ».
 *
 * Les trois sont distinctes, et la troisième n'est pas un luxe. `declare` : la
 * personne l'a dit. `observe` : l'usage le laisse penser, et personne ne l'a
 * validé. `confirme` : l'usage le laissait penser, et la personne a répondu
 * « c'est juste ». Fondre les deux dernières dans `declare` ferait disparaître
 * la seule information qui compte le jour où un réglage est faux — savoir si
 * c'est une déclaration qui l'était, ou une déduction.
 */
export type Source = 'declare' | 'observe' | 'confirme';

const SOURCES: readonly Source[] = ['declare', 'observe', 'confirme'];

export interface ChargeChamp {
  /** Absente quand `supprime` est vrai : il n'y a plus de valeur à porter. */
  valeur?: unknown;
  source?: Source;
  /** La portée voulue, ou rien pour celle du catalogue. */
  portee?: Portee;
  /** Vrai quand ce champ est **effacé**. La valeur est alors ignorée. */
  supprime?: boolean;
}

export interface ValeurDeChamp {
  champ: string;
  declare: ChampDeclare;
  valeur: unknown;
  source: Source;
  portee: Portee;
  /** L'appareil qui a posé la dernière version. */
  appareil: string;
  /** Combien de fois ce champ a été écrit. A.3 : les modifications sont versionnées. */
  version: number;
  /** L'horloge de la dernière écriture, qui ordonne et qui date. */
  hlc: string;
}

/** La charge d'une opération de champ, **normalisée** : la source est toujours là. */
interface ChargeLue {
  valeur: unknown;
  source: Source;
  portee?: Portee;
  supprime?: boolean;
}

function lireCharge(op: Operation): ChargeLue | null {
  const charge = op.charge as Partial<ChargeChamp> | undefined;
  if (!charge) return null;
  if (charge.supprime === true) return { valeur: null, source: 'declare', supprime: true };
  if (!('valeur' in charge)) return null;
  const source: Source =
    charge.source && SOURCES.includes(charge.source) ? charge.source : 'declare';
  return { valeur: charge.valeur, source, portee: charge.portee };
}

export type Profil = Map<string, ValeurDeChamp>;

/**
 * Le profil, lu du journal : **le dernier écrivain gagne, par champ**.
 *
 * Les opérations d'un champ inconnu du catalogue sont ignorées. C'est la même
 * orientation que partout ailleurs : un champ ajouté par une version future est
 * refusé par une version antérieure plutôt qu'écrit à l'aveugle, et un champ
 * retiré du catalogue cesse d'être lu sans qu'il faille nettoyer le journal.
 */
export function lireProfil(operations: readonly Operation[]): Profil {
  const parChamp = new Map<string, Operation[]>();
  for (const op of operations) {
    if (op.type !== TYPE_CHAMP_PROFIL) continue;
    const champ = champDeCible(op.cible);
    if (!champ || !PAR_CHAMP.has(champ)) continue;
    const groupe = parChamp.get(champ);
    if (groupe) groupe.push(op);
    else parChamp.set(champ, [op]);
  }

  const profil: Profil = new Map();
  for (const [champ, ops] of parChamp) {
    const ordonnees = [...ops].sort(comparerOperations);
    const derniere = ordonnees[ordonnees.length - 1];
    const charge = lireCharge(derniere);
    if (!charge || charge.supprime) continue;
    const declare = PAR_CHAMP.get(champ)!;
    profil.set(champ, {
      champ,
      declare,
      valeur: charge.valeur,
      source: charge.source,
      portee: charge.portee ?? declare.porteeParDefaut,
      appareil: derniere.appareil,
      version: ordonnees.length,
      hlc: derniere.hlc,
    });
  }
  return profil;
}

/* ══════════════════════════════════════════════════════════════════════════
   L'initialisation : une fois, et pas une fois par appareil
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le fait qui dit que l'initialisation a été menée à son terme.
 *
 * A.6 l'exige : « l'initialisation n'a lieu qu'une fois. Sur un nouvel appareil
 * ajouté par le parcours Ajouter un téléphone, le profil arrive avec la copie :
 * pas de nouvelle initialisation. » C'est donc un **fait journalisé**, qui
 * voyage avec le reste — un drapeau local aurait fait reposer la promesse sur
 * chaque appareil séparément, et le téléphone aurait reposé les quatorze
 * questions.
 *
 * Il ne dit pas que tout a été répondu : on peut arriver au bout en touchant
 * « Plus tard » treize fois. Il dit que la personne a vu l'initialisation, et
 * que les champs manquants sont désormais l'affaire de « Mon profil ».
 */
export const TYPE_INITIALISATION = 'profil.initialisation';

export const CIBLE_INITIALISATION = `${PREFIXE_CIBLE}:initialisation`;

export interface Initialisation {
  /** Quand, en ISO. */
  termineeLe: string;
  /** Allégée : préremplie de ce qui était déjà connu (A.7). */
  allegee: boolean;
  appareil: string;
}

export function lireInitialisation(operations: readonly Operation[]): Initialisation | null {
  let retenue: Initialisation | null = null;
  let hautHlc = '';
  for (const op of operations) {
    if (op.type !== TYPE_INITIALISATION) continue;
    const charge = op.charge as Partial<Initialisation> | undefined;
    if (typeof charge?.termineeLe !== 'string') continue;
    if (retenue && op.hlc <= hautHlc) continue;
    hautHlc = op.hlc;
    retenue = {
      termineeLe: charge.termineeLe,
      allegee: charge.allegee === true,
      appareil: op.appareil,
    };
  }
  return retenue;
}

export interface Avancement {
  /** Les champs du socle qui portent une valeur. */
  repondus: number;
  /** Les champs du socle, en tout. */
  total: number;
  /** Le prénom est-il posé ? C'est la seule réponse obligatoire. */
  prenomPose: boolean;
  /** Les champs du socle qui restent à poser, dans l'ordre des questions. */
  restants: ChampDeclare[];
  initialisation: Initialisation | null;
}

export function avancement(operations: readonly Operation[]): Avancement {
  const profil = lireProfil(operations);
  const socle = champsDuSocle();
  const restants = socle.filter((c) => !profil.has(c.champ));
  return {
    repondus: socle.length - restants.length,
    total: socle.length,
    prenomPose: profil.has('prenom'),
    restants,
    initialisation: lireInitialisation(operations),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Qui lit quoi
   ══════════════════════════════════════════════════════════════════════════ */

export const porteeInclut = (portee: Portee, branche: string): boolean =>
  portee === 'toutes' ? true : portee.includes(branche);

/**
 * Ce qu'une branche lit du profil.
 *
 * Le champ hors portée est **retiré**, pas masqué — la matrice de permissions a
 * déjà tranché ce point, et pour la même raison : rendre un champ caviardé
 * apprendrait qu'il existe, et parfois cela suffit.
 */
export function pourBranche(profil: Profil, branche: string): Map<string, unknown> {
  const sortie = new Map<string, unknown>();
  for (const [champ, valeur] of profil) {
    if (!porteeInclut(valeur.portee, branche)) continue;
    sortie.set(champ, valeur.valeur);
  }
  return sortie;
}

/** Les branches qui lisent ce champ aujourd'hui, pour l'écran « Mon profil ». */
export function lecteurs(valeur: ValeurDeChamp, branches: readonly string[]): string[] {
  return branches.filter((b) => porteeInclut(valeur.portee, b));
}

/* ══════════════════════════════════════════════════════════════════════════
   Les divergences entre appareils
   ══════════════════════════════════════════════════════════════════════════ */

export interface Divergence {
  champ: string;
  declare: ChampDeclare;
  /** La dernière version de chaque appareil, du plus ancien au plus récent. */
  versions: { appareil: string; valeur: unknown; hlc: string; source: Source }[];
}

const serialiserStable = (valeur: unknown): string => {
  if (Array.isArray(valeur)) return `[${valeur.map(serialiserStable).join(',')}]`;
  if (valeur && typeof valeur === 'object') {
    return `{${Object.entries(valeur as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([c, v]) => `${JSON.stringify(c)}:${serialiserStable(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(valeur) ?? 'null';
};

/**
 * Les champs sur lesquels deux appareils ne disent pas la même chose.
 *
 * A.6 le demande : « si deux appareils ont été initialisés séparément avant
 * l'appairage : fusion champ par champ, avec question de confirmation en cas de
 * divergence ». La fusion, elle, a déjà lieu — c'est le dernier écrivain par
 * champ. Ce que cette fonction ajoute, c'est la **question** : savoir qu'une
 * valeur en a remplacé une autre, et laquelle.
 *
 * Deux écritures du même appareil ne sont pas une divergence : c'est une
 * correction, et la personne a changé d'avis sur sa propre machine — ce qui ne
 * demande pas d'être arbitré. Même règle que pour les conflits de fusion.
 */
export function divergences(operations: readonly Operation[]): Divergence[] {
  const parChamp = new Map<string, Operation[]>();
  for (const op of operations) {
    if (op.type !== TYPE_CHAMP_PROFIL) continue;
    const champ = champDeCible(op.cible);
    if (!champ || !PAR_CHAMP.has(champ)) continue;
    const groupe = parChamp.get(champ);
    if (groupe) groupe.push(op);
    else parChamp.set(champ, [op]);
  }

  const sortie: Divergence[] = [];
  for (const [champ, ops] of parChamp) {
    const parAppareil = new Map<string, Operation>();
    for (const op of [...ops].sort(comparerOperations)) parAppareil.set(op.appareil, op);
    if (parAppareil.size < 2) continue;

    const versions: Divergence['versions'] = [];
    for (const op of [...parAppareil.values()].sort(comparerOperations)) {
      const charge = lireCharge(op);
      if (!charge || charge.supprime) continue;
      versions.push({
        appareil: op.appareil,
        valeur: charge.valeur,
        hlc: op.hlc,
        source: charge.source,
      });
    }
    if (versions.length < 2) continue;
    const formes = new Set(versions.map((v) => serialiserStable(v.valeur)));
    if (formes.size < 2) continue;
    sortie.push({ champ, declare: PAR_CHAMP.get(champ)!, versions });
  }
  return sortie.sort((a, b) => (a.champ < b.champ ? -1 : 1));
}

/* ══════════════════════════════════════════════════════════════════════════
   Validation
   ══════════════════════════════════════════════════════════════════════════ */

export interface Verdict {
  recevable: boolean;
  motif?: string;
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Une valeur est-elle recevable pour ce champ ?
 *
 * La validation est volontairement **pauvre** : elle vérifie la forme, pas le
 * contenu. « Quelle est votre activité ? » n'a pas de bonne réponse, et un
 * module qui refuserait « en reconversion » parce qu'il attend une liste fermée
 * obligerait à mentir dès la première minute.
 */
export function valider(champ: string, valeur: unknown): Verdict {
  const declare = PAR_CHAMP.get(champ);
  if (!declare) return { recevable: false, motif: `Champ inconnu : « ${champ} ».` };
  switch (declare.nature) {
    case 'texte':
      if (typeof valeur !== 'string') return { recevable: false, motif: 'Un texte est attendu.' };
      if (valeur.length > 2000) return { recevable: false, motif: 'Texte trop long (2 000 signes).' };
      return { recevable: true };
    case 'nombre':
      if (typeof valeur !== 'number' || !Number.isFinite(valeur)) {
        return { recevable: false, motif: 'Un nombre est attendu.' };
      }
      return { recevable: true };
    case 'booleen':
      return typeof valeur === 'boolean'
        ? { recevable: true }
        : { recevable: false, motif: 'Oui ou non.' };
    case 'heure':
      return typeof valeur === 'string' && HEURE.test(valeur)
        ? { recevable: true }
        : { recevable: false, motif: 'Une heure au format HH:MM est attendue.' };
    case 'liste':
      if (!Array.isArray(valeur) || valeur.some((x) => typeof x !== 'string')) {
        return { recevable: false, motif: 'Une liste de textes est attendue.' };
      }
      if (valeur.length > 50) return { recevable: false, motif: 'Liste trop longue (50 entrées).' };
      return { recevable: true };
    case 'repartition':
      if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) {
        return { recevable: false, motif: 'Un dictionnaire est attendu.' };
      }
      return { recevable: true };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle du catalogue
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Vérifie les invariants du catalogue de champs.
 *
 * Deux comptent vraiment. Qu'**un seul champ soit obligatoire** — le prompt dit
 * « seul le prénom est obligatoire », et un second champ obligatoire ajouté par
 * inadvertance rendrait l'initialisation refusable. Et qu'**aucune portée ne
 * nomme une branche inconnue** : une portée vers une branche qui n'existe pas se
 * lirait comme une restriction alors qu'elle n'en est pas une.
 */
export function controlerChamps(branchesConnues: readonly string[]): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();
  for (const c of CHAMPS) {
    if (vus.has(c.champ)) problemes.push(`Le champ « ${c.champ} » est déclaré deux fois.`);
    vus.add(c.champ);
    if (c.question.trim().length < 10) {
      problemes.push(`Le champ « ${c.champ} » n’a pas de question lisible.`);
    }
    if (c.brancheDOrigine && !branchesConnues.includes(c.brancheDOrigine)) {
      problemes.push(
        `Le champ « ${c.champ} » vient de la branche « ${c.brancheDOrigine} », qui n’existe pas.`,
      );
    }
    if (c.porteeParDefaut !== 'toutes') {
      for (const branche of c.porteeParDefaut) {
        if (!branchesConnues.includes(branche)) {
          problemes.push(
            `La portée du champ « ${c.champ} » nomme « ${branche} », qui n’est pas une branche.`,
          );
        }
      }
    }
  }
  const obligatoires = CHAMPS.filter((c) => c.obligatoire).map((c) => c.champ);
  if (obligatoires.length !== 1 || obligatoires[0] !== 'prenom') {
    problemes.push(
      `Un seul champ doit être obligatoire, et c’est le prénom ; obligatoires : ${obligatoires.join(', ') || 'aucun'}.`,
    );
  }
  return problemes;
}
