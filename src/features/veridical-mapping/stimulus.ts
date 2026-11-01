/**
 * Un stimulus concret : ce qu'il faut montrer ou jouer pour un pas donné.
 *
 * Une seule dimension varie à la fois ; toutes les autres prennent une valeur
 * fixe. C'est indispensable à la validité de la mesure — si la hauteur variait
 * en même temps que l'intensité, le seuil mesuré ne porterait sur aucune des
 * deux.
 */
import {
  dimensionParId,
  type AttributDeStimulus,
  type Dimension,
  type Modalite,
} from './dimensions';

/** Valeurs des dimensions qui ne varient pas dans un essai donné. */
export const FIXES = {
  taillePx: 84,
  clarte: 62,
  teinte: 210,
  positionPct: 50,
  frequenceHz: 440,
  niveauDb: -14,
  dureeMs: 360,
} as const;

export interface Stimulus {
  dimension: string;
  modalite: Modalite;
  taillePx: number;
  /** Clarté L*, de 0 à 100. */
  clarte: number;
  /** Teinte en degrés. */
  teinte: number;
  /** Position le long de la ligne, en pourcentage. */
  positionPct: number;
  frequenceHz: number;
  niveauDb: number;
  dureeMs: number;
}

/**
 * LE STIMULUS D'UNE DIMENSION, SANS QUE CE FICHIER CONNAISSE LA LISTE.
 *
 * C'était un `switch` de sept cas, plus un `default` qui rendait le stimulus
 * de repos — donc une dimension oubliée du `switch` produisait un stimulus
 * **immobile**, et l'essai qui en dépendait mesurait un tirage au sort en se
 * présentant comme une discrimination. Rien ne levait.
 *
 * La dimension porte maintenant l'attribut qu'elle pilote, et ce fichier le
 * lit. Deux conséquences : une dimension nouvelle n'oblige plus à toucher
 * ici — c'est la frontière que le prompt 63 demande pour le lot des
 * dimensions —, et l'oubli silencieux disparaît, puisqu'il n'y a plus rien à
 * oublier. Le typage de `attribut` fait le reste : un attribut qui n'existe
 * pas ne compile pas.
 */
export function stimulus(dimension: Dimension, pas: number): Stimulus {
  return {
    dimension: dimension.id,
    modalite: dimension.modalite,
    ...FIXES,
    [dimension.attribut]: dimension.valeur(pas),
  };
}

/**
 * Superpose deux stimulus visuels en un seul.
 *
 * C'est ce que demande la tâche « un couple » : une référence n'y est pas une valeur
 * sur une dimension mais un **couple** de valeurs sur deux dimensions, porté par
 * un seul objet — un disque à la fois grand et clair, par exemple.
 *
 * La superposition n'est possible que parce que chaque dimension ne touche qu'un
 * attribut de `Stimulus`. On part donc du premier et l'on n'écrase que l'attribut
 * du second, ce qui rend l'opération sûre sans qu'il faille énumérer les couples.
 * Deux dimensions qui se disputeraient le même attribut produiraient un stimulus
 * où la seconde effacerait la première — d'où la vérification de `superposables`,
 * qui écarte ces couples au tirage plutôt que de les rendre indistinguables.
 */
/**
 * LES ATTRIBUTS QU'UN STIMULUS FAIT VARIER, LUS SUR LE REGISTRE.
 *
 * Un stimulus porte l'identifiant de sa dimension, et un stimulus déjà
 * superposé porte les deux joints par « + » : le découpage rend donc la liste
 * exacte, superposition imbriquée comprise.
 *
 * Elle était auparavant INFÉRÉE, en comparant chaque attribut à sa valeur de
 * repos. L'inférence était juste — voir `superposer` — mais elle l'était par
 * conséquence d'un invariant, et non par lecture de la règle.
 */
function attributsVaries(unStimulus: Stimulus): AttributDeStimulus[] {
  const morceaux = unStimulus.dimension.split('+');
  const dimensions = morceaux.map((id) => dimensionParId(id));
  const inconnu = morceaux.find((id, rang) => dimensions[rang] === undefined);
  if (inconnu !== undefined) {
    /*
       ON LÈVE PLUTÔT QUE DE RETOMBER SUR LA DEVINETTE.

       Un identifiant hors registre ne peut pas arriver : les stimulus sont
       produits par `stimulus()` à partir d'une dimension du registre. S'il
       arrivait, retomber sur la comparaison aux valeurs de repos rendrait un
       stimulus plausible et faux, et la mesure continuerait sans rien dire.
       C'est exactement le mode de panne que ce correctif supprime, et il n'a
       pas à être réintroduit par la porte de service.
    */
    throw new Error(`superposer : dimension hors registre « ${inconnu} »`);
  }
  return (dimensions as Dimension[]).map((dimension) => dimension.attribut);
}

export function superposer(premier: Stimulus, second: Stimulus): Stimulus {
  const fusion: Stimulus = { ...premier };
  /*
     L'ATTRIBUT REPORTÉ EST CELUI QUE LA DIMENSION PILOTE, ET NON CELUI QUI
     SE TROUVE DIFFÉRER DE LA VALEUR DE REPOS.

     La boucle précédente reportait « tout attribut dont la valeur n'est pas
     celle de repos », et une liste d'attributs écrite à la main lui disait
     lesquels examiner. Ce même fichier produit maintenant un résultat
     identique en lisant la règle sur le registre. **Le comportement ne
     change pas**, et il faut le dire : l'inférence était juste.

     Elle l'était par conséquence, non par construction. La teinte au pas 70
     vaut 210°, qui EST sa valeur de repos : cet attribut n'était donc pas
     reporté. Le couple restait correct parce que `premier` ne pilote jamais
     l'attribut du `second` — `superposables` l'exige — et portait donc déjà
     cette même valeur de repos. Le résultat juste reposait ainsi sur un
     invariant d'un AUTRE fichier, que son propre commentaire annonçait sans
     le vérifier, et sur une coïncidence de valeurs. Les deux tenaient ; ni
     l'une ni l'autre n'était mesurée.

     Deux choses y gagnent. La liste écrite à la main disparaît : c'était une
     seconde source, et un attribut ajouté à `Stimulus` sans y être inscrit
     n'aurait jamais été reporté. Et une dimension nouvelle n'a plus besoin
     que la coïncidence lui soit favorable.
  */
  for (const attribut of attributsVaries(second)) {
    fusion[attribut] = second[attribut];
  }
  fusion.dimension = `${premier.dimension}+${second.dimension}`;
  // La modalité du couple est auditive dès qu'un des deux l'est : il faudra
  // jouer un son, et l'interface doit le savoir.
  fusion.modalite = premier.modalite === 'auditive' || second.modalite === 'auditive'
    ? 'auditive'
    : 'visuelle';
  return fusion;
}

/**
 * Deux dimensions peuvent-elles être superposées sans se recouvrir ?
 *
 * Elles ne peuvent pas si elles pilotent le même attribut — ce qui n'arrive pas
 * dans le catalogue actuel, chaque dimension ayant le sien — ni si elles sont
 * toutes deux auditives : deux sons superposés ne se distinguent pas à l'écoute
 * comme deux attributs d'un même disque se distinguent à l'œil. La restriction
 * est perceptive, non technique, et c'est la raison de la nommer ici plutôt que
 * de la laisser se deviner à l'usage.
 */
export function superposables(a: Dimension, b: Dimension): boolean {
  if (a.id === b.id) return false;
  /*
     LA GARDE QUE LE COMMENTAIRE CI-DESSUS ANNONÇAIT SANS LA POSER.

     Il disait « elles ne peuvent pas si elles pilotent le même attribut — ce
     qui n'arrive pas dans le catalogue actuel ». La seconde moitié était vraie
     et la première n'était pas vérifiée : rien n'empêchait d'ajouter une
     huitième dimension pilotant `clarte`, et le couple l'aurait acceptée. La
     superposition aurait alors écrasé la composante de la première par celle
     de la seconde — un couple où l'une des deux dimensions ne se voit pas.

     Et c'est de cet invariant que `superposer` tire sa justesse. Il était donc
     énoncé dans un fichier, utilisé dans un autre, et vérifié dans aucun. Il
     se mesure maintenant, ce que seul permet l'attribut porté par la
     dimension.
  */
  if (a.attribut === b.attribut) return false;
  if (a.modalite === 'auditive' && b.modalite === 'auditive') return false;
  return true;
}
