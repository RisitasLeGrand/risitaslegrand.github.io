/**
 * Le retour arrière ferme le calque, et ne quitte pas la page (M5).
 *
 * ## Le défaut visé
 *
 * Sur un téléphone, le retour arrière est le premier réflexe pour refermer ce
 * qui vient de s'ouvrir. Il ne fermait rien : la feuille « Plus », le centre
 * de notifications et le menu du cadenas ne touchaient pas à l'historique, si
 * bien que le retour **quittait l'écran** avec le calque encore par-dessus.
 *
 * ## Les deux moitiés, et la seconde est celle qu'on oublie
 *
 * 1. Le retour referme le calque **et** laisse la page en place.
 * 2. Fermer par le bouton visible ne laisse **pas** d'entrée fantôme : le
 *    retour suivant doit quitter l'écran pour de bon, et non être avalé.
 *
 * Un essai qui ne mesure que la première laisse passer un historique qui
 * enfle à chaque ouverture — et c'est un défaut pire que celui qu'il corrige,
 * parce qu'il faut alors reculer trois fois pour sortir d'une page.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { devientVisible } from './lib/post-condition.mjs';

const BASE = 'http://localhost:4321';
const MDP = motDePasseEssais();

let echecs = 0;
const verifier = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
process.on('uncaughtException', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({ executablePath: cheminDuNavigateur() });
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);

const chemin = () => new URL(page.url()).pathname;
const visible = (id) =>
  page.evaluate((i) => {
    const e = document.getElementById(i);
    if (!e) return false;
    if (e.hidden) return false;
    const r = e.getBoundingClientRect();
    return r.height > 0 && r.width > 0;
  }, id);

console.log('\nLA FEUILLE « PLUS » : LE RETOUR LA FERME, SANS QUITTER L’ÉCRAN');

/* Deux pages d'historique, pour que « quitter » ait un sens observable. */
await page.goto(`${BASE}/odyssee/`, { waitUntil: 'networkidle' });
await page.goto(`${BASE}/odyssee/calendrier/`, { waitUntil: 'networkidle' });
/*
   CE QUE CES NEUF ATTENTES COUVRAIENT, ET CE QUI LES REMPLACE.

   Ce fichier mesure l'historique, et c'est ce qui rendait ses attentes
   délicates : la moitié de ses assertions sont NÉGATIVES — « la page n'a
   pas bougé ». Une attente trop courte les rendrait vraies d'avance, et
   c'est le pire cas possible ici, puisque le défaut que l'essai traque est
   précisément un historique qui bouge quand il ne devrait pas.

   La clé est que `page.goBack()` est ATTENDU : quand il rend la main, le
   déplacement dans l'historique est accompli et `page.url()` est à jour,
   que le retour ait changé de document ou seulement défait un `pushState`.
   Il ne reste donc rien à attendre du côté du chemin — et tout du côté du
   calque, qui réagit au `popstate` dans son propre temps.

   Chaque assertion négative sur le chemin est ainsi gardée par un
   complément POSITIF sur le calque : le calque était visible, on attend
   qu'il ne le soit plus. Et si un retour quittait l'écran par erreur, le
   calque disparaîtrait aussi — mais le chemin, lu ensuite, accuserait. Les
   deux assertions se tiennent l'une l'autre.
*/
await page.locator('#ouvrir-plus').waitFor({ state: 'visible', timeout: 30000 });
verifier('prémisse : on est sur le calendrier', chemin(), '/odyssee/calendrier/');

await page.click('#ouvrir-plus');
await devientVisible(page, '#feuille-plus', true, { delai: 30000 });
verifier('la feuille est ouverte', await visible('feuille-plus'), true);

await page.goBack();
await devientVisible(page, '#feuille-plus', false, { delai: 30000 });
verifier('le retour la referme', await visible('feuille-plus'), false);
verifier('et la page n’a pas bougé', chemin(), '/odyssee/calendrier/');

console.log('\nET FERMER PAR LE BOUTON NE LAISSE PAS D’ENTRÉE FANTÔME');

await page.click('#ouvrir-plus');
await devientVisible(page, '#feuille-plus', true, { delai: 30000 });
verifier('prémisse : la feuille est rouverte', await visible('feuille-plus'), true);
await page.click('#fermer-plus');
await devientVisible(page, '#feuille-plus', false, { delai: 30000 });
verifier('le bouton la referme', await visible('feuille-plus'), false);
verifier('la page n’a toujours pas bougé', chemin(), '/odyssee/calendrier/');

/*
   CELLE-CI EST POSITIVE, et c'est la seule du fichier : le retour doit
   VRAIMENT quitter l'écran. On attend donc le chemin d'arrivée, ce qui est
   un changement, et non un délai.
*/
await page.goBack();
await page.waitForURL(`${BASE}/odyssee/`, { timeout: 30000 }).catch(() => {});
verifier(
  'le retour suivant quitte vraiment l’écran, il n’est pas avalé',
  chemin(),
  '/odyssee/',
);

console.log('\nLE CENTRE DE NOTIFICATIONS, MÊME RÈGLE');

await page.goto(`${BASE}/odyssee/calendrier/`, { waitUntil: 'networkidle' });
await page.locator('#centre-bouton').waitFor({ state: 'visible', timeout: 30000 });
await page.click('#centre-bouton');
await devientVisible(page, '#centre-panneau', true, { delai: 30000 });
verifier('le panneau est ouvert', await visible('centre-panneau'), true);
await page.goBack();
await devientVisible(page, '#centre-panneau', false, { delai: 30000 });
verifier('le retour le referme', await visible('centre-panneau'), false);
verifier('et la page reste', chemin(), '/odyssee/calendrier/');

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
