/**
 * Le socle de clés du coffre : ce qui est écrit, et ce qui ne l'est plus.
 *
 *   npm run essais:coffre-session
 *
 * **Phase 1 du prompt 35.** La clé du coffre n'est plus rangée en clair dans
 * le stockage de l'onglet : ce qui s'y trouve est un chiffré, et l'enveloppe
 * qui l'ouvre vit dans IndexedDB, non extractible et renouvelée à chaque
 * ouverture du coffre.
 *
 * **Ce que ce contrôle doit prouver, et pourquoi chaque point y est.**
 *
 * *Qu'il n'y a plus rien d'utilisable dans le stockage.* Il ne suffit pas de
 * regarder si la valeur « a l'air » chiffrée : le contrôle décode ce qui est
 * rangé et **tente de s'en servir comme d'une clé**. Une clé AES-256 brute
 * fait 32 octets ; l'importer doit **échouer**. Un contrôle qui se
 * contenterait de comparer deux chaînes passerait au vert le jour où le format
 * changerait sans que la protection change.
 *
 * *Que la navigation et le rechargement ne redemandent rien.* C'est la raison
 * d'être du choix : sur un site multi-pages, s'en tenir à la mémoire de la
 * page redemanderait le mot de passe à chaque écran.
 *
 * *Et surtout, que rien n'est devenu illisible.* C'est le seul risque de cette
 * phase qui se paierait en données perdues. Le contrôle écrit donc une note
 * **par l'écran réel**, ferme le coffre, le rouvre avec le mot de passe, et
 * exige de **retrouver la note**. Si la dérivation de la clé avait bougé d'un
 * octet, ce point serait rouge.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const NOTE = `essai-socle-${Date.now()}`;

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
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 200)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 200)}`);
  }
};

console.log('\nCOFFRE — LE SOCLE DE CLÉS');

const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

const ouvrirLaSession = async (p) => {
  const verrou = p.locator('#champ-mdp');
  if (await verrou.isVisible().catch(() => false)) {
    await p.fill('#champ-mdp', MDP);
    await p.click('#bouton-verrou');
  }
};

const ouvrirLeCoffre = async (p) => {
  const champ = p.locator('#mdp-coffre');
  await champ.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await champ.isVisible().catch(() => false))) return false;
  await p.fill('#mdp-coffre', MDP);
  await p.locator('#coffre-ferme button').first().click();
  await p.locator('#coffre-ferme').waitFor({ state: 'hidden', timeout: 20000 });
  return true;
};

/* Ce que les trois stockages contiennent, vu depuis la page. */
const stockages = (p) =>
  p.evaluate(async () => {
    const range = sessionStorage.getItem('cyclades.coffre');
    let octets = null;
    let utilisableCommeCle = null;
    if (range) {
      try {
        octets = Uint8Array.from(atob(range), (c) => c.charCodeAt(0)).length;
      } catch {
        octets = -1;
      }
      /* Le point du contrôle : s'en servir comme d'une clé doit ÉCHOUER. */
      try {
        await crypto.subtle.importKey(
          'raw',
          Uint8Array.from(atob(range), (c) => c.charCodeAt(0)),
          { name: 'AES-GCM', length: 256 },
          true,
          ['decrypt'],
        );
        utilisableCommeCle = true;
      } catch {
        utilisableCommeCle = false;
      }
    }
    const enLocal = Object.keys(localStorage).filter((k) => k.toLowerCase().includes('coffre'));

    let enveloppe = null;
    try {
      const base = await new Promise((res, rej) => {
        const r = indexedDB.open('cyclades-cles');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (base.objectStoreNames.contains('cles')) {
        const cle = await new Promise((res, rej) => {
          const d = base.transaction('cles').objectStore('cles').get('encapsulation-session');
          d.onsuccess = () => res(d.result);
          d.onerror = () => rej(d.error);
        });
        enveloppe = cle
          ? { presente: true, extractible: cle.extractable, algo: cle.algorithm?.name }
          : { presente: false };
      }
      base.close();
    } catch {
      enveloppe = { presente: false, erreur: true };
    }
    return { range: Boolean(range), octets, utilisableCommeCle, enLocal, enveloppe };
  });

/* --- A. Ouvrir, et regarder ce qui a été écrit ---------------------------- */

console.log('\n  A — ce que l’ouverture écrit');

await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await ouvrirLaSession(page);
v('le coffre demande son mot de passe', await ouvrirLeCoffre(page), true);

const apresOuverture = await stockages(page);
v('quelque chose est rangé pour l’onglet', apresOuverture.range, true);
v(
  `ce n’est pas une clé AES-256 brute (${apresOuverture.octets} octets, non 32)`,
  apresOuverture.octets !== 32,
  true,
);
v('et s’en servir comme d’une clé échoue', apresOuverture.utilisableCommeCle, false);
v('rien dans localStorage', apresOuverture.enLocal, []);
v('l’enveloppe est dans IndexedDB', apresOuverture.enveloppe?.presente, true);
v('elle est NON extractible', apresOuverture.enveloppe?.extractible, false);
v(`et c’est bien une clé d’encapsulation (${apresOuverture.enveloppe?.algo})`, apresOuverture.enveloppe?.algo, 'AES-KW');

/* --- B. Écrire une note, par l'écran réel --------------------------------- */

console.log('\n  B — une note scellée par l’écran');

await page.fill('#note', NOTE);
await page.click('#enregistrer');
await page.waitForTimeout(800);

/* --- C. Naviguer et recharger ne redemandent rien ------------------------- */

console.log('\n  C — navigation et rechargement');

await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
await ouvrirLaSession(page);
await page.waitForTimeout(1000);
v(
  'après navigation, le coffre n’est pas redemandé',
  await page.locator('#mdp-coffre').isVisible().catch(() => false),
  false,
);

await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await ouvrirLaSession(page);
await page.waitForTimeout(1200);
v(
  'après rechargement non plus',
  await page.locator('#mdp-coffre').isVisible().catch(() => false),
  false,
);

/* --- D. Fermer efface les deux ------------------------------------------- */

console.log('\n  D — fermer efface le chiffré ET l’enveloppe');

await page.click('#fermer-coffre');
await page.locator('#coffre-ferme').waitFor({ state: 'visible', timeout: 10000 });
await page.waitForTimeout(600);
/*
   Rechargement avant de relever : sans lui, le champ garderait simplement ce
   qui y a été tapé, et le contrôle E mesurerait sa propre saisie plutôt que
   le déchiffrement. C'est précisément l'erreur qu'il doit éviter.
*/
const apresFermeture = await stockages(page);
v('plus rien pour l’onglet', apresFermeture.range, false);
v('et l’enveloppe a disparu', apresFermeture.enveloppe?.presente, false);

/* --- E. Rouvrir : la note est retrouvée ---------------------------------- */
/*
   LE contrôle de cette phase. Si la dérivation de la clé avait changé, ou si
   l'encapsulation avait altéré quoi que ce soit, la note serait perdue — et
   c'est le seul défaut de ce lot qui se paierait en données, pas en écran.
*/

console.log('\n  E — rouvrir, et retrouver ce qui a été scellé');

await page.reload({ waitUntil: 'networkidle' });
await ouvrirLaSession(page);
v('le coffre redemande bien son mot de passe', await ouvrirLeCoffre(page), true);
await page.waitForTimeout(1500);
/*
   La note est relue DANS LE CHAMP, pas dans le corps de la page — l'écran la
   réinjecte depuis l'enregistrement déchiffré. Mon premier contrôle regardait
   le texte de la page et sortait rouge alors que la donnée était intacte :
   un contrôle faux, corrigé après avoir constaté que l'enregistrement existait
   bel et bien dans le magasin scellé.
*/
const relue = await page.inputValue('#note').catch(() => '');
v('la note scellée avant la fermeture est relue', relue, NOTE);
v(
  'et l’écran dit l’avoir notée',
  /Noté à \d{2}:\d{2}/.test((await page.textContent('body')) ?? ''),
  true,
);

const apresReouverture = await stockages(page);
v('une enveloppe neuve a été créée', apresReouverture.enveloppe?.presente, true);
v('toujours non extractible', apresReouverture.enveloppe?.extractible, false);

/* --- F. Un onglet neuf redemande le coffre ------------------------------- */

console.log('\n  F — la frontière de la session');

/*
   Ce contrôle disait, en phase 1 : « un onglet neuf redemande le coffre ».
   La phase 3 a changé ce contrat **à dessein** — c'est la session
   multi-onglets de la décision 1 — et le contrôle est donc passé au rouge.
   Il n'est pas supprimé pour autant : il garde la frontière qui, elle, n'a
   pas bougé, et qui est celle qui compte. Le cas « case décochée », où
   l'onglet neuf redemande bien, est tenu par `essais:coffre-onglets`, D.
*/
const onglet = await ctx.newPage();
await onglet.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await ouvrirLaSession(onglet);
await onglet.waitForTimeout(2500);
v(
  'un onglet neuf hérite de la session (relais, case cochée par défaut)',
  await onglet.locator('#mdp-coffre').isVisible().catch(() => false),
  false,
);
await onglet.close();

/* La frontière, elle, tient : sans onglet donneur, rien ne passe. */
const etranger = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const p3 = await etranger.newPage();
await p3.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await ouvrirLaSession(p3);
await p3.waitForTimeout(2500);
v(
  'mais un contexte sans donneur redemande le coffre',
  await p3.locator('#mdp-coffre').isVisible().catch(() => false),
  true,
);
await etranger.close();

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
