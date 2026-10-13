/**
 * Des enregistrements des branches aux séries d'indicateurs — phase 3.
 *
 * Le moteur attend, pour chaque indicateur, **une valeur par jour**. Les
 * branches, elles, enregistrent des nuits, des séances, des sessions. Ce
 * module fait le passage, et c'est le seul endroit où il se fait.
 *
 * ## La convention roulante, et pourquoi elle était nécessaire
 *
 * Plusieurs indicateurs du catalogue sont naturellement des grandeurs **de
 * fenêtre** : « nombre de nuits courtes », « séances par semaine », « part
 * des séances abandonnées ». Prises au jour, elles valent 0 ou 1, et la
 * médiane d'une série de 0 et de 1 ne dit rien — elle vaut 0 tant que moins
 * de la moitié des jours sont à 1, puis saute à 1.
 *
 * Elles sont donc calculées **en roulant sur sept jours** : la valeur du jour
 * d est l'agrégat des sept jours qui finissent en d. On obtient une grandeur
 * journalière dont la médiane a un sens, et dont la ligne de base se calcule
 * comme les autres. Le prix est que l'indicateur réagit avec une semaine
 * d'inertie — ce qui, pour un dispositif qui exige de toute façon dix à
 * vingt-et-un jours de persistance, ne coûte rien.
 *
 * ## L'irrégularité se mesure localement
 *
 * « Irrégularité du coucher » n'est pas une valeur du jour : c'est une
 * dispersion. Elle est calculée comme l'écart du jour à la médiane locale,
 * sur une fenêtre centrée de sept jours. Une personne régulière y reste près
 * de zéro ; une personne dont les heures partent dans tous les sens y monte,
 * **même si sa moyenne ne bouge pas** — ce qui est précisément ce que la
 * littérature fait remonter le plus nettement.
 *
 * ## Ce qu'il ne fabrique pas
 *
 * Un indicateur dont la branche n'enregistre rien **n'apparaît pas** dans le
 * résultat. Il n'est pas mis à zéro : `suffisance()` le comptera parmi les
 * « jamais renseignés », l'écran le dira, et la veille se taira plutôt que
 * de lire une absence comme un comportement.
 */
import { heureLocale } from '../noyau/jour-logique';
import { journeesDUsage, type Session } from './usage';
import { mediane, type Mesure } from './veille';

/* ══════════════════════════════════════════════════════════════════════════
   Les entrées, réduites au strict nécessaire
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce que ce module lit, et rien de plus.
 *
 * Des formes minimales plutôt que les types des branches : le collecteur ne
 * doit pas pouvoir lire un intitulé de repas ou le titre d'une tâche, et le
 * meilleur moyen de s'en assurer est de ne pas les recevoir.
 */
export interface SourcesDeMesures {
  nuits?: readonly { jour: string; coucher: string; lever: string }[];
  repas?: readonly { jour: string; le: string }[];
  pesees?: readonly { jour: string; kg: number }[];
  seances?: readonly { jour: string; terminee: boolean }[];
  focus?: readonly { jour: string; secondes: number; interrompue: boolean }[];
  taches?: readonly { jour: string; reportee: boolean }[];
  evenements?: readonly { jour: string; annule: boolean }[];
  usage?: readonly Session[];
}

const ajouterJours = (jour: string, n: number) =>
  new Date(Date.parse(`${jour}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Tous les jours de `debut` à `fin`, bornes incluses. */
function calendrier(debut: string, fin: string): string[] {
  const out: string[] = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) out.push(j);
  return out;
}

const bornes = (jours: readonly string[]): [string, string] | null => {
  if (!jours.length) return null;
  const tries = [...jours].sort();
  return [tries[0], tries[tries.length - 1]];
};

export const JOURS_ROULANTS = 7;

/**
 * Une série roulante : pour chaque jour où il existe au moins une donnée dans
 * la fenêtre, l'agrégat des `JOURS_ROULANTS` jours qui s'y terminent.
 *
 * Les jours sans **aucune** donnée dans leur fenêtre sont omis, jamais mis à
 * zéro. C'est la règle de tout le dispositif : une absence n'est pas un
 * comportement.
 */
function roulant<T extends { jour: string }>(
  elements: readonly T[],
  agreger: (lot: readonly T[]) => number | null,
  jours = JOURS_ROULANTS,
): Mesure[] {
  const limites = bornes(elements.map((e) => e.jour));
  if (!limites) return [];
  const out: Mesure[] = [];
  for (const jour of calendrier(limites[0], limites[1])) {
    const debut = ajouterJours(jour, -(jours - 1));
    const lot = elements.filter((e) => e.jour >= debut && e.jour <= jour);
    if (!lot.length) continue;
    const valeur = agreger(lot);
    if (valeur !== null) out.push({ jour, valeur });
  }
  return out;
}

/** Une valeur par jour, à partir des éléments de ce jour-là seulement. */
function parJour<T extends { jour: string }>(
  elements: readonly T[],
  agreger: (lot: readonly T[]) => number | null,
): Mesure[] {
  const paquets = new Map<string, T[]>();
  for (const e of elements) {
    const lot = paquets.get(e.jour) ?? [];
    lot.push(e);
    paquets.set(e.jour, lot);
  }
  const out: Mesure[] = [];
  for (const jour of [...paquets.keys()].sort()) {
    const valeur = agreger(paquets.get(jour)!);
    if (valeur !== null) out.push({ jour, valeur });
  }
  return out;
}

/**
 * L'écart de chaque jour à la médiane locale, sur une fenêtre **centrée**.
 *
 * C'est la mesure d'irrégularité. Centrée et non glissante vers l'arrière :
 * une personne qui change de rythme d'un coup doit voir l'irrégularité monter
 * autour du changement, pas une semaine après.
 */
function irregularite(valeurs: readonly Mesure[], jours = JOURS_ROULANTS): Mesure[] {
  const demi = Math.floor(jours / 2);
  const out: Mesure[] = [];
  for (const m of valeurs) {
    const debut = ajouterJours(m.jour, -demi);
    const fin = ajouterJours(m.jour, demi);
    const voisins = valeurs.filter((v) => v.jour >= debut && v.jour <= fin).map((v) => v.valeur);
    if (voisins.length < 3) continue;
    const centre = mediane(voisins);
    if (centre === null) continue;
    out.push({ jour: m.jour, valeur: Math.abs(m.valeur - centre) });
  }
  return out;
}

const part = <T>(lot: readonly T[], predicat: (x: T) => boolean) =>
  lot.length ? lot.filter(predicat).length / lot.length : null;

/**
 * Heures décimales d'un instant, dans le fuseau de l'application.
 *
 * `heureLocale` du noyau, et non `getHours()`. La différence n'est pas
 * théorique : `getHours()` rend l'heure de la machine, et le journal d'usage,
 * lui, passe déjà par `heureLocale` en Europe/Paris. Les deux auraient
 * cohabité dans le même calcul — une session de 3 h du matin aurait été
 * nocturne pour un indicateur et diurne pour l'autre, selon le fuseau de
 * l'appareil. Le défaut s'est produit, et c'est un essai qui l'a montré.
 */
const heureLocaleDe = (iso: string): number => {
  const h = heureLocale(new Date(iso));
  return h.heure + h.minute / 60;
};

/**
 * L'heure de coucher, en **heures écoulées depuis 18 h**.
 *
 * Voir le catalogue : en heures d'horloge, un coucher repoussé de 23 h à 3 h
 * donne une valeur qui chute de vingt, et se lit comme une amélioration.
 */
export const ANCRE_DU_COUCHER = 18;
export const heuresDepuisLAncre = (iso: string): number => {
  const h = heureLocaleDe(iso);
  return h >= ANCRE_DU_COUCHER ? h - ANCRE_DU_COUCHER : h + 24 - ANCRE_DU_COUCHER;
};

/* ══════════════════════════════════════════════════════════════════════════
   La construction
   ══════════════════════════════════════════════════════════════════════════ */

export function construireLesMesures(sources: SourcesDeMesures): Record<string, Mesure[]> {
  const out: Record<string, Mesure[]> = {};
  const poser = (id: string, mesures: Mesure[]) => {
    if (mesures.length) out[id] = mesures;
  };

  /* ── Sommeil ─────────────────────────────────────────────────────────── */
  if (sources.nuits?.length) {
    const nuits = sources.nuits;
    const durees = parJour(nuits, (lot) =>
      mediane(lot.map((n) => (Date.parse(n.lever) - Date.parse(n.coucher)) / 3_600_000)),
    );
    poser('sommeil.duree', durees);

    const couchers = parJour(nuits, (lot) => mediane(lot.map((n) => heuresDepuisLAncre(n.coucher))));
    poser('sommeil.phase', couchers);
    poser('sommeil.irregularite', irregularite(couchers));

    poser(
      'sommeil.nuits-courtes',
      roulant(nuits, (lot) =>
        lot.filter((n) => (Date.parse(n.lever) - Date.parse(n.coucher)) / 3_600_000 < 6).length,
      ),
    );
  }

  /* ── Activité ────────────────────────────────────────────────────────── */
  if (sources.seances?.length) {
    const seances = sources.seances;
    poser('sport.frequence', roulant(seances, (lot) => lot.filter((s) => s.terminee).length));
    poser('sport.abandons', roulant(seances, (lot) => part(lot, (s) => !s.terminee)));
  }

  /* ── Rythme et usage ─────────────────────────────────────────────────── */
  if (sources.usage?.length) {
    const journees = journeesDUsage(sources.usage);
    poser(
      'usage.heure-tardive',
      journees.map((j) => ({ jour: j.jour, valeur: j.partTardive })),
    );
    poser(
      'usage.duree',
      journees
        .filter((j) => j.dureeMediane !== null)
        .map((j) => ({ jour: j.jour, valeur: j.dureeMediane! / 60 })),
    );
    poser(
      'usage.fragmentation',
      journees.map((j) => ({ jour: j.jour, valeur: j.sessions })),
    );
    poser(
      'jour.amplitude',
      journees
        .filter((j) => j.amplitude !== null)
        .map((j) => ({ jour: j.jour, valeur: j.amplitude! })),
    );
    const debuts = journees
      .filter((j) => j.premiereTrace !== null)
      .map((j) => ({ jour: j.jour, valeur: j.premiereTrace! }));
    poser('jour.irregularite-debut', irregularite(debuts));
  }

  /* ── Engagement ──────────────────────────────────────────────────────── */
  if (sources.focus?.length) {
    const focus = sources.focus;
    poser(
      'focus.minutes',
      parJour(focus, (lot) => lot.reduce((s, f) => s + f.secondes, 0) / 60),
    );
    poser('focus.abandons', roulant(focus, (lot) => part(lot, (f) => f.interrompue)));
  }
  if (sources.taches?.length) {
    poser('taches.report', roulant(sources.taches, (lot) => part(lot, (t) => t.reportee)));
  }

  /* ── Agenda et lien ──────────────────────────────────────────────────── */
  if (sources.evenements?.length) {
    const evenements = sources.evenements;
    poser('agenda.annulations', roulant(evenements, (lot) => part(lot, (e) => e.annule)));
    poser('agenda.densite', roulant(evenements, (lot) => lot.length));
  }

  /* ── Corps ───────────────────────────────────────────────────────────── */
  if (sources.repas?.length) {
    const heures = parJour(sources.repas, (lot) => mediane(lot.map((r) => heureLocaleDe(r.le))));
    poser('repas.regularite', irregularite(heures));
  }
  if (sources.pesees?.length) {
    const poids = parJour(sources.pesees, (lot) => mediane(lot.map((p) => p.kg)));
    /*
       La variation est rapportée à la dispersion habituelle, comme le dit le
       catalogue : la valeur du jour est l'écart au poids d'il y a trente
       jours, en kilogrammes. Le moteur la standardisera ensuite contre la
       base de la personne — un kilogramme ne veut pas dire la même chose
       chez tout le monde.
    */
    const parJourDePoids = new Map(poids.map((m) => [m.jour, m.valeur]));
    const variation: Mesure[] = [];
    for (const m of poids) {
      const avant = parJourDePoids.get(ajouterJours(m.jour, -30));
      if (avant === undefined) continue;
      variation.push({ jour: m.jour, valeur: Math.abs(m.valeur - avant) });
    }
    poser('poids.variation', variation);
  }

  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   Ce qui n'est pas encore collecté
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les indicateurs du catalogue qu'aucune branche n'alimente aujourd'hui.
 *
 * La liste est **déclarée** plutôt que devinée, pour deux raisons. D'abord
 * l'écran « Ce que la veille regarde » doit pouvoir dire « déclaré, pas
 * encore alimenté » au lieu de laisser croire que l'indicateur est muet faute
 * de données. Ensuite, un essai compare cette liste à ce que le collecteur
 * produit réellement : le jour où une branche se met à alimenter l'un d'eux
 * sans qu'on retire la ligne, l'essai le dira.
 */
export const NON_COLLECTES: readonly string[] = [
  // Demande de reconnaître l'arrêt d'une pratique installée : il faut
  // d'abord savoir ce qu'est une pratique installée, ce que Sport ne dit pas.
  'sport.rupture',
  // La question « pourquoi » n'est pas encore posée sur une tâche non faite.
  'taches.sans-motif',
  // Les révisions n'exposent pas encore d'intervalle entre séances.
  'revisions.regularite',
  // Aucun enregistrement d'interaction n'existe, et c'est très bien ainsi
  // tant que personne ne l'a demandé.
  'lien.interactions',
  // Un repas « attendu » suppose des repas attendus déclarés.
  'repas.sautes',
];
