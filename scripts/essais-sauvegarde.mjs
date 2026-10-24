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

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
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
  /* Depuis la version 13, ces magasins n'ont plus de compteur auto-incrémenté :
     un enregistrement sans « id » est refusé, et « add » lève sur-le-champ. Le
     semis pose donc son propre identifiant, comme l'application le fait. */
  let compteur = 0;
  const idEssai = () => `01ESSAI${String(compteur++).padStart(19, '0')}`;
  const ajouter = (n, v) => new Promise((ok) => { const r = base.transaction(n,'readwrite').objectStore(n).add({ id: idEssai(), ...v }); r.onsuccess = () => ok(); r.onerror = () => ok(); });
  const mettre = (n, v) => new Promise((ok) => { const r = base.transaction(n,'readwrite').objectStore(n).put(v); r.onsuccess = () => ok(); r.onerror = () => ok(); });
  await ajouter('nback', { le: '2026-01-01T00:00:00.000Z', n: 2, taux: 0.9, statut: 'terminee', secondes: 60 });
  await ajouter('relationnel', { le: '2026-01-01T00:00:00.000Z', items: [{ moteur: 'algebre-cachee', systeme: 'line', note: 1 }], tentes: 1, reussis: 1, secondes: 30 });
  await ajouter('vmSessions', { le: '2026-01-01T00:00:00.000Z', famille: 'prothetique', mode: 'squelette', charge: 1, essais: 10, reussis: 7, paires: [], seuilMedian: 5, secondes: 60 });
  await mettre('vmSeuils', { id: 'taille>luminosite', famille: 'prothetique', de: 'taille', vers: 'luminosite', horsFamille: false, transmodale: false, escalier: { delta: 10, bonnesDeSuite: 0, inversions: [], derniereDirection: null, essais: 5, reussis: 3 }, seuil: null, statut: 'en-cours', majLe: '2026-01-01T00:00:00.000Z' });
});
console.log('après semis      :', JSON.stringify(await compter()));

/*
 * Le fichier d'essai, fabriqué sans bouton.
 *
 * Il venait du bouton « Exporter ma progression ». Ce bouton est retiré
 * (D-008) : Cyclades ne produit plus de JSON, parce que trois mécanismes se
 * disputaient le même geste. L'**import**, lui, reste — les fichiers déjà
 * exportés doivent rester lisibles —, et c'est précisément ce que cet essai
 * vérifie : qu'une restauration en mode « Remplacer » efface réellement,
 * deux fois de suite, sans laisser de doublon.
 *
 * Le fichier est donc assemblé depuis IndexedDB, dans la forme que
 * « importerTout » attend. Cette forme est écrite ici une seconde fois, et
 * c'est assumé : si elle dérive de celle du lecteur, l'import échouera et
 * l'essai avec lui — la duplication se contrôle elle-même, ce qui est
 * exactement ce qu'on demande à un essai de régression de format.
 *
 * Les champs facultatifs — profil, planification, réglages, sélections — sont
 * omis volontairement : l'essai porte sur l'effacement des magasins à clé, et
 * un paquet minimal prouve de surcroît que le lecteur tolère l'absence.
 */
const chemin = `${S}/sauvegarde-test.json`;
const contenu = await page.evaluate(async () => {
  const base = await new Promise((ok, non) => {
    const d = indexedDB.open('revinsp');
    d.onsuccess = () => ok(d.result);
    d.onerror = () => non(d.error);
  });
  const tout = (magasin) =>
    new Promise((ok) => {
      if (!base.objectStoreNames.contains(magasin)) return ok([]);
      const r = base.transaction(magasin, 'readonly').objectStore(magasin).getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok([]);
    });
  const MAGASINS = [
    'cartes', 'fiches', 'quiz', 'jours', 'nback', 'seances', 'qcmDgfip', 'qcmSessions',
    'relationnel', 'vmSeuils', 'vmSessions', 'journal', 'competences', 'difficultes', 'aides',
  ];
  const paquet = { format: 'revinsp-progression', version: 1, exporteLe: new Date().toISOString() };
  for (const m of MAGASINS) paquet[m] = await tout(m);
  return JSON.stringify(paquet, null, 2);
});
writeFileSync(chemin, contenu);
console.log(`export           : ${contenu.length} octets`);

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
