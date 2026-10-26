/**
 * LES CURSEURS DU QUAD N-BACK ONT LEURS DEUX BOUTONS DE PAS (E9 du prompt 43).
 *
 *   SITE_PASSWORD=… npm run essais:curseurs-pas:navigateur
 *
 * ## Ce qui était mesuré avant
 *
 * Neuf réglages, tous `input[type=range]`, **473 × 16 px à la souris**, et
 * aucun bouton de pas. Changer une valeur demandait de viser le pouce et de
 * glisser — imprécis à la souris, pire au doigt — ou de focaliser le curseur
 * puis d'employer les flèches, ce que personne ne devine.
 *
 * Sous `pointer: coarse`, la feuille de style donne 44 px de haut aux contrôles
 * de formulaire : la piste est confortable au doigt. Mais une piste
 * confortable ne rend pas le POUCE plus facile à viser, et c'est lui qu'il faut
 * attraper pour changer d'un cran. La taille du pouce relevant de l'agent
 * utilisateur, ce sont les boutons qui répondent, et non une piste plus haute.
 *
 * ## Ce que cet essai garde, et le piège qu'il éprouve
 *
 * Le pas est celui du curseur, jamais un autre : un bouton qui avancerait de 1
 * là où le curseur avance de 250 produirait des valeurs que le curseur ne peut
 * pas atteindre. Les bornes sont tenues, et un bouton au bout se DÉSACTIVE —
 * un bouton qui reste actif et ne fait rien laisse croire à un appui manqué.
 *
 * Et le piège : hors jeu, ce composant lance la session sur **Entrée ou
 * Espace**, par un écouteur de fenêtre. Un Entrée sur « + » doit donc bouger la
 * valeur **sans** lancer la partie. C'est `accapareLaTouche` qui le garantit,
 * et rien ne le mesurait.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;

function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  ${vert('✓')} ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  ${rouge('✗')} ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

console.log('\nLES CURSEURS DU QUAD N-BACK, ET LEURS BOUTONS DE PAS\n');

await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/cog-training/quad-n-back/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
/* On attend l'apparition d'un curseur, et non un délai. */
await page.waitForSelector('input[type=range]', { timeout: 40000, state: 'attached' }).catch(() => {});

/* Les réglages vivent dans des dépliants : on les ouvre tous. */
const replis = await page.locator('details:not([open]) summary').count();
for (let i = 0; i < replis; i += 1) {
  await page.locator('details:not([open]) summary').first().click({ timeout: 2000 }).catch(() => {});
}
await page.waitForTimeout(500);

const curseurs = await page.$$eval('input[type=range]', (es) =>
  es.filter((e) => e.getClientRects().length > 0).map((e) => e.id),
);
verifier('prémisse : les neuf curseurs sont visibles', curseurs.length, 9);
verifier('prémisse : chacun porte un identifiant', curseurs.filter(Boolean).length, 9);

/*
   CHAQUE CURSEUR GARDE SON NOM, et c'est A3 du socle qui l'a appris à ce lot :
   sept des neuf sont nommés par un `<label for>` visible, DEUX par un
   `aria-label`. Extraire le balisage en composant avait fait tomber celui-là,
   et deux curseurs sur neuf s'annonçaient « curseur » sans dire de quoi.
   `essais:accessibilite:navigateur` le mesure sur tout le site ; ici, le
   défaut se nomme là où il naît.
*/
const sansNom = await page.$$eval('input[type=range]', (es) =>
  es
    .filter((e) => e.getClientRects().length > 0)
    .filter((e) => {
      const parEtiquette = e.id && document.querySelector(`label[for="${e.id}"]`);
      return !parEtiquette && !(e.getAttribute('aria-label') ?? '').trim();
    })
    .map((e) => e.id || '(sans identifiant)'),
);
verifier('chaque curseur garde un nom accessible', sansNom, []);

const paires = await page.$$eval('[data-pas]', (es) =>
  es.map((e) => ({
    pas: e.dataset.pas,
    pour: e.dataset.pour,
    nom: e.getAttribute('aria-label') ?? '',
    balise: e.tagName.toLowerCase(),
  })),
);
verifier('chaque curseur a ses deux boutons', paires.length, 18);
verifier('et ce sont des boutons', [...new Set(paires.map((p) => p.balise))], ['button']);
/*
   LE NOM DIT QUOI ET DANS QUEL SENS. « − » tout seul n'apprend rien à qui
   l'entend annoncer, et dix-huit boutons nommés « − » ou « + » sont dix-huit
   boutons indiscernables.
*/
verifier(
  'chaque bouton dit ce qu’il change et dans quel sens',
  paires.filter((p) => !/^(Diminuer|Augmenter) ./.test(p.nom)).map((p) => `${p.pour}:${p.nom}`),
  [],
);
verifier(
  'et les dix-huit noms sont distincts',
  new Set(paires.map((p) => p.nom)).size,
  18,
);

/* ── Le pas est celui du curseur ──────────────────────────────────────── */

console.log('\nLE PAS EST CELUI DU CURSEUR, JAMAIS UN AUTRE');

/*
   « duree » est le cas qui tranche : son pas est de 250. Un bouton qui
   avancerait de 1 produirait une valeur que le curseur ne peut pas atteindre,
   et l'écart ne se verrait sur aucun des curseurs à pas 1.
*/
for (const id of ['duree', 'nb-epreuves', 'niveau-n']) {
  const pas = Number(await page.locator(`#${id}`).getAttribute('step'));
  const avant = Number(await page.locator(`#${id}`).inputValue());
  await page.locator(`[data-pas="1"][data-pour="${id}"]`).click();
  await page.waitForTimeout(250);
  const apres = Number(await page.locator(`#${id}`).inputValue());
  verifier(`${id} : « + » avance d’exactement un pas (${pas})`, apres - avant, pas);

  await page.locator(`[data-pas="-1"][data-pour="${id}"]`).click();
  await page.waitForTimeout(250);
  verifier(
    `${id} : « − » revient d’exactement un pas`,
    Number(await page.locator(`#${id}`).inputValue()),
    avant,
  );
}

/* ── Les bornes, et le bouton qui se désactive ────────────────────────── */

console.log('\nAU BOUT DE LA COURSE, LE BOUTON SE DÉSACTIVE');

{
  const id = 'niveau-n';
  const max = Number(await page.locator(`#${id}`).getAttribute('max'));
  const min = Number(await page.locator(`#${id}`).getAttribute('min'));
  /* On pousse plus loin que la course : la borne doit tenir, et le bouton
     cesser d'être actif plutôt que de ne rien faire en silence. */
  for (let i = 0; i < max - min + 3; i += 1) {
    if (await page.locator(`[data-pas="1"][data-pour="${id}"]`).isEnabled()) {
      await page.locator(`[data-pas="1"][data-pour="${id}"]`).click();
    }
  }
  await page.waitForTimeout(250);
  verifier(
    `${id} : la borne haute tient (${max})`,
    Number(await page.locator(`#${id}`).inputValue()),
    max,
  );
  verifier(
    `${id} : et « + » est désactivé au maximum`,
    await page.locator(`[data-pas="1"][data-pour="${id}"]`).isEnabled(),
    false,
  );

  for (let i = 0; i < max - min + 3; i += 1) {
    if (await page.locator(`[data-pas="-1"][data-pour="${id}"]`).isEnabled()) {
      await page.locator(`[data-pas="-1"][data-pour="${id}"]`).click();
    }
  }
  await page.waitForTimeout(250);
  verifier(
    `${id} : la borne basse tient (${min})`,
    Number(await page.locator(`#${id}`).inputValue()),
    min,
  );
  verifier(
    `${id} : et « − » est désactivé au minimum`,
    await page.locator(`[data-pas="-1"][data-pour="${id}"]`).isEnabled(),
    false,
  );
}

/* ── LE PIÈGE : Entrée sur « + » ne doit pas lancer la partie ─────────── */

console.log('\nENTRÉE SUR « + » BOUGE LA VALEUR, ET NE LANCE PAS LA PARTIE');

/*
   Hors jeu, ce composant lance la session sur Entrée ou Espace, par un
   écouteur de FENÊTRE. Sans le garde `accapareLaTouche`, un appui sur « + » au
   clavier aurait donc démarré une partie — en changeant d'écran sous les
   doigts de qui réglait ses paramètres.
*/
for (const touche of ['Enter', 'Space']) {
  const id = 'taux-corr';
  const avant = Number(await page.locator(`#${id}`).inputValue());
  const pas = Number(await page.locator(`#${id}`).getAttribute('step'));
  await page.locator(`[data-pas="1"][data-pour="${id}"]`).focus();
  await page.keyboard.press(touche);
  await page.waitForTimeout(400);

  /*
     L'ÉCRAN SE CONTRÔLE AVANT LA VALEUR, et c'est le sabotage qui l'a appris :
     le garde retiré, la partie se lançait, le curseur disparaissait du DOM, et
     `inputValue()` expirait au bout de trente secondes. Code 1, mais par un
     PLANTAGE — le verdict était bon, le message non. Lu dans cet ordre, le même
     sabotage donne deux rouges nommés.
  */
  const enJeu = (await page.locator('[data-zone-de-jeu]').count()) > 0;
  verifier(`${touche} sur « + » ne lance PAS la partie`, enJeu, false);
  verifier(
    `${touche} sur « + » avance la valeur`,
    enJeu
      ? 'la partie a été lancée : le curseur a disparu de l’écran'
      : Number(await page.locator(`#${id}`).inputValue()) - avant,
    pas,
  );
}

verifier('aucune erreur de page', erreurs.slice(0, 3), []);

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('Les neuf curseurs se règlent d’un cran, au doigt comme au clavier.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
