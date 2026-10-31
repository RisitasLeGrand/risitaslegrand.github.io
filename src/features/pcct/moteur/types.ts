/**
 * Les types du moteur de PCCT.
 *
 * Tout ce qui suit est PUR : aucun accès au document, aucune minuterie, aucun
 * tirage caché. Le hasard et l'heure entrent par des paramètres, ce qui est la
 * seule façon d'éprouver un rythme adaptatif et une mémoire prospective sans
 * attendre quinze minutes par essai.
 */

/** Les quatre opérations. Le libellé français est à l'écran, la clé au moteur. */
export type Operation = 'somme' | 'difference' | 'produit' | 'quotient';

export const OPERATIONS: readonly Operation[] = [
  'somme',
  'difference',
  'produit',
  'quotient',
] as const;

/** Les trois algorithmes de rythme. */
export type Rythme = 'standard' | 'douce' | 'precision';

/** Ce que la séance tire au sort et pose devant la personne. */
export interface Essai {
  /** Rang dans la séance, à partir de 1. */
  rang: number;
  /** Le nombre présenté à cet essai. */
  nombre: number;
  /**
   * Le nombre présenté n positions plus tôt, ou `null` pendant l'échauffement.
   *
   * `null` n'est pas « zéro » : c'est « il n'y a pas encore de référence », et
   * un essai sans référence ne se note pas.
   */
  reference: number | null;
  operation: Operation;
  /** Le résultat attendu, ou `null` pendant l'échauffement. */
  attendu: number | null;
  /** L'intervalle qui a précédé cet essai, en millisecondes. */
  intervalle: number;
}

/** Ce que la personne a fait d'un essai. */
export interface Reponse {
  /** Ce qui a été saisi, ou `null` si rien ne l'a été. */
  donne: number | null;
  /** Le délai entre la présentation et la saisie, en millisecondes. */
  reaction: number | null;
  /** L'aide qui a fait accepter une réponse qui, sans elle, aurait été fausse. */
  aide: Aide | null;
}

/** Les aides qui peuvent faire accepter une réponse. */
export type Aide = 'doigt-glisse' | 'chiffres-inverses' | 'chiffre-des-unites' | 'delai-de-grace';

/** Une consigne de mémoire prospective : « dans X secondes, appuyez sur K ». */
export interface Consigne {
  id: string;
  /** L'instant où la consigne a paru, en millisecondes depuis le début. */
  creeeA: number;
  /** L'instant où elle doit être exécutée. */
  echeance: number;
  /** La durée pendant laquelle la touche est acceptée, en millisecondes. */
  fenetre: number;
  /** La touche demandée. */
  touche: string;
}

/** Ce qu'une consigne est devenue. */
export type VerdictConsigne = 'juste' | 'manquee' | 'omise' | 'fausse';

export interface ConsigneJugee extends Consigne {
  verdict: VerdictConsigne;
  /** Ce qui a été pressé, s'il y a eu une frappe dans la fenêtre. */
  presse: string | null;
  /** Quand, en millisecondes depuis le début. */
  presseA: number | null;
}

/** Les trois scores, comme dans la référence. */
export interface Scores {
  /** Essais justes sur essais notés. `null` si aucun essai n'a été noté. */
  arithmetique: number | null;
  /** Justes sur l'ensemble des consignes échues. `null` s'il n'y en a eu aucune. */
  prospective: number | null;
  /** La moyenne des deux présents. `null` si aucun des deux n'existe. */
  global: number | null;
}
