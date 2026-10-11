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

const empreinteAffichee = (appareil) => appareil.page.textContent('#empreinte');

/** Crée le paquet par l'écran et rend le chemin du fichier téléchargé. */
async function envoyer(appareil, nomAffiche) {
  await appareil.page.fill('#mdp-envoi', MDP);
  await appareil.page.fill('#nom-appareil', nomAffiche);
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
  return { apercu, message: await appareil.page.textContent('#message-fusion') };
}

console.log('\nDEUX APPAREILS, DEUX BASES');

const a = await appareil('A');
const b = await appareil('B');

const avantA = await lire(a);
const avantB = await lire(b);
v('la base de A est neuve', [avantA.operations, avantA.revisions], [0, 0]);
v('celle de B aussi', [avantB.operations, avantB.revisions], [0, 0]);
v(
  'et leurs identifiants d’appareil diffèrent',
  (await a.page.textContent('#appareil')) !== (await b.page.textContent('#appareil')),
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

console.log('\nA ENVOIE, B REÇOIT');

const paquetA = await envoyer(a, 'Ordinateur de bureau');
vrai('le fichier porte l’extension attendue', paquetA.nom.endsWith('.paquet'));
vrai(
  'le message annonce ce qui est parti',
  paquetA.message.includes('1 opération') && paquetA.message.includes('8 révision'),
);

const receptionB = await recevoir(b, paquetA.chemin);
vrai('l’aperçu nomme l’appareil émetteur', receptionB.apercu.includes('Ordinateur de bureau'));
vrai('l’aperçu annonce le fichier intact', receptionB.apercu.includes('intact'));
vrai('la fusion annonce ce qu’elle a reçu', receptionB.message.includes('reçues'));
vrai('et les cartes recalculées', receptionB.message.includes('recalculée'));

const apresB = await lire(b);
v('B porte maintenant les douze révisions', apresB.revisions, 12);
v('et les deux opérations', apresB.operations, 2);
v(
  'les trois cartes existent chez B, dont deux qu’il ne connaissait pas',
  apresB.cartes.map((c) => c.id),
  ['carte-alpha', 'carte-beta', 'carte-gamma'],
);
vrai(
  'leur état FSRS a été recalculé, pas copié',
  apresB.cartes.every((c) => c.revisions === 3 && c.stability > 0),
);

console.log('\nB ENVOIE À SON TOUR');

const paquetB = await envoyer(b, 'Téléphone');
const receptionA = await recevoir(a, paquetB.chemin);
vrai('A reçoit ce qui lui manquait', receptionA.message.includes('reçues'));
vrai('et les deux appareils se disent identiques', receptionA.message.includes('identiques'));

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

console.log('\nREJEU : LE MÊME FICHIER UNE SECONDE FOIS');

const rejeu = await recevoir(a, paquetB.chemin);
vrai('la fusion n’apporte rien', rejeu.message.includes('0 opération'));
await rafraichir(a);
const apresRejeu = await lire(a);
v('et rien n’a bougé', [apresRejeu.operations, apresRejeu.revisions], [finalA.operations, finalA.revisions]);

console.log('\nANNULATION');

const lots = await a.page.$$('.annuler');
vrai('les synchronisations reçues sont listées, avec un bouton d’annulation', lots.length >= 1);
v(
  'et le rejeu, qui n’a rien apporté, n’a pas laissé de ligne',
  lots.length,
  1,
);

a.page.once('dialog', (d) => d.accept());
await lots[0].click();
await a.page.waitForSelector('#message-annulation:not(.hidden)', { timeout: 60000 });
const messageAnnulation = await a.page.textContent('#message-annulation');
vrai('l’annulation dit ce qu’elle a retiré', messageAnnulation.includes('retirées'));

/* L'état vide est nommé, et il reste visible : c'est ce qui permet au message
   d'annulation de rester lisible après avoir annulé la dernière
   synchronisation. */
vrai(
  'après annulation, la section reste visible et nomme son état vide',
  (await a.page.textContent('#lots')).includes('Aucune synchronisation'),
);

const apresAnnulation = await lire(a);
vrai(
  'le journal de A a bien diminué',
  apresAnnulation.revisions < finalA.revisions || apresAnnulation.operations < finalA.operations,
);
v(
  'et ce qu’il a saisi lui-même est intact : ses huit révisions sont là',
  apresAnnulation.revisions >= 8,
  true,
);

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
