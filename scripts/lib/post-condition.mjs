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
 *
 * ## Les cinq formes, et laquelle prendre
 *
 * - `apresLaPeinture` — la zone compte ses peintures dans `data-peint`. La
 *   forme la plus sûre, et celle qui demande une marque au site.
 * - `apresLeRemplacement` — la zone remplace ses enfants. Rien à demander au
 *   site : on marque l'ancien nœud et l'on attend un nœud sans la marque.
 * - `apresLeChangementDeTexte` — un texte est réécrit. On relève l'ancien et
 *   l'on attend qu'il diffère, ce qui reste indépendant de ce qu'on affirme.
 * - `attendreLeCompte` — une liste atteint un nombre d'éléments.
 * - `devientVisible` — un élément paraît ou s'en va.
 *
 * Et quand rien de tout cela ne s'applique, parce que l'écriture n'a aucune
 * marque à l'écran, c'est la BASE qu'on interroge jusqu'à ce qu'elle réponde :
 * l'idiome `attendreEnBase` de `essais-niveau-navigateur.mjs`.
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

/**
 * Fait le geste, et attend que la zone ait été REMPLACÉE.
 *
 * ## Le motif que cette aide couvre
 *
 * Beaucoup d'écrans repeignent une liste entière plutôt qu'une ligne :
 * `zone.replaceChildren()`, puis les nouveaux enfants. Il n'y a donc aucun
 * compteur à lire, et la valeur qu'on s'apprête à vérifier est souvent déjà
 * présente — la ligne que l'essai vient de remplir porte déjà « 42 » avant
 * que l'écran ne l'ait relue.
 *
 * On marque alors le premier enfant AVANT le geste, et l'on attend un premier
 * enfant SANS la marque. Aucun passage antérieur ne peut avoir rendu cette
 * condition vraie, puisqu'elle porte sur une marque posée après eux : c'est la
 * forme du compteur monotone, appliquée à un nœud.
 *
 * ## Deux usages, et le second surprend
 *
 *     await apresLeRemplacement(page, '#liste', () => page.click('#ajouter'));
 *
 * et, sans geste du tout, pour attendre la PROCHAINE peinture — celle qu'un
 * délai du site déclenchera tout seul, par exemple l'expiration d'un bandeau
 * d'annulation :
 *
 *     await apresLeRemplacement(page, '#liste');
 *
 * Ce second usage remplace une temporisation calée sur la durée du délai, et
 * il est exact plutôt que généreux : il rend la main quand l'écriture a eu
 * lieu, non six ou huit secondes plus tard.
 *
 * ## Ce qu'elle ne sait pas faire
 *
 * Une zone qui ne remplace pas ses enfants mais les modifie en place ne
 * déclenche rien ici : la marque survit, et l'attente expire. Dans ce cas,
 * `apresLeChangementDeTexte` ou un compteur sur la zone conviennent.
 *
 * @param page la page de Playwright
 * @param zone le conteneur dont les enfants sont remplacés
 * @param geste ce qui déclenche la peinture — rien, pour attendre la suivante
 * @param options.delai en millisecondes, 30 000 par défaut
 */
export async function apresLeRemplacement(page, zone, geste = null, { delai = 30000 } = {}) {
  await page.evaluate(
    (s) => document.querySelector(s)?.firstElementChild?.setAttribute('data-ancien', 'oui'),
    zone,
  );
  if (geste) await geste();
  await page
    .waitForFunction(
      (s) => {
        const premier = document.querySelector(s)?.firstElementChild;
        return Boolean(premier) && !premier.hasAttribute('data-ancien');
      },
      zone,
      { timeout: delai },
    )
    .catch(() => {});
}

/**
 * Fait le geste, et attend que le texte de l'élément ait CHANGÉ.
 *
 * ## Pourquoi « changé » et non « contient ceci »
 *
 * Le motif est partout : on choisit une option, et un paragraphe explique ce
 * que cette option fait. Attendre que le paragraphe contienne la phrase
 * attendue reviendrait à attendre l'assertion elle-même — bornée, donc
 * honnête, mais elle n'apprend plus rien quand elle passe.
 *
 * Attendre un texte DIFFÉRENT de celui d'avant est indépendant de ce qu'on
 * affirme : la valeur de départ est relevée avant le geste, et aucun passage
 * antérieur ne peut l'avoir rendue différente d'elle-même.
 *
 * ## La limite
 *
 * Un geste qui réécrit le même texte — choisir l'option déjà choisie — n'est
 * pas détectable ainsi, et l'attente expire. C'est voulu : un essai qui refait
 * deux fois le même choix mesure autre chose que ce qu'il annonce.
 *
 * @param page la page de Playwright
 * @param cible un sélecteur, ou un localisateur de Playwright
 * @param geste ce qui déclenche le changement
 * @param options.delai en millisecondes, 30 000 par défaut
 * @returns vrai si le texte a changé dans le délai
 */
export async function apresLeChangementDeTexte(page, cible, geste, { delai = 30000 } = {}) {
  /*
     La cible est un SÉLECTEUR ou un localisateur. Le second est souvent le
     seul possible : « le premier paragraphe du second repli de cette ligne »
     s'écrit en localisateurs chaînés et n'a pas d'équivalent CSS honnête.
  */
  const lire =
    typeof cible === 'string'
      ? () => page.textContent(cible).catch(() => null)
      : () => cible.textContent().catch(() => null);

  const avant = await lire();
  await geste();
  const fin = Date.now() + delai;
  for (;;) {
    if ((await lire()) !== avant) return true;
    if (Date.now() > fin) return false;
    await page.waitForTimeout(50);
  }
}

/**
 * Attend que le nombre d'éléments atteigne ce compte.
 *
 * Le motif le plus simple du lot : on enregistre une fiche, et la liste en
 * porte une de plus. L'attente est bornée et son expiration est rendue comme
 * un faux, donc l'assertion qui suit garde son sens — ce qui disparaît, c'est
 * seulement l'exigence que l'écriture et la relecture tiennent en mille deux
 * cents millisecondes.
 *
 * @returns vrai si le compte a été atteint dans le délai
 */
export function attendreLeCompte(page, selecteur, combien, { delai = 30000 } = {}) {
  return page
    .waitForFunction(
      ([s, n]) => document.querySelectorAll(s).length === n,
      [selecteur, combien],
      { timeout: delai },
    )
    .then(() => true)
    .catch(() => false);
}

/**
 * Attend que les animations de l'élément soient TERMINÉES.
 *
 * ## Quand il la faut
 *
 * Dès qu'une assertion lit une GÉOMÉTRIE — « le bandeau est au-dessus de la
 * barre du bas », « la section est dans l'écran » — l'apparition de l'élément
 * ne suffit pas : il peut encore être en train de monter. Mesuré sur le
 * bandeau d'annulation, qui porte `animation: boite-monte` : son bas passe de
 * 708 à 691 puis à 684 px en cent cinquante millisecondes. Lu dès qu'il est
 * visible, il est encore vingt-quatre pixels trop bas, et l'assertion tombe —
 * sur du code sain.
 *
 * C'est la même famille que `scrollend` pour une ancre : une animation se
 * lit par sa FIN, jamais par une durée supposée.
 *
 * ## Comment
 *
 * `Element.getAnimations()` rend les animations en cours, chacune avec sa
 * promesse `finished`. Une animation infinie ne finirait jamais : le délai
 * borne l'attente, et son expiration ne fait pas échouer l'essai — l'assertion
 * qui suit s'en charge, et dira ce qu'elle a vu.
 */
export async function apresLesAnimations(page, selecteur, { delai = 5000 } = {}) {
  await Promise.race([
    page.evaluate(
      (s) => {
        const e = document.querySelector(s);
        if (!e) return null;
        return Promise.all(e.getAnimations().map((a) => a.finished.catch(() => null)));
      },
      selecteur,
    ),
    new Promise((ok) => setTimeout(ok, delai)),
  ]).catch(() => {});
}
