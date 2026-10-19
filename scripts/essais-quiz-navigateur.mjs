/**
 * Les trois promesses des écrans de QCM : démarrer vite, dire où l'on en est,
 * et ne pas jeter une épreuve sur un toucher.
 *
 * ## F1 — « Commencer » ne doit pas charger toute la banque
 *
 * Avec « Toutes les matières » et « Toutes les fiches », l'écran chargeait les
 * 425 fiches du site, déchiffrées une à une, pour en retenir vingt questions.
 * En local cela prend quelques secondes ; sur un téléphone, le bouton reste
 * sans effet visible assez longtemps pour qu'on le croie cassé. Le contrôle
 * compte donc les **téléchargements de fiches**, qui est la grandeur en cause,
 * et non le temps, qui dépend de la machine qui mesure.
 *
 * ## F4 — un compteur qui se lit
 *
 * Les deux QCM affichaient « 1/30 » et « 0/1 » : deux nombres qui se
 * ressemblent et ne comptent pas la même chose. Le contrôle lit la position en
 * toutes lettres et vérifie qu'elle avance.
 *
 * ## F3 — quitter une épreuve commencée
 *
 * Rien n'est enregistré avant la fin : sortir en cours de route perd tout. Le
 * contrôle vérifie qu'on est prévenu **et** qu'un refus laisse sur place — un
 * garde-fou qu'on peut franchir en disant non n'en est pas un.
 */
import { chromium } from 'playwright-core';
import { compterLesBoites, repondreALaBoite } from './lib/boite-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(`\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`);
    rouges += 1;
  }
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

/** Un onglet déverrouillé, sur l'écran demandé. */
async function ouvrir(chemin, options = {}) {
  const contexte = await nav.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await contexte.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(800);
  }
  return { contexte, page };
}

console.log('\n\x1b[1mF1 — LE TIRAGE « TOUTES MATIÈRES » NE CHARGE PAS LA BANQUE\x1b[0m\n');
{
  const { contexte, page } = await ouvrir('/quiz/cours/');
  let fiches = 0;
  page.on('request', (r) => {
    if (/\/data\/fiches\//.test(r.url())) fiches += 1;
  });
  await page.selectOption('#quiz-taille', '20');
  await page.click('#lancer-quiz');
  await page.waitForSelector('#jeu:not(.hidden)', { timeout: 120000 });
  // Au plus une fiche par question tirée : c'est la borne que le tirage pose.
  verifier(`vingt questions coûtent au plus vingt fiches (ici ${fiches})`, fiches <= 20, true);
  verifier(
    'et le tirage en rend bien vingt',
    await page.locator('#score-courant').textContent(),
    'Question 1 sur 20',
  );
  await contexte.close();
}

console.log('\n\x1b[1mF4 — « QUESTION n SUR N », DANS LES DEUX QCM\x1b[0m\n');
{
  const { contexte, page } = await ouvrir('/quiz/cours/');
  await page.selectOption('#quiz-taille', '10');
  await page.click('#lancer-quiz');
  await page.waitForSelector('#jeu:not(.hidden)', { timeout: 120000 });
  verifier('quiz du cours, avant la première réponse', await page.locator('#score-courant').textContent(), 'Question 1 sur 10');
  verifier('annoncé aux lecteurs d’écran', await page.locator('#score-courant').getAttribute('aria-live'), 'polite');

  await page.locator('#quiz-options button').first().click();
  await page.waitForTimeout(400);
  const apres = await page.locator('#score-courant').textContent();
  verifier(
    'après une réponse, la position ne bouge pas et le score apparaît',
    /^Question 1 sur 10 · \d+ justes?$/.test(apres) ? apres.replace(/\d+ justes?$/, 'N justes') : apres,
    'Question 1 sur 10 · N justes',
  );
  await page.locator('#quiz-suivant').click();
  await page.waitForTimeout(400);
  // La position avance, le score reste : une réponse a bien été donnée, et
  // elle ne disparaît pas parce qu'on a tourné la page.
  const suivante = await page.locator('#score-courant').textContent();
  verifier(
    'puis la position avance, le score restant acquis',
    /^Question 2 sur 10 · \d+ justes?$/.test(suivante) ? suivante.replace(/\d+ justes?$/, 'N justes') : suivante,
    'Question 2 sur 10 · N justes',
  );
  await contexte.close();
}
{
  const { contexte, page } = await ouvrir('/quiz/dgfip/');
  await page.click('#lancer-dgfip');
  await page.waitForSelector('#epreuve:not(.hidden)', { timeout: 60000 });
  const compteur = await page.locator('#compteur-dgfip').textContent();
  verifier('QCM DGFiP, même forme', /^Question 1 sur \d+$/.test(compteur) ? 'Question 1 sur N' : compteur, 'Question 1 sur N');
  verifier('annoncé aux lecteurs d’écran', await page.locator('#compteur-dgfip').getAttribute('aria-live'), 'polite');
  await contexte.close();
}

console.log('\n\x1b[1mF3 — QUITTER UNE ÉPREUVE COMMENCÉE\x1b[0m\n');
{
  const { contexte, page } = await ouvrir('/quiz/dgfip/', { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await page.click('#lancer-dgfip');
  await page.waitForSelector('#epreuve:not(.hidden)', { timeout: 60000 });

  const quitter = page.locator('#quitter-dgfip');
  const hauteur = Math.round((await quitter.boundingBox()).height);
  verifier(`« Quitter » fait au moins 44 px de haut au doigt (ici ${hauteur})`, hauteur >= 44, true);

  /*
     LA BOÎTE COMMUNE, ET CE QU'ON COMPTE (C1 et C3 du 43).

     « Quitter » posait une fenêtre native ; l'essai la comptait avec
     « page.on('dialog') ». Depuis le 43, c'est la boîte commune : plus
     aucune fenêtre native ne s'ouvre, donc le compteur restait à zéro et
     l'assertion « après une réponse : une demande » lisait 0 au lieu de 1.
     L'essai ne mesurait plus rien — ni la demande, ni son absence.

     On compte donc les OUVERTURES de la boîte, en enveloppant
     « showModal » : c'est l'ouverture qui est l'événement, et une boîte
     posée puis retirée sans être ouverte ne doit pas compter. Le module
     pose l'enveloppe dans le document COURANT et pour les suivants :
     « addInitScript » seule ne compterait rien ici, la page étant déjà
     chargée.
  */
  const boites = await compterLesBoites(page);
  let demandes = 0;

  // Rien de répondu : sortir ne demande rien, il n'y a rien à perdre.
  await quitter.click();
  await page.waitForTimeout(600);
  demandes = await boites();
  verifier('épreuve vierge : aucune demande', demandes, 0);
  verifier('et l’on sort bien', await page.locator('#accueil-dgfip').isVisible(), true);

  // Une réponse donnée : la demande est posée, et le refus laisse sur place.
  await page.click('#lancer-dgfip');
  await page.waitForSelector('#epreuve:not(.hidden)', { timeout: 60000 });
  await page.locator('#options-dgfip button').first().click();
  await page.waitForTimeout(300);
  const avant = await boites();
  await quitter.click();
  await repondreALaBoite(page, 'Continuer l’épreuve');
  verifier('après une réponse : une demande', (await boites()) - avant, 1);
  verifier('et un refus laisse dans l’épreuve', await page.locator('#epreuve').isVisible(), true);
  await contexte.close();
}

await nav.close();

if (rouges > 0) {
  console.log(`\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mTous les essais passent.\x1b[0m');
