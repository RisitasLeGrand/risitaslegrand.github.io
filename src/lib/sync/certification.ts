/**
 * L'ordinateur certifié : le seul qui puisse synchroniser sans qu'on le lui
 * demande.
 *
 * ## Ce qu'« arrière-plan » veut dire ici, et ce qu'il ne veut pas dire
 *
 * Un site statique n'a pas de processus. `RTCPeerConnection` n'existe pas dans
 * un *service worker*, donc la liaison directe est impossible hors page.
 * « Arrière-plan » signifie donc, exactement : **sans geste, pendant que
 * Cyclades est ouvert dans un onglet de cet ordinateur**. Fermer l'onglet ou
 * éteindre la machine arrête tout. C'est une restriction réelle, elle est
 * écrite sur l'écran d'activation, et non dans une note de bas de page : un
 * utilisateur qui croit que son ordinateur éteint synchronise est exactement la
 * croyance que ce chantier doit refuser d'installer.
 *
 * ## Pourquoi la décision est locale et l'annonce partagée
 *
 * La certification s'active **sur l'ordinateur lui-même**, jamais à distance
 * depuis le téléphone — ce serait le chemin d'une prise de contrôle par QR
 * photographié. Elle vit donc dans le magasin `etat`, qui ne voyage pas.
 *
 * Mais les autres écrans doivent pouvoir dire « l'ordinateur de bureau
 * synchronise seul », sans quoi une fusion surgie de nulle part serait
 * inexplicable. L'appareil **annonce** donc sa certification par un fait, et
 * cette annonce n'est lue que si son auteur est son sujet : un fait qui
 * certifierait un autre appareil que son émetteur est **ignoré**. C'est la
 * règle « jamais à distance » tenue par le code, et pas seulement par l'écran.
 *
 * ## Ce que la certification ne donne pas
 *
 * Aucun droit de lecture supplémentaire. La matrice de permissions par type de
 * fait s'applique à l'identique. Un appareil certifié n'est pas un appareil
 * privilégié : c'est un appareil autorisé à agir seul.
 */
import { db } from '../db';
import type { Operation } from '../noyau/operations';

/** Le fait qui **annonce** une certification. Il ne la décide pas. */
export const TYPE_CERTIFICATION = 'appareil.certifie';

const CLEF = 'certification';

export interface Certification {
  /** La décision, locale à cet appareil. */
  certifie: boolean;
  /** Quand elle a été prise, en ISO. */
  le: string;
}

export async function certificationLocale(): Promise<Certification | null> {
  const base = await db();
  return ((await base.get('etat', CLEF)) as Certification | undefined) ?? null;
}

export const estCertifie = async (): Promise<boolean> =>
  (await certificationLocale())?.certifie === true;

/**
 * Ce qu'il faut réunir pour qu'un appareil se certifie **tout seul**.
 *
 * Les deux conditions sont celles que la veille exige déjà pour agir : un
 * appairage mémorisé et le mot de passe en mémoire de session. Les reprendre
 * ici n'ajoute donc aucun pouvoir — cela déplace seulement le moment où on
 * les constate.
 */
export interface ContexteDeCertification {
  /** Un appairage est mémorisé sur cet appareil. */
  apparie: boolean;
  /** Le mot de passe du site est en mémoire de session, maintenant. */
  motDePasseEnMemoire: boolean;
}

/**
 * La certification effective : la décision prise, ou le défaut.
 *
 * ## Pourquoi un défaut, après l'avoir refusé
 *
 * Le prompt 23 voulait la synchronisation automatique **activée par défaut**.
 * Le code posait l'inverse : « le niveau 0 ne se mérite pas, il se donne » y
 * était devenu « il se mérite ». L'audit l'a relevé (D-028), et la réponse
 * tranche pour le défaut — mais le défaut le plus étroit des trois proposés :
 * seulement sur un appareil **déjà apparié** et qui a le **mot de passe en
 * mémoire**. Les deux conditions ensemble disent : quelqu'un a photographié
 * le QR sur cet appareil, et quelqu'un y a tapé le mot de passe depuis le
 * dernier verrouillage. Ce n'est pas un appareil anonyme.
 *
 * ## Ce qui reste intact
 *
 * **La décision explicite gagne toujours**, dans les deux sens. Un appareil
 * décertifié à la main le reste, même s'il remplit les deux conditions : un
 * défaut qui écraserait un refus ne serait pas un défaut, ce serait une
 * reprise de contrôle.
 *
 * **Le défaut ne se garde pas.** Il n'est ni écrit dans « etat », ni annoncé
 * par un fait : il se recalcule à chaque démarrage de la veille. La raison
 * tient en une phrase — le mot de passe quitte la mémoire au verrouillage et
 * à chaque rechargement sans saisie, donc une certification persistée
 * survivrait à la condition qui l'a fait naître. Un appareil serait certifié
 * pour toujours après une seule session où l'on a tapé le mot de passe, ce
 * qui n'est pas ce qui a été décidé.
 *
 * La contrepartie est assumée : les autres appareils ne voient pas une
 * certification par défaut, puisque rien ne l'annonce. Ils ne voient pas non
 * plus l'appareil agir hors de ses propres échanges, et l'écran local, lui,
 * la montre et dit qu'elle est tacite.
 */
export function certificationEffective(
  locale: Certification | null,
  contexte: ContexteDeCertification,
): { certifie: boolean; parDefaut: boolean } {
  if (locale) return { certifie: locale.certifie, parDefaut: false };
  const certifie = contexte.apparie && contexte.motDePasseEnMemoire;
  return { certifie, parDefaut: certifie };
}

/**
 * Pose ou retire la certification de **cet** appareil.
 *
 * L'écriture locale d'abord, l'annonce ensuite : si l'annonce échoue, la
 * machine se comporte comme ce que la personne a décidé, et l'annonce repartira
 * à la prochaine occasion. L'inverse annoncerait une certification qui n'agit
 * pas.
 */
export async function certifier(certifie: boolean): Promise<Certification> {
  const certification: Certification = { certifie, le: new Date().toISOString() };
  await (await db()).put('etat', certification, CLEF);
  return certification;
}

/**
 * Les appareils qui **se** déclarent certifiés.
 *
 * Un fait dont l'auteur n'est pas le sujet est ignoré : on ne certifie pas un
 * autre appareil. Les opérations arrivent triées par l'ordre total, donc la
 * dernière annonce d'un appareil sur lui-même gagne.
 */
export function certifiesDeclares(operations: readonly Operation[]): Set<string> {
  const etat = new Map<string, boolean>();
  for (const op of operations) {
    if (op.type !== TYPE_CERTIFICATION) continue;
    if (op.appareil !== op.cible) continue;
    const certifie = (op.charge as { certifie?: unknown })?.certifie;
    etat.set(op.cible, certifie !== false);
  }
  return new Set([...etat].filter(([, oui]) => oui).map(([id]) => id));
}
