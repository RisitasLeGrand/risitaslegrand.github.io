/**
 * À qui un repère sourcé s'applique, et comment on le dit sans le deviner.
 *
 * ## Le moteur ne demande aucune source, les valeurs en demandent une
 *
 * Le § 3.3 du prompt veut qu'un repère sourcé porte la population que sa
 * source vise, et qu'un écran sache dire « ce repère ne vous concerne pas »
 * plutôt que de l'afficher comme s'il concernait tout le monde. Le
 * **mécanisme** de ce jugement ne coûte aucune source : il compare une
 * population déclarée à ce que le registre consent à dire de la personne.
 * Les **valeurs**, elles, sont dans les documents — et aucun n'est
 * atteignable depuis ce conteneur.
 *
 * Ce module est donc livré **à vide**, délibérément : tous les repères du
 * dépôt rendent `indeterminable`, et `essais:population` l'affirme
 * nommément. Le jour où une population est lue dans un document, c'est cet
 * essai qui change — c'est-à-dire que le changement sera un geste et non un
 * effet de bord.
 *
 * ## Trois verdicts, et le troisième n'est pas un échec
 *
 * `applicable` et `non_applicable` sont des jugements. `indeterminable` est
 * une absence, et c'est le **défaut** : ne rien savoir ne vaut jamais
 * « applicable ». C'est la même règle que `ValeurSourcee` dans Santé — on ne
 * peut pas construire une valeur sans dire d'où elle vient — et que les
 * quatre états de `etatDUsage` dans le registre, où « coupé », « inconnu
 * faute de donnée » et « en attente d'une source » ne se confondent pas.
 *
 * Et `indeterminable` porte **pourquoi**, parce que deux causes très
 * différentes y mènent : la source ne dit pas qui elle vise, ou la personne
 * n'a pas déclaré ce qu'il faudrait pour trancher. La première est une
 * limite du document, la seconde une question qu'on peut poser.
 *
 * ## Pourquoi ce module ne voit jamais l'âge
 *
 * Il reçoit un `Contexte`, c'est-à-dire ce que `contextePersonne()` a bien
 * voulu rendre : une **tranche**, pas une date de naissance ; un booléen de
 * majorité, pas un âge. Le prompt l'écrit ainsi — « reçoit un booléen, pas
 * l'âge » — et l'essai sur le graphe d'imports interdit à ce fichier de
 * nommer les champs bruts. Comparer des bornes d'âge y est donc impossible
 * par construction, et non par discipline.
 *
 * La conséquence est une limite qu'il faut dire : une population exprimée en
 * tranches ne peut être jugée que si le consommateur lit `tranche_age` et
 * que ses bornes produisent les mêmes étiquettes. Quand ce n'est pas le cas,
 * le verdict est `indeterminable` et il le dit.
 */
import type { Contexte, SexePhysio } from './registre-usages';

/* ══════════════════════════════════════════════════════════════════════════
   La population visée
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'une source dit de la population qu'elle vise.
 *
 * Les trois critères sont tous facultatifs, et un critère absent **ne
 * restreint rien** — une source qui ne parle pas de sexe vise les deux. Un
 * critère présent, en revanche, doit pouvoir être tranché : s'il ne peut pas
 * l'être, le verdict est `indeterminable` et non `applicable`.
 */
export interface CriteresDePopulation {
  /** Les étiquettes de tranche que la source couvre, dans le vocabulaire du consommateur. */
  tranches?: readonly string[];
  /** Les sexes physiologiques que la source couvre. */
  sexes?: readonly SexePhysio[];
  /** La source ne vaut que pour les personnes majeures. */
  majeurSeulement?: boolean;
}

/**
 * Une population, ou l'absence déclarée de population.
 *
 * Union et non objet à champs facultatifs, pour la raison qui a fait
 * `ValeurSourcee` : avec `{ criteres?, source? }`, on peut écrire des
 * critères sans source, et rien ne s'en aperçoit avant l'écran. Ici le
 * compilateur refuse.
 *
 * `ValeurSourcee` n'est pas réutilisée telle quelle : elle vit dans
 * `odyssee/sante.ts`, et l'importer depuis le noyau inverserait la
 * dépendance — Psyché devrait alors passer par Santé pour afficher un palier.
 * Le jour où elle montera dans le noyau, les deux unions se rejoindront ;
 * c'est un déplacement de fichier partagé, pas le travail de ce lot.
 */
export type PopulationVisee =
  | { readonly declaree: true; criteres: CriteresDePopulation; dit: string }
  | { readonly declaree: false; pourquoi: string };

/** Une population lue dans un document, avec la phrase qui la dit. */
export const populationLue = (criteres: CriteresDePopulation, dit: string): PopulationVisee => ({
  declaree: true,
  criteres,
  dit,
});

/** Aucune population lue. `pourquoi` est affichable. */
export const populationNonLue = (pourquoi: string): PopulationVisee => ({
  declaree: false,
  pourquoi,
});

/* ══════════════════════════════════════════════════════════════════════════
   Le verdict
   ══════════════════════════════════════════════════════════════════════════ */

export type Verdict = 'applicable' | 'non_applicable' | 'indeterminable';

export interface Applicabilite {
  verdict: Verdict;
  /**
   * La raison, en français, affichable telle quelle.
   *
   * Vide pour `applicable` : il n'y a rien à dire quand un repère s'applique,
   * et une phrase inventée pour remplir le champ serait du bruit.
   */
  pourquoi: string;
}

const A: Applicabilite = { verdict: 'applicable', pourquoi: '' };
const non = (pourquoi: string): Applicabilite => ({ verdict: 'non_applicable', pourquoi });
const indetermine = (pourquoi: string): Applicabilite => ({
  verdict: 'indeterminable',
  pourquoi,
});

/** « a », « a et b », « a, b et c » — jamais « a, b, c ». */
const liste = (mots: readonly string[]): string =>
  mots.length <= 1
    ? (mots[0] ?? '')
    : `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1]}`;

/**
 * Ce repère concerne-t-il cette personne ?
 *
 * L'ordre des contrôles n'est pas indifférent : `non_applicable` l'emporte
 * sur `indeterminable`. Si un critère tranche contre et un autre manque, la
 * personne est hors de la population — en dire « on ne sait pas » serait
 * moins vrai, et laisserait croire qu'une réponse de plus pourrait rendre le
 * repère applicable.
 */
export function applicabilite(
  population: PopulationVisee,
  contexte: Contexte,
): Applicabilite {
  if (!population.declaree) {
    return indetermine(
      `Cyclades ne sait pas à qui ce repère s’applique : ${population.pourquoi}`,
    );
  }

  const { tranches, sexes, majeurSeulement } = population.criteres;
  const manquants: string[] = [];

  if (majeurSeulement) {
    if (contexte.majeur === 'non') return non('Ce repère ne vaut que pour les personnes majeures.');
    if (contexte.majeur !== 'oui') manquants.push('votre majorité');
  }

  if (sexes && sexes.length) {
    const s = contexte.sexe_physio;
    if (s !== undefined && s !== 'inconnu' && !sexes.includes(s)) {
      return non('La source de ce repère ne porte pas sur votre sexe déclaré.');
    }
    if (s === undefined || s === 'inconnu') manquants.push('votre sexe');
  }

  if (tranches && tranches.length) {
    const t = contexte.tranche_age;
    if (t !== undefined && t !== 'inconnu' && !tranches.includes(t)) {
      return non('La source de ce repère ne porte pas sur votre tranche d’âge.');
    }
    if (t === undefined || t === 'inconnu') manquants.push('votre tranche d’âge');
  }

  if (manquants.length) {
    return indetermine(
      `Ce repère vise une population précise, et Cyclades ne connaît pas ${liste(manquants)}.`,
    );
  }
  return A;
}

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une population déclarée est-elle cohérente avec elle-même ?
 *
 * Deux pièges, tous deux muets. Des critères vides avec une source : la
 * population dit « tout le monde » sans le dire, et le verdict sera toujours
 * `applicable`. Et une phrase de source vide : le repère prétend savoir qui
 * il vise sans pouvoir le citer.
 */
export function controlerPopulation(p: PopulationVisee, ou: string): string[] {
  const problemes: string[] = [];
  if (!p.declaree) {
    if (!p.pourquoi.trim()) problemes.push(`${ou} : aucune population, et aucune raison donnée.`);
    return problemes;
  }
  if (!p.dit.trim()) {
    problemes.push(`${ou} : une population déclarée sans la phrase de la source qui la dit.`);
  }
  const { tranches, sexes, majeurSeulement } = p.criteres;
  if (!tranches?.length && !sexes?.length && !majeurSeulement) {
    problemes.push(
      `${ou} : une population déclarée sans aucun critère. Une source qui vise tout le monde ` +
        'se déclare non lue, pas universelle — sinon le verdict est « applicable » par défaut.',
    );
  }
  return problemes;
}
