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
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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

/* ── Un magasin scellé dont la date est dedans ────────────────────────── */

/*
   LA SEULE MESURE QUI TIENNE DU BRANCHEMENT, ET POURQUOI ELLE EST ICI.

   `odysseeCreneaux` est scellé, et son jour est À L'INTÉRIEUR du scellé —
   c'est l'objet du magasin : « tous les jours à 8 h » dit la régularité d'un
   traitement qu'on ne nomme même pas. Le découpage générique, qui lit la
   ligne brute avant déchiffrement, n'y voit donc aucune date : `CHAMP_DATE`
   vaut `null`, et le découpage vit dans le module, que `DECOUPAGES_DE_MODULE`
   appelle.

   Les essais de Node tiennent le choix des jours (fonction pure) et l'accord
   des deux tables. Ils ne tiennent PAS le branchement : retirer l'appel dans
   `compter` et `effacer` en laissant la table les laissait tous verts — c'est
   mesuré, pas supposé. Seul un vrai navigateur peut le tenir, parce qu'il
   faut un coffre ouvert, une ligne vraiment scellée, et l'écran qui la
   demande.

   Le créneau est marqué PAR L'ÉCRAN, et non semé à la main : c'est `sceller()`
   qui doit l'écrire, sinon la ligne n'aurait pas la forme qu'on prétend
   découper. La contrepartie est que le marquage ne peut tomber qu'AUJOURD'HUI
   — l'écran ne montre que les créneaux du jour. Les deux bornes se mesurent
   donc contre ce jour-là, ce qui suffit à distinguer « visé » de « épargné ».
*/

console.log('\nUN CRÉNEAU SCELLÉ, MARQUÉ PAR L’ÉCRAN');

const AUJOURDHUI = new Date().toLocaleDateString('en-CA');
const HIER = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');

await page.goto(`${RACINE}/odyssee/sante/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForSelector('#pas-active', { state: 'visible', timeout: 40000 });
await page.click('#activer');
await page.waitForSelector('#coffre-ferme', { state: 'visible', timeout: 20000 });
await page.fill('#mdp-coffre', MDP);
await page.click('#ouvrir-coffre');
await page.waitForSelector('#coffre-ouvert', { state: 'visible', timeout: 20000 });

/*
   Un traitement d'abord, puis son schéma de prise : le repli `details` qui
   porte les heures n'existe qu'une fois le traitement créé, et sans heure
   déclarée il n'y a aucun créneau à marquer.
*/
await page.fill('#t-nom', 'Traitement témoin de l’effacement');
await page.fill('#t-posologie', '1 le matin');
await page.click('#form-traitement button[type="submit"]');
await page.waitForSelector('#traitements details summary', { timeout: 20000 });
await page.click('#traitements details summary');
await page.waitForTimeout(300);
await page.fill('#traitements details input[type="time"]', '08:00');
await page.click('#traitements details button:has-text("Ajouter cette heure")');
await page.click('#traitements details button[type="submit"]');
await page.waitForSelector('#creneaux li', { timeout: 20000 });

await page.click('#creneaux li button:has-text("Pris")');
// Le bandeau d'annulation retarde l'écriture de six secondes.
await page.waitForTimeout(8000);

v('un créneau est scellé en base', await compter('odysseeCreneaux'), 1);
/*
   Et il n'expose AUCUNE date en clair : c'est la condition qui rend le
   découpage générique impossible, et la raison de tout ce qui suit. Lu sur la
   ligne brute, celle que `getAll` rend.
*/
const brut = await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const base = r.result;
        const q = base.transaction('odysseeCreneaux').objectStore('odysseeCreneaux').getAll();
        q.onsuccess = () => {
          base.close();
          ok(Object.keys(q.result[0] ?? {}).sort());
        };
      };
    }),
);
v('et ne porte en clair que sa clé et son scellé', brut, ['id', 'scelle']);

/* ── Une période qui ne le contient pas l'épargne ─────────────────────── */

console.log('\nUNE PÉRIODE QUI NE LE CONTIENT PAS L’ÉPARGNE');

await page.goto(`${RACINE}/stockage/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForSelector('#stockage', { state: 'visible', timeout: 60000 });
await page.waitForTimeout(1500);

const compterLaPeriode = async (depuis, jusqua) => {
  /*
     Un seul domaine coché, et les autres décochés explicitement : les
     sections précédentes en ont laissé un, et un effacement qui emporterait
     un domaine voisin rendrait le compte illisible — on ne saurait plus ce
     que la ligne des créneaux mesure.
  */
  for (const boite of await page.locator('input[name="groupe-effacement"]').all()) {
    if (await boite.isChecked()) await boite.uncheck();
  }
  await page.check('input[name="groupe-effacement"][value="odyssee"]');
  await page.fill('#depuis', depuis);
  await page.fill('#jusqua', jusqua);
  await page.click('#compter');
  await page.waitForSelector('#decompte', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(400);
  return {
    detail: (await page.locator('#decompte-detail').textContent()) ?? '',
    refus: (await page.locator('#decompte-refus').textContent()) ?? '',
  };
};

{
  const d = await compterLaPeriode('2024-01-01', '2024-12-31');
  /*
     Le magasin est COMPTÉ, et non refusé : le coffre est ouvert, donc le
     module a pu lire. C'est exactement ce que le branchement ajoute, et la
     différence avec le défaut d'avant : auparavant la ligne annonçait
     « 0 sur 1 » pour TOUTE période, y compris celle du créneau.
  */
  v('le magasin est compté, pas laissé entier', /odysseeCreneaux/.test(d.refus), false);
  v('et aucune ligne de 2024 n’est visée', /odysseeCreneaux — 0 sur 1/.test(d.detail), true);
  v('le créneau est toujours là', await compter('odysseeCreneaux'), 1);
}

/* ── La période du jour le vise, et l'effacement l'emporte ────────────── */

console.log('\nLA PÉRIODE DU JOUR LE VISE, ET L’EFFACEMENT L’EMPORTE');

{
  const d = await compterLaPeriode(HIER, AUJOURDHUI);
  v('la ligne du jour est visée', /odysseeCreneaux — 1 sur 1/.test(d.detail), true);
  v('et compter n’a rien touché', await compter('odysseeCreneaux'), 1);

  await page.click('#effacer-sans');
  await repondreALaRedemande(page, MDP);
  await page.waitForTimeout(3000);
  v('le créneau est parti', await compter('odysseeCreneaux'), 0);
}

/* ── Coffre fermé : le magasin est laissé entier, et l'écran le dit ───── */

console.log('\nCOFFRE FERMÉ : LAISSÉ ENTIER, ET L’ÉCRAN DIT POURQUOI');

/*
   Le troisième état, et le seul qui reste honnête quand la clé manque. Ni
   « 0 visé » — qui ferait croire à un effacement complet —, ni une erreur :
   le magasin est nommé parmi les laissés entiers, avec la raison. C'est la
   phrase que `raisonDuRefusDeDecoupage` porte, et elle ne dit plus « un état
   courant et non un historique », qui aurait été faux ici.
*/
{
  /*
     Le coffre est encore ouvert : sa clé vit dans `sessionStorage`, qui
     survit à la navigation dans le même onglet. On remarque donc le créneau
     sans le réouvrir, puis on ferme le coffre pour de bon en vidant ce
     rangement — c'est exactement ce que fait un nouvel onglet.
  */
  await page.goto(`${RACINE}/odyssee/sante/`, { waitUntil: 'networkidle' });
  await connecter();
  await page.waitForSelector('#coffre-ouvert', { state: 'visible', timeout: 40000 });
  await page.waitForSelector('#creneaux li button:has-text("Pris")', { timeout: 20000 });
  await page.click('#creneaux li button:has-text("Pris")');
  await page.waitForTimeout(8000);
  v('un créneau est de nouveau scellé', await compter('odysseeCreneaux'), 1);

  // La clé du coffre vit dans `sessionStorage` : la retirer ferme le coffre.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${RACINE}/stockage/`, { waitUntil: 'networkidle' });
  await connecter();
  await page.waitForSelector('#stockage', { state: 'visible', timeout: 60000 });
  await page.waitForTimeout(1500);

  const d = await compterLaPeriode(HIER, AUJOURDHUI);
  v('le magasin est annoncé laissé entier', /odysseeCreneaux/.test(d.refus), true);
  v('avec la vraie raison — ses dates sont scellées', /scellées/.test(d.refus), true);
  v('et non la phrase des états courants', /odysseeCreneaux — ce magasin porte un état courant/.test(d.refus), false);
  v('le créneau est intact', await compter('odysseeCreneaux'), 1);
}

/* ── Les exceptions scellées : le jour est dans la clé ────────────────── */

/*
   L'AUTRE MAGASIN SCELLÉ SANS DATE EN CHAMP, ET IL SE DÉCOUPE AUTREMENT.

   `odysseeExceptionsScellees` a sa clé primaire en clair — elle vaut
   `«tacheId»/«jourPrevu»` —, donc son jour est lisible sans coffre. Son
   découpage vit dans le module pour une autre raison que celui des créneaux :
   non parce qu'il faut la clé du coffre, mais parce que la date n'est dans
   aucun CHAMP, et que `dateDe` lit des champs.

   D'où une différence de méthode assumée. Les créneaux devaient être marqués
   par l'écran, parce que la forme du scellé était sous mesure. Ici le scellé
   n'est jamais ouvert par l'effacement : seules les clés le sont. Semer les
   lignes en base est donc une mesure valide de ce qui est testé, et le reste
   du magasin est éprouvé ailleurs, dans `essais:fusion-occurrences`.
*/

console.log('\nLES EXCEPTIONS SCELLÉES SE DÉCOUPENT SUR LE JOUR DE LEUR CLÉ');

const TACHE = '01JBQZ9X8K7M4N2P5R6S7T8V9W';
const semerExceptions = (clefs) =>
  page.evaluate(
    (lignes) =>
      new Promise((ok, ko) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          const tx = base.transaction('odysseeExceptionsScellees', 'readwrite');
          const magasin = tx.objectStore('odysseeExceptionsScellees');
          for (const id of lignes) {
            magasin.put({ id, scelle: { iv: 'AAAA', charge: 'AAAA' } });
          }
          tx.oncomplete = () => {
            base.close();
            ok();
          };
          tx.onerror = () => ko(tx.error);
        };
      }),
    clefs,
  );

await semerExceptions([
  `${TACHE}/2024-06-01`,
  `${TACHE}/${HIER}`,
  `${TACHE}/${AUJOURDHUI}`,
  `${TACHE}/${AUJOURDHUI}/etape-1`,
]);
v('quatre exceptions scellées sont en base', await compter('odysseeExceptionsScellees'), 4);

{
  /*
     Le coffre est fermé depuis la section précédente, et c'est l'occasion de
     mesurer les deux magasins ENSEMBLE : les créneaux sont laissés entiers
     faute de clé, les exceptions sont comptées quand même. Les deux refus
     possibles ne sont pas le même refus, et l'écran ne doit pas les
     confondre.
  */
  const d = await compterLaPeriode(HIER, AUJOURDHUI);
  v('les créneaux sont laissés entiers, coffre fermé', /odysseeCreneaux/.test(d.refus), true);
  v('mais les exceptions sont comptées', /odysseeExceptionsScellees/.test(d.refus), false);
  v('trois exceptions sur quatre sont visées', /odysseeExceptionsScellees — 3 sur 4/.test(d.detail), true);
  v('et compter n’a rien touché', await compter('odysseeExceptionsScellees'), 4);

  await page.click('#effacer-sans');
  await repondreALaRedemande(page, MDP);
  await page.waitForTimeout(3000);
  v('les trois sont parties', await compter('odysseeExceptionsScellees'), 1);
  /*
     Et c'est bien celle de 2024 qui reste. Compter les survivants ne suffit
     pas : « 1 sur 4 » serait vrai aussi si l'effacement avait pris la
     mauvaise. On relit la clé.
  */
  const restantes = await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          const q = base
            .transaction('odysseeExceptionsScellees')
            .objectStore('odysseeExceptionsScellees')
            .getAllKeys();
          q.onsuccess = () => {
            base.close();
            ok(q.result);
          };
        };
      }),
  );
  v('et celle qui reste est bien celle de 2024', restantes, [`${TACHE}/2024-06-01`]);
}

/* ── Une clé illisible fait laisser le magasin entier ─────────────────── */

console.log('\nUNE CLÉ ILLISIBLE FAIT LAISSER LE MAGASIN ENTIER, ET NON À MOITIÉ');

/*
   Le garde-fou contre le défaut que ce lot corrige, vu de l'autre bord. Un
   découpage qui écarterait en silence une clé dont il ne sait pas lire le
   jour effacerait « 3 sur 4 » en annonçant avoir fait la période. Il refuse
   le magasin ENTIER, et l'écran dit pourquoi.
*/
{
  await semerExceptions([`${TACHE}/${AUJOURDHUI}`, 'clef-sans-jour']);
  v('trois exceptions, dont une clé illisible', await compter('odysseeExceptionsScellees'), 3);

  const d = await compterLaPeriode(HIER, AUJOURDHUI);
  v('le magasin est annoncé laissé entier', /odysseeExceptionsScellees/.test(d.refus), true);
  v('avec la raison — entier plutôt qu’à moitié', /moitié/.test(d.refus), true);

  await page.click('#effacer-sans');
  await repondreALaRedemande(page, MDP);
  await page.waitForTimeout(3000);
  v('et rien n’a été effacé de ce magasin', await compter('odysseeExceptionsScellees'), 3);
}

await nav.close();
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
