/**
 * Les tendances : des pistes, jamais des causes.
 *
 * ## Ce que ce module refuse de faire
 *
 * Il ne dit pas qu'une chose en provoque une autre. Jamais, dans aucun cas,
 * même quand la corrélation est forte et l'intuition évidente. Ce ne serait
 * pas une prudence de langage : les données d'ici sont observationnelles, sans
 * assignation ni témoin, et rien n'y distingue « mieux dormir fait mieux
 * réviser » de « les jours calmes permettent les deux ». Le vocabulaire est
 * donc **fermé** et vérifié par un contrôle : `controlerVocabulaire()` relit
 * les phrases produites et refuse celles qui emploient un mot de causalité.
 *
 * ## Quatre garde-fous, et aucun n'est négociable
 *
 * 1. **Un effectif minimal.** Sous `EFFECTIF_MINIMAL` paires, rien n'est
 *    affiché — pas « une piste faible », rien. Une corrélation sur six jours
 *    est un dessin dans les nuages.
 * 2. **Une taille d'effet.** Un coefficient significatif mais minuscule est
 *    une trouvaille de statisticien, pas une information : sous
 *    `EFFET_MINIMAL`, la piste est écartée même si le calcul « passe ».
 * 3. **Un intervalle, pas un point.** Un `r` de 0,42 sur vingt jours a un
 *    intervalle qui va de 0,0 à 0,7 : l'afficher seul donnerait à un brouillard
 *    l'allure d'une mesure.
 * 4. **Le contrôle des comparaisons multiples.** Croiser dix indicateurs deux
 *    à deux fait quarante-cinq tests ; à 5 %, deux « découvertes » sont
 *    attendues *par pur hasard*. La procédure de Benjamini-Hochberg corrige le
 *    seuil, et le nombre de tests est affiché.
 *
 * ## Les approximations, nommées
 *
 * L'intervalle de confiance du coefficient passe par la transformation de
 * Fisher, et le quantile normal 1,96 y remplace celui de Student. C'est
 * acceptable **parce que** l'effectif minimal est de vingt : en deçà, on
 * n'affiche rien, donc on n'a jamais besoin du cas où l'approximation ment.
 */

import { nombreFr } from '../noyau/accords';

/* ══════════════════════════════════════════════════════════════════════════
   Les seuils, déclarés
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le nombre minimal de paires pour qu'une piste existe.
 *
 * Vingt, et non dix : avec dix paires, l'intervalle de confiance d'un
 * coefficient de 0,5 contient encore zéro. Afficher une piste dont
 * l'intervalle contient zéro, c'est afficher « peut-être rien ».
 */
export const EFFECTIF_MINIMAL = 20;

/**
 * La taille d'effet en deçà de laquelle on se tait.
 *
 * 0,3 — la borne conventionnelle d'un effet « moyen ». C'est une convention,
 * pas une loi de la nature, et elle est écrite ici pour pouvoir être discutée
 * plutôt que subie.
 */
export const EFFET_MINIMAL = 0.3;

/** Le taux de fausses découvertes toléré par la procédure de Benjamini-Hochberg. */
export const TAUX_FAUSSES_DECOUVERTES = 0.1;

/** Le quantile normal à 95 %. Voir l'en-tête pour pourquoi il suffit ici. */
const Z95 = 1.959964;

/** Les paliers de taille d'effet, conventionnels et nommés comme tels. */
export type Ampleur = 'négligeable' | 'faible' | 'moyenne' | 'forte';

export function ampleur(r: number): Ampleur {
  const a = Math.abs(r);
  if (a < 0.1) return 'négligeable';
  if (a < 0.3) return 'faible';
  if (a < 0.5) return 'moyenne';
  return 'forte';
}

/* ══════════════════════════════════════════════════════════════════════════
   Les séries
   ══════════════════════════════════════════════════════════════════════════ */

export interface Serie {
  /** L'identifiant de ce qui est mesuré : un type de fait, un indicateur. */
  id: string;
  libelle: string;
  /** Une valeur par jour logique. Les jours absents sont absents, pas nuls. */
  valeurs: Map<string, number>;
}

/**
 * Les paires de deux séries : les jours où **les deux** ont une valeur.
 *
 * L'intersection, et non l'union complétée de zéros. Compléter inventerait des
 * jours à zéro sommeil et à zéro révision, qui tireraient mécaniquement toute
 * corrélation vers le haut — l'artefact le plus banal de ce genre d'analyse.
 */
export function apparier(a: Serie, b: Serie): { jours: string[]; x: number[]; y: number[] } {
  const jours: string[] = [];
  const x: number[] = [];
  const y: number[] = [];
  for (const jour of [...a.valeurs.keys()].sort()) {
    const va = a.valeurs.get(jour);
    const vb = b.valeurs.get(jour);
    if (va === undefined || vb === undefined) continue;
    jours.push(jour);
    x.push(va);
    y.push(vb);
  }
  return { jours, x, y };
}

/**
 * Apparie deux séries en **décalant** la seconde de `decalage` jours.
 *
 * Un décalage ne démontre rien non plus — l'antériorité n'est pas la cause —
 * mais il répond à une question différente : « les jours qui suivent une
 * bonne nuit » n'est pas « les jours où j'ai bien dormi ». Le décalage est
 * reporté dans la piste, pour que personne ne lise l'un en croyant l'autre.
 */
export function apparierDecale(
  a: Serie,
  b: Serie,
  decalage: number,
): { jours: string[]; x: number[]; y: number[] } {
  if (decalage === 0) return apparier(a, b);
  const decalee: Serie = { ...b, valeurs: new Map() };
  for (const [jour, valeur] of b.valeurs) {
    const vers = new Date(Date.parse(`${jour}T12:00:00.000Z`) - decalage * 86400000)
      .toISOString()
      .slice(0, 10);
    decalee.valeurs.set(vers, valeur);
  }
  return apparier(a, decalee);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les statistiques
   ══════════════════════════════════════════════════════════════════════════ */

export const moyenne = (xs: readonly number[]): number =>
  xs.reduce((s, x) => s + x, 0) / xs.length;

/** L'écart-type **de l'échantillon**, en n−1 : on estime, on ne recense pas. */
export function ecartType(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = moyenne(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export interface Coefficient {
  /** Le coefficient de corrélation de Pearson. */
  r: number;
  /** Le nombre de paires. */
  n: number;
  /** Les bornes de l'intervalle à 95 %, par la transformation de Fisher. */
  bas: number;
  haut: number;
  /** La valeur p bilatérale, approchée par la même transformation. */
  p: number;
}

/**
 * Le coefficient de corrélation de deux séries appariées.
 *
 * Pearson, et non Spearman : il se vérifie à la main sur un petit jeu, ce qui
 * est la seule façon de savoir qu'une implémentation statistique est juste.
 * Son défaut — la sensibilité aux valeurs extrêmes — est réel, et c'est une
 * raison de plus pour n'en rien conclure de causal.
 *
 * Rend `null` quand le calcul n'a pas de sens : moins de trois paires, ou une
 * série constante. Une série constante ne corrèle avec rien, et la formule y
 * divise par zéro — rendre 0 ferait passer une impossibilité pour une absence
 * de lien.
 */
export function correlation(x: readonly number[], y: readonly number[]): Coefficient | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const mx = moyenne(x.slice(0, n));
  const my = moyenne(y.slice(0, n));
  let haut = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    haut += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }
  if (sx === 0 || sy === 0) return null;
  const r = Math.max(-1, Math.min(1, haut / Math.sqrt(sx * sy)));

  /*
     Fisher : z = atanh(r), d'écart-type 1/√(n−3). L'intervalle se calcule
     dans cet espace puis revient par tanh, ce qui le rend asymétrique — et
     c'est juste : un r de 0,9 ne peut pas s'écarter de 0,2 vers le haut.
  */
  if (n < 4) return { r, n, bas: -1, haut: 1, p: 1 };
  const z = Math.atanh(r);
  const erreur = 1 / Math.sqrt(n - 3);
  return {
    r,
    n,
    bas: Math.tanh(z - Z95 * erreur),
    haut: Math.tanh(z + Z95 * erreur),
    p: 2 * (1 - loiNormale(Math.abs(z) / erreur)),
  };
}

/**
 * La fonction de répartition de la loi normale centrée réduite.
 *
 * Approximation d'Abramowitz et Stegun 26.2.17, à 7,5·10⁻⁸ près. Largement
 * suffisant : on compare la valeur p à un seuil, on ne la publie pas.
 */
function loiNormale(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const densite = Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
  const polynome =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const queue = densite * polynome;
  return x >= 0 ? 1 - queue : queue;
}

export interface Pente {
  /** La pente, en unités de y par jour. */
  parJour: number;
  /** L'ordonnée à l'origine, au premier jour de la série. */
  origine: number;
  /** Les bornes de la pente à 95 %. */
  bas: number;
  haut: number;
  /** La part de variance expliquée. */
  r2: number;
  n: number;
}

/**
 * La droite des moindres carrés d'une série temporelle.
 *
 * L'abscisse est le **nombre de jours depuis le premier point**, et non le
 * rang : deux points séparés de trois semaines ne pèsent pas comme deux points
 * consécutifs, et prendre le rang écraserait les trous — c'est-à-dire
 * raconterait une progression régulière là où il y a eu une interruption.
 */
export function pente(jours: readonly string[], valeurs: readonly number[]): Pente | null {
  const n = Math.min(jours.length, valeurs.length);
  if (n < 3) return null;
  const t0 = Date.parse(`${jours[0]}T12:00:00.000Z`);
  const x = jours.slice(0, n).map((j) => (Date.parse(`${j}T12:00:00.000Z`) - t0) / 86400000);
  const y = valeurs.slice(0, n);

  const mx = moyenne(x);
  const my = moyenne(y);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  if (sxx === 0) return null;

  const parJour = sxy / sxx;
  const origine = my - parJour * mx;
  let residus = 0;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    residus += (y[i] - (origine + parJour * x[i])) ** 2;
    total += (y[i] - my) ** 2;
  }
  const erreur = n > 2 ? Math.sqrt(residus / (n - 2) / sxx) : 0;
  return {
    parJour,
    origine,
    bas: parJour - Z95 * erreur,
    haut: parJour + Z95 * erreur,
    r2: total === 0 ? 1 : Math.max(0, 1 - residus / total),
    n,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les comparaisons multiples
   ══════════════════════════════════════════════════════════════════════════ */

export interface Test {
  id: string;
  p: number;
}

/**
 * Benjamini-Hochberg : lesquels de ces tests survivent ?
 *
 * On trie les valeurs p, et l'on garde celles qui passent sous `i/m × q`. La
 * procédure contrôle la **part attendue de fausses découvertes parmi les
 * découvertes**, ce qui est la bonne question quand on explore : « combien de
 * mes pistes sont du bruit ? », et non « ai-je une chance de me tromper une
 * fois ? ».
 *
 * Le rendu nomme aussi `m`, le nombre de tests. Une piste retenue parmi
 * quarante-cinq ne se lit pas comme une piste retenue parmi deux, et cacher
 * `m` serait cacher la moitié de l'information.
 */
export function benjaminiHochberg(
  tests: readonly Test[],
  q = TAUX_FAUSSES_DECOUVERTES,
): { retenus: Set<string>; m: number; seuil: number | null } {
  const m = tests.length;
  if (!m) return { retenus: new Set(), m: 0, seuil: null };
  const tries = [...tests].sort((a, b) => a.p - b.p);

  /*
     On cherche le **plus grand** rang qui passe, puis on retient tout ce qui
     le précède. Retenir seulement ceux qui passent individuellement serait une
     autre procédure, plus conservatrice, et fausse : BH garantit son taux
     précisément grâce à cette remontée.
  */
  let dernier = -1;
  for (let i = 0; i < m; i += 1) {
    if (tries[i].p <= ((i + 1) / m) * q) dernier = i;
  }
  if (dernier < 0) return { retenus: new Set(), m, seuil: null };
  return {
    retenus: new Set(tries.slice(0, dernier + 1).map((t) => t.id)),
    m,
    seuil: tries[dernier].p,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le recul
   ══════════════════════════════════════════════════════════════════════════ */

export type Recul = 'aucun' | 'court' | 'moyen' | 'long';

export interface MesureDuRecul {
  /** Jours entre le premier et le dernier point, bornes comprises. */
  etendue: number;
  /** Jours effectivement renseignés. */
  renseignes: number;
  /** Part des jours de l'étendue qui portent une valeur. */
  densite: number;
  niveau: Recul;
}

/**
 * Depuis combien de temps mesure-t-on, et à quelle densité ?
 *
 * Deux chiffres et non un, parce qu'ils se trompent différemment. Six mois
 * d'étendue avec quatre points n'est pas du recul : c'est un souvenir. Trente
 * jours pleins en sont davantage.
 */
export function recul(jours: readonly string[]): MesureDuRecul {
  if (!jours.length) return { etendue: 0, renseignes: 0, densite: 0, niveau: 'aucun' };
  const tries = [...new Set(jours)].sort();
  const etendue =
    Math.round(
      (Date.parse(`${tries[tries.length - 1]}T12:00:00.000Z`) -
        Date.parse(`${tries[0]}T12:00:00.000Z`)) /
        86400000,
    ) + 1;
  const renseignes = tries.length;
  const densite = etendue ? renseignes / etendue : 0;

  /*
     Le niveau tient compte des deux : une étendue sans densité ne compte pas.
     C'est pourquoi `niveau` n'est pas une simple tranche de durée.
  */
  let niveau: Recul = 'aucun';
  if (renseignes >= EFFECTIF_MINIMAL && densite >= 0.3) {
    if (etendue >= 365) niveau = 'long';
    else if (etendue >= 90) niveau = 'moyen';
    else niveau = 'court';
  }
  return { etendue, renseignes, densite: Math.round(densite * 100) / 100, niveau };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les pistes
   ══════════════════════════════════════════════════════════════════════════ */

export type SortePiste = 'croisement' | 'tendance';

export interface Piste {
  id: string;
  sorte: SortePiste;
  /** Ce que la piste dit, dans le vocabulaire fermé. */
  enonce: string;
  /** Ce qu'elle **ne** dit **pas**. Affiché à côté, jamais en note de bas de page. */
  reserve: string;
  /** Les séries en cause. */
  series: string[];
  decalage: number;
  n: number;
  r?: number;
  bas?: number;
  haut?: number;
  p: number;
  ampleur: Ampleur;
  recul: MesureDuRecul;
}

export interface PisteEcartee {
  series: string[];
  decalage: number;
  /** Pourquoi elle n'est pas montrée. Nommé, parce qu'un silence n'apprend rien. */
  motif: 'effectif' | 'effet' | 'intervalle' | 'comparaisons-multiples' | 'incalculable';
  n: number;
}

export interface Exploration {
  pistes: Piste[];
  ecartees: PisteEcartee[];
  /** Le nombre de tests menés. Affiché : il change la lecture de chaque piste. */
  tests: number;
}

/**
 * La réserve, construite à partir de ce que la piste est.
 *
 * Elle n'est pas décorative. Une corrélation observationnelle admet toujours
 * au moins trois lectures — l'un vers l'autre, l'autre vers l'un, un tiers
 * vers les deux — et la phrase les nomme pour qu'on ne lise pas la première
 * par défaut.
 */
function reserveDe(a: string, b: string, decalage: number): string {
  const tiers =
    'un troisième facteur — une période chargée, une maladie, des vacances — peut agir sur les deux.';
  if (decalage === 0) {
    return `Ces deux mesures varient ensemble. Rien n’indique laquelle précède l’autre, et ${tiers}`;
  }
  return (
    `« ${a} » précède « ${b} » de ${Math.abs(decalage)} jour${Math.abs(decalage) > 1 ? 's' : ''} ici. ` +
    `Précéder n’est pas causer, et ${tiers}`
  );
}

/**
 * Croise toutes les paires de séries et rend ce qui survit aux quatre
 * garde-fous.
 *
 * L'ordre des garde-fous compte : l'effectif d'abord, parce qu'un calcul sur
 * six points n'a pas à être fait ; la correction des comparaisons multiples en
 * dernier, parce qu'elle a besoin de connaître le nombre total de tests.
 */
export function explorer(
  series: readonly Serie[],
  options: { decalages?: readonly number[]; q?: number } = {},
): Exploration {
  const decalages = options.decalages ?? [0];
  const candidats: {
    cle: string;
    a: Serie;
    b: Serie;
    decalage: number;
    jours: string[];
    coefficient: Coefficient;
  }[] = [];
  const ecartees: PisteEcartee[] = [];

  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      for (const decalage of decalages) {
        const a = series[i];
        const b = series[j];
        const { jours, x, y } = apparierDecale(a, b, decalage);
        if (jours.length < EFFECTIF_MINIMAL) {
          ecartees.push({ series: [a.id, b.id], decalage, motif: 'effectif', n: jours.length });
          continue;
        }
        const coefficient = correlation(x, y);
        if (!coefficient) {
          ecartees.push({ series: [a.id, b.id], decalage, motif: 'incalculable', n: jours.length });
          continue;
        }
        if (Math.abs(coefficient.r) < EFFET_MINIMAL) {
          ecartees.push({ series: [a.id, b.id], decalage, motif: 'effet', n: coefficient.n });
          continue;
        }
        /*
           L'intervalle qui contient zéro : le signe lui-même n'est pas établi.
           Afficher « lien positif » quand l'intervalle va de −0,1 à 0,6 serait
           choisir une borne et taire l'autre.
        */
        if (coefficient.bas <= 0 && coefficient.haut >= 0) {
          ecartees.push({ series: [a.id, b.id], decalage, motif: 'intervalle', n: coefficient.n });
          continue;
        }
        candidats.push({ cle: `${a.id}|${b.id}|${decalage}`, a, b, decalage, jours, coefficient });
      }
    }
  }

  const { retenus, m } = benjaminiHochberg(
    candidats.map((c) => ({ id: c.cle, p: c.coefficient.p })),
    options.q,
  );

  const pistes: Piste[] = [];
  for (const candidat of candidats) {
    if (!retenus.has(candidat.cle)) {
      ecartees.push({
        series: [candidat.a.id, candidat.b.id],
        decalage: candidat.decalage,
        motif: 'comparaisons-multiples',
        n: candidat.coefficient.n,
      });
      continue;
    }
    const { r, n, bas, haut, p } = candidat.coefficient;
    const sens = r > 0 ? 'vont dans le même sens' : 'vont en sens inverse';
    pistes.push({
      id: candidat.cle,
      sorte: 'croisement',
      enonce:
        `« ${candidat.a.libelle} » et « ${candidat.b.libelle} » ${sens} ` +
        `sur ${n} jours appariés (lien ${ampleur(r)}, de ${nombreFr(bas, 2)} ` +
        `à ${nombreFr(haut, 2)}).`,
      reserve: reserveDe(candidat.a.libelle, candidat.b.libelle, candidat.decalage),
      series: [candidat.a.id, candidat.b.id],
      decalage: candidat.decalage,
      n,
      r,
      bas,
      haut,
      p,
      ampleur: ampleur(r),
      recul: recul(candidat.jours),
    });
  }

  pistes.sort((a, b) => Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0));
  return { pistes, ecartees, tests: m };
}

/**
 * La tendance d'une série seule : monte-t-elle, descend-elle ?
 *
 * Même exigence qu'un croisement : l'effectif minimal, et un intervalle qui ne
 * contient pas zéro. Une pente dont l'intervalle traverse zéro est une série
 * qui ne fait rien de net, et l'annoncer « en hausse » serait lire le bruit.
 */
export function tendance(serie: Serie): Piste | null {
  const jours = [...serie.valeurs.keys()].sort();
  if (jours.length < EFFECTIF_MINIMAL) return null;
  const valeurs = jours.map((j) => serie.valeurs.get(j)!);
  const droite = pente(jours, valeurs);
  if (!droite) return null;
  if (droite.bas <= 0 && droite.haut >= 0) return null;

  const sens = droite.parJour > 0 ? 'monte' : 'descend';
  const parSemaine = Math.abs(droite.parJour) * 7;
  return {
    id: `tendance|${serie.id}`,
    sorte: 'tendance',
    enonce:
      `« ${serie.libelle} » ${sens} d’environ ${nombreFr(parSemaine, 2)} par semaine ` +
      `sur ${droite.n} jours mesurés.`,
    reserve:
      'Une pente décrit la période observée, pas la suite. Elle ne dit pas non plus pourquoi : ' +
      'une saison, un changement de vie ou une façon de mesurer suffisent à l’expliquer.',
    series: [serie.id],
    decalage: 0,
    n: droite.n,
    p: 0,
    ampleur: ampleur(Math.sqrt(droite.r2)),
    recul: recul(jours),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le vocabulaire : le contrôle qui tient la promesse
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les mots qui affirment une cause.
 *
 * La liste est volontairement large, et comprend des tournures qui semblent
 * prudentes — « favorise », « contribue à », « grâce à ». Elles affirment
 * toutes une direction, et c'est précisément ce que les données ne portent
 * pas. « Précède » et « varie avec » restent permis : ils décrivent.
 */
export const MOTS_DE_CAUSE: readonly string[] = [
  'cause',
  'causé',
  'causée',
  'provoque',
  'provoqué',
  'entraîne',
  'entraîné',
  'déclenche',
  'produit un effet',
  'grâce à',
  'à cause de',
  'en raison de',
  'favorise',
  'contribue à',
  'améliore',
  'dégrade',
  'augmente le',
  'diminue le',
  'fait baisser',
  'fait monter',
  'permet de',
  'empêche de',
  'responsable de',
  'explique',
  'parce que',
  'donc',
];

const sansAccent = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Relit des phrases et nomme celles qui affirment une cause.
 *
 * Le contrôle vit ici, pas dans l'écran : un écran se contourne, et la
 * promesse « jamais de causalité » doit pouvoir s'éprouver sans navigateur.
 */
export function controlerVocabulaire(phrases: readonly string[]): string[] {
  /*
     Les formes sont **dédupliquées une fois l'accent retiré**. « entraîne » et
     « entraîné » se confondent alors, et les laisser toutes deux ferait compter
     deux problèmes là où il n'y a qu'un mot — un contrôle qui compte mal
     devient un contrôle qu'on cesse de lire.
  */
  const formes = [...new Set(MOTS_DE_CAUSE.map(sansAccent))];
  const problemes: string[] = [];
  for (const phrase of phrases) {
    const nette = sansAccent(phrase);
    for (const forme of formes) {
      if (!nette.includes(forme)) continue;
      problemes.push(`« ${forme} » affirme une cause : « ${phrase.slice(0, 80)}… »`);
    }
  }
  return problemes;
}
