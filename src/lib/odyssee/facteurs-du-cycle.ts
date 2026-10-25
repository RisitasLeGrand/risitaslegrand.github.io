/**
 * Les facteurs de la fiche de cycle, et leur rang : observé, non mesuré, non autorisé.
 *
 * ## Ce que la maquette 8.3 impose, et ce que ce module tient
 *
 * Le plan de phase 0 range les facteurs en trois blocs, et il insiste sur un
 * point : « "Non autorisé" et "non mesuré" sont deux lignes distinctes — les
 * confondre laisserait croire qu'un domaine coupé est un domaine vide ». C'est
 * la règle que ce module existe pour tenir.
 *
 * Les trois rangs ne se déduisent pas des données :
 *
 * - **non mesuré** est une propriété du PRODUIT. Cyclades ne sait pas que
 *   quelqu'un s'est déplacé : aucun fait ne le porte, et le § 7 le nomme « un
 *   angle mort à déclarer, pas une lacune à combler en douce ». La réponse est
 *   la même pour une fenêtre pleine et pour une fenêtre vide ;
 * - **non autorisé** est une propriété de la MATRICE de lecture. Elle ne
 *   dépend pas davantage des données : un domaine coupé reste coupé un mois où
 *   rien n'a été saisi ;
 * - **observé** est le seul rang qui regarde la fenêtre.
 *
 * ## Ce que ce module NE fait pas, et pourquoi ce n'est pas un oubli
 *
 * La maquette montre des écarts chiffrés : « Sommeil 5 h 50 · habituel 7 h 10
 * · −1 h 20 ». Ces nombres ne sont pas atteignables ici. La projection des
 * faits rend des `FaitObserve`, qui valent `{ type, jourLogique }` et **ne
 * portent aucune valeur** : elle dit qu'une nuit a été renseignée le 12, pas
 * qu'elle a duré cinq heures cinquante. Lire les durées demanderait un lecteur
 * par domaine, chacun passé par la matrice, et c'est un lot à soi.
 *
 * Ce qui est donc tenu, et qui est vrai : la COUVERTURE — « 22 nuits
 * renseignées sur 31 » —, que le § 7 cite lui-même comme la moitié utile de la
 * phrase. Ce qui manque est nommé à l'écran plutôt que simulé : une fiche qui
 * afficherait un écart qu'elle n'a pas mesuré serait exactement ce que la
 * décision 13 interdit.
 *
 * ## L'ordre imposé, et pourquoi il ne peut pas l'être encore
 *
 * Le § 5.3 impose « classé par écart à vos habitudes ». Un écart demande deux
 * valeurs, que ce module n'a pas : l'ordre est donc la COUVERTURE décroissante,
 * et il est déclaré comme tel. Le dire vaut mieux que de trier sur un nombre
 * approchant en laissant croire à l'ordre demandé.
 */
import type { DomaineNonAutorise } from '../noyau/permissions';
import type { FaitObserve } from './pointage-derive';

/** Ce que Cyclades sait, ou ne sait pas, d'un facteur. */
export type CouvertureDuFacteur =
  /** Un ou plusieurs faits le portent entièrement. */
  | 'complete'
  /** Des faits existent, mais ils ne couvrent qu'une partie de ce que le facteur nomme. */
  | 'partielle'
  /** Aucun fait ne le porte. Cyclades ne le mesure pas. */
  | 'absente';

export interface FacteurDuCycle {
  id: string;
  /** Le nom affiché, au singulier ou au pluriel selon l'usage courant. */
  libelle: string;
  /**
   * Les types de faits qui le renseignent. **Vide quand Cyclades ne le mesure
   * pas** — et c'est alors la seule chose qui distingue « non mesuré » d'un
   * domaine coupé.
   */
  types: readonly string[];
  /**
   * Les domaines à autoriser pour le lire. **Vide quand aucun fait n'existe.**
   *
   * ## Pourquoi une LISTE, et non un domaine
   *
   * Le schéma 5.2 parle d'un `domaine_a_autoriser` au singulier, et j'avais
   * suivi. Mesuré contre le contrat des faits, c'est faux : la charge de
   * révision mêle `revision.seance` (connaissances) et `odyssee.focus`
   * (cognition), et les apports déclarés mêlent `odyssee.poids` (corps) et
   * `odyssee.apport-externe` (connaissances). Un facteur traverse donc les
   * domaines, et un seul suffit à le rendre illisible.
   *
   * La conséquence est dans `classerLesFacteurs` : un facteur dont UN domaine
   * est refusé passe en « non autorisé », et l'écran nomme lequel. Retenir un
   * domaine sur deux aurait affiché une couverture amputée comme si elle était
   * entière.
   */
  domaines: readonly string[];
  couverture: CouvertureDuFacteur;
  /**
   * Ce qui manque, dit à la personne, quand la couverture n'est pas complète.
   *
   * Écrit pour être lu tel quel : la personne n'a pas à deviner ce que
   * « partielle » recouvre.
   */
  reserve?: string;
}

/**
 * Les treize facteurs du § 5.2, confrontés aux faits réels par le § 7.
 *
 * Les couvertures et les réserves ne sont pas des jugements portés ici : elles
 * recopient le tableau du § 7, qui a été établi en parcourant les types
 * déclarés. Les modifier demande de refaire cette confrontation, pas de
 * retoucher cette liste.
 */
export const FACTEURS_DU_CYCLE: readonly FacteurDuCycle[] = [
  {
    id: 'sommeil',
    libelle: 'Sommeil',
    types: ['odyssee.sommeil'],
    domaines: ['corps'],
    couverture: 'complete',
  },
  {
    id: 'horaires-atypiques',
    libelle: 'Horaires atypiques',
    types: [],
    domaines: [],
    couverture: 'partielle',
    reserve:
      'Vos horaires sont déclarés dans votre profil, mais Cyclades n’observe pas vos journées : ' +
      'il ne sait pas si vous avez travaillé de nuit cette fois-ci.',
  },
  {
    /*
       LE FACTEUR 3, ET LE § 7 LE NOMME « UN ANGLE MORT À DÉCLARER ». Aucun
       fait ne porte un lieu : le fuseau est un champ de profil à valeur
       unique, et un événement d'agenda n'a pas de lieu. Il reste dans la liste
       justement pour que l'écran le dise.
    */
    id: 'deplacements',
    libelle: 'Déplacements',
    types: [],
    domaines: [],
    couverture: 'absente',
    reserve: 'Cyclades ne mesure pas vos déplacements ni vos changements de fuseau horaire.',
  },
  {
    id: 'stress-percu',
    libelle: 'Stress et charge perçus',
    types: ['odyssee.checkin', 'odyssee.charge-percue'],
    domaines: ['psyche'],
    couverture: 'complete',
  },
  {
    id: 'charge-de-revision',
    libelle: 'Charge de révision',
    types: ['revision.seance', 'odyssee.focus'],
    domaines: ['connaissances', 'cognition'],
    couverture: 'complete',
  },
  {
    id: 'charge-sport',
    libelle: 'Charge d’entraînement',
    types: ['sport.seance', 'sport.serie', 'sport.phase', 'sport.blessure'],
    domaines: ['corps'],
    couverture: 'complete',
  },
  {
    id: 'poids-et-apports',
    libelle: 'Poids et apports déclarés',
    types: ['odyssee.poids', 'odyssee.repas', 'odyssee.apport-externe'],
    domaines: ['corps', 'connaissances'],
    couverture: 'complete',
    reserve:
      'Cyclades ne calcule aucune disponibilité énergétique : il compte ce que vous avez noté, ' +
      'et rien de plus.',
  },
  {
    id: 'boissons',
    libelle: 'Boissons',
    types: ['odyssee.hydratation'],
    domaines: ['corps'],
    couverture: 'partielle',
    reserve:
      'Les boissons notées sont comptées. Le tabac et l’alcool n’ont pas de saisie dédiée dans ' +
      'Cyclades : ils ne sont donc ni comptés, ni déduits.',
  },
  {
    id: 'medicaments',
    libelle: 'Médicaments et compléments',
    types: ['odyssee.medicament'],
    domaines: ['corps'],
    couverture: 'complete',
    reserve:
      'Les prises que vous avez notées sont comptées. Cyclades ne dit pas si une molécule ' +
      'influence un cycle : cela demanderait une source que personne n’a lue ici.',
  },
  {
    id: 'sante-et-blessures',
    libelle: 'Maladie, symptômes, blessure',
    types: ['odyssee.sante', 'sport.blessure'],
    domaines: ['corps'],
    couverture: 'complete',
  },
  {
    id: 'evenements',
    libelle: 'Événements marquants',
    types: ['odyssee.evenement'],
    domaines: ['ordre'],
    couverture: 'complete',
  },
  {
    id: 'statut-hormonal',
    libelle: 'Stade de vie déclaré',
    types: ['odyssee.statut-hormonal'],
    domaines: ['corps'],
    couverture: 'complete',
    reserve: 'Ce que vous avez déclaré vous-même. Cyclades ne le déduit jamais de vos saisies.',
  },
  {
    /*
       LE FACTEUR 13 RESTE À CRÉER : le § 7 le dit « absent », et il demande
       une saisie dans le journal du cycle qui n'existe pas. Le déclarer ici
       l'affiche comme non mesuré, ce qui est exact — plutôt que de le taire,
       ce qui laisserait croire qu'il a été regardé.
    */
    id: 'contraception-urgence',
    libelle: 'Contraception d’urgence',
    types: [],
    domaines: [],
    couverture: 'absente',
    reserve:
      'Cyclades n’a pas encore de saisie pour cela. Rien n’est donc compté, et rien n’est deviné.',
  },
];

/** Le rang d'un facteur dans la fiche. Trois blocs, et jamais deux confondus. */
export type RangDuFacteur = 'observe' | 'non-mesure' | 'non-autorise';

export interface FacteurClasse {
  facteur: FacteurDuCycle;
  rang: RangDuFacteur;
  /** Les jours du cycle où au moins un de ses types est renseigné. */
  joursRenseignes: number;
  /** Les jours que le cycle compte, pour que « 22 sur 31 » ait son dénominateur. */
  joursDuCycle: number;
  /**
   * Les domaines refusés et leur compte, quand le rang est `non-autorise`.
   *
   * Une liste, parce qu'un facteur traverse les domaines : l'écran doit pouvoir
   * nommer tous ceux qu'il faudrait ouvrir, et non le premier venu.
   */
  refus?: readonly DomaineNonAutorise[];
}

/**
 * La phrase que la décision 13 impose sous chaque facteur observé.
 *
 * Déclarée ici et lue par l'écran : recopiée, elle finirait par différer d'une
 * vue à l'autre, et c'est la phrase qui empêche la fiche de se lire comme une
 * explication. Elle ne dit pas « sans lien » — elle dit que Cyclades n'en
 * établit pas, ce qui n'est pas la même chose.
 */
export const LIEN_NON_ETABLI = 'Mesuré par Cyclades, lien non établi par Cyclades';

/**
 * Le bloc final de la fiche, fixe, imposé par le § 5.3.
 *
 * Fixe veut dire : il s'affiche toujours, même quand tous les facteurs sont
 * observés et qu'aucun n'est refusé. C'est le seul énoncé de la fiche qui parle
 * de ce qu'elle ne contient pas.
 */
export const BLOC_FINAL =
  'D’autres facteurs, mesurés ou non par Cyclades, ont pu intervenir.';

export interface ClassementDesFacteurs {
  /** Observés, couverture décroissante. Voir l'en-tête sur l'ordre imposé. */
  observes: FacteurClasse[];
  /** Cyclades ne les mesure pas. Une propriété du produit, pas de la fenêtre. */
  nonMesures: FacteurClasse[];
  /** La matrice les refuse. Une propriété de la matrice, pas de la fenêtre. */
  nonAutorises: FacteurClasse[];
}

/**
 * Range les facteurs en trois blocs, pour une fenêtre de cycle.
 *
 * ## L'ordre des tests, et il compte
 *
 * « Non mesuré » passe AVANT « non autorisé ». Un facteur sans aucun fait n'a
 * pas de domaine à autoriser : proposer d'ouvrir un domaine pour lui ferait
 * espérer des données qui n'existent pas, et l'écran mentirait en offrant un
 * bouton qui ne change rien.
 *
 * ## Un facteur observé peut avoir zéro jour renseigné
 *
 * Et il reste observé. « Zéro nuit renseignée sur 31 » est une information
 * vraie et utile : Cyclades mesure le sommeil, et vous n'en avez pas noté. La
 * ranger dans « non mesuré » confondrait une absence de saisie avec une
 * absence de mesure — la seconde est définitive, la première non.
 */
export function classerLesFacteurs(options: {
  faits: readonly FaitObserve[];
  nonAutorises: readonly DomaineNonAutorise[];
  joursDuCycle: number;
  facteurs?: readonly FacteurDuCycle[];
}): ClassementDesFacteurs {
  const { faits, nonAutorises, joursDuCycle } = options;
  const facteurs = options.facteurs ?? FACTEURS_DU_CYCLE;
  const refusParDomaine = new Map(nonAutorises.map((d) => [d.domaine, d]));

  const sortie: ClassementDesFacteurs = { observes: [], nonMesures: [], nonAutorises: [] };

  for (const facteur of facteurs) {
    const jours = new Set(
      faits.filter((f) => facteur.types.includes(f.type)).map((f) => f.jourLogique),
    );
    const base: FacteurClasse = {
      facteur,
      rang: 'observe',
      joursRenseignes: jours.size,
      joursDuCycle,
    };

    if (facteur.types.length === 0) {
      sortie.nonMesures.push({ ...base, rang: 'non-mesure', joursRenseignes: 0 });
      continue;
    }
    /*
       UN SEUL DOMAINE REFUSÉ SUFFIT. Un facteur dont la moitié des faits est
       lisible n'est pas « à moitié observé » : la couverture affichée serait
       amputée sans le dire, et c'est exactement le genre de nombre qu'on lit
       comme entier.
    */
    const refus = facteur.domaines
      .map((d) => refusParDomaine.get(d))
      .filter((r): r is DomaineNonAutorise => r !== undefined);
    if (refus.length > 0) {
      /*
         Le compte de jours est remis à zéro : la lectrice n'avait pas le droit
         de lire ce domaine, donc ce qu'elle a pu en voir ne doit pas apparaître
         comme une couverture. Laisser le nombre reviendrait à répondre à la
         question qu'on vient de refuser.
      */
      sortie.nonAutorises.push({ ...base, rang: 'non-autorise', joursRenseignes: 0, refus });
      continue;
    }
    sortie.observes.push(base);
  }

  sortie.observes.sort(
    (a, b) => b.joursRenseignes - a.joursRenseignes || a.facteur.libelle.localeCompare(b.facteur.libelle, 'fr'),
  );
  return sortie;
}

/**
 * « 22 nuits renseignées sur 31 », en français et avec le bon accord.
 *
 * Le mot change avec le facteur — des nuits pour le sommeil, des jours pour le
 * reste —, et il est passé par l'appelant plutôt que deviné : un module qui
 * conjuguerait les noms de facteurs finirait par écrire « 3 sommeils ».
 */
export const direLaCouverture = (
  classe: FacteurClasse,
  unite: { un: string; plusieurs: string } = { un: 'jour renseigné', plusieurs: 'jours renseignés' },
): string =>
  `${classe.joursRenseignes} ${classe.joursRenseignes === 1 ? unite.un : unite.plusieurs} ` +
  `sur ${classe.joursDuCycle}`;
