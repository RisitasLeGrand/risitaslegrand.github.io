/**
 * L'écran de l'ordinateur certifié, en navigateur.
 *
 * Ce que cet essai couvre : la décision locale, son annonce par un fait écrit
 * **par** l'appareil **sur** lui-même, l'enregistrement du *service worker*, la
 * permission de notifier, les états de la veille, et la marque « automatique »
 * dans l'historique des fusions.
 *
 * Ce qu'il ne couvre pas, et pourquoi : l'échange automatique de bout en bout.
 * Il passe par un relais Nostr public, et la politique réseau de cette machine
 * refuse la connexion — un CONNECT 403 du mandataire. Le chemin d'échange
 * lui-même est le **même** que celui de `essais:liaison` et `essais:transport`,
 * qui l'éprouvent : seul le déclencheur diffère. C'est à vérifier sur appareil,
 * et c'est dit plutôt que supposé.
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

const contexte = await nav.newContext({
  // La permission est accordée d'avance : « Notification.requestPermission »
  // ouvre une invite que Playwright ne peut pas cliquer, et ce n'est pas
  // l'invite qu'on éprouve — c'est ce que l'écran fait de la réponse.
  permissions: ['notifications'],
});
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

async function aller(chemin, selecteur) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector(selecteur, { timeout: 30000 });
}

const journal = () =>
  page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const ops = await new Promise((ok) => {
      const q = base.transaction('operations').objectStore('operations').getAll();
      q.onsuccess = () => ok(q.result);
    });
    const certification = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get('certification');
      q.onsuccess = () => ok(q.result ?? null);
    });
    base.close();
    return {
      annonces: ops
        .filter((o) => o.type === 'appareil.certifie')
        .map((o) => ({ parSoi: o.appareil === o.cible, certifie: o.charge?.certifie })),
      certification,
    };
  });

console.log('\nL’ÉCRAN DE L’ORDINATEUR CERTIFIÉ');

await aller('/appareils/', '#ecran:not(.hidden)');

console.log('\n1. Avant certification');
v('l’état est inactif', (await page.textContent('#etat-certification')).trim(), 'inactif');
vrai('le bouton « Certifier » est offert', await page.locator('#certifier').isVisible());
vrai('celui qui retire est caché', !(await page.locator('#decertifier').isVisible()));

{
  const identite = (await page.textContent('#identite-certification')).replace(/\s+/g, ' ');
  vrai('l’écran dit lequel on certifie : empreinte', identite.includes('Empreinte'));
  vrai('et identifiant', identite.includes('Identifiant'));
}

{
  const texte = (await page.textContent('#certification')).replace(/\s+/g, ' ');
  vrai(
    'la restriction est écrite, pas en note de bas de page',
    texte.includes('rien ne se synchronise') && texte.includes('ne peut pas tourner tout seul'),
  );
  vrai('aucune notification instantanée n’est promise', texte.includes('aucune notification instantanée'));
  vrai('les sept jours d’annulation sont dits', texte.includes('sept jours'));
}

console.log('\n2. Certification');
await page.click('#certifier');
await page.waitForSelector('#message-certification:not(.hidden)', { timeout: 30000 });

v('l’état passe à actif', (await page.textContent('#etat-certification')).trim(), 'actif');
vrai('le bouton de retrait apparaît', await page.locator('#decertifier').isVisible());
vrai('celui de certification disparaît', !(await page.locator('#certifier').isVisible()));

{
  const message = (await page.textContent('#message-certification')).replace(/\s+/g, ' ');
  vrai('le message dit ce que cela veut dire', message.includes('sans geste'));
}

{
  const lu = await journal();
  v('la décision est enregistrée localement', lu.certification?.certifie, true);
  v('et annoncée par un fait écrit par l’appareil sur lui-même', lu.annonces, [
    { parSoi: true, certifie: true },
  ]);
}

{
  const veille = (await page.textContent('#veille-certification')).replace(/\s+/g, ' ').trim();
  vrai(
    'la veille dit honnêtement ce qui lui manque : aucun appairage',
    veille.includes('aucun appairage'),
  );
}

{
  const enregistre = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return Boolean(r);
  });
  vrai('le service worker est enregistré', enregistre);
  const permission = await page.evaluate(() => Notification.permission);
  v('la permission de notifier est accordée', permission, 'granted');
  vrai(
    'le bouton de permission ne s’affiche plus',
    !(await page.locator('#autoriser-avis').isVisible()),
  );
}

console.log('\n3. La marque « automatique » dans l’historique');

await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const lots = [
    {
      lot: '01AUTOMATIQUE00000000000000',
      le: new Date().toISOString(),
      appareil: 'BBBB2222',
      nomAppareil: 'Téléphone',
      operations: 11,
      revisions: 8,
      cartes: ['c-1', 'c-2'],
      automatique: true,
    },
    {
      lot: '01MANUEL0000000000000000000',
      le: new Date(Date.now() - 3600_000).toISOString(),
      appareil: 'BBBB2222',
      nomAppareil: 'Téléphone',
      operations: 2,
      revisions: 0,
      cartes: [],
    },
  ];
  await new Promise((ok) => {
    const tx = base.transaction('etat', 'readwrite');
    tx.objectStore('etat').put(lots, 'lotsRecus');
    tx.oncomplete = () => ok();
  });
  base.close();
});

await aller('/appareils/', '#ecran:not(.hidden)');
{
  const lignes = await page.$$eval('#lots > li', (l) =>
    l.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  v('les deux synchronisations sont listées', lignes.length, 2);
  vrai('la fusion automatique est marquée comme telle', lignes[0].includes('⟳ automatique'));
  vrai('et sa date limite d’annulation est écrite', lignes[0].includes('Annulable jusqu’au'));
  vrai('la fusion demandée n’est pas marquée', !lignes[1].includes('automatique'));
}

console.log('\n4. Retrait de la certification');
await page.click('#decertifier');
await page.waitForFunction(
  () => document.getElementById('etat-certification').textContent.trim() === 'inactif',
  undefined,
  { timeout: 30000 },
);
v('l’état revient à inactif', (await page.textContent('#etat-certification')).trim(), 'inactif');
{
  const lu = await journal();
  v('la décision locale est retirée', lu.certification?.certifie, false);
  v('et le retrait est annoncé', lu.annonces.at(-1), { parSoi: true, certifie: false });
  const message = (await page.textContent('#message-certification')).replace(/\s+/g, ' ');
  vrai('rien n’est perdu, et l’écran le dit', message.includes('rien de ce qu’il a n’est perdu'));
}

await nav.close();
console.log(
  echecs === 0
    ? '\nTous les essais de certification en navigateur passent.\n'
    : `\n${echecs} échec(s).\n`,
);
process.exit(echecs === 0 ? 0 : 1);
