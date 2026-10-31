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
import {
  apresLesAnimations,
  attendreEnBase,
  attendreLeCompte,
  devientVisible,
} from './lib/post-condition.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
/** Le plancher du 43. En dessous, le bandeau ne sert à rien. */
const SECONDES_MINIMUM = 6;
/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;
/**
 * LE REPOS DU SITE, ET LA MARGE QU'ON LUI LAISSE.
 *
 * `src/lib/geste.ts` refuse un geste répété à données identiques en moins de
 * 600 ms. C'est l'objet de cet essai, donc les deux seules temporisations
 * gardées ici franchissent ce repos — on ne peut pas les remplacer par une
 * post-condition, puisque ce qu'on attend est qu'il ne se passe RIEN, et
 * donner une marque à ce non-événement reviendrait à annoncer la
 * déduplication que le site rend invisible.
 */
const REPOS_FRANCHI_MS = 700;

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
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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
  /*
     UNE PAGE VISITÉE POUR SON EFFET DE BORD A BESOIN DE SA POST-CONDITION, et
     c'est la leçon que ce passage m'a coûtée. La bibliothèque se déchiffre sur
     cet écran-ci ; « networkidle » dit que le réseau se tait, pas que le
     déchiffrement est fini et rangé. Ma première conversion retirait les deux
     fois 2 200 ms en croyant que l'attente du sélecteur, plus bas, suffisait :
     mesuré à ×15 de bridage, le sélecteur restait vide et l'essai entier
     tombait avant sa première assertion.

     `#vue` ne paraît qu'une fois la bibliothèque lue : c'est la marque que
     l'écran donne, et elle vaut mieux que deux secondes deux cents.
  */
  await page.goto(`${RACINE}/sport/exercices/`, { waitUntil: 'networkidle' });
  await devientVisible(page, '#vue', true, { delai: DELAI });
  await page.goto(`${RACINE}/sport/seance/`, { waitUntil: 'networkidle' });
  await page.click('#commencer');
  /*
     Et la borne est désormais à sa place. Elle était passée en DEUXIÈME
     argument de `waitForFunction`, où Playwright attend la valeur à passer à
     la fonction : les vingt secondes annoncées n'en étaient pas, et la borne
     réelle était celle par défaut. Une borne qu'on croit avoir fixée est pire
     qu'une borne absente.
  */
  await page.waitForFunction(
    () => (document.getElementById('exercice')?.options.length ?? 0) > 0,
    undefined,
    { timeout: DELAI },
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
  /* L'écart EST la mesure : c'est la variable de cet essai, pas une attente. */
  if (ecart) await page.waitForTimeout(ecart);
  await bouton.click().catch(() => {});
  /*
     Deux temps, et ils ne sont pas interchangeables. D'abord la première
     écriture, attendue par sa peinture — c'est une post-condition. Puis le
     repos franchi, pour qu'une seconde écriture ait eu le temps de paraître
     si elle devait venir : « rien ne s'est passé » ne s'attend pas autrement.
  */
  await attendreLeCompte(page, '#series > *', 1, { delai: DELAI });
  await page.waitForTimeout(REPOS_FRANCHI_MS);
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
  await attendreLeCompte(page, '#series > *', 1, { delai: DELAI });
  /* Le repos franchi : la seconde série est VOULUE, et doit passer. */
  await page.waitForTimeout(REPOS_FRANCHI_MS);
  await page.fill('#repetitions', '8');
  await page.locator('#saisie button[type=submit]').click();
  await attendreLeCompte(page, '#series > *', 2, { delai: DELAI });
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
  await attendreLeCompte(page, '#series > *', 1, { delai: DELAI });
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
  /*
     ICI L'ORDRE DU SITE EST L'INVERSE DE CELUI DE SANTÉ, et c'est pourquoi il
     se lit plutôt que se suppose. Le gestionnaire d'« Abandonner » repeint
     l'écran D'ABORD — `await peindre()` — et propose l'annulation ENSUITE.
     Le bandeau est donc la peinture la PLUS TARDIVE : l'attendre couvre aussi
     les lectures de l'état de l'écran qui suivent.
  */
  await devientVisible(page, '#bandeau-annulation', true, { delai: DELAI });
  /*
     ET L'ANIMATION FINIE, parce que trois de ces constats lisent une
     GÉOMÉTRIE. Le bandeau porte `animation: boite-monte` : mesuré, son bas
     passe de 708 à 684 px en cent cinquante millisecondes. Lu dès qu'il est
     visible, il paraît vingt-quatre pixels sous la barre du bas, et
     « au-dessus de la barre » tombe — sur du code sain. C'est ma première
     conversion de ce fichier qui est tombée là.
  */
  await apresLesAnimations(page, '#bandeau-annulation');

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
  /*
     `defaire` retire le bandeau, puis rend la séance et repeint : la série
     revenue est la dernière chose écrite, donc c'est elle qu'on attend.
  */
  await attendreLeCompte(page, '#series > *', 1, { delai: DELAI });
  verifier('annuler rend la séance avec sa série', await combienDeSeries(page), 1);
  verifier('et le bandeau s’en va', await page.evaluate(() => !document.getElementById('bandeau-annulation')), true);

  /*
     ET LE REPOS, AVANT DE REFAIRE LE MÊME GESTE — la leçon de ce lot.

     « Abandonner » passe par `unSeulGeste`, et l'empreinte d'un bouton sans
     champ est VIDE : deux appuis sur ce bouton portent donc la même empreinte,
     et le second est pris pour un rebond s'il arrive moins de 600 ms après la
     fin du premier. Les temporisations d'avant franchissaient ce repos sans le
     savoir ; les post-conditions, plus rapides, le ramènent dans la fenêtre.

     Mesuré : sans cette ligne, le second « Abandonner » est avalé, la séance
     reste en cours, et deux assertions tombent — sur du code sain.
  */
  await page.waitForTimeout(REPOS_FRANCHI_MS);

  /* Et si l'on ne fait rien, la suppression part pour de bon. */
  await page.click('#abandonner');
  /*
     SEPT SECONDES ET DEMIE ATTENDAIENT SIX SECONDES DE BANDEAU, et le reste
     était de la marge. L'expiration, elle, se lit dans le magasin : l'écran
     s'était vidé au clic, et la suppression ne lui ajoute rien.
  */
  await attendreEnBase(
    page,
    'sportSeances',
    (tout) => tout.filter((s) => s.statut === 'en-cours').length === 0,
  );
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
  /*
     Les deux sections partent `hidden` du serveur : « repos visible » est donc
     une vraie transition, et non un état déjà acquis. C'est la peinture de
     l'écran rechargé, et elle vaut mieux que deux secondes et demie.
  */
  await devientVisible(page, '#repos', true, { delai: DELAI });
  verifier('et la séance ne revient pas au rechargement', await etatDeLEcran(), {
    repos: true,
    enCours: false,
  });
  await ctx.close();
}

await nav.close();
process.exit(rouges === 0 ? 0 : 1);
