/**
 * LE NOYAU DU LOT L5 : CE QU'UNE DIMENSION DISCRÈTE CHANGE À LA MESURE.
 *
 * Prompt 63, lot L5. Les dimensions du Veridical Mapping refondu comptent
 * trente-deux dimensions DISCRÈTES — un nombre d'événements, un nombre de
 * côtés, un nombre de syllabes. Ce fichier tient ce que leur caractère discret
 * impose à la mesure, et rien d'autre : aucun rendu, aucune dimension inventée.
 *
 * Il ne touche aucun fichier de l'agent A. Le seul contact prévu avec son
 * registre est une ligne par dimension en fin de liste, comme il l'a fixé.
 *
 * ## LE DÉFAUT QUE CE FICHIER EXISTE POUR EMPÊCHER
 *
 * L'escalier demande un écart en `z`, part sans unité de l'étendue de la
 * dimension. Son plancher est `PLANCHER_MESURABLE`, soit 0,04. Une dimension
 * discrète à `niveaux` valeurs ne peut présenter que des écarts multiples de
 * `1 / (niveaux - 1)`. Mesuré :
 *
 * | niveaux | grain | ce qu'un écart de 0,04 devient |
 * |---|---|---|
 * | 3 | 0,5000 | **0 — les deux stimulus sont IDENTIQUES** |
 * | 5 | 0,2500 | **0 — IDENTIQUES** |
 * | 8 | 0,1429 | **0 — IDENTIQUES** |
 * | 12 | 0,0909 | **0 — IDENTIQUES** |
 * | 26 | 0,0400 | 0,0400 — le grain rejoint enfin le plancher |
 * | 101 | 0,0100 | 0,0400 |
 *
 * **La règle générale est plus large qu'un cas particulier : une demande
 * inférieure au DEMI-GRAIN ne montre rien.** À huit niveaux, le demi-grain
 * vaut 0,071 — donc tout ce que l'escalier demande sous cela présente deux
 * stimulus identiques, alors que son plancher est à 0,04.
 *
 * On montre alors deux fois la même chose et l'on demande laquelle diffère. La
 * personne répond au hasard, l'escalier lit ses erreurs comme « seuil
 * atteint », et il ENREGISTRE UN SEUIL. Rien ne lève, rien ne rougit : un
 * tirage au sort se présente comme une discrimination.
 *
 * **La première rédaction de ce tableau disait « 8 niveaux → 1 niveau », et
 * c'était faux.** Le chiffre venait d'une sonde jetable qui comparait deux
 * positions de part et d'autre de 0,5 — donc un arrondi qui franchissait une
 * frontière de niveau par accident de placement. La fonction livrée, elle,
 * arrondit l'ÉCART, et `Math.round(0,28)` vaut zéro. C'est l'essai qui l'a
 * dit, en rougissant sur une assertion que j'avais écrite d'après la sonde et
 * non d'après la fonction. Mesurer autre chose que ce qu'on livre est une
 * façon de se tromper qui a l'air d'une mesure.
 *
 * Et la grille fine de 1 001 points ne protège de rien ici, ce qui est le point
 * contre-intuitif : `pasDuZ(0,04)` rend 40 pas sur 1 000, soit 0,040 pile. Elle
 * est juste, et elle ne sait pas que la dimension est discrète. C'est la même
 * faute que la grille de 120 points — un écart cru présenté qui ne l'était
 * pas —, mais dans sa forme sévère : là l'erreur valait 16 %, ici les deux
 * stimulus se confondent.
 *
 * ## LA RÈGLE QUI EN SORT
 *
 * **On enregistre l'écart MONTRÉ, non l'écart demandé.** `ecartMontre` ramène
 * la demande de l'escalier sur la grille des niveaux, et c'est cette valeur qui
 * doit remonter. Un seuil est une propriété de la personne ; l'écart demandé
 * est une propriété de la procédure, et les confondre attribue à la personne la
 * finesse de l'algorithme.
 *
 * ## CE QUE CE FICHIER NE FAIT PAS, ET POURQUOI
 *
 * Il ne déclare aucune dimension. La liste des quatre-vingt-cinq vient de
 * `VMTrainer.html`, que je n'ai pas, et le plan L0 que le pilote cite n'existe
 * pas dans le dépôt — vérifié sur `main` et sur la branche d'A. Inventer
 * quatre-vingt-cinq définitions perceptives aurait produit un fichier qui a
 * l'air complet et dont personne ne pourrait dire ce qui est fondé. Les
 * dimensions se posent quand leur définition arrive ; la machinerie qu'elles
 * demandent est ici, et elle est éprouvée.
 */
import { PLANCHER_MESURABLE } from './escalier';

/**
 * CE QU'UNE DIMENSION DISCRÈTE DÉCLARE EN PLUS.
 *
 * Séparé de `Dimension` plutôt qu'ajouté dedans : le registre d'A appartient à
 * A, et une dimension continue n'a pas à porter un champ qui ne la concerne
 * pas. Les dimensions de L5 porteront les deux, par intersection de types.
 */
export interface TraitsDeL5 {
  /**
   * Le nombre de valeurs distinctes que la dimension peut prendre.
   *
   * Absent pour une dimension continue. Présent, il est le GRAIN de tout ce
   * qui suit : c'est lui, et non la grille de dessin, qui dit ce que la
   * personne peut voir.
   */
  niveaux?: number;
  /**
   * La dimension fait-elle varier quelque chose DANS LE TEMPS ?
   *
   * Un clignotement, un motif rythmique, une apparition. Règle photosensible
   * validée par Alexis : tout ce qui varie dans le temps reste en gris neutre.
   * Le champ est déclaratif pour que la règle se BALAIE au lieu de se relire —
   * une règle qui dépend de la vigilance de chaque auteur n'est pas une règle.
   */
  varieDansLeTemps?: true;
  /**
   * La durée totale du stimulus, en millisecondes, quand elle est fixée.
   *
   * Nécessaire aux dimensions qui font varier un NOMBRE d'événements. Si la
   * durée totale suivait le nombre, la personne compterait la durée au lieu
   * d'entendre le nombre, et le seuil mesuré porterait sur la durée — c'est
   * l'indice parasite qu'Alexis a nommé. Une durée totale fixe le ferme.
   */
  dureeTotaleMs?: number;
}

/** Une dimension du lot L5 : le registre d'A, plus ce qui précède. */
export type DimensionL5 = TraitsDeL5 & {
  id: string;
  niveaux?: number;
  /**
   * La dimension REBOUCLE-T-ELLE ? Ajouté par A, et le grain en dépend.
   *
   * Même nom et même sens que dans son registre, pour qu'une dimension puisse
   * porter les deux types sans traduction. Voir `grainDe` juste dessous : ce
   * champ n'est pas un ornement, il change le grain d'un facteur n/(n−1).
   */
  circulaire?: boolean;
};

/* ── LE GRAIN, ET CE QU'IL AUTORISE ───────────────────────────────────── */

/**
 * Le plus petit écart non nul qu'une dimension puisse MONTRER, en z.
 *
 * Pour une dimension continue, c'est le plancher de la procédure. Pour une
 * discrète, c'est son grain, qui peut être bien plus grossier — et c'est alors
 * lui qui commande.
 */
export function grainDe(d: DimensionL5): number {
  if (d.niveaux === undefined) return PLANCHER_MESURABLE;
  if (!Number.isInteger(d.niveaux) || d.niveaux < 2) {
    throw new Error(
      `La dimension « ${d.id} » déclare ${d.niveaux} niveaux. ` +
        'Une dimension discrète en a au moins deux, et un nombre entier : ' +
        'au-dessous il n’y a rien à discriminer, et la mesure n’aurait pas d’objet.',
    );
  }
  /*
     CORRECTION D'A, MESURÉE : une dimension qui reboucle n'a pas ce grain-là.

     `STEP(n, circulaire)` de la référence rend `round(z*n) % n` quand la
     dimension reboucle, et `round(z*(n-1))` sinon. Les deux atteignent n
     niveaux, mais le pas n'est pas le même : 1/n d'un côté, 1/(n−1) de
     l'autre. Sur une circulaire à sept niveaux — « note_name », « weekday » —
     la seconde formule annonce 16,7 % là où le rendu montre 14,3 %, soit 17 %
     de trop. Vingt-quatre des cent vingt-trois dimensions de la fiche de
     référence rebouclent.

     La direction de l'erreur était prudente — un grain surestimé donne un
     plancher trop haut, donc jamais deux stimulus identiques. Mais c'est
     `ecartMontre` qui en souffre : il ramenait la demande sur une grille que
     le rendu n'emploie pas, et l'écart ENREGISTRÉ est celui qui devient le
     seuil d'une personne.

     Aucun des verdicts de l'essai de ce fichier ne bascule : vérifié sur les
     sept parlées, circulaires comprises, elles restent toutes écartées.
  */
  return d.circulaire ? 1 / d.niveaux : 1 / (d.niveaux - 1);
}

/**
 * LE PLANCHER RÉEL D'UNE DIMENSION — le plus fin des deux contraintes.
 *
 * On prend le MAXIMUM, et le sens de l'inégalité est le tout : un seuil ne peut
 * être ni plus fin que ce que la procédure encadre, ni plus fin que ce que le
 * stimulus montre. Prendre le minimum rendrait un plancher que rien ne tient.
 */
export function plancherDe(d: DimensionL5): number {
  return Math.max(PLANCHER_MESURABLE, grainDe(d));
}

/**
 * L'ÉCART RÉELLEMENT MONTRÉ, quand l'escalier en demande un.
 *
 * C'est la fonction dont dépend l'honnêteté de la mesure sur une dimension
 * discrète. Elle rend zéro quand la demande est plus fine que le demi-grain —
 * et ce zéro n'est pas une erreur à corriger : c'est le fait qu'il faut
 * remonter, parce qu'un écart nul signifie DEUX STIMULUS IDENTIQUES.
 *
 * Arrondi, et non troncature, pour la raison qu'A donne pour `pasDuZ` :
 * tronquer décalerait tout vers le bas d'un demi-grain.
 */
export function ecartMontre(d: DimensionL5, ecartDemande: number): number {
  const grain = grainDe(d);
  return Math.round(ecartDemande / grain) * grain;
}

/**
 * LA DIMENSION SORT-ELLE DE L'ESCALIER, ET SINON POURQUOI.
 *
 * Rend `null` quand l'escalier peut l'encadrer, et sinon la phrase à écrire.
 * La raison est produite ici, à côté du critère, et non rédigée à la main
 * ailleurs — deux sources finiraient par ne plus dire la même chose.
 *
 * Le critère : il faut que l'escalier puisse présenter des écarts DE PART ET
 * D'AUTRE du seuil, ce qui demande au moins trois écarts distincts non nuls
 * sous le départ. Avec un départ à 0,18, un grain de 0,0909 n'en offre que
 * deux — 0,0909 et 0,1818 —, et un grain de 0,25 aucun.
 *
 * ## CETTE FONCTION S'APPELAIT « raisonDInaptitude », ET LE NOM ÉTAIT FAUX
 *
 * Renommée le 1er novembre, sur décision du pilote : « on ne rejette que les
 * dimensions de moins de 3 niveaux ». Le critère mesuré ici reste exact — un
 * escalier n'encadre pas un seuil sur sept niveaux —, mais il ne dit pas
 * qu'une dimension est inapte : il dit qu'elle ne se mesure pas PAR ESCALIER.
 * Sept dimensions parlées tombent dedans, et elles se mesurent par
 * IDENTIFICATION, au lot L6.
 *
 * Le nom d'une fonction qui rend un verdict EST le verdict. Sous l'ancien nom,
 * sept dimensions auraient quitté le chantier au motif d'une mesure qui ne
 * disait pas cela. Aucune assertion n'a changé : elles portent toutes sur la
 * même frontière, et elles l'appellent maintenant par son nom.
 */
export const ECARTS_REQUIS = 3;

export function horsEscalier(d: DimensionL5, departDelta = 0.18): string | null {
  const grain = grainDe(d);
  const disponibles = Math.floor(departDelta / grain);
  if (disponibles >= ECARTS_REQUIS) return null;
  /*
     « Intl » ET NON « toFixed », et ce n'est pas une préférence de style.

     `essais:accords` refuse tout `toFixed` affiché dans « src/ » : il écrit un
     point décimal et colle le signe, là où le français veut une virgule et une
     espace insécable. Ce pourcentage-ci part dans une phrase montrée, donc il
     passe par « Intl ». Mesuré : le noyau portait un `toFixed` ici, et
     `essais:accords` — qui est au socle — rougissait.
  */
  const pct = (x: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format(x);
  const ecarts = disponibles === 1 ? 'un écart présentable' : `${disponibles} écarts présentables`;
  return (
    `« ${d.id} » ne se mesure pas par escalier : ${d.niveaux} niveaux ` +
    `donnent un grain de ${pct(grain)}, donc ${ecarts} ` +
    `sous le départ de ${pct(departDelta)}, là où il en faut ${ECARTS_REQUIS} pour ` +
    `encadrer un seuil. Mesurée quand même, elle rendrait un chiffre : la personne ` +
    `répondrait au hasard devant deux stimulus trop proches pour différer, et ` +
    `l’escalier lirait ses erreurs comme un seuil. Elle se mesure par ` +
    `identification, où le nombre de niveaux est un atout et non un obstacle.`
  );
}

/**
 * LA DIMENSION EST-ELLE MESURABLE DU TOUT, ET SINON POURQUOI.
 *
 * Le seul critère de REJET, décidé par le pilote le 1er novembre : moins de
 * trois niveaux. En dessous, il n'y a pas de quoi présenter un écart de part
 * et d'autre d'un seuil, et aucune tâche n'y changerait rien — deux niveaux
 * n'offrent qu'un seul écart non nul, et une dimension à un niveau ne montre
 * rien.
 *
 * **Deux fonctions, et c'est le point.** Celle-ci rejette ; `horsEscalier`
 * oriente. Les confondre revenait à rejeter sept dimensions parfaitement
 * mesurables parce qu'une procédure sur deux ne leur convient pas.
 */
export const NIVEAUX_REQUIS = 3;

export function raisonDInaptitude(d: DimensionL5): string | null {
  if (d.niveaux === undefined || d.niveaux >= NIVEAUX_REQUIS) return null;
  return (
    `« ${d.id} » n’est pas mesurable : ${d.niveaux} niveaux. Il en faut au moins ` +
    `${NIVEAUX_REQUIS} pour présenter un écart de part et d’autre d’un seuil. ` +
    `Aucune tâche n’y changerait rien : à deux niveaux il n’existe qu’un seul ` +
    `écart non nul, et il n’y a donc pas de seuil à chercher.`
  );
}

/* ── LES DEUX RÈGLES DÉCLARÉES, ET LEUR BALAYAGE ──────────────────────── */

/**
 * LA RÈGLE PHOTOSENSIBLE, comme propriété du registre et non comme vigilance.
 *
 * Rend la liste des dimensions qui varient dans le temps sans déclarer le gris
 * neutre. Un balayage plutôt qu'une relecture : la règle vaut pour les
 * quatre-vingt-cinq, et une règle qu'il faut se rappeler à chaque ajout est
 * déjà perdue.
 */
export function manquentLeGrisNeutre(
  dimensions: (DimensionL5 & { grisNeutre?: true })[],
): string[] {
  return dimensions.filter((d) => d.varieDansLeTemps && !d.grisNeutre).map((d) => d.id);
}

/**
 * L'INDICE PARASITE ARITHMÉTIQUE : le nombre ne doit pas se lire dans la durée.
 *
 * Une dimension qui fait varier un nombre d'événements doit fixer sa durée
 * totale. Sans cela, plus d'événements veut dire plus long, la personne compare
 * des durées, et le seuil mesuré porte sur la durée — pas sur le nombre.
 *
 * Le contrôle est faible et il faut le dire : il vérifie que la durée est
 * DÉCLARÉE, pas que le rendu la respecte. Ce second point ne se mesure qu'au
 * rendu, qui n'existe pas encore.
 */
export function nombresSansDureeFixe(
  dimensions: (DimensionL5 & { compteDEvenements?: true })[],
): string[] {
  return dimensions
    .filter((d) => d.compteDEvenements && d.dureeTotaleMs === undefined)
    .map((d) => d.id);
}
