/**
 * Le volet des parties, dans la page d'une séance (prompt 46, P5).
 *
 *   npm run essais:seances-parties:navigateur
 *
 * ## Pourquoi cet essai existe, et ce qu'il ajoute
 *
 * `essais:seances-parties` éprouve les RÈGLES — le seuil, le complément, ce
 * qu'une séance ancienne prouve. Elles sont justes, et cela ne dit rien de
 * l'écran : un volet qui ne s'ouvre pas, une case qui ne coche pas la fiche,
 * une sélection qui ne survit pas au rechargement, et P5 ne sert à personne.
 * C'est le trou que le compte rendu signalait, et le voici comblé.
 *
 * Trois choses se constatent ici, et nulle part ailleurs :
 *
 * 1. **Le volet ne se charge qu'à l'ouverture.** Les titres des parties
 *    vivent dans la charge utile chiffrée de la fiche ; déplier d'office
 *    toutes les fiches d'une matière déchiffrerait la matière entière pour
 *    des cases que personne ne cochera. On vérifie donc qu'avant ouverture
 *    il n'y a AUCUNE case, et qu'après il y en a exactement trois.
 * 2. **Cocher une partie coche la fiche.** Sans cela, la séance retiendrait
 *    une partie d'une fiche qu'elle ne dit pas avoir ouverte, et les rappels
 *    des séances suivantes ne la verraient jamais.
 * 3. **La sélection survit au rechargement**, c'est-à-dire qu'elle est
 *    vraiment passée par `Seance.parties` et par la base — et non par une
 *    variable de page.
 *
 * ## Le laboratoire, et ce qu'il ne touche pas
 *
 * Il construit « content/ » à partir de « content-exemple/ » avec un mot de
 * passe FACTICE, sert le résultat sur le port 4322 — et non 4321, pour ne pas
 * se faire prendre pour l'aperçu de la batterie —, puis efface tout derrière
 * lui. Si « content/ », « .env.local », le témoin local ou « public/data/ »
 * existent déjà, il ne s'exécute pas et le dit.
 *
 * Le jour visité est un **lundi**, parce que la rotation par défaut de l'INSP
 * y place « Droit public » : c'est la matière des fiches d'exemple qui portent
 * des parties et des cartes rattachées. Un autre jour donnerait une séance
 * sans fiche, et l'essai mesurerait un écran vide.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { idStable } from './lib/crypto.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-prompt-46-p5-sans-valeur';
const PORT = 4322;
const RACINE_WEB = `http://localhost:${PORT}`;

/** Un lundi : la rotation par défaut de l'INSP y place « Droit public ». */
const LUNDI = '2026-10-19';

/** La fiche d'exemple qui porte trois parties ET des cartes rattachées. */
const AVEC_PARTIES = 'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.md';
const PARTIES_ATTENDUES = [
  'i-larchitecture-de-lordre-juridique-interne',
  'ii-le-contrôle-de-constitutionnalité',
  'iii-larticulation-avec-le-droit-international',
];

let rouges = 0;
const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;

function verifier(quoi: string, vrai: boolean, detail = '') {
  if (vrai) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    rouges += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
  }
}

const gardes = [
  ['content', path.join(racine, 'content')],
  ['.env.local', path.join(racine, '.env.local')],
  ['public/data', path.join(racine, 'public', 'data')],
  ['.temoin-mot-de-passe.local.json', path.join(racine, '.temoin-mot-de-passe.local.json')],
] as const;

const occupes = gardes.filter(([, chemin]) => existsSync(chemin)).map(([nom]) => nom);
if (occupes.length) {
  console.log(
    `\n${rouge('✗ REFUS')} — ${occupes.join(', ')} existe déjà.\n` +
      '  Cet essai construit un site de laboratoire avec un mot de passe factice et\n' +
      '  efface tout derrière lui : il ne travaillera pas par-dessus du contenu réel.',
  );
  process.exit(1);
}

const node = (script: string, env: Record<string, string> = {}) =>
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

let nav: Awaited<ReturnType<typeof chromium.launch>> | null = null;

try {
  console.log('\nLA CONSTRUCTION DU LABORATOIRE');
  node('init-contenu.mjs');
  writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);
  node('podcasts.mjs', { REVINSP_SANS_PODCAST: '1' });

  /*
     Des métadonnées audio avec repères, pour que la fiche porte aussi la
     partie « écoutable » : le suivi des parties vues croise les séances et
     l'écoute, et une fiche sans repère ne permettrait pas de le voir.
  */
  const dossierAudio = path.join(racine, 'content', '.audio');
  mkdirSync(dossierAudio, { recursive: true });
  writeFileSync(
    path.join(dossierAudio, `${await idStable(AVEC_PARTIES)}.opus`),
    Buffer.alloc(2048, 7),
  );
  writeFileSync(
    path.join(dossierAudio, `${await idStable(AVEC_PARTIES)}.json`),
    JSON.stringify({
      empreinte: 'x',
      secondes: 153.8,
      octets: 2048,
      moteur: 'kokoro',
      parties: PARTIES_ATTENDUES.map((id, i) => ({ id, debut: 26.59 + i * 40 })),
    }),
  );

  node('build-content.mjs');
  execFileSync('npx', ['astro', 'build'], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, REVINSP_SANS_PODCAST: '1' },
  });
  rmSync(path.join(racine, '.env.local'), { force: true });

  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: racine,
    detached: true,
    stdio: 'ignore',
  }).unref();
} catch (erreur) {
  console.log(`\n${rouge('✗ PANNE')} — le laboratoire n’a pas pu être construit.`);
  console.log(String((erreur as Error)?.message ?? erreur).slice(0, 700));
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

  nav = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const contexte = await nav.newContext();
  const page = await contexte.newPage();
  const ficheAvec = await idStable(AVEC_PARTIES);

  async function ouvrirLaSeance() {
    await page.goto(`${RACINE_WEB}/planification/seance/?jour=${LUNDI}`, {
      waitUntil: 'networkidle',
    });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MOT_DE_PASSE);
      await page.click('#bouton-verrou');
    }
    await page.waitForSelector('#seance:not(.hidden)', { timeout: 30000 });
    await page.waitForSelector('[data-fiche]', { timeout: 30000 });
    await page.waitForTimeout(600);
  }

  /* ── La prémisse : la séance sert bien les fiches de Droit public ────── */

  console.log('\nLA PRÉMISSE');
  await ouvrirLaSeance();
  const fiches = await page.$$eval('[data-fiche]', (c) =>
    c.map((e) => (e as HTMLInputElement).dataset.fiche ?? ''),
  );
  verifier(
    'un lundi, la séance propose les fiches de Droit public',
    fiches.includes(ficheAvec),
    `${fiches.length} fiche(s) proposées`,
  );

  /* ── 1. Le volet ne se charge qu'à l'ouverture ───────────────────────── */

  console.log('\nLE VOLET NE DÉCHIFFRE QU’À L’OUVERTURE');
  const volet = `details[data-volet-fiche="${ficheAvec}"]`;
  verifier('la fiche à parties porte un volet', (await page.$(volet)) !== null);
  verifier(
    'replié, il ne porte AUCUNE case de partie',
    (await page.$$(`${volet} [data-partie]`)).length === 0,
  );
  verifier(
    'et il annonce ce qu’il contient',
    ((await page.$eval(`${volet} summary`, (e) => e.textContent ?? '').catch(() => '')) || '').includes(
      'certaines parties',
    ),
  );

  await page.click(`${volet} summary`);
  await page.waitForSelector(`${volet} [data-partie]`, { timeout: 20000 });
  const casesParties = await page.$$eval(`${volet} [data-partie]`, (c) =>
    c.map((e) => (e as HTMLInputElement).dataset.partie ?? ''),
  );
  verifier(
    'ouvert, il porte les trois parties de la fiche',
    casesParties.length === 3 && PARTIES_ATTENDUES.every((p) => casesParties.includes(p)),
    casesParties.join(' | '),
  );
  verifier(
    'et il dit que, sans case cochée, la séance porte sur toute la fiche',
    (await page.$eval(volet, (e) => e.textContent ?? '')).includes('toute la fiche'),
  );
  verifier(
    'aucune case n’est cochée d’office — « toute la fiche » est le défaut',
    await page.$$eval(`${volet} [data-partie]`, (c) =>
      c.every((e) => !(e as HTMLInputElement).checked),
    ),
  );

  /* ── 2. Cocher une partie coche la fiche ─────────────────────────────── */

  console.log('\nCOCHER UNE PARTIE COCHE LA FICHE');
  const caseFiche = `[data-fiche="${ficheAvec}"]`;
  verifier(
    'la fiche n’est pas cochée au départ',
    !(await page.$eval(caseFiche, (e) => (e as HTMLInputElement).checked)),
  );
  await page.click(`${volet} [data-partie="${PARTIES_ATTENDUES[1]}"]`);
  await page.waitForTimeout(400);
  /*
     LE POINT QUI COMPTE. Sans cela, la séance retiendrait une partie d'une
     fiche qu'elle ne dit pas avoir ouverte, et les rappels des séances
     suivantes — qui partent de `Seance.fiches` — ne la verraient jamais.
  */
  verifier(
    'cocher une partie coche la fiche du même coup',
    await page.$eval(caseFiche, (e) => (e as HTMLInputElement).checked),
  );

  /* ── 3. La sélection survit au rechargement ──────────────────────────── */

  console.log('\nLA SÉLECTION PASSE VRAIMENT PAR LA BASE');
  /* L'enregistrement est différé : on lui laisse son délai avant de recharger. */
  await page.waitForTimeout(1600);
  await ouvrirLaSeance();
  verifier(
    'après rechargement, la fiche est toujours cochée',
    await page.$eval(caseFiche, (e) => (e as HTMLInputElement).checked),
  );
  await page.click(`${volet} summary`);
  await page.waitForSelector(`${volet} [data-partie]`, { timeout: 20000 });
  const apres = await page.$$eval(`${volet} [data-partie]`, (c) =>
    c.filter((e) => (e as HTMLInputElement).checked).map((e) => (e as HTMLElement).dataset.partie),
  );
  verifier(
    'et la partie cochée l’est restée — elle est passée par « Seance.parties »',
    apres.length === 1 && apres[0] === PARTIES_ATTENDUES[1],
    apres.join(' | '),
  );

  const enBase = await page.evaluate(
    () =>
      new Promise<unknown[]>((resolve) => {
        const demande = indexedDB.open('revinsp');
        demande.onsuccess = () => {
          const base = demande.result;
          if (!base.objectStoreNames.contains('seances')) return resolve([]);
          const tx = base.transaction('seances', 'readonly');
          const tout = tx.objectStore('seances').getAll();
          tout.onsuccess = () => resolve(tout.result as unknown[]);
          tout.onerror = () => resolve([]);
        };
        demande.onerror = () => resolve([]);
      }),
  );
  const seances = enBase as { fiches?: string[]; parties?: { fiche: string; partie: string }[] }[];
  verifier(
    'le champ « parties » est écrit dans la séance, et nomme sa fiche',
    seances.some((s) =>
      (s.parties ?? []).some(
        (p) => p.fiche === ficheAvec && p.partie === PARTIES_ATTENDUES[1],
      ),
    ),
    JSON.stringify(seances.map((s) => s.parties)),
  );
  /*
     Et le champ reste FACULTATIF : une séance qui ne coche aucune partie ne
     doit pas porter un tableau vide, qui se lirait « aucune partie vue » —
     c'est-à-dire le contraire de « la fiche entière ».
  */
  verifier(
    'aucune séance ne porte un tableau de parties VIDE',
    seances.every((s) => s.parties === undefined || s.parties.length > 0),
    JSON.stringify(seances.map((s) => s.parties)),
  );
} finally {
  await nav?.close();
  nettoyer();
}

console.log(
  rouges === 0
    ? `\n${vert('Tout est vert.')}`
    : `\n${rouge(`${rouges} rouge${rouges > 1 ? 's' : ''}.`)}`,
);
process.exit(rouges === 0 ? 0 : 1);
