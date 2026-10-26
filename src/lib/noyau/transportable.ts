/**
 * CE QU'UNE OPÉRATION A LE DROIT D'EMPORTER HORS DE L'APPAREIL.
 *
 * ## La règle, et pourquoi elle vit ici plutôt qu'à chaque sortie
 *
 * La clé du coffre n'est pas partagée entre appareils, et ce n'est pas une
 * crainte : c'est le trajet du sel qui en décide. La clé des données est
 * dérivée du mot de passe ET de `coffre.sel`, tiré au sort à la première
 * ouverture et rangé dans le magasin `etat` (`coffre.ts`, `selLocal`). Or un
 * paquet de synchronisation emporte `operations` et `revisions`, jamais
 * `etat` (`sync/service.ts`, `magasinsEnPlus`) : l'appareil d'en face ne
 * reçoit pas ce sel, en tire un autre, et dérive une autre clé.
 *
 * MESURÉ LE 26 OCTOBRE, ET DANS L'AUTRE SENS — c'est ce qui en fait une
 * preuve. Une SAUVEGARDE, elle, emporte `etat`, donc `coffre.sel` : restaurée
 * sur un profil neuf, elle a rouvert le check-in scellé avec le même mot de
 * passe, les quatre glissières à leur valeur. C'est donc bien la route du sel
 * qui décide, et non le sceau.
 *
 * Une première version de cet en-tête citait, à l'appui de la même
 * conclusion, le sel de l'ENVELOPPE (`coffre.sel-enveloppe`, dans
 * `localStorage`). L'enveloppe emballe la clé pour la session ; elle ne la
 * dérive pas. La conclusion tenait, la raison était fausse.
 *
 * Une opération dont la charge porte un enregistrement **scellé** est donc
 * illisible chez l'appareil qui la reçoit par paquet. L'envoyer ne transmet
 * rien et fait du dégât : celui qui reçoit range une entrée qu'il ne peut pas
 * ouvrir, et ses lecteurs — en `Promise.all` — rendent du même coup illisibles
 * ses données LOCALES.
 *
 * Le constat B-2 du prompt 58 mesurait dix-sept magasins à la fois scellés et
 * journalisés. Ce n'était pas une perte qui « arriverait si on synchronisait
 * un jour » : elle avait lieu.
 *
 * ## Pourquoi UNE fonction, et non un filtre à chaque sortie
 *
 * Parce qu'il y a plus d'une sortie. Recensées le 26 octobre : le paquet de
 * synchronisation (`sync/service.ts`) et le fichier de sauvegarde, dont le
 * groupe « Journaux de synchronisation » emporte le magasin `operations`.
 * L'export IA, lui, ne retient que les opérations de type export et ne sort
 * donc rien d'un magasin.
 *
 * Deux filtres écrits séparément divergeraient. C'est la leçon des cinq
 * lecteurs du mot de passe de ce matin, et des deux prédicats de parcours :
 * une règle recopiée finit par diverger, et on ne sait jamais à quel endroit.
 *
 * ## Le prédicat est DÉRIVÉ, et c'est le point
 *
 * Il ne tient aucune liste des dix-sept. Il demande à `estScelle`, qui lit
 * `MAGASINS_SCELLES`. Un dix-huitième magasin scellé demain sera écarté sans
 * que personne touche à ce fichier — et c'est précisément ce qu'une liste
 * recopiée n'aurait pas fait.
 *
 * ## Ce que cette règle NE fait pas
 *
 * Elle n'empêche pas de journaliser. L'opération est écrite dans le journal
 * local comme avant : l'appareil garde la mémoire de ses propres écritures,
 * dont la compaction et la reprise ont besoin. Elle est seulement retenue au
 * départ.
 *
 * Elle ne supprime rien non plus. Les opérations déjà parties restent où elles
 * sont et redeviendront lisibles le jour où la clé sera partagée. « Isoler,
 * c'est écarter, compter et dire ; jamais supprimer. »
 *
 * ## Le jour où la clé sera partagée
 *
 * Ce fichier disparaît, et les dix-sept repartent sans qu'on touche à leurs
 * déclarations : elles n'ont jamais quitté `MAGASINS_JOURNALISES`.
 */
import { estScelle } from './coffre';

/** La forme minimale qu'on sait lire sans déchiffrer quoi que ce soit. */
interface OperationLisible {
  charge?: unknown;
}

/**
 * Le magasin que porte une opération, s'il est lisible.
 *
 * La charge d'une opération d'enregistrement est `{ magasin, enregistrement }`.
 * Le nom du magasin est donc en clair, et c'est ce qui rend ce filtre possible
 * sans la moindre clé : on n'ouvre rien, on lit une étiquette.
 *
 * Les autres genres d'opérations — suppressions, exports, certifications —
 * n'ont pas cette forme. Elles rendent `null`, et sont transportables : elles
 * ne portent aucune donnée scellée.
 */
export function magasinDeLOperation(operation: OperationLisible): string | null {
  const charge = operation?.charge;
  if (!charge || typeof charge !== 'object') return null;
  const magasin = (charge as { magasin?: unknown }).magasin;
  return typeof magasin === 'string' && magasin ? magasin : null;
}

/**
 * Cette opération peut-elle quitter l'appareil ?
 *
 * Non si elle porte l'enregistrement d'un magasin scellé — il serait illisible
 * en face. Oui dans tous les autres cas, y compris quand elle ne nomme aucun
 * magasin.
 */
export function estTransportable(operation: OperationLisible): boolean {
  const magasin = magasinDeLOperation(operation);
  return magasin === null || !estScelle(magasin);
}

/** Les opérations qu'on a le droit d'emporter, dans l'ordre reçu. */
export function operationsTransportables<T extends OperationLisible>(
  operations: readonly T[],
): T[] {
  return operations.filter(estTransportable);
}

/** Celles qu'on retient, pour pouvoir les compter et le dire à l'écran. */
export function operationsRetenues<T extends OperationLisible>(operations: readonly T[]): T[] {
  return operations.filter((o) => !estTransportable(o));
}
