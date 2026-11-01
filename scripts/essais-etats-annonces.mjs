/**
 * Les états sont lus par le lecteur d'écran — prompt 43, E7.
 *
 *   npm run essais:etats-annonces
 *
 * ## Ce que cet essai mesure
 *
 * Trois défauts, tous invisibles à l'œil et tous audibles :
 *
 * 1. deux conteneurs de « À rapprocher » annonçaient `role="tablist"` sans
 *    porter un seul onglet ;
 * 2. les cinq boutons de périodicité des actualités portaient
 *    `aria-selected` sans `role="tab"` — un attribut qui n'existe pas hors
 *    d'un onglet ;
 * 3. les quatre cases « noter » de Psyché s'appelaient toutes « noter »,
 *    sans jamais dire quelle dimension elles activent.
 *
 * Rien de tout cela ne se voit sur une capture. C'est pourquoi cet essai
 * part d'une route, lit les RÔLES et les NOMS ACCESSIBLES tels que le
 * navigateur les calcule — `getByRole` les calcule vraiment —, et actionne
 * les commandes pour vérifier que l'état suit.
 *
 * Playwright n'est pas une dépendance du projet : lancez « astro preview »
 * avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { devientVisible } from './lib/post-condition.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(
      `      obtenu  ${String(JSON.stringify(obtenu)).slice(0, 220)}\n      attendu ${String(JSON.stringify(attendu)).slice(0, 220)}`,
    );
  }
};
const vrai = (titre, condition) => v(titre, condition, true);

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log(`PAGEERROR: ${e.message.slice(0, 200)}`));

const deverrouiller = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
};

/**
 * Va sur un écran, le déverrouille, et attend son TÉMOIN.
 *
 * Le témoin est demandé à l'appelant, et ce n'est pas une commodité : les
 * 500 ms d'avant précédaient, selon l'appel, des assertions radicalement
 * différentes — dont deux NÉGATIVES (« aucun tablist », « aucun
 * aria-selected »). Une assertion négative devant un écran pas encore peint
 * est vraie d'avance : elle aurait été verte sur une page blanche, ce qui
 * est le contraire de ce qu'elle prétend établir.
 *
 * On attend donc quelque chose dont la présence prouve que l'écran est
 * rendu, et qui ne soit PAS ce que l'assertion vérifie — sinon l'attente
 * décide du verdict.
 */
const aller = async (chemin, temoin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  if (temoin) await page.locator(temoin).first().waitFor({ state: 'visible', timeout: 30000 });
};

/** Ouvre le coffre depuis l'écran courant, s'il le demande. */
const ouvrirLeCoffre = async () => {
  const champ = page.locator('#mdp-coffre');
  if (!(await champ.isVisible().catch(() => false))) return true;
  await champ.fill(MDP);
  await page.locator('#ouvrir-coffre').click().catch(() => {});
  /*
     LE DÉPART DU CHAMP EST LE TÉMOIN, et il faut remarquer que cette
     fonction REND le verdict que l'assertion affiche — « prémisse : le
     coffre s'ouvre ». Une attente qui garantirait ce verdict le rendrait
     vrai d'office.

     `devientVisible` ne le garantit pas : elle rend `false` quand la borne
     est atteinte. Le champ parti, on rend `true` ; le champ resté, on rend
     `false` et la prémisse tombe — ce qu'elle doit faire, puisque rien de ce
     qui suit n'aurait alors de sens.
  */
  return devientVisible(page, '#mdp-coffre', false, { delai: 30000 });
};

/**
 * Les clés dont l'état annoncé est « pressé », triées.
 *
 * Sert à attendre un CHANGEMENT d'état sans dire lequel : les assertions
 * disent quelle clé doit être pressée après le clic, et une attente qui le
 * dirait aussi les empêcherait d'échouer.
 */
const pressees = async (selecteur) =>
  (await etats(selecteur))
    .filter((x) => x.presse === 'true')
    .map((x) => x.cle)
    .sort()
    .join('|');

/** Attend que l'ensemble des pressés DIFFÈRE de ce qu'il était. */
const apresLeChangementDEtat = async (selecteur, geste) => {
  const avant = await pressees(selecteur);
  await geste();
  const fin = Date.now() + 30000;
  for (;;) {
    if ((await pressees(selecteur)) !== avant) return true;
    if (Date.now() > fin) return false;
    await page.waitForTimeout(50);
  }
};

/** Les boutons d'un groupe, avec leur état annoncé. */
const etats = (selecteur) =>
  page.$$eval(selecteur, (els) =>
    els.map((e) => ({
      cle: e.dataset.filtre ?? e.dataset.axe ?? e.dataset.vue ?? '',
      presse: e.getAttribute('aria-pressed'),
    })),
  );

try {
  await aller('/');
  await franchirInitialisation(page, RACINE, MDP);

  console.log('\nE7 — « À RAPPROCHER » : DEUX FAUX ONGLETS');
  await aller('/odyssee/rapprocher/');
  vrai('prémisse : le coffre s’ouvre', await ouvrirLeCoffre());
  /* Les filtres rendus : c'est ce que les assertions vont compter. */
  await page.locator('.filtre').first().waitFor({ state: 'visible', timeout: 30000 });

  v('aucun « tablist » ne subsiste sur l’écran', await page.locator('[role="tablist"]').count(), 0);
  v('aucun « tab » orphelin non plus', await page.locator('[role="tab"]').count(), 0);
  v(
    'les filtres forment un groupe nommé',
    await page.getByRole('group', { name: 'Filtrer la file' }).count(),
    1,
  );
  v(
    'et les axes aussi',
    await page.getByRole('group', { name: 'Axe de comparaison' }).count(),
    1,
  );

  const filtres = await etats('.filtre');
  v('les quatre filtres annoncent leur état', filtres.length, 4);
  v(
    'un seul est pressé à la fois',
    filtres.filter((f) => f.presse === 'true').length,
    1,
  );
  vrai('et aucun ne reste muet', filtres.every((f) => f.presse === 'true' || f.presse === 'false'));

  /* L'état SUIT le geste : un attribut posé une fois au rendu et jamais
     remis à jour serait vert au premier contrôle et faux ensuite. */
  await apresLeChangementDEtat('.filtre', () =>
    page.locator('[data-filtre="a-revoir"]').click().catch(() => {}),
  );
  const apres = await etats('.filtre');
  v(
    'le pressé a suivi le clic',
    apres.find((f) => f.presse === 'true')?.cle,
    'a-revoir',
  );

  const axes = await etats('.axe');
  v('les trois axes annoncent leur état', axes.length, 3);
  v('un seul axe est pressé', axes.filter((a) => a.presse === 'true').length, 1);

  console.log('\nE7 — LES ACTUALITÉS : « aria-selected » SANS ONGLET');
  /*
     Le témoin est `.onglet-vue`, et non `[role="tablist"]` : les deux
     assertions qui suivent sont négatives, et attendre leur objet serait
     attendre qu'il n'arrive pas — c'est-à-dire ne rien attendre du tout.
     Un bouton de vue présent prouve que l'écran est rendu, et laisse les
     deux assertions dire ce qu'il ne porte pas.
  */
  await aller('/actualites/', '.onglet-vue');
  v('aucun « tablist »', await page.locator('[role="tablist"]').count(), 0);
  v('aucun « aria-selected » nulle part', await page.locator('[aria-selected]').count(), 0);
  v(
    'la périodicité est un groupe nommé',
    await page.getByRole('group', { name: 'Périodicité' }).count(),
    1,
  );
  const vues = await etats('.onglet-vue');
  v('les cinq vues annoncent leur état', vues.length, 5);
  v('une seule est pressée', vues.filter((x) => x.presse === 'true').length, 1);
  await apresLeChangementDEtat('.onglet-vue', () =>
    page.locator('[data-vue="mois"]').click().catch(() => {}),
  );
  v(
    'le pressé a suivi le clic',
    (await etats('.onglet-vue')).find((x) => x.presse === 'true')?.cle,
    'mois',
  );

  console.log('\nE7 — PSYCHÉ : QUATRE FOIS « NOTER », ET MAINTENANT QUATRE NOMS');
  await aller('/odyssee/psyche/');
  vrai('prémisse : le coffre s’ouvre', await ouvrirLeCoffre());
  /* Les quatre cases rendues : c'est sur elles que portent les assertions. */
  await page.locator('[data-active]').first().waitFor({ state: 'visible', timeout: 30000 });

  for (const libelle of ['Humeur', 'Énergie', 'Stress', 'Motivation']) {
    v(
      `une case « noter » porte « ${libelle} » dans son nom`,
      await page.getByRole('checkbox', { name: new RegExp(`noter\\s*${libelle}`, 'i') }).count(),
      1,
    );
  }
  /* Et le mot visible n'a pas changé : le nom accessible s'ajoute, il ne
     remplace pas. Une correction qui alourdirait l'écran pour tout le monde
     serait une autre faute. */
  const visible = await page.$$eval('[data-active]', (els) =>
    els.map((e) => (e.closest('label')?.firstChild?.nodeValue ?? '') + (e.parentElement?.innerText ?? '')),
  );
  vrai(
    'le mot visible reste « noter »',
    visible.length === 4 && visible.every((t) => t.trim().toLowerCase().startsWith('noter')),
  );
} finally {
  await contexte.close();
  await nav.close();
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les contrôles sont verts.\x1b[0m\n'
    : `\n\x1b[31m${echecs} contrôle${echecs > 1 ? 's' : ''} rouge${echecs > 1 ? 's' : ''}.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
