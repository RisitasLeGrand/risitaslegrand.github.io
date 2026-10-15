/**
 * Les tâches à étapes — phase 3 du prompt 38.
 *
 * Pur, comme le moteur de répétition : ce module ne lit aucune base, n'écrit
 * rien, et ne connaît pas l'écran. Il répond à quatre questions — où en est
 * cette occurrence, dans quel ordre s'affichent les étapes, que donne un
 * déplacement, et la tâche est-elle finie.
 *
 * ## L'idée qui porte tout : le cochage appartient à l'occurrence
 *
 * « **Chaque occurrence repart d'une liste décochée.** Les étapes cochées
 * d'hier restent dans l'historique d'hier. » C'est l'exigence du prompt, et
 * elle se tient par la forme des données, pas par une remise à zéro : les
 * étapes sont portées par la **tâche** et valent pour toutes ses occurrences ;
 * les cochages sont des enregistrements à part qui portent un `jourPrevu`.
 *
 * Rien n'est donc jamais « remis à zéro » — il n'y a rien à remettre. Demander
 * l'avancement d'un autre jour, c'est filtrer sur un autre jour. Une remise à
 * zéro nocturne aurait eu besoin d'un réveil, d'un fuseau, et d'une réponse à
 * « que se passe-t-il si l'application n'est pas ouverte cette nuit-là ».
 *
 * ## Ce que ce module ne fait pas, et pourquoi
 *
 * **Il n'écrit pas de « non faite ».** La décision 2c dit qu'à la clôture
 * manuelle, « les étapes restantes sont marquées non faites ». Elles le sont
 * déjà : l'absence de cochage **est** le non-fait, et `etapesNonFaites()` le
 * donne à tout moment. Écrire un enregistrement par étape non cochée aurait
 * doublé le magasin pour n'ajouter aucune information — et aurait créé une
 * donnée nouvelle, « non faite à telle heure », que personne n'a saisie.
 */
import type { Etape, EtapeCochee } from './modele';

/* ══════════════════════════════════════════════════════════════════════════
   Lire
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les étapes dans l'ordre d'affichage : par rang, puis par identifiant.
 *
 * Le départage par identifiant n'est pas décoratif. Deux appareils peuvent
 * poser le même rang sur deux étapes différentes — la fusion garde les deux —
 * et sans second critère l'ordre dépendrait de celui de lecture de la base,
 * donc différerait d'un appareil à l'autre pour les mêmes données.
 */
export const etapesOrdonnees = (etapes: readonly Etape[]): Etape[] =>
  [...etapes].sort((a, b) => a.rang - b.rang || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Les cochages d'une occurrence : ceux de cette tâche, ce jour-là, et pas d'autres. */
export const cochagesDeLOccurrence = (
  cochages: readonly EtapeCochee[],
  tacheId: string,
  jourPrevu: string,
): EtapeCochee[] =>
  cochages.filter((c) => c.tacheId === tacheId && c.jourPrevu === jourPrevu);

/** Les identifiants d'étapes cochés, en ensemble pour les lectures répétées. */
export const cochees = (cochages: readonly EtapeCochee[]): Set<string> =>
  new Set(cochages.map((c) => c.etapeId));

export interface Avancement {
  faites: number;
  total: number;
  /** « 3 / 7 ». Vide quand la tâche n'a pas d'étapes : il n'y a rien à compter. */
  texte: string;
  /** Toutes les étapes sont cochées, et il y en a au moins une. */
  complet: boolean;
}

/**
 * L'avancement d'une occurrence.
 *
 * Les cochages passés sont **filtrés sur les étapes qui existent encore** :
 * une étape supprimée de la tâche laisse derrière elle des cochages orphelins,
 * et les compter donnerait « 4 / 3 ». Les orphelins ne sont pas effacés pour
 * autant — ils appartiennent à l'historique du jour où l'étape existait.
 */
export function avancement(
  etapes: readonly Etape[],
  cochages: readonly EtapeCochee[],
): Avancement {
  const total = etapes.length;
  if (total === 0) return { faites: 0, total: 0, texte: '', complet: false };
  const existantes = new Set(etapes.map((e) => e.id));
  const faites = new Set(
    cochages.map((c) => c.etapeId).filter((id) => existantes.has(id)),
  ).size;
  return { faites, total, texte: `${faites} / ${total}`, complet: faites === total };
}

/** Les étapes qui ne sont pas cochées, dans l'ordre d'affichage. */
export const etapesNonFaites = (
  etapes: readonly Etape[],
  cochages: readonly EtapeCochee[],
): Etape[] => {
  const faites = cochees(cochages);
  return etapesOrdonnees(etapes).filter((e) => !faites.has(e.id));
};

/* ══════════════════════════════════════════════════════════════════════════
   La fin de la tâche — décision 2c
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La tâche se clôt-elle d'elle-même ?
 *
 * Décision 2c : **les deux** — automatique quand tout est coché, manuelle à
 * tout moment. Celle-ci ne répond qu'à la première moitié ; la seconde est un
 * geste, et un geste ne se déduit pas.
 *
 * Une tâche **sans étapes** ne se clôt jamais toute seule : « zéro sur zéro »
 * n'est pas « tout est fait », c'est « il n'y avait rien à cocher ». La
 * traiter comme complète fermerait toute tâche simple à sa création.
 */
export const seClotToutSeul = (
  etapes: readonly Etape[],
  cochages: readonly EtapeCochee[],
): boolean => avancement(etapes, cochages).complet;

/* ══════════════════════════════════════════════════════════════════════════
   Réordonner
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le rang à donner à une étape glissée entre deux autres.
 *
 * ## Pourquoi un rang intercalé, et non une renumérotation
 *
 * Renuméroter toute la liste à chaque déplacement ferait de chaque glissement
 * une réécriture de **toutes** les étapes, donc de la tâche entière. Deux
 * appareils qui réordonnent chacun une étape différente écriraient alors tous
 * deux la liste complète, et la fusion — dernier écrivain gagne, par cible —
 * perdrait silencieusement le travail de l'un.
 *
 * En n'écrivant que le rang de l'étape déplacée, deux déplacements distincts
 * survivent tous les deux.
 *
 * ## La limite, et ce qu'on en fait
 *
 * Un rang intercalé est une moyenne, donc un flottant, et la place entre deux
 * flottants n'est pas infinie : après une cinquantaine d'intercalations au
 * même endroit, les deux voisins deviennent indiscernables. `rangEntre()`
 * rend alors `null`, et l'appelant doit renuméroter. Ce n'est pas un détail
 * qu'on découvre en production : c'est une valeur de retour.
 */
export function rangEntre(avant: number | null, apres: number | null): number | null {
  if (avant === null && apres === null) return 0;
  if (avant === null) return (apres as number) - 1;
  if (apres === null) return avant + 1;
  const milieu = (avant + apres) / 2;
  /* Plus de place : le milieu retombe sur l'une des deux bornes. */
  if (milieu === avant || milieu === apres) return null;
  return milieu;
}

/**
 * Déplacer une étape à une position donnée de la liste ordonnée.
 *
 * Rend **le seul rang à écrire**, ou `null` s'il n'y a plus de place entre les
 * deux voisins — l'appelant renumérote alors par `renumeroter()`.
 *
 * `vers` est l'index visé dans la liste **sans l'étape déplacée** : zéro la
 * met en tête, la longueur la met en queue.
 */
export function deplacer(
  etapes: readonly Etape[],
  etapeId: string,
  vers: number,
): { rang: number } | { renumeroter: true } | null {
  const ordre = etapesOrdonnees(etapes);
  if (!ordre.some((e) => e.id === etapeId)) return null;
  const sansElle = ordre.filter((e) => e.id !== etapeId);
  const place = Math.max(0, Math.min(vers, sansElle.length));
  const avant = place > 0 ? sansElle[place - 1].rang : null;
  const apres = place < sansElle.length ? sansElle[place].rang : null;
  const rang = rangEntre(avant, apres);
  return rang === null ? { renumeroter: true } : { rang };
}

/**
 * Renumérote toute la liste, par pas de dix.
 *
 * Le recours quand la place est épuisée. Le pas de dix rend neuf
 * intercalations entières avant d'avoir à recommencer, ce qui suffit en
 * pratique et garde des rangs lisibles dans la base.
 */
export const renumeroter = (etapes: readonly Etape[]): Etape[] =>
  etapesOrdonnees(etapes).map((e, i) => ({ ...e, rang: (i + 1) * 10 }));
