/**
 * Composition d'une session et tirage d'un essai.
 *
 * Un essai est un **choix forcé à deux alternatives** : une référence sur la
 * dimension de départ, deux candidats sur la dimension d'arrivée, dont un seul
 * est au même niveau relatif. C'est ce format qui donne à l'escalier son point
 * de convergence connu — 70,7 % de réussite, bien au-dessus du hasard à 50 %.
 *
 * La **charge** ajoute des sous-essais sur le même écran plutôt que des
 * candidats : ajouter des candidats changerait le niveau du hasard, donc le
 * point de convergence, et rendrait les seuils incomparables d'une charge à
 * l'autre. Plusieurs sous-essais côte à côte augmentent ce qu'il faut tenir en
 * tête sans toucher à la mesure — ce que le cahier des charges demande
 * précisément : une difficulté indépendante du seuil perceptif.
 */
import { PAS, borner, type Famille } from './dimensions';
import { arbreCouvrant, aretesDeFamille, aretesHorsFamille, idArete, type Arete } from './hub';
import { stimulus, type Stimulus } from './stimulus';

export type Mode = 'squelette' | 'exhaustif';

export const LONGUEURS = [48, 96, 160] as const;

export interface Reglages {
  famille: Famille;
  mode: Mode;
  essais: number;
  /** Sous-essais par écran, de 1 à 3. */
  charge: number;
  /** Ouvrir les paires qui franchissent la frontière des familles. */
  horsFamille: boolean;
  /** Brouiller les attributs sans rapport des candidats. */
  bruit: boolean;
  /** Ne montrer qu'une partie de la référence. */
  partiel: boolean;
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  famille: 'prothetique',
  mode: 'squelette',
  essais: 48,
  charge: 1,
  horsFamille: false,
  bruit: false,
  partiel: false,
};

export interface Candidat {
  pas: number;
  stimulus: Stimulus;
  juste: boolean;
  /** Teinte parasite, quand le bruit de surface est actif. */
  parasite?: number;
}

export interface SousEssai {
  pasReference: number;
  reference: Stimulus;
  candidats: Candidat[];
}

export interface Essai {
  arete: Arete;
  delta: number;
  sousEssais: SousEssai[];
  /** La référence n'est montrée qu'en partie : il faut la compléter. */
  partiel: boolean;
}

export interface Hasard {
  reel(): number;
  entier(borne: number): number;
}

/**
 * Le vivier d'arêtes d'une session.
 *
 * En mode squelette, les n−1 paires de l'arbre couvrant, dans leurs deux sens :
 * le minimum pour relier toutes les dimensions de la famille, sans repasser par
 * les paires redondantes. En mode exhaustif, toutes les arêtes.
 */
export function vivierDAretes(
  reglages: Reglages,
  essaisDeLaPaire: (a: string, b: string) => number,
): Arete[] {
  const toutes = aretesDeFamille(reglages.famille);
  const base =
    reglages.mode === 'exhaustif'
      ? toutes
      : arbreCouvrant(reglages.famille, essaisDeLaPaire).flatMap((paire) =>
          toutes.filter(
            (arete) =>
              (arete.de.id === paire.a.id && arete.vers.id === paire.b.id) ||
              (arete.de.id === paire.b.id && arete.vers.id === paire.a.id),
          ),
        );

  if (!reglages.horsFamille) return base;
  return [
    ...base,
    ...aretesHorsFamille().filter(
      (arete) => arete.de.famille === reglages.famille || arete.vers.famille === reglages.famille,
    ),
  ];
}

/** La charge n'est portée que par les arêtes entièrement visuelles. */
export function chargeAdmise(arete: Arete, charge: number): number {
  const toutVisuel = arete.de.modalite === 'visuelle' && arete.vers.modalite === 'visuelle';
  return toutVisuel ? Math.max(1, Math.min(3, charge)) : 1;
}

/**
 * Tire un essai sur une arête, à l'écart courant de son escalier.
 *
 * La référence est choisie avec une marge suffisante pour que le leurre reste
 * dans la plage — sauf sur une dimension circulaire, où il n'y a pas de bord.
 */
export function tirerEssai(
  arete: Arete,
  delta: number,
  reglages: Reglages,
  hasard: Hasard,
): Essai {
  const ecart = Math.max(1, Math.round(delta));
  const charge = chargeAdmise(arete, reglages.charge);
  const sousEssais: SousEssai[] = [];

  for (let n = 0; n < charge; n += 1) {
    const marge = arete.vers.circulaire ? 0 : ecart;
    const etendue = Math.max(1, PAS - 2 * marge);
    const pasReference = arete.de.circulaire
      ? hasard.entier(PAS)
      : marge + hasard.entier(etendue);

    const sens = hasard.reel() < 0.5 ? -1 : 1;
    const pasLeurre = borner(arete.vers, pasReference + sens * ecart);

    const candidats: Candidat[] = [
      { pas: pasReference, stimulus: stimulus(arete.vers, pasReference), juste: true },
      { pas: pasLeurre, stimulus: stimulus(arete.vers, pasLeurre), juste: false },
    ];
    // Bruit de surface : une teinte parasite différente par candidat, qui ne
    // dit rien du niveau et qu'il faut apprendre à ignorer. On ne l'applique
    // pas quand c'est justement la teinte qu'on compare.
    if (reglages.bruit && arete.vers.id !== 'teinte') {
      for (const candidat of candidats) candidat.parasite = hasard.entier(360);
    }
    if (hasard.reel() < 0.5) candidats.reverse();

    sousEssais.push({
      pasReference,
      reference: stimulus(arete.de, pasReference),
      candidats,
    });
  }

  return { arete, delta: ecart, sousEssais, partiel: reglages.partiel };
}

/** Identifiant d'arête, réexporté pour les appelants qui n'ont que des chaînes. */
export { idArete };
