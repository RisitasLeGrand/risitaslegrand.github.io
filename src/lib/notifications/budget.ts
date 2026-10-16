/**
 * Le budget d'attention du panneau — prompt 32, § 3.3.
 *
 * ## Ce qui est plafonné, et ce qui ne l'est pas
 *
 * Le plafond porte sur le nombre d'éléments **nouveaux du jour affichés
 * un par un**. Au-delà, les suivants deviennent une ligne « et 4 autres ».
 * Rien n'est caché, rien n'est supprimé : ce qui est plafonné, c'est le
 * nombre de choses qui réclament un regard séparé.
 *
 * Deux exceptions, et elles ne sont pas des réglages.
 *
 * - **§ 1 n° 8** — une question à trancher n'est jamais regroupée. La
 *   noyer dans « et 4 autres » reviendrait à la faire taire sans la
 *   résoudre, ce que l'interdit vise précisément.
 * - **§ 1 n° 7** — urgence et détresse ne sont « jamais regroupés,
 *   différés, résumés ni comptés dans un plafond ».
 *
 * ## Pourquoi `SOURCES_HORS_PLAFOND` existe alors qu'elle est vide
 *
 * Aucune source d'urgence n'est déclarée au centre aujourd'hui : le § 1
 * n° 7 veut que ces messages restent « immédiats dans leur écran
 * d'origine », donc hors du centre. L'exception n'a donc, à ce jour,
 * rien à excepter.
 *
 * La liste existe quand même, et c'est la leçon d'A-17 : une interdiction
 * écrite en prose et gardée par rien n'est pas une interdiction. Le jour
 * où un lot déclarera une source d'urgence, soit il l'inscrira ici, soit
 * le regroupement l'avalera — et personne ne s'en apercevra, puisque le
 * cas ne se produira qu'un jour de détresse.
 *
 * Elle est **testée vide et testée pleine** : le contrôle y met une
 * source de son cru et vérifie qu'elle échappe au plafond.
 *
 * ## Le chiffre : cinq
 *
 * Décision 4 : « bas, environ 5 », à justifier comme règle de produit.
 * Cinq, et la justification tient à ce que le panneau est une liste qu'on
 * parcourt debout, souvent sur un téléphone. Au-delà de cinq entrées
 * nouvelles, on ne lit plus : on fait défiler, puis on referme. Un
 * sixième élément affiché séparément ne gagne rien sur « et 2 autres »,
 * et il coûte la lisibilité des cinq premiers.
 *
 * Le même chiffre que le plafond des notifications du système, et ce
 * n'est pas une coïncidence qu'on partage : ce sont deux règles
 * distinctes — l'une borne les interruptions, l'autre la longueur d'une
 * liste — qui se trouvent tomber sur la même valeur pour des raisons
 * différentes. Les lier par une constante commune ferait croire qu'il n'y
 * en a qu'une, et changer l'une changerait l'autre par surprise.
 */
import type { ElementDuCentre } from './modele';

/** Le plafond d'éléments nouveaux affichés séparément. Voir l'en-tête. */
export const PLAFOND_QUOTIDIEN = 5;

/**
 * Les sources que le § 1 n° 7 met hors de tout plafond.
 *
 * **Vide aujourd'hui, et ce n'est pas un oubli** : aucune source
 * d'urgence n'est déclarée au centre. Voir l'en-tête pour ce que cette
 * liste empêche.
 */
export const SOURCES_HORS_PLAFOND: readonly string[] = [];

export interface Regroupement {
  /** La source dont les éléments sont repliés. */
  source: string;
  /** Combien sont repliés derrière la ligne « et N autres ». */
  combien: number;
}

export interface BudgetApplique {
  /** Ce qui s'affiche un par un, dans l'ordre reçu. */
  montres: ElementDuCentre[];
  /** Les lignes « et N autres », une par source concernée. */
  regroupes: Regroupement[];
}

export interface ReglagesDuBudget {
  plafond?: number;
  /**
   * Le « résumé du jour » du § 3.3 : tout s'affiche, rien n'est replié.
   *
   * C'est une option et non le défaut, parce qu'un panneau qui déroule
   * quinze lignes le jour où quinze choses arrivent est précisément ce
   * que le budget d'attention cherche à éviter.
   */
  resumeDuJour?: boolean;
}

/**
 * Applique le budget d'attention à une liste déjà triée et déjà filtrée.
 *
 * **Ne trie pas et ne filtre pas** : l'ordre reçu est celui qui sera
 * affiché, et c'est au panneau de l'avoir décidé. Une fonction qui
 * trierait aussi déciderait de deux choses à la fois, et le jour où
 * l'ordre change il faudrait y penser à deux endroits.
 *
 * Est **pure** : aucun accès au magasin, aucune horloge. Le jour est un
 * argument, parce qu'un plafond « quotidien » calculé sur `new Date()`
 * serait intestable aux limites — et la limite est précisément 4 h, le
 * jour logique du projet.
 */
export function appliquerLeBudget(
  elements: readonly ElementDuCentre[],
  jour: string,
  reglages: ReglagesDuBudget = {},
): BudgetApplique {
  const plafond = reglages.plafond ?? PLAFOND_QUOTIDIEN;
  if (reglages.resumeDuJour) return { montres: [...elements], regroupes: [] };

  const montres: ElementDuCentre[] = [];
  const comptes = new Map<string, number>();
  let nouveauxMontres = 0;

  for (const element of elements) {
    /*
       Les deux exceptions d'abord, et jamais comptées dans le plafond :
       le § 1 n° 7 dit « ni comptés », pas seulement « ni regroupés ». Les
       compter sans les replier ferait disparaître un élément ordinaire à
       leur place, ce qui revient au même pour celui qui disparaît.
    */
    if (element.genre === 'a-trancher' || SOURCES_HORS_PLAFOND.includes(element.source)) {
      montres.push(element);
      continue;
    }
    /* Ce qui n'est pas de ce jour n'est pas nouveau : déjà vu, déjà compté. */
    if (element.creeLe !== jour) {
      montres.push(element);
      continue;
    }
    if (nouveauxMontres < plafond) {
      montres.push(element);
      nouveauxMontres += 1;
      continue;
    }
    comptes.set(element.source, (comptes.get(element.source) ?? 0) + 1);
  }

  return {
    montres,
    regroupes: [...comptes].map(([source, combien]) => ({ source, combien })),
  };
}

/** « et 4 autres », au singulier quand il n'y en a qu'un. */
export const libelleDuRegroupement = (combien: number): string =>
  combien === 1 ? 'et 1 autre' : `et ${combien} autres`;
