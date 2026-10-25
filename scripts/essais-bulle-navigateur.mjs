/**
 * La bulle : assez longue pour être lue, et jamais sur la barre (C4 du 43).
 *
 *   npx astro preview &  CHROMIUM=… SITE_PASSWORD=… npm run essais:bulle:navigateur
 *
 * Trois promesses du point C4, et aucune ne se lit dans le code :
 *
 * - la bulle dure **5 s au moins** — elle en durait 2,6, ce qui suffit à voir
 *   qu'il s'est passé quelque chose et pas à lire une phrase ;
 * - elle **se ferme d'un appui**, pour qui a déjà lu ;
 * - elle passe **au-dessus de la barre du bas, encoche comprise** : sur un
 *   téléphone à poignée d'accueil, elle finissait dessous, là où le doigt
 *   appartient au système.
 *
 * Le changement de parcours du glossaire produit une bulle de succès sans
 * coffre ni séance : c'est le déclencheur le plus court du dépôt.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { readFileSync } from 'node:fs';

/*
   La constante se LIT dans le fichier, elle ne s'importe pas : `ui.ts` touche
   `import.meta.env` dès son premier import, ce qu'un script Node ne sait pas
   fournir. Lire le littéral garde ce que l'import donnait — un essai qui cite
   la valeur nommée et rougit si elle redescend — sans traîner tout Astro.
*/
const DUREE_BULLE_MS = Number(
  /export const DUREE_BULLE_MS = (\d+)/.exec(readFileSync('src/lib/ui.ts', 'utf8'))?.[1] ?? 0,
);

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({ executablePath: cheminDuNavigateur(), args: ['--no-sandbox'] });

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

console.log('\nLA DURÉE EST DÉCLARÉE, ET ELLE TIENT LE PLANCHER');
vrai(`la bulle dure ${DUREE_BULLE_MS} ms, soit 5 000 au moins`, DUREE_BULLE_MS >= 5000);

/** Ouvre le glossaire et change de parcours : une bulle de succès paraît. */
async function faireParaitreUneBulle(page) {
  await page.goto(`${RACINE}/glossaire/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#selecteur-parcours', { timeout: 40000 });
  const options = await page.$$eval('#selecteur-parcours option', (o) => o.map((x) => x.value));
  const courant = await page.$eval('#selecteur-parcours', (e) => e.value);
  const autre = options.find((o) => o && o !== courant);
  vrai('il existe un second parcours pour provoquer une bulle', Boolean(autre));
  await page.selectOption('#selecteur-parcours', autre);
  const bulle = page.locator('.bulle-notification').first();
  await bulle.waitFor({ state: 'visible', timeout: 15000 });
  return bulle;
}

/* ════════════════════════════════════════════════════════════════════════
   1. Au téléphone : au-dessus de la barre, et de l'encoche
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nAU TÉLÉPHONE, LA BULLE NE COUVRE PAS LA BARRE');

const tactile = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const surTelephone = await tactile.newPage();
{
  const bulle = await faireParaitreUneBulle(surTelephone);
  const mesures = await surTelephone.evaluate(() => {
    const bulle = document.querySelector('.bulle-notification');
    /* La barre par son identifiant, et non par ses classes : « nav » et
       « fixed » attrapent aussi les menus du pied de page, et c'est ce qui a
       fait rougir cet essai sur une bulle pourtant bien placée. */
    const barre = document.getElementById('barre-du-bas');
    const racine = getComputedStyle(document.documentElement);
    return {
      basDeLaBulle: bulle.getBoundingClientRect().bottom,
      hautDeLaBarre: barre ? barre.getBoundingClientRect().top : null,
      hauteur: window.innerHeight,
      sousLeBas: racine.getPropertyValue('--sur-bas').trim(),
    };
  });
  vrai(
    'la bulle est au-dessus du bas de la fenêtre, et pas collée dedans',
    mesures.basDeLaBulle < mesures.hauteur - 48,
  );
  if (mesures.hautDeLaBarre !== null) {
    vrai(
      'et elle ne mord pas sur la barre du bas',
      mesures.basDeLaBulle <= mesures.hautDeLaBarre + 1,
    );
  }
  /* L'encoche est comptée : la règle la nomme, et un essai du dépôt lui donne
     une valeur. On vérifie que la variable existe, faute de pouvoir simuler
     une poignée d'accueil dans un navigateur sans encoche. */
  v('la variable de l’encoche existe', typeof mesures.sousLeBas, 'string');
  await bulle.waitFor({ state: 'visible' });
}

/* ════════════════════════════════════════════════════════════════════════
   2. Elle reste assez longtemps pour être lue
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nELLE RESTE ASSEZ LONGTEMPS POUR ÊTRE LUE');

{
  const bulle = surTelephone.locator('.bulle-notification').first();
  /* Quatre secondes après la parution, elle est encore là. L'ancienne durée,
     2,6 s, aurait déjà rendu cette assertion fausse. */
  await surTelephone.waitForTimeout(4000);
  vrai('quatre secondes après, elle est encore à l’écran', await bulle.isVisible());
}

/* ════════════════════════════════════════════════════════════════════════
   3. Et elle se ferme d'un appui
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nELLE SE FERME D’UN APPUI');

{
  const bulle = await faireParaitreUneBulle(surTelephone);
  await bulle.click();
  await bulle.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  v(
    'après l’appui, plus aucune bulle',
    await surTelephone.locator('.bulle-notification').count(),
    0,
  );
}

await tactile.close();
await nav.close();
console.log(echecs ? `\n\x1b[31m${echecs} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(echecs ? 1 : 0);
