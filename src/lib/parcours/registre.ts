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
  /**
   * Les racines de contenu que ce parcours partage avec d'autres.
   *
   * ## Le problème que ce champ résout
   *
   * Une matière peut être au programme de plusieurs concours — l'organisation
   * de la DGFiP l'est des trois. Écrite deux fois, elle donnerait deux fiches
   * à maintenir, et surtout DEUX IDENTIFIANTS : `idStable` hache le chemin
   * relatif à `content/`, donc la même fiche sous `dgfip-a/` et sous
   * `dgfip-b/` porte deux empreintes, deux séries FSRS, deux journaux
   * d'erreurs et deux podcasts. Réviser la fiche sous un parcours ne compterait
   * pas sous l'autre.
   *
   * ## Pourquoi une racine commune suffit, et pourquoi `idStable` ne bouge pas
   *
   * Une fiche rangée sous `content/commun/` a un chemin relatif qui ne nomme
   * aucun parcours : son empreinte est donc la même pour tous. L'invariant
   * « un identifiant, un historique » tient sans toucher à `idStable`, dont
   * dépend l'historique des 262 fiches de l'INSP — et c'est exactement pour
   * cela qu'on ne la touche pas.
   *
   * ## Ce que ce champ ne fait pas
   *
   * Il ne range aucune fiche et ne déplace rien. Il dit quelles racines un
   * parcours sert EN PLUS de la sienne. Le thème sous lequel la fiche apparaît
   * reste déclaré par chaque parcours : la même matière n'a pas le même poids
   * d'un concours à l'autre, et l'organisation de la DGFiP est un thème de QCM
   * chez l'inspecteur là où elle est une option de l'oral chez le contrôleur.
   *
   * Un tableau vide est un état normal, et non une absence à combler : l'INSP
   * ne partage rien, et c'est une propriété de son contenu — ses 262 fiches
   * sont à la racine.
   */
  racinesPartagees: string[];
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
   * Ce qu'il faut savoir du programme de ce parcours, même quand il se planifie.
   *
   * ## Pourquoi ce champ n'est pas une raison de refus
   *
   * Il a d'abord été écrit comme telle — « pourquoi ce parcours n'a aucun thème
   * alors que son référentiel est établi » —, pour DGFiP A+, qui n'en avait
   * aucun. Dès que A+ a reçu les quatre épreuves de l'article 1er, ce champ
   * devenait mort : plus aucun parcours n'est sans thèmes, et la phrase se
   * serait tue avec lui.
   *
   * Or ce qu'elle dit reste vrai et reste utile : le programme ANNEXÉ de A+ est
   * abrogé depuis le 6 septembre 2025, ses thèmes viennent du seul article 1er,
   * et ce sont des épreuves plutôt que des matières. Quelqu'un qui cherche « le
   * programme de l'IPFiP » tombera sur un texte abrogé ; il vaut mieux le lui
   * dire que de le laisser le découvrir.
   *
   * L'avertissement s'affiche donc avec le calendrier, et non à sa place. Il
   * sert aussi de raison de repli si un parcours se retrouvait sans thèmes avec
   * un référentiel établi — voir `raisonNonPlanifiable`.
   */
  avertissementDuProgramme?: string;
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
  {
    /*
       AJOUTÉ LE 25 OCTOBRE, ET IL MANQUAIT POUR DEUX RAISONS À LA FOIS.

       Le QCM porte l'organisation de la DGFiP dans son thème I — « les
       institutions administratives », « la réforme de l'État », et au § 3.2
       l'organisation administrative de la France. Et l'épreuve n° 2 du concours
       INTERNE en fait son option 5, « budget, immobilier, gestion des
       ressources humaines, logistique et organisation de la DGFiP », dont le
       document note que la partie III « reprend mot pour mot, à la graphie
       près » l'option 10 du concours de contrôleur.

       Il porte donc le même identifiant et le même intitulé que chez DGFiP B :
       c'est la même matière, et le lot de partage entre parcours s'appuiera
       là-dessus. Avec lui, DGFiP A a sept thèmes pour sept jours.
    */
    id: 'environnement-dgfip',
    nom: 'Environnement et organisation de la DGFiP',
    court: 'Env. DGFiP',
    icone: '🏛️',
    matieres: ['Organisation de la DGFiP'],
  },
];

/*
   Sept thèmes, sept jours. Le dimanche prend l'option de QRC, qui est une
   matière académique entière, comme le dimanche de l'INSP prend l'exercice le
   plus long. Les cinq thèmes du QCM suivent du lundi au vendredi, dans l'ordre
   de l'arrêté, et l'organisation de la DGFiP ferme la semaine.

   La semaine était incomplète jusqu'au 25 octobre : six thèmes, et le samedi
   sans proposition. Le septième thème ne vient pas d'un arrangement de
   calendrier mais d'une lecture qui manquait — le QCM et l'option 5 de
   l'interne portent tous deux l'organisation de la DGFiP. C'est le programme
   qui remplit la semaine, non l'inverse.
*/
const ROTATION_DGFIP_A = [
  'option-qrc', // dimanche
  'environnement-administratif-economique-financier', // lundi
  'union-europeenne', // mardi
  'culture-numerique', // mercredi
  'raisonnement-logique', // jeudi
  'anglais', // vendredi
  'environnement-dgfip', // samedi
];

/* ══════════════════════════════════════════════════════════════════════════
   DGFiP A+ — l'article 1er, et lui seul, puisque l'annexe est abrogée
   ══════════════════════════════════════════════════════════════════════════ */

/*
   CE PARCOURS A DES THÈMES SANS AVOIR DE PROGRAMME, ET LA NUANCE EST TOUT.

   L'annexe de programme de l'arrêté du 2 mars 2011 est ABROGÉE depuis le
   6 septembre 2025 — article 2 de l'arrêté du 4 septembre 2025, état `ABROGE`
   pour `LEGIARTI000030768328`. Chercher « le programme de l'IPFiP » aboutit
   donc à un texte abrogé, et c'est un piège que la préparation doit connaître.

   Ce qui reste en vigueur, c'est l'ARTICLE 1er, dans sa version du
   22 décembre 2025, qui délimite encore les épreuves. Les thèmes ci-dessous
   viennent de lui et de rien d'autre : ils décrivent des ÉPREUVES, non un
   programme de connaissances, et l'avertissement du parcours le dit à la
   personne au lieu de le laisser croire.

   La conséquence pratique est que ces thèmes sont des métiers là où ceux de
   l'INSP sont des matières académiques. On ne « révise » pas la fiscalité
   professionnelle comme on révise le droit public ; on s'y prépare sur des cas
   pratiques. Le registre n'a pas de place pour dire cela, et c'est à
   l'avertissement de le porter.
*/
const THEMES_DGFIP_AP: ThemePlanification[] = [
  {
    /*
       Épreuve n° 1, cinq heures, coefficient 6 : une note administrative « sur
       un sujet relatif à l'environnement administratif, économique, financier
       et social de la DGFiP, ainsi qu'aux politiques publiques dans lesquelles
       la DGFiP intervient ». Un seul thème, parce que l'arrêté n'y découpe
       rien.
    */
    id: 'environnement-et-politiques-publiques',
    nom: 'Environnement administratif, économique, financier et social',
    court: 'Env. et pol.',
    icone: '🏛️',
    matieres: ['Environnement administratif, économique, financier et social', 'Politiques publiques'],
  },
  {
    /*
       Épreuve n° 2, première partie, notée 15 points sur 20 : six options « au
       choix du candidat ». Un seul thème, comme pour les options de QRC chez A
       et B — six thèmes auraient proposé cinq séances par semaine sur des
       métiers que personne ne prépare. Les intitulés sont ceux du texte, avec
       ses élisions : « la gestion comptable et l'analyse financière », « la
       gestion des ressources et l'organisation de la DGFiP ».
    */
    id: 'option-metier',
    nom: 'Épreuve professionnelle',
    court: 'Métier',
    icone: '🔀',
    matieres: [
      'Fiscalité professionnelle',
      'Fiscalité personnelle et patrimoniale',
      'Gestion comptable et l’analyse financière',
      'Gestion publique (État et collectivités locales)',
      'Gestion des ressources et l’organisation de la DGFiP',
      'Systèmes d’information',
      /*
         LA MATIÈRE COMMUNE, ET POURQUOI ELLE EST ICI.

         « Organisation de la DGFiP » est le nom de matière des fiches rangées
         sous la racine commune, servie aux trois parcours DGFiP. Les thèmes
         `environnement-dgfip` de B et de A la portent déjà.

         A+ servait cette racine sans porter la matière, et le défaut était
         silencieux : `fichesDuTheme` rapproche une fiche de son thème par le
         NOM EXACT de la matière, à la casse près. Une fiche de la racine
         commune était donc dans l'arbre du parcours A+ sans qu'aucune séance
         ne la propose jamais — le contenu livré, et personne pour le lire.

         Sa place est l'épreuve professionnelle, parce que l'option de l'arrêté
         s'intitule « Gestion des ressources et l'organisation de la DGFiP » :
         l'organisation de la DGFiP y est nommée. La matière commune est
         rattachée à ce thème, et non ajoutée comme un huitième intitulé
         d'option, qui aurait fait croire à une option de plus au concours.

         Mesuré par `npm run essais:matiere-commune`.
      */
      'Organisation de la DGFiP',
    ],
  },
  {
    /*
       Épreuve n° 2, seconde partie, notée 5 points sur 20, et COMMUNE à tous
       les candidats : elle ne dépend d'aucune option, donc elle a son thème
       propre. La ranger avec les six options aurait laissé croire qu'on peut
       ne pas la préparer.
    */
    id: 'analyse-financiere',
    nom: 'Analyse financière',
    court: 'Analyse fin.',
    icone: '📊',
    matieres: ['Analyse financière'],
  },
  {
    /*
       L'oral, quarante minutes, coefficient 8 — le plus fort de l'épreuve. Il
       a son thème parce qu'il se prépare, et parce que c'est la SEULE épreuve
       notée des deux examens professionnels (§ 4.2 et § 4.3), où il n'y a ni
       écrit ni programme de connaissances.
    */
    id: 'entretien-avec-le-jury',
    nom: 'Entretien avec le jury',
    court: 'Oral',
    icone: '🎙️',
    matieres: ['Entretien avec le jury'],
  },
];

/*
   Quatre thèmes, sept jours : trois jours ne reçoivent AUCUNE proposition, et
   l'écran le dit case par case.

   C'est volontaire et c'est honnête. L'arrêté ne délimite que quatre épreuves ;
   en étaler quatre sur sept jours obligerait à en répéter trois, c'est-à-dire à
   désigner les matières qui comptent double — ce que le texte ne dit pas, et
   qui est précisément le genre d'invention que ce parcours doit éviter plus que
   tout autre, puisque son programme a été retiré.

   L'ordre suit le poids : l'épreuve professionnelle et la note administrative
   pèsent chacune coefficient 6, l'oral 8, et l'analyse financière vaut cinq
   points de l'épreuve n° 2.
*/
const ROTATION_DGFIP_AP = [
  'option-metier', // dimanche
  'environnement-et-politiques-publiques', // lundi
  'analyse-financiere', // mardi
  'entretien-avec-le-jury', // mercredi
  // jeudi, vendredi, samedi : rien de proposé, et l'écran l'annonce.
];

/* ══════════════════════════════════════════════════════════════════════════
   La racine commune
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le sous-dossier de `content/` qui porte les fiches servies à plusieurs
 * parcours.
 *
 * Nommé ici et lu partout ailleurs : écrit en dur dans le chargeur de contenu
 * et dans deux essais, il aurait fini par différer de l'un à l'autre, et une
 * fiche partagée aurait cessé de l'être sans qu'aucune ligne ne rougisse.
 */
export const RACINE_COMMUNE = 'commun';

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
    /*
       L'INSP ne partage rien, et ce n'est pas un oubli : ses 262 fiches sont à
       la racine de `content/`, donc TOUT y serait partagé si on l'y inscrivait.
       Voir l'en-tête du module sur la raison pour laquelle cette racine reste
       `''`.
    */
    racinesPartagees: [],
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
    racinesPartagees: [RACINE_COMMUNE],
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
    racinesPartagees: [RACINE_COMMUNE],
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
    racinesPartagees: [RACINE_COMMUNE],
    referentiel: {
      origine: 'officiel',
      source:
        'Arrêté du 2 mars 2011 (NOR BCRE1104996A, JORF n° 0055 du 6 mars 2011, ' +
        'JORFTEXT000023662346), article 1er, version du 22/12/2025 ; aucun programme annexé ' +
        'depuis le 24/06/2015, date d’abrogation de l’article 3 qui le renvoyait à l’annexe — ' +
        'lu au 25 octobre 2026 ; relevé dans docs/cyclades/programmes-dgfip.md',
      verifieLe: '2026-10-25',
    },
    themes: THEMES_DGFIP_AP,
    rotationParDefaut: ROTATION_DGFIP_AP,
    /*
       LA DATE A ÉTÉ FAUSSE ICI, ET DANS LE SENS QUI TROMPE LE PLUS.

       Cet avertissement a d'abord dit que le programme avait été abrogé le
       6 septembre 2025. L'abrogation de cette date est réelle, mais elle ne
       portait pas sur un programme : l'annexe ne contenait plus, depuis juin
       2015, qu'un modèle de dossier de présentation pour un oral qui a lui-même
       disparu. Le programme, lui, a quitté l'annexe le 24 juin 2015, le jour où
       l'article 3 qui l'y renvoyait a été abrogé.

       L'écart n'est pas une nuance de calendrier. « Supprimé il y a sept
       semaines » envoie chercher un support de l'an dernier qui l'aurait
       contenu ; « absent depuis onze ans » dit qu'il n'y en a aucun à trouver.
       Vérifié sur les XML DILA : trois versions de l'annexe, et la dernière ne
       porte ni option ni notion.
    */
    avertissementDuProgramme:
      'Ce concours n’a aucun programme annexé depuis le 24 juin 2015 : c’est la date à ' +
      'laquelle l’article 3, qui renvoyait le programme à l’annexe, a été abrogé et le ' +
      'programme retiré de celle-ci. L’annexe abrogée en 2025 ne contenait plus qu’un ' +
      'modèle de dossier de présentation. Et l’épreuve n° 1, la note administrative, n’a ' +
      'jamais eu de programme dans aucune version : celui de 2011 à 2015 ne portait que sur ' +
      'les options de l’épreuve n° 2. Chercher « le programme de l’IPFiP » ne mène donc à ' +
      'aucun texte en vigueur. Les quatre thèmes ci-dessous viennent du seul article 1er de ' +
      'l’arrêté, dans sa version du 22 décembre 2025, qui délimite encore les épreuves. Ce ' +
      'sont donc des épreuves et des métiers, et non un programme de connaissances : trois ' +
      'jours de la semaine restent sans proposition, parce que l’arrêté n’en délimite que ' +
      'quatre. Les deux examens professionnels ouverts aux inspecteurs n’ont, eux, qu’un oral.',
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   De quelle racine vient une fiche, et à qui elle est servie
   ══════════════════════════════════════════════════════════════════════════ */

/** Les racines qu'un parcours sert : la sienne, puis celles qu'il partage. */
export const racinesDuParcours = (p: Parcours): string[] => [
  p.racineContenu,
  ...p.racinesPartagees,
];

/** Les racines déclarées, la racine vide exclue, du plus long nom au plus court. */
export const racinesDeclarees = (): string[] =>
  [...new Set(PARCOURS.flatMap(racinesDuParcours).filter((r) => r !== ''))].sort(
    (a, b) => b.length - a.length,
  );

/**
 * La racine de contenu d'un chemin relatif à `content/`.
 *
 * ## Le plus long préfixe : ce qu'il protège vraiment
 *
 * Le commentaire d'origine disait : « si un parcours s'appelait `dgfip` et un
 * autre `dgfip-a`, le plus court capterait les fiches du second ». C'est FAUX,
 * et le sabotage l'a montré — la comparaison porte sur `«racine»/`, donc
 * `dgfip-ap/x.md` ne commence pas par `dgfip-a/`, et l'ordre n'y change rien.
 * Un constat d'essai affirmait la règle et restait vert avec le tri inversé.
 *
 * Ce que l'ordre protège réellement, c'est le cas des racines IMBRIQUÉES :
 * `commun` et `commun/organisation`, où un chemin commence par les deux. Le
 * cas ne se présente pas aujourd'hui, et il est désormais éprouvé — d'où le
 * paramètre `racines`, qui n'existe que pour cela.
 *
 * La racine vide — celle de l'INSP — est le repli, et elle n'est pas comparée
 * par préfixe : tout chemin commence par `''`, donc la tester reviendrait à
 * capter toutes les fiches.
 */
export function racineDuChemin(relatif: string, racines = racinesDeclarees()): string {
  const normalise = relatif.split('\\').join('/');
  for (const racine of [...racines].sort((a, b) => b.length - a.length)) {
    if (normalise.startsWith(`${racine}/`)) return racine;
  }
  return '';
}

/**
 * Les parcours servis par une racine de contenu.
 *
 * Rend **plusieurs** identifiants pour une racine partagée, et c'est tout
 * l'objet : une fiche de `commun/` appartient aux trois parcours DGFiP, et
 * lui attribuer un parcours unique serait écrire un faux. L'ordre est celui du
 * registre, pour que deux appels rendent la même liste.
 */
export const parcoursServisParLaRacine = (racine: string): string[] =>
  PARCOURS.filter((p) => racinesDuParcours(p).includes(racine)).map((p) => p.id);

/**
 * Les parcours servis par une fiche, d'après l'endroit où elle est rangée.
 *
 * Le chemin est relatif à `content/`, comme celui que `idStable` hache — et
 * c'est la même chaîne, ce qui garantit qu'une fiche partagée a UN identifiant
 * pour les trois parcours sans qu'`idStable` ait à connaître les parcours.
 */
export const parcoursDuChemin = (relatif: string): string[] =>
  parcoursServisParLaRacine(racineDuChemin(relatif));

/**
 * Une racine est-elle partagée entre plusieurs parcours ?
 *
 * Lu dans le registre et non dans une liste à part : le jour où un quatrième
 * parcours déclare `commun`, la réponse suit sans qu'une ligne soit à écrire.
 */
export const racineEstPartagee = (racine: string): boolean =>
  parcoursServisParLaRacine(racine).length > 1;

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
      p.avertissementDuProgramme ??
      `Le programme de ${p.libelle} ne donne aucun thème de planification, et la raison n’est pas déclarée. C’est un défaut du registre, non un état de ce concours.`
    );
  }
  return `Le programme de ${p.libelle} n’est pas encore établi sur source officielle. La planification s’ouvrira quand il le sera : un programme inventé ferait réviser à côté du sujet.`;
}
