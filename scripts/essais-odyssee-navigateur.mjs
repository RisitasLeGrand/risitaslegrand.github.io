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
import { liensDeNavigation } from './lib/navigation-essais.mjs';

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

/*
   Un **plancher**, et non la version exacte. Le sujet de cet essai est qu'une
   base en v14 migre sans rien perdre ; le numéro du jour appartient à
   « db.ts », et l'inscrire ici obligerait à retoucher l'essai à chaque schéma
   — une retouche mécanique qui finit par se faire sans réfléchir. Ce qui
   compte est vérifié juste en dessous : les magasins neufs sont là, et les
   anciens aussi.
*/
vrai('la base a migré au moins jusqu’à la v15', apres.version >= 15);
/*
   Un **plancher** ici aussi, et pour la même raison qu'au-dessus.

   La liste était une égalité : chaque nouveau magasin d'Odyssée la faisait
   tomber, sur un essai dont le sujet est la migration depuis la v14 et non
   l'inventaire du jour. Deux magasins ajoutés par le domaine Santé l'ont
   fait tomber sans qu'aucune migration soit cassée — un rouge qui ne dit
   rien finit par être lu comme un rouge qu'on ignore.

   Ce qui est vérifié : **tous** les magasins attendus sont là, et les
   anciens aussi. Ce qui ne l'est plus : qu'il n'y en ait pas d'autres. Un
   magasin surnuméraire ou mal nommé reste attrapé ailleurs — « essais:coffre »
   compte exactement les magasins scellés, et refuse un nom inconnu.
*/
const ATTENDUS = [
    'odysseeBoissons',
    // La psyché, depuis la phase 7 : scellés tous les trois.
    'odysseeCheckins',
    // Finances, depuis sa phase 1 : scellés tous les quatre.
    'odysseeComptes',
    // Qui lit mon budget, depuis la phase 4 de Finances.
    'odysseeConsommateurs',
    'odysseeEvenements',
    'odysseeFocus',
    'odysseeHebdos',
    'odysseeHormonal',
    'odysseeJournal',
    'odysseeLignesBudget',
    'odysseeMedicaments',
    'odysseeMesures',
    'odysseeNuits',
    'odysseeOperations',
    'odysseePassations',
    'odysseePesees',
    // Le pointage par vendeur, depuis la phase 3 bis de Finances.
    'odysseePointages',
    'odysseeQuetes',
    // Le rapprochement, depuis la phase 3 de Finances. Scellé lui aussi.
    'odysseeRapprochements',
    'odysseeReglesPointage',
    'odysseeRepas',
    'odysseeRevues',
    'odysseeSante',
    'odysseeTaches',
    'odysseeTaxonomie',
    'odysseeTrajectoires',
    /*
       La veille, depuis sa phase 1. Le journal d'usage n'est pas scellé, et
       c'est la seule exception d'Odyssée : scellé, il ne s'écrirait que coffre
       ouvert et ne mesurerait qu'un échantillon biaisé.
    */
    'odysseeUsage',
    'odysseeValorisations',
    'odysseeVeilleBases',
    'odysseeVeilleReglages',
    'odysseeVeilleSignaux',
    // « Veille » avant « Vendeurs » : le i passe avant le n.
    'odysseeVendeurs',
];
const presents = apres.magasins.filter((m) => m.startsWith('odyssee')).sort();
const manquants = ATTENDUS.filter((m) => !presents.includes(m));
v(
  `les ${ATTENDUS.length} magasins d’Odyssée attendus existent (${presents.length} présents)`,
  manquants,
  [],
);
{
  const enPlus = presents.filter((m) => !ATTENDUS.includes(m));
  if (enPlus.length) console.log(`    · ${enPlus.length} magasin(s) de plus depuis : ${enPlus.join(', ')}`);
}
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

/* ════════════════════════════════════════════════════════════════════════
   5. Les tâches : trois sorties, et le motif exigé
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE TÂCHE SE FAIT, S’ABANDONNE, OU RESTE OUVERTE');

await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });

await page.fill('#titre', 'Appeler le syndic');
await page.selectOption('#domaine', 'connaissances');
await page.click('#ajouter');
await page.waitForFunction(
  () => document.querySelectorAll('[data-tache]').length === 1,
  undefined,
  { timeout: 15000 },
);
v('la tâche est créée', await page.locator('[data-tache]').count(), 1);
v(
  'et elle est ouverte',
  await page.locator('[data-tache]').first().getAttribute('data-etat'),
  'ouverte',
);

/*
   Le domaine proposé ne contient que les domaines actifs : offrir un domaine
   en pause permettrait de créer une tâche qui ne reparaîtrait jamais — la
   règle posée en O2.
*/
{
  const proposes = await page.$$eval('#domaine option', (els) => els.map((e) => e.value));
  faux('« ordre » n’est pas proposé : il est en pause', proposes.includes('ordre'));
  v('les cinq actifs le sont', proposes.length, 5);
}

/* L'abandon demande un motif, et le refuse sans. */
await page.click('[data-renoncer]');
await page.click('[data-confirmer]');
vrai(
  'renoncer sans motif est refusé, et dit pourquoi',
  ((await page.locator('[data-tache]').first().textContent()) ?? '').includes(
    'fait partie du renoncement',
  ),
);
v(
  'et la tâche est toujours ouverte',
  await page.locator('[data-tache]').first().getAttribute('data-etat'),
  'ouverte',
);

await page.selectOption('[data-motif]', 'trop-ambitieux');
await page.click('[data-confirmer]');
await page.waitForFunction(
  () => document.querySelector('[data-tache]')?.getAttribute('data-etat') === 'abandonnee',
  undefined,
  { timeout: 15000 },
);
v(
  'avec motif, elle est abandonnée',
  await page.locator('[data-tache]').first().getAttribute('data-etat'),
  'abandonnee',
);
vrai(
  'et le motif est affiché',
  ((await page.locator('[data-tache]').first().textContent()) ?? '').includes(
    'le plan était trop chargé',
  ),
);

/* ════════════════════════════════════════════════════════════════════════
   6. Le calendrier et le relevé
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nCE QUI ÉTAIT PRÉVU : ODYSSÉE DEMANDE, ET SAIT POURQUOI');

/*
   Deux moments **passés** sont semés directement : l'écran ne permet pas de
   créer un événement dans le passé par son formulaire — ce serait un usage
   douteux —, et c'est pourtant le seul état où le relevé se pose.

   Leurs heures sont calculées depuis l'instant présent, et non écrites en dur.
   Elles l'étaient — 6 h et 7 h — et l'essai ne passait donc que l'après-midi :
   lancé le matin, les deux moments étaient encore à venir et le relevé, à
   juste titre, ne s'affichait pas. Le défaut était dans l'essai, pas dans
   l'écran, et il a coûté une demi-heure à comprendre.

   Il reste une fenêtre d'une minute, juste après 4 h du matin, où le moment
   semé tomberait la veille : la contrainte est inhérente, puisqu'il faut un
   moment à la fois passé et dans le jour logique courant.
*/
const PASSES = await page.evaluate(
  (jour) =>
    new Promise((ok, ko) => {
      const demande = indexedDB.open('revinsp');
      demande.onerror = () => ko(demande.error);
      demande.onsuccess = () => {
        const base = demande.result;
        const tx = base.transaction('odysseeEvenements', 'readwrite');
        const magasin = tx.objectStore('odysseeEvenements');
        /*
           Les moments sont posés dans le **jour logique**, pas dans le jour
           du calendrier.

           Entre minuit et 4 h, les deux diffèrent : le calendrier affiche
           encore la veille, et des moments datés de « maintenant » tombaient
           dans un jour qu'il ne montrait pas. L'essai échouait alors quatre
           heures par nuit, sur un écran qui faisait exactement ce qu'on lui
           demande — et un essai qui échoue à heure fixe finit par être lu
           comme un essai qu'on ignore.

           Après 4 h, « maintenant moins une minute » est dans le jour
           logique courant et rien ne change. Avant, on recule à 23 h de la
           veille : passé, et dans le jour affiché.
        */
        const finDuSecond = Math.min(Date.now() - 60_000, Date.parse(`${jour}T23:00:00`));
        for (const [id, titre, recul] of [
          ['EV-1', 'Séance de sport', 2],
          ['EV-2', 'Appel famille', 1],
        ]) {
          const fin = new Date(finDuSecond - (recul - 1) * 20 * 60_000);
          const debut = new Date(fin.getTime() - 15 * 60_000);
          magasin.put({
            id,
            titre,
            domaine: 'corps',
            debut: debut.toISOString(),
            fin: fin.toISOString(),
            journeeEntiere: false,
            lieu: '',
            note: '',
            uidIcs: null,
            realise: 'inconnu',
            releveLe: null,
            motif: null,
            motifLibre: '',
            majLe: `${jour}T05:00:00.000Z`,
          });
        }
        tx.oncomplete = () => {
          base.close();
          ok(true);
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
  JOUR,
);
vrai('deux moments passés sont semés', PASSES === true);

await page.goto(`${RACINE}/odyssee/calendrier/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue-calendrier:not(.hidden)', { timeout: 40000 });
await page.click('[data-vue="jour"]');
await page.waitForFunction(
  () => document.querySelectorAll('[data-evenement]').length === 2,
  undefined,
  { timeout: 15000 },
);
v('les deux moments sont à l’agenda du jour', await page.locator('[data-evenement]').count(), 2);
v('et les deux demandent un relevé', await page.locator('[data-releve]').count(), 2);

/* « Fait » s'enregistre d'un clic : il n'a pas de raison à donner. */
await page.click('[data-evenement="EV-1"] [data-reponse="fait"]');
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-evenement="EV-1"] [data-realise]')
      ?.getAttribute('data-realise') === 'fait',
  undefined,
  { timeout: 15000 },
);
v(
  'un moment déclaré fait porte sa réponse',
  await page
    .locator('[data-evenement="EV-1"] [data-realise]')
    .getAttribute('data-realise'),
  'fait',
);

/* « Pas fait » ouvre la question du motif, et la refuse vide. */
await page.click('[data-evenement="EV-2"] [data-reponse="non-fait"]');
await page.click('[data-evenement="EV-2"] button:has-text("Enregistrer")');
vrai(
  'un « pas fait » sans motif est refusé à l’écran',
  ((await page.locator('[data-evenement="EV-2"]').textContent()) ?? '').includes(
    'demande d’en dire la raison',
  ),
);
v(
  'et rien n’est enregistré',
  await page.locator('[data-evenement="EV-2"] [data-realise]').count(),
  0,
);

await page.selectOption('[data-evenement="EV-2"] select', 'imprevu');
await page.fill('[data-evenement="EV-2"] input[type="text"]', 'panne de voiture');
await page.click('[data-evenement="EV-2"] button:has-text("Enregistrer")');
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-evenement="EV-2"] [data-realise]')
      ?.getAttribute('data-realise') === 'non-fait',
  undefined,
  { timeout: 15000 },
);
{
  const texte = (await page.locator('[data-evenement="EV-2"]').textContent()) ?? '';
  vrai('le motif est enregistré et affiché', texte.includes('un imprévu'));
  vrai('et la précision libre aussi', texte.includes('panne de voiture'));
}

/* ════════════════════════════════════════════════════════════════════════
   7. Le suivi, et ce qu'il refuse de conclure
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE TABLEAU DE BORD COMPTE CE QUI A ÉTÉ RELEVÉ');

await page.goto(`${RACINE}/odyssee/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });

{
  const chiffres = (await page.locator('#plan-chiffres').textContent()) ?? '';
  /*
     Deux moments relevés — un fait, un non fait — plus la tâche abandonnée,
     qui compte comme non faite : un sur trois, soit 33 %.
  */
  vrai('le taux est affiché', chiffres.includes('%'));
  vrai('et le détail des réponses aussi', chiffres.includes('1 fait'));
}
{
  const pourquoi = (await page.locator('#plan-pourquoi').textContent()) ?? '';
  vrai('les raisons données sont listées', pourquoi.includes('un imprévu'));
  /*
     Deux motifs, un chacun : sous le seuil et à égalité. Nommer une cause
     dominante là-dessus serait la conclusion que le catalogue d'indicateurs
     interdit ailleurs.
  */
  vrai('mais aucune cause n’est désignée', pourquoi.includes('Trop peu'));
}
v(
  'il ne reste rien à relever',
  await page.locator('#rien-a-relever').isVisible(),
  true,
);

/* ════════════════════════════════════════════════════════════════════════
   8. La branche est ouverte : la barre est devenue un sélecteur
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nODYSSÉE EST OUVERTE');

await page.goto(`${RACINE}/odyssee/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });

{
  /*
     Les onglets viennent du registre de branches, et la mise en page ne
     connaît plus aucun écran : c'est le critère d'extensibilité que la
     phase 8 posait — ajouter une branche ne doit pas demander d'y toucher.
  */
  /*
     LA SURFACE RENDUE, ET NON LE RUBAN SEUL.

     L'essai lisait `#navigation-principale`. Depuis la barre latérale, ce
     ruban est caché à 1280 px avec une souris — le contexte même de cet
     essai — et la latérale porte les mêmes onglets. La question posée ici
     n'a pas changé : la branche courante montre-t-elle SES écrans ?
  */
  const { chemins: onglets, surface } = await liensDeNavigation(page);
  console.log(`      navigation lue : ${surface}`);
  vrai('la barre montre les écrans d’Odyssée', onglets.some((h) => h.includes('/odyssee/taches/')));
  faux('et non ceux de Révisions', onglets.some((h) => h.includes('/flashcards/')));
  vrai('« Mes synthèses » y est, car Odyssée les lit', onglets.some((h) => h.includes('/syntheses/')));
}
vrai(
  'et un lien mène à Révisions',
  (await page.locator('[data-branche="revisions"]').count()) === 1,
);
vrai(
  'et un autre à Sport, ouverte depuis',
  (await page.locator('[data-branche="sport"]').count()) === 1,
);

await page.goto(`${RACINE}/flashcards/`, { waitUntil: 'networkidle' });
await deverrouiller();
{
  const { chemins: onglets } = await liensDeNavigation(page);
  // Et réciproquement : un écran de Révisions montre la barre de Révisions.
  vrai('un écran de Révisions garde sa barre', onglets.some((h) => h.includes('/flashcards/')));
  faux('sans les écrans d’Odyssée', onglets.some((h) => h.includes('/odyssee/taches/')));
}
vrai(
  'et le lien mène à Odyssée',
  (await page.locator('[data-branche="odyssee"]').count()) === 1,
);

/* ════════════════════════════════════════════════════════════════════════
   9. Les quêtes et la revue du soir
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES QUÊTES ET LA REVUE');

await page.goto(`${RACINE}/odyssee/quetes/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });
v('la quête semée est là', await page.locator('[data-quete]').count(), 1);
v('et la frise montre quatorze jours', await page.locator('[data-quete] [data-jour]').count(), 14);
{
  const tenue = await page.locator(`[data-quete] [data-jour="${JOUR}"]`).getAttribute('data-tenue');
  v('le jour tenu plus tôt est coché', tenue, 'true');
}
/* Mettre en pause ne supprime rien : la quête garde son histoire. */
await page.click('[data-quete] [data-action="basculer"]');
await page.waitForFunction(
  () => document.querySelector('[data-quete]')?.getAttribute('data-active') === 'false',
  undefined,
  { timeout: 15000 },
);
v(
  'la quête en pause garde ses jours tenus',
  await page.locator('[data-quete] [data-jour][data-tenue="true"]').count(),
  1,
);

await page.goto(`${RACINE}/odyssee/revue/`, { waitUntil: 'networkidle' });
await deverrouiller();
await page.waitForSelector('#vue:not(.hidden)', { timeout: 40000 });
await page.click('#enregistrer');
vrai(
  'une revue vide est refusée',
  ((await page.locator('#erreur').textContent()) ?? '').includes('Une réponse au moins'),
);
await page.fill('#compte', 'Avancé sur le fascicule 4.');
await page.click('#enregistrer');
await page.waitForFunction(
  () => (document.getElementById('dit')?.textContent ?? '').length > 0,
  undefined,
  { timeout: 15000 },
);
vrai(
  'une revue d’une ligne est enregistrée',
  ((await page.locator('#dit').textContent()) ?? '').includes('enregistrée'),
);
/* E.6 pris au mot : le coût de saisie est affiché. */
vrai(
  'et le temps passé est affiché',
  /\d+ s/.test((await page.locator('#cout').textContent()) ?? ''),
);

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
