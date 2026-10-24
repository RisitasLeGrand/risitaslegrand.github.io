/**
 * L'export pour une IA, par l'interface réelle.
 *
 * Ce que cet essai couvre, et qu'aucun essai pur ne peut couvrir : que les
 * catégories sensibles soient **décochées à l'ouverture** et demandent une
 * confirmation, que l'aperçu précède tout téléchargement, que l'empreinte et le
 * vecteur de versions soient bien calculés sur la base réelle, et que le
 * journal retienne l'identifiant **sans le contenu**.
 *
 * Playwright n'est pas une dépendance du projet : fournissez CHROMIUM et lancez
 * « astro preview » avant ce script.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaBoite } from './lib/boite-essais.mjs';

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
const faux = (titre, condition) => v(titre, condition, false);

const contexte = await nav.newContext({ acceptDownloads: true });
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250));
});

/**
 * La réponse aux confirmations, depuis la boîte commune (C1 du 43).
 *
 * Les quinze `confirm()` du site ont été remplacés par un `<dialog>` modal.
 * Cet essai écoutait encore `page.on('dialog')`, c'est-à-dire la fenêtre
 * native : elle ne s'ouvre plus, donc plus rien ne répondait, la case
 * sensible restait décochée par accident — l'assertion passait pour la
 * mauvaise raison — et la feuille restée ouverte arrêtait le clic suivant
 * (« dialog.boite … intercepts pointer events »).
 *
 * On répond donc à la boîte, par le LIBELLÉ du bouton : « Inclure quand
 * même » pour accepter, « Annuler » pour refuser. Le refus reste le défaut,
 * pour que l'oubli se voie.
 */
const repondre = async (accepter) =>
  repondreALaBoite(page, accepter ? 'Inclure quand même' : 'Annuler');

await page.goto(`${RACINE}/robots.txt`);
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await franchirInitialisation(page, RACINE, MDP);

/* Des séances sur le mois en cours, pour que l'export ait de quoi parler. */
const semees = await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const aujourdhui = new Date();
  const seances = [];
  for (let i = 1; i <= 4; i += 1) {
    const jour = new Date(
      Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), i),
    )
      .toISOString()
      .slice(0, 10);
    seances.push({
      id: `01EXPORTESSAI${i}0000000000000`.slice(0, 26),
      jour,
      statut: 'terminee',
      theme: 'droit-public',
      secondes: 3600,
      termineeLe: `${jour}T10:00:00.000Z`,
      fiches: [],
      etendue: false,
    });
  }
  await new Promise((ok, ko) => {
    const tx = base.transaction('seances', 'readwrite');
    for (const s of seances) tx.objectStore('seances').put(s);
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
  return seances.length;
});
v('quatre séances sont semées', semees, 4);

console.log('\nLES CATÉGORIES SENSIBLES SONT DÉCOCHÉES, ET SE CONFIRMENT');

await page.goto(`${RACINE}/exporter-ia/`, { waitUntil: 'networkidle' });
if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
  await page.fill('#champ-mdp', MDP);
  await page.click('#bouton-verrou');
}
await page.waitForSelector('#categories input[type="checkbox"]', { timeout: 40000 });

{
  const cases = await page.$$eval('#categories input[type="checkbox"]', (els) =>
    els.map((e) => ({ id: e.dataset.categorie, coche: e.checked })),
  );
  v('onze catégories sont proposées', cases.length, 11);
  v(
    'trois sont cochées au départ',
    cases.filter((c) => c.coche).map((c) => c.id),
    ['indicateurs', 'series', 'qualite'],
  );
  faux('le profil est décoché', cases.find((c) => c.id === 'profil')?.coche ?? true);
  faux('les textes libres aussi', cases.find((c) => c.id === 'textes')?.coche ?? true);
  for (const sensible of ['sante', 'psyche', 'finances']) {
    faux(`« ${sensible} » est décochée`, cases.find((c) => c.id === sensible)?.coche ?? true);
  }
}
{
  /* Cocher une sensible demande confirmation, et un refus la laisse décochée. */
  await page.click('#categories input[data-categorie="sante"]');
  await repondre(false);
  faux(
    'une confirmation refusée laisse la catégorie sensible décochée',
    await page.locator('#categories input[data-categorie="sante"]').isChecked(),
  );
  await page.click('#categories input[data-categorie="sante"]');
  await repondre(true);
  vrai(
    'une confirmation acceptée la coche',
    await page.locator('#categories input[data-categorie="sante"]').isChecked(),
  );
  /* On la retire : l'export d'essai n'a aucune raison de la porter. */
  await page.click('#categories input[data-categorie="sante"]');
  await page.waitForTimeout(200);
  faux(
    'et la décocher ne demande rien',
    await page.locator('#categories input[data-categorie="sante"]').isChecked(),
  );
}
{
  /*
     Une case non sensible ne demande aucune confirmation. On le MESURE :
     aucune boîte ne doit s'ouvrir, et la case doit être cochée. Attendre
     une boîte qui ne vient pas serait attendre trente secondes ; on
     constate donc son absence, puis l'effet.
  */
  await page.click('#categories input[data-categorie="profil"]');
  await page.waitForTimeout(400);
  faux(
    'une catégorie non sensible n’ouvre aucune boîte',
    await page.locator('dialog.boite[open]').isVisible().catch(() => false),
  );
  vrai(
    'une catégorie non sensible se coche sans confirmation',
    await page.locator('#categories input[data-categorie="profil"]').isChecked(),
  );
  await page.click('#categories input[data-categorie="profil"]');
}

console.log('\nL’APERÇU PRÉCÈDE TOUT TÉLÉCHARGEMENT');

faux('aucun aperçu à l’ouverture', await page.locator('#apercu').isVisible());
await page.click('#apercevoir');
await page.waitForSelector('#apercu:not(.hidden)', { timeout: 60000 });

{
  const resume = (await page.locator('#resume-export').textContent()) ?? '';
  vrai('l’aperçu annonce l’identifiant de l’export', /Export 0[0-9A-Z]{25}/.test(resume));
  vrai('et le nombre de fichiers', resume.includes('9 fichiers'));
  const taille = (await page.locator('#taille').textContent()) ?? '';
  vrai('la taille est annoncée', /ko|Mo/.test(taille));
  vrai('et une estimation de jetons', taille.includes('jetons'));
  faux('aucun problème n’est signalé', await page.locator('#problemes').isVisible());
}
{
  const fichiers = await page.$$eval('#fichiers [data-fichier]', (els) =>
    els.map((e) => e.dataset.fichier),
  );
  v('neuf fichiers sont listés, manifeste compris', fichiers.length, 9);
  for (const attendu of [
    'LISEZMOI.md',
    'synthese.md',
    'indicateurs.json',
    'series/series.json',
    'contexte.md',
    'qualite-des-donnees.md',
    'schema-analyse.json',
    'exemple-analyse.json',
    'manifest.json',
  ]) {
    vrai(`« ${attendu} » est là`, fichiers.includes(attendu));
  }
}
{
  const extraits = await page.$$eval('#extraits details', (els) =>
    els.map((e) => ({
      nom: e.querySelector('summary')?.textContent ?? '',
      debut: e.querySelector('pre')?.textContent?.slice(0, 400) ?? '',
    })),
  );
  const manifeste = extraits.find((x) => x.nom === 'manifest.json');
  vrai(
    'le manifeste s’ouvre sur son format et son identifiant',
    /"format": "cyclades-export"/.test(manifeste?.debut ?? ''),
  );
  const lisezmoi = extraits.find((x) => x.nom === 'LISEZMOI.md');
  vrai('le LISEZMOI s’ouvre sur le titre de l’export', (lisezmoi?.debut ?? '').includes('Export Cyclades pour analyse'));
}

console.log('\nLE JOURNAL RETIENT L’IDENTIFIANT, PAS LE CONTENU');

vrai('le journal est vide avant tout export', await page.locator('#journal-vide').isVisible());
let empreinteDuManifeste = '';
{
  /* Playwright capture les téléchargements : neuf fichiers, neuf captures. */
  const captures = [];
  const contenus = new Map();
  page.on('download', async (d) => {
    captures.push(d.suggestedFilename());
    const chemin = await d.path().catch(() => null);
    if (chemin) contenus.set(d.suggestedFilename(), readFileSync(chemin, 'utf8'));
  });
  await page.click('#telecharger');
  await page.waitForSelector('#message-export:not(.hidden)', { timeout: 30000 });
  await page.waitForTimeout(1500);
  v('neuf fichiers sont téléchargés', captures.length, 9);
  vrai(
    'et le sous-dossier est aplati dans le nom',
    captures.includes('series-series.json'),
  );

  /*
     Le manifeste **tel qu'il est téléchargé**, et non tel que l'aperçu le
     tronque : c'est le fichier qui part, et c'est celui-là qui doit porter une
     empreinte vérifiable.
  */
  const manifeste = JSON.parse(contenus.get('manifest.json') ?? '{}');
  vrai('le manifeste téléchargé porte une empreinte sha256', /^sha256:[0-9a-f]{64}$/.test(manifeste.empreinte ?? ''));
  empreinteDuManifeste = manifeste.empreinte ?? '';
  v('il porte le format de l’export', manifeste.format, 'cyclades-export');
  v('et sa portée', manifeste.portee, 'globale');
  vrai('le vecteur de versions nomme au moins un appareil', Object.keys(manifeste.vecteur_de_versions?.bornes ?? {}).length >= 1);
  v('aucune compaction n’a eu lieu', manifeste.vecteur_de_versions?.compaction, {});
  v('les huit autres fichiers y sont pesés', (manifeste.fichiers ?? []).length, 8);
  faux(
    'et le manifeste ne se pèse pas lui-même',
    (manifeste.fichiers ?? []).some((f) => f.nom === 'manifest.json'),
  );

  /* L'exemple servi cite bien l'identifiant de cet export-là. */
  const exemple = JSON.parse(contenus.get('exemple-analyse.json') ?? '{}');
  v('l’exemple reprend l’identifiant de l’export', exemple.export_id, manifeste.export_id);
  const message = (await page.locator('#message-export').textContent()) ?? '';
  vrai('le message dit que l’export est inscrit', message.includes('inscrit au journal'));
  vrai('et qu’aucune copie n’est conservée', message.includes('Aucune copie'));
}
{
  const entrees = await page.$$eval('#journal > div', (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
  );
  v('une entrée est au journal', entrees.length, 1);
  vrai('elle porte un identifiant', /0[0-9A-Z]{25}/.test(entrees[0]));
  vrai('une empreinte', /sha256:[0-9a-f]{64}/.test(entrees[0]));
  vrai('la portée', entrees[0].includes('globale'));
  vrai('les catégories', entrees[0].includes('indicateurs'));
  faux('et aucun contenu de fichier', entrees[0].includes('Export Cyclades pour analyse'));
  vrai(
    'l’empreinte du journal est celle du manifeste téléchargé',
    entrees[0].includes(empreinteDuManifeste),
  );
}
{
  /* L'opération journalisée ne doit porter aucun contenu, pas seulement l'écran. */
  const charge = await page.evaluate(async () => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const tout = await new Promise((ok, ko) => {
      const demande = base.transaction('operations').objectStore('operations').getAll();
      demande.onsuccess = () => ok(demande.result);
      demande.onerror = () => ko(demande.error);
    });
    base.close();
    const exports = tout.filter((o) => o.type === 'export.ia');
    return { combien: exports.length, charge: JSON.stringify(exports[0]?.charge ?? null) };
  });
  v('une seule opération d’export est journalisée', charge.combien, 1);
  vrai('elle porte l’identifiant et l’empreinte', /export_?[Ii]d|exportId/.test(charge.charge));
  faux('et pas un octet de contenu', charge.charge.includes('Export Cyclades pour analyse'));
  vrai('elle porte le poids, pour savoir ce qui a été confié', charge.charge.includes('octets'));
}

console.log('\nLA VARIANTE FICHIER UNIQUE');

{
  const captures = [];
  page.on('download', (d) => captures.push(d.suggestedFilename()));
  await page.click('#telecharger-unique');
  await page.waitForTimeout(800);
  v('un seul fichier est téléchargé', captures.length, 1);
  v('et il porte le nom attendu', captures[0], 'export-cyclades.md');
  const entrees = await page.$$eval('#journal > div', (els) => els.length);
  v('et il est inscrit au journal comme les autres', entrees, 2);
}

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
