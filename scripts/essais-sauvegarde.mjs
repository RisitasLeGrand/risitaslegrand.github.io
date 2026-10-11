/**
 * Aller-retour de sauvegarde par l'interface réelle.
 *
 * On sème des enregistrements dans les quatre magasins qui étaient oubliés du
 * mode « remplacement », on exporte par le bouton, puis on restaure **deux
 * fois** par le champ de fichier. Effacement complet ⇒ le compte reste stable ;
 * effacement partiel ⇒ il double.
 */
// Playwright n'est pas une dépendance du projet : le contrôle s'exécute à la
// demande, avec un navigateur installé hors du dépôt. Adaptez les deux chemins
// ci-dessous à votre installation, puis lancez « astro preview » avant ce script.
import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync } from 'node:fs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const S = process.env.DOSSIER_ESSAIS ?? '/tmp';

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1000, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

await page.goto('http://localhost:4321/progression', { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(()=>false)) { await page.fill('#champ-mdp',MDP); await page.click('#bouton-verrou'); await page.waitForTimeout(2500); }

const compter = () => page.evaluate(async () => {
  const base = await new Promise((ok) => { const r = indexedDB.open('revinsp'); r.onsuccess = () => ok(r.result); });
  const lire = (n) => new Promise((ok) => { const r = base.transaction(n).objectStore(n).getAll(); r.onsuccess = () => ok(r.result); });
  return { nback: (await lire('nback')).length, relationnel: (await lire('relationnel')).length, vmSeuils: (await lire('vmSeuils')).length, vmSessions: (await lire('vmSessions')).length };
});

await page.evaluate(async () => {
  const base = await new Promise((ok) => { const r = indexedDB.open('revinsp'); r.onsuccess = () => ok(r.result); });
  const ajouter = (n, v) => new Promise((ok) => { const r = base.transaction(n,'readwrite').objectStore(n).add(v); r.onsuccess = () => ok(); r.onerror = () => ok(); });
  const mettre = (n, v) => new Promise((ok) => { const r = base.transaction(n,'readwrite').objectStore(n).put(v); r.onsuccess = () => ok(); r.onerror = () => ok(); });
  await ajouter('nback', { le: '2026-01-01T00:00:00.000Z', n: 2, taux: 0.9, statut: 'terminee', secondes: 60 });
  await ajouter('relationnel', { le: '2026-01-01T00:00:00.000Z', items: [{ moteur: 'algebre-cachee', systeme: 'line', note: 1 }], tentes: 1, reussis: 1, secondes: 30 });
  await ajouter('vmSessions', { le: '2026-01-01T00:00:00.000Z', famille: 'prothetique', mode: 'squelette', charge: 1, essais: 10, reussis: 7, paires: [], seuilMedian: 5, secondes: 60 });
  await mettre('vmSeuils', { id: 'taille>luminosite', famille: 'prothetique', de: 'taille', vers: 'luminosite', horsFamille: false, transmodale: false, escalier: { delta: 10, bonnesDeSuite: 0, inversions: [], derniereDirection: null, essais: 5, reussis: 3 }, seuil: null, statut: 'en-cours', majLe: '2026-01-01T00:00:00.000Z' });
});
console.log('après semis      :', JSON.stringify(await compter()));

// Export par le bouton.
const [telechargement] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.getByRole('button', { name: /Exporter|Télécharger|sauvegarde/i }).first().click(),
]);
const chemin = `${S}/sauvegarde-test.json`;
await telechargement.saveAs(chemin);
const taille = readFileSync(chemin, 'utf8').length;
console.log(`export           : ${taille} octets`);

// Deux restaurations en mode « remplacement ».
for (const passe of [1, 2]) {
  await page.locator('input[name=mode][value=remplacement]').check();
  await page.setInputFiles('#fichier', chemin);
  await page.waitForTimeout(2500);
  console.log(`après import ${passe}   :`, JSON.stringify(await compter()));
}

const final = await compter();
await nav.close();
const ok = final.nback === 1 && final.relationnel === 1 && final.vmSeuils === 1 && final.vmSessions === 1;
console.log(ok ? '\n✓ « Remplacer » efface bien : aucun doublon après deux restaurations' : '\n✖ doublons : l\'effacement reste partiel');
process.exit(ok ? 0 : 1);
