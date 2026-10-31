/**
 * Répondre à la boîte commune, depuis un essai de navigateur.
 *
 * ## Pourquoi ce module existe
 *
 * La section C du prompt 43 a remplacé 13 `confirm()`, 4 `alert()` et
 * 2 `prompt()` par une seule boîte : un `<dialog>` ouvert en modal. Neuf
 * essais de navigateur écoutaient encore `page.on('dialog')`, c'est-à-dire
 * la fenêtre NATIVE du navigateur. Elle ne s'ouvre plus. Leurs symptômes
 * dans la batterie du 18 octobre :
 *
 * - une expiration à 30 ou 40 s, parce qu'ils attendent un message qui
 *   n'est écrit qu'après une réponse qu'ils ne donnent pas ;
 * - « dialog.boite intercepts pointer events », parce qu'ils cliquent dans
 *   la page pendant que la feuille est ouverte, et qu'un modal arrête le
 *   pointeur — ce qui est son rôle ;
 * - « attendu 1, obtenu 0 » quand ils comptaient les fenêtres natives.
 *
 * Ces essais ne sont pas trop exigeants : ils regardent au mauvais endroit.
 * Les mettre à jour n'est donc pas les assouplir, c'est leur rendre leur
 * objet.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne contourne rien : il clique le bouton que la personne cliquerait,
 * par son libellé — le verbe de l'action, jamais « OK ». Un essai qui
 * fermerait la boîte en la retirant du DOM mesurerait un écran qui n'existe
 * pour personne.
 */

/** Le sélecteur de la boîte commune, écrit une fois. */
export const BOITE = 'dialog.boite';

/** Attend que la boîte soit ouverte, et rend son titre. */
export async function attendreLaBoite(page, { delai = 10000 } = {}) {
  await page.waitForSelector(`${BOITE}[open]`, { timeout: delai });
  return ((await page.locator(`${BOITE} .boite-titre`).textContent()) ?? '').trim();
}

/**
 * Répond à la boîte en cliquant le bouton dont le libellé est donné.
 *
 * Le libellé, et non une position : c'est lui que la décision 1 du 43
 * impose — « le bouton dit l'action » —, et un essai qui cliquerait « le
 * second bouton » cesserait de voir le jour où les deux s'échangent.
 */
export async function repondreALaBoite(page, verbe, { delai = 10000 } = {}) {
  await page.waitForSelector(`${BOITE}[open]`, { timeout: delai });
  await page.locator(`${BOITE} .boite-bouton`, { hasText: verbe }).first().click();
  await page.waitForSelector(`${BOITE}[open]`, { state: 'detached', timeout: delai });
}

/** Remplit le champ d'une demande de texte, puis valide. */
export async function repondreAuChamp(page, valeur, verbe = 'Enregistrer', options = {}) {
  await page.waitForSelector(`${BOITE}[open] input, ${BOITE}[open] textarea`, {
    timeout: options.delai ?? 10000,
  });
  await page.fill(`${BOITE}[open] input, ${BOITE}[open] textarea`, valeur);
  await repondreALaBoite(page, verbe, options);
}

/**
 * Remplit les dates d'une boîte de répartition, désignées par leur ÉTIQUETTE.
 *
 * ## Pourquoi cet auxiliaire s'ajoute à « repondreAuChamp »
 *
 * « repondreAuChamp » remplit UN champ. La boîte des dates d'épreuves en
 * porte un par parcours — quatre aujourd'hui —, et lui donner une chaîne JSON
 * échouait sur « Malformed value » : le JSON partait dans le premier
 * `input[type=date]`, qui refuse tout ce qui n'est pas une date.
 *
 * Ce n'était pas une exigence trop forte, c'était un essai qui regardait au
 * mauvais endroit : la section C du 43 a retiré le JSON de cette saisie —
 * c'était bien son objet —, et l'essai est resté à l'ancienne forme. On lui
 * rend donc son objet.
 *
 * ## Désignées par leur étiquette, et par rien d'autre
 *
 * Pas par leur position : « la deuxième date » cesserait de voir le jour où
 * un parcours s'ajoute, et il s'en ajoute. Pas par un attribut `name` non
 * plus — la saisie n'en pose pas. On lit donc les étiquettes telles qu'elles
 * s'affichent et l'on compare le texte ENTIER : « DGFiP A » est un préfixe de
 * « DGFiP AP », et une comparaison par sous-chaîne remplirait le mauvais
 * champ sans rien dire.
 *
 * Une étiquette introuvable fait ÉCHOUER, avec la liste de celles qui
 * existent : un essai qui écrirait dans le vide rendrait un vert sans objet.
 */
export async function repondreAuxDates(page, dates, verbe = 'Enregistrer', options = {}) {
  const delai = options.delai ?? 10000;
  await page.waitForSelector(`${BOITE}[open] input[type="date"]`, { timeout: delai });
  const etiquettes = await page.$$eval(`${BOITE}[open] label`, (labels) =>
    labels.map((l) => (l.querySelector('span')?.textContent ?? '').trim()),
  );
  for (const [etiquette, valeur] of Object.entries(dates)) {
    const rang = etiquettes.indexOf(etiquette);
    if (rang === -1) {
      throw new Error(
        `La boîte ne porte pas de date pour « ${etiquette} ». Étiquettes trouvées : ` +
          `${etiquettes.map((e) => `« ${e} »`).join(', ')}.`,
      );
    }
    await page.locator(`${BOITE}[open] label`).nth(rang).locator('input[type="date"]').fill(valeur);
  }
  await repondreALaBoite(page, verbe, options);
}

/**
 * Compte les ouvertures de boîte, pour les essais qui comptaient les
 * fenêtres natives.
 *
 * À appeler AVANT la première navigation : `addInitScript` ne s'applique
 * qu'aux documents chargés après lui. On enveloppe `showModal`, et non on
 * observe le DOM : l'ouverture est ce qu'on compte, et une boîte posée puis
 * retirée sans être ouverte ne doit pas compter.
 */
export async function compterLesBoites(page) {
  const pose = `(() => {
    if (globalThis.__boitesComptees) return globalThis.__boitesOuvertes ?? 0;
    globalThis.__boitesComptees = true;
    globalThis.__boitesOuvertes = 0;
    const natif = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function (...args) {
      if (this.classList.contains('boite')) globalThis.__boitesOuvertes += 1;
      return natif.apply(this, args);
    };
    return 0;
  })()`;
  /*
     DEUX POSES, ET IL EN FAUT DEUX.

     `addInitScript` ne s'applique qu'aux documents chargés APRÈS lui :
     posée seule, elle ne compte rien sur une page déjà ouverte — et c'est
     le cas le plus fréquent, puisqu'un essai déverrouille d'abord. On pose
     donc aussi l'enveloppe dans le document courant, et le garde
     « __boitesComptees » empêche de compter deux fois si les deux poses se
     rencontrent.
  */
  await page.addInitScript(`${pose};`);
  await page.evaluate(pose).catch(() => undefined);
  return async () => (await page.evaluate('globalThis.__boitesOuvertes ?? 0')) ?? 0;
}

/**
 * Répond à la REDEMANDE DU MOT DE PASSE, qui n'est pas la boîte commune.
 *
 * Deux gestes sans retour — l'effacement sans sauvegarde et l'export en
 * clair — demandent le mot de passe du site depuis le prompt 44, là où ils
 * se contentaient d'un « confirm ». Le dialogue vient de
 * « src/lib/redemande.ts », il n'a pas de classe « boite » et aucun
 * identifiant : on le désigne donc par ce qu'il est, un `<dialog>` ouvert
 * portant un champ de mot de passe.
 *
 * Un essai qui ignore cette redemande ne mesure pas un site muet : il
 * mesure un geste qui n'a pas eu lieu, et le dialogue resté ouvert arrête
 * le clic suivant — « dialog intercepts pointer events ». C'est le symptôme
 * qui a mis douze essais au rouge le 18 octobre.
 */
export async function repondreALaRedemande(page, motDePasse, { delai = 15000 } = {}) {
  const champ = page.locator('dialog[open] input[type="password"]').first();
  await champ.waitFor({ state: 'visible', timeout: delai });
  await champ.fill(motDePasse);
  await page.locator('dialog[open] button[type="submit"]').first().click();
  /*
     On attend la FERMETURE, et non un délai fixe : la vérification du mot de
     passe déchiffre un témoin, ce qui prend le temps que prend une
     dérivation de clé — quelques centaines de millisecondes sur un
     ordinateur, davantage sur un téléphone.
  */
  await page
    .locator('dialog[open] input[type="password"]')
    .first()
    .waitFor({ state: 'detached', timeout: delai })
    .catch(async () => {
      /* Mot de passe refusé : le dialogue reste, et il le dit. L'essai doit
         le savoir plutôt que d'expirer trente secondes plus loin. */
      const erreur = ((await page.locator('dialog[open]').textContent()) ?? '').trim();
      throw new Error(`la redemande de mot de passe n’a pas été acceptée : ${erreur.slice(0, 200)}`);
    });
}
