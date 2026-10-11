/**
 * Le registre d'appareils : qui sont-ils, et que sait-on d'eux ?
 *
 * ## La question de conception, et sa réponse
 *
 * Un registre d'appareils mélange deux choses de natures différentes, et les
 * confondre produirait soit des pertes, soit des mensonges.
 *
 * **Ce qui se partage** : le nom qu'on a donné à un appareil, et le fait qu'il
 * existe. Ce sont des **faits**, au sens du journal : « cet appareil s'appelle
 * Ordinateur de bureau » est vrai partout. Ils voyagent donc comme des
 * opérations, ce qui leur donne gratuitement l'union par identifiant, l'ordre
 * total et l'idempotence — là où un dictionnaire fusionné par
 * dernier-écrivain-gagne aurait perdu l'appareil que l'autre venait d'ajouter.
 *
 * **Ce qui reste local** : quand cet appareil-ci a vu l'autre pour la dernière
 * fois, quelle empreinte il affichait alors, et jusqu'où on lui a déjà envoyé.
 * Ce sont des **observations**, vraies d'un point de vue seulement. Les
 * partager ferait dire au téléphone « vu il y a deux jours » alors que c'est
 * l'ordinateur qui l'a vu il y a deux jours, et l'écran mentirait sans qu'on
 * puisse le reprendre.
 *
 * C'est la même distinction que le reste du chantier — faits contre état
 * dérivé — appliquée à un cas où elle n'est pas évidente.
 */
import { db } from '../db';
import type { Operation } from '../noyau/operations';

/** Le type de fait qui nomme un appareil. */
export const TYPE_NOM_APPAREIL = 'appareil.nom';

/** Le type de fait qui déclare une sauvegarde réussie. */
export const TYPE_SAUVEGARDE = 'sauvegarde.faite';

const CLEF_OBSERVATIONS = 'appareilsVus';

/** Ce qu'on sait d'un appareil : son nom partagé, nos observations locales. */
export interface AppareilConnu {
  id: string;
  /** Le nom déclaré, s'il en a reçu un. */
  nom?: string;
  /** Quand cet appareil-ci l'a vu pour la dernière fois. Local. */
  vuLe?: string;
  /** L'empreinte qu'il annonçait alors. Local. */
  empreinte?: string;
  /** Jusqu'où on lui a déjà envoyé, pour borner la prochaine tranche. Local. */
  envoyeJusqua?: string;
  /** Est-ce cet appareil-ci ? */
  soi: boolean;
}

export interface Observation {
  vuLe: string;
  empreinte?: string;
  envoyeJusqua?: string;
  /** Le nom annoncé par le paquet, gardé si aucun fait ne le dit encore. */
  nomAnnonce?: string;
}

async function observations(): Promise<Record<string, Observation>> {
  const base = await db();
  return ((await base.get('etat', CLEF_OBSERVATIONS)) as Record<string, Observation>) ?? {};
}

/**
 * Note ce qu'on vient d'observer d'un appareil. **Local**, jamais transporté.
 */
export async function noterObservation(
  appareil: string,
  observation: Partial<Observation>,
): Promise<void> {
  const base = await db();
  const toutes = await observations();
  toutes[appareil] = {
    ...toutes[appareil],
    ...observation,
    vuLe: observation.vuLe ?? toutes[appareil]?.vuLe ?? new Date().toISOString(),
  };
  await base.put('etat', toutes, CLEF_OBSERVATIONS);
}

/**
 * Le nom d'un appareil, tel que les faits le disent.
 *
 * Plusieurs faits peuvent nommer le même appareil — on l'a renommé, ou deux
 * appareils l'ont nommé. C'est le plus récent au sens de l'ordre total qui
 * gagne : un renommage est une décision, et la dernière prise est la bonne.
 */
export function nomsDeclares(operations: readonly Operation[]): Map<string, string> {
  const sortie = new Map<string, string>();
  // Les opérations arrivent triées par l'ordre total ; on écrase donc au fil de
  // la lecture, et la dernière valeur lue est la plus récente.
  for (const op of operations) {
    if (op.type !== TYPE_NOM_APPAREIL) continue;
    const nom = (op.charge as { nom?: unknown })?.nom;
    if (typeof nom === 'string' && nom.trim()) sortie.set(op.cible, nom.trim());
  }
  return sortie;
}

export interface SauvegardeDeclaree {
  /** L'identifiant de l'opération, qui est aussi celui de la sauvegarde. */
  id: string;
  appareil: string;
  le: string;
  /**
   * La borne d'horloge couverte par la sauvegarde : tout ce qui précède est
   * dans le fichier. C'est ce qui permet de dire « couvert jusqu'au… » plutôt
   * que seulement « sauvegardé le… », qui ne dit pas ce qui est protégé.
   */
  couvertJusqua?: string;
}

export function sauvegardesDeclarees(
  operations: readonly Operation[],
): SauvegardeDeclaree[] {
  const sortie: SauvegardeDeclaree[] = [];
  for (const op of operations) {
    if (op.type !== TYPE_SAUVEGARDE) continue;
    const charge = op.charge as { le?: unknown; couvertJusqua?: unknown };
    sortie.push({
      id: op.id,
      appareil: op.appareil,
      le: typeof charge?.le === 'string' ? charge.le : '',
      couvertJusqua: typeof charge?.couvertJusqua === 'string' ? charge.couvertJusqua : undefined,
    });
  }
  return sortie.sort((a, b) => b.le.localeCompare(a.le));
}

/**
 * Le registre complet : les appareils connus, soi compris.
 *
 * Un appareil est « connu » dès qu'un fait le nomme **ou** qu'on l'a observé.
 * Les deux chemins comptent : on peut avoir reçu un paquet d'un appareil qui ne
 * s'est pas encore nommé, et on peut connaître par un fait un appareil qu'on
 * n'a jamais rencontré soi-même — ce qui est exactement le cas du troisième
 * appareil, découvert par l'intermédiaire du deuxième.
 */
export async function appareilsConnus(
  operations: readonly Operation[],
  soi: string,
): Promise<AppareilConnu[]> {
  const noms = nomsDeclares(operations);
  const vus = await observations();
  const identifiants = new Set<string>([soi, ...noms.keys(), ...Object.keys(vus)]);

  return [...identifiants]
    .map((id) => ({
      id,
      nom: noms.get(id) ?? vus[id]?.nomAnnonce,
      vuLe: vus[id]?.vuLe,
      empreinte: vus[id]?.empreinte,
      envoyeJusqua: vus[id]?.envoyeJusqua,
      soi: id === soi,
    }))
    .sort((a, b) => (a.soi ? -1 : b.soi ? 1 : a.id.localeCompare(b.id)));
}

/**
 * La borne à partir de laquelle envoyer à un appareil donné.
 *
 * `undefined` veut dire « tout » : c'est le premier contact, et c'est aussi le
 * seul cas sûr, puisqu'on ne peut pas deviner ce qu'un appareil inconnu
 * possède. Envoyer trop ne coûte que du volume — l'idempotence de la fusion
 * s'occupe du reste.
 */
export async function bornePour(appareil: string): Promise<string | undefined> {
  return (await observations())[appareil]?.envoyeJusqua;
}
