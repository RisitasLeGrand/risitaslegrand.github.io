/**
 * Le dossier surveillé de relevés — Finances, phase 4, méthode 3.
 *
 * ## Le plancher honnête est un geste, pas zéro
 *
 * Sans serveur ni tiers, rien ne peut aller chercher un fichier pendant que
 * l'application est fermée. Le dossier surveillé atteint ce plancher et pas
 * mieux : on choisit le dossier **une fois**, et à chaque ouverture Cyclades
 * dit « 2 nouveaux relevés, les importer ? ». C'est tout ce que le plan
 * promet, et c'est tout ce que ce module fait.
 *
 * ## Le nom d'un relevé est une donnée sensible
 *
 * C'est le point que l'implémentation évidente rate. Une banque nomme ses
 * relevés `Releve_CCP_00055347_202609.pdf` : le numéro de compte est dans le
 * nom du fichier, et une liste de « fichiers déjà importés » conservée en
 * clair dans IndexedDB ferait entrer dans la base exactement ce que tout le
 * reste du chantier refuse d'y mettre.
 *
 * On n'enregistre donc **jamais le nom**. Ce qui est conservé est une
 * empreinte SHA-256 de `nom|taille|dernière modification`, qui suffit à
 * répondre à la seule question posée — « ai-je déjà vu ce fichier ? » — et ne
 * permet pas de reconstituer ce qu'on n'a pas déjà.
 *
 * Les noms affichés à l'écran sont lus **en direct** dans le dossier, et ne
 * sont jamais écrits nulle part.
 *
 * ## Le souvenir n'est pas le garde-fou
 *
 * Le vrai dédoublonnage reste celui de l'import : l'empreinte d'une opération
 * mêle compte, jour, montant, libellé et rang, et deux relevés qui se
 * chevauchent reconnaissent les mêmes opérations. Le souvenir des fichiers ne
 * sert qu'à **ne pas proposer** deux fois le même travail. L'oublier ne perd
 * donc aucune donnée : il refait seulement proposer un import qui n'ajoutera
 * rien.
 */
import { db } from '../db';
import { CLEF_DOSSIER } from '../sync/dossier';

/** Où la poignée du dossier de relevés est rangée. Distincte de la synchro. */
export const CLEF_DOSSIER_RELEVES = 'dossier-releves';
/** Où sont rangées les empreintes des fichiers déjà vus. */
export const CLEF_VUS = 'dossier-releves-vus';

/**
 * Combien d'empreintes on garde.
 *
 * Un relevé par mois et par compte, quatre comptes, cinq ans : 240. Le double
 * laisse de la marge sans faire grossir la base pour rien. Au-delà, les plus
 * anciennes partent — et le seul effet est qu'un relevé de 2021 retrouvé dans
 * le dossier serait proposé à nouveau, pour n'ajouter aucune opération.
 */
export const EMPREINTES_GARDEES = 500;

export interface PoigneeFichierReleve {
  kind: 'file' | 'directory';
  name: string;
  getFile: () => Promise<File>;
}

export interface PoigneeDossier {
  kind: 'file' | 'directory';
  name: string;
  entries: () => AsyncIterableIterator<[string, PoigneeFichierReleve]>;
  queryPermission?: (o?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

type Fenetre = typeof globalThis & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: string;
  }) => Promise<PoigneeDossier>;
};

export const disponible = (): boolean =>
  typeof (globalThis as Fenetre).showDirectoryPicker === 'function';

export class DossierDeRelevesRefuse extends Error {
  constructor(readonly motif: 'indisponible' | 'annule' | 'permission') {
    super(
      {
        indisponible:
          'Ce navigateur ne sait pas mémoriser un dossier. C’est le cas de Firefox, de Safari ' +
          'et de tous les navigateurs de téléphone : déposez les relevés un par un, le résultat ' +
          'est exactement le même.',
        annule: 'Aucun dossier choisi.',
        permission:
          'L’autorisation de lire ce dossier n’a pas été donnée. Un navigateur la redemande ' +
          'après un redémarrage, et elle exige un clic : elle ne peut pas être reprise toute ' +
          'seule au chargement.',
      }[motif],
    );
    this.name = 'DossierDeRelevesRefuse';
  }
}

/**
 * Le dossier est demandé en **lecture seule**.
 *
 * La synchronisation, elle, demande l'écriture parce qu'elle y dépose des
 * paquets. Ici, Cyclades n'a aucune raison d'écrire chez vos relevés — et
 * demander un droit dont on ne se sert pas est la façon la plus sûre de faire
 * refuser celui dont on a besoin.
 */
export async function choisirDossierDeReleves(): Promise<PoigneeDossier> {
  const ouvrir = (globalThis as Fenetre).showDirectoryPicker;
  if (!ouvrir) throw new DossierDeRelevesRefuse('indisponible');
  try {
    return await ouvrir({ id: 'cyclades-releves', mode: 'read', startIn: 'downloads' });
  } catch (erreur) {
    if ((erreur as { name?: string })?.name === 'AbortError') {
      throw new DossierDeRelevesRefuse('annule');
    }
    throw erreur;
  }
}

export async function memoriserLeDossier(poignee: PoigneeDossier): Promise<void> {
  await (await db()).put('etat', poignee, CLEF_DOSSIER_RELEVES);
}

export async function dossierMemorise(): Promise<PoigneeDossier | null> {
  return ((await (await db()).get('etat', CLEF_DOSSIER_RELEVES)) as PoigneeDossier | undefined)
    ?? null;
}

export async function oublierLeDossier(): Promise<void> {
  const base = await db();
  await base.delete('etat', CLEF_DOSSIER_RELEVES);
  await base.delete('etat', CLEF_VUS);
}

export type Autorisation = 'accordee' | 'a-redemander' | 'refusee';

export async function autorisation(poignee: PoigneeDossier): Promise<Autorisation> {
  const etat = await poignee.queryPermission?.({ mode: 'read' });
  if (etat === 'granted') return 'accordee';
  return etat === 'denied' ? 'refusee' : 'a-redemander';
}

export async function redemanderAutorisation(poignee: PoigneeDossier): Promise<Autorisation> {
  const etat = await poignee.requestPermission?.({ mode: 'read' });
  if (etat === 'granted') return 'accordee';
  return etat === 'denied' ? 'refusee' : 'a-redemander';
}

/* ══════════════════════════════════════════════════════════════════════════
   Les empreintes
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'empreinte d'un fichier : nom, taille, dernière modification.
 *
 * Pas son contenu : lire plusieurs mégaoctets de PDF pour décider s'il faut
 * les lire coûterait exactement ce qu'on cherche à éviter. Les trois
 * ensemble suffisent — deux relevés différents ne partagent pas la même
 * taille à l'octet **et** la même date à la milliseconde **et** le même nom.
 *
 * La contrepartie est assumée : un fichier renommé sera proposé à nouveau.
 * L'import n'en tirera aucune opération nouvelle, et la personne aura perdu
 * un clic — ce qui est le bon côté sur lequel se tromper.
 */
export async function empreinteDuFichier(
  nom: string,
  taille: number,
  modifieLe: number,
): Promise<string> {
  const octets = new TextEncoder().encode(`${nom}|${taille}|${modifieLe}`);
  const digest = await crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(digest)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

export async function empreintesVues(): Promise<string[]> {
  return ((await (await db()).get('etat', CLEF_VUS)) as string[] | undefined) ?? [];
}

export async function noterCommeVues(empreintes: readonly string[]): Promise<void> {
  if (!empreintes.length) return;
  const connues = await empreintesVues();
  /*
     Les plus récentes en tête, pour que l'élagage retire les plus anciennes.
     Un `Set` dédoublonne, et l'ordre d'insertion d'un `Set` est garanti.
  */
  const fusion = [...new Set([...empreintes, ...connues])].slice(0, EMPREINTES_GARDEES);
  await (await db()).put('etat', fusion, CLEF_VUS);
}

/* ══════════════════════════════════════════════════════════════════════════
   Ce que le dossier contient de nouveau
   ══════════════════════════════════════════════════════════════════════════ */

export interface ReleveDuDossier {
  /** Lu en direct, jamais enregistré. */
  nom: string;
  taille: number;
  modifieLe: number;
  empreinte: string;
  dejaVu: boolean;
}

const estUnPdf = (nom: string) => /\.pdf$/i.test(nom);

/**
 * Ce que le dossier contient, le déjà-vu marqué.
 *
 * Rendu trié du plus récent au plus ancien : un relevé qu'on vient de
 * télécharger est celui qu'on veut importer, et le faire chercher dans une
 * liste alphabétique de soixante fichiers annulerait le geste qu'on
 * économise.
 */
export async function contenuDuDossier(poignee: PoigneeDossier): Promise<ReleveDuDossier[]> {
  const vues = new Set(await empreintesVues());
  const sortie: ReleveDuDossier[] = [];
  for await (const [nom, entree] of poignee.entries()) {
    if (entree.kind !== 'file' || !estUnPdf(nom)) continue;
    const fichier = await entree.getFile();
    const empreinte = await empreinteDuFichier(nom, fichier.size, fichier.lastModified);
    sortie.push({
      nom,
      taille: fichier.size,
      modifieLe: fichier.lastModified,
      empreinte,
      dejaVu: vues.has(empreinte),
    });
  }
  return sortie.sort((a, b) => b.modifieLe - a.modifieLe || a.nom.localeCompare(b.nom));
}

export const nouveaux = (contenu: readonly ReleveDuDossier[]) => contenu.filter((r) => !r.dejaVu);

export async function lireLeFichier(
  poignee: PoigneeDossier,
  nom: string,
): Promise<File> {
  for await (const [n, entree] of poignee.entries()) {
    if (n === nom && entree.kind === 'file') return entree.getFile();
  }
  throw new Error(`« ${nom} » n’est plus dans le dossier.`);
}

/**
 * La phrase du bandeau. Jamais les noms : seulement combien.
 *
 * Le bandeau s'affiche au chargement d'une page, coffre encore fermé. Y
 * écrire « Releve_CCP_00055347_202609.pdf est nouveau » afficherait un numéro
 * de compte à quelqu'un qui n'a pas donné son mot de passe.
 */
export function phraseDuBandeau(contenu: readonly ReleveDuDossier[]): string | null {
  const combien = nouveaux(contenu).length;
  if (combien === 0) return null;
  return combien === 1
    ? '1 nouveau relevé dans le dossier surveillé.'
    : `${combien} nouveaux relevés dans le dossier surveillé.`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export async function controlerLeDossierDeReleves(): Promise<string[]> {
  const problemes: string[] = [];

  /*
     Le point qui compte : l'empreinte ne doit pas laisser retrouver le nom.
     On le vérifie en cherchant un numéro de compte dans ce qui est écrit.
  */
  const nom = 'Releve_CCP_00055347_202609.pdf';
  const empreinte = await empreinteDuFichier(nom, 182_344, 1_759_000_000_000);
  if (empreinte.includes('00055347') || empreinte.includes('Releve')) {
    problemes.push(
      'L’empreinte d’un relevé laisse lire son nom. Les banques mettent le numéro de compte ' +
        'dans le nom du fichier, et ce numéro entrerait dans la base.',
    );
  }
  if (!/^[0-9a-f]{64}$/.test(empreinte)) {
    problemes.push('L’empreinte d’un relevé n’est pas un SHA-256 hexadécimal.');
  }
  /* Déterministe, sinon chaque ouverture reproposerait tout le dossier. */
  const encore = await empreinteDuFichier(nom, 182_344, 1_759_000_000_000);
  if (encore !== empreinte) {
    problemes.push('L’empreinte d’un relevé n’est pas déterministe.');
  }
  /* Et discriminante, sinon un mois chasserait l'autre. */
  const autre = await empreinteDuFichier('Releve_CCP_00055347_202610.pdf', 182_344, 1_759_000_000_000);
  if (autre === empreinte) {
    problemes.push('Deux relevés de mois différents ont la même empreinte.');
  }

  if (EMPREINTES_GARDEES < 240) {
    problemes.push(
      'Moins de 240 empreintes ne couvrent pas cinq ans de quatre comptes mensuels.',
    );
  }
  /*
     La clé est comparée à celle de la synchronisation, et non à une chaîne
     écrite ici : une égalité littérale serait vraie ou fausse à l'écriture et
     ne dirait plus rien le jour où l'une des deux est renommée.
  */
  for (const [nom, clef] of [['la poignée', CLEF_DOSSIER_RELEVES], ['les empreintes', CLEF_VUS]]) {
    if (clef === CLEF_DOSSIER) {
      problemes.push(
        `Le dossier de relevés range ${nom} sous la clé du dossier de synchronisation : ` +
          'choisir l’un effacerait l’autre.',
      );
    }
  }
  return problemes;
}
