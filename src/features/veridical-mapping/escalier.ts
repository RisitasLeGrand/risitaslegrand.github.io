/**
 * L'escalier adaptatif : un seuil de discrimination par paire, plutôt qu'un
 * pourcentage de bonnes réponses.
 *
 * Procédure **3-down-1-up** : TROIS réponses justes de suite resserrent l'écart
 * entre les deux candidats, une erreur l'élargit. Elle converge vers le point
 * où la personne réussit **79,4 %** des essais — 0,5 à la puissance un tiers —
 * bien au-dessus du hasard, qui est ici de 50 %.
 *
 * ## Ce qui a changé le 31 octobre, et pourquoi
 *
 * Cette procédure était **2-down-1-up**, convergeant vers 70,7 %, avec un pas
 * géométrique qui se resserrait par paliers — facteur 2, puis 1,41 après deux
 * inversions, puis 1,19 après quatre. Le prompt 63 aligne le moteur sur la
 * référence de comportement : 3-down, et des facteurs **constants et
 * asymétriques**.
 *
 * **L'asymétrie est le point qui se remarque le moins et qui compte le plus.**
 * L'ancienne version appliquait le MÊME facteur dans les deux sens — on
 * divisait pour resserrer, on multipliait pour élargir. Désormais on resserre
 * de 13 % et l'on élargit de 20 % : une erreur coûte plus qu'une réussite ne
 * rapporte, ce qui est ce qui empêche l'escalier de s'installer trop bas quand
 * la personne devine juste deux fois de suite.
 *
 * **Un seuil est rendu dès quatre inversions** — il en fallait huit. Les
 * premières servent à descendre depuis l'écart initial, mais quatre suffisent
 * à encadrer : attendre huit faisait payer une séance entière avant le premier
 * chiffre. La convergence, elle, demande **six inversions**.
 *
 * ## Ce que la convergence ne mesure plus, et il faut le dire
 *
 * Elle reposait sur la dispersion du log des dernières inversions, plafonnée à
 * 0,1. Le prompt 63 la place sur le NOMBRE d'inversions, et `dispersion`
 * reste exportée parce que le tableau de bord la montre — mais elle ne
 * gouverne plus le statut. C'est un assouplissement, et il est volontaire :
 * une dispersion faible sur six inversions peut venir d'un escalier coincé
 * contre sa borne, ce qui se lit « stabilisé » alors que rien ne l'est.
 *
 * ## L'échelle est z, et non les pas
 *
 * Les écarts sont **en z**, c'est-à-dire en part de l'étendue utile de la
 * dimension, de 0 à 1. Ils étaient en pas jusqu'au 31 octobre — un seuil
 * dépendait donc du découpage choisi, et changer `PAS` aurait changé tous les
 * seuils enregistrés sans que la personne ait rien appris.
 *
 * La grille de 120 points reste, mais au moment de DESSINER : `pasDuZ` y
 * ramène le z du tirage, et c'est la quantification `qz`. L'escalier, lui,
 * ignore la grille.
 *
 * Les trois valeurs viennent de la référence de comportement : départ 0,18,
 * bornes 0,02 et 0,45. Nos anciennes bornes, 1 et 60 pas, valaient 0,0084 et
 * 0,504 : le resserrement est réel, et il est voulu — un écart de la moitié de
 * l'étendue ne mesure plus rien, et un écart de 0,0084 est sous le
 * discriminable de presque tout le monde.
 */
export const REGLAGES = {
  /** Écart initial, en z : largement au-dessus de tout seuil plausible. */
  departDelta: 0.18,
  deltaMinimum: 0.02,
  deltaMaximum: 0.45,
  /** Bonnes réponses consécutives avant de resserrer. Trois : « 3-down ». */
  bonnesRequises: 3,
  /**
   * Les deux facteurs, et ils ne sont pas inverses l'un de l'autre.
   *
   * On resserre de 13 %, on élargit de 20 %. Une erreur coûte donc plus qu'une
   * réussite ne rapporte, et c'est ce qui empêche l'escalier de s'installer
   * trop bas sur une série de devinettes heureuses. Les écrire tous les deux
   * plutôt qu'un seul facteur et son inverse est ce qui rend l'asymétrie
   * visible à la relecture.
   */
  facteurResserre: 0.87,
  facteurElargit: 1.2,
  /** Inversions retenues pour le calcul du seuil. */
  inversionsRetenues: 6,
  /** Inversions nécessaires avant de rendre un seuil. */
  inversionsRequises: 4,
  /** Inversions nécessaires pour dire l'escalier stabilisé. */
  inversionsPourConverger: 6,
} as const;

export type Statut = 'jamais' | 'en-cours' | 'converge';

export interface EtatEscalier {
  /** Écart courant entre le bon candidat et le leurre, en z. */
  delta: number;
  /** Bonnes réponses consécutives depuis le dernier changement d'écart. */
  bonnesDeSuite: number;
  /** Écarts relevés à chaque inversion, en z, dans l'ordre. */
  inversions: number[];
  /** Sens du dernier changement d'écart. */
  derniereDirection: 'resserre' | 'elargit' | null;
  essais: number;
  reussis: number;
}

export function escalierNeuf(): EtatEscalier {
  return {
    delta: REGLAGES.departDelta,
    bonnesDeSuite: 0,
    inversions: [],
    derniereDirection: null,
    essais: 0,
    reussis: 0,
  };
}

/**
 * Enregistre une réponse et rend le nouvel état.
 *
 * L'inversion est relevée **au moment où le sens change**, et l'écart consigné
 * est celui qui précède le changement : c'est le point de rebroussement, et
 * c'est lui qui encadre le seuil.
 */
export function repondre(etat: EtatEscalier, juste: boolean): EtatEscalier {
  const suivant: EtatEscalier = {
    ...etat,
    inversions: [...etat.inversions],
    essais: etat.essais + 1,
    reussis: etat.reussis + (juste ? 1 : 0),
  };

  if (juste) {
    suivant.bonnesDeSuite = etat.bonnesDeSuite + 1;
    // Trois bonnes de suite avant de resserrer : c'est ce qui fait la règle
    // « 3-down » et place le point de convergence à 79,4 %.
    if (suivant.bonnesDeSuite < REGLAGES.bonnesRequises) return suivant;
    suivant.bonnesDeSuite = 0;
    if (etat.derniereDirection === 'elargit') suivant.inversions.push(etat.delta);
    suivant.derniereDirection = 'resserre';
    suivant.delta = Math.max(REGLAGES.deltaMinimum, etat.delta * REGLAGES.facteurResserre);
    return suivant;
  }

  suivant.bonnesDeSuite = 0;
  if (etat.derniereDirection === 'resserre') suivant.inversions.push(etat.delta);
  suivant.derniereDirection = 'elargit';
  suivant.delta = Math.min(REGLAGES.deltaMaximum, etat.delta * REGLAGES.facteurElargit);
  return suivant;
}

/** Les dernières inversions retenues pour le seuil. */
function dernieres(etat: EtatEscalier): number[] {
  return etat.inversions.slice(-REGLAGES.inversionsRetenues);
}

/**
 * Le seuil, **en z** — donc comparable d'une dimension à l'autre, et d'une
 * version du logiciel à l'autre, puisqu'il ne dépend plus du découpage de la
 * grille. Rend `null` tant que les inversions requises ne sont pas atteintes.
 */
export function seuil(etat: EtatEscalier): number | null {
  if (etat.inversions.length < REGLAGES.inversionsRequises) return null;
  const retenues = dernieres(etat);
  const somme = retenues.reduce((total, valeur) => total + Math.log(valeur), 0);
  return Math.exp(somme / retenues.length);
}

/** Dispersion des dernières inversions, en log décimal. */
export function dispersion(etat: EtatEscalier): number | null {
  const retenues = dernieres(etat);
  if (retenues.length < REGLAGES.inversionsRetenues) return null;
  const logs = retenues.map((valeur) => Math.log10(valeur));
  const moyenne = logs.reduce((total, valeur) => total + valeur, 0) / logs.length;
  const variance =
    logs.reduce((total, valeur) => total + (valeur - moyenne) ** 2, 0) / logs.length;
  return Math.sqrt(variance);
}

export function statut(etat: EtatEscalier): Statut {
  if (!etat.essais) return 'jamais';
  /*
     SIX INVERSIONS, ET RIEN D'AUTRE. La dispersion ne gouverne plus le statut
     — voir l'en-tête : une dispersion faible peut venir d'un escalier coincé
     contre sa borne, ce qui se lirait « stabilisé » alors que rien ne l'est.
     `dispersion` reste exportée, et le tableau de bord la montre.
  */
  if (etat.inversions.length >= REGLAGES.inversionsPourConverger) return 'converge';
  return 'en-cours';
}

export const INTITULES_STATUT: Record<Statut, string> = {
  jamais: 'jamais travaillée',
  'en-cours': 'en cours',
  converge: 'stabilisée',
};
