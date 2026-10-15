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

export interface FaitsDeLaFenetre {
  faits: FaitObserve[];
  /** Les branches dont la projection a échoué — typiquement, scellées et coffre fermé. */
  branchesIllisibles: string[];
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

/** Les faits entre deux jours logiques, inclus. Ne lève jamais. */
export async function faitsEntre(de: string, a: string): Promise<FaitsDeLaFenetre> {
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
  return { faits, branchesIllisibles };
}

/** Raccourci pour un seul jour. */
export const faitsDuJour = (jour: string): Promise<FaitsDeLaFenetre> => faitsEntre(jour, jour);
