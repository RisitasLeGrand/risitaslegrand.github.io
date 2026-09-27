/**
 * Composition d'une session : quelques items tirés dans les couples de la phase
 * courante, difficulté croissante.
 *
 * Le point délicat est le **refus**. Un moteur rend `null` quand le tirage ne
 * porte pas une réponse unique, et certains couples refusent presque toujours —
 * Réseau relationnel sur « groups », dont les camps sont interchangeables. Une
 * boucle naïve tournerait sans fin. La composition écarte donc un couple après
 * quelques refus consécutifs, et s'arrête proprement si plus aucun ne répond,
 * plutôt que de figer la page.
 */
import { alea, graineDuMoment } from './noyaux/aleatoire';
import type { Item } from './moteurs/types';
import { couplesDeLaPhase } from './progression';

/** Tentatives par couple avant de le mettre de côté pour cette session. */
const REFUS_TOLERES = 12;

export interface Session {
  phase: number;
  graine: number;
  items: Item[];
}

/**
 * Difficulté d'un item : elle monte avec la phase et, à l'intérieur d'une
 * session, avec le rang de l'item. La montée en cours de session est douce —
 * un cran tous les quatre items — pour que la session commence par des cas
 * lisibles sans finir sur un plateau.
 */
export function difficulte(phase: number, rang: number): number {
  return Math.min(10, 1 + (phase - 1) * 2 + Math.floor(rang / 4));
}

export function composerSession(phase: number, nombre: number, graine = graineDuMoment()): Session {
  const hasard = alea(graine);
  const disponibles = couplesDeLaPhase(phase).map((couple) => ({ ...couple, refus: 0 }));
  const items: Item[] = [];

  let rang = 0;
  let tentatives = 0;
  const plafond = nombre * REFUS_TOLERES + 50;

  while (items.length < nombre && tentatives < plafond) {
    tentatives += 1;
    const vivants = disponibles.filter((couple) => couple.refus < REFUS_TOLERES);
    if (!vivants.length) break;

    // On préfère le couple le moins servi, pour que la session balaie les
    // moteurs au lieu d'insister sur un seul.
    const compte = (id: string) => items.filter((item) => item.moteur === id).length;
    const minimum = Math.min(...vivants.map((couple) => compte(couple.moteur.id)));
    const candidats = vivants.filter((couple) => compte(couple.moteur.id) === minimum);
    const couple = hasard.un(candidats);

    const item = couple.moteur.engendrer(couple.systeme, difficulte(phase, rang), hasard);
    if (!item) {
      couple.refus += 1;
      continue;
    }
    couple.refus = 0;
    items.push(item);
    rang += 1;
  }

  return { phase, graine, items };
}
