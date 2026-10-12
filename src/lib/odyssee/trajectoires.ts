/**
 * Les trajectoires : trois à la fois, et un refus qui tient.
 *
 * Une **trajectoire** est une intention de durée — « dormir sept heures »,
 * « réviser les finances publiques trois fois par semaine » — adossée à une
 * piste ou à un constat. Elle n'est ni une tâche ni une quête : une tâche se
 * fait, une quête se tient chaque jour, une trajectoire se suit sur des mois
 * et peut échouer sans que rien ne soit perdu.
 *
 * ## Trois, et pas quatre
 *
 * Le plafond n'est pas une coquetterie d'ergonomie. Une liste de douze
 * intentions simultanées n'est pas douze fois plus ambitieuse : c'est une
 * liste qu'on ne regarde plus, et dont chaque ligne devient un petit reproche.
 * Le plafond est donc un **refus d'écriture**, pas un avertissement d'écran.
 *
 * ## Un refus se mémorise, et il est respecté
 *
 * Proposer de nouveau ce qui vient d'être écarté est la façon la plus sûre de
 * faire fermer un écran. Une trajectoire refusée garde donc son identifiant
 * d'origine : la proposition qui l'a produite ne revient pas. Et le refus est
 * **réversible** — on peut changer d'avis, ce qui n'est pas la même chose que
 * se faire redemander.
 *
 * Contrairement aux refus de Sport, celui-ci **voyage** : il porte un choix
 * de fond sur ce qu'on veut faire des prochains mois, pas une consigne de
 * silence de trois semaines. Le perdre en changeant d'appareil coûterait
 * quelque chose.
 */

export const PLAFOND_ACTIVES = 3;

export type StatutTrajectoire = 'active' | 'refusee' | 'atteinte' | 'abandonnee';

export const STATUTS: Record<StatutTrajectoire, string> = {
  active: 'En cours',
  refusee: 'Écartée',
  atteinte: 'Atteinte',
  abandonnee: 'Abandonnée',
};

export interface Trajectoire {
  id: string;
  /**
   * D'où elle vient.
   *
   * L'identifiant d'une piste, d'un constat importé, ou `null` si elle a été
   * posée à la main. C'est **lui** qui rend un refus respectable : sans
   * origine, on ne saurait pas quelle proposition ne plus faire.
   */
  origine: string | null;
  intitule: string;
  /** Ce qu'on veut voir changer, en une phrase. */
  pourquoi: string;
  domaine: string;
  statut: StatutTrajectoire;
  /** Les indicateurs ou types de faits qu'on regardera pour la suivre. */
  series: string[];
  debut: string;
  /** Horizon visé, ou `null` : toutes les trajectoires n'ont pas d'échéance. */
  horizon: string | null;
  /** Renseigné dès que le statut quitte `active`. */
  closeLe: string | null;
  /** Pourquoi elle a été écartée ou abandonnée. Obligatoire dans ces deux cas. */
  motif: string;
  majLe: string;
}

export const estActive = (t: Trajectoire): boolean => t.statut === 'active';

export function controlerTrajectoire(t: Trajectoire): string[] {
  const problemes: string[] = [];
  if (!t.intitule.trim()) problemes.push('Une trajectoire a besoin d’un intitulé.');
  if (!t.domaine) problemes.push('Une trajectoire appartient à un domaine.');
  /*
     Un motif est exigé pour écarter ou abandonner, et pour la même raison que
     dans Odyssée : relire « écartée » six mois plus tard sans savoir pourquoi
     ne renseigne sur rien, et l'on refait alors le même détour.
  */
  if ((t.statut === 'refusee' || t.statut === 'abandonnee') && !t.motif.trim()) {
    problemes.push(`Une trajectoire ${STATUTS[t.statut].toLowerCase()} dit pourquoi.`);
  }
  if (t.statut !== 'active' && t.closeLe === null) {
    problemes.push('Une trajectoire qui n’est plus active porte sa date de clôture.');
  }
  if (t.statut === 'active' && t.closeLe !== null) {
    problemes.push('Une trajectoire active n’a pas de date de clôture.');
  }
  if (t.horizon !== null && t.horizon < t.debut.slice(0, 10)) {
    problemes.push('L’horizon est avant le début.');
  }
  return problemes;
}

/**
 * Peut-on en activer une de plus ?
 *
 * Rendue séparément du contrôle d'une trajectoire seule : le plafond porte sur
 * **l'ensemble**, et une trajectoire isolée ne peut pas savoir si elle est la
 * quatrième.
 */
export function placeDisponible(
  existantes: readonly Trajectoire[],
  sauf?: string,
): { possible: boolean; actives: number; pourquoi: string } {
  const actives = existantes.filter((t) => estActive(t) && t.id !== sauf).length;
  if (actives < PLAFOND_ACTIVES) {
    return {
      possible: true,
      actives,
      pourquoi: `${actives} trajectoire${actives > 1 ? 's' : ''} en cours sur ${PLAFOND_ACTIVES}.`,
    };
  }
  return {
    possible: false,
    actives,
    pourquoi:
      `${PLAFOND_ACTIVES} trajectoires sont déjà en cours. En clore une avant d’en ouvrir une ` +
      'autre n’est pas une contrainte d’affichage : trois intentions suivies valent mieux que ' +
      'dix affichées.',
  };
}

/**
 * Cette origine a-t-elle déjà été écartée ?
 *
 * C'est la question que pose l'écran avant de proposer quoi que ce soit, et
 * c'est elle qui tient la promesse « un refus est respecté ». Elle regarde
 * l'origine, jamais l'intitulé : deux formulations de la même piste doivent
 * se taire pareillement.
 */
export function dejaEcartee(
  existantes: readonly Trajectoire[],
  origine: string | null,
): Trajectoire | undefined {
  if (!origine) return undefined;
  return existantes.find((t) => t.origine === origine && t.statut === 'refusee');
}

/**
 * Les propositions qui restent à faire, une fois les refus retirés.
 *
 * Elle retire aussi celles qui ont **déjà** une trajectoire active ou atteinte
 * de même origine : reproposer ce qu'on fait déjà est la deuxième façon de
 * faire fermer un écran.
 */
export function propositionsRestantes<T extends { id: string }>(
  candidates: readonly T[],
  existantes: readonly Trajectoire[],
): T[] {
  const prises = new Set(
    existantes.filter((t) => t.origine !== null).map((t) => t.origine as string),
  );
  return candidates.filter((c) => !prises.has(c.id));
}
