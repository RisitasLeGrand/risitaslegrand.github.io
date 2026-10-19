/**
 * Le repos du geste ne confond plus deux gestes différents.
 *
 *   npm run essais:geste-empreinte
 *
 * ## Ce que cet essai éprouve, et pourquoi il a fallu l'écrire
 *
 * `unSeulGeste` (A1 du 43) impose 600 ms de repos après un geste abouti,
 * contre le doigt qui rebondit et écrit deux fois la même chose. Le repos
 * était indexé par le seul CONTRÔLE : deux ajouts délibérés et différents
 * sur le même formulaire, à moins de 600 ms, étaient donc écartés tous les
 * deux sauf le premier — en silence.
 *
 * Mesuré le 19 octobre sur trois essais : le clic avait lieu, l'événement
 * « submit » avait lieu, et rien ne s'écrivait. Il a fallu instrumenter la
 * page pour le voir. Le pilote a tranché : le repos n'écarte qu'un double
 * appui sur le même contrôle **avec les mêmes données**.
 *
 * Les deux sens sont éprouvés ici, sur le même écran, le même bouton et le
 * même écart de temps. **Seules les données changent**, et c'est la seule
 * chose qui doit changer le résultat.
 *
 * ## Ce que cet essai ne prétend pas couvrir
 *
 * Le verrou de concurrence — « une action à la fois sur un contrôle » —
 * reste posé par contrôle, et non par empreinte : deux appuis strictement
 * simultanés restent sérialisés, ce qui est la promesse M6. Un écart de
 * 250 ms suffit largement à l'écrire, et personne ne saisit deux titres
 * différents en moins que cela.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const ECART_MS = 250;

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (titre, condition) => v(titre, condition, true);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await (await nav.newContext()).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));

/** Le compte des tâches, lu dans la base : un écran peut regrouper, pas elle. */
const compter = () =>
  page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          if (!base.objectStoreNames.contains('odysseeTaches')) {
            ok(-1);
            return;
          }
          const q = base.transaction('odysseeTaches').objectStore('odysseeTaches').count();
          q.onsuccess = () => {
            base.close();
            ok(q.result);
          };
          q.onerror = () => ok(-2);
        };
        r.onerror = () => ok(-3);
      }),
  );

await franchirInitialisation(page, RACINE, MDP);
await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.locator('#ajout').waitFor({ state: 'visible', timeout: 30000 });

const depart = await compter();
vrai('prémisse : le magasin des tâches est lisible', depart >= 0);

console.log('\nDEUX TITRES DIFFÉRENTS, À 250 ms : LES DEUX S’ÉCRIVENT');
{
  const avant = await compter();
  await page.fill('#titre', 'Empreinte alpha');
  await page.click('#ajout button[type="submit"]');
  await page.waitForTimeout(ECART_MS);
  await page.fill('#titre', 'Empreinte bêta');
  await page.click('#ajout button[type="submit"]');
  await page.waitForTimeout(2000);
  v('deux tâches de plus en base', (await compter()) - avant, 2);
  const vues = await page.$$eval('[data-tache]', (els) =>
    els.map((e) => e.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
  );
  vrai('la première est là', vues.some((t) => t.includes('Empreinte alpha')));
  vrai('et la seconde aussi', vues.some((t) => t.includes('Empreinte bêta')));
}

console.log('\nLE MÊME TITRE, AU MÊME ÉCART : UNE SEULE S’ÉCRIT');
{
  /*
     Le champ est vidé après un ajout réussi : on le ressaisit, comme le
     ferait un doigt qui rebondit sur un formulaire qui garderait sa valeur.
     Tout est identique au cas précédent, sauf les données.
  */
  const avant = await compter();
  await page.waitForTimeout(800);
  await page.fill('#titre', 'Empreinte gamma');
  await page.click('#ajout button[type="submit"]');
  await page.waitForTimeout(ECART_MS);
  await page.fill('#titre', 'Empreinte gamma');
  await page.click('#ajout button[type="submit"]');
  await page.waitForTimeout(2000);
  v('une seule tâche de plus en base', (await compter()) - avant, 1);
}

console.log('\nET LE MÊME TITRE, UNE SECONDE PLUS TARD : IL S’ÉCRIT');
{
  /*
     Le revers, sans lequel le garde-fou accuserait à tort : on peut vouloir
     deux tâches de même nom. Au-delà du repos, le second appui passe.
  */
  const avant = await compter();
  await page.waitForTimeout(1200);
  await page.fill('#titre', 'Empreinte gamma');
  await page.click('#ajout button[type="submit"]');
  await page.waitForTimeout(2000);
  v('la tâche voulue est écrite', (await compter()) - avant, 1);
}

console.log(echecs ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n` : '\n\x1b[32m✓ tout passe\x1b[0m\n');
await nav.close();
process.exit(echecs ? 1 : 0);
