/**
 * Système `anneau` : six places disposées en cercle.
 *
 * Ce que l'anneau ajoute, et qu'aucun autre système ne porte : une relation
 * qui **reboucle**. Sur une rangée, aller trois places à droite puis trois
 * places à droite sort du plateau ; sur un cercle, on revient à son point de
 * départ. C'est la source d'une erreur très particulière et très répandue —
 * parcourir un cycle comme s'il était un ordre —, et le seul moyen de la faire
 * travailler est de donner un système où elle est possible.
 *
 * Ne pas confondre avec `cyclic`, qui est une **dominance** cyclique : « bat »,
 * au sens de pierre-papier-ciseaux, où la relation n'est pas transitive du tout.
 * Ici la relation est une translation sur le cercle, parfaitement transitive —
 * ce qui change tout, puisque l'erreur n'est plus d'enchaîner mais de ne pas
 * voir que l'enchaînement revient en arrière.
 *
 * Six places, parce que c'est le plus petit nombre pair qui laisse exister les
 * trois figures du vocabulaire circulaire : le voisin immédiat, l'écart de
 * deux, et le **diamétralement opposé**.
 */
import { motsFantomes } from '../noyaux/mots';
import type { Alea, Instance, Modele, Relation, Systeme } from './types';

const PLACES = 6;
const OPPOSE = PLACES / 2;

/** Les écarts de 1 à 5 : l'écart 0 serait la même place. */
const ECARTS = [1, 2, 3, 4, 5];

/** Normalise un écart dans [0, 6). */
const modulo = (n: number) => ((n % PLACES) + PLACES) % PLACES;

function idDeLEcart(ecart: number): string {
  return `e${modulo(ecart)}`;
}

function libelleDeLEcart(ecart: number): string {
  const e = modulo(ecart);
  if (e === OPPOSE) return 'est diamétralement opposé à';
  // Au-delà de la moitié du cercle, le chemin court passe par l'autre côté :
  // on le dit, plutôt que d'annoncer « cinq places à droite » quand une seule
  // place à gauche suffit.
  const court = e > OPPOSE ? PLACES - e : e;
  const cote = e > OPPOSE ? 'gauche' : 'droite';
  if (court === 1) return `est juste à ${cote} de`;
  return `est à deux places à ${cote} de`;
}

const relations: Relation[] = ECARTS.map((ecart) => ({
  id: idDeLEcart(ecart),
  libelle: libelleDeLEcart(ecart),
  bref: ecart === OPPOSE ? '↔' : ecart > OPPOSE ? `−${PLACES - ecart}` : `+${ecart}`,
  // L'opposé est une involution symétrique : c'est le motif de l'opposition.
  // Les voisinages dessinent un cycle couvrant, donc la dominance cyclique.
  algebre:
    ecart === OPPOSE
      ? ('opposition' as const)
      : Math.abs(ecart) === 1 || ecart === PLACES - 1
        ? ('cyclique' as const)
        : undefined,
}));

function relationDansModele(modele: Modele, a: string, b: string): string {
  const pa = modele.coordonnees?.[a]?.[0] ?? 0;
  const pb = modele.coordonnees?.[b]?.[0] ?? 0;
  return idDeLEcart(pa - pb);
}

export const anneau: Systeme = {
  id: 'anneau',
  nom: 'Anneau',
  resume: 'Six places en cercle, et l’écart qui mène de l’une à l’autre.',
  regimes: ['algebre'],
  relations,
  monde: 'ouvert',
  converse: (relation) => idDeLEcart(-(Number(relation.slice(1)) || 0)),
  composer: (r, s) => {
    const somme = modulo((Number(r.slice(1)) || 0) + (Number(s.slice(1)) || 0));
    // Revenir à son point de départ voudrait dire que deux entités distinctes
    // occupent la même place : la combinaison est contradictoire.
    if (somme === 0) return new Set<string>();
    return new Set([idDeLEcart(somme)]);
  },
  cheminComplet: true,
  relationDansModele,

  engendrer(difficulte: number, alea: Alea): Instance {
    const nombre = Math.min(PLACES, 3 + Math.floor(difficulte / 3));
    const entites = motsFantomes(nombre, alea);
    const places = alea.plusieurs(
      Array.from({ length: PLACES }, (_, i) => i),
      nombre,
    );
    const coordonnees: Record<string, number[]> = {};
    entites.forEach((entite, i) => {
      coordonnees[entite] = [places[i]];
    });
    const modele: Modele = { coordonnees };

    const ordre = alea.melanger(entites);
    const faits = ordre.slice(1).map((entite, i) => ({
      sujet: entite,
      relation: relationDansModele(modele, entite, ordre[i]),
      objet: ordre[i],
    }));

    return { systeme: 'anneau', entites, faits: alea.melanger(faits), modele };
  },

  rendu: 'graphe',
};
