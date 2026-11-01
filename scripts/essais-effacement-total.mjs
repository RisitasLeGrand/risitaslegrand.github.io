/**
 * « Tout effacer sur cet appareil » efface les quatre endroits — A7 et G-2
 * du 58.
 *
 * ## D'où vient cet essai
 *
 * D'une sonde faite à la main le 19 octobre, qui a montré que le bouton ne
 * vidait que les magasins de la base `revinsp` : `localStorage` intact, Cache
 * Storage intact, les autres bases IndexedDB intactes — alors que la phrase
 * de confirmation annonçait « les réglages enregistrés dans ce navigateur ».
 * La sonde devient donc un essai, pour que le constat ne se reperde pas.
 *
 * ## Les deux moitiés du contrôle
 *
 * Un effacement a deux manières de se tromper, et les deux sont graves :
 *
 * - **ne pas assez effacer**, et c'est le défaut corrigé ici ;
 * - **trop effacer**, en emportant ce qui n'appartient pas à ce site. Un
 *   témoin étranger est donc posé à côté de chaque témoin à nous, et il doit
 *   survivre.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaBoite } from './lib/boite-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 220)));

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(3000);
  }
};

/** Pose les témoins, et rend l'état de départ. */
const poser = () =>
  page.evaluate(async () => {
    // À nous : deux vraies clés du site, et une étrangère à côté.
    localStorage.setItem('revinsp.theme', 'sombre');
    localStorage.setItem('cyclades.sport.refus', '{"temoin":true}');
    localStorage.setItem('autre-site.reglage', 'ne-pas-toucher');
    sessionStorage.setItem('cyclades.coffre.temoin', 'x');
    /*
       ET UN TÉMOIN À L'INTÉRIEUR DE LA CLÉ QUE L'APPLICATION RÉÉCRIT.

       « cyclades.defilement » garde la position de lecture par écran. La page
       la réécrit dès qu'elle se repeint — c'est-à-dire juste après
       l'effacement, puisque l'écran reste affiché. Constater sa PRÉSENCE ne dit
       donc rien ; ce qu'il faut constater, c'est que son CONTENU d'avant n'est
       pas revenu.

       On y met donc un écran que la page courante n'écrira jamais, avec une
       valeur reconnaissable. Et le choix de l'écran n'est pas innocent : une
       position de lecture sur « /odyssee/mes-regles/ » dit que la personne a
       consulté son cycle, avant tout contenu. C'est exactement ce que
       l'effacement total doit emporter.
    */
    sessionStorage.setItem(
      'cyclades.defilement',
      JSON.stringify({ '/odyssee/mes-regles/': 4242 }),
    );

    // Un cache à nous, un cache étranger.
    const aNous = await caches.open('cyclades-sonde');
    await aNous.put(new Request('https://exemple.test/a-nous'), new Response('x'));
    const etranger = await caches.open('autre-cache');
    await etranger.put(new Request('https://exemple.test/etranger'), new Response('x'));

    // Les deux bases annexes du site, et une base étrangère.
    const creer = (nom) =>
      new Promise((ok) => {
        const r = indexedDB.open(nom, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('t');
        r.onsuccess = () => {
          r.result.close();
          ok();
        };
        r.onerror = () => ok();
      });
    await creer('revinsp-instantanes');
    await creer('cyclades-cles');
    await creer('autre-base');

    return 'posés';
  });

/** Relève les quatre endroits, sans rien toucher. */
const relever = () =>
  page.evaluate(async () => {
    const bases = typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases()).map((b) => b.name).filter(Boolean).sort()
      : ['(liste indisponible)'];
    return {
      locales: Object.keys(localStorage).sort(),
      session: Object.keys(sessionStorage).sort(),
      /*
         LES VALEURS, et pas seulement les noms. Un relevé qui ne donne que les
         noms oblige à deviner ce qu'une clé présente contient, et c'est ce qui
         a fait lire « une clé survit » là où l'application venait d'en écrire
         une neuve.
      */
      valeursDeSession: Object.fromEntries(
        Object.keys(sessionStorage).map((c) => [c, sessionStorage.getItem(c) ?? '']),
      ),
      caches: (await caches.keys()).sort(),
      bases,
    };
  });

/* ── Les témoins, posés dans les quatre endroits ──────────────────────── */

console.log('\nLES TÉMOINS, POSÉS DANS LES QUATRE ENDROITS');

await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2500);
v('les témoins sont posés', await poser(), 'posés');

const avant = await relever();
console.log(`      locales : ${avant.locales.join(', ')}`);
console.log(`      caches  : ${avant.caches.join(', ')}`);
console.log(`      bases   : ${avant.bases.join(', ')}`);
v('un réglage à nous est en place', avant.locales.includes('revinsp.theme'), true);
v('un cache à nous est en place', avant.caches.includes('cyclades-sonde'), true);
v('les deux bases annexes sont en place',
  ['revinsp-instantanes', 'cyclades-cles'].filter((b) => !avant.bases.includes(b)),
  []);

/* ── Le libellé dit la portée ─────────────────────────────────────────── */

console.log('\nLE LIBELLÉ DIT LA PORTÉE');

const libelle = ((await page.locator('#reinitialiser').textContent()) ?? '').trim();
v('le bouton s’appelle « Tout effacer sur cet appareil »', libelle, 'Tout effacer sur cet appareil');

/* ── L'effacement, depuis l'écran ─────────────────────────────────────── */

console.log('\nL’EFFACEMENT, DEPUIS L’ÉCRAN');

await page.click('#reinitialiser');
const titre = await page
  .locator('dialog.boite[open] .boite-titre')
  .textContent({ timeout: 30000 });
v('la boîte nomme l’appareil', (titre ?? '').trim(), 'Tout effacer sur cet appareil ?');

const dit = ((await page.locator('dialog.boite[open]').textContent()) ?? '').replace(/\s+/g, ' ');
v('elle annonce les réglages de ce navigateur', /réglages de ce navigateur/.test(dit), true);
v('elle annonce les pages gardées hors ligne', /hors ligne/.test(dit), true);
v('elle annonce les instantanés', /instantanés/.test(dit), true);
v('elle annonce les clés du coffre', /clés de votre coffre/.test(dit), true);

await repondreALaBoite(page, 'Tout effacer', { delai: 30000 });
await page.waitForFunction(
  () => !document.getElementById('message-effacement-total')?.classList.contains('hidden'),
  undefined,
  { timeout: 30000 },
);
console.log(
  `      message : ${((await page.locator('#message-effacement-total').textContent()) ?? '').trim()}`,
);

/* ── Les quatre endroits sont vides, et seulement eux ─────────────────── */

console.log('\nLES QUATRE ENDROITS SONT VIDES, ET SEULEMENT EUX');

const apres = await relever();
console.log(`      locales : ${apres.locales.join(', ') || '(aucune)'}`);
console.log(`      caches  : ${apres.caches.join(', ') || '(aucun)'}`);
console.log(`      bases   : ${apres.bases.join(', ') || '(aucune)'}`);

v('aucun réglage de ce site ne survit',
  apres.locales.filter((c) => c.startsWith('revinsp') || c.startsWith('cyclades')),
  []);
/*
   CE QUE CETTE ASSERTION MESURAIT, ET CE QU'ELLE MESURE MAINTENANT.

   Elle exigeait qu'aucune clé de session du site ne reste. Elle était ROUGE sur
   « main », et pour une raison qui n'est pas un défaut de l'effacement :
   « cyclades.defilement » est réécrite par la page dès qu'elle se repeint,
   c'est-à-dire juste après l'effacement, puisque l'écran reste affiché.

   Mesuré dans « src/lib/defilement.ts » : « noter() » relit la carte des
   positions avant d'écrire, donc elle repart de rien après un effacement et la
   nouvelle valeur ne porte que l'écran COURANT. L'effacement a bien fait son
   travail ; c'était l'assertion qui lisait une absence à un instant où
   l'application écrit légitimement.

   On ne l'affaiblit pas pour autant — on lui rend son objet, qui est plus
   exigeant que ce qu'elle disait : ce n'est pas « aucune clé ne reste », c'est
   « rien de ce qui existait AVANT ne subsiste ». Les trois contrôles qui
   suivent le mesurent, et le dernier des trois est le seul qui aurait attrapé
   une vraie fuite logée à l'intérieur d'une clé recréée.
*/
v('les témoins de session posés avant sont tous partis',
  apres.session.filter((c) => c === 'cyclades.coffre.temoin'),
  []);
/*
   ET CE QUI RESTE, S'IL RESTE QUELQUE CHOSE, EST NOMMÉ plutôt que toléré en
   silence : une clé recréée doit pouvoir être reconnue, et une clé inattendue
   doit se voir. On n'autorise donc pas « tout ce qui commence par cyclades » —
   on autorise une liste, et elle est courte.
*/
const RECREEES_PAR_LA_PAGE = ['cyclades.defilement'];
v('et aucune clé de session inattendue ne reste',
  apres.session.filter(
    (c) =>
      (c.startsWith('revinsp') || c.startsWith('cyclades')) &&
      !RECREEES_PAR_LA_PAGE.includes(c),
  ),
  []);
/*
   LE CONTRÔLE QUI COMPTE VRAIMENT. Une clé recréée ne doit rien porter de ce
   qui a été effacé. Le témoin posé à l'intérieur de « cyclades.defilement »
   nomme un écran que la page courante n'écrira jamais — et une position de
   lecture sur « /odyssee/mes-regles/ » dit à elle seule que la personne a
   consulté son cycle.

   C'est le seul des trois qui attraperait une fuite logée DANS une clé
   recréée, et aucune des deux versions précédentes de cet essai ne la voyait.
*/
v('et rien de ce qui existait avant ne reparaît dans ce qui a été recréé',
  Object.entries(apres.valeursDeSession)
    .filter(([, valeur]) => /mes-regles|4242/.test(valeur))
    .map(([clef]) => clef),
  []);
console.log(`      session : ${
  Object.entries(apres.valeursDeSession)
    .map(([c, val]) => `${c} = ${val.slice(0, 60)}`)
    .join(' · ') || '(aucune)'
}`);
v('aucun cache de ce site ne survit',
  apres.caches.filter((c) => c.startsWith('cyclades-')),
  []);
v('les deux bases annexes sont parties',
  apres.bases.filter((b) => b === 'revinsp-instantanes' || b === 'cyclades-cles'),
  []);

console.log('\nET CE QUI N’EST PAS À NOUS EST INTACT');
v('le réglage étranger est intact', apres.locales.includes('autre-site.reglage'), true);
v('le cache étranger est intact', apres.caches.includes('autre-cache'), true);
v('la base étrangère est intacte', apres.bases.includes('autre-base'), true);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
process.exit(echecs === 0 ? 0 : 1);
