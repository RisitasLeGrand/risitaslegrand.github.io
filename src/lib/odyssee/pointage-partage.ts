/**
 * Le geste de pointage : ce qu'un coche depuis le calendrier écrit vraiment —
 * phase 5 du prompt 38, suite du registre `liaison-branches.ts`.
 *
 * ## « Un fait par geste, jamais deux »
 *
 * C'est l'exigence du prompt, et elle n'est pas rhétorique : une tâche liée à
 * une séance de sport qui compterait **et** son occurrence **et** sa séance
 * doublerait l'XP de la journée. La règle tient grâce à une constatation,
 * pas grâce à une précaution — `activite.ts` énumère les types de faits qui
 * comptent, et `odyssee.occurrence` n'y figure pas (ni aucun des trois autres
 * types ajoutés par ce lot). L'occurrence est une **marque d'exception** ;
 * le fait de branche est le fait. Seul le second compte.
 *
 * Cette constatation est datée : si un jour quelqu'un ajoute
 * `odyssee.occurrence` à la liste de `activite.ts`, le double comptage
 * revient sans que rien ici ne change. L'essai `essais:pointage-partage` le
 * surveille, et échoue si le type y apparaît.
 *
 * ## Ce qui en découle pour les tâches **non liées**
 *
 * Une tâche répétée n'est jamais « close » : elle n'a pas de `faiteLe`, et
 * `faits-odyssee.ts` ignore (`if (!tache.faiteLe) continue;`) tout ce qui
 * n'en porte pas. Donc pointer l'occurrence d'une tâche répétée **sans lien**
 * ne produit aujourd'hui aucun fait compté, là où clore une tâche simple en
 * produit un. L'asymétrie est réelle, elle est constatée et non corrigée ici :
 * la corriger demanderait de compter `odyssee.occurrence`, ce qui casserait
 * la règle ci-dessus pour les tâches liées. C'est une ligne du prochain
 * tableau, pas un correctif silencieux.
 *
 * ## Ce module n'invente aucune mesure
 *
 * Un geste de calendrier ne connaît ni durée, ni poids, ni score. Il ne peut
 * donc créer que les faits dont tous les champs obligatoires se déduisent du
 * geste lui-même. C'est le registre qui le dit (`sens: 'deux-sens'`), et ce
 * module ne fait que l'exécuter : il n'a pas de liste à lui.
 */
import { jourLogique } from '../noyau/jour-logique';
import {
  LIBELLE_NEUTRE_DU_POINTAGE,
  actionLiable,
  ecritDansLaBranche,
  magasinDeLException,
  ouvreLEcran,
} from './liaison-branches';
import type { Occurrence, Tache } from './modele';

/* ══════════════════════════════════════════════════════════════════════════
   Ce que le geste a fait, dit à l'écran qui l'a demandé
   ══════════════════════════════════════════════════════════════════════════ */

export type GesteDeBranche =
  /** Un fait a été écrit dans la branche. `reference` est l'id de la ligne. */
  | { quoi: 'ecrit'; branche: string; action: string; reference: string }
  /** Rien n'a été écrit : l'écran de la branche doit s'ouvrir. */
  | { quoi: 'ouvrir'; branche: string; action: string }
  /** Rien n'a été écrit, et rien ne doit l'être. `pourquoi` est affichable. */
  | { quoi: 'rien'; pourquoi: string };

export interface ResultatDuPointage {
  /** L'exception écrite, toujours. C'est elle qui tient le calendrier. */
  occurrence: Occurrence;
  /** Où elle a été rangée — en clair, ou sous scellé. */
  magasin: 'odysseeOccurrences' | 'odysseeExceptionsScellees';
  geste: GesteDeBranche;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les écrivains de branche — un par action « deux-sens », et rien de plus
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les imports sont **dynamiques**, et c'est nécessaire, pas un confort :
 * `sport/donnees.ts` et `odyssee/donnees.ts` chargent tous deux le modèle
 * d'Odyssée. Les importer en tête d'un module qu'eux-mêmes pourraient un jour
 * atteindre fermerait un cycle, qu'un bundler résout en livrant un module à
 * moitié initialisé — une panne qui ne se voit qu'à l'exécution.
 */
type Ecrivain = (tache: Tache, le: Date) => Promise<GesteDeBranche>;

const ECRIVAINS: Record<string, Ecrivain> = {
  /**
   * Une séance de sport naît « en cours », sans série, et se clôt aussitôt :
   * c'est l'état « à compléter » prévu par le modèle, et le pointage ne
   * prétend pas savoir ce qui a été soulevé.
   *
   * **Une séance déjà en cours n'est ni fermée ni doublée.** `ouvrirSeance`
   * rend l'existante plutôt que d'en ouvrir une seconde ; la clore ici
   * couperait une séance que la personne est en train de faire. On s'y
   * rattache et on le dit.
   */
  'sport.seance': async (_tache, le) => {
    const sport = await import('../sport/donnees');
    const enCours = await sport.seanceEnCours();
    if (enCours) {
      return { quoi: 'ecrit', branche: 'sport', action: 'sport.seance', reference: enCours.id };
    }
    const seance = await sport.ouvrirSeance(null, le);
    await sport.cloreSeance(seance.id, { note: LIBELLE_NEUTRE_DU_POINTAGE, le });
    return { quoi: 'ecrit', branche: 'sport', action: 'sport.seance', reference: seance.id };
  },

  /**
   * Tenir une quête ne porte qu'un jour : aucune mesure à inventer. Le lien
   * doit nommer la quête visée — sans elle, il n'y a rien à tenir, et on ne
   * va pas en choisir une au hasard.
   */
  'odyssee.quete': async (tache, le) => {
    const cible = tache.lien?.cible;
    if (!cible) {
      return { quoi: 'rien', pourquoi: 'Le lien ne désigne aucune quête.' };
    }
    const odyssee = await import('./donnees');
    const tenue = await odyssee.tenir(cible, true, le);
    if (!tenue) {
      return { quoi: 'rien', pourquoi: 'La quête liée n’existe plus.' };
    }
    return { quoi: 'ecrit', branche: 'odyssee', action: 'odyssee.quete', reference: tenue.id };
  },
};

/**
 * Le registre et les écrivains doivent dire la même chose.
 *
 * Une action déclarée « deux-sens » sans écrivain promettrait une écriture
 * qui n'arrive pas ; un écrivain sans déclaration écrirait dans une branche
 * que personne n'a autorisée. L'essai compare les deux ensembles.
 */
export const actionsEcrivables = (): string[] => Object.keys(ECRIVAINS).sort();

/* ══════════════════════════════════════════════════════════════════════════
   Le geste
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Pointer une occurrence depuis le calendrier.
 *
 * L'ordre compte : **l'exception d'abord**, le fait de branche ensuite. Si
 * l'écriture de branche échoue, le calendrier montre quand même l'occurrence
 * pointée, ce qui est le moindre mal — l'inverse laisserait une séance de
 * sport orpheline, sans rien qui la rattache au geste qui l'a créée.
 */
export async function pointerDepuisLeCalendrier(
  tache: Tache,
  jourPrevu: string,
  options: { le?: Date } = {},
): Promise<ResultatDuPointage> {
  const le = options.le ?? new Date();
  const magasin = magasinDeLException(tache);
  const exception: Omit<Occurrence, 'id' | 'majLe'> = {
    tacheId: tache.id,
    jourPrevu,
    etat: 'pointee',
    jourPorte: null,
    heure: null,
    le: le.toISOString(),
    motifAbandon: null,
  };

  const donnees = await import('./donnees-occurrences');
  const occurrence =
    magasin === 'odysseeExceptionsScellees'
      ? ((await donnees.ecrireExceptionScellee({
          genre: 'occurrence',
          id: '',
          majLe: '',
          ...exception,
        })) as Occurrence)
      : await donnees.ecrireOccurrence(exception);

  return { occurrence, magasin, geste: await gesteDeBranche(tache, le) };
}

/* ══════════════════════════════════════════════════════════════════════════
   La décision, séparée de l'écriture
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce que le lien de la tâche autorise — rien d'autre, et rien par défaut.
 *
 * **Pure, et séparée de l'exécution.** C'est la moitié du module qui porte
 * une politique, et une politique se contrôle exhaustivement : la laisser
 * mêlée aux écritures l'aurait rendue inéprouvable ailleurs que dans un
 * navigateur, donc éprouvée tard, donc éprouvée mal.
 */
export type DecisionDePointage =
  | { quoi: 'ecrire'; branche: string; action: string }
  | { quoi: 'ouvrir'; branche: string; action: string }
  | { quoi: 'rien'; pourquoi: string };

export function decisionDePointage(tache: Tache): DecisionDePointage {
  const lien = tache.lien;
  if (!lien) return { quoi: 'rien', pourquoi: 'La tâche ne vise aucune branche.' };

  const action = actionLiable(lien.action);
  if (!action) {
    return { quoi: 'rien', pourquoi: `Action inconnue : ${lien.action}.` };
  }
  if (ouvreLEcran(lien.action)) {
    return { quoi: 'ouvrir', branche: action.branche, action: lien.action };
  }
  if (!ecritDansLaBranche(lien.action)) {
    return { quoi: 'rien', pourquoi: action.pourquoi };
  }
  return { quoi: 'ecrire', branche: action.branche, action: lien.action };
}

async function gesteDeBranche(tache: Tache, le: Date): Promise<GesteDeBranche> {
  const decision = decisionDePointage(tache);
  if (decision.quoi !== 'ecrire') return decision;

  const ecrivain = ECRIVAINS[decision.action];
  if (!ecrivain) {
    /*
       Le registre promet une écriture que personne ne sait faire. On refuse
       plutôt que d'ignorer : un « rien » silencieux ici ferait croire à un
       pointage complet.
    */
    throw new Error(
      `Aucun écrivain pour l’action « ${decision.action} », pourtant déclarée deux-sens.`,
    );
  }
  return ecrivain(tache, le);
}

/** Le jour que pointe un geste sans jour explicite. */
export const jourPointeParDefaut = (le = new Date()): string => jourLogique(le);
