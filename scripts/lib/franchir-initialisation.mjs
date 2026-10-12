/**
 * Franchir l'initialisation, pour les essais qui ne la mesurent pas.
 *
 * ## Pourquoi ce module existe
 *
 * Depuis la phase C, `/` mène à l'initialisation tant qu'elle n'a pas eu lieu,
 * et `/revisions/` aux six questions de la branche tant qu'elles n'ont pas été
 * posées. C'est le parcours réel d'une première ouverture, et les essais de
 * navigateur partent tous d'un profil vierge : ils arrivaient donc sur un écran
 * qu'ils n'attendaient pas, et échouaient sur un défaut qui n'existe pas.
 *
 * Plutôt que de leur faire contourner la garde par une écriture directe en
 * base, ce module la **traverse** comme une personne le ferait : « Terminer
 * maintenant », qui est visible sur chaque question. Un essai qui passerait par
 * la porte de service cesserait de remarquer que la porte principale est
 * cassée.
 */

/**
 * Mène l'initialisation du socle et le module de Révisions à leur terme.
 *
 * Idempotente : sur une base déjà initialisée, les deux visites ne trouvent
 * rien à faire et rendent la main.
 */
export async function franchirInitialisation(page, racine, motDePasse) {
  for (const chemin of ['/initialisation/', '/initialisation/?branche=revisions']) {
    await page.goto(`${racine}${chemin}`, { waitUntil: 'networkidle' });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', motDePasse);
      await page.click('#bouton-verrou');
    }
    /*
       Soit l'écran des questions s'ouvre, soit l'écran allégé, soit l'écran de
       fin. On attend que **l'un des trois** boutons soit visible, et non le
       premier du sélecteur : « waitForSelector » sur une union résout la liste
       puis attend le premier élément, qui est `#terminer` — caché tant que
       l'écran allégé est affiché. L'attente expirait donc sur une base qui
       porte déjà de l'usage, c'est-à-dire précisément le cas où l'écran allégé
       existe.
    */
    await page.waitForFunction(
      () =>
        ['terminer', 'aller-menu', 'commencer'].some((id) => {
          const e = document.getElementById(id);
          return e instanceof HTMLElement && e.offsetParent !== null;
        }),
      undefined,
      { timeout: 40000 },
    );
    if (await page.locator('#commencer').isVisible().catch(() => false)) {
      await page.click('#commencer');
    }
    if (await page.locator('#terminer').isVisible().catch(() => false)) {
      await page.click('#terminer');
    }
    await page.waitForSelector('#aller-menu', { timeout: 20000 });
  }
}
