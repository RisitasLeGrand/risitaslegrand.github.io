/**
 * L'aller-retour complet d'une sauvegarde `.cyclades`, dans un vrai navigateur.
 *
 * Les essais de `format.ts` prouvent que le conteneur est juste. Ils ne prouvent
 * pas que l'écran sait s'en servir, ni que la restauration remet réellement la
 * progression en place — et c'est pourtant le seul moment qui compte, celui où
 * l'on vient de tout perdre.
 *
 * Le scénario est donc celui du pire jour : on travaille, on sauvegarde, on
 * efface tout, on restaure, et l'on vérifie que la progression est revenue.
 */
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};

const connecter = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(3000);
  }
};

/** Le contenu d'un magasin, lu directement : aucun écran n'est interrogé. */
const lire = (magasin) =>
  page.evaluate(async (nom) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const res = await new Promise((ok) => {
      const q = base.transaction(nom).objectStore(nom).getAll();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return res;
  }, magasin);

/* ── Un état de départ reconnaissable ─────────────────────────────────── */

const SEANCE = {
  id: 1,
  theme: 'droit-public',
  jour: '2026-03-04',
  statut: 'terminee',
  secondes: 3600,
  note: 'Une note de séance qu’il faut absolument retrouver après restauration.',
  restitutions: {},
  etendue: false,
};
const JOUR = { jour: '2026-03-04', xp: 120, cartes: 30, quiz: 2, bonnes: 25, reponses: 30, secondes: 3600 };
const CARTE = {
  id: 'fiche-temoin:0',
  ficheId: 'fiche-temoin',
  matiere: 'Droit public',
  du: '2026-04-01',
  derniereRevision: '2026-03-04T10:00:00.000Z',
  intervalle: 28,
  revisions: 7,
  oublis: 1,
  fsrs: {
    due: '2026-04-01T10:00:00.000Z',
    stability: 42.5,
    difficulty: 5.25,
    elapsed_days: 12,
    scheduled_days: 28,
    learning_steps: 0,
    reps: 7,
    lapses: 1,
    state: 2,
    last_review: '2026-03-04T10:00:00.000Z',
  },
};

console.log('\nUN ÉTAT DE DÉPART');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2000);

await page.evaluate(
  async ({ seance, jour, carte }) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    await new Promise((ok, ko) => {
      const tx = base.transaction(['seances', 'jours', 'cartes'], 'readwrite');
      tx.objectStore('seances').put(seance);
      tx.objectStore('jours').put(jour);
      tx.objectStore('cartes').put(carte);
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
  },
  { seance: SEANCE, jour: JOUR, carte: CARTE },
);

v('la séance témoin est en base', (await lire('seances')).length, 1);
v('la carte témoin aussi', (await lire('cartes')).length, 1);

console.log('\nL’ÉTAT DE SAUVEGARDE S’AFFICHE, ET DIT LA VÉRITÉ');

await page.reload({ waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2500);
v(
  'aucune sauvegarde n’a encore été faite',
  (await page.locator('#etat-sauvegarde-titre').textContent())?.trim(),
  'Jamais sauvegardé',
);

console.log('\nSAUVEGARDER');

await page.fill('#mdp-sauvegarde', MDP);
const attenteFichier = page.waitForEvent('download', { timeout: 120000 });
await page.click('#sauvegarder');
const telechargement = await attenteFichier;
const chemin = await telechargement.path();
const octets = await readFile(chemin);

v('le nom du fichier suit la convention', /^cyclades-sauvegarde-\d{4}-\d{2}-\d{2}-\d{4}\.cyclades$/.test(telechargement.suggestedFilename()), true);
v('le fichier s’annonce dès sa première ligne', octets.subarray(0, 19).toString('utf8'), 'CYCLADES-SAUVEGARDE');
v('il ne contient pas le mot de passe', octets.toString('latin1').includes(MDP), false);
v(
  'il ne contient pas la note de séance en clair',
  octets.toString('latin1').includes('qu’il faut absolument retrouver'),
  false,
);

await page.waitForTimeout(1500);
/*
   A3 DU 43 — LA DATE N'EST NOTÉE QU'APRÈS CONFIRMATION.

   Cette assertion exigeait « Sauvegarde à jour » juste après le clic. Elle
   figeait donc le défaut qu'A3 corrige : l'écran affirmait une sauvegarde
   réussie alors que `click()` ne prouve rien — le fichier peut n'être jamais
   arrivé, et sur iPhone cela arrive.

   L'essai fait maintenant ce qu'une personne fait : il constate que le
   téléchargement est lancé, que la date n'a pas encore bougé, puis il
   confirme avoir retrouvé le fichier — ce qu'il a de fait sous la main,
   puisqu'il vient de le lire pour en vérifier le contenu.
*/
v(
  'l’écran annonce un téléchargement lancé, pas une réussite',
  /[Tt]éléchargement lancé/.test((await page.locator('#message-sauvegarde').textContent()) ?? ''),
  true,
);
v(
  'et la date n’est pas encore notée',
  (await page.locator('#etat-sauvegarde-titre').textContent())?.trim(),
  'Jamais sauvegardé',
);
await page.click('#sauvegarde-retrouvee');
await page.waitForTimeout(1500);
v(
  'une fois le fichier retrouvé, l’écran note la sauvegarde',
  (await page.locator('#etat-sauvegarde-titre').textContent())?.trim(),
  'Sauvegarde à jour',
);
v('le reçu est affiché', await page.locator('#recu-sauvegarde').isVisible(), true);
v(
  'le champ de mot de passe est vidé après usage',
  await page.inputValue('#mdp-sauvegarde'),
  '',
);

console.log('\nTOUT EFFACER');

await page.evaluate(
  async () =>
    new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const base = r.result;
        const tx = base.transaction(['seances', 'jours', 'cartes'], 'readwrite');
        tx.objectStore('seances').clear();
        tx.objectStore('jours').clear();
        tx.objectStore('cartes').clear();
        tx.oncomplete = () => {
          base.close();
          ok();
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
);
v('plus aucune séance', (await lire('seances')).length, 0);
v('plus aucune carte', (await lire('cartes')).length, 0);

console.log('\nVÉRIFIER AVANT D’APPLIQUER');

await page.setInputFiles('#fichier-cyclades', chemin);
await page.waitForTimeout(1500);
v('l’aperçu s’affiche', await page.locator('#apercu-cyclades').isVisible(), true);
v('rien n’a encore été appliqué', (await lire('seances')).length, 0);
v(
  'le message dit que rien n’est appliqué',
  /rien n’a encore été appliqué/i.test((await page.locator('#message-cyclades').textContent()) ?? ''),
  true,
);
v(
  'le mot de passe est demandé, la sauvegarde étant chiffrée',
  await page.locator('#bloc-mdp-restauration').isVisible(),
  true,
);

console.log('\nUN MAUVAIS MOT DE PASSE EST REFUSÉ, SANS RIEN CASSER');

page.on('dialog', (d) => d.accept());
await page.fill('#mdp-restauration', 'pas-le-bon-mot-de-passe');
await page.uncheck('#avec-instantane');
/*
   « Appliquer » passe par la boîte commune depuis que `src/lib/boite.ts`
   remplace les quinze `confirm()` du site. L'essai ne le savait pas : il
   cliquait, la boîte s'ouvrait, et le clic suivant tombait dessus — un
   « dialog intercepts pointer events » pendant trente secondes, puis une
   panne. Le contrôle suivait un écran qui n'existe plus.

   La confirmation fait donc partie du geste, comme pour la personne. On
   attend le bouton d'action, on l'appuie, et l'on constate la suite.
*/
const confirmerLeRemplacement = async () => {
  const action = page.locator('dialog.boite button', { hasText: 'Remplacer' }).first();
  await action.waitFor({ state: 'visible', timeout: 10_000 });
  await action.click();
};

await page.click('#appliquer-cyclades');
await confirmerLeRemplacement();
await page.waitForTimeout(3000);
const refus = (await page.locator('#message-cyclades').textContent()) ?? '';
v('le refus est expliqué', /n’ouvre pas cette sauvegarde/i.test(refus), true);
v('et il suggère l’ancien mot de passe', /ancien/i.test(refus), true);
v('la base n’a pas été touchée', (await lire('seances')).length, 0);

console.log('\nRESTAURER');

await page.fill('#mdp-restauration', MDP);
await page.click('#appliquer-cyclades');
await confirmerLeRemplacement();
await page.waitForTimeout(6000);

const seances = await lire('seances');
const cartes = await lire('cartes');
const jours = await lire('jours');

v('la séance est revenue', seances.length, 1);
v('avec sa note intacte', seances[0]?.note, SEANCE.note);
v('la carte est revenue', cartes.length, 1);
v('avec son état FSRS exact', cartes[0]?.fsrs, CARTE.fsrs);
/*
 * Le pointage du jour restauré est cherché par sa date, et non en comptant les
 * enregistrements : la page est restée ouverte pendant tout l'essai, et le
 * compteur de temps de révision a créé le pointage d'aujourd'hui. Deux
 * enregistrements est donc le résultat juste — un essai qui en exigeait un seul
 * mesurait le fait que la page était ouverte, pas la restauration.
 */
const restaure = jours.find((j) => j.jour === JOUR.jour);
v('le pointage du jour sauvegardé est revenu', Boolean(restaure), true);
v('avec ses compteurs', restaure?.xp, JOUR.xp);
v('et le pointage d’aujourd’hui existe à côté, la page étant ouverte', jours.length >= 1, true);
v(
  'le message annonce la réussite',
  /Restauration faite/i.test((await page.locator('#message-cyclades').textContent()) ?? ''),
  true,
);

console.log('\nUN FICHIER QUI N’EST PAS UNE SAUVEGARDE EST REFUSÉ');

const { writeFile } = await import('node:fs/promises');
const intrus = '/tmp/pas-une-sauvegarde.cyclades';
await writeFile(intrus, 'ceci n’est pas une sauvegarde\nni la seconde ligne\n');
await page.setInputFiles('#fichier-cyclades', intrus);
await page.waitForTimeout(1200);
v(
  'le refus est clair',
  /n’est pas une sauvegarde Cyclades/i.test((await page.locator('#message-cyclades').textContent()) ?? ''),
  true,
);
v('et l’aperçu reste fermé', await page.locator('#apercu-cyclades').isVisible(), false);

console.log('\nUN FICHIER TRONQUÉ EST REFUSÉ');

const tronque = '/tmp/tronquee.cyclades';
await writeFile(tronque, octets.subarray(0, octets.length - 50));
await page.setInputFiles('#fichier-cyclades', tronque);
await page.waitForTimeout(1200);
v(
  'la troncature est nommée',
  /incomplet ou abîmé/i.test((await page.locator('#message-cyclades').textContent()) ?? ''),
  true,
);

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
