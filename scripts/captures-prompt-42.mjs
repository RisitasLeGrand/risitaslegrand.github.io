/**
 * Les captures du prompt 42 — les quatorze thèmes, et la page Paramètres.
 *
 *   npm run captures:42
 *
 * Elles vont dans « audit/captures/prompt-42/ », hors du dépôt public : une
 * capture montre l'état d'une base, et cette base ne sort pas de la machine.
 *
 * Trois séries, et pas une de plus :
 *
 * 1. **Chaque thème, dans chaque mode, aux trois tailles** (§ 4.4). C'est
 *    l'accueil qui sert de témoin : il porte un en-tête, des cartes, du
 *    texte secondaire, des boutons d'action et la barre du bas — de quoi
 *    voir d'un coup si une échelle dérivée jure.
 * 2. **La page Paramètres**, aux trois tailles, en Égée clair et sombre.
 * 3. **Les trois écrans dont un réglage a bougé** — profil, progression,
 *    notifications —, pour qu'on puisse comparer à l'identique ce qui n'a
 *    pas dû changer.
 *
 * Le thème est posé comme la personne le poserait : par la clé que la page
 * Paramètres écrit, avant chargement. Aucune écriture détournée.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const DOSSIER = 'audit/captures/prompt-42';

/* Les trois tailles du 41 : téléphone étroit, téléphone courant, ordinateur. */
const TAILLES = [
  { nom: '360', viewport: { width: 360, height: 740 }, tactile: true },
  { nom: '430', viewport: { width: 430, height: 932 }, tactile: true },
  { nom: '1280', viewport: { width: 1280, height: 800 }, tactile: false },
];

/* Les quatorze thèmes, lus dans le catalogue plutôt que recopiés. */
const { THEMES } = await import('../src/lib/themes.ts').catch(() => ({ THEMES: null }));
const IDS = THEMES
  ? THEMES.map((t) => t.id)
  : [
      'egee',
      'republique',
      'santorin',
      'olivier',
      'naxos',
      'milos',
      'amorgos',
      'aube',
      'papier',
      'soir',
      'delos',
      'ardoise',
      'contraste',
      'adaptees',
    ];

mkdirSync(DOSSIER, { recursive: true });

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let faites = 0;

/**
 * Ouvre une page dans un contexte neuf, thème et mode posés d'avance.
 *
 * Un contexte neuf par capture, et c'est délibéré : passer le mode par les
 * options de contexte (`colorScheme`) remplacerait tout le jeu de médias
 * simulés et ferait tomber « pointer: coarse » — le piège mesuré le
 * 18 octobre. On force donc le mode par les heures de bascule, comme une
 * personne le ferait en changeant l'heure de son réveil.
 */
async function capturer(route, fichier, { palette, mode, taille }) {
  const ctx = await nav.newContext({
    viewport: taille.viewport,
    hasTouch: taille.tactile,
    isMobile: taille.tactile,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([p, heures]) => {
      try {
        localStorage.setItem('revinsp.palette', p);
        localStorage.setItem('revinsp.bascule-jour-nuit', 'oui');
        localStorage.setItem('revinsp.heures-bascule', heures);
        localStorage.setItem('revinsp.animations', 'reduites');
      } catch {
        /* rien */
      }
    },
    [palette, mode === 'clair' ? '00:00|23:59' : '03:00|03:01'],
  );
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForLoadState('networkidle');
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DOSSIER}/${fichier}.png`, fullPage: false });
  faites += 1;
  await ctx.close();
}

/* 1. Les quatorze thèmes, aux trois tailles. */
for (const palette of IDS) {
  for (const mode of ['clair', 'sombre']) {
    for (const taille of TAILLES) {
      await capturer('/', `theme-${palette}-${mode}-${taille.nom}`, { palette, mode, taille });
    }
  }
}

/* 2. La page Paramètres, en Égée, aux trois tailles et dans les deux modes. */
for (const mode of ['clair', 'sombre']) {
  for (const taille of TAILLES) {
    await capturer('/parametres/', `parametres-${mode}-${taille.nom}`, {
      palette: 'egee',
      mode,
      taille,
    });
  }
}

/* 3. Les trois écrans dont un réglage a bougé. */
for (const [route, nom] of [
  ['/profil/', 'profil'],
  ['/progression/', 'progression'],
  ['/notifications/', 'notifications'],
]) {
  for (const mode of ['clair', 'sombre']) {
    await capturer(route, `${nom}-${mode}-360`, {
      palette: 'egee',
      mode,
      taille: TAILLES[0],
    });
  }
}

await nav.close();
console.log(`${faites} captures dans ${DOSSIER}/`);
