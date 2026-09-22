/**
 * Chiffrement du contenu au moment du build.
 *
 * Schéma : PBKDF2-HMAC-SHA256 (sel aléatoire, itérations élevées) -> clé
 * AES-GCM 256 bits. Chaque fichier publié reçoit son propre IV aléatoire.
 * Seul le résultat chiffré est écrit dans « public/data/ », donc dans « dist/ »,
 * donc sur GitHub Pages.
 */
import { webcrypto as crypto } from 'node:crypto';

const encodeur = new TextEncoder();

export function b64(octets) {
  return Buffer.from(octets).toString('base64');
}

/** Empreinte SHA-256 hexadécimale (sert à vérifier le mot de passe). */
export async function sha256Hex(texte) {
  const digest = await crypto.subtle.digest('SHA-256', encodeur.encode(texte));
  return [...new Uint8Array(digest)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

/** Dérive la clé AES-GCM à partir du mot de passe et du sel. */
export async function deriverCle(motDePasse, sel, iterations, tailleCleBits) {
  const materiel = await crypto.subtle.importKey('raw', encodeur.encode(motDePasse), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' },
    materiel,
    { name: 'AES-GCM', length: tailleCleBits },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function selAleatoire(taille) {
  return crypto.getRandomValues(new Uint8Array(taille));
}

/** Chiffre une valeur JSON. Retourne { iv, ct } en base64. */
export async function chiffrerJson(cle, valeur, tailleIvOctets) {
  const iv = crypto.getRandomValues(new Uint8Array(tailleIvOctets));
  const donnees = encodeur.encode(JSON.stringify(valeur));
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, donnees);
  return { iv: b64(iv), ct: b64(new Uint8Array(chiffre)) };
}

/** Identifiant stable et opaque : ne révèle rien du contenu, ne change pas d'un build à l'autre. */
export async function idStable(texte, longueur = 16) {
  const digest = await crypto.subtle.digest('SHA-256', encodeur.encode(texte));
  return [...new Uint8Array(digest)]
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, longueur);
}

// --- Chiffrement asymétrique de la rubrique Actualités ---------------------
//
// Les actualités sont écrites par des routines qui tournent dans le nuage et
// n'ont pas accès au mot de passe. Elles ne peuvent donc pas utiliser la clé
// symétrique du site. Schéma retenu : RSA-OAEP.
//
//   - la clé PUBLIQUE est publiée en clair et sert aux routines à chiffrer ;
//   - la clé PRIVÉE reste dans « content/ » (jamais commitée) et n'est publiée
//     que chiffrée avec le mot de passe du site, pour le navigateur.
//
// Une routine peut donc écrire une actualité, mais jamais relire celles qui
// existent : elle ne détient rien qui déchiffre.

export const ALGO_ENVELOPPE = { name: 'RSA-OAEP', hash: 'SHA-256' };

/** Crée une paire de clés pour la rubrique Actualités. Retourne deux JWK. */
export async function genererPaireActualites() {
  const paire = await crypto.subtle.generateKey(
    { ...ALGO_ENVELOPPE, modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['encrypt', 'decrypt'],
  );
  return {
    publique: await crypto.subtle.exportKey('jwk', paire.publicKey),
    privee: await crypto.subtle.exportKey('jwk', paire.privateKey),
  };
}

export function importerPubliqueActualites(jwk) {
  return crypto.subtle.importKey('jwk', jwk, ALGO_ENVELOPPE, true, ['encrypt']);
}

/**
 * Chiffre une valeur JSON pour la rubrique Actualités.
 * Le contenu est chiffré en AES-GCM sous une clé tirée au hasard, elle-même
 * enveloppée par la clé publique : la taille du contenu n'est pas limitée par
 * celle de la clé RSA.
 */
export async function chiffrerPourActualites(clePublique, valeur, tailleIvOctets = 12) {
  const cleContenu = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(tailleIvOctets));
  const donnees = encodeur.encode(JSON.stringify(valeur));
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cleContenu, donnees);

  const brute = await crypto.subtle.exportKey('raw', cleContenu);
  const enveloppe = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, clePublique, brute);

  return {
    v: 1,
    alg: 'RSA-OAEP-256+AES-GCM-256',
    cle: b64(new Uint8Array(enveloppe)),
    iv: b64(iv),
    ct: b64(new Uint8Array(chiffre)),
  };
}
