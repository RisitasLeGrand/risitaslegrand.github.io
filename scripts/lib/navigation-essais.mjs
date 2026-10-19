/**
 * Lire la navigation de branche, depuis un essai de navigateur.
 *
 * ## Pourquoi ce module existe
 *
 * Plusieurs essais lisaient `#navigation-principale a` et attendaient ce
 * ruban par `waitForSelector`. Depuis la BARRE LATÉRALE (D-010), le ruban
 * n'est plus rendu partout : `global.css` lui pose
 * `display: none !important` sous `(min-width: 1024px) and (pointer: fine)`,
 * c'est-à-dire exactement le contexte par défaut de Playwright — 1280 px et
 * souris. La latérale le remplace, avec les mêmes onglets.
 *
 * Les essais attendaient donc, quarante secondes, un élément que le site a
 * raison de cacher. Ils ne mesuraient plus la navigation de la branche : ils
 * mesuraient une de ses deux surfaces, celle qui ne s'affiche pas là où ils
 * regardent.
 *
 * Lire « la surface rendue » n'est pas un relâchement : c'est la question
 * d'origine — *la branche courante porte-t-elle ses écrans, et pas ceux
 * d'une autre ?* La réponse doit être vraie sur l'ordinateur comme sur le
 * téléphone, et `essais:laterale` et `essais:navigation:navigateur` tiennent
 * séparément laquelle des deux surfaces doit paraître dans quel contexte.
 */

/** Les deux surfaces, dans l'ordre où on les interroge. */
const SURFACES = ['nav#navigation-principale', 'nav#barre-laterale'];

/**
 * Attend qu'une navigation de branche soit rendue, et rend ses liens.
 *
 * Rend les **chemins** (sans la barre finale, sauf la racine) de tous les
 * liens visibles, groupes dépliés — c'est ce que fait quelqu'un qui cherche
 * un onglet. Lève si aucune des deux surfaces n'a répondu dans le délai : un
 * essai qui lirait zéro lien et conclurait « pas d'onglet de Révisions »
 * passerait au vert pour une page blanche.
 */
export async function liensDeNavigation(page, { delai = 40000 } = {}) {
  const lire = () =>
    page.evaluate((surfaces) => {
      for (const d of document.querySelectorAll('nav#navigation-principale details, nav#barre-laterale details')) {
        /** @type {HTMLDetailsElement} */ (d).open = true;
      }
      const resultat = {};
      for (const sel of surfaces) {
        resultat[sel] = [...document.querySelectorAll(`${sel} a`)]
          .filter((a) => a.getClientRects().length > 0)
          .map((a) => new URL(a.href).pathname);
      }
      return resultat;
    }, SURFACES);

  const limite = Date.now() + delai;
  let releve = {};
  for (;;) {
    releve = await lire().catch(() => ({}));
    const tous = Object.values(releve).flat();
    if (tous.length > 0) {
      return {
        chemins: tous,
        surface: SURFACES.find((s) => (releve[s] ?? []).length > 0),
      };
    }
    if (Date.now() > limite) {
      throw new Error(
        'aucune navigation de branche rendue : ni le ruban ni la latérale ne portent de lien visible',
      );
    }
    await page.waitForTimeout(250);
  }
}
