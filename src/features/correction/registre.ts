/**
 * Le registre des exercices de Cog-Training, et leur droit à la correction
 * détaillée.
 *
 * Un indicateur déclaratif plutôt qu'une liste d'exclusion dans le composant :
 * tout exercice ajouté plus tard est **inclus par défaut**, et il faut une
 * raison écrite pour qu'il ne le soit pas. L'inverse — une liste de ceux qui
 * ont droit à la correction — se serait périmée au premier exercice nouveau.
 *
 * Quad N-Back est le seul exclu, et ce n'est pas un oubli : il n'y a rien à
 * corriger dans un n-back. L'item n'est pas un problème dont on manque la
 * solution, c'est une position en mémoire que l'on n'a pas tenue. Expliquer
 * « la case était en haut à gauche il y a trois coups » n'enseigne rien, puisque
 * la personne ne s'est pas trompée de raisonnement : elle a oublié.
 */

export interface ExerciceCog {
  id: string;
  nom: string;
  /** La correction détaillée est-elle offerte sur cet exercice ? */
  correctionDetaillee: boolean;
  /** Pourquoi elle ne l'est pas, le cas échéant. */
  raisonExclusion?: string;
}

export const EXERCICES_COG: ExerciceCog[] = [
  {
    id: 'relational-reasoning',
    nom: 'Relational Reasoning',
    correctionDetaillee: true,
  },
  {
    id: 'veridical-mapping',
    nom: 'Veridical Mapping',
    correctionDetaillee: true,
  },
  {
    id: 'quad-n-back',
    nom: 'Quad N-Back',
    correctionDetaillee: false,
    raisonExclusion:
      'Une erreur de n-back est un oubli, non un raisonnement manqué : il n’y a pas de chemin à refaire.',
  },
];

export function exerciceCog(id: string): ExerciceCog | undefined {
  return EXERCICES_COG.find((e) => e.id === id);
}

/**
 * Un exercice offre-t-il la correction détaillée ?
 *
 * Inconnu du registre, il la reçoit : c'est le défaut voulu, pour qu'un
 * exercice nouveau soit couvert avant même d'être déclaré.
 */
export function aCorrectionDetaillee(id: string): boolean {
  return exerciceCog(id)?.correctionDetaillee ?? true;
}
