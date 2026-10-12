/**
 * Médicaments et statut hormonal : le domaine Corps, sous coffre.
 *
 * Ces deux-là étaient les seuls objets de la phase 6 retenus par la décision
 * 3. Elle est prise : ils sont **chiffrés au repos**, et ce module les écrit
 * à travers le coffre.
 *
 * ## Enregistrement seul, et c'est la règle entière
 *
 * Le contrat de faits le dit pour `odyssee.medicament` : « Enregistrement
 * seul : nom, dose, heure, voie, motif. **Aucun conseil, aucune dose
 * proposée.** » Ce module n'a donc ni rappel de prise, ni vérification
 * d'interaction, ni suggestion d'horaire. Ce ne sont pas des fonctions
 * manquantes : chacune serait un acte médical rendu par un logiciel qui ne
 * sait rien de la personne, et aucune garantie de prudence dans la
 * formulation ne rattraperait cela.
 *
 * La seule chose que le module calcule est **ce qui a été pris**, à partir de
 * ce qui a été saisi. Jamais ce qu'il faudrait prendre.
 *
 * ## Le statut hormonal est une période, pas un événement
 *
 * Il dure, et Sport le lit pour **contextualiser** — jamais pour ajuster une
 * proposition. Une charge qui monterait « parce que » le statut a changé
 * serait une recommandation déguisée ; le garde-fou de Sport ne connaît qu'une
 * chose, la douleur déclarée.
 */

export type VoieDAdministration = 'orale' | 'cutanee' | 'injection' | 'inhalee' | 'autre';

export const VOIES: Record<VoieDAdministration, string> = {
  orale: 'Par la bouche',
  cutanee: 'Sur la peau',
  injection: 'Injection',
  inhalee: 'Inhalée',
  autre: 'Autre',
};

/**
 * Une prise, telle qu'elle a eu lieu.
 *
 * `prevu` n'existe pas : un médicament non pris n'est pas enregistré, et un
 * champ « prévu » transformerait l'enregistrement en plan de traitement —
 * c'est-à-dire en la chose que le contrat interdit.
 */
export interface Prise {
  id: string;
  jour: string;
  le: string;
  nom: string;
  /** Libre : « 500 mg », « 2 bouffées », « une cuillère ». */
  dose: string;
  voie: VoieDAdministration;
  /** Pourquoi, selon la personne. Pas un diagnostic. */
  motif: string;
  note: string;
  majLe: string;
}

export function controlerPrise(p: Prise): string[] {
  const problemes: string[] = [];
  if (!p.nom.trim()) problemes.push('Une prise a besoin d’un nom.');
  if (!(p.voie in VOIES)) problemes.push(`Voie inconnue : « ${p.voie} ».`);
  if (!p.jour) problemes.push('Une prise appartient à un jour.');
  return problemes;
}

export type NatureDuStatut = 'traitement' | 'cycle' | 'substance' | 'autre';

export const NATURES: Record<NatureDuStatut, string> = {
  traitement: 'Traitement hormonal',
  cycle: 'Phase du cycle',
  substance: 'Substance',
  autre: 'Autre',
};

export interface StatutHormonal {
  id: string;
  nature: NatureDuStatut;
  intitule: string;
  debut: string;
  /** `null` tant que cela dure. */
  fin: string | null;
  note: string;
  majLe: string;
}

export function controlerStatut(s: StatutHormonal): string[] {
  const problemes: string[] = [];
  if (!s.intitule.trim()) problemes.push('Un statut a besoin d’un intitulé.');
  if (!(s.nature in NATURES)) problemes.push(`Nature inconnue : « ${s.nature} ».`);
  if (s.fin !== null && s.fin < s.debut) problemes.push('La fin est avant le début.');
  return problemes;
}

/** Les statuts en cours à un instant donné. */
export function statutsEnCours(
  statuts: readonly StatutHormonal[],
  maintenant = new Date(),
): StatutHormonal[] {
  const instant = maintenant.toISOString();
  return statuts.filter((s) => s.debut <= instant && (s.fin === null || s.fin >= instant));
}

/**
 * Ce qui a été pris un jour donné, groupé par nom.
 *
 * Un **constat**, et rien d'autre : combien de fois, à quelles heures. Aucune
 * comparaison à une posologie, aucune alerte d'oubli — le module ne sait pas
 * ce qui était prévu, et c'est délibéré.
 */
export function prisesDuJour(
  prises: readonly Prise[],
  jour: string,
): { nom: string; fois: number; heures: string[] }[] {
  const parNom = new Map<string, string[]>();
  for (const p of prises) {
    if (p.jour !== jour) continue;
    const heures = parNom.get(p.nom) ?? [];
    heures.push(p.le);
    parNom.set(p.nom, heures);
  }
  return [...parNom.entries()]
    .map(([nom, heures]) => ({ nom, fois: heures.length, heures: heures.sort() }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
