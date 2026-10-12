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
    // Soit l'écran des questions s'ouvre, soit l'écran de fin : dans les deux
    // cas, « Entrer » apparaît une fois la marque posée.
    await page.waitForSelector('#terminer, #aller-menu, #commencer', { timeout: 40000 });
    if (await page.locator('#commencer').isVisible().catch(() => false)) {
      await page.click('#commencer');
    }
    if (await page.locator('#terminer').isVisible().catch(() => false)) {
      await page.click('#terminer');
    }
    await page.waitForSelector('#aller-menu', { timeout: 20000 });
  }
}
