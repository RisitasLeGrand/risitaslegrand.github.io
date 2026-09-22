/**
 * XP, niveaux, série de jours (« streak ») et badges.
 * Toutes les données sont locales (IndexedDB) — voir src/lib/db.ts.
 */
import config from '../../site.config.mjs';
import {
  ajouterJours,
  ecartJours,
  ecrireProfil,
  jourISO,
  lireProfil,
  majJour,
  tousLesJours,
  toutesLesCartes,
  tousLesEtatsFiches,
  tousLesResultatsQuiz,
  type Profil,
} from './db';

const XP = (config as { xp: Record<string, number> }).xp;

export interface Niveau {
  niveau: number;
  xpDansNiveau: number;
  xpRequisNiveau: number;
  progression: number; // 0 → 1
}

/**
 * Barème de niveaux : le niveau n coûte 100 + (n-1) × 50 XP.
 * Niveau 1 → 2 : 100 XP ; 2 → 3 : 150 XP ; etc.
 */
export function coutNiveau(niveau: number): number {
  return 100 + (niveau - 1) * 50;
}

export function calculerNiveau(xpTotal: number): Niveau {
  let niveau = 1;
  let reste = Math.max(0, xpTotal);
  while (reste >= coutNiveau(niveau)) {
    reste -= coutNiveau(niveau);
    niveau += 1;
  }
  const requis = coutNiveau(niveau);
  return { niveau, xpDansNiveau: reste, xpRequisNiveau: requis, progression: reste / requis };
}

/** Met à jour la série de jours consécutifs à partir du jour courant. */
function majStreak(profil: Profil, aujourdhui: string): Profil {
  if (profil.dernierJourEtudie === aujourdhui) return profil;
  const ecart = profil.dernierJourEtudie ? ecartJours(profil.dernierJourEtudie, aujourdhui) : null;
  const courante = ecart === 1 ? profil.streakCourante + 1 : 1;
  return {
    ...profil,
    streakCourante: courante,
    streakRecord: Math.max(profil.streakRecord, courante),
    dernierJourEtudie: aujourdhui,
  };
}

export interface GainXp {
  xpGagne: number;
  profil: Profil;
  niveau: Niveau;
  monteeDeNiveau: boolean;
  nouveauxBadges: Badge[];
}

/** Enregistre un gain d'XP, met à jour streak, badges et statistiques du jour. */
export async function gagnerXp(
  xpGagne: number,
  delta: { cartes?: number; quiz?: number; bonnes?: number; reponses?: number; secondes?: number } = {},
): Promise<GainXp> {
  const aujourdhui = jourISO();
  const avant = await lireProfil();
  const niveauAvant = calculerNiveau(avant.xp).niveau;

  let profil: Profil = majStreak({ ...avant, xp: avant.xp + xpGagne }, aujourdhui);
  await ecrireProfil(profil);
  await majJour(aujourdhui, { xp: xpGagne, ...delta });

  const nouveauxBadges = await evaluerBadges(profil);
  if (nouveauxBadges.length) {
    profil = { ...profil, badges: [...profil.badges, ...nouveauxBadges.map((b) => b.id)] };
    await ecrireProfil(profil);
  }

  const niveau = calculerNiveau(profil.xp);
  return {
    xpGagne,
    profil,
    niveau,
    monteeDeNiveau: niveau.niveau > niveauAvant,
    nouveauxBadges,
  };
}

export const xpFlashcard = (difficulte: 'difficile' | 'moyen' | 'facile') =>
  difficulte === 'facile'
    ? XP.flashcardFacile
    : difficulte === 'moyen'
      ? XP.flashcardMoyen
      : XP.flashcardDifficile;

export const xpQuiz = (bonnes: number) => XP.quizTermine + bonnes * XP.quizBonneReponse;
export const xpFiche = () => XP.ficheTerminee;

// --- Badges ---------------------------------------------------------------

export interface Badge {
  id: string;
  nom: string;
  description: string;
  icone: string;
}

interface DefinitionBadge extends Badge {
  obtenu: (c: ContexteBadges) => boolean;
}

interface ContexteBadges {
  profil: Profil;
  cartesRevisees: number;
  cartesAcquises: number;
  fichesLues: number;
  quizPasses: number;
  quizParfaits: number;
  joursEtudies: number;
  secondesTotales: number;
  matieresTerminees: number;
}

export const BADGES: DefinitionBadge[] = [
  {
    id: 'premiere-fiche',
    nom: 'Première fiche',
    description: 'Terminer une première fiche de cours.',
    icone: '📘',
    obtenu: (c) => c.fichesLues >= 1,
  },
  {
    id: 'premiere-carte',
    nom: 'Premier réflexe',
    description: 'Réviser une première flashcard.',
    icone: '⚡',
    obtenu: (c) => c.cartesRevisees >= 1,
  },
  {
    id: 'cent-cartes',
    nom: 'Cent cartes',
    description: 'Cumuler 100 révisions de flashcards.',
    icone: '🃏',
    obtenu: (c) => c.cartesRevisees >= 100,
  },
  {
    id: 'mille-cartes',
    nom: 'Mille cartes',
    description: 'Cumuler 1 000 révisions de flashcards.',
    icone: '🎴',
    obtenu: (c) => c.cartesRevisees >= 1000,
  },
  {
    id: 'streak-7',
    nom: '7 jours d\'affilée',
    description: 'Réviser sept jours consécutifs.',
    icone: '🔥',
    obtenu: (c) => c.profil.streakRecord >= 7,
  },
  {
    id: 'streak-30',
    nom: 'Un mois sans faillir',
    description: 'Réviser trente jours consécutifs.',
    icone: '🏔️',
    obtenu: (c) => c.profil.streakRecord >= 30,
  },
  {
    id: 'streak-100',
    nom: 'Cent jours',
    description: 'Réviser cent jours consécutifs.',
    icone: '💎',
    obtenu: (c) => c.profil.streakRecord >= 100,
  },
  {
    id: 'quiz-parfait',
    nom: 'Sans faute',
    description: 'Obtenir 100 % à un quiz.',
    icone: '🎯',
    obtenu: (c) => c.quizParfaits >= 1,
  },
  {
    id: 'dix-quiz-parfaits',
    nom: 'Sans faute × 10',
    description: 'Obtenir 100 % à dix quiz.',
    icone: '🏅',
    obtenu: (c) => c.quizParfaits >= 10,
  },
  {
    id: 'matiere-maitrisee',
    nom: 'Matière maîtrisée',
    description: 'Atteindre 100 % de maîtrise sur une matière entière.',
    icone: '👑',
    obtenu: (c) => c.matieresTerminees >= 1,
  },
  {
    id: 'dix-heures',
    nom: 'Dix heures',
    description: 'Cumuler dix heures de révision.',
    icone: '⏱️',
    obtenu: (c) => c.secondesTotales >= 10 * 3600,
  },
  {
    id: 'cent-heures',
    nom: 'Cent heures',
    description: 'Cumuler cent heures de révision.',
    icone: '🕰️',
    obtenu: (c) => c.secondesTotales >= 100 * 3600,
  },
  {
    id: 'cinquante-acquises',
    nom: 'Mémoire longue',
    description: 'Avoir 50 flashcards à plus de 21 jours d\'intervalle.',
    icone: '🧠',
    obtenu: (c) => c.cartesAcquises >= 50,
  },
];

/** Construit le contexte d'évaluation des badges à partir de la base locale. */
export async function contexteBadges(profil?: Profil): Promise<ContexteBadges> {
  const [p, cartes, fiches, quiz, jours] = await Promise.all([
    profil ? Promise.resolve(profil) : lireProfil(),
    toutesLesCartes(),
    tousLesEtatsFiches(),
    tousLesResultatsQuiz(),
    tousLesJours(),
  ]);

  // Une matière est « terminée » quand toutes ses cartes connues sont acquises.
  const parMatiere = new Map<string, { total: number; acquises: number }>();
  for (const c of cartes) {
    const entree = parMatiere.get(c.matiere) ?? { total: 0, acquises: 0 };
    entree.total += 1;
    if (c.intervalle >= 21) entree.acquises += 1;
    parMatiere.set(c.matiere, entree);
  }

  return {
    profil: p,
    cartesRevisees: cartes.reduce((n, c) => n + c.revisions, 0),
    cartesAcquises: cartes.filter((c) => c.intervalle >= 21).length,
    fichesLues: fiches.filter((f) => f.lu).length,
    quizPasses: quiz.length,
    quizParfaits: quiz.filter((q) => q.total > 0 && q.bonnes === q.total).length,
    joursEtudies: jours.filter((j) => j.xp > 0).length,
    secondesTotales: jours.reduce((n, j) => n + j.secondes, 0),
    matieresTerminees: [...parMatiere.values()].filter((m) => m.total >= 5 && m.acquises === m.total)
      .length,
  };
}

/** Retourne les badges nouvellement débloqués (et non encore enregistrés). */
export async function evaluerBadges(profil: Profil): Promise<Badge[]> {
  const contexte = await contexteBadges(profil);
  const deja = new Set(profil.badges);
  return BADGES.filter((b) => !deja.has(b.id) && b.obtenu(contexte)).map(
    ({ obtenu: _ignore, ...badge }) => badge,
  );
}

/** Statut de la série : sert à la relance visuelle du tableau de bord. */
export async function statutStreak() {
  const profil = await lireProfil();
  const aujourdhui = jourISO();
  const hier = ajouterJours(aujourdhui, -1);
  const etudieAujourdhui = profil.dernierJourEtudie === aujourdhui;
  const enPeril = !etudieAujourdhui && profil.dernierJourEtudie === hier && profil.streakCourante > 0;
  const rompue =
    !etudieAujourdhui &&
    profil.dernierJourEtudie !== null &&
    profil.dernierJourEtudie < hier &&
    profil.streakCourante > 0;
  return {
    courante: rompue ? 0 : profil.streakCourante,
    record: profil.streakRecord,
    etudieAujourdhui,
    enPeril,
    rompue,
  };
}
