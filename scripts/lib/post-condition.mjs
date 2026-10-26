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

/**
 * L'élément atteint-il cet état de visibilité, dans le délai ?
 *
 * ## Pourquoi cela remplace une temporisation à l'aveugle
 *
 * Le motif le plus répandu dans les essais de navigateur est
 *
 *     await page.click('#masquer');
 *     await page.waitForTimeout(300);
 *     verifier('le bandeau part', await page.locator('#bandeau').isVisible(), false);
 *
 * Trois cents millisecondes sont une MOYENNE : sous une batterie chargée, la
 * peinture arrive après, et l'essai lit l'état d'avant. Le § 3 de
 * « cadence-des-essais.md » le dit — une temporisation à l'aveugle réduit le
 * risque sans le supprimer, et cède là où elle était censée protéger.
 *
 * ## Et pourquoi ce n'est pas un vert à vide
 *
 * L'objection évidente : attendre la condition qu'on va affirmer rend
 * l'affirmation impossible à démentir. Elle ne tient pas, parce que l'attente
 * est BORNÉE et que son expiration est rendue comme un faux. La condition
 * n'est pas supposée : elle est vérifiée en continu pendant tout le délai, et
 * l'assertion échoue si elle ne vient jamais. Ce qui disparaît, c'est
 * seulement l'exigence qu'elle arrive en moins de trois cents millisecondes —
 * laquelle ne mesurait pas l'écran mais la charge de la machine.
 *
 * ## Ce qu'elle ne sait pas faire
 *
 * Pour « l'élément RESTE visible », elle tolère une arrivée tardive : un
 * élément qui clignoterait passerait. La temporisation à l'aveugle était
 * pire — elle lisait à un instant arbitraire — mais la limite est réelle, et
 * un invariant de ce genre se tient mieux par un compteur sur la zone.
 */
export async function devientVisible(page, selecteur, visible, { delai = 10000 } = {}) {
  return page
    .waitForSelector(selecteur, { state: visible ? 'visible' : 'hidden', timeout: delai })
    .then(() => true)
    .catch(() => false);
}
