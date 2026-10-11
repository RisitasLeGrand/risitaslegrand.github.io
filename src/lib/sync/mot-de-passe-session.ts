/**
 * Le mot de passe du site, retenu en mémoire le temps de la session.
 *
 * ## Pourquoi il le faut
 *
 * Un paquet de synchronisation est chiffré avec le mot de passe du site, et
 * c'est la seule frontière de sécurité du transport : le canal n'est pas de
 * confiance, le paquet l'est. La conséquence est qu'il faut le mot de passe à
 * chaque envoi et à chaque fusion — et le redemander à chaque fois rendrait
 * « synchroniser » un geste de plus long que de transférer un fichier à la main.
 *
 * ## Pourquoi c'est acceptable, et où est la limite
 *
 * « auth.ts » ne garde jamais le mot de passe : il garde la **clé dérivée**, et
 * c'est juste — une clé exportée dans `localStorage` est une clé, pas un mot de
 * passe, et elle n'ouvre que le contenu publié. Ici je garde le mot de passe
 * lui-même, mais :
 *
 *  - **en mémoire seulement**. Jamais `localStorage`, jamais `sessionStorage`,
 *    jamais IndexedDB. Fermer l'onglet l'oublie.
 *  - **oublié au verrouillage**, par abonnement explicite : verrouiller doit
 *    tout verrouiller, sans quoi le bouton mentirait.
 *  - **jamais rendu à l'écran, jamais journalisé, jamais mis dans un paquet.**
 *
 * L'alternative aurait été de chiffrer le paquet avec le secret d'appairage, ce
 * qui aurait supprimé la saisie — et aussi la garantie. Qui photographie le QR
 * aurait alors pu lire la progression. Un geste de moins ne valait pas cela.
 */
import { surChangementVerrou } from '../auth';

let retenu: string | null = null;
let abonne = false;

function abonner() {
  if (abonne) return;
  abonne = true;
  try {
    surChangementVerrou((deverrouille) => {
      if (!deverrouille) retenu = null;
    });
  } catch {
    /* hors navigateur : il n'y a pas de verrou à écouter. */
  }
}

export function retenirMotDePasse(motDePasse: string): void {
  abonner();
  retenu = motDePasse || null;
}

export const motDePasseRetenu = (): string | null => retenu;

export const oublierMotDePasse = (): void => void (retenu = null);
