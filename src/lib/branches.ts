/**
 * Les branches de Cyclades.
 *
 * Cyclades est l'application ; une branche en est un domaine d'usage, avec ses
 * écrans, ses données et ses règles. Trois sont prévues :
 *
 * - **Révisions** — la préparation aux concours, ce qui s'appelait RevINSP ;
 * - **Odyssée** — le pilotage de la vie, qui deviendra la page d'accueil ;
 * - **Sport** — la musculation et le cardio.
 *
 * ## Pourquoi déclarer des branches qui n'existent pas encore
 *
 * Parce que le socle partagé a besoin de les nommer avant qu'elles aient des
 * écrans : un fait porte la branche qui l'émet, et la matrice de lecture
 * inter-branches se déclare entre identifiants. Les déclarer maintenant évite
 * que ces identifiants soient inventés deux fois, à deux endroits, avec deux
 * orthographes.
 *
 * ## Mais on n'affiche que ce qui existe
 *
 * `disponible` est faux pour Odyssée et Sport, et la navigation ne montre que
 * les branches disponibles. Un onglet qui mène à une page vide ne renseigne
 * personne : il promet. Le jour où la branche s'ouvre, le drapeau passe à vrai
 * et la barre devient un vrai sélecteur, sans autre changement.
 */
export interface Branche {
  id: string;
  /** Le nom affiché : « Révisions », jamais « Cyclades · Révisions ». */
  libelle: string;
  icone: string;
  /** Une phrase, pour l'écran de choix et les info-bulles. */
  description: string;
  /** Racine de ses pages. `'/'` pour celle qui occupe la racine du site. */
  racine: string;
  /** La branche a-t-elle des écrans aujourd'hui ? */
  disponible: boolean;
}

export const BRANCHES: Branche[] = [
  {
    id: 'revisions',
    libelle: 'Révisions',
    icone: '🎓',
    description: 'Préparation aux concours : cours, flashcards, quiz, planification.',
    racine: '/',
    disponible: true,
  },
  {
    id: 'odyssee',
    libelle: 'Odyssée',
    icone: '🧭',
    description: 'Pilotage de la vie : domaines, calendrier, tâches, quêtes, tendances.',
    racine: '/odyssee/',
    disponible: false,
  },
  {
    id: 'sport',
    libelle: 'Sport',
    icone: '🏋️',
    description: 'Musculation et cardio : exercices, séances, suivi de la force.',
    racine: '/sport/',
    disponible: false,
  },
];

export const ID_BRANCHE_PAR_DEFAUT = 'revisions';

export const branche = (id: string): Branche | undefined => BRANCHES.find((b) => b.id === id);

export const branchesDisponibles = (): Branche[] => BRANCHES.filter((b) => b.disponible);

/** Le nom complet d'un écran : « Cyclades · Révisions ». */
export function nomComplet(nomProduit: string, id = ID_BRANCHE_PAR_DEFAUT): string {
  const b = branche(id);
  return b ? `${nomProduit} · ${b.libelle}` : nomProduit;
}
