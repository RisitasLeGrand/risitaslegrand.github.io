/**
 * Des vies synthétiques, pour mesurer le taux de faux signaux.
 *
 * ## Le piège de cette mesure, et comment il est évité
 *
 * Mesurer un taux de faux signaux sur du bruit blanc ne mesure rien. Le bruit
 * blanc se moyenne : la médiane d'une fenêtre de quatorze jours de bruit
 * indépendant est presque toujours proche de zéro, et le dispositif
 * paraîtrait d'une spécificité parfaite. Ce serait une mesure flatteuse et
 * fausse.
 *
 * Une vraie vie est **autocorrélée**. Une mauvaise quinzaine existe : une
 * période chargée au travail, une grippe de la maisonnée, trois semaines de
 * chaleur. C'est exactement ce que le moteur doit apprendre à ne pas prendre
 * pour une dégradation, et c'est donc ce que ce générateur produit : une
 * composante lente de type AR(1), qui dérive et revient, par-dessus le bruit
 * du jour.
 *
 * ## Ce que « stable » veut dire ici
 *
 * Une personne dont **rien ne se dégrade** : pas de tendance, pas de rupture.
 * Elle a des semaines meilleures et des semaines pires, des week-ends
 * différents de ses mardis, des nuits ratées, et elle oublie de noter. Tout
 * signal levé sur une telle série est un faux signal, par construction — et
 * c'est la seule définition de « faux » dont on dispose, puisqu'il n'existe
 * aucune vérité terrain.
 *
 * ## Déterminisme
 *
 * Une graine donne toujours la même vie. Sans quoi deux exécutions rendraient
 * deux taux, et l'on ne saurait jamais si un écart vient d'un réglage ou du
 * tirage.
 */
import { CATALOGUE, type Mesure } from '../../src/lib/odyssee/veille.ts';

/** Générateur congruentiel linéaire, pour que la graine suffise. */
export function alea(graine = 1) {
  let etat = graine >>> 0 || 1;
  return () => {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    return etat / 4294967296;
  };
}

/** Deux uniformes donnent une normale centrée réduite. */
const normale = (r: () => number) => {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};

const ajouterJours = (jour: string, n: number) =>
  new Date(Date.parse(`${jour}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

const estWeekEnd = (jour: string) => {
  const j = new Date(`${jour}T12:00:00.000Z`).getUTCDay();
  return j === 0 || j === 6;
};

export interface Reglages {
  debut: string;
  jours: number;
  graine: number;
  /** Bruit du jour, en multiples du plancher de l'indicateur. */
  bruitDuJour: number;
  /** Amplitude de la composante lente, en multiples du plancher. */
  bruitLent: number;
  /** Persistance de la composante lente : 0,95 ≈ trois semaines de mémoire. */
  memoire: number;
  /** Part des jours non saisis, pour les indicateurs déclaratifs. */
  oublis: number;
  /** Part des jours franchement atypiques — une nuit blanche, un week-end. */
  joursAtypiques: number;
}

export const REGLAGES_REALISTES: Reglages = {
  debut: '2021-01-04',
  jours: 365 * 5,
  graine: 1,
  /*
     Deux planchers de bruit quotidien : pour le sommeil, dont le plancher est
     d'un quart d'heure, cela fait une demi-heure d'écart-type d'une nuit à
     l'autre. C'est l'ordre de grandeur qu'on observe chez quelqu'un de
     régulier.
  */
  bruitDuJour: 2,
  /*
     Un plancher et demi de composante lente : les bonnes et les mauvaises
     quinzaines. C'est le paramètre qui décide réellement du taux de faux
     signaux, et le mettre à zéro rendrait la mesure sans valeur.
  */
  bruitLent: 1.5,
  memoire: 0.95,
  oublis: 0.15,
  joursAtypiques: 0.04,
};

/**
 * Une vie stable sur `jours` jours.
 *
 * Les indicateurs observés (domaine du rythme) ne connaissent pas d'oubli :
 * ils sont produits par l'usage de l'application, pas par une saisie. C'est
 * la propriété qui fait tenir la veille quand quelqu'un cesse de remplir, et
 * la mesure doit la refléter.
 */
export function vieStable(reglages: Partial<Reglages> = {}): Record<string, Mesure[]> {
  const r = { ...REGLAGES_REALISTES, ...reglages };
  const sortie: Record<string, Mesure[]> = {};

  for (const [n, indicateur] of CATALOGUE.entries()) {
    const tirage = alea(r.graine * 7919 + n * 104729);
    const plancher = indicateur.plancherDeDispersion;
    // Un socle arbitraire mais stable : seul l'écart compte, pas le niveau.
    const socle = plancher * 40;
    // Les week-ends diffèrent, et la base les sépare : c'est fait exprès.
    const decalageWeekEnd = normale(tirage) * plancher * 3;

    let lent = 0;
    const mesures: Mesure[] = [];
    for (let d = 0; d < r.jours; d += 1) {
      const jour = ajouterJours(r.debut, d);
      lent = lent * r.memoire + normale(tirage) * r.bruitLent * plancher * Math.sqrt(1 - r.memoire ** 2);

      if (indicateur.saisie === 'declarative' && tirage() < r.oublis) continue;

      let valeur = socle + lent + normale(tirage) * r.bruitDuJour * plancher;
      if (estWeekEnd(jour)) valeur += decalageWeekEnd;
      // Un jour franchement atypique : une nuit blanche, un dimanche entier.
      if (tirage() < r.joursAtypiques) valeur += normale(tirage) * plancher * 8;

      mesures.push({ jour, valeur: Math.max(0, valeur) });
    }
    sortie[indicateur.id] = mesures;
  }
  return sortie;
}

/**
 * La même vie, qui se dégrade à partir de `leJour`, sur trois domaines.
 *
 * Elle ne sert pas à mesurer un taux de détection — il n'y en a pas — mais à
 * vérifier qu'un dispositif réglé pour se taire sur une vie stable n'est pas
 * devenu muet tout court. Un dispositif qui ne signale jamais rien a un taux
 * de faux signaux parfait, et ne sert à rien.
 */
export function vieQuiSeDegrade(
  leJour: number,
  ampleur = 4,
  reglages: Partial<Reglages> = {},
): Record<string, Mesure[]> {
  const r = { ...REGLAGES_REALISTES, ...reglages };
  const base = vieStable(reglages);
  const touches = ['sommeil.duree', 'usage.heure-tardive', 'focus.minutes'];
  const sortie: Record<string, Mesure[]> = { ...base };
  for (const id of touches) {
    const indicateur = CATALOGUE.find((i) => i.id === id)!;
    const sens = indicateur.sens === 'baisse' ? -1 : 1;
    const limite = ajouterJours(r.debut, leJour);
    sortie[id] = base[id].map((m) =>
      m.jour >= limite
        ? { ...m, valeur: Math.max(0, m.valeur + sens * ampleur * indicateur.plancherDeDispersion) }
        : m,
    );
  }
  return sortie;
}
