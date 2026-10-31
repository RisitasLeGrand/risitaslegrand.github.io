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
import type { CleDeContexte } from './registre-usages';

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

/**
 * Un lecteur réel du champ : le fichier qui lit la valeur, et ce que la
 * personne en voit.
 *
 * ## Pourquoi une déclaration, et non un calcul
 *
 * La portée, elle, se calculait — et c'est précisément ce qui a mal tourné.
 * L'écran affichait « Utilisé par : Révisions, Odyssée » en interrogeant une
 * portée que **personne ne consultait** : `pourBranche` n'avait aucun
 * appelant. Une liste juste au sens du code et fausse au sens de la personne.
 *
 * Un lecteur ne se déduit pas d'un type : il se déduit d'un appel, quelque
 * part, dans un fichier. On le déclare donc, et `essais-lu-par.mts` confronte
 * la déclaration au code **dans les deux sens** — un lecteur déclaré qui ne
 * lit pas, ou une lecture non déclarée, font rougir l'essai. C'est la seule
 * forme de promesse qu'on sache tenir : celle qu'un essai casse quand elle
 * cesse d'être vraie.
 */
export interface LecteurDeChamp {
  /** Le fichier qui lit la valeur, depuis la racine du dépôt. */
  module: string;
  /**
   * Ce que la personne lit sur la ligne « Lu par ». En français, sans jargon,
   * et nommant un écran ou un effet qu'elle peut reconnaître.
   */
  libelle: string;
  /**
   * Vrai quand ce lecteur lit la valeur pour l'**écarter**, non pour s'en
   * servir : l'export pour une IA lit le prénom et le nom afin de les retirer
   * des textes libres.
   *
   * La distinction décide si la question est encore posée. Un champ dont le
   * seul lecteur protège sa valeur ne sert à rien d'autre qu'à lui-même : il
   * cesse d'être demandé, et garde ce qui y est déjà.
   */
  protection?: true;
}

export interface ChampDeclare {
  champ: string;
  libelle: string;
  nature: Nature;
  /** La question telle que l'initialisation la pose. Voir `questions.md`. */
  question: string;
  porteeParDefaut: Portee;
  /** La branche dont ce champ est l'extension, ou rien pour le socle commun. */
  brancheDOrigine?: string;
  /**
   * Le bloc de « Mon profil » où ce champ est montré (P1 du prompt 56).
   *
   * Les champs de branche n'en ont pas : leur bloc est leur branche. Les
   * champs du socle en ont **un, obligatoirement** — le contrôle le vérifie —
   * parce que l'écran les affichait par ordre alphabétique, socle et branches
   * mêlés, sur neuf écrans de long. Un champ ajouté sans groupe se verrait
   * tout de suite, au lieu d'atterrir au hasard de son initiale.
   */
  groupe?: 'vous' | 'journee' | 'objectifs';
  /*
     IL N'Y A PLUS DE CHAMP OBLIGATOIRE, ET C'EST POURQUOI « obligatoire »
     N'EXISTE PLUS ICI.

     Le prénom l'était, seul, et le contrôle vérifiait qu'il le restât. D6 du
     prompt 43 le rend facultatif : nommer son prénom est un geste de
     confiance, pas un péage à l'entrée, et le demander avant tout le reste
     inverse l'ordre des choses.

     Le champ est retiré du type plutôt que mis à « false » partout : ainsi
     « obligatoire: true » ne compile plus. Un contrôle au lancement se serait
     contenté de crier après coup ; le compilateur, lui, refuse d'avance.

     Rien n'exigeait le prénom en pratique. L'initialisation ne le vérifiait
     nulle part, et `prenom()` rend déjà `null` quand il manque — le menu
     salue alors par « Bonjour. ». La seule conséquence visible était une
     phrase du profil, « Le prénom est la seule réponse attendue. », qui est
     partie avec l'obligation.
  */
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
  /**
   * Ce champ **ne sort jamais** : ni dans l'export pour une IA, ni dans le
   * prompt de « Demander à l'IA », quelle que soit la case cochée.
   *
   * POURQUOI LE DRAPEAU EST ICI, et non dans l'export. L'export ne peut pas
   * nommer les trois champs de naissance : l'essai sur le graphe d'imports
   * l'interdit à tout fichier hors de cette courte liste, et c'est cette
   * interdiction qui rend vraie la promesse « pas de lecture silencieuse ».
   * Un export qui les nommerait pour les exclure serait indistinguable, pour
   * ce contrôle, d'un export qui les nomme pour les lire. Le drapeau se
   * déclare donc au catalogue, et l'export ne connaît qu'une liste de noms
   * qu'il n'a pas écrite.
   *
   * POURQUOI UN DRAPEAU ET NON UNE PORTÉE VIDE. `porteeParDefaut: []`
   * empêche une BRANCHE de lire le champ ; il n'empêche rien à la sortie,
   * et les cinq champs concernés l'ont déjà sans que cela ait suffi —
   * l'année de naissance sortait quand la case « Profil » était cochée,
   * alors que le registre des usages promettait « L'année n'y figure
   * jamais ». Deux questions différentes, deux déclarations.
   */
  jamaisExporte?: boolean;
  /**
   * Qui lit ce champ, aujourd'hui, dans le code.
   *
   * Absent — et non pas vide — quand rien ne le lit : l'écran n'affiche alors
   * aucune ligne « Lu par », et la question n'est plus posée (décision 2 du
   * prompt 56). Déclarer un lecteur suffit à la reposer : il n'y a pas de
   * seconde liste à tenir à jour, et c'est tout l'intérêt.
   */
  luPar?: readonly LecteurDeChamp[];
  /**
   * Ce que ses clés — ou ses entrées — **nomment**.
   *
   * `concours` porte des identifiants de parcours, `tempsParDomaine` des
   * identifiants de domaine. L'écran a besoin de le savoir pour dire « INSP »
   * plutôt que `insp`, et c'est une propriété du champ, pas de l'écran.
   *
   * ET C'EST POURQUOI C'EST ICI. Un module d'affichage qui porterait la liste
   * « ces champs-là nomment des parcours » nommerait des champs — ce que le
   * contrôle du graphe d'imports interdit à tout fichier hors de six, parce
   * que nommer `naissanceAnnee` est le premier geste de qui contourne la porte
   * de l'âge. La règle a attrapé ma première version : elle a eu raison.
   */
  clefs?: 'parcours' | 'domaines';
  /**
   * Les clés du **registre des usages** que ce champ alimente.
   *
   * ## Pourquoi ces champs-là ne déclarent pas leurs lecteurs ici
   *
   * L'âge a déjà une table de lecteurs déclarés, et elle est ailleurs :
   * `registre-usages.ts` nomme chaque usage, ce qu'il lit, à quoi il sert et
   * ce qu'il fait quand il ne sait pas. C'est l'écran « Qui utilise mon âge ».
   * En écrire une seconde ici ferait deux vérités du même fait, et la seconde
   * finirait par mentir — exactement ce que la ligne « Lu par » est censée
   * empêcher.
   *
   * Ce champ ne déclare donc que les **clés** qu'il alimente, et la ligne est
   * dérivée du registre. Le registre appartient à qui construit le cycle : ce
   * fichier ne le modifie pas, et l'arbitrage du pilote est explicite — l'âge,
   * le sexe et le cycle viennent du registre, tout le reste de `luPar`.
   *
   * Le contrôle ci-dessous refuse un champ déclaré aux deux endroits.
   */
  clesDuRegistre?: readonly CleDeContexte[];
  /**
   * Son nombre ne se groupe pas : c'est une année, pas une quantité.
   *
   * « 1990 », jamais « 1 990 ». `Intl` groupe par défaut, et le défaut est
   * juste partout ailleurs.
   */
  sansGroupement?: true;
  /**
   * L'unité, telle que la phrase de « Mon profil » la porte — au singulier et
   * au pluriel, parce que « séance » s'accorde et « h » non.
   *
   * Distincte de l'unité des bornes (`BORNES` dans `initialisation.ts`), qui
   * est celle du curseur : « 10 h » sous le pouce, « 10 h par semaine » dans
   * la phrase. Un essai vérifie que les deux ne se contredisent pas.
   */
  unite?: { un: string; plusieurs: string };
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
    groupe: 'vous',
    luPar: [
      { module: 'src/lib/profil.ts', libelle: 'la salutation du menu' },
      {
        module: 'src/lib/export-ia.ts',
        libelle: 'un export pour une IA, pour en retirer votre prénom',
        protection: true,
      },
    ],
    jamaisExporte: true,
    libelle: 'Prénom',
    nature: 'texte',
    question: 'Comment doit-on vous appeler ?',
    // Le menu salue par le prénom ; aucune branche n'a besoin de le lire.
    porteeParDefaut: [],
    /* P12 : « qui se coupe d'un réglage » est parti avec le réglage, qui
       n'existe pas. Aucun catalogue n'en porte, et `index.astro` salue sans
       rien vérifier. */
    regle: 'La salutation du menu.',
  }),
  C({
    champ: 'nom',
    groupe: 'vous',
    luPar: [
      {
        module: 'src/lib/export-ia.ts',
        libelle: 'un export pour une IA, pour en retirer votre nom',
        protection: true,
      },
    ],
    jamaisExporte: true,
    libelle: 'Nom',
    nature: 'texte',
    question: 'Et votre nom, si vous voulez le donner ?',
    porteeParDefaut: [],
  }),
  C({
    champ: 'naissanceAnnee',
    groupe: 'vous',
    sansGroupement: true,
    clesDuRegistre: ['tranche_age', 'majeur'],
    jamaisExporte: true,
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
    groupe: 'vous',
    sansGroupement: true,
    /* Le mois ne sert qu'à lever l'incertitude d'un an : il alimente les mêmes
       clés que l'année, et seulement à la frontière d'un seuil. */
    clesDuRegistre: ['tranche_age', 'majeur'],
    jamaisExporte: true,
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
    groupe: 'vous',
    clesDuRegistre: ['majeur'],
    jamaisExporte: true,
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
    champ: 'usagesCoupes',
    groupe: 'vous',
    luPar: [
      {
        module: 'src/pages/qui-utilise-mon-age.astro',
        libelle: 'l’écran Qui utilise mon âge, qui coupe les usages que vous refusez',
      },
      {
        /*
           La portée du suivi personnel lit cette liste pour savoir si l'usage
           `suivi.statistiques-majeur` est coupé. Elle n'était pas déclarée :
           `essais:lu-par` l'a dit à la fusion du train, et il a raison — ce
           registre est ce qu'une personne lit pour savoir QUI lit ses champs,
           et un lecteur non déclaré y fait un trou muet.
        */
        module: 'src/lib/odyssee/portee-du-suivi.ts',
        libelle: 'la portée du suivi personnel, qui respecte l’usage que vous avez coupé',
      },
    ],
    /* Décision 6 : « et mon sexe » quitte le titre, le libellé et la
       question. Le sexe ne se déclare nulle part dans Cyclades — il viendra
       d'Odyssée > Corps, sous le coffre —, et l'annoncer ici laissait croire
       à un champ qui n'existe pas (G9). */
    libelle: 'Usages de mon âge que j’ai coupés',
    nature: 'liste',
    question: 'Quels usages de votre âge souhaitez-vous couper ?',
    porteeParDefaut: [],
    demandeAuBesoin:
      'Depuis « Qui utilise mon âge », dans Mon profil. La question ne se ' +
      'pose pas à l’initialisation : couper un usage demande d’abord de voir lesquels ' +
      'existent.',
    /*
       LA PHRASE DISAIT PLUS QUE CE QUE LE CODE FAIT (interdit 2).

       « Un usage coupé ne reçoit plus rien » suppose des consommateurs. Or la
       porte — `contextePersonne` — ne prend pas les coupures en paramètre, et
       aucune fonction ne lit l'âge aujourd'hui : `etatDeLaPersonne` et
       `contextePersonne` n'ont qu'un appelant, l'écran lui-même. La coupure est
       donc appliquée à l'affichage, et à rien d'autre. Signalé au pilote : le
       jour où un consommateur arrivera, il recevra l'âge sans égard pour les
       coupures tant que la porte ne les lira pas.
    */
    regle:
      'Les usages que vous coupez sont montrés comme coupés. Aucune autre fonction ne ' +
      'lit votre âge aujourd’hui.',
  }),
  C({
    champ: 'formalite',
    groupe: 'vous',
    libelle: 'Tutoiement ou vouvoiement',
    nature: 'texte',
    question: 'On se tutoie, ou on se vouvoie ?',
    porteeParDefaut: 'toutes',
    /* Pas de `regle` : rien ne lit ce champ. Il promettait « la façon dont les
       écrans s'adressent à vous », et aucun écran ne la consulte — ils
       vouvoient tous. La promesse revient le jour où un lecteur est déclaré,
       et pas avant (G7, P12). */
  }),
  C({
    /*
       LA QUESTION A CHANGÉ AVEC LA DÉCISION 2 DU 56, et pas par goût.

       Elle était « Français, et heure de Paris : c'est bien ça ? », partagée
       avec le fuseau : un seul écran réglait les deux champs. Rien ne lit la
       langue — Cyclades n'existe qu'en français —, donc elle n'est plus
       demandée, et l'écran ne règle plus que le fuseau. Garder l'ancienne
       phrase aurait laissé « Mon profil » proposer « Français, et heure de
       Paris : c'est bien ça ? » pour modifier la seule langue, ce qui ne se
       comprend pas. Le champ garde sa valeur si elle existe.
    */
    champ: 'langue',
    groupe: 'vous',
    libelle: 'Langue',
    nature: 'texte',
    question: 'Dans quelle langue utilisez-vous Cyclades ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'fuseau',
    groupe: 'journee',
    luPar: [
      {
        module: 'src/lib/noyau/reglages.ts',
        libelle: 'le fuseau dans lequel vos journées sont comptées',
      },
    ],
    libelle: 'Fuseau horaire',
    nature: 'texte',
    /* Sans « Français » : l'écran ne règle plus la langue, et une phrase qui
       annonce un réglage qu'elle ne fait pas est exactement l'interdit 2. */
    question: 'Vos journées sont comptées à l’heure de Paris : c’est bien ça ?',
    porteeParDefaut: 'toutes',
    /* « Le jour logique » est le nom du mécanisme, pas une chose que l'on
       sait lire : la phrase dit la même chose en français (G2). */
    regle: 'Le fuseau dans lequel vos journées sont comptées.',
  }),
  C({
    champ: 'activite',
    groupe: 'vous',
    libelle: 'Ce que vous faites dans la vie',
    nature: 'texte',
    question: 'Qu’est-ce que vous faites dans la vie ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'lever',
    groupe: 'journee',
    luPar: [
      {
        module: 'src/lib/noyau/reglages.ts',
        libelle: 'l’heure à laquelle votre journée change de date',
      },
      { module: 'src/lib/odyssee-jour.ts', libelle: 'la fenêtre de la revue (Odyssée)' },
      { module: 'src/lib/parametres/acces.ts', libelle: 'Paramètres, Ma journée' },
      {
        module: 'src/layouts/Base.astro',
        libelle: 'la bascule entre le thème clair et le thème sombre',
      },
    ],
    libelle: 'Heure de lever',
    nature: 'heure',
    question: 'À quelle heure vous levez-vous, d’habitude ?',
    porteeParDefaut: 'toutes',
    /*
       M4 DU 56 : LA PHRASE ÉTAIT FAUSSE, et d'une façon qui se vérifie.

       Elle disait que la journée change de date à l'heure du lever. Le code
       dit autre chose : `basculeDuJour` prend l'heure du lever MOINS UNE, et
       la borne entre 2 h et 6 h. Quelqu'un qui se lève à 11 h voyait donc sa
       journée changer à 6 h, et non à 11 h — et la phrase lui laissait croire
       le contraire, ce qui est exactement le genre de réglage qu'on rechange
       au hasard.
    */
    regle:
      'Votre journée change de date une heure avant votre lever, entre 2 h et 6 h : ' +
      'une séance finie à minuit trente compte pour la soirée écoulée.',
  }),
  C({
    /*
       Le moment de la revue : 'matin' ou 'soir'.
       
       Un champ de profil et non un réglage caché, parce que c'est une
       préférence qui change ce que la revue DEMANDE — le matin, elle porte
       sur la veille — et non sa seule apparence. Nature « texte » faute de
       nature « choix » au catalogue ; la lecture refuse toute autre valeur
       que les deux attendues, de sorte qu'une saisie libre ne peut pas
       produire un troisième comportement.
    */
    champ: 'moment-revue',
    groupe: 'journee',
    /*
       LE NOM, APRÈS LA DÉCISION 4 DU 56.

       « Moment de ma revue » et « Moment de révision préféré » se
       ressemblaient assez pour qu'on les prenne l'un pour l'autre, et
       Alexis a tranché : les garder séparés, mieux nommés. Celui-ci dit
       désormais la branche dont il vient, et la question dit ce que le
       choix change — le jour sur lequel la revue porte, et non l'heure à
       laquelle elle est proposée.
    */
    luPar: [
      {
        module: 'src/lib/odyssee-jour.ts',
        libelle: 'le moment où la revue d’Odyssée vous est proposée',
      },
      {
        module: 'src/pages/odyssee/revue.astro',
        libelle: 'la revue, qui porte sur la veille le matin et sur la journée le soir',
      },
      { module: 'src/lib/parametres/acces.ts', libelle: 'Paramètres, Ma journée' },
    ],
    libelle: 'Moment de ma revue (Odyssée)',
    nature: 'texte',
    question: 'Faites-vous votre revue le matin, sur la veille, ou le soir, sur la journée ?',
    porteeParDefaut: 'toutes',
    regle:
      'Le jour sur lequel votre revue porte : la veille si vous la faites le matin, ' +
      'la journée en cours si vous la faites le soir.',
  }),
  C({
    champ: 'coucher',
    groupe: 'journee',
    luPar: [
      {
        module: 'src/lib/noyau/adaptation.ts',
        libelle: 'la règle qui remarque un coucher dépassé',
      },
      { module: 'src/lib/odyssee-jour.ts', libelle: 'la fenêtre de la revue (Odyssée)' },
      { module: 'src/lib/parametres/acces.ts', libelle: 'Paramètres, Ma journée' },
      {
        module: 'src/layouts/Base.astro',
        libelle: 'la bascule entre le thème clair et le thème sombre',
      },
    ],
    libelle: 'Heure de coucher',
    nature: 'heure',
    question: 'Et vous couchez-vous ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'joursTravail',
    groupe: 'journee',
    libelle: 'Jours de travail',
    nature: 'liste',
    question: 'Quels jours travaillez-vous ?',
    porteeParDefaut: 'toutes',
    /* Pas de `regle` : le réglage déduit « jours de repos » en découle, et rien
       ne l'applique — la rotation ne lit pas ce champ, et la série non plus
       (constat B2). La phrase promettait les deux. */
  }),
  C({
    champ: 'plagesTravail',
    groupe: 'journee',
    libelle: 'Plages de travail',
    nature: 'liste',
    question: 'Sur quelles plages ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'objectifsAnnee',
    groupe: 'objectifs',
    libelle: 'Objectifs de l’année',
    nature: 'liste',
    question: 'Qu’est-ce que vous voulez obtenir cette année ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'objectifsVie',
    groupe: 'objectifs',
    libelle: 'Objectifs de long terme',
    nature: 'liste',
    question: 'Et à plus long terme ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'tempsParSemaine',
    groupe: 'objectifs',
    unite: { un: 'h par semaine', plusieurs: 'h par semaine' },
    luPar: [
      {
        module: 'src/lib/noyau/adaptation.ts',
        libelle: 'la proposition qui compare ce temps à vos séances réelles',
      },
    ],
    libelle: 'Temps disponible par semaine',
    nature: 'nombre',
    question: 'Combien de temps pouvez-vous y consacrer par semaine ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'domainesActifs',
    groupe: 'objectifs',
    clefs: 'domaines',
    luPar: [
      {
        module: 'src/lib/odyssee-jour.ts',
        libelle: 'les domaines affichés dans la roue et au menu',
      },
      {
        module: 'src/lib/noyau/reglages.ts',
        libelle: 'les domaines affichés dans la roue et au menu',
      },
      {
        module: 'src/lib/noyau/adaptation.ts',
        libelle: 'la proposition qui compare vos domaines à ceux que vous suivez vraiment',
      },
    ],
    libelle: 'Domaines suivis',
    nature: 'liste',
    question: 'Lesquels de ces domaines voulez-vous suivre ?',
    porteeParDefaut: 'toutes',
    regle: 'Les domaines affichés dans la roue d’équilibre et au menu.',
  }),
  C({
    champ: 'tempsParDomaine',
    groupe: 'objectifs',
    clefs: 'domaines',
    unite: { un: 'h', plusieurs: 'h' },
    libelle: 'Temps par domaine',
    nature: 'repartition',
    question: 'Combien de temps par semaine pour chacun ?',
    porteeParDefaut: 'toutes',
  }),
  C({
    champ: 'styleAccompagnement',
    groupe: 'objectifs',
    libelle: 'Style d’accompagnement',
    nature: 'texte',
    question: 'Comment Cyclades doit-il vous accompagner ?',
    porteeParDefaut: 'toutes',
    /* Pas de `regle` : les avis locaux ne lisent pas ce champ (B2). */
  }),

  /* --- Extension : Révisions ---------------------------------------------- */
  C({
    champ: 'concours',
    clefs: 'parcours',
    libelle: 'Concours préparés',
    nature: 'liste',
    question: 'Quel concours préparez-vous ?',
    porteeParDefaut: ['revisions', 'odyssee'],
    brancheDOrigine: 'revisions',
    /* Pas de `regle` : le registre n'ouvre pas les parcours d'après ce champ —
       le parcours courant se choisit dans Révisions (B2). */
  }),
  C({
    champ: 'datesEpreuves',
    clefs: 'parcours',
    libelle: 'Dates d’épreuves',
    nature: 'repartition',
    question: 'Quand sont les épreuves ?',
    porteeParDefaut: ['revisions', 'odyssee'],
    brancheDOrigine: 'revisions',
    /* La décision 3 rend ce champ utile : sans elle, rien ne le lisait et il
       tombait dans « plus demandé » comme les vingt-deux autres. Le compte à
       rebours le lit, donc Cyclades le redemande — c'est le même `aUnUsage`
       qui décide des deux, et c'est pour cela qu'ils ne peuvent pas diverger. */
    luPar: [
      {
        module: 'src/pages/revisions/index.astro',
        libelle: 'le compte à rebours de l’accueil de Révisions',
      },
    ],
    regle: 'Le compte à rebours de l’accueil de Révisions, qu’un réglage coupe.',
  }),
  C({
    champ: 'heuresRevision',
    unite: { un: 'h par semaine', plusieurs: 'h par semaine' },
    luPar: [
      {
        module: 'src/lib/noyau/adaptation.ts',
        libelle: 'la proposition qui compare ces heures à vos séances réelles',
      },
    ],
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
    luPar: [
      {
        module: 'src/lib/noyau/adaptation.ts',
        libelle: 'la proposition qui compare ce moment à l’heure de vos séances',
      },
    ],
    /* Décision 4 : séparé de « Moment de ma revue », et nommé pour qu'on ne
       les confonde plus. Celui-ci ne décide de rien dans la revue : il dit
       quand vous préférez réviser, et l'adaptation le compare au réel. */
    libelle: 'Heure préférée pour réviser',
    nature: 'texte',
    question: 'Préférez-vous réviser le matin ou le soir ?',
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
    unite: { un: 'séance par semaine', plusieurs: 'séances par semaine' },
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
    clefs: 'domaines',
    unite: { un: 'h', plusieurs: 'h' },
    luPar: [
      { module: 'src/lib/odyssee-jour.ts', libelle: 'la roue d’équilibre d’Odyssée' },
    ],
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
    /* Pas de `regle` : aucun avis n'est posé à cette heure (B2). */
  }),
];

const PAR_CHAMP = new Map(CHAMPS.map((c) => [c.champ, c]));

export const champDeclare = (champ: string): ChampDeclare | undefined => PAR_CHAMP.get(champ);

/**
 * Les champs de profil qui ne sortent jamais du site.
 *
 * Déduite du catalogue, et non recopiée : un champ nouveau marqué
 * `jamaisExporte` est exclu sans qu'aucun autre fichier ait à être touché,
 * et un champ qui perdrait le drapeau le perdrait visiblement, dans la
 * déclaration elle-même.
 */
export const CHAMPS_JAMAIS_EXPORTES: readonly string[] = CHAMPS.filter(
  (c) => c.jamaisExporte === true,
).map((c) => c.champ);

/**
 * Les champs que l'export doit **retirer des textes libres**.
 *
 * Déduite des lecteurs marqués `protection`, et non recopiée dans l'export.
 * La raison est la même que pour `CHAMPS_JAMAIS_EXPORTES` : l'export ne doit
 * pas nommer les champs qu'il protège, sans quoi la liste vivrait à deux
 * endroits et l'essai ne pourrait plus dire si le module lit ce nom pour
 * s'en servir ou pour l'écarter.
 */
export const CHAMPS_A_CAVIARDER: readonly string[] = CHAMPS.filter((c) =>
  c.luPar?.some((l) => l.protection === true),
).map((c) => c.champ);

/**
 * Le champ sert-il à quelque chose d'autre qu'à se protéger lui-même ?
 *
 * C'est le critère de la décision 2 : un champ que rien ne lit n'est plus
 * demandé. « Rien ne lit » se dit ici une fois, et les deux conséquences —
 * la question qu'on ne pose plus, la ligne « Lu par » qui n'apparaît pas —
 * en découlent au lieu d'être tenues à part.
 */
export const aUnUsage = (c: ChampDeclare): boolean =>
  (c.luPar ?? []).some((l) => l.protection !== true) || (c.clesDuRegistre ?? []).length > 0;

/**
 * Les champs qui ne sont plus demandés, faute de lecteur.
 *
 * Ils ne sont **pas** effacés, ni cachés : leur valeur reste, visible et
 * modifiable, avec la mention qui dit qu'elle est gardée pour plus tard
 * (interdit 1 du prompt 56). Cette liste sert à l'écran, qui porte la
 * mention, et à l'essai, qui vérifie qu'elle n'est pas devenue fausse.
 */
export const CHAMPS_PLUS_DEMANDES: readonly string[] = CHAMPS.filter(
  (c) => !aUnUsage(c) && !c.demandeAuBesoin,
).map((c) => c.champ);

/*
   CE QUE L'ÉCRAN AFFICHE APRÈS « LU PAR », et pourquoi ce n'est pas ici.

   Il y a deux sources — cette table, et le registre des usages pour l'âge —,
   et les réunir demande de lire le registre. Le catalogue n'a pas à en
   dépendre à l'exécution : la réunion se fait dans `lib/profil-lecteurs.ts`,
   qui ne nomme aucun champ et peut donc vivre hors des six fichiers autorisés
   à nommer ceux de naissance.
*/

/**
 * Les champs qui relèvent de la case « Objectifs » et non de la case
 * « Profil ».
 *
 * Déclarés ici, avec les champs eux-mêmes, et non dans l'export : c'est une
 * propriété du champ, pas une propriété de l'écran qui l'exporte.
 */
export const CHAMPS_OBJECTIF: readonly string[] = [
  'objectifsAnnee',
  'objectifsVie',
  'tempsParSemaine',
  'tempsParDomaine',
  'heuresRevision',
  'ciblesEquilibre',
  'datesEpreuves',
];

/**
 * Qui va où, dans un export : la règle, sans base de données.
 *
 * Fonction pure, et c'est tout l'intérêt — la règle qui décide ce qui sort
 * se lit et s'éprouve sans navigateur, sans coffre et sans profil réel. Le
 * module d'export ne fait plus que lui passer ce qu'il a lu.
 *
 * Trois sorts, dans cet ordre, et l'ordre compte :
 *
 * 1. un champ marqué `jamaisExporte` ne sort pas, **quelles que soient les
 *    cases cochées** — c'est le sens de « jamais » ;
 * 2. un champ d'objectif sort si, et seulement si, « objectifs » est coché ;
 * 3. tout le reste sort si « profil » est coché.
 *
 * Mettre l'interdiction en premier n'est pas une élégance : si un champ
 * marqué `jamaisExporte` figurait aussi parmi les objectifs, l'ordre
 * inverse le ferait sortir.
 */
export function repartirProfilPourExport(
  champs: Iterable<readonly [string, unknown]>,
  categories: readonly string[],
): { profil: Record<string, unknown>; objectifs: Record<string, unknown> } {
  const profil: Record<string, unknown> = {};
  const objectifs: Record<string, unknown> = {};
  for (const [nom, valeur] of champs) {
    if (CHAMPS_JAMAIS_EXPORTES.includes(nom)) continue;
    if (CHAMPS_OBJECTIF.includes(nom)) {
      if (categories.includes('objectifs')) objectifs[nom] = valeur;
      continue;
    }
    if (categories.includes('profil')) profil[nom] = valeur;
  }
  return { profil, objectifs };
}

/** Les champs du socle commun, dans l'ordre de l'initialisation. */
export const champsDuSocle = (): ChampDeclare[] => CHAMPS.filter((c) => !c.brancheDOrigine);

/**
 * Les champs du socle **que l'on pose en question**, c'est-à-dire tous sauf
 * ceux qui se demandent au moment du besoin.
 *
 * La distinction a l'air d'un détail et ne l'est pas. `avancement()` affiche
 * « deux réponses sur N » : si N comptait les champs jamais posés, il
 * annoncerait un dénominateur que la personne **ne peut pas atteindre**, et
 * l'initialisation semblerait inachevée pour toujours. Nommer les deux
 * ensembles vaut mieux que filtrer au cas par cas chez les appelants, où le
 * jour vient toujours où l'un d'eux oublie.
 */
export const questionsDuSocle = (): ChampDeclare[] =>
  champsDuSocle().filter((c) => !c.demandeAuBesoin && aUnUsage(c));

/** Les champs qu'une branche pose à sa première ouverture. */
export const champsDeBranche = (branche: string): ChampDeclare[] =>
  CHAMPS.filter((c) => c.brancheDOrigine === branche);

/**
 * Les champs d'une branche **que l'on pose en question**.
 *
 * Même distinction que pour le socle, et deux filtres au lieu d'un :
 * `demandeAuBesoin` écarte ce qui se demande au moment de l'usage, et
 * `aUnUsage` ce que rien ne lit. `champsDeBranche` garde, lui, la liste
 * entière — c'est celle dont l'écran a besoin pour offrir « Renseigner » sur
 * un champ vide (B5).
 */
export const questionsDeBranche = (branche: string): ChampDeclare[] =>
  champsDeBranche(branche).filter((c) => !c.demandeAuBesoin && aUnUsage(c));

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
  /** Les champs du socle qui restent à poser, dans l'ordre des questions. */
  restants: ChampDeclare[];
  initialisation: Initialisation | null;
}

export function avancement(operations: readonly Operation[]): Avancement {
  const profil = lireProfil(operations);
  const socle = questionsDuSocle();
  const restants = socle.filter((c) => !profil.has(c.champ));
  return {
    repondus: socle.length - restants.length,
    total: socle.length,
    restants,
    initialisation: lireInitialisation(operations),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Qui lit quoi
   ══════════════════════════════════════════════════════════════════════════ */

export const porteeInclut = (portee: Portee, branche: string): boolean =>
  portee === 'toutes' ? true : portee.includes(branche);

/* ══════════════════════════════════════════════════════════════════════════
   LES DEUX NON-RÉPONSES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * « Je ne sais pas. »
 *
 * Une valeur, pas une absence — et le registre des usages emploie déjà ce mot
 * dans ce sens exact : « `'inconnu'` est une valeur, pas une absence, et les
 * deux ne veulent pas dire la même chose — "tu n'as pas le droit de savoir" et
 * "personne ne sait" ». C'est le second sens ici.
 *
 * À ne pas confondre avec `'inconnue'`, au féminin, qui est une RÉPONSE parmi
 * les options de la phase sportive. Une lettre les sépare, et elles n'ont pas
 * le même statut : celle-là se lit, celle-ci jamais.
 */
export const NON_REPONSE_INCONNU = 'inconnu';

/**
 * « Je préfère ne pas répondre. »
 *
 * Le même mot que `odyssee/sexe.ts`, et pour la même raison : la question a
 * été vue, et la personne a refusé. Ce refus se garde — sans quoi on le
 * reposerait — et ne se lit jamais comme une réponse. L'essai du sexe le dit
 * déjà de son côté : « un refus de répondre ne devient pas une réponse ».
 */
export const NON_REPONSE_REFUS = 'sans-reponse';

/**
 * Cette valeur est-elle une non-réponse ?
 *
 * Les deux non-réponses sont STOCKÉES, et c'est volontaire. Les effacer
 * reviendrait à ne rien savoir de la question : « Mon profil » ne pourrait
 * plus montrer qu'on a refusé, le parcours reposerait la question, et un
 * refus serait indistinguable d'un oubli.
 *
 * Ce qui est interdit, c'est qu'un LECTEUR les prenne pour une réponse. C'est
 * la fonction `champ()` qui l'empêche, et `pourBranche` ici même : le champ
 * est retiré de ce qu'on lit, et non remis à une valeur de repli.
 */
export function estUneNonReponse(valeur: unknown): boolean {
  return valeur === NON_REPONSE_INCONNU || valeur === NON_REPONSE_REFUS;
}

/**
 * Ce qu'un lecteur a le droit de lire d'un champ : la valeur, ou rien.
 *
 * Rend `null` pour une non-réponse, et la valeur telle quelle sinon. C'est la
 * décision que `champ()` applique, sortie ici pour qu'elle se mesure : `champ()`
 * lit la base, donc aucun essai ne peut l'interroger sans navigateur — et un
 * garde qu'aucun essai ne touche finit par tomber sans bruit. Celui-ci est
 * tombé une fois, le temps d'un sabotage, et seul un indice d'import inutile
 * l'a signalé.
 */
export function lisibleParUnLecteur(valeur: ValeurDeChamp | null): ValeurDeChamp | null {
  return valeur && estUneNonReponse(valeur.valeur) ? null : valeur;
}

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
    /* Une non-réponse est retirée, pour la même raison qu'un champ hors
       portée : la rendre apprendrait qu'il y a quelque chose à savoir, et
       une branche qui recevrait « sans-reponse » finirait par le traiter
       comme une valeur. Ce qui n'a pas été répondu n'est pas lisible. */
    if (estUneNonReponse(valeur.valeur)) continue;
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
  /*
     UNE NON-RÉPONSE EST RECEVABLE POUR TOUTE NATURE.

     Elle n'est pas une valeur mal typée : c'est l'absence déclarée d'une
     valeur. Sans cette ligne, « Je préfère ne pas répondre » était refusé par
     « Un nombre est attendu. » sur tout champ qui n'attend pas un texte — et
     l'écran répondait à un refus par un reproche de forme.

     Le défaut ne s'est pas vu en lisant : l'essai de navigateur s'est bloqué
     sur la boîte d'avertissement que le refus déclenchait. Les trois sorties
     doivent valoir pour tous les champs, sinon elles ne valent pour aucun.
  */
  if (estUneNonReponse(valeur)) return { recevable: true };
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
 * Celui qui compte le plus : qu'**aucune portée ne nomme une branche
 * inconnue**, une portée vers une branche qui n'existe pas se lisant comme une
 * restriction alors qu'elle n'en est pas une.
 *
 * Il en vérifiait un autre — qu'un seul champ soit obligatoire, et que ce soit
 * le prénom. Il est parti avec l'obligation elle-même (D6) : plus aucun champ
 * ne l'est, et le type ne permet plus de le déclarer.
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
  for (const c of CHAMPS) {
    if (c.luPar && !c.luPar.length) {
      problemes.push(
        `Le champ « ${c.champ} » déclare une liste de lecteurs vide : il faut l’omettre, ` +
          'pour que « rien ne le lit » se lise d’une seule façon.',
      );
    }
    for (const lecteur of c.luPar ?? []) {
      if (!lecteur.module.startsWith('src/')) {
        problemes.push(`Le lecteur « ${lecteur.module} » du champ « ${c.champ} » n’est pas dans src/.`);
      }
      if (lecteur.libelle.trim().length < 10) {
        problemes.push(`Le lecteur « ${lecteur.module} » du champ « ${c.champ} » n’a pas de libellé lisible.`);
      }
    }
    /*
       JAMAIS LES DEUX SOURCES POUR LE MÊME CHAMP.

       Un champ dont les lecteurs seraient déclarés ici **et** dérivés du
       registre aurait deux listes à tenir d'accord, et c'est l'état que la
       ligne « Lu par » existe pour supprimer. La protection ne compte pas : un
       lecteur qui retire la valeur d'un export n'est pas un usage.
    */
    if (c.clesDuRegistre?.length && (c.luPar ?? []).some((l) => l.protection !== true)) {
      problemes.push(
        `Le champ « ${c.champ} » déclare ses lecteurs au catalogue et les dérive du registre : ` +
          'il faut choisir, sans quoi les deux listes finiront par se contredire.',
      );
    }
    if (c.clesDuRegistre && !c.clesDuRegistre.length) {
      problemes.push(
        `Le champ « ${c.champ} » déclare une liste de clés vide : il faut l’omettre.`,
      );
    }
    const modules = (c.luPar ?? []).map((l) => l.module);
    if (new Set(modules).size !== modules.length) {
      problemes.push(`Le champ « ${c.champ} » déclare deux fois le même lecteur.`);
    }
    if (!c.brancheDOrigine && !c.groupe) {
      problemes.push(
        `Le champ « ${c.champ} » n’est dans aucun bloc de « Mon profil » : il faut le placer.`,
      );
    }
    if (c.brancheDOrigine && c.groupe) {
      problemes.push(
        `Le champ « ${c.champ} » vient d’une branche et déclare pourtant un bloc du socle.`,
      );
    }
    if (c.clefs && c.nature !== 'liste' && c.nature !== 'repartition') {
      problemes.push(
        `Le champ « ${c.champ} » dit ce que ses clés nomment, mais il n’a ni liste ni répartition.`,
      );
    }
    if (c.unite && c.nature !== 'nombre' && c.nature !== 'repartition') {
      problemes.push(`Le champ « ${c.champ} » porte une unité sans porter de nombre.`);
    }
    if (c.unite && (!c.unite.un.trim() || !c.unite.plusieurs.trim())) {
      problemes.push(`Le champ « ${c.champ} » porte une unité vide.`);
    }
    if (c.sansGroupement && c.nature !== 'nombre') {
      problemes.push(`Le champ « ${c.champ} » refuse le groupement sans porter de nombre.`);
    }
    /*
       UNE PROMESSE SUPPOSE UN LECTEUR (P12, interdit 2 du prompt 56).

       `regle` dit à l'écran ce que le champ **règle** dans l'application. Un
       champ que rien ne lit ne règle rien : la phrase était alors une promesse
       que le code ne tenait pas, et quatre champs en portaient une — les jours
       de travail, le style d'accompagnement, les concours et l'heure de
       rappel. Le contrôle rend la faute impossible à rejouer sans le voir.
    */
    if (c.regle && !aUnUsage(c)) {
      problemes.push(
        `Le champ « ${c.champ} » annonce ce qu'il règle, mais rien ne le lit : ` +
          'une promesse sans lecteur est interdite (P12 du prompt 56).',
      );
    }
  }

  return problemes;
}
