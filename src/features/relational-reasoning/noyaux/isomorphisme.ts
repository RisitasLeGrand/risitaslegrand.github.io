/**
 * Isomorphisme de structures relationnelles — deuxième des huit noyaux.
 *
 * Il sert Structure Match, Motif Search, Relational Web, Common Sub-System et
 * Partial Isomorphism. Il ne compose rien : il ne regarde que le motif des
 * arêtes, ce qui le rend utilisable jusque sur les systèmes du régime clos,
 * qui n'ont pas de table de composition.
 *
 * Sa fonction la plus importante ici n'est pas de trouver un isomorphisme mais
 * d'en **compter les automorphismes**. Un exercice qui demande d'apparier deux
 * réseaux n'a de réponse unique que si la structure est rigide : si elle admet
 * une symétrie non triviale, deux appariements différents sont tous deux
 * corrects, et corriger l'un comme faux serait une erreur. Les moteurs
 * concernés rejettent donc le tirage plutôt que de poser la question.
 */
import type { Instance, Modele, Systeme } from '../systemes/types';

/** La matrice des relations d'une instance, indexée comme ses entités. */
export type Matrice = string[][];

export function matrice(systeme: Systeme, instance: Instance): Matrice {
  const modele = instance.modele;
  return instance.entites.map((a) =>
    instance.entites.map((b) => {
      if (a === b) return '';
      if (modele) return systeme.relationDansModele(modele, a, b);
      return instance.faits.find((f) => f.sujet === a && f.objet === b)?.relation ?? '';
    }),
  );
}

/** Toutes les permutations d'indices, par ordre lexicographique. */
function* permutations(taille: number): Generator<number[]> {
  const indices = Array.from({ length: taille }, (_, i) => i);
  function* parcourir(prefixe: number[], reste: number[]): Generator<number[]> {
    if (!reste.length) {
      yield prefixe;
      return;
    }
    for (let i = 0; i < reste.length; i += 1) {
      yield* parcourir([...prefixe, reste[i]], [...reste.slice(0, i), ...reste.slice(i + 1)]);
    }
  }
  yield* parcourir([], indices);
}

/**
 * Le nombre d'automorphismes de la structure, identité comprise.
 *
 * Vaut 1 pour une structure rigide — c'est ce que les moteurs d'appariement
 * exigent. Le parcours est exhaustif : au plus 5 040 permutations pour sept
 * entités, ce qui reste immédiat et évite un algorithme dont la justesse
 * serait plus difficile à établir que le gain.
 */
export function nombreAutomorphismes(structure: Matrice): number {
  const n = structure.length;
  let total = 0;
  for (const pi of permutations(n)) {
    let conserve = true;
    for (let i = 0; i < n && conserve; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (structure[i][j] !== structure[pi[i]][pi[j]]) {
          conserve = false;
          break;
        }
      }
    }
    if (conserve) total += 1;
  }
  return total;
}

/** La structure est-elle rigide, donc appariable de façon unique ? */
export function rigide(systeme: Systeme, instance: Instance): boolean {
  return nombreAutomorphismes(matrice(systeme, instance)) === 1;
}

/**
 * Cherche un isomorphisme entre deux structures, ou rend `null`.
 * Rendu sous forme de tableau : `resultat[i]` est l'indice de l'image de i.
 */
export function isomorphisme(gauche: Matrice, droite: Matrice): number[] | null {
  if (gauche.length !== droite.length) return null;
  const n = gauche.length;
  for (const pi of permutations(n)) {
    let conserve = true;
    for (let i = 0; i < n && conserve; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (gauche[i][j] !== droite[pi[i]][pi[j]]) {
          conserve = false;
          break;
        }
      }
    }
    if (conserve) return pi;
  }
  return null;
}

/** Les deux structures sont-elles isomorphes ? */
export function isomorphes(gauche: Matrice, droite: Matrice): boolean {
  return isomorphisme(gauche, droite) !== null;
}

/**
 * Réétiquette une instance : mêmes relations, noms et positions nouveaux.
 *
 * Les positions sont brouillées autant que les noms. Sans cela, un appariement
 * se lirait sur la disposition du dessin au lieu de la structure — ce que le
 * cahier des charges demande précisément d'empêcher pour Relational Web.
 */
export function reetiqueter(
  instance: Instance,
  nouveauxNoms: readonly string[],
  ordreAffichage: readonly number[],
): { instance: Instance; correspondance: Record<string, string> } {
  const correspondance: Record<string, string> = {};
  instance.entites.forEach((ancien, i) => {
    correspondance[ancien] = nouveauxNoms[i];
  });

  const coordonnees = instance.modele?.coordonnees;
  const camps = instance.modele?.camps;
  const modele: Modele = {};
  if (coordonnees) {
    modele.coordonnees = {};
    for (const [ancien, coord] of Object.entries(coordonnees)) {
      modele.coordonnees[correspondance[ancien]] = coord;
    }
  }
  if (camps) {
    modele.camps = {};
    for (const [ancien, camp] of Object.entries(camps)) {
      modele.camps[correspondance[ancien]] = camp;
    }
  }

  return {
    instance: {
      systeme: instance.systeme,
      entites: ordreAffichage.map((i) => correspondance[instance.entites[i]]),
      faits: instance.faits.map((fait) => ({
        sujet: correspondance[fait.sujet],
        relation: fait.relation,
        objet: correspondance[fait.objet],
      })),
      modele: Object.keys(modele).length ? modele : undefined,
    },
    correspondance,
  };
}
