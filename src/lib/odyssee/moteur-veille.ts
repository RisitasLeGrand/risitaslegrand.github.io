/**
 * Le moteur de la veille du rythme de vie — phase 2.
 *
 * ## Ce qu'il fait, en une phrase
 *
 * Il compare la médiane des derniers jours à **l'habitude de la personne**,
 * indicateur par indicateur, et ne parle que si l'écart tient, dans le sens
 * préoccupant, et sur plusieurs domaines indépendants à la fois.
 *
 * ## Les quatre conditions, et pourquoi chacune
 *
 * 1. **Déviation** : la médiane récente s'écarte de plus de `seuil` écarts
 *    absolus médians. Le seuil est bas — deux ÉAM valent environ 1,35 σ pour
 *    une loi normale — et c'est délibéré : ce n'est pas le seuil individuel
 *    qui porte la spécificité, c'est le croisement.
 * 2. **Persistance** : l'écart est mesuré sur la **médiane** d'une fenêtre de
 *    dix à vingt-et-un jours, pas sur un jour. Un mauvais lundi ne déclenche
 *    donc rien, et il n'y a pas de compteur de jours consécutifs à tenir —
 *    la médiane fait le travail, et elle le fait sur des données trouées.
 * 3. **Croisement** : au moins k domaines comptants. Plusieurs indicateurs du
 *    même domaine comptent **pour un** : trois façons de mesurer le sommeil
 *    ne font pas trois observations indépendantes, elles font trois fois la
 *    même.
 * 4. **Décote de contexte** : un déménagement, une maladie, des examens
 *    déclarés relèvent le seuil des domaines concernés — ils ne les
 *    éteignent pas, et la décote appliquée est **écrite dans l'explication**,
 *    jamais appliquée en coulisse.
 *
 * ## Ce qu'il ne fait pas, et ne fera pas
 *
 * Il ne lit **jamais** les auto-évaluations. Un check-in rassurant ne peut
 * pas éteindre un signal, et un check-in sombre ne peut pas en allumer un :
 * si le déclaratif pouvait agir sur le moteur, le dispositif perdrait
 * exactement la propriété qu'on lui demande, celle de voir ce que la
 * personne ne dit pas. Les check-ins s'affichent **à côté**, et la carte dit
 * que les deux peuvent être vrais.
 *
 * ## Pas de Web Worker, et pourquoi
 *
 * Le plan en prévoyait un, avec un calcul incrémental. Mesure faite avant de
 * décider, sur les vingt-trois indicateurs :
 *
 * | Historique | Durée d'une évaluation |
 * |---|---|
 * | 70 jours | 2,8 ms |
 * | 180 jours (la rétention réelle) | 2,9 ms |
 * | 1 an | 2,9 ms |
 * | 5 ans | 4,9 ms |
 *
 * Trois millisecondes ne justifient pas un fil d'exécution séparé. Et un
 * Worker coûterait ici davantage qu'il ne rapporte : il faut lui **copier**
 * les mesures à chaque appel, et à cinq ans la copie dépasse le calcul. Le
 * calcul incrémental, lui, introduirait un état à invalider — la source
 * classique du « le chiffre affiché n'est plus celui des données ».
 *
 * Si un jour le catalogue triplait et que la mesure passait la barre des
 * seize millisecondes, soit une image à soixante hertz, la décision se
 * reprendrait. Elle est écrite ici pour qu'on sache ce qui l'a fondée.
 *
 * Il ne rend jamais rien de muet non plus. Un verdict dit toujours s'il
 * manque des données, et lesquelles, parce qu'un écran vide se lit « tout va
 * bien » — ce qui est précisément ce qu'il ne faut pas laisser croire.
 */
import {
  CATALOGUE,
  DOMAINES,
  JOURS_DE_REFERENCE,
  ligneDeBase,
  mediane,
  suffisance,
  comptesDeJours,
  type DomaineVeille,
  type Indicateur,
  type LigneDeBase,
  type Mesure,
  type Suffisance,
} from './veille';

/* ══════════════════════════════════════════════════════════════════════════
   Les trois sensibilités
   ══════════════════════════════════════════════════════════════════════════ */

export type Sensibilite = 'discrete' | 'standard' | 'attentive';

export interface Reglage {
  /** En écarts absolus médians. */
  seuil: number;
  /** Longueur de la fenêtre récente, en jours. */
  persistance: number;
  /** Nombre de domaines comptants exigés. */
  k: number;
  libelle: string;
}

/**
 * Les trois réglages, **révisés après mesure** en phase 4.
 *
 * Le plan proposait de faire varier trois choses à la fois — le seuil, la
 * fenêtre et le nombre de domaines. La mesure sur cinq ans de vies
 * synthétiques a montré que c'était une mauvaise idée, de deux façons.
 *
 * **Le k = 4 de « Discrète » la rendait aveugle.** Une dégradation touchant
 * trois domaines ne peut pas en remplir quatre : le réglage ne signalait
 * jamais rien, quelle que soit l'ampleur. Zéro faux signal, zéro détection.
 *
 * **Baisser le seuil ne détectait rien de plus, et coûtait très cher.** À
 * 1,5 ÉAM sur dix jours, la mesure donnait près de neuf signaux par an sur
 * une vie stable — et *moins* de détections, pas plus. La raison est
 * contre-intuitive et vaut d'être retenue : les faux signaux partent les
 * premiers, le silence qui suit chaque réponse les suit, et ce silence masque
 * le vrai signal quand il arrive. **En dessous d'une certaine spécificité, la
 * cadence transforme la sensibilité en bruit qui cache ce qu'on cherche.**
 *
 * Les trois réglages ne font donc plus varier qu'**une** chose, le seuil, sur
 * une fenêtre de vingt-et-un jours et un croisement de trois domaines. Les
 * chiffres mesurés sont dans `docs/cyclades/psyche-veille/mesures.md`, et
 * l'écran « À propos » les affiche : quelqu'un qui choisit « Attentive » doit
 * savoir qu'elle signale plus souvent sur une vie stable **sans** mieux
 * repérer une vraie dégradation.
 */
export const REGLAGES: Record<Sensibilite, Reglage> = {
  discrete: { seuil: 3, persistance: 21, k: 3, libelle: 'Discrète' },
  standard: { seuil: 2.5, persistance: 21, k: 3, libelle: 'Standard' },
  attentive: { seuil: 2, persistance: 21, k: 3, libelle: 'Attentive' },
};

export const SENSIBILITE_PAR_DEFAUT: Sensibilite = 'standard';

/* ══════════════════════════════════════════════════════════════════════════
   Le contexte déclaré
   ══════════════════════════════════════════════════════════════════════════ */

export type MotifDeContexte =
  | 'voyage'
  | 'maladie'
  | 'blessure'
  | 'examens'
  | 'vacances'
  | 'deuil'
  | 'traitement';

export const LIBELLES_DE_CONTEXTE: Record<MotifDeContexte, string> = {
  voyage: 'un voyage',
  maladie: 'une maladie',
  blessure: 'une blessure',
  examens: 'des examens',
  vacances: 'des vacances',
  deuil: 'un deuil',
  traitement: 'un changement de traitement',
};

export interface Contexte {
  id: string;
  motif: MotifDeContexte;
  /** Jours civils, bornes incluses. */
  debut: string;
  fin: string;
  /** Les domaines que ce contexte explique. Vide : tous. */
  domaines: readonly DomaineVeille[];
}

/**
 * La marge au-delà de la période déclarée.
 *
 * Une grippe ne cesse pas d'expliquer un sommeil haché le lendemain de la
 * guérison. Sept jours, et pas davantage : **un contexte ne masque pas
 * indéfiniment**, et des vacances de deux semaines n'expliquent pas deux mois.
 */
export const MARGE_DE_CONTEXTE = 7;

/**
 * Ce qu'un contexte fait au seuil.
 *
 * Il le **multiplie**, il ne l'annule pas. Un contexte déclaré rend un écart
 * moins surprenant, pas impossible : quelqu'un qui se dégrade pendant ses
 * examens se dégrade quand même, et un dispositif qui s'éteindrait sur
 * déclaration serait désarmé par la première explication venue — y compris
 * par celle qu'on se donne à soi-même pour ne pas regarder.
 */
export const DECOTE = 1.5;

const ajouterJours = (jour: string, n: number) =>
  new Date(Date.parse(`${jour}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Les contextes couvrant `jour`, marge comprise, pour `domaine`. */
export function contextesApplicables(
  contextes: readonly Contexte[],
  domaine: DomaineVeille,
  debut: string,
  fin: string,
): readonly Contexte[] {
  return contextes.filter((c) => {
    if (c.domaines.length && !c.domaines.includes(domaine)) return false;
    const finEtendue = ajouterJours(c.fin, MARGE_DE_CONTEXTE);
    // Chevauchement de deux intervalles, bornes incluses.
    return c.debut <= fin && finEtendue >= debut;
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   La déviation d'un indicateur
   ══════════════════════════════════════════════════════════════════════════ */

export interface Deviation {
  indicateur: string;
  domaine: DomaineVeille;
  libelle: string;
  /** En écarts absolus médians, **signé dans le sens préoccupant**. */
  ecarts: number;
  seuilApplique: number;
  devie: boolean;
  /** Les motifs qui ont relevé le seuil. Nommés, jamais tus. */
  contextes: readonly MotifDeContexte[];
  joursRetenus: number;
}

const estWeekEnd = (jour: string) => {
  const j = new Date(`${jour}T12:00:00.000Z`).getUTCDay();
  return j === 0 || j === 6;
};

/**
 * L'écart d'un jour, rapporté à la base de **son type de jour**.
 *
 * Chaque jour est standardisé contre sa propre référence — un samedi contre
 * les samedis — puis les écarts sont médianisés sur la fenêtre. C'est ce qui
 * permet à une fenêtre mêlant semaine et week-end de donner un seul nombre
 * sans que la proportion de week-ends ne le déplace.
 */
function ecartDuJour(m: Mesure, base: LigneDeBase, indicateur: Indicateur): number | null {
  const reference = estWeekEnd(m.jour) ? base.weekEnd : base.ouvre;
  if (!reference) return null;
  const dispersion = Math.max(reference.dispersion, indicateur.plancherDeDispersion);
  const brut = (m.valeur - reference.mediane) / dispersion;
  // Seule « baisse » inquiète vers le bas. Irrégularité et rupture sont des
  // grandeurs qui n'inquiètent qu'en montant, comme « hausse ».
  return indicateur.sens === 'baisse' ? -brut : brut;
}

export function deviation(
  indicateur: Indicateur,
  mesures: readonly Mesure[],
  base: LigneDeBase,
  jour: string,
  reglage: Reglage,
  contextes: readonly Contexte[],
): Deviation | null {
  const debut = ajouterJours(jour, -(reglage.persistance - 1));
  const fenetre = mesures.filter((m) => m.jour >= debut && m.jour <= jour);

  /*
     Le minimum de jours est celui du catalogue, posé pour une fenêtre de
     quatorze, mis à l'échelle de la fenêtre réellement employée. Sans cela,
     « Attentive » exigerait dix jours valides sur dix, c'est-à-dire la
     perfection, et ne déclencherait jamais.
  */
  const minimum = Math.max(
    2,
    Math.ceil((indicateur.joursMinimaux * reglage.persistance) / 14),
  );
  const ecarts = fenetre
    .map((m) => ecartDuJour(m, base, indicateur))
    .filter((e): e is number => e !== null);
  if (ecarts.length < minimum) return null;

  const applicables = contextesApplicables(contextes, indicateur.domaine, debut, jour);
  const seuilApplique = reglage.seuil * (applicables.length ? DECOTE : 1);
  const valeur = mediane(ecarts) ?? 0;

  return {
    indicateur: indicateur.id,
    domaine: indicateur.domaine,
    libelle: indicateur.libelle,
    ecarts: valeur,
    seuilApplique,
    devie: valeur > seuilApplique,
    contextes: [...new Set(applicables.map((c) => c.motif))],
    joursRetenus: ecarts.length,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le verdict
   ══════════════════════════════════════════════════════════════════════════ */

export interface Repere {
  jour: string;
  /** Premier jour de la fenêtre retenue. */
  depuis: string;
  sensibilite: Sensibilite;
  /** Les déviations des domaines comptants, les plus fortes d'abord. */
  deviations: readonly Deviation[];
  domaines: readonly DomaineVeille[];
  /** Le domaine d'appoint : il renforce, il ne déclenche pas. */
  appuis: readonly Deviation[];
  contextes: readonly MotifDeContexte[];
  /** Le jour auquel la base employée a été arrêtée. Gelée s'il y a lieu. */
  baseArreteeAu: string;
}

export type Verdict =
  | { quoi: 'donnees-insuffisantes'; suffisance: Suffisance; baseArreteeAu: string }
  | {
      quoi: 'rien-a-signaler';
      deviations: readonly Deviation[];
      domaines: readonly DomaineVeille[];
      /** Pourquoi rien : combien de domaines, sur combien attendus. */
      pourquoi: string;
      baseArreteeAu: string;
    }
  | { quoi: 'repere'; repere: Repere };

export interface Entree {
  jour: string;
  mesures: Readonly<Record<string, readonly Mesure[]>>;
  contextes?: readonly Contexte[];
  sensibilite?: Sensibilite;
  /**
   * Le jour où le signal en cours a commencé, ou `null`.
   *
   * C'est **ce qui gèle la ligne de base**. Tant qu'un repère est actif, la
   * base reste celle d'avant lui ; sans ce gel, la dégradation entre peu à
   * peu dans la référence, la référence la rejoint, et le signal s'éteint de
   * lui-même sans que rien ne se soit amélioré. C'est le défaut qui ruine la
   * plupart des détections par écart, et il est entièrement silencieux.
   */
  signalActifDepuis?: string | null;
  catalogue?: readonly Indicateur[];
  /**
   * Un réglage libre, qui prime sur la sensibilité.
   *
   * Il n'existe que pour **mesurer** : c'est ce qui permet de balayer des
   * seuils et des fenêtres sans toucher aux trois réglages offerts. Aucun
   * écran ne le passe, et aucun ne doit le passer — les trois sensibilités
   * sont un choix, pas un curseur.
   */
  reglageBrut?: { seuil: number; persistance: number; k: number };
}

export function evaluer(entree: Entree): Verdict {
  const catalogue = entree.catalogue ?? CATALOGUE;
  const offert = REGLAGES[entree.sensibilite ?? SENSIBILITE_PAR_DEFAUT];
  const reglage: Reglage = entree.reglageBrut
    ? { ...offert, ...entree.reglageBrut }
    : offert;
  const contextes = entree.contextes ?? [];
  const { jour } = entree;

  /*
     La base s'arrête **avant** la fenêtre qu'on lui compare, toujours.

     C'est le correctif le plus important de la phase 4, et il vient d'une
     mesure. Tant que la base allait jusqu'au jour courant, elle contenait la
     période qu'on voulait juger : une dégradation qui dure y entrait peu à
     peu, la référence la rejoignait, et l'écart retombait sous le seuil. Le
     gel était censé l'empêcher — mais il ne s'arme que pendant qu'un repère
     est ouvert, et une dégradation lente n'en ouvre jamais. Donc ne gèle
     jamais. Donc ne se voit jamais. Le raisonnement était circulaire, et la
     mesure l'a montré : au réglage Standard, il fallait un écart de six
     écarts absolus médians — trois heures de sommeil en moins, toutes les
     nuits — pour que quoi que ce soit se déclenche.

     Psyché avait déjà reçu ce correctif en phase 7 ; je ne l'avais pas
     reporté ici.

     Le gel reste utile par-dessus : il recule la base encore plus loin quand
     un repère est ouvert, pour que la période du signal n'y entre pas non
     plus. On retient donc la plus ancienne des deux dates.
  */
  const avantLaFenetre = ajouterJours(jour, -reglage.persistance);
  const baseArreteeAu = entree.signalActifDepuis
    ? [ajouterJours(entree.signalActifDepuis, -1), avantLaFenetre].sort()[0]
    : avantLaFenetre;

  const comptes = comptesDeJours(entree.mesures, jour, reglage.persistance, JOURS_DE_REFERENCE);
  const assez = suffisance(comptes, catalogue);
  if (assez.statut === 'donnees-insuffisantes') {
    return { quoi: 'donnees-insuffisantes', suffisance: assez, baseArreteeAu };
  }

  const toutes: Deviation[] = [];
  for (const indicateur of catalogue) {
    const mesures = entree.mesures[indicateur.id];
    if (!mesures?.length) continue;
    const base = ligneDeBase(indicateur.id, mesures, baseArreteeAu);
    const d = deviation(indicateur, mesures, base, jour, reglage, contextes);
    if (d) toutes.push(d);
  }

  const parForce = (a: Deviation, b: Deviation) => b.ecarts - a.ecarts;
  const deviantes = toutes.filter((d) => d.devie).sort(parForce);
  const comptantes = deviantes.filter((d) => DOMAINES[d.domaine].compteDansLeCroisement);
  const appuis = deviantes.filter((d) => !DOMAINES[d.domaine].compteDansLeCroisement);
  const domaines = [...new Set(comptantes.map((d) => d.domaine))];

  if (domaines.length < reglage.k) {
    return {
      quoi: 'rien-a-signaler',
      deviations: toutes.sort(parForce),
      domaines,
      pourquoi:
        `${domaines.length} domaine(s) s’écartent de votre habitude, sur les ` +
        `${reglage.k} qu’il en faut pour que ce soit signalé.`,
      baseArreteeAu,
    };
  }

  return {
    quoi: 'repere',
    repere: {
      jour,
      depuis: ajouterJours(jour, -(reglage.persistance - 1)),
      sensibilite: entree.sensibilite ?? SENSIBILITE_PAR_DEFAUT,
      deviations: comptantes,
      domaines,
      appuis,
      contextes: [...new Set(comptantes.flatMap((d) => d.contextes))],
      baseArreteeAu,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   La mise en mots
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'ampleur d'un écart, en langage courant et **sans aucun chiffre**.
 *
 * Pas de pourcentage, pas de jauge, pas de « 2,4 écarts ». Les valeurs
 * exactes existent, et elles vivent dans « Pourquoi ce repère ? », pour qui
 * veut vérifier. Sur la carte elles ne feraient qu'une chose : donner à une
 * comparaison avec soi-même l'allure d'une mesure clinique.
 */
export function formulerLEcart(d: Deviation, indicateur: Indicateur): string {
  const beaucoup = d.ecarts >= d.seuilApplique * 1.75;
  const nuance = beaucoup ? 'nettement ' : '';
  switch (indicateur.sens) {
    case 'irregularite':
      return `vos ${indicateur.libelle.toLowerCase()} sont ${nuance}plus dispersées qu’à votre habitude`;
    case 'baisse':
      return `${indicateur.libelle.toLowerCase()} : ${nuance}moins qu’à votre habitude`;
    case 'rupture':
      return `${indicateur.libelle.toLowerCase()} : une pratique installée s’est interrompue`;
    default:
      return `${indicateur.libelle.toLowerCase()} : ${nuance}plus qu’à votre habitude`;
  }
}

/** La ligne de contexte de la carte. Elle existe même quand il n'y en a pas. */
export function formulerLeContexte(repere: Repere): string {
  if (!repere.contextes.length) {
    return 'Contexte pris en compte : aucun n’a été déclaré sur cette période.';
  }
  const liste = repere.contextes.map((m) => LIBELLES_DE_CONTEXTE[m]).join(', ');
  return (
    `Contexte pris en compte : ${liste}. Les repères concernés ont été jugés ` +
    'plus exigeamment, sans être écartés.'
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les trois mots que ce module ne prononcera jamais.
 *
 * Ils ne sont pas dans `MOTS_INTERDITS` de la psyché parce qu'ils ne
 * diagnostiquent rien : ils **qualifient le dispositif**. Et c'est
 * précisément là que la dérive se produirait — non pas en disant à quelqu'un
 * qu'il est malade, mais en disant de Cyclades qu'il dépiste.
 */
export const MOTS_INTERDITS_VEILLE: readonly string[] = [
  'dépistage',
  'dépister',
  'détection',
  'détecter',
  'prévention',
  'prévenir',
  'alerte',
  'risque de',
  'probabilité',
  'sensibilité du',
  'spécificité',
  'faux négatif',
];

const sansAccent = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, "'")
    .toLowerCase();

/**
 * Relit les phrases produites par le moteur.
 *
 * Deux refus : le vocabulaire de dépistage, et **tout chiffre** dans ce qui
 * est destiné à la carte. Le second est le plus facile à perdre — il suffit
 * d'une amélioration bien intentionnée, « et si on affichait l'écart ? ».
 */
export function controlerFormulations(phrases: readonly string[]): string[] {
  const problemes: string[] = [];
  for (const phrase of phrases) {
    const nette = sansAccent(phrase);
    for (const mot of MOTS_INTERDITS_VEILLE) {
      if (nette.includes(sansAccent(mot))) {
        problemes.push(`« ${mot} » n’a pas sa place ici : « ${phrase.slice(0, 80)}… »`);
      }
    }
    if (/\d/.test(phrase)) {
      problemes.push(
        `Un chiffre s’est glissé dans une phrase de la carte : « ${phrase.slice(0, 80)}… ». ` +
          'Les valeurs exactes vivent dans « Pourquoi ce repère ? », pas ici.',
      );
    }
  }
  return problemes;
}

/** Le moteur se contrôle lui-même : les réglages se tiennent-ils ? */
export function controlerMoteur(): string[] {
  const problemes: string[] = [];
  const ordre: Sensibilite[] = ['attentive', 'standard', 'discrete'];
  for (let i = 1; i < ordre.length; i += 1) {
    const avant = REGLAGES[ordre[i - 1]];
    const apres = REGLAGES[ordre[i]];
    if (apres.seuil <= avant.seuil) {
      problemes.push(
        `« ${apres.libelle} » devrait avoir un seuil plus haut que « ${avant.libelle} ».`,
      );
    }
    /*
       Et la fenêtre comme le croisement doivent rester **identiques**. La
       phase 4 a montré qu'en faire varier plusieurs à la fois produisait des
       réglages incomparables, dont l'un était purement aveugle. Un réglage
       offert à quelqu'un doit se décrire en une phrase ; trois axes qui
       bougent ensemble ne se décrivent pas.
    */
    if (apres.persistance !== avant.persistance || apres.k !== avant.k) {
      problemes.push(
        `« ${apres.libelle} » et « ${avant.libelle} » ne diffèrent pas que par le seuil. ` +
          'Voir la note des réglages : faire varier plusieurs axes a produit un réglage aveugle.',
      );
    }
  }
  const comptants = Object.values(DOMAINES).filter((d) => d.compteDansLeCroisement).length;
  for (const [nom, r] of Object.entries(REGLAGES)) {
    if (r.k > comptants) {
      problemes.push(
        `« ${nom} » exige ${r.k} domaines, or il n’en existe que ${comptants} qui comptent : ` +
          'ce réglage ne pourrait jamais rien signaler.',
      );
    }
  }
  if (DECOTE <= 1) {
    problemes.push('Une décote inférieure ou égale à 1 rendrait un contexte déclaré aggravant.');
  }
  return problemes;
}
