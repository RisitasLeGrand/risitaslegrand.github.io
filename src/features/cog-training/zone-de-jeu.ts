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
 *  3. tout de suite, si la zone est déjà visible — le cas de l'ordinateur, où
 *     rien n'a besoin de bouger.
 *
 * Dans les trois cas la partie démarre. Aucun chemin ne laisse l'écran inerte.
 */

/** Part de la zone qui doit être visible pour que la partie démarre. */
const PART_VISIBLE = 0.9;

/**
 * Au-delà, on démarre quand même. Mesurée large : un défilement lissé sur un
 * téléphone lent prend quelques centaines de millisecondes, et couper trop tôt
 * reviendrait à ne pas avoir attendu.
 */
const ATTENTE_MAX = 1200;

/**
 * Le défilement respecte le réglage du système : « lissé » est une animation,
 * et quelqu'un qui demande moins de mouvement ne l'a pas demandée. Lu à chaque
 * appel plutôt qu'une fois : le réglage peut changer pendant la session.
 */
function defilementLisse(): ScrollBehavior {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
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

  zone.scrollIntoView({ behavior: defilementLisse(), block: 'center' });

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

    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.intersectionRatio >= PART_VISIBLE)) achever();
      },
      { threshold: [PART_VISIBLE] },
    );
    const minuteur = setTimeout(achever, ATTENTE_MAX);
    observateur.observe(zone);
  });
}
