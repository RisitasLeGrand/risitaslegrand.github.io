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
 * La clé privée est écrite à deux endroits :
 *   - « content/actualites-cle-privee.json », en clair, dans le dossier jamais
 *     commité — c'est la copie de travail ;
 *   - « actualites-data/cle-privee-chiffree.json », chiffrée avec le mot de
 *     passe du site — commitée. Elle survit donc à un clone, et permet aux
 *     routines trimestrielle et annuelle, à qui l'on confie le mot de passe, de
 *     relire les actualités passées pour en faire la synthèse.
 *
 * Le build republie par ailleurs la clé privée chiffrée avec la clé de la
 * publication, dans « data/actualites-cle.json », pour le navigateur.
 *
 * Régénérer la paire rend illisibles les actualités déjà publiées : le script
 * refuse donc d'écraser une clé existante sans « --forcer ».
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import { genererPaireActualites, idStable } from './lib/crypto.mjs';
import { chiffrerAvecMotDePasse } from './lib/secret.mjs';
import { AIDE_MOT_DE_PASSE, lireMotDePasseEventuel } from './lib/motdepasse.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cheminPrivee = path.join(racine, 'content', 'actualites-cle-privee.json');
const cheminPublique = path.join(racine, 'actualites-data', 'cle-publique.json');
const cheminChiffree = path.join(racine, 'actualites-data', 'cle-privee-chiffree.json');
const forcer = process.argv.includes('--forcer');
const resynchroniser = process.argv.includes('--resynchroniser');

const motDePasse = await lireMotDePasseEventuel();
if (!motDePasse) {
  console.error(`\n✖ ${AIDE_MOT_DE_PASSE}\n`);
  process.exit(1);
}

/** Écrit la copie chiffrée par mot de passe, commitée avec le dépôt. */
async function ecrireCopieChiffree(paire) {
  await writeFile(
    cheminChiffree,
    JSON.stringify(
      await chiffrerAvecMotDePasse(motDePasse, { empreinte: paire.empreinte, privee: paire.privee }, config.crypto),
      null,
      2,
    ),
  );
}

// Le mot de passe a changé : on réécrit la copie chiffrée sans toucher à la paire.
if (resynchroniser) {
  if (!existsSync(cheminPrivee)) {
    console.error('\n✖ Aucune clé privée locale à resynchroniser (content/actualites-cle-privee.json).\n');
    process.exit(1);
  }
  await ecrireCopieChiffree(JSON.parse(await readFile(cheminPrivee, 'utf8')));
  console.log('✓ « actualites-data/cle-privee-chiffree.json » réécrit avec le mot de passe actuel.');
  process.exit(0);
}

if (existsSync(cheminPrivee) && !forcer) {
  const { publique } = JSON.parse(await readFile(cheminPrivee, 'utf8'));
  console.log('› Une paire de clés existe déjà.');
  console.log(`  Empreinte : ${await idStable(JSON.stringify(publique))}`);
  console.log('  Pour en générer une nouvelle : npm run actualites:cles -- --forcer');
  console.log('  (les actualités déjà publiées deviendraient alors illisibles)');
  console.log('  Après un changement de mot de passe : npm run actualites:cles -- --resynchroniser');
  process.exit(0);
}

const { publique, privee } = await genererPaireActualites();
const empreinte = await idStable(JSON.stringify(publique));

await mkdir(path.dirname(cheminPrivee), { recursive: true });
await writeFile(cheminPrivee, JSON.stringify({ v: 1, empreinte, publique, privee }, null, 2));

await mkdir(path.dirname(cheminPublique), { recursive: true });
await writeFile(cheminPublique, JSON.stringify({ v: 1, empreinte, jwk: publique }, null, 2));
await ecrireCopieChiffree({ empreinte, privee });

console.log('✓ Paire de clés créée.');
console.log('  Clé privée   : content/actualites-cle-privee.json            (jamais commitée)');
console.log('  Copie chiffrée: actualites-data/cle-privee-chiffree.json     (commitée, protégée par le mot de passe)');
console.log('  Clé publique : actualites-data/cle-publique.json             (commitée, publique)');
console.log(`  Empreinte    : ${empreinte}`);
console.log('\n  La copie chiffrée permet de retrouver la clé privée après un clone,');
console.log('  et aux routines trimestrielle et annuelle de relire les actualités.');
