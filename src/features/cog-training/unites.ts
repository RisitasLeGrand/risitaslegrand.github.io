/**
 * Le contrat de « Mon entraînement », volontairement indépendant des exercices.
 *
 * Une **unité** est ce qu'on peut cocher : un moteur dans Relational Reasoning,
 * une route entre dimensions dans Veridical Mapping, une modalité dans Quad
 * N-Back. Un **groupe** les range. C'est tout ce que l'écran de sélection a
 * besoin de connaître, et c'est ce qui permettra de le réutiliser sans le
 * réécrire — un composant qui aurait pris des `Moteur` en entrée aurait fermé
 * cette porte au premier jour.
 */

export interface Unite {
  id: string;
  nom: string;
  resume: string;
  /** Accessible sans le mode libre ? */
  debloque: boolean;
}

export interface GroupeUnites {
  id: string;
  nom: string;
  resume?: string;
  unites: Unite[];
}
