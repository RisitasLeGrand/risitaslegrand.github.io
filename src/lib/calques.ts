/**
 * Les calques : feuilles, panneaux et menus, et le retour arrière du système.
 *
 * ## Le défaut visé (M5, premier point)
 *
 * Sur un téléphone, le retour arrière est un geste du **système** — un
 * balayage depuis le bord, un bouton matériel —, et c'est le premier réflexe
 * pour fermer ce qui vient de s'ouvrir. Aujourd'hui il ne ferme rien : la
 * feuille « Plus », le centre de notifications et le menu du cadenas ne
 * touchent pas à l'historique, si bien que le retour **quitte la page** avec
 * le calque encore ouvert par-dessus. On revient donc à l'écran précédent
 * sans avoir voulu le quitter, et l'on perd sa place.
 *
 * ## Le mécanisme, et sa seule difficulté
 *
 * À l'ouverture, on empile une entrée d'historique qui ne change pas
 * l'adresse. Le retour la dépile : on referme le calque, et la page reste.
 * Fermer par le bouton visible doit alors dépiler cette entrée **sans**
 * rejouer la fermeture, sinon un clic sur « Fermer » laisserait une entrée
 * fantôme qui avalerait le retour suivant.
 *
 * C'est tout le rôle de `ferméParNous` : il distingue « le système a
 * reculé » de « nous avons reculé pour ranger notre entrée ».
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne garde pas de pile de calques superposés. Un seul calque à la fois est
 * la règle de l'application — une feuille par-dessus un panneau n'existe
 * nulle part — et prétendre gérer l'empilement sans qu'il existe serait du
 * code qu'aucun essai ne peut éprouver.
 */

/** La marque posée dans `history.state` pour reconnaître notre entrée. */
const MARQUE = 'cycladesCalque';

interface CalqueOuvert {
  nom: string;
  fermer: () => void;
}

let courant: CalqueOuvert | null = null;
let fermeParNous = false;
let branche = false;

function surRetour(): void {
  if (!courant) return;
  /*
     Le système a reculé sur notre entrée : on referme, et on ne touche plus à
     l'historique — l'entrée est déjà partie.
  */
  const calque = courant;
  courant = null;
  calque.fermer();
}

function brancher(): void {
  if (branche) return;
  branche = true;
  window.addEventListener('popstate', () => {
    if (fermeParNous) {
      /* C'est notre propre « history.back() » : rien à refermer. */
      fermeParNous = false;
      return;
    }
    surRetour();
  });
}

/**
 * Déclare qu'un calque vient de s'ouvrir.
 *
 * `fermer` doit être idempotente : elle peut être appelée par le retour
 * arrière alors que le calque se referme déjà par un autre chemin.
 */
export function calqueOuvert(nom: string, fermer: () => void): void {
  brancher();
  /*
     Un calque déjà ouvert : on remplace sans empiler une seconde entrée.
     Deux entrées pour un seul calque demanderaient deux retours pour le
     fermer, ce que personne ne comprendrait.
  */
  if (courant) {
    courant = { nom, fermer };
    return;
  }
  courant = { nom, fermer };
  try {
    history.pushState({ ...(history.state ?? {}), [MARQUE]: nom }, '');
  } catch {
    /*
       Historique refusé (cas rare, contexte restreint) : le calque s'ouvre
       quand même, et le retour arrière quittera la page comme avant. On
       perd le confort, jamais la fonction.
    */
    courant = null;
  }
}

/**
 * Déclare qu'un calque vient de se fermer par un autre chemin que le retour.
 *
 * Range l'entrée d'historique que l'ouverture avait empilée. Sans cela, le
 * retour suivant serait avalé par une entrée qui ne correspond plus à rien.
 */
export function calqueFerme(nom?: string): void {
  if (!courant) return;
  if (nom && courant.nom !== nom) return;
  courant = null;
  if (typeof history.state === 'object' && history.state && MARQUE in history.state) {
    fermeParNous = true;
    history.back();
  }
}

/** Y a-t-il un calque ouvert ? Exporté pour les essais. */
export const calqueCourant = (): string | null => courant?.nom ?? null;
