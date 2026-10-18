/**
 * Le branchement des piles sur le document. Le raisonnement est dans
 * « piles.ts », qui ne connaît ni le stockage ni le DOM et s'éprouve en Node.
 */
import { destination, ongletParRacine, poser, type Piles } from './piles';

const CLEF = 'cyclades.piles';

const lire = (): Piles => {
  try {
    const brut = sessionStorage.getItem(CLEF);
    const lu: unknown = brut ? JSON.parse(brut) : {};
    return lu && typeof lu === 'object' ? (lu as Piles) : {};
  } catch {
    return {};
  }
};

const ecrire = (piles: Piles): void => {
  try {
    sessionStorage.setItem(CLEF, JSON.stringify(piles));
  } catch {
    // Navigation privée : les piles ne tiendront pas, le site marche quand même.
  }
};

/**
 * Note la position courante, et détourne les appuis sur les onglets.
 *
 * Le détournement est volontairement **tardif** : les liens gardent leur
 * `href` vers la racine, de sorte qu'un clic du milieu, un « ouvrir dans un
 * nouvel onglet », ou l'absence de JavaScript mènent quelque part de juste.
 * La pile est un confort ; elle ne doit pas être la seule façon d'arriver.
 */
export function brancherLesPiles(base: string): () => void {
  const prefixe = base.replace(/\/$/, '');
  const sansBase = (chemin: string) =>
    (prefixe && chemin.startsWith(prefixe) ? chemin.slice(prefixe.length) : chemin) || '/';

  ecrire(poser(lire(), sansBase(location.pathname)));

  const surClic = (evenement: MouseEvent) => {
    /*
       On ne touche ni aux clics modifiés, ni aux clics du milieu : ils
       ouvrent ailleurs, et détourner une destination vers un autre onglet du
       navigateur serait la pire des surprises.
    */
    if (
      evenement.defaultPrevented ||
      evenement.button !== 0 ||
      evenement.metaKey ||
      evenement.ctrlKey ||
      evenement.shiftKey ||
      evenement.altKey
    ) {
      return;
    }
    const cible = evenement.target as HTMLElement | null;
    const lien = cible?.closest?.('a[data-onglet]') as HTMLAnchorElement | null;
    if (!lien) return;
    const onglet = ongletParRacine(lien.dataset.onglet ?? '');
    if (!onglet) return;

    const ou = destination(lire(), onglet, sansBase(location.pathname));
    const complet = `${prefixe}${ou}`;
    if (complet === location.pathname) {
      /*
         Déjà à destination : on ne recharge pas. Un second appui qui recharge
         la page donne l'impression d'un bouton cassé, parce que rien ne bouge
         pendant une seconde puis tout clignote.
      */
      evenement.preventDefault();
      return;
    }
    evenement.preventDefault();
    location.assign(complet);
  };

  document.addEventListener('click', surClic);
  return () => document.removeEventListener('click', surClic);
}
