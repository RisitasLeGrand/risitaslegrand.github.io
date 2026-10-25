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
   *
   * Peut être plus court que sept : `rotationParDefaut()` complète les jours
   * restants par `SANS_THEME`, qui veut dire « rien n'est proposé ce jour-là ».
   * C'est le cas de DGFiP A, qui a six thèmes.
   */
  rotationParDefaut: string[];
  /**
   * Pourquoi ce parcours n'a aucun thème ALORS QUE son référentiel est établi.
   *
   * Un parcours sans thèmes dont le référentiel est `a-etablir` attend sa
   * source, et `raisonNonPlanifiable` le dit très bien. Mais un parcours peut
   * avoir une source officielle ET aucun thème : DGFiP A+, dont le programme a
   * été abrogé. Lui servir « son programme n'est pas encore établi sur source
   * officielle » serait faux, dit à la personne au moment où elle cherche quoi
   * réviser. La phrase est donc déclarée par le parcours qui connaît sa raison,
   * plutôt que devinée par un message générique.
   */
  raisonSansThemes?: string;
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
   DGFiP B — le tronc commun de l'arrêté du 19 mai 2011
   ══════════════════════════════════════════════════════════════════════════ */

/*
   CE QUI A CHANGÉ, ET POURQUOI LES HUIT RUBRIQUES DE LA BANQUE ONT CÉDÉ.

   Ces thèmes venaient des huit rubriques de la banque « QCM - DGFiP », établies
   sur les annales dépouillées — l'origine du référentiel était donc `annales`,
   et le commentaire l'assumait. La confrontation au programme officiel, menée
   dans `docs/cyclades/programmes-dgfip.md` § 5.1, a montré que deux d'entre
   elles ne sont PAS au programme du concours de contrôleur :
   `environnement-administratif` est le thème 1° du QCM d'INSPECTEUR, et
   l'anglais son thème 5°. Deux autres n'étaient pas des thèmes mais des parties
   des connaissances générales : l'Union européenne (partie D) et la culture
   numérique (partie E). Et deux intitulés n'étaient pas ceux de l'arrêté :
   « culture générale » pour « connaissances générales », « logique » pour
   « raisonnement logique ».

   Garder ces rubriques tout en déclarant un référentiel `officiel` aurait donc
   été impossible sans mentir : c'est ce qui tranche entre les deux options que
   le § 5.3 laissait au propriétaire du code. L'option 2 (conserver les huit
   rubriques en corrigeant les intitulés) ne peut pas porter une origine
   `officiel`, puisque deux de ses thèmes sont hors programme. L'OPTION 1 est
   donc retenue, et elle est reprise ligne à ligne du § 5.3 : sept thèmes, un
   par jour.

   Ce que cela coûte, et qui est dit aux écarts restants : la banque « QCM -
   DGFiP » n'est pas filtrée par parcours, donc ses rubriques `anglais` et
   `environnement-administratif` ne correspondent plus à un thème de ce
   parcours-ci. Le § 5.3 le signalait déjà ; le filtrage de la banque reste à
   faire, et il n'est pas de ce lot.
*/
const THEMES_DGFIP_B: ThemePlanification[] = [
  {
    id: 'connaissances-generales',
    nom: 'Connaissances générales',
    court: 'Conn. gén.',
    icone: '📚',
    matieres: ['Connaissances générales'],
  },
  { id: 'francais', nom: 'Français', court: 'Français', icone: '✍️', matieres: ['Français'] },
  { id: 'maths', nom: 'Mathématiques', court: 'Maths', icone: '🔢', matieres: ['Maths'] },
  {
    id: 'raisonnement-logique',
    nom: 'Raisonnement logique',
    court: 'Raisonnement',
    icone: '🧩',
    matieres: ['Logique'],
  },
  {
    id: 'analyse-de-dossier',
    nom: 'Analyse de dossier',
    court: 'Dossier',
    icone: '🗂️',
    matieres: ['Analyse de dossier'],
  },
  {
    /*
       L'épreuve n° 2 du concours externe laisse CINQ options et celle de
       l'interne DIX : aucune n'est commune aux trois voies. Un thème par option
       aurait donc fabriqué quinze thèmes dont la personne n'en prépare qu'un, et
       choisir lesquels aurait supposé une voie que `concours.voie` laisse
       justement à `a-preciser`. Le thème porte donc l'option, pas son contenu,
       et ses matières sont celles des quatre options externes qui n'ont pas de
       thème propre ailleurs — § 5.3.
    */
    id: 'option-qrc',
    nom: 'Matière d’option (QRC)',
    court: 'Option',
    icone: '🔀',
    matieres: ['SES', 'Comptabilité', 'Droit', 'Histoire-géo'],
  },
  {
    /*
       Pas au programme du QCM, mais à celui de l'oral — coefficient 6, le plus
       fort des trois voies — et à celui de l'option 10 du concours interne.
       Le § 5.3 lui donne un créneau pour cette raison.
    */
    id: 'environnement-dgfip',
    nom: 'Environnement et organisation de la DGFiP',
    court: 'Env. DGFiP',
    icone: '🏛️',
    matieres: ['Organisation de la DGFiP'],
  },
];

/*
   Sept thèmes, sept jours. Le dimanche prend l'analyse de dossier, qui est
   l'épreuve la plus longue — trois heures — comme le dimanche de l'INSP prend
   le cas pratique. Les deux thèmes qui ne sont pas des matières de QCM ferment
   la semaine. Entièrement reconfigurable depuis la page de planification.
*/
const ROTATION_DGFIP_B = [
  'analyse-de-dossier', // dimanche
  'connaissances-generales', // lundi
  'francais', // mardi
  'maths', // mercredi
  'raisonnement-logique', // jeudi
  'option-qrc', // vendredi
  'environnement-dgfip', // samedi
];

/* ══════════════════════════════════════════════════════════════════════════
   DGFiP A — les cinq thèmes du QCM de l'arrêté du 2 mars 2011, et l'option
   ══════════════════════════════════════════════════════════════════════════ */

/*
   Lus à l'annexe de l'arrêté, § 3.2 du document des programmes, dans l'ordre
   que l'arrêté leur donne : 1° environnement administratif, économique et
   financier ; 2° Union européenne ; 3° culture numérique ; 4° raisonnement
   logique ; 5° anglais. Le sixième thème porte l'épreuve de QRC, dont les neuf
   matières sont au choix du candidat (§ 3.3).

   Une remarque sur le document plutôt que sur l'arrêté : le § 5.3 écrit que les
   neuf matières de QRC « en font un dixième ». Cinq thèmes de QCM plus un thème
   d'option font six, non dix ; je lis « un sixième » et je le signale plutôt
   que de fabriquer quatre thèmes pour atteindre le compte.

   Ce que ces thèmes ne couvrent pas, et qui est dit aux écarts restants :
   l'épreuve n° 1 — note de synthèse, quatre heures, coefficient 5 — n'a pas de
   thème, alors que le § 5.3 en donne un à son équivalent chez le contrôleur
   (`analyse-de-dossier`). Le § 5.3 ne le propose pas pour l'inspecteur, et je
   ne l'ajoute pas de moi-même : la dissymétrie est réelle, elle est remontée.
*/
const THEMES_DGFIP_A: ThemePlanification[] = [
  {
    id: 'environnement-administratif-economique-financier',
    nom: 'Environnement administratif, économique et financier',
    court: 'Env. adm.',
    icone: '🏛️',
    matieres: ['Environnement administratif, économique et financier'],
  },
  {
    id: 'union-europeenne',
    nom: 'Union européenne',
    court: 'Union eur.',
    icone: '🇪🇺',
    matieres: ['Union européenne'],
  },
  {
    id: 'culture-numerique',
    nom: 'Culture numérique',
    court: 'Numérique',
    icone: '💻',
    matieres: ['Culture numérique'],
  },
  {
    /*
       L'arrêté énumère « 4° raisonnement logique » à l'épreuve, et son annexe
       intitule le programme « IV. Raisonnement et logique ». Les deux graphies
       sont au document ; le thème porte celle de l'épreuve, et l'écart est
       noté ici plutôt que choisi en silence.
    */
    id: 'raisonnement-logique',
    nom: 'Raisonnement logique',
    court: 'Raisonnement',
    icone: '🧩',
    matieres: ['Raisonnement et logique'],
  },
  {
    // « anglais du niveau B1 du cadre européen de référence pour les langues ».
    id: 'anglais',
    nom: 'Anglais',
    court: 'Anglais',
    icone: '🇬🇧',
    matieres: ['Anglais'],
  },
  {
    /*
       Une matière au choix parmi neuf, et c'est le candidat qui choisit : le
       thème porte donc l'épreuve, et ses matières sont les neuf titres de
       l'annexe. Les séparer en neuf thèmes aurait proposé huit séances par
       semaine sur des matières que personne ne prépare.
    */
    id: 'option-qrc',
    nom: 'Matière d’option (QRC)',
    court: 'Option',
    icone: '🔀',
    matieres: [
      'Droit public',
      'Droit privé',
      'Finances publiques',
      'Mathématiques, statistiques et probabilités',
      'Comptabilité et analyse financière',
      'Analyse économique',
      'Sciences politiques',
      'Littérature',
      'Histoire et géographie',
    ],
  },
];

/*
   Six thèmes, sept jours, et le septième jour ne reçoit AUCUNE proposition.

   Trois sorties étaient possibles et deux sont fausses. Répéter un thème
   choisirait pour la personne la matière qui compte double, ce que l'arrêté ne
   dit pas. Y mettre le repos affirmerait un jour de repos que personne n'a
   décidé — et `rotation.ts` le refuserait de toute façon, puisque la rotation
   par défaut ne peut nommer que les thèmes du parcours. Le tableau s'arrête
   donc à six : `rotationParDefaut()` complète le septième jour par
   `SANS_THEME`, qui veut dire « rien n'est proposé ce jour-là », et la page de
   planification laisse la personne l'assigner.

   Le dimanche prend l'option de QRC, qui est une matière académique entière,
   comme le dimanche de l'INSP prend l'exercice le plus long. Les cinq thèmes
   du QCM suivent du lundi au vendredi, dans l'ordre de l'arrêté.
*/
const ROTATION_DGFIP_A = [
  'option-qrc', // dimanche
  'environnement-administratif-economique-financier', // lundi
  'union-europeenne', // mardi
  'culture-numerique', // mercredi
  'raisonnement-logique', // jeudi
  'anglais', // vendredi
  // samedi : rien de proposé, et c'est dit plus haut.
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
      origine: 'officiel',
      source:
        'Arrêté du 19 mai 2011 (NOR BCRE1106036A, JORF n° 0126 du 31 mai 2011), version en ' +
        'vigueur issue de l’arrêté du 1er juillet 2024 (NOR ECOE2416020A) — lue au 14 octobre ' +
        '2026 ; relevé dans docs/cyclades/programmes-dgfip.md',
      verifieLe: '2026-10-17',
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
    referentiel: {
      origine: 'officiel',
      source:
        'Arrêté du 2 mars 2011 (NOR BCRE1030476A, JORF n° 0055 du 6 mars 2011, ' +
        'JORFTEXT000023662281), version en vigueur issue de l’arrêté du 1er juillet 2024 ' +
        '(NOR ECOE2416012A) — lue au 14 octobre 2026 ; relevé dans ' +
        'docs/cyclades/programmes-dgfip.md',
      verifieLe: '2026-10-17',
    },
    themes: THEMES_DGFIP_A,
    rotationParDefaut: ROTATION_DGFIP_A,
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
    referentiel: {
      origine: 'officiel',
      source:
        'Arrêté du 2 mars 2011 (NOR BCRE1104996A, JORF n° 0055 du 6 mars 2011, ' +
        'JORFTEXT000023662346), article 1er en vigueur depuis le 22 décembre 2025 ; son ' +
        'annexe de programme est ABROGÉE depuis le 6 septembre 2025 par l’article 2 de ' +
        'l’arrêté du 4 septembre 2025 (NOR ECOE2524347A) — lu au 14 octobre 2026 ; relevé ' +
        'dans docs/cyclades/programmes-dgfip.md',
      verifieLe: '2026-10-17',
    },
    /*
       AUCUN THÈME, ET CE N'EST PLUS UNE ATTENTE. L'annexe de programme est
       abrogée depuis le 6 septembre 2025 : les six options de l'épreuve n° 2 du
       concours professionnel sont la seule délimitation en vigueur, et ce sont
       des MÉTIERS — fiscalité professionnelle, gestion publique, systèmes
       d'information — non des matières académiques. Les deux examens
       professionnels, eux, n'ont qu'un oral et aucun programme de
       connaissances. Fabriquer des thèmes ici reviendrait à inventer le
       programme que l'État a retiré.
    */
    themes: [],
    rotationParDefaut: [],
    raisonSansThemes:
      'Le programme de DGFiP A+ n’attend pas une source : il a été abrogé. Depuis le ' +
      '6 septembre 2025, aucun programme n’est annexé au concours professionnel, et les deux ' +
      'examens professionnels n’ont qu’un oral. La planification par thèmes n’a donc rien à ' +
      'proposer ; les six options de l’épreuve n° 2 sont des métiers, pas des matières.',
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
  /*
     Deux absences de thèmes, et deux phrases, parce qu'elles ne disent pas la
     même chose. Un référentiel `a-etablir` attend une source ; un référentiel
     établi sans thèmes a une autre raison, que le parcours porte lui-même. La
     seconde branche ne retombe JAMAIS sur la première : un parcours établi et
     sans thèmes qui ne déclarerait pas sa raison serait un défaut à corriger,
     pas une phrase à improviser — et `essais:parcours` le fait rougir.
  */
  if (p.referentiel.origine !== 'a-etablir') {
    return (
      p.raisonSansThemes ??
      `Le programme de ${p.libelle} ne donne aucun thème de planification, et la raison n’est pas déclarée. C’est un défaut du registre, non un état de ce concours.`
    );
  }
  return `Le programme de ${p.libelle} n’est pas encore établi sur source officielle. La planification s’ouvrira quand il le sera : un programme inventé ferait réviser à côté du sujet.`;
}
