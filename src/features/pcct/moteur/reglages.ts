/**
 * Les réglages de PCCT, leurs bornes, et leur validation.
 *
 * ## Les valeurs par défaut sont celles du moteur, et elles le restent
 *
 * La référence porte un défaut qu'il ne faut pas reproduire : ses valeurs
 * par défaut sont `duration: 15`, `startISI: 1500` et `isiMin: 500`, mais son
 * écran affiche « 20 min » et « 3000 ms ». Quelqu'un qui n'a jamais touché un
 * réglage lit donc un nombre, et joue avec un autre.
 *
 * On n'écrit donc les bornes et les défauts qu'ICI, et l'écran les lit. C'est la
 * même règle que la table de bornes du Quad N-Back : une seule source, lue par
 * le balisage ET par le validateur, faute de quoi il y en a deux qui divergent.
 */
import type { Operation, Rythme } from './types';

export interface Reglages {
  /** Durée de la séance, en minutes. */
  duree: number;
  /** Profondeur : l'opération porte sur le nombre d'il y a n positions. */
  n: number;
  /** Intervalle de départ, en millisecondes. */
  intervalleDepart: number;
  /** Plancher de l'intervalle, en millisecondes. */
  intervalleMin: number;
  /** Plafond de l'intervalle, en millisecondes. */
  intervalleMax: number;
  operation: Operation;
  rythme: Rythme;
  /**
   * Pas d'ajustement de la cadence douce, en millisecondes.
   *
   * Nommés par leur EFFET et non par le signe du calcul : accélérer, c'est
   * raccourcir l'intervalle après un essai juste ; ralentir, c'est l'allonger
   * après un essai manqué. La référence appelle les siens « up » et « down »,
   * ce qui ne dit pas de quoi — de la vitesse ou de l'intervalle, qui vont en
   * sens contraires.
   */
  pasAcceleration: number;
  pasRalentissement: number;
  /** Précision visée, en pourcentage, pour le rythme « precision ». */
  precisionCible: number;
  /** Plage des nombres présentés. */
  nombreMin: number;
  nombreMax: number;
  /**
   * La fenêtre du délai de grâce, en millisecondes.
   *
   * SA PLAGE N'EST PAS CONTINUE, et c'est voulu : **zéro éteint l'aide**, et
   * toute autre valeur vaut entre 100 et 2 000 ms. Rien entre 1 et 99, parce
   * qu'une fenêtre de quelques dizaines de millisecondes ne rattrape aucune
   * frappe — elle donnerait une aide allumée qui n'aide jamais, c'est-à-dire
   * exactement le défaut de la référence, obtenu cette fois par le réglage.
   *
   * C'est pourquoi `valeurValide` ne suffit pas ici : elle borne sur un
   * intervalle d'un seul tenant, et ramènerait un zéro à 100 — donc
   * rallumerait une aide qu'on vient d'éteindre. Voir `delaiDeGraceValide`.
   *
   * Le réglage est ici, avec les autres, parce qu'il se valide, se borne et se
   * met par défaut comme eux ; la RÈGLE qu'il commande est dans `grace.ts`.
   */
  delaiDeGrace: number;
  /**
   * L'ordre d'affichage du pavé de réponse.
   *
   * « melange » le remélange À CHAQUE ESSAI — c'est `paveDeLEssai` qui le
   * tient, en semant sur le rang de l'essai. La référence porte le même
   * réglage et ne mélange qu'une fois par séance.
   */
  ordrePave: 'croissant' | 'decroissant' | 'melange';
  /** Mémoire prospective. */
  prospectiveActive: boolean;
  /** Fenêtre de réponse d'une consigne, en millisecondes. */
  prospectiveFenetre: number;
  /** Nombre maximal de consignes en attente. */
  prospectiveEnAttente: number;
  /** Horizon maximal d'une consigne, en millisecondes. */
  prospectiveHorizon: number;
  /** Durée d'affichage de la consigne, en millisecondes. */
  prospectiveAffichage: number;
  /**
   * Les opérations entre lesquelles le changement de règle alterne.
   *
   * Le MODULE est de L3 ; le RÉGLAGE est ici, avec les autres, parce qu'il se
   * valide, se met par défaut et se copie comme eux. Et parce qu'une garde sur
   * la copie en profondeur ne se tient pas sans un sous-objet : c'est un
   * sabotage qui me l'a dit, en passant au vert sur un objet entièrement plat
   * où une copie superficielle et une copie profonde sont indiscernables. Le
   * défaut de la référence, lui, ne mord que sur ses réglages imbriqués.
   */
  operationsCommutees: Record<Operation, boolean>;

  /* ── Les quatre modules facultatifs (L3) ──────────────────────────────── */

  /**
   * L'inhibition : certains essais portent un signal, et il ne faut pas
   * répondre mais presser « Retenir ».
   */
  inhibitionActive: boolean;
  /** Part des essais qui portent le signal, en pourcentage. */
  inhibitionFrequence: number;
  /** NDM : dire si le NOMBRE est plus petit, égal ou plus grand que le précédent. */
  ndmActif: boolean;
  /** SDM : la même chose sur le RÉSULTAT ATTENDU. */
  sdmActif: boolean;
  /**
   * Le changement de règle, **marqué « expérimental »** à l'écran.
   *
   * Expérimental au sens propre : les opérations entre lesquelles il alterne
   * sont celles d'`operationsCommutees`, et rien n'a encore établi qu'alterner
   * entre quatre reste lisible. Le marquer le dit à qui l'allume plutôt que de
   * le lui laisser découvrir.
   */
  changementDeRegleActif: boolean;
  /** Nombre d'essais par bloc avant que la règle change. */
  changementDeRegleBloc: number;
}

/**
 * Les bornes, lues par l'écran comme par le validateur.
 *
 * `pas` sert à la fois au curseur et à la remise sur grille : une valeur
 * enregistrée hors grille revient au cran le plus proche au lieu d'être rejetée.
 */
export const BORNES = {
  duree: { min: 1, max: 60, pas: 1 },
  n: { min: 1, max: 5, pas: 1 },
  intervalleDepart: { min: 50, max: 6000, pas: 50 },
  intervalleMin: { min: 50, max: 6000, pas: 50 },
  intervalleMax: { min: 50, max: 6000, pas: 50 },
  pasAcceleration: { min: 5, max: 200, pas: 5 },
  pasRalentissement: { min: 5, max: 200, pas: 5 },
  precisionCible: { min: 50, max: 99, pas: 1 },
  nombreMin: { min: 0, max: 99, pas: 1 },
  nombreMax: { min: 1, max: 99, pas: 1 },
  /*
     LA PLAGE DU DÉLAI DE GRÂCE est celle des valeurs NON NULLES : zéro est un
     cas à part, traité par `delaiDeGraceValide`. L'écran lit ces bornes pour
     son curseur, et pose l'extinction par une case à cocher — un curseur qui
     descendrait à zéro mettrait l'éteint et le plus court au même bout, et
     personne ne saurait lequel il vient de choisir.
  */
  delaiDeGrace: { min: 100, max: 2000, pas: 50 },
  prospectiveFenetre: { min: 500, max: 10000, pas: 100 },
  prospectiveEnAttente: { min: 1, max: 5, pas: 1 },
  prospectiveHorizon: { min: 10000, max: 180000, pas: 1000 },
  prospectiveAffichage: { min: 1000, max: 20000, pas: 500 },
  inhibitionFrequence: { min: 5, max: 50, pas: 5 },
  /*
     AU MOINS DEUX ESSAIS PAR BLOC. Un bloc d'un seul essai ferait changer la
     règle à chaque nombre : ce n'est plus une bascule de règle, c'est la
     lecture d'un signal, et le module mesurerait autre chose que son nom.
  */
  changementDeRegleBloc: { min: 2, max: 40, pas: 1 },
} as const;

/**
 * Les valeurs de la référence, reprises telles quelles quand elles tiennent.
 *
 * Gelé EN PROFONDEUR : `Object.freeze` ne gèle que le premier niveau, et le
 * sous-objet des opérations commutées resterait modifiable — c'est-à-dire que
 * le piège de la copie superficielle resterait ouvert là où il mord.
 */
export const DEFAUTS: Readonly<Reglages> = Object.freeze({
  duree: 15,
  n: 1,
  intervalleDepart: 1500,
  intervalleMin: 50,
  intervalleMax: 6000,
  operation: 'somme',
  rythme: 'standard',
  pasAcceleration: 20,
  pasRalentissement: 20,
  precisionCible: 85,
  nombreMin: 1,
  nombreMax: 9,
  /*
     Trois cents millisecondes, et c'est MON choix, non une valeur relevée dans
     la référence — dont la fenêtre existe mais ne sert jamais, de sorte
     qu'aucune valeur n'y a été éprouvée. Trois cents est le temps d'un doigt
     qui descend : assez pour rattraper une frappe partie trop tard, trop court
     pour qu'on puisse répondre deux fois au même nombre. À reprendre si
     l'usage le démentait.
  */
  delaiDeGrace: 300,
  ordrePave: 'melange',
  prospectiveActive: true,
  prospectiveFenetre: 3000,
  prospectiveEnAttente: 2,
  prospectiveHorizon: 60000,
  prospectiveAffichage: 6500,
  /* Somme et différence, comme la référence : deux opérations suffisent à faire
     du changement de règle une épreuve, et quatre la rendent illisible. */
  operationsCommutees: { somme: true, difference: true, produit: false, quotient: false },
  /* LES QUATRE MODULES SONT ÉTEINTS PAR DÉFAUT. Ils sont facultatifs, et
     chacun ajoute une tâche à une épreuve qui en porte déjà deux. Qui les
     allume le fait exprès. */
  inhibitionActive: false,
  inhibitionFrequence: 20,
  ndmActif: false,
  sdmActif: false,
  changementDeRegleActif: false,
  changementDeRegleBloc: 10,
});
Object.freeze(DEFAUTS.operationsCommutees);

/**
 * Une copie neuve des défauts, EN PROFONDEUR.
 *
 * La référence rend ici une copie superficielle, de sorte que « réglages par
 * défaut » rend un objet dont les sous-objets sont partagés avec la table :
 * le premier réglage modifié après un retour aux défauts corrompt les défauts
 * eux-mêmes, et plus rien ne les rétablit jusqu'au rechargement.
 *
 * `DEFAUTS` est gelé, ce qui ferait lever l'écriture en mode strict au lieu de
 * la laisser passer en silence — mais une erreur levée au mauvais moment reste
 * un défaut. On rend donc une copie, et le gel n'est qu'un garde-fou de plus.
 */
export function reglagesParDefaut(): Reglages {
  return structuredClone(DEFAUTS) as Reglages;
}

const nombreFini = (valeur: unknown): valeur is number =>
  typeof valeur === 'number' && Number.isFinite(valeur);

/**
 * Ramène une valeur dans ses bornes et sur sa grille.
 *
 * `typeof` et non `Number()` : `Number(null)`, `Number('')` et `Number([])`
 * valent tous zéro, de sorte qu'une valeur qui n'est PAS un nombre prendrait le
 * minimum au lieu de retrouver son défaut. La leçon vient du Quad N-Back.
 */
export function valeurValide(
  brut: unknown,
  bornes: { min: number; max: number; pas: number },
  defaut: number,
): number {
  if (!nombreFini(brut)) return defaut;
  const bornee = Math.min(bornes.max, Math.max(bornes.min, brut));
  const crans = Math.round((bornee - bornes.min) / bornes.pas);
  const surGrille = bornes.min + crans * bornes.pas;
  return surGrille > bornes.max ? bornes.min + (crans - 1) * bornes.pas : surGrille;
}

/**
 * Valide le délai de grâce, dont la plage n'est PAS d'un seul tenant.
 *
 * Zéro éteint l'aide et doit survivre tel quel ; toute autre valeur vaut entre
 * 100 et 2 000 ms. `valeurValide` seule ramènerait un zéro au minimum de la
 * plage — donc RALLUMERAIT une aide qu'on vient d'éteindre, en silence, et le
 * réglage ne pourrait plus jamais être mis à zéro.
 *
 * Une valeur entre 1 et 99 remonte à 100 plutôt que de retomber à zéro : elle
 * dit qu'on VEUT l'aide, et la plus courte fenêtre utile est 100. Retomber à
 * zéro interpréterait « un peu » comme « pas du tout ».
 */
export function delaiDeGraceValide(brut: unknown): number {
  if (brut === 0) return 0;
  if (!nombreFini(brut)) return DEFAUTS.delaiDeGrace;
  if (brut < 0) return 0;
  return valeurValide(brut, BORNES.delaiDeGrace, DEFAUTS.delaiDeGrace);
}
