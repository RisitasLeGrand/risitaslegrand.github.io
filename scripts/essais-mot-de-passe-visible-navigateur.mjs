/**
 * « Afficher » : le bouton, à l'écran (D3 du prompt 43).
 *
 *   npx astro preview &  CHROMIUM=… npm run essais:mot-de-passe-visible:navigateur
 *
 * Le mot de passe ne se donne PAS sur la ligne de commande : elle reste en
 * clair dans le journal du terminal. Il se pose dans `.env.local`, ignoré
 * par Git, et `motDePasseEssais()` l'y lit — c'est la source unique.
 *
 *   printf 'SITE_PASSWORD=…\n' > .env.local
 *
 * L'essai pur garde qu'aucun fichier ne porte un champ nu. Celui-ci garde ce
 * qu'un relevé de fichiers ne peut pas garder : que le bouton **existe sur la
 * page construite**, qu'il rende le mot de passe lisible, qu'il le remasque,
 * que son état soit annoncé, et qu'il se touche au doigt.
 *
 * Le mot de passe du site n'est jamais écrit ici : il vient de
 * l'environnement, et les assertions portent sur une saisie d'essai —
 * « phrase-de-controle » — qu'on tape dans le champ pour vérifier qu'elle
 * devient lisible. Aucune valeur réelle n'est affichée ni journalisée.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
/* Une saisie d'essai, et surtout pas le mot de passe du site : ce que le
   bouton rend lisible finit dans les assertions et dans le journal. */
const SAISIE = 'phrase-de-controle';

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 200)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 200)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));

async function deverrouiller() {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

/** L'œil d'un champ : le bouton posé dans sa rangée. */
const oeilDe = (id) => page.locator(`#${id}`).locator('xpath=../button[@aria-pressed]');

/**
 * Le contrat du bouton, sur un champ donné : il existe, il se touche, il
 * rend lisible, il annonce, il remasque.
 */
async function controlerLeChamp(ecran, id) {
  const champ = page.locator(`#${id}`);
  const oeil = oeilDe(id);
  if ((await oeil.count()) === 0) {
    v(`${ecran} · ${id} porte un bouton « Afficher »`, 'aucun bouton', 'un bouton');
    return;
  }
  vrai(`${ecran} · ${id} porte un bouton « Afficher »`, true);

  /* La taille ne se mesure pas ici : le plancher de 44 px du dépôt ne
     s'applique que sous « pointer: coarse », et certains de ces champs vivent
     dans une section repliée, sans boîte. La section 3 le mesure au doigt. */
  v(`${ecran} · ${id} : il n’est pas enfoncé au départ`, await oeil.getAttribute('aria-pressed'), 'false');
  vrai(
    `${ecran} · ${id} : son libellé prévient`,
    ((await oeil.getAttribute('aria-label')) ?? '').includes('lisible à l’écran'),
  );
  v(`${ecran} · ${id} : le champ est masqué`, await champ.getAttribute('type'), 'password');

  /*
     UN CHAMP QUI VIT DANS UNE SECTION REPLIÉE N'EST PAS CLIQUÉ.

     Celui de la restauration n'apparaît qu'une fois une sauvegarde chiffrée
     choisie, et fabriquer une vraie sauvegarde pour mesurer un bouton
     reviendrait à écrire un autre essai. Son contrat d'attributs est vérifié
     ci-dessus ; le geste, lui, est mesuré sur les six champs visibles, et
     c'est le même module qui le rend. L'essai dit ce qu'il ne mesure pas
     plutôt que de le passer sous silence.
  */
  if (!(await oeil.isVisible())) {
    console.log(`  \x1b[33m•\x1b[0m ${ecran} · ${id} : section repliée, le geste n’est pas mesuré ici`);
    return;
  }
  /*
     Un champ désactivé non plus : ceux de la bascule du coffre le restent tant
     qu'on n'a pas choisi entre « session » et « appareil ». Son bouton l'est
     avec lui — il vit dans la même étiquette —, et c'est ce qu'il faut : rien
     à révéler dans un champ qu'on ne peut pas remplir.
  */
  if (await champ.isDisabled()) {
    vrai(`${ecran} · ${id} : champ désactivé, son bouton l’est aussi`, await oeil.isDisabled());
    return;
  }

  await oeil.click();
  v(`${ecran} · ${id} : un appui le rend lisible`, await champ.getAttribute('type'), 'text');
  v(`${ecran} · ${id} : et l’annonce`, await oeil.getAttribute('aria-pressed'), 'true');
  v(
    `${ecran} · ${id} : le libellé devient « Masquer »`,
    await oeil.getAttribute('aria-label'),
    'Masquer le mot de passe',
  );
  await oeil.click();
  v(`${ecran} · ${id} : un second appui le remasque`, await champ.getAttribute('type'), 'password');
  v(`${ecran} · ${id} : et l’annonce aussi`, await oeil.getAttribute('aria-pressed'), 'false');
}

/* ════════════════════════════════════════════════════════════════════════
   1. Le verrou du site : le premier champ qu'on rencontre
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE VERROU DU SITE');

await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      try {
        localStorage.clear();
      } catch {
        /* rien à faire */
      }
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#champ-mdp', { timeout: 20000 });
await controlerLeChamp('verrou', 'champ-mdp');

/* Ce que le bouton promet vraiment : le texte devient lisible. On le vérifie
   sur une saisie d'essai, jamais sur le mot de passe du site. */
await page.fill('#champ-mdp', SAISIE);
await oeilDe('champ-mdp').click();
v(
  'verrou · le texte tapé devient lisible',
  await page.locator('#champ-mdp').inputValue(),
  SAISIE,
);
vrai(
  'verrou · et le champ n’est plus de type « password »',
  (await page.locator('#champ-mdp').getAttribute('type')) === 'text',
);
await oeilDe('champ-mdp').click();
/* `clear()` et non `fill(…, '')` : `essais:secret` interdit toute chaîne
   littérale passée au champ du mot de passe, et il a raison de ne pas faire
   d'exception pour la chaîne vide — une exception se faufile. Vider le champ
   se dit d'ailleurs mieux ainsi. */
await page.locator('#champ-mdp').clear();

/* ════════════════════════════════════════════════════════════════════════
   2. Les écrans qui demandent un mot de passe
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES AUTRES ÉCRANS');

await deverrouiller();
await franchirInitialisation(page, RACINE, MDP);

const ECRANS = [
  ['sauvegarde', '/progression/', ['mdp-sauvegarde', 'mdp-restauration']],
  ['effacement', '/stockage/', ['mdp-avant-effacement']],
  ['appariement', '/apparier/', ['mdp']],
  ['bascule du coffre', '/coffre/bascule/', ['mdp-nouveau', 'mdp-confirmation']],
  ['budget', '/odyssee/qui-lit-mon-budget/', ['mdp-coffre']],
  ['formulaire du coffre', '/odyssee/sante/', ['mdp-coffre']],
];

for (const [nom, route, champs] of ECRANS) {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await page.waitForSelector(`#${champs[0]}`, { state: 'attached', timeout: 40000 });
  for (const id of champs) await controlerLeChamp(nom, id);
}

/* ════════════════════════════════════════════════════════════════════════
   3. Au doigt, le bouton atteint le plancher
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nAU DOIGT, 44 PX');

/*
   Un contexte tactile, et non le contexte d'ordinateur : le plancher de 44 px
   du dépôt vit sous « @media (pointer: coarse) », parce qu'il existe pour le
   doigt et non pour la souris. Le mesurer à la souris aurait fait rougir un
   bouton conforme — et c'est ce que cet essai a commencé par faire.
*/
const tactile = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const surTelephone = await tactile.newPage();
await surTelephone.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await surTelephone.waitForSelector('#champ-mdp', { timeout: 20000 });
{
  const oeil = surTelephone.locator('#champ-mdp').locator('xpath=../button[@aria-pressed]');
  const boite = await oeil.boundingBox();
  vrai('le bouton fait 44 px de haut et de large', boite.width >= 44 && boite.height >= 44);
  /* Et il ne pousse pas la page hors de l'écran : c'est la raison pour
     laquelle il est posé à côté du champ et non par-dessus. */
  const debord = await surTelephone.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  v('et l’écran ne déborde pas en largeur', debord <= 0, true);
}
await tactile.close();

await contexte.close();
await nav.close();
console.log(echecs ? `\n\x1b[31m${echecs} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(echecs ? 1 : 0);
