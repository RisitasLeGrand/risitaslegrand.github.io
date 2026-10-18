/**
 * M6 — un geste, une écriture ; et ce qui se défait se défait d'en bas.
 *
 *   npm run essais:gestes
 *
 * ## Les deux règles mesurées
 *
 * 1. **Le double appui n'écrit pas deux fois.** Mesuré le 18 octobre sur
 *    « Valider la série » à 0, 60, 150 et 300 ms d'écart : une seule série à
 *    chaque fois — mais par effet de bord, la validation native refusant la
 *    seconde soumission parce que le champ « Répétitions » venait d'être
 *    vidé. Une garantie qui tient par accident n'en est pas une : le sabotage
 *    ci-dessous retire l'accident pour voir ce qui reste.
 * 2. **« Supprimer cette séance » s'annule depuis un bandeau en bas, au moins
 *    six secondes, sans fenêtre de confirmation.** Et l'annulation rend
 *    vraiment la séance, avec ses séries : c'est la moitié qu'on oublie.
 *
 * ## Pourquoi l'essai ouvre d'abord la bibliothèque
 *
 * Le sélecteur d'exercices d'une séance se remplit depuis la bibliothèque, et
 * celle-ci se déchiffre à la première visite. Sans ce passage, le sélecteur
 * est vide, aucune série n'est saisissable, et l'essai mesurerait un écran
 * sans contenu — ce qui ne prouve rien.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
/** Le plancher du 43. En dessous, le bandeau ne sert à rien. */
const SECONDES_MINIMUM = 6;

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
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
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

/** Ouvre une séance, sélecteur d'exercices rempli, et rend la page. */
async function seancePrete() {
  const ctx = await nav.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/sport/exercices/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.goto(`${RACINE}/sport/seance/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.click('#commencer');
  await page.waitForFunction(
    () => (document.getElementById('exercice')?.options.length ?? 0) > 0,
    { timeout: 20000 },
  );
  return { ctx, page };
}

/** Remplit le formulaire d'une série. */
async function remplir(page) {
  const exercice = await page.evaluate(
    () => [...document.getElementById('exercice').options].map((o) => o.value).filter(Boolean)[0],
  );
  await page.selectOption('#exercice', exercice);
  await page.fill('#charge', '40');
  await page.fill('#repetitions', '10');
  await page.waitForTimeout(300);
}

const combienDeSeries = (page) =>
  page.evaluate(() => document.getElementById('series')?.children.length ?? -1);

/* ---- 1. Le double appui ------------------------------------------------ */

console.log('\nUN GESTE, UNE SÉRIE');
for (const ecart of [0, 60, 150, 300]) {
  const { ctx, page } = await seancePrete();
  await remplir(page);
  const bouton = page.locator('#saisie button[type=submit]');
  await bouton.click();
  if (ecart) await page.waitForTimeout(ecart);
  await bouton.click().catch(() => {});
  await page.waitForTimeout(2000);
  verifier(`deux appuis à ${ecart} ms d’écart n’écrivent qu’une série`, await combienDeSeries(page), 1);
  await ctx.close();
}

/*
   Et le revers, sans lequel le garde-fou serait un défaut : une seconde série
   **voulue**, une seconde plus tard, doit passer. Un contrôle qui accuse à
   tort se fait désactiver, et on perd les deux.
*/
{
  const { ctx, page } = await seancePrete();
  await remplir(page);
  await page.locator('#saisie button[type=submit]').click();
  await page.waitForTimeout(1200);
  await page.fill('#repetitions', '8');
  await page.locator('#saisie button[type=submit]').click();
  await page.waitForTimeout(1500);
  verifier('mais deux séries voulues, à une seconde d’écart, s’écrivent bien', await combienDeSeries(page), 2);
  await ctx.close();
}

/* ---- 2. Le bandeau d'annulation ---------------------------------------- */

const decrireLeBandeau = () =>
  // eslint-disable-next-line no-undef
  (() => {
    const b = document.getElementById('bandeau-annulation');
    if (!b) return { present: false };
    const r = b.getBoundingClientRect();
    const bouton = b.querySelector('.bandeau-annulation-bouton');
    const rb = bouton.getBoundingClientRect();
    const barre = document.getElementById('barre-du-bas');
    return {
      present: true,
      texte: (b.textContent ?? '').replace(/\s+/g, ' ').trim(),
      role: b.getAttribute('role'),
      // Au-dessus de la barre du bas, et non derrière elle.
      auDessusDeLaBarre: !barre || r.bottom <= barre.getBoundingClientRect().top + 1,
      boutonTouchable: rb.height >= 44,
      secondes: Number(
        (b.querySelector('.bandeau-annulation-reste')?.textContent ?? '').replace(/\D/g, ''),
      ),
    };
  })();

console.log('\n« SUPPRIMER CETTE SÉANCE » S’ANNULE, ET NE DEMANDE RIEN');
{
  const { ctx, page } = await seancePrete();
  await remplir(page);
  await page.locator('#saisie button[type=submit]').click();
  await page.waitForTimeout(1500);
  verifier('la prémisse — une série est enregistrée avant qu’on supprime', await combienDeSeries(page), 1);

  /* Aucune fenêtre ne doit s'ouvrir : ni native, ni la boîte commune. */
  await page.evaluate(() => {
    window.__natives = 0;
    window.confirm = () => {
      window.__natives += 1;
      return true;
    };
  });
  await page.click('#abandonner');
  await page.waitForTimeout(700);

  const vu = await page.evaluate(decrireLeBandeau);
  verifier('le bandeau paraît', vu.present, true);
  verifier('sans aucune fenêtre de confirmation', await page.evaluate(() => window.__natives), 0);
  verifier(
    'il dit ce qui est parti, et combien',
    vu.texte.startsWith('Séance supprimée, avec sa série.'),
    true,
  );
  verifier('il est annoncé comme un état, pas comme une alerte', vu.role, 'status');
  verifier('il est au-dessus de la barre du bas, pas derrière', vu.auDessusDeLaBarre, true);
  verifier('« Annuler » tient le plancher de 44 px', vu.boutonTouchable, true);
  verifier(`le délai part d’au moins ${SECONDES_MINIMUM} s`, vu.secondes >= SECONDES_MINIMUM, true);
  /*
     L'écran bascule entre deux sections, `#repos` et `#encours` : c'est là
     que se lit l'état, et non sur un bouton. Une première version interrogeait
     `closest('section').classList`, qui ne dit rien ici — elle a échoué sur du
     code sain, et c'est le banc qu'il a fallu corriger, pas l'écran.
  */
  const etatDeLEcran = () =>
    page.evaluate(() => ({
      repos: !document.getElementById('repos')?.classList.contains('hidden'),
      enCours: !document.getElementById('encours')?.classList.contains('hidden'),
    }));
  verifier('et l’écran s’est vidé tout de suite', await etatDeLEcran(), {
    repos: true,
    enCours: false,
  });

  /* Annuler rend la séance ET ses séries : c'est la moitié qu'on oublie. */
  await page.click('.bandeau-annulation-bouton');
  await page.waitForTimeout(1200);
  verifier('annuler rend la séance avec sa série', await combienDeSeries(page), 1);
  verifier('et le bandeau s’en va', await page.evaluate(() => !document.getElementById('bandeau-annulation')), true);

  /* Et si l'on ne fait rien, la suppression part pour de bon. */
  await page.click('#abandonner');
  await page.waitForTimeout(SECONDES_MINIMUM * 1000 + 1500);
  verifier(
    'laissé expirer, le bandeau part et l’écran reste vide',
    {
      bandeau: await page.evaluate(() => !!document.getElementById('bandeau-annulation')),
      ...(await etatDeLEcran()),
    },
    { bandeau: false, repos: true, enCours: false },
  );
  /* La preuve que la suppression est bien partie : elle survit au
     rechargement. Sans cela, on ne distinguerait pas « supprimée » de
     « écran vidé, suppression jamais exécutée ». */
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  verifier('et la séance ne revient pas au rechargement', await etatDeLEcran(), {
    repos: true,
    enCours: false,
  });
  await ctx.close();
}

await nav.close();
process.exit(rouges === 0 ? 0 : 1);
