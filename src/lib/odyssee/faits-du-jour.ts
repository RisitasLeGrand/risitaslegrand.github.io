/**
 * Les faits d'une fenêtre de jours, toutes branches lisibles — prompt 39.
 *
 * Le calcul du sens branche → tâche a besoin d'une question simple : « un
 * fait de ce type existe-t-il ce jour-là ? ». Les faits ne sont pas stockés,
 * ils sont **projetés** par six publieurs, un par branche. Ce module les
 * réunit, et il fait trois choses qu'aucun d'eux ne fait seul.
 *
 * **Il borne la fenêtre.** Les publieurs acceptent `de` et `a` : on ne
 * projette pas cinq ans pour savoir si une séance a eu lieu aujourd'hui.
 * C'est ce qui rend la lecture tenable sur un calendrier qui montre un mois.
 *
 * **Il survit à une branche illisible.** Psyché et Finances vivent sous
 * coffre ; coffre fermé, leur publieur ne peut pas lire. Un écran qui
 * planterait pour cette raison serait pire que l'information manquante, et
 * un `catch` muet serait pire encore — il ferait passer « je n'ai pas pu
 * lire » pour « il n'y a rien ». Les branches qu'on n'a pas pu lire sont
 * donc **rendues, nommées**, et l'appelant décide quoi en dire.
 *
 * **Il ne garde que deux champs.** Le type et le jour logique : de quoi
 * répondre à la question, et rien de plus. Faire circuler des faits entiers
 * dans l'affichage des tâches donnerait à un écran des données d'une
 * branche qu'il n'a pas à connaître.
 */

import type { FaitObserve } from './pointage-derive';
import {
  MATRICE_PAR_DEFAUT,
  domainesNonAutorises,
  filtrerPourLecture,
  type DomaineNonAutorise,
  type Lectrice,
  type Matrice,
} from '../noyau/permissions';

export interface FaitsDeLaFenetre {
  faits: FaitObserve[];
  /** Les branches dont la projection a échoué — typiquement, scellées et coffre fermé. */
  branchesIllisibles: string[];
  /**
   * Les domaines que la lectrice n'a pas le droit de lire, en entier ou en
   * partie — **et ce n'est pas la même chose que `branchesIllisibles`**.
   *
   * `branchesIllisibles` dit « je n'ai pas pu lire » : un coffre fermé, une
   * projection qui lève. `nonAutorises` dit « je n'avais pas le droit », et la
   * réponse ne dépend pas des données : elle est la même pour une fenêtre
   * pleine et pour une fenêtre vide. C'est ce que la maquette 8.3 demande de
   * distinguer, parce que confondre les deux laisse croire qu'un domaine coupé
   * est un domaine vide.
   */
  nonAutorises: DomaineNonAutorise[];
}

type Publieur = { branche: string; charger: () => Promise<{ faits: { type: string; jourLogique: string }[] }> };

/**
 * Les six publieurs, chargés à la demande.
 *
 * Les imports sont dynamiques pour la même raison qu'ailleurs dans Odyssée :
 * les modules de branche chargent le modèle commun, et les importer en tête
 * refermerait un cycle qu'un bundler résout en livrant un module à moitié
 * initialisé — une panne qui ne se voit qu'à l'exécution.
 */
const publieurs = (options: { de: string; a: string }): Publieur[] => [
  {
    branche: 'revisions',
    charger: async () => (await import('./faits-revisions')).publierFaitsRevisions(options),
  },
  { branche: 'sport', charger: async () => (await import('../sport/faits-sport')).publierFaitsSport(options) },
  { branche: 'odyssee', charger: async () => (await import('./faits-odyssee')).publierFaitsOdyssee(options) },
  { branche: 'corps', charger: async () => (await import('./faits-corps')).publierFaitsCorps(options) },
  { branche: 'psyche', charger: async () => (await import('./faits-psyche')).publierFaitsPsyche(options) },
  { branche: 'finances', charger: async () => (await import('./faits-finances')).publierFaitsFinances(options) },
];

/**
 * Les faits entre deux jours logiques, inclus. Ne lève jamais.
 *
 * `lectrice` est **obligatoire** : c'est le lot B.2. La matrice de lecture
 * inter-branches existait et n'était appelée par personne ; ici elle l'est, et
 * le compilateur demande à chaque appelant de se nommer. Un paramètre
 * facultatif aurait gardé le trou par défaut.
 *
 * Le filtre s'applique **après** la projection, et la limite est dite dans
 * `faits-branches.ts` : une lectrice qui n'a pas le droit de voir un domaine
 * en provoque quand même la lecture, dont le résultat est jeté. Rien ne sort,
 * mais le chemin existe.
 */
export async function faitsEntre(
  de: string,
  a: string,
  lectrice: Lectrice,
  matrice: Matrice = MATRICE_PAR_DEFAUT,
): Promise<FaitsDeLaFenetre> {
  const resultats = await Promise.all(
    publieurs({ de, a }).map(async (p) => {
      try {
        const { faits } = await p.charger();
        return { branche: p.branche, faits };
      } catch {
        return { branche: p.branche, faits: null };
      }
    }),
  );

  const faits: FaitObserve[] = [];
  const branchesIllisibles: string[] = [];
  for (const r of resultats) {
    if (!r.faits) {
      branchesIllisibles.push(r.branche);
      continue;
    }
    for (const f of r.faits) faits.push({ type: f.type, jourLogique: f.jourLogique });
  }
  return {
    faits: filtrerPourLecture(lectrice, faits, matrice),
    branchesIllisibles,
    nonAutorises: domainesNonAutorises(lectrice, matrice),
  };
}

/** Raccourci pour un seul jour. */
export const faitsDuJour = (jour: string, lectrice: Lectrice): Promise<FaitsDeLaFenetre> =>
  faitsEntre(jour, jour, lectrice);
