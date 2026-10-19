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
 *  2. au bout de `ATTENTE_MAX`, si la zone ne devient jamais visible (une
 *     fenêtre plus courte que la zone, un conteneur à défilement imbriqué) ;
 *  3. tout de suite, si le haut de la zone est déjà en place — le cas de
 *     l'ordinateur, où rien n'a besoin de bouger.
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
      tenir();
    };

    /*
       Le seuil est à zéro et c'est la POSITION qui décide : l'observateur sert
       à être prévenu quand le défilement a bougé, le rectangle à savoir s'il a
       assez bougé. Un seuil de part visible aurait écarté d'emblée les zones
       plus hautes que la fenêtre, qui sont justement celles qui en ont besoin.
    */
    const observateur = new IntersectionObserver(
      (entrees) => {
        const enPlace = entrees.some((e) => {
          const r = e.boundingClientRect;
          const fenetre = e.rootBounds?.height ?? innerHeight;
          /* Entrée en entier, ou à défaut commencée en haut de la fenêtre. */
          if (r.top >= -1 && r.bottom <= fenetre + 1) return true;
          return Math.abs(r.top) <= TOLERANCE_HAUT;
        });
        if (enPlace) achever();
      },
      { threshold: [0] },
    );
    const minuteur = setTimeout(achever, ATTENTE_MAX);
    observateur.observe(zone);
  });
}
