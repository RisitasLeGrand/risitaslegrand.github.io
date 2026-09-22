#!/usr/bin/env node
/**
 * Chiffre une actualité pour publication — c'est l'outil qu'utilisent les
 * routines de veille, qui n'ont pas accès au mot de passe du site.
 *
 *   node scripts/chiffrer-actualite.mjs <dossier> <id> <fichier-clair.json>
 *   node scripts/chiffrer-actualite.mjs --modele <dossier>
 *
 * Exemples :
 *   node scripts/chiffrer-actualite.mjs semaines 2026-W40 /tmp/semaine.json
 *   node scripts/chiffrer-actualite.mjs fiches premier-ministre /tmp/pm.json
 *   node scripts/chiffrer-actualite.mjs --modele semaines
 *
 * Le fichier produit est écrit dans « actualites-data/<dossier>/<empreinte>.json ».
 * Le nom du fichier est une empreinte de « <dossier>/<id> » : la liste des
 * fichiers publiés ne révèle donc ni les dates ni les thèmes suivis.
 *
 * Le fichier en clair passé en argument n'est jamais copié dans le dépôt :
 * écrivez-le hors du dossier de travail (/tmp) et ne le commitez pas.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chiffrerPourActualites, idStable, importerPubliqueActualites } from './lib/crypto.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossierActualites = path.join(racine, 'actualites-data');
const DOSSIERS = ['fiches', 'semaines', 'trimestres', 'annees'];

const MODELES = {
  fiches: {
    id: 'premier-ministre',
    titre: 'Premier ministre',
    resume: 'Quelques phrases rédigées dans vos propres mots.',
    sources: [{ nom: "Nom de la source", url: 'https://exemple.gouv.fr/page' }],
    lien_cours: "Phrase expliquant en quoi cette actualité sert la préparation du concours.",
    mots_cles: ['Premier ministre', 'gouvernement', 'article 20'],
    derniere_maj: new Date().toISOString().slice(0, 10),
  },
  semaines: {
    semaine: '2026-W40',
    periode: '28 septembre – 4 octobre 2026',
    items: [
      {
        titre: 'Titre court',
        theme: 'juridique',
        resume: 'Quelques phrases rédigées dans vos propres mots, jamais une copie du texte source.',
        sources: [{ nom: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }],
        image: { url: "https://exemple.org/illustration.jpg", credit: 'Auteur / Agence' },
        lien_cours: "Phrase reliant l'actualité au programme de révision.",
        mots_cles: ['déficit public', 'Pacte de stabilité'],
      },
    ],
  },
};
MODELES.trimestres = { trimestre: '2026-T4', periode: 'octobre – décembre 2026', items: MODELES.semaines.items };
MODELES.annees = { annee: '2026', periode: 'année 2026', items: MODELES.semaines.items };

function echouer(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// --- Mode « modèle » : imprime un gabarit JSON, sans rien écrire -----------
if (process.argv[2] === '--modele') {
  const dossier = process.argv[3];
  if (!DOSSIERS.includes(dossier)) echouer(`Dossier attendu : ${DOSSIERS.join(', ')}.`);
  console.log(JSON.stringify(MODELES[dossier], null, 2));
  process.exit(0);
}

const [dossier, id, fichier] = process.argv.slice(2);
if (!dossier || !id || !fichier) {
  echouer(
    'Usage : node scripts/chiffrer-actualite.mjs <dossier> <id> <fichier-clair.json>\n' +
      `  dossier : ${DOSSIERS.join(', ')}\n` +
      '  id      : 2026-W40, 2026-T4, 2026, premier-ministre…\n' +
      '  Gabarit : node scripts/chiffrer-actualite.mjs --modele semaines',
  );
}
if (!DOSSIERS.includes(dossier)) echouer(`Dossier inconnu « ${dossier} ». Attendu : ${DOSSIERS.join(', ')}.`);
if (!/^[A-Za-z0-9-]+$/.test(id)) echouer(`Identifiant invalide « ${id} » : lettres, chiffres et tirets seulement.`);
if (!existsSync(fichier)) echouer(`Fichier introuvable : ${fichier}`);

const cheminPublique = path.join(dossierActualites, 'cle-publique.json');
if (!existsSync(cheminPublique)) {
  echouer(
    'Clé publique absente (actualites-data/cle-publique.json).\n' +
      "  Elle est créée par « npm run actualites:cles » sur la machine du propriétaire du site.",
  );
}

let charge;
try {
  charge = JSON.parse(await readFile(fichier, 'utf8'));
} catch (e) {
  echouer(`« ${fichier} » n'est pas un JSON valide : ${e.message}`);
}

// --- Contrôles de forme, pour éviter de publier une entrée inexploitable ---
const THEMES = ['juridique', 'economique', 'international'];
if (dossier === 'fiches') {
  if (!charge.titre || !charge.resume) echouer('Une fiche doit comporter au moins « titre » et « resume ».');
  charge.id ??= id;
} else {
  if (!Array.isArray(charge.items) || charge.items.length === 0) {
    echouer('Une entrée datée doit comporter un tableau « items » non vide.');
  }
  for (const [i, item] of charge.items.entries()) {
    if (!item.titre || !item.resume) echouer(`items[${i}] : « titre » et « resume » sont obligatoires.`);
    if (item.theme && !THEMES.includes(item.theme)) {
      echouer(`items[${i}] : thème « ${item.theme} » inconnu. Attendu : ${THEMES.join(', ')}.`);
    }
  }
}

const { jwk } = JSON.parse(await readFile(cheminPublique, 'utf8'));
const clePublique = await importerPubliqueActualites(jwk);
const enveloppe = await chiffrerPourActualites(clePublique, charge);

const nom = await idStable(`${dossier}/${id}`);
const sortie = path.join(dossierActualites, dossier, `${nom}.json`);
await mkdir(path.dirname(sortie), { recursive: true });
await writeFile(sortie, JSON.stringify(enveloppe));

console.log(`✓ ${dossier}/${id} chiffré → actualites-data/${dossier}/${nom}.json`);
console.log('  Commitez ce fichier. Ne commitez jamais la version en clair.');
