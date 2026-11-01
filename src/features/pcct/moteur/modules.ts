/**
 * Les quatre modules facultatifs de PCCT (prompt 64, L3).
 *
 * Tout ce qui suit est PUR : aucun document, aucune minuterie, aucun tirage
 * caché. Les modules ajoutent des RÈGLES au flux d'essais, et une règle
 * s'éprouve en millisecondes — c'est la même raison qui a mis `grace.attribuer`
 * ici plutôt que dans l'écran.
 *
 * ## Ce que chaque module demande en plus
 *
 *   INHIBITION (ICT) — certains essais portent un signal : il ne faut PAS
 *   répondre, mais presser « Retenir ». Presser « Retenir » sur un essai
 *   ordinaire est une FAUSSE ALARME, et elle se compte.
 *
 *   NDM — en plus du résultat, dire si le NOMBRE présenté est plus petit, égal
 *   ou plus grand que le nombre précédent.
 *
 *   SDM — en plus du résultat, dire si le RÉSULTAT ATTENDU est plus petit, égal
 *   ou plus grand que le résultat attendu PRÉCÉDENT.
 *
 *   CHANGEMENT DE RÈGLE — l'opération change par blocs, parmi celles que les
 *   réglages ont commutées. Marqué « expérimental » à l'écran.
 *
 * ## Les trois défauts de la référence que ce fichier existe pour ne pas refaire
 *
 * 1. L'ICT Y EST IMPOSSIBLE À RÉPONDRE. Son champ de saisie est désactivé sur
 *    un essai d'inhibition, et les touches ne sont écoutées QUE sur ce champ :
 *    la personne n'a aucun moyen de signaler qu'elle retient. Et comme rien
 *    n'est écouté, une fausse alarme ne peut pas exister non plus — le module
 *    ne mesure donc ni ce qu'il prétend mesurer, ni son contraire.
 *
 * 2. LA FLÈCHE EST JUGÉE TROP TÔT. La validation automatique note l'essai dès
 *    que le nombre est complet ; une direction donnée APRÈS le nombre arrive
 *    sur un essai déjà clos. C'est pourquoi `accumuler` ne regarde pas l'ordre :
 *    un essai n'est complet que lorsque TOUT ce qu'il demande est là.
 *
 * 3. SDM COMPARE À LA DERNIÈRE SOMME JUSTE, sans le dire. Sa variable n'est
 *    réécrite que dans la branche des essais réussis : après un essai manqué,
 *    la comparaison porte sur une somme plus ancienne que la précédente, et
 *    rien à l'écran ne dit laquelle. On compare ici au résultat attendu de
 *    l'essai PRÉCÉDENT, réussi ou non — décision du Pilote — et l'écran le dit.
 */
import type { Operation } from './types';

/** Le sens d'une comparaison. */
export type Sens = 'plus-petit' | 'egal' | 'plus-grand';

export const SENS: readonly Sens[] = ['plus-petit', 'egal', 'plus-grand'] as const;

/**
 * Le sens de `valeur` PAR RAPPORT À `reference`.
 *
 * L'ordre des arguments est celui de la phrase qu'on lit à l'écran — « le
 * nombre est plus grand que le précédent » —, et non celui d'un comparateur.
 * Inverser les deux donnerait un module qui se trompe de sens une fois sur
 * deux sans jamais rougir sur un essai où ils sont égaux.
 */
export function sensEntre(valeur: number, reference: number): Sens {
  if (valeur < reference) return 'plus-petit';
  if (valeur > reference) return 'plus-grand';
  return 'egal';
}

/**
 * Le sens attendu, ou `null` quand la comparaison n'est pas possible.
 *
 * `null` n'est pas « égal » : pendant l'échauffement il n'y a pas de référence,
 * et un essai sans comparaison possible ne doit pas en demander une. Traiter
 * l'absence comme un zéro ferait exiger une flèche que rien ne permet de
 * choisir.
 */
export function sensAttendu(valeur: number | null, reference: number | null): Sens | null {
  if (valeur === null || reference === null) return null;
  return sensEntre(valeur, reference);
}

/* ── L'inhibition ───────────────────────────────────────────────────────── */

/**
 * Ce qu'un essai d'inhibition est devenu.
 *
 * Cinq cas et non deux, parce que trois d'entre eux se confondraient autrement
 * et qu'on ne saurait plus ce qui a été mesuré :
 *
 *   `retenu`         l'essai portait le signal, « Retenir » a été pressé, et
 *                    aucun résultat n'a été saisi ;
 *   `rate`           l'essai portait le signal et un résultat a été saisi —
 *                    l'inhibition a échoué ;
 *   `omis`           l'essai portait le signal et RIEN n'a été fait. Distinct
 *                    de `retenu` : ne rien faire n'est pas retenir, et la
 *                    référence ne permet même pas de le distinguer ;
 *   `fausse-alarme`  l'essai ne portait pas le signal et « Retenir » a été
 *                    pressé. C'est la mesure que la référence rend impossible,
 *                    et c'est elle qui dit si la personne retient à bon escient
 *                    ou retient tout le temps ;
 *   `sans-objet`     essai ordinaire, rien de particulier.
 */
export type VerdictInhibition = 'retenu' | 'rate' | 'omis' | 'fausse-alarme' | 'sans-objet';

export function jugerInhibition(
  signal: boolean,
  aRetenu: boolean,
  aRepondu: boolean,
): VerdictInhibition {
  if (signal) {
    /* L'ORDRE DES CAS EST LA RÈGLE. Une saisie l'emporte sur « Retenir » :
       qui a répondu n'a pas retenu, même s'il a pressé le bouton ensuite.
       Examiner « Retenir » d'abord rendrait `retenu` à quelqu'un qui a répondu
       puis s'est repris, ce qui est précisément l'échec que le module mesure. */
    if (aRepondu) return 'rate';
    if (aRetenu) return 'retenu';
    return 'omis';
  }
  return aRetenu ? 'fausse-alarme' : 'sans-objet';
}

/** Les comptes de l'inhibition, tels qu'ils paraissent au bilan. */
export interface ComptesInhibition {
  signales: number;
  retenus: number;
  rates: number;
  omis: number;
  faussesAlarmes: number;
  /** Essais ORDINAIRES, dénominateur des fausses alarmes. */
  ordinaires: number;
}

export function comptesInhibitionNeufs(): ComptesInhibition {
  return { signales: 0, retenus: 0, rates: 0, omis: 0, faussesAlarmes: 0, ordinaires: 0 };
}

export function compterInhibition(
  comptes: ComptesInhibition,
  verdict: VerdictInhibition,
): ComptesInhibition {
  const c = { ...comptes };
  if (verdict === 'sans-objet' || verdict === 'fausse-alarme') c.ordinaires += 1;
  else c.signales += 1;
  if (verdict === 'retenu') c.retenus += 1;
  if (verdict === 'rate') c.rates += 1;
  if (verdict === 'omis') c.omis += 1;
  if (verdict === 'fausse-alarme') c.faussesAlarmes += 1;
  return c;
}

/* ── La flèche, avant ou après le nombre ────────────────────────────────── */

/** Ce qu'un essai attend, selon les modules actifs et ce qui est possible. */
export interface Exigences {
  /** Faux sur un essai d'inhibition : il ne faut justement pas répondre. */
  nombre: boolean;
  /** Vrai si NDM ou SDM est actif ET que la comparaison est possible. */
  sens: boolean;
}

/** Ce qui a été donné. L'ordre n'y figure pas, et c'est le point. */
export interface Donnees {
  nombre: number | null;
  sens: Sens | null;
  retenir: boolean;
}

export function donneesNeuves(): Donnees {
  return { nombre: null, sens: null, retenir: false };
}

export type Evenement =
  | { quoi: 'nombre'; valeur: number }
  | { quoi: 'sens'; valeur: Sens }
  | { quoi: 'retenir' };

/**
 * Range un événement, QUEL QUE SOIT L'ORDRE DES AUTRES.
 *
 * C'est le défaut n° 2 de la référence qui a dicté cette forme. Sa validation
 * automatique note l'essai dès que le nombre est complet, de sorte qu'une
 * flèche donnée après le nombre arrive sur un essai clos — et ne compte pas.
 * Qui donne la flèche d'abord est noté ; qui la donne ensuite est noté faux,
 * pour le même geste.
 *
 * Rien ici ne regarde ce qui est déjà là. Une version qui refuserait un sens
 * après un nombre ferait exactement le défaut, et `essais:pcct` le saborde
 * ainsi.
 */
export function accumuler(d: Donnees, e: Evenement): Donnees {
  if (e.quoi === 'nombre') return { ...d, nombre: e.valeur };
  if (e.quoi === 'sens') return { ...d, sens: e.valeur };
  return { ...d, retenir: true };
}

/** L'essai a-t-il reçu tout ce qu'il demandait ? */
export function essaiComplet(exigences: Exigences, d: Donnees): boolean {
  if (exigences.nombre && d.nombre === null) return false;
  if (exigences.sens && d.sens === null) return false;
  return true;
}

/* ── Le changement de règle ─────────────────────────────────────────────── */

/**
 * Les opérations entre lesquelles la règle alterne, dans un ordre stable.
 *
 * Moins de deux opérations commutées, c'est pas de changement du tout : on rend
 * alors une liste vide, et l'appelant garde l'opération des réglages. Rendre
 * une liste d'un seul élément ferait un « changement » qui ne change rien,
 * annoncé à l'écran par une couleur qui ne bouge jamais — pire qu'un module
 * éteint, parce qu'il se dit allumé.
 */
export function operationsCommutables(table: Record<Operation, boolean>): Operation[] {
  const actives = (Object.keys(table) as Operation[]).filter((o) => table[o]);
  return actives.length >= 2 ? actives : [];
}

/**
 * L'opération du bloc où tombe ce rang.
 *
 * Par BLOCS et non par essai : changer à chaque nombre ne mesure plus la
 * bascule d'une règle, mais la lecture d'un signal. Et de façon déterministe à
 * partir du rang, pour qu'un essai se rejoue à l'identique — ce qui est la
 * condition pour qu'une correction détaillée dise la vérité, et pour qu'un
 * essai de ce moteur tienne sans tirage.
 */
export function operationDuRang(
  rang: number,
  commutables: Operation[],
  tailleDeBloc: number,
  defaut: Operation,
): Operation {
  if (commutables.length < 2 || tailleDeBloc < 1) return defaut;
  const bloc = Math.floor((rang - 1) / tailleDeBloc);
  return commutables[bloc % commutables.length];
}

/** Le rang est-il le PREMIER de son bloc ? L'écran l'annonce alors. */
export function debutDeBloc(rang: number, tailleDeBloc: number): boolean {
  if (tailleDeBloc < 1) return false;
  return (rang - 1) % tailleDeBloc === 0;
}
