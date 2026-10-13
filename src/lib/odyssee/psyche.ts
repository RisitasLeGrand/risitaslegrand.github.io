/**
 * Psyché : le check-in, le journal, et ce que l'application s'interdit d'en dire.
 *
 * ## Ce que ce domaine n'est pas
 *
 * Ce n'est pas un outil clinique, et il ne le deviendra pas par accident. Les
 * échelles **WHO-5, PHQ-9 et GAD-7 ne sont pas intégrées** : le prompt les
 * conditionne à la vérification de leur licence **et** d'une traduction
 * française validée, et ni l'une ni l'autre n'a été faite. Les intégrer « en
 * attendant » produirait un score d'allure clinique sans la validation qui lui
 * donne son sens — c'est-à-dire un chiffre que l'on croirait.
 *
 * Il n'y a donc **aucun score global**, aucun seuil, aucune étiquette. Un
 * check-in rend quatre nombres de 0 à 10, et ces nombres ne disent rien d'autre
 * que ce que la personne a glissé.
 *
 * ## Les indicateurs ne parlent qu'en écart à soi
 *
 * Un « 4 sur 10 » ne veut rien dire dans l'absolu : il y a des gens dont le
 * sept est le quatre d'un autre. Rien ne s'affiche donc avant
 * `JOURS_DE_LIGNE_DE_BASE` jours de mesure, et ce qui s'affiche ensuite est un
 * **écart à sa propre moyenne**, jamais une valeur jugée.
 *
 * C'est la règle que le prompt pose, et elle a une conséquence qu'il faut
 * assumer : pendant un mois, l'écran ne dit presque rien. Il le dit plutôt que
 * d'inventer.
 *
 * ## La charge perçue est le seul fil qui sort
 *
 * Sport a besoin de savoir si la fatigue est là. Il n'a pas besoin de savoir
 * pourquoi. Le contrat déclare donc `odyssee.charge-percue` **non sensible** :
 * un nombre de 0 à 10, sans texte, sans détail, sans la question dont il
 * vient. `chargePercue()` le calcule, et sa forme même interdit d'en faire
 * passer davantage — ajouter un champ aux check-ins ne le fera pas voyager.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Le check-in quotidien : moins de trente secondes
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les quatre glissières, et pas une de plus.
 *
 * Le prompt demande moins de trente secondes. Quatre glissières de 0 à 10 s'y
 * tiennent ; six n'y tiendraient pas, et un check-in qu'on n'a pas le temps de
 * faire est un check-in qu'on ne fait pas — donc une série de trous qui
 * ruinent la ligne de base.
 *
 * `energie` et `stress` ne mesurent pas la même chose que `humeur` : on peut
 * être de bonne humeur et épuisé. Les fondre en un seul chiffre « moral »
 * perdrait précisément ce qui sert à Sport.
 */
export type Dimension = 'humeur' | 'energie' | 'stress' | 'motivation';

export const DIMENSIONS: Record<Dimension, { libelle: string; question: string; hautEstBon: boolean }> = {
  humeur: { libelle: 'Humeur', question: 'Comment vous sentez-vous ?', hautEstBon: true },
  energie: { libelle: 'Énergie', question: 'Quelle énergie avez-vous ?', hautEstBon: true },
  stress: { libelle: 'Stress', question: 'Quel niveau de tension ?', hautEstBon: false },
  motivation: { libelle: 'Motivation', question: 'L’envie d’avancer ?', hautEstBon: true },
};

export const ORDRE_DIMENSIONS: readonly Dimension[] = [
  'humeur',
  'energie',
  'stress',
  'motivation',
];

export interface Checkin {
  id: string;
  jour: string;
  le: string;
  /** De 0 à 10. `null` quand la glissière n'a pas été touchée. */
  humeur: number | null;
  energie: number | null;
  stress: number | null;
  motivation: number | null;
  /** Un mot, pas un journal. Le journal est ailleurs. */
  note: string;
  majLe: string;
}

export const ECHELLE = { min: 0, max: 10 };

export function controlerCheckin(c: Checkin): string[] {
  const problemes: string[] = [];
  for (const d of ORDRE_DIMENSIONS) {
    const v = c[d];
    if (v === null) continue;
    if (!Number.isFinite(v) || v < ECHELLE.min || v > ECHELLE.max) {
      problemes.push(`« ${DIMENSIONS[d].libelle} » va de ${ECHELLE.min} à ${ECHELLE.max}.`);
      continue;
    }
    /*
       Entier. La glissière n'en produit pas d'autres ; un 5,5 vient donc
       d'un import, d'une fusion ou d'un bug, et l'accepter ferait entrer
       dans la moyenne une valeur que personne n'a posée.
    */
    if (!Number.isInteger(v)) {
      problemes.push(`« ${DIMENSIONS[d].libelle} » se note par points entiers.`);
    }
  }
  /*
     Un check-in entièrement vide n'est pas une mesure : l'enregistrer créerait
     un jour « renseigné » sans rien dedans, et la couverture mentirait.
  */
  if (ORDRE_DIMENSIONS.every((d) => c[d] === null) && !c.note.trim()) {
    problemes.push('Un check-in vide n’est pas un check-in.');
  }
  if (!c.jour) problemes.push('Un check-in appartient à un jour.');
  /*
     L'identifiant **est** le jour. C'est ce qui fait qu'un second
     enregistrement corrige le premier au lieu de s'empiler à côté. Si les
     deux divergeaient, la correction créerait un doublon — et la personne
     verrait deux humeurs contradictoires pour le même jour.
  */
  if (c.id !== c.jour) {
    problemes.push(`L’identifiant d’un check-in est son jour : « ${c.id} » ≠ « ${c.jour} ».`);
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le check-in hebdomadaire
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une fois par semaine, trois questions ouvertes.
 *
 * Elles ne sont pas chiffrées, et c'est délibéré : ce qu'on écrit le dimanche
 * soir sur sa semaine ne se ramène pas à un nombre, et le ramener à un nombre
 * donnerait une courbe là où il n'y a qu'un texte.
 */
export interface CheckinHebdo {
  id: string;
  /** Lundi de la semaine couverte, en jour logique. */
  semaine: string;
  le: string;
  /** Ce qui a porté. */
  porte: string;
  /** Ce qui a pesé. */
  pese: string;
  /** Ce dont on a besoin. */
  besoin: string;
  majLe: string;
}

export function controlerHebdo(h: CheckinHebdo): string[] {
  const problemes: string[] = [];
  if (!h.porte.trim() && !h.pese.trim() && !h.besoin.trim()) {
    problemes.push('Un point de semaine vide n’est pas un point de semaine.');
  }
  /*
     Le lundi, et l'identifiant qui le reprend : même raison que pour le
     check-in. Une semaine rangée sous un mercredi en créerait une seconde
     dès que le point serait repris un autre jour.
  */
  if (new Date(`${h.semaine}T12:00:00.000Z`).getUTCDay() !== 1) {
    problemes.push(`Une semaine commence un lundi : « ${h.semaine} » n’en est pas un.`);
  }
  if (h.id !== h.semaine) {
    problemes.push(`L’identifiant d’un point de semaine est sa semaine : « ${h.id} » ≠ « ${h.semaine} ».`);
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le journal
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Du texte libre, et rien qui le lise.
 *
 * Aucune analyse, aucune extraction de mots-clés, aucune détection d'humeur.
 * Le contrat le dit : « ne sort jamais de l'appareil, ni vers une autre
 * branche ». La projection ne publie donc **pas** son contenu — seulement
 * qu'une entrée existe, et sa longueur.
 */
export interface Entree {
  id: string;
  jour: string;
  le: string;
  texte: string;
  majLe: string;
}

export function controlerEntree(e: Entree): string[] {
  return e.texte.trim() ? [] : ['Une entrée de journal vide ne s’enregistre pas.'];
}

/* ══════════════════════════════════════════════════════════════════════════
   La charge perçue : le seul fil qui sort
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La fatigue et la tension d'un jour, ramenées à un nombre de 0 à 10.
 *
 * `(stress + (10 − énergie)) / 2`, arrondi au dixième. Une énergie basse et un
 * stress haut font une charge haute ; l'humeur et la motivation **n'entrent
 * pas** — ce sont elles qui diraient quelque chose de l'état intérieur, et
 * Sport n'a pas à le savoir.
 *
 * Rend `null` si aucune des deux dimensions n'est renseignée : une charge
 * inventée serait pire qu'une charge absente, puisque Sport s'en sert.
 */
export function chargePercue(c: Pick<Checkin, 'energie' | 'stress'>): number | null {
  const parts: number[] = [];
  if (c.stress !== null) parts.push(c.stress);
  if (c.energie !== null) parts.push(ECHELLE.max - c.energie);
  if (!parts.length) return null;
  return Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 10) / 10;
}

/* ══════════════════════════════════════════════════════════════════════════
   La ligne de base, et l'écart à soi
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le nombre de jours mesurés avant qu'un indicateur s'affiche.
 *
 * Trente, comme le prompt l'exige. Ce n'est pas une fenêtre glissante de
 * trente jours : ce sont **trente jours effectivement renseignés**, qui peuvent
 * s'étaler sur deux mois. Compter les jours du calendrier plutôt que les
 * mesures donnerait une ligne de base de six points à qui pointe une fois par
 * semaine.
 */
export const JOURS_DE_LIGNE_DE_BASE = 30;

/** Au-delà de cet écart en points, on dit « nettement ». En deçà, rien. */
export const ECART_NOTABLE = 1.5;

export type Tendance = 'au-dessus' | 'dans la moyenne' | 'en dessous';

export interface EcartALaBase {
  dimension: Dimension;
  /** La moyenne de la personne **avant** la fenêtre récente. */
  base: number;
  /** La moyenne récente, sur la fenêtre demandée. */
  recent: number;
  ecart: number;
  tendance: Tendance;
  /** Combien de jours composent la ligne de base. */
  jours: number;
}

/**
 * L'écart d'une dimension à sa propre ligne de base.
 *
 * Rend `null` tant que la ligne de base n'a pas `JOURS_DE_LIGNE_DE_BASE`
 * points. Pas « un écart provisoire », pas « une tendance faible » : rien. Un
 * écart calculé sur huit jours est du bruit, et l'afficher en le disant fragile
 * ne change pas qu'il sera lu.
 *
 * ## La base exclut la fenêtre récente
 *
 * Elle l'incluait, et c'était faux par construction : la semaine mesurée
 * entrait dans la moyenne à laquelle on la comparait, donc elle se comparait
 * en partie à elle-même. Sur trente-sept jours, sept jours à 8 après trente
 * à 5 donnaient un écart de 2,4 au lieu de 3 — et la dilution est d'autant
 * plus forte que l'historique est court, c'est-à-dire que l'indicateur est
 * jeune. Il était donc le moins sensible exactement quand il venait de
 * s'allumer.
 *
 * Conséquence assumée : il faut `JOURS_DE_LIGNE_DE_BASE + joursRecents` jours
 * **mesurés** avant le premier écart, et non trente. `joursRestants` compte
 * la même chose, sans quoi l'écran ferait un compte à rebours qui n'ouvre rien.
 */
export function ecartALaBase(
  checkins: readonly Checkin[],
  dimension: Dimension,
  joursRecents = 7,
): EcartALaBase | null {
  const mesures = [...checkins]
    .filter((c) => c[dimension] !== null)
    .sort((a, b) => a.jour.localeCompare(b.jour));
  if (mesures.length < JOURS_DE_LIGNE_DE_BASE + joursRecents) return null;

  const valeur = (c: Checkin) => c[dimension] as number;

  /*
     La fenêtre récente se prend sur les **derniers jours renseignés**, pas sur
     les sept derniers jours du calendrier : sans cela, une semaine sans
     pointage rendrait la moyenne récente vide, et l'écart indéfini.
  */
  const recents = mesures.slice(-joursRecents);
  const anciens = mesures.slice(0, -joursRecents);
  const base = anciens.reduce((s, c) => s + valeur(c), 0) / anciens.length;
  const recent = recents.reduce((s, c) => s + valeur(c), 0) / recents.length;
  const ecart = Math.round((recent - base) * 10) / 10;

  const notable = Math.abs(ecart) >= ECART_NOTABLE;
  return {
    dimension,
    base: Math.round(base * 10) / 10,
    recent: Math.round(recent * 10) / 10,
    ecart,
    tendance: !notable ? 'dans la moyenne' : ecart > 0 ? 'au-dessus' : 'en dessous',
    jours: anciens.length,
  };
}

/**
 * Ce qu'il reste à mesurer avant que les indicateurs existent.
 *
 * Le même compte que `ecartALaBase`, fenêtre récente comprise : un écran qui
 * annoncerait « encore 3 jours » puis n'afficherait toujours rien serait pire
 * que de ne rien annoncer.
 */
export function joursRestants(
  checkins: readonly Checkin[],
  dimension: Dimension,
  joursRecents = 7,
): number {
  const mesures = checkins.filter((c) => c[dimension] !== null).length;
  return Math.max(0, JOURS_DE_LIGNE_DE_BASE + joursRecents - mesures);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les garde-fous E.2
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les ressources affichées, en clair et sans condition.
 *
 * Elles ne sont **pas** déclenchées par un seuil : l'application n'a pas les
 * moyens de décider que quelqu'un va mal, et un message qui apparaîtrait
 * au-dessous de « 3 sur 10 » apprendrait surtout à ne plus écrire 3. Elles
 * sont donc **toujours là**, discrètes, au bas de l'écran.
 */
export interface Ressource {
  nom: string;
  numero: string;
  quand: string;
}

export const RESSOURCES: readonly Ressource[] = [
  {
    nom: 'Numéro national de prévention du suicide',
    numero: '3114',
    quand: 'Gratuit, 24 h/24, 7 j/7. Pour soi, ou pour quelqu’un dont on s’inquiète.',
  },
  {
    nom: 'Samu',
    numero: '15',
    quand: 'Urgence vitale, immédiate.',
  },
  {
    nom: 'Numéro d’urgence européen',
    numero: '112',
    quand: 'Depuis n’importe quel téléphone, partout en Europe.',
  },
];

/**
 * Les mots que Psyché n'emploie jamais.
 *
 * Même procédé que le vocabulaire de causalité des tendances : la promesse ne
 * vaut que si un contrôle la vérifie sur les phrases **produites**. Un écran
 * qui dirait « vous semblez déprimé » poserait un diagnostic, et un écran qui
 * dirait « tout va bien » ferait une affirmation qu'il n'a pas les moyens de
 * faire.
 */
export const MOTS_INTERDITS: readonly string[] = [
  'dépression',
  'déprimé',
  'dépressif',
  'anxiété généralisée',
  'trouble',
  'pathologique',
  'symptôme',
  'diagnostic',
  'burn-out',
  'épuisement professionnel',
  'tout va bien',
  'rien d’inquiétant',
  'rien d’alarmant',
  'vous allez mieux',
  'vous allez moins bien',
  'score de bien-être',
  'niveau de santé mentale',
  'normal',
  'anormal',
  /*
     Les trois graduations cliniques. Elles sont le vocabulaire des échelles
     de dépistage, et les employer pour qualifier une glissière maison serait
     emprunter l'autorité d'un instrument qu'on n'a pas administré.
  */
  'léger',
  'modéré',
  'sévère',
];

const sansAccent = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, "'")
    .toLowerCase();

/** Relit des phrases et nomme celles qui diagnostiquent ou qui rassurent. */
export function controlerVocabulairePsyche(phrases: readonly string[]): string[] {
  const formes = [...new Set(MOTS_INTERDITS.map(sansAccent))];
  const problemes: string[] = [];
  for (const phrase of phrases) {
    const nette = sansAccent(phrase);
    for (const forme of formes) {
      if (!nette.includes(forme)) continue;
      problemes.push(`« ${forme} » n’a pas sa place ici : « ${phrase.slice(0, 80)}… »`);
    }
  }
  return problemes;
}

/**
 * Le catalogue de Psyché se tient-il ?
 *
 * Deux choses qu'on perdrait sans s'en apercevoir : les ressources d'urgence,
 * et le fait que les quatre dimensions soient toutes déclarées.
 */
export function controlerPsyche(): string[] {
  const problemes: string[] = [];
  if (!RESSOURCES.some((r) => r.numero === '3114')) {
    problemes.push('Le 3114 doit figurer dans les ressources : c’est une exigence de E.2.');
  }
  for (const r of RESSOURCES) {
    if (!r.numero.trim() || !r.quand.trim()) problemes.push(`La ressource « ${r.nom} » est incomplète.`);
  }
  for (const d of ORDRE_DIMENSIONS) {
    if (!DIMENSIONS[d]) problemes.push(`La dimension « ${d} » n’est pas déclarée.`);
  }
  if (ORDRE_DIMENSIONS.length !== Object.keys(DIMENSIONS).length) {
    problemes.push('L’ordre des dimensions ne couvre pas toutes les dimensions déclarées.');
  }
  return problemes;
}
