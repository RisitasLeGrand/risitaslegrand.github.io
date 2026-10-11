/**
 * Le journal d'opérations : la forme qu'un fait prend pour voyager.
 *
 * Une opération est **immuable**. C'est l'hypothèse dont dépendent les trois
 * garanties du moteur de fusion — commutativité, associativité, idempotence :
 * une seule mutation en place et elles tombent ensemble. Rien dans le type ne
 * l'empêche techniquement ; c'est une discipline, et c'est pourquoi elle est
 * écrite ici plutôt que supposée.
 *
 * ## Les quatre champs d'ordonnancement
 *
 * `id` identifie, et son ordre lexicographique est l'ordre chronologique de
 * création. `hlc` ordonne entre appareils, ce qu'un horodatage ne sait pas
 * faire. `appareil` départage deux horloges égales, de façon stable. Ensemble
 * ils donnent l'ordre total `(hlc, appareil, id)` sur lequel repose la fusion :
 * les trois composantes sont nécessaires, la dernière closant le cas d'un même
 * appareil au même instant logique.
 *
 * ## Le lot, et pourquoi il est là dès maintenant
 *
 * Une opération intégrée par une fusion porte l'identifiant de cette fusion.
 * Annuler une synchronisation, c'est retirer les opérations d'un lot — et elles
 * seules. Le champ est posé dès la première version du journal parce que
 * l'ajouter plus tard priverait d'annulation toutes les fusions antérieures :
 * on ne peut pas rétro-attribuer un lot à des opérations déjà mêlées.
 *
 * Une saisie locale porte le **lot vide**, et non `undefined` : IndexedDB
 * n'indexe pas les enregistrements dont la clé d'index est absente, et une
 * opération locale invisible à l'index serait un piège pour toute requête
 * écrite plus tard.
 */
import type { Hlc } from './hlc';
import { encoderHlc } from './hlc';

/** Le lot d'une saisie locale : vide, et indexé. */
export const SANS_LOT = '';

/**
 * L'identifiant d'un appareil : huit signes, tirés une fois et conservés.
 *
 * Il départage deux horloges logiques égales, donc il doit être **stable** : le
 * régénérer à chaque ouverture ferait de chaque session un appareil distinct et
 * l'ordre de fusion cesserait d'être reproductible. Il est aussi affiché dans
 * le registre d'appareils, d'où l'alphabet sans lettre ambiguë — un identifiant
 * qu'on doit lire à voix haute ne doit pas contenir de O ni de 0 à la fois.
 *
 * Huit signes sur un alphabet de 32 font 2^40 possibilités : pour une poignée
 * d'appareils, la collision n'est pas le risque. Ce n'est pas un secret et il
 * ne protège rien ; l'authentification d'un appareil vient de la preuve de
 * connaissance du mot de passe, pas de son nom.
 */
export function idAppareilNeuf(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const octets = new Uint8Array(8);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => alphabet[o % 32]).join('');
}

export interface Operation {
  /** ULID. */
  id: string;
  /** Identifiant court de l'appareil émetteur. */
  appareil: string;
  /** Horloge logique encodée, qui se trie comme elle se compare. */
  hlc: string;
  /** Le type de fait, au sens du contrat de `noyau/faits.ts`. */
  type: string;
  /** L'objet concerné : identifiant stable de carte, de séance, de jour… */
  cible: string;
  /** Le lot de fusion qui l'a intégrée, ou `SANS_LOT` pour une saisie locale. */
  lot: string;
  /** Les champs du fait. Opaques pour le journal. */
  charge: unknown;
}

/** L'ordre total de fusion. Voir le plan, § 1.2. */
export function comparerOperations(a: Operation, b: Operation): number {
  if (a.hlc !== b.hlc) return a.hlc < b.hlc ? -1 : 1;
  if (a.appareil !== b.appareil) return a.appareil < b.appareil ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface Ebauche {
  id: string;
  appareil: string;
  hlc: Hlc;
  type: string;
  cible: string;
  charge: unknown;
  lot?: string;
}

/** Fige une ébauche en opération. L'horloge y est encodée une fois pour toutes. */
export function operation(e: Ebauche): Operation {
  return Object.freeze({
    id: e.id,
    appareil: e.appareil,
    hlc: encoderHlc(e.hlc),
    type: e.type,
    cible: e.cible,
    lot: e.lot ?? SANS_LOT,
    charge: e.charge,
  });
}
