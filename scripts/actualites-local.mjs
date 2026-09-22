#!/usr/bin/env node
/**
 * Fabrique des actualités de démonstration, chiffrées, pour le développement
 * local :
 *
 *   npm run actualites:local
 *
 * Elles sont écrites dans « public/actualites-data/ » (ignoré par Git) avec la
 * clé publique du site : le chemin exact qu'emprunteront les vraies actualités.
 * Cela permet de voir la rubrique en local — et de vérifier au passage que la
 * chaîne clé publique → chiffrement → déchiffrement dans le navigateur
 * fonctionne.
 *
 * « npm run deploy » écarte systématiquement ce dossier avant de republier :
 * la démonstration locale ne peut jamais atteindre le site en ligne.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chiffrerPourActualites, idStable, importerPubliqueActualites } from './lib/crypto.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cheminPublique = path.join(racine, 'actualites-data', 'cle-publique.json');
const cible = path.join(racine, 'public', 'actualites-data');

if (!existsSync(cheminPublique)) {
  console.error('\n✖ Clé publique absente. Lancez d\'abord : npm run actualites:cles\n');
  process.exit(1);
}

/** Numéro de semaine ISO, identique à celui calculé par le navigateur. */
function idSemaine(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const debut = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((d.getTime() - debut.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semaine).padStart(2, '0')}`;
}

const aujourdhui = new Date();
const annee = aujourdhui.getFullYear();
const trimestre = `${annee}-T${Math.floor(aujourdhui.getMonth() / 3) + 1}`;

const demonstration = [
  ['fiches', 'premier-ministre', {
    id: 'premier-ministre',
    titre: 'Premier ministre',
    resume: "DÉMONSTRATION LOCALE — cette fiche sera remplacée par la routine hebdomadaire. Elle indique qui occupe la fonction, depuis quelle date, et les priorités annoncées.",
    sources: [{ nom: 'Gouvernement.fr', url: 'https://www.gouvernement.fr/composition-du-gouvernement' }],
    lien_cours: "Point d'ancrage de toute question sur l'organisation de l'exécutif et la conduite de la politique de la Nation.",
    mots_cles: ['gouvernance', 'souveraineté'],
    derniere_maj: aujourdhui.toISOString().slice(0, 10),
  }],
  ['fiches', 'chiffres-economie', {
    id: 'chiffres-economie',
    titre: "Chiffres clés de l'économie française",
    resume: "DÉMONSTRATION LOCALE — croissance du PIB, inflation, chômage au sens du BIT, déficit et dette publics en points de PIB.",
    sources: [{ nom: 'INSEE', url: 'https://www.insee.fr/fr/statistiques' }],
    lien_cours: "Données à dater et à sourcer en copie, mobilisables en économie comme en finances publiques.",
    mots_cles: ['produit intérieur brut', 'inflation', 'dette publique', 'déficit public'],
    derniere_maj: aujourdhui.toISOString().slice(0, 10),
  }],
  ['semaines', idSemaine(aujourdhui), {
    semaine: idSemaine(aujourdhui),
    periode: 'semaine en cours',
    items: [
      {
        titre: 'DÉMONSTRATION — actualité juridique',
        theme: 'juridique',
        resume: "Entrée de démonstration produite en local. Elle vérifie le chiffrement, le déchiffrement dans le navigateur et le rattachement automatique aux fiches de cours.",
        sources: [{ nom: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }],
        lien_cours: "Les mots-clés ci-dessous déterminent les fiches proposées.",
        mots_cles: ['citoyenneté européenne', 'primauté du droit de l\'Union'],
      },
      {
        titre: 'DÉMONSTRATION — actualité économique',
        theme: 'economique',
        resume: "Deuxième entrée de démonstration, sur un autre thème, pour vérifier le filtre de la page d'archive.",
        sources: [{ nom: 'Banque de France', url: 'https://www.banque-france.fr/' }],
        lien_cours: 'Rattachement attendu : politique monétaire et conjoncture.',
        mots_cles: ['politique monétaire', 'inflation'],
      },
      {
        titre: 'DÉMONSTRATION — actualité internationale',
        theme: 'international',
        resume: "Troisième entrée de démonstration, pour le troisième thème.",
        sources: [{ nom: 'France Diplomatie', url: 'https://www.diplomatie.gouv.fr/' }],
        lien_cours: 'Rattachement attendu : gouvernance mondiale et multilatéralisme.',
        mots_cles: ['multilatéralisme', 'gouvernance mondiale'],
      },
    ],
  }],
  ['trimestres', trimestre, {
    trimestre,
    periode: 'trimestre en cours',
    items: [
      {
        titre: 'DÉMONSTRATION — synthèse trimestrielle',
        theme: 'juridique',
        resume: "Sélection resserrée des actualités structurantes du trimestre.",
        sources: [{ nom: 'Vie publique', url: 'https://www.vie-publique.fr/' }],
        lien_cours: 'Rattachement attendu : réforme institutionnelle du trimestre.',
        mots_cles: ['subsidiarité', 'hiérarchie des normes'],
      },
    ],
  }],
  ['annees', String(annee), {
    annee: String(annee),
    periode: `année ${annee}`,
    items: [
      {
        titre: 'DÉMONSTRATION — synthèse annuelle',
        theme: 'economique',
        resume: "Évolutions les plus structurantes de l'année, construites à partir des quatre synthèses trimestrielles.",
        sources: [{ nom: 'INSEE', url: 'https://www.insee.fr/' }],
        lien_cours: "Rattachement attendu : tendance de fond de l'année.",
        mots_cles: ['croissance endogène', 'productivité'],
      },
    ],
  }],
];

await rm(cible, { recursive: true, force: true });
await mkdir(cible, { recursive: true });

// La clé publique est publiée en clair à côté des données : c'est elle que les
// routines lisent pour chiffrer.
const { jwk } = JSON.parse(await import('node:fs/promises').then((f) => f.readFile(cheminPublique, 'utf8')));
const clePublique = await importerPubliqueActualites(jwk);
execFileSync('cp', [cheminPublique, path.join(cible, 'cle-publique.json')]);

for (const [dossier, id, charge] of demonstration) {
  const nom = await idStable(`${dossier}/${id}`);
  await mkdir(path.join(cible, dossier), { recursive: true });
  await writeFile(
    path.join(cible, dossier, `${nom}.json`),
    JSON.stringify(await chiffrerPourActualites(clePublique, charge)),
  );
}

console.log(
  `✓ ${demonstration.length} actualité(s) de démonstration chiffrées dans « public/actualites-data/ ».`,
);
console.log('  Développement local uniquement — jamais publiées.');
