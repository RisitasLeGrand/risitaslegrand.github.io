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
 * son grain. Celui-ci vaut `1 / (niveaux - 1)` quand la dimension est ouverte
 * aux deux bouts, et `1 / niveaux` quand elle REBOUCLE — un jour de la semaine,
 * un mois, un point cardinal —, parce que `STEP` y vaut alors « round(z·n)
 * modulo n ». Ma première version prenait 1/(n−1) partout ; l'agent A l'a
 * relevé. Mesuré, sur des dimensions ouvertes :
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
   * LA DIMENSION REBOUCLE-T-ELLE SUR ELLE-MÊME ?
   *
   * Elle change le GRAIN, et pas seulement l'écart entre deux positions. La
   * référence d'A donne la déclaration : « STEP » vaut « round(z·n) modulo n »
   * quand la dimension reboucle, et « round(z·(n−1)) » sinon. Le grain est donc
   * 1/n pour une circulaire et 1/(n−1) pour les autres.
   *
   * Ma première version prenait 1/(n−1) partout. Sur une circulaire à sept
   * niveaux — « weekday », « note_name » — elle rendait 16,7 % là où la
   * référence dit 14,3 % : une surestimation de 17 %. La direction était
   * prudente, et le chiffre faux ; un plancher trop grossier écarte des
   * dimensions mesurables.
   */
  circulaire?: true;
  /**
   * LE PIRE GRAIN, quand il ne se déduit pas du nombre de niveaux.
   *
   * Sur une échelle logarithmique, le grain VARIE avec la position et il est le
   * plus grossier en bas de la plage : « audition.event_count » vaut 24 % en
   * bas et bien moins en haut. Le nombre de niveaux ne suffit donc plus à le
   * dire, et la référence le marque d'une étoile.
   *
   * On prend le pire, et c'est un choix : un plancher calculé localement serait
   * plus fin, mais il changerait de valeur selon l'endroit où l'escalier se
   * trouve — et un seuil dont l'unité bouge en cours de mesure ne se compare à
   * rien, pas même à lui-même.
   */
  pireGrain?: number;
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
  /*
     LE PIRE GRAIN DÉCLARÉ L'EMPORTE, parce qu'il vient d'une mesure sur la
     plage réelle et non d'un compte de niveaux. Il n'existe que pour les
     échelles logarithmiques, où le grain dépend de la position.
  */
  if (d.pireGrain !== undefined) return d.pireGrain;
  if (d.niveaux === undefined) return PLANCHER_MESURABLE;
  if (!Number.isInteger(d.niveaux) || d.niveaux < 2) {
    throw new Error(
      `La dimension « ${d.id} » déclare ${d.niveaux} niveaux. ` +
        'Une dimension discrète en a au moins deux, et un nombre entier : ' +
        'au-dessous il n’y a rien à discriminer, et la mesure n’aurait pas d’objet.',
    );
  }
  /* Circulaire : « round(z·n) modulo n », donc n pas. Sinon « round(z·(n−1)) ». */
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
 * LA DIMENSION EST-ELLE MESURABLE PAR CETTE PROCÉDURE, ET SINON POURQUOI.
 *
 * Rend `null` quand elle l'est, et sinon la phrase à écrire. Le pilote demande
 * que les dimensions écartées le soient « avec leur raison écrite » : la raison
 * est donc produite ici, à côté du critère, et non rédigée à la main ailleurs —
 * deux sources finiraient par ne plus dire la même chose.
 *
 * Le critère : il faut que l'escalier puisse présenter des écarts DE PART ET
 * D'AUTRE du seuil, ce qui demande au moins trois écarts distincts non nuls
 * sous le départ. Avec un départ à 0,18, un grain de 0,0909 n'en offre que
 * deux — 0,0909 et 0,1818 —, et un grain de 0,25 aucun.
 */
export const ECARTS_REQUIS = 3;

/**
 * COMBIEN D'ÉCARTS NON NULS LA DIMENSION PEUT PRÉSENTER SOUS LE DÉPART.
 *
 * Extrait de `raisonDInaptitude` pour une seule raison : la ligne qui suit a
 * un défaut flottant, et tant qu'elle était enfouie dans la phrase de refus
 * ce défaut n'était pas mesurable. Il l'est maintenant.
 *
 * ## LE DÉFAUT, ET CE QU'IL NE FAIT PAS
 *
 * « departDelta / grain » est une division flottante. Relevé sur huit valeurs
 * de départ et tous les grains 1/n et 1/(n−1) jusqu'à n = 400 : **70 couples
 * où le quotient tombe juste sous l'entier** — 0,18 / (1/150) rend
 * 26,999999999999996 au lieu de 27 — et le plancher les couche alors d'un
 * rang. Le « + 1e-9 » les répare tous, et n'en casse aucun.
 *
 * **Et il ne change aucun verdict aujourd'hui, ce qu'il faut dire.** Les 70
 * divergences se produisent toutes à neuf écarts ou plus, là où le seuil est
 * à trois : les deux côtés de l'erreur sont au-dessus, donc la dimension est
 * admise dans les deux cas. Relevé plus largement : sur les 18 000 grains au
 * cent-millième entre 0 et 0,18, **aucun ne fait basculer le verdict**.
 *
 * J'ai d'abord écrit l'inverse — que la garde réparait une dimension à trois
 * écarts exacts injustement écartée — sur la foi de « 0,24 / 0,08 », que
 * j'avais supposé valoir 2,9999999999999996. Il vaut 3, exactement.
 * L'assertion qui devait l'établir était verte parce qu'elle passait par un
 * comparateur à 1e-9, et l'écart qu'elle prétendait détecter vaut 4e-16 : une
 * tolérance plus large que l'effet qu'elle mesure rend l'assertion
 * décorative. C'est le sabotage qui l'a dit — retirer la garde ne rougissait
 * rien.
 *
 * ## POURQUOI LA GARDE RESTE
 *
 * Parce que `ECARTS_REQUIS` est une constante, et que la divergence est
 * exactement à la hauteur où quelqu'un pourrait la porter. À neuf écarts
 * requis, un grain de 1/75 sous un départ de 0,12 en présente neuf, et sans
 * la garde il en présenterait huit : la dimension serait écartée pour une
 * erreur de représentation, avec une phrase parfaitement plausible. La garde
 * ne répare donc rien d'observable ; elle empêche qu'un changement de seuil
 * rende observable un défaut déjà présent.
 */
export function ecartsPresentables(d: DimensionL5, departDelta = 0.18): number {
  return Math.floor(departDelta / grainDe(d) + 1e-9);
}

/**
 * LE COMPTE EXACT, par arithmétique entière, pour servir de référence.
 *
 * Il n'est pas appelé par le programme : il existe pour que l'essai ait une
 * seconde route vers le même nombre, qui ne passe par aucun flottant. Une
 * assertion qui recalculerait le compte comme le code le calcule ne
 * vérifierait que sa propre copie.
 *
 * Exposé plutôt que recopié dans l'essai pour la raison inverse : recopié, il
 * dériverait. Le départ est donné en centièmes parce que c'est ainsi qu'il est
 * écrit — 0,18 n'est pas représentable en binaire, 18 l'est.
 */
export function ecartsPresentablesExacts(centiemesDeDepart: number, pasDansLaDimension: number): number {
  return Math.floor((centiemesDeDepart * pasDansLaDimension) / 100);
}

/**
 * LA DIMENSION EST-ELLE MESURABLE PAR CETTE PROCÉDURE, ET SINON POURQUOI.
 *
 * Rend `null` quand elle l'est, et sinon la phrase à écrire. Le pilote demande
 * que les dimensions écartées le soient « avec leur raison écrite » : la raison
 * est donc produite ici, à côté du critère, et non rédigée à la main ailleurs —
 * deux sources finiraient par ne plus dire la même chose.
 *
 * Le critère : il faut que l'escalier puisse présenter des écarts DE PART ET
 * D'AUTRE du seuil, ce qui demande au moins trois écarts distincts non nuls
 * sous le départ. Avec un départ à 0,18, un grain de 0,0909 n'en offre que
 * deux — 0,0909 et 0,1818 —, et un grain de 0,25 aucun.
 */
export function raisonDInaptitude(d: DimensionL5, departDelta = 0.18): string | null {
  const grain = grainDe(d);
  const disponibles = ecartsPresentables(d, departDelta);
  if (disponibles >= ECARTS_REQUIS) return null;
  const pourCent = new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  /*
     « écart présentable » s'accorde, il ne porte pas de « (s) ».

     La règle d'écriture l'interdit, et ce n'est pas une coquetterie : le
     nombre vaut ici zéro, un ou deux, tous connus à l'écriture. « 0 écart »
     est la forme française — le singulier va jusqu'à deux exclu.
  */
  const ecarts = `${disponibles} ${disponibles >= 2 ? 'écarts présentables' : 'écart présentable'}`;
  /*
     Une échelle logarithmique déclare son pire grain sans que le nombre de
     niveaux le commande : le dire « à n niveaux » serait faux, et sur une
     dimension sans « niveaux » la phrase annonçait « undefined niveaux ».
  */
  const origine =
    d.pireGrain !== undefined
      ? 'son grain le plus grossier vaut'
      : `${d.niveaux} niveaux donnent un grain de`;
  return (
    `« ${d.id} » n’est pas mesurable par cet escalier : ${origine} ` +
    `${pourCent.format(grain)}, donc ${ecarts} sous le départ de ` +
    `${pourCent.format(departDelta)}, là où il en faut ${ECARTS_REQUIS} pour ` +
    `encadrer un seuil. Mesurée quand même, elle rendrait un chiffre : la personne ` +
    `répondrait au hasard devant deux stimulus trop proches pour différer, et ` +
    `l’escalier lirait ses erreurs comme un seuil.`
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
