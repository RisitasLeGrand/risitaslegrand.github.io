/**
 * 0.2 — « Supprimer cette séance » s'annule, pendant au moins six secondes.
 *
 *   npm run essais:annulation:navigateur
 *
 * ## Ce que cet essai ajoute, et pourquoi il manquait
 *
 * La règle M6 du 41, précisée par le 43, dit : « Toute action destructrice ou
 * de pointage s'annule depuis un bandeau en bas, sans fenêtre de
 * confirmation, pendant **au moins 6 secondes**. »
 *
 * `src/lib/annulation.ts` la tient : `SECONDES_MINIMUM = 6`, un
 * `Math.max(6, …)`, l'écriture retardée plutôt que défaite, et `pagehide` qui
 * exécute ce qui attendait. Tout cela était écrit, et **aucun essai du dépôt
 * ne citait `bandeau-annulation`**. Une fonction que rien ne mesure est une
 * fonction qui peut disparaître à la prochaine refonte sans que personne ne
 * s'en aperçoive — et celle-ci protège des données qu'on ne peut pas
 * reconstruire.
 *
 * ## Les six secondes sont MESURÉES, et non lues dans le code
 *
 * Lire `SECONDES_MINIMUM` prouverait l'accord du fichier avec lui-même. On
 * chronomètre donc la seule chose qui compte pour la personne : combien de
 * temps le bandeau reste à l'écran, c'est-à-dire combien de temps elle a pour
 * se rattraper. Un `setTimeout` mal câblé, un intervalle qui ferme trop tôt,
 * un bandeau recouvert par un autre — rien de tout cela ne se verrait dans la
 * constante.
 *
 * ## Les trois moitiés du point
 *
 * 1. le délai existe et il dure ;
 * 2. « Annuler » rend la séance, avec ses séries ;
 * 3. **quitter n'annule pas** — la suppression part tout de suite, plutôt que
 *    de se perdre. C'est la contrepartie du choix de retarder l'écriture au
 *    lieu de la défaire, et c'est la moitié qu'on oublierait.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const v = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
const vrai = (quoi, obtenu) => v(quoi, Boolean(obtenu), true);
const auMoins = (quoi, obtenu, plancher, unite = 'ms') => {
  if (obtenu >= plancher) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi} — ${obtenu} ${unite}`);
    return;
  }
  console.log(`\x1b[31m✗\x1b[0m ${quoi} — ${obtenu} ${unite}, il en faut ${plancher}`);
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/*
   UN CONTEXTE NEUF PAR MESURE. Les trois moitiés laissent chacune la base
   dans un état différent — séance supprimée, séance rendue, séance supprimée
   par la sortie —, et les enchaîner ferait dépendre la troisième de ce que la
   première a laissé. Chacune part donc d'une base vierge.
*/
async function unePage() {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  return { ctx, page };
}

/** Rouvre le verrou si l'écran le redemande. */
async function deverrouiller(page) {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(800);
  }
}

/**
 * Un exercice, sans lequel la séance ne peut rien enregistrer.
 *
 * Ce n'est pas une commodité d'essai : `seance.astro:445` cache le formulaire
 * de saisie quand la bibliothèque est vide — « $('saisie').classList.toggle
 * ('hidden', vide) ». Une base neuve ne permet donc pas d'ajouter une série,
 * et c'est juste : on ne note pas un tirage avant d'avoir dit qu'on tire.
 * L'essai commence donc par là, comme une personne le ferait.
 */
async function unExercice(page) {
  await page.goto(`${RACINE}/sport/exercices/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
  await page.click('#ouvrir-ajout');
  await page.waitForTimeout(400);
  await page.fill('#nom', 'Tirage d’essai');
  await page.fill('#equipement', 'poulie');
  await page.click('#ajout button[type="submit"]');
  await page.waitForTimeout(800);
}

/** Démarre une séance et y pose deux séries identiques. */
async function uneSeanceDeDeuxSeries(page) {
  await unExercice(page);
  await page.goto(`${RACINE}/sport/seance/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
  await page.click('#commencer');
  await page.waitForSelector('#encours:not(.hidden)', { timeout: 15000 });
  for (let i = 0; i < 2; i += 1) {
    /*
       Deux séries identiques portent les mêmes données : la garde du double
       appui les prendrait pour un seul geste. Une main attend entre deux
       séries, l'essai attend donc aussi — c'est la leçon de
       « essais:sport:navigateur ».
    */
    await page.waitForTimeout(700);
    await page.fill('#charge', '60');
    await page.fill('#repetitions', '8');
    const avant = await page.$$eval('#series li', (l) => l.length);
    await page.click('#saisie button[type="submit"]');
    await page.waitForFunction((n) => document.querySelectorAll('#series li').length > n, avant, {
      timeout: 15000,
    });
  }
  return page.$$eval('#series li', (l) => l.length);
}

/* ══════════════════════════════════════════════════════════════════════════
   1. Le bandeau paraît, il dit ce qui s'est passé, et il dure six secondes
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE BANDEAU PARAÎT, ET IL LAISSE LE TEMPS DE SE RATTRAPER');
{
  const { ctx, page } = await unePage();
  v('la séance porte bien deux séries avant qu’on la supprime', await uneSeanceDeDeuxSeries(page), 2);

  const t0 = Date.now();
  await page.click('#abandonner');
  const bandeau = page.locator('#bandeau-annulation');
  await page.waitForSelector('#bandeau-annulation', { timeout: 10000 });

  const dit = ((await bandeau.locator('.bandeau-annulation-texte').textContent()) ?? '').trim();
  v('il dit ce qui a été supprimé, et le nombre de séries', dit, 'Séance supprimée, avec ses 2 séries.');
  /* La règle d'écriture G : jamais « série(s) ». Le compte décide du pluriel. */
  vrai('et il ne porte aucun « (s) »', !/\(s\)/.test(dit));
  v('il s’annonce comme une information, non comme une alerte', await bandeau.getAttribute('role'), 'status');

  vrai(
    'un décompte est visible, pour qu’on sache combien de temps il reste',
    /\d+\s*s/.test(((await bandeau.locator('.bandeau-annulation-reste').textContent()) ?? '').trim()),
  );

  const annuler = bandeau.locator('button:has-text("Annuler")');
  vrai('un bouton « Annuler » est offert', await annuler.isVisible());
  auMoins(
    'et il atteint le plancher tactile',
    Math.round(await annuler.evaluate((b) => Math.min(b.getBoundingClientRect().height, 9999))),
    44,
    'px',
  );

  /* L'écran s'est vidé tout de suite : on ne fait pas attendre pour voir. */
  vrai('l’écran ne montre plus la séance', await page.locator('#encours.hidden').count() > 0);

  /*
     LE CHRONOMÈTRE. On attend que le bandeau s'en aille de lui-même : c'est
     l'instant où l'action part. Le plancher est de six secondes, et on le
     mesure depuis le clic, pas depuis l'apparition du bandeau — c'est le clic
     qui déclenche, et c'est de là que compte le temps dont la personne
     dispose.
  */
  await page.waitForSelector('#bandeau-annulation', { state: 'detached', timeout: 20000 });
  auMoins('le bandeau est resté au moins six secondes', Date.now() - t0, 6000);

  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   2. « Annuler » rend la séance, avec ses séries
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n« ANNULER » REND LA SÉANCE');
{
  const { ctx, page } = await unePage();
  v('deux séries avant', await uneSeanceDeDeuxSeries(page), 2);
  await page.click('#abandonner');
  await page.waitForSelector('#bandeau-annulation', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.locator('#bandeau-annulation button:has-text("Annuler")').click();
  await page.waitForTimeout(800);

  vrai('le bandeau s’en va', (await page.locator('#bandeau-annulation').count()) === 0);
  vrai('la séance est de retour à l’écran', await page.locator('#encours:not(.hidden)').count() > 0);
  v('et elle a toujours ses deux séries', await page.$$eval('#series li', (l) => l.length), 2);

  /*
     LA PREUVE QUE RIEN N'A ÉTÉ DÉTRUIT PUIS RECONSTRUIT. On recharge : ce qui
     revient vient du magasin, pas de l'état en mémoire. C'est la différence
     entre « retarder l'écriture » et « défaire après coup », et c'est tout le
     choix de conception que ce module a fait.
  */
  await page.reload({ waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#encours:not(.hidden)', { timeout: 30000 });
  v('et après un rechargement, le magasin la porte toujours', await page.$$eval('#series li', (l) => l.length), 2);

  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Quitter n'annule pas : la suppression part tout de suite
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nQUITTER N’ANNULE PAS');
{
  const { ctx, page } = await unePage();
  v('deux séries avant', await uneSeanceDeDeuxSeries(page), 2);
  await page.click('#abandonner');
  await page.waitForSelector('#bandeau-annulation', { timeout: 10000 });

  /*
     On quitte AVANT la fin du délai — c'est tout l'objet : si la sortie
     perdait l'action en attente, la séance reviendrait au prochain
     chargement, et la personne retrouverait ce qu'elle a supprimé.
  */
  await page.waitForTimeout(1200);
  await page.goto(`${RACINE}/sport/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await page.goto(`${RACINE}/sport/seance/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
  await page.waitForTimeout(1200);

  vrai(
    'la séance n’est pas revenue : la sortie a exécuté la suppression',
    (await page.locator('#encours:not(.hidden)').count()) === 0,
  );
  vrai('et l’écran propose d’en commencer une', await page.locator('#commencer').isVisible());

  await ctx.close();
}

await nav.close();
console.log(
  rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
