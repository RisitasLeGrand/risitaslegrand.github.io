/**
 * Le lecteur de fiche audio, ses parties et sa reprise (prompt 46, P3 ;
 * prompt 55, N°13).
 *
 *   npm run essais:lecteur-parties
 *
 * ## Ce que cet essai constate, et pourquoi en deux temps
 *
 * **1. La règle**, sans navigateur. Quelle partie est en cours à telle
 * seconde, comment s'écrit « 4:12 », ce qu'on fait d'une partie dont l'audio
 * n'a pas de repère : de l'arithmétique et des règles de tri, qu'il serait
 * absurde d'éprouver en montant un navigateur. On lui montre aussi les cas
 * qui doivent rendre une liste VIDE, parce qu'un calcul qui ne trouve jamais
 * rien à ne pas faire ne prouve rien.
 *
 * **2. L'écran.** P3 ne demande pas que le code parle de parties : il demande
 * qu'on les voie sous le lecteur, qu'un bouton « Écouter à partir d'ici »
 * soit là, que l'écran verrouillé ne montre aucun titre de cours, et qu'une
 * écoute interrompue se reprenne. Ces quatre choses ne se lisent pas dans un
 * diff. L'essai construit donc un site, l'ouvre dans un navigateur, et
 * regarde la page de la fiche.
 *
 * ## Le laboratoire, et ce qu'il ne touche pas
 *
 * Il construit « content/ » à partir de « content-exemple/ », avec un mot de
 * passe FACTICE, sert le résultat sur le port 4322 — et non 4321, pour ne pas
 * se faire prendre pour l'aperçu de la batterie —, puis efface tout derrière
 * lui. Si « content/ », « .env.local », le témoin local ou « public/data/ »
 * existent déjà, il ne s'exécute pas et le dit : du contenu réel et un vrai
 * mot de passe ne sont pas un terrain d'essai.
 *
 * La synthèse vocale n'est pas sollicitée — elle demande un modèle de 325 Mo.
 * Les métadonnées audio sont écrites à la main, telles que la synthèse les
 * écrit, et les octets de l'audio sont du remplissage : le lecteur n'a pas
 * besoin de décoder du son pour poser sa liste de parties, ses boutons et ses
 * métadonnées d'écran verrouillé. Ce qui se mesure ici, c'est l'interface ;
 * la justesse des repères eux-mêmes est l'affaire de `essais:reperes-audio`,
 * qui relit l'onde.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { idStable } from './lib/crypto.mjs';
import {
  horodatage,
  partieCourante,
  partiesEcoutables,
  type PartieEcoutable,
} from '../src/lib/podcast-noyau';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-prompt-46-p3-sans-valeur';
const PORT = 4322;
const RACINE_WEB = `http://localhost:${PORT}`;

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

/* ══════════════════════════════════════════════════════════════════════════
   1. LA RÈGLE
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLA RÈGLE — ce qui se calcule sans écran');

verifier('« 4:12 » s’écrit avec deux chiffres de secondes', horodatage(252) === '4:12', horodatage(252));
verifier('une seconde seule est complétée', horodatage(65) === '1:05', horodatage(65));
verifier('le début s’écrit « 0:00 »', horodatage(0) === '0:00', horodatage(0));
verifier('passé l’heure, l’heure apparaît', horodatage(3852) === '1:04:12', horodatage(3852));
/*
   Tronqué et non arrondi : un repère à 251,8 s affiché « 4:12 » enverrait
   deux dixièmes APRÈS le début du titre, et l'on manquerait son premier mot.
*/
verifier('les secondes sont tronquées, jamais arrondies', horodatage(251.8) === '4:11', horodatage(251.8));
verifier('une seconde négative ne produit pas de monstre', horodatage(-5) === '0:00', horodatage(-5));

const TROIS: PartieEcoutable[] = [
  { id: 'a', titre: 'A', debut: 0 },
  { id: 'b', titre: 'B', debut: 100 },
  { id: 'c', titre: 'C', debut: 200 },
];

verifier('avant la première partie, aucun rang', partieCourante([], 10) === -1);
verifier('à la seconde zéro, la première partie', partieCourante(TROIS, 0) === 0);
verifier('au milieu de la deuxième, la deuxième', partieCourante(TROIS, 150) === 1);
verifier('pile au repère, la partie qui commence', partieCourante(TROIS, 200) === 2);
/*
   `currentTime` rend un flottant : sauter au repère 200 peut donner
   199,9999. Sans la tolérance, la liste clignoterait entre deux lignes
   au moment même où l'on vient de sauter.
*/
verifier('un millième avant le repère compte déjà', partieCourante(TROIS, 199.9996) === 2);
verifier('après la dernière, la dernière', partieCourante(TROIS, 9999) === 2);

/** Une fiche réduite à ce que le lecteur lui demande. */
const ficheAvec = (parties: unknown, reperes: unknown) =>
  ({ parties, podcast: reperes ? { parties: reperes } : {} }) as never;

verifier(
  'sans repère audio, aucune partie écoutable — la fiche s’écoute d’un bloc',
  partiesEcoutables(ficheAvec([{ id: 'a', titre: 'A' }], null)).length === 0,
);
verifier(
  'une partie sans repère est écartée, non rendue inerte',
  partiesEcoutables(
    ficheAvec(
      [
        { id: 'a', titre: 'A' },
        { id: 'b', titre: 'B' },
      ],
      [{ id: 'a', debut: 10 }],
    ),
  ).map((p) => p.id).join() === 'a',
);
verifier(
  'un repère sans titre est écarté lui aussi',
  partiesEcoutables(ficheAvec([{ id: 'a', titre: 'A' }], [{ id: 'zz', debut: 10 }])).length === 0,
);
verifier(
  'l’ordre suit l’audio, pas le sommaire',
  partiesEcoutables(
    ficheAvec(
      [
        { id: 'a', titre: 'A' },
        { id: 'b', titre: 'B' },
      ],
      [
        { id: 'b', debut: 10 },
        { id: 'a', debut: 5 },
      ],
    ),
  ).map((p) => p.id).join() === 'a,b',
);

/* ══════════════════════════════════════════════════════════════════════════
   2. L'ÉCRAN
   ══════════════════════════════════════════════════════════════════════════ */

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
      '  efface tout derrière lui : il ne travaillera pas par-dessus du contenu réel.\n' +
      '  Mettez-les de côté, puis relancez.',
  );
  process.exit(1);
}

const AVEC = 'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.md';
const SANS = 'droit-public/fascicule-1/fiche-02-principe-de-legalite.md';
/* Trois repères, tels que la synthèse les écrit — secondes, deux décimales. */
const REPERES = [
  { id: 'i-larchitecture-de-lordre-juridique-interne', debut: 26.59 },
  { id: 'ii-le-contrôle-de-constitutionnalité', debut: 64.95 },
  { id: 'iii-larticulation-avec-le-droit-international', debut: 106.49 },
];
/** Là où l'écoute s'était arrêtée, dans l'ANCIENNE clé de `localStorage`. */
const ANCIENNE_POSITION = 72;

let nav: Awaited<ReturnType<typeof chromium.launch>> | null = null;

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

try {
  console.log('\nLA CONSTRUCTION DU LABORATOIRE');
  node('init-contenu.mjs');
  writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);
  node('podcasts.mjs', { REVINSP_SANS_PODCAST: '1' });

  const dossierAudio = path.join(racine, 'content', '.audio');
  mkdirSync(dossierAudio, { recursive: true });
  const idAvec = await idStable(AVEC);
  const idSans = await idStable(SANS);
  /*
     Les octets sont du remplissage. Le lecteur les déchiffre et en fait un
     Blob ; il n'a pas à les DÉCODER pour poser sa liste, ses boutons et ses
     métadonnées d'écran verrouillé, et c'est cela qu'on mesure ici.
  */
  const poserAudio = (id: string, meta: Record<string, unknown>) => {
    writeFileSync(path.join(dossierAudio, `${id}.opus`), Buffer.alloc(2048, 7));
    writeFileSync(path.join(dossierAudio, `${id}.json`), JSON.stringify(meta));
  };
  poserAudio(idAvec, {
    empreinte: 'x',
    secondes: 153.8,
    octets: 2048,
    moteur: 'kokoro',
    parties: REPERES,
  });
  /* Une fiche audio SANS repères : l'état d'un audio produit avant le 46. */
  poserAudio(idSans, { empreinte: 'y', secondes: 123.8, octets: 2048, moteur: 'kokoro' });

  node('build-content.mjs');
  execFileSync('npx', ['astro', 'build'], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, REVINSP_SANS_PODCAST: '1' },
  });
  rmSync(path.join(racine, '.env.local'), { force: true });

  /*
     DÉTACHÉ, et non `execFileSync` avec un délai : l'aperçu ne rend pas la
     main, et un `execFileSync` qui expire TUE l'enfant — c'est-à-dire le
     serveur qu'on vient de lancer. On le détache, on l'oublie, et on
     l'arrête à la fin par « astro preview stop », jamais par `kill` : le
     démon se croirait encore en vie.
  */
  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: racine,
    detached: true,
    stdio: 'ignore',
  }).unref();
} catch (erreur) {
  console.log(`\n${rouge('✗ PANNE')} — le laboratoire n’a pas pu être construit.`);
  console.log(String((erreur as Error)?.message ?? erreur).slice(0, 600));
  nettoyer();
  process.exit(1);
}

try {
  /* L'aperçu met un instant à répondre ; sans quoi la première visite tombe à vide. */
  for (let essai = 0; essai < 30; essai++) {
    try {
      const reponse = await fetch(`${RACINE_WEB}/data/cle.json`);
      if (reponse.ok) break;
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

  const idAvec = await idStable(AVEC);
  const idSans = await idStable(SANS);

  /*
     L'ANCIENNE position, posée avant tout script de la page : c'est le seul
     moment où l'on peut écrire ce que l'installation du lecteur va lire.
  */
  await page.addInitScript(
    ([id, secondes]: [string, number]) => {
      try {
        localStorage.setItem('revinsp.podcast.position', JSON.stringify({ [id]: secondes }));
      } catch {
        /* l'essai le verra */
      }
    },
    [idAvec, ANCIENNE_POSITION] as [string, number],
  );

  async function ouvrirFiche(id: string) {
    await page.goto(`${RACINE_WEB}/fiche/?id=${encodeURIComponent(id)}`, {
      waitUntil: 'networkidle',
    });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MOT_DE_PASSE);
      await page.click('#bouton-verrou');
    }
    await page.waitForSelector('#fiche:not(.hidden)', { timeout: 30000 });
    await page.waitForTimeout(900);
  }

  /* ── La liste des parties ─────────────────────────────────────────────── */

  console.log('\nÀ L’ÉCRAN — la liste des parties');
  await ouvrirFiche(idAvec);

  const lignes = await page.$$eval('#podcast-parties [data-partie]', (boutons) =>
    boutons.map((b) => ({
      partie: (b as HTMLElement).dataset.partie ?? '',
      texte: (b.textContent ?? '').trim(),
    })),
  );
  verifier('la liste des parties est à l’écran', lignes.length === 3, `${lignes.length} ligne(s)`);
  verifier(
    'chaque partie porte son heure de début',
    lignes[0]?.texte.startsWith('0:26') &&
      lignes[1]?.texte.startsWith('1:04') &&
      lignes[2]?.texte.startsWith('1:46'),
    lignes.map((l) => l.texte.slice(0, 12)).join(' | '),
  );
  verifier(
    'et son titre, dans l’ordre de l’audio',
    lignes.map((l) => l.partie).join() === REPERES.map((r) => r.id).join(),
    lignes.map((l) => l.partie).join(),
  );

  /* ── « Écouter à partir d'ici » ───────────────────────────────────────── */

  console.log('\nÀ L’ÉCRAN — « Écouter à partir d’ici »');
  const boutonsDEcoute = await page.$$eval('#contenu h2[data-ecoute], #contenu h3[data-ecoute]', (titres) =>
    titres.map((t) => t.id),
  );
  verifier(
    'un bouton sur chaque titre qui est une partie atteignable',
    boutonsDEcoute.length === 3 && REPERES.every((r) => boutonsDEcoute.includes(r.id)),
    boutonsDEcoute.join(' | '),
  );
  verifier(
    'et sur aucun autre titre',
    await page.$$eval('#contenu h2, #contenu h3', (titres) =>
      titres.every((t) => !t.dataset.ecoute || Boolean(t.id)),
    ),
  );
  /*
     Le titre propre, et lui seul : les boutons posés dans un titre entrent
     dans son `textContent`, et c'est ce texte-là qui partait dans le contexte
     envoyé à une IA.
  */
  verifier(
    'le titre relevé pour l’assistant ne porte pas le libellé des boutons',
    await page.$$eval('#contenu h2[data-titre], #contenu h3[data-titre]', (titres) =>
      titres.every((t) => !(t.dataset.titre ?? '').includes('Écouter')),
    ),
  );

  /* ── La reprise de l'ancienne clé ─────────────────────────────────────── */

  console.log('\nÀ L’ÉCRAN — la reprise');
  const reprise = await page.evaluate(() => ({
    libelle: document.getElementById('podcast-bouton')?.textContent ?? '',
    ancienneCle: localStorage.getItem('revinsp.podcast.position'),
  }));
  /* 72 s moins les trois secondes de recul = 1:09. */
  verifier(
    'le bouton propose de reprendre, trois secondes avant l’arrêt',
    reprise.libelle.includes('1:09'),
    reprise.libelle,
  );
  verifier(
    'et l’ancienne clé de localStorage a été retirée',
    reprise.ancienneCle === null,
    String(reprise.ancienneCle),
  );

  const enBase = await page.evaluate(
    () =>
      new Promise<unknown[]>((resolve) => {
        const demande = indexedDB.open('revinsp');
        demande.onsuccess = () => {
          const base = demande.result;
          if (!base.objectStoreNames.contains('podcastPositions')) return resolve([]);
          const tx = base.transaction('podcastPositions', 'readonly');
          const tout = tx.objectStore('podcastPositions').getAll();
          tout.onsuccess = () => resolve(tout.result as unknown[]);
          tout.onerror = () => resolve([]);
        };
        demande.onerror = () => resolve([]);
      }),
  );
  verifier(
    'la position est désormais dans le magasin synchronisé',
    (enBase as { fiche: string; secondes: number }[]).some(
      (p) => p.fiche === idAvec && p.secondes === ANCIENNE_POSITION,
    ),
    JSON.stringify(enBase),
  );

  /* ── L'écran verrouillé ───────────────────────────────────────────────── */

  console.log('\nÀ L’ÉCRAN VERROUILLÉ — ce qu’il ne dit pas');
  await page.click('#podcast-bouton');
  await page.waitForTimeout(1500);
  const metadonnees = await page.evaluate(() => {
    const m = navigator.mediaSession?.metadata;
    return m ? { title: m.title, artist: m.artist, album: m.album, illustrations: m.artwork?.length ?? 0 } : null;
  });
  verifier('des métadonnées sont bien posées', metadonnees !== null, JSON.stringify(metadonnees));
  verifier(
    'le titre est neutre, le même pour toutes les fiches',
    metadonnees?.title === 'Cyclades — fiche audio',
    String(metadonnees?.title),
  );
  /*
     LE POINT QUI COMPTE. Le titre de la fiche de laboratoire est « La
     hiérarchie des normes et le contrôle de constitutionnalité », et sa
     matière « Droit public ». Ni l'un ni l'autre ne doit apparaître dans
     AUCUN champ — c'est ce qu'un téléphone posé sur une table montrerait.
  */
  const toutDit = [metadonnees?.title, metadonnees?.artist, metadonnees?.album].join(' ');
  verifier(
    'aucun titre de cours sur l’écran verrouillé',
    !/hiérarchie|normes|constitutionnalité/i.test(toutDit),
    toutDit,
  );
  verifier('aucune matière non plus', !/droit public/i.test(toutDit), toutDit);
  verifier('et aucune illustration', (metadonnees?.illustrations ?? 0) === 0);

  /* ── Une fiche audio sans repères ─────────────────────────────────────── */

  console.log('\nÀ L’ÉCRAN — une fiche audio d’avant le prompt 46');
  await ouvrirFiche(idSans);
  verifier(
    'aucune liste de parties : elle s’écoute d’un bloc',
    await page.evaluate(
      () => document.getElementById('podcast-parties')?.classList.contains('hidden') ?? false,
    ),
  );
  verifier(
    'aucun bouton « Écouter à partir d’ici »',
    (await page.$$('#contenu h2[data-ecoute], #contenu h3[data-ecoute]')).length === 0,
  );
  verifier(
    'mais le lecteur est bien là',
    await page.evaluate(() => {
      const b = document.getElementById('podcast-bouton');
      return b instanceof HTMLElement && !b.classList.contains('hidden');
    }),
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
