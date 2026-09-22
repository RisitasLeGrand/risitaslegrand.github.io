/**
 * Rattachement d'une actualité aux fiches de cours.
 *
 * Les routines de veille ne peuvent pas connaître le plan du site : le
 * manifeste est chiffré et elles n'ont pas le mot de passe. Elles se contentent
 * donc de poser des mots-clés ; le rapprochement avec les fiches réelles se
 * fait ici, dans le navigateur, une fois le contenu déchiffré.
 *
 * Le score privilégie, dans l'ordre :
 *   1. un mot-clé qui correspond exactement à un tag de fiche ;
 *   2. un mot-clé contenu dans le titre d'une fiche ;
 *   3. un mot-clé contenu dans un tag (correspondance partielle) ;
 *   4. un mot-clé présent dans le corps de la fiche (index de recherche,
 *      chargé seulement si les signaux précédents n'ont rien donné) ;
 *   5. à défaut, les mots significatifs du titre de l'actualité.
 */
import { normaliser } from './ui';
import type { EntreeRecherche, FicheAplatie } from './contenu';
import type { FicheActu, ItemActu } from './actualites';

export interface Rattachement {
  fiche: FicheAplatie;
  score: number;
}

/** Mots trop courants pour porter du sens dans un rapprochement. */
const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'et', 'ou', 'en', 'dans',
  'sur', 'pour', 'par', 'avec', 'sans', 'sous', 'vers', 'chez', 'que', 'qui', 'quoi', 'dont',
  'ce', 'ces', 'cet', 'cette', 'son', 'sa', 'ses', 'leur', 'leurs', 'est', 'sont', 'ete',
  'plus', 'moins', 'tres', 'entre', 'apres', 'avant', 'nouveau', 'nouvelle', 'nouvelles',
  'france', 'francais', 'francaise', 'annee', 'mois', 'semaine', 'jour',
]);

function motsSignificatifs(texte: string): string[] {
  return [
    ...new Set(
      normaliser(texte)
        .split(/[^a-z0-9]+/)
        .filter((m) => m.length >= 5 && !MOTS_VIDES.has(m)),
    ),
  ];
}

/** Index « identifiant de fiche → corps de la fiche, normalisé ». */
export type IndexTexte = Map<string, string>;

export function construireIndexTexte(entrees: EntreeRecherche[]): IndexTexte {
  return new Map(entrees.map((e) => [e.id, normaliser(e.texte)]));
}

/**
 * Classe les fiches de cours par pertinence pour une actualité.
 * Retourne au plus « maximum » fiches, les mieux notées d'abord.
 */
export function rattacher(
  actualite: Pick<ItemActu | FicheActu, 'titre' | 'mots_cles'> & { resume?: string },
  fiches: FicheAplatie[],
  index?: IndexTexte | null,
  maximum = 3,
): Rattachement[] {
  const motsCles = (actualite.mots_cles ?? []).map(normaliser).filter((m) => m.length >= 3);
  const secours = motsCles.length ? [] : motsSignificatifs(actualite.titre ?? '');

  const scores: Rattachement[] = [];
  for (const fiche of fiches) {
    const titre = normaliser(fiche.titre);
    const tags = fiche.tags.map(normaliser);
    let score = 0;

    for (const mot of motsCles) {
      if (tags.includes(mot)) score += 5;
      else if (titre.includes(mot)) score += 3;
      else if (tags.some((t) => t.includes(mot) || mot.includes(t))) score += 2;
    }
    for (const mot of secours) {
      if (tags.includes(mot)) score += 2;
      else if (titre.includes(mot)) score += 1;
    }

    // Repêchage : le mot-clé figure dans le corps de la fiche. Signal faible,
    // mais il évite de laisser une actualité sans aucun rattachement.
    if (score === 0 && index) {
      const texte = index.get(fiche.id);
      if (texte) {
        for (const mot of motsCles.length ? motsCles : secours) {
          if (mot.length >= 5 && texte.includes(mot)) score += 1;
        }
      }
    }

    if (score > 0) scores.push({ fiche, score });
  }

  return scores
    .sort((a, b) => b.score - a.score || a.fiche.titre.localeCompare(b.fiche.titre, 'fr'))
    .slice(0, maximum);
}
