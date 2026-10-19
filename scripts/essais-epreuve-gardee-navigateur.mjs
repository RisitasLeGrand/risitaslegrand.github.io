/**
 * Garder une épreuve pour plus tard, et la reprendre (C3 du prompt 43).
 *
 *   CHROMIUM=… npm run essais:epreuve-gardee:navigateur
 *
 * ## Pourquoi cet essai construit son propre site
 *
 * L'écran du QCM DGFiP ne s'ouvre que si la banque de questions existe, et
 * cette banque vient de `content/qcm-dgfip/`, chiffré à la construction. Le
 * conteneur où le travail se fait n'en porte aucune : le bouton « Commencer »
 * y est désactivé, et aucune épreuve ne peut être commencée — donc aucune
 * gardée. Servir une banque de contrebande par le réseau ne marcherait pas
 * davantage : les fichiers sont chiffrés avec la clé du site.
 *
 * Cet essai bâtit donc un **laboratoire**, comme cinq autres du dépôt : un
 * `content/` tiré de `content-exemple/`, une banque synthétique de quatre
 * questions, un mot de passe factice, un aperçu sur le port 4322 — et il
 * efface tout derrière lui. Il REFUSE de démarrer si `content/`, `.env.local`
 * ou `public/data/` existent déjà : il ne travaillera pas par-dessus du
 * contenu réel.
 *
 * ## Ce qu'il garde, et que l'essai pur ne peut pas garder
 *
 * - que la sortie propose **trois** issues, et non « rester ou tout perdre » ;
 * - que « Garder pour plus tard » rende l'épreuve **telle quelle** : mêmes
 *   questions, même ordre des propositions, mêmes cases cochées, même
 *   position — et qu'elle survive à la fermeture de l'onglet ;
 * - que « Abandonner » ne laisse **rien** dans la base, lu par `indexedDB`
 *   depuis la page et non par le module qui vient d'effacer ;
 * - qu'une épreuve que la banque ne permet plus de reprendre le dise sans le
 *   mot « erreur », soit effacée, et ne reparaisse pas à la visite suivante.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { attendreLaBoite, BOITE, repondreALaBoite } from './lib/boite-essais.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-prompt-43-c3-sans-valeur';
const PORT = 4322;
const RACINE_WEB = `http://localhost:${PORT}`;

let rouges = 0;
const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const v = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) rouges += 1;
  console.log(`  ${ok ? vert('✓') : rouge('✗')} ${quoi}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 260)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 260)}`);
  }
};
const vrai = (quoi, condition) => v(quoi, condition, true);
const faux = (quoi, condition) => v(quoi, condition, false);

/* ── Les gardes : jamais par-dessus du contenu réel ──────────────────────── */

const gardes = [
  ['content', path.join(racine, 'content')],
  ['.env.local', path.join(racine, '.env.local')],
  ['public/data', path.join(racine, 'public', 'data')],
  ['.temoin-mot-de-passe.local.json', path.join(racine, '.temoin-mot-de-passe.local.json')],
];
const occupes = gardes.filter(([, chemin]) => existsSync(chemin)).map(([nom]) => nom);
if (occupes.length) {
  console.log(
    `\n${rouge('✗ REFUS')} — ${occupes.join(', ')} existe déjà.\n` +
      '  Cet essai construit un site de laboratoire avec un mot de passe factice et\n' +
      '  efface tout derrière lui : il ne travaillera pas par-dessus du contenu réel.\n' +
      '  La batterie le lance dans un arbre de travail séparé, qui n’en porte aucun.',
  );
  process.exit(1);
}

/* ── Une banque synthétique, de quatre questions ─────────────────────────── */

/*
   Quatre questions à trois options : assez pour que la « Série courte » en
   tire plusieurs, assez peu pour que l'essai reste lisible. Les énoncés sont
   inventés et sans valeur de révision — c'est un décor, pas du contenu.
*/
const BANQUE = `rubrique: Laboratoire
ordre: 1
questions:
${[1, 2, 3, 4]
  .map(
    (n) => `  - question: Question de laboratoire numéro ${n} ?
    options:
      - Première proposition ${n}
      - Deuxième proposition ${n}
      - Troisième proposition ${n}
    reponse: Première proposition ${n}
    explication: Réponse de laboratoire, sans valeur de révision.
    categorie_origine: maison`,
  )
  .join('\n')}
`;

const node = (script, env = {}) =>
  execFileSync(process.execPath, [path.join(racine, 'scripts', script)], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

function nettoyer() {
  try {
    execFileSync('npx', ['astro', 'preview', 'stop'], { cwd: racine, stdio: 'ignore' });
  } catch {
    /* aucun aperçu à arrêter */
  }
  for (const [, chemin] of gardes) rmSync(chemin, { recursive: true, force: true });
  rmSync(path.join(racine, 'dist'), { recursive: true, force: true });
}

let nav = null;

try {
  console.log('\nLA CONSTRUCTION DU LABORATOIRE');
  node('init-contenu.mjs');
  mkdirSync(path.join(racine, 'content', 'qcm-dgfip'), { recursive: true });
  writeFileSync(path.join(racine, 'content', 'qcm-dgfip', 'laboratoire.yml'), BANQUE);
  writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);
  node('build-content.mjs');
  execFileSync('npx', ['astro', 'build'], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, REVINSP_SANS_PODCAST: '1' },
  });
  /* Le mot de passe ne survit pas à la construction : il n'a rien à faire sur
     le disque une seconde de plus que nécessaire. */
  rmSync(path.join(racine, '.env.local'), { force: true });
  console.log(`  ${vert('✓')} la banque de laboratoire est construite`);

  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: racine,
    detached: true,
    stdio: 'ignore',
  }).unref();
} catch (erreur) {
  console.log(`\n${rouge('✗ PANNE')} — le laboratoire n’a pas pu être construit.`);
  console.log(String(erreur?.message ?? erreur).slice(0, 600));
  nettoyer();
  process.exit(1);
}

try {
  for (let essai = 0; essai < 40; essai++) {
    try {
      if ((await fetch(`${RACINE_WEB}/data/cle.json`)).ok) break;
    } catch {
      /* pas encore debout */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  nav = await chromium.launch({ executablePath: cheminDuNavigateur(), args: ['--no-sandbox'] });
  const contexte = await nav.newContext();
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

  /** Ce que la base porte, lu depuis la page et non par le module. */
  const dansLaBase = () =>
    page.evaluate(
      () =>
        new Promise((ok) => {
          const r = indexedDB.open('revinsp');
          r.onsuccess = () => {
            if (!r.result.objectStoreNames.contains('epreuveDgfipEnCours')) return ok('magasin-absent');
            const tx = r.result.transaction('epreuveDgfipEnCours', 'readonly');
            tx.objectStore('epreuveDgfipEnCours').getAll().onsuccess = (e) => ok(e.target.result);
          };
          r.onerror = () => ok('base-illisible');
        }),
    );

  /** L'épreuve telle qu'elle est à l'écran : énoncé, propositions, cases. */
  const etatDeLEcran = () =>
    page.evaluate(() => ({
      enonce: document.getElementById('enonce-dgfip')?.textContent?.trim(),
      options: [...document.querySelectorAll('#options-dgfip button')].map((b) => ({
        texte: b.textContent?.trim(),
        coche: b.getAttribute('aria-checked'),
      })),
    }));

  async function aller(chemin, attendu) {
    await page.goto(`${RACINE_WEB}${chemin}`, { waitUntil: 'networkidle' });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MOT_DE_PASSE);
      await page.click('#bouton-verrou');
    }
    if (attendu) await page.waitForSelector(attendu, { timeout: 40000 });
  }

  /* ──────────────────────────────────────────────────────────────────────
     1. Sans rien de gardé, l'écran ne propose rien
     ────────────────────────────────────────────────────────────────────── */
  console.log('\nSANS RIEN DE GARDÉ, AUCUNE PROPOSITION');

  await aller('/quiz/dgfip/', '#lancer-dgfip');
  vrai(
    'le bloc de reprise est caché',
    await page.locator('#reprise-dgfip').evaluate((e) => e.classList.contains('hidden')),
  );
  faux(
    'et « Commencer » est proposé : la banque de laboratoire est bien là',
    await page.locator('#lancer-dgfip').isDisabled(),
  );

  /* ──────────────────────────────────────────────────────────────────────
     2. Quitter propose TROIS issues
     ────────────────────────────────────────────────────────────────────── */
  console.log('\nQUITTER PROPOSE TROIS ISSUES');

  await page.selectOption('#format-dgfip', 'mixte-12');
  await page.click('#lancer-dgfip');
  await page.waitForSelector('#options-dgfip button', { timeout: 20000 });

  await page.locator('#options-dgfip button').first().click();
  const premiere = await etatDeLEcran();
  await page.click('#suivant-dgfip');
  await page.locator('#options-dgfip button').nth(1).click();
  const seconde = await etatDeLEcran();

  await page.click('#quitter-dgfip');
  v('la feuille dit ce qu’on quitte', await attendreLaBoite(page), 'Quitter l’épreuve ?');
  const boutons = await page.$$eval(`${BOITE}[open] .boite-bouton`, (l) =>
    l.map((b) => ({
      texte: b.textContent?.trim(),
      type: b.getAttribute('type'),
      ordre: getComputedStyle(b).order,
    })),
  );
  v('trois issues, et non deux', boutons.length, 3);
  v(
    'leurs verbes',
    boutons.map((b) => b.texte).sort(),
    ['Abandonner', 'Continuer l’épreuve', 'Garder pour plus tard'],
  );
  v('« Continuer » est à gauche', boutons.find((b) => b.texte === 'Continuer l’épreuve')?.ordre, '1');
  v(
    'et il a le focus',
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    'Continuer l’épreuve',
  );
  /* Entrée ne déclenche jamais une destructrice : elle n'est pas un bouton de
     soumission. C'est ce qui empêche de perdre une épreuve d'une touche. */
  v(
    '« Abandonner » n’est pas un bouton de soumission',
    boutons.find((b) => b.texte === 'Abandonner')?.type,
    'button',
  );

  /* ──────────────────────────────────────────────────────────────────────
     3. Gardée, puis reprise telle quelle
     ────────────────────────────────────────────────────────────────────── */
  console.log('\nGARDÉE, PUIS REPRISE TELLE QUELLE');

  await repondreALaBoite(page, 'Garder pour plus tard');
  await page.waitForSelector('#reprise-dgfip:not(.hidden)', { timeout: 20000 });
  const texteReprise = (await page.locator('#reprise-texte').textContent())?.trim();
  vrai(
    'le bloc dit où l’on s’était arrêté',
    /gardé une épreuve commencée le .+, à la question 2 sur \d+\.$/.test(texteReprise ?? ''),
  );
  faux('et il ne parle pas d’erreur', /erreur/i.test(texteReprise ?? ''));

  const gardee = await dansLaBase();
  v('un seul enregistrement, de clé fixe', gardee.length, 1);
  v('la clé est bien « courante »', gardee[0]?.id, 'courante');
  v('il porte la position', gardee[0]?.position, 1);
  vrai('ainsi que l’ordre des propositions', Array.isArray(gardee[0]?.ordres?.[0]));

  /* Rechargée : la reprise survit à la fermeture de l'onglet. */
  await aller('/quiz/dgfip/', '#reprise-dgfip:not(.hidden)');
  await page.click('#reprendre-dgfip');
  await page.waitForSelector('#options-dgfip button', { timeout: 20000 });
  v('la reprise rouvre la question où l’on était', await etatDeLEcran(), seconde);
  await page.click('#precedent-dgfip');
  v('et la précédente a gardé sa réponse et son ordre', await etatDeLEcran(), premiere);
  v('le brouillon est consommé par la reprise', (await dansLaBase()).length, 0);

  /* ──────────────────────────────────────────────────────────────────────
     4. Abandonner ne laisse rien
     ────────────────────────────────────────────────────────────────────── */
  console.log('\nABANDONNER NE LAISSE RIEN');

  await page.click('#quitter-dgfip');
  await repondreALaBoite(page, 'Abandonner');
  await page.waitForSelector('#accueil-dgfip:not(.hidden)', { timeout: 20000 });
  v('la base ne porte aucune épreuve gardée', (await dansLaBase()).length, 0);
  vrai(
    'et le bloc de reprise est caché',
    await page.locator('#reprise-dgfip').evaluate((e) => e.classList.contains('hidden')),
  );

  /* ──────────────────────────────────────────────────────────────────────
     5. La banque a changé : la reprise refuse, et n'insiste pas
     ────────────────────────────────────────────────────────────────────── */
  console.log('\nLA BANQUE A CHANGÉ : LA REPRISE REFUSE');

  /* Un brouillon dont une question n'existe plus : c'est ce qu'une banque
     rechargée produit, et on ne la recharge pas ici. */
  await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => {
          const tx = r.result.transaction('epreuveDgfipEnCours', 'readwrite');
          tx.objectStore('epreuveDgfipEnCours').put({
            id: 'courante',
            le: new Date().toISOString(),
            majLe: new Date().toISOString(),
            formatId: 'mixte-12',
            parcoursId: 'inconnu',
            questionIds: ['question-qui-nexiste-pas'],
            ordres: [[0, 1, 2]],
            choix: [[0]],
            position: 0,
          });
          tx.oncomplete = () => ok();
        };
        r.onerror = () => ok();
      }),
  );

  await aller('/quiz/dgfip/', '#reprise-dgfip:not(.hidden)');
  const refus = (await page.locator('#reprise-texte').textContent())?.trim();
  vrai(
    'le bloc dit que l’épreuve ne peut plus être reprise',
    /ne peut plus être reprise/.test(refus ?? ''),
  );
  faux('sans le mot « erreur »', /erreur/i.test(refus ?? ''));
  vrai('et il propose d’en lancer une neuve', /lancer une neuve/.test(refus ?? ''));
  faux('« Reprendre » n’est pas proposé', await page.locator('#reprendre-dgfip').isVisible());
  v('le brouillon refusé est effacé', (await dansLaBase()).length, 0);

  await aller('/quiz/dgfip/', '#lancer-dgfip');
  vrai(
    'la visite suivante ne repose plus la question',
    await page.locator('#reprise-dgfip').evaluate((e) => e.classList.contains('hidden')),
  );

  await contexte.close();
} catch (erreur) {
  rouges += 1;
  console.log(`\n${rouge('✗ PANNE')} — ${String(erreur?.message ?? erreur).slice(0, 600)}`);
} finally {
  await nav?.close();
  nettoyer();
}

console.log(rouges ? `\n${rouge(`${rouges} rouge(s).`)}` : `\n${vert('Tout est vert.')}`);
process.exit(rouges ? 1 : 0);
