/**
 * L'initialisation : une question à la fois, et « Plus tard » partout.
 *
 * ## Ce que ce module ajoute au profil
 *
 * `profil.ts` sait déjà quels champs portent une valeur, et il sait déjà dire
 * que l'initialisation a été menée à son terme. Il manque entre les deux la
 * seule chose dont un parcours en quatorze écrans a besoin : **où on en est**.
 *
 * Et « où on en est » n'est pas « quels champs sont remplis ». Toucher
 * « Plus tard » sur l'heure de lever, fermer l'onglet, revenir : si le report
 * n'est pas gardé, l'écran repose la même question, et la personne comprend
 * qu'on ne l'a pas écoutée. Le report est donc **journalisé** comme le reste —
 * c'est ce que le plan appelle « l'avancement est un champ de profil comme les
 * autres, donc il se synchronise ». Un drapeau local aurait fait reposer les
 * quatorze questions sur le téléphone.
 *
 * ## Trois faits, et pas un de plus
 *
 * - `profil.report` — « pas maintenant », par champ. Annulable, et annulé de
 *   fait dès que le champ reçoit une valeur.
 * - `profil.module` — « les questions de cette branche ont été posées ». Par
 *   branche, puisque les modules sont posés à la première entrée dans chacune.
 * - `profil.initialisation` — déjà dans `profil.ts`, inchangé.
 *
 * Aucun ne porte de réponse : les réponses sont des champs de profil, écrits
 * par le même chemin qu'« Mon profil » utilise. Un second chemin d'écriture
 * aurait fait deux vérités du même champ.
 */
import type { Deduction } from './observation';
import { anneeAberrante } from './age';
import type { Operation } from './operations';
import { comparerOperations } from './operations';
import {
  CHAMPS,
  PREFIXE_CIBLE,
  champsDuSocle,
  questionsDeBranche,
  questionsDuSocle,
  lireInitialisation,
  lireProfil,
  valider,
  type ChampDeclare,
  type Initialisation,
  type Profil,
  type ValeurDeChamp,
} from './profil';

/* ══════════════════════════════════════════════════════════════════════════
   « Plus tard »
   ══════════════════════════════════════════════════════════════════════════ */

export const TYPE_REPORT = 'profil.report';

export const cibleDuReport = (champ: string): string => `${PREFIXE_CIBLE}:report:${champ}`;

export function champDuReport(cible: string): string | null {
  const prefixe = `${PREFIXE_CIBLE}:report:`;
  if (!cible.startsWith(prefixe)) return null;
  return cible.slice(prefixe.length) || null;
}

export interface ChargeReport {
  /** Quand le report a été demandé, en ISO. */
  reporteLe?: string;
  /** Vrai pour **lever** le report : la question redevient à poser. */
  annule?: boolean;
}

export interface Report {
  champ: string;
  reporteLe: string;
  appareil: string;
  hlc: string;
}

/**
 * Les champs reportés, le dernier mot par champ.
 *
 * Deux appareils peuvent reporter et dé-reporter le même champ ; la règle est
 * celle du reste du journal — l'horloge logique ordonne, le dernier écrivain
 * gagne. Rien à inventer ici.
 */
export function lireReports(operations: readonly Operation[]): Map<string, Report> {
  const parChamp = new Map<string, Operation[]>();
  for (const op of operations) {
    if (op.type !== TYPE_REPORT) continue;
    const champ = champDuReport(op.cible);
    if (!champ) continue;
    const groupe = parChamp.get(champ);
    if (groupe) groupe.push(op);
    else parChamp.set(champ, [op]);
  }

  const reports = new Map<string, Report>();
  for (const [champ, ops] of parChamp) {
    const derniere = [...ops].sort(comparerOperations)[ops.length - 1];
    const charge = derniere.charge as ChargeReport | undefined;
    if (charge?.annule === true) continue;
    reports.set(champ, {
      champ,
      reporteLe: typeof charge?.reporteLe === 'string' ? charge.reporteLe : '',
      appareil: derniere.appareil,
      hlc: derniere.hlc,
    });
  }
  return reports;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les modules de branche
   ══════════════════════════════════════════════════════════════════════════ */

export const TYPE_MODULE = 'profil.module';

export const cibleDuModule = (branche: string): string => `${PREFIXE_CIBLE}:module:${branche}`;

export function brancheDuModule(cible: string): string | null {
  const prefixe = `${PREFIXE_CIBLE}:module:`;
  if (!cible.startsWith(prefixe)) return null;
  return cible.slice(prefixe.length) || null;
}

export interface ModulePose {
  branche: string;
  poseLe: string;
  appareil: string;
}

/**
 * Les branches dont le module a été posé.
 *
 * Posé ne veut pas dire répondu : on peut traverser les six questions de
 * Révisions en touchant « Plus tard » six fois. La marque dit que la branche a
 * cessé de demander, et c'est tout ce qu'il faut pour ne pas redemander à
 * chaque entrée.
 */
export function lireModules(operations: readonly Operation[]): Map<string, ModulePose> {
  const modules = new Map<string, ModulePose>();
  const hauts = new Map<string, string>();
  for (const op of operations) {
    if (op.type !== TYPE_MODULE) continue;
    const branche = brancheDuModule(op.cible);
    if (!branche) continue;
    const haut = hauts.get(branche);
    if (haut !== undefined && op.hlc <= haut) continue;
    hauts.set(branche, op.hlc);
    const charge = op.charge as { poseLe?: string } | undefined;
    modules.set(branche, {
      branche,
      poseLe: typeof charge?.poseLe === 'string' ? charge.poseLe : '',
      appareil: op.appareil,
    });
  }
  return modules;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le parcours
   ══════════════════════════════════════════════════════════════════════════ */

export interface Etape {
  declare: ChampDeclare;
  /** La valeur déjà posée, s'il y en a une — l'écran la propose en défaut. */
  deja?: ValeurDeChamp;
  /** Ce que l'observation suggère, quand le champ est vide. */
  deduction?: Deduction;
  /** La question a-t-elle été reportée ? */
  reportee: boolean;
}

export interface Parcours {
  /** Toutes les étapes, dans l'ordre des questions. */
  etapes: Etape[];
  /** Les étapes qui restent à voir : ni répondues, ni reportées. */
  restantes: Etape[];
  /** La prochaine à poser, ou `null` quand le parcours est fini. */
  prochaine: Etape | null;
  /** Combien d'étapes sont réglées — répondues **ou** reportées. */
  reglees: number;
  total: number;
}

export interface OptionsParcours {
  /** Les déductions à proposer, par champ. */
  deductions?: readonly Deduction[];
  /** Pour un module : la branche dont on pose les questions. Sinon, le socle. */
  branche?: string;
}

/**
 * L'état du parcours : ce qui reste à poser, et dans quel ordre.
 *
 * « Réglée » couvre répondue **et** reportée, et c'est la décision du module :
 * une question reportée n'est plus à poser *maintenant*, sans quoi le parcours
 * ne se terminerait jamais. Elle reparaît dans « Mon profil », parmi les champs
 * restants — l'endroit prévu pour y revenir quand on veut, et non celui où l'on
 * est retenu.
 */
export function parcours(
  operations: readonly Operation[],
  options: OptionsParcours = {},
): Parcours {
  const profil = lireProfil(operations);
  const reports = lireReports(operations);
  const parChampDeduit = new Map((options.deductions ?? []).map((d) => [d.champ, d]));
  /* Les champs demandés au moment du besoin ne sont pas du parcours : les y
     laisser reviendrait à collecter « au cas où » une donnée dont la minimisation
     impose qu'elle n'existe que si une fonction l'exige. `questionsDuSocle()`
     porte ce filtre, et `avancement()` s'en sert aussi : un seul endroit.

     DÉCISION 2 DU 56. Le même endroit porte le second filtre : un champ que
     rien ne lit n'est plus posé. Il n'est pas retiré du catalogue — sa valeur
     reste visible et modifiable dans « Mon profil », et une déclaration de
     lecteur suffit à reposer la question. */
  const champs = options.branche
    ? questionsDeBranche(options.branche)
    : questionsDuSocle();

  const etapes = champs.map((declare): Etape => {
    const deja = profil.get(declare.champ);
    return {
      declare,
      ...(deja ? { deja } : {}),
      ...(!deja && parChampDeduit.has(declare.champ)
        ? { deduction: parChampDeduit.get(declare.champ)! }
        : {}),
      reportee: reports.has(declare.champ),
    };
  });

  const restantes = etapes.filter((e) => !e.deja && !e.reportee);
  return {
    etapes,
    restantes,
    prochaine: restantes[0] ?? null,
    reglees: etapes.length - restantes.length,
    total: etapes.length,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les gardes : qui doit poser quoi, et quand
   ══════════════════════════════════════════════════════════════════════════ */

export type Porte =
  /** Rien à faire : entrer directement. */
  | { quoi: 'entrer' }
  /** Mener l'initialisation du socle. */
  | { quoi: 'initialiser'; allegee: boolean }
  /** Poser le module de cette branche. */
  | { quoi: 'module'; branche: string };

export interface OptionsPorte {
  /** La branche dans laquelle on entre, ou rien pour le menu. */
  branche?: string;
  /**
   * L'installation porte-t-elle déjà des données ?
   *
   * C'est ce qui distingue A.7 d'A.1 : une base qui contient déjà des séances
   * et des quiz n'est pas une première installation, et son initialisation est
   * **allégée** — préremplie de ce qui est déduit, et plus courte. Poser les
   * quatorze questions à quelqu'un qui révise depuis un an serait lui demander
   * ce qu'on sait déjà.
   */
  existante?: boolean;
}

/**
 * Ce que la porte d'entrée doit faire.
 *
 * L'ordre compte : le socle d'abord, les modules ensuite. Un module posé avant
 * le socle demanderait les matières fortes à quelqu'un dont on ne sait pas
 * encore le prénom.
 */
export function porte(operations: readonly Operation[], options: OptionsPorte = {}): Porte {
  if (!lireInitialisation(operations)) {
    return { quoi: 'initialiser', allegee: options.existante === true };
  }
  if (options.branche && !lireModules(operations).has(options.branche)) {
    const restantes = parcours(operations, { branche: options.branche }).restantes;
    if (restantes.length) return { quoi: 'module', branche: options.branche };
  }
  return { quoi: 'entrer' };
}

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle
   ══════════════════════════════════════════════════════════════════════════ */

export interface EtatInitialisation {
  initialisation: Initialisation | null;
  profil: Profil;
  reports: Map<string, Report>;
  modules: Map<string, ModulePose>;
}

export function etat(operations: readonly Operation[]): EtatInitialisation {
  return {
    initialisation: lireInitialisation(operations),
    profil: lireProfil(operations),
    reports: lireReports(operations),
    modules: lireModules(operations),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les réponses proposées, telles que `questions.md` les formule
   ══════════════════════════════════════════════════════════════════════════ */

export interface Option {
  valeur: unknown;
  libelle: string;
  /** La phrase d'exemple sous le bouton, quand le libellé ne suffit pas. */
  aide?: string;
}

/**
 * Les choix fermés, par champ.
 *
 * Ils sont ici et non dans la page pour une raison : un essai peut alors
 * vérifier que chaque valeur proposée **passe la validation du champ**, et
 * qu'une déduction ne propose jamais une valeur absente de la liste. Un bouton
 * qui écrit une valeur refusée par `valider()` est un écran mort, et il ne se
 * découvre qu'en cliquant.
 *
 * Les champs dont les choix dépendent des données — les concours du registre,
 * les domaines, les matières d'un parcours — ne sont **pas** ici : leur liste
 * est construite à l'écran, à partir de son registre.
 */
export const CHOIX: Readonly<Record<string, readonly Option[]>> = {
  formalite: [
    { valeur: 'tu', libelle: 'Tutoie-moi' },
    { valeur: 'vous', libelle: 'Vouvoyez-moi' },
  ],
  langue: [{ valeur: 'fr', libelle: 'Français' }],
  /* Un mois est un ensemble fermé, contrairement à une année : douze libellés
     valent mieux qu'un curseur de 1 à 12, et « Mars » se lit mieux que « 3 ». */
  naissanceMois: [
    { valeur: 1, libelle: 'Janvier' },
    { valeur: 2, libelle: 'Février' },
    { valeur: 3, libelle: 'Mars' },
    { valeur: 4, libelle: 'Avril' },
    { valeur: 5, libelle: 'Mai' },
    { valeur: 6, libelle: 'Juin' },
    { valeur: 7, libelle: 'Juillet' },
    { valeur: 8, libelle: 'Août' },
    { valeur: 9, libelle: 'Septembre' },
    { valeur: 10, libelle: 'Octobre' },
    { valeur: 11, libelle: 'Novembre' },
    { valeur: 12, libelle: 'Décembre' },
  ],
  fuseau: [
    { valeur: 'Europe/Paris', libelle: 'Heure de Paris' },
    { valeur: 'Europe/Brussels', libelle: 'Bruxelles' },
    { valeur: 'Europe/Lisbon', libelle: 'Lisbonne' },
    { valeur: 'America/Martinique', libelle: 'Antilles' },
    { valeur: 'Indian/Reunion', libelle: 'La Réunion' },
    { valeur: 'Pacific/Noumea', libelle: 'Nouvelle-Calédonie' },
    { valeur: 'UTC', libelle: 'Temps universel' },
  ],
  joursTravail: [
    { valeur: 'lundi', libelle: 'Lundi' },
    { valeur: 'mardi', libelle: 'Mardi' },
    { valeur: 'mercredi', libelle: 'Mercredi' },
    { valeur: 'jeudi', libelle: 'Jeudi' },
    { valeur: 'vendredi', libelle: 'Vendredi' },
    { valeur: 'samedi', libelle: 'Samedi' },
    { valeur: 'dimanche', libelle: 'Dimanche' },
  ],
  plagesTravail: [
    { valeur: 'journee', libelle: 'Journée' },
    { valeur: 'matin', libelle: 'Matin' },
    { valeur: 'apres-midi', libelle: 'Après-midi' },
    { valeur: 'soir', libelle: 'Soir' },
    { valeur: 'nuit', libelle: 'Nuit' },
    { valeur: 'variable', libelle: 'Variable' },
  ],
  styleAccompagnement: [
    {
      valeur: 'discret',
      libelle: 'Discret',
      aide: '« 3 fiches dues. » Rien d’autre, et seulement si vous ouvrez l’écran.',
    },
    {
      valeur: 'normal',
      libelle: 'Normal',
      aide: '« 3 fiches dues aujourd’hui, dont 2 en droit public. »',
    },
    {
      valeur: 'soutenu',
      libelle: 'Soutenu',
      aide: '« 3 fiches dues. Votre série tient depuis 12 jours — une séance de 20 minutes suffit. »',
    },
  ],
  momentRevision: [
    { valeur: 'matin', libelle: 'Matin' },
    { valeur: 'soir', libelle: 'Soir' },
    { valeur: 'variable', libelle: 'Ça dépend' },
  ],
  /*
     G6 : LA QUESTION SE POSAIT EN TEXTE LIBRE, ET SEULS DEUX MOTS ÉTAIENT LUS.

     `lireMoment` ne reconnaît que « matin » et « soir », et replie tout le
     reste sur le soir. Taper « le soir », avec l'article, donnait donc le même
     résultat que ne rien taper — sans que rien le dise. Un choix fermé rend la
     question honnête : les deux réponses possibles sont les deux réponses
     lues, et l'aide dit ce que chacune change.
  */
  'moment-revue': [
    { valeur: 'matin', libelle: 'Le matin (sur la veille)', aide: 'La revue porte alors sur la journée d’hier, puis donne un aperçu du jour.' },
    { valeur: 'soir', libelle: 'Le soir (sur la journée)', aide: 'La revue porte sur la journée qui s’achève.' },
  ],
  experienceSport: [
    { valeur: 'jamais', libelle: 'Jamais' },
    { valeur: 'moins-un-an', libelle: 'Depuis moins d’un an' },
    { valeur: 'un-a-trois-ans', libelle: 'Un à trois ans' },
    { valeur: 'plus-trois-ans', libelle: 'Plus de trois ans' },
  ],
  objectifsSport: [
    { valeur: 'force', libelle: 'Force' },
    { valeur: 'masse', libelle: 'Masse' },
    { valeur: 'perte-de-gras', libelle: 'Perte de gras' },
    { valeur: 'sante', libelle: 'Santé' },
    { valeur: 'endurance', libelle: 'Endurance' },
  ],
  lieuMateriel: [
    { valeur: 'salle-complete', libelle: 'Salle complète' },
    { valeur: 'salle-limitee', libelle: 'Salle limitée' },
    { valeur: 'maison-halteres', libelle: 'Maison, haltères' },
    { valeur: 'maison-poids-du-corps', libelle: 'Maison, poids du corps' },
    { valeur: 'dehors', libelle: 'Dehors' },
  ],
  phaseSport: [
    { valeur: 'prise-de-masse', libelle: 'Prise de masse' },
    { valeur: 'seche', libelle: 'Sèche' },
    { valeur: 'maintien', libelle: 'Maintien' },
    { valeur: 'reprise', libelle: 'Reprise' },
    { valeur: 'inconnue', libelle: 'Je ne sais pas' },
  ],
  frequenceRevues: [
    { valeur: 'semaine', libelle: 'Chaque semaine' },
    { valeur: 'mois', libelle: 'Chaque mois' },
    { valeur: 'les-deux', libelle: 'Les deux' },
    { valeur: 'jamais', libelle: 'Jamais' },
  ],
  frequenceCheckin: [
    { valeur: 'quotidien', libelle: 'Oui' },
    { valeur: 'hebdomadaire', libelle: 'Une fois par semaine' },
    { valeur: 'jamais', libelle: 'Non' },
  ],
  suiviFinances: [
    { valeur: true, libelle: 'Oui, je les ajouterai' },
    { valeur: false, libelle: 'Pas maintenant' },
  ],
};

/** Les champs dont plusieurs réponses peuvent être retenues à la fois. */
export const MULTIPLES: readonly string[] = [
  'joursTravail',
  'plagesTravail',
  'objectifsSport',
  'domainesActifs',
  'concours',
  'matieresFortes',
  'matieresFaibles',
];

/** Ce qui est préchoché à l'ouverture, quand la question a un défaut sensé. */
export const DEFAUTS: Readonly<Record<string, unknown>> = {
  // Lundi–vendredi : le cas de loin le plus fréquent, et la réponse se corrige
  // d'un geste. Un écran vide demanderait sept gestes à presque tout le monde.
  joursTravail: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
  langue: 'fr',
  fuseau: 'Europe/Paris',
};

export interface Bornes {
  min: number;
  max: number;
  pas: number;
  /** L'unité affichée après le nombre. */
  unite: string;
}

export const BORNES: Readonly<Record<string, Bornes>> = {
  tempsParSemaine: { min: 0, max: 40, pas: 1, unite: 'h' },
  heuresRevision: { min: 0, max: 40, pas: 1, unite: 'h' },
  frequenceSouhaitee: { min: 1, max: 7, pas: 1, unite: 'séance' },
};

/**
 * Les nombres **tapés librement**, que rien ne borne.
 *
 * `BORNES` ne convenait pas, et la différence n'est pas cosmétique : des bornes
 * sont une **contrainte**, et B.3 demande exactement l'inverse pour une année
 * de naissance — « année plausible, confirmation en cas d'aberration, **sans
 * blocage** ». Un minimum à 1900 refuserait quelqu'un né en 1895 ; un maximum
 * calculé refuserait une faute de frappe au lieu de la signaler. Ces champs
 * s'écrivent donc sans borne, et leur invraisemblance est **dite** par
 * `anneeAberrante()`, qui rend une phrase et non un refus.
 */
export const SAISIE_LIBRE_CHIFFREE: readonly string[] = ['naissanceAnnee'];

/**
 * Y a-t-il quelque chose à dire sur cette réponse — **sans la refuser** ?
 *
 * L'écran appelle cette fonction sans savoir de quel champ il s'agit, et c'est
 * le but : s'il devait connaître les années de naissance en particulier, il
 * devrait aussi connaître la prochaine règle du même genre, et la suivante.
 * Ici, l'outillage des questions répond ; la page affiche la phrase, et laisse
 * continuer.
 *
 * C'est aussi ce qui évite à la page d'importer le calcul d'âge, que l'essai
 * sur le graphe d'imports lui interdit — à raison : un écran qui sait calculer
 * un âge sait aussi lire l'année.
 */
export function avisDeSaisie(champ: string, valeur: unknown, jour: string): string | null {
  if (champ === 'naissanceAnnee' && typeof valeur === 'number') {
    return anneeAberrante(valeur, jour);
  }
  return null;
}

/** Combien de lignes au plus, pour les champs à saisie libre multiple. */
export const MAXIMUM_LIGNES: Readonly<Record<string, number>> = {
  objectifsAnnee: 3,
  objectifsVie: 2,
};

/** Les suggestions d'une saisie libre. Proposées, jamais imposées. */
export const SUGGESTIONS: Readonly<Record<string, readonly string[]>> = {
  activite: [
    'étudiant·e',
    'agent public',
    'salarié·e du privé',
    'en préparation de concours',
    'en recherche d’emploi',
    'indépendant·e',
  ],
};

/**
 * Les champs posés **ensemble**, sur un seul écran.
 *
 * ## Pourquoi la liste est vide, et pourquoi le mécanisme reste
 *
 * Elle portait `['langue', 'fuseau']` : la question 3 de `questions.md` —
 * « Français, et heure de Paris : c'est bien ça ? » — réglait deux champs, et
 * les poser séparément aurait affiché deux fois la même phrase.
 *
 * La décision 2 du prompt 56 a dissous ce groupe : rien ne lit la langue, elle
 * n'est donc plus demandée, et l'écran ne règle plus que le fuseau. Il ne
 * reste aucun champ à grouper.
 *
 * Le mécanisme, lui, ne bouge pas : `enEcrans` regroupe sur la **question
 * affichée**, et deux champs qui recevraient demain la même formulation
 * seraient réunis sans qu'on ait à toucher cette liste. Elle ne sert plus
 * qu'au contrôle, qui vérifie qu'un groupe déclaré partage bien sa question.
 */
export const GROUPES: readonly (readonly string[])[] = [];

export interface Question {
  /** Le texte affiché, commun aux champs du groupe. */
  question: string;
  etapes: Etape[];
}

/**
 * Les étapes regroupées en écrans.
 *
 * Deux étapes voisines qui portent la même question forment un écran. Le
 * regroupement se fait sur la question affichée, et non sur la liste `GROUPES`
 * seule : si deux champs reçoivent un jour la même formulation, l'écran les
 * réunira sans qu'on ait à y penser — et le contrôle du catalogue vérifie que
 * `GROUPES` ne nomme que des champs qui partagent effectivement leur question.
 */
export function enEcrans(etapes: readonly Etape[]): Question[] {
  const ecrans: Question[] = [];
  for (const etape of etapes) {
    const dernier = ecrans[ecrans.length - 1];
    if (dernier && dernier.question === etape.declare.question) dernier.etapes.push(etape);
    else ecrans.push({ question: etape.declare.question, etapes: [etape] });
  }
  return ecrans;
}

/**
 * Les champs dont les réponses viennent d'un registre, et non d'une liste fixe.
 *
 * Déclarés ici pour que le contrôle ci-dessous puisse exiger que **tout** champ
 * ait un moyen d'être répondu : soit une liste de choix, soit des bornes, soit
 * une saisie libre de sa nature, soit une entrée dans cette liste. Un champ
 * déclaré sans aucun des quatre est une question que l'écran ne saurait pas
 * poser, et cela ne se voit qu'en arrivant dessus.
 */
export const DYNAMIQUES: readonly string[] = [
  /* Ses options sont les entrées du registre des usages, construites par
     l'écran « Qui utilise mon âge et mon sexe » — pas une liste fermée qu'on
     pourrait figer ici. */
  'usagesCoupes',
  'domainesActifs',
  'tempsParDomaine',
  'concours',
  'datesEpreuves',
  'matieresFortes',
  'matieresFaibles',
  'ciblesEquilibre',
];

/** Vérifie que chaque question sait se poser, et que chaque réponse est recevable. */
export function controlerQuestions(): string[] {
  const problemes: string[] = [];
  const declare = (champ: string) => CHAMPS.find((c) => c.champ === champ);

  const nommes = new Set<string>([
    ...Object.keys(CHOIX),
    ...Object.keys(BORNES),
    ...Object.keys(MAXIMUM_LIGNES),
    ...Object.keys(SUGGESTIONS),
    ...Object.keys(DEFAUTS),
    ...MULTIPLES,
    ...DYNAMIQUES,
    ...SAISIE_LIBRE_CHIFFREE,
    ...GROUPES.flat(),
  ]);
  for (const champ of nommes) {
    if (!declare(champ)) problemes.push(`« ${champ} » est outillé mais n’est pas un champ déclaré.`);
  }

  for (const [champ, options] of Object.entries(CHOIX)) {
    if (!options.length) problemes.push(`« ${champ} » n’a aucune réponse proposée.`);
    const multiple = MULTIPLES.includes(champ);
    const verdict = multiple
      ? valider(champ, options.map((o) => String(o.valeur)))
      : options.map((o) => valider(champ, o.valeur)).find((v) => !v.recevable);
    if (verdict && !verdict.recevable) {
      problemes.push(`Une réponse de « ${champ} » est refusée par la validation : ${verdict.motif}`);
    }
  }

  for (const groupe of GROUPES) {
    const questions = new Set(groupe.map((c) => declare(c)?.question ?? `?${c}`));
    if (questions.size !== 1) {
      problemes.push(
        `Le groupe « ${groupe.join(' + ')} » réunit des champs qui ne posent pas la même question.`,
      );
    }
  }

  for (const champ of champsDuSocle()) {
    const outille =
      champ.champ in CHOIX ||
      champ.champ in BORNES ||
      champ.champ in MAXIMUM_LIGNES ||
      champ.champ in SUGGESTIONS ||
      DYNAMIQUES.includes(champ.champ) ||
      SAISIE_LIBRE_CHIFFREE.includes(champ.champ) ||
      champ.nature === 'texte' ||
      champ.nature === 'heure' ||
      champ.nature === 'booleen';
    if (!outille) problemes.push(`Le champ « ${champ.champ} » n’a aucun moyen d’être répondu.`);
  }

  return problemes;
}
