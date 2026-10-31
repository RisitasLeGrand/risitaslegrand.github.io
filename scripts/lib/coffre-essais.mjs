/**
 * Ouvrir le coffre depuis un écran, pour les essais.
 *
 * ## Pourquoi ce module existe
 *
 * Le motif était recopié à la main dans au moins six essais : remplir
 * `#mdp-coffre`, cliquer `#ouvrir-coffre`, attendre `#coffre-ouvert`. Six
 * copies d'un geste, dont la septième allait être la mienne — et l'une d'elles
 * se taira le jour où le formulaire change d'identifiant.
 *
 * Il n'ouvre rien de lui-même : il remplit le formulaire que l'écran affiche,
 * exactement comme un doigt. Le coffre n'est PAS la session — déverrouiller la
 * session ne l'ouvre pas —, et c'est pourquoi ce geste-là est séparé de
 * `franchirInitialisation`.
 *
 * ## La post-condition
 *
 * `#coffre-ouvert` visible. Sans elle, un essai qui continuerait trop tôt
 * mesurerait un écran encore fermé et appellerait cela un défaut de ce qu'il
 * voulait éprouver.
 */

/**
 * Ouvre le coffre sur la page courante.
 *
 * @param page la page Playwright, déjà sur un écran qui porte le formulaire
 * @param mdp le mot de passe du coffre
 * @returns `true` si le coffre est ouvert, `false` si l'écran ne l'offrait pas
 */
export async function ouvrirLeCoffre(page, mdp, { delai = 20000 } = {}) {
  /* Déjà ouvert : rien à faire, et c'est le cas quand deux essais
     s'enchaînent dans le même contexte. */
  if (await page.locator('#coffre-ouvert').isVisible().catch(() => false)) return true;
  const champ = page.locator('#mdp-coffre');
  if (!(await champ.isVisible().catch(() => false))) return false;
  await champ.fill(mdp);
  await page.click('#ouvrir-coffre');
  await page.waitForSelector('#coffre-ouvert', { state: 'visible', timeout: delai });
  return true;
}
