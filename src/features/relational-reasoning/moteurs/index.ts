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
import { rechercheMotif } from './isomorphisme/motif';
import { sousSystemeCommun } from './isomorphisme/sous-systeme-commun';
import { isomorphismePartiel } from './isomorphisme/isomorphisme-partiel';
import { contradiction } from './incompletude/contradiction';
import { premissesMinimales } from './incompletude/premisses-minimales';
import { premisseManquante } from './incompletude/premisse-manquante';
import { projection } from './geometrie/projection';
import { cadres } from './geometrie/cadres';
import { echangeAxes } from './geometrie/echange-axes';
import { analogieIntruse } from './analogie/intruse';
import { analogieInterSystemes } from './analogie/inter-systemes';
import { chaineConclusion } from './chaines/conclusion';
import { chaineSyllogisme } from './chaines/syllogisme';
import { chaineComposee } from './chaines/composee';
import { chaineSecondOrdre } from './chaines/second-ordre';

export const MOTEURS: Moteur[] = [
  infererRelation,
  reseauRelationnel,
  algebreCachee,
  completionAnalogie,
  ensemblesPossibles,
  entreDeux,
  rechercheMotif,
  sousSystemeCommun,
  isomorphismePartiel,
  contradiction,
  premissesMinimales,
  premisseManquante,
  projection,
  cadres,
  echangeAxes,
  analogieIntruse,
  analogieInterSystemes,
  chaineConclusion,
  chaineSyllogisme,
  chaineComposee,
  chaineSecondOrdre,
];

export function moteurParId(id: string): Moteur | undefined {
  return MOTEURS.find((moteur) => moteur.id === id);
}

/**
 * Les couples moteur × système praticables parmi ceux fournis.
 *
 * La liste entière est passée à `accepte` comme voisinage : c'est ce qui permet
 * à un moteur inter-systèmes de refuser un système depuis lequel il n'aurait
 * nulle part où transférer, sans importer le catalogue lui-même.
 */
export function couples(moteurs: readonly Moteur[], systemes: readonly Systeme[]) {
  const resultat: { moteur: Moteur; systeme: Systeme }[] = [];
  for (const moteur of moteurs) {
    for (const systeme of systemes) {
      if (accepte(moteur, systeme, systemes)) resultat.push({ moteur, systeme });
    }
  }
  return resultat;
}

export { accepte };
export type { Moteur };
