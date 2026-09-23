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
const mois = `${annee}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}`;
const jour = (recul) => {
  const d = new Date(aujourdhui);
  d.setDate(d.getDate() - recul);
  return d.toISOString().slice(0, 10);
};

const tendancesDemonstration = [
  {
    titre: 'DÉMONSTRATION — une orientation qui se confirme',
    domaine: 'finance',
    texte:
      "Bloc de démonstration : les bilans mensuels, trimestriels et annuels dégagent ici les " +
      "dynamiques de fond de la période — une orientation de politique publique qui se confirme, " +
      "un sujet qui revient, une évolution progressive — et non une nouvelle liste d'actualités.",
  },
  {
    titre: 'DÉMONSTRATION — un sujet récurrent',
    domaine: 'social',
    texte:
      "Deuxième paragraphe de démonstration, pour vérifier l'affichage de plusieurs tendances " +
      'et la légende par domaine.',
  },
];

const friseDemonstration = [
  { date: jour(24), libelle: 'DÉMONSTRATION — repère juridique', domaine: 'juridique', detail: 'Une ligne de contexte.' },
  { date: jour(17), libelle: 'DÉMONSTRATION — repère économique', domaine: 'economie' },
  { date: jour(10), libelle: 'DÉMONSTRATION — repère social', domaine: 'social' },
  { date: jour(3), libelle: 'DÉMONSTRATION — repère international', domaine: 'international' },
];

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
  ['fiches', 'ministres-finances', {
    id: 'ministres-finances',
    titre: 'Ministres économiques et financiers, Action et Comptes publics, DGFiP',
    resume:
      "DÉMONSTRATION LOCALE — ministre de l'Économie et des Finances, ministre de l'Action et des " +
      'Comptes publics lorsque ce poste existe dans le gouvernement en fonction, et directeur ' +
      'général des Finances publiques.',
    sources: [{ nom: 'Gouvernement.fr', url: 'https://www.gouvernement.fr/composition-du-gouvernement' }],
    lien_cours: "Qui décide quoi à Bercy : utile en finances publiques comme en organisation administrative.",
    mots_cles: ['DGFiP', 'ordonnateur', 'comptable public'],
    derniere_maj: aujourdhui.toISOString().slice(0, 10),
  }],
  // Tableau de bord : cinq indicateurs chiffrés, et le texte de contexte qui
  // les accompagne — il n'est pas remplacé par les chiffres.
  ['fiches', 'chiffres-economie', {
    id: 'chiffres-economie',
    titre: "Chiffres clés de l'économie française",
    indicateurs: {
      pib: { valeur: '2 900 Md€', periode_reference: 'DÉMO — 2025', source: { nom: 'INSEE', url: 'https://www.insee.fr/' } },
      dette: { valeur: '3 300 Md€', periode_reference: 'DÉMO — T2 2026', source: { nom: 'INSEE', url: 'https://www.insee.fr/' } },
      dette_pct_pib: { valeur: '113 %', periode_reference: 'DÉMO — T2 2026', source: { nom: 'INSEE', url: 'https://www.insee.fr/' } },
      deficit: { valeur: '5,4 % du PIB', periode_reference: 'DÉMO — 2025', source: { nom: 'INSEE', url: 'https://www.insee.fr/' } },
      inflation: { valeur: '1,2 % sur un an', periode_reference: 'DÉMO — mois en cours', source: { nom: 'INSEE', url: 'https://www.insee.fr/' } },
    },
    texte_contextuel:
      "DÉMONSTRATION LOCALE — le texte de contexte reste affiché sous les chiffres : il situe les " +
      'indicateurs les uns par rapport aux autres et par rapport à la trajectoire pluriannuelle.',
    sources: [{ nom: 'INSEE', url: 'https://www.insee.fr/fr/statistiques' }],
    lien_cours: "Données à dater et à sourcer en copie, mobilisables en économie comme en finances publiques.",
    mots_cles: ['produit intérieur brut', 'inflation', 'dette publique', 'déficit public'],
    derniere_maj: aujourdhui.toISOString().slice(0, 10),
  }],
  // Historique cumulatif : chaque changement s'ajoute, rien n'est écrasé.
  ['fiches', 'legislation', {
    id: 'legislation',
    titre: 'Changements législatifs majeurs récents',
    historique: [
      {
        titre: 'DÉMONSTRATION — texte le plus récent',
        date: jour(6),
        resume: "Entrée de démonstration : la liste se complète à chaque passage de la veille, du plus récent au plus ancien.",
        sources: [{ nom: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }],
        lien_cours: 'Rattachement attendu : hiérarchie des normes.',
        mots_cles: ['hiérarchie des normes', 'loi de finances'],
      },
      {
        titre: 'DÉMONSTRATION — texte antérieur, conservé',
        date: jour(48),
        resume: "Cette entrée plus ancienne reste en place : c'est la différence avec les autres fiches de suivi, remplacées à chaque mise à jour.",
        sources: [{ nom: 'Vie publique', url: 'https://www.vie-publique.fr/' }],
        mots_cles: ['LOLF', 'autorisation budgétaire'],
      },
      // Au-delà de cinq entrées, la liste se replie derrière « Voir plus » :
      // ces entrées de remplissage servent à voir le dépliant à l'œuvre.
      ...Array.from({ length: 5 }, (_, i) => ({
        titre: `DÉMONSTRATION — entrée d'historique n° ${i + 3}`,
        date: jour(80 + i * 30),
        resume:
          "Entrée de remplissage : elle vérifie que l'historique cumulatif se condense aux cinq plus récentes, le reste étant accessible d'un clic.",
        sources: [{ nom: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }],
        mots_cles: ['hiérarchie des normes'],
      })),
    ],
    derniere_maj: aujourdhui.toISOString().slice(0, 10),
  }],
  ['semaines', idSemaine(aujourdhui), {
    semaine: idSemaine(aujourdhui),
    periode: 'semaine en cours',
    items: [
      {
        titre: 'DÉMONSTRATION — actualité juridique',
        domaine: 'juridique',
        date: jour(2),
        resume: "Entrée de démonstration produite en local. Elle vérifie le chiffrement, le déchiffrement dans le navigateur et le rattachement automatique aux fiches de cours.",
        sources: [{ nom: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }],
        lien_cours: "Les mots-clés ci-dessous déterminent les fiches proposées.",
        mots_cles: ['citoyenneté européenne', 'primauté du droit de l\'Union'],
      },
      {
        titre: 'DÉMONSTRATION — actualité économique',
        domaine: 'economie',
        date: jour(3),
        resume: "Deuxième entrée de démonstration, sur un autre domaine, pour vérifier le filtre de la page d'archive.",
        sources: [{ nom: 'Banque de France', url: 'https://www.banque-france.fr/' }],
        lien_cours: 'Rattachement attendu : politique monétaire et conjoncture.',
        mots_cles: ['politique monétaire', 'inflation'],
      },
      {
        titre: 'DÉMONSTRATION — actualité de finances publiques',
        domaine: 'finance',
        date: jour(4),
        resume: "Troisième entrée de démonstration, sur le domaine des finances publiques.",
        sources: [{ nom: 'Cour des comptes', url: 'https://www.ccomptes.fr/' }],
        lien_cours: 'Rattachement attendu : trajectoire des finances publiques.',
        mots_cles: ['déficit public', 'dette publique'],
      },
      {
        titre: 'DÉMONSTRATION — actualité sociale',
        domaine: 'social',
        date: jour(5),
        resume: "Quatrième entrée de démonstration, sur le domaine social.",
        sources: [{ nom: 'DREES', url: 'https://drees.solidarites-sante.gouv.fr/' }],
        lien_cours: 'Rattachement attendu : protection sociale et assurance maladie.',
        mots_cles: ['protection sociale', 'assurance maladie'],
      },
      {
        titre: 'DÉMONSTRATION — actualité internationale',
        domaine: 'international',
        date: jour(6),
        resume: "Cinquième entrée de démonstration, pour le cinquième domaine.",
        sources: [{ nom: 'France Diplomatie', url: 'https://www.diplomatie.gouv.fr/' }],
        lien_cours: 'Rattachement attendu : gouvernance mondiale et multilatéralisme.',
        mots_cles: ['multilatéralisme', 'gouvernance mondiale'],
      },
    ],
  }],
  ['mois', mois, {
    mois,
    periode: 'mois en cours',
    items: [
      {
        titre: 'DÉMONSTRATION — bilan mensuel',
        domaine: 'finance',
        date: jour(12),
        resume: "Sélection resserrée des actualités du mois, construite à partir des bulletins hebdomadaires.",
        sources: [{ nom: 'Vie publique', url: 'https://www.vie-publique.fr/' }],
        lien_cours: 'Rattachement attendu : trajectoire des finances publiques.',
        mots_cles: ['loi de finances', 'déficit public'],
      },
    ],
    tendances: tendancesDemonstration,
    frise: friseDemonstration,
  }],
  ['trimestres', trimestre, {
    trimestre,
    periode: 'trimestre en cours',
    items: [
      {
        titre: 'DÉMONSTRATION — synthèse trimestrielle',
        domaine: 'juridique',
        date: jour(30),
        resume: "Sélection resserrée des actualités structurantes du trimestre.",
        sources: [{ nom: 'Vie publique', url: 'https://www.vie-publique.fr/' }],
        lien_cours: 'Rattachement attendu : réforme institutionnelle du trimestre.',
        mots_cles: ['subsidiarité', 'hiérarchie des normes'],
      },
    ],
    tendances: tendancesDemonstration,
    frise: friseDemonstration,
  }],
  ['annees', String(annee), {
    annee: String(annee),
    periode: `année ${annee}`,
    items: [
      {
        titre: 'DÉMONSTRATION — synthèse annuelle',
        domaine: 'economie',
        date: jour(90),
        resume: "Évolutions les plus structurantes de l'année, construites à partir des quatre synthèses trimestrielles.",
        sources: [{ nom: 'INSEE', url: 'https://www.insee.fr/' }],
        lien_cours: "Rattachement attendu : tendance de fond de l'année.",
        mots_cles: ['croissance endogène', 'productivité'],
      },
    ],
    tendances: tendancesDemonstration,
    frise: friseDemonstration,
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
