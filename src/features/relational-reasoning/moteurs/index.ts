/**
 * Catalogue des moteurs.
 *
 * Comme pour les systèmes, c'est le seul endroit où la liste existe. Un moteur
 * n'est jamais importé par un autre.
 */
import type { Moteur } from './types';
import { accepte } from './types';
import type { Systeme } from '../systemes/types';
import { algebreCachee } from './isomorphisme/algebre-cachee';
import { ensemblesPossibles } from './incompletude/ensembles-possibles';
import { entreDeux } from './algebres/entre-deux';
import { completionAnalogie } from './analogie/completion';
import { infererRelation } from './induction/inferer-relation';
import { reseauRelationnel } from './induction/reseau-relationnel';

export const MOTEURS: Moteur[] = [
  infererRelation,
  reseauRelationnel,
  algebreCachee,
  completionAnalogie,
  ensemblesPossibles,
  entreDeux,
];

export function moteurParId(id: string): Moteur | undefined {
  return MOTEURS.find((moteur) => moteur.id === id);
}

/** Les couples moteur × système praticables parmi ceux fournis. */
export function couples(moteurs: readonly Moteur[], systemes: readonly Systeme[]) {
  const resultat: { moteur: Moteur; systeme: Systeme }[] = [];
  for (const moteur of moteurs) {
    for (const systeme of systemes) {
      if (accepte(moteur, systeme)) resultat.push({ moteur, systeme });
    }
  }
  return resultat;
}

export { accepte };
export type { Moteur };
