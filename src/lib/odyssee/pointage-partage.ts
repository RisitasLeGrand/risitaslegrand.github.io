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
import { coffreOuvert, rangementDeLaBoite } from '../coffre';
import { jourLogique } from '../noyau/jour-logique';
import { gesteSousCoffre } from './coffre-ferme';
import {
  LIBELLE_NEUTRE_DU_POINTAGE,
  actionLiable,
  ecritDansLaBranche,
  magasinDeLException,
  ouvreLEcran,
} from './liaison-branches';
import { idOccurrence } from './modele';
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
   Le geste complet, coffre compris — les DEUX écrans qui pointent
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'un pointage a réellement fait, dit à l'écran qui l'a demandé.
 *
 * Le refus est une **valeur**, comme dans `gesteSousCoffre` et pour la même
 * raison : deux écrans doivent afficher la même phrase, et une phrase qui
 * voyage dans une exception finit par être affichée comme une panne par
 * l'un et avalée par l'autre.
 */
export type GestePointe =
  | { quoi: 'pointe'; resultat: ResultatDuPointage }
  /** Gardé chiffré, à rejouer à l'ouverture du coffre — A-6, option D. */
  | { quoi: 'reporte' }
  | { quoi: 'refuse'; pourquoi: string };

/**
 * Pointer l'occurrence d'une tâche répétée, **coffre compris**.
 *
 * ## Pourquoi cette fonction n'est pas dans l'écran
 *
 * Elle y était, dans `taches.astro`, et le calendrier allait en recevoir une
 * copie. Or ce qu'elle enchaîne n'est pas de la mise en page : l'état du
 * coffre, l'existence d'une boîte sur cet appareil, le choix entre écrire et
 * reporter. Deux copies auraient divergé, et la divergence n'aurait pas été
 * cosmétique — l'un des deux écrans aurait fini par écrire en clair ce que
 * l'autre scelle, ou par jeter un geste que l'autre garde.
 *
 * L'écran garde ce qui lui revient : dire le résultat.
 */
export async function pointerLOccurrence(
  tache: Tache,
  jourPrevu: string,
  options: { le?: Date } = {},
): Promise<GestePointe> {
  const le = options.le ?? new Date();

  const { publiqueDeLaBoite } = await import('../noyau/boite-du-coffre');
  const boiteDisponible = Boolean(await publiqueDeLaBoite(rangementDeLaBoite()));
  const geste = gesteSousCoffre(tache, coffreOuvert(), boiteDisponible);

  if (geste.quoi === 'impossible') return { quoi: 'refuse', pourquoi: geste.pourquoi };

  if (geste.quoi === 'reporter') {
    const donnees = await import('./donnees-occurrences');
    const garde = await donnees.deposerUnReport({
      tacheId: tache.id,
      jourPrevu,
      le: le.toISOString(),
      branche: tache.lien?.action ?? '',
    });
    /*
       `deposerUnReport` rend `false` quand il n'y a pas de boîte. On le dit
       plutôt que de laisser croire que le geste a été gardé : un geste perdu
       en silence est pire qu'un geste refusé.
    */
    if (!garde) {
      return {
        quoi: 'refuse',
        pourquoi:
          'Le geste n’a pas pu être gardé : ce navigateur n’a pas de boîte. ' +
          'Ouvrez le coffre une fois, puis réessayez.',
      };
    }
    return { quoi: 'reporte' };
  }

  return { quoi: 'pointe', resultat: await pointerDepuisLeCalendrier(tache, jourPrevu, { le }) };
}

/**
 * Écrire une exception **dans le bon magasin** — anomalie A-14.
 *
 * Toute exception d'une tâche liée à une branche sous coffre est scellée :
 * `magasinDeLException` le dit, et c'est la décision 3 qui le veut, parce
 * qu'une ligne en clair « tâche X, le 14, abandonnée » rend un rythme
 * lisible sans la clé. Les écrans appelaient `ecrireOccurrence` directement,
 * donc écrivaient toujours en clair ; ils passent par ici désormais.
 *
 * **Lève si le coffre est fermé sur une tâche scellée** : il n'y a pas de
 * repli acceptable. Écrire en clair annulerait la protection, et ne rien
 * écrire ferait croire le geste enregistré.
 */
export async function ecrireLException(
  tache: Tache,
  exception: Omit<Occurrence, 'id' | 'majLe'>,
): Promise<void> {
  const donnees = await import('./donnees-occurrences');
  if (magasinDeLException(tache) === 'odysseeExceptionsScellees') {
    await donnees.ecrireExceptionScellee({ genre: 'occurrence', id: '', majLe: '', ...exception });
    return;
  }
  await donnees.ecrireOccurrence(exception);
}

/**
 * Défaire un pointage — C1, option D, et seconde moitié de l'anomalie A-14.
 *
 * ## Le magasin se choisit, il ne se suppose pas
 *
 * `taches.astro` écrivait le dépointage avec `ecrireOccurrence`, donc **en
 * clair**, y compris pour une tâche liée à une branche sous coffre. Une
 * ligne en clair portant « tâche X, le 14, dépointée » rend le rythme
 * lisible sans la clé — exactement ce que la décision 3 refuse, et ce que
 * `magasinDeLException` existe pour empêcher. Le choix du magasin est donc
 * fait ici, une fois, pour les deux écrans.
 *
 * ## Deux gestes, pas un
 *
 * `gesteDeRetrait` les distingue, et la distinction porte tout :
 *
 * - **effacer l'exception** quand c'est l'exception qui disait « faite ».
 *   L'occurrence redevient ce que la règle en dit ;
 * - **écrire un dépointage** quand c'est la branche qui le dit. Effacer ne
 *   servirait à rien — l'affichage suivant relirait le fait et recocherait.
 *   Il faut une exception qui **contredit**, sans toucher à la séance : la
 *   séance a eu lieu, et le calendrier n'a pas à la défaire.
 *
 * **Lève si le coffre est fermé sur une tâche scellée**, parce qu'il n'y a
 * alors rien à proposer : l'occurrence est `inconnu`, donc pas « faite »,
 * donc `gesteDeRetrait` rend `rien-a-defaire` et l'écran n'offre pas le
 * bouton. Si malgré tout l'appel arrive, mieux vaut une erreur visible
 * qu'une écriture en clair.
 */
export async function retirerLePointage(
  tache: Tache,
  jourPrevu: string,
  geste: 'effacer-l-exception' | 'ecrire-un-depointage',
  options: { le?: Date } = {},
): Promise<void> {
  const donnees = await import('./donnees-occurrences');
  const scelle = magasinDeLException(tache) === 'odysseeExceptionsScellees';

  if (geste === 'effacer-l-exception') {
    /* Effacer n'est pas lire : aucune des deux suppressions n'exige le coffre. */
    if (scelle) await donnees.oublierExceptionScellee(idOccurrence(tache.id, jourPrevu));
    else await donnees.oublierOccurrence(tache.id, jourPrevu);
    return;
  }

  const depointage: Omit<Occurrence, 'id' | 'majLe'> = {
    tacheId: tache.id,
    jourPrevu,
    etat: 'depointee',
    jourPorte: null,
    heure: null,
    le: (options.le ?? new Date()).toISOString(),
    motifAbandon: null,
  };
  await ecrireLException(tache, depointage);
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
