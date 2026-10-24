/**
 * Une séance ouverte sans aucun exercice en bibliothèque — anomalie A-43-1.
 *
 *   npm run essais:bibliotheque-vide
 *
 * ## Le défaut, et pourquoi il ne se voyait pas
 *
 * `sport/seance.astro` peint le choix d'exercice depuis la bibliothèque, et
 * ce `<select>` porte `required`. Bibliothèque vide, il n'a aucune option :
 * le navigateur refuse la soumission du formulaire, et l'écran ne dit rien.
 * On a donc sous les yeux un formulaire complet — charge, répétitions,
 * réserve, « Enregistrer la série » — qui n'enregistre rien et n'explique
 * pas pourquoi.
 *
 * Trouvé le 19 octobre en corrigeant `essais:sport:navigateur`, qui
 * supprimait le seul exercice dont sa section suivante avait besoin et
 * attendait ensuite quinze secondes une série impossible. Tranché par le
 * pilote : le formulaire cède la place à une phrase et à un lien.
 *
 * ## Ce que cet essai sème, et pourquoi
 *
 * Il vide `sportExercices`. L'écran sait produire cet état — trente-deux
 * suppressions confirmées une à une —, mais ce n'est pas ce qui est éprouvé
 * ici : ce qui est éprouvé, c'est ce que l'écran DIT une fois la
 * bibliothèque vide. Le semis est déclaré dans `essais-semis.mjs`.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext()).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));

const deverrouiller = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
};

await franchirInitialisation(page, RACINE, MDP);

/*
   On passe d'abord par la bibliothèque : c'est son ouverture qui pose les
   exercices fournis. Vider avant qu'ils ne soient posés ne prouverait rien,
   puisqu'ils reparaîtraient au premier affichage.
*/
await page.goto(`${RACINE}/sport/exercices/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
const fournis = await page.evaluate(() => document.querySelectorAll('#liste [data-exercice]').length);
vrai('prémisse : la bibliothèque fournie est bien posée', fournis > 0);

console.log('\nLA BIBLIOTHÈQUE EST VIDÉE');
const restants = await page.evaluate(
  () =>
    new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onerror = () => ko(r.error);
      r.onsuccess = () => {
        const base = r.result;
        const tx = base.transaction('sportExercices', 'readwrite');
        tx.objectStore('sportExercices').clear();
        tx.oncomplete = () => {
          const q = base.transaction('sportExercices').objectStore('sportExercices').count();
          q.onsuccess = () => {
            base.close();
            ok(q.result);
          };
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
);
v('plus aucun exercice en base', restants, 0);

console.log('\nLA SÉANCE LE DIT, ET DONNE LA PORTE');
await page.goto(`${RACINE}/sport/seance/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
await page.click('#commencer');
await page.waitForSelector('#encours:not(.hidden)', { timeout: 15000 });

{
  const dit = await page.locator('#bibliotheque-vide').isVisible();
  vrai('la phrase est affichée', dit);
  vrai(
    'et c’est bien celle qui a été décidée',
    ((await page.textContent('#bibliotheque-vide')) ?? '').includes(
      'Aucun exercice dans votre bibliothèque pour l’instant.',
    ),
  );
  faux('le formulaire de saisie n’est plus proposé', await page.locator('#saisie').isVisible());
  /*
     Le lien, et non une phrase seule : un cul-de-sac qui s'explique reste un
     cul-de-sac. C'est la porte qui compte.
  */
  const porte = page.locator('#bibliotheque-vide a[href$="/sport/exercices/"]');
  vrai('un lien mène à la bibliothèque', await porte.isVisible());
  v('et il dit ce qu’il fait', ((await porte.textContent()) ?? '').trim(), 'Ajouter un exercice');
}

console.log('\nUN EXERCICE AJOUTÉ, LE FORMULAIRE REVIENT');
await page.goto(`${RACINE}/sport/exercices/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 30000 });
await page.click('#ouvrir-ajout');
await page.waitForSelector('#fenetre-ajout[open]', { timeout: 15000 });
await page.fill('#nom', 'Exercice de retour');
await page.selectOption('[data-case="quadriceps"]', 'principal');
await page.click('#ajout button[type="submit"]');
await page.waitForFunction(
  () => [...document.querySelectorAll('#liste p')].some((p) => p.textContent.includes('Exercice de retour')),
  undefined,
  { timeout: 15000 },
);

await page.goto(`${RACINE}/sport/seance/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#encours:not(.hidden)', { timeout: 30000 });
vrai('le formulaire est de nouveau là', await page.locator('#saisie').isVisible());
faux('et la phrase a disparu', await page.locator('#bibliotheque-vide').isVisible());
/*
   ET LA PORTE RÉPARE L'ÉTAT, CE QUI EST MIEUX QUE DE LE DIRE.

   Ouvrir la bibliothèque repose les exercices fournis (`installerBibliotheque`,
   au déverrouillage) : on retrouve donc les trente et un livrés, plus celui
   qu'on vient d'écrire. L'essai ne fige pas ce compte — il grandira le jour
   où un exercice sera ajouté à la bibliothèque livrée —, il constate que
   l'exercice saisi est là et que le choix n'est plus vide.
*/
{
  const options = await page.$$eval('#exercice option', (o) => o.map((x) => x.textContent ?? ''));
  vrai('le choix d’exercice n’est plus vide', options.length > 0);
  vrai(
    'et il porte l’exercice qui vient d’être ajouté',
    options.some((t) => t.includes('Exercice de retour')),
  );
}

console.log(echecs ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n` : '\n\x1b[32m✓ tout passe\x1b[0m\n');
await nav.close();
process.exit(echecs ? 1 : 0);
