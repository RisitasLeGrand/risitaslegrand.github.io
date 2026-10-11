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
export const VERSION_FORMAT = 1;

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
  /** Nombre d'enregistrements par magasin, pour la vérification à blanc. */
  magasins: Record<string, number>;
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

/** Un tampon neuf de `n` octets aléatoires. */
function aleatoires(n: number): Uint8Array<ArrayBuffer> {
  const tampon = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(tampon);
  return tampon;
}

function octetsVersBase64(octets: Octets): string {
  let binaire = '';
  // Par tranches : une chaîne d'appel avec des centaines de milliers
  // d'arguments dépasse la pile.
  const TRANCHE = 0x8000;
  for (let i = 0; i < octets.length; i += TRANCHE) {
    binaire += String.fromCharCode(...octets.subarray(i, i + TRANCHE));
  }
  return btoa(binaire);
}

function base64VersOctets(b64: string): Uint8Array<ArrayBuffer> {
  const binaire = atob(b64);
  const octets = new Uint8Array(new ArrayBuffer(binaire.length));
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

function concatener(morceaux: Octets[]): Uint8Array<ArrayBuffer> {
  const total = morceaux.reduce((s, m) => s + m.length, 0);
  const sortie = new Uint8Array(new ArrayBuffer(total));
  let decalage = 0;
  for (const m of morceaux) {
    sortie.set(m, decalage);
    decalage += m.length;
  }
  return sortie;
}

async function parcourir(flux: ReadableStream<Octets>): Promise<Uint8Array<ArrayBuffer>> {
  const morceaux: Octets[] = [];
  const lecteur = flux.getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    if (value) morceaux.push(value);
  }
  return concatener(morceaux);
}

/**
 * Compression et décompression gzip par les flux natifs du navigateur.
 *
 * `CompressionStream` est disponible partout où l'on vise, et dans Node depuis
 * la version 18 — ce qui permet d'essayer le format en ligne de commande.
 * `compressionDisponible()` existe pour le repli : un fichier non compressé
 * reste un fichier valide, l'en-tête le dit.
 */
export const compressionDisponible = (): boolean =>
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function comprimer(octets: Octets): Promise<Uint8Array<ArrayBuffer>> {
  const flux = new Blob([octets as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return parcourir(flux as ReadableStream<Octets>);
}

async function decomprimer(octets: Octets): Promise<Uint8Array<ArrayBuffer>> {
  const flux = new Blob([octets as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return parcourir(flux as ReadableStream<Octets>);
}

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

export async function ecrire(options: OptionsEcriture): Promise<Sauvegarde> {
  const maintenant = options.maintenant ?? new Date();

  const clair = serialiser(options.magasins);
  const compresse = compressionDisponible() ? await comprimer(clair) : clair;

  let chargeUtile: Octets = compresse;
  let chiffrement: ParametresChiffrement | null = null;

  if (options.motDePasse !== null) {
    const iterations = options.iterations ?? ITERATIONS_PAR_DEFAUT;
    const sel = aleatoires(16);
    const iv = aleatoires(12);
    const cle = await deriver(options.motDePasse, sel, iterations);
    const chiffre = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      cle,
      compresse as BufferSource,
    );
    chargeUtile = new Uint8Array(chiffre);
    chiffrement = {
      kdf: 'PBKDF2-SHA256',
      iterations,
      sel: octetsVersBase64(sel),
      chiffrement: 'AES-GCM',
      iv: octetsVersBase64(iv),
    };
  }

  const somme = await sha256(chargeUtile);

  const entete: EnTeteSauvegarde = {
    format: 'cyclades-sauvegarde',
    versionFormat: VERSION_FORMAT,
    versionApplication: options.versionApplication,
    creeLe: maintenant.toISOString(),
    branches: options.branches,
    magasins: Object.fromEntries(
      Object.entries(options.magasins).map(([nom, v]) => [nom, v.length]),
    ),
    chiffrement,
    compression: compressionDisponible() ? 'gzip' : null,
    sommeDeControle: { algorithme: 'SHA-256', porte: 'octets-de-la-charge-utile', valeur: somme },
    portee: options.portee,
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
    try {
      const clair = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64VersOctets(entete.chiffrement.iv) as BufferSource },
        cle,
        chargeUtile as BufferSource,
      );
      chargeUtile = new Uint8Array(clair);
    } catch {
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
