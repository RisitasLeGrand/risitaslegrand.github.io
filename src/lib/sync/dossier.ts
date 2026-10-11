/**
 * Le dossier partagé : déposer le paquet quelque part que les deux appareils
 * voient.
 *
 * C'est le mode B de la décision 2, et il tient sa promesse sur un seul des
 * deux appareils du problème : l'accès **mémorisé** à un dossier n'existe que
 * sur les navigateurs Chromium de bureau. Ni Firefox, ni Safari, ni aucun
 * navigateur mobile ne l'offrent — ils n'exposent qu'un système de fichiers
 * privé, qui est un bac à sable et non votre disque.
 *
 * Cela ne le rend pas inutile, et c'est pourquoi la décision l'a retenu en
 * second : sur ordinateur, c'est le seul transport **sans aucun geste** une fois
 * réglé, et le seul qui n'exige pas que les deux appareils soient ouverts en même
 * temps — ce qui est la seule faiblesse de la liaison directe. Si le dossier est
 * un dossier synchronisé par un service de fichiers, l'autre appareil y
 * retrouvera le paquet quand il voudra.
 *
 * ## Ce qui est déposé
 *
 * Exactement le même paquet que le transfert manuel : chiffré avec le mot de
 * passe du site, somme de contrôle comprise. Le dossier peut donc être un
 * dossier synchronisé chez un tiers sans que ce tiers puisse rien lire. C'est la
 * condition qui rend ce mode acceptable sous la règle « aucun stockage chez un
 * tiers » : ce qui transite est illisible, comme sur GitHub Pages.
 *
 * ## La permission se perd, et c'est normal
 *
 * Un navigateur peut oublier l'autorisation d'écrire dans un dossier — à la
 * fermeture, après une mise à jour, ou si l'utilisateur la révoque. Elle ne peut
 * être redemandée que sur un geste de l'utilisateur. Le module ne la redemande
 * donc **jamais tout seul** : il dit « à redemander », et l'écran offre le
 * bouton. Un module qui tenterait silencieusement verrait son appel refusé et
 * conclurait à tort que le dossier est perdu.
 */
import { db } from '../db';

export const CLEF_DOSSIER = 'dossier-partage';

/** Ce que l'on garde par appareil : au-delà, les anciens paquets ne servent plus. */
export const PAQUETS_GARDES = 3;

const SUFFIXE = '.paquet';

/*
   Les types du système de fichiers ne sont pas tous dans la bibliothèque
   standard selon les versions : on déclare le strict nécessaire plutôt que
   d'élargir la configuration du projet pour une seule page.
*/
type Mode = { mode?: 'read' | 'readwrite' };
interface Poignee {
  kind: 'file' | 'directory';
  name: string;
  queryPermission?: (options?: Mode) => Promise<PermissionState>;
  requestPermission?: (options?: Mode) => Promise<PermissionState>;
  getFileHandle: (nom: string, options?: { create?: boolean }) => Promise<PoigneeFichier>;
  removeEntry: (nom: string, options?: { recursive?: boolean }) => Promise<void>;
  entries: () => AsyncIterableIterator<[string, Poignee | PoigneeFichier]>;
}
interface PoigneeFichier {
  kind: 'file' | 'directory';
  name: string;
  getFile: () => Promise<File>;
  createWritable: (options?: { keepExistingData?: boolean }) => Promise<{
    write: (donnees: BufferSource) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

type Fenetre = typeof globalThis & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: string;
  }) => Promise<Poignee>;
};

/** Le mode B est-il possible sur cet appareil ? */
export const disponible = (): boolean =>
  typeof (globalThis as Fenetre).showDirectoryPicker === 'function';

export class DossierRefuse extends Error {
  constructor(readonly motif: 'indisponible' | 'annule' | 'permission') {
    super(
      {
        indisponible:
          'Ce navigateur ne sait pas mémoriser un dossier. C’est le cas de Firefox, de Safari ' +
          'et de tous les navigateurs de téléphone : utilisez la liaison directe ou le fichier.',
        annule: 'Aucun dossier choisi.',
        permission:
          'L’autorisation d’écrire dans ce dossier n’a pas été donnée. Elle doit être ' +
          'redemandée par un clic.',
      }[motif],
    );
    this.name = 'DossierRefuse';
  }
}

/** Demande un dossier à l'utilisateur. Exige un geste de sa part. */
export async function choisirDossier(): Promise<Poignee> {
  const ouvrir = (globalThis as Fenetre).showDirectoryPicker;
  if (!ouvrir) throw new DossierRefuse('indisponible');
  try {
    return await ouvrir({ id: 'cyclades-sync', mode: 'readwrite', startIn: 'documents' });
  } catch (erreur) {
    // Un refus de l'utilisateur est un « AbortError » : ce n'est pas une panne.
    if ((erreur as { name?: string })?.name === 'AbortError') throw new DossierRefuse('annule');
    throw erreur;
  }
}

/**
 * La poignée est enregistrée **telle quelle** dans IndexedDB.
 *
 * C'est ce qui fait tout l'intérêt du mode B : une poignée survit à la
 * fermeture de l'onglet, là où un chemin de fichier ne voudrait rien dire pour
 * un navigateur. Elle n'est pas un chemin, et on ne peut pas en lire un : le
 * navigateur ne dit jamais où le dossier se trouve, seulement son nom.
 */
export async function memoriserDossier(poignee: Poignee): Promise<void> {
  await (await db()).put('etat', poignee, CLEF_DOSSIER);
}

export async function dossierMemorise(): Promise<Poignee | null> {
  return ((await (await db()).get('etat', CLEF_DOSSIER)) as Poignee | undefined) ?? null;
}

export async function oublierDossier(): Promise<void> {
  await (await db()).delete('etat', CLEF_DOSSIER);
}

export type Autorisation = 'accordee' | 'a-redemander' | 'refusee';

/** L'état de l'autorisation, sans jamais la redemander de son propre chef. */
export async function autorisation(poignee: Poignee): Promise<Autorisation> {
  if (!poignee.queryPermission) return 'accordee';
  const etat = await poignee.queryPermission({ mode: 'readwrite' });
  return etat === 'granted' ? 'accordee' : etat === 'denied' ? 'refusee' : 'a-redemander';
}

/** À n'appeler que depuis un gestionnaire de clic. */
export async function redemanderAutorisation(poignee: Poignee): Promise<Autorisation> {
  if (!poignee.requestPermission) return 'accordee';
  const etat = await poignee.requestPermission({ mode: 'readwrite' });
  return etat === 'granted' ? 'accordee' : etat === 'denied' ? 'refusee' : 'a-redemander';
}

export async function deposer(poignee: Poignee, nom: string, octets: Uint8Array): Promise<void> {
  if ((await autorisation(poignee)) !== 'accordee') throw new DossierRefuse('permission');
  const fichier = await poignee.getFileHandle(nom, { create: true });
  const flux = await fichier.createWritable();
  await flux.write(octets as unknown as BufferSource);
  await flux.close();
}

export interface PaquetDuDossier {
  nom: string;
  /** L'appareil qui l'a déposé, lu dans le nom du fichier. */
  appareil: string;
  modifie: number;
  taille: number;
}

/**
 * L'appareil d'un nom de fichier.
 *
 * Le nom est de la forme « cyclades-<appareil>-<date>h<minute>.paquet ». On
 * découpe par la fin : l'identifiant d'appareil ne contient pas de tiret, mais
 * la date en contient trois, et compter depuis le début se tromperait le jour
 * où le format de date changerait.
 */
export function appareilDuNom(nom: string): string | null {
  if (!nom.endsWith(SUFFIXE) || !nom.startsWith('cyclades-')) return null;
  const morceaux = nom.slice('cyclades-'.length, -SUFFIXE.length).split('-');
  if (morceaux.length < 5) return null;
  return morceaux.slice(0, morceaux.length - 4).join('-') || null;
}

/**
 * Les paquets déposés par **les autres** appareils, du plus récent au plus
 * ancien.
 *
 * Exclure les siens n'est pas une commodité d'affichage : fusionner son propre
 * paquet ne changerait rien, mais enregistrerait un lot vide dans l'historique
 * d'annulation, et offrirait une annulation qui ne défait rien.
 */
export async function paquetsDisponibles(
  poignee: Poignee,
  appareilLocal: string,
): Promise<PaquetDuDossier[]> {
  const sortie: PaquetDuDossier[] = [];
  for await (const [nom, entree] of poignee.entries()) {
    if (entree.kind !== 'file') continue;
    const appareil = appareilDuNom(nom);
    if (!appareil || appareil === appareilLocal.toLowerCase()) continue;
    const fichier = await (entree as PoigneeFichier).getFile();
    sortie.push({ nom, appareil, modifie: fichier.lastModified, taille: fichier.size });
  }
  return sortie.sort((a, b) => b.modifie - a.modifie);
}

export async function lirePaquet(poignee: Poignee, nom: string): Promise<Uint8Array<ArrayBuffer>> {
  const fichier = await poignee.getFileHandle(nom);
  return new Uint8Array(await (await fichier.getFile()).arrayBuffer());
}

/**
 * Ne garde que les derniers paquets de chaque appareil.
 *
 * Sans cela le dossier grossit indéfiniment, à raison d'un fichier de plusieurs
 * mégaoctets par synchronisation. La rétention est **par appareil** : garder
 * « les trois plus récents du dossier » ferait disparaître le seul paquet d'un
 * appareil qui synchronise rarement, c'est-à-dire exactement celui qu'il faut
 * conserver.
 */
export async function nettoyer(
  poignee: Poignee,
  garder = PAQUETS_GARDES,
): Promise<string[]> {
  if ((await autorisation(poignee)) !== 'accordee') throw new DossierRefuse('permission');
  const parAppareil = new Map<string, PaquetDuDossier[]>();
  for await (const [nom, entree] of poignee.entries()) {
    if (entree.kind !== 'file') continue;
    const appareil = appareilDuNom(nom);
    if (!appareil) continue;
    const fichier = await (entree as PoigneeFichier).getFile();
    const liste = parAppareil.get(appareil) ?? [];
    liste.push({ nom, appareil, modifie: fichier.lastModified, taille: fichier.size });
    parAppareil.set(appareil, liste);
  }
  const retires: string[] = [];
  for (const liste of parAppareil.values()) {
    liste.sort((a, b) => b.modifie - a.modifie);
    for (const vieux of liste.slice(garder)) {
      await poignee.removeEntry(vieux.nom);
      retires.push(vieux.nom);
    }
  }
  return retires.sort();
}
