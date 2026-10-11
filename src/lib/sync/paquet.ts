/**
 * Le paquet de synchronisation : ce qu'un appareil envoie à l'autre.
 *
 * ## Il réutilise le format de sauvegarde, délibérément
 *
 * Un paquet et une sauvegarde `.cyclades` partagent tout ce qui est délicat :
 * compresser **puis** chiffrer, une somme de contrôle sur les octets du
 * fichier, un sel et un nombre d'itérations propres au fichier dans l'en-tête
 * en clair. Écrire une seconde implémentation de cette discipline serait la
 * vraie faute de ce chantier : deux chaînes de chiffrement, dont une moins
 * relue, et un bogue qui n'apparaîtrait que dans l'une des deux.
 *
 * Ce module n'ajoute donc que ce qu'une **fusion** exige et qu'une restauration
 * n'exigeait pas : qui parle, quel schéma il parle, et quelle tranche d'horloge
 * le paquet couvre. Les deux formes se distinguent par leur seule ligne de
 * reconnaissance, vérifiée avant tout déchiffrement — un paquet restauré comme
 * sauvegarde remplacerait la base par un fragment.
 *
 * ## Le sel voyage avec le paquet
 *
 * Vérifié dans le code du build : le sel de dérivation est régénéré à **chaque
 * construction** du site (`scripts/build-content.mjs`). Deux appareils ouverts
 * sur deux versions du site n'ont donc pas la même clé de session, même avec le
 * même mot de passe. Un paquet qui s'appuierait sur « la clé courante » serait
 * illisible dès qu'une version diffère — c'est-à-dire exactement quand on
 * synchronise après une mise à jour. Il porte donc son propre sel, comme une
 * sauvegarde, et c'est le mot de passe qui fait le lien.
 *
 * ## Il n'est pas un delta
 *
 * Un paquet porte les opérations **d'une tranche d'horloge**, pas une
 * différence calculée contre l'état de l'autre. Calculer une différence
 * demanderait de connaître l'état de l'autre avant de lui parler, donc un
 * aller-retour de plus, et surtout une réponse à « que sait-il déjà ? » qui est
 * fausse dès qu'un troisième appareil existe. L'idempotence de la fusion rend ce
 * calcul inutile : envoyer trop n'a aucun coût de justesse, seulement de
 * volume, et le volume se borne par la tranche.
 */
import {
  ecrire,
  LIGNE_PAQUET,
  lireEnTete,
  relire,
  SauvegardeRefusee,
  verifier,
  type EnTeteSauvegarde,
  type Octets,
} from '../sauvegarde/format';
import type { Operation } from '../noyau/operations';
import type { Reglages } from '../noyau/fusion';

/** Ce qu'un paquet transporte. Deux « magasins » au sens du format. */
export interface ContenuDePaquet {
  operations: Operation[];
  /** Les réglages versionnés, tels que la fusion les attend. */
  reglages: Reglages;
}

export interface MetadonneesDePaquet {
  /** L'appareil émetteur, pour que le receveur sache de qui il tient quoi. */
  appareil: string;
  /** Le nom que la personne a donné à cet appareil. Pour l'écran, pas pour la fusion. */
  nomAppareil?: string;
  /**
   * La version de schéma de la base émettrice.
   *
   * Un paquet venu d'un schéma **plus récent** est refusé : une opération d'un
   * type qu'on ne connaît pas encore serait recopiée sans être comprise, et
   * l'état dérivé recalculé par-dessus serait faux sans que rien ne le dise.
   */
  schema: number;
  /** La tranche d'horloge couverte, bornes encodées et incluses. */
  tranche: { de: string; a: string };
  /** L'empreinte d'état de l'émetteur au moment de l'envoi. */
  empreinte: string;
}

export const VERSION_PAQUET = 1;

export interface OptionsDeFabrication extends MetadonneesDePaquet {
  contenu: ContenuDePaquet;
  motDePasse: string;
  versionApplication: string;
  iterations?: number;
  maintenant?: Date;
}

export interface Paquet {
  octets: Uint8Array<ArrayBuffer>;
  entete: EnTeteSauvegarde;
  metadonnees: MetadonneesDePaquet;
  /** Pour l'écran : « 14 opérations, 3,2 Kio ». */
  operations: number;
  tailleFichier: number;
}

/**
 * Les métadonnées voyagent dans la **portée** de l'en-tête de sauvegarde.
 *
 * Le format de sauvegarde porte déjà un champ `portee` destiné à dire ce que le
 * fichier couvre. Y loger les métadonnées du paquet évite d'ajouter un champ au
 * format commun pour un seul de ses deux usages — et donc d'avoir un champ qui
 * reste vide dans toutes les sauvegardes, que quelqu'un finirait par remplir
 * par erreur.
 */
const CLEF_PAQUET = 'paquet';

type PorteeAvecPaquet = EnTeteSauvegarde['portee'] & {
  [CLEF_PAQUET]?: MetadonneesDePaquet & { versionPaquet: number };
};

export async function fabriquer(options: OptionsDeFabrication): Promise<Paquet> {
  const { contenu, motDePasse, versionApplication, iterations, maintenant } = options;
  const metadonnees: MetadonneesDePaquet = {
    appareil: options.appareil,
    nomAppareil: options.nomAppareil,
    schema: options.schema,
    tranche: options.tranche,
    empreinte: options.empreinte,
  };

  const sauvegarde = await ecrire({
    genre: LIGNE_PAQUET,
    magasins: {
      operations: contenu.operations,
      // Les réglages sont un dictionnaire, pas une liste : on l'enveloppe dans
      // un tableau d'un élément plutôt que d'inventer une seconde forme de
      // charge utile. Le format n'a ainsi qu'une seule façon de se lire.
      reglages: [contenu.reglages],
    },
    branches: [],
    versionApplication,
    portee: { branches: [], [CLEF_PAQUET]: { ...metadonnees, versionPaquet: VERSION_PAQUET } },
    motDePasse,
    iterations,
    maintenant,
  });

  return {
    octets: sauvegarde.octets,
    entete: sauvegarde.entete,
    metadonnees,
    operations: contenu.operations.length,
    tailleFichier: sauvegarde.tailleFichier,
  };
}

/**
 * Lit les métadonnées **sans déchiffrer**.
 *
 * C'est ce qui permet à l'écran d'annoncer « reçu de Téléphone, 11 opérations »
 * avant de demander quoi que ce soit, et surtout de refuser un paquet d'un
 * schéma plus récent sans en avoir déchiffré une ligne.
 */
export function lireMetadonnees(octets: Octets): MetadonneesDePaquet & { versionPaquet: number } {
  const entete = lireEnTete(octets, LIGNE_PAQUET);
  const portee = entete.portee as PorteeAvecPaquet;
  const brut = portee[CLEF_PAQUET];
  if (!brut) {
    throw new SauvegardeRefusee(
      'entete-illisible',
      'Ce paquet n’annonce pas son appareil émetteur : il est illisible.',
    );
  }
  return brut;
}

export interface Apercu {
  metadonnees: MetadonneesDePaquet & { versionPaquet: number };
  chiffre: boolean;
  intact: boolean;
  tailleFichier: number;
}

/** L'aperçu d'un paquet : ce qu'on peut en dire avant d'avoir le mot de passe. */
export async function apercu(octets: Octets): Promise<Apercu> {
  const metadonnees = lireMetadonnees(octets);
  const { chiffree, intacte } = await verifier(octets, LIGNE_PAQUET);
  return {
    metadonnees,
    chiffre: chiffree,
    intact: intacte,
    tailleFichier: octets.length,
  };
}

export interface PaquetOuvert {
  metadonnees: MetadonneesDePaquet & { versionPaquet: number };
  contenu: ContenuDePaquet;
  /** Lignes que la relecture n'a pas su interpréter. Zéro en temps normal. */
  lignesIllisibles: number;
}

/**
 * Ouvre un paquet : vérifie, déchiffre, et contrôle le schéma.
 *
 * `schemaLocal` est la version de la base qui recevra. Un paquet plus récent est
 * **refusé**, et le message dit quoi faire : mettre à jour cet appareil. Le
 * laisser passer serait recopier des opérations d'un type inconnu, puis
 * recalculer un état dérivé par-dessus — faux, et silencieusement.
 *
 * Un paquet plus **ancien** est accepté : les opérations d'un schéma antérieur
 * restent intelligibles, c'est tout le point d'un journal immuable.
 */
export async function ouvrir(
  octets: Octets,
  motDePasse: string,
  schemaLocal: number,
): Promise<PaquetOuvert> {
  const metadonnees = lireMetadonnees(octets);
  if (metadonnees.versionPaquet > VERSION_PAQUET) {
    throw new SauvegardeRefusee(
      'version-trop-recente',
      `Ce paquet est au format ${metadonnees.versionPaquet}, et cet appareil lit jusqu’au ` +
        `format ${VERSION_PAQUET}. Mettez à jour Cyclades ici avant de synchroniser.`,
    );
  }
  if (metadonnees.schema > schemaLocal) {
    throw new SauvegardeRefusee(
      'version-trop-recente',
      `L’autre appareil est en version ${metadonnees.schema} et celui-ci en version ` +
        `${schemaLocal}. Ouvrez Cyclades ici pour le mettre à jour, puis recommencez : ` +
        'fusionner maintenant recopierait des données que cette version ne sait pas lire.',
    );
  }

  const { magasins, lignesIllisibles } = await relire(octets, motDePasse, LIGNE_PAQUET);
  const operations = (magasins.operations ?? []) as Operation[];
  const reglages = ((magasins.reglages ?? [])[0] ?? {}) as Reglages;
  return { metadonnees, contenu: { operations, reglages }, lignesIllisibles };
}

/** Le nom d'un paquet enregistré sur disque, pour le transport manuel. */
export function nomDeFichier(appareil: string, maintenant = new Date()): string {
  const d = maintenant;
  const deuxChiffres = (n: number) => String(n).padStart(2, '0');
  const horodatage =
    `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}` +
    `-${deuxChiffres(d.getHours())}h${deuxChiffres(d.getMinutes())}`;
  // L'appareil est dans le nom : avec trois appareils, « paquet-2026-10-11 »
  // trois fois dans un dossier de téléchargements ne dit plus rien.
  return `cyclades-${appareil.toLowerCase()}-${horodatage}.paquet`;
}

/**
 * La tranche d'horloge à envoyer.
 *
 * Deux cas, et un seul choix à faire. Si l'on sait ce que l'autre a déjà vu —
 * l'appairage l'a mémorisé —, on part de là. Sinon on envoie tout : c'est le
 * cas du premier contact, et c'est aussi le seul qui soit sûr, puisqu'on ne
 * peut pas deviner ce qu'un appareil inconnu possède.
 *
 * `BORNE_HAUTE` est le dernier instant représentable par l'encodage de
 * l'horloge, et non une date arbitraire : une tranche « jusqu'à maintenant »
 * exclurait les opérations émises pendant la fabrication du paquet.
 */
export const BORNE_BASSE = '000000000000000-0000';
export const BORNE_HAUTE = '999999999999999-ZZZZ';

export function tranche(depuis?: string): { de: string; a: string } {
  return { de: depuis ?? BORNE_BASSE, a: BORNE_HAUTE };
}

export function dansLaTranche(hlc: string, bornes: { de: string; a: string }): boolean {
  return hlc >= bornes.de && hlc <= bornes.a;
}
