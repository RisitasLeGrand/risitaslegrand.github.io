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
/*
   LA CONSTANTE DU MOTEUR, IMPORTÉE et non recopiée : un essai qui écrirait
   « 12 » de son côté cesserait de mesurer le jour où le moteur change d'avis,
   et c'est précisément le défaut qu'il garde.
*/
import { N_MAXIMAL } from '../src/features/quad-n-back/moteur/nback.js';

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

/* ── Le maximum, et la grille ──────────────────────────────────────────── */

console.log('\nL’ÉCRAN SAIT REPRÉSENTER CE QUE LE MOTEUR PRODUIT');

/*
   LE MAXIMUM DU CURSEUR EST CELUI DU MOTEUR.

   Il valait 9 quand le moteur monte à 12 par progression automatique. Une
   partie à n = 10 s'affichait donc au maximum du curseur, et l'avoir baissé à
   la main aurait silencieusement défait la progression. Relevé par le
   constructeur sur mon propre lot.
*/
verifier(
  `niveau-n monte jusqu’où le moteur monte (${N_MAXIMAL})`,
  Number(await page.locator('#niveau-n').getAttribute('max')),
  N_MAXIMAL,
);

verifier('aucune erreur de page', erreurs.slice(0, 3), []);

/* ── La divergence entre le réglage enregistré et le curseur ───────────── */

console.log('\nLE RÉGLAGE ENREGISTRÉ ET LE CURSEUR NE DIVERGENT PLUS');

/*
   DEUX FOIS JE ME SUIS TROMPÉ SUR CE DÉFAUT, et les deux fois c'est la mesure
   qui l'a dit — ce constat est le troisième essai.

   1. Le défaut m'avait été décrit comme « une valeur qui reste hors grille ».
      Or un `input[type=range]` ASSAINIT la valeur qu'on lui assigne : la
      spécification lui fait arrondir au cran le plus proche. Poser 11 sur un
      curseur de pas 2 donne 12, et une valeur hors grille ne peut pas exister
      DANS le curseur.
   2. J'ai alors voulu mesurer la divergence en posant 11 sur le curseur puis
      en signalant l'événement « input ». Mais c'est cet événement qui fait
      lire la valeur au composant : il lisait donc 12, l'état s'accordait au
      curseur, et la divergence ne naissait jamais. Le sabotage — le retour à
      mon ancien calcul — passait au VERT. Mon essai prétendait garder une
      garantie qu'il ne mesurait pas.

   LE SEUL CHEMIN RÉEL est un réglage ENREGISTRÉ hors grille, lu au montage :
   `chargerReglages` restaure le contenu de `localStorage` tel quel, sans le
   confronter au pas ni aux bornes. L'état vaut alors 11, le curseur affiche
   12, et aucun événement ne les réconcilie.

   C'est pire qu'une valeur hors grille : le réglage AFFICHÉ et le réglage
   ENREGISTRÉ cessent durablement de dire la même chose, et c'est l'état qui
   part au moteur.
*/
{
  const ctx2 = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
  const p2 = await ctx2.newPage();
  await p2.addInitScript(() => {
    try {
      const brut = localStorage.getItem('revinsp.nback.reglages');
      const r = brut ? JSON.parse(brut) : {};
      /* Hors grille : le curseur a min 10 et pas 2. */
      localStorage.setItem('revinsp.nback.reglages', JSON.stringify({ ...r, epreuves: 11 }));
    } catch {
      /* La prémisse ci-dessous le dira. */
    }
  });
  await franchirInitialisation(p2, RACINE, MDP);
  await p2.goto(`${RACINE}/cog-training/quad-n-back/`, { waitUntil: 'networkidle' });
  if (await p2.locator('#champ-mdp').isVisible().catch(() => false)) {
    await p2.fill('#champ-mdp', MDP);
    await p2.click('#bouton-verrou');
  }
  await p2.waitForSelector('#nb-epreuves', { timeout: 40000, state: 'attached' }).catch(() => {});
  const replis2 = await p2.locator('details:not([open]) summary').count();
  for (let i = 0; i < replis2; i += 1) {
    await p2.locator('details:not([open]) summary').first().click({ timeout: 2000 }).catch(() => {});
  }
  await p2.waitForTimeout(600);

  const lire = async () => ({
    curseur: Number(await p2.locator('#nb-epreuves').inputValue()),
    /* L'étiquette affiche l'ÉTAT du composant : c'est lui qui part au moteur,
       et comparer le curseur à lui-même ne prouverait rien. */
    etiquette: Number((await p2.locator('label[for="nb-epreuves"] strong').innerText()).trim()),
  });

  const auMontage = await lire();
  verifier('prémisse : le curseur assainit le réglage semé', auMontage.curseur, 12);
  verifier(
    `prémisse : et l’état, lui, a gardé la valeur hors grille (${auMontage.etiquette})`,
    auMontage.etiquette,
    11,
  );

  await p2.locator('[data-pas="1"][data-pour="nb-epreuves"]').click();
  await p2.waitForTimeout(300);
  const apres = await lire();
  verifier(
    `un appui réconcilie les deux (étiquette ${apres.etiquette}, curseur ${apres.curseur})`,
    apres.etiquette,
    apres.curseur,
  );
  verifier(`et la valeur est sur la grille (${apres.curseur})`, (apres.curseur - 10) % 2, 0);
  await ctx2.close();
}

await nav.close();
console.log(
  rouges === 0
    ? `\n${vert('Les neuf curseurs se règlent d’un cran, au doigt comme au clavier.')}\n`
    : `\n${rouge(`${rouges} rouge(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
