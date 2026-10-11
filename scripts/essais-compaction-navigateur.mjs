/**
 * La compaction, en vrai : deux bases, un fichier, et un appareil en retard.
 *
 * Les essais purs éprouvent la règle ; celui-ci éprouve ce qu'aucune fonction
 * pure ne peut montrer — que l'accusé de réception circule réellement par le
 * paquet, que la borne qu'il établit soit lue au bon endroit, et qu'un journal
 * compacté d'un côté ne revienne pas de l'autre.
 *
 * Le parcours suit l'ordre dans lequel les choses se produisent en vrai, parce
 * que c'est l'ordre qui compte : on ne peut pas compacter avant d'avoir été
 * accusé, et on ne peut pas être accusé avant d'avoir envoyé.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { semer } from './lib/semer.mjs';

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

async function deverrouiller(page) {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

async function appareil(nom) {
  const contexte = await nav.newContext({ acceptDownloads: true });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.log(`PAGEERROR[${nom}]:`, e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`CONSOLE[${nom}]:`, m.text().slice(0, 250));
  });
  await page.goto(`${RACINE}/appareils/`, { waitUntil: 'networkidle' });
  await deverrouiller(page);
  await page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });
  return { nom, contexte, page };
}

/** Va sur une page du site, mot de passe compris, et attend son écran. */
async function aller(appareil, chemin, selecteur) {
  await appareil.page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller(appareil.page);
  await appareil.page.waitForSelector(selecteur, { timeout: 30000 });
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
    const operations = await tout('operations');
    const revisions = await tout('revisions');
    base.close();
    return {
      operations: operations.length,
      revisions: revisions.length,
      types: [...new Set(operations.map((o) => o.type))].sort(),
      cibles: [...new Set(revisions.map((r) => r.carteId))].sort(),
    };
  });

/** Écrit une pierre tombale pour une carte, à une horloge donnée. */
const supprimer = (appareil, carte, dansMs) =>
  appareil.page.evaluate(
    async ([carte, dansMs]) => {
      const base = await new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
      });
      const id = await new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get('appareil');
        q.onsuccess = () => ok(q.result);
      });
      const ms = Date.now() + dansMs;
      const op = {
        id: `01SUPPRESSION${String(ms).slice(-8)}`,
        appareil: id,
        hlc: `${String(ms).padStart(15, '0')}-0000`,
        type: 'suppression',
        cible: carte,
        lot: '',
        charge: {},
      };
      await new Promise((ok, ko) => {
        const tx = base.transaction('operations', 'readwrite');
        tx.objectStore('operations').put(op);
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
      return op.hlc;
    },
    [carte, dansMs],
  );

/** Déclare un appareil qu'on n'a jamais rencontré : un fait suffit. */
const nommerUnFantome = (appareil, nom) =>
  appareil.page.evaluate(
    async (nom) => {
      const base = await new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
      });
      const id = await new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get('appareil');
        q.onsuccess = () => ok(q.result);
      });
      const op = {
        id: '01FANTOME000000000000000000',
        appareil: id,
        hlc: '000000000000001-0000',
        type: 'appareil.nom',
        cible: 'ZZZZ9999',
        lot: '',
        charge: { nom },
      };
      await new Promise((ok, ko) => {
        const tx = base.transaction('operations', 'readwrite');
        tx.objectStore('operations').put(op);
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
    },
    nom,
  );

/** Retire un appareil par l'écran, comme la personne le ferait. */
async function retirer(appareil, id) {
  await aller(appareil, '/appareils/', '#ecran:not(.hidden)');
  await appareil.page.click(`[data-retrait="${id}"]`);
  await appareil.page.waitForSelector('#message-nom:not(.hidden)', { timeout: 30000 });
  return (await appareil.page.textContent('#message-nom')).replace(/\s+/g, ' ').trim();
}

async function envoyer(appareil) {
  await aller(appareil, '/appareils/', '#ecran:not(.hidden)');
  await appareil.page.fill('#mdp-envoi', MDP);
  const attente = appareil.page.waitForEvent('download', { timeout: 60000 });
  await appareil.page.click('#envoyer');
  const telechargement = await attente;
  await appareil.page.waitForSelector('#message-envoi:not(.hidden)', { timeout: 30000 });
  return telechargement.path();
}

async function recevoir(appareil, chemin) {
  await aller(appareil, '/appareils/', '#ecran:not(.hidden)');
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
  return appareil.page.textContent('#message-fusion');
}

/** Un aller-retour complet : chacun envoie, chacun fusionne. */
async function echanger(x, y) {
  const deX = await envoyer(x);
  await recevoir(y, deX);
  const deY = await envoyer(y);
  await recevoir(x, deY);
}

/** Clique « Voir ce qui partirait » et rend ce que l'écran dit. */
async function prevoir(appareil) {
  await aller(appareil, '/stockage/', '#stockage:not(.hidden)');
  await appareil.page.click('#prevoir-compaction');
  await appareil.page.waitForSelector('#apercu-compaction:not(.hidden)', { timeout: 30000 });
  return {
    texte: (await appareil.page.textContent('#apercu-compaction')).replace(/\s+/g, ' ').trim(),
    boutonVisible: await appareil.page.locator('#compacter').isVisible(),
  };
}

async function compacter(appareil) {
  await appareil.page.click('#compacter');
  await appareil.page.waitForSelector('#message-compaction:not(.hidden)', { timeout: 60000 });
  return (await appareil.page.textContent('#message-compaction')).replace(/\s+/g, ' ').trim();
}

console.log('\nLA COMPACTION, DE BOUT EN BOUT');

const a = await appareil('A');
const b = await appareil('B');

await semer(a, ['carte-a1', 'carte-a2'], Date.UTC(2026, 0, 1));
await semer(b, ['carte-b1'], Date.UTC(2026, 2, 1));

const departA = await lire(a);
v('A porte huit entrées de révision et une opération', [departA.revisions, departA.operations], [8, 1]);

console.log('\n1. Avant tout accusé de réception');

{
  const vu = await prevoir(a);
  vrai(
    'sans appareil connu, la compaction est possible et n’a rien à faire',
    vu.texte.includes('Rien à compacter'),
  );
  vrai('et le bouton n’apparaît pas', !vu.boutonVisible);
}

await nommerUnFantome(a, 'Vieil ordinateur');
{
  const vu = await prevoir(a);
  vrai(
    'un appareil déclaré mais jamais vu refuse la compaction, en le nommant',
    vu.texte.includes('Vieil ordinateur') && vu.texte.includes('accusé'),
  );
  vrai('et le bouton reste caché', !vu.boutonVisible);
}

{
  const message = await retirer(a, 'ZZZZ9999');
  vrai(
    'le retrait dit franchement qu’il n’est pas une révocation',
    message.includes('pas une révocation'),
  );
  const vu = await prevoir(a);
  vrai(
    'un appareil retiré n’est plus attendu par la compaction',
    vu.texte.includes('Rien à compacter'),
  );
  const repris = await retirer(a, 'ZZZZ9999');
  vrai('et il se reprend d’un geste', repris.includes('repris'));
  const apres = await prevoir(a);
  vrai(
    'repris, il bloque de nouveau la compaction',
    apres.texte.includes('Vieil ordinateur'),
  );
}
await retirer(a, 'ZZZZ9999');

console.log('\n2. Premier échange : les accusés circulent');

await echanger(a, b);
const apresA = await lire(a);
const apresB = await lire(b);
v('A détient les deux histoires', [apresA.revisions, apresA.cibles.length], [12, 3]);
v('B aussi', [apresB.revisions, apresB.cibles.length], [12, 3]);

console.log('\n3. Une suppression plus récente que la borne');

const hlcSuppression = await supprimer(a, 'carte-a1', 10 * 60 * 1000);
vrai('la pierre tombale est postérieure à l’échange', hlcSuppression > '000000000000000-0000');
{
  const vu = await prevoir(a);
  vrai(
    'la cible est reportée, parce que B ne l’a pas encore vue',
    vu.texte.includes('plus récentes que ce que tous vos appareils ont vu'),
  );
  vrai('rien n’est proposé', !vu.boutonVisible);
}
const toujoursLa = await lire(a);
v('et le journal n’a pas bougé, sauf la pierre tombale', toujoursLa.revisions, 12);

console.log('\n4. Deuxième échange, puis compaction');

await echanger(a, b);
{
  const vu = await prevoir(a);
  vrai('la compaction est maintenant proposée', vu.boutonVisible);
  vrai('elle annonce un objet supprimé', vu.texte.includes('1 objet(s) supprimé(s) seraient'));
  vrai('et une pierre tombale', vu.texte.includes('1 pierre(s) tombale(s)'));
  vrai(
    'elle promet de ne pas toucher aux cartes vivantes',
    vu.texte.includes('Aucun historique de carte vivante'),
  );
}

const message = await compacter(a);
vrai('le message annonce ce qui est parti', message.includes('Journal compacté'));

const compacteA = await lire(a);
v('les quatre entrées de la carte supprimée sont parties', compacteA.revisions, 8);
vrai('la carte supprimée n’est plus dans le journal', !compacteA.cibles.includes('carte-a1'));
vrai('les deux autres y sont', compacteA.cibles.includes('carte-a2') && compacteA.cibles.includes('carte-b1'));
vrai('la pierre tombale est partie avec', !compacteA.types.includes('suppression'));
vrai('et le compactage est inscrit au journal', compacteA.types.includes('compaction'));

{
  const vu = await prevoir(a);
  vrai('une seconde prévision ne trouve plus rien', vu.texte.includes('Rien à compacter'));
  vrai('et ne propose plus rien', !vu.boutonVisible);
}

console.log('\n5. L’appareil en retard ne ressuscite rien');

const avantB = await lire(b);
v('B porte encore les entrées de la carte supprimée', avantB.revisions, 12);

const deA = await envoyer(a);
await recevoir(b, deA);
const compacteB = await lire(b);
v('B applique le compactage reçu', compacteB.revisions, 8);
vrai('et oublie la carte supprimée', !compacteB.cibles.includes('carte-a1'));

const deB = await envoyer(b);
await recevoir(a, deB);
const retourA = await lire(a);
v('A ne reçoit rien qui ressuscite', retourA.revisions, 8);
vrai('et garde son journal compacté', !retourA.cibles.includes('carte-a1'));

await nav.close();
console.log(
  echecs === 0
    ? '\nTous les essais de compaction en navigateur passent.\n'
    : `\n${echecs} échec(s).\n`,
);
process.exit(echecs === 0 ? 0 : 1);
