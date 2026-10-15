/**
 * Le recalcul du texte depuis la source — phase 3 du prompt 32.
 *
 * ## Pourquoi un mécanisme, et pas douze fonctions
 *
 * La phase 2 a décidé qu'un élément ne porte **aucun texte** : il porte une
 * source et une référence, et le libellé se recalcule à l'affichage. Reste à
 * dire *qui* recalcule. Chaque source sait lire ses propres données et elle
 * seule ; le centre, lui, ne doit rien savoir d'elles. D'où un **port** : la
 * source déclare un résolveur, le centre l'appelle sans jamais ouvrir ce
 * qu'il y a derrière.
 *
 * Ce fichier ne contient donc aucun résolveur. Il contient le contrat, les
 * quatre issues possibles d'une résolution, et la règle de prudence. Les
 * douze résolveurs arrivent en phase 5, un par un.
 *
 * ## La règle de prudence : dire qu'on ne peut pas savoir, jamais deviner
 *
 * C'est la règle du prompt 38, reprise telle quelle. Un texte recalculé
 * depuis une source scellée n'existe pas tant que le coffre est fermé. Le
 * centre ne le remplace **ni par un libellé générique plausible, ni par la
 * dernière valeur connue** : il dit que c'est chiffré, ou il n'affiche rien.
 * Les deux sont honnêtes ; inventer ne l'est pas.
 *
 * Trois conséquences écrites dans le type :
 *
 * - une source **inconnue** du registre ne s'affiche pas. Pas de libellé de
 *   repli : si personne n'a déclaré la politique de confidentialité d'une
 *   source, le centre ne peut pas savoir ce qu'il a le droit d'en montrer ;
 * - une référence que la source **ne reconnaît plus** rend l'élément
 *   orphelin, et un orphelin se supprime (§ 1 n° 9) — il ne se garde pas
 *   avec un libellé « élément supprimé », qui serait encore une trace ;
 * - un texte **vide** est un défaut du résolveur, pas un texte. Le contrôle
 *   le refuse, pour qu'une ligne blanche ne passe jamais pour un rendu.
 */

import type { ElementDuCentre } from './modele';

/* ══════════════════════════════════════════════════════════════════════════
   Ce que la source laisse voir quand le coffre est fermé
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La colonne « panneau coffre fermé » du tableau de sensibilité, mise en
 * type. Elle appartient à la source, pas au centre : c'est la source qui
 * sait si ses données vivent sous le coffre et ce qu'elle accepte d'en dire.
 */
export type PolitiqueFermee =
  /** L'élément n'apparaît pas du tout. Son existence même est une donnée. */
  | 'rien'
  /** Une ligne, qui dit que c'est chiffré et rien d'autre. */
  | 'mention'
  /** Le texte entier : les données de cette source ne sont pas scellées. */
  | 'texte';

/**
 * La mention affichée pour un élément illisible.
 *
 * Mot pour mot celle du prompt 38 (`odyssee/coffre-ferme.ts`). Deux
 * formulations pour la même situation apprendraient à l'œil qu'il y a deux
 * situations ; un essai vérifie qu'elles restent identiques.
 */
export const MENTION_COFFRE = 'État chiffré — ouvrez le coffre pour le voir';

/* ══════════════════════════════════════════════════════════════════════════
   Le contrat d'un résolveur
   ══════════════════════════════════════════════════════════════════════════ */

export interface Resolveur {
  /** L'identifiant de source, tel que `filtre-cycle.ts` le déclare. */
  readonly source: string;
  /** La politique du tableau de sensibilité, coffre fermé. */
  readonly coffreFerme: PolitiqueFermee;
  /**
   * Le texte à afficher, recalculé depuis la source.
   *
   * `null` signifie **la source ne connaît plus cette référence** — et non
   * « je n'ai pas pu lire ». Un résolveur qui ne peut pas lire lève ; un
   * résolveur qui a lu et n'a rien trouvé rend `null`. La différence décide
   * d'une suppression, elle ne se devine pas.
   */
  texte(refSource: string): Promise<string | null>;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les quatre issues d'une résolution
   ══════════════════════════════════════════════════════════════════════════ */

export type Rendu =
  /** Le texte, recalculé à l'instant depuis la source. */
  | { etat: 'lisible'; texte: string }
  /** Une ligne qui dit qu'on ne peut pas savoir. */
  | { etat: 'illisible'; texte: typeof MENTION_COFFRE }
  /** Rien : l'élément n'apparaît pas tant que le coffre est fermé. */
  | { etat: 'masque' }
  /** La source ne reconnaît plus la référence : l'élément est à supprimer. */
  | { etat: 'orphelin' }
  /** Aucun résolveur déclaré : on n'affiche pas ce qu'on ne sait pas cadrer. */
  | { etat: 'inconnu' };

/** Seuls ces deux états produisent une ligne dans le panneau. */
export const sAffiche = (rendu: Rendu): boolean =>
  rendu.etat === 'lisible' || rendu.etat === 'illisible';

/** § 1 n° 9 : l'effacement d'une source emporte ses éléments. */
export const aSupprimer = (rendu: Rendu): boolean => rendu.etat === 'orphelin';

/* ══════════════════════════════════════════════════════════════════════════
   La résolution
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Recalcule le texte d'un élément.
 *
 * L'ordre des trois questions n'est pas indifférent, et c'est lui qui porte
 * la confidentialité :
 *
 * 1. **la source est-elle déclarée ?** Sinon on s'arrête là. C'est la seule
 *    des trois qui protège quelque chose par elle-même : tout repli — un
 *    libellé générique, « Notification » — afficherait un élément dont
 *    personne n'a déclaré ce qu'on avait le droit d'en montrer ;
 * 2. **le coffre est-il fermé ?** Alors c'est la politique déclarée qui
 *    répond, et le résolveur n'est **pas appelé** si elle vaut `rien` ou
 *    `mention` — ne pas lire vaut mieux que lire et taire ;
 * 3. **sinon**, le texte vient de la source.
 *
 * Un mot sur l'ordre, pour ne pas lui prêter plus qu'il ne fait : déplacer
 * la première question après la deuxième ne crée pas de fuite, cela plante
 * sur un résolveur absent. C'est la garde elle-même qui protège, pas sa
 * position — l'essai qui le montre est celui du libellé générique.
 */
export async function rendre(
  element: Pick<ElementDuCentre, 'source' | 'refSource'>,
  options: { coffreOuvert: boolean; resolveurs: ReadonlyMap<string, Resolveur> },
): Promise<Rendu> {
  const resolveur = options.resolveurs.get(element.source);
  if (!resolveur) return { etat: 'inconnu' };

  if (!options.coffreOuvert) {
    if (resolveur.coffreFerme === 'rien') return { etat: 'masque' };
    if (resolveur.coffreFerme === 'mention') {
      return { etat: 'illisible', texte: MENTION_COFFRE };
    }
  }

  const texte = await resolveur.texte(element.refSource);
  if (texte === null) return { etat: 'orphelin' };
  if (texte.trim() === '') {
    throw new Error(
      `Le résolveur « ${resolveur.source} » a rendu un texte vide. ` +
        'Une référence inconnue se signale par `null`, pas par une chaîne vide.',
    );
  }
  return { etat: 'lisible', texte };
}

/** Rend le registre indexé, en refusant deux résolveurs pour une même source. */
export function registre(resolveurs: readonly Resolveur[]): ReadonlyMap<string, Resolveur> {
  const par = new Map<string, Resolveur>();
  for (const r of resolveurs) {
    if (par.has(r.source)) {
      throw new Error(`Deux résolveurs déclarés pour « ${r.source} ».`);
    }
    par.set(r.source, r);
  }
  return par;
}
