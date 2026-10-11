/**
 * Les conversions d'octets, en un seul endroit.
 *
 * Elles étaient écrites trois fois : dans « crypto.ts » pour l'écran de
 * connexion, dans « sauvegarde/format.ts » pour les fichiers, et il m'en
 * fallait une quatrième pour les QR. Trois copies d'une fonction de six lignes,
 * c'est trois endroits où corriger le jour où l'une se révèle fausse — et c'est
 * arrivé une fois ici, sur la pile débordée par « String.fromCharCode » appelé
 * avec un mégaoctet d'arguments.
 *
 * « crypto.ts » garde la sienne : c'est le chemin du déverrouillage, chargé
 * avant tout le reste, et je ne lui ajoute pas une dépendance pour économiser
 * six lignes. C'est un choix, pas un oubli.
 */
export type Octets = Uint8Array<ArrayBufferLike>;

/** Par tranches : une chaîne d'appel de centaines de milliers d'arguments dépasse la pile. */
const TRANCHE = 0x8000;

export function octetsVersBase64(octets: Octets): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i += TRANCHE) {
    binaire += String.fromCharCode(...octets.subarray(i, i + TRANCHE));
  }
  return btoa(binaire);
}

export function base64VersOctets(b64: string): Uint8Array<ArrayBuffer> {
  const binaire = atob(b64);
  const octets = new Uint8Array(new ArrayBuffer(binaire.length));
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/**
 * Base64 « URL », sans remplissage.
 *
 * Elle sert aux QR et aux fragments d'URL : « + », « / » et « = » y seraient
 * réécrits par les navigateurs et les messageries, et le QR en mode octets
 * paie chaque caractère.
 */
export function octetsVersBase64Url(octets: Octets): string {
  return octetsVersBase64(octets).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlVersOctets(texte: string): Uint8Array<ArrayBuffer> {
  const b64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  // atob tolère l'absence de remplissage dans les navigateurs récents, mais pas
  // partout : on le rétablit plutôt que de s'y fier.
  const reste = b64.length % 4;
  return base64VersOctets(reste ? b64 + '='.repeat(4 - reste) : b64);
}

export function concatener(morceaux: Octets[]): Uint8Array<ArrayBuffer> {
  const total = morceaux.reduce((somme, m) => somme + m.length, 0);
  const sortie = new Uint8Array(new ArrayBuffer(total));
  let decalage = 0;
  for (const m of morceaux) {
    sortie.set(m, decalage);
    decalage += m.length;
  }
  return sortie;
}

export function aleatoire(taille: number): Uint8Array<ArrayBuffer> {
  const tampon = new Uint8Array(new ArrayBuffer(taille));
  crypto.getRandomValues(tampon);
  return tampon;
}

/**
 * Compression et décompression gzip par les flux natifs.
 *
 * `CompressionStream` est disponible partout où l'on vise, et dans Node depuis
 * la version 18 — ce qui permet d'éprouver les formats en ligne de commande.
 * `compressionDisponible()` existe pour le repli : un fichier non compressé
 * reste un fichier valide, et l'en-tête le dit.
 */
export const compressionDisponible = (): boolean =>
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function parcourir(flux: ReadableStream<Octets>): Promise<Uint8Array<ArrayBuffer>> {
  const lecteur = flux.getReader();
  const morceaux: Octets[] = [];
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    if (value) morceaux.push(value);
  }
  return concatener(morceaux);
}

export async function comprimer(
  octets: Octets,
  format: CompressionFormat = 'gzip',
): Promise<Uint8Array<ArrayBuffer>> {
  const flux = new Blob([octets as BlobPart]).stream().pipeThrough(new CompressionStream(format));
  return parcourir(flux as ReadableStream<Octets>);
}

export async function decomprimer(
  octets: Octets,
  format: CompressionFormat = 'gzip',
): Promise<Uint8Array<ArrayBuffer>> {
  const flux = new Blob([octets as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
  return parcourir(flux as ReadableStream<Octets>);
}
