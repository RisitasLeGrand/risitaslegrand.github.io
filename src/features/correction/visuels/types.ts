/**
 * Les données déclaratives des visuels de correction, côté affichage.
 *
 * Ces types sont le miroir des schémas de `scripts/lib/visuels.mjs`, qui
 * valident les mêmes objets **au build**. Deux déclarations pour une seule
 * forme, et c'est assumé : l'une est en zod et tourne dans Node à la
 * construction du contenu, l'autre est en TypeScript et tourne dans le
 * navigateur. Les faire dériver l'une de l'autre demanderait d'importer zod
 * dans le bundle du site pour n'en tirer qu'un type, ce qui coûterait à chaque
 * visiteur ce que l'on économiserait une fois.
 *
 * La règle qui les tient ensemble : **toute modification se fait des deux
 * côtés**, et le contrôle de contenu refuse ce que le rendu ne saurait pas
 * dessiner.
 */
import type { Marqueur } from '../vocabulaire';

export type TypeVisuel =
  | 'frise'
  | 'tableau'
  | 'schema'
  | 'courbe'
  | 'venn'
  | 'figure'
  | 'grille'
  | 'texte_annote'
  | 'aucun';

export interface DonneesFrise {
  jalons: { date: number | string; libelle: string; marqueur?: Marqueur }[];
  intervalles?: { de: number | string; a: number | string; libelle: string; marqueur?: Marqueur }[];
}

export interface DonneesTableau {
  entetes: string[];
  lignes: string[][];
  marques?: { ligne: number; colonne: number; marqueur: Marqueur }[];
}

export interface DonneesSchema {
  noeuds: { id: string; libelle: string; niveau: number; marqueur?: Marqueur }[];
  liens?: { de: string; a: string; libelle?: string; marqueur?: Marqueur }[];
}

export interface DonneesCourbe {
  axeX: { nom: string; min: number; max: number };
  axeY: { nom: string; min: number; max: number };
  series: { nom: string; points: [number, number][]; marqueur?: Marqueur }[];
  reperes?: { x: number; y: number; libelle: string; marqueur?: Marqueur }[];
}

export interface DonneesVenn {
  ensembles: { id: string; libelle: string }[];
  zones?: { regions: string[]; marqueur: Marqueur; libelle?: string }[];
}

export interface DonneesFigure {
  points: { id: string; x: number; y: number; libelle?: string }[];
  segments?: { de: string; a: string; cote?: string; marqueur?: Marqueur }[];
  angles?: { en: string; de: string; a: string; libelle: string; marqueur?: Marqueur }[];
}

export interface DonneesGrille {
  colonnes: number;
  lignes: number;
  entetesColonnes?: string[];
  entetesLignes?: string[];
  cases?: { x: number; y: number; valeur?: string; marqueur?: Marqueur }[];
}

export interface DonneesTexteAnnote {
  segments: { texte: string; etiquette?: string; marqueur?: Marqueur }[];
}

/** Un visuel de correction, tel que la banque le porte. */
export interface Visuel {
  type: TypeVisuel;
  donnees?: unknown;
  legende?: string;
  alt?: string;
  /** Obligatoire quand `type` vaut `aucun` : pourquoi aucun dessin n'aiderait. */
  raison_aucun?: string;
}

/**
 * Les marqueurs employés par un visuel, pour sa légende.
 *
 * Parcourt les données sans savoir de quel type elles sont : tout marqueur, où
 * qu'il soit, s'appelle `marqueur`. Une liste par type aurait oublié un champ
 * au premier ajout, et la légende aurait alors annoncé moins que le dessin.
 */
export function marqueursDuVisuel(donnees: unknown): Marqueur[] {
  const vus = new Set<Marqueur>();
  const parcourir = (valeur: unknown) => {
    if (Array.isArray(valeur)) {
      for (const element of valeur) parcourir(element);
      return;
    }
    if (!valeur || typeof valeur !== 'object') return;
    for (const [clef, sous] of Object.entries(valeur as Record<string, unknown>)) {
      if (clef === 'marqueur' && typeof sous === 'string') vus.add(sous as Marqueur);
      else parcourir(sous);
    }
  };
  parcourir(donnees);
  return [...vus];
}
