/**
 * La fiabilité d'un indicateur : un calcul, et non une impression.
 *
 * ## Pourquoi elle est ici, et pas dans le moteur de tendances
 *
 * B.4 l'exige : « les conflits non résolus restent visibles et dégradent
 * l'indicateur de fiabilité des analyses concernées ». Si cette dégradation
 * vivait dans le moteur de tendances, elle ne s'appliquerait qu'aux tendances —
 * et la roue d'équilibre, le tableau de bord, la couverture de mesure
 * continueraient d'afficher des nombres pleine confiance tirés des mêmes faits
 * en désaccord. Elle est donc attachée à l'indicateur, en amont de tout ce qui
 * le lit.
 *
 * ## Quatre composantes qui se multiplient
 *
 * Et c'est voulu : la plus faible commande le résultat. Une mesure fraîche,
 * complète et sans conflit mais tirée de trois points reste une mesure de trois
 * points. Additionner les composantes, ou en prendre la moyenne, laisserait une
 * bonne note compenser une mauvaise, ce qui est exactement ce qu'une fiabilité
 * ne doit pas faire.
 *
 * ## Sous 0,5, l'indicateur ne nourrit aucune trajectoire
 *
 * C'est la contrepartie de C.8 : on ne construit pas un plan d'action sur une
 * mesure dont on sait qu'elle est faible. L'indicateur reste affiché — le
 * cacher serait pire, puisque la personne a bien produit ces données — mais
 * grisé, avec la raison.
 */

export type Frequence = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'an';

/** La fenêtre attendue d'une fréquence, en jours. */
export const JOURS_DE_FREQUENCE: Record<Frequence, number> = {
  jour: 1,
  semaine: 7,
  mois: 30,
  trimestre: 91,
  an: 365,
};

/** Le seuil sous lequel un indicateur ne nourrit plus aucune trajectoire. */
export const SEUIL_EXPLOITABLE = 0.5;

/**
 * A-t-on assez de points ?
 *
 * 1 à partir du minimum, décroissance linéaire en dessous, 0 sous le tiers du
 * minimum. Le palier à un tiers évite de donner une demi-confiance à une mesure
 * faite sur un point.
 */
export function effectif(points: number, minimum: number): number {
  if (minimum <= 0) return 1;
  if (points >= minimum) return 1;
  const tiers = minimum / 3;
  if (points <= tiers) return 0;
  return (points - tiers) / (minimum - tiers);
}

/**
 * La dernière donnée est-elle récente au regard de la fréquence ?
 *
 * 1 dans la fenêtre attendue, puis décroissance linéaire jusqu'à deux fenêtres,
 * 0 au-delà. Une pesée d'il y a six semaines ne décrit pas cette semaine.
 */
export function fraicheur(joursDepuis: number, frequence: Frequence): number {
  const fenetre = JOURS_DE_FREQUENCE[frequence];
  if (joursDepuis <= fenetre) return 1;
  if (joursDepuis >= fenetre * 2) return 0;
  return 1 - (joursDepuis - fenetre) / fenetre;
}

/** Part des jours attendus qui portent un fait de la source. */
export function completude(joursRenseignes: number, joursAttendus: number): number {
  if (joursAttendus <= 0) return 1;
  return Math.min(1, Math.max(0, joursRenseignes / joursAttendus));
}

export interface EtatDesaccords {
  /** Nombre de désaccords ouverts touchant les sources de l'indicateur. */
  ouverts: number;
  /**
   * Le désaccord porte-t-il sur la source **pivot** — celle sans laquelle
   * l'indicateur n'existe pas ?
   */
  pivotEnConflit?: boolean;
}

/**
 * Y a-t-il des désaccords non résolus sur les faits utilisés ?
 *
 * 1 sans conflit, 0,5 avec un conflit ouvert, 0 si le fait pivot est en
 * conflit. Les trois valeurs viennent du catalogue d'indicateurs : un conflit
 * sur une source secondaire abîme la mesure, un conflit sur le pivot la rend
 * sans objet.
 */
export function integrite(etat: EtatDesaccords): number {
  if (etat.pivotEnConflit) return 0;
  return etat.ouverts > 0 ? 0.5 : 1;
}

export interface EntreesFiabilite {
  points: number;
  minimumDePoints: number;
  joursDepuisDerniereDonnee: number;
  frequence: Frequence;
  joursRenseignes: number;
  joursAttendus: number;
  desaccords: EtatDesaccords;
}

export interface Fiabilite {
  valeur: number;
  composantes: {
    effectif: number;
    fraicheur: number;
    completude: number;
    integrite: number;
  };
  /** Ce qu'il faut dire à l'écran, composante par composante, quand elle pèse. */
  motifs: string[];
  /** Au-dessus du seuil : l'indicateur peut nourrir une trajectoire. */
  exploitable: boolean;
}

export function fiabilite(entrees: EntreesFiabilite): Fiabilite {
  const composantes = {
    effectif: effectif(entrees.points, entrees.minimumDePoints),
    fraicheur: fraicheur(entrees.joursDepuisDerniereDonnee, entrees.frequence),
    completude: completude(entrees.joursRenseignes, entrees.joursAttendus),
    integrite: integrite(entrees.desaccords),
  };
  const valeur =
    composantes.effectif * composantes.fraicheur * composantes.completude * composantes.integrite;

  const motifs: string[] = [];
  if (composantes.effectif < 1) {
    motifs.push(
      `${entrees.points} point(s) pour un minimum de ${entrees.minimumDePoints} : l’effectif est insuffisant.`,
    );
  }
  if (composantes.fraicheur < 1) {
    motifs.push(
      `La dernière donnée a ${entrees.joursDepuisDerniereDonnee} jour(s) : elle ne décrit plus la période.`,
    );
  }
  if (composantes.completude < 1) {
    motifs.push(
      `${entrees.joursRenseignes} jour(s) renseigné(s) sur ${entrees.joursAttendus} : la série est trouée.`,
    );
  }
  if (composantes.integrite < 1) {
    motifs.push(
      entrees.desaccords.pivotEnConflit
        ? 'Un désaccord non tranché porte sur la donnée dont tout l’indicateur dépend.'
        : `${entrees.desaccords.ouverts} désaccord(s) non tranché(s) sur les données utilisées.`,
    );
  }

  return { valeur, composantes, motifs, exploitable: valeur >= SEUIL_EXPLOITABLE };
}
