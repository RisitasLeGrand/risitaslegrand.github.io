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
 * ## Où elle vit, et contre quoi cela protège
 *
 * Dans `sessionStorage`, et **jamais** dans `localStorage`. La distinction
 * n'est pas cosmétique : `sessionStorage` est vidé à la fermeture de l'onglet
 * et n'est pas partagé entre onglets, tandis que `localStorage` survit à
 * l'extinction de la machine.
 *
 * Et ce qui y est rangé n'est plus la clé, mais son **chiffré** : voir
 * `coffre-cles.ts`, qui garde l'enveloppe dans IndexedDB, non extractible et
 * renouvelée à chaque ouverture. Une lecture du stockage de l'onglet ne rend
 * donc plus rien d'utilisable. Contre un script exécuté sur notre origine,
 * en revanche, cela n'apporte rien — il appellerait `unwrapKey` comme nous.
 * Le tableau ci-dessous est inchangé sur ce point, et c'est voulu : il dit ce
 * qui est protégé, pas ce qu'on aimerait l'être.
 *
 * Ce choix a été pris après avoir mesuré ce que coûtait le précédent. La clé
 * vivait dans une variable de module, donc ne survivait **même pas à une
 * navigation** : sur un site multi-pages, cela faisait une saisie du mot de
 * passe à chaque visite de l'écran. Une protection qu'on contourne en
 * renonçant à l'écran n'en est pas une.
 *
 * Ce que ce choix protège, et il faut le dire précisément :
 *
 * | Menace | Protégée ? |
 * |---|---|
 * | Un autre profil du navigateur, un autre compte de la machine | **oui** |
 * | Un outil d'inspection ouvert après coup, onglet fermé | **oui** |
 * | Un ordinateur partagé, repris plus tard | **oui** |
 * | Une sauvegarde du disque, un vol de la machine éteinte | **oui** |
 * | Une extension **active dans l'onglet ouvert** | **non** |
 *
 * La dernière ligne est la limite réelle, et elle était déjà là : la clé du
 * **contenu** est mémorisée en `localStorage` quand « rester connecté » est
 * coché. Une extension capable de lire IndexedDB lit aussi les deux stockages.
 * Refuser `sessionStorage` n'aurait donc protégé contre elle que dans le cas
 * où cette case est décochée — un cas rare — et au prix d'une friction qui
 * aurait fait abandonner l'écran.
 *
 * **Pour revenir en arrière**, mettre `MEMORISER` à `false` : la clé
 * redevient une variable de module, et le mot de passe est redemandé à chaque
 * navigation. Une ligne, et c'est voulu : la décision doit pouvoir se changer
 * sans réécrire le module.
 *
 * Les cours, eux, restent accessibles sans rien redemander : c'est la clé du
 * contenu qui les ouvre, et un cours « volé » est un cours déjà public pour
 * qui a le dépôt.
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
import {
  APPAREIL,
  SESSION,
  desencapsuler,
  encapsuler,
  oublierLEncapsulation,
  renouvelerLEncapsulationDeSession,
} from './coffre-cles';

const CLEF_SEL = 'coffre.sel';
const CLEF_SESSION = 'cyclades.coffre';
/**
 * Le chiffré mémorisé sur l'appareil (P1 bis).
 *
 * Dans `localStorage`, parce que c'est le seul stockage qui survive à la
 * fermeture du navigateur — ce que la case demande explicitement. L'interdit 2
 * proscrit la clé **en clair** dans `localStorage` : ce qui y est rangé est un
 * chiffré, inutilisable sans l'enveloppe non extractible d'IndexedDB.
 */
const CLEF_APPAREIL = 'cyclades.coffre.appareil';

/**
 * La clé survit-elle à une navigation ?
 *
 * `true` : elle est gardée dans `sessionStorage`, vidé à la fermeture de
 * l'onglet. `false` : elle ne vit qu'en mémoire, et le mot de passe est
 * redemandé à chaque page. Voir l'en-tête pour ce que chaque choix protège.
 */
const MEMORISER = true;

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
    /*
       Extractible **seulement** si on la mémorise, et la raison a changé avec
       l'encapsulation : ce n'est plus parce qu'il faut l'écrire en texte —
       justement, on ne l'écrit plus —, c'est parce que `wrapKey` refuse
       d'encapsuler une clé non extractible. Le matériel ne sort pour autant
       jamais de la page : il passe de `wrapKey` au chiffré, sans détour par
       une variable. Quand `MEMORISER` est faux, elle reste non extractible et
       `exportKey` échoue dessus, ce qui empêche l'erreur de l'écrire quelque
       part « pour éviter de la redemander ».
    */
    MEMORISER,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Range la clé du coffre pour la durée de l'onglet — **encapsulée**.
 *
 * Ce qui atterrit dans `sessionStorage` est un chiffré : sans la clé
 * d'encapsulation, gardée dans IndexedDB et non extractible, il ne vaut rien.
 * La clé elle-même n'y figure plus en clair, ce qu'exige la décision 5.
 *
 * Pourquoi `sessionStorage` tout de même, et pas la seule mémoire : Cyclades
 * est multi-pages, chaque navigation détruit la mémoire de la page, et s'en
 * tenir à elle redemanderait le mot de passe **à chaque page** — l'inverse de
 * ce que le prompt 35 cherche.
 */
async function retenir(cle: CryptoKey): Promise<void> {
  if (!MEMORISER) return;
  try {
    sessionStorage.setItem(CLEF_SESSION, await encapsuler(cle, SESSION));
  } catch {
    // Navigation privée, stockage refusé : le coffre fonctionne, sans mémoire.
  }
}

export function oublierLaMemoire(): void {
  /*
     L'effacement qui compte est celui-ci, et il est **synchrone** : sans le
     chiffré, la clé d'encapsulation n'ouvre plus rien. La destruction de
     l'enveloppe suit sans qu'on l'attende, de sorte que « Fermer le coffre »
     reste immédiat même si la page est quittée dans la foulée (interdit 6).
  */
  try {
    sessionStorage.removeItem(CLEF_SESSION);
  } catch {
    // Rien à faire : il n'y avait rien à oublier.
  }
  void oublierLEncapsulation(SESSION);
}

/**
 * Restaure la clé depuis la session, s'il y en a une.
 *
 * Appelée par les écrans avant de conclure que le coffre est fermé. Elle ne
 * **vérifie pas** le mot de passe — il n'est plus là —, mais une clé fausse se
 * dénoncerait au premier déchiffrement, et `ouvrir()` lèverait.
 */
export async function reprendreLeCoffre(): Promise<boolean> {
  if (cleMemoire) return true;
  if (!MEMORISER) return false;
  let brut: string | null = null;
  let ou: typeof SESSION | typeof APPAREIL = SESSION;
  try {
    brut = sessionStorage.getItem(CLEF_SESSION);
    if (!brut) {
      brut = localStorage.getItem(CLEF_APPAREIL);
      if (brut) ou = APPAREIL;
    }
  } catch {
    return false;
  }
  if (!brut) return false;
  try {
    cleMemoire = await desencapsuler(brut, ou);
    abonnes.forEach((f) => f(true));
    return true;
  } catch {
    /*
       Trois cas tombent ici, et le même traitement leur convient : un chiffré
       produit sous une enveloppe désormais renouvelée, un reste en clair écrit
       par une version antérieure de ce module, un stockage abîmé. Dans les
       trois, on oublie et le mot de passe est redemandé **une fois**. Tenter
       de relire un ancien format en clair reviendrait à rouvrir la porte que
       la décision 5 ferme.
    */
    oublierLaMemoire();
    return false;
  }
}

/**
 * Comment le coffre est ouvert : pour la session seule, ou mémorisé.
 *
 * L'en-tête en a besoin pour ne pas dire « mémorisé sur cet appareil » à qui
 * n'a rien mémorisé — un témoin qui se trompe sur la portée est pire que pas
 * de témoin.
 */
export function modeDuCoffre(): 'ferme' | 'session' | 'appareil' {
  if (!cleMemoire) return 'ferme';
  try {
    return localStorage.getItem(CLEF_APPAREIL) ? 'appareil' : 'session';
  } catch {
    return 'session';
  }
}

/**
 * Oublie la mémorisation sur cet appareil, et ferme le coffre.
 *
 * Distincte de « Fermer le coffre », qui ne touche pas à la mémorisation :
 * les deux libellés ne promettent pas la même chose, et les confondre ferait
 * croire effacé ce qui ne l'est pas.
 */
export function oublierLAppareil(): void {
  try {
    localStorage.removeItem(CLEF_APPAREIL);
  } catch {
    // Rien à oublier.
  }
  void oublierLEncapsulation(APPAREIL);
  fermerLeCoffre();
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
export async function ouvrirLeCoffre(
  motDePasse: string,
  options: { memoriserAppareil?: boolean } = {},
): Promise<string | null> {
  if (!motDePasse) return 'Saisissez le mot de passe.';
  const config = (await import('../../site.config.mjs')).default as { motDePasseHash: string };
  if ((await sha256Hex(motDePasse)) !== config.motDePasseHash.toLowerCase()) {
    return 'Mot de passe incorrect.';
  }
  cleMemoire = await deriver(motDePasse);
  /*
     L'enveloppe est renouvelée à chaque ouverture : un chiffré d'une session
     précédente, restauré par le navigateur ou copié, cesse d'être ouvrable.
  */
  if (MEMORISER) {
    await renouvelerLEncapsulationDeSession();
    await retenir(cleMemoire);
  }
  /*
     P1 bis. L'enveloppe de l'appareil, elle, n'est PAS renouvelée : elle doit
     survivre à la fermeture du navigateur, c'est tout son objet. Seuls
     « Oublier sur cet appareil », un changement de mot de passe et la
     réinitialisation l'effacent.
  */
  if (options.memoriserAppareil) {
    try {
      localStorage.setItem(CLEF_APPAREIL, await encapsuler(cleMemoire, APPAREIL));
    } catch {
      // Stockage refusé : le coffre fonctionne, sans mémorisation.
    }
  }
  abonnes.forEach((f) => f(true));
  return null;
}

/** Referme le coffre. Appelé par le verrouillage de la session. */
export function fermerLeCoffre(): void {
  cleMemoire = null;
  oublierLaMemoire();
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
