/**
 * La pastille de la revue, sur l'onglet Odyssée — V4 / décision 2 du 36.
 *
 *   npm run essais:pastille:navigateur
 *
 * Le bandeau de l'accueil disait déjà « la revue vous attend » ; le relevé
 * des reliquats notait que la seconde moitié de la recommandation — un
 * badge sur l'onglet Odyssée — manquait. Elle est là, et cet essai la
 * regarde **dans les deux états**, parce qu'un témoin qui s'allume
 * toujours ne dit rien.
 *
 * ## Pourquoi un essai de navigateur, et pas un contrôle de module
 *
 * `revueASignaler` lit la base. Son verdict se prouverait en module avec
 * un faux magasin, mais ce qu'on veut savoir est autre chose : que le
 * verdict **atteint la barre**. C'est la classe de défaut A-16 — chaque
 * morceau juste, et personne qui les relie.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
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
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#entete-principal', { timeout: 40000 }).catch(() => {});
};

/** La pastille est-elle visible, une fois la barre peinte ? */
const pastilleVisible = async () => {
  for (let i = 0; i < 30; i += 1) {
    if (await page.locator('#pastille-revue').isVisible().catch(() => false)) return true;
    await page.waitForTimeout(400);
  }
  return false;
};

await franchirInitialisation(page, RACINE, MDP);

console.log('\n\x1b[1m1. OÙ ELLE EST, ET OÙ ELLE N’EST PAS\x1b[0m');
await aller('/revisions/');
/*
   Une seule, et sur Odyssée. Une pastille par branche serait une
   décoration ; sur la mauvaise branche, un mensonge.
*/
v('il n’y en a qu’une dans la page', await page.locator('#pastille-revue').count(), 1);
vrai(
  'et elle est dans le lien de la branche Odyssée',
  await page.evaluate(() =>
    Boolean(document.getElementById('pastille-revue')?.closest('[data-branche="odyssee"]')),
  ),
);

console.log('\n\x1b[1m2. DES REVUES MANQUENT : ELLE S’ALLUME\x1b[0m');
/*
   Profil neuf : aucune revue n'a jamais été tenue, donc `revuesManquees`
   en trouve sept. La prémisse se lit — on la vérifie plus bas en la
   retirant — plutôt que de se deviner.
*/
vrai('la pastille est visible depuis une page de Révisions', await pastilleVisible());
/*
   Sonde faible, et dite telle : `textContent` lit aussi un élément
   caché. Sabotée — la barre ne peignant plus rien —, elle reste verte,
   et c'est la ligne au-dessus qui accuse. Elle garde la formulation, pas
   la visibilité, et les deux sont nécessaires : un point sans libellé
   accessible ne dit rien à qui ne voit pas la couleur.
*/
v(
  'et son libellé dit la chose en toutes lettres (sonde faible : le texte, pas l’affichage)',
  (await page.textContent('#pastille-revue'))?.trim(),
  'La revue vous attend.',
);

console.log('\n\x1b[1m3. TOUTES LES REVUES TENUES : ELLE S’ÉTEINT\x1b[0m');
/*
   On écrit les revues du soir des quinze derniers jours, directement dans
   le magasin — il n'est pas scellé. C'est le seul moyen d'éprouver
   l'extinction : sans lui, la section 2 serait un témoin qui s'allume
   toujours, et on ne saurait pas s'il sait s'éteindre.

   Quinze jours couvrent largement les sept jours rattrapables, et le jour
   courant y est : sans lui, la revue du jour resterait due dans sa
   fenêtre horaire, et l'essai serait rouge une partie de la journée
   seulement — le pire des essais, celui qui dépend de l'heure.
*/
await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const jours = [];
  for (let i = 0; i <= 15; i += 1) {
    const d = new Date(Date.now() - i * 86_400_000);
    jours.push(d.toISOString().slice(0, 10));
  }
  await new Promise((ok, ko) => {
    const tx = base.transaction('odysseeRevues', 'readwrite');
    for (const jour of jours) {
      tx.objectStore('odysseeRevues').put({
        id: `soir:${jour}`,
        type: 'soir',
        jour,
        reponses: {},
        majLe: new Date().toISOString(),
      });
    }
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
});

await aller('/revisions/');
/*
   On attend la fin du travail de la barre avant de conclure à l'absence :
   une sonde d'absence qui regarde trop tôt est verte pour rien. Le témoin
   de synchronisation, peint dans le même passage, sert de repère.
*/
await page.waitForTimeout(4000);
v('la pastille a disparu', await page.locator('#pastille-revue').isVisible(), false);

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
