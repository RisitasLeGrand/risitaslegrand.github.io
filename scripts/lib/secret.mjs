/**
 * Chiffrement d'un secret par mot de passe, indépendamment du build.
 *
 * Sert à conserver dans le dépôt la clé privée des actualités sous forme
 * chiffrée, avec son propre sel. Deux bénéfices :
 *
 *  - après un clone, la clé privée reste récupérable avec le mot de passe :
 *    elle n'est donc pas perdue si « content/ », qui n'est jamais commité,
 *    disparaît de la machine ;
 *  - les routines trimestrielle et annuelle, à qui l'on confie le mot de passe,
 *    peuvent relire les actualités passées pour en faire la synthèse.
 *
 * Le blob produit est autonome : il porte ses propres paramètres de dérivation.
 */
import { webcrypto as crypto } from 'node:crypto';
import { b64, chiffrerJson, deriverCle, selAleatoire } from './crypto.mjs';

const decodeur = new TextDecoder();

export function b64VersOctets(texte) {
  return new Uint8Array(Buffer.from(texte, 'base64'));
}

/** Chiffre une valeur JSON avec un mot de passe. */
export async function chiffrerAvecMotDePasse(motDePasse, valeur, params) {
  const { iterations, tailleSelOctets, tailleIvOctets, tailleCleBits } = params;
  const sel = selAleatoire(tailleSelOctets);
  const cle = await deriverCle(motDePasse, sel, iterations, tailleCleBits);
  const { iv, ct } = await chiffrerJson(cle, valeur, tailleIvOctets);
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations, sel: b64(sel), chiffrement: 'AES-GCM', iv, ct };
}

/** Opération inverse. Lève une erreur explicite si le mot de passe est faux. */
export async function dechiffrerAvecMotDePasse(motDePasse, blob) {
  const cle = await deriverCle(motDePasse, b64VersOctets(blob.sel), blob.iterations, 256);
  let clair;
  try {
    clair = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64VersOctets(blob.iv) },
      cle,
      b64VersOctets(blob.ct),
    );
  } catch {
    throw new Error('Mot de passe incorrect : le déchiffrement a échoué.');
  }
  return JSON.parse(decodeur.decode(clair));
}

/**
 * Ouvre une enveloppe d'actualité avec la clé privée (JWK).
 * Pendant exact de « ouvrirEnveloppe » du navigateur.
 */
export async function ouvrirEnveloppeActualites(priveeJwk, enveloppe) {
  const privee = await crypto.subtle.importKey(
    'jwk',
    priveeJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
  const brute = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privee,
    b64VersOctets(enveloppe.cle),
  );
  const cleContenu = await crypto.subtle.importKey('raw', brute, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64VersOctets(enveloppe.iv) },
    cleContenu,
    b64VersOctets(enveloppe.ct),
  );
  return JSON.parse(decodeur.decode(clair));
}
