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
import { attendreEnBase } from './lib/post-condition.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const ECART_MS = 250;
/*
   LES DURÉES DE CE FICHIER NE SONT PAS DES PARIS, ET IL FAUT LE DIRE UNE
   FOIS POUR TOUTES, parce qu'un relevé les comptera comme sept attentes
   aveugles alors que quatre sont le SUJET MÊME de l'essai.

   `unSeulGeste` impose un repos de 600 ms après un geste abouti
   (`src/lib/geste.ts:51`). Tout ce que cet essai mesure est le
   comportement du site à l'intérieur et à l'extérieur de cette fenêtre :
   un écart imposé par le site est l'une des attentes légitimes du § 4, et
   l'enlever ne rendrait pas l'essai plus sûr — il le rendrait vide.

   Ce qui n'était PAS légitime : les trois temporisations de 2000 ms qui
   suivaient chaque ajout. Elles n'attendaient pas une règle du site mais
   une écriture en base, et c'est la base que les assertions lisent.

   Les deux sorties de repos étaient écrites 800 et 1200, nombres sans
   justification apparente. Elles valent maintenant le repos plus une
   marge, et le lecteur voit d'où elles viennent.
*/
const REPOS_MS = 600;
const MARGE_MS = 400;
const SORTIR_DU_REPOS_MS = REPOS_MS + MARGE_MS;

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (titre, condition) => v(titre, condition, true);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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
  /* Les deux écritures sont le fait attendu : on les attend en base. */
  await attendreEnBase(page, 'odysseeTaches', (tout) => tout.length >= avant + 2, { delai: 30000 });
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
  /* On sort du repos laissé par le bloc précédent, sinon on mesurerait le sien. */
  await page.waitForTimeout(SORTIR_DU_REPOS_MS);
  await page.fill('#titre', 'Empreinte gamma');
  await page.click('#ajout button[type="submit"]');
  await page.waitForTimeout(ECART_MS);
  await page.fill('#titre', 'Empreinte gamma');
  await page.click('#ajout button[type="submit"]');
  /*
     DEUX TEMPS, PARCE QU'IL Y A DEUX FAITS DE NATURES OPPOSÉES.

     Le premier ajout DOIT s'écrire : on l'attend en base, et c'est une
     post-condition. Le second ne doit PAS s'écrire : aucune
     post-condition ne peut dire cela, puisque rien n'arrive — c'est une
     fenêtre d'observation, la deuxième catégorie du § 4, et sa durée est
     justifiée : au-delà du repos, un second appui PASSERAIT. Si
     l'écriture refusée devait finir par arriver, elle arriverait dans
     cette fenêtre.

     Les 2000 ms d'avant confondaient les deux : elles attendaient le
     premier fait au hasard et le second sans le dire.
  */
  await attendreEnBase(page, 'odysseeTaches', (tout) => tout.length >= avant + 1, { delai: 30000 });
  await page.waitForTimeout(SORTIR_DU_REPOS_MS);
  v('une seule tâche de plus en base', (await compter()) - avant, 1);
}

console.log('\nET LE MÊME TITRE, UNE SECONDE PLUS TARD : IL S’ÉCRIT');
{
  /*
     Le revers, sans lequel le garde-fou accuserait à tort : on peut vouloir
     deux tâches de même nom. Au-delà du repos, le second appui passe.
  */
  const avant = await compter();
  /* Au-delà du repos : c'est toute la condition de ce cas. */
  await page.waitForTimeout(SORTIR_DU_REPOS_MS);
  await page.fill('#titre', 'Empreinte gamma');
  await page.click('#ajout button[type="submit"]');
  await attendreEnBase(page, 'odysseeTaches', (tout) => tout.length >= avant + 1, { delai: 30000 });
  v('la tâche voulue est écrite', (await compter()) - avant, 1);
}

console.log(echecs ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n` : '\n\x1b[32m✓ tout passe\x1b[0m\n');
await nav.close();
process.exit(echecs ? 1 : 0);
