/**
 * Le commentaire « lien avec le programme » d'une actualité, par parcours.
 *
 * Module à part, et non dans `actualites.ts`, pour deux raisons : c'est une
 * question de parcours avant d'être une question d'actualités, et `actualites.ts`
 * importe `ui.ts`, qui lit `import.meta.env` — ce qui le rend inatteignable
 * depuis un essai en ligne de commande. Une règle de repli qui décide quel
 * concours une phrase désigne mérite d'être interrogeable.
 */
import { ID_PARCOURS_PAR_DEFAUT } from './registre';

/** Tout ce qui peut porter un commentaire de rattachement au programme. */
export interface PorteurDeLienCours {
  /** Forme antérieure : une seule phrase, écrite pour le programme de l'INSP. */
  lien_cours?: string;
  /** Forme actuelle : une phrase par parcours. */
  liens_cours?: Record<string, string>;
}

/**
 * Le commentaire « lien avec le programme » d'une actualité, pour un parcours.
 *
 * ## Pourquoi la forme antérieure ne sert qu'au parcours historique
 *
 * Les actualités déjà publiées portent une phrase unique, et cette phrase a été
 * écrite pour le programme de l'INSP : « point d'ancrage de toute question sur
 * l'organisation de l'exécutif », « rattachement attendu : hiérarchie des
 * normes ». L'afficher sous un parcours DGFiP serait exactement le défaut que ce
 * chantier corrige — un texte qui parle d'un autre concours que celui préparé.
 *
 * Le repli est donc **réservé au parcours par défaut**. Sous un autre parcours,
 * une actualité dont la veille n'a pas encore écrit le lien n'en affiche aucun :
 * les fiches rattachées par mots-clés, elles, restent calculées et suffisent à
 * rendre le bloc utile.
 */
export function lienCours(
  porteur: PorteurDeLienCours,
  parcoursId: string,
): string | undefined {
  const propre = porteur.liens_cours?.[parcoursId]?.trim();
  if (propre) return propre;
  // La veille a écrit des liens par parcours, et pas pour celui-ci : il n'y en
  // a donc pas, et le repli n'a pas à en inventer un.
  if (porteur.liens_cours) return undefined;
  if (parcoursId !== ID_PARCOURS_PAR_DEFAUT) return undefined;
  return porteur.lien_cours?.trim() || undefined;
}
