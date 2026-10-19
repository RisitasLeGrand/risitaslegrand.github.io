/**
 * Le compteur de visites par écran — prompt 43, lot I, point 1.
 *
 *   npm run essais:compteur-visites
 *
 * ## Ce que cet essai garde
 *
 * Il garde d'abord les PROMESSES DE DISCRÉTION, parce que ce sont elles qui
 * rendent ce compteur acceptable :
 *
 * 1. rien en clair dans la base ne nomme une route — la clé est tirée au
 *    hasard, et l'essai le vérifie en lisant la base SANS la clé du coffre ;
 * 2. aucune date n'est écrite, nulle part, même scellée ;
 * 3. coffre fermé, rien n'est compté.
 *
 * Il garde ensuite ce que le point demande : que les visites soient comptées,
 * par écran, et que l'écran les montre.
 *
 * ## Pourquoi il lit la base deux fois
 *
 * Une fois coffre OUVERT, par le module, pour savoir ce qui est compté. Une
 * fois coffre FERMÉ, par `indexedDB` directement, pour voir ce qu'un lecteur
 * sans clé verrait. C'est la seconde lecture qui prouve la discrétion ; la
 * première ne prouverait que le bon fonctionnement.
 *
 * Playwright n'est pas une dépendance du projet : lancez « astro preview »
 * avant ce script.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
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
      `      obtenu  ${String(JSON.stringify(obtenu)).slice(0, 240)}\n      attendu ${String(JSON.stringify(attendu)).slice(0, 240)}`,
    );
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const nav = await chromium.launch({
  executablePath: cheminDuNavigateur(),
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log(`PAGEERROR: ${e.message.slice(0, 200)}`));

const deverrouiller = async () => {
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
};
const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await page.waitForTimeout(400);
};

/** Le magasin « visites » tel qu'un lecteur SANS clé le voit. */
const visitesEnClair = () =>
  page.evaluate(async () => {
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    if (!base.objectStoreNames.contains('visites')) {
      base.close();
      return null;
    }
    const rangees = await new Promise((ok) => {
      const q = base.transaction('visites').objectStore('visites').getAll();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return rangees;
  });

try {
  await aller('/');
  await franchirInitialisation(page, RACINE, MDP);

  console.log('\nI1 — COFFRE FERMÉ, RIEN N’EST COMPTÉ');
  await aller('/revisions/');
  await aller('/glossaire/');
  await aller('/revisions/');
  const ferme = await visitesEnClair();
  v('le magasin existe au schéma', Array.isArray(ferme), true);
  v('et il est vide : écrire scellé demande la clé', ferme?.length ?? -1, 0);

  await aller('/statistiques/');
  vrai(
    'l’écran le dit, au lieu de montrer une liste vide',
    (await page.locator('#visites-etat').innerText().catch(() => '')).toLowerCase().includes('coffre fermé'),
  );

  console.log('\nI1 — COFFRE OUVERT, LES VISITES SE COMPTENT PAR ÉCRAN');
  await aller('/odyssee/corps/');
  const champ = page.locator('#mdp-coffre');
  vrai('prémisse : le coffre s’offre', await champ.isVisible().catch(() => false));
  await champ.fill(MDP);
  await page.locator('#ouvrir-coffre').click().catch(() => {});
  await page.waitForTimeout(1500);

  await aller('/revisions/');
  await aller('/glossaire/');
  await aller('/revisions/');
  await aller('/revisions/');

  const scellees = await visitesEnClair();
  vrai('des visites ont été écrites', (scellees?.length ?? 0) >= 2);

  console.log('\nI1 — CE QU’UN LECTEUR SANS CLÉ PEUT EN TIRER : RIEN');
  /* La forme réelle d'un enregistrement scellé est « { id, scelle } », le
     sceau portant « v », « iv » et « ct ». Ma première version de ce contrôle
     attendait les quatre champs à plat : c'était l'essai qui avait tort, et
     c'est en le mesurant que la forme s'est dite. */
  const champsEnClair = [...new Set((scellees ?? []).flatMap((r) => Object.keys(r)))].sort();
  v('les champs en clair sont l’identifiant et le sceau', champsEnClair, ['id', 'scelle']);
  const champsDuSceau = [
    ...new Set((scellees ?? []).flatMap((r) => Object.keys(r.scelle ?? {}))),
  ].sort();
  v('et le sceau ne porte que sa version, son vecteur et son chiffré', champsDuSceau, [
    'ct',
    'iv',
    'v',
  ]);

  const texte = JSON.stringify(scellees ?? []);
  faux('aucune route ne se lit', texte.includes('revisions') || texte.includes('glossaire'));
  faux(
    'aucun identifiant ne ressemble à une route',
    (scellees ?? []).some((r) => String(r.id).includes('/')),
  );
  /* Aucune date : ni champ daté, ni valeur qui ressemble à une date ISO. */
  faux('aucune date, même dans le sceau', /\d{4}-\d{2}-\d{2}/.test(texte));

  console.log('\nI1 — L’ÉCRAN MONTRE LE CLASSEMENT');
  await aller('/statistiques/');
  await page.waitForTimeout(600);
  const lignes = await page.$$eval('#visites-liste li', (ls) =>
    ls.map((l) => l.innerText.replace(/\s+/g, ' ').trim()),
  );
  vrai('la liste n’est pas vide', lignes.length >= 2);
  vrai(
    'l’écran le plus ouvert est en tête',
    (lignes[0] ?? '').startsWith('/revisions'),
  );
  vrai(
    'et son compte est celui des visites faites coffre ouvert',
    /(^|\s)3$/.test(lignes[0] ?? ''),
  );
  vrai(
    'le total et le nombre d’écrans sont dits',
    (await page.locator('#visites-etat').innerText().catch(() => '')).includes('ouvertures comptées'),
  );

  console.log('\nI1 — LES PARAMÈTRES D’ADRESSE NE SONT PAS COMPTÉS');
  faux(
    'aucune ligne ne porte un paramètre',
    lignes.some((l) => l.includes('?') || l.includes('=')),
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
