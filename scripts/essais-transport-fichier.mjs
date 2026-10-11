/**
 * Le transport manuel, bout en bout, entre deux bases réellement distinctes.
 *
 * Deux contextes de navigateur, donc deux IndexedDB : c'est la seule façon
 * d'éprouver ce que le simulateur ne peut pas — que l'écran fabrique un vrai
 * fichier, qu'il soit déchiffrable par l'autre appareil, que la fusion écrive
 * dans la base, et que l'état FSRS soit **recalculé** chez celui qui reçoit des
 * révisions pour des cartes qu'il ne connaissait pas.
 *
 * Le fichier passe par le disque, comme il le fera en vrai : téléchargement
 * d'un côté, sélection de fichier de l'autre. Un essai qui se contenterait de
 * passer les octets de main à main ne prouverait rien du téléchargement.
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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 400)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 400)}`);
  }
};
const vrai = (titre, condition) => v(titre, condition, true);

/** Un appareil : son contexte, sa page, sa base. */
async function appareil(nom) {
  const contexte = await nav.newContext({ acceptDownloads: true });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.log(`PAGEERROR[${nom}]:`, e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') {
      console.log(`CONSOLE[${nom}] ${m.type()}:`, m.text().slice(0, 250));
    }
  });
  await page.goto(`${RACINE}/appareils/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });
  return { nom, contexte, page };
}

/**
 * Sème des révisions dans la base d'un appareil, par le chemin de la base.
 *
 * Passer par l'écran de flashcards serait plus fidèle, mais rendrait l'essai
 * dépendant du tirage des cartes et donc instable. Ce qu'on éprouve ici est le
 * transport et la fusion, pas l'écran de révision — qui a ses propres essais.
 */
async function semer(appareil, cartes, depart) {
  return appareil.page.evaluate(
    async ([cartes, depart]) => {
      const base = await new Promise((ok, ko) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
      const appareilId = await new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get('appareil');
        q.onsuccess = () => ok(q.result);
      });

      const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
      const encoderTemps = (ms) => {
        let reste = Math.floor(ms);
        let sortie = '';
        for (let i = 0; i < 10; i += 1) {
          sortie = ALPHABET[reste % 32] + sortie;
          reste = Math.floor(reste / 32);
        }
        return sortie;
      };
      let rang = 0;
      const ulid = (ms) =>
        encoderTemps(ms) +
        `${appareilId.slice(0, 8)}${String(rang++).padStart(8, '0')}`
          .toUpperCase()
          .replace(/[ILOU]/g, 'X')
          .slice(0, 16);
      const hlc = (ms, n) =>
        `${String(ms).padStart(15, '0')}-${n.toString(36).toUpperCase().padStart(4, '0')}`;

      const entrees = [];
      const etats = [];
      let instant = depart;
      let compteur = 0;
      for (const carte of cartes) {
        // Un socle, pour que la carte existe dans le journal, puis des
        // notations : exactement ce qu'une migration puis des révisions
        // produisent.
        instant += 3600_000;
        entrees.push({
          id: ulid(instant),
          genre: 'socle',
          carteId: carte,
          ficheId: `fiche-${carte}`,
          matiere: 'Économie',
          le: new Date(instant).toISOString(),
          appareil: appareilId,
          hlc: hlc(instant, compteur++),
          lot: '',
          etat: {
            due: new Date(instant).toISOString().slice(0, 10),
            stability: 1,
            difficulty: 5,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
          },
          revisions: 0,
          oublis: 0,
        });
        for (const note of ['correct', 'facile', 'difficile']) {
          instant += 86_400_000;
          entrees.push({
            id: ulid(instant),
            genre: 'notation',
            carteId: carte,
            ficheId: `fiche-${carte}`,
            matiere: 'Économie',
            le: new Date(instant).toISOString(),
            appareil: appareilId,
            hlc: hlc(instant, compteur++),
            lot: '',
            note,
          });
        }
        etats.push(carte);
      }

      // Et une opération ordinaire, pour que le journal des opérations ne soit
      // pas vide : la fusion doit traiter les deux.
      instant += 1000;
      const operation = {
        id: ulid(instant),
        appareil: appareilId,
        hlc: hlc(instant, compteur++),
        type: 'checkin',
        cible: `jour-${appareilId}`,
        lot: '',
        charge: { valeur: 3 },
      };

      await new Promise((ok, ko) => {
        const tx = base.transaction(['revisions', 'operations'], 'readwrite');
        for (const e of entrees) tx.objectStore('revisions').put(e);
        tx.objectStore('operations').put(operation);
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
      return { revisions: entrees.length, operations: 1, appareil: appareilId };
    },
    [cartes, depart],
  );
}

const lire = (appareil) =>
  appareil.page.evaluate(async () => {
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const tout = (nom) =>
      new Promise((ok) => {
        const q = base.transaction(nom).objectStore(nom).getAll();
        q.onsuccess = () => ok(q.result);
      });
    const sortie = {
      operations: (await tout('operations')).length,
      revisions: (await tout('revisions')).length,
      cartes: (await tout('cartes')).map((c) => ({
        id: c.id,
        du: c.du,
        revisions: c.revisions,
        stability: Number(c.fsrs.stability.toFixed(6)),
      })).sort((a, b) => a.id.localeCompare(b.id)),
    };
    base.close();
    return sortie;
  });

/** Recharge la page pour que l'écran reflète la base. */
async function rafraichir(appareil) {
  await appareil.page.reload({ waitUntil: 'networkidle' });
  if (await appareil.page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await appareil.page.fill('#champ-mdp', MDP);
    await appareil.page.click('#bouton-verrou');
  }
  await appareil.page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });
}

/**
 * L'empreinte de cet appareil, lue dans sa ligne du registre.
 *
 * Le registre affiche toutes les empreintes côte à côte — c'est l'exigence de
 * la maquette —, donc il n'y a plus de champ unique à lire. On prend celle de
 * la ligne marquée « celui-ci ».
 */
const empreinteAffichee = (appareil) =>
  appareil.page.evaluate(() => {
    const lignes = [...document.querySelectorAll('#appareils > li')];
    const moi = lignes.find((l) => l.textContent.includes('celui-ci')) ?? lignes[0];
    const groupes = [...moi.querySelectorAll('.font-mono')];
    // Deux éléments en police fixe par ligne : l'empreinte puis l'identifiant.
    return groupes[0]?.textContent?.trim() ?? '';
  });

/** Crée le paquet par l'écran et rend le chemin du fichier téléchargé. */
async function envoyer(appareil) {
  await appareil.page.fill('#mdp-envoi', MDP);
  const attente = appareil.page.waitForEvent('download', { timeout: 60000 });
  await appareil.page.click('#envoyer');
  const telechargement = await attente;
  await appareil.page.waitForSelector('#message-envoi:not(.hidden)', { timeout: 30000 });
  return {
    chemin: await telechargement.path(),
    nom: telechargement.suggestedFilename(),
    message: await appareil.page.textContent('#message-envoi'),
  };
}

/** Charge un paquet par l'écran, l'aperçoit, puis fusionne. */
async function recevoir(appareil, chemin) {
  await appareil.page.setInputFiles('#fichier', chemin);
  await appareil.page.waitForSelector('#apercu:not(.hidden)', { timeout: 30000 });
  const apercu = await appareil.page.textContent('#apercu-detail');
  await appareil.page.fill('#mdp-fusion', MDP);
  await appareil.page.click('#fusionner');
  await appareil.page.waitForSelector('#message-fusion:not(.hidden)', { timeout: 60000 });
  // Le message « Fusion en cours… » est neutre ; on attend le définitif.
  await appareil.page.waitForFunction(
    () => !document.getElementById('message-fusion').textContent.includes('en cours'),
    undefined,
    { timeout: 60000 },
  );
  return {
    apercu,
    message: await appareil.page.textContent('#message-fusion'),
    // Le diagnostic de la fusion, affiché même quand il est favorable.
    diagnostic: await appareil.page.textContent('#apercu-avertissement'),
  };
}

/**
 * Charge un paquet et tente de fusionner, en **attendant un refus**.
 *
 * Séparé de « recevoir » exprès : une fonction qui accepte les deux issues
 * passerait si le refus n'arrivait pas, ce qui est précisément ce qu'on éprouve.
 */
async function tenterEtEtreRefuse(appareil, chemin) {
  await appareil.page.setInputFiles('#fichier', chemin);
  await appareil.page.waitForSelector('#apercu:not(.hidden)', { timeout: 30000 });
  await appareil.page.fill('#mdp-fusion', MDP);
  await appareil.page.click('#fusionner');
  await appareil.page.waitForFunction(
    () => {
      const e = document.getElementById('message-fusion');
      return e && !e.classList.contains('hidden') && !e.textContent.includes('en cours');
    },
    undefined,
    { timeout: 60000 },
  );
  return {
    message: await appareil.page.textContent('#message-fusion'),
    visible: !(await appareil.page.locator('#marche-a-suivre').isHidden()),
    motif: await appareil.page.textContent('#marche-motif'),
    etapes: await appareil.page.$$eval('#marche-etapes > li', (l) =>
      l.map((e) => e.textContent.trim()),
    ),
  };
}

/** L'horloge logique persistée de cet appareil, telle qu'elle est en base. */
const horlogeDe = (appareil) =>
  appareil.page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const lu = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get('horloge');
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return lu ?? null;
  });

console.log('\nDEUX APPAREILS, DEUX BASES');

const a = await appareil('A');
const b = await appareil('B');

const avantA = await lire(a);
const avantB = await lire(b);
v('la base de A est neuve', [avantA.operations, avantA.revisions], [0, 0]);
v('celle de B aussi', [avantB.operations, avantB.revisions], [0, 0]);
/* Les identifiants sont lus dans le registre, qui les affiche : « #appareil »
   n'existe plus depuis que la section nomme tous les appareils. */
v(
  'et leurs identifiants d’appareil diffèrent',
  (await a.page.textContent('#appareils')) !== (await b.page.textContent('#appareils')),
  true,
);

console.log('\nCHACUN RÉVISE DE SON CÔTÉ');

const semisA = await semer(a, ['carte-alpha', 'carte-beta'], Date.parse('2026-05-01T08:00:00Z'));
const semisB = await semer(b, ['carte-gamma'], Date.parse('2026-06-01T08:00:00Z'));
await rafraichir(a);
await rafraichir(b);

/* Le semis n'a écrit que le journal. En usage réel, noter une carte écrit les
   deux — le journal et l'état. On passe donc par « Reconstruire depuis le
   journal », qui est le chemin que l'application offre pour cela, plutôt que
   d'écrire les cartes à la main dans l'essai. */
for (const app of [a, b]) {
  await app.page.click('#reconstruire');
  await app.page.waitForSelector('#message-reconstruction:not(.hidden)', { timeout: 30000 });
  await app.page.waitForFunction(
    () => !document.getElementById('message-reconstruction').textContent.includes('en cours'),
    undefined,
    { timeout: 30000 },
  );
}
v('A a huit entrées de révision', semisA.revisions, 8);
v('et deux cartes reconstruites', (await lire(a)).cartes.length, 2);
v('B en a une', (await lire(b)).cartes.length, 1);
v('B en a quatre', semisB.revisions, 4);
vrai('les empreintes diffèrent', (await empreinteAffichee(a)) !== (await empreinteAffichee(b)));

console.log('\nNOMMER LES APPAREILS : LE NOM EST UN FAIT, IL VOYAGE');

for (const [app, nom] of [[a, 'Ordinateur de bureau'], [b, 'Téléphone']]) {
  await app.page.fill('#nom-appareil', nom);
  await app.page.click('#nommer');
  await app.page.waitForSelector('#message-nom:not(.hidden)', { timeout: 30000 });
}
vrai(
  'chaque appareil s’affiche sous son nom, et se reconnaît',
  (await a.page.textContent('#appareils')).includes('Ordinateur de bureau') &&
    (await a.page.textContent('#appareils')).includes('celui-ci'),
);
v(
  'et il ne connaît encore que lui-même',
  (await a.page.$$('#appareils > li')).length,
  1,
);

console.log('\nUN RÉGLAGE ÉCRIT ICI DOIT ARRIVER LÀ-BAS');

/*
   Le réglage est modifié **par l'écran**, et c'est le point de l'essai : écrire
   le registre versionné à la main aurait vérifié la fusion sans vérifier que
   l'application l'alimente. Or c'est exactement là que le branchement peut
   manquer — le code compile et les essais passent, et les réglages ne voyagent
   pas.
*/
await a.page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
if (await a.page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await a.page.fill('#champ-mdp', MDP);
  await a.page.click('#bouton-verrou');
}
await a.page.waitForSelector('#plafond-cartes', { timeout: 30000 });
await a.page.fill('#plafond-cartes', '45');
await a.page.dispatchEvent('#plafond-cartes', 'change');
await a.page.waitForFunction(
  () => (document.getElementById('message-reglages')?.textContent ?? '').includes('45'),
  undefined,
  { timeout: 30000 },
);

const registreA = await a.page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const lu = await new Promise((ok) => {
    const q = base.transaction('etat').objectStore('etat').get('reglagesSync');
    q.onsuccess = () => ok(q.result);
  });
  base.close();
  return lu;
});
v(
  'l’écran de réglages a bien alimenté le registre versionné',
  registreA?.reglagesSession?.valeur?.plafondCartes,
  45,
);
vrai(
  'et le registre porte une horloge et un appareil',
  Boolean(registreA?.reglagesSession?.hlc) && Boolean(registreA?.reglagesSession?.appareil),
);
await a.page.goto(`${RACINE}/appareils/`, { waitUntil: 'networkidle' });
await a.page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });

console.log('\nA ENVOIE, B REÇOIT');

const paquetA = await envoyer(a);
vrai('le fichier porte l’extension attendue', paquetA.nom.endsWith('.paquet'));
vrai(
  'le message annonce ce qui est parti',
  paquetA.message.includes('opération') && paquetA.message.includes('8 révision'),
);

const receptionB = await recevoir(b, paquetA.chemin);
vrai('l’aperçu nomme l’appareil émetteur', receptionB.apercu.includes('Ordinateur de bureau'));
vrai('l’aperçu annonce le fichier intact', receptionB.apercu.includes('intact'));
vrai('la fusion annonce ce qu’elle a reçu', receptionB.message.includes('reçues'));
/*
   Ces deux appareils n'ont aucun ancêtre commun — ils ne se sont jamais parlé —
   et leur fusion est pourtant sans danger : leurs faits portent sur des cartes
   différentes. C'est le cas que la décision 4, prise à la lettre, aurait
   interdit. Le diagnostic est affiché **même favorable** : on doit pouvoir lire
   pourquoi c'était sûr.
*/
vrai(
  'le diagnostic dit qu’ils ne s’étaient jamais parlé, et que rien n’est perdu',
  receptionB.diagnostic.includes('jamais parlé') &&
    receptionB.diagnostic.includes('aucune histoire'),
);
vrai('et les cartes recalculées', receptionB.message.includes('recalculée'));

const apresB = await lire(b);
v('B porte maintenant les douze révisions', apresB.revisions, 12);
/* Quatre opérations : deux check-in — un par appareil — et deux déclarations
   de nom, car nommer un appareil est un fait qui voyage. */
v('et les quatre opérations', apresB.operations, 4);
v(
  'les trois cartes existent chez B, dont deux qu’il ne connaissait pas',
  apresB.cartes.map((c) => c.id),
  ['carte-alpha', 'carte-beta', 'carte-gamma'],
);
vrai(
  'leur état FSRS a été recalculé, pas copié',
  apresB.cartes.every((c) => c.revisions === 3 && c.stability > 0),
);

const reglageChezB = await b.page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const lu = await new Promise((ok) => {
    const q = base.transaction('etat').objectStore('etat').get('reglagesSession');
    q.onsuccess = () => ok(q.result);
  });
  base.close();
  return lu;
});
v('le réglage écrit chez A est arrivé chez B', reglageChezB?.plafondCartes, 45);
vrai('et la fusion l’a annoncé', receptionB.message.includes('réglage'));

console.log('\nLE REGISTRE D’APPAREILS');

await rafraichir(b);
const registreB = await b.page.textContent('#appareils');
vrai('B connaît maintenant deux appareils', (await b.page.$$('#appareils > li')).length === 2);
vrai('et il appelle A par le nom que A s’est donné', registreB.includes('Ordinateur de bureau'));
vrai('il affiche l’empreinte annoncée par A', registreB.includes('·'));
vrai('et quand il l’a vu', registreB.includes('vu le'));

console.log('\nB ENVOIE À SON TOUR');

const paquetB = await envoyer(b);
const receptionA = await recevoir(a, paquetB.chemin);
vrai('A reçoit ce qui lui manquait', receptionA.message.includes('reçues'));
vrai('et les deux appareils se disent identiques', receptionA.message.includes('identiques'));
vrai(
  'et cette fois le diagnostic constate une histoire commune',
  receptionA.diagnostic.includes('commun'),
);

await rafraichir(a);
await rafraichir(b);
const finalA = await lire(a);
const finalB = await lire(b);

v('les empreintes affichées sont identiques', await empreinteAffichee(a), await empreinteAffichee(b));
v('les journaux aussi', [finalA.operations, finalA.revisions], [finalB.operations, finalB.revisions]);
v(
  'et l’état FSRS recalculé des deux côtés est le même, au chiffre près',
  finalA.cartes,
  finalB.cartes,
);

console.log('\nCONFLIT SUR UN CHAMP SENSIBLE, ET SA RÉSOLUTION');

/* Deux poids différents pour le même jour, saisis sur deux appareils. C'est le
   cas que la maquette décrit mot pour mot. */
const poser = (appareil, kg, ms) =>
  appareil.page.evaluate(
    async ([kg, ms]) => {
      const base = await new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
      });
      const appareilId = await new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get('appareil');
        q.onsuccess = () => ok(q.result);
      });
      const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
      let reste = ms;
      let temps = '';
      for (let i = 0; i < 10; i += 1) {
        temps = A[reste % 32] + temps;
        reste = Math.floor(reste / 32);
      }
      await new Promise((ok, ko) => {
        const tx = base.transaction('operations', 'readwrite');
        tx.objectStore('operations').put({
          id: `${temps}POIDS${appareilId.slice(0, 8)}XXX`.slice(0, 26).padEnd(26, 'X'),
          appareil: appareilId,
          hlc: `${String(ms).padStart(15, '0')}-0000`,
          type: 'odyssee.poids',
          cible: 'poids:2026-10-09',
          lot: '',
          charge: { kg },
        });
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
      return appareilId;
    },
    [kg, ms],
  );

await poser(a, 74.2, Date.parse('2026-10-09T07:12:00Z'));
await poser(b, 73.8, Date.parse('2026-10-09T07:40:00Z'));
await rafraichir(a);
v('aucun conflit tant que les journaux ne se sont pas rencontrés', (await a.page.$$('#liste-conflits > li')).length, 0);

const paquetPoidsB = await envoyer(b);
const receptionPoids = await recevoir(a, paquetPoidsB.chemin);
vrai('la fusion annonce le conflit', receptionPoids.message.includes('conflit'));
await rafraichir(a);
v('A montre un conflit', (await a.page.$$('#liste-conflits > li')).length, 1);
const texteConflit = await a.page.textContent('#liste-conflits');
vrai('les deux valeurs sont affichées', texteConflit.includes('74.2') && texteConflit.includes('73.8'));
vrai('avec l’appareil qui les a saisies', texteConflit.includes('Téléphone'));

/* Ignorer sans motif ne doit rien enregistrer : une réponse sans explication ne
   se relit pas six mois plus tard. */
a.page.once('dialog', (d) => d.dismiss());
await a.page.click('button[data-issue="ignore"]');
await a.page.waitForTimeout(500);
v('une invite annulée ne tranche rien', (await a.page.$$('#liste-conflits > li')).length, 1);

/* On garde la valeur de l'ordinateur. */
const boutons = await a.page.$$('button[data-issue="retenue"]');
v('un bouton « garder » par valeur', boutons.length, 2);
await boutons[0].click();
await a.page.waitForSelector('#message-conflit:not(.hidden)', { timeout: 30000 });
vrai(
  'la réponse est enregistrée et annoncée comme voyageant',
  (await a.page.textContent('#message-conflit')).includes('voyagera'),
);
v('et le conflit disparaît', (await a.page.$$('#liste-conflits > li')).length, 0);

/* Et la résolution voyage : B doit le trouver tranché. */
const paquetResolution = await envoyer(a);
await recevoir(b, paquetResolution.chemin);
await rafraichir(b);
v('B reçoit la résolution et ne montre aucun conflit', (await b.page.$$('#liste-conflits > li')).length, 0);
vrai(
  'alors qu’il porte bien les deux valeurs : rien n’a été écrasé',
  await b.page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const tout = await new Promise((ok) => {
      const q = base.transaction('operations').objectStore('operations').getAll();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    const poids = tout.filter((o) => o.type === 'odyssee.poids');
    return poids.length === 2 && poids.some((o) => o.charge.kg === 74.2) &&
      poids.some((o) => o.charge.kg === 73.8);
  }),
);

console.log('\nLE REGISTRE DE SAUVEGARDES EST PARTAGÉ');

/* Une sauvegarde faite sur B doit apparaître dans la liste de A : sans cela,
   chaque appareil insiste séparément. */
await b.page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
if (await b.page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await b.page.fill('#champ-mdp', MDP);
  await b.page.click('#bouton-verrou');
}
await b.page.waitForSelector('#sauvegarder', { timeout: 30000 });
{
  const attente = b.page.waitForEvent('download', { timeout: 90000 });
  await b.page.fill('#mdp-sauvegarde', MDP);
  await b.page.click('#sauvegarder');
  await attente;
  /*
     Attendre le téléchargement ne suffit **pas**. Le fichier part dès que le
     chiffrement est fini, et la déclaration au registre vient après : naviguer
     sur la foi du seul téléchargement tue la page en cours d'opération, et la
     sauvegarde n'est jamais déclarée. C'est le message de fin qui dit que tout
     est écrit — le même signal qu'un utilisateur attend avant de quitter
     l'écran.
  */
  await b.page.waitForFunction(
    () => {
      const texte = document.getElementById('message-sauvegarde')?.textContent ?? '';
      return texte.length > 0 && !texte.includes('en cours');
    },
    undefined,
    { timeout: 60000 },
  );
}
await b.page.goto(`${RACINE}/appareils/`, { waitUntil: 'networkidle' });
await b.page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });
vrai(
  'B voit sa propre sauvegarde dans le registre',
  (await b.page.textContent('#sauvegardes')).includes('depuis'),
);

const paquetB2 = await envoyer(b);
await recevoir(a, paquetB2.chemin);
await rafraichir(a);
vrai(
  'et A la voit aussi, attribuée au téléphone',
  (await a.page.textContent('#sauvegardes')).includes('Téléphone'),
);

console.log('\nREJEU : LE MÊME FICHIER UNE SECONDE FOIS');

/* L'état de référence est relu **juste avant** le rejeu, et non figé plus haut :
   A a reçu entre-temps un second paquet, celui qui portait la sauvegarde
   déclarée. Comparer à un état antérieur ferait échouer l'essai pour une
   raison étrangère à ce qu'il vérifie. */
const avantRejeu = await lire(a);
const lotsAvantRejeu = (await a.page.$$('.annuler')).length;
const rejeu = await recevoir(a, paquetB.chemin);
vrai('la fusion n’apporte rien', rejeu.message.includes('0 opération'));
await rafraichir(a);
const apresRejeu = await lire(a);
v(
  'et rien n’a bougé',
  [apresRejeu.operations, apresRejeu.revisions],
  [avantRejeu.operations, avantRejeu.revisions],
);

console.log('\nANNULATION');

const lots = await a.page.$$('.annuler');
vrai('les synchronisations reçues sont listées, avec un bouton d’annulation', lots.length >= 1);
/*
   La propriété vérifiée est « le rejeu n'ajoute pas de lot », et non « il y a
   exactement N lots ». Le décompte absolu changeait à chaque étape ajoutée à
   cet essai, et le faire échouer pour cette raison-là n'apprenait rien : trois
   fois de suite, j'ai corrigé un nombre au lieu de vérifier la propriété.
*/
v('et le rejeu, qui n’a rien apporté, n’a pas laissé de ligne', lots.length, lotsAvantRejeu);

a.page.once('dialog', (d) => d.accept());
await lots[0].click();
await a.page.waitForSelector('#message-annulation:not(.hidden)', { timeout: 60000 });
const messageAnnulation = await a.page.textContent('#message-annulation');
vrai('l’annulation dit ce qu’elle a retiré', messageAnnulation.includes('retirées'));

/* L'état vide est nommé, et il reste visible : c'est ce qui permet au message
   d'annulation de rester lisible après avoir annulé la dernière
   synchronisation. */
v(
  'un lot de moins après la première annulation',
  (await a.page.$$('.annuler')).length,
  lots.length - 1,
);

const apresAnnulation = await lire(a);
vrai(
  'le journal de A a bien diminué',
  apresAnnulation.revisions < avantRejeu.revisions ||
    apresAnnulation.operations < avantRejeu.operations,
);

/* On annule le reste, pour éprouver l'état vide — celui qui doit rester
   visible, sans quoi le message de confirmation disparaît avec la section. */
let restants = (await a.page.$$('.annuler')).length;
let garde = 0;
while (restants > 0 && garde < 10) {
  a.page.once('dialog', (d) => d.accept());
  await (await a.page.$$('.annuler'))[0].click();
  await a.page.waitForFunction(
    (combien) => document.querySelectorAll('.annuler').length < combien,
    restants,
    { timeout: 60000 },
  );
  restants = (await a.page.$$('.annuler')).length;
  garde += 1;
}
vrai(
  'tout annulé, la section reste visible en nommant son état vide',
  (await a.page.textContent('#lots')).includes('Aucune synchronisation'),
);
v(
  'et ce qu’il a saisi lui-même est intact : ses huit révisions sont là',
  apresAnnulation.revisions >= 8,
  true,
);

console.log('\nDEUX HISTOIRES POUR LA MÊME CARTE : LA FUSION DOIT ÊTRE REFUSÉE');

/*
   Le cas que la décision 4 protège réellement. Deux appareils migrent chacun de
   leur côté avant de s'apparier : chacun fabrique son propre socle pour la même
   carte — « l'état de cette carte, repris tel quel, faute de journal antérieur ».
   Deux socles concurrents disent deux passés différents de la même carte, et
   aucun recalcul ne peut trancher : le journal ne contient pas de quoi savoir
   lequel a eu lieu.

   On éprouve donc trois choses, et pas seulement le refus : que le refus
   survienne, qu'il **n'ait rien écrit** — pas même avancé l'horloge logique —,
   et qu'il dise quoi faire.
*/
{
  const c = await appareil('C');
  const d = await appareil('D');

  // La même carte des deux côtés, à des dates différentes : deux socles, deux
  // identifiants, un seul objet.
  await semer(c, ['carte-omega'], Date.parse('2026-03-01T08:00:00Z'));
  await semer(d, ['carte-omega'], Date.parse('2026-04-01T08:00:00Z'));
  await rafraichir(c);
  await rafraichir(d);

  /* Le semis n'écrit que le journal : on reconstruit l'état de D, pour pouvoir
     vérifier ensuite que le refus l'a laissé intact. */
  await d.page.click('#reconstruire');
  await d.page.waitForFunction(
    () => {
      const e = document.getElementById('message-reconstruction');
      return e && !e.classList.contains('hidden') && !e.textContent.includes('en cours');
    },
    undefined,
    { timeout: 30000 },
  );

  /* D se nomme : c'est une émission par l'écran, donc une horloge logique
     persistée. Sans elle, « l'horloge n'a pas bougé » comparerait deux fois
     rien. */
  await d.page.fill('#nom-appareil', 'Portable de secours');
  await d.page.click('#nommer');
  await d.page.waitForSelector('#message-nom:not(.hidden)', { timeout: 30000 });

  const avantRefus = await lire(d);
  const horlogeAvant = await horlogeDe(d);
  vrai('D a bien une horloge logique avant la tentative', Boolean(horlogeAvant));

  const paquetC = await envoyer(c);
  const refus = await tenterEtEtreRefuse(d, paquetC.chemin);

  vrai('la fusion est refusée', refus.message.includes('refusée'));
  vrai('et le refus dit que rien n’a été écrit', refus.message.includes('rien n’a été écrit'));
  vrai('la marche à suivre est affichée', refus.visible);
  vrai(
    'le motif nomme la carte dont les deux appareils ont chacun leur histoire',
    refus.motif.includes('1 flashcard') && refus.motif.includes('état de départ'),
  );
  v('et elle tient en trois étapes', refus.etapes.length, 3);
  vrai(
    'la sauvegarde vient avant l’effacement, dans cet ordre',
    refus.etapes[1].includes('sauvegarde') && refus.etapes[2].includes('effacez'),
  );

  const apresRefus = await lire(d);
  v(
    'rien n’a été écrit : ni opération, ni révision',
    [apresRefus.operations, apresRefus.revisions],
    [avantRefus.operations, avantRefus.revisions],
  );
  v('pas même une horloge avancée', await horlogeDe(d), horlogeAvant);
  v('et aucun lot de synchronisation n’a été enregistré', (await d.page.$$('.annuler')).length, 0);
  vrai(
    'la carte de D a gardé son propre état',
    apresRefus.cartes.length === 1 && apresRefus.cartes[0].id === 'carte-omega',
  );

  /* Et le refus n'est pas un mur : choisir un appareil de référence, puis
     restaurer, remet les deux sur la même histoire. On vérifie au moins que le
     chemin existe — l'effacement et la restauration ont leurs propres essais. */
  vrai(
    'l’écran dit aussi comment s’en sortir, en nommant la restauration',
    refus.etapes[2].includes('restaurez'),
  );

  await c.contexte.close();
  await d.contexte.close();
}

console.log('\nREFUS');

{
  const mauvais = await nav.newContext({ acceptDownloads: true });
  const page = await mauvais.newPage();
  await page.goto(`${RACINE}/appareils/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });
  await page.setInputFiles('#fichier', paquetA.chemin);
  await page.waitForSelector('#apercu:not(.hidden)', { timeout: 30000 });
  await page.fill('#mdp-fusion', 'pas-le-bon-mot-de-passe');
  await page.click('#fusionner');
  await page.waitForFunction(
    () => {
      const e = document.getElementById('message-fusion');
      return e && !e.classList.contains('hidden') && !e.textContent.includes('en cours');
    },
    undefined,
    { timeout: 60000 },
  );
  const message = await page.textContent('#message-fusion');
  vrai('un mauvais mot de passe est refusé, et rien n’est fusionné', message.includes('incorrect'));
  await mauvais.close();
}

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m' : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
await nav.close();
process.exit(echecs === 0 ? 0 : 1);
