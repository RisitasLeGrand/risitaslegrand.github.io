/**
 * La clé du coffre : en mémoire, jamais écrite.
 *
 * ## Pourquoi une seconde clé
 *
 * La clé du contenu publié ne sait que **déchiffrer** : `deriverCle` la crée
 * avec le seul usage `decrypt`, parce que le site n'a jamais rien à chiffrer
 * de ce côté-là. Le coffre, lui, écrit. Il lui faut donc une clé capable de
 * chiffrer, et la dériver séparément vaut mieux que d'élargir les pouvoirs de
 * la première : une clé qui ne peut pas chiffrer ne peut pas réécrire le
 * contenu publié, même par accident.
 *
 * La séparation est aussi **cryptographique** : les deux clés sortent du même
 * mot de passe mais de sels différents, et compromettre l'une n'apprend rien
 * sur l'autre.
 *
 * ## Pourquoi elle n'est pas mémorisée
 *
 * Parce que la mémoriser reviendrait à ne rien chiffrer. Le danger nommé par
 * la décision 3 est « quiconque accède au navigateur » — une extension, un
 * autre profil, un outil d'inspection. Or une extension qui lit IndexedDB lit
 * aussi `localStorage`. Y déposer la clé du coffre la lui offrirait avec les
 * données qu'elle protège.
 *
 * La conséquence est visible et assumée : **après un rechargement, les écrans
 * sensibles redemandent le mot de passe une fois**, même si « rester
 * connecté » est coché. Les cours, eux, restent accessibles : c'est la clé du
 * contenu qui les ouvre, et elle, on la mémorise — un cours volé est un cours
 * déjà public pour qui a le dépôt.
 *
 * ## Le sel
 *
 * Il est tiré au sort à la première ouverture et gardé dans `etat`. Un sel
 * n'est pas un secret : il sert à ce que deux installations du même mot de
 * passe ne produisent pas la même clé, et à ce que le coût de dérivation ne
 * se mutualise pas entre elles.
 */
import { db } from './db';
import { sha256Hex } from './crypto';

const CLEF_SEL = 'coffre.sel';

/**
 * Le nombre d'itérations PBKDF2.
 *
 * Le même ordre de grandeur que la clé du contenu. Il est payé **une fois par
 * session**, au déverrouillage du coffre, et jamais à la lecture : une fois la
 * clé en mémoire, ouvrir un enregistrement coûte un AES-GCM, c'est-à-dire
 * rien.
 */
export const ITERATIONS = 310_000;

let cleMemoire: CryptoKey | null = null;
const abonnes = new Set<(ouvert: boolean) => void>();

const encodeur = new TextEncoder();

async function selLocal(): Promise<Uint8Array> {
  const base = await db();
  const garde = (await base.get('etat', CLEF_SEL)) as string | undefined;
  if (typeof garde === 'string' && garde.length >= 16) {
    const octets = new Uint8Array(garde.length / 2);
    for (let i = 0; i < octets.length; i += 1) {
      octets[i] = Number.parseInt(garde.slice(i * 2, i * 2 + 2), 16);
    }
    return octets;
  }
  const neuf = crypto.getRandomValues(new Uint8Array(16));
  const hexa = [...neuf].map((o) => o.toString(16).padStart(2, '0')).join('');
  await base.put('etat', hexa, CLEF_SEL);
  return neuf;
}

/**
 * Dérive la clé du coffre depuis le mot de passe.
 *
 * Non extractible : `exportKey` échoue dessus. Ce n'est pas une protection
 * contre un attaquant qui exécute du code dans la page — il peut s'en servir
 * sans la lire — mais cela empêche la seule erreur qui comptait vraiment,
 * celle de l'écrire quelque part « pour éviter de la redemander ».
 */
async function deriver(motDePasse: string): Promise<CryptoKey> {
  const materiel = await crypto.subtle.importKey(
    'raw',
    encodeur.encode(motDePasse) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: (await selLocal()) as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    materiel,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** La clé du coffre, ou `null` si le coffre est fermé. */
export const cleDuCoffre = (): CryptoKey | null => cleMemoire;

export const coffreOuvert = (): boolean => cleMemoire !== null;

/**
 * Ouvre le coffre.
 *
 * Le mot de passe est vérifié **avant** la dérivation, par la même empreinte
 * que l'écran de connexion : sans cela, un mot de passe faux produirait une
 * clé fausse, qui chiffrerait de nouveaux enregistrements illisibles par la
 * suite. Un coffre qui accepte n'importe quelle clé fabrique des données
 * perdues.
 */
export async function ouvrirLeCoffre(motDePasse: string): Promise<string | null> {
  if (!motDePasse) return 'Saisissez le mot de passe.';
  const config = (await import('../../site.config.mjs')).default as { motDePasseHash: string };
  if ((await sha256Hex(motDePasse)) !== config.motDePasseHash.toLowerCase()) {
    return 'Mot de passe incorrect.';
  }
  cleMemoire = await deriver(motDePasse);
  abonnes.forEach((f) => f(true));
  return null;
}

/** Referme le coffre. Appelé par le verrouillage de la session. */
export function fermerLeCoffre(): void {
  cleMemoire = null;
  abonnes.forEach((f) => f(false));
}

export function surCoffre(callback: (ouvert: boolean) => void): () => void {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}

/**
 * La clé, ou une erreur qui dit quoi faire.
 *
 * Les couches de données l'appellent avant d'écrire. Lever plutôt que rendre
 * `null` est délibéré : un appelant qui oublierait de tester écrirait sinon
 * en clair dans un magasin scellé, ce qui est exactement la fuite que tout
 * ceci existe pour empêcher.
 */
export function exigerLeCoffre(): CryptoKey {
  if (!cleMemoire) {
    throw new Error(
      'Le coffre est fermé. Ces données sont chiffrées : saisissez le mot de passe pour les ouvrir.',
    );
  }
  return cleMemoire;
}
