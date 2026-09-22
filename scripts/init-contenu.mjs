#!/usr/bin/env node
/**
 * Crée le dossier « content/ » à partir de « content-exemple/ ».
 * Utile au premier lancement : content/ n'est pas dans Git.
 */
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(racine, 'content-exemple');
const cible = path.join(racine, 'content');

if (existsSync(cible)) {
  console.log('Le dossier « content/ » existe déjà — rien n\'a été modifié.');
  process.exit(0);
}

await mkdir(cible, { recursive: true });
await cp(source, cible, { recursive: true });
console.log('✓ Dossier « content/ » créé à partir des exemples.');
console.log('  Remplacez son contenu par vos propres fiches, puis lancez « npm run dev ».');
