/**
 * La migration v15, sur une base déjà remplie.
 *
 * C'est la seule chose qu'aucun essai pur ne peut couvrir, et c'est celle qui
 * compte : une migration ne tourne jamais sur une base vide chez quelqu'un qui
 * utilise déjà le site. L'essai sème donc une base **en version 14**, à la
 * main, puis laisse le site l'ouvrir et vérifie que rien n'a été perdu en
 * chemin — ni les séances, ni l'identifiant d'appareil, qui départage les
 * horloges et ne doit jamais être régénéré.
 *
 * Les écritures, le journal et la projection de faits ne sont **pas** ici :
 * « astro preview » sert un site construit, où les modules du dépôt ne sont
 * pas adressables, et les exposer sur `window` pour les besoins d'un essai
 * ajouterait au site une porte qui n'existe que pour lui. La projection est
 * devenue pure (`projeterFaitsOdyssee`) et se vérifie dans
 * `essais:odyssee` ; les écritures se vérifieront par les écrans, quand ils
 * existeront.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et
 * lancez « astro preview » avant ce script.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { MAGASINS_V14, schemaV14 } from './lib/base-ancienne.mjs';

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

async function deverrouiller() {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

/* ════════════════════════════════════════════════════════════════════════
   1. La migration v15 sur une base déjà remplie
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA MIGRATION N’OUBLIE RIEN');

await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

/*
   On ouvre d'abord la base **à la version 14**, à la main, et on y sème des
   données. C'est ce qui rend l'essai honnête : migrer une base vide ne prouve
   rien, puisque le bloc v15 est additif et que le risque est ailleurs — qu'une
   migration additive fasse perdre ce qui était là.
*/
const seme = await page.evaluate(
  (source) =>
    new Promise((ok, ko) => {
      const demande = indexedDB.open('revinsp', 14);
      demande.onupgradeneeded = () => {
        // Le schéma **entier** de la v14 : voir « lib/base-ancienne.mjs ».
        new Function('base', `(${source})(base)`)(demande.result);
      };
      demande.onerror = () => ko(demande.error);
      demande.onsuccess = () => {
        const base = demande.result;
        const tx = base.transaction(['etat', 'seances'], 'readwrite');
        tx.objectStore('etat').put('APPAREIL-ESSAI', 'appareil');
        tx.objectStore('seances').put({
          id: 'SEANCE-AVANT-MIGRATION',
          theme: 'economie',
          jour: '2026-10-01',
          statut: 'terminee',
          termineeLe: '2026-10-01T18:00:00.000Z',
          secondes: 1800,
          fiches: [],
        });
        tx.oncomplete = () => {
          const noms = [...base.objectStoreNames];
          base.close();
          ok(noms);
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
  schemaV14.toString(),
);
v('une base complète en version 14 est semée', [...seme].sort(), [...MAGASINS_V14].sort());

await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
await deverrouiller();
await franchirInitialisation(page, RACINE, MDP);

const apres = await page.evaluate(
  () =>
    new Promise((ok, ko) => {
      const demande = indexedDB.open('revinsp');
      demande.onerror = () => ko(demande.error);
      demande.onsuccess = () => {
        const base = demande.result;
        const magasins = [...base.objectStoreNames];
        const tx = base.transaction(['seances', 'etat'], 'readonly');
        const seances = tx.objectStore('seances').getAll();
        const appareil = tx.objectStore('etat').get('appareil');
        tx.oncomplete = () => {
          const resultat = {
            version: base.version,
            magasins,
            seances: seances.result.map((s) => s.id),
            appareil: appareil.result,
          };
          base.close();
          ok(resultat);
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
);

v('la base est passée en version 15', apres.version, 15);
v(
  'les cinq magasins d’Odyssée existent',
  apres.magasins.filter((m) => m.startsWith('odyssee')).sort(),
  ['odysseeEvenements', 'odysseeFocus', 'odysseeQuetes', 'odysseeRevues', 'odysseeTaches'],
);
/*
   Et aucun des anciens n'a disparu. C'est ce que « additive » veut dire, et
   c'est la seule formulation qui attrape une migration qui recréerait le
   schéma au lieu de l'étendre.
*/
v(
  'et les dix-neuf magasins d’avant sont tous là',
  MAGASINS_V14.filter((m) => !apres.magasins.includes(m)),
  [],
);
v('la séance d’avant la migration est toujours là', apres.seances, ['SEANCE-AVANT-MIGRATION']);
/*
   L'identifiant d'appareil est la chose qu'une migration ne doit jamais
   régénérer : il départage deux horloges égales, et le perdre ferait de cette
   machine un appareil inconnu pour tous les autres.
*/
v('et l’identifiant d’appareil n’a pas bougé', apres.appareil, 'APPAREIL-ESSAI');

/* ════════════════════════════════════════════════════════════════════════
   2. Le tableau de bord, sur une base qui ne sait rien
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN TABLEAU DE BORD VIDE LE DIT, ET N’ACCUSE PAS');

await page.goto(`${RACINE}/odyssee/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });

vrai('le bandeau du vide est affiché', await page.locator('#bandeau-vide').isVisible());
{
  const texte = (await page.locator('#bandeau-vide').textContent()) ?? '';
  /*
     La phrase doit dire que c'est une **absence**, et pas un déséquilibre.
     C'est l'exigence tirée du catalogue d'indicateurs, et elle se vérifie sur
     les mots, parce que c'est par les mots qu'elle se perd.
  */
  vrai('et il parle d’absence de données', texte.includes('absence de données'));
  vrai('en niant explicitement le déséquilibre', texte.includes('n’est pas un déséquilibre'));
}
{
  const etats = await page.$$eval('#roue [data-domaine]', (els) =>
    els.map((e) => e.getAttribute('data-etat')),
  );
  v('les cinq domaines actifs sont peints', etats.length, 5);
  v('et tous « sans donnée »', [...new Set(etats)], ['sans-donnee']);
  const textes = await page.$$eval('#roue [data-domaine]', (els) =>
    els.map((e) => e.textContent ?? ''),
  );
  // Jamais « 0 % » : un zéro permanent est un reproche permanent.
  v('aucune carte n’affiche un pourcentage', textes.filter((t) => t.includes('%')).length, 0);
  vrai('toutes disent « pas de donnée »', textes.every((t) => t.includes('Pas de donnée')));
}
vrai('les domaines en pause ne sont pas peints', (await page.locator('#roue [data-domaine="ordre"]').count()) === 0);

/* ════════════════════════════════════════════════════════════════════════
   3. Une quête : le plancher, la suggestion, et sa règle
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nCHAQUE SUGGESTION PORTE SA RÈGLE');

/*
   La quête est semée **directement en base**, et non par un écran : l'écran
   des quêtes est en O5, et attendre qu'il existe pour vérifier le tableau de
   bord reviendrait à ne vérifier ni l'un ni l'autre. Le format est celui que
   « modele.ts » déclare, et un écart de forme ferait échouer l'essai — ce qui
   est exactement ce qu'on veut d'une fixture.
*/
const JOUR = await page.evaluate(() => {
  const d = new Date();
  // Le jour logique bascule à 4 h : avant, on est encore la veille.
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
});

await page.evaluate(
  (jour) =>
    new Promise((ok, ko) => {
      const demande = indexedDB.open('revinsp');
      demande.onerror = () => ko(demande.error);
      demande.onsuccess = () => {
        const base = demande.result;
        const tx = base.transaction('odysseeQuetes', 'readwrite');
        tx.objectStore('odysseeQuetes').put({
          id: 'QUETE-ESSAI',
          titre: 'Marcher trente minutes',
          domaine: 'corps',
          cadence: 'jour',
          active: true,
          tenues: [],
          creeeLe: `${jour}T08:00:00.000Z`,
          majLe: `${jour}T08:00:00.000Z`,
        });
        tx.oncomplete = () => {
          base.close();
          ok(true);
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
  JOUR,
);

await page.reload({ waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });

v(
  'la quête non tenue est suggérée',
  await page.locator('#suggestions [data-regle="quete-du-jour"]').count(),
  1,
);
{
  const texte =
    (await page.locator('#suggestions [data-regle="quete-du-jour"]').textContent()) ?? '';
  vrai('la suggestion nomme la quête', texte.includes('Marcher trente minutes'));
  vrai('et dit ce qui l’a déclenchée', texte.includes('pas encore tenue'));
  /*
     L'intitulé de la règle, et non sa raison : la raison explique au
     développeur pourquoi la règle existe, l'intitulé dit à la personne ce que
     la règle cherche. Les confondre afficherait un commentaire de code.
  */
  vrai(
    'et affiche l’intitulé de la règle',
    texte.includes('Une quête du jour n’est pas encore tenue'),
  );
}
v('le plancher compte une quête', await page.locator('#plancher [data-quete]').count(), 1);
v('dont aucune tenue', (await page.locator('#plancher-compte').textContent())?.trim(), '0 sur 1.');

/* La tenir depuis la suggestion : c'est le geste que l'écran existe pour offrir. */
await page.click('#suggestions [data-tenir="QUETE-ESSAI"]');
await page.waitForFunction(
  () => (document.getElementById('plancher-compte')?.textContent ?? '').includes('atteint'),
  undefined,
  { timeout: 15000 },
);
v(
  'tenue, le plancher est atteint',
  (await page.locator('#plancher-compte').textContent())?.trim(),
  '1 sur 1 — atteint.',
);
v(
  'et la suggestion a disparu',
  await page.locator('#suggestions [data-regle="quete-du-jour"]').count(),
  0,
);

/*
   Et la roue cesse d'être vide : une quête tenue est un fait, mais **sans
   durée** — elle ne doit donc pas peser dans la roue, qui ne compte que des
   secondes. Le bandeau du vide reste affiché, et c'est voulu.
*/
vrai(
  'une quête tenue ne remplit pas la roue : elle n’a pas de durée',
  await page.locator('#bandeau-vide').isVisible(),
);

/* ════════════════════════════════════════════════════════════════════════
   4. Le focus enregistre ce qui a eu lieu
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE FOCUS COMPTE LE TEMPS RÉEL');

await page.selectOption('#focus-domaine', 'cognition');
await page.click('#focus-demarrer');
vrai('le compteur apparaît', await page.locator('#focus-compteur').isVisible());
await page.waitForTimeout(2200);
await page.click('#focus-arreter');
await page.waitForFunction(
  () => (document.getElementById('focus-dit')?.textContent ?? '').length > 0,
  undefined,
  { timeout: 15000 },
);

const sessions = await page.evaluate(
  () =>
    new Promise((ok, ko) => {
      const demande = indexedDB.open('revinsp');
      demande.onerror = () => ko(demande.error);
      demande.onsuccess = () => {
        const base = demande.result;
        const tx = base.transaction('odysseeFocus', 'readonly');
        tx.objectStore('odysseeFocus').getAll().onsuccess = (e) => {
          const r = e.target.result.map((f) => ({
            domaine: f.domaine,
            secondes: f.secondes,
            interrompue: f.interrompue,
          }));
          base.close();
          ok(r);
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
);
v('une session est enregistrée', sessions.length, 1);
v('dans le domaine choisi', sessions[0].domaine, 'cognition');
/*
   Deux secondes, pas les vingt-cinq minutes visées. Compter la durée visée
   gonflerait le temps de concentration exactement les jours où l'on s'est le
   moins concentré.
*/
vrai('et elle vaut le temps réellement passé', sessions[0].secondes >= 2 && sessions[0].secondes <= 6);
vrai('arrêtée avant son terme, elle est marquée interrompue', sessions[0].interrompue === true);

/* La roue, elle, s'est remplie : un focus porte une durée. */
await page.reload({ waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });
faux('la roue n’est plus vide', await page.locator('#bandeau-vide').isVisible());
v(
  'et c’est Cognition qui porte la mesure',
  await page.locator('#roue [data-domaine="cognition"]').getAttribute('data-etat'),
  'mesure',
);

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
