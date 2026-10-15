/**
 * Le calendrier quand le coffre est fermé — phase 7 du prompt 38.
 *
 * ## Ce qui reste lisible, et ce qui ne l'est pas
 *
 * Les occurrences ordinaires sont **calculées** par `repetition.ts` : la
 * série vit en clair dans la tâche, donc le calendrier se dessine
 * entièrement coffre fermé. Ce sont les **exceptions** qui peuvent manquer,
 * et seulement celles des tâches liées à une branche sous coffre
 * (`magasinDeLException()`).
 *
 * L'écart compte : pour l'immense majorité des tâches, fermer le coffre ne
 * change rien. Pour celles-là, une occurrence s'affiche **sans son état** —
 * ni pointée, ni abandonnée, ni déplacée — et il faut le dire plutôt que de
 * la montrer « à faire », qui serait une affirmation fausse.
 *
 * ## Ce qu'un geste peut faire, et le mur qu'il rencontre
 *
 * Trois cas, et le troisième n'est pas implémenté — volontairement, voir
 * plus bas :
 *
 * | Cas | Ce qui se passe |
 * |---|---|
 * | Exception en clair | Le geste s'écrit, coffre ouvert ou fermé. |
 * | Exception scellée, coffre ouvert | Le geste s'écrit sous scellé. |
 * | Exception scellée, coffre fermé | **Le geste ne peut pas être enregistré.** |
 *
 * ## Pourquoi le report en attente n'existe pas encore
 *
 * Le magasin `odysseeReports` a été créé en phase 2 pour cela : garder le
 * geste et l'écrire à l'ouverture. Il est **scellé**, donc ses écritures
 * exigent le coffre ouvert — c'est-à-dire exactement la condition qu'il
 * était censé contourner. Le magasin ne peut pas servir à ce pour quoi il
 * a été fait, et c'est une erreur de ma part, pas une limite.
 *
 * Le descellér n'est pas un détail d'implémentation : une file en clair
 * portant « tâche T, jour J, branche psyché » révèle qu'un check-in a été
 * fait ce jour-là, ce que l'exception scellée a précisément pour objet de
 * cacher. La trace serait transitoire — effacée au report — mais elle
 * existerait. C'est un arbitrage sur le chiffrement, donc il revient à
 * Alexis, et rien n'est écrit en attendant.
 *
 * Ce module dit donc le refus **proprement**, avec sa raison affichable, au
 * lieu de laisser `exigerLeCoffre()` lever une exception à la figure de
 * l'écran.
 */
import { magasinDeLException } from './liaison-branches';
import type { Tache } from './modele';

/** Ce que le calendrier sait de l'état d'une occurrence. */
export type LisibiliteDeLOccurrence = 'lisible' | 'scellee';

/**
 * L'état de cette occurrence est-il lisible ?
 *
 * `scellee` ne veut pas dire « il y a une exception » — on n'en sait rien,
 * c'est tout le problème. Il veut dire : **on ne peut pas savoir**.
 */
export const lisibiliteDeLOccurrence = (
  tache: Tache,
  coffreOuvert: boolean,
): LisibiliteDeLOccurrence =>
  !coffreOuvert && magasinDeLException(tache) === 'odysseeExceptionsScellees'
    ? 'scellee'
    : 'lisible';

/** Ce qu'un écran affiche à la place d'un état qu'il ne peut pas lire. */
export const MENTION_ETAT_SCELLE = 'État chiffré — ouvrez le coffre pour le voir';

export type GesteSousCoffre =
  /** Le geste s'écrit, en clair ou sous scellé selon le magasin. */
  | { quoi: 'ecrire'; magasin: 'odysseeOccurrences' | 'odysseeExceptionsScellees' }
  /** Le geste est gardé chiffré et rejoué à l'ouverture — A-6, option D. */
  | { quoi: 'reporter' }
  /** Le geste est impossible. `pourquoi` s'affiche tel quel. */
  | { quoi: 'impossible'; pourquoi: string };

/**
 * Ce qu'un geste sur cette tâche peut faire, dans l'état du coffre.
 *
 * Le refus est rendu comme une **valeur**, pas comme une exception lancée :
 * un écran qui doit afficher « ouvrez le coffre » n'a pas à attraper une
 * erreur pour l'apprendre, et une erreur attrapée finit toujours par être
 * confondue avec une panne.
 */
export function gesteSousCoffre(
  tache: Tache,
  coffreOuvert: boolean,
  boiteDisponible = false,
): GesteSousCoffre {
  const magasin = magasinDeLException(tache);
  if (magasin === 'odysseeOccurrences') return { quoi: 'ecrire', magasin };
  if (coffreOuvert) return { quoi: 'ecrire', magasin };
  /*
     A-6, option D : le geste est gardé chiffré plutôt que refusé. Il faut
     pour cela qu'une boîte existe — donc que le coffre ait été ouvert au
     moins une fois sur cet appareil. Sans elle, le refus demeure, et c'est
     préférable à un geste qu'on dirait gardé sans l'avoir gardé.
  */
  if (boiteDisponible) return { quoi: 'reporter' };
  return {
    quoi: 'impossible',
    pourquoi:
      'Cette tâche touche une branche chiffrée, et ce navigateur n’a pas encore de boîte. Ouvrez le coffre une fois pour pouvoir la pointer plus tard.',
  };
}

/**
 * Les tâches dont le calendrier ne peut pas montrer l'état, coffre fermé.
 *
 * Rendu pour que l'écran puisse le dire **une fois**, en tête de journée,
 * plutôt que de répéter la mention sur chaque ligne.
 */
export const tachesIllisibles = (
  taches: readonly Tache[],
  coffreOuvert: boolean,
): Tache[] => taches.filter((t) => lisibiliteDeLOccurrence(t, coffreOuvert) === 'scellee');
