/**
 * Des faits aux séries journalières.
 *
 * ## L'agrégation est déclarée par type, pas devinée
 *
 * Sommer des durées de révision a un sens ; sommer des pesées n'en a aucun, et
 * sommer des difficultés perçues en aurait encore moins. Chaque type déclare
 * donc **comment** il se ramène à une valeur par jour, et les types qui ne
 * sont pas dans la table ne font pas de série du tout.
 *
 * Deviner à partir de l'unité aurait semblé plus malin, et aurait produit des
 * courbes fausses sans prévenir : deux types en « kg » — une pesée et une
 * charge soulevée — ne s'agrègent pas pareillement.
 *
 * ## Les jours sans fait restent absents
 *
 * Aucune série n'est complétée par des zéros. C'est la même règle que dans
 * `tendances.ts` : un jour sans mesure n'est pas un jour à zéro, et compléter
 * tirerait mécaniquement toute corrélation vers le haut.
 */
import type { Fait } from '../noyau/faits';
import type { Serie } from './tendances';

export type Agregation = 'somme' | 'moyenne' | 'dernier' | 'compte';

export interface SerieDeclaree {
  type: string;
  libelle: string;
  agregation: Agregation;
  unite: string;
  /** Le domaine, pour grouper les séries à l'écran. */
  domaine: string;
  /**
   * La clef de `details` à lire au lieu de la valeur du fait.
   *
   * Sert aux grandeurs qui voyagent dans les détails — la difficulté perçue
   * d'une séance, la qualité d'une nuit — et qu'on ne peut pas tirer de la
   * valeur principale sans se tromper de grandeur.
   */
  detail?: string;
}

/**
 * Le catalogue des séries croisables.
 *
 * Volontairement court. Croiser tout avec tout multiplierait les tests sans
 * rien apprendre : quarante séries feraient sept cent quatre-vingts paires, et
 * la correction des comparaisons multiples rendrait alors presque tout
 * invisible — ce qui est la bonne conséquence, mais un mauvais point de
 * départ. Mieux vaut peu de séries choisies.
 */
export const SERIES_DECLAREES: readonly SerieDeclaree[] = [
  {
    type: 'revision.seance',
    libelle: 'Temps de révision',
    agregation: 'somme',
    unite: 'secondes',
    domaine: 'connaissances',
  },
  {
    type: 'revision.flashcards',
    libelle: 'Cartes revues',
    agregation: 'compte',
    unite: 'cartes',
    domaine: 'connaissances',
  },
  {
    type: 'odyssee.focus',
    libelle: 'Temps de concentration',
    agregation: 'somme',
    unite: 'secondes',
    domaine: 'ordre',
  },
  {
    type: 'odyssee.sommeil',
    libelle: 'Sommeil',
    agregation: 'somme',
    unite: 'secondes',
    domaine: 'corps',
  },
  {
    type: 'odyssee.sommeil',
    libelle: 'Qualité du sommeil',
    agregation: 'moyenne',
    unite: 'sur 5',
    domaine: 'corps',
    detail: 'qualite',
  },
  {
    // La **dernière** pesée du jour : la sommer donnerait un nombre absurde.
    type: 'odyssee.poids',
    libelle: 'Poids',
    agregation: 'dernier',
    unite: 'kg',
    domaine: 'corps',
  },
  {
    type: 'odyssee.repas',
    libelle: 'Calories',
    agregation: 'somme',
    unite: 'kcal',
    domaine: 'corps',
  },
  {
    type: 'odyssee.hydratation',
    libelle: 'Hydratation',
    agregation: 'somme',
    unite: 'mL',
    domaine: 'corps',
  },
  {
    type: 'sport.seance',
    libelle: 'Temps d’entraînement',
    agregation: 'somme',
    unite: 'secondes',
    domaine: 'corps',
  },
  {
    type: 'sport.serie',
    libelle: 'Séries soulevées',
    agregation: 'compte',
    unite: 'séries',
    domaine: 'corps',
  },
  {
    type: 'sport.seance',
    libelle: 'Difficulté des séances',
    agregation: 'moyenne',
    unite: 'sur 10',
    domaine: 'corps',
    detail: 'difficulte',
  },
];

const valeurDe = (fait: Fait, declaree: SerieDeclaree): number | null => {
  const brut = declaree.detail ? fait.details?.[declaree.detail] : fait.valeur;
  return typeof brut === 'number' && Number.isFinite(brut) ? brut : null;
};

/** Construit une série depuis les faits, ou `null` si aucun jour n'est renseigné. */
export function construire(faits: readonly Fait[], declaree: SerieDeclaree): Serie | null {
  const parJour = new Map<string, { total: number; compte: number; dernier: number; le: string }>();
  for (const fait of faits) {
    if (fait.type !== declaree.type) continue;
    const valeur = valeurDe(fait, declaree);
    /*
       Un fait sans la grandeur demandée est **sauté**, pas compté pour zéro :
       une séance sans difficulté perçue ne vaut pas une séance facile, et la
       compter ferait baisser toute moyenne de difficulté à chaque oubli.
    */
    if (valeur === null) continue;
    const jour = fait.jourLogique;
    const cumul = parJour.get(jour) ?? { total: 0, compte: 0, dernier: valeur, le: fait.debut };
    cumul.total += valeur;
    cumul.compte += 1;
    if (fait.debut >= cumul.le) {
      cumul.dernier = valeur;
      cumul.le = fait.debut;
    }
    parJour.set(jour, cumul);
  }
  if (!parJour.size) return null;

  const valeurs = new Map<string, number>();
  for (const [jour, cumul] of parJour) {
    const valeur =
      declaree.agregation === 'somme'
        ? cumul.total
        : declaree.agregation === 'moyenne'
          ? cumul.total / cumul.compte
          : declaree.agregation === 'compte'
            ? cumul.compte
            : cumul.dernier;
    valeurs.set(jour, Math.round(valeur * 1000) / 1000);
  }
  return { id: `${declaree.type}|${declaree.agregation}|${declaree.detail ?? ''}`, libelle: declaree.libelle, valeurs };
}

/** Toutes les séries constructibles depuis ces faits. */
export function construireToutes(faits: readonly Fait[]): Serie[] {
  const sortie: Serie[] = [];
  for (const declaree of SERIES_DECLAREES) {
    const serie = construire(faits, declaree);
    if (serie) sortie.push(serie);
  }
  return sortie;
}

/**
 * Le catalogue se tient-il ?
 *
 * Deux séries ne peuvent pas partager un identifiant — elles s'écraseraient
 * dans toute carte indexée par lui, et le croisement se ferait d'une série
 * avec elle-même sans que rien ne le signale.
 */
export function controlerSeries(): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();
  for (const d of SERIES_DECLAREES) {
    const id = `${d.type}|${d.agregation}|${d.detail ?? ''}`;
    if (vus.has(id)) problemes.push(`Deux séries portent l’identifiant « ${id} ».`);
    vus.add(id);
    if (!d.libelle.trim()) problemes.push(`La série « ${id} » n’a pas de libellé.`);
  }
  const libelles = SERIES_DECLAREES.map((d) => d.libelle);
  for (const libelle of libelles) {
    if (libelles.filter((l) => l === libelle).length > 1) {
      problemes.push(`Deux séries s’appellent « ${libelle} » : les pistes seraient illisibles.`);
    }
  }
  return problemes;
}
