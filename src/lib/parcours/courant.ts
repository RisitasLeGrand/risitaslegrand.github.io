/**
 * Le parcours ouvert en ce moment.
 *
 * ## Pourquoi `localStorage` et non IndexedDB
 *
 * Le parcours courant est lu par la rotation, donc par la planification, donc
 * par la gamification — c'est-à-dire sur des chemins synchrones, parfois avant
 * que la base soit ouverte. Une lecture asynchrone obligerait à propager
 * `await` dans une dizaine de fonctions qui n'en ont pas besoin, pour une
 * préférence d'un seul mot.
 *
 * ## Pourquoi la clé reste « revinsp. »
 *
 * Le produit s'appelle Cyclades, et les clés gardent le préfixe `revinsp.`. Les
 * renommer n'apporterait rien et coûterait l'état de l'installation existante :
 * thème, position de lecture, réglages d'exercices, clé de session. La table de
 * correspondance entre les noms affichés et les noms stockés est documentée dans
 * `docs/cyclades/renommage.md`.
 */
import {
  ID_PARCOURS_PAR_DEFAUT,
  parcoursOuDefaut,
  type Parcours,
} from './registre';

export const CLE_PARCOURS = 'revinsp.parcours';

/** L'événement émis quand le parcours change, pour que les écrans se refassent. */
export const EVENEMENT_PARCOURS = 'cyclades:parcours';

/**
 * Lire la préférence sans jamais lever.
 *
 * `localStorage` jette en navigation privée, derrière un blocage de cookies
 * tiers, et dans un contexte sans origine. Un parcours illisible n'est pas une
 * panne : c'est le parcours par défaut.
 */
export function idParcoursCourant(): string {
  try {
    return localStorage.getItem(CLE_PARCOURS) ?? ID_PARCOURS_PAR_DEFAUT;
  } catch {
    return ID_PARCOURS_PAR_DEFAUT;
  }
}

export function parcoursCourant(): Parcours {
  return parcoursOuDefaut(idParcoursCourant());
}

/**
 * Changer de parcours.
 *
 * Rend le parcours réellement retenu, qui peut différer de celui demandé si
 * l'identifiant est inconnu — l'appelant doit pouvoir afficher ce qui a été
 * ouvert, et non ce qu'il croyait ouvrir.
 */
export function definirParcoursCourant(id: string): Parcours {
  const retenu = parcoursOuDefaut(id);
  try {
    localStorage.setItem(CLE_PARCOURS, retenu.id);
  } catch {
    // Préférence non conservée : le parcours vaut pour cette page, pas plus.
  }
  document.dispatchEvent(
    new CustomEvent(EVENEMENT_PARCOURS, { detail: { parcours: retenu.id } }),
  );
  return retenu;
}
