/**
 * Le dossier partagé, par l'écran, avec une vraie poignée de dossier.
 *
 * `showDirectoryPicker` ouvre une fenêtre du système, qu'aucun essai ne peut
 * actionner. On la remplace donc — dans l'essai seulement — par le **système de
 * fichiers privé de l'origine**, qui rend une poignée de dossier *réelle* :
 * mêmes méthodes, même sémantique, et surtout structurellement clonable, donc
 * enregistrable dans IndexedDB. Un faux objet avec des fonctions ne l'aurait pas
 * été, et l'écran aurait échoué sur « DataCloneError » au moment de mémoriser le
 * dossier — c'est-à-dire que l'essai aurait échoué pour une raison qui n'a rien à
 * voir avec ce qu'il vérifie.
 *
 * Ce système de fichiers est propre à chaque contexte. Les deux appareils n'en
 * partagent donc pas un : c'est le **fichier** qui voyage, l'essai le recopiant
 * de l'un à l'autre — ce qui est exactement ce qu'un dossier synchronisé fait.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { semer } from './lib/semer.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
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

const FAUX_SELECTEUR = () => {
  Object.defineProperty(window, 'showDirectoryPicker', {
    configurable: true,
    value: async () => navigator.storage.getDirectory(),
  });
};

async function appareil(nom) {
  const contexte = await nav.newContext({ acceptDownloads: true });
  await contexte.addInitScript(FAUX_SELECTEUR);
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

/** Le contenu du dossier, vu depuis le navigateur. */
const contenuDossier = (appareil) =>
  appareil.page.evaluate(async () => {
    const dossier = await navigator.storage.getDirectory();
    const sortie = [];
    for await (const [nom, entree] of dossier.entries()) {
      if (entree.kind !== 'file') continue;
      const fichier = await entree.getFile();
      sortie.push({ nom, taille: fichier.size });
    }
    return sortie.sort((a, b) => a.nom.localeCompare(b.nom));
  });

/** Recopie un fichier d'un appareil à l'autre, comme le ferait un dossier synchronisé. */
async function recopier(de, vers, nom, horodatage) {
  const b64 = await de.page.evaluate(async (n) => {
    const dossier = await navigator.storage.getDirectory();
    const fichier = await (await dossier.getFileHandle(n)).getFile();
    const octets = new Uint8Array(await fichier.arrayBuffer());
    let binaire = '';
    for (const o of octets) binaire += String.fromCharCode(o);
    return btoa(binaire);
  }, nom);
  await vers.page.evaluate(
    async ([n, contenu]) => {
      const dossier = await navigator.storage.getDirectory();
      const fichier = await dossier.getFileHandle(n, { create: true });
      const flux = await fichier.createWritable();
      const binaire = atob(contenu);
      const octets = new Uint8Array(binaire.length);
      for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
      await flux.write(octets);
      await flux.close();
    },
    [nom, b64],
  );
  return horodatage;
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
    };
    base.close();
    return sortie;
  });

const message = (appareil) => appareil.page.textContent('#message-dossier');

/**
 * Attend un message, en exigeant qu'il ait **changé**.
 *
 * Attendre un simple contenu rend la main aussitôt quand le message précédent le
 * contenait déjà : c'est ce qui m'a fait croire qu'un dépôt était terminé alors
 * qu'il n'avait pas commencé, et l'essai mesurait le dossier d'avant. Le texte
 * courant est donc capturé avant l'action, et l'attente porte sur sa relève.
 */
async function attendreMessage(appareil, fragment, delai = 60000) {
  await appareil.page.waitForFunction(
    ([attendu, precedent]) => {
      const e = document.getElementById('message-dossier');
      return (
        e &&
        !e.classList.contains('hidden') &&
        e.textContent !== precedent &&
        e.textContent.includes(attendu)
      );
    },
    [fragment, appareil.dernierMessage ?? ''],
    { timeout: delai },
  );
  appareil.dernierMessage = await appareil.page.textContent('#message-dossier');
}

console.log('\nLE DOSSIER PARTAGÉ');

const a = await appareil('A');
const b = await appareil('B');

vrai(
  'la section est proposée là où le navigateur sait mémoriser un dossier',
  await a.page.locator('#dossier-actions').isVisible(),
);
vrai(
  'et le message d’indisponibilité n’est pas affiché',
  await a.page.locator('#dossier-indisponible').isHidden(),
);

await semer(a, ['carte-alpha', 'carte-beta'], Date.parse('2026-05-01T08:00:00Z'));
await semer(b, ['carte-gamma'], Date.parse('2026-06-01T08:00:00Z'));
await a.page.reload({ waitUntil: 'networkidle' });
await a.page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });

console.log('\nCHOISIR, PUIS DÉPOSER');

for (const app of [a, b]) {
  await app.page.click('#choisir-dossier');
  await attendreMessage(app, 'mémorisé');
}
vrai('le dossier est mémorisé et nommé', (await message(a)).includes('mémorisé'));
vrai('le bouton devient « changer de dossier »', (await a.page.textContent('#choisir-dossier')).includes('Changer'));
vrai('« déposer » apparaît', await a.page.locator('#deposer').isVisible());
vrai('et « oublier » aussi', await a.page.locator('#oublier-dossier').isVisible());

await a.page.fill('#mdp-dossier', MDP);
await a.page.click('#deposer');
await attendreMessage(a, 'Déposé');
const depose = await contenuDossier(a);
v('un fichier est dans le dossier', depose.length, 1);
vrai('il porte l’extension du paquet', depose[0].nom.endsWith('.paquet'));
vrai('et il pèse quelque chose', depose[0].taille > 100);
v('le mot de passe n’est pas laissé dans le champ', await a.page.inputValue('#mdp-dossier'), '');

console.log('\nLE PAQUET DÉPOSÉ EST VU PAR L’AUTRE APPAREIL, ET PAS PAR SOI-MÊME');

v(
  'A ne se propose pas son propre paquet',
  await a.page.locator('#paquets-dossier li button').count(),
  0,
);
vrai(
  'et il le dit plutôt que de laisser une liste vide',
  (await a.page.textContent('#paquets-dossier')).includes('Aucun paquet'),
);

await recopier(a, b, depose[0].nom);
await b.page.click('#choisir-dossier');
await b.page.waitForSelector('.fusionner-dossier', { timeout: 30000 });
v('B voit un paquet à fusionner', await b.page.locator('.fusionner-dossier').count(), 1);
const ligne = await b.page.textContent('#paquets-dossier');
vrai('avec l’appareil qui l’a déposé', /\d{2}\/\d{2}\/\d{4}/.test(ligne));
vrai('et sa taille', ligne.includes('Kio'));

console.log('\nFUSIONNER DEPUIS LE DOSSIER');

const avantB = await lire(b);
await b.page.fill('#mdp-dossier', MDP);
await b.page.click('.fusionner-dossier');
await attendreMessage(b, 'reçues');
vrai('la fusion annonce ce qu’elle a reçu', (await message(b)).includes('reçues'));
const apresB = await lire(b);
v('B porte maintenant les douze révisions', apresB.revisions, 12);
vrai('et plus d’opérations qu’avant', apresB.operations > avantB.operations);

console.log('\nUN MAUVAIS MOT DE PASSE NE FUSIONNE RIEN');

{
  await b.page.fill('#mdp-dossier', 'pas-le-bon');
  await b.page.click('.fusionner-dossier');
  await attendreMessage(b, 'incorrect');
  vrai('le refus est nommé', (await message(b)).includes('incorrect'));
  const inchange = await lire(b);
  v('et rien n’a bougé', [inchange.operations, inchange.revisions], [apresB.operations, apresB.revisions]);
}

console.log('\nLA RÉTENTION SE FAIT AU DÉPÔT, SANS BOUTON');

{
  /*
     Quatre anciens paquets du **même appareil** sont posés dans le dossier, puis
     on dépose : il doit n'en rester que trois en tout pour cet appareil.

     Les fichiers sont écrits directement plutôt que déposés quatre fois : le nom
     d'un paquet porte la minute, donc quatre dépôts dans la même minute
     écriraient le même fichier. J'avais d'abord déplacé l'horloge de la page
     entre deux dépôts — remplacer « Date » sous les pieds de l'application est
     une façon de casser autre chose pour éprouver ceci.
  */
  const moi = await a.page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const lu = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get('appareil');
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return lu;
  });

  await a.page.evaluate(async (id) => {
    const dossier = await navigator.storage.getDirectory();
    for (const jour of ['01', '02', '03', '04']) {
      const fichier = await dossier.getFileHandle(
        `cyclades-${id.toLowerCase()}-2026-09-${jour}-08h00.paquet`,
        { create: true },
      );
      const flux = await fichier.createWritable();
      await flux.write(new Uint8Array(512));
      await flux.close();
    }
  }, moi);

  const avant = await contenuDossier(a);
  vrai(`cinq paquets avant le dépôt (${avant.length})`, avant.length === 5);

  await a.page.fill('#mdp-dossier', MDP);
  await a.page.click('#deposer');
  await attendreMessage(a, 'Déposé');
  const final = await contenuDossier(a);
  v('il ne reste que trois paquets pour cet appareil', final.length, 3);
  vrai('et le dépôt annonce ce qu’il a retiré', (await message(a)).includes('retiré'));
}

console.log('\nOUBLIER LE DOSSIER NE SUPPRIME PAS LES FICHIERS');

{
  const avant = await contenuDossier(a);
  await a.page.click('#oublier-dossier');
  await attendreMessage(a, 'oublié');
  vrai('l’écran le dit', (await message(a)).includes('restent'));
  v('les fichiers sont toujours là', (await contenuDossier(a)).length, avant.length);
  vrai('et « déposer » a disparu', await a.page.locator('#deposer').isHidden());
}

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m' : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
await nav.close();
process.exit(echecs === 0 ? 0 : 1);
