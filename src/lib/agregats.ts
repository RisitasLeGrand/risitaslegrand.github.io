/**
 * Croise le manifeste (structure du contenu) avec la base locale
 * (progression) pour produire les indicateurs affichés partout :
 * maîtrise par fiche, par fascicule et par matière, file du jour, etc.
 */
import {
  aplatirFiches,
  chargerFiche,
  chargerManifeste,
  type FicheAplatie,
  type Manifeste,
} from './contenu';
import {
  ecartJours,
  jourISO,
  toutesLesCartes,
  tousLesEtatsFiches,
  tousLesResultatsQuiz,
  type EtatCarte,
} from './db';
import { maitrise } from './srs';

export interface ProgressionFiche {
  fiche: FicheAplatie;
  lu: boolean;
  cartesTotal: number;
  cartesVues: number;
  cartesAcquises: number;
  cartesDues: number;
  meilleurQuiz: number | null;
  maitrise: number; // 0 → 1
}

export interface ProgressionGroupe {
  nom: string;
  id: string;
  fiches: ProgressionFiche[];
  maitrise: number;
  cartesDues: number;
  fichesLues: number;
}

export interface Vue {
  manifeste: Manifeste;
  fiches: ProgressionFiche[];
  matieres: (ProgressionGroupe & { fascicules: ProgressionGroupe[] })[];
  cartesDues: number;
  maitriseGlobale: number;
}

function moyenne(valeurs: number[]): number {
  return valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : 0;
}

/** Construit la vue complète « contenu + progression ». */
export async function construireVue(): Promise<Vue> {
  const manifeste = await chargerManifeste();
  const [cartes, etatsFiches, resultats] = await Promise.all([
    toutesLesCartes(),
    tousLesEtatsFiches(),
    tousLesResultatsQuiz(),
  ]);
  const aujourdhui = jourISO();

  const cartesParFiche = new Map<string, EtatCarte[]>();
  for (const carte of cartes) {
    const liste = cartesParFiche.get(carte.ficheId) ?? [];
    liste.push(carte);
    cartesParFiche.set(carte.ficheId, liste);
  }

  const luParFiche = new Map(etatsFiches.map((e) => [e.id, e.lu]));
  const meilleurParFiche = new Map<string, number>();
  for (const r of resultats) {
    if (r.total === 0) continue;
    const taux = r.bonnes / r.total;
    meilleurParFiche.set(r.ficheId, Math.max(meilleurParFiche.get(r.ficheId) ?? 0, taux));
  }

  const progressions: ProgressionFiche[] = aplatirFiches(manifeste).map((fiche) => {
    const etats = cartesParFiche.get(fiche.id) ?? [];
    const parId = new Map(etats.map((e) => [e.id, e]));
    const lu = luParFiche.get(fiche.id) ?? false;
    const meilleurQuiz = meilleurParFiche.get(fiche.id) ?? null;

    // Les cartes jamais vues comptent comme dues et non maîtrisées.
    const cartesVues = etats.filter((e) => e.revisions > 0).length;
    const cartesAcquises = etats.filter((e) => e.intervalle >= 21).length;
    const cartesDues =
      fiche.nbFlashcards - cartesVues + etats.filter((e) => e.revisions > 0 && e.du <= aujourdhui).length;

    const niveauxCartes: number[] = [];
    for (let i = 0; i < fiche.nbFlashcards; i++) niveauxCartes.push(0);
    let index = 0;
    for (const etat of parId.values()) {
      // Garde-fou : une carte supprimée du contenu peut subsister en base.
      if (index >= niveauxCartes.length) break;
      niveauxCartes[index++] = maitrise(etat);
    }

    const composantes: number[] = [];
    if (fiche.aCours || fiche.aFiche) composantes.push(lu ? 1 : 0);
    if (fiche.nbFlashcards > 0) composantes.push(moyenne(niveauxCartes));
    if (fiche.nbQuiz > 0) composantes.push(meilleurQuiz ?? 0);

    return {
      fiche,
      lu,
      cartesTotal: fiche.nbFlashcards,
      cartesVues,
      cartesAcquises,
      cartesDues: Math.max(0, cartesDues),
      meilleurQuiz,
      maitrise: moyenne(composantes),
    };
  });

  const parId = new Map(progressions.map((p) => [p.fiche.id, p]));

  const matieres = manifeste.matieres.map((m) => {
    const fascicules = m.fascicules.map((f) => {
      const fiches = f.fiches.map((x) => parId.get(x.id)!).filter(Boolean);
      return {
        id: f.id,
        nom: f.nom,
        fiches,
        maitrise: moyenne(fiches.map((x) => x.maitrise)),
        cartesDues: fiches.reduce((n, x) => n + x.cartesDues, 0),
        fichesLues: fiches.filter((x) => x.lu).length,
      };
    });
    const fiches = fascicules.flatMap((f) => f.fiches);
    return {
      id: m.id,
      nom: m.nom,
      fascicules,
      fiches,
      maitrise: moyenne(fiches.map((x) => x.maitrise)),
      cartesDues: fiches.reduce((n, x) => n + x.cartesDues, 0),
      fichesLues: fiches.filter((x) => x.lu).length,
    };
  });

  return {
    manifeste,
    fiches: progressions,
    matieres,
    cartesDues: progressions.reduce((n, p) => n + p.cartesDues, 0),
    maitriseGlobale: moyenne(progressions.map((p) => p.maitrise)),
  };
}

export interface CarteAReviser {
  id: string;
  question: string;
  reponse: string;
  ficheId: string;
  ficheTitre: string;
  matiere: string;
  /** true si la carte n'a encore jamais été révisée. */
  neuve: boolean;
  /** Nombre de jours de retard sur l'échéance ; 0 pour une carte neuve. */
  retard: number;
}

/**
 * Construit la file de révision du jour.
 * Charge le détail des fiches concernées, puis retient les cartes dues.
 */
export async function fileDuJour(options: {
  matiere?: string | null;
  ficheId?: string | null;
  /** Restreint la file à un ensemble de fiches — rappel d'une séance passée. */
  ficheIds?: string[] | null;
  limite?: number;
  inclureNonDues?: boolean;
} = {}): Promise<CarteAReviser[]> {
  const {
    matiere = null,
    ficheId = null,
    ficheIds = null,
    limite = 0,
    inclureNonDues = false,
  } = options;
  const manifeste = await chargerManifeste();
  const cartes = new Map((await toutesLesCartes()).map((c) => [c.id, c]));
  const aujourdhui = jourISO();
  const ensemble = ficheIds?.length ? new Set(ficheIds) : null;

  const candidates = aplatirFiches(manifeste).filter(
    (f) =>
      f.nbFlashcards > 0 &&
      (!matiere || f.matiere === matiere) &&
      (!ficheId || f.id === ficheId) &&
      (!ensemble || ensemble.has(f.id)),
  );

  const file: CarteAReviser[] = [];
  for (const resume of candidates) {
    const fiche = await chargerFiche(resume.id);
    for (const carte of fiche.flashcards) {
      const etat = cartes.get(carte.id);
      const due = !etat || etat.du <= aujourdhui;
      if (!due && !inclureNonDues) continue;
      file.push({
        id: carte.id,
        question: carte.question,
        reponse: carte.reponse,
        ficheId: fiche.id,
        ficheTitre: fiche.titre,
        matiere: fiche.matiere,
        neuve: !etat || etat.revisions === 0,
        // Retard, en jours : sert à servir d'abord ce qui attend depuis le
        // plus longtemps quand la session est plafonnée.
        retard: etat ? Math.max(0, ecartJours(etat.du, aujourdhui)) : 0,
      });
    }
  }

  // Cartes déjà vues d'abord (rappel avant découverte), les plus en retard
  // en tête : c'est ce qui compte quand la file dépasse le plafond de session.
  file.sort((a, b) => Number(a.neuve) - Number(b.neuve) || b.retard - a.retard);
  return limite > 0 ? file.slice(0, limite) : file;
}
