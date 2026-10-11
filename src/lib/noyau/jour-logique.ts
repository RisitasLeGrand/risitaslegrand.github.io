/**
 * Le jour logique : la journée bascule à 4 h, pas à minuit.
 *
 * ## Pourquoi
 *
 * Une séance de révision qui finit à 00 h 30 appartient à la soirée qui vient de
 * s'écouler, pas au jour qui commence. Compter minuit comme frontière casse une
 * série de jours chaque fois qu'on travaille tard, et scinde une séance en deux
 * journées statistiques.
 *
 * Quatre heures du matin est le réglage par défaut. Il est modifiable, et la
 * valeur a une conséquence technique qui mérite d'être connue — voir plus bas.
 *
 * ## Pourquoi `Intl` et pas une bibliothèque de fuseaux
 *
 * Le navigateur connaît déjà les fuseaux et leurs changements d'heure, par
 * `Intl.DateTimeFormat`. Embarquer une base de fuseaux ajouterait quelques
 * centaines de kilo-octets à un site qui en compte peu, et une base de fuseaux
 * se périme — les règles d'heure d'été changent par décision politique, pas par
 * nécessité physique.
 *
 * ## Les deux heures pathologiques, et pourquoi 4 h les évite
 *
 * En Europe/Paris, le passage à l'heure d'été fait sauter l'heure de 2 h à 3 h
 * le dernier dimanche de mars : **2 h 30 n'existe pas ce jour-là**. Le retour à
 * l'heure d'hiver rejoue l'heure de 2 h à 3 h le dernier dimanche d'octobre :
 * **2 h 30 existe deux fois**.
 *
 * Une bascule réglée à 4 h ne tombe jamais dans cette fenêtre, et c'est une des
 * raisons de ce défaut. Mais le réglage est libre, et quelqu'un peut le poser à
 * 2 h : les deux cas sont donc traités explicitement, avec une règle écrite —
 * une heure qui n'existe pas est prise à l'instant du saut, une heure qui existe
 * deux fois est prise à sa première occurrence. Choisir la première occurrence
 * donne une journée logique de 25 heures ce jour-là, ce qui est le moindre mal :
 * l'autre choix en donnerait une de 23 heures et perdrait une heure d'activité
 * réelle.
 */

/** L'heure de bascule par défaut, en heures locales. */
export const HEURE_BASCULE_PAR_DEFAUT = 4;

/** Le fuseau de référence. Déclaré, et non déduit du navigateur. */
export const FUSEAU_PAR_DEFAUT = 'Europe/Paris';

const JOUR_MS = 86_400_000;
const HEURE_MS = 3_600_000;

export interface ReglagesJourLogique {
  /** Heure de bascule, de 0 à 23. 0 revient à compter minuit. */
  heureBascule: number;
  fuseau: string;
}

export const REGLAGES_PAR_DEFAUT: ReglagesJourLogique = {
  heureBascule: HEURE_BASCULE_PAR_DEFAUT,
  fuseau: FUSEAU_PAR_DEFAUT,
};

/* ══════════════════════════════════════════════════════════════════════════
   Lecture d'un instant dans un fuseau
   ══════════════════════════════════════════════════════════════════════════ */

const formateurs = new Map<string, Intl.DateTimeFormat>();

function formateur(fuseau: string): Intl.DateTimeFormat {
  let f = formateurs.get(fuseau);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formateurs.set(fuseau, f);
  }
  return f;
}

export interface HeureLocale {
  annee: number;
  mois: number;
  jour: number;
  heure: number;
  minute: number;
  seconde: number;
}

/** L'heure murale d'un instant, dans un fuseau donné. */
export function heureLocale(instant: Date, fuseau = FUSEAU_PAR_DEFAUT): HeureLocale {
  const parties = formateur(fuseau).formatToParts(instant);
  const prendre = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parties.find((p) => p.type === type)?.value ?? '0');
  return {
    annee: prendre('year'),
    mois: prendre('month'),
    jour: prendre('day'),
    heure: prendre('hour'),
    minute: prendre('minute'),
    seconde: prendre('second'),
  };
}

/** Le décalage du fuseau à cet instant, en millisecondes. */
function decalage(instant: Date, fuseau: string): number {
  const l = heureLocale(instant, fuseau);
  const commeUtc = Date.UTC(l.annee, l.mois - 1, l.jour, l.heure, l.minute, l.seconde);
  // Les millisecondes ne sont pas rendues par le formateur : on les reprend de
  // l'instant, sans quoi le décalage serait faux de moins d'une seconde — assez
  // pour faire basculer un instant posé exactement sur la frontière.
  return commeUtc - (instant.getTime() - instant.getMilliseconds());
}

/* ══════════════════════════════════════════════════════════════════════════
   De l'instant au jour logique
   ══════════════════════════════════════════════════════════════════════════ */

const iso = (annee: number, mois: number, jour: number) =>
  `${String(annee).padStart(4, '0')}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;

/**
 * Le jour logique d'un instant, au format `AAAA-MM-JJ`.
 *
 * Avant l'heure de bascule, l'instant appartient au jour précédent.
 */
export function jourLogique(
  instant: Date = new Date(),
  reglages: Partial<ReglagesJourLogique> = {},
): string {
  const { heureBascule, fuseau } = { ...REGLAGES_PAR_DEFAUT, ...reglages };
  const l = heureLocale(instant, fuseau);
  if (l.heure >= heureBascule) return iso(l.annee, l.mois, l.jour);
  // La veille, calculée en UTC pour que le passage d'un mois ou d'une année ne
  // soit pas à refaire à la main.
  const veille = new Date(Date.UTC(l.annee, l.mois - 1, l.jour) - JOUR_MS);
  return iso(veille.getUTCFullYear(), veille.getUTCMonth() + 1, veille.getUTCDate());
}

/* ══════════════════════════════════════════════════════════════════════════
   Du jour logique à l'instant
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'instant où commence un jour logique.
 *
 * ## La conversion difficile
 *
 * Aller d'un instant à une heure murale est facile : `Intl` le fait. L'inverse
 * ne l'est pas, parce que le décalage du fuseau dépend de l'instant qu'on
 * cherche. La méthode est donc : supposer que le décalage est celui d'une
 * première approximation, corriger, et vérifier. Deux passes suffisent partout
 * sauf dans la fenêtre d'un changement d'heure, où la troisième lecture tranche.
 *
 * ## L'heure qui n'existe pas
 *
 * Si la bascule est réglée dans l'heure sautée au printemps, aucun instant ne
 * correspond à cette heure murale. La fonction rend alors **l'instant du saut**
 * lui-même : la journée logique commence au premier moment où elle peut
 * commencer. Rendre `null` aurait obligé chaque appelant à traiter un cas qui se
 * produit une fois par an pour un réglage inhabituel, et l'oubli aurait été
 * silencieux.
 *
 * ## L'heure qui existe deux fois
 *
 * À l'automne, la fonction rend la **première** occurrence, et ce n'est pas une
 * préférence : c'est la seule valeur qui garde l'ensemble cohérent.
 *
 * `jourLogique()` compare l'heure murale au seuil. Les deux occurrences de
 * 02 h 30 ont la même heure murale, donc le même jour logique. Si le début du
 * jour était la **seconde** occurrence, le premier 02 h 30 appartiendrait à un
 * jour dont il précéderait le début — un instant hors des bornes de son propre
 * jour. L'invariant « chaque instant tombe dans les bornes de son jour » serait
 * faux deux heures par an, et c'est exactement le genre d'incohérence qu'on ne
 * trouve jamais en lisant le code.
 */
export function debutDuJourLogique(
  jour: string,
  reglages: Partial<ReglagesJourLogique> = {},
): Date {
  const { heureBascule, fuseau } = { ...REGLAGES_PAR_DEFAUT, ...reglages };
  const [annee, mois, j] = jour.split('-').map(Number);
  const voulu = Date.UTC(annee, mois - 1, j, heureBascule, 0, 0);

  /*
   * Les deux décalages possibles autour de l'instant visé. Douze heures de part
   * et d'autre suffisent : aucun fuseau ne change d'heure deux fois dans la même
   * journée. Les deux sondes donnent le même décalage un jour ordinaire, et deux
   * décalages différents un jour de changement d'heure.
   */
  const decalages = [
    decalage(new Date(voulu - 12 * HEURE_MS), fuseau),
    decalage(new Date(voulu + 12 * HEURE_MS), fuseau),
  ];

  /*
   * Un décalage est valide s'il ramène bien à l'heure murale voulue. Un jour
   * ordinaire, un seul l'est. L'heure dédoublée en a deux — on garde la plus
   * ancienne. L'heure sautée n'en a aucun.
   */
  const valides = decalages
    .map((d) => voulu - d)
    .filter((t) => {
      const l = heureLocale(new Date(t), fuseau);
      return l.jour === j && l.heure === heureBascule && l.minute === 0;
    });
  if (valides.length) return new Date(Math.min(...valides));

  /*
   * L'heure voulue n'existe pas : la journée commence au premier instant où
   * elle peut commencer, c'est-à-dire à celui du saut. C'est l'instant obtenu
   * avec le **plus petit** décalage, celui d'avant le changement.
   */
  return new Date(voulu - Math.min(...decalages));
}

/**
 * Les bornes d'un jour logique : `[début, fin[`.
 *
 * La fin est le début du jour suivant, exclue. Deux jours logiques consécutifs
 * ne se chevauchent donc jamais et ne laissent pas de trou — y compris les jours
 * de changement d'heure, où l'un des deux dure 23 ou 25 heures.
 */
export function bornesDuJourLogique(
  jour: string,
  reglages: Partial<ReglagesJourLogique> = {},
): { debut: Date; fin: Date } {
  const debut = debutDuJourLogique(jour, reglages);
  const [annee, mois, j] = jour.split('-').map(Number);
  const lendemain = new Date(Date.UTC(annee, mois - 1, j) + JOUR_MS);
  const fin = debutDuJourLogique(
    iso(lendemain.getUTCFullYear(), lendemain.getUTCMonth() + 1, lendemain.getUTCDate()),
    reglages,
  );
  return { debut, fin };
}

/** Le jour logique précédent ou suivant, en nombre de jours. */
export function decalerJourLogique(jour: string, jours: number): string {
  const [annee, mois, j] = jour.split('-').map(Number);
  const d = new Date(Date.UTC(annee, mois - 1, j) + jours * JOUR_MS);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Nombre de jours logiques entre deux jours, `b - a`. */
export function ecartJoursLogiques(a: string, b: string): number {
  const [aa, am, aj] = a.split('-').map(Number);
  const [ba, bm, bj] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(ba, bm - 1, bj) - Date.UTC(aa, am - 1, aj)) / JOUR_MS,
  );
}

/**
 * La durée d'un jour logique, en heures.
 *
 * Vaut 24 sauf les deux jours de changement d'heure, où elle vaut 23 ou 25.
 * Exposée parce qu'un calcul de moyenne horaire qui suppose 24 heures se trompe
 * deux fois par an, et que l'erreur est invisible.
 */
export function dureeDuJourLogique(
  jour: string,
  reglages: Partial<ReglagesJourLogique> = {},
): number {
  const { debut, fin } = bornesDuJourLogique(jour, reglages);
  return (fin.getTime() - debut.getTime()) / HEURE_MS;
}
