/**
 * « La clé qui les ouvre a disparu » : le dire, et ne rien écrire par-dessus
 * — A7 du 58.
 *
 * ## Le défaut, et sa mécanique exacte
 *
 * `selLocal()` (`src/lib/coffre.ts`) POSE un sel neuf quand il n'en trouve
 * pas. Sur une base vierge, c'est ce qu'il faut : le coffre naît à la
 * première ouverture. Mais si des enregistrements scellés sont là et que le
 * sel a disparu — effacement trop large, nettoyage de site, restauration
 * partielle —, le même code fabriquait un sel neuf, dérivait une clé neuve,
 * et ouvrait **un coffre vide d'apparence par-dessus les données
 * existantes**. Au premier mot de passe saisi, et sans un mot.
 *
 * C'est la mécanique du « coffre créé par-dessus en silence ». L'essai la
 * reproduit à partir de la reproduction de B-3 : un vrai coffre, un vrai
 * enregistrement scellé, puis la clé retirée à la main.
 *
 * ## Ce qu'il constate
 *
 * Que l'écran le dit, qu'il ne propose plus un mot de passe qui ne peut rien
 * ouvrir, qu'il annonce le nombre d'enregistrements concernés, et surtout
 * qu'**aucun sel neuf n'est écrit**. Ce dernier contrôle est le seul qui
 * porte sur la perte : les trois autres portent sur la franchise.
 */
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

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

const ouvrirLeCoffre = async () => {
  const champ = page.locator('#mdp-coffre');
  await champ.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (!(await champ.isVisible().catch(() => false))) return false;
  await page.fill('#mdp-coffre', MDP);
  await page.locator('#coffre-ferme button').first().click();
  await page.locator('#coffre-ferme').waitFor({ state: 'hidden', timeout: 20000 });
  return true;
};

/** Les clés d'« etat » qui touchent au coffre. */
const clefsDuCoffre = () =>
  page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          const q = base.transaction('etat').objectStore('etat').getAllKeys();
          q.onsuccess = () => {
            base.close();
            ok(q.result.map(String).filter((c) => c.startsWith('coffre.')).sort());
          };
        };
      }),
  );

/* ── Un vrai coffre, avec un vrai enregistrement scellé ───────────────── */

console.log('\nUN VRAI COFFRE, AVEC UN VRAI ENREGISTREMENT SCELLÉ');

await page.goto(`${RACINE}/robots.txt`, { waitUntil: 'load' });
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.deleteDatabase('revinsp');
      r.onsuccess = r.onerror = r.onblocked = () => ok();
    }),
);

await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await connecter();
v('le coffre demande son mot de passe', await ouvrirLeCoffre(), true);
await page.waitForTimeout(1500);

/*
   Un enregistrement scellé posé à la main, dans un magasin scellé. On ne
   passe pas par l'écran : ce qui compte ici est la PRÉSENCE d'un scellé, non
   la façon dont il est arrivé, et un relevé de Psyché demanderait dix gestes
   de plus pour le même fait.
*/
await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const base = r.result;
        const tx = base.transaction('odysseeRessentis', 'readwrite');
        tx.objectStore('odysseeRessentis').put({
          id: 'essai-cle-disparue',
          le: '2026-10-19T10:00:00.000Z',
          scelle: 'ceci-est-un-chiffre-opaque',
        });
        tx.oncomplete = () => {
          base.close();
          ok();
        };
        tx.onerror = () => {
          base.close();
          ok();
        };
      };
    }),
);

const avant = await clefsDuCoffre();
console.log(`      clés du coffre : ${avant.join(', ')}`);
v('le sel du coffre est en place', avant.includes('coffre.sel'), true);

/* ── La clé disparaît ─────────────────────────────────────────────────── */

console.log('\nLA CLÉ DISPARAÎT');

await page.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => {
        const base = r.result;
        const tx = base.transaction('etat', 'readwrite');
        const etat = tx.objectStore('etat');
        const q = etat.getAllKeys();
        q.onsuccess = () => {
          for (const clef of q.result.map(String)) {
            if (clef.startsWith('coffre.')) etat.delete(clef);
          }
        };
        tx.oncomplete = () => {
          base.close();
          ok();
        };
      };
    }),
);
await page.evaluate(() => sessionStorage.clear());

const apresPerte = await clefsDuCoffre();
v('plus aucune clé de coffre en base', apresPerte, []);
v(
  'et l’enregistrement scellé est toujours là',
  await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          const q = base.transaction('odysseeRessentis').objectStore('odysseeRessentis').count();
          q.onsuccess = () => {
            base.close();
            ok(q.result);
          };
        };
      }),
  ),
  1,
);

/* ── L'écran le dit, et ne propose plus un mot de passe inutile ───────── */

console.log('\nL’ÉCRAN LE DIT');

await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle' });
await connecter();
await page.waitForSelector('#coffre-sans-cle:not(.hidden)', { timeout: 30000 });

/*
   On attend que le compte soit écrit avant de lire le bloc : il est calculé
   après l'affichage, pour que le signal paraisse sans attendre une lecture
   de tous les magasins scellés. Lire trop tôt mesurait l'ordre d'arrivée, pas
   le contenu.
*/
await page
  .waitForFunction(
    () => (document.getElementById('coffre-sans-cle-compte')?.textContent ?? '').length > 0,
    undefined,
    { timeout: 20000 },
  )
  .catch(() => {});
const dit = ((await page.locator('#coffre-sans-cle').textContent()) ?? '').replace(/\s+/g, ' ');
console.log(`      compte : ${((await page.locator('#coffre-sans-cle-compte').textContent()) ?? '(vide)').trim()}`);
v('le signal paraît', true, true);
v('il dit que la clé a disparu', /la clé qui les ouvre a disparu/i.test(dit), true);
v('il dit qu’aucun mot de passe ne les rouvrira', /aucun mot de passe ne les rouvrira/i.test(dit), true);
v('il propose de restaurer une sauvegarde', /Restaurer une sauvegarde/.test(dit), true);
/*
   Le nombre est LU, pas figé. Ouvrir le coffre écrit lui-même un scellé — la
   paire de la boîte aux lettres —, donc le scénario en porte plus d'un, et
   une assertion sur « 1 » mesurait ma supposition plutôt que l'écran.
   Ce qui compte : l'écran annonce un nombre, il est supérieur à zéro, et la
   confirmation annoncera LE MÊME. Deux nombres différents pour la même perte
   seraient pires que pas de nombre du tout.
*/
const annonce = ((await page.locator('#coffre-sans-cle-compte').textContent()) ?? '').match(/(\d+)/);
const combienDit = annonce ? Number(annonce[1]) : 0;
v('il annonce un nombre d’enregistrements', combienDit > 0, true);
v(
  'le formulaire d’ouverture est retiré',
  await page.locator('#coffre-ferme').isVisible().catch(() => false),
  false,
);

/* ── Et rien n'est écrit par-dessus ───────────────────────────────────── */

console.log('\nET RIEN N’EST ÉCRIT PAR-DESSUS');

await page.waitForTimeout(2000);

/*
   LE CONTRÔLE QUI MANQUAIT, ET QUI A COÛTÉ UN ROUGE EN BATTERIE.

   Cette page — comme les huit autres sous coffre — porte son propre
   abonnement, et fait `classList.toggle('hidden', ouvert)` sur
   `#coffre-ferme`. Coffre fermé, elle RETIRE `hidden` : elle ré-affichait
   donc le formulaire juste après que le signal l'avait caché. Lequel des deux
   scripts arrive en dernier dépend de la vitesse des imports — seul en
   batterie, machine chargée, le défaut est sorti.
   Le correctif est une règle de style sur un attribut de racine ; ce contrôle
   mesure donc la visibilité APRÈS le réveil des abonnements, et non à
   l'instant où le signal paraît.
*/
v(
  'et le formulaire reste retiré, les écrans réveillés',
  await page.locator('#coffre-ferme').isVisible().catch(() => false),
  false,
);
const apresVisite = await clefsDuCoffre();
v('aucun sel neuf n’a été posé', apresVisite, []);
v(
  'et la clé de session reste vide',
  await page.evaluate(() => sessionStorage.getItem('cyclades.coffre')),
  null,
);

/* ── Repartir à zéro est possible, jamais en silence ──────────────────── */

console.log('\nREPARTIR À ZÉRO EST POSSIBLE, JAMAIS EN SILENCE');

await page.click('#coffre-recreer');
const titre = await page
  .locator('dialog.boite[open] .boite-titre')
  .textContent({ timeout: 20000 });
v('une confirmation s’ouvre', (titre ?? '').trim(), 'Repartir d’un coffre neuf ?');
const texte = ((await page.locator('dialog.boite[open]').textContent()) ?? '').replace(/\s+/g, ' ');
v('elle cite le message', /la clé qui les ouvre a disparu/i.test(texte), true);
const annonceBoite = texte.match(/retire (?:ces )?(\d+)/);
v(
  'elle donne le même nombre que l’écran',
  annonceBoite ? Number(annonceBoite[1]) : -1,
  combienDit,
);
v('elle conseille la sauvegarde d’abord', /restaurez-la plutôt/i.test(texte), true);

// On refuse : rien ne doit partir.
await page.locator('dialog.boite[open] .boite-bouton', { hasText: 'Annuler' }).first().click();
await page.waitForTimeout(1500);
v(
  'un refus ne retire rien',
  await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const base = r.result;
          const q = base.transaction('odysseeRessentis').objectStore('odysseeRessentis').count();
          q.onsuccess = () => {
            base.close();
            ok(q.result);
          };
        };
      }),
  ),
  1,
);
v('et aucun sel n’est posé non plus', await clefsDuCoffre(), []);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m`,
);
process.exit(echecs === 0 ? 0 : 1);
