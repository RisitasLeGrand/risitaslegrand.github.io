/**
 * Écran de connexion et gestion de la clé de déchiffrement.
 *
 * Un seul mécanisme, et c'est le bon : la saisie dérive une clé AES par
 * PBKDF2, et cette clé doit ouvrir le **témoin chiffré** publié avec le
 * contenu. Réussir, c'est pouvoir déchiffrer ; il n'y a rien d'autre à
 * vérifier.
 *
 * Il y en avait deux. La première comparait une empreinte SHA-256 **sans
 * sel** du mot de passe, embarquée dans `site.config.mjs` et donc dans le
 * paquet publié. Elle ne servait qu'à choisir entre deux messages d'erreur,
 * et elle coûtait tout : une empreinte sans sel se teste par dizaines de
 * milliards par seconde sur une carte graphique ordinaire. Elle est partie
 * (prompt 44, point 1), et un essai refuse désormais qu'une empreinte du mot
 * de passe réapparaisse dans `dist/`.
 *
 * ## Où vit la clé mémorisée, et ce que le commentaire disait de faux
 *
 * Il annonçait « par défaut dans sessionStorage ». C'était inexact : la case
 * « Rester connecté sur cet appareil » est cochée d'avance, et `auth.ts`
 * écrit alors dans `localStorage`. Le défaut réel est donc `localStorage`,
 * et c'est ce que dit maintenant cette ligne — constat 3 du prompt 44.
 *
 *  - `localStorage` quand « rester connecté » est coché, ce qui est le cas
 *    par défaut : la clé survit à la fermeture du navigateur ;
 *  - `sessionStorage` sinon : effacée à la fermeture de l'onglet.
 */
import config from '../../site.config.mjs';
import {
  cleValide,
  deriverCle,
  exporterCle,
  importerCle,
  sha256Hex,
  type ParametresCle,
} from './crypto';
import { chargerParametresCle, viderCache } from './contenu';
import { oublierCleActualites } from './actualites';

const CLE_STOCKAGE = 'revinsp.cle';

/** Nom de l'événement annonçant que le contenu peut être déchiffré. */
export const EVENEMENT_DEVERROUILLE = 'revinsp:deverrouille';

let cleMemoire: CryptoKey | null = null;
const abonnes = new Set<(deverrouille: boolean) => void>();

// La mise en cache est assurée par contenu.ts : une seule source de vérité
// pour les paramètres publics et le numéro de publication.
const params = (): Promise<ParametresCle> => chargerParametresCle();

function lireStockage(): string | null {
  try {
    return sessionStorage.getItem(CLE_STOCKAGE) ?? localStorage.getItem(CLE_STOCKAGE);
  } catch {
    return null;
  }
}

function ecrireStockage(valeur: string, persistant: boolean) {
  try {
    (persistant ? localStorage : sessionStorage).setItem(CLE_STOCKAGE, valeur);
  } catch {
    /* navigation privée : on continue sans mémoriser */
  }
}

function effacerStockage() {
  try {
    sessionStorage.removeItem(CLE_STOCKAGE);
    localStorage.removeItem(CLE_STOCKAGE);
  } catch {
    /* ignoré */
  }
}

/** Retourne la clé en mémoire, en la restaurant depuis le stockage si besoin. */
export async function obtenirCle(): Promise<CryptoKey | null> {
  if (cleMemoire) return cleMemoire;
  const memorisee = lireStockage();
  if (!memorisee) return null;
  try {
    const cle = await importerCle(memorisee);
    if (await cleValide(cle, await params())) {
      cleMemoire = cle;
      return cle;
    }
    // Clé obsolète (contenu republi é avec un autre mot de passe) : on repart de zéro.
    effacerStockage();
  } catch {
    effacerStockage();
  }
  return null;
}

export async function estDeverrouille(): Promise<boolean> {
  return (await obtenirCle()) !== null;
}

/**
 * Tente de déverrouiller la session.
 * Retourne un message d'erreur, ou null en cas de succès.
 */
export async function deverrouiller(motDePasse: string, persistant: boolean): Promise<string | null> {
  if (!motDePasse) return 'Saisissez le mot de passe.';

  /*
     Une seule vérification, et c'est la vraie : dériver la clé, puis tenter
     d'ouvrir le témoin chiffré publié avec le contenu.

     Le message perd en précision — on ne distingue plus « mot de passe faux »
     de « site construit avec un autre mot de passe ». C'était tout le service
     que rendait l'empreinte publiée, et il ne valait pas son prix. Le message
     dit donc les deux possibilités, au lieu de faire semblant de trancher.
  */
  const p = await params();
  const cle = await deriverCle(motDePasse, p);
  if (!(await cleValide(cle, p))) {
    return (
      'Mot de passe incorrect — ou site construit avec un autre mot de passe. ' +
      'Si vous êtes sûr du mot de passe, relancez « npm run deploy ».'
    );
  }

  cleMemoire = cle;
  ecrireStockage(await exporterCle(cle), persistant);

  /*
     Le coffre ne s'ouvre **pas** ici, et c'est le point de la décision 3.

     Il s'ouvrait : le mot de passe était là, autant s'en servir. Depuis que la
     clé du coffre survit à la navigation (`MEMORISER` dans `coffre.ts`), cela
     revenait à l'ouvrir pour tout l'onglet dès l'entrée sur le site — et le
     coffre cessait d'être une seconde porte. Un essai en navigateur l'a
     montré : la psyché s'affichait sans que personne ait rien demandé.

     Or la seconde porte est précisément ce qu'on a voulu. Le chiffrement au
     repos protège la base contre une extension ou contre quelqu'un qui
     récupère le fichier ; il ne protège de rien contre un ordinateur
     déverrouillé qu'on prête deux minutes, avec le site déjà ouvert. C'est ce
     cas-là que vise la décision 3, parce que c'est le plus probable.

     Le prix est connu et assumé : le mot de passe est tapé une seconde fois,
     une fois par onglet, le jour où l'on va voir ses traitements ou sa psyché.
  */

  abonnes.forEach((f) => f(true));
  return null;
}

/** Verrouille la session : clé oubliée, contenu déchiffré purgé de la mémoire. */
export function verrouiller() {
  cleMemoire = null;
  effacerStockage();
  viderCache();
  oublierCleActualites();
  /*
     Et le coffre avec. Le laisser ouvert après un verrouillage explicite
     serait la pire des incohérences : on croirait avoir tout fermé, et les
     écrans sensibles resteraient lisibles.
  */
  /*
     Et la mémorisation avec, pas seulement la session. Un verrouillage
     explicite qui laisserait le coffre se rouvrir sans mot de passe à la
     visite suivante dirait le contraire de ce que le bouton promet. C'est ma
     lecture de l'esprit de l'interdit 6 ; elle va au-delà de la lettre du
     prompt 35, qui distingue « Fermer » de « Oublier », et je la signale
     plutôt que de la glisser.
  */
  void import('./coffre').then(({ oublierLAppareil }) => oublierLAppareil());
  abonnes.forEach((f) => f(false));
}

export function surChangementVerrou(callback: (deverrouille: boolean) => void) {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}

/* ══════════════════════════════════════════════════════════════════════════
   Signal de déverrouillage — verrou à bascule, et non événement fugace
   ══════════════════════════════════════════════════════════════════════════

   L'écran de connexion annonçait l'ouverture de la session par un simple
   CustomEvent. Or les scripts de page sont des modules chargés séparément :
   quand le paquet d'une page arrivait APRÈS l'envoi de l'événement — ce qui se
   produit dès que « cle.json » est servi par le cache du navigateur, donc à
   presque chaque navigation —, la page posait son écouteur trop tard,
   n'apprenait jamais que la session était ouverte et restait indéfiniment sur
   « Déchiffrement du contenu… ». Un rechargement manuel rejouait la séquence
   avec un autre minutage et « corrigeait » le problème.

   La correction consiste à mémoriser l'état sur <html> : l'information cesse
   d'être un instant pour devenir une condition, qu'une page arrivée en retard
   peut toujours lire. « quandDeverrouille » unifie les deux cas.
   ══════════════════════════════════════════════════════════════════════════ */

/** Marque la session comme ouverte et prévient les pages déjà en écoute. */
export function signalerDeverrouillage() {
  document.documentElement.dataset.verrou = 'ouvert';
  document.dispatchEvent(new CustomEvent(EVENEMENT_DEVERROUILLE));
}

/** Marque la session comme fermée. */
export function signalerVerrouillage() {
  delete document.documentElement.dataset.verrou;
}

/** Vrai si la session est ouverte, sans attendre de vérification asynchrone. */
export function sessionOuverte(): boolean {
  return document.documentElement.dataset.verrou === 'ouvert';
}

/**
 * Exécute « callback » dès que la session est ouverte — immédiatement si elle
 * l'est déjà. C'est le seul point d'entrée que les pages doivent utiliser.
 */
export function quandDeverrouille(callback: () => void): void {
  if (sessionOuverte()) {
    queueMicrotask(callback);
    return;
  }
  document.addEventListener(EVENEMENT_DEVERROUILLE, callback, { once: true });
}
