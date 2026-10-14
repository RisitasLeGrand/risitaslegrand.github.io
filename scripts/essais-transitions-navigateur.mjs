/**
 * Transitions entre pages — et ce qu'elles ne doivent jamais capturer.
 *
 *   npm run essais:transitions:navigateur
 *
 * **Ce qui est en jeu.** Une transition entre documents photographie la page
 * sortante et rejoue cette photographie par-dessus la page entrante. Si la
 * page sortante est un écran dont le coffre est ouvert, la photographie
 * contient des données déchiffrées, et elles s'affichent pendant la
 * transition sur une page qui n'aurait jamais dû les montrer. L'interdit n° 2
 * du prompt 34 l'exclut sans réserve.
 *
 * La parade : les pages sous coffre n'émettent pas `@view-transition`. Comme
 * une transition exige le consentement des **deux** pages, aucune capture
 * n'a lieu, ni en partant ni en arrivant.
 *
 * Cet essai ne se contente pas de relire le CSS — `essais:coffre-transitions`
 * le fait déjà, et mieux. Il observe **les événements**, parce qu'eux seuls
 * disent si une transition a eu lieu, et surtout **quelle page a été
 * photographiée**.
 *
 * **Deux événements, et il faut les deux.** Mesuré le 14 octobre 2026 :
 *
 *   départ (`pageswap`)     consentement de la page **sortante** seule ;
 *   arrivée (`pagereveal`)  consentement **mutuel**, donc transition réelle.
 *
 * D'où le relevé obtenu, qui n'est pas celui que j'attendais :
 *
 *   ordinaire → ordinaire      départ oui, arrivée oui   → transition
 *   ordinaire → sous coffre    départ oui, arrivée NON   → abandonnée
 *   coffre ouvert → ordinaire  départ NON, arrivée non   → jamais amorcée
 *
 * La deuxième ligne a d'abord été lue comme une fuite : elle n'en est pas une.
 * La photographie annoncée au départ est celle de la page **ordinaire** — le
 * glossaire — et le navigateur abandonne la transition à l'arrivée, faute de
 * consentement de la page sous coffre. Ce qui protège les données, c'est la
 * troisième ligne : en partant d'un coffre ouvert, rien n'est photographié.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};

const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
/*
   Le témoin d'arrivée doit exister **avant le premier rendu** de la page
   entrante : `pagereveal` se déclenche trop tôt pour qu'on l'installe après
   la navigation. Un script d'initialisation, lui, court à document-start.
*/
await contexte.addInitScript(() => {
  window.addEventListener(
    'pagereveal',
    (e) => {
      try {
        sessionStorage.setItem('essai.arrivee', e.viewTransition ? 'oui' : 'non');
      } catch {
        /* sessionStorage peut manquer : l'absence de relevé vaut échec. */
      }
    },
    { once: true },
  );
});

const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

console.log('\nTRANSITIONS ENTRE PAGES');

/* --- Le navigateur sait-il faire ? -------------------------------------- */
/* Sans cela, les deux contrôles suivants seraient verts parce que rien ne se
   passe — pas parce que la règle fonctionne. */

await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
const sait = await page.evaluate(() => 'onpageswap' in window);
console.log(
  sait
    ? '  (ce navigateur gère les transitions entre documents)'
    : "  (ce navigateur ne les gère pas : la navigation reste sèche, c'est le repli prévu)",
);

/* --- 1. La règle est là où il faut, et seulement là --------------------- */

const regleIci = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('style'))
      .some((s) => s.textContent?.includes('@view-transition')),
  );

await page.goto(`${RACINE}/glossaire/`, { waitUntil: 'networkidle' });
v('une page ordinaire porte la règle', await regleIci(), true);

await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
v('une page sous coffre ne la porte pas', await regleIci(), false);

/* --- 2. L'événement : la transition a-t-elle vraiment lieu ? ------------ */
/*
   « pageswap » ne se déclenche que si une transition entre documents démarre.
   On pose le témoin, on navigue par un vrai clic de lien, et on relève.
*/

/*
   Attention à ce qu'on mesure — deux fois plutôt qu'une.

   D'abord, `pageswap` se déclenche à **chaque** navigation de même origine,
   transition ou non : le relevé du 14 octobre l'a montré en condamnant à tort
   une implémentation correcte. Ce qui distingue les deux cas, c'est
   `event.viewTransition` — un objet quand une transition démarre, `null`
   sinon.

   Ensuite, et c'est la correction du même jour : `pageswap` ne connaît que la
   page sortante. Il annonce « oui » dès que **celle-ci** consent, avant même
   que le navigateur ait vu la page entrante. Seul `pagereveal`, à l'arrivée,
   atteste que la transition s'est réellement jouée. On consigne donc les deux,
   et on les nomme par leur bout du trajet.
*/
const poserTemoin = () =>
  page.evaluate(() => {
    window.addEventListener(
      'pageswap',
      (e) => sessionStorage.setItem('essai.depart', e.viewTransition ? 'oui' : 'non'),
      { once: true },
    );
    sessionStorage.removeItem('essai.depart');
    sessionStorage.removeItem('essai.arrivee');
  });

/** @returns {Promise<{depart: string|null, arrivee: string|null}>} */
const releverTemoin = () =>
  page.evaluate(() => ({
    depart: sessionStorage.getItem('essai.depart'),
    arrivee: sessionStorage.getItem('essai.arrivee'),
  }));

if (sait) {
  // a) page ordinaire vers page ordinaire : la transition doit avoir lieu.
  await page.goto(`${RACINE}/glossaire/`, { waitUntil: 'networkidle' });
  await poserTemoin();
  await page.evaluate(() => {
    window.location.href = '/recherche/';
  });
  await page.waitForURL('**/recherche/', { timeout: 15000 });
  v('ordinaire → ordinaire : la transition a lieu', await releverTemoin(), {
    depart: 'oui',
    arrivee: 'oui',
  });

  // b) page sous coffre vers page ordinaire : elle ne doit PAS avoir lieu.
  //    C'est le cas qui protège les données ; le coffre est ouvert pour que
  //    l'essai porte sur l'écran réellement à risque, pas sur une coquille.
  await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
  // Deux serrures se succèdent : le verrou de session, puis le coffre de
  // l'écran. Chercher le second sans avoir ouvert le premier ne rend rien.
  const session = page.locator('#champ-mdp');
  if (await session.isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  /* Le formulaire du coffre naît dans une section `hidden` que le script
     révèle après déchiffrement. Un délai fixe parie sur la durée de ce
     déchiffrement ; on attend l'état, et l'essai cesse de mesurer sa propre
     impatience. */
  const verrou = page.locator('#mdp-coffre');
  const ouvrable = await verrou
    .waitFor({ state: 'visible', timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  v('le coffre de la page sensible est bien présent', ouvrable, true);
  if (ouvrable) {
    await page.fill('#mdp-coffre', MDP);
    await page.keyboard.press('Enter');
    /* De même à l'ouverture : on attend que le formulaire s'efface, signe que
       le contenu chiffré est rendu — c'est lui que la transition ne doit
       jamais photographier. */
    await verrou.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
  }

  await poserTemoin();
  await page.evaluate(() => {
    window.location.href = '/glossaire/';
  });
  await page.waitForURL('**/glossaire/', { timeout: 15000 });
  /* Le contrôle qui protège réellement : en partant d'un écran dont le coffre
     est ouvert, le départ lui-même refuse — rien n'est photographié. */
  v(
    'coffre ouvert → ordinaire : aucune capture de la page sensible',
    await releverTemoin(),
    { depart: 'non', arrivee: 'non' },
  );

  // c) et dans l'autre sens, puisque le consentement doit être mutuel.
  //    Ici le départ annonce « oui » — et c'est correct : c'est le glossaire
  //    qu'il propose de photographier, pas le coffre. Ce qui compte est que
  //    l'arrivée refuse, donc qu'aucune transition ne se joue sur l'écran
  //    sensible. Attendre « non » au départ serait attendre du navigateur
  //    qu'il devine la page suivante avant de l'avoir demandée.
  await page.goto(`${RACINE}/glossaire/`, { waitUntil: 'networkidle' });
  await poserTemoin();
  await page.evaluate(() => {
    window.location.href = '/odyssee/psyche/';
  });
  await page.waitForURL('**/odyssee/psyche/', { timeout: 15000 });
  v('ordinaire → sous coffre : la transition est abandonnée à l’arrivée', await releverTemoin(), {
    depart: 'oui',
    arrivee: 'non',
  });
} else {
  console.log('  — contrôles 2a à 2c non exécutés : le navigateur ne sait pas.');
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
