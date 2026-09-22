/**
 * Écran de connexion et gestion de la clé de déchiffrement.
 *
 * Deux mécanismes complémentaires, comme prévu :
 *  1. la saisie du mot de passe est vérifiée par comparaison SHA-256 ;
 *  2. la même saisie sert à dériver la clé AES qui déchiffre réellement le
 *     contenu — sans elle, les fichiers publiés restent illisibles.
 *
 * La clé dérivée peut être mémorisée pour éviter de retaper le mot de passe :
 *  - par défaut dans sessionStorage (effacée à la fermeture de l'onglet) ;
 *  - dans localStorage si l'utilisateur coche « rester connecté ».
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
const HASH_ATTENDU = (config as { motDePasseHash: string }).motDePasseHash.toLowerCase();

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

  // Étape 1 — vérification de l'empreinte (retour immédiat et message clair).
  const empreinte = await sha256Hex(motDePasse);
  if (empreinte !== HASH_ATTENDU) return 'Mot de passe incorrect.';

  // Étape 2 — dérivation de la clé et vérification sur le témoin chiffré.
  const p = await params();
  const cle = await deriverCle(motDePasse, p);
  if (!(await cleValide(cle, p))) {
    return (
      'Le mot de passe est reconnu mais ne déchiffre pas le contenu publié. ' +
      'Le site a probablement été construit avec un autre mot de passe : relancez « npm run deploy ».'
    );
  }

  cleMemoire = cle;
  ecrireStockage(await exporterCle(cle), persistant);
  abonnes.forEach((f) => f(true));
  return null;
}

/** Verrouille la session : clé oubliée, contenu déchiffré purgé de la mémoire. */
export function verrouiller() {
  cleMemoire = null;
  effacerStockage();
  viderCache();
  oublierCleActualites();
  abonnes.forEach((f) => f(false));
}

export function surChangementVerrou(callback: (deverrouille: boolean) => void) {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}
