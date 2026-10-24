/**
 * Pointer coffre fermé, ouvrir, constater le rejeu — A-6 option D.
 *
 *   npm run essais:rejeu:navigateur
 *
 * ## Ce que ce parcours prouve, et pourquoi il manquait
 *
 * L'option D, signée le 15 octobre, promet qu'« un report est rejoué ou
 * signalé, jamais perdu en silence ». Le moteur `rejouerLesReports()`
 * était écrit, éprouvé, et **appelé par personne** : un geste fait coffre
 * fermé était gardé, jamais rejoué, jamais dit. Aucun contrôle de module
 * ne pouvait le voir — chaque pièce était juste, c'est la **rencontre**
 * qui manquait, la classe de défaut A-16.
 *
 * Le parcours suit donc la vie réelle : on ouvre le coffre une fois pour
 * que la boîte naisse, on le ferme, on pointe une occurrence d'une tâche
 * liée à une branche scellée — le pointage part en pli —, on rouvre, et
 * on regarde si le pli est devenu une exception.
 *
 * ## Ce qu'il ne prouve pas
 *
 * Le cas de la boîte **périmée** — mot de passe changé, plis illisibles
 * gardés et signalés. Il demanderait de changer le mot de passe du site
 * en cours de parcours, ce qui sort de ce lot ; `rejouerLesReports` rend
 * déjà le compte des illisibles, et l'écran le dit. Noté comme non
 * constaté, plutôt que sous-entendu tenu.
 *
 * La tâche est **semée** directement dans son magasin, qui n'est pas
 * scellé : la créer par l'écran ajouterait un formulaire à éprouver sans
 * rien apprendre sur le rejeu. Tout le reste passe par les écrans réels.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const TACHE = 'tache-rejeu-essai';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

const aller = async (chemin, selecteur) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  if (selecteur) await page.waitForSelector(selecteur, { timeout: 40000 });
};

const coffreOuvert = () =>
  page.evaluate(() => !document.getElementById('temoin-coffre')?.classList.contains('hidden'));

/** Combien de lignes porte un magasin, vu de la base. */
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

await franchirInitialisation(page, RACINE, MDP);

console.log('\n\x1b[1m1. LA BOÎTE NAÎT À LA PREMIÈRE OUVERTURE DU COFFRE\x1b[0m');
await aller('/odyssee/corps/', '#entete-principal');
{
  const champ = await page.locator('#mdp-coffre').isVisible().catch(() => false);
  vrai('le formulaire du coffre est offert', champ);
  if (champ) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
  vrai('le coffre est ouvert', await coffreOuvert());
}

console.log('\n\x1b[1m2. UNE TÂCHE LIÉE À UNE BRANCHE SCELLÉE, ET LE COFFRE REFERMÉ\x1b[0m');
const aujourdhui = await page.evaluate(async (id) => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  /*
     Le jour logique commence à 4 h ; avant cette heure, « aujourd'hui »
     est la veille. On sème donc une série QUOTIDIENNE ancrée huit jours
     en arrière : quelle que soit l'heure du parcours, il y a une
     occurrence du jour, et l'essai ne dépend pas de l'horloge.
  */
  const jour = new Date(Date.now() - 86_400_000 * 8).toISOString().slice(0, 10);
  const maintenant = new Date().toISOString();
  await new Promise((ok, ko) => {
    const tx = base.transaction('odysseeTaches', 'readwrite');
    tx.objectStore('odysseeTaches').put({
      id,
      titre: 'Tâche semée du contrôle',
      domaine: 'psyche',
      echeance: null,
      faiteLe: null,
      abandonneeLe: null,
      motifAbandon: null,
      note: '',
      creeeLe: maintenant,
      majLe: maintenant,
      serie: {
        depuis: jour,
        repetition: { type: 'jours', tous: 1 },
        fin: { type: 'jamais' },
        heure: null,
      },
      /* `odyssee.checkin` est sous coffre : c'est ce qui rend l'exception scellée. */
      lien: { action: 'odyssee.checkin' },
    });
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
  return new Date().toISOString().slice(0, 10);
}, TACHE);

/* On referme par le témoin de l'en-tête, comme on le ferait à la main. */
await page.click('#temoin-coffre-fermer').catch(async () => {
  await page.click('#temoin-coffre button');
});
await page.waitForTimeout(1200);
/*
   Par l'écran des TÂCHES et non par le calendrier, et ce n'est pas un
   détail de commodité : le calendrier s'arrête un cran plus tôt. Sur une
   occurrence illisible — branche scellée, coffre fermé — il affiche
   « État chiffré » puis `return` avant toute action, donc il n'offre
   aucun moyen de pointer, donc le dépôt du pli y est inatteignable.
   Trouvé par cet essai, remonté comme anomalie A-20, et pas corrigé ici :
   ce qu'un écran montre d'une branche scellée est une décision d'Alexis.

   L'écran des tâches, lui, passe par `etatDuJour` et offre « Faite ».
   C'est le chemin réel qui marche aujourd'hui, et c'est celui qu'on suit.
*/
await aller('/odyssee/taches/', '#entete-principal');
v('le coffre est bien refermé avant de pointer', await coffreOuvert(), false);
v('aucun pli en attente au départ', await compter('odysseeReports'), 0);

console.log('\n\x1b[1m3. LE POINTAGE PART EN PLI\x1b[0m');
{
  /*
     On compte le bouton avant de cliquer : un sélecteur qui ne trouve
     rien doit accuser, pas expirer sur quarante secondes.
  */
  const bouton = page.locator(`[data-faire="${TACHE}"]`).first();
  await page.waitForSelector(`[data-faire="${TACHE}"]`, { timeout: 30000 }).catch(() => {});
  const combien = await page.locator(`[data-faire="${TACHE}"]`).count();
  vrai(`la tâche du jour est pointable (${combien} bouton(s))`, combien > 0);
  if (combien > 0) {
    await bouton.click();
    let plis = 0;
    for (let i = 0; i < 40; i += 1) {
      plis = await compter('odysseeReports');
      if (plis > 0) break;
      await page.waitForTimeout(400);
    }
    v('un pli est gardé, coffre fermé', plis, 1);
    /*
       Et rien n'est écrit dans le magasin scellé : c'est la moitié qui
       dit que le geste a bien été REPORTÉ, et non écrit en douce.
    */
    v('aucune exception scellée n’a été écrite', await compter('odysseeExceptionsScellees'), 0);
  }
}

console.log('\n\x1b[1m4. À L’OUVERTURE DU COFFRE, LE PLI EST REJOUÉ\x1b[0m');
{
  await aller('/odyssee/corps/', '#entete-principal');
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await page.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
  vrai('le coffre est rouvert', await coffreOuvert());

  let plis = 1;
  let exceptions = 0;
  for (let i = 0; i < 40; i += 1) {
    plis = await compter('odysseeReports');
    exceptions = await compter('odysseeExceptionsScellees');
    if (plis === 0 && exceptions > 0) break;
    await page.waitForTimeout(400);
  }
  v('le pli a disparu de la file', plis, 0);
  v('et une exception scellée a pris sa place', exceptions, 1);
}

console.log('\n\x1b[1m5. RIEN NE RESTE À SIGNALER\x1b[0m');
{
  await aller('/odyssee/', '#vue:not(.hidden)');
  await page.waitForTimeout(3000);
  /*
     La mention ne paraît que s'il reste quelque chose. Tout ayant été
     rejoué, elle doit rester cachée — et c'est aussi ce qui prouve
     qu'elle ne s'affiche pas en permanence.
  */
  v('la mention des gestes en attente reste cachée', await page.locator('#gestes-en-attente').isVisible(), false);
}

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
