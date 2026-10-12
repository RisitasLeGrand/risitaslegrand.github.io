/**
 * Les synthèses : une période, ses indicateurs, et ce qu'on ne sait pas d'elle.
 *
 * ## Ce qu'une synthèse doit dire, et que les tableaux de bord oublient
 *
 * Trois choses, et la troisième est celle qui manque partout :
 *
 * 1. **les mesures** de la période, avec leur fiabilité ;
 * 2. **la comparaison** avec la période précédente, quand elle a du sens ;
 * 3. **ce qui n'a pas pu être mesuré**, et pourquoi. C'est la couverture de
 *    mesure, et c'est elle qui empêche de lire une roue d'équilibre vide comme
 *    une vie déséquilibrée.
 *
 * ## La comparaison ne juge pas ce qui ne se juge pas
 *
 * Un indicateur `neutre` reçoit un **écart** et jamais un verdict. E.3 interdit
 * de présenter un poids ou une humeur comme un progrès ; le catalogue étend la
 * règle au taux de bonnes réponses, qui dépend de la difficulté tirée, et au
 * niveau estimé, qui n'est pas une note de valeur. L'écart est un fait, le
 * verdict est une opinion : les deux ne se rendent pas ensemble.
 *
 * ## La résolution se dégrade avec l'ancienneté
 *
 * Une série de cinq ans au jour près fait deux mille points, dont personne ne
 * lira les mille huit cents premiers et qui pèsent lourd dans un export. Les
 * trente derniers jours restent au jour, l'année au la semaine, au-delà au
 * mois. La règle est **déclarée** et non choisie à l'affichage, pour que deux
 * écrans ne dégradent pas différemment la même série.
 */
import type { Evaluation, Fenetre, Indicateur } from './indicateurs';
import { INDICATEURS, evaluer, joursDeLaFenetre } from './indicateurs';
import { SEUIL_EXPLOITABLE } from './fiabilite';

const JOUR_MS = 86_400_000;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const jour = (s: string) => Date.parse(`${s}T00:00:00Z`);

/* ══════════════════════════════════════════════════════════════════════════
   Les périodes
   ══════════════════════════════════════════════════════════════════════════ */

export type TypePeriode = 'semaine' | 'mois' | 'trimestre' | 'annee' | 'libre';

export interface Periode {
  type: TypePeriode;
  /** Premier jour logique, inclus. */
  de: string;
  /** Dernier jour logique, inclus. */
  a: string;
  /** Le nom de la période, en français : « semaine du 12 octobre 2026 ». */
  libelle: string;
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const enFrancais = (j: string): string => {
  const [a, m, d] = j.split('-').map(Number);
  return `${d} ${MOIS[(m ?? 1) - 1]} ${a}`;
};

/**
 * La période qui contient ce jour logique.
 *
 * Les bornes sont **calendaires** et non glissantes : « cette semaine » est la
 * semaine du lundi au dimanche, pas les sept derniers jours. Une période
 * glissante ne se compare pas à la précédente — elles se chevauchent — et toute
 * la section 2 d'une synthèse repose sur cette comparaison.
 */
export function periode(type: TypePeriode, ancre: string): Periode {
  const t = jour(ancre);
  const date = new Date(t);
  const annee = date.getUTCFullYear();
  const mois = date.getUTCMonth();

  switch (type) {
    case 'semaine': {
      const recul = (date.getUTCDay() + 6) % 7;
      const de = iso(t - recul * JOUR_MS);
      const a = iso(t + (6 - recul) * JOUR_MS);
      return { type, de, a, libelle: `semaine du ${enFrancais(de)}` };
    }
    case 'mois': {
      const de = iso(Date.UTC(annee, mois, 1));
      const a = iso(Date.UTC(annee, mois + 1, 1) - JOUR_MS);
      return { type, de, a, libelle: `${MOIS[mois]} ${annee}` };
    }
    case 'trimestre': {
      const premier = Math.floor(mois / 3) * 3;
      const de = iso(Date.UTC(annee, premier, 1));
      const a = iso(Date.UTC(annee, premier + 3, 1) - JOUR_MS);
      return {
        type,
        de,
        a,
        libelle: `${premier / 3 + 1}ᵉ trimestre ${annee}`,
      };
    }
    case 'annee': {
      return {
        type,
        de: iso(Date.UTC(annee, 0, 1)),
        a: iso(Date.UTC(annee + 1, 0, 1) - JOUR_MS),
        libelle: `année ${annee}`,
      };
    }
    case 'libre':
      return { type, de: ancre, a: ancre, libelle: `journée du ${enFrancais(ancre)}` };
  }
}

/** Une période libre, bornée à la main. */
export const periodeLibre = (de: string, a: string): Periode => ({
  type: 'libre',
  de,
  a,
  libelle: `du ${enFrancais(de)} au ${enFrancais(a)}`,
});

/** La période de même type qui précède immédiatement celle-ci. */
export function precedente(p: Periode): Periode {
  if (p.type === 'libre') {
    const duree = Math.round((jour(p.a) - jour(p.de)) / JOUR_MS) + 1;
    return periodeLibre(iso(jour(p.de) - duree * JOUR_MS), iso(jour(p.de) - JOUR_MS));
  }
  return periode(p.type, iso(jour(p.de) - JOUR_MS));
}

/* ══════════════════════════════════════════════════════════════════════════
   La synthèse
   ══════════════════════════════════════════════════════════════════════════ */

/** Sur quoi porte la synthèse. */
export type Portee =
  | { quoi: 'globale' }
  | { quoi: 'domaine'; domaine: string }
  | { quoi: 'transversale' };

export interface CouvertureDomaine {
  domaine: string;
  /** Indicateurs du domaine qui rendent une mesure. */
  mesures: number;
  /** Indicateurs du domaine déclarés au catalogue. */
  declares: number;
  /** Combien sont au-dessus du seuil d'exploitabilité. */
  exploitables: number;
}

export interface Manque {
  indicateur: string;
  libelle: string;
  pourquoi: string;
}

export interface Synthese {
  periode: Periode;
  portee: Portee;
  /** Les évaluations retenues, dans l'ordre du catalogue. */
  evaluations: Evaluation[];
  /** Part des indicateurs du périmètre qui rendent une mesure. */
  couverture: number;
  parDomaine: CouvertureDomaine[];
  /** Ce qui n'a pas pu être mesuré, et pourquoi. */
  manques: Manque[];
}

const dansLaPortee = (indic: Indicateur, portee: Portee): boolean => {
  if (portee.quoi === 'globale') return true;
  if (portee.quoi === 'transversale') return indic.domaine === 'transverse';
  return indic.domaine === portee.domaine;
};

/**
 * La synthèse d'une période.
 *
 * La fenêtre passée doit porter les bornes de la période : c'est l'appelant qui
 * rassemble les données, et lui seul sait les lire. La synthèse vérifie
 * l'accord et le dit plutôt que de calculer sur une fenêtre qui ne correspond
 * pas — une synthèse de septembre calculée sur les faits d'octobre serait
 * indiscernable d'une synthèse juste.
 */
export function synthese(
  p: Periode,
  fenetre: Fenetre,
  portee: Portee = { quoi: 'globale' },
): Synthese {
  if (fenetre.de !== p.de || fenetre.a !== p.a) {
    throw new Error(
      `La fenêtre (${fenetre.de} → ${fenetre.a}) ne couvre pas la période (${p.de} → ${p.a}).`,
    );
  }

  const retenus = INDICATEURS.filter((i) => dansLaPortee(i, portee));
  const evaluations = retenus.map((i) => evaluer(i, fenetre));

  const manques: Manque[] = evaluations
    .filter((e) => !e.mesure)
    .map((e) => ({
      indicateur: e.indicateur.id,
      libelle: e.indicateur.libelle,
      pourquoi: e.pourquoi ?? 'Pas de donnée.',
    }));

  const domaines = [...new Set(retenus.map((i) => i.domaine))];
  const parDomaine = domaines.map((domaine): CouvertureDomaine => {
    const dedans = evaluations.filter((e) => e.indicateur.domaine === domaine);
    return {
      domaine,
      mesures: dedans.filter((e) => e.mesure).length,
      declares: dedans.length,
      exploitables: dedans.filter(
        (e) => e.fiabilite && e.fiabilite.valeur >= SEUIL_EXPLOITABLE,
      ).length,
    };
  });

  return {
    periode: p,
    portee,
    evaluations,
    couverture: retenus.length
      ? evaluations.filter((e) => e.mesure).length / retenus.length
      : 0,
    parDomaine,
    manques,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Comparer deux périodes
   ══════════════════════════════════════════════════════════════════════════ */

/** Le verdict d'une comparaison. `aucun` pour un indicateur neutre. */
export type Verdict = 'mieux' | 'moins-bien' | 'stable' | 'aucun';

export interface Comparaison {
  indicateur: string;
  libelle: string;
  avant: number | null;
  apres: number | null;
  /** L'écart absolu, ou `null` si l'une des deux mesures manque. */
  ecart: number | null;
  /**
   * Le verdict, ou `aucun` pour un indicateur que le catalogue dit neutre.
   *
   * L'écart est un fait, le verdict est une opinion : les deux ne se rendent
   * pas ensemble. Un indicateur neutre porte donc son écart et pas de flèche.
   */
  verdict: Verdict;
}

/** En deçà de cette part de variation, on dit « stable » plutôt qu'un sens. */
export const SEUIL_DE_STABILITE = 0.05;

export function comparer(courante: Synthese, avant: Synthese): Comparaison[] {
  const anciennes = new Map(avant.evaluations.map((e) => [e.indicateur.id, e]));
  return courante.evaluations.map((e): Comparaison => {
    const ancienne = anciennes.get(e.indicateur.id);
    const apres = e.mesure?.valeur ?? null;
    const avantValeur = ancienne?.mesure?.valeur ?? null;
    const base = {
      indicateur: e.indicateur.id,
      libelle: e.indicateur.libelle,
      avant: avantValeur,
      apres,
    };
    if (apres === null || avantValeur === null) {
      return { ...base, ecart: null, verdict: 'aucun' };
    }
    const ecart = apres - avantValeur;
    if (e.indicateur.sens === 'neutre') return { ...base, ecart, verdict: 'aucun' };
    const reference = Math.abs(avantValeur) || 1;
    if (Math.abs(ecart) / reference < SEUIL_DE_STABILITE) {
      return { ...base, ecart, verdict: 'stable' };
    }
    const monte = ecart > 0;
    const bien = e.indicateur.sens === 'haut-mieux' ? monte : !monte;
    return { ...base, ecart, verdict: bien ? 'mieux' : 'moins-bien' };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Les séries, à résolution dégradée
   ══════════════════════════════════════════════════════════════════════════ */

/** Au jour près en deçà. */
export const JOURS_AU_JOUR = 30;
/** À la semaine jusque-là. */
export const JOURS_A_LA_SEMAINE = 365;

export type Resolution = 'jour' | 'semaine' | 'mois';

export interface Point {
  jour: string;
  valeur: number;
}

export interface PointDegrade {
  /** Le premier jour du pas : le jour, le lundi, ou le premier du mois. */
  jour: string;
  resolution: Resolution;
  /** La moyenne des points du pas — jamais leur somme. */
  valeur: number;
  /** Combien de points d'origine ont été fondus ici. */
  points: number;
}

/** La résolution d'un jour, selon son ancienneté. */
export function resolutionDe(jourMesure: string, aujourdhui: string): Resolution {
  const age = Math.round((jour(aujourdhui) - jour(jourMesure)) / JOUR_MS);
  if (age <= JOURS_AU_JOUR) return 'jour';
  if (age <= JOURS_A_LA_SEMAINE) return 'semaine';
  return 'mois';
}

const pasDe = (jourMesure: string, resolution: Resolution): string => {
  if (resolution === 'jour') return jourMesure;
  const t = jour(jourMesure);
  if (resolution === 'semaine') {
    const recul = (new Date(t).getUTCDay() + 6) % 7;
    return iso(t - recul * JOUR_MS);
  }
  return `${jourMesure.slice(0, 7)}-01`;
};

/**
 * Dégrade une série : au jour sur un mois, à la semaine sur un an, au mois
 * au-delà.
 *
 * La valeur d'un pas est la **moyenne** et non la somme, et c'est la décision du
 * module : une somme mensuelle à côté de valeurs journalières produirait un
 * graphique où les anciens mois écrasent les jours récents, et une courbe de
 * régularité additionnée n'a aucun sens. La moyenne garde l'unité intacte.
 */
export function serieDegradee(points: readonly Point[], aujourdhui: string): PointDegrade[] {
  const pas = new Map<string, { jour: string; resolution: Resolution; somme: number; n: number }>();
  for (const point of points) {
    const resolution = resolutionDe(point.jour, aujourdhui);
    const clef = pasDe(point.jour, resolution);
    const vu = pas.get(clef);
    if (vu) {
      vu.somme += point.valeur;
      vu.n += 1;
    } else {
      pas.set(clef, { jour: clef, resolution, somme: point.valeur, n: 1 });
    }
  }
  return [...pas.values()]
    .sort((a, b) => (a.jour < b.jour ? -1 : 1))
    .map((p) => ({
      jour: p.jour,
      resolution: p.resolution,
      valeur: p.somme / p.n,
      points: p.n,
    }));
}

/** Les jours d'une période, pour qu'un appelant sache quoi rassembler. */
export const joursDeLaPeriode = (p: Periode): string[] => joursDeLaFenetre(p.de, p.a);
