/**
 * Un stimulus concret : ce qu'il faut montrer ou jouer pour un pas donné.
 *
 * Une seule dimension varie à la fois ; toutes les autres prennent une valeur
 * fixe. C'est indispensable à la validité de la mesure — si la hauteur variait
 * en même temps que l'intensité, le seuil mesuré ne porterait sur aucune des
 * deux.
 */
import { type Dimension, type Modalite } from './dimensions';

/** Valeurs des dimensions qui ne varient pas dans un essai donné. */
export const FIXES = {
  taillePx: 84,
  clarte: 62,
  teinte: 210,
  positionPct: 50,
  frequenceHz: 440,
  niveauDb: -14,
  dureeMs: 360,
} as const;

export interface Stimulus {
  dimension: string;
  modalite: Modalite;
  taillePx: number;
  /** Clarté L*, de 0 à 100. */
  clarte: number;
  /** Teinte en degrés. */
  teinte: number;
  /** Position le long de la ligne, en pourcentage. */
  positionPct: number;
  frequenceHz: number;
  niveauDb: number;
  dureeMs: number;
}

export function stimulus(dimension: Dimension, pas: number): Stimulus {
  const valeur = dimension.valeur(pas);
  const base: Stimulus = {
    dimension: dimension.id,
    modalite: dimension.modalite,
    ...FIXES,
  };
  switch (dimension.id) {
    case 'taille':
      return { ...base, taillePx: valeur };
    case 'luminosite':
      return { ...base, clarte: valeur };
    case 'teinte':
      return { ...base, teinte: valeur };
    case 'position':
      return { ...base, positionPct: valeur };
    case 'hauteur':
      return { ...base, frequenceHz: valeur };
    case 'intensite':
      return { ...base, niveauDb: valeur };
    case 'duree':
      return { ...base, dureeMs: valeur };
    default:
      return base;
  }
}
