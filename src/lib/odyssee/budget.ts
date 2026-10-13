/**
 * Le budget : le **prévu**, par opposition au réel que porte `finances.ts`.
 *
 * ## Une ligne est une suite de versions, jamais une valeur
 *
 * Un loyer n'est pas « 780 € ». C'est « 740 € jusqu'en mars 2026, puis 780 ».
 * Écraser l'ancien montant au déménagement rendrait faux **tout l'historique
 * des écarts** : janvier se comparerait soudain à un loyer qui n'existait pas
 * encore, et les six premiers mois de l'année deviendraient anormaux du jour
 * au lendemain.
 *
 * Chaque version porte donc ses dates, et une occurrence est évaluée avec la
 * version **en vigueur à sa date**. Corriger une faute de frappe d'hier et
 * déménager demain sont deux gestes différents : le premier remplace une
 * version, le second en ajoute une.
 *
 * ## Les occurrences sont dérivées, et déterministes
 *
 * Elles ne sont **jamais stockées** : deux appareils qui les enregistreraient
 * les fusionneraient, alors qu'ils peuvent les recalculer à l'identique depuis
 * la même ligne. C'est la règle du prompt de synchronisation — les états
 * dérivés se recalculent, ils ne voyagent pas.
 *
 * Déterministe veut dire : mêmes entrées, mêmes dates, toujours, quels que
 * soient le fuseau, l'heure d'été et le mois en cours. Les calculs se font
 * donc en dates civiles pures, jamais par arithmétique sur des instants.
 *
 * ## Tout est en centimes entiers
 *
 * Voir `finances.ts`. Et la mensualisation d'une charge annuelle répartit son
 * reste de division : douze provisions dont la somme fait **exactement**
 * l'annuel, et non douze arrondis qui laissent deux centimes dans le vide.
 */
import type { Centimes } from './finances';

/* ══════════════════════════════════════════════════════════════════════════
   Les dates, en civil pur
   ══════════════════════════════════════════════════════════════════════════ */

const JOURS_PAR_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const bissextile = (an: number): boolean =>
  (an % 4 === 0 && an % 100 !== 0) || an % 400 === 0;

export function joursDansLeMois(an: number, mois: number): number {
  return mois === 2 && bissextile(an) ? 29 : JOURS_PAR_MOIS[mois - 1];
}

const jour = (j: string) => ({
  an: Number(j.slice(0, 4)),
  mois: Number(j.slice(5, 7)),
  j: Number(j.slice(8, 10)),
});

const ecrire = (an: number, mois: number, j: number) =>
  `${String(an).padStart(4, '0')}-${String(mois).padStart(2, '0')}-${String(j).padStart(2, '0')}`;

/**
 * Le jour `attendu` du mois (an, mois), **ramené au dernier jour s'il déborde**.
 *
 * Un prélèvement « le 31 » tombe le 30 en avril et le 28 ou 29 en février.
 * L'alternative — reporter au 1er du mois suivant — déplacerait l'échéance
 * dans une autre période budgétaire, et ferait apparaître un mois à zéro suivi
 * d'un mois à deux loyers.
 */
export function jourDuMois(an: number, mois: number, attendu: number): string {
  return ecrire(an, mois, Math.min(attendu, joursDansLeMois(an, mois)));
}

/** Avance de `n` mois, en gardant le jour attendu et en le ramenant si besoin. */
export function ajouterMois(depuis: string, n: number, attendu?: number): string {
  const d = jour(depuis);
  const total = (d.an * 12 + (d.mois - 1)) + n;
  const an = Math.floor(total / 12);
  const mois = (total % 12) + 1;
  return jourDuMois(an, mois, attendu ?? d.j);
}

export function ajouterJours(depuis: string, n: number): string {
  const d = jour(depuis);
  let { an, mois, j: x } = d;
  x += n;
  for (;;) {
    const dans = joursDansLeMois(an, mois);
    if (x <= dans) break;
    x -= dans;
    mois += 1;
    if (mois > 12) { mois = 1; an += 1; }
  }
  while (x < 1) {
    mois -= 1;
    if (mois < 1) { mois = 12; an -= 1; }
    x += joursDansLeMois(an, mois);
  }
  return ecrire(an, mois, x);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les lignes de budget
   ══════════════════════════════════════════════════════════════════════════ */

export type Sens = 'ressource' | 'charge';

export type Periodicite =
  | 'hebdomadaire'
  | 'mensuelle'
  | 'trimestrielle'
  | 'annuelle'
  | 'ponctuelle';

/** Combien de fois par an, pour les totaux. `null` pour une ponctuelle. */
export const PAR_AN: Record<Periodicite, number | null> = {
  hebdomadaire: 52,
  mensuelle: 12,
  trimestrielle: 4,
  annuelle: 1,
  ponctuelle: null,
};

export type Nature = 'fixe' | 'estime' | 'fourchette';

export interface Tolerance {
  /** En centimes, et en pour cent : la plus large des deux s'applique. */
  centimes: Centimes;
  pourCent: number;
  /** Nombre de jours de part et d'autre du jour attendu. */
  jours: number;
}

export const TOLERANCE_PAR_DEFAUT: Tolerance = { centimes: 200, pourCent: 2, jours: 2 };

/**
 * La largeur réelle de la tolérance sur un montant donné.
 *
 * « La plus grande des deux » : 2 % d'un abonnement à 9,99 € font 20 centimes,
 * ce qui exigerait une exactitude que la vie n'a pas. Et 2 € sur un loyer de
 * 780 € sont trop stricts dans l'autre sens. Chacun rattrape l'échelle où
 * l'autre échoue.
 */
export function largeurTolerance(montant: Centimes, t: Tolerance): Centimes {
  return Math.max(t.centimes, Math.round((Math.abs(montant) * t.pourCent) / 100));
}

export interface VersionDeLigne {
  /** Premier jour où cette version s'applique. */
  depuis: string;
  /** Dernier jour inclus, ou `null` si elle court toujours. */
  jusqua: string | null;
  montant: Centimes;
  nature: Nature;
  /** Pour une fourchette : la borne haute. Sinon `null`. */
  montantHaut: Centimes | null;
  periodicite: Periodicite;
  /** Jour du mois attendu (1 à 31), ou jour de la semaine (1 = lundi) si hebdomadaire. */
  jourAttendu: number;
  tolerance: Tolerance;
}

export interface LigneBudget {
  id: string;
  libelle: string;
  categorie: string;
  sens: Sens;
  /** Le compte concerné, ou `null` si la ligne n'en vise aucun. */
  compteId: string | null;
  /** Déclaratif, jamais déduit : c'est un jugement, pas une mesure. */
  essentielle: boolean;
  /** Fragments cherchés dans les libellés d'opération, pour l'appariement. */
  motifs: readonly string[];
  /** Triées par `depuis` croissant. Au moins une. */
  versions: readonly VersionDeLigne[];
  note: string;
  majLe: string;
}

export function controlerLigne(l: LigneBudget): string[] {
  const problemes: string[] = [];
  if (!l.libelle.trim()) problemes.push('Une ligne de budget a un libellé.');
  if (!l.versions.length) problemes.push('Une ligne de budget a au moins une version.');

  const triees = [...l.versions].sort((a, b) => a.depuis.localeCompare(b.depuis));
  for (const [i, v] of triees.entries()) {
    if (!Number.isInteger(v.montant)) problemes.push('Un montant se compte en centimes entiers.');
    if (v.montant < 0) {
      problemes.push(
        'Un montant de ligne est positif : c’est le sens (ressource ou charge) qui le signe.',
      );
    }
    if (v.nature === 'fourchette' && (v.montantHaut === null || v.montantHaut < v.montant)) {
      problemes.push('Une fourchette a une borne haute supérieure à la basse.');
    }
    if (v.nature !== 'fourchette' && v.montantHaut !== null) {
      problemes.push('Seule une fourchette porte une borne haute.');
    }
    if (v.jusqua && v.jusqua < v.depuis) problemes.push('Une version se termine après son début.');
    /*
       Le chevauchement, et non le trou. Deux versions qui se recouvrent
       rendent une occurrence ambiguë — deux montants pour la même date, et
       rien pour trancher. Un trou, lui, est licite : une charge suspendue
       trois mois n'a pas d'occurrence pendant ces trois mois, et c'est ce
       qu'on veut dire.
    */
    const suivante = triees[i + 1];
    if (suivante && v.jusqua !== null && suivante.depuis <= v.jusqua) {
      problemes.push(`Deux versions se chevauchent à partir du ${suivante.depuis}.`);
    }
    if (suivante && v.jusqua === null) {
      problemes.push('Une version ouverte ne peut pas être suivie d’une autre.');
    }
    const max = v.periodicite === 'hebdomadaire' ? 7 : 31;
    if (v.jourAttendu < 1 || v.jourAttendu > max) {
      problemes.push(`Le jour attendu va de 1 à ${max} pour une ligne ${v.periodicite}.`);
    }
  }
  return problemes;
}

/** La version en vigueur un jour donné, ou `null` s'il n'y en a aucune. */
export function versionAu(l: LigneBudget, j: string): VersionDeLigne | null {
  return (
    l.versions.find((v) => v.depuis <= j && (v.jusqua === null || j <= v.jusqua)) ?? null
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Les occurrences
   ══════════════════════════════════════════════════════════════════════════ */

export interface Occurrence {
  /** Déterministe : `<ligne>:<jour>`. Deux appareils calculent le même. */
  id: string;
  ligneId: string;
  jour: string;
  montant: Centimes;
  /** Signé pour les totaux : négatif pour une charge. */
  signe: -1 | 1;
  /** La fenêtre d'appariement, bornes incluses. */
  du: string;
  au: string;
  tolerance: Centimes;
}

/**
 * Les occurrences d'une ligne entre deux jours, bornes incluses.
 *
 * Le point de départ n'est pas « aujourd'hui » : c'est le `depuis` de la
 * version, replacé dans la période demandée. Sans cela, demander les
 * occurrences de mars donnerait un résultat différent selon le jour où on les
 * demande — et deux appareils n'auraient pas la même liste.
 */
export function occurrences(ligne: LigneBudget, du: string, au: string): Occurrence[] {
  const sorties: Occurrence[] = [];
  const signe: -1 | 1 = ligne.sens === 'charge' ? -1 : 1;

  for (const v of ligne.versions) {
    const debut = v.depuis > du ? v.depuis : du;
    const fin = v.jusqua !== null && v.jusqua < au ? v.jusqua : au;
    if (debut > fin) continue;

    const poser = (j: string) => {
      if (j < debut || j > fin) return;
      sorties.push({
        id: `${ligne.id}:${j}`,
        ligneId: ligne.id,
        jour: j,
        montant: v.montant,
        signe,
        du: ajouterJours(j, -v.tolerance.jours),
        au: ajouterJours(j, v.tolerance.jours),
        tolerance: largeurTolerance(v.montant, v.tolerance),
      });
    };

    if (v.periodicite === 'ponctuelle') {
      poser(v.depuis);
      continue;
    }
    if (v.periodicite === 'hebdomadaire') {
      /*
         On part du premier jour de la fenêtre qui tombe le bon jour de la
         semaine, et non du `depuis` : une ligne ouverte en 2024 et consultée
         en 2026 ne doit pas faire boucler cent quatre fois pour rien.
      */
      const d = new Date(`${debut}T12:00:00.000Z`);
      const actuel = ((d.getUTCDay() + 6) % 7) + 1; // 1 = lundi
      let j = ajouterJours(debut, (v.jourAttendu - actuel + 7) % 7);
      while (j <= fin) {
        poser(j);
        j = ajouterJours(j, 7);
      }
      continue;
    }

    const pas = v.periodicite === 'mensuelle' ? 1 : v.periodicite === 'trimestrielle' ? 3 : 12;
    /*
       L'ancre est le `depuis` de la version : une ligne trimestrielle ouverte
       en février tombe en février, mai, août, novembre — pas en janvier,
       avril, juillet, octobre. La phase appartient à la ligne, pas au
       calendrier.
    */
    const a = jour(v.depuis);
    const premierMois = a.an * 12 + (a.mois - 1);
    const f = jour(fin);
    const dernierMois = f.an * 12 + (f.mois - 1);
    for (let m = premierMois; m <= dernierMois; m += pas) {
      const an = Math.floor(m / 12);
      const mois = (m % 12) + 1;
      poser(jourDuMois(an, mois, v.jourAttendu));
    }
  }
  sorties.sort((x, y) => (x.jour === y.jour ? x.id.localeCompare(y.id) : x.jour.localeCompare(y.jour)));
  return sorties;
}

/* ══════════════════════════════════════════════════════════════════════════
   La mensualisation
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Répartit un montant en `n` parts entières dont la somme est **exacte**.
 *
 * 150 € en douze ne fait pas douze fois 12,50 € si l'on arrondit chaque part :
 * 150,00 / 12 = 12,50 tombe juste, mais 100 € en 12 donne 8,333…, et douze
 * fois 8,33 font 99,96 — quatre centimes évaporés par an, qui reviennent sous
 * forme d'un écart inexplicable au rapprochement.
 *
 * Le reste est donc réparti sur les premières parts, une unité chacune.
 */
export function repartir(montant: Centimes, n: number): Centimes[] {
  if (n <= 0) return [];
  const signe = montant < 0 ? -1 : 1;
  const absolu = Math.abs(montant);
  const base = Math.floor(absolu / n);
  const reste = absolu - base * n;
  return Array.from({ length: n }, (_, i) => signe * (base + (i < reste ? 1 : 0)));
}

/** La provision mensuelle d'une version, ou `null` pour une ponctuelle. */
export function provisionMensuelle(v: VersionDeLigne): Centimes | null {
  const parAn = PAR_AN[v.periodicite];
  if (parAn === null) return null;
  /*
     Par an d'abord, par mois ensuite, et la répartition rend la première
     part : c'est la plus grande, donc la provision affichée ne sous-estime
     jamais. Mieux vaut provisionner un centime de trop.
  */
  return repartir(v.montant * parAn, 12)[0];
}

/* ══════════════════════════════════════════════════════════════════════════
   Les totaux
   ══════════════════════════════════════════════════════════════════════════ */

export interface Totaux {
  ressources: Centimes;
  chargesFixes: Centimes;
  chargesVariables: Centimes;
  epargne: Centimes;
  /** `null` sans ressource : zéro divisé par zéro ne fait pas « 0 % ». */
  tauxEffort: number | null;
  tauxEpargne: number | null;
  resteAVivre: Centimes;
}

/** Les catégories que le reste à vivre retranche, au-delà des charges fixes. */
export const CATEGORIES_EPARGNE = ['épargne', 'investissement', 'épargne programmée'];

const estEpargne = (c: string) =>
  CATEGORIES_EPARGNE.some((e) => c.toLowerCase().includes(e.toLowerCase()));

/**
 * Les totaux mensuels, charges annuelles mensualisées.
 *
 * `resteAVivre` suit la formule retenue à la décision 4 : **ressources moins
 * charges fixes moins épargne programmée**. Les enveloppes variables n'en sont
 * pas retranchées — c'est dedans qu'on vit, et les retrancher donnerait un
 * reste à vivre qui ne reste à rien.
 *
 * La formule est un paramètre, pas une loi : `variablesComprises` la bascule,
 * et l'écran affiche laquelle est appliquée.
 */
export function totauxMensuels(
  lignes: readonly LigneBudget[],
  au: string,
  options: { variablesComprises?: boolean } = {},
): Totaux {
  let ressources = 0;
  let chargesFixes = 0;
  let chargesVariables = 0;
  let epargne = 0;

  for (const l of lignes) {
    const v = versionAu(l, au);
    if (!v) continue;
    const mensuel = provisionMensuelle(v);
    if (mensuel === null) continue; // une ponctuelle n'entre pas dans un total mensuel
    if (l.sens === 'ressource') ressources += mensuel;
    else if (estEpargne(l.categorie)) epargne += mensuel;
    else if (v.nature === 'fixe') chargesFixes += mensuel;
    else chargesVariables += mensuel;
  }

  const taux = (part: number) =>
    ressources === 0 ? null : Math.round((part / ressources) * 1000) / 10;

  const resteAVivre =
    ressources - chargesFixes - epargne - (options.variablesComprises ? chargesVariables : 0);

  return {
    ressources,
    chargesFixes,
    chargesVariables,
    epargne,
    tauxEffort: taux(chargesFixes),
    tauxEpargne: taux(epargne),
    resteAVivre,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   La trésorerie prévisionnelle
   ══════════════════════════════════════════════════════════════════════════ */

export interface PointDeTresorerie {
  jour: string;
  /** Le solde après les occurrences du jour. */
  solde: Centimes;
  mouvement: Centimes;
}

/**
 * Le solde prévisionnel jour par jour, à partir d'un solde de départ.
 *
 * C'est le **calendrier réel**, à distinguer de la moyenne lissée : avoir
 * 970 € de reste à vivre et avoir 970 € dont 780 partent le 5 ne sont pas la
 * même situation, et c'est la seconde qui fait découvrir un découvert.
 */
export function tresorerie(
  lignes: readonly LigneBudget[],
  depart: Centimes,
  du: string,
  au: string,
): PointDeTresorerie[] {
  const parJour = new Map<string, Centimes>();
  for (const l of lignes) {
    for (const o of occurrences(l, du, au)) {
      parJour.set(o.jour, (parJour.get(o.jour) ?? 0) + o.signe * o.montant);
    }
  }
  const points: PointDeTresorerie[] = [];
  let solde = depart;
  for (let j = du; j <= au; j = ajouterJours(j, 1)) {
    const mouvement = parJour.get(j) ?? 0;
    solde += mouvement;
    points.push({ jour: j, solde, mouvement });
  }
  return points;
}

/** Le premier jour où le solde prévisionnel passe sous zéro, s'il y en a un. */
export function premierDecouvert(points: readonly PointDeTresorerie[]): string | null {
  return points.find((p) => p.solde < 0)?.jour ?? null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les scénarios
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une copie de travail du budget, qui **ne touche jamais le réel**.
 *
 * Elle porte ses propres lignes. On aurait pu n'y mettre que les différences,
 * pour économiser ; mais un scénario qui référence les lignes réelles change
 * de sens quand on modifie une ligne réelle, et « et si je déménageais »
 * répondrait soudain autre chose sans que personne y ait touché.
 */
export interface Scenario {
  id: string;
  nom: string;
  /** Jour de la copie, pour dire à quoi on se compare. */
  copieLe: string;
  lignes: readonly LigneBudget[];
  majLe: string;
}

export interface Comparaison {
  champ: keyof Totaux;
  courant: number | null;
  scenario: number | null;
  ecart: number | null;
}

export function comparerAuCourant(
  courant: readonly LigneBudget[],
  scenario: Scenario,
  au: string,
): Comparaison[] {
  const a = totauxMensuels(courant, au);
  const b = totauxMensuels(scenario.lignes, au);
  const champs: (keyof Totaux)[] = [
    'ressources',
    'chargesFixes',
    'chargesVariables',
    'epargne',
    'resteAVivre',
    'tauxEffort',
    'tauxEpargne',
  ];
  return champs.map((champ) => {
    const x = a[champ];
    const y = b[champ];
    return {
      champ,
      courant: x,
      scenario: y,
      /* `null` si l'un des deux manque : un écart à une absence n'existe pas. */
      ecart: x === null || y === null ? null : Math.round((y - x) * 10) / 10,
    };
  });
}
