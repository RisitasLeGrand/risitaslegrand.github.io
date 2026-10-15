/**
 * Ce qu'un élément du centre EST — phase 2 du prompt 32.
 *
 * ## Sept champs, aucun contenu
 *
 * Le § 2.3 l'impose, et c'est la contrainte qui décide de tout le reste :
 * un élément ne porte **ni titre ni texte**. Il porte une référence, et le
 * texte se recalcule depuis la source à l'affichage. Trois conséquences
 * qu'on obtient d'un coup :
 *
 * - **le centre ne peut pas mentir.** Un titre stocké survivrait à la
 *   correction de la donnée qu'il décrit ; une référence, non ;
 * - **coffre fermé, il ne révèle rien** d'une source scellée : il n'a rien
 *   à révéler, le texte n'existe pas chez lui ;
 * - **l'effacement d'une source suffit** (§ 1 n° 9) : l'élément devient
 *   orphelin et se supprime, sans qu'il reste un libellé quelque part.
 *
 * ## L'identifiant est une EMPREINTE, et pas la référence
 *
 * Le § 2.3 demande un `id` « dérivé de la source, pas d'un compteur local »,
 * pour que deux appareils ou deux onglets n'en produisent pas deux. C'est
 * la règle des clés déterministes du prompt 38, et elle a la même
 * conséquence : **un identifiant dérivé est lisible**.
 *
 * Un `id` valant `journal-du-cycle/2026-10-12` dirait en clair ce que tout
 * le magasin est chiffré pour cacher — et le § 4.1 interdit explicitement
 * domaine, source et date fine dans les index en clair. La dérivation passe
 * donc par SHA-256 : déterminisme conservé entre appareils, rien de dit.
 *
 * C'est une lecture de ma part, soumise au plan et prise faute de
 * contre-indication. Elle n'affaiblit rien — une empreinte est aussi
 * déterministe que la chaîne dont elle vient — et elle referme une fuite
 * que la lettre du prompt laissait ouverte.
 */

/** Les trois états. `archive` n'est pas `lu` : on range ce qu'on a vu. */
export type EtatDElement = 'non_lu' | 'lu' | 'archive';

/** Le genre décide de la section du panneau, et du droit d'archiver. */
export type GenreDElement = 'a-trancher' | 'a-savoir';

export interface ElementDuCentre {
  /** Empreinte de `source + refSource`. Déterministe, et muette. */
  id: string;
  /** L'identifiant de la source, tel que `filtre-cycle.ts` le déclare. */
  source: string;
  /** La référence vers l'objet de la source. Jamais ouverte par le centre. */
  refSource: string;
  genre: GenreDElement;
  /** Le jour logique de création. **Au jour**, jamais à l'instant (§ 4.1). */
  creeLe: string;
  etat: EtatDElement;
  /** La clé de regroupement, ou `null`. « 3 revues en attente » en est une. */
  regroupement: string | null;
}

/**
 * Un élément « à trancher » peut-il être marqué lu ou archivé ?
 *
 * Non, et le § 1 n° 8 en donne la raison : une question ouverte ne
 * disparaît pas. Elle quitte le compteur **à la résolution de sa source**,
 * pas parce qu'on l'a regardée. Sans cette règle, le centre offrirait un
 * moyen de faire taire un conflit sans le résoudre — ce qui est pire que de
 * ne rien signaler.
 */
export const peutEtreRange = (element: ElementDuCentre): boolean =>
  element.genre !== 'a-trancher';

/** Un élément compte-t-il dans la pastille ? Seules les questions à trancher. */
export const compteDansLaPastille = (element: ElementDuCentre): boolean =>
  element.genre === 'a-trancher' && element.etat !== 'archive';

const encodeur = new TextEncoder();

/**
 * L'empreinte d'une référence. Seize octets en hexadécimal, soit 32 signes.
 *
 * Tronquée : une collision demanderait 2^64 éléments pour une chance sur
 * deux, et le magasin en portera quelques centaines. Les 32 signes entiers
 * ne protégeraient de rien de plus et alourdiraient chaque clé.
 */
export async function idDeLElement(source: string, refSource: string): Promise<string> {
  const brut = await crypto.subtle.digest('SHA-256', encodeur.encode(`${source}\u0000${refSource}`));
  return Array.from(new Uint8Array(brut).slice(0, 16))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

/** La rétention, en jours. Réglable (décision 7), jamais pour une question ouverte. */
export interface RetentionDuCentre {
  archiverApres: number;
  supprimerApres: number;
}

export const RETENTION_PAR_DEFAUT: RetentionDuCentre = {
  archiverApres: 30,
  supprimerApres: 180,
};

/**
 * Ce que la rétention fait d'un élément, au jour dit.
 *
 * **Rend toujours `rien` pour une question à trancher**, quel que soit son
 * âge. C'est le § 1 n° 8 appliqué au ménage automatique : une question
 * vieille de deux ans reste une question.
 */
export function sortDeLaRetention(
  element: ElementDuCentre,
  aujourdHui: string,
  retention: RetentionDuCentre = RETENTION_PAR_DEFAUT,
): 'rien' | 'archiver' | 'supprimer' {
  if (!peutEtreRange(element)) return 'rien';
  const jours = Math.floor(
    (Date.parse(`${aujourdHui}T00:00:00Z`) - Date.parse(`${element.creeLe}T00:00:00Z`)) / 86_400_000,
  );
  if (jours >= retention.supprimerApres) return 'supprimer';
  if (jours >= retention.archiverApres && element.etat !== 'archive') return 'archiver';
  return 'rien';
}

export function controlerElement(e: ElementDuCentre): string[] {
  const problemes: string[] = [];
  if (!/^[0-9a-f]{32}$/.test(e.id)) problemes.push('L’identifiant doit être une empreinte de 32 signes.');
  if (!e.source) problemes.push('La source est obligatoire.');
  if (!e.refSource) problemes.push('La référence de source est obligatoire.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.creeLe)) {
    problemes.push('La date de création est un jour, jamais un instant.');
  }
  return problemes;
}
