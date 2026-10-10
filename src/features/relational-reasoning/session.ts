/**
 * Composition d'une session : quelques items tirés dans les moteurs ouverts,
 * chacun **à son propre échelon**.
 *
 * Il n'y a pas de difficulté de session : deux items de la même session peuvent
 * être de niveaux très différents si la personne est plus avancée sur un moteur
 * que sur un autre. C'est le principe de l'échelle par moteur, et c'est aussi ce
 * qui rend la session lisible — on progresse là où l'on est prêt.
 *
 * Le point délicat reste le **refus**. Un moteur rend `null` quand le tirage ne
 * porte pas de réponse unique, et certains couples refusent presque toujours —
 * Réseau relationnel sur « groups », dont les camps sont interchangeables. Une
 * boucle naïve tournerait sans fin. La composition écarte donc un couple après
 * quelques refus consécutifs, et s'arrête proprement si plus aucun ne répond.
 */
import { alea, graineDuMoment } from './noyaux/aleatoire';
import { SYSTEMES } from './systemes/index';
import type { Item } from './moteurs/types';
import { couplesPourEntrainement, type Trace } from './progression';

/** Tentatives par couple avant de le mettre de côté pour cette session. */
const REFUS_TOLERES = 12;

export interface Session {
  graine: number;
  items: Item[];
}

export interface OptionsSession {
  /**
   * Les moteurs retenus. Vide ou absent, tous les moteurs accessibles jouent.
   *
   * Une sélection qui ne laisserait aucun couple praticable rend une session
   * **vide** plutôt que de se rabattre sur tous les moteurs : se rabattre
   * tromperait la personne, qui croirait travailler ce qu'elle a coché.
   * L'interface interdit d'en arriver là, et la composition ne la contourne pas.
   */
  moteurs?: readonly string[];
  /** Entrelacé, ou regroupé moteur par moteur. */
  ordre?: 'entrelace' | 'par-unite';
  /** Ouvre tous les moteurs à l'échelon de départ, sans toucher aux déblocages. */
  modeLibre?: boolean;
}

export function composerSession(
  traces: readonly Trace[],
  nombre: number,
  graine = graineDuMoment(),
  options: OptionsSession = {},
): Session {
  const hasard = alea(graine);
  const retenus = options.moteurs && options.moteurs.length > 0 ? new Set(options.moteurs) : null;
  const disponibles = couplesPourEntrainement(traces, { modeLibre: options.modeLibre })
    .filter((couple) => !retenus || retenus.has(couple.moteur.id))
    .map((couple) => ({ ...couple, refus: 0 }));
  const items: Item[] = [];

  let tentatives = 0;
  const plafond = nombre * REFUS_TOLERES + 50;

  while (items.length < nombre && tentatives < plafond) {
    tentatives += 1;
    const vivants = disponibles.filter((couple) => couple.refus < REFUS_TOLERES);
    if (!vivants.length) break;

    // On préfère le moteur le moins servi, pour que la session balaie les
    // moteurs ouverts au lieu d'insister sur un seul.
    const compte = (id: string) => items.filter((item) => item.moteur === id).length;
    const minimum = Math.min(...vivants.map((couple) => compte(couple.moteur.id)));
    const candidats = vivants.filter((couple) => compte(couple.moteur.id) === minimum);
    const couple = hasard.un(candidats);

    // Le catalogue passe en quatrième paramètre : un moteur inter-systèmes a
    // besoin d'un monde où transférer, et il ne doit pas l'importer lui-même.
    const item = couple.moteur.engendrer(couple.systeme, couple.echelon, hasard, SYSTEMES);
    if (!item) {
      couple.refus += 1;
      continue;
    }
    couple.refus = 0;
    items.push(item);
  }

  // L'ordre « par moteur » regroupe après coup plutôt que de tirer moteur par
  // moteur : la boucle de tirage préfère déjà le moteur le moins servi, ce qui
  // équilibre la session. Tirer dans l'ordre déséquilibrerait le dernier moteur,
  // qui n'aurait que les items restants.
  if (options.ordre === 'par-unite') {
    const rang = new Map<string, number>();
    for (const item of items) if (!rang.has(item.moteur)) rang.set(item.moteur, rang.size);
    items.sort((a, b) => (rang.get(a.moteur) ?? 0) - (rang.get(b.moteur) ?? 0));
  }

  return { graine, items };
}
