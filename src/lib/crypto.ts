/**
 * Déchiffrement côté navigateur (API Web Crypto native, aucune dépendance).
 *
 * Le contenu publié sur GitHub Pages est chiffré en AES-GCM. La clé est
 * redérivée ici, en mémoire, à partir du mot de passe saisi et du sel public
 * publié dans « data/cle.json ».
 */

export interface ParametresCle {
  v: number;
  kdf: string;
  iterations: number;
  sel: string;
  chiffrement: string;
  temoin: Blob;
}

export interface Blob {
  iv: string;
  ct: string;
  /**
   * La compression appliquée AVANT le chiffrement, s'il y en a une.
   *
   * Absente, le bloc est exactement ce qu'il a toujours été : les fichiers
   * déjà publiés restent lisibles, et les petits fichiers gardent la forme
   * d'avant à l'octet près. C'est pourquoi cette information voyage avec le
   * bloc plutôt que dans « cle.json » : un fichier dit lui-même comment il est
   * fait, et une publication partielle ne peut pas rendre les autres illisibles.
   *
   * Seul « gzip » est écrit aujourd'hui. Brotli comprime 1,4 fois mieux sur ce
   * contenu — mesuré : 1 791 Ko contre 2 452 Ko — et « DecompressionStream »
   * ne le connaît pas, vérifié dans le navigateur du dépôt : il n'accepte que
   * « gzip », « deflate » et « deflate-raw ». Le champ garde donc une place
   * pour le jour où cela changera.
   */
  z?: 'gzip';
}

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

function base64VersOctets(b64: string): Uint8Array {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

function octetsVersBase64(octets: Uint8Array): string {
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire);
}

/** Empreinte SHA-256 hexadécimale, utilisée par l'écran de connexion. */
export async function sha256Hex(texte: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encodeur.encode(texte));
  return [...new Uint8Array(digest)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

/** Dérive la clé AES-GCM (PBKDF2). Extractible pour pouvoir la mémoriser. */
export async function deriverCle(motDePasse: string, params: ParametresCle): Promise<CryptoKey> {
  const materiel = await crypto.subtle.importKey('raw', encodeur.encode(motDePasse), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64VersOctets(params.sel) as BufferSource,
      iterations: params.iterations,
      hash: 'SHA-256',
    },
    materiel,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt'],
  );
}

/**
 * Déchiffre un blob { iv, ct } et parse le JSON obtenu.
 *
 * ## Pourquoi « z », et pourquoi la compression vient AVANT le chiffrement
 *
 * Du JSON se comprime d'ordinaire de 80 à 90 %. Les fichiers de contenu n'y
 * gagnaient que 25 %, et ce chiffre est la signature d'un contenu chiffré :
 * un texte chiffré n'a plus de redondance, donc plus rien à comprimer. La
 * compression du serveur et celle du navigateur arrivaient toutes deux trop
 * tard.
 *
 * Comprimer le CLAIR, puis chiffrer le comprimé, rend la redondance au
 * compresseur. Mesuré sur « recherche.json » : 11 371 Ko servis deviennent
 * 3 270 Ko, et le clair obtenu est identique octet pour octet — donc rien ne
 * change pour la personne, ni dans ce qu'elle voit ni dans ce qu'elle cherche.
 *
 * L'ordre importe aussi pour une raison qui n'est pas la taille : comprimer
 * APRÈS aurait été sans effet, et comprimer des données déjà chiffrées est en
 * général le signe qu'on n'a pas compris ce qu'on fait.
 */
export async function dechiffrerJson<T>(cle: CryptoKey, blob: Blob): Promise<T> {
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64VersOctets(blob.iv) as BufferSource },
    cle,
    base64VersOctets(blob.ct) as BufferSource,
  );
  const octets = blob.z === 'gzip' ? await decomprimer(clair) : clair;
  return JSON.parse(decodeur.decode(octets)) as T;
}

/**
 * Décomprime du gzip avec l'API du navigateur, sans dépendance.
 *
 * `Response` fait le ramassage des morceaux : écrire la boucle de lecture à la
 * main aurait été quinze lignes de plus pour le même résultat, et une de plus
 * à se tromper sur la concaténation.
 */
async function decomprimer(octets: ArrayBuffer): Promise<ArrayBuffer> {
  const flux = new Blob2([octets]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(flux).arrayBuffer();
}

/**
 * Le « Blob » du navigateur, sous un autre nom.
 *
 * Ce module exporte sa propre interface `Blob` — le bloc chiffré —, qui
 * masque celle du DOM dans tout le fichier. Lui donner ici un alias explicite
 * vaut mieux que de renommer l'interface publique, qui est nommée ainsi
 * partout dans le dépôt.
 */
const Blob2 = globalThis.Blob;

/**
 * Déchiffre un fichier binaire (fiche audio), dont l'IV occupe les premiers
 * octets. Les podcasts pèsent quelques mégaoctets : ils ne passent pas par le
 * base64, qui les alourdirait d'un tiers.
 */
export async function dechiffrerBinaire(
  cle: CryptoKey,
  octets: ArrayBuffer,
  tailleIvOctets = 12,
): Promise<ArrayBuffer> {
  const iv = new Uint8Array(octets, 0, tailleIvOctets);
  const chiffre = new Uint8Array(octets, tailleIvOctets);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cle, chiffre as BufferSource);
}

/** Vérifie que la clé dérivée déchiffre bien le témoin publié. */
export async function cleValide(cle: CryptoKey, params: ParametresCle): Promise<boolean> {
  try {
    const temoin = await dechiffrerJson<{ ok: boolean }>(cle, params.temoin);
    return temoin?.ok === true;
  } catch {
    return false;
  }
}

/** Sérialise la clé pour la mémoriser entre deux visites. */
export async function exporterCle(cle: CryptoKey): Promise<string> {
  const brut = await crypto.subtle.exportKey('raw', cle);
  return octetsVersBase64(new Uint8Array(brut));
}

export async function importerCle(brutBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64VersOctets(brutBase64) as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt'],
  );
}

// --- Rubrique Actualités : déchiffrement de l'enveloppe RSA ----------------
//
// Les actualités ne sont pas chiffrées avec la clé du site : les routines qui
// les écrivent n'ont pas le mot de passe. Elles utilisent une clé publique
// publiée dans « actualites-data/cle-publique.json ». La clé privée
// correspondante n'arrive ici que déchiffrée depuis « data/actualites-cle.json »,
// donc après saisie du mot de passe.

export interface Enveloppe {
  v: number;
  alg: string;
  /** Clé AES du contenu, chiffrée avec la clé publique. */
  cle: string;
  iv: string;
  ct: string;
}

export function importerPriveeActualites(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, [
    'decrypt',
  ]);
}

/** Ouvre une enveloppe : déballe la clé AES, puis déchiffre le contenu. */
export async function ouvrirEnveloppe<T>(privee: CryptoKey, enveloppe: Enveloppe): Promise<T> {
  const brute = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privee,
    base64VersOctets(enveloppe.cle) as BufferSource,
  );
  const cleContenu = await crypto.subtle.importKey('raw', brute, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64VersOctets(enveloppe.iv) as BufferSource },
    cleContenu,
    base64VersOctets(enveloppe.ct) as BufferSource,
  );
  return JSON.parse(decodeur.decode(clair)) as T;
}

/** Empreinte tronquée, identique à « idStable » du build : nomme les fichiers publiés. */
export async function idStable(texte: string, longueur = 16): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encodeur.encode(texte));
  return [...new Uint8Array(digest)]
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, longueur);
}
