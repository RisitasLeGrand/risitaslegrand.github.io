/**
 * Les synthèses, par l'interface réelle.
 *
 * Ce que cet essai couvre, et qu'aucun essai pur ne peut couvrir : que
 * l'assembleur rassemble bien **ce que la base porte vraiment** — les faits
 * publiés, les cartes FSRS avec leur rétention demandée à la bibliothèque,
 * l'état d'activité —, que les indicateurs sans source paraissent dans « ce qui
 * n'a pas pu être mesuré » et non à zéro dans les mesures, et qu'un indicateur
 * neutre n'affiche **aucun** verdict.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
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
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

await franchirInitialisation(page, RACINE, MDP);

/*
   Des séances sur la semaine en cours et la précédente, pour que la
   comparaison ait deux périodes à comparer. Deux heures cette semaine, une la
   semaine dernière : le temps de révision doit être annoncé « en progrès ».
*/
const semees = await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const aujourdhui = new Date();
  const lundi = new Date(
    Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()) -
      ((aujourdhui.getUTCDay() + 6) % 7) * 86_400_000,
  );
  const seances = [];
  const poser = (decalage, secondes, suffixe) => {
    const jour = new Date(lundi.getTime() + decalage * 86_400_000).toISOString().slice(0, 10);
    seances.push({
      id: `01SYNTHESE${suffixe}00000000000000`.slice(0, 26),
      jour,
      statut: 'terminee',
      theme: 'droit-public',
      secondes,
      termineeLe: `${jour}T10:00:00.000Z`,
      fiches: [],
      etendue: false,
    });
  };
  // Cette semaine : deux heures. La précédente : une heure.
  poser(0, 3600, 'A');
  poser(1, 3600, 'B');
  poser(-7, 3600, 'C');

  await new Promise((ok, ko) => {
    const tx = base.transaction('seances', 'readwrite');
    for (const seance of seances) tx.objectStore('seances').put(seance);
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
  return seances.length;
});
v('trois séances sont semées', semees, 3);

console.log('\nLA SYNTHÈSE DE LA SEMAINE');

await page.goto(`${RACINE}/syntheses/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#vue:not(.hidden)', { timeout: 60000 });

{
  const titre = (await page.locator('#titre-periode').textContent()) ?? '';
  vrai('la période est nommée', /^Semaine du \d+ \w+ \d{4}$/.test(titre.trim()));
  const couverture = (await page.locator('#couverture').textContent()) ?? '';
  /*
     LE TOTAL NE SE FIGE PAS. L'essai attendait « sur 15 », juste le jour où
     il a été écrit : le catalogue des indicateurs a grandi depuis, et
     l'essai accusait l'écran d'un total faux. Le catalogue ne fait que
     s'allonger, donc la borne basse garde la propriété — « la couverture
     est annoncée sur le catalogue entier » — sans se périmer au prochain
     indicateur ajouté. Le NOMBRE d'indicateurs se contrôle au catalogue,
     par « essais:indicateurs » (contrôle de module).
  */
  const surCombien = Number(/sur (\d+)/.exec(couverture)?.[1] ?? 0);
  vrai(
    `la couverture est annoncée sur le catalogue entier (sur ${surCombien})`,
    surCombien >= 15,
  );
  vrai('et elle dit pourquoi les autres manquent', couverture.includes('attendent une branche'));
}
{
  const puces = await page.$$eval('#par-domaine span', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  /*
     UN DÉTAIL PAR DOMAINE ACTIF — lu dans la source, et non figé à trois.
     Un quatrième domaine est actif par défaut depuis que la liste a changé ;
     l'essai réclamait trois puces et en trouvait quatre, c'est-à-dire la
     bonne réponse.
  */
  const { readFileSync } = await import('node:fs');
  /*
     La bonne référence est le CATALOGUE DES INDICATEURS, et non la liste des
     domaines actifs : « parDomaine » se construit sur les domaines que les
     indicateurs retenus mentionnent (`odyssee/syntheses.ts`). Ma première
     version comparait aux domaines actifs par défaut — cinq — et réclamait
     donc une puce de plus que l'écran n'en a à montrer.
  */
  const catalogue = readFileSync('src/lib/odyssee/indicateurs.ts', 'utf8');
  const domainesDuCatalogue = new Set(
    [...catalogue.matchAll(/domaine: '([a-z]+)'/g)].map((m) => m[1]),
  );
  if (domainesDuCatalogue.size === 0) {
    console.log(
      '\x1b[31m✗\x1b[0m PANNE — aucun domaine trouvé dans le catalogue des indicateurs : ' +
        'cet essai ne sait plus à combien de puces comparer.',
    );
    process.exit(1);
  }
  v(
    `un détail par domaine du catalogue (${[...domainesDuCatalogue].sort().join(', ')})`,
    puces.length,
    domainesDuCatalogue.size,
  );
  vrai(
    'et chacun dit ses mesurés sur ses déclarés',
    puces.every((p) => /\d+\/\d+ mesurés/.test(p)),
  );
}
{
  const mesures = await page.$$eval('#mesures > div', (els) =>
    els.map((e) => ({
      id: e.dataset.indicateur,
      texte: e.textContent.replace(/\s+/g, ' ').trim(),
    })),
  );
  const ids = mesures.map((m) => m.id);
  vrai('le temps de révision est mesuré', ids.includes('cog.temps-revision'));
  vrai('la régularité aussi', ids.includes('cog.regularite-revision'));
  vrai('la série aussi', ids.includes('tr.serie'));
  vrai('et la couverture de mesure', ids.includes('tr.couverture-mesure'));
  faux('la rétention FSRS n’est pas mesurée, faute de cartes', ids.includes('cog.retention-fsrs'));

  const temps = mesures.find((m) => m.id === 'cog.temps-revision');
  vrai('le temps de révision est affiché en heures', /2\s*h/.test(temps?.texte ?? ''));
  vrai('sa formule est dite', (temps?.texte ?? '').includes('Somme des durées'));
  vrai('sa fiabilité est chiffrée', /Fiabilité \d+ %/.test(temps?.texte ?? ''));
  vrai('et sa source nommée', (temps?.texte ?? '').includes('revision.seance'));
}
{
  const verdicts = await page.$$eval('#mesures [data-verdict]', (els) =>
    els.map((e) => ({
      verdict: e.dataset.verdict,
      bloc: e.closest('[data-indicateur]')?.dataset.indicateur,
      texte: e.textContent.replace(/\s+/g, ' ').trim(),
    })),
  );
  const temps = verdicts.find((x) => x.bloc === 'cog.temps-revision');
  v('le temps de révision est annoncé en progrès', temps?.verdict, 'mieux');
  vrai('et l’écart est dit par rapport à la période précédente', (temps?.texte ?? '').includes('période précédente'));
  faux(
    'aucun indicateur ne porte un verdict « aucun » avec un mot de jugement',
    verdicts.some((x) => x.verdict === 'aucun' && /progrès|recul/.test(x.texte)),
  );
}
{
  const manques = await page.$$eval('#manques > div', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  vrai('les manques sont listés', manques.length >= 6);
  vrai(
    'chacun dit la source qui manque',
    manques.every((m) => m.includes('Pas de donnée')),
  );
  faux(
    'et aucun n’apparaît dans les mesures avec une valeur nulle',
    (
      await page.$$eval('#mesures [data-valeur]', (els) => els.map((e) => e.dataset.valeur))
    ).includes('null'),
  );
}

console.log('\nCHANGER DE PÉRIODE RECALCULE');

await page.click('[data-periode="annee"]');
await page.waitForFunction(
  () => /^Année \d{4}$/.test(document.getElementById('titre-periode')?.textContent?.trim() ?? ''),
  { timeout: 60000 },
);
{
  const titre = (await page.locator('#titre-periode').textContent()) ?? '';
  vrai('l’année est nommée', /^Année \d{4}$/.test(titre.trim()));
  v(
    'et le bouton de l’année est marqué comme actif',
    await page.locator('[data-periode="annee"]').getAttribute('aria-pressed'),
    'true',
  );
  v(
    'celui de la semaine ne l’est plus',
    await page.locator('[data-periode="semaine"]').getAttribute('aria-pressed'),
    'false',
  );
  const mesures = await page.$$eval('#mesures > div', (els) =>
    els.map((e) => e.dataset.indicateur),
  );
  vrai('les mesures de l’année sont là aussi', mesures.includes('cog.temps-revision'));
}

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
