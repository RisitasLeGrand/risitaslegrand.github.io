/**
 * Le sens branche → tâche : faire le geste dans la branche coche la tâche —
 * phase 6 du prompt 38.
 *
 * ## Pourquoi ce sens-ci est le dangereux
 *
 * En phase 5, pointer depuis le calendrier créait le fait : il n'y en avait
 * qu'un, et l'occurrence ne comptait pas. Ici, **le fait existe déjà** quand
 * on arrive — la séance a été close, la quête tenue — et la tâche qu'on
 * s'apprête à cocher en produirait un second. D'où la règle de
 * `liaison-branches.ts` : une tâche liée à une action comptée **cède son
 * fait** à sa branche. Elle n'en produit plus, elle en porte la marque.
 *
 * ## Ce que le retour coche, et ce qu'il laisse
 *
 * Trois refus, chacun pour une raison différente, et aucun n'est un cas
 * limite théorique :
 *
 * - **un jour que la règle ne prévoit pas.** Faire du sport un dimanche
 *   quand la série dit « lundi, mercredi, vendredi » ne coche rien : une
 *   exception sur un jour sans occurrence désignerait une occurrence qui
 *   n'existe pas. Le fait de branche, lui, est bien écrit — il n'est
 *   simplement rattaché à aucune tâche ;
 * - **une exception déjà posée.** Si la personne a abandonné l'occurrence du
 *   jour, le retour ne l'écrase pas. Revenir sur un abandon est un geste, et
 *   un geste ne s'annule pas tout seul parce qu'une séance a été écrite
 *   ailleurs. L'écran peut le proposer ; ce module ne le décide pas ;
 * - **une tâche simple déjà faite.** Rien à cocher deux fois.
 *
 * ## Le jour est celui du fait, jamais « aujourd'hui »
 *
 * Une séance close à 2 h du matin appartient au jour logique de la veille.
 * Le retour prend donc le jour que l'appelant lui donne — celui du fait — et
 * ne lit jamais l'horloge pour le deviner.
 */
import { cocheLaTache } from './liaison-branches';
import type { Tache } from './modele';
import { suitLaRegle } from './repetition';

export type GesteDeRetour =
  /** La tâche simple se clôt, sans produire son propre fait (elle l'a cédé). */
  | { quoi: 'clore' }
  /** L'occurrence du jour reçoit une exception « pointée ». */
  | { quoi: 'occurrence'; jourPrevu: string }
  /** Rien, et `pourquoi` est affichable tel quel. */
  | { quoi: 'rien'; pourquoi: string };

export interface EtatConnu {
  /** Une exception existe-t-elle déjà pour ce couple (tâche, jour) ? */
  dejaExcepte?: boolean;
}

/**
 * Ce que le geste de branche fait à cette tâche — **pure**, et c'est délibéré.
 *
 * Le module qui écrit n'a plus qu'à exécuter : toute la politique est
 * éprouvable sans base de données, ce qui est la seule façon d'en couvrir
 * les refus, qui sont la moitié de l'intérêt.
 */
export function decisionDeRetour(
  tache: Tache,
  action: string,
  jour: string,
  etat: EtatConnu = {},
): GesteDeRetour {
  if (!tache.lien || tache.lien.action !== action) {
    return { quoi: 'rien', pourquoi: 'La tâche ne vise pas cette action.' };
  }
  if (!cocheLaTache(action)) {
    return { quoi: 'rien', pourquoi: `L’action « ${action} » ne coche aucune tâche.` };
  }
  if (tache.abandonneeLe) {
    return { quoi: 'rien', pourquoi: 'La tâche est abandonnée.' };
  }

  if (tache.serie) {
    if (!suitLaRegle(tache.serie, jour)) {
      return { quoi: 'rien', pourquoi: 'La règle ne prévoit pas d’occurrence ce jour-là.' };
    }
    if (etat.dejaExcepte) {
      return { quoi: 'rien', pourquoi: 'Cette occurrence porte déjà une exception.' };
    }
    return { quoi: 'occurrence', jourPrevu: jour };
  }

  if (tache.faiteLe) {
    return { quoi: 'rien', pourquoi: 'La tâche est déjà faite.' };
  }
  return { quoi: 'clore' };
}

/**
 * Les tâches qu'un geste de branche touche, et ce qu'il leur fait.
 *
 * Rend **toutes** les tâches examinées, y compris celles qu'on ne coche pas,
 * avec leur raison : un écran qui dirait « rien n'a été coché » sans pouvoir
 * dire pourquoi laisserait croire à une panne là où il y a une règle.
 */
export const retourDeBranche = (
  taches: readonly Tache[],
  action: string,
  jour: string,
  etatDe: (tache: Tache) => EtatConnu = () => ({}),
): { tache: Tache; geste: GesteDeRetour }[] =>
  taches
    .filter((t) => t.lien?.action === action)
    .map((tache) => ({ tache, geste: decisionDeRetour(tache, action, jour, etatDe(tache)) }));
