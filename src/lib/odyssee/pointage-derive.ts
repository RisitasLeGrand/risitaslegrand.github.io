/**
 * Le sens branche → tâche, **calculé** et non écrit — prompt 39, C2.
 *
 * ## Pourquoi un calcul, et pas six écrans câblés
 *
 * Quand une branche produit un fait compté, la tâche qui visait ce fait est
 * faite. La façon évidente d'y arriver serait d'appeler, depuis chaque écran
 * de branche, une fonction qui écrit l'exception correspondante. Six écrans,
 * six moments d'écriture, six occasions d'oublier — et c'est exactement la
 * forme de l'anomalie A-9, où trois moteurs attendaient un appelant qui n'est
 * jamais venu.
 *
 * On fait donc l'inverse : **rien ne s'écrit, tout se relit**. Les
 * occurrences d'une série sont déjà calculées depuis la règle plutôt que
 * stockées ; le pointage venu d'une branche suit la même voie. Une occurrence
 * liée est réputée faite quand un fait compté de son action existe pour son
 * jour logique.
 *
 * Trois conséquences qu'on obtient d'un coup :
 *
 * - **aucun écran de branche n'a à savoir que les tâches existent.** La
 *   dépendance ne va que dans un sens, et le sens inverse ne peut donc pas
 *   être oublié ;
 * - **« jamais deux fois » est tenu par construction**, et non par vigilance :
 *   on ne peut pas écrire deux fois ce qu'on n'écrit pas du tout ;
 * - **rien à migrer, rien à rattraper.** Une séance d'il y a trois semaines
 *   coche sa tâche dès le premier affichage, sans qu'on ait eu à repasser sur
 *   le passé.
 *
 * ## L'exception fait autorité, le calcul n'est que le défaut
 *
 * C'est la règle qui tient tout le reste, et c'est celle que série et
 * exception ont déjà partout ici. Une occurrence porte-t-elle une exception ?
 * Elle décide, et le calcul se tait. Sinon, le calcul répond.
 *
 * Sans cela, « Pas finalement » serait un bouton sans effet : il effacerait
 * l'exception, et l'affichage suivant relirait le fait de branche pour
 * recocher aussitôt. D'où l'état `depointee`, qui permet de dire non à une
 * déduction **sans toucher à ce que la branche a enregistré** — on ne
 * supprime pas une séance de sport pour corriger une case.
 *
 * ## Ce qu'on ne peut pas savoir, on ne le devine pas
 *
 * Si l'action vise une branche scellée et que le coffre est fermé, ses faits
 * sont illisibles. L'occurrence ne rend alors ni « faite » ni « à faire »,
 * mais `lisible: false` — et l'écran affiche la mention d'état chiffré. Dire
 * « à faire » serait une affirmation, et elle serait fausse une fois sur
 * deux.
 */

import { actionLiable, laTacheCedeSonFait } from './liaison-branches';
import type { EtatDOccurrence, Tache } from './modele';

/** Le strict nécessaire d'un fait, pour que ce module reste pur. */
export interface FaitObserve {
  type: string;
  jourLogique: string;
}

export type OrigineDuPointage =
  /** Une exception écrite le dit — elle l'emporte toujours. */
  | 'exception'
  /** Un fait compté de la branche visée existe ce jour-là. */
  | 'branche'
  /** Ni l'un ni l'autre. */
  | 'aucune';

export interface EtatDePointage {
  faite: boolean;
  origine: OrigineDuPointage;
  /**
   * Peut-on seulement répondre ? `false` quand la branche est scellée et le
   * coffre fermé. Ce n'est pas « non », c'est « on ne sait pas ».
   */
  lisible: boolean;
}

const INCONNU: EtatDePointage = { faite: false, origine: 'aucune', lisible: false };
const PAS_FAITE: EtatDePointage = { faite: false, origine: 'aucune', lisible: true };

export interface ContexteDePointage {
  /** L'exception de ce couple (tâche, jour), s'il y en a une. */
  exception?: { etat: EtatDOccurrence } | null;
  /** Les faits du jour, toutes branches lisibles confondues. */
  faits: readonly FaitObserve[];
  coffreOuvert: boolean;
}

/**
 * Cette occurrence est-elle faite, et d'où le sait-on ?
 *
 * L'ordre des questions **est** la règle ; le relire de haut en bas, c'est
 * relire la politique.
 */
export function pointageDeLOccurrence(
  tache: Tache,
  jour: string,
  contexte: ContexteDePointage,
): EtatDePointage {
  /* 1. L'exception d'abord, toujours. */
  const etat = contexte.exception?.etat;
  if (etat === 'pointee') return { faite: true, origine: 'exception', lisible: true };
  if (etat === 'depointee' || etat === 'abandonnee') {
    return { faite: false, origine: 'exception', lisible: true };
  }

  /*
     2. La tâche cède-t-elle son fait ? Même prédicat que le prompt 38 : une
        tâche ne cède le sien que si la branche en produit un qui compte. Le
        réécrire ici ferait deux politiques pour une règle.
  */
  if (!laTacheCedeSonFait(tache)) return PAS_FAITE;

  const action = actionLiable(tache.lien!.action)!;

  /* 3. Scellée et coffre fermé : on ne peut pas savoir, et on le dit. */
  if (action.sousCoffre && !contexte.coffreOuvert) return INCONNU;

  /* 4. Le fait existe-t-il ce jour-là ? */
  const trouve = contexte.faits.some((f) => f.type === action.id && f.jourLogique === jour);
  return trouve ? { faite: true, origine: 'branche', lisible: true } : PAS_FAITE;
}

/**
 * Peut-on défaire ce pointage depuis l'écran des tâches ?
 *
 * Oui dans tous les cas où l'on sait répondre — mais le geste n'est pas le
 * même : effacer une exception qu'on a soi-même écrite, ou en écrire une qui
 * contredit la branche. L'écran a besoin de la différence pour nommer son
 * bouton honnêtement.
 */
export type GesteDeRetrait = 'effacer-l-exception' | 'ecrire-un-depointage' | 'rien-a-defaire';

export const gesteDeRetrait = (etat: EtatDePointage): GesteDeRetrait => {
  if (!etat.faite) return 'rien-a-defaire';
  return etat.origine === 'exception' ? 'effacer-l-exception' : 'ecrire-un-depointage';
};
