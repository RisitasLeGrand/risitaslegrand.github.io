/**
 * Accorder l'apprentissage, depuis un essai de navigateur.
 *
 * ## Pourquoi ce module existe
 *
 * Depuis l'anomalie A-13 (`3cf4122`), `observerUsage()` porte une PORTE :
 * sans consentement local, elle rend « silence : sans-consentement » et
 * aucune déduction, avant même de lire le moindre fait. La porte est dans
 * la fonction qui lit, et non chez ses appelants — précisément pour qu'un
 * appelant de plus ne puisse pas relancer l'observation sans que personne
 * l'ait voulu.
 *
 * Deux essais sèment des semaines d'usage puis attendent un constat
 * d'observation. Ils n'accordaient rien, parce qu'ils ont été écrits avant
 * la porte : l'écran se taisait, à juste titre, et les essais l'accusaient.
 *
 * ## Par l'écran, et non par la base
 *
 * On clique l'interrupteur de la page « Mon profil », comme une personne le
 * ferait. Écrire le consentement directement en base ferait un essai qui
 * cesserait de remarquer que l'interrupteur est cassé — et un consentement
 * qu'on ne peut pas donner vaut un consentement refusé.
 */

/**
 * Accorde l'apprentissage par l'écran du profil, et le vérifie.
 *
 * Idempotent : si c'est déjà accordé, le bouton « Autoriser » est caché et
 * la fonction rend la main sans rien faire.
 */
export async function accorderLApprentissage(page, racine, motDePasse) {
  await page.goto(`${racine}/profil/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', motDePasse);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#consentement-etat', { timeout: 30000 });
  const bouton = page.locator('#consentement-accorder');
  if (!(await bouton.isVisible().catch(() => false))) return false;
  await bouton.click();
  /*
     On attend que l'écran le DISE, et non un délai : l'accord passe par une
     écriture en base, et la page ne peint qu'ensuite.
  */
  await page.waitForFunction(
    () => document.getElementById('consentement-revoquer')?.classList.contains('hidden') === false,
    undefined,
    { timeout: 20000 },
  );
  return true;
}
