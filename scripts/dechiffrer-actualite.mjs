#!/usr/bin/env node
/**
 * Relit une actualité chiffrée — l'outil des synthèses trimestrielle et
 * annuelle, à qui l'on confie le mot de passe du site.
 *
 *   node scripts/dechiffrer-actualite.mjs <dossier> <id>
 *   node scripts/dechiffrer-actualite.mjs --lister [dossier]
 *   node scripts/dechiffrer-actualite.mjs --depuis semaines 2026-W30 2026-W39
 *
 * Exemples :
 *   node scripts/dechiffrer-actualite.mjs semaines 2026-W38
 *   node scripts/dechiffrer-actualite.mjs fiches premier-ministre
 *   node scripts/dechiffrer-actualite.mjs --depuis semaines 2026-W27 2026-W39
 *
 * Le mot de passe vient de SITE_PASSWORD ou de « .env.local ». Il ouvre la clé
 * privée conservée chiffrée dans « actualites-data/cle-privee-chiffree.json »,
 * qui déchiffre ensuite les entrées.
 *
 * La sortie est du JSON en clair sur la sortie standard : ne la redirigez
 * jamais vers un fichier du dépôt.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idStable } from './lib/crypto.mjs';
import { dechiffrerAvecMotDePasse, ouvrirEnveloppeActualites } from './lib/secret.mjs';
import { AIDE_MOT_DE_PASSE, lireMotDePasseEventuel } from './lib/motdepasse.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossierActualites = path.join(racine, 'actualites-data');
const DOSSIERS = ['fiches', 'semaines', 'mois', 'trimestres', 'annees'];

function echouer(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const cheminCleChiffree = path.join(dossierActualites, 'cle-privee-chiffree.json');
if (!existsSync(cheminCleChiffree)) {
  echouer(
    'Clé privée chiffrée absente (actualites-data/cle-privee-chiffree.json).\n' +
      '  La rubrique Actualités n\'a pas encore été activée sur ce site.',
  );
}

const motDePasse = await lireMotDePasseEventuel();
if (!motDePasse) echouer(AIDE_MOT_DE_PASSE);

let paire;
try {
  paire = await dechiffrerAvecMotDePasse(motDePasse, JSON.parse(await readFile(cheminCleChiffree, 'utf8')));
} catch (erreur) {
  echouer(erreur.message);
}

/** Lit et déchiffre une entrée. Retourne null si elle n'existe pas. */
async function lire(dossier, id) {
  const chemin = path.join(dossierActualites, dossier, `${await idStable(`${dossier}/${id}`)}.json`);
  if (!existsSync(chemin)) return null;
  return ouvrirEnveloppeActualites(paire.privee, JSON.parse(await readFile(chemin, 'utf8')));
}

// --- Semaines ISO, pour parcourir un intervalle ---------------------------

function lundiDeSemaineIso(annee, semaine) {
  // Le 4 janvier appartient toujours à la semaine 1.
  const quatreJanvier = new Date(Date.UTC(annee, 0, 4));
  const lundiSemaine1 = new Date(quatreJanvier);
  lundiSemaine1.setUTCDate(quatreJanvier.getUTCDate() - ((quatreJanvier.getUTCDay() || 7) - 1));
  const lundi = new Date(lundiSemaine1);
  lundi.setUTCDate(lundiSemaine1.getUTCDate() + (semaine - 1) * 7);
  return lundi;
}

function idSemaine(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const debut = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((d.getTime() - debut.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semaine).padStart(2, '0')}`;
}

/** Tous les identifiants de semaine de « debut » à « fin », inclus. */
function intervalleSemaines(debut, fin) {
  const analyser = (id) => {
    const m = /^(\d{4})-W(\d{1,2})$/.exec(id);
    if (!m) echouer(`Identifiant de semaine invalide : « ${id} » (attendu AAAA-Wnn).`);
    return lundiDeSemaineIso(Number(m[1]), Number(m[2]));
  };
  const curseur = analyser(debut);
  const arret = analyser(fin);
  if (curseur > arret) echouer('La semaine de début est postérieure à celle de fin.');

  const ids = [];
  while (curseur <= arret) {
    ids.push(idSemaine(curseur));
    curseur.setUTCDate(curseur.getUTCDate() + 7);
  }
  return ids;
}

// --- Modes ----------------------------------------------------------------

const [mode, ...reste] = process.argv.slice(2);

if (mode === '--lister') {
  // Les noms de fichiers sont des empreintes : on ne peut que compter.
  const { readdir } = await import('node:fs/promises');
  for (const dossier of reste.length ? reste : DOSSIERS) {
    const chemin = path.join(dossierActualites, dossier);
    const n = existsSync(chemin) ? (await readdir(chemin)).filter((f) => f.endsWith('.json')).length : 0;
    console.log(`${dossier} : ${n} entrée(s)`);
  }
  console.log(
    '\nLes noms de fichiers sont des empreintes : pour lire une entrée, ' +
      'indiquez son identifiant (2026-W38, 2026-T3, 2026, premier-ministre…).',
  );
  process.exit(0);
}

if (mode === '--depuis') {
  const [dossier, debut, fin] = reste;
  if (dossier !== 'semaines' || !debut || !fin) {
    echouer('Usage : node scripts/dechiffrer-actualite.mjs --depuis semaines AAAA-Wnn AAAA-Wnn');
  }
  const entrees = [];
  for (const id of intervalleSemaines(debut, fin)) {
    const entree = await lire('semaines', id);
    if (entree) entrees.push(entree);
  }
  console.log(JSON.stringify(entrees, null, 2));
  console.error(`\n(${entrees.length} entrée(s) trouvée(s) sur l'intervalle ${debut} → ${fin})`);
  process.exit(0);
}

const [dossier, id] = [mode, reste[0]];
if (!dossier || !id) {
  echouer(
    'Usage : node scripts/dechiffrer-actualite.mjs <dossier> <id>\n' +
      `  dossier : ${DOSSIERS.join(', ')}\n` +
      '  id      : 2026-W38, 2026-T3, 2026, premier-ministre…\n\n' +
      '  Voir aussi : --lister, et --depuis semaines AAAA-Wnn AAAA-Wnn',
  );
}
if (!DOSSIERS.includes(dossier)) echouer(`Dossier inconnu « ${dossier} ». Attendu : ${DOSSIERS.join(', ')}.`);

const entree = await lire(dossier, id);
if (!entree) echouer(`Aucune entrée « ${dossier}/${id} » publiée.`);
console.log(JSON.stringify(entree, null, 2));
