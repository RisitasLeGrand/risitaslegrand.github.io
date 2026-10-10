/**
 * La rotation hebdomadaire des thèmes, et les jours de repos.
 *
 * Ce module existe séparément de `planification.ts` pour une raison précise :
 * la gamification a besoin de savoir quels jours sont des jours de repos — une
 * série de révisions ne doit pas se rompre parce qu'on a respecté son propre
 * planning — et `planification.ts` importe déjà la gamification. Tout mettre au
 * même endroit ferait un cycle d'imports.
 *
 * ## Il lit le registre, il ne déclare plus rien
 *
 * Les sept thèmes de l'INSP étaient ici, en constante. Ils sont désormais
 * déclarés par le registre des parcours (`parcours/registre.ts`), et ce module
 * en est le lecteur : les thèmes, la rotation par défaut et le fait qu'un
 * parcours soit planifiable du tout dépendent du parcours ouvert.
 *
 * ## La rotation est stockée par parcours
 *
 * Une rotation est un choix propre à un parcours : les sept matières de l'INSP
 * n'ont rien à voir avec les rubriques de la DGFiP. Les réglages portent donc un
 * dictionnaire `rotations`, et la forme antérieure — une seule rotation — est
 * lue comme étant celle de l'INSP. La migration se fait à la lecture, sans
 * changement de version de la base : le magasin `etat` est un magasin clé-valeur,
 * et seule la forme de la valeur change.
 */
import {
  ecrireReglagesPlanification,
  jourISO,
  lireReglagesPlanification,
  toutesLesSeances,
  type ReglagesPlanification,
} from './db';
import { ID_PARCOURS_PAR_DEFAUT, planifiable, type Parcours } from './parcours/registre';
import { parcoursCourant } from './parcours/courant';

export type { ThemePlanification } from './parcours/registre';
import type { ThemePlanification } from './parcours/registre';

/**
 * Le repos, traité comme un thème.
 *
 * Un jour sans révision n'est pas un trou dans le planning : c'est une décision,
 * et elle se pose exactement là où se posent les autres — dans la rotation
 * hebdomadaire pour un jour de repos régulier, sur une case du calendrier pour
 * une date précise. En faire un thème évite d'inventer un second mécanisme
 * d'assignation à côté du premier, et de tenir deux vérités sur le même jour.
 *
 * Il ne rattache aucune matière : aucune fiche, aucune carte, aucun rappel. Et
 * il ne dépend d'aucun parcours : se reposer veut dire la même chose partout.
 */
export const REPOS: ThemePlanification = {
  id: 'repos',
  nom: 'Repos',
  court: 'Repos',
  icone: '🌙',
  matieres: [],
};

/**
 * Le thème « aucun ».
 *
 * Un parcours dont le référentiel n'est pas établi n'a pas de thèmes, et sa
 * rotation est donc faite de cette valeur. Ce n'est **pas** le repos : se
 * reposer est une décision, ne pas avoir de programme est un état d'attente. Les
 * confondre ferait compter des jours de repos qui n'en sont pas, et donc
 * protéger une série qui ne l'est pas.
 */
export const SANS_THEME = '';

/** Les thèmes du parcours : ceux que le registre déclare, et rien de plus. */
export const themes = (p: Parcours = parcoursCourant()): ThemePlanification[] => p.themes;

/** Les thèmes assignables à un jour — ceux du parcours, et le repos. */
export const themesAssignables = (p: Parcours = parcoursCourant()): ThemePlanification[] => [
  ...p.themes,
  REPOS,
];

export const theme = (
  id: string,
  p: Parcours = parcoursCourant(),
): ThemePlanification | undefined => themesAssignables(p).find((t) => t.id === id);

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
 * La rotation proposée par le registre, sur sept jours exactement.
 *
 * Un parcours sans thèmes rend sept fois `SANS_THEME`. La longueur est garantie
 * ici pour que les appelants puissent indexer par jour de semaine sans vérifier
 * — c'était déjà l'hypothèse du code existant, elle devient une propriété.
 */
export function rotationParDefaut(p: Parcours = parcoursCourant()): string[] {
  if (!planifiable(p)) return Array(7).fill(SANS_THEME);
  return Array.from({ length: 7 }, (_, i) => p.rotationParDefaut[i] ?? SANS_THEME);
}

export function jourDeLaSemaine(jour: string): number {
  return new Date(`${jour}T12:00:00`).getDay();
}

/**
 * Les rotations stockées, par parcours, la forme antérieure migrée.
 *
 * La migration est volontairement faite à la lecture et non une fois pour
 * toutes : une sauvegarde restaurée peut porter l'ancienne forme longtemps après
 * la mise à jour, et un code de migration qui ne tourne qu'au démarrage l'aurait
 * manquée.
 *
 * Exportée pour l'essai : la migration est la seule chose ici qui puisse perdre
 * une rotation que la personne a réglée à la main, et un invariant qu'on ne
 * peut pas interroger n'est pas un invariant.
 */
export function rotationsStockees(
  stockes: ReglagesPlanification | null,
): Record<string, string[]> {
  if (!stockes) return {};
  if (stockes.rotations) return stockes.rotations;
  // Forme antérieure : une rotation unique, qui était celle de l'INSP.
  if (stockes.rotation?.length) return { [ID_PARCOURS_PAR_DEFAUT]: stockes.rotation };
  return {};
}

export interface ReglagesRotation {
  /** Sept thèmes, index 0 = dimanche. */
  rotation: string[];
  trimestreEcarte: string | null;
}

export async function lireReglages(
  p: Parcours = parcoursCourant(),
): Promise<ReglagesRotation> {
  const stockes = await lireReglagesPlanification();
  const defaut = rotationParDefaut(p);
  const stockee = rotationsStockees(stockes)[p.id];
  // Un thème supprimé du registre, ou un tableau tronqué, ne doit pas casser la
  // rotation : chaque case retombe sur le défaut du parcours.
  const rotation = defaut.map((parDefaut, i) =>
    theme(stockee?.[i] ?? '', p) ? (stockee as string[])[i] : parDefaut,
  );
  return { rotation, trimestreEcarte: stockes?.trimestreEcarte ?? null };
}

export async function ecrireRotation(rotation: string[], p: Parcours = parcoursCourant()) {
  const stockes = await lireReglagesPlanification();
  await ecrireReglagesPlanification({
    rotations: { ...rotationsStockees(stockes), [p.id]: rotation },
    trimestreEcarte: stockes?.trimestreEcarte ?? null,
  });
}

/**
 * Le thème prévu pour un jour : celui d'une séance déjà posée, sinon la rotation.
 *
 * Une séance enregistrée fait foi — c'est elle que porte une réassignation, y
 * compris une mise au repos. Mais seulement si son thème appartient au parcours
 * ouvert : les séances ne sont pas cloisonnées par parcours, et afficher
 * « Droit public » pendant une préparation DGFiP serait pire qu'un trou.
 */
export async function themeDuJour(
  jour = jourISO(),
  p: Parcours = parcoursCourant(),
): Promise<string> {
  const [reglages, seances] = await Promise.all([lireReglages(p), toutesLesSeances()]);
  const existante = seances.find((s) => s.jour === jour);
  if (existante && theme(existante.theme, p)) return existante.theme;
  return reglages.rotation[jourDeLaSemaine(jour)];
}

/** Le jour est-il un jour de repos — par la rotation ou par réassignation ? */
export async function jourDeRepos(jour = jourISO()): Promise<boolean> {
  return estRepos(await themeDuJour(jour));
}
