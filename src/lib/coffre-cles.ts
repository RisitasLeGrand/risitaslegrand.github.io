/**
 * La clé qui encapsule la clé du coffre.
 *
 * ## Pourquoi ce module existe
 *
 * Jusqu'ici, la clé du coffre était rangée dans `sessionStorage` **en base64
 * brut**. Elle y survivait à la navigation — ce qui est la bonne propriété sur
 * un site multi-pages — mais elle y était lisible par quiconque ouvrait le
 * stockage de l'onglet.
 *
 * La décision 5 du prompt 35 demande deux choses à la fois : plus de clé en
 * clair dans le stockage de l'onglet, **et** pas de saisie du mot de passe en
 * plus. Les deux tiennent ensemble si ce qu'on range n'est plus la clé mais
 * son **chiffré**, et que de quoi le déchiffrer vit ailleurs, hors de portée
 * d'une lecture de `sessionStorage`.
 *
 * ## Ce que cela protège, et ce que cela ne protège pas
 *
 * | Menace | Protégée ? |
 * |---|---|
 * | Lecture du stockage de l'onglet (outil d'inspection, copie de profil ou de disque) | **oui** — le chiffré ne sert à rien sans la clé d'IndexedDB |
 * | Un script exécuté sur notre origine | **non** |
 *
 * La seconde ligne est la limite réelle et il faut la dire sans la farder : un
 * script sur notre origine appelle `unwrapKey` avec la clé non extractible et
 * obtient exactement le même résultat que nous. **« Non extractible » empêche
 * de copier la clé, pas de s'en servir.** Le niveau de protection contre ce
 * cas est celui d'avant ce module, ni plus ni moins. Ce qui change est la
 * lecture *passive* du stockage, et seulement elle.
 *
 * **Limite non vérifiée** : certains navigateurs restaurent `sessionStorage`
 * avec un onglet rouvert, ou au redémarrage. Cela relève de l'enveloppe du
 * navigateur, hors de portée d'un pilotage automatisé : un contrôle
 * automatique serait asymétrique au point d'être trompeur, puisqu'un résultat
 * négatif ne prouverait rien. C'est donc écrit ici comme réserve plutôt que
 * mesuré faussement. La clé de session étant détruite à la fermeture du
 * coffre, un chiffré ainsi restauré serait de toute façon inutilisable.
 *
 * ## Pourquoi une base à part, et non un magasin de la base principale
 *
 * La base principale est en version 31, avec une chaîne de migrations et un
 * instantané automatique avant chacune. Y ajouter un magasin ferait payer une
 * migration à tout le monde pour deux clés. Une base minuscule et séparée
 * n'entre pas dans cette chaîne, et son effacement ne risque jamais d'emporter
 * des données : elle n'en contient pas, seulement de quoi ouvrir celles qui
 * sont ailleurs.
 *
 * ## Deux clés, deux durées de vie
 *
 * - **Session** : régénérée à chaque ouverture du coffre, détruite à sa
 *   fermeture. L'interdit 6 du prompt 35 promet un bouton qui « efface la clé
 *   et tout ce qui en a été tiré » : une clé d'encapsulation qui survivrait à
 *   « Fermer le coffre » rendrait un chiffré copié ou restauré ouvrable après
 *   coup, et la fermeture serait un affichage plutôt qu'un effacement.
 * - **Mémorisation** (P1 bis, phase suivante) : ne meurt qu'à « Oublier sur
 *   cet appareil », au changement de mot de passe et à la réinitialisation.
 *
 * Ce module porte les deux emplacements dès maintenant pour que la seconde
 * phase n'ait pas à rouvrir celui-ci ; seule la clé de session est utilisée
 * tant que P1 bis n'est pas livré.
 */
import { openDB, type IDBPDatabase } from 'idb';

const NOM_BASE = 'cyclades-cles';
const VERSION = 1;
const MAGASIN = 'cles';

/** Les deux emplacements, nommés une fois. */
export const SESSION = 'encapsulation-session';
export const APPAREIL = 'encapsulation-appareil';

export type Emplacement = typeof SESSION | typeof APPAREIL;

let base: Promise<IDBPDatabase> | null = null;

function baseDesCles(): Promise<IDBPDatabase> {
  base ??= openDB(NOM_BASE, VERSION, {
    upgrade(b) {
      if (!b.objectStoreNames.contains(MAGASIN)) b.createObjectStore(MAGASIN);
    },
  });
  return base;
}

/**
 * La clé d'encapsulation, créée si elle n'existe pas encore.
 *
 * `extractable: false` : IndexedDB range l'objet `CryptoKey` lui-même, par
 * clonage structuré, et une clé non extractible le reste une fois relue. Rien
 * de son matériel ne transite donc par du texte, à aucun moment.
 *
 * AES-KW plutôt qu'AES-GCM : l'encapsulation de clé est précisément ce pour
 * quoi il est fait, il n'a pas de vecteur d'initialisation à gérer — donc pas
 * de vecteur à réutiliser par erreur — et la clé du coffre fait 32 octets,
 * multiple de 8 comme il l'exige.
 */
export async function cleDEncapsulation(ou: Emplacement): Promise<CryptoKey> {
  const b = await baseDesCles();
  const gardee = (await b.get(MAGASIN, ou)) as CryptoKey | undefined;
  if (gardee) return gardee;
  const neuve = await crypto.subtle.generateKey({ name: 'AES-KW', length: 256 }, false, [
    'wrapKey',
    'unwrapKey',
  ]);
  await b.put(MAGASIN, neuve, ou);
  return neuve;
}

/**
 * Régénère la clé d'encapsulation de session.
 *
 * Appelée à chaque ouverture du coffre. Sans cela, un chiffré produit lors
 * d'une session précédente — restauré par le navigateur, ou copié — resterait
 * déchiffrable par la clé courante.
 */
export async function renouvelerLEncapsulationDeSession(): Promise<CryptoKey> {
  await oublierLEncapsulation(SESSION);
  return cleDEncapsulation(SESSION);
}

export async function oublierLEncapsulation(ou: Emplacement): Promise<void> {
  try {
    await (await baseDesCles()).delete(MAGASIN, ou);
  } catch {
    // Stockage refusé ou base absente : il n'y avait rien à oublier.
  }
}

const base64 = (octets: Uint8Array): string => {
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire);
};

const octetsDe = (texte: string): Uint8Array =>
  Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));

/** Encapsule la clé du coffre. Le texte rendu ne vaut rien sans `ou`. */
export async function encapsuler(cle: CryptoKey, ou: Emplacement): Promise<string> {
  const enveloppe = await cleDEncapsulation(ou);
  const chiffre = await crypto.subtle.wrapKey('raw', cle, enveloppe, 'AES-KW');
  return base64(new Uint8Array(chiffre));
}

/**
 * Rouvre une clé encapsulée.
 *
 * Lève si le chiffré ne correspond pas à la clé d'encapsulation courante —
 * notamment après un renouvellement. L'appelant traite cet échec comme une
 * absence : le mot de passe est redemandé, ce qui est le comportement sûr.
 */
export async function desencapsuler(chiffre: string, ou: Emplacement): Promise<CryptoKey> {
  const enveloppe = await cleDEncapsulation(ou);
  return crypto.subtle.unwrapKey(
    'raw',
    octetsDe(chiffre) as BufferSource,
    enveloppe,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}
