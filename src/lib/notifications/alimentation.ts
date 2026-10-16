/**
 * Ce qui alimente le centre — prompt 32, phase 2.
 *
 * ## Deux sources, et pas douze
 *
 * Le plan de la phase 2 le dit : « branchés **d'abord** sur les avis de
 * fusion et les questions à trancher, puis sur les autres sources une par
 * une ». Brancher les douze d'un coup aurait produit un panneau qu'aucun
 * essai ne couvre, et douze occasions de laisser passer du contenu là où
 * le § 2.3 n'en veut pas.
 *
 * Les dix autres sont **nommées dans `sources.ts`** et absentes ici : un
 * registre de routage complet et une alimentation partielle, c'est ce qui
 * permet de dire exactement ce qui est branché, et de le vérifier.
 *
 * ## Le recensement est idempotent, parce qu'il tourne à chaque page
 *
 * `recenser()` s'appelle au chargement de n'importe quel écran de branche.
 * Un conflit encore ouvert au troisième chargement ne doit pas produire
 * trois éléments : l'identifiant dérive de `source + refSource`
 * (`idDeLElement`), donc le même conflit rend toujours la même clé, et le
 * `put` écrase au lieu d'empiler. C'est la raison d'être de l'empreinte
 * déterministe, et c'est ici qu'elle sert.
 *
 * ## Un conflit refermé retire son élément
 *
 * Le § 1 n° 8 dit qu'une question quitte le compteur **à la résolution de
 * sa source**. C'est donc ici, et nulle part ailleurs, que la sortie se
 * fait : le recensement compare les conflits ouverts aux éléments présents
 * et supprime ceux qui n'ont plus de conflit. Sans cette moitié, le § 1
 * n° 8 ferait du centre une liste qui ne décroît jamais — et un compteur
 * qui ne redescend pas finit par ne plus être lu.
 */
import { jourLogique } from '../noyau/jour-logique';
import {
  aTrancherLisibles,
  centreLisible,
  deposer,
  oublier,
  type Depot,
} from './donnees';
import { idDeLElement, type ElementDuCentre } from './modele';

/** La source des conflits de synchronisation et des désaccords de branche. */
export const SOURCE_CONFLITS = 'question-a-trancher';
/** La source des fusions automatiques réussies. */
export const SOURCE_FUSION = 'avis-de-fusion';

export interface Recensement {
  /** Les éléments créés ou rafraîchis. */
  deposes: number;
  /** Les éléments retirés parce que leur conflit est tranché. */
  retires: number;
  /** Pourquoi rien n'a été fait, le cas échéant. */
  silence: 'coffre-ferme' | null;
}

/**
 * Recense les questions à trancher, et retire celles qui ne le sont plus.
 *
 * **Coffre fermé, ne fait rien.** Écrire demande de sceller, donc une clé.
 * Un recensement qui échouerait à moitié laisserait le magasin en désaccord
 * avec les conflits réels, et le § 3.2 n'attend de toute façon rien du
 * centre coffre fermé — pas même une mise à jour silencieuse.
 */
export async function recenser(
  conflitsOuverts: readonly { type: string; cible: string }[],
): Promise<Recensement> {
  if (!centreLisible()) return { deposes: 0, retires: 0, silence: 'coffre-ferme' };

  const jour = jourLogique();
  const attendus = new Map<string, ElementDuCentre>();
  for (const conflit of conflitsOuverts) {
    /*
       La référence est `type:cible`, et c'est ce que l'écran des conflits
       sait retrouver. Elle ne porte aucune valeur en désaccord — seulement
       de quoi la rechercher là où le coffre est déjà ouvert.
    */
    const refSource = `${conflit.type}:${conflit.cible}`;
    const id = await idDeLElement(SOURCE_CONFLITS, refSource);
    attendus.set(id, {
      id,
      source: SOURCE_CONFLITS,
      refSource,
      genre: 'a-trancher',
      creeLe: jour,
      etat: 'non_lu',
      /*
         Pas de regroupement : chaque question se tranche séparément, et
         « 3 questions » cacherait qu'il y en a une de plus qu'hier. Le § 3.3
         exclut d'ailleurs explicitement le § 1 n° 8 du budget d'attention.
      */
      regroupement: null,
    });
  }

  let deposes = 0;
  for (const element of attendus.values()) {
    /*
       Le `creeLe` du premier dépôt doit survivre : la rétention s'y réfère,
       et un conflit vieux de trois mois qui se redaterait à chaque page ne
       vieillirait jamais. (Il n'est pas purgé pour autant — § 1 n° 8 —,
       mais l'ancienneté est ce qui le fait remonter dans la liste.)
    */
    const dejaLa = (await aTrancherLisibles()).find((e) => e.id === element.id);
    const resultat: Depot = await deposer(dejaLa ? { ...element, creeLe: dejaLa.creeLe, etat: dejaLa.etat } : element);
    if (resultat.quoi === 'depose') deposes += 1;
  }

  let retires = 0;
  for (const present of await aTrancherLisibles()) {
    if (present.source !== SOURCE_CONFLITS) continue;
    if (attendus.has(present.id)) continue;
    await oublier(present.id);
    retires += 1;
  }

  return { deposes, retires, silence: null };
}

/**
 * Dépose l'avis d'une fusion automatique.
 *
 * **Sans aucun nombre**, et c'est la décision 5 : « Reçu : 1 opération »
 * dit qu'une saisie a eu lieu sur l'autre appareil, et une saisie unique
 * un soir donné en dit déjà beaucoup. Le centre ne porte de toute façon
 * pas de texte (§ 2.3) ; ce qui compte ici est que la **référence** n'en
 * porte pas non plus — elle nomme le lot, pas son volume.
 *
 * Genre `a-savoir` : une fusion est une information, pas une question. Elle
 * ne compte donc pas dans la pastille, s'archive et se purge normalement.
 */
export async function signalerUneFusion(lot: string): Promise<Depot> {
  const refSource = `lot:${lot}`;
  return deposer({
    id: await idDeLElement(SOURCE_FUSION, refSource),
    source: SOURCE_FUSION,
    refSource,
    genre: 'a-savoir',
    creeLe: jourLogique(),
    etat: 'non_lu',
    /*
       Regroupées : trois synchronisations dans la journée sont un fait, pas
       trois. C'est exactement le cas que le § 3.3 vise par « et 4 autres ».
    */
    regroupement: SOURCE_FUSION,
  });
}
