/**
 * Le moment de la revue, et les libellés qui en découlent.
 *
 * ## Pourquoi un module, pour deux valeurs
 *
 * Parce que le moment ne change pas que l'apparence : il change **ce que la
 * revue porte**. Le soir, elle porte sur la journée en cours ; le matin, sur
 * **la veille**, puis donne un aperçu du jour. Un écran qui dirait « Qu'est-ce
 * qui a compté aujourd'hui ? » le matin en enregistrant la veille serait un
 * mensonge d'interface — et c'est le défaut que l'interdit du prompt 36 vise
 * en exigeant « jamais un "aujourd'hui" faux ».
 *
 * Le jour visé et les libellés sortent donc du même endroit, pour qu'ils ne
 * puissent pas diverger.
 *
 * ## Les valeurs par défaut vivent ici, jamais dans le profil
 *
 * Sans préférence déclarée, c'est le soir — le fonctionnement d'avant, sans
 * changement, ce que le prompt demande. Et le repli n'est **pas** écrit dans
 * le champ : écrire « soir » dans le profil reviendrait à faire dire à la
 * personne une préférence qu'elle n'a jamais exprimée. Toute la branche
 * distingue le déclaré du déduit ; un repli est une règle de produit.
 */
import { jourLogique, type ReglagesJourLogique } from '../noyau/jour-logique';

export type Moment = 'matin' | 'soir';

/** Sans préférence déclarée : le soir, c'est-à-dire l'existant. */
export const MOMENT_PAR_DEFAUT: Moment = 'soir';

/** Ne reconnaît que les deux valeurs attendues ; tout le reste est un défaut. */
export function lireMoment(brut: unknown): Moment {
  return brut === 'matin' ? 'matin' : MOMENT_PAR_DEFAUT;
}

/**
 * Le jour sur lequel porte la revue.
 *
 * Le matin, c'est **la veille** : la revue du matin de J+1 EST la revue de J,
 * et un seul passage suffit (V3). Le soir, c'est le jour en cours.
 */
export function jourVise(moment: Moment, maintenant = new Date(), reglages?: ReglagesJourLogique): string {
  const aujourdhui = jourLogique(maintenant, reglages);
  if (moment === 'soir') return aujourdhui;
  const veille = new Date(`${aujourdhui}T12:00:00.000Z`);
  veille.setUTCDate(veille.getUTCDate() - 1);
  return veille.toISOString().slice(0, 10);
}

/**
 * Les mots qui suivent le moment.
 *
 * Rassemblés plutôt que semés dans l'écran : c'est le seul moyen qu'« hier »
 * et « aujourd'hui » ne se contredisent pas d'un paragraphe à l'autre, et
 * aucun test de type ne rattraperait cette erreur-là.
 */
export interface Libelles {
  /** « aujourd'hui » ou « hier », tel qu'on l'écrit dans une phrase. */
  quand: string;
  /** « Ce qui était prévu aujourd'hui » / « … hier ». */
  titrePlan: string;
  /** « Qu'est-ce qui a compté aujourd'hui ? » / « … hier ? » */
  questionCompte: string;
  /** Le rappel affiché quand la revue du jour visé est déjà tenue. */
  dejaTenue: string;
}

export function libelles(moment: Moment): Libelles {
  const quand = moment === 'matin' ? 'hier' : 'aujourd’hui';
  return {
    quand,
    titrePlan: `Ce qui était prévu ${quand}`,
    questionCompte: `Qu’est-ce qui a compté ${quand} ?`,
    dejaTenue:
      moment === 'matin'
        ? 'La revue d’hier est déjà tenue. Vous pouvez la compléter.'
        : 'La revue d’aujourd’hui est déjà tenue. Vous pouvez la compléter.',
  };
}
