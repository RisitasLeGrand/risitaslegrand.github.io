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
 * | Menace | Session seule | Mémorisé sur l'appareil |
 * |---|---|---|
 * | Un autre profil du navigateur, un autre compte de la machine | **oui** | **oui** |
 * | Un outil d'inspection ouvert après coup, onglet fermé | **oui** | **non** |
 * | Un ordinateur partagé, repris plus tard | **oui** | **NON** |
 * | Une sauvegarde du disque, un vol de la machine **éteinte** | **oui** | **non** |
 * | Un vol de la machine **allumée et déverrouillée** | **non** | **non** |
 * | Une extension **active dans l'onglet ouvert** | **non** | **non** |
 * | Un script exécuté sur notre origine (XSS) | **non** | **non** |
 *
 * Trois lignes méritent d'être lues deux fois.
 *
 * **« Ordinateur partagé » passe de oui à NON avec la mémorisation**, et
 * c'est tout l'objet de l'avertissement affiché sous la case : quiconque
 * utilise cet appareil et ce navigateur ouvrira le coffre sans le mot de
 * passe. Ce n'est pas un effet de bord, c'est la fonction demandée.
 *
 * **L'encapsulation ne protège de rien contre un script sur notre origine.**
 * Ce script appelle `unwrapKey` avec la clé non extractible et obtient le
 * même résultat que nous : « non extractible » empêche de **copier** la clé,
 * pas de **s'en servir**. Le gain porte uniquement sur la lecture *passive*
 * du stockage — copie de profil, copie de disque, outil d'inspection.
 *
 * **Limite NON VÉRIFIÉE** : certains navigateurs restaurent `sessionStorage`
 * avec un onglet rouvert, ou au redémarrage. Cela relève de l'enveloppe du
 * navigateur, hors de portée d'un pilotage automatisé — un contrôle
 * automatique serait asymétrique au point d'être trompeur, puisqu'un résultat
 * négatif ne prouverait rien. C'est donc écrit ici comme réserve plutôt que
 * mesuré faussement. L'enveloppe de session étant renouvelée à chaque
 * ouverture et détruite à la fermeture, un chiffré ainsi restauré serait de
 * toute façon inutilisable.
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
  CLEF_DELAI,
  DELAI_PAR_DEFAUT_MS,
  VerrouAutomatique,
} from './noyau/verrou-automatique';
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

/* ══════════════════════════════════════════════════════════════════════════
   La boîte aux lettres — A-6, option D
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le rangement de la paire, adossé au magasin d'état en clair.
 *
 * Exporté pour que la couche de données des reports s'en serve aussi : deux
 * définitions de « où vit la paire » finiraient par diverger, et le jour où
 * elles divergeraient, les plis deviendraient illisibles sans que rien ne
 * le dise.
 */
export const rangementDeLaBoite = () => ({
  lire: async (clef: string) => (await db()).get('etat', clef) as Promise<string | undefined>,
  ecrire: async (clef: string, valeur: string) => void (await (await db()).put('etat', valeur, clef)),
  effacer: async (clef: string) => void (await (await db()).delete('etat', clef)),
});

/**
 * L'état de la boîte, pour les écrans. Exige le coffre ouvert.
 *
 * Rend `'ferme'` plutôt que de lever : un écran qui demande l'état de la
 * boîte coffre fermé pose une question légitime, et la réponse est « je ne
 * peux pas savoir ».
 */
export async function etatDeLaBoiteDuCoffre(): Promise<
  'ferme' | 'absente' | 'utilisable' | 'perimee'
> {
  if (!cleMemoire) return 'ferme';
  const { etatDeLaBoite } = await import('./noyau/boite-du-coffre');
  return etatDeLaBoite(rangementDeLaBoite(), cleMemoire);
}

/** La clé du coffre, ou `null` si le coffre est fermé. */
export const cleDuCoffre = (): CryptoKey | null => cleMemoire;

export const coffreOuvert = (): boolean => cleMemoire !== null;

/**
 * La clé dérivée ouvre-t-elle vraiment ce coffre ?
 *
 * ## Pourquoi cette fonction existe
 *
 * L'ouverture se vérifiait par une empreinte SHA-256 **sans sel** du mot de
 * passe du site, publiée dans le paquet. C'était à la fois la seule
 * vérification du coffre et le plus grave des sept constats du prompt 44 : la
 * retirer sans rien mettre à la place aurait fait accepter n'importe quel mot
 * de passe et dériver une clé fausse — et « un coffre qui accepte n'importe
 * quelle clé fabrique des données perdues ».
 *
 * ## Le témoin, c'est le coffre lui-même
 *
 * Plutôt que de fabriquer un témoin à côté — qui peut diverger de la vraie
 * clé — on ouvre **un enregistrement scellé déjà là**. Il est authentique par
 * construction : s'il s'ouvre, la clé est la bonne ; s'il résiste,
 * l'authentification AES-GCM a refusé, et c'est un vrai refus, pas une
 * comparaison.
 *
 * ## Le cas du coffre vide
 *
 * Aucun enregistrement scellé : il n'y a rien à vérifier, et rien à perdre.
 * On accepte. Le premier enregistrement écrit devient le témoin des
 * ouvertures suivantes — et si le mot de passe était faux, il n'y avait de
 * toute façon aucune donnée antérieure qu'il puisse rendre illisible.
 *
 * C'est la seule porte laissée ouverte, et elle est bornée par ce qu'elle
 * risque : rien.
 */
async function laCleOuvreLeCoffre(cle: CryptoKey): Promise<boolean> {
  const { MAGASINS_SCELLES, ouvrir: ouvrirUnScelle } = await import('./noyau/coffre');
  const base = await db();
  for (const { magasin } of MAGASINS_SCELLES) {
    let enregistrements: Record<string, unknown>[];
    try {
      enregistrements = (await base.getAll(magasin as never)) as Record<string, unknown>[];
    } catch {
      // Magasin absent de cette version du schéma : il n'apprend rien.
      continue;
    }
    for (const enregistrement of enregistrements) {
      if (!enregistrement?.scelle) continue;
      try {
        await ouvrirUnScelle(cle, enregistrement);
        return true;
      } catch {
        /*
           Ce scellé ne s'ouvre pas. On ne conclut pas tout de suite : un
           enregistrement abîmé ferait rejeter un mot de passe juste. On
           continue, et c'est l'absence TOTALE d'ouverture qui tranche.
        */
      }
    }
  }
  /*
     Aucun scellé ouvert. Deux cas que ce booléen ne distingue pas, et
     l'appelant s'en charge : coffre vide (rien à vérifier) ou mot de passe
     faux (tout a résisté).
  */
  return false;
}

/** Y a-t-il seulement quelque chose à vérifier ? */
async function leCoffreContientQuelqueChose(): Promise<boolean> {
  const { MAGASINS_SCELLES } = await import('./noyau/coffre');
  const base = await db();
  for (const { magasin } of MAGASINS_SCELLES) {
    try {
      const tout = (await base.getAll(magasin as never)) as Record<string, unknown>[];
      if (tout.some((e) => e?.scelle)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Ouvre le coffre.
 *
 * Le mot de passe est éprouvé **après** la dérivation, en ouvrant un
 * enregistrement réel. L'ordre a changé — on dérivait après avoir comparé une
 * empreinte, on vérifie maintenant en déchiffrant — et le coût aussi : il faut
 * payer les itérations PBKDF2 avant de savoir. C'est précisément ce qu'on
 * veut : sans ce coût, un essai de mot de passe est gratuit.
 */
export async function ouvrirLeCoffre(
  motDePasse: string,
  options: { memoriserAppareil?: boolean } = {},
): Promise<string | null> {
  if (!motDePasse) return 'Saisissez le mot de passe.';
  const candidate = await deriver(motDePasse);
  if (!(await laCleOuvreLeCoffre(candidate)) && (await leCoffreContientQuelqueChose())) {
    return 'Mot de passe incorrect.';
  }
  /*
     On réutilise la clé déjà dérivée pour la vérification, et c'est ce que
     l'ancien code ne pouvait pas faire : il comparait une empreinte, puis
     dérivait. Dériver une seconde fois ici coûterait 310 000 itérations de
     plus à chaque ouverture, pour obtenir exactement la même clé.
  */
  cleMemoire = candidate;
  /*
     A-6, option D : la boîte aux lettres naît ici, à la première ouverture,
     parce qu'il faut la clé du coffre pour sceller sa privée. Ensuite elle
     DURE — `assurerLaBoite` ne remplace rien si une paire existe déjà, et
     refuse de renouveler une paire périmée, ce qui rendrait les plis en
     attente illisibles sans un mot.

     L'échec n'empêche pas d'ouvrir le coffre. Une boîte absente ne coûte
     que le report d'un geste ; une ouverture qui échoue coûte l'accès à
     tout. `etatDeLaBoiteDuCoffre()` dira ce qu'il en est quand on le lui
     demandera.
  */
  try {
    const { assurerLaBoite } = await import('./noyau/boite-du-coffre');
    await assurerLaBoite(rangementDeLaBoite(), cleMemoire);
  } catch {
    // La boîte manquera, et l'écran le dira. Le coffre, lui, est ouvert.
  }
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

/* ══════════════════════════════════════════════════════════════════════════
   Le verrouillage automatique
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Branche le verrou automatique sur la page.
 *
 * La décision vit dans `noyau/verrou-automatique`, qui ne connaît ni clic ni
 * onglet ; ici on lui donne seulement de quoi savoir l'heure, l'état du
 * coffre, et comment le refermer.
 *
 * ## Trois déclencheurs, et le deuxième est le seul qui compte vraiment
 *
 * - Un **minuteur**, pour le cas ordinaire : l'écran reste allumé, personne ne
 *   touche rien.
 * - Le **retour de l'onglet** (`visibilitychange`), et c'est là que se joue le
 *   vrai danger : une machine en veille n'exécute pas ses minuteurs. Trois
 *   heures de veille, et aucun `setInterval` ne s'est déclenché. Le module
 *   compare deux horodatages précisément pour que ce retour suffise.
 * - Le **`pageshow`**, pour le retour depuis le cache de page, où le script ne
 *   se rejoue pas et où le minuteur n'a pas tourné non plus.
 *
 * ## Ce qui compte comme activité
 *
 * Des gestes, pas du mouvement : un clic, une touche, une saisie, un défilement
 * volontaire. Pas `mousemove` — un chat sur le clavier, un écran tactile posé
 * sur une table, et le coffre resterait ouvert toute la nuit « parce qu'il y
 * avait de l'activité ».
 */
export function brancherLeVerrouAutomatique(delaiMs?: number): () => void {
  if (typeof document === 'undefined') return () => {};

  const verrou = new VerrouAutomatique(
    {
      maintenant: () => Date.now(),
      coffreOuvert: () => cleMemoire !== null,
      fermer: () => fermerLeCoffre(),
    },
    delaiMs ?? DELAI_PAR_DEFAUT_MS,
  );

  const activite = () => verrou.activite();
  const verifier = () => void verrou.verifier();

  const gestes = ['pointerdown', 'keydown', 'wheel'] as const;
  for (const geste of gestes) document.addEventListener(geste, activite, { passive: true });

  const auRetour = () => {
    if (document.visibilityState === 'visible') verifier();
  };
  document.addEventListener('visibilitychange', auRetour);
  window.addEventListener('pageshow', verifier);

  /*
     Toutes les trente secondes : assez fin pour que le verrou tombe dans la
     minute qui suit son échéance, assez rare pour ne rien coûter. La précision
     n'a pas d'intérêt ici — personne ne compte les secondes avant la fermeture
     de son coffre.
  */
  const minuteur = window.setInterval(verifier, 30_000);

  return () => {
    for (const geste of gestes) document.removeEventListener(geste, activite);
    document.removeEventListener('visibilitychange', auRetour);
    window.removeEventListener('pageshow', verifier);
    window.clearInterval(minuteur);
  };
}

/** Le délai retenu sur cet appareil, ou celui par défaut. */
export async function delaiDuVerrouAutomatique(): Promise<number> {
  try {
    const garde = (await (await db()).get('etat', CLEF_DELAI)) as number | undefined;
    return typeof garde === 'number' && Number.isFinite(garde) ? garde : DELAI_PAR_DEFAUT_MS;
  } catch {
    return DELAI_PAR_DEFAUT_MS;
  }
}

/** Enregistre le délai. Zéro désactive le verrou, et c'est un choix valide. */
export async function reglerLeDelaiDuVerrou(ms: number): Promise<void> {
  await (await db()).put('etat', ms, CLEF_DELAI);
}
