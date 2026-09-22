#!/usr/bin/env node
/**
 * Affiche l'empreinte SHA-256 d'un mot de passe, à recopier dans
 * « site.config.mjs » (champ motDePasseHash) après un changement.
 *
 *   npm run hash                 -> utilise le mot de passe de .env.local
 *   npm run hash -- "nouveau"    -> utilise le mot de passe donné
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from './lib/crypto.mjs';
import config from '../site.config.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let motDePasse = process.argv.slice(2).join(' ').trim();
let source = 'argument de ligne de commande';

if (!motDePasse) {
  const chemin = path.join(racine, '.env.local');
  if (!existsSync(chemin)) {
    console.error('Aucun mot de passe fourni et « .env.local » est absent.');
    console.error('Usage : npm run hash -- "votre-mot-de-passe"');
    process.exit(1);
  }
  const ligne = (await readFile(chemin, 'utf8')).split(/\r?\n/).find((l) => /^\s*SITE_PASSWORD\s*=/.test(l));
  motDePasse = (ligne ?? '').replace(/^\s*SITE_PASSWORD\s*=/, '').trim().replace(/^["']|["']$/g, '');
  source = '.env.local';
  if (!motDePasse) {
    console.error('« .env.local » ne contient pas de SITE_PASSWORD utilisable.');
    process.exit(1);
  }
}

const empreinte = await sha256Hex(motDePasse);
console.log(`\nMot de passe lu depuis : ${source}`);
console.log(`SHA-256                : ${empreinte}`);
console.log(
  empreinte === config.motDePasseHash.toLowerCase()
    ? '\n✓ Correspond déjà à « motDePasseHash » dans site.config.mjs — rien à faire.\n'
    : '\n! Différent de site.config.mjs. Recopiez l\'empreinte ci-dessus dans\n' +
        '  site.config.mjs (champ motDePasseHash), puis relancez « npm run deploy ».\n',
);
