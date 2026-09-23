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
const DOSSIERS = ['fiches', 'semaines', 'mois', 'trimestres', 'annees'];

/** Les cinq domaines communs aux items et aux frises chronologiques. */
const DOMAINES = ['economie', 'finance', 'social', 'juridique', 'international'];

/** Les bilans qui doivent porter tendances de fond et frise chronologique. */
const BILANS = ['mois', 'trimestres', 'annees'];

const ITEM_MODELE = {
  titre: 'Titre court',
  domaine: 'juridique',
  date: '2026-09-30',
  resume: 'Quelques phrases rédigées dans vos propres mots, jamais une copie du texte source.',
  sources: [{ nom: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }],
  image: { url: 'https://exemple.org/illustration.jpg', credit: 'Auteur / Agence' },
  lien_cours: "Phrase reliant l'actualité au programme de révision.",
  mots_cles: ['déficit public', 'Pacte de stabilité'],
};

const TENDANCES_MODELE = [
  {
    titre: 'Une orientation qui se confirme',
    domaine: 'finance',
    texte:
      "Quelques phrases de lecture d'ensemble : une dynamique structurante de la période, " +
      "pas une nouvelle liste d'actualités.",
  },
];

const FRISE_MODELE = [
  { date: '2026-09-15', libelle: 'Événement marquant', domaine: 'juridique', detail: 'Une ligne de contexte.' },
  { date: '2026-09-28', libelle: 'Autre repère de la période', domaine: 'economie' },
];

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
  // Fiche « tableau de bord » : cinq indicateurs chiffrés, plus le texte de
  // contexte, qui n'est pas remplacé par les chiffres mais les accompagne.
  'chiffres-economie': {
    id: 'chiffres-economie',
    titre: "Chiffres clés de l'économie française",
    indicateurs: {
      pib: {
        valeur: '2 900 Md€',
        periode_reference: '2025',
        source: { nom: 'INSEE', url: 'https://www.insee.fr/' },
      },
      dette: {
        valeur: '3 300 Md€',
        periode_reference: 'T2 2026',
        source: { nom: 'INSEE', url: 'https://www.insee.fr/' },
      },
      dette_pct_pib: {
        valeur: '113 % du PIB',
        periode_reference: 'T2 2026',
        source: { nom: 'INSEE', url: 'https://www.insee.fr/' },
      },
      deficit: {
        valeur: '5,4 % du PIB',
        periode_reference: '2025',
        source: { nom: 'INSEE', url: 'https://www.insee.fr/' },
      },
      inflation: {
        valeur: '1,2 % sur un an',
        periode_reference: 'août 2026',
        source: { nom: 'INSEE', url: 'https://www.insee.fr/' },
      },
    },
    texte_contextuel:
      'Quelques phrases situant ces chiffres les uns par rapport aux autres et par rapport ' +
      'à la trajectoire pluriannuelle des finances publiques.',
    lien_cours: 'Phrase reliant ces chiffres au programme de révision.',
    mots_cles: ['déficit public', 'dette publique', 'inflation'],
    derniere_maj: new Date().toISOString().slice(0, 10),
  },
  // Fiche « historique » : la seule qui se complète au lieu d'être remplacée.
  legislation: {
    id: 'legislation',
    titre: 'Changements législatifs majeurs récents',
    historique: [
      {
        titre: 'Intitulé du texte',
        date: '2026-09-15',
        resume: 'Quelques phrases rédigées dans vos propres mots.',
        sources: [{ nom: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }],
        lien_cours: 'Phrase reliant ce changement au programme de révision.',
        mots_cles: ['loi de finances', 'LOLF'],
      },
    ],
    derniere_maj: new Date().toISOString().slice(0, 10),
  },
  semaines: {
    semaine: '2026-W40',
    periode: '28 septembre – 4 octobre 2026',
    items: [ITEM_MODELE],
  },
};
MODELES.mois = {
  mois: '2026-09',
  periode: 'septembre 2026',
  items: [ITEM_MODELE],
  tendances: TENDANCES_MODELE,
  frise: FRISE_MODELE,
};
MODELES.trimestres = {
  trimestre: '2026-T4',
  periode: 'octobre – décembre 2026',
  items: [ITEM_MODELE],
  tendances: TENDANCES_MODELE,
  frise: FRISE_MODELE,
};
MODELES.annees = {
  annee: '2026',
  periode: 'année 2026',
  items: [ITEM_MODELE],
  tendances: TENDANCES_MODELE,
  frise: FRISE_MODELE,
};

function echouer(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// --- Mode « modèle » : imprime un gabarit JSON, sans rien écrire -----------
if (process.argv[2] === '--modele') {
  const cle = process.argv[3];
  if (!MODELES[cle]) {
    echouer(`Modèle attendu : ${Object.keys(MODELES).join(', ')}.`);
  }
  console.log(JSON.stringify(MODELES[cle], null, 2));
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
const domaineInvalide = (valeur) => valeur && !DOMAINES.includes(valeur);

if (dossier === 'fiches') {
  if (!charge.titre) echouer('Une fiche doit comporter un « titre ».');
  // Trois formes de fiche coexistent : instantané (resume), tableau de bord
  // (indicateurs + texte_contextuel) et historique cumulatif (historique).
  const aDuFond =
    charge.resume ||
    charge.texte_contextuel ||
    (charge.indicateurs && Object.keys(charge.indicateurs).length) ||
    (Array.isArray(charge.historique) && charge.historique.length);
  if (!aDuFond) {
    echouer(
      'Une fiche doit comporter « resume », ou « indicateurs » (tableau de bord), ' +
        'ou « historique » (liste cumulative).',
    );
  }
  if (charge.indicateurs) {
    for (const [cle, indicateur] of Object.entries(charge.indicateurs)) {
      if (!indicateur || !indicateur.valeur) echouer(`indicateurs.${cle} : « valeur » est obligatoire.`);
    }
  }
  if (charge.historique) {
    if (!Array.isArray(charge.historique)) echouer('« historique » doit être un tableau.');
    for (const [i, entree] of charge.historique.entries()) {
      if (!entree.titre || !entree.resume) {
        echouer(`historique[${i}] : « titre » et « resume » sont obligatoires.`);
      }
    }
    // Le seul fichier qui se complète : écraser l'historique existant le
    // viderait de son sens, d'où ce rappel avant écriture.
    console.log(
      `› Rappel : « ${id} » est cumulatif — l'historique publié doit contenir les entrées ` +
        'déjà en ligne, relues au préalable, en plus des nouvelles.',
    );
  }
  charge.id ??= id;
} else {
  if (!Array.isArray(charge.items) || charge.items.length === 0) {
    echouer('Une entrée datée doit comporter un tableau « items » non vide.');
  }
  for (const [i, item] of charge.items.entries()) {
    if (!item.titre || !item.resume) echouer(`items[${i}] : « titre » et « resume » sont obligatoires.`);
    const domaine = item.domaine ?? item.theme;
    if (domaineInvalide(domaine)) {
      echouer(`items[${i}] : domaine « ${domaine} » inconnu. Attendu : ${DOMAINES.join(', ')}.`);
    }
  }
  if (BILANS.includes(dossier)) {
    if (!Array.isArray(charge.tendances) || charge.tendances.length === 0) {
      echouer(
        'Un bilan mensuel, trimestriel ou annuel doit comporter « tendances » : ' +
          "les dynamiques de fond de la période, pas une liste d'actualités.",
      );
    }
    for (const [i, tendance] of charge.tendances.entries()) {
      if (!tendance.texte) echouer(`tendances[${i}] : « texte » est obligatoire.`);
      if (domaineInvalide(tendance.domaine)) {
        echouer(`tendances[${i}] : domaine « ${tendance.domaine} » inconnu.`);
      }
    }
    if (!Array.isArray(charge.frise) || charge.frise.length === 0) {
      echouer('Un bilan doit comporter « frise » : la chronologie de la période, légendée par domaine.');
    }
  }
  for (const [i, point] of (charge.frise ?? []).entries()) {
    if (!point.date || !point.libelle) echouer(`frise[${i}] : « date » et « libelle » sont obligatoires.`);
    if (domaineInvalide(point.domaine)) {
      echouer(`frise[${i}] : domaine « ${point.domaine} » inconnu. Attendu : ${DOMAINES.join(', ')}.`);
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
