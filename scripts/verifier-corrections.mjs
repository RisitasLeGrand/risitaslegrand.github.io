/**
 * Contrôle des corrections détaillées de la banque de QCM.
 *
 * Deux régimes, pour une raison exposée dans « scripts/lib/corrections-migrees.mjs » :
 * une correction **malformée** est refusée partout, une correction **absente**
 * seulement dans un périmètre déjà migré. Le build échoue dans les deux cas,
 * jamais sur le simple fait que le rattrapage ne soit pas fini.
 *
 * Le rapport imprimé est celui du livrable de couverture : par matière et par
 * rubrique, combien de questions ont une correction, combien un visuel, et
 * combien un « aucun » justifié.
 *
 * Le prétest est hors périmètre, et ce n'est pas un oubli : il ne corrige rien
 * par construction — « rien n'est compté comme une erreur » —, de sorte qu'y
 * exiger une correction irait contre sa raison d'être.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import YAML from 'yaml';
import { decouperSections } from './lib/markdown.mjs';
import { quizSchema, banqueDgfipSchema } from './lib/schema.mjs';
import { estMatiereMigree, estRubriqueMigree, MATIERES_MIGREES, RUBRIQUES_MIGREES } from './lib/corrections-migrees.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossierContenu = path.join(racine, 'content');
const couleur = {
  rouge: (t) => `\x1b[31m${t}\x1b[0m`,
  vert: (t) => `\x1b[32m${t}\x1b[0m`,
  jaune: (t) => `\x1b[33m${t}\x1b[0m`,
  gras: (t) => `\x1b[1m${t}\x1b[0m`,
  faible: (t) => `\x1b[90m${t}\x1b[0m`,
};

const erreurs = [];

/** Un compteur de couverture par périmètre. */
function compteur() {
  return { total: 0, corrigees: 0, avecVisuel: 0, aucunJustifie: 0, confianceMoyenne: 0 };
}

function compter(stats, question) {
  stats.total += 1;
  const c = question.correction;
  if (!c) return;
  stats.corrigees += 1;
  if (c.visuel.type === 'aucun') stats.aucunJustifie += 1;
  else stats.avecVisuel += 1;
  if (c.confiance === 'moyenne') stats.confianceMoyenne += 1;
}

async function listerFiches(dossier, base = dossier) {
  const entrees = await readdir(dossier, { withFileTypes: true });
  const fichiers = [];
  for (const entree of entrees) {
    if (entree.name.startsWith('.')) continue;
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) fichiers.push(...(await listerFiches(complet, base)));
    else if (entree.isFile() && entree.name.endsWith('.md') && !entree.name.endsWith('.podcast.md')) {
      fichiers.push(path.relative(base, complet));
    }
  }
  return fichiers.sort();
}

function parserListe(texte) {
  if (!texte?.trim()) return [];
  const nettoye = texte.replace(/^\s*```(?:ya?ml)?\s*$/gim, '').trim();
  if (!nettoye) return [];
  const donnees = YAML.parse(nettoye);
  return Array.isArray(donnees) ? donnees : [];
}

/** Les quiz de cours, matière par matière. */
async function verifierCours() {
  const parMatiere = new Map();
  if (!existsSync(dossierContenu)) return parMatiere;

  for (const relatif of await listerFiches(dossierContenu)) {
    const matiere = relatif.split(path.sep)[0];
    if (matiere === 'qcm-dgfip') continue;
    const brut = await readFile(path.join(dossierContenu, relatif), 'utf8');
    const { content } = matter(brut);
    const { sections } = decouperSections(content);

    let liste;
    try {
      liste = parserListe(sections.quiz);
    } catch (e) {
      erreurs.push(`${relatif} (## Quiz) : YAML invalide — ${e.message.split('\n')[0]}`);
      continue;
    }

    const stats = parMatiere.get(matiere) ?? compteur();
    parMatiere.set(matiere, stats);

    for (const item of liste) {
      const r = quizSchema.safeParse(item);
      if (!r.success) {
        // Une correction malformée est refusée quel que soit le périmètre.
        erreurs.push(`${relatif} (## Quiz) : ${r.error.issues.map((i) => i.message).join(' ; ')}`);
        stats.total += 1;
        continue;
      }
      compter(stats, r.data);
      if (!r.data.correction && estMatiereMigree(matiere)) {
        erreurs.push(
          `${relatif} (## Quiz) : « ${r.data.question} » sans bloc « correction » — la matière ${matiere} est déclarée migrée`,
        );
      }
    }
  }
  return parMatiere;
}

/** La banque « QCM - DGFiP », rubrique par rubrique. */
async function verifierDgfip() {
  const parRubrique = new Map();
  const dossier = path.join(dossierContenu, 'qcm-dgfip');
  if (!existsSync(dossier)) return parRubrique;

  for (const nom of (await readdir(dossier)).sort()) {
    if (!/\.ya?ml$/.test(nom)) continue;
    const brut = await readFile(path.join(dossier, nom), 'utf8');
    let donnees;
    try {
      donnees = YAML.parse(brut);
    } catch (e) {
      erreurs.push(`qcm-dgfip/${nom} : YAML invalide — ${e.message.split('\n')[0]}`);
      continue;
    }
    const r = banqueDgfipSchema.safeParse(donnees);
    if (!r.success) {
      erreurs.push(`qcm-dgfip/${nom} : ${r.error.issues.map((i) => i.message).join(' ; ')}`);
      continue;
    }

    const id = path.basename(nom).replace(/\.ya?ml$/, '');
    const stats = compteur();
    parRubrique.set(id, stats);
    for (const question of r.data.questions) {
      compter(stats, question);
      if (!question.correction && estRubriqueMigree(id)) {
        erreurs.push(
          `qcm-dgfip/${nom} : « ${question.question} » sans bloc « correction » — la rubrique ${id} est déclarée migrée`,
        );
      }
    }
  }
  return parRubrique;
}

function tableau(titre, entrees, migrees) {
  if (entrees.size === 0) return;
  console.log(`\n${couleur.gras(titre)}\n`);
  const nom = Math.max(titre.length, ...[...entrees.keys()].map((k) => k.length)) + 2;
  console.log(
    `  ${'périmètre'.padEnd(nom)}${'total'.padStart(7)}${'corrigées'.padStart(11)}` +
      `${'visuel'.padStart(8)}${'aucun'.padStart(7)}${'moyenne'.padStart(9)}  état`,
  );
  const cumul = compteur();
  for (const [clef, s] of [...entrees].sort((a, b) => b[1].total - a[1].total)) {
    cumul.total += s.total;
    cumul.corrigees += s.corrigees;
    cumul.avecVisuel += s.avecVisuel;
    cumul.aucunJustifie += s.aucunJustifie;
    cumul.confianceMoyenne += s.confianceMoyenne;
    const migre = migrees.includes(clef);
    const etat = migre
      ? s.corrigees === s.total
        ? couleur.vert('migré')
        : couleur.rouge('migré, incomplet')
      : couleur.faible('inventaire');
    console.log(
      `  ${clef.padEnd(nom)}${String(s.total).padStart(7)}${String(s.corrigees).padStart(11)}` +
        `${String(s.avecVisuel).padStart(8)}${String(s.aucunJustifie).padStart(7)}` +
        `${String(s.confianceMoyenne).padStart(9)}  ${etat}`,
    );
  }
  console.log(
    `  ${couleur.gras('ensemble'.padEnd(nom))}${String(cumul.total).padStart(7)}` +
      `${String(cumul.corrigees).padStart(11)}${String(cumul.avecVisuel).padStart(8)}` +
      `${String(cumul.aucunJustifie).padStart(7)}${String(cumul.confianceMoyenne).padStart(9)}`,
  );
  return cumul;
}

const cours = await verifierCours();
const dgfip = await verifierDgfip();

const cumulCours = tableau('QUIZ DE COURS, PAR MATIÈRE', cours, MATIERES_MIGREES) ?? compteur();
const cumulDgfip = tableau('QCM - DGFIP, PAR RUBRIQUE', dgfip, RUBRIQUES_MIGREES) ?? compteur();

const total = cumulCours.total + cumulDgfip.total;
const corrigees = cumulCours.corrigees + cumulDgfip.corrigees;
const part = total ? Math.round((corrigees / total) * 1000) / 10 : 0;
console.log(
  `\n${couleur.gras('Couverture')} : ${corrigees} / ${total} question(s) corrigée(s) (${part} %).`,
);
const restant = total - corrigees;
if (restant > 0) {
  console.log(
    couleur.jaune(
      `Reste à rédiger : ${restant} correction(s). Régime d'inventaire sur les périmètres non migrés.`,
    ),
  );
}

if (erreurs.length > 0) {
  console.log(`\n${couleur.rouge(`${erreurs.length} problème(s) :`)}`);
  for (const e of erreurs.slice(0, 40)) console.log(`  ✗ ${e}`);
  if (erreurs.length > 40) console.log(couleur.faible(`  … et ${erreurs.length - 40} autre(s).`));
  console.log('');
  process.exit(1);
}
console.log(couleur.vert('\nAucun problème de correction.\n'));
