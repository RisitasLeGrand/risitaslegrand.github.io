/**
 * ATTENDRE UNE POST-CONDITION, ET NON UN ÉTAT DURABLE.
 *
 * ## Le défaut que ce module évite
 *
 * `docs/cyclades/cadence-des-essais.md` § 3 le décrit en entier. En deux
 * lignes : attendre qu'un panneau soit visible ne dit rien du moment où son
 * contenu arrive. L'attente est satisfaite soit parce que la condition était
 * déjà vraie avant le geste, soit parce que le gestionnaire l'a rendue vraie
 * puis a cédé la main avant de peindre. Dans les deux cas, l'essai lit l'état
 * d'avant — et il rend souvent la bonne réponse par hasard, ce qui est pire
 * qu'un rouge.
 *
 * ## Ce qu'un compteur a de plus qu'un drapeau
 *
 * `aria-busy` retiré en dernier est une vraie post-condition — mais au REPOS,
 * son absence est déjà vraie. Attendre « plus occupé » après un geste répété
 * est donc satisfait avant même que le geste agisse. Le centre de
 * notifications s'en tire parce qu'on ne l'ouvre qu'une fois par mesure ;
 * l'import bancaire, non, et `essais-rapprocher-ecran` enchaîne cinq relevés.
 *
 * Un compteur monotone n'a pas ce défaut : on relève sa valeur AVANT le geste
 * et on attend qu'elle change. Aucun passage antérieur ne peut avoir rendu
 * cette condition vraie, puisqu'elle porte sur une valeur relevée après eux.
 *
 * ## L'usage
 *
 *     await apresLaPeinture(page, '#etat', async () => {
 *       await page.click('#enregistrer');
 *     });
 *
 * Le relevé a lieu avant le geste, le geste ensuite, et l'attente après — cet
 * ordre est tout l'intérêt, et l'inverser ramène le défaut.
 */

/**
 * Fait le geste, et attend que la zone ait été repeinte APRÈS lui.
 *
 * @param page la page de Playwright
 * @param selecteur la zone qui porte `data-peint`
 * @param geste ce qui déclenche la peinture
 * @param options.delai en millisecondes, 30 000 par défaut
 */
export async function apresLaPeinture(page, selecteur, geste, { delai = 30000 } = {}) {
  /*
     La valeur d'avant, ou `null` si la zone n'a jamais été peinte. Les deux
     cas se traitent pareil : on attend une valeur DIFFÉRENTE, et `null` est
     différent de « 1 ».
  */
  const avant = await page.getAttribute(selecteur, 'data-peint').catch(() => null);
  await geste();
  await page.waitForFunction(
    ([sel, valeurDAvant]) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const maintenant = el.getAttribute('data-peint');
      return maintenant !== null && maintenant !== valeurDAvant;
    },
    [selecteur, avant],
    { timeout: delai },
  );
  /*
     Et la zone n'est plus marquée occupée. Le compteur est posé dans le même
     « finally » que le retrait de `aria-busy`, donc ce second contrôle est
     normalement déjà satisfait ; il coûte un test et dirait quelque chose si
     l'ordre des deux lignes changeait un jour.
  */
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('aria-busy') !== 'true',
    selecteur,
    { timeout: delai },
  );
}
