/**
 * Le journal d'usage, dans un vrai navigateur.
 *
 * Ce que cet essai couvre et que les essais purs ne peuvent pas couvrir :
 * que l'enregistreur est **réellement branché** sur la mise en page, qu'une
 * navigation ne fabrique pas une session par page, qu'aucun champ de contenu
 * ne se glisse dans ce qui est écrit, et que rien ne part sur le réseau.
 *
 * Le dernier point mérite d'être vérifié ici plutôt que relu : un journal
 * d'usage est exactement la donnée qu'une bibliothèque de mesure
 * d'audience enverrait ailleurs sans qu'on s'en aperçoive.
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
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 250)}\n      attendu ${JSON.stringify(attendu)?.slice(0, 250)}`);
};
const vrai = (t, c) => v(t, c, true);
const faux = (t, c) => v(t, c, false);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 250)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 250)); });

const sorties = [];
await page.route('**/*', (route) => {
  const url = route.request().url();
  if (!url.startsWith(RACINE) && !url.startsWith('data:') && !url.startsWith('blob:')) {
    sorties.push(url);
  }
  return route.continue();
});

await franchirInitialisation(page, RACINE, MDP);

async function aller(chemin) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
}

/** Lit le magasin directement : l'enregistreur n'a pas d'écran. */
const sessions = () =>
  page.evaluate(
    () =>
      new Promise((resoudre, rejeter) => {
        const d = indexedDB.open('revinsp');
        d.onerror = () => rejeter(d.error);
        d.onsuccess = () => {
          const base = d.result;
          const tx = base.transaction('odysseeUsage', 'readonly');
          const tout = tx.objectStore('odysseeUsage').getAll();
          tout.onsuccess = () => {
            base.close();
            resoudre(tout.result);
          };
          tout.onerror = () => rejeter(tout.error);
        };
      }),
  );

const attendreUneSession = async (combien) => {
  for (let essai = 0; essai < 40; essai += 1) {
    const s = await sessions();
    if (s.length >= combien) return s;
    await page.waitForTimeout(250);
  }
  return sessions();
};

console.log('\nUNE SESSION S’OUVRE À L’ENTRÉE');

await aller('/odyssee/');
const premieres = await attendreUneSession(1);
v('une session, et une seule', premieres.length, 1);

const session = premieres[0];
{
  v(
    'elle ne porte que les cinq champs autorisés',
    Object.keys(session).sort(),
    ['debut', 'fin', 'id', 'jour', 'majLe'],
  );
  vrai('elle a un début', typeof session.debut === 'string' && session.debut.length > 0);
  vrai('et un jour logique', /^\d{4}-\d{2}-\d{2}$/.test(session.jour));
}

console.log('\nCHANGER DE PAGE NE FABRIQUE PAS UNE SESSION DE PLUS');

await aller('/odyssee/psyche/');
await aller('/');
{
  const apres = await sessions();
  v('toujours une seule session', apres.length, 1);
  v('et c’est la même', apres[0].id, session.id);
  vrai(
    'dont la fin a été repoussée',
    Date.parse(apres[0].fin) >= Date.parse(session.fin ?? session.debut),
  );
}

console.log('\nAUCUN CONTENU N’EST ENREGISTRÉ');

{
  const apres = await sessions();
  const texte = JSON.stringify(apres);
  /*
     Les trois pages visitées sont nommément cherchées dans ce qui a été
     écrit. C'est la garde qui compte : savoir que quelqu'un a ouvert
     Cyclades à 3 h est une information de rythme ; savoir qu'il a ouvert
     « Ma psyché » à 3 h est une information sur lui.
  */
  faux('aucune trace de « psyche »', texte.includes('psyche'));
  faux('aucune trace de « odyssee »', texte.includes('odyssee'));
  faux('aucune URL', texte.includes('http'));
}

console.log('\nUN ONGLET NEUF OUVRE SA PROPRE SESSION');

{
  /*
     `sessionStorage` meurt avec l'onglet : un second onglet doit donc ouvrir
     une session distincte. `fusionnerLesProches()` les réunira à la lecture
     si elles se touchent — ce qui est le bon endroit pour le faire, puisque
     la fusion dépend d'un seuil qu'on peut vouloir changer plus tard.
  */
  const second = await contexte.newPage();
  await second.goto(`${RACINE}/odyssee/`, { waitUntil: 'networkidle' });
  if (await second.locator('#champ-mdp').isVisible().catch(() => false)) {
    await second.fill('#champ-mdp', MDP);
    await second.click('#bouton-verrou');
  }
  for (let essai = 0; essai < 40; essai += 1) {
    if ((await sessions()).length >= 2) break;
    await page.waitForTimeout(250);
  }
  const apres = await sessions();
  v('deux sessions', apres.length, 2);
  vrai('d’identifiants distincts', new Set(apres.map((s) => s.id)).size === 2);
  await second.close();
}

console.log('\nRIEN N’EST SORTI DU SITE');
v('aucune requête extérieure', sorties, []);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m`
    : '\n\x1b[32m✓ tout passe\x1b[0m',
);
await nav.close();
process.exit(echecs ? 1 : 0);
