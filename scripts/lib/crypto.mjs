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
