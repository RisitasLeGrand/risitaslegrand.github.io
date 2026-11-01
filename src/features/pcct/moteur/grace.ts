/**
 * Le délai de grâce : à QUEL essai une réponse appartient.
 *
 * ## Ce que l'aide promet
 *
 * À cadence rapide, on tape sa réponse et le nombre suivant paraît pendant que
 * le doigt descend. Sans le délai de grâce, cette frappe compte pour le NOUVEL
 * essai — donc faux deux fois : l'essai précédent est manqué, et le courant est
 * raté par une réponse qui ne le visait pas. Une seule hésitation en coûte deux.
 *
 * L'aide ouvre une courte fenêtre après l'apparition d'un nombre : une réponse
 * qui y tombe, alors que l'essai précédent n'a PAS été répondu, lui est
 * attribuée.
 *
 * ## Le défaut de la référence, et pourquoi l'ordre est tout
 *
 * La référence porte bien une fenêtre, et elle ne sert jamais : la branche qui
 * note l'essai COURANT vient avant celle qui note la fenêtre, et rien ne
 * l'empêche de consommer la frappe. La fenêtre s'ouvre, s'affiche, se ferme, et
 * ne reçoit rien.
 *
 * D'où une fonction qui décide, et une seule, dont l'ordre des cas est la
 * chose à ne pas défaire. `essais:pcct` la saborde en inversant les deux
 * premiers cas, et le rouge le dit.
 *
 * ## Pourquoi ce n'est pas dans l'écran
 *
 * L'attribution est une règle, pas un geste. Mise dans l'écran, elle ne
 * s'éprouverait qu'au navigateur, avec une bâtisse par sabotage et des courses
 * de minuterie à amadouer ; ici elle s'éprouve en millisecondes, et l'écran n'a
 * plus qu'à poser les trois nombres qu'elle demande.
 */

/** À qui la réponse est attribuée. */
export type Attribution = 'courant' | 'precedent' | 'perdue';

export interface Circonstances {
  /** Millisecondes écoulées depuis l'apparition du nombre courant. */
  depuisLApparition: number;
  /** La fenêtre de grâce, en millisecondes. Zéro désactive l'aide. */
  delaiDeGrace: number;
  /** L'essai courant attend-il encore une réponse ? */
  courantEnAttente: boolean;
  /**
   * L'essai PRÉCÉDENT est-il resté sans réponse ?
   *
   * S'il a déjà été répondu, il n'y a rien à rattraper, et la frappe revient au
   * courant même dans la fenêtre : la grâce rattrape un retard, elle ne permet
   * pas de répondre deux fois.
   */
  precedentSansReponse: boolean;
}

/**
 * Décide à quel essai une frappe appartient.
 *
 * L'ORDRE DES CAS EST LA RÈGLE. Le rattrapage est examiné d'abord, parce que
 * c'est le cas particulier : l'examiner après le cas général revient à ne jamais
 * l'examiner, puisque le cas général accepte toujours.
 */
export function attribuer(c: Circonstances): Attribution {
  /* 1. Le rattrapage, d'abord. */
  if (
    c.delaiDeGrace > 0 &&
    c.precedentSansReponse &&
    c.depuisLApparition <= c.delaiDeGrace
  ) {
    return 'precedent';
  }
  /* 2. L'essai courant, s'il attend encore. */
  if (c.courantEnAttente) return 'courant';
  /* 3. Ni l'un ni l'autre : le courant est déjà noté et il n'y a rien à
        rattraper. La frappe est perdue, et c'est le bon résultat — la compter
        quelque part reviendrait à noter deux fois le même essai. */
  return 'perdue';
}
