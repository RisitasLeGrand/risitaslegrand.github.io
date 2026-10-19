/**
 * « Habitude sans pression » — prompt 43, lot F, par l'écran.
 *
 *   npm run essais:habitude:navigateur
 *
 * ## Ce que cet essai mesure, et comment
 *
 * Il part d'une route, sème un profil **synthétique** dans le seul magasin
 * « etat », recharge, et lit ce qui est écrit à l'écran. Chaque contrôle porte
 * sur une phrase visible, jamais sur une variable du code.
 *
 * Deux profils, parce que les deux bandeaux que F1 retire s'excluent l'un
 * l'autre : « en péril » demande une série continuée et un jour non étudié ;
 * « interrompue » demande un trou. Un essai qui n'en sèmerait qu'un ne
 * constaterait que la moitié du retrait, et resterait vert si l'autre bandeau
 * revenait.
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
      `      obtenu  ${String(JSON.stringify(obtenu)).slice(0, 220)}\n      attendu ${String(JSON.stringify(attendu)).slice(0, 220)}`,
    );
  }
};
const vrai = (titre, condition) => v(titre, condition, true);
const faux = (titre, condition) => v(titre, condition, false);

const jour = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const PROFIL_EN_PERIL = {
  xp: 540,
  streakCourante: 7,
  streakRecord: 12,
  dernierJourEtudie: jour(-1),
  badges: [],
  creeLe: jour(-120),
};
const PROFIL_ROMPU = { ...PROFIL_EN_PERIL, streakCourante: 9, dernierJourEtudie: jour(-5) };

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

const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  await deverrouiller();
  await page.waitForTimeout(400);
};

/**
 * Écrit une valeur dans le magasin « etat », par la base, puis rend la main.
 *
 * Tout le semis de cet essai passe par là : un profil, une rotation. Rien
 * d'autre n'est touché, et rien n'est réel.
 */
const semer = (clef, valeur) =>
  page.evaluate(async ([clef, valeur]) => {
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    await new Promise((ok, ko) => {
      const tx = base.transaction('etat', 'readwrite');
      tx.objectStore('etat').put(valeur, clef);
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
  }, [clef, valeur]);

/**
 * Une semaine sans aucun jour de repos.
 *
 * La prémisse de F3 en dépend : un jour de repos n'est PAS un oubli, et la
 * grâce n'aurait rien à absorber. En posant la rotation, l'essai ne dépend
 * plus de ce que le parcours propose par défaut — ni de ce qu'il proposera.
 */
const SEPT_JOURS_TRAVAILLES = {
  rotations: {
    insp: [
      'cas-pratique',
      'droit-public',
      'finances-publiques',
      'economie',
      'questions-europeennes',
      'questions-internationales',
      'questions-sociales',
    ],
  },
  trimestreEcarte: null,
};

const semerLeProfil = (profil) =>
  page.evaluate(async (profil) => {
    const base = await new Promise((ok, ko) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    await new Promise((ok, ko) => {
      const tx = base.transaction('etat', 'readwrite');
      tx.objectStore('etat').put(profil, 'profil');
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
    base.close();
  }, profil);

/** Le texte visible de la page, apostrophes ramenées à la droite. */
const texteDeLaPage = async () =>
  (await page.locator('body').innerText()).replace(/[’ʼ]/g, "'");

try {
  await aller('/');
  await franchirInitialisation(page, RACINE, MDP);

  console.log('\nF1 — LA SÉRIE EN PÉRIL NE PRESSE PLUS PERSONNE');
  await aller('/revisions/');
  await semerLeProfil(PROFIL_EN_PERIL);
  await aller('/revisions/');

  /* La prémisse d'abord : sans elle, les trois contrôles suivants seraient
     verts sur un écran qui ne montre simplement aucune série. */
  vrai(
    'le semis a pris : la série de sept jours est à l’écran',
    (await page.locator('#streak').innerText().catch(() => '')).trim() === '7',
  );

  let texte = await texteDeLaPage();
  faux("« s'arrête ce soir » n'est plus écrit nulle part", texte.includes("s'arrête ce soir"));
  faux('aucun sablier de compte à rebours', texte.includes('⏳'));
  v("le bandeau de relance n'existe plus dans le document", await page.locator('#alerte-streak').count(), 0);

  console.log('\nF1 — LA SÉRIE INTERROMPUE NE REPROCHE PLUS RIEN');
  await semerLeProfil(PROFIL_ROMPU);
  await aller('/revisions/');
  texte = await texteDeLaPage();
  faux("« La série s'est interrompue » n'est plus écrit", texte.includes("s'est interrompue"));
  faux("aucune relance « en relance une nouvelle »", texte.includes('relance une nouvelle'));
  vrai(
    'le compteur dit toujours ce qu’il sait : le record est affiché',
    texte.includes('Record'),
  );
  console.log('\nF3 — UN JOUR OUBLIÉ PAR SEMAINE NE CASSE PLUS LA SÉRIE');
  await semer('planification', SEPT_JOURS_TRAVAILLES);

  /* Un jour sauté, aucune grâce encore consommée : la série tient. */
  await semerLeProfil({ ...PROFIL_EN_PERIL, streakCourante: 7, dernierJourEtudie: jour(-2) });
  await aller('/revisions/');
  v(
    'un jour oublié, la série de sept jours est intacte',
    (await page.locator('#streak').innerText().catch(() => '')).trim(),
    '7',
  );

  /* La même situation, la grâce consommée avant-hier : la série tombe. Ce
     contrôle est aussi la PRÉMISSE du précédent — si le jour sauté n'était
     pas compté comme un oubli, celui-ci rougirait. */
  await semerLeProfil({
    ...PROFIL_EN_PERIL,
    streakCourante: 7,
    dernierJourEtudie: jour(-2),
    graceUtiliseeLe: jour(-2),
  });
  await aller('/revisions/');
  v(
    'la grâce déjà consommée cette semaine : la série est rompue',
    (await page.locator('#streak').innerText().catch(() => '')).trim(),
    '0',
  );

  /* La grâce se renouvelle au bout de sept jours. */
  await semerLeProfil({
    ...PROFIL_EN_PERIL,
    streakCourante: 7,
    dernierJourEtudie: jour(-2),
    graceUtiliseeLe: jour(-9),
  });
  await aller('/revisions/');
  v(
    'la grâce d\u2019il y a neuf jours est de nouveau disponible',
    (await page.locator('#streak').innerText().catch(() => '')).trim(),
    '7',
  );

  /* Deux jours oubliés d'affilée : la grâce absorbe l'accident, pas l'arrêt. */
  await semerLeProfil({ ...PROFIL_EN_PERIL, streakCourante: 7, dernierJourEtudie: jour(-3) });
  await aller('/revisions/');
  v(
    'deux jours oubliés : la série est rompue, grâce ou non',
    (await page.locator('#streak').innerText().catch(() => '')).trim(),
    '0',
  );

  texte = await texteDeLaPage();
  vrai(
    'la règle est écrite sous le compteur',
    texte.includes("Un jour oublié par semaine ne casse pas la série"),
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
