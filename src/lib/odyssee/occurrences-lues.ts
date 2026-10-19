/**
 * Lire les occurrences d'une fenêtre — la porte unique des trois écrans.
 *
 * ## Pourquoi une porte, et pas trois lectures
 *
 * Le calendrier, le tableau de bord et la Revue montrent les mêmes
 * occurrences. Chacun pourrait enchaîner lui-même les trois lectures —
 * les tâches, les exceptions, les faits — puis appeler le moteur. Trois
 * copies, et la troisième aurait oublié d'élargir la fenêtre, ou de lire
 * le magasin scellé, ou de passer l'état du coffre. C'est exactement la
 * forme d'A-14 : une règle tenue à plusieurs endroits finit par n'être
 * tenue qu'à certains.
 *
 * ## Deux économies, et elles sont dites
 *
 * **Les faits peuvent être fournis.** `etatDuJour` projette déjà tous les
 * faits pour la roue et les suggestions ; les reprojeter ici ferait le
 * travail deux fois par peinture du tableau de bord. L'appelant qui les a
 * déjà les passe, et il reste seul juge de leur fenêtre.
 *
 * **Les tâches aussi**, pour la même raison.
 *
 * ## Ce qui n'est jamais économisé
 *
 * La fenêtre élargie et la lecture des deux magasins. `exceptionsDeLaFenetre`
 * est appelée avec les bornes de `fenetreElargie()`, jamais avec celles de
 * l'affichage : une occurrence déplacée de loin perdrait son exception et
 * paraîtrait au jour que la règle prévoyait, c'est-à-dire là où elle n'est
 * plus.
 *
 * ## Les branches illisibles sont rendues, jamais avalées
 *
 * Un `catch` muet ferait passer « je n'ai pas pu lire » pour « il n'y a
 * rien ». L'appelant reçoit leurs noms et décide quoi en dire — en
 * pratique, rien de nommé : la mention d'état chiffré suffit, et nommer la
 * branche dirait déjà quelque chose.
 */
import { coffreOuvert } from '../coffre';
import { toutesLesTaches } from './donnees';
import { exceptionsDeLaFenetre } from './donnees-occurrences';
import { faitsEntre } from './faits-du-jour';
import { LECTRICES } from '../noyau/permissions';
import {
  fenetreElargie,
  occurrencesDeLaFenetre,
  type OccurrenceAffichee,
} from './occurrences-de-la-fenetre';
import type { FaitObserve } from './pointage-derive';
import type { Tache } from './modele';

export interface FenetreDOccurrences {
  occurrences: OccurrenceAffichee[];
  /** Les branches qu'on n'a pas pu lire. Nommées ici, jamais à l'écran. */
  branchesIllisibles: string[];
  /** Les tâches lues, rendues pour éviter une seconde lecture à l'appelant. */
  taches: readonly Tache[];
}

export async function occurrencesLues(
  du: string,
  au: string,
  options: { taches?: readonly Tache[]; faits?: readonly FaitObserve[] } = {},
): Promise<FenetreDOccurrences> {
  const taches = options.taches ?? (await toutesLesTaches());

  /*
     Sans aucune tâche répétée vivante, on s'arrête là. Projeter les faits
     de six branches pour n'afficher aucune ligne serait une lecture de
     données sensibles qu'aucun affichage ne demande.
  */
  if (!taches.some((t) => t.serie && !t.abandonneeLe)) {
    return { occurrences: [], branchesIllisibles: [], taches };
  }

  const ouvert = coffreOuvert();
  const [debut, fin] = fenetreElargie(du, au);
  const exceptions = await exceptionsDeLaFenetre(debut, fin, { coffreOuvert: ouvert });

  let faits = options.faits;
  let branchesIllisibles: string[] = [];
  if (!faits) {
    const fenetre = await faitsEntre(du, au, LECTRICES.odyssee);
    faits = fenetre.faits;
    branchesIllisibles = fenetre.branchesIllisibles;
  }

  return {
    occurrences: occurrencesDeLaFenetre(taches, du, au, {
      exceptions,
      faits,
      coffreOuvert: ouvert,
    }),
    branchesIllisibles,
    taches,
  };
}

/** Les occurrences d'un seul jour. */
export const occurrencesDuJour = (
  jour: string,
  options: { taches?: readonly Tache[]; faits?: readonly FaitObserve[] } = {},
): Promise<FenetreDOccurrences> => occurrencesLues(jour, jour, options);

/**
 * En retard : passée, pas faite, pas abandonnée — et **lisible**.
 *
 * La lisibilité n'est pas un détail de présentation ici. Coffre fermé, on
 * ne sait pas si l'occurrence a été faite ; la dire en retard serait
 * inventer, et inventer dans le sens du reproche.
 */
export const enRetard = (o: OccurrenceAffichee, aujourdhui: string): boolean =>
  o.lisible && !o.faite && !o.abandonnee && o.jour < aujourdhui;

/** Le compte d'une journée : prévu, fait, et ce qu'on ne peut pas lire. */
export interface CompteDuJour {
  prevues: number;
  faites: number;
  renoncees: number;
  illisibles: number;
}

export function compterLesOccurrences(
  occurrences: readonly OccurrenceAffichee[],
): CompteDuJour {
  return {
    prevues: occurrences.length,
    faites: occurrences.filter((o) => o.lisible && o.faite).length,
    renoncees: occurrences.filter((o) => o.lisible && o.abandonnee).length,
    /*
       Comptées à part, et non rangées parmi les « pas faites ». Une
       occurrence scellée n'est pas un échec : c'est une ignorance, et la
       ranger du côté des manques transformerait un coffre fermé en reproche.
    */
    illisibles: occurrences.filter((o) => !o.lisible).length,
  };
}
