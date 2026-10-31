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
 * ## LE PIÈGE DE FOCUS (E4 du prompt 43)
 *
 * Mesuré le 26 octobre, à 390 px, coffre ouvert :
 *
 * - le CENTRE de notifications se déclarait `aria-modal="false"`, laissait le
 *   focus sur son bouton au lieu de l'amener dans le panneau, et **une seule
 *   tabulation** suffisait à passer derrière un panneau qui couvre l'écran —
 *   on tabulait alors à l'aveugle, sur des commandes invisibles ;
 * - la feuille « Plus » se déclarait bien modale et amenait le focus dedans,
 *   mais la tabulation en sortait au bout de vingt-deux arrêts.
 *
 * Le piège vit ICI, et non dans chaque composant, parce que ce module sait
 * déjà qu'un calque est ouvert et lequel. Deux implémentations du même piège
 * divergeraient le jour où l'une des deux change.
 *
 * Il est **facultatif**, et c'est voulu : le menu du cadenas porte
 * `role="menu"`, et piéger le focus dans un menu serait une faute — un menu
 * se ferme quand le focus le quitte, il ne le retient pas. Seuls les deux
 * dialogues le demandent.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne garde pas de pile de calques superposés. Un seul calque à la fois est
 * la règle de l'application — une feuille par-dessus un panneau n'existe
 * nulle part — et prétendre gérer l'empilement sans qu'il existe serait du
 * code qu'aucun essai ne peut éprouver.
 *
 * Il ne rend pas le reste de la page `inert`. Ce serait plus complet pour un
 * lecteur d'écran en mode lecture, mais les deux calques vivent DANS
 * `#application` : rendre ce conteneur inerte rendrait le dialogue inerte
 * avec lui. `aria-modal` et le piège de la tabulation sont ce que cette
 * structure permet, et c'est dit plutôt que tu.
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

/** Ce qu'un calque doit fournir pour que la tabulation y reste. */
export interface PiegeDemande {
  /** Le panneau dans lequel la tabulation tourne. */
  panneau: HTMLElement;
  /**
   * À quoi rendre le focus en refermant. Par défaut, l'élément qui l'avait
   * au moment de l'ouverture — c'est-à-dire le bouton qui a ouvert, dans
   * tous les cas mesurés.
   */
  rendreA?: HTMLElement | null;
}

interface Piege extends PiegeDemande {
  nom: string;
  rendreA: HTMLElement | null;
  surTouche: (e: KeyboardEvent) => void;
}

let piege: Piege | null = null;

/*
   Les éléments qui prennent le focus à la tabulation. `getClientRects()` et
   non `offsetParent` : ce dernier est nul pour tout élément en `position:
   fixed`, et la feuille « Plus » en est un — le filtre aurait écarté ses
   vingt-trois commandes, et le piège se serait refermé sur rien.
*/
const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focalisables = (panneau: HTMLElement): HTMLElement[] =>
  [...panneau.querySelectorAll<HTMLElement>(FOCALISABLES)].filter(
    (e) => e.getClientRects().length > 0,
  );

function leverLePiege(): void {
  if (!piege) return;
  const { rendreA, surTouche } = piege;
  piege = null;
  document.removeEventListener('keydown', surTouche, true);
  /*
     LE FOCUS REVIENT, et c'est la moitié du point E4 : sans cela il reste où
     la tabulation l'a laissé — mesuré sur le centre, où Échap le laissait sur
     le commutateur de thème. La tabulation suivante repart alors d'un endroit
     que personne n'a choisi.

     `isConnected` : le panneau a pu emporter son déclencheur en se vidant.
  */
  if (rendreA?.isConnected) rendreA.focus();
}

function poserLePiege(nom: string, demande: PiegeDemande): void {
  leverLePiege();
  const rendreA =
    demande.rendreA ??
    (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  const surTouche = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab' || !piege) return;
    const liste = focalisables(piege.panneau);
    const actif = document.activeElement;
    /*
       Un panneau sans commande focalisable : on garde le focus sur le panneau
       lui-même plutôt que de le laisser partir. Cela arrive au centre quand
       il est vide.
    */
    if (liste.length === 0) {
      e.preventDefault();
      piege.panneau.setAttribute('tabindex', '-1');
      piege.panneau.focus();
      return;
    }
    const premier = liste[0];
    const dernier = liste[liste.length - 1];
    if (!piege.panneau.contains(actif)) {
      e.preventDefault();
      (e.shiftKey ? dernier : premier).focus();
      return;
    }
    if (!e.shiftKey && actif === dernier) {
      e.preventDefault();
      premier.focus();
    } else if (e.shiftKey && actif === premier) {
      e.preventDefault();
      dernier.focus();
    }
  };

  piege = { nom, panneau: demande.panneau, rendreA, surTouche };
  /*
     En phase de CAPTURE : les écrans posent leurs propres écouteurs de touche
     sur le document, et un piège qui s'exécuterait après l'un d'eux arriverait
     trop tard si celui-ci arrête la propagation.
  */
  document.addEventListener('keydown', surTouche, true);

  /* Et le focus entre dans le panneau : le centre le laissait sur son bouton,
     de sorte qu'une tabulation suffisait à sortir. */
  if (!demande.panneau.contains(document.activeElement)) {
    const liste = focalisables(demande.panneau);
    if (liste.length > 0) liste[0].focus();
    else {
      demande.panneau.setAttribute('tabindex', '-1');
      demande.panneau.focus();
    }
  }
}

function surRetour(): void {
  if (!courant) return;
  /*
     Le système a reculé sur notre entrée : on referme, et on ne touche plus à
     l'historique — l'entrée est déjà partie.
  */
  const calque = courant;
  courant = null;
  /*
     On ferme d'abord, on rend le focus ensuite : le composant masque son
     panneau dans `fermer()`, et rendre le focus avant le laisserait un
     instant sur un élément encore couvert. `leverLePiege` est idempotente —
     `fermer()` passe souvent par `calqueFerme`, qui l'a déjà appelée.
  */
  calque.fermer();
  leverLePiege();
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
export function calqueOuvert(nom: string, fermer: () => void, piegeDemande?: PiegeDemande): void {
  brancher();
  /*
     Le piège se pose AVANT la gestion de l'historique, et indépendamment
     d'elle : un contexte qui refuse `pushState` doit tout de même garder le
     focus dans le dialogue. On perd le retour arrière, pas l'accessibilité.
  */
  if (piegeDemande) poserLePiege(nom, piegeDemande);
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
  /*
     Le piège se lève même si `courant` est nul : l'historique a pu être
     refusé à l'ouverture, auquel cas il n'y a pas d'entrée à ranger mais il y
     a bien un focus à rendre.
  */
  if (piege && (!nom || piege.nom === nom)) leverLePiege();
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
