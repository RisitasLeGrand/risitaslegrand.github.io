/**
 * Sous-ensembles insatisfiables minimaux — troisième des huit noyaux.
 *
 * Il sert trois moteurs de la catégorie « information incomplète » :
 *
 *  - **Contradiction** : quel fait retirer pour rétablir la cohérence ?
 *  - **Prémisses minimales** : quels faits suffisent à forcer la conclusion ?
 *  - **Prémisse manquante** : quel fait ajouter pour que la conclusion suive ?
 *
 * Les trois se ramènent à une énumération de sous-ensembles par taille
 * croissante. C'est exponentiel, et c'est acceptable : les instances engendrées
 * comptent au plus une dizaine de faits, soit mille combinaisons, là où un
 * solveur incrémental coûterait cent lignes de plus pour un gain nul à cette
 * échelle. La borne est explicite (`FAITS_MAXIMUM`) et les générateurs la
 * respectent, plutôt que d'être laissée implicite dans un temps de réponse.
 *
 * Un point de vocabulaire, car il porte toute la correction : un ensemble de
 * faits *entraîne* une relation r entre a et b lorsque r est **la seule**
 * relation encore possible entre eux. « Possible » se calcule par le noyau de
 * cohérence, qui sait à quelles algèbres la propagation seule suffit.
 */
import type { Fait } from '../systemes/types';
import { coherent, possibilites, type Algebre } from './algebre';

/** Au-delà, l'énumération par sous-ensembles n'est plus raisonnable. */
export const FAITS_MAXIMUM = 12;

export interface Contexte {
  algebre: Algebre;
  cheminComplet: boolean;
  entites: readonly string[];
}

/** Tous les sous-ensembles de `faits`, par taille croissante. */
function* parTailleCroissante<T>(faits: readonly T[]): Generator<T[]> {
  const n = faits.length;
  const parTaille: T[][][] = Array.from({ length: n + 1 }, () => []);
  for (let masque = 0; masque < 1 << n; masque += 1) {
    const choisis: T[] = [];
    for (let i = 0; i < n; i += 1) if (masque & (1 << i)) choisis.push(faits[i]);
    parTaille[choisis.length].push(choisis);
  }
  for (const groupe of parTaille) for (const sous of groupe) yield sous;
}

/**
 * Les faits dont le retrait **à lui seul** rétablit la cohérence.
 *
 * C'est exactement l'intersection de tous les sous-ensembles insatisfiables
 * minimaux : un fait absent d'un seul d'entre eux laisse ce conflit intact. La
 * liste peut donc être vide — deux cycles contradictoires disjoints n'ont aucun
 * fait commun —, et c'est la raison pour laquelle les générateurs de
 * Contradiction imposent aux cycles de partager une arête. Le moteur rejette le
 * tirage plutôt que de poser une question sans réponse unique.
 */
export function faitsRedempteurs(contexte: Contexte, faits: readonly Fait[]): Fait[] {
  const { algebre, cheminComplet, entites } = contexte;
  if (coherent(algebre, cheminComplet, entites, faits)) return [];
  return faits.filter((_, i) => {
    const restants = faits.filter((__, j) => j !== i);
    return coherent(algebre, cheminComplet, entites, restants);
  });
}

/** Un ensemble de faits force-t-il `relation` entre `a` et `b` ? */
export function entraine(
  contexte: Contexte,
  faits: readonly Fait[],
  a: string,
  b: string,
  relation: string,
): boolean {
  const { algebre, cheminComplet, entites } = contexte;
  const restantes = possibilites(algebre, cheminComplet, entites, faits, a, b);
  return restantes.size === 1 && restantes.has(relation);
}

export interface Suffisant {
  /** Le plus petit sous-ensemble qui entraîne la conclusion. */
  faits: Fait[];
  /** Vrai si aucun autre sous-ensemble de la même taille ne l'entraîne. */
  unique: boolean;
}

/**
 * Le plus petit sous-ensemble de prémisses entraînant la conclusion.
 *
 * L'unicité n'est pas garantie en général : deux chaînes indépendantes peuvent
 * mener à la même conclusion, et il n'y a alors pas de « bonne » réponse à
 * cocher. Le drapeau est rendu au moteur, qui décide — Prémisses minimales
 * rejette le tirage, quand un moteur plus tolérant pourrait accepter l'un ou
 * l'autre.
 */
export function plusPetitSuffisant(
  contexte: Contexte,
  faits: readonly Fait[],
  a: string,
  b: string,
  relation: string,
): Suffisant | null {
  if (faits.length > FAITS_MAXIMUM) return null;
  if (!entraine(contexte, faits, a, b, relation)) return null;

  let trouve: Fait[] | null = null;
  let concurrents = 0;
  for (const sous of parTailleCroissante(faits)) {
    if (trouve && sous.length > trouve.length) break;
    if (!entraine(contexte, sous, a, b, relation)) continue;
    if (!trouve) trouve = sous;
    else concurrents += 1;
  }
  return trouve ? { faits: trouve, unique: concurrents === 0 } : null;
}

/**
 * Parmi des faits candidats, ceux dont l'ajout rend la conclusion certaine.
 *
 * Le candidat doit rester **compatible** avec les prémisses : un fait qui rend
 * le réseau incohérent entraînerait formellement n'importe quoi, et serait une
 * réponse absurde. On l'écarte donc avant de tester l'entraînement.
 */
export function candidatsSuffisants(
  contexte: Contexte,
  premisses: readonly Fait[],
  candidats: readonly Fait[],
  a: string,
  b: string,
  relation: string,
): Fait[] {
  const { algebre, cheminComplet, entites } = contexte;
  return candidats.filter((candidat) => {
    const augmentees = [...premisses, candidat];
    if (!coherent(algebre, cheminComplet, entites, augmentees)) return false;
    return entraine(contexte, augmentees, a, b, relation);
  });
}
