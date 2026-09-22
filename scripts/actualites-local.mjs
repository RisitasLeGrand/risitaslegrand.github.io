#!/usr/bin/env node
/**
 * Copie les fichiers d'exemple « actualites-data/ » dans « public/ », pour que
 * la rubrique Actualités s'affiche pendant le développement local.
 *
 * Ce détour est nécessaire parce que les données réelles vivent sur la branche
 * publiée, pas dans le build : en local, rien ne répondrait au « fetch ».
 *
 * « public/actualites-data/ » est ignoré par Git, et « npm run deploy » écarte
 * systématiquement ce dossier du build avant de republier — la copie locale ne
 * peut donc jamais écraser la veille en ligne.
 */
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(racine, 'actualites-data');
const cible = path.join(racine, 'public', 'actualites-data');

await rm(cible, { recursive: true, force: true });
await cp(source, cible, { recursive: true });
console.log('✓ Exemples d\'actualités copiés dans « public/actualites-data/ » (développement local uniquement).');
