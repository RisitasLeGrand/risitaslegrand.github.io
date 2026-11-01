/**
 * Le format de sauvegarde `.cyclades` : construire et relire un fichier.
 *
 * Module **pur** : il ne lit ni IndexedDB, ni le DOM, ni le réseau. On lui donne
 * des magasins et un mot de passe, il rend des octets ; on lui donne des octets
 * et un mot de passe, il rend des magasins. C'est ce qui le rend vérifiable
 * hors navigateur, et c'est aussi ce qui rend démontrable qu'il ne peut pas
 * emporter de secret : il n'a accès à rien d'autre que ce qu'on lui passe.
 *
 * ## La forme du fichier
 *
 * ```
 * CYCLADES-SAUVEGARDE\n   ← ligne de reconnaissance
 * {"format":…,"versionFormat":1,…}\n   ← en-tête, une ligne de JSON lisible
 * <charge utile binaire>
 * ```
 *
 * L'en-tête est **en clair et lisible dans un éditeur de texte**, même quand la
 * charge utile est chiffrée. C'est voulu : retrouver dans six mois ce que
 * contient un fichier, et de quand il date, ne doit pas demander de le
 * déchiffrer. L'en-tête ne porte donc aucune donnée personnelle — des noms de
 * magasins, des compteurs, une date.
 *
 * ## Comprimer puis chiffrer, dans cet ordre
 *
 * L'ordre inverse ne marcherait pas : des données chiffrées ressemblent à du
 * bruit et ne se compressent plus du tout. Comprimer d'abord, c'est aussi ce
 * qui permet aux notes de séance de peser 6 % de leur taille — voir
 * `docs/cyclades/budget-stockage.md`.
 *
 * ## La somme de contrôle porte sur les octets du fichier
 *
 * Et non sur le contenu en clair, ce qui serait le réflexe. Deux raisons :
 *
 *  1. AES-GCM **authentifie déjà** le clair : une altération du chiffré fait
 *     échouer le déchiffrement, sans qu'aucune somme n'ait à le dire.
 *  2. Une empreinte du clair, écrite en clair dans l'en-tête, permettrait de
 *     confirmer une hypothèse sur le contenu d'un fichier chiffré. C'est un
 *     oracle faible, mais gratuit à éviter.
 *
 * La somme sert donc à ce qu'une somme sert vraiment ici : dire si le fichier
 * est arrivé entier. C'est utile dans les deux cas, chiffré ou non.
 */

/*
   La seule dépendance de ce module : les conversions d'octets, qui étaient
   écrites ici et le sont désormais une fois pour tout le projet. Elle ne lui
   retire pas sa pureté — « noyau/octets.ts » ne lit ni base, ni DOM, ni réseau.
*/
import {
  aleatoire as aleatoires,
  base64VersOctets,
  comprimer,
  compressionDisponible,
  concatener,
  decomprimer,
  octetsVersBase64,
} from '../noyau/octets';

export { compressionDisponible };

/* ══════════════════════════════════════════════════════════════════════════
   Le contrat
   ══════════════════════════════════════════════════════════════════════════ */

export const LIGNE_RECONNAISSANCE = 'CYCLADES-SAUVEGARDE';

/**
 * La ligne de reconnaissance d'un **paquet de synchronisation**.
 *
 * Un paquet et une sauvegarde partagent tout ce qui est délicat : compresser
 * puis chiffrer, une somme de contrôle sur les octets du fichier, un sel et un
 * nombre d'itérations par fichier dans l'en-tête. Écrire une seconde
 * implémentation de cette discipline serait la vraie faute de ce chantier — deux
 * chaînes de chiffrement, dont une moins relue, et un bogue qui n'apparaîtrait
 * que dans l'une des deux.
 *
 * Ils ne partagent donc que la ligne qui les distingue. Un paquet présenté comme
 * sauvegarde, ou l'inverse, est refusé avant toute tentative de déchiffrement :
 * les deux n'ont pas le même sens, et restaurer un paquet reviendrait à
 * remplacer sa base par un fragment.
 */
export const LIGNE_PAQUET = 'CYCLADES-PAQUET';

/** Les deux formes reconnues, et aucune autre. */
export type Genre = typeof LIGNE_RECONNAISSANCE | typeof LIGNE_PAQUET;

/**
 * La version du format que ce code sait écrire **et** relire.
 *
 * Un fichier portant une version supérieure est refusé avec un message clair :
 * une version future peut avoir changé le sens d'un champ, et deviner serait la
 * pire des réponses. Un fichier de version inférieure reste lisible.
 */
export const VERSION_FORMAT = 2;

/**
 * Ce que la version 2 change, et pourquoi les deux restent lisibles.
 *
 * ## M-1 — l'en-tête est AUTHENTIFIÉ
 *
 * La version 1 chiffrait sans données associées. L'en-tête n'était donc
 * authentifié par rien : `creeLe`, `branches`, `versionApplication` et les
 * comptes par magasin pouvaient être modifiés dans un éditeur de texte sans
 * que le déchiffrement bronche. La somme de contrôle ne couvre que la charge
 * utile — c'est voulu, et le commentaire en tête de ce module dit pourquoi
 * elle ne doit pas couvrir le clair — mais personne ne couvrait l'en-tête.
 *
 * Un en-tête falsifiable n'est pas une curiosité : il annonce ce qu'un fichier
 * contient, et c'est sur lui que l'écran décide quoi proposer. Changer
 * `branches` revient à faire restaurer une sauvegarde en annonçant qu'elle
 * porte autre chose.
 *
 * ## LA CIRCULARITÉ, ET COMMENT ELLE EST DÉNOUÉE
 *
 * L'en-tête contient la somme de la charge utile, qu'on ne connaît qu'APRÈS
 * avoir chiffré. Il ne peut donc pas servir tel quel de données associées.
 *
 * On authentifie donc la ligne d'en-tête EXACTE, avec la valeur de la somme
 * remplacée par soixante-quatre zéros. Les deux côtés reconstruisent les
 * mêmes octets par la même substitution, et c'est tout ce qu'il faut : la
 * somme, elle, est vérifiée séparément, et elle porte sur le chiffré qu'AES-GCM
 * authentifie déjà.
 *
 * Le choix d'authentifier les OCTETS RÉELS du fichier plutôt qu'une
 * re-sérialisation est délibéré. Deux sérialisations qui doivent coïncider à
 * l'octet près sont une divergence en attente : l'ordre des clés d'un JSON
 * relu n'est garanti par rien, et le jour où une clé change de place, tous les
 * fichiers deviennent illisibles d'un coup.
 *
 * ## M-2 — les comptes des magasins SCELLÉS quittent le clair
 *
 * L'en-tête annonçait `magasins`, un compte par magasin, pour TOUS les
 * magasins. Dans un fichier chiffré, cela veut dire qu'un éditeur de texte
 * lisait combien d'entrées de cycle et combien de prises de traitement le
 * fichier contient, sans aucun mot de passe.
 *
 * Le dépôt énonce déjà le principe ailleurs, à propos des fichiers en clair :
 * « un fichier qui porte un magasin nommé `odysseeSexe` avec un seul
 * enregistrement dit déjà que la personne a répondu, avant tout contenu »
 * (`db.ts`, `MAGASINS_HORS_SAUVEGARDE_EN_CLAIR`). Il vaut autant pour l'en-tête
 * en clair d'un fichier chiffré.
 *
 * Les comptes des magasins scellés quittent donc le clair.
 *
 * ## M-2bis — les NOMS aussi, et le total avec
 *
 * Première version : les comptes partaient, remplacés par un total unique, et
 * les noms restaient dans `branches[].magasins`. La limite était écrite ici
 * plutôt que tue, et le pilote a tranché — aucun nom, aucun compte, total
 * compris.
 *
 * Il a raison deux fois. Le TOTAL dit encore l'ordre de grandeur de ce qui est
 * scellé, et il ne vaut que pour quelqu'un qui en a : « zéro » et « quatre
 * cents » ne disent pas la même chose de la personne. Et le NOM suffit à lui
 * seul : lire qu'un fichier porte le magasin du cycle ou celui des prises de
 * traitement dit que la personne suit l'un ou l'autre, avant même de savoir
 * combien. C'est exactement l'argument que le dépôt tenait déjà pour
 * `odysseeSexe` — nous ne l'avions appliqué qu'à moitié.
 *
 * CE QUE L'EN-TÊTE EN CLAIR GARDE : les magasins non sensibles, nommés et
 * comptés, et `chiffrement` — présent, le fichier est protégé ; `null`, la
 * personne a désactivé le chiffrement en connaissance de cause. La
 * vérification à blanc survit donc : on sait ce qu'est ce fichier, s'il est
 * entier, de quelle version il vient, et s'il faudra un mot de passe.
 *
 * CE QUI DÉMÉNAGE APRÈS LE MOT DE PASSE : l'aperçu détaillé des magasins
 * scellés, noms et comptes. Il se lit dans la charge utile, au moment où la
 * restauration demande de toute façon le mot de passe. Rien n'est perdu ; ce
 * qui était gratuit coûte maintenant ce qu'il devait coûter.
 *
 * ## Pourquoi la v1 reste lisible
 *
 * Parce que les sauvegardes déjà faites sont, par construction, celles dont on
 * a besoin le jour où quelque chose a été perdu. Une version qui ne relirait
 * plus ses propres fichiers d'hier serait un défaut, pas une amélioration.
 */
export const VERSION_SANS_EN_TETE_AUTHENTIFIE = 1;

/** La valeur de somme écrite au moment du chiffrement, puis remplacée. */
const SOMME_EN_ATTENTE = '0'.repeat(64);

/** Déclaration d'une branche présente dans la sauvegarde. */
export interface BrancheSauvegardee {
  id: string;
  /** Version de schéma de ses magasins, pour que la restauration sache migrer. */
  schema: number;
  /** Noms des magasins que cette branche apporte. */
  magasins: string[];
}

export interface ParametresChiffrement {
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  /** Sel **propre à cette sauvegarde**, en base64. Jamais le sel du site. */
  sel: string;
  chiffrement: 'AES-GCM';
  iv: string;
}

export interface EnTeteSauvegarde {
  format: 'cyclades-sauvegarde';
  versionFormat: number;
  /** Version de l'application qui a écrit le fichier. */
  versionApplication: string;
  creeLe: string;
  branches: BrancheSauvegardee[];
  /**
   * Nombre d'enregistrements par magasin — **les scellés exceptés** (M-2).
   *
   * En version 1, tous les magasins y figuraient, y compris ceux du cycle et
   * de la santé : leur compte se lisait dans un éditeur de texte sans mot de
   * passe. Depuis la version 2, les magasins scellés n'y sont plus, et leur
   * total est rendu à part.
   */
  magasins: Record<string, number>;
  /*
     IL N'Y A PAS DE CHAMP POUR LES SCELLÉS, ET C'EST LE POINT DE M-2bis.

     Une première version en gardait le TOTAL — un seul nombre, les comptes par
     magasin ayant déjà quitté le clair. Le pilote l'a écarté, et sa raison est
     D2 : un nombre lisible sans mot de passe dit encore l'ordre de grandeur de
     ce qui est scellé, et il ne vaut que pour quelqu'un qui en a. « Zéro » et
     « quatre cents » ne disent pas la même chose de la personne.

     Il n'y a pas non plus de drapeau « ce fichier contient des données
     scellées ». Il dirait en clair que la personne suit son cycle ou un
     traitement — le même fait, un cran plus bas. La mention neutre que l'écran
     a besoin de lire existe déjà, et c'est `chiffrement` : présent, le fichier
     est protégé et il faudra un mot de passe ; `null`, la personne a désactivé
     le chiffrement en connaissance de cause.

     Ce que portent les magasins scellés — leurs noms comme leurs comptes — se
     lit APRÈS le déchiffrement, dans la charge utile, au moment où l'écran a
     de toute façon demandé le mot de passe pour restaurer.
  */
  /** `null` quand la personne a explicitement désactivé le chiffrement. */
  chiffrement: ParametresChiffrement | null;
  compression: 'gzip' | null;
  sommeDeControle: {
    algorithme: 'SHA-256';
    /** Ce sur quoi elle porte, écrit pour qu'on n'ait pas à le deviner. */
    porte: 'octets-de-la-charge-utile';
    valeur: string;
  };
  /**
   * Ce que le fichier couvre.
   *
   * Pour une sauvegarde : les branches et, le cas échéant, les parcours. Pour un
   * paquet de synchronisation, le même champ porte en plus les métadonnées de
   * l'émetteur — voir « sync/paquet.ts ». Les loger ici évite d'ajouter au
   * format commun un champ qui resterait vide dans toutes les sauvegardes, et
   * que quelqu'un finirait par remplir par erreur.
   */
  portee: { branches: string[]; parcours?: string[] } & Record<string, unknown>;
}

/** Les données à sauvegarder : un tableau d'enregistrements par magasin. */
export type Magasins = Record<string, unknown[]>;

/* ══════════════════════════════════════════════════════════════════════════
   Outillage binaire
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les octets, sous un seul nom.
 *
 * `Uint8Array` est devenu générique sur son tampon, et les API Web mélangent
 * `ArrayBuffer` et `ArrayBufferLike` selon qu'elles allouent ou reçoivent. Un
 * alias unique évite d'avoir à trancher ce débat à chaque signature.
 */
export type Octets = Uint8Array<ArrayBufferLike>;

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

async function sha256(octets: Octets): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', octets as BufferSource);
  return [...new Uint8Array(digest)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

/* ══════════════════════════════════════════════════════════════════════════
   Dérivation de clé
   ══════════════════════════════════════════════════════════════════════════ */

/** Itérations PBKDF2, alignées sur celles du site (recommandation OWASP). */
export const ITERATIONS_PAR_DEFAUT = 600_000;

/**
 * Dérive la clé de la sauvegarde.
 *
 * Le sel est **propre au fichier** et voyage dans son en-tête, avec le nombre
 * d'itérations. C'est ce qui règle l'écueil que le prompt signale : le mot de
 * passe du site peut changer, une ancienne sauvegarde reste ouvrable avec
 * l'ancien mot de passe, parce que tout ce qu'il faut pour redériver sa clé est
 * dans le fichier et nulle part ailleurs.
 */
async function deriver(
  motDePasse: string,
  sel: Octets,
  iterations: number,
): Promise<CryptoKey> {
  const materiel = await crypto.subtle.importKey(
    'raw',
    encodeur.encode(motDePasse) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel as BufferSource, iterations, hash: 'SHA-256' },
    materiel,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Charge utile : un enregistrement JSON par ligne
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La charge utile en clair.
 *
 * Un objet par ligne, préfixé du nom de son magasin. Ce n'est pas un seul grand
 * JSON, et la raison est pratique : un fichier d'un seul objet doit être parsé
 * en entier avant qu'on sache ce qu'il contient, alors qu'un format par lignes
 * se lit, se vérifie et se restaure magasin par magasin, et survit mieux à une
 * troncature — ce qui est resté lisible reste lisible.
 */
function serialiser(magasins: Magasins): Uint8Array<ArrayBuffer> {
  const lignes: string[] = [];
  for (const [nom, enregistrements] of Object.entries(magasins)) {
    for (const enr of enregistrements) {
      lignes.push(JSON.stringify({ m: nom, e: enr }));
    }
  }
  return encodeur.encode(lignes.join('\n'));
}

function deserialiser(octets: Octets): { magasins: Magasins; lignesIllisibles: number } {
  const magasins: Magasins = {};
  let lignesIllisibles = 0;
  const texte = decodeur.decode(octets);
  for (const ligne of texte.split('\n')) {
    if (!ligne.trim()) continue;
    try {
      const { m, e } = JSON.parse(ligne) as { m: string; e: unknown };
      if (typeof m !== 'string') {
        lignesIllisibles += 1;
        continue;
      }
      (magasins[m] ??= []).push(e);
    } catch {
      // Une ligne illisible est comptée et laissée de côté : perdre un
      // enregistrement vaut mieux que refuser tout le fichier, et le compte
      // remonte à l'interface pour qu'elle le dise.
      lignesIllisibles += 1;
    }
  }
  return { magasins, lignesIllisibles };
}

/* ══════════════════════════════════════════════════════════════════════════
   Écriture
   ══════════════════════════════════════════════════════════════════════════ */

export interface OptionsEcriture {
  magasins: Magasins;
  branches: BrancheSauvegardee[];
  versionApplication: string;
  portee: EnTeteSauvegarde['portee'];
  /**
   * Les magasins SCELLÉS, pour que leurs comptes quittent le clair (M-2).
   *
   * Donnés par l'appelant, et non lus ici : ce module est PUR, et importer le
   * registre du coffre lui ferait connaître IndexedDB par la bande. C'est la
   * même raison qui fait qu'il ne connaît aucune liste de magasins — il n'a
   * accès qu'à ce qu'on lui passe, et c'est ce qui rend démontrable qu'il ne
   * peut pas emporter de secret.
   *
   * Omise, aucun magasin n'est traité comme scellé : un appelant qui n'en sait
   * rien écrit un fichier de version 2 dont tous les comptes sont en clair,
   * ce qui est le comportement de la version 1 et ne surprend personne.
   */
  magasinsScelles?: readonly string[];
  /**
   * Écrire dans une version ANTÉRIEURE du format. Par défaut, la courante.
   *
   * ## Pourquoi cette porte existe, et ce qu'elle garde
   *
   * La version 2 promet de relire les fichiers de version 1. Une promesse de
   * compatibilité qui n'est pas MESURÉE est une promesse qui n'existe pas : on
   * la croit tenue jusqu'au jour où quelqu'un a besoin d'une sauvegarde
   * ancienne, c'est-à-dire le jour où il a déjà perdu quelque chose.
   *
   * Or un essai ne peut pas fabriquer un fichier de version 1 sans ce
   * paramètre : la dérivation de clé n'est pas exportée, et la réécrire dans
   * l'essai serait exactement la duplication que ce module refuse pour le
   * chiffrement — « deux chaînes de chiffrement, dont une moins relue, et un
   * bogue qui n'apparaîtrait que dans l'une des deux ».
   *
   * Elle sert donc à éprouver la relecture des anciens fichiers avec de VRAIS
   * anciens fichiers. Rien dans l'application ne la passe, et le défaut vaut
   * la version courante : personne n'écrit une version périmée par
   * inadvertance.
   */
  versionFormat?: number;
  /**
   * Le mot de passe du site. `null` désactive explicitement le chiffrement —
   * l'appelant doit alors avoir averti la personne.
   */
  motDePasse: string | null;
  iterations?: number;
  /** Pour les essais : fige la date et les aléas. */
  maintenant?: Date;
  /**
   * Sauvegarde (par défaut) ou paquet de synchronisation. Seule la ligne de
   * reconnaissance change : tout le reste du format est délibérément commun.
   */
  genre?: Genre;
}

export interface Sauvegarde {
  octets: Uint8Array<ArrayBuffer>;
  entete: EnTeteSauvegarde;
  /** Empreinte courte à montrer à la personne, pour comparer deux fichiers. */
  empreinteCourte: string;
  tailleClair: number;
  tailleFichier: number;
}

/**
 * La ligne d'en-tête telle qu'elle sera écrite, et les octets à authentifier.
 *
 * Les deux ne diffèrent que par la valeur de la somme : les données associées
 * la portent en zéros, puisqu'on ne la connaît pas encore au moment de
 * chiffrer. La relecture refait exactement la même substitution sur la ligne
 * LUE DANS LE FICHIER, ce qui garantit que les deux côtés authentifient les
 * mêmes octets sans jamais re-sérialiser.
 */
function donneesAssociees(ligne: string): Uint8Array {
  return encodeur.encode(ligne);
}

/** Remplace la valeur de la somme par des zéros, dans une ligne d'en-tête. */
function sommeEnZeros(ligne: string): string {
  return ligne.replace(
    /("valeur":")[0-9a-f]{64}(")/,
    (_tout, avant: string, apres: string) => `${avant}${SOMME_EN_ATTENTE}${apres}`,
  );
}

export async function ecrire(options: OptionsEcriture): Promise<Sauvegarde> {
  const maintenant = options.maintenant ?? new Date();

  const clair = serialiser(options.magasins);
  const compresse = compressionDisponible() ? await comprimer(clair) : clair;

  /*
     LES COMPTES SE SÉPARENT AVANT TOUT LE RESTE — M-2. Ce qui est scellé n'est
     compté qu'en bloc ; ce qui ne l'est pas garde son compte nommé, parce que
     c'est ce qui rend la vérification à blanc utile.
  */
  const scelles = new Set(options.magasinsScelles ?? []);
  const comptes = Object.entries(options.magasins).map(
    ([nom, v]) => [nom, v.length] as const,
  );
  const magasinsEnClair = Object.fromEntries(comptes.filter(([nom]) => !scelles.has(nom)));

  /*
     ET LES NOMS AUSSI — M-2bis. Les comptes avaient quitté le clair, les NOMS y
     restaient : `branches[].magasins` les déclarait tous. Or un nom suffit. Lire
     dans un éditeur de texte qu'un fichier porte le magasin du cycle ou celui
     des prises de traitement dit déjà, sans aucun mot de passe, que la personne
     suit l'un ou l'autre — avant même de savoir combien.

     LE FILTRAGE EST ICI, ET NON CHEZ L'APPELANT, parce que « ecrire » a deux
     appelants : la sauvegarde et le paquet de synchronisation. Une règle de
     confidentialité qui dépend du souvenir de chaque appelant tient jusqu'au
     troisième. Celle-ci tient par construction, et le module reste pur : c'est
     l'appelant qui dit QUELS magasins sont scellés, ce module ne fait
     qu'appliquer.

     Ce que la branche déclare reste donc vrai, simplement incomplet en clair :
     elle n'annonce aucun magasin que le fichier ne porte pas. Le reste se lit
     dans la charge utile, après le mot de passe.
  */
  const branchesEnClair = options.branches.map((branche) => ({
    ...branche,
    magasins: branche.magasins.filter((nom) => !scelles.has(nom)),
  }));

  let chargeUtile: Octets = compresse;
  let chiffrement: ParametresChiffrement | null = null;
  /*
     L'EN-TÊTE EST CONSTRUIT AVANT LE CHIFFREMENT, et c'est tout le dessin de
     M-1 : il doit exister pour servir de données associées. Sa somme n'est pas
     encore connue — elle porte sur le chiffré — donc elle part en zéros et
     sera remplacée après.
  */
  const version = options.versionFormat ?? VERSION_FORMAT;
  const enTeteSansSomme = (parametres: ParametresChiffrement | null) => ({
    format: 'cyclades-sauvegarde' as const,
    versionFormat: version,
    versionApplication: options.versionApplication,
    creeLe: maintenant.toISOString(),
    branches:
      version > VERSION_SANS_EN_TETE_AUTHENTIFIE ? branchesEnClair : options.branches,
    /*
       EN VERSION 1, TOUS LES COMPTES SONT EN CLAIR — c'est précisément ce que
       M-2 corrige, et un fichier écrit en version 1 doit l'être comme un
       vrai, sans quoi l'essai de compatibilité éprouverait un fichier qui n'a
       jamais existé.
    */
    magasins: version > VERSION_SANS_EN_TETE_AUTHENTIFIE
      ? magasinsEnClair
      : Object.fromEntries(comptes),
    chiffrement: parametres,
    compression: compressionDisponible() ? ('gzip' as const) : null,
    sommeDeControle: {
      algorithme: 'SHA-256' as const,
      porte: 'octets-de-la-charge-utile' as const,
      valeur: SOMME_EN_ATTENTE,
    },
    portee: options.portee,
  });

  if (options.motDePasse !== null) {
    const iterations = options.iterations ?? ITERATIONS_PAR_DEFAUT;
    const sel = aleatoires(16);
    const iv = aleatoires(12);
    const cle = await deriver(options.motDePasse, sel, iterations);
    chiffrement = {
      kdf: 'PBKDF2-SHA256',
      iterations,
      sel: octetsVersBase64(sel),
      chiffrement: 'AES-GCM',
      iv: octetsVersBase64(iv),
    };
    /*
       Les données associées sont la ligne d'en-tête COMPLÈTE, paramètres de
       chiffrement compris. Le sel et le vecteur d'initialisation sont donc
       authentifiés eux aussi : les changer ferait échouer le déchiffrement au
       lieu de produire du bruit.
    */
    const aad =
      version > VERSION_SANS_EN_TETE_AUTHENTIFIE
        ? donneesAssociees(JSON.stringify(enTeteSansSomme(chiffrement)))
        : undefined;
    const chiffre = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        ...(aad ? { additionalData: aad as BufferSource } : {}),
      },
      cle,
      compresse as BufferSource,
    );
    chargeUtile = new Uint8Array(chiffre);
  }

  const somme = await sha256(chargeUtile);

  /*
     LA SOMME PREND SA PLACE, et la ligne écrite ne diffère de celle qui a
     servi de données associées que par ces soixante-quatre signes. La
     relecture n'a donc qu'à les remettre en zéros pour retrouver les mêmes
     octets — sans re-sérialiser, et sans dépendre de l'ordre des clés.
  */
  const entete: EnTeteSauvegarde = { ...enTeteSansSomme(chiffrement) };
  entete.sommeDeControle = {
    algorithme: 'SHA-256',
    porte: 'octets-de-la-charge-utile',
    valeur: somme,
  };

  const octets = concatener([
    encodeur.encode(`${options.genre ?? LIGNE_RECONNAISSANCE}\n`),
    encodeur.encode(`${JSON.stringify(entete)}\n`),
    chargeUtile,
  ]);

  return {
    octets,
    entete,
    empreinteCourte: somme.slice(0, 12),
    tailleClair: clair.length,
    tailleFichier: octets.length,
  };
}

/** Le nom de fichier conventionnel : `cyclades-sauvegarde-AAAA-MM-JJ-HHmm`. */
export function nomDeFichier(maintenant = new Date()): string {
  const d = maintenant;
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `cyclades-sauvegarde-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}.cyclades`
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Lecture
   ══════════════════════════════════════════════════════════════════════════ */

/** Pourquoi un fichier a été refusé. Chaque cas a son message, aucun n'est muet. */
export type MotifDeRefus =
  | 'pas-une-sauvegarde'
  | 'entete-illisible'
  | 'version-trop-recente'
  | 'somme-de-controle'
  | 'mot-de-passe'
  | 'charge-utile-illisible';

export class SauvegardeRefusee extends Error {
  constructor(
    readonly motif: MotifDeRefus,
    message: string,
    readonly entete?: EnTeteSauvegarde,
  ) {
    super(message);
    this.name = 'SauvegardeRefusee';
  }
}

/**
 * Lit l'en-tête seul, sans mot de passe et sans toucher à la charge utile.
 *
 * C'est la « vérification à blanc » du prompt, dans sa première moitié : savoir
 * ce que contient un fichier avant de demander quoi que ce soit à la personne,
 * et avant d'appliquer quoi que ce soit.
 */
/**
 * La ligne d'en-tête telle qu'elle est écrite dans le fichier, non reparsée.
 *
 * Elle sert aux données associées de la version 2 : ce sont les OCTETS RÉELS
 * qui ont été authentifiés, et les retrouver par une re-sérialisation serait
 * parier sur l'ordre des clés d'un JSON relu — que rien ne garantit.
 */
export function ligneDEnTete(octets: Octets): string {
  const sautLigne = 10;
  const premier = octets.indexOf(sautLigne);
  const second = premier < 0 ? -1 : octets.indexOf(sautLigne, premier + 1);
  if (premier < 0 || second < 0) {
    throw new SauvegardeRefusee('entete-illisible', 'L’en-tête de la sauvegarde est tronqué.');
  }
  return decodeur.decode(octets.subarray(premier + 1, second));
}

export function lireEnTete(octets: Octets, genreAttendu?: Genre): EnTeteSauvegarde {
  const sautLigne = 10;
  const premier = octets.indexOf(sautLigne);
  if (premier < 0) {
    throw new SauvegardeRefusee('pas-une-sauvegarde', 'Ce fichier n’a pas la forme attendue.');
  }
  const reconnaissance = decodeur.decode(octets.subarray(0, premier)).trim();
  if (reconnaissance !== LIGNE_RECONNAISSANCE && reconnaissance !== LIGNE_PAQUET) {
    throw new SauvegardeRefusee(
      'pas-une-sauvegarde',
      'Ce fichier n’est pas une sauvegarde Cyclades.',
    );
  }
  /*
     Le genre attendu est vérifié ici, avant de toucher à la charge utile : un
     paquet restauré comme sauvegarde remplacerait la base par un fragment, et
     une sauvegarde fusionnée comme paquet n'aurait pas de sens non plus. Les
     deux refus sont donc des refus de forme, pas des erreurs de contenu.
  */
  if (genreAttendu && reconnaissance !== genreAttendu) {
    throw new SauvegardeRefusee(
      'pas-une-sauvegarde',
      genreAttendu === LIGNE_PAQUET
        ? 'Ce fichier est une sauvegarde Cyclades, pas un paquet de synchronisation. ' +
          'Une sauvegarde se restaure depuis l’écran de progression ; elle ne se fusionne pas.'
        : 'Ce fichier est un paquet de synchronisation, pas une sauvegarde. ' +
          'Le restaurer remplacerait votre base par un fragment : il se fusionne, ' +
          'depuis l’écran « Appareils et synchronisation ».',
    );
  }
  const second = octets.indexOf(sautLigne, premier + 1);
  if (second < 0) {
    throw new SauvegardeRefusee('entete-illisible', 'L’en-tête de la sauvegarde est tronqué.');
  }
  let entete: EnTeteSauvegarde;
  try {
    entete = JSON.parse(decodeur.decode(octets.subarray(premier + 1, second)));
  } catch {
    throw new SauvegardeRefusee('entete-illisible', 'L’en-tête de la sauvegarde est illisible.');
  }
  if (entete?.format !== 'cyclades-sauvegarde') {
    throw new SauvegardeRefusee(
      'pas-une-sauvegarde',
      'Ce fichier n’est pas une sauvegarde Cyclades.',
    );
  }
  if (typeof entete.versionFormat !== 'number' || entete.versionFormat > VERSION_FORMAT) {
    throw new SauvegardeRefusee(
      'version-trop-recente',
      `Cette sauvegarde a été écrite par une version plus récente de Cyclades ` +
        `(format ${entete.versionFormat}, cette version lit jusqu’au ${VERSION_FORMAT}). ` +
        `Mettez Cyclades à jour avant de la restaurer : deviner le sens d’un champ ` +
        `inconnu ferait plus de dégâts que de refuser.`,
      entete,
    );
  }
  return entete;
}

/** Où commence la charge utile : après les deux premières lignes. */
function debutChargeUtile(octets: Octets): number {
  const premier = octets.indexOf(10);
  const second = octets.indexOf(10, premier + 1);
  return second + 1;
}

export interface Verification {
  entete: EnTeteSauvegarde;
  chiffree: boolean;
  /** La somme de contrôle du fichier correspond-elle à son en-tête ? */
  intacte: boolean;
  tailleChargeUtile: number;
}

/**
 * Vérifie un fichier **sans rien appliquer et sans mot de passe**.
 *
 * C'est le bouton « Vérifier cette sauvegarde » : il dit si le fichier est
 * entier et ce qu'il annonce contenir. Il ne peut pas dire si le mot de passe
 * est le bon — cela demande de déchiffrer, donc d'appeler `relire`.
 */
export async function verifier(octets: Octets, genreAttendu?: Genre): Promise<Verification> {
  const entete = lireEnTete(octets, genreAttendu);
  const chargeUtile = octets.subarray(debutChargeUtile(octets));
  const somme = await sha256(chargeUtile);
  return {
    entete,
    chiffree: entete.chiffrement !== null,
    intacte: somme === entete.sommeDeControle?.valeur,
    tailleChargeUtile: chargeUtile.length,
  };
}

export interface Relecture {
  entete: EnTeteSauvegarde;
  magasins: Magasins;
  /** Lignes que la relecture n'a pas pu interpréter. Zéro en temps normal. */
  lignesIllisibles: number;
}

/**
 * Relit une sauvegarde en entier.
 *
 * `motDePasse` est celui du **fichier**, pas celui du site : une sauvegarde
 * faite avant un changement de mot de passe s'ouvre avec l'ancien, et c'est le
 * cas normal, pas une exception.
 */
export async function relire(
  octets: Octets,
  motDePasse?: string,
  genreAttendu?: Genre,
): Promise<Relecture> {
  const { entete, intacte } = await verifier(octets, genreAttendu);
  if (!intacte) {
    throw new SauvegardeRefusee(
      'somme-de-controle',
      'Ce fichier est incomplet ou abîmé : sa somme de contrôle ne correspond pas. ' +
        'Il a probablement été tronqué pendant un transfert.',
      entete,
    );
  }

  let chargeUtile: Octets = octets.slice(debutChargeUtile(octets));

  if (entete.chiffrement) {
    if (!motDePasse) {
      throw new SauvegardeRefusee(
        'mot-de-passe',
        'Cette sauvegarde est chiffrée : son mot de passe est nécessaire.',
        entete,
      );
    }
    const cle = await deriver(
      motDePasse,
      base64VersOctets(entete.chiffrement.sel),
      entete.chiffrement.iterations,
    );
    /*
       LES DONNÉES ASSOCIÉES, POUR LA VERSION 2 ET AU-DELÀ — M-1.

       On reprend la ligne d'en-tête TELLE QU'ELLE EST DANS LE FICHIER et on y
       remet la somme en zéros : ce sont exactement les octets que l'écriture a
       authentifiés. Un en-tête modifié — une date, une branche, un compte, le
       sel lui-même — fait échouer le déchiffrement, là où la version 1 le
       laissait passer sans un mot.

       Un fichier de version 1 n'a pas été écrit avec données associées : lui
       en passer le rendrait illisible. C'est la version du fichier qui décide,
       jamais la version de ce code, et c'est ce qui permet de relire les
       sauvegardes d'hier — celles dont on a justement besoin le jour où
       quelque chose a été perdu.
    */
    const aad =
      entete.versionFormat > VERSION_SANS_EN_TETE_AUTHENTIFIE
        ? donneesAssociees(sommeEnZeros(ligneDEnTete(octets)))
        : undefined;
    try {
      const clair = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: base64VersOctets(entete.chiffrement.iv) as BufferSource,
          ...(aad ? { additionalData: aad as BufferSource } : {}),
        },
        cle,
        chargeUtile as BufferSource,
      );
      chargeUtile = new Uint8Array(clair);
    } catch {
      /*
         DEUX CAUSES, UN SEUL MESSAGE, ET C'EST DÉLIBÉRÉ. Depuis la version 2,
         cet échec peut venir d'un mot de passe qui n'ouvre pas, ou d'un
         en-tête modifié. Les distinguer demanderait de réessayer sans les
         données associées pour voir — c'est-à-dire d'accepter une fois ce
         qu'on refuse, et de le dire à qui a modifié le fichier. Le message
         reste donc celui du mot de passe, qui est la cause de loin la plus
         probable et la seule que la personne puisse corriger.
      */
      throw new SauvegardeRefusee(
        'mot-de-passe',
        'Ce mot de passe n’ouvre pas cette sauvegarde. Si elle est antérieure à un ' +
          'changement de mot de passe, essayez l’ancien : une sauvegarde garde celui ' +
          'qu’elle avait le jour où elle a été faite.',
        entete,
      );
    }
  }

  if (entete.compression === 'gzip') {
    try {
      chargeUtile = await decomprimer(chargeUtile);
    } catch {
      throw new SauvegardeRefusee(
        'charge-utile-illisible',
        'La charge utile de cette sauvegarde n’a pas pu être décompressée.',
        entete,
      );
    }
  }

  const { magasins, lignesIllisibles } = deserialiser(chargeUtile);
  return { entete, magasins, lignesIllisibles };
}
