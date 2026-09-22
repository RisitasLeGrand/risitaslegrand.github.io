#!/usr/bin/env node
/**
 * Crée la paire de clés de la rubrique Actualités (une seule fois).
 *
 *   npm run actualites:cles
 *
 * La clé publique est écrite dans « actualites-data/cle-publique.json » : elle
 * est commitée et publiée en clair, c'est son rôle. Elle permet aux routines de
 * veille de chiffrer une actualité sans rien pouvoir relire.
 *
 * La clé privée est écrite dans « content/actualites-cle-privee.json », donc
 * dans le dossier jamais commité. Le build la republie chiffrée avec le mot de
 * passe du site, pour que le navigateur puisse la récupérer après connexion.
 *
 * Régénérer la paire rend illisibles les actualités déjà publiées : le script
 * refuse donc d'écraser une clé existante sans « --forcer ».
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { genererPaireActualites, idStable } from './lib/crypto.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cheminPrivee = path.join(racine, 'content', 'actualites-cle-privee.json');
const cheminPublique = path.join(racine, 'actualites-data', 'cle-publique.json');
const forcer = process.argv.includes('--forcer');

if (existsSync(cheminPrivee) && !forcer) {
  const { publique } = JSON.parse(await readFile(cheminPrivee, 'utf8'));
  console.log('› Une paire de clés existe déjà.');
  console.log(`  Empreinte : ${await idStable(JSON.stringify(publique))}`);
  console.log('  Pour en générer une nouvelle : npm run actualites:cles -- --forcer');
  console.log('  (les actualités déjà publiées deviendraient alors illisibles)');
  process.exit(0);
}

const { publique, privee } = await genererPaireActualites();
const empreinte = await idStable(JSON.stringify(publique));

await mkdir(path.dirname(cheminPrivee), { recursive: true });
await writeFile(cheminPrivee, JSON.stringify({ v: 1, empreinte, publique, privee }, null, 2));

await mkdir(path.dirname(cheminPublique), { recursive: true });
await writeFile(cheminPublique, JSON.stringify({ v: 1, empreinte, jwk: publique }, null, 2));

console.log('✓ Paire de clés créée.');
console.log(`  Clé privée  : content/actualites-cle-privee.json   (jamais commitée)`);
console.log(`  Clé publique: actualites-data/cle-publique.json    (commitée, publique)`);
console.log(`  Empreinte   : ${empreinte}`);
console.log('\n  Pensez à sauvegarder la clé privée en lieu sûr : sans elle, les');
console.log('  actualités chiffrées par les routines resteront illisibles.');
