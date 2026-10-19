#!/usr/bin/env node
/**
 * La batterie complète : les 234 essais, dans l'ordre, et un verdict.
 *
 *   npm run batterie
 *
 * ## Pourquoi cette commande existe
 *
 * La règle de travail est « batterie complète avant chaque poussée et avant
 * chaque fusion ». Tant que la batterie n'était qu'une boucle shell écrite à
 * la main dans un dossier temporaire, elle n'était ni reproductible ni
 * vérifiable : deux lancements pouvaient ne pas couvrir les mêmes essais, et
 * personne ne pouvait relire ce qui avait tourné.
 *
 * ## Ce qu'elle refuse de faire
 *
 * Elle ne lance rien si les conditions d'un verdict honnête ne sont pas
 * réunies, et elle le dit au lieu de rendre des rouges qui n'en sont pas :
 *
 * - sans `SITE_PASSWORD`, les essais de navigateur ne peuvent pas
 *   déverrouiller le site : tous seraient rouges, pour une raison qui
 *   n'appartient pas au site ;
 * - sans aperçu servant `localhost:4321`, ils n'ont rien à visiter — et un
 *   aperçu d'un AUTRE répertoire de travail répondrait quand même, ce qui
 *   mesurerait un autre site que celui qu'on croit. L'adresse est donc
 *   affichée, et c'est à l'appelant de savoir ce qu'elle sert.
 *
 * Elle ne décide pas non plus si un rouge est acceptable : elle les nomme,
 * et la comparaison au tableau des anomalies reste un geste humain.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const ADRESSE = process.env.RACINE ?? 'http://localhost:4321';
const DELAI_MS = Number(process.env.BATTERIE_DELAI_MS ?? 500_000);

const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {};
/* Tout ce qui commence par « essais » : la liste ne se tient pas à la main. */
const noms = Object.keys(scripts).filter((n) => n.startsWith('essais'));

if (noms.length === 0) {
  console.error('✗ PANNE — aucun essai trouvé dans package.json.');
  process.exit(1);
}

/* ── Les deux refus ────────────────────────────────────────────────────── */

if (!process.env.SITE_PASSWORD) {
  console.error(
    '✗ REFUS — SITE_PASSWORD n’est pas dans l’environnement.\n' +
      '  Les essais de navigateur ne pourraient pas déverrouiller le site, et\n' +
      '  la batterie rendrait des rouges qui n’appartiennent pas au site.\n' +
      '  Donnez-le dans l’environnement de la commande, jamais dans un fichier\n' +
      '  suivi par Git.',
  );
  process.exit(1);
}

const sert = await fetch(`${ADRESSE}/robots.txt`, { signal: AbortSignal.timeout(20_000) })
  .then((r) => r.ok)
  .catch(() => false);
if (!sert) {
  console.error(
    `✗ REFUS — rien ne répond sur ${ADRESSE}.\n` +
      '  Construisez puis lancez l’aperçu avant la batterie :\n' +
      '    REVINSP_SANS_PODCAST=1 npx astro build   (avec .env.local, puis effacé)\n' +
      '    npx astro preview stop && npx astro preview --port 4321\n' +
      '  Un aperçu d’un AUTRE répertoire de travail répondrait aussi : vérifiez\n' +
      '  qu’il sert bien le « dist/ » que vous venez de construire.',
  );
  process.exit(1);
}

/* ── Le passage ────────────────────────────────────────────────────────── */

const journal = mkdtempSync(join(tmpdir(), 'batterie-'));
console.log(`\nBATTERIE COMPLÈTE — ${noms.length} essais, aperçu sur ${ADRESSE}`);
console.log(`Journaux : ${journal}\n`);

const rouges = [];
let verts = 0;
const debut = Date.now();

for (const [index, nom] of noms.entries()) {
  const compteur = `${String(index + 1).padStart(3, ' ')}/${noms.length}`;
  let sortie = '';
  let code = 0;
  const depart = Date.now();
  try {
    sortie = execFileSync('npm', ['run', '--silent', nom], {
      encoding: 'utf8',
      timeout: DELAI_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
  } catch (erreur) {
    code = erreur.status ?? (erreur.signal ? 124 : 1);
    sortie = `${erreur.stdout ?? ''}${erreur.stderr ?? ''}`;
    if (erreur.signal) sortie += `\n[batterie] interrompu après ${DELAI_MS} ms (${erreur.signal})`;
  }
  writeFileSync(join(journal, `${nom.replace(/[:/]/g, '-')}.log`), sortie);

  /*
     Deux juges, et non un seul : le code de sortie, et la présence d'une
     croix. Certains essais rendent 0 en affichant des croix — c'est un défaut
     de ces essais, consigné ailleurs, mais la batterie ne doit pas s'en rendre
     complice en les comptant verts.
  */
  const croix = /✗/.test(sortie);
  const secondes = ((Date.now() - depart) / 1000).toFixed(0);
  if (code === 0 && !croix) {
    verts += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${compteur} ${nom} (${secondes} s)`);
  } else {
    rouges.push(nom);
    console.log(`  \x1b[31m✗\x1b[0m ${compteur} ${nom} (code ${code}, ${secondes} s)`);
    for (const ligne of sortie.split('\n').filter((l) => l.includes('✗')).slice(0, 3)) {
      console.log(`        ${ligne.trim().slice(0, 160)}`);
    }
  }
}

const minutes = ((Date.now() - debut) / 60_000).toFixed(0);
console.log(`\nbatterie complète : ${verts} verts ; ${rouges.length} rouges (${minutes} min)`);
if (rouges.length > 0) {
  console.log(`rouges : ${rouges.join(' ')}`);
  console.log(
    'À comparer au tableau des anomalies avant toute poussée : un rouge qui n’y\n' +
      'figure pas est un rouge NOUVEAU, et il se corrige avant de pousser.',
  );
}
console.log(`Journaux conservés : ${journal}\n`);
/* Le code de sortie ne juge pas : la batterie rapporte, l'humain tranche. */
process.exit(0);
