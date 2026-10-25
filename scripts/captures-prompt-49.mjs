/**
 * Les captures du prompt 49 — la copie de concours.
 *
 *   SITE_PASSWORD=… CHROMIUM=… npm run captures:49
 *
 * Elles vont dans « audit/captures/prompt-49/ », hors du dépôt : une capture
 * montre l'état d'une base, et cette base ne sort pas de la machine.
 *
 * Quatre vues, aux trois tailles du prompt 41 et dans les deux modes d'Égée :
 *
 * 1. **la copie vierge** — le bandeau neutre, l'en-tête, l'aide repliée, les
 *    premières questions et leurs zones ;
 * 2. **la copie remplie** — des cases à l'encre, dont une 2ᵉ ligne et un
 *    « Ann », pour voir les trois états côte à côte ;
 * 3. **l'écran de fin** — la note, le temps utilisé, les deux panneaux ;
 * 4. **la feuille de réponse** dépliée — les soixante zones, dont seules les
 *    douze premières sont servies.
 *
 * Le mode est posé comme la personne le poserait, par les clés que la page
 * Paramètres écrit, avant chargement. Aucune écriture détournée.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { attendreLaBoite, repondreALaBoite } from './lib/boite-essais.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const DOSSIER = 'audit/captures/prompt-49';

/* Les trois tailles du 41 : téléphone étroit, téléphone courant, ordinateur. */
const TAILLES = [
  { nom: '360', viewport: { width: 360, height: 740 }, tactile: true },
  { nom: '430', viewport: { width: 430, height: 932 }, tactile: true },
  { nom: '1280', viewport: { width: 1280, height: 900 }, tactile: false },
];

const MODES = ['clair', 'sombre'];

mkdirSync(DOSSIER, { recursive: true });

const nav = await chromium.launch({
  /*
     Le chemin était épinglé sur « chromium-1194/chrome-linux/chrome ». Le
     conteneur sert la 1243, et sa disposition s'appelle « chrome-linux64 » :
     ce chemin ne désigne plus rien, et c'est pour cela que cet essai était
     rouge. L'aide partagée cherche au lieu de nommer, et REFUSE quand elle
     ne trouve rien — ne rien trouver rendait `undefined`, et Playwright
     parlait alors d'un binaire que personne n'avait demandé.
  */
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});

let faites = 0;
const anomalies = [];

for (const taille of TAILLES) {
  for (const mode of MODES) {
    const contexte = await nav.newContext({
      viewport: taille.viewport,
      hasTouch: taille.tactile,
      isMobile: taille.tactile,
      deviceScaleFactor: 2,
    });
    const page = await contexte.newPage();
    page.on('pageerror', (e) => anomalies.push(`${taille.nom}/${mode} : ${e.message.slice(0, 160)}`));

    /*
       Le mode est obtenu par la bascule jour/nuit, comme la page Paramètres
       l'écrit : des heures qui couvrent toute la journée pour le clair, une
       fenêtre d'une minute en pleine nuit pour le sombre.
    */
    await page.addInitScript(
      (heures) => {
        try {
          localStorage.setItem('revinsp.palette', 'egee');
          localStorage.setItem('revinsp.bascule-jour-nuit', 'oui');
          localStorage.setItem('revinsp.heures-bascule', heures);
          localStorage.setItem('revinsp.animations', 'reduites');
        } catch {
          /* rien */
        }
      },
      mode === 'clair' ? '00:00|23:59' : '03:00|03:01',
    );

    const prise = async (nom) => {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DOSSIER}/${nom}-${taille.nom}-${mode}.png` });
      faites += 1;
    };

    const deverrouiller = async () => {
      if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
        await page.fill('#champ-mdp', MDP);
        await page.click('#bouton-verrou');
        await page.waitForLoadState('networkidle');
      }
    };

    await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
    await deverrouiller();
    await franchirInitialisation(page, RACINE, MDP);

    await page.goto(`${RACINE}/quiz/dgfip/`, { waitUntil: 'networkidle' });
    await deverrouiller();
    await page.waitForSelector('#accueil-dgfip:not(.hidden)', { timeout: 30000 });
    await page.selectOption('#presentation-dgfip', 'copie');
    await page.selectOption('#format-dgfip', 'mixte-12');
    await page.click('#lancer-dgfip');
    await page.waitForSelector('#copie-sujet article[data-question="1"]', { timeout: 30000 });

    /* 1. La copie vierge. */
    await prise('copie-vierge');

    /*
       2. La copie remplie, avec les trois états visibles d'un coup : une
       réponse de 1ʳᵉ ligne, une correction par la 2ᵉ, et une annulation.
    */
    await page.locator('#copie-sujet [data-zone="1"] [data-ligne="premiere"] button').nth(1).click();
    await page.locator('#copie-sujet [data-zone="2"] [data-ligne="premiere"] button').first().click();
    await page.locator('#copie-sujet [data-zone="2"] [data-ligne="seconde"] button').nth(2).click();
    await page.locator('#copie-sujet [data-zone="3"] [data-ligne="premiere"] button').nth(3).click();
    await page.locator('#copie-sujet [data-zone="3"] [data-ligne="premiere"] button').last().click();
    await page.waitForTimeout(300);
    /* On cadre sur les zones remplies plutôt que sur le haut de page. */
    await page.locator('#copie-sujet [data-zone="2"]').scrollIntoViewIfNeeded();
    await prise('copie-remplie');

    /* 3. L'écran de fin. */
    await page.locator('#copie-sujet [data-zone="4"] [data-ligne="premiere"] button').nth(2).click();
    await page.waitForTimeout(300);
    await page.click('#rendre-copie');
    await attendreLaBoite(page);
    await repondreALaBoite(page, 'Rendre la copie');
    await page.waitForSelector('#resultat-dgfip:not(.hidden)', { timeout: 30000 });
    await page.locator('#panneau-themes summary').click();
    await page.waitForTimeout(300);
    await prise('copie-fin');

    /* 4. La feuille de réponse, ses soixante zones. */
    await page.locator('#panneau-feuille summary').click();
    await page.waitForTimeout(400);
    await page.locator('#feuille-copie').scrollIntoViewIfNeeded();
    await prise('copie-feuille');

    /*
       Un contrôle au passage, qui ne coûte rien et qui vaut mieux qu'un œil
       sur vingt-quatre images : la page ne doit pas déborder en largeur.
    */
    const debord = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (debord > 1) anomalies.push(`${taille.nom}/${mode} : débordement de ${debord} px`);

    /*
       ET LA PLACE QUE PREND LA BARRE COLLANTE, mesurée comme
       `essais:entetes-collants` la mesure : l'enveloppe de ce qui est
       « sticky » ou « fixed », visible, et touche le haut de la fenêtre.

       L'écran de l'épreuve n'est pas dans la liste de cet essai, mais la
       règle vaut : un tiers d'écran perdu en permanence est un tiers perdu,
       quel que soit l'écran. La première version en prenait 215 à 360 px ;
       c'est la capture qui l'a montré, et c'est ce contrôle qui empêche d'y
       revenir sans s'en apercevoir.
    */
    const collant = await page.evaluate(() => {
      let bas = 0;
      for (const element of document.querySelectorAll('body *')) {
        const style = getComputedStyle(element);
        if (style.position !== 'sticky' && style.position !== 'fixed') continue;
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        const boite = element.getBoundingClientRect();
        if (boite.height === 0 || boite.top > 2) continue;
        if (boite.height > innerHeight * 0.8) continue;
        bas = Math.max(bas, boite.bottom);
      }
      return Math.round(bas);
    });
    const plafond = Math.round(taille.viewport.height * 0.15);
    if (collant > plafond) {
      anomalies.push(
        `${taille.nom}/${mode} : barre collante de ${collant} px, au-delà du plafond de ${plafond}`,
      );
    } else {
      console.log(`  ${taille.nom}/${mode} : barre collante ${collant} px sur ${plafond} permis`);
    }

    await contexte.close();
  }
}

await nav.close();

console.log(`\n${faites} captures dans « ${DOSSIER} » (hors du dépôt).`);
if (anomalies.length) {
  console.log(`\n\x1b[31m${anomalies.length} anomalie(s) :\x1b[0m`);
  for (const a of anomalies) console.log(`  · ${a}`);
  process.exit(1);
}
console.log('\x1b[32mAucune anomalie : aucun débordement, aucune erreur de page.\x1b[0m\n');
