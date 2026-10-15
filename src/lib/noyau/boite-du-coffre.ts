/**
 * Le cycle de vie de la boîte aux lettres — A-6, option D, second volet.
 *
 * `boite-aux-lettres.ts` sait chiffrer. Ce module sait **où vit la paire,
 * combien de temps, et ce qui arrive quand elle ne convient plus**.
 *
 * ## Une paire durable, et non une paire par ouverture
 *
 * Ma première lecture de l'avis du Pilote était « une paire engendrée à
 * chaque ouverture du coffre ». Elle se contredit : un pli déposé lundi
 * coffre fermé serait illisible mardi, puisque la paire aurait changé entre
 * les deux. L'avis dit en réalité **régénérée au changement de mot de
 * passe**, ce qui est tout autre chose.
 *
 * La paire naît donc à la première ouverture du coffre — il faut la clé pour
 * sceller la privée — puis **elle dure**. La publique reste en clair, prête
 * à recevoir un dépôt sans rien demander.
 *
 * ## Les trois états, et pourquoi le troisième existe
 *
 * | État | Ce que cela veut dire |
 * |---|---|
 * | `absente` | Aucune paire. Le coffre n'a jamais été ouvert sur cet appareil. |
 * | `utilisable` | La privée se descelle avec la clé du coffre d'aujourd'hui. |
 * | `perimee` | Une paire existe, et sa privée ne se descelle plus. |
 *
 * `perimee` est le cas du **mot de passe changé**. Le mot de passe de
 * Cyclades est posé à la construction du site : le changer change la clé
 * dérivée, donc la privée scellée sous l'ancienne devient inouvrable, donc
 * les plis en attente deviennent illisibles — définitivement.
 *
 * **Ces plis ne sont jamais supprimés en silence.** C'est le troisième
 * contrôle demandé par le Pilote, et c'est le seul des trois qui porte sur
 * une perte plutôt que sur une fuite. Un geste perdu sans trace est pire
 * qu'un geste refusé : la personne croit l'avoir fait.
 */
import {
  type PaireDeBoite,
  engendrerLaPaire,
  exporterLaPrivee,
  exporterLaPublique,
  importerLaPrivee,
  importerLaPublique,
} from './boite-aux-lettres';

export const CLEF_PUBLIQUE = 'boite.publique';
export const CLEF_PRIVEE = 'boite.privee';

/**
 * Le peu de stockage dont ce module a besoin.
 *
 * Un port, et non `db()` directement : c'est ce qui rend tout le cycle de
 * vie éprouvable en Node, avec du vrai WebCrypto et une carte en mémoire.
 * Un module de clés testé seulement à travers IndexedDB serait testé une
 * fois, dans un navigateur, et jamais sur le cas qui compte — le mot de
 * passe changé.
 */
export interface RangementDeLaBoite {
  lire(clef: string): Promise<string | undefined>;
  ecrire(clef: string, valeur: string): Promise<void>;
  effacer(clef: string): Promise<void>;
}

export type EtatDeLaBoite = 'absente' | 'utilisable' | 'perimee';

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

const enB64 = (octets: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(octets)));

const deB64 = (texte: string): Uint8Array<ArrayBuffer> => {
  const brut = atob(texte);
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
};

/** Scelle la privée sous la clé du coffre. AES-GCM, comme le reste du coffre. */
async function sceller(cleDuCoffre: CryptoKey, clair: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cleDuCoffre,
    encodeur.encode(clair),
  );
  return JSON.stringify({ iv: enB64(iv.buffer), ct: enB64(ct) });
}

/** Descelle, ou rend `null`. **Ne lève pas** : une clé qui ne convient plus est un état, pas une panne. */
async function desceller(cleDuCoffre: CryptoKey, range: string): Promise<string | null> {
  try {
    const { iv, ct } = JSON.parse(range) as { iv: string; ct: string };
    const clair = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: deB64(iv) },
      cleDuCoffre,
      deB64(ct),
    );
    return decodeur.decode(clair);
  } catch {
    return null;
  }
}

/**
 * La publique de la boîte. **N'exige pas le coffre** — c'est tout l'objet.
 *
 * Rend `null` si aucune paire n'existe : sur un appareil où le coffre n'a
 * jamais été ouvert, il n'y a pas de boîte, et un geste sur une branche
 * chiffrée ne peut pas être gardé. L'écran doit le dire, pas l'ignorer.
 */
export async function publiqueDeLaBoite(
  rangement: RangementDeLaBoite,
): Promise<CryptoKey | null> {
  const brut = await rangement.lire(CLEF_PUBLIQUE);
  return brut ? importerLaPublique(brut) : null;
}

/** La privée. Exige la clé du coffre, et rend `null` si elle ne convient plus. */
export async function priveeDeLaBoite(
  rangement: RangementDeLaBoite,
  cleDuCoffre: CryptoKey,
): Promise<CryptoKey | null> {
  const range = await rangement.lire(CLEF_PRIVEE);
  if (!range) return null;
  const clair = await desceller(cleDuCoffre, range);
  return clair ? importerLaPrivee(clair) : null;
}

export async function etatDeLaBoite(
  rangement: RangementDeLaBoite,
  cleDuCoffre: CryptoKey,
): Promise<EtatDeLaBoite> {
  if (!(await rangement.lire(CLEF_PRIVEE))) return 'absente';
  return (await priveeDeLaBoite(rangement, cleDuCoffre)) ? 'utilisable' : 'perimee';
}

/** Écrit une paire neuve. Appelé à la création comme au renouvellement. */
async function poser(
  rangement: RangementDeLaBoite,
  cleDuCoffre: CryptoKey,
  paire: PaireDeBoite,
): Promise<void> {
  await rangement.ecrire(CLEF_PRIVEE, await sceller(cleDuCoffre, await exporterLaPrivee(paire.privee)));
  await rangement.ecrire(CLEF_PUBLIQUE, await exporterLaPublique(paire.publique));
}

/**
 * Garantit qu'une boîte utilisable existe, et dit ce qu'elle a trouvé.
 *
 * **Ne renouvelle jamais une paire périmée de sa propre initiative.** Le
 * faire rendrait les plis en attente illisibles pour toujours, et sans un
 * mot. L'appelant reçoit `perimee` et décide — c'est à lui de prévenir, puis
 * d'appeler `renouvelerLaBoite()` quand la personne a vu.
 */
export async function assurerLaBoite(
  rangement: RangementDeLaBoite,
  cleDuCoffre: CryptoKey,
): Promise<EtatDeLaBoite> {
  const etat = await etatDeLaBoite(rangement, cleDuCoffre);
  if (etat !== 'absente') return etat;
  await poser(rangement, cleDuCoffre, await engendrerLaPaire());
  return 'utilisable';
}

/**
 * Renouvelle la paire. **Geste destructeur, et nommé comme tel.**
 *
 * Tout pli déposé sous l'ancienne publique devient illisible. L'appelant ne
 * doit l'appeler qu'après avoir relevé ce qui pouvait l'être, ou après avoir
 * prévenu de ce qui sera perdu.
 */
export async function renouvelerLaBoite(
  rangement: RangementDeLaBoite,
  cleDuCoffre: CryptoKey,
): Promise<void> {
  await poser(rangement, cleDuCoffre, await engendrerLaPaire());
}

/** Efface la boîte — « Oublier sur cet appareil ». */
export async function oublierLaBoite(rangement: RangementDeLaBoite): Promise<void> {
  await rangement.effacer(CLEF_PRIVEE);
  await rangement.effacer(CLEF_PUBLIQUE);
}
