/**
 * L'effacement ciblé dans un vrai navigateur : compter, puis effacer, et jamais
 * l'inverse.
 *
 * L'invariant central tient en une phrase : **« Compter » ne doit rien
 * toucher.** C'est la seule protection qui reste quand la personne s'est
 * trompée de domaine, et c'est le genre de garantie qu'une refonte casse sans
 * s'en apercevoir, puisqu'un comptage qui efface donne exactement le même
 * écran qu'un comptage qui compte.
 */
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { repondreALaBoite, repondreALaRedemande } from './lib/boite-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1200, height: 1100 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 220)));
page.on('dialog', (d) => d.accept());

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

const compter = (magasin) =>
  page.evaluate(async (nom) => {
    const base = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const n = await new Promise((ok) => {
      const q = base.transaction(nom).objectStore(nom).count();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return n;
  }, magasin);

/* ── Un historique étalé sur deux années ──────────────────────────────── */

console.log('\nUN HISTORIQUE SUR DEUX ANNÉES');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);
// Passer par un écran qui lit la base, pour qu'elle soit créée au bon schéma.
await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForTimeout(2500);

await page.evaluate(
  () =>
    new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const base = r.result;
        const tx = base.transaction(['nback', 'relationnel', 'vmSeuils', 'cartes'], 'readwrite');
        const nback = tx.objectStore('nback');
        const relationnel = tx.objectStore('relationnel');
        // Dix sessions en 2025, dix en 2026.
        for (let i = 0; i < 10; i += 1) {
          nback.put({
            id: i + 1,
            le: `2025-0${(i % 9) + 1}-15T10:00:00.000Z`,
            n: 2,
            dimensions: ['position'],
            nombreEpreuves: 20,
            taux: 0.8,
            reperees: 8,
            aReperer: 10,
            erreurs: 2,
            secondes: 300,
          });
          nback.put({
            id: i + 11,
            le: `2026-0${(i % 9) + 1}-15T10:00:00.000Z`,
            n: 3,
            dimensions: ['position', 'couleur'],
            nombreEpreuves: 20,
            taux: 0.7,
            reperees: 7,
            aReperer: 10,
            erreurs: 3,
            secondes: 300,
          });
        }
        relationnel.put({
          id: 1,
          le: '2025-05-15T10:00:00.000Z',
          items: [{ moteur: 'chaine-conclusion', systeme: 'line', note: 1 }],
          tentes: 1,
          reussis: 1,
          secondes: 60,
        });
        // Un état courant, sans historique : il ne doit pas se découper.
        tx.objectStore('vmSeuils').put({
          id: 'taille>intensite',
          famille: 'prothetique',
          de: 'taille',
          vers: 'intensite',
          horsFamille: false,
          transmodale: false,
          escalier: { delta: 4, bonnesDeSuite: 0, inversions: [], derniereDirection: null, essais: 10, reussis: 6 },
          seuil: 3.5,
          statut: 'en-cours',
          majLe: '2025-05-15T10:00:00.000Z',
        });
        // Et une carte, dans un autre domaine, qui ne doit pas être touchée.
        tx.objectStore('cartes').put({
          id: 'temoin:0',
          ficheId: 'temoin',
          matiere: 'Droit public',
          du: '2026-12-01',
          derniereRevision: '2025-01-01T10:00:00.000Z',
          intervalle: 30,
          revisions: 5,
          oublis: 1,
          fsrs: {
            due: '2026-12-01T10:00:00.000Z',
            stability: 30,
            difficulty: 5,
            elapsed_days: 10,
            scheduled_days: 30,
            learning_steps: 0,
            reps: 5,
            lapses: 1,
            state: 2,
          },
        });
        tx.oncomplete = () => {
          base.close();
          ok();
        };
        tx.onerror = () => ko(tx.error);
      };
    }),
);

v('vingt sessions de n-back', await compter('nback'), 20);
v('une session relationnelle', await compter('relationnel'), 1);
v('un seuil Veridical', await compter('vmSeuils'), 1);
v('une carte témoin', await compter('cartes'), 1);

/* ── Compter ne touche à rien ─────────────────────────────────────────── */

console.log('\n« COMPTER » NE TOUCHE À RIEN');

await page.goto(`${RACINE}/stockage/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForSelector('#stockage', { state: 'visible', timeout: 60000 });
await page.waitForTimeout(1500);

await page.check('input[name="groupe-effacement"][value="cog-training"]');
await page.fill('#depuis', '2025-01-01');
await page.fill('#jusqua', '2025-12-31');
await page.click('#compter');
await page.waitForSelector('#decompte', { state: 'visible', timeout: 30000 });

const total = (await page.locator('#decompte-total').textContent()) ?? '';
v('le compte annonce onze enregistrements', /\b11\b/.test(total), true);
v('et le dit comme définitif', /définitivement/.test(total), true);

const detail = (await page.locator('#decompte-detail').textContent()) ?? '';
v('le détail dit 10 sur 20 pour n-back', /nback — 10 sur 20/.test(detail), true);
v('et 1 sur 1 pour le relationnel', /relationnel — 1 sur 1/.test(detail), true);

const refus = (await page.locator('#decompte-refus').textContent()) ?? '';
v('les seuils Veridical sont annoncés comme laissés entiers', /vmSeuils/.test(refus), true);
v('avec la raison', /état courant/.test(refus), true);

v('rien n’a été effacé : vingt sessions', await compter('nback'), 20);
v('ni la session relationnelle', await compter('relationnel'), 1);
v('ni le seuil', await compter('vmSeuils'), 1);

/* ── Effacer, avec sauvegarde d'abord ─────────────────────────────────── */

console.log('\nEFFACER, SAUVEGARDE D’ABORD');

/*
   B-5 DU 58 — LA PREUVE A3 AVANT D'EFFACER.

   « Sauvegarder d'abord, puis effacer » téléchargeait, notait « sauvegarde
   réussie » et effaçait. Un navigateur ne dit jamais si un téléchargement a
   abouti : sur un téléphone qui refuse le fichier, la sauvegarde n'existait
   pas et l'effacement avait lieu quand même.

   On éprouve donc les DEUX réponses, et le refus d'abord : c'est lui qui
   doit ne rien effacer, et c'est lui qui manquait.
*/
await page.fill('#mdp-avant-effacement', MDP);
const attenteRefus = page.waitForEvent('download', { timeout: 120000 });
await page.click('#sauver-puis-effacer');
const fichierRefuse = await attenteRefus;
v(
  'la sauvegarde de sécurité part avant l’effacement',
  /^avant-effacement-cyclades-sauvegarde-/.test(fichierRefuse.suggestedFilename()),
  true,
);
await repondreALaBoite(page, 'Je ne le trouve pas', { delai: 30000 });
await page.waitForTimeout(2500);
v('un « je ne le trouve pas » n’efface rien', await compter('nback'), 20);
v('et la session de 2025 est toujours là', await compter('relationnel'), 1);
const refusDit = (await page.locator('#message-effacement').textContent()) ?? '';
v('et l’écran dit que rien n’a été effacé', /rien n’a été effacé/i.test(refusDit), true);

/* Puis la même chose, confirmée. */
await page.fill('#mdp-avant-effacement', MDP);
const attente = page.waitForEvent('download', { timeout: 120000 });
await page.click('#sauver-puis-effacer');
const fichier = await attente;
v(
  'la seconde sauvegarde part aussi',
  /^avant-effacement-cyclades-sauvegarde-/.test(fichier.suggestedFilename()),
  true,
);
await repondreALaBoite(page, 'Je l’ai retrouvé', { delai: 30000 });

await page.waitForTimeout(4000);
v('les dix sessions de 2025 sont parties', await compter('nback'), 10);
v('la session relationnelle de 2025 aussi', await compter('relationnel'), 0);
v('le seuil Veridical est intact', await compter('vmSeuils'), 1);
v('la carte d’un autre domaine est intacte', await compter('cartes'), 1);

const message = (await page.locator('#message-effacement').textContent()) ?? '';
v('le message donne le compte effacé', /11 enregistrement\(s\) effacés/.test(message), true);
v('et signale le magasin laissé entier', /laissés entiers/.test(message), true);

/* ── Sans période, tout le domaine part ───────────────────────────────── */

console.log('\nSANS PÉRIODE, TOUT LE DOMAINE PART');

await page.fill('#depuis', '');
await page.fill('#jusqua', '');
await page.check('input[name="groupe-effacement"][value="cog-training"]');
await page.click('#compter');
await page.waitForSelector('#decompte', { state: 'visible', timeout: 30000 });
v(
  'le compte inclut maintenant les seuils',
  /vmSeuils — 1 sur 1/.test((await page.locator('#decompte-detail').textContent()) ?? ''),
  true,
);
v(
  'et plus aucun refus n’est annoncé',
  await page.locator('#decompte-refus').isVisible(),
  false,
);

await page.click('#effacer-sans');
/*
   LA REDEMANDE DU MOT DE PASSE — prompt 44, point 1.

   « Effacer sans sauvegarder » ne se contente plus d'un « confirm » : il
   demande le mot de passe du site, parce que c'est la branche la plus
   définitive des deux et qu'elle ne prouvait rien, là où celle qui
   sauvegarde le prouve en chiffrant la sauvegarde.

   L'essai répondait encore à la fenêtre native, qui ne s'ouvre plus : rien
   n'était effacé — « obtenu 10, attendu 0 » — et le dialogue resté ouvert
   arrêtait le clic suivant, trente secondes plus loin, sur un message qui
   ne nommait pas la cause.
*/
await repondreALaRedemande(page, MDP);
await page.waitForTimeout(3000);
v('le domaine est vide : n-back', await compter('nback'), 0);
v('les seuils aussi', await compter('vmSeuils'), 0);
v('et la carte d’un autre domaine est toujours là', await compter('cartes'), 1);

/* ── Une période à l'envers est refusée ───────────────────────────────── */

console.log('\nUNE PÉRIODE À L’ENVERS EST REFUSÉE');

await page.check('input[name="groupe-effacement"][value="revisions"]');
await page.fill('#depuis', '2026-12-31');
await page.fill('#jusqua', '2026-01-01');
await page.click('#compter');
await page.waitForTimeout(1000);
v(
  'le message explique le problème',
  /à l’envers/.test((await page.locator('#message-effacement').textContent()) ?? ''),
  true,
);
v('et le décompte reste fermé', await page.locator('#decompte').isVisible(), false);
v('la carte est toujours là', await compter('cartes'), 1);

/* ── L'export lisible produit du CSV ──────────────────────────────────── */

console.log('\nL’EXPORT LISIBLE PRODUIT DU CSV OUVRABLE');

await page.check('input[name="groupe-export"][value="revisions"]');
const attenteCsv = page.waitForEvent('download', { timeout: 60000 });
await page.click('#exporter-csv');
/*
   Le second geste sans retour du prompt 44 : l'export EN CLAIR, qui écrit
   sur le disque, sans chiffrement, ce que le reste du site passe son temps
   à chiffrer. Il demande donc le mot de passe du site, lui aussi, et
   l'attente du téléchargement se posait avant que le fichier ne puisse
   partir.
*/
await repondreALaRedemande(page, MDP);
const csv = await attenteCsv;
v('le nom dit le domaine et le magasin', /^cyclades-revisions-cartes-/.test(csv.suggestedFilename()), true);
v('et porte l’extension csv', /\.csv$/.test(csv.suggestedFilename()), true);

const { readFile } = await import('node:fs/promises');
const contenu = await readFile(await csv.path(), 'utf8');
v('le fichier commence par un BOM', contenu.charCodeAt(0), 0xfeff);
v('le séparateur est le point-virgule', contenu.includes('id;ficheId'), true);
v('les colonnes imbriquées sont aplaties', contenu.includes('fsrs.stability'), true);

await page.waitForTimeout(1200);
const msgExport = (await page.locator('#message-export').textContent()) ?? '';
v('le message rappelle que ce n’est pas une sauvegarde', /ne se réimportent pas/.test(msgExport), true);

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
