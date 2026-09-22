/**
 * Répétition espacée — algorithme SM-2 (SuperMemo 2), adapté à trois niveaux
 * de difficulté : difficile / moyen / facile.
 *
 * Principe : chaque bonne réponse allonge l'intervalle avant la prochaine
 * révision ; une réponse « difficile » remet la carte dans la file du jour.
 */
import {
  ajouterJours,
  ecrireCarte,
  jourISO,
  lireCarte,
  type Difficulte,
  type EtatCarte,
} from './db';

/** Qualité de rappel SM-2 associée à chaque bouton. */
const QUALITE: Record<Difficulte, number> = { difficile: 2, moyen: 4, facile: 5 };

export const FACILITE_INITIALE = 2.5;
export const FACILITE_MINIMALE = 1.3;

export function carteNeuve(id: string, ficheId: string, matiere: string): EtatCarte {
  return {
    id,
    ficheId,
    matiere,
    repetitions: 0,
    intervalle: 0,
    facilite: FACILITE_INITIALE,
    du: jourISO(),
    derniereRevision: null,
    oublis: 0,
    revisions: 0,
  };
}

/** Applique une note à une carte et retourne son nouvel état (calcul pur). */
export function noter(carte: EtatCarte, difficulte: Difficulte, aujourdhui = jourISO()): EtatCarte {
  const q = QUALITE[difficulte];

  // Mise à jour du facteur de facilité (formule SM-2).
  const facilite = Math.max(
    FACILITE_MINIMALE,
    carte.facilite + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  let repetitions = carte.repetitions;
  let intervalle: number;
  let oublis = carte.oublis;

  if (q < 3) {
    // Échec : la carte revient dans la file du jour.
    repetitions = 0;
    intervalle = 0;
    oublis += 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      // Une carte neuve jugée « facile » n'a pas besoin de revenir dès demain.
      intervalle = difficulte === 'facile' ? 3 : 1;
    } else if (repetitions === 2) {
      intervalle = difficulte === 'facile' ? 8 : 6;
    } else {
      intervalle = Math.max(1, Math.round(carte.intervalle * facilite));
      // Une réponse « facile » sur une carte déjà connue accélère un peu plus.
      if (difficulte === 'facile') intervalle = Math.round(intervalle * 1.15);
    }
  }

  return {
    ...carte,
    facilite,
    repetitions,
    intervalle,
    oublis,
    revisions: carte.revisions + 1,
    derniereRevision: new Date().toISOString(),
    du: ajouterJours(aujourdhui, intervalle),
  };
}

/** Note une carte et enregistre le résultat. */
export async function noterEtEnregistrer(
  id: string,
  ficheId: string,
  matiere: string,
  difficulte: Difficulte,
): Promise<EtatCarte> {
  const existante = (await lireCarte(id)) ?? carteNeuve(id, ficheId, matiere);
  const misAJour = noter({ ...existante, ficheId, matiere }, difficulte);
  await ecrireCarte(misAJour);
  return misAJour;
}

/** Une carte est due si elle n'a jamais été vue ou si son échéance est atteinte. */
export function estDue(carte: EtatCarte | undefined, aujourdhui = jourISO()): boolean {
  if (!carte) return true;
  return carte.du <= aujourdhui;
}

/** Niveau de maîtrise d'une carte, de 0 à 1 : sert aux barres de progression. */
export function maitrise(carte: EtatCarte | undefined): number {
  if (!carte || carte.revisions === 0) return 0;
  // 21 jours d'intervalle = carte considérée comme acquise.
  return Math.min(1, carte.intervalle / 21);
}
