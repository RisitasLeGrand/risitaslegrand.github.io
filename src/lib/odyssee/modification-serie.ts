/**
 * Modifier ou supprimer une série — phase 4 du prompt 38, la partie pure.
 *
 * Le prompt pose une exigence courte et lourde de conséquences :
 *
 * > « Modifier ou supprimer : **cette occurrence**, **celle-ci et les
 * > suivantes** ou **toute la série**. Le passé pointé reste intact dans tous
 * > les cas. » Et, dans les interdits : « **aucune série perdue ni réécrite
 * > en silence** ».
 *
 * Ce module ne modifie rien. Il **prépare un plan** : ce qu'il faudrait
 * écrire, et ce que cela coûterait. L'écran montre le plan, la personne
 * décide, et l'écriture vient après. C'est la seule façon qu'une série ne
 * soit pas réécrite en silence : pour qu'elle ne le soit pas, il faut
 * pouvoir dire d'avance ce qui va changer.
 *
 * ## Le piège de « toute la série », et ce que ce module en fait
 *
 * Les occurrences sont **calculées** ; seules les exceptions sont écrites, et
 * leur clé est « tâche / jour prévu ». Changer la règle change donc l'ensemble
 * des jours calculés — et une exception posée sur un jour que la nouvelle
 * règle ne produit plus **ne correspond plus à rien**.
 *
 * Si cette exception était un pointage, la refuser reviendrait à effacer un
 * fait : « j'ai fait cette chose le 12 ». Ce module ne l'efface jamais. Il la
 * **signale** — `pointagesOrphelins` — pour que l'écran puisse dire « trois
 * occurrences déjà pointées ne feront plus partie de la série » avant que la
 * personne confirme. Le fait survit ; ce qui change, c'est qu'on le sait.
 */
import { occurrences, prochaineOccurrence, scinderLaSerie, type Serie } from './repetition';
import { decalerJourLogique } from '../noyau/jour-logique';
import type { MotifNonFait, Occurrence, Tache } from './modele';

/** Jusqu'où regarder en arrière pour trouver les pointages orphelins. */
const HORIZON_PASSE = 400;

/** Les trois portées du prompt, et rien d'autre. */
export type Portee = 'cette-fois' | 'celle-ci-et-suivantes' | 'toute-la-serie';

export const LIBELLE_PORTEE: Record<Portee, string> = {
  'cette-fois': 'Cette occurrence seulement',
  'celle-ci-et-suivantes': 'Celle-ci et les suivantes',
  'toute-la-serie': 'Toute la série',
};

/**
 * Ce qu'il faudrait écrire, et ce que cela coûte.
 *
 * Tous les champs sont facultatifs **sauf** `avertissements` : un plan sans
 * écriture est un plan valide — « cette modification ne change rien » — et
 * c'est une réponse utile.
 */
export interface Plan {
  /** La tâche, réécrite. Absente si elle ne change pas. */
  tache?: Tache;
  /**
   * La **seconde** tâche, née d'une scission, qui porte la suite de la série.
   *
   * Elle n'a ni identifiant ni date de création : l'appelant les pose, parce
   * que lui seul sait tirer un ULID et lire l'horloge.
   */
  suite?: Omit<Tache, 'id' | 'creeeLe' | 'majLe'>;
  /** L'exception à écrire, pour la portée « cette fois ». */
  occurrence?: Omit<Occurrence, 'id' | 'majLe'>;
  /**
   * Les jours déjà **pointés** que la nouvelle règle ne produit plus.
   *
   * Ils ne sont ni effacés ni réécrits. Ils sont dits.
   */
  pointagesOrphelins: string[];
  /** À montrer avant de confirmer. Vide quand il n'y a rien à signaler. */
  avertissements: string[];
}

/* ══════════════════════════════════════════════════════════════════════════
   Les pointages que la nouvelle règle laisserait de côté
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les jours pointés qui ne seraient plus des occurrences.
 *
 * On compare les jours **portés par des exceptions pointées** aux jours que
 * la nouvelle règle produit sur la même fenêtre. Ce qui n'est plus produit est
 * orphelin.
 *
 * La fenêtre remonte à un peu plus d'un an. Au-delà, le coût de parcours
 * dépasse l'intérêt : une personne qui change la règle d'une série ne
 * s'inquiète pas de ce qu'elle a coché il y a trois ans, et le pointage reste
 * de toute façon dans la base.
 */
export function pointagesOrphelins(
  exceptions: readonly Occurrence[],
  nouvelle: Serie,
  aujourdhui: string,
): string[] {
  const pointes = exceptions
    .filter((o) => o.etat === 'pointee')
    .map((o) => o.jourPrevu)
    .sort();
  if (!pointes.length) return [];
  const debut = decalerJourLogique(aujourdhui, -HORIZON_PASSE);
  const plusAncien = pointes[0] < debut ? debut : pointes[0];
  const produits = new Set(occurrences(nouvelle, plusAncien, aujourdhui));
  return pointes.filter((j) => j >= plusAncien && !produits.has(j));
}

/* ══════════════════════════════════════════════════════════════════════════
   Modifier
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le plan d'une modification de série.
 *
 * - **cette fois** : une exception « modifiée » portant l'heure de
 *   remplacement. La règle ne bouge pas. C'est la seule portée qui ne touche
 *   pas la série, et c'est pour cela qu'elle est la plus sûre.
 * - **celle-ci et les suivantes** : la série est scindée. La première moitié
 *   garde le passé tel quel — c'est littéralement ce que « le passé reste
 *   intact » veut dire ici — et une seconde tâche porte la nouvelle règle.
 * - **toute la série** : la règle est remplacée. Le passé **pointé** n'est pas
 *   touché, mais il peut se retrouver hors de la nouvelle règle : d'où les
 *   orphelins.
 */
export function planifierModification(
  tache: Tache,
  jour: string,
  portee: Portee,
  nouvelle: Serie,
  exceptions: readonly Occurrence[] = [],
  aujourdhui = jour,
): Plan {
  if (!tache.serie) {
    return {
      pointagesOrphelins: [],
      avertissements: ['Cette tâche n’est pas répétée : il n’y a pas de série à modifier.'],
    };
  }

  if (portee === 'cette-fois') {
    return {
      occurrence: {
        tacheId: tache.id,
        jourPrevu: jour,
        etat: 'modifiee',
        jourPorte: null,
        heure: nouvelle.heure,
        le: null,
        motifAbandon: null,
      },
      pointagesOrphelins: [],
      avertissements: [],
    };
  }

  if (portee === 'celle-ci-et-suivantes') {
    const { avant, apres } = scinderLaSerie(tache.serie, jour);
    const suite = apres
      ? { ...nouvelle, depuis: apres.depuis, fin: apres.fin }
      : null;
    return {
      /* `avant` à `null` veut dire que la scission tombe avant la première
         occurrence : il ne reste rien à garder, la tâche prend la nouvelle
         règle telle quelle. */
      tache: avant ? { ...tache, serie: avant } : { ...tache, serie: suite ?? nouvelle },
      suite:
        avant && suite
          ? {
              ...tache,
              serie: suite,
              faiteLe: null,
              abandonneeLe: null,
              motifAbandon: null,
            }
          : undefined,
      pointagesOrphelins: [],
      avertissements: avant
        ? []
        : ['La scission tombe avant la première occurrence : toute la série prend la nouvelle règle.'],
    };
  }

  const orphelins = pointagesOrphelins(exceptions, nouvelle, aujourdhui);
  return {
    tache: { ...tache, serie: nouvelle },
    pointagesOrphelins: orphelins,
    avertissements: orphelins.length
      ? [
          `${orphelins.length} occurrence(s) déjà pointée(s) ne feront plus partie de la série. ` +
            'Elles restent dans l’historique ; elles n’y seront plus rattachées.',
        ]
      : [],
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Supprimer, ou plutôt abandonner
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le plan d'un abandon.
 *
 * « Abandonner n'est pas supprimer » : la décision est celle de `modele.ts`,
 * antérieure à ce lot, et elle vaut pour les occurrences comme pour les
 * tâches. Rien n'est effacé — ni la tâche, ni une occurrence pointée.
 *
 * - **cette fois** : une exception « abandonnée », avec son motif.
 * - **celle-ci et les suivantes** : la série s'arrête la veille. Les
 *   occurrences passées restent ce qu'elles étaient.
 * - **toute la série** : la tâche est abandonnée. Le passé pointé reste
 *   pointé — c'est l'inverse de supprimer, et c'est voulu : une série
 *   abandonnée a tout de même été tenue un temps.
 */
export function planifierAbandon(
  tache: Tache,
  jour: string,
  portee: Portee,
  motif: MotifNonFait,
  le: string,
): Plan {
  if (portee === 'cette-fois') {
    return {
      occurrence: {
        tacheId: tache.id,
        jourPrevu: jour,
        etat: 'abandonnee',
        jourPorte: null,
        heure: null,
        le,
        motifAbandon: motif,
      },
      pointagesOrphelins: [],
      avertissements: [],
    };
  }

  if (!tache.serie) {
    return {
      tache: { ...tache, abandonneeLe: jour, motifAbandon: motif },
      pointagesOrphelins: [],
      avertissements: [],
    };
  }

  if (portee === 'celle-ci-et-suivantes') {
    const { avant } = scinderLaSerie(tache.serie, jour);
    if (!avant) {
      /* Rien n'a encore eu lieu : abandonner la suite, c'est abandonner tout. */
      return {
        tache: { ...tache, abandonneeLe: jour, motifAbandon: motif },
        pointagesOrphelins: [],
        avertissements: ['Aucune occurrence n’a encore eu lieu : la série entière est abandonnée.'],
      };
    }
    const suivante = prochaineOccurrence(tache.serie, jour);
    return {
      tache: { ...tache, serie: avant },
      pointagesOrphelins: [],
      avertissements: suivante
        ? [`La série s’arrêtera après le ${decalerJourLogique(jour, -1)}.`]
        : [],
    };
  }

  return {
    tache: { ...tache, abandonneeLe: jour, motifAbandon: motif },
    pointagesOrphelins: [],
    avertissements: [
      'Les occurrences déjà pointées restent dans l’historique : abandonner n’est pas supprimer.',
    ],
  };
}
