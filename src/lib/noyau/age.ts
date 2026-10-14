/**
 * L'âge : ce qu'on en sait, ce qu'on n'en sait pas, et comment on se trompe du
 * bon côté.
 *
 * ## L'âge n'est pas un nombre, c'est un intervalle
 *
 * Cyclades ne stocke que l'**année** de naissance (minimisation, 1 n° 8). Sans
 * le mois, l'âge n'est donc pas connu : il vaut `A − 1` **ou** `A`, selon que
 * l'anniversaire est passé. Un module qui ramènerait cela à un entier unique
 * choisirait en silence, et se tromperait une fois sur deux pendant la moitié
 * de l'année.
 *
 * D'où le type de retour : une **fourchette**. Les appelants doivent regarder
 * les deux bornes, et c'est le but.
 *
 * ## Se tromper du bon côté
 *
 * Quand la fourchette chevauche un seuil — la personne a 17 ou 18 ans —, il n'y
 * a pas de réponse. Le prompt tranche dans le sens de la prudence (2.4) : la
 * fonction réservée aux majeurs **reste fermée** tant que le mois n'est pas
 * connu. Ce module ne rend donc pas `false`, qui se lirait « cette personne est
 * mineure » : il rend **`indeterminable`**, qui se lit « on ne sait pas ». La
 * différence compte au moment d'écrire l'écran : on n'affiche pas la même
 * phrase à quelqu'un dont on sait qu'il est mineur et à quelqu'un dont on
 * l'ignore.
 *
 * ## Le mois de naissance, et le jour qu'on n'a pas
 *
 * Quand le mois est connu et que c'est **le mois courant**, l'anniversaire peut
 * être passé ou non : il faudrait le jour, qu'on ne stocke jamais. L'âge est
 * alors tenu pour **le plus bas jusqu'à la fin du mois** (2.4). Cela retarde un
 * déblocage de quelques semaines au plus, ce qui est le mauvais côté le moins
 * cher.
 *
 * ## Aucune lecture d'horloge
 *
 * Le jour est un **paramètre**, jamais `new Date()` à l'intérieur d'un calcul.
 * C'est la règle du projet depuis le rapprochement bancaire : un calcul qui lit
 * l'heure ne se rejoue pas, et ne se teste ni à midi ni à minuit.
 */
import { seuil, type SeuilDeclare } from './seuils-age';

/* ══════════════════════════════════════════════════════════════════════════
   Ce que la personne a déclaré
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'état d'un champ, repris de I.2.
 *
 * Les trois manières de ne pas avoir de valeur ne sont pas la même chose, et
 * les confondre coûte : une question **refusée** ne se repose jamais, une
 * question **non répondue** peut revenir, et un **« je ne sais pas »** appelle
 * une aide, pas une relance.
 */
export type EtatDeChamp = 'non_repondu' | 'inconnu' | 'refuse' | 'renseigne';

export interface DeclarationDAge {
  /** `null` quand l'année n'est pas renseignée, quelle qu'en soit la raison. */
  anneeNaissance: number | null;
  /** Demandé **uniquement** à la frontière d'un seuil utilisé (2.4). 1 à 12. */
  moisNaissance: number | null;
  /**
   * « Je suis majeur(e) », en alternative à l'année.
   *
   * **Ignoré si l'année est connue** (2.4) : deux sources pour le même fait
   * finiraient par diverger, et c'est l'année qui porte l'information la plus
   * riche.
   */
  majeurDeclare: boolean | null;
}

export const DECLARATION_VIERGE: DeclarationDAge = {
  anneeNaissance: null,
  moisNaissance: null,
  majeurDeclare: null,
};

/* ══════════════════════════════════════════════════════════════════════════
   L'âge, en fourchette
   ══════════════════════════════════════════════════════════════════════════ */

/** `min === max` quand le mois est connu : la fourchette se referme. */
export interface Fourchette {
  min: number;
  max: number;
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

function decomposer(jour: string): { annee: number; mois: number } {
  const m = JOUR.exec(jour);
  if (!m) throw new Error(`Jour logique illisible : « ${jour} ».`);
  return { annee: Number(m[1]), mois: Number(m[2]) };
}

/**
 * L'âge au jour logique donné, ou `null` si l'année n'est pas connue.
 *
 * Sans le mois : `A − 1` ou `A`. Avec le mois : une seule valeur, le mois de
 * naissance comptant pour l'âge le plus bas jusqu'à sa fin.
 */
export function ageA(declaration: DeclarationDAge, jour: string): Fourchette | null {
  const { anneeNaissance: naissance, moisNaissance: mois } = declaration;
  if (naissance === null) return null;
  const aujourdhui = decomposer(jour);
  const A = aujourdhui.annee - naissance;
  if (mois === null) return { min: A - 1, max: A };
  /* Le mois courant compte pour l'âge le plus bas : le jour manque. */
  const age = aujourdhui.mois > mois ? A : A - 1;
  return { min: age, max: age };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les seuils
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Trois réponses, et la troisième n'est pas un échec.
 *
 * `indeterminable` est une réponse à part entière : elle dit que la donnée
 * manque, pas que la personne est d'un côté ou de l'autre. Les écrans s'en
 * servent pour proposer de renseigner, au lieu de fermer sans expliquer.
 */
export type Franchissement = 'oui' | 'non' | 'indeterminable';

/**
 * La personne a-t-elle atteint ce seuil ?
 *
 * L'ordre des cas est la règle de prudence elle-même. L'année prime sur la
 * déclaration « je suis majeur(e) » (2.4). La fourchette ne tranche que si elle
 * est **entièrement** d'un côté : à cheval, c'est `indeterminable`, et la
 * fonction reste fermée.
 */
export function franchit(
  declaration: DeclarationDAge,
  idDuSeuil: string,
  jour: string,
): Franchissement {
  const s = seuil(idDuSeuil);
  if (!s) throw new Error(`Seuil non déclaré : « ${idDuSeuil} ». Voir seuils-age.ts.`);
  const fourchette = ageA(declaration, jour);
  if (fourchette === null) {
    /* Pas d'année. La déclaration « je suis majeur(e) » ne vaut que pour la
       majorité : l'étendre à un seuil de 16 ou de 40 ans serait une déduction. */
    if (s.id === 'majorite' && declaration.majeurDeclare !== null) {
      return declaration.majeurDeclare ? 'oui' : 'non';
    }
    return 'indeterminable';
  }
  if (fourchette.min >= s.valeur) return 'oui';
  if (fourchette.max < s.valeur) return 'non';
  return 'indeterminable';
}

/**
 * Faut-il demander le mois de naissance pour ce seuil ?
 *
 * **Et seulement pour celui-là** : la question ne se pose qu'au moment où la
 * personne demande à activer une fonction que ce seuil garde (2.4). La
 * demander « au cas où » reviendrait à collecter un mois dont on n'a pas
 * l'usage, ce que 1 n° 8 interdit.
 */
export function moisRequisPour(
  declaration: DeclarationDAge,
  idDuSeuil: string,
  jour: string,
): boolean {
  if (declaration.anneeNaissance === null || declaration.moisNaissance !== null) return false;
  return franchit(declaration, idDuSeuil, jour) === 'indeterminable';
}

/* ══════════════════════════════════════════════════════════════════════════
   La tranche d'âge
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La tranche, calculée **avec les bornes que le consommateur a déclarées**.
 *
 * C'est la granularité minimale de 2.2 : un module qui n'a besoin que de
 * « adulte ou non » ne reçoit pas « 34 ans », et un module qui déclare
 * `[18, 40, 65]` ne reçoit pas une tranche de cinq ans. La finesse est un
 * choix inscrit au registre, pas une conséquence de ce que Cyclades sait.
 *
 * Rend `null` — qui se lit « inconnu » — dès que la fourchette chevauche une
 * borne : à 39 ou 40 ans selon un anniversaire qu'on ignore, aucune des deux
 * tranches n'est vraie.
 */
export function trancheDAge(
  declaration: DeclarationDAge,
  bornes: readonly number[],
  jour: string,
): string | null {
  const fourchette = ageA(declaration, jour);
  if (fourchette === null) return null;
  const triees = [...bornes].sort((a, b) => a - b);
  const laquelle = (age: number): number => {
    let i = 0;
    while (i < triees.length && age >= triees[i]) i += 1;
    return i;
  };
  const basse = laquelle(fourchette.min);
  if (basse !== laquelle(fourchette.max)) return null;
  /* Sous la première borne : la tranche n'a pas de plancher déclaré. */
  if (basse === 0) return `moins de ${triees[0]}`;
  const debut = triees[basse - 1];
  const fin = triees[basse];
  return fin === undefined ? `${debut} et plus` : `${debut}-${fin - 1}`;
}

/** Le seuil, pour un écran qui veut citer sa ligne plutôt que l'affirmer. */
export const seuilDeclare = (id: string): SeuilDeclare | undefined => seuil(id);
