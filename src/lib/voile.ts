/**
 * Le voile : ce que l'écran montre quand on ne le regarde plus.
 *
 * ## Le défaut visé
 *
 * Quitter l'application ne vide pas l'écran. Sur un téléphone, le sélecteur
 * d'applications garde une **vignette** de la dernière page affichée, et cette
 * vignette est visible de n'importe qui regarde l'appareil par-dessus une
 * épaule — sans mot de passe, sans rien ouvrir. Sur un ordinateur, un partage
 * d'écran ou un second moniteur montre la même chose. Le coffre, le
 * verrouillage automatique et les mots de passe ne protègent de rien ici :
 * l'écran a déjà été dessiné.
 *
 * Le voile couvre la page dès qu'elle cesse d'être au premier plan, et se
 * retire dès qu'elle y revient.
 *
 * ## Ce qu'il ne garantit PAS, et il faut le dire avant de l'écrire
 *
 * Le voile dépend d'un événement du navigateur. Le système, lui, prend sa
 * vignette quand il veut : sur iOS en particulier, rien ne garantit que
 * `visibilitychange` soit traité **avant** la capture. Le voile réduit donc
 * la fenêtre, il ne la ferme pas. Promettre l'inverse serait faux, et c'est
 * le genre de fausseté qui fait baisser la garde — raison pour laquelle cette
 * limite est écrite ici et dans la fiche « mot de passe perdu », et non
 * seulement dans un commentaire.
 *
 * Il ne protège pas non plus d'une capture d'écran volontaire, que rien dans
 * une page web ne peut empêcher.
 *
 * ## Pourquoi il se retire de quatre façons
 *
 * Un voile resté en place rendrait l'application inutilisable, ce qui serait
 * un dégât bien réel pour une protection partielle. Il se retire donc au
 * retour de visibilité, à la reprise du focus, au retour arrière du
 * navigateur (`pageshow`), et au clic — ce dernier n'est pas un garde-fou
 * sérieux, c'est la sortie de secours.
 */

/** L'identifiant du voile, exporté pour que les essais le désignent. */
export const ID_VOILE = 'voile-confidentialite';

function creer(): HTMLElement {
  const voile = document.createElement('div');
  voile.id = ID_VOILE;
  /*
     `aria-hidden` : il n'y a rien à lire là-dedans, et une technologie
     d'assistance n'a aucune raison d'annoncer un écran qui n'existe que
     pendant que personne ne regarde.
  */
  voile.setAttribute('aria-hidden', 'true');
  voile.style.cssText = [
    'position:fixed',
    'inset:0',
    /*
       Au-dessus de tout, y compris du dialogue de redemande de mot de passe,
       qui est un `<dialog>` modal donc dans la couche du dessus. Un voile que
       le contenu traverse ne voile rien.
    */
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    /*
       Opaque, et aux couleurs du thème.
       
       La première version posait un bleu ardoise très sombre en dur, avec
       cette raison : au
       moment où le voile est posé, la page part en arrière-plan et une
       lecture de style calculé coûterait un reflow qu'on n'a plus le temps
       de payer. La raison était juste pour une **lecture** ; elle ne valait
       pas pour une écriture. Écrire « var(--etat-fond) » dans un style en
       ligne ne lit rien : c'est le moteur de style qui résoudra la variable,
       au moment où il peindra. Le voile suit donc les quatorze thèmes, et ne
       coûte toujours rien.
    */
    'background:var(--etat-fond)',
    'color:var(--etat-texte-faible)',
    'font:600 1rem/1.4 system-ui,sans-serif',
    'letter-spacing:0.02em',
  ].join(';');
  voile.textContent = 'Cyclades';
  return voile;
}

function poser(): void {
  if (document.getElementById(ID_VOILE)) return;
  document.body.appendChild(creer());
}

function retirer(): void {
  document.getElementById(ID_VOILE)?.remove();
}

/**
 * Branche le voile. Rend la fonction qui le débranche.
 *
 * Montée depuis la mise en page, donc présente sur toutes les pages : une
 * seule page oubliée suffirait à rendre la mesure inutile, puisque c'est
 * précisément celle qu'on aurait sous les yeux en quittant.
 */
export function brancherLeVoile(): () => void {
  const surVisibilite = () => {
    if (document.visibilityState === 'hidden') poser();
    else retirer();
  };
  const surCache = () => poser();
  const surRetour = () => retirer();

  document.addEventListener('visibilitychange', surVisibilite);
  window.addEventListener('pagehide', surCache);
  window.addEventListener('blur', surCache);
  window.addEventListener('pageshow', surRetour);
  window.addEventListener('focus', surRetour);
  document.addEventListener('click', surRetour, true);

  /* L'état de départ compte : une page chargée en arrière-plan doit naître voilée. */
  surVisibilite();

  return () => {
    document.removeEventListener('visibilitychange', surVisibilite);
    window.removeEventListener('pagehide', surCache);
    window.removeEventListener('blur', surCache);
    window.removeEventListener('pageshow', surRetour);
    window.removeEventListener('focus', surRetour);
    document.removeEventListener('click', surRetour, true);
    retirer();
  };
}
