/**
 * Le registre des parcours de Cyclades · Révisions.
 *
 * ## Pourquoi le registre porte les thèmes de planification
 *
 * Les sept matières de l'INSP vivaient dans `rotation.ts`, comme constante du
 * code, et elles y servaient de **thèmes de la rotation hebdomadaire** — donc de
 * la planification, donc des séances, donc des rappels. Un second parcours
 * n'aurait eu aucun thème, et donc aucune planification : pas une page vide, une
 * branche entière inerte.
 *
 * Le registre déclare donc les thèmes, et `rotation.ts` en est devenu le
 * lecteur. C'est l'inversion que l'audit de parité a rendue nécessaire
 * (`docs/cyclades/audit-parite.md`).
 *
 * ## Un parcours peut n'avoir aucun thème, et c'est un état normal
 *
 * Les programmes des concours de la DGFiP doivent venir de sources officielles
 * et **ne jamais être inventés** : un programme faux produirait des mois de
 * révision à côté du sujet. Tant qu'un référentiel n'est pas établi sur source
 * datée, le parcours existe, se navigue, et dit que sa planification attend son
 * référentiel. `themes: []` est donc une valeur légitime, que tout lecteur du
 * registre doit traiter — pas une absence à combler par un défaut.
 *
 * ## Pourquoi la racine de contenu de l'INSP est vide
 *
 * Le contenu de l'INSP vit aujourd'hui à la racine de `content/`, et non dans
 * `content/insp/`. Le déplacer semblerait plus propre et serait une faute :
 * l'identifiant d'une fiche est un hachage de son chemin relatif
 * (`idStable(relatif)`), et les 262 fiches changeraient donc d'identifiant. La
 * progression FSRS, le journal d'erreurs, les niveaux estimés et les podcasts
 * sont tous rattachés à ces identifiants : la migration coûterait l'historique
 * entier pour un gain d'esthétique. La racine de l'INSP reste donc `''`, et les
 * parcours créés ensuite ont la leur.
 */

/** Un thème de la rotation hebdomadaire, et les matières qu'il rattache. */
export interface ThemePlanification {
  id: string;
  nom: string;
  /** Nom court, pour les cases du calendrier. */
  court: string;
  icone: string;
  /** Matières du contenu rattachées à ce thème. */
  matieres: string[];
}

/**
 * La voie du concours.
 *
 * `a-preciser` n'est pas un oubli : c'est l'état d'un parcours dont le grade est
 * connu mais dont la voie n'a pas été arrêtée. Mieux vaut l'afficher que de
 * trancher à la place de la personne — c'est exactement l'erreur que le prompt
 * « Demander à l'IA » commettait en annonçant « externe » pour une préparation
 * interne.
 */
export type Voie = 'interne' | 'externe' | 'a-preciser';

export interface Concours {
  /**
   * La désignation complète, groupe nominal compris, telle qu'elle s'insère
   * dans une phrase : « Tu m'aides à préparer <phrase>. »
   *
   * Stockée en entier et non composée à partir d'un sigle et d'une voie :
   * engendrer « le concours interne de l'INSP » ou « le concours de contrôleur
   * des finances publiques » demande de gérer les articles, les élisions et les
   * genres, et chaque parcours ajouté serait une occasion de produire du
   * français faux dans un prompt.
   */
  phrase: string;
  sigle: string;
  voie: Voie;
}

/** D'où vient le programme d'un parcours. Jamais une présomption. */
export interface Referentiel {
  /**
   * - `officiel` : établi sur un arrêté ou une notice, datés.
   * - `annales` : déduit d'annales réelles déjà intégrées au site.
   * - `a-etablir` : aucune source à ce jour. Le parcours reste navigable et le dit.
   */
  origine: 'officiel' | 'annales' | 'a-etablir';
  /** La source, quand il y en a une. Obligatoire dès que l'origine n'est pas « a-etablir ». */
  source?: string;
  /** Date de vérification, au format AAAA-MM-JJ. */
  verifieLe?: string;
}

export interface Parcours {
  id: string;
  /** Le nom de la branche tel qu'il s'affiche : « INSP », « DGFiP B ». */
  libelle: string;
  /** L'intitulé long, pour les écrans de choix. */
  intitule: string;
  concours: Concours;
  /**
   * Le sous-dossier de `content/` qui porte les fiches. `''` = la racine.
   * Voir l'en-tête du module avant de songer à le changer pour l'INSP.
   */
  racineContenu: string;
  referentiel: Referentiel;
  themes: ThemePlanification[];
  /**
   * Le thème proposé pour chaque jour de la semaine, index 0 = dimanche.
   * Vide quand le parcours n'a pas de thèmes : il n'y a alors rien à proposer,
   * et inventer une rotation serait inventer un programme.
   */
  rotationParDefaut: string[];
}

/* ══════════════════════════════════════════════════════════════════════════
   INSP — le parcours historique
   ══════════════════════════════════════════════════════════════════════════ */

/*
   La correspondance thème ↔ matière est de un à un. Les listes restent des
   tableaux pour absorber un regroupement futur sans retoucher une centaine de
   fichiers.
*/
const THEMES_INSP: ThemePlanification[] = [
  { id: 'droit-public', nom: 'Droit public', court: 'Droit pub.', icone: '⚖️', matieres: ['Droit public'] },
  { id: 'finances-publiques', nom: 'Finances publiques', court: 'Fin. pub.', icone: '💶', matieres: ['Finances publiques'] },
  { id: 'economie', nom: 'Économie', court: 'Économie', icone: '📊', matieres: ['Économie'] },
  { id: 'questions-europeennes', nom: 'Questions européennes', court: 'Q. europ.', icone: '🇪🇺', matieres: ['Questions européennes'] },
  { id: 'questions-internationales', nom: 'Questions internationales', court: 'Q. inter.', icone: '🌍', matieres: ['Questions internationales'] },
  { id: 'questions-sociales', nom: 'Questions sociales', court: 'Q. sociales', icone: '🤝', matieres: ['Questions sociales'] },
  { id: 'cas-pratique', nom: 'Résolution de cas pratique', court: 'Cas prat.', icone: '🗂️', matieres: ['Cas pratique'] },
];

/*
   La semaine de travail commence par le droit public et se termine, le
   dimanche, par le cas pratique — l'exercice le plus long. Entièrement
   reconfigurable depuis la page de planification, jours de repos compris.
*/
const ROTATION_INSP = [
  'cas-pratique', // dimanche
  'droit-public', // lundi
  'finances-publiques', // mardi
  'economie', // mercredi
  'questions-europeennes', // jeudi
  'questions-internationales', // vendredi
  'questions-sociales', // samedi
];

/* ══════════════════════════════════════════════════════════════════════════
   DGFiP B — thèmes déduits des annales, et de rien d'autre
   ══════════════════════════════════════════════════════════════════════════ */

/*
   Ces huit thèmes ne sont pas un programme officiel : ce sont les huit rubriques
   de la banque « QCM - DGFiP », établies à partir des annales du concours de
   contrôleur réellement dépouillées et déjà intégrées au site. L'origine du
   référentiel est donc `annales`, et non `officiel` — la nuance compte, parce
   qu'une rubrique d'annales dit ce qui a été demandé, pas ce qui est au
   programme.
*/
const THEMES_DGFIP_B: ThemePlanification[] = [
  { id: 'culture-generale', nom: 'Culture générale', court: 'Culture g.', icone: '📚', matieres: ['Culture générale'] },
  { id: 'maths', nom: 'Mathématiques', court: 'Maths', icone: '🔢', matieres: ['Maths'] },
  { id: 'francais', nom: 'Français', court: 'Français', icone: '✍️', matieres: ['Français'] },
  { id: 'logique', nom: 'Logique', court: 'Logique', icone: '🧩', matieres: ['Logique'] },
  { id: 'environnement-administratif', nom: 'Environnement administratif', court: 'Env. adm.', icone: '🏛️', matieres: ['Environnement administratif'] },
  { id: 'culture-numerique', nom: 'Culture numérique', court: 'Numérique', icone: '💻', matieres: ['Culture numérique'] },
  { id: 'union-europeenne', nom: 'Union européenne', court: 'Union eur.', icone: '🇪🇺', matieres: ['Union européenne'] },
  { id: 'anglais', nom: 'Anglais', court: 'Anglais', icone: '🇬🇧', matieres: ['Anglais'] },
];

/*
   Sept jours, huit thèmes : l'anglais n'a pas de créneau par défaut, parce que
   la banque n'en porte que cinq questions — trop peu pour tenir une séance
   hebdomadaire. Il reste assignable à la main, et prendra son créneau quand il
   aura de quoi le remplir.
*/
const ROTATION_DGFIP_B = [
  'culture-generale', // dimanche
  'maths', // lundi
  'francais', // mardi
  'logique', // mercredi
  'environnement-administratif', // jeudi
  'culture-numerique', // vendredi
  'union-europeenne', // samedi
];

/* ══════════════════════════════════════════════════════════════════════════
   Le registre
   ══════════════════════════════════════════════════════════════════════════ */

export const PARCOURS: Parcours[] = [
  {
    id: 'insp',
    libelle: 'INSP',
    intitule: 'Institut national du service public — concours interne',
    concours: {
      phrase: 'le concours interne de l’INSP (Institut national du service public)',
      sigle: 'INSP',
      voie: 'interne',
    },
    racineContenu: '',
    referentiel: {
      origine: 'officiel',
      source: 'Fascicules de préparation IGPDE et programme du concours interne',
      verifieLe: '2026-10-10',
    },
    themes: THEMES_INSP,
    rotationParDefaut: ROTATION_INSP,
  },
  {
    id: 'dgfip-b',
    libelle: 'DGFiP B',
    intitule: 'DGFiP B — contrôleur des finances publiques',
    concours: {
      phrase: 'le concours de contrôleur des finances publiques (DGFiP, catégorie B)',
      sigle: 'DGFiP B',
      voie: 'a-preciser',
    },
    racineContenu: 'dgfip-b',
    referentiel: {
      origine: 'annales',
      source: 'Annales du concours de contrôleur dépouillées pour la banque « QCM - DGFiP »',
      verifieLe: '2026-10-10',
    },
    themes: THEMES_DGFIP_B,
    rotationParDefaut: ROTATION_DGFIP_B,
  },
  {
    id: 'dgfip-a',
    libelle: 'DGFiP A',
    intitule: 'DGFiP A — inspecteur des finances publiques',
    concours: {
      phrase: 'le concours d’inspecteur des finances publiques (DGFiP, catégorie A)',
      sigle: 'DGFiP A',
      voie: 'a-preciser',
    },
    racineContenu: 'dgfip-a',
    referentiel: { origine: 'a-etablir' },
    themes: [],
    rotationParDefaut: [],
  },
  {
    id: 'dgfip-ap',
    libelle: 'DGFiP A+',
    intitule: 'DGFiP A+ — inspecteur principal des finances publiques',
    concours: {
      phrase: 'le concours d’inspecteur principal des finances publiques (DGFiP, catégorie A+)',
      sigle: 'DGFiP A+',
      voie: 'a-preciser',
    },
    racineContenu: 'dgfip-ap',
    referentiel: { origine: 'a-etablir' },
    themes: [],
    rotationParDefaut: [],
  },
];

/** Le parcours ouvert par défaut, et le seul qui porte du contenu aujourd'hui. */
export const ID_PARCOURS_PAR_DEFAUT = 'insp';

export const parcours = (id: string): Parcours | undefined =>
  PARCOURS.find((p) => p.id === id);

/**
 * Le parcours d'un identifiant, ou celui par défaut.
 *
 * Un identifiant inconnu — un réglage écrit par une version antérieure, un
 * parcours retiré — ne doit pas vider l'écran : il ramène à l'INSP, qui est le
 * seul parcours dont on sait qu'il a du contenu.
 */
export function parcoursOuDefaut(id: string | null | undefined): Parcours {
  return parcours(id ?? '') ?? (parcours(ID_PARCOURS_PAR_DEFAUT) as Parcours);
}

/** Le parcours a-t-il de quoi planifier ? Faux tant que son référentiel manque. */
export const planifiable = (p: Parcours): boolean => p.themes.length > 0;

/**
 * Ce qu'il faut dire d'un parcours dont le référentiel n'est pas établi.
 *
 * Rendu ici et non dans un composant, pour que la page de planification, la page
 * d'accueil du parcours et le tableau de couverture disent tous la même chose.
 */
export function raisonNonPlanifiable(p: Parcours): string | null {
  if (planifiable(p)) return null;
  return `Le programme de ${p.libelle} n’est pas encore établi sur source officielle. La planification s’ouvrira quand il le sera : un programme inventé ferait réviser à côté du sujet.`;
}
