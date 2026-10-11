/**
 * La liaison par QR, de bout en bout, par l'écran et par la caméra.
 *
 * Deux contextes de navigateur, donc deux IndexedDB, et une vraie liaison
 * WebRTC entre les deux. Ce qui est éprouvé ici est précisément ce que les
 * essais purs ne peuvent pas atteindre :
 *
 *  - que le QR affiché par un appareil soit **réellement lisible** par la
 *    caméra de l'autre, à la taille où il est affiché ;
 *  - que la description de session y tienne ;
 *  - que la liaison s'ouvre, que le paquet passe, et que la fusion ait lieu des
 *    deux côtés en une seule rencontre.
 *
 * ## La caméra
 *
 * `getUserMedia` est remplacé, **dans l'essai seulement**, par un flux issu
 * d'un canevas que l'essai dessine. Aucun crochet d'essai n'est ajouté au code
 * du site : c'est une API du navigateur qui est substituée, exactement comme le
 * ferait une caméra pointée sur l'écran d'en face. Toute la boucle de lecture du
 * site — capture d'image, conversion, décodage — est donc exercée pour de vrai.
 *
 * ## mDNS
 *
 * Chromium masque les adresses locales derrière des noms « .local » tirés au
 * hasard. Deux contextes du même navigateur les résolvent, mais l'essai désarme
 * cette obfuscation pour ne pas dépendre d'un résolveur mDNS dans un conteneur
 * qui n'en a pas.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { semer } from './lib/semer.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--no-sandbox',
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--autoplay-policy=no-user-gesture-required',
  ],
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

/**
 * Une caméra pilotée par l'essai.
 *
 * Le canevas est grand (600 points) : c'est l'ordre de grandeur de ce qu'une
 * caméra de téléphone voit d'un QR affiché sur un écran d'ordinateur. Trop
 * petit, le décodage échouerait — et c'est une information utile, pas un défaut
 * de l'essai.
 */
const CAMERA = () => {
  const toile = document.createElement('canvas');
  toile.width = 600;
  toile.height = 600;
  const pinceau = toile.getContext('2d');
  pinceau.fillStyle = '#ffffff';
  pinceau.fillRect(0, 0, 600, 600);
  const flux = toile.captureStream(12);

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => flux,
      enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'essai' }],
    },
  });

  window.__montrer = (svg) =>
    new Promise((ok, ko) => {
      const image = new Image();
      image.onload = () => {
        pinceau.fillStyle = '#ffffff';
        pinceau.fillRect(0, 0, 600, 600);
        // Marge comprise : le QR porte déjà sa zone de silence.
        pinceau.drawImage(image, 20, 20, 560, 560);
        ok(true);
      };
      image.onerror = () => ko(new Error('SVG illisible'));
      image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    });
};

async function appareil(nom) {
  const contexte = await nav.newContext({ permissions: ['camera'] });
  await contexte.addInitScript(CAMERA);
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.log(`PAGEERROR[${nom}]:`, e.message.slice(0, 200)));
  page.on('console', (m) => {
    /* Les relais publics sont inaccessibles depuis ce conteneur, et c'est
       attendu : le mandataire sortant ne laisse pas passer de WebSocket vers un
       hôte quelconque. C'est précisément la panne que le mode sans relais est là
       pour couvrir, et c'est elle que cet essai éprouve. */
    if (m.type() === 'error' && !m.text().includes('WebSocket connection')) {
      console.log(`CONSOLE[${nom}] erreur :`, m.text().slice(0, 200));
    }
  });
  await page.goto(`${RACINE}/apparier/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });
  return { nom, contexte, page };
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
      cartes: (await tout('cartes')).map((c) => c.id).sort(),
      /* Les identifiants du journal : c'est **eux** qui disent si les deux
         appareils portent la même histoire. « cartes » est un état dérivé, et
         le semis de cet essai ne le construit pas — seule la fusion le fait,
         pour les cartes reçues. */
      ids: (await tout('revisions')).map((r) => r.id).sort(),
    };
    base.close();
    return sortie;
  });

/** Le SVG du QR actuellement affiché dans une zone. */
const qrAffiche = (appareil, zone) =>
  appareil.page.locator(`#${zone} svg`).evaluate((n) => n.outerHTML);

/** Fait voir à la caméra de cet appareil le QR affiché par l'autre. */
const montrer = (appareil, svg) => appareil.page.evaluate((s) => window.__montrer(s), svg);

const message = (appareil, id) => appareil.page.textContent(`#${id}`);

const attendreMessage = (appareil, id, fragment, delai = 60000) =>
  appareil.page.waitForFunction(
    ([identifiant, attendu]) => {
      const e = document.getElementById(identifiant);
      return e && !e.classList.contains('hidden') && e.textContent.includes(attendu);
    },
    [id, fragment],
    { timeout: delai },
  );

console.log('\nDEUX APPAREILS, UN QR, AUCUN RELAIS');

const a = await appareil('A');
const b = await appareil('B');

await semer(a, ['carte-alpha', 'carte-beta'], Date.parse('2026-05-01T08:00:00Z'));
await semer(b, ['carte-gamma'], Date.parse('2026-06-01T08:00:00Z'));

const avantA = await lire(a);
const avantB = await lire(b);
v('A porte huit révisions', avantA.revisions, 8);
v('B en porte quatre', avantB.revisions, 4);

/* Le mot de passe est saisi une fois de chaque côté : il est retenu en mémoire
   pour la session, ce qui est exactement ce qui rend l'échange automatique. */
for (const app of [a, b]) {
  await app.page.fill('#mdp', MDP);
  await app.page.dispatchEvent('#mdp', 'change');
}
v('le mot de passe n’est pas laissé dans le champ', await a.page.inputValue('#mdp'), '');

console.log('\nA PROPOSE, B RÉPOND');

await a.page.click('#a2-proposer');
await a.page.waitForSelector('#a2-qr svg', { timeout: 30000 });
const offre = await qrAffiche(a, 'a2-qr');
vrai('A affiche un QR de proposition', offre.includes('<svg'));

const cote = Number(offre.match(/viewBox="0 0 (\d+)/)?.[1] ?? 0);
vrai(`et il reste visable (${cote} modules de côté, zone de silence comprise)`, cote <= 110);

await b.page.click('#a2-repondre');
await b.page.waitForSelector('#zone-camera:not(.hidden)', { timeout: 30000 });
await montrer(b, offre);

/* B doit lire le QR par sa caméra, puis afficher sa réponse. */
await b.page.waitForSelector('#a2-qr svg', { timeout: 60000 });
vrai('B a lu le QR par la caméra', (await message(b, 'message-camera')).includes('QR lu'));
const reponse = await qrAffiche(b, 'a2-qr');
vrai('et affiche un QR de réponse', reponse.includes('<svg') && reponse !== offre);

await a.page.click('#a2-lire');
await a.page.waitForSelector('#zone-camera:not(.hidden)', { timeout: 30000 });
await montrer(a, reponse);

console.log('\nLA LIAISON S’OUVRE ET LES DEUX FUSIONNENT');

await attendreMessage(a, 'message-a2', 'reçues', 90000);
await attendreMessage(b, 'message-a2', 'reçues', 90000);
vrai('A annonce ce qu’il a reçu', (await message(a, 'message-a2')).includes('reçues'));
vrai('B aussi', (await message(b, 'message-a2')).includes('reçues'));

const apresA = await lire(a);
const apresB = await lire(b);
v('A porte maintenant les douze révisions', apresA.revisions, 12);
v('B aussi', apresB.revisions, 12);
v('et leurs journaux de révision sont identiques', apresA.ids, apresB.ids);
v('les mêmes opérations aussi', apresA.operations, apresB.operations);
/* Chacun a recalculé l'état FSRS des cartes qu'il a reçues — et seulement
   celles-là : son propre état dérivé n'avait jamais été construit, puisque le
   semis n'écrit que le journal. */
v('A a recalculé la carte reçue', apresA.cartes, ['carte-gamma']);
v('B les deux qu’il a reçues', apresB.cartes, ['carte-alpha', 'carte-beta']);
vrai(
  'les deux se disent identiques, en une seule rencontre',
  (await message(a, 'message-a2')).includes('identiques ✓') &&
    (await message(b, 'message-a2')).includes('identiques ✓'),
);

console.log('\nLE LECTEUR DE QR RECONNAÎT UN LIEN D’APPAIRAGE');

{
  const c = await appareil('C');
  /* On fabrique un QR d'appairage en demandant à l'écran de l'afficher, puis on
     le fait lire par un troisième appareil : c'est le parcours privilégié, à
     ceci près que c'est le lecteur embarqué qui lit au lieu de l'appareil
     photo du système. */
  await a.page.click('#afficher-qr').catch(() => {});
  await a.page.waitForSelector('#qr svg', { timeout: 30000 });
  const qrAppairage = await qrAffiche(a, 'qr');
  const lien = await a.page.textContent('#lien-appairage');
  vrai('le lien d’appairage porte le secret dans le fragment', lien.includes('/apparier/#c='));
  vrai('et il est bien sur cette page', lien.includes('/apparier/'));

  await c.page.click('#ouvrir-camera');
  await c.page.waitForSelector('#zone-camera:not(.hidden)', { timeout: 30000 });
  await montrer(c, qrAppairage);
  await c.page.waitForSelector('#lu:not(.hidden)', { timeout: 60000 });
  vrai(
    'le lecteur reconnaît un QR d’appairage et propose d’apparier',
    !(await c.page.locator('#lu-apparier').isHidden()),
  );
  const luTexte = await c.page.textContent('#lu-texte');
  vrai('et il montre ce qu’il a lu', luTexte.includes('/apparier/#c='));
  await c.contexte.close();
}

console.log('\nLE SECRET NE RESTE PAS DANS LA BARRE D’ADRESSE');

{
  /* Un contexte neuf, ouvert **directement** sur l'URL à fragment : naviguer
     depuis la même page ne changerait que le fragment, ce qui ne recharge pas le
     document et ne rejoue donc pas le script. L'essai se serait trompé sur ce
     qu'il croyait vérifier. */
  const contexte = await nav.newContext({ permissions: ['camera'] });
  await contexte.addInitScript(CAMERA);
  const page = await contexte.newPage();
  const d = { nom: 'D', contexte, page };
  await page.goto(`${RACINE}/apparier/#c=SALON.SECRET`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await d.page.waitForSelector('#ecran:not(.hidden)', { timeout: 30000 });
  await d.page.waitForFunction(() => !location.hash, undefined, { timeout: 30000 });
  v('le fragment est retiré de l’URL', await d.page.evaluate(() => location.hash), '');
  const memorise = await d.page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const lu = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get('appairage');
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return lu;
  });
  v('mais l’appairage est mémorisé', [memorise?.salon, memorise?.secret], ['SALON', 'SECRET']);
  await d.contexte.close();
}

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m' : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
await nav.close();
process.exit(echecs === 0 ? 0 : 1);
