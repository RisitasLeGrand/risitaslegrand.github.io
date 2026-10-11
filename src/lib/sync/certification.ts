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
