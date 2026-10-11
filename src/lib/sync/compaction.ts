/**
 * La compaction : effacer ce qui ne sert plus, sans effacer ce qui sert.
 *
 * Le journal garde tout, et c'est sa qualité première : c'est lui la vérité,
 * l'état dérivé n'en est qu'un résumé. Mais il garde aussi les faits d'objets
 * **supprimés**, et leurs pierres tombales, pour toujours. La compaction est la
 * seule opération du chantier qui retire des entrées de journal. Elle est donc
 * écrite avec la même méfiance que la fusion, et pour la même raison : la base
 * est la seule copie.
 *
 * ## Ce qu'elle efface, et rien d'autre
 *
 * Les faits d'une cible **supprimée**, et la pierre tombale elle-même. Rien
 * d'autre. En particulier :
 *
 * - **jamais les révisions d'une carte vivante.** Résumer un journal de carte
 *   vivante voudrait dire fabriquer un socle, et deux appareils qui compactent
 *   chacun de leur côté fabriqueraient deux socles pour la même carte — ce que
 *   la décision 4 nomme irréconciliable, et ce que `premiere-fusion.ts` refuse.
 *   La compaction serait alors le mécanisme qui rend deux bases infusionnables,
 *   ce qui est exactement l'inverse de son office ;
 * - **jamais une opération de compaction**, qui est le seul souvenir de ce qui
 *   a été effacé ;
 * - **jamais une cible dont une opération dépasse la borne.** On la reporte
 *   entière : effacer sa pierre tombale en laissant une opération plus récente
 *   que la borne ferait ressusciter l'objet, puisque le périmètre du compactage
 *   s'arrête à la borne.
 *
 * ## Pourquoi un compactage est un fait, et non une décision locale
 *
 * La tentation est d'en faire un ménage local : chaque appareil efface ce dont
 * il n'a plus besoin. Elle ne tient pas une seconde d'examen. L'empreinte
 * d'état porte sur la liste des identifiants du journal : un appareil qui
 * compacte seul cesse d'être « identique ✓ » à l'autre **définitivement**, et
 * chaque rencontre lui renvoie ce qu'il vient d'effacer.
 *
 * Le compactage est donc journalisé comme n'importe quel fait : il voyage, et
 * l'autre appareil l'applique à son tour. Il porte la **liste des cibles**
 * effacées et non seulement sa borne, et ce détail est la pièce qui rend le
 * procédé sûr : la pierre tombale disparaissant avec les faits qu'elle cachait,
 * c'est le compactage qui se souvient que cette cible est supprimée. Sans cette
 * liste, un appareil en retard renverrait un fait dont plus personne ne sait
 * qu'il concerne un objet effacé, et l'objet reviendrait à la vie.
 *
 * ## La borne, et l'appareil en retard
 *
 * La borne est la plus petite borne **accusée** par les appareils du registre :
 * ce qu'ils ont vu de nous, et non ce qu'on leur a envoyé — un paquet déposé
 * dans un dossier partagé peut n'avoir jamais été ouvert. Un appareil qui n'a
 * jamais rien accusé n'a pas de borne : la compaction est alors refusée, et
 * l'écran le dit en le nommant. C'est la règle du plan,
 * § 1.5 — une pierre tombale ne s'efface qu'une fois que tous les appareils du
 * registre l'ont vue — et c'est aussi la seule honnête : un appareil resté un
 * mois hors ligne n'est pas un appareil disparu.
 */
import { TYPE_SUPPRESSION } from '../noyau/fusion';
import type { Journalisable, Operation } from '../noyau/operations';

/** Le type de fait qui déclare un compactage. Il ne s'efface jamais. */
export const TYPE_COMPACTION = 'compaction';

/** La cible d'une opération de compaction : le journal lui-même. */
export const CIBLE_COMPACTION = 'journal';

export interface Compactage {
  /** La borne d'horloge : au-delà, le compactage ne couvre rien. */
  jusqua: string;
  /** Les cibles supprimées que ce compactage a effacées. */
  cibles: readonly string[];
}

/** Les compactages déclarés par n'importe quel appareil. */
export function compactagesDeclares(operations: Iterable<Operation>): Compactage[] {
  const sortie: Compactage[] = [];
  for (const op of operations) {
    if (op.type !== TYPE_COMPACTION) continue;
    const charge = op.charge as { jusqua?: unknown; cibles?: unknown };
    const jusqua = typeof charge?.jusqua === 'string' ? charge.jusqua : '';
    const cibles = Array.isArray(charge?.cibles)
      ? charge.cibles.filter((c): c is string => typeof c === 'string')
      : [];
    if (jusqua) sortie.push({ jusqua, cibles });
  }
  return sortie.sort((a, b) => (a.jusqua < b.jusqua ? -1 : a.jusqua > b.jusqua ? 1 : 0));
}

/**
 * Le périmètre réuni de plusieurs compactages : pour chaque cible, la borne la
 * plus haute qui la couvre.
 *
 * Deux appareils peuvent compacter chacun de leur côté, avec deux bornes et
 * deux listes qui se recoupent. L'union est la bonne réponse, et elle est
 * commutative, associative et idempotente comme le reste du modèle : la plus
 * haute borne par cible ne dépend pas de l'ordre de lecture.
 */
export function perimetre(compactages: Iterable<Compactage>): Map<string, string> {
  const sortie = new Map<string, string>();
  for (const { jusqua, cibles } of compactages) {
    for (const cible of cibles) {
      const connue = sortie.get(cible);
      if (!connue || connue < jusqua) sortie.set(cible, jusqua);
    }
  }
  return sortie;
}

/** Une entrée est-elle couverte par un périmètre de compactage ? */
export function couverte(
  entree: { type?: string; hlc: string },
  cible: string,
  perimetre: Map<string, string>,
): boolean {
  if (entree.type === TYPE_COMPACTION) return false;
  const borne = perimetre.get(cible);
  return borne !== undefined && entree.hlc <= borne;
}

/**
 * Retire d'un journal ce qu'un périmètre couvre.
 *
 * C'est la fonction à rejouer **après chaque fusion** : un appareil en retard
 * renvoie ce qu'il n'a pas encore vu effacer, et il n'y a pas d'autre moyen de
 * l'en empêcher que de le réeffacer. L'opération est idempotente, donc la
 * rejouer ne coûte qu'une lecture quand il n'y a rien à faire.
 */
export function horsPerimetre<T extends Journalisable>(
  entrees: readonly T[],
  perimetre: Map<string, string>,
  cibleDe: (entree: T) => string,
): { gardees: T[]; retirees: T[] } {
  if (perimetre.size === 0) return { gardees: [...entrees], retirees: [] };
  const gardees: T[] = [];
  const retirees: T[] = [];
  for (const entree of entrees) {
    if (couverte(entree as { type?: string; hlc: string }, cibleDe(entree), perimetre)) {
      retirees.push(entree);
    } else {
      gardees.push(entree);
    }
  }
  return { gardees, retirees };
}

/* ══════════════════════════════════════════════════════════════════════════
   La borne partagée
   ══════════════════════════════════════════════════════════════════════════ */

/** Ce que la borne a besoin de savoir d'un appareil, et rien de plus. */
export interface AppareilBornable {
  id: string;
  nom?: string;
  soi: boolean;
  /** Jusqu'où il a accusé réception de notre journal. */
  reconnuJusqua?: string;
}

export type Borne =
  | { possible: true; jusqua: string; seul: boolean }
  | { possible: false; motif: 'appareil-jamais-vu'; attendus: readonly string[] };

/**
 * La plus petite borne reconnue par tous les appareils du registre.
 *
 * Seul au registre, la borne est l'horloge courante : il n'y a personne à
 * attendre, et le cas est fréquent — un appareil unique accumule des pierres
 * tombales comme un autre. Un appareil connu qui n'a jamais accusé réception
 * interdit la compaction, et c'est dit en le nommant : « jamais vu » n'est pas
 * « disparu », et c'est exactement le cas de l'appareil en retard.
 */
export function bornePartagee(
  appareils: readonly AppareilBornable[],
  horloge: string,
): Borne {
  const autres = appareils.filter((a) => !a.soi);
  if (autres.length === 0) return { possible: true, jusqua: horloge, seul: true };

  const attendus = autres
    .filter((a) => !a.reconnuJusqua)
    .map((a) => a.nom ?? a.id)
    .sort();
  if (attendus.length) return { possible: false, motif: 'appareil-jamais-vu', attendus };

  let jusqua = horloge;
  for (const appareil of autres) {
    const borne = appareil.reconnuJusqua!;
    if (borne < jusqua) jusqua = borne;
  }
  return { possible: true, jusqua, seul: false };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le plan de compaction
   ══════════════════════════════════════════════════════════════════════════ */

export interface Plan {
  jusqua: string;
  /** Les cibles supprimées entièrement couvertes par la borne. */
  cibles: string[];
  /** Les opérations à retirer, pierres tombales comprises. */
  operations: Operation[];
  /** Les entrées de journal de révision à retirer. */
  revisions: Journalisable[];
  /** Les pierres tombales retirées : une par cible compactée. */
  pierresTombales: number;
  /**
   * Les cibles supprimées qu'on laisse en place parce qu'une de leurs
   * opérations dépasse la borne. L'écran peut les compter : c'est ce qu'un
   * appareil en retard coûte, et c'est mieux dit que caché.
   */
  reportees: string[];
}

export interface Journaux {
  operations: readonly Operation[];
  revisions: readonly (Journalisable & { carteId: string })[];
}

/**
 * Ce qu'une compaction retirerait, sans rien retirer.
 *
 * Pure et déterministe : deux appareils qui ont les mêmes journaux et la même
 * borne calculent le même plan. C'est ce qui permet de l'afficher avant de
 * l'exécuter, et c'est ce qui rend la fonction éprouvable sans navigateur.
 */
export function planifier(journaux: Journaux, jusqua: string): Plan {
  const supprimees = new Set<string>();
  for (const op of journaux.operations) {
    if (op.type === TYPE_SUPPRESSION) supprimees.add(op.cible);
  }

  const parCible = new Map<string, Operation[]>();
  for (const op of journaux.operations) {
    if (op.type === TYPE_COMPACTION) continue;
    if (!supprimees.has(op.cible)) continue;
    const groupe = parCible.get(op.cible);
    if (groupe) groupe.push(op);
    else parCible.set(op.cible, [op]);
  }

  const revisionsParCible = new Map<string, (Journalisable & { carteId: string })[]>();
  for (const entree of journaux.revisions) {
    if (!supprimees.has(entree.carteId)) continue;
    const groupe = revisionsParCible.get(entree.carteId);
    if (groupe) groupe.push(entree);
    else revisionsParCible.set(entree.carteId, [entree]);
  }

  const cibles: string[] = [];
  const reportees: string[] = [];
  const operations: Operation[] = [];
  const revisions: Journalisable[] = [];
  let pierresTombales = 0;

  for (const cible of [...supprimees].sort()) {
    const ops = parCible.get(cible) ?? [];
    const revs = revisionsParCible.get(cible) ?? [];
    const aucuneAuDela =
      ops.every((o) => o.hlc <= jusqua) && revs.every((r) => r.hlc <= jusqua);
    if (!aucuneAuDela) {
      reportees.push(cible);
      continue;
    }
    // Défensif : une cible sans aucune entrée ne se déclare pas. Le cas ne
    // devrait pas se produire — une pierre tombale est elle-même une opération
    // — et un compactage qui n'efface rien n'allongerait le journal pour rien.
    if (ops.length === 0 && revs.length === 0) continue;
    cibles.push(cible);
    for (const op of ops) {
      operations.push(op);
      if (op.type === TYPE_SUPPRESSION) pierresTombales += 1;
    }
    revisions.push(...revs);
  }

  return { jusqua, cibles, operations, revisions, pierresTombales, reportees };
}

/** Le plan retire-t-il quelque chose ? */
export const vide = (plan: Plan): boolean =>
  plan.operations.length === 0 && plan.revisions.length === 0;
