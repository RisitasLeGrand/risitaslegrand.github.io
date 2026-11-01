/**
 * Amener la zone de jeu sous les yeux, et ne lancer qu'une fois qu'elle y est.
 *
 * ## Le défaut que cette fonction existe pour empêcher
 *
 * Les trois exercices de la branche s'ouvrent sur des réglages, parfois longs :
 * dans Mémoire de travail, le détail des dimensions, des touches et de la
 * progression pousse la zone de jeu sous la ligne de flottaison d'un
 * téléphone. Au lancement, la page ne bougeait pas — rien ne le lui demandait.
 * On touchait « Commencer » et il ne se passait rien de visible, pendant que la
 * première épreuve défilait hors de l'écran. Le premier stimulus était donc
 * perdu par construction, et la faute paraissait venir de la personne.
 *
 * ## Pourquoi attendre la visibilité, et non seulement défiler
 *
 * Un appel à `scrollIntoView` ne dit pas quand le défilement s'achève, et il
 * est lissé par défaut : lancer la partie juste après revient à parier sur une
 * durée d'animation. La promesse rendue ici n'est tenue que lorsque la zone est
 * **effectivement** visible, mesurée par l'observateur du navigateur. C'est ce
 * qui permet à l'essai de constater la règle plutôt que de l'espérer.
 *
 * ## Les trois sorties de secours
 *
 * Une attente qui ne finit jamais serait pire que le défaut : l'écran resterait
 * figé sur une partie qui ne démarre pas. La promesse se résout donc aussi
 *
 *  1. si `IntersectionObserver` n'existe pas — le défilement a tout de même eu
 *     lieu, et c'est mieux que rien ;
 *  1 bis. sur la fin du défilement (`scrollend`), qui est le signal exact et
 *     celui qui tient la promesse dans le cas courant ;
 *  2. au bout de `ATTENTE_MAX`, si la zone ne devient jamais visible (une
 *     fenêtre plus courte que la zone, un conteneur à défilement imbriqué) ;
 *  3. tout de suite, si le haut de la zone est déjà en place — le cas de
 *     l'ordinateur, où rien n'a besoin de bouger.
 *
 * La deuxième n'est une sortie de SECOURS que depuis le 1er novembre : avant,
 * toute zone plus haute que la fenêtre y passait à chaque lancement, parce que
 * le haut visé était zéro et non le décalage de la page. Voir
 * `decalageDeLaPage`.
 *
 * Dans les trois cas la partie démarre. Aucun chemin ne laisse l'écran inerte.
 */

/**
 * Tolérance, en pixels, sur la position du haut de la zone.
 *
 * ## Pourquoi le HAUT, et non une part visible
 *
 * La première version exigeait 90 % de la zone dans la fenêtre, et amenait la
 * zone au centre. L'essai a montré que c'était la mauvaise règle : la zone de
 * l'énoncé de Raisonnement mesure 1149 px dans une fenêtre de 844. Elle ne
 * peut donc JAMAIS atteindre 90 %, et la centrer coupait le haut — c'est-à-dire
 * le début de l'énoncé, là où l'on commence à lire.
 *
 * La règle tenable est donc : le haut de la zone au haut de la fenêtre. Elle
 * vaut pour une zone courte comme pour une zone trop haute, et elle se mesure
 * d'une seule façon.
 */
const TOLERANCE_HAUT = 4;

/**
 * LE HAUT VISÉ N'EST PAS ZÉRO, ET C'EST LA PAGE QUI LE DIT.
 *
 * ## Le défaut, et il coûtait 1200 ms à chaque lancement
 *
 * La racine porte `scroll-padding-top` pour que `scrollIntoView` pose sa cible
 * SOUS l'en-tête collant au lieu de la glisser dessous. Mesuré le 1er novembre :
 * **111 px**, soit l'en-tête de 103 et huit de respiration. Et le haut de la
 * zone s'y pose exactement, les neuf fois, sur les trois écrans.
 *
 * Or cette fonction comparait ce haut à ZÉRO, à quatre pixels près. Pour une
 * zone plus haute que la fenêtre — l'énoncé long de Raisonnement, une fois sur
 * deux —, ni « entrée en entier » ni « haut à 4 px près » n'est donc JAMAIS
 * vrai : la promesse tombait chaque fois dans sa sortie de secours, et la
 * partie démarrait 1200 ms après le toucher alors que la zone était en place
 * depuis 400.
 *
 * Rien ne le signalait. L'écran était correct — la zone bien placée sous
 * l'en-tête —, et le retard ne se voyait qu'à la montre. Comme la hauteur de
 * l'énoncé est tirée au hasard, il frappait un lancement sur deux, ce qui le
 * rendait irreproductible à la demande.
 *
 * ## Pourquoi le LIRE et non l'écrire
 *
 * Recopier 111 ici aurait produit une fonction fausse au premier changement de
 * l'en-tête, et fausse en silence — le retard reviendrait sans qu'une ligne ait
 * bougé ici. On lit donc la valeur que la page impose, à chaque appel : c'est
 * elle qui décide, et elle peut changer avec la fenêtre.
 *
 * Une valeur illisible ou absente vaut zéro, ce qui est l'ancien comportement :
 * une page sans `scroll-padding-top` pose bien sa cible en haut.
 */
function decalageDeLaPage(): number {
  try {
    const dit = getComputedStyle(document.documentElement).scrollPaddingTop;
    const valeur = Number.parseFloat(dit);
    return Number.isFinite(valeur) ? valeur : 0;
  } catch {
    return 0;
  }
}

/**
 * Au-delà, on démarre quand même. Mesurée large : un défilement lissé sur un
 * téléphone lent prend quelques centaines de millisecondes, et couper trop tôt
 * reviendrait à ne pas avoir attendu.
 */
const ATTENTE_MAX = 1200;

/**
 * Le défilement respecte le mouvement réduit : « lissé » est une animation, et
 * quelqu'un qui demande moins de mouvement ne l'a pas demandée.
 *
 * **Les DEUX réglages sont lus**, et c'est le socle qui l'a rappelé : le
 * réglage du système, et celui de l'application, posé en « data-animations »
 * sur la racine par la page Paramètres. Ma première écriture ne lisait que le
 * premier — quelqu'un qui avait coché « animations réduites » dans Cyclades,
 * sur un système qui ne demande rien, aurait eu le défilement lissé quand même.
 * `essais:mouvement-reduit` interdit précisément de ne connaître qu'un des
 * deux, et il avait raison contre moi.
 *
 * Lu à chaque appel plutôt qu'une fois : l'interrupteur peut basculer pendant
 * la session, et un lancement plus tard doit en tenir compte.
 */
function defilementLisse(): ScrollBehavior {
  try {
    if (typeof window === 'undefined') return 'auto';
    const systeme =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const application =
      document.documentElement.getAttribute('data-animations') === 'reduites';
    return systeme || application ? 'auto' : 'smooth';
  } catch {
    return 'auto';
  }
}

/**
 * Fait venir `zone` sous les yeux, et rend la main quand elle y est.
 *
 * À appeler après que le rendu a eu lieu — dans Svelte, après un `tick()` —,
 * sans quoi la zone n'existe pas encore dans la page.
 */
export function amenerLaZone(zone: HTMLElement | null | undefined): Promise<void> {
  if (!zone) return Promise.resolve();

  zone.scrollIntoView({ behavior: defilementLisse(), block: 'start' });

  if (typeof IntersectionObserver === 'undefined') return Promise.resolve();

  return new Promise<void>((tenir) => {
    let fini = false;
    const achever = () => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      observateur.disconnect();
      removeEventListener('scrollend', surFinDuDefilement);
      tenir();
    };

    /** Le haut de la zone est-il arrivé là où la page le veut ? */
    const enPlaceMaintenant = (): boolean => {
      const r = zone.getBoundingClientRect();
      if (r.top >= -1 && r.bottom <= innerHeight + 1) return true;
      return Math.abs(r.top - decalageDeLaPage()) <= TOLERANCE_HAUT;
    };

    /*
       LA FIN DU DÉFILEMENT EST UN ÉVÉNEMENT, et sans lui cette promesse ne
       pouvait pas tenir.

       L'`IntersectionObserver` à seuil zéro prévient quand la zone FRANCHIT le
       bord de la fenêtre — donc en pleine descente, où le haut n'est pas encore
       arrivé. Ensuite, plus rien ne le réveille : la part visible ne recroise
       plus zéro. Pour une zone plus haute que la fenêtre, la promesse tombait
       donc TOUJOURS dans sa sortie de secours, même après que le haut visé a
       été corrigé. Mesuré le 1er novembre : 2202 ms avant la première épreuve
       de Mémoire de travail sur une fenêtre de 640, là où la zone est en place
       depuis 310 ms.

       « scrollend » dit exactement ce qu'il faut : le défilement est fini, la
       position est définitive. On relit alors la position une fois, et l'on
       tient. L'observateur reste, pour les navigateurs qui n'ont pas
       l'événement et pour le cas où la zone arrive en place sans qu'un
       défilement ait lieu.
    */
    const surFinDuDefilement = () => {
      if (enPlaceMaintenant()) achever();
    };

    /*
       Le seuil est à zéro et c'est la POSITION qui décide : l'observateur sert
       à être prévenu quand le défilement a bougé, le rectangle à savoir s'il a
       assez bougé. Un seuil de part visible aurait écarté d'emblée les zones
       plus hautes que la fenêtre, qui sont justement celles qui en ont besoin.
    */
    /*
       L'OBSERVATEUR CONSULTE LA MÊME DÉFINITION QUE TOUT LE RESTE.

       Il portait sa propre copie de « est-ce en place ? », lue sur le rectangle
       que l'entrée d'intersection fournit. Deux copies de la même règle, donc
       une seconde source : un sabotage l'a montré le 1er novembre — fausser
       celle de l'observateur ne changeait RIEN, parce que `scrollend` tient la
       promesse par l'autre. Une règle qu'on peut casser sans conséquence n'est
       pas une règle, c'est un commentaire exécutable.

       Il n'y en a plus qu'une, et l'observateur relit la position plutôt que
       d'en recevoir une version. C'est une lecture de plus par notification,
       et elles sont rares : l'observateur ne se réveille qu'au franchissement
       du bord.
    */
    const observateur = new IntersectionObserver(
      () => {
        if (enPlaceMaintenant()) achever();
      },
      { threshold: [0] },
    );
    const minuteur = setTimeout(achever, ATTENTE_MAX);
    observateur.observe(zone);
    addEventListener('scrollend', surFinDuDefilement, { passive: true });
    /*
       ET SI LE HAUT EST DÉJÀ ARRIVÉ, on ne demande rien à personne : le cas de
       l'ordinateur, où la zone tient sans que rien ait à bouger. Vérifié après
       l'abonnement, pour qu'un défilement qui finirait entre les deux ne soit
       pas perdu.
    */
    if (enPlaceMaintenant()) achever();
  });
}
