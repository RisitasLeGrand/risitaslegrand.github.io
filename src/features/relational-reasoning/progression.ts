/**
 * Les quatre phases de difficulté, et l'ouverture des suivantes.
 *
 * Chaque phase déclare les systèmes et les moteurs qu'elle rend disponibles,
 * **y compris ceux qui ne sont pas encore écrits** : les listes décrivent le
 * découpage du cahier des charges, et l'intersection avec les catalogues réels
 * fait le reste. Un moteur ajouté plus tard apparaît donc dans sa phase sans
 * qu'on touche à ce fichier.
 *
 * La phase atteinte n'est pas stockée mais **recalculée** à partir des items
 * réussis. Une valeur mémorisée se désynchroniserait d'un import de sauvegarde ;
 * un décompte se refait.
 */
import { accepte, MOTEURS, type Moteur } from './moteurs/index';
import { SYSTEMES, type Systeme } from './systemes/index';

export interface Phase {
  numero: number;
  nom: string;
  resume: string;
  systemes: string[];
  moteurs: string[];
  /** Items réussis cumulés nécessaires pour l'ouvrir. */
  seuil: number;
}

export const PHASES: Phase[] = [
  {
    numero: 1,
    nom: 'Structures simples',
    resume: 'Une ligne, un plan, deux camps. Inférer une règle qu’aucun énoncé ne nomme.',
    systemes: ['line', 'plane', 'groups'],
    moteurs: [
      'inferer-relation',
      'reseau-relationnel',
      'correspondance-transformation',
      'cartes-axes',
      'mouvements-mutuels',
      'algebre-cachee',
      'correspondance-structure',
      'completion-analogie',
    ],
    seuil: 0,
  },
  {
    numero: 2,
    nom: 'Mondes clos et indétermination',
    resume:
      'Réseaux dirigés et ordres partiels. Ce qui n’est pas dit est parfois une négation, parfois une inconnue.',
    systemes: ['line', 'plane', 'groups', 'digraph', 'poset', 'poset-ouvert'],
    moteurs: [
      'motif-recherche',
      'projection',
      'analogie-partielle',
      'analogie-intruse',
      'isomorphisme-partiel',
      'ensembles-possibles',
      'premisse-manquante',
    ],
    seuil: 30,
  },
  {
    numero: 3,
    nom: 'Espace et cycles',
    resume: 'Trois dimensions, dominance non transitive, cadres de référence propres à chacun.',
    systemes: ['line', 'plane', 'groups', 'digraph', 'poset', 'poset-ouvert', 'space', 'cyclic'],
    moteurs: [
      'contradiction',
      'premisses-minimales',
      'entre-deux',
      'pivots',
      'dominance-cyclique',
      'base-oblique',
      'cadres',
    ],
    seuil: 70,
  },
  {
    numero: 4,
    nom: 'Algèbres topologiques et temporelles',
    resume: 'Régions et intervalles, leurs tables de composition, et les analogies de second ordre.',
    systemes: [
      'line',
      'plane',
      'groups',
      'digraph',
      'poset',
      'poset-ouvert',
      'space',
      'cyclic',
      'rcc8',
      'allen',
    ],
    moteurs: [
      'analogie-transsysteme',
      'analogie-second-ordre',
      'conflit-correspondance',
      'sous-systeme-commun',
      'deplacements-de-contexte',
    ],
    seuil: 130,
  },
];

/** La phase la plus avancée ouverte par un nombre d'items réussis. */
export function phaseAtteinte(itemsReussis: number): number {
  return PHASES.reduce((haute, phase) => (itemsReussis >= phase.seuil ? phase.numero : haute), 1);
}

/** Ce qu'il reste à réussir pour ouvrir la phase suivante, ou `null` à la dernière. */
export function prochainPalier(itemsReussis: number): { phase: Phase; reste: number } | null {
  const suivante = PHASES.find((phase) => itemsReussis < phase.seuil);
  return suivante ? { phase: suivante, reste: suivante.seuil - itemsReussis } : null;
}

/**
 * Les couples praticables d'une phase : l'intersection de ce qu'elle déclare,
 * de ce qui est écrit, et de ce que le moteur accepte du système.
 *
 * Une phase **cumule** les phases précédentes : ses moteurs tournent aussi sur
 * les systèmes déjà ouverts, et les moteurs déjà acquis sur ses systèmes neufs.
 * C'est ce cumul qui donne la variété, un moteur nouveau sur un système connu
 * étant un exercice nouveau.
 */
export function couplesDeLaPhase(numero: number): { moteur: Moteur; systeme: Systeme }[] {
  const jusquIci = PHASES.filter((phase) => phase.numero <= numero);
  const idsMoteurs = new Set(jusquIci.flatMap((phase) => phase.moteurs));
  const idsSystemes = new Set(jusquIci.flatMap((phase) => phase.systemes));

  const resultat: { moteur: Moteur; systeme: Systeme }[] = [];
  for (const moteur of MOTEURS) {
    if (!idsMoteurs.has(moteur.id)) continue;
    for (const systeme of SYSTEMES) {
      if (!idsSystemes.has(systeme.id)) continue;
      if (accepte(moteur, systeme)) resultat.push({ moteur, systeme });
    }
  }
  return resultat;
}

/** Les phases dont au moins un couple est praticable aujourd'hui. */
export function phasesJouables(): Phase[] {
  return PHASES.filter((phase) => couplesDeLaPhase(phase.numero).length > 0);
}
