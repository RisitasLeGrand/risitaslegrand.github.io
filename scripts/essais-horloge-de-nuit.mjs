/**
 * LA GARDE SUR L'OUTIL DE NUIT.
 *
 *   npm run essais:horloge-de-nuit
 *
 * `scripts/lib/horloge-de-nuit.mjs` sert à classer les essais : il place Node
 * ET le navigateur à 1 h 30 du matin, heure de Paris, pour faire diverger le
 * jour logique de la date du calendrier. Un outil pareil ne peut pas tomber en
 * silence : s'il cesse d'atteindre le navigateur, tout ce qu'il mesure devient
 * vert, et ce vert ne veut plus rien dire. C'est exactement ce qui m'est
 * arrivé — un `.catch(() => {})` sur la pose du script d'initialisation — et
 * j'ai lu plusieurs verts avant de m'en apercevoir.
 *
 * Cet essai mesure donc les deux horloges, des deux côtés, avec et sans le
 * crochet. Il se relance lui-même avec `--import` pour éprouver le crochet
 * posé : c'est le seul moyen de l'éprouver tel qu'il est employé.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
let croix = 0;
const v = (titre, obtenu, attendu) => {
  const bon = obtenu === attendu;
  if (!bon) croix += 1;
  console.log(`  ${bon ? '✓' : '✗'} ${titre}`);
  if (!bon) console.log(`      obtenu  ${obtenu}\n      attendu ${attendu}`);
};
const vrai = (titre, condition) => v(titre, Boolean(condition), true);

/** Les deux horloges, telles que ce processus et une page les voient. */
async function lireLesDeuxHorloges() {
  const nav = await chromium.launch({
    executablePath: cheminDuNavigateur(),
    args: ['--no-sandbox'],
  });
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await page.goto('about:blank');
  const navigateur = await page.evaluate(() => Date.now());
  const node = Date.now();
  await nav.close();
  return { node, navigateur };
}

/** L'heure de Paris, en minutes depuis minuit, pour un instant donné. */
const minutesAParis = (ms) => {
  const p = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  return Number(p.find((x) => x.type === 'hour').value) * 60 +
    Number(p.find((x) => x.type === 'minute').value);
};

/* ── Le cas éprouvé : le crochet posé ───────────────────────────────────── */

if (process.env.REVINSP_SOUS_CROCHET === '1') {
  const { node, navigateur } = await lireLesDeuxHorloges();
  /* On rend les deux instants au processus parent, qui juge. */
  console.log(`__HORLOGES__ ${node} ${navigateur}`);
  process.exit(0);
}

console.log('L’OUTIL DE NUIT PORTE BIEN LES DEUX HORLOGES À 1 H 30');

/* 1. Sans le crochet, les deux horloges sont à l'heure réelle. */
const sans = await lireLesDeuxHorloges();
vrai(
  'sans le crochet, Node et le navigateur sont à la même heure',
  Math.abs(sans.node - sans.navigateur) < 5000,
);
const reelle = minutesAParis(sans.node);

/* 2. Avec le crochet, les deux sont à 1 h 30 — et c'est le point qui compte :
      un crochet qui n'atteindrait que Node rendrait des mesures fausses. */
const fils = spawnSync(
  process.execPath,
  ['--import', resolve(ICI, 'lib/horloge-de-nuit.mjs'), resolve(ICI, 'essais-horloge-de-nuit.mjs')],
  { encoding: 'utf8', env: { ...process.env, REVINSP_SOUS_CROCHET: '1' } },
);
const annonce = /\[horloge\]/.test(fils.stdout ?? '');
vrai('le crochet annonce son décalage', annonce);
const ligne = (fils.stdout ?? '').split('\n').find((l) => l.startsWith('__HORLOGES__'));
vrai('le processus sous crochet a rendu ses deux horloges', Boolean(ligne));
if (!ligne) {
  console.log(fils.stdout, fils.stderr);
} else {
  const [, nodeMs, navMs] = ligne.split(' ').map(Number);
  v('Node est à 1 h 30 à Paris', minutesAParis(nodeMs), 90);
  v('LE NAVIGATEUR AUSSI', minutesAParis(navMs), 90);
  vrai(
    'et les deux restent à la même heure entre elles',
    Math.abs(nodeMs - navMs) < 5000,
  );
  /* La garde ne vaut que si l'heure réelle n'était pas déjà 1 h 30 : sinon
     les égalités ci-dessus seraient vraies sans que le crochet fasse rien. */
  vrai(
    `prémisse : l’heure réelle (${Math.floor(reelle / 60)} h ${String(reelle % 60).padStart(2, '0')}) n’est pas déjà 1 h 30`,
    Math.abs(reelle - 90) > 5,
  );
}

console.log(croix === 0 ? '\nL’outil de nuit atteint bien les deux horloges.' : `\n${croix} croix.`);
process.exit(croix === 0 ? 0 : 1);
