/**
 * La rotation hebdomadaire des thèmes, et les jours de repos.
 *
 * Ce module existe séparément de `planification.ts` pour une raison précise :
 * la gamification a besoin de savoir quels jours sont des jours de repos — une
 * série de révisions ne doit pas se rompre parce qu'on a respecté son propre
 * planning — et `planification.ts` importe déjà la gamification. Tout mettre au
 * même endroit ferait un cycle d'imports.
 */
import {
  ecrireReglagesPlanification,
  jourISO,
  lireReglagesPlanification,
  toutesLesSeances,
  type ReglagesPlanification,
} from './db';

export interface ThemePlanification {
  id: string;
  nom: string;
  /** Nom court, pour les cases du calendrier. */
  court: string;
  icone: string;
  /** Matières du contenu rattachées à ce thème. */
  matieres: string[];
}

/*
   Les sept thèmes portent chacun une matière du contenu. La correspondance est
   aujourd'hui de un à un ; les listes restent des tableaux pour absorber un
   regroupement futur sans retoucher une centaine de fichiers.
*/
export const THEMES: ThemePlanification[] = [
  { id: 'droit-public', nom: 'Droit public', court: 'Droit pub.', icone: '⚖️', matieres: ['Droit public'] },
  { id: 'finances-publiques', nom: 'Finances publiques', court: 'Fin. pub.', icone: '💶', matieres: ['Finances publiques'] },
  { id: 'economie', nom: 'Économie', court: 'Économie', icone: '📊', matieres: ['Économie'] },
  { id: 'questions-europeennes', nom: 'Questions européennes', court: 'Q. europ.', icone: '🇪🇺', matieres: ['Questions européennes'] },
  { id: 'questions-internationales', nom: 'Questions internationales', court: 'Q. inter.', icone: '🌍', matieres: ['Questions internationales'] },
  { id: 'questions-sociales', nom: 'Questions sociales', court: 'Q. sociales', icone: '🤝', matieres: ['Questions sociales'] },
  { id: 'cas-pratique', nom: 'Résolution de cas pratique', court: 'Cas prat.', icone: '🗂️', matieres: ['Cas pratique'] },
];

/**
 * Le repos, traité comme un thème.
 *
 * Un jour sans révision n'est pas un trou dans le planning : c'est une décision,
 * et elle se pose exactement là où se posent les autres — dans la rotation
 * hebdomadaire pour un jour de repos régulier, sur une case du calendrier pour
 * une date précise. En faire un thème évite d'inventer un second mécanisme
 * d'assignation à côté du premier, et de tenir deux vérités sur le même jour.
 *
 * Il ne rattache aucune matière : aucune fiche, aucune carte, aucun rappel.
 */
export const REPOS: ThemePlanification = {
  id: 'repos',
  nom: 'Repos',
  court: 'Repos',
  icone: '🌙',
  matieres: [],
};

/** Les thèmes assignables à un jour — les sept matières, et le repos. */
export const THEMES_ASSIGNABLES: ThemePlanification[] = [...THEMES, REPOS];

export const theme = (id: string) => THEMES_ASSIGNABLES.find((t) => t.id === id);

export const estRepos = (themeId: string | null | undefined) => themeId === REPOS.id;

/** Libellés des jours, index 0 = dimanche, comme « Date.getDay() ». */
export const JOURS_SEMAINE = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

/**
 * Rotation par défaut : la semaine de travail commence par le droit public et
 * se termine, le dimanche, par le cas pratique — l'exercice le plus long.
 * Entièrement reconfigurable depuis la page de planification, jours de repos
 * compris.
 */
export const ROTATION_PAR_DEFAUT: string[] = [
  'cas-pratique', // dimanche
  'droit-public', // lundi
  'finances-publiques', // mardi
  'economie', // mercredi
  'questions-europeennes', // jeudi
  'questions-internationales', // vendredi
  'questions-sociales', // samedi
];

export function jourDeLaSemaine(jour: string): number {
  return new Date(`${jour}T12:00:00`).getDay();
}

export async function lireReglages(): Promise<ReglagesPlanification> {
  const stockes = await lireReglagesPlanification();
  if (!stockes) return { rotation: [...ROTATION_PAR_DEFAUT], trimestreEcarte: null };
  // Un thème supprimé ou un tableau tronqué ne doit pas casser la rotation.
  const rotation = ROTATION_PAR_DEFAUT.map((defaut, i) =>
    theme(stockes.rotation?.[i] ?? '') ? stockes.rotation[i] : defaut,
  );
  return { rotation, trimestreEcarte: stockes.trimestreEcarte ?? null };
}

export async function ecrireRotation(rotation: string[]) {
  const actuels = await lireReglages();
  await ecrireReglagesPlanification({ ...actuels, rotation });
}

/**
 * Le thème prévu pour un jour : celui d'une séance déjà posée, sinon la rotation.
 *
 * Une séance enregistrée fait foi — c'est elle que porte une réassignation, y
 * compris une mise au repos.
 */
export async function themeDuJour(jour = jourISO()): Promise<string> {
  const [reglages, seances] = await Promise.all([lireReglages(), toutesLesSeances()]);
  const existante = seances.find((s) => s.jour === jour);
  return existante?.theme ?? reglages.rotation[jourDeLaSemaine(jour)];
}

/** Le jour est-il un jour de repos — par la rotation ou par réassignation ? */
export async function jourDeRepos(jour = jourISO()): Promise<boolean> {
  return estRepos(await themeDuJour(jour));
}
