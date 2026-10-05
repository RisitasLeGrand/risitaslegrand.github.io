/**
 * Les chemins de prémisses, partagés par les moteurs de la famille.
 *
 * Un **chemin** est la suite de prémisses qui, composées l'une après l'autre,
 * mènent d'une entité à une autre. C'est la forme que prend la justification
 * dans un raisonnement relationnel, et c'est ce que la correction pas à pas doit
 * pouvoir dérouler : sans chemin, on ne peut que montrer le résultat.
 *
 * Extrait de `conclusion.ts` quand `composee.ts` en a eu besoin : les deux
 * moteurs cherchent le même objet, et une seconde copie aurait divergé.
 */
import type { Fait, Systeme } from '../../systemes/types';

export interface Arete {
  de: string;
  a: string;
  relation: string;
  /** Rang de la prémisse dans la liste affichée. */
  indice: number;
}

export interface Chemin {
  aretes: Arete[];
  /** L'ensemble des relations que ce chemin laisse possibles entre les bouts. */
  obtenu: Set<string>;
}

/** Les arêtes parcourables : chaque prémisse dans ses deux sens. */
export function aretes(systeme: Systeme, faits: readonly Fait[]): Arete[] {
  const liste: Arete[] = [];
  faits.forEach((fait, indice) => {
    liste.push({ de: fait.sujet, a: fait.objet, relation: fait.relation, indice });
    liste.push({
      de: fait.objet,
      a: fait.sujet,
      relation: systeme.converse(fait.relation),
      indice,
    });
  });
  return liste;
}

/**
 * Le chemin le plus informatif de `a` vers `b`, parmi les chemins simples.
 *
 * « Le plus informatif » et non « le plus court » : un détour qui ne laisse
 * qu'une relation possible justifie une conclusion qu'un raccourci ambigu ne
 * justifierait pas. À égalité d'information, le plus court gagne — une
 * correction de trois étapes se suit mieux qu'une de cinq.
 */
export function meilleurChemin(
  systeme: Systeme,
  liste: readonly Arete[],
  a: string,
  b: string,
  longueurMax: number,
): Chemin | null {
  if (!systeme.composer) return null;
  let meilleur: Chemin | null = null;

  const explorer = (courant: string, vus: Set<string>, prises: Arete[], obtenu: Set<string>) => {
    if (prises.length > 0 && courant === b) {
      const candidat: Chemin = { aretes: [...prises], obtenu: new Set(obtenu) };
      if (
        !meilleur ||
        candidat.obtenu.size < meilleur.obtenu.size ||
        (candidat.obtenu.size === meilleur.obtenu.size &&
          candidat.aretes.length < meilleur.aretes.length)
      ) {
        meilleur = candidat;
      }
      return;
    }
    if (prises.length >= longueurMax) return;

    for (const arete of liste) {
      if (arete.de !== courant) continue;
      if (vus.has(arete.a)) continue;
      if (prises.some((p) => p.indice === arete.indice)) continue;

      const suivant = new Set<string>();
      if (obtenu.size === 0) {
        suivant.add(arete.relation);
      } else {
        for (const r of obtenu) for (const t of systeme.composer!(r, arete.relation)) suivant.add(t);
      }
      // Un chemin dont la composition est vide est contradictoire : il ne
      // justifie rien et n'a pas à être exploré plus loin.
      if (suivant.size === 0) continue;

      vus.add(arete.a);
      prises.push(arete);
      explorer(arete.a, vus, prises, suivant);
      prises.pop();
      vus.delete(arete.a);
    }
  };

  explorer(a, new Set([a]), [], new Set());
  return meilleur;
}

/**
 * Un système dont deux relations ne se composent jamais en plusieurs.
 *
 * La propriété décide du mode de réponse des moteurs de la famille : sur un
 * système fonctionnel, une chaîne couvrant les entités fixe **tout** le réseau,
 * de sorte qu'une conclusion y est nécessairement entraînée ou contredite,
 * jamais entre les deux.
 *
 * Mémoïsé, parce que le test parcourt le carré du vocabulaire et que
 * `plan-temps` en compte sept cent vingt-neuf cases.
 */
const memoFonctionnel = new WeakMap<Systeme, boolean>();
export function fonctionnel(systeme: Systeme): boolean {
  const connu = memoFonctionnel.get(systeme);
  if (connu !== undefined) return connu;
  let resultat = Boolean(systeme.composer) && systeme.cheminComplet;
  if (resultat && systeme.composer) {
    for (const r of systeme.relations) {
      for (const s of systeme.relations) {
        if (systeme.composer(r.id, s.id).size > 1) {
          resultat = false;
          break;
        }
      }
      if (!resultat) break;
    }
  }
  memoFonctionnel.set(systeme, resultat);
  return resultat;
}
