/**
 * Fabriquer une sauvegarde depuis l'écran, puis la restaurer — pour les essais.
 *
 * ## Pourquoi un module partagé, et non deux copies
 *
 * Deux essais ont besoin de la même chose : B1, qui mesure que la
 * restauration est offerte dès la première question et qu'elle aboutit, et le
 * 58 p2, qui doit mesurer qu'une sauvegarde faite sur un appareil A se
 * restaure sur un appareil B neuf. Recopier la chaîne reviendrait à la laisser
 * diverger : le jour où l'écran de sauvegarde change un identifiant, l'une des
 * deux copies resterait verte sur un chemin qui n'existe plus.
 *
 * ## Ce que ce module NE fait pas, et c'est son intérêt
 *
 * Il ne décide **pas quelle donnée** la sauvegarde porte. C'est `poser` qui
 * l'écrit, et l'appelant la choisit : un poids pour B1, une donnée scellée
 * d'Odyssée — ouverture du coffre comprise — pour qui en a besoin. Une fixture
 * qui imposerait sa donnée promettrait à chaque essai ce qu'elle porte pour un
 * seul.
 *
 * ## Le mot de passe
 *
 * Il n'est **jamais écrit ici**. L'appelant le lit par `motDePasseEssais()`,
 * qui va le chercher hors du dépôt, et le passe en argument. Le fichier de
 * sauvegarde, lui, vit dans le dossier que l'appelant fournit — hors du dépôt,
 * et à lui de l'effacer : une sauvegarde porte des données, et son cycle de vie
 * appartient à qui l'a demandée.
 */
import path from 'node:path';

/** Un contexte neuf : aucune base, aucun profil, rien de mémorisé. */
export async function unProfilNeuf(nav, options = {}) {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    acceptDownloads: true,
    ...options,
  });
  return { ctx, page: await ctx.newPage() };
}

/**
 * Rouvre le verrou du site si l'écran le redemande.
 *
 * Appelé après chaque navigation plutôt qu'une fois : le verrou se redemande
 * sur un contexte neuf, et un essai qui ne le prévoit pas attend trente
 * secondes un sélecteur caché derrière lui.
 */
export async function deverrouiller(page, mdp) {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', mdp);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(1000);
  }
}

/**
 * Fabrique une sauvegarde depuis l'écran, et rend son chemin sur le disque.
 *
 * `poser(page)` est appelé une fois l'initialisation franchie et avant la
 * sauvegarde : c'est là que l'appelant écrit ce qu'il veut retrouver ensuite.
 *
 * On passe par l'ÉCRAN et non par la base : un fichier d'exemple commité se
 * périmerait au premier changement de format, et il porterait des données.
 */
export async function fabriquerUneSauvegarde(
  nav,
  { racine, motDePasseDuSite, motDePasseDuFichier = motDePasseDuSite, dossier, poser, nom = 'sauvegarde.cyclades' },
) {
  const { franchirInitialisation } = await import('./franchir-initialisation.mjs');
  const { ctx, page } = await unProfilNeuf(nav);
  await franchirInitialisation(page, racine, motDePasseDuSite);
  await poser(page);

  await page.goto(`${racine}/progression/`, { waitUntil: 'networkidle' });
  await deverrouiller(page, motDePasseDuSite);
  await page.waitForTimeout(1500);
  /* Le mot de passe du FICHIER, qui n'a pas à être celui du site. */
  await page.fill('#mdp-sauvegarde', motDePasseDuFichier);
  const attente = page.waitForEvent('download', { timeout: 60000 });
  await page.click('#sauvegarder');
  const telechargement = await attente;
  const chemin = path.join(dossier, nom);
  await telechargement.saveAs(chemin);
  await ctx.close();
  return chemin;
}

/**
 * Suit le chemin d'une personne qui restaure, et rend ce qu'elle a vu.
 *
 * `motDePasse` est celui du FICHIER, et c'est un point qui compte :
 * `restaurer()` relit la sauvegarde avec lui et ne touche pas au coffre. Un
 * essai qui passerait ici le mot de passe du coffre mesurerait autre chose.
 *
 * **DEUX MOTS DE PASSE, ET ILS NE SE CONFONDENT PAS.** Celui du SITE ouvre le
 * verrou de la page ; celui du FICHIER déchiffre la sauvegarde. Ils ont la
 * même valeur dans l'essai B1, parce que la sauvegarde y est faite avec le
 * mot de passe du site — ce qui est précisément ce qui rend la confusion
 * indétectable, et c'est pourquoi les deux sont séparés ici. Un essai qui les
 * mêlerait resterait vert jusqu'au jour où quelqu'un restaure un fichier
 * chiffré avec un autre mot de passe, et il rougirait alors sans dire pourquoi.
 *
 * Rend `{ verifie, confirmation, message }`. `verifie` à `false` veut dire que
 * le fichier a été REFUSÉ avant d'être appliqué — un en-tête tronqué, par
 * exemple —, et le message dit lequel. `confirmation` est le texte de la boîte
 * de remplacement, relevé **avant** d'y répondre : c'est le dernier écran que
 * la personne lit avant d'écraser sa base, et un essai qui répond sans le lire
 * laisserait sa rédaction sans mesure. On rend donc le refus comme une valeur, parce qu'un
 * essai du refus est aussi utile qu'un essai de la réussite : c'est le seul
 * geste de l'application qu'on ne peut pas rattraper.
 */
export async function restaurerDepuis(
  page,
  { racine, chemin, motDePasseDuSite, motDePasseDuFichier, avecInstantane = false },
) {
  await page.goto(`${racine}/progression/#restaurer`, { waitUntil: 'networkidle' });
  await deverrouiller(page, motDePasseDuSite);
  await page.waitForSelector('#fichier-cyclades', { timeout: 30000 });
  await page.locator('#fichier-cyclades').setInputFiles(chemin);
  await page.waitForTimeout(2500);
  const verifie = (await page.locator('#apercu-cyclades:not(.hidden)').count()) > 0;
  if (!verifie) {
    return {
      verifie,
      confirmation: '',
      message: ((await page.locator('#message-cyclades').textContent()) ?? '').trim(),
    };
  }
  await page.fill('#mdp-restauration', motDePasseDuFichier);
  if (!avecInstantane) await page.locator('#avec-instantane').uncheck().catch(() => {});
  await page.click('#appliquer-cyclades');
  await page.waitForTimeout(800);
  /* Relevé AVANT la réponse : la boîte disparaît avec elle. */
  const confirmation = ((await page.locator('dialog.boite[open]').textContent().catch(() => '')) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const { repondreALaBoite } = await import('./boite-essais.mjs');
  await repondreALaBoite(page, 'Remplacer').catch(() => {});
  await page.waitForTimeout(4000);
  return {
    verifie,
    confirmation,
    message: ((await page.locator('#message-cyclades').textContent()) ?? '').trim(),
  };
}
