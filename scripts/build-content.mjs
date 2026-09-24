#!/usr/bin/env node
/**
 * Étape 1 du déploiement : lit « content/ » (en clair, jamais commité),
 * valide, transforme en HTML, puis écrit UNIQUEMENT du contenu chiffré
 * dans « public/data/ ».
 *
 * Lancé automatiquement par « npm run dev » et « npm run deploy ».
 */
import { readFile, readdir, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import YAML from 'yaml';
import config from '../site.config.mjs';
import { frontMatterSchema, flashcardSchema, quizSchema, glossaireSchema } from './lib/schema.mjs';
import { dechiffrerAvecMotDePasse } from './lib/secret.mjs';
import { construireIndexGlossaire, idTerme } from './lib/glossaire.mjs';
import { decouperSections, rendreHtml, texteBrut, extraireSommaire } from './lib/markdown.mjs';
import { sha256Hex, deriverCle, selAleatoire, chiffrerJson, chiffrerBinaire, idStable, b64 } from './lib/crypto.mjs';
import { audioDisponible, SUFFIXE_SCRIPT } from './podcasts.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossierContenu = path.join(racine, 'content');
const dossierSortie = path.join(racine, 'public', 'data');

const couleur = {
  rouge: (t) => `\x1b[31m${t}\x1b[0m`,
  vert: (t) => `\x1b[32m${t}\x1b[0m`,
  jaune: (t) => `\x1b[33m${t}\x1b[0m`,
  gris: (t) => `\x1b[90m${t}\x1b[0m`,
};

const avertissements = [];
const erreurs = [];

function echouer(message) {
  console.error(`\n${couleur.rouge('✖ ' + message)}\n`);
  process.exit(1);
}

/** Lit le mot de passe depuis .env.local et vérifie son empreinte SHA-256. */
async function lireMotDePasse() {
  const chemin = path.join(racine, '.env.local');
  if (!existsSync(chemin)) {
    echouer(
      'Fichier « .env.local » introuvable.\n' +
        '  Créez-le à la racine du projet avec la ligne :\n' +
        '      SITE_PASSWORD=votre-mot-de-passe\n' +
        '  (voir .env.local.example — ce fichier n\'est jamais commité)',
    );
  }
  const brut = await readFile(chemin, 'utf8');
  const ligne = brut.split(/\r?\n/).find((l) => /^\s*SITE_PASSWORD\s*=/.test(l));
  if (!ligne) echouer('« .env.local » ne contient pas de ligne « SITE_PASSWORD= ».');

  let motDePasse = ligne.replace(/^\s*SITE_PASSWORD\s*=/, '').trim();
  if (
    (motDePasse.startsWith('"') && motDePasse.endsWith('"')) ||
    (motDePasse.startsWith("'") && motDePasse.endsWith("'"))
  ) {
    motDePasse = motDePasse.slice(1, -1);
  }
  if (!motDePasse) echouer('Le mot de passe défini dans « .env.local » est vide.');

  const empreinte = await sha256Hex(motDePasse);
  if (empreinte !== config.motDePasseHash.toLowerCase()) {
    echouer(
      'Le mot de passe de « .env.local » ne correspond pas à l\'empreinte\n' +
        'enregistrée dans « site.config.mjs ».\n' +
        `  attendu : ${config.motDePasseHash}\n` +
        `  obtenu  : ${empreinte}\n\n` +
        '  Si vous venez de changer de mot de passe, mettez à jour\n' +
        '  « motDePasseHash » dans site.config.mjs (npm run hash).',
    );
  }
  return motDePasse;
}

/**
 * Parcourt récursivement content/ et retourne la liste des fiches (.md).
 * Les scripts parlés (« .podcast.md ») et les dossiers techniques (« .audio »)
 * en sont exclus : ce ne sont pas des fiches.
 */
async function listerFiches(dossier, base = dossier) {
  const entrees = await readdir(dossier, { withFileTypes: true });
  const fichiers = [];
  for (const entree of entrees) {
    if (entree.name.startsWith('.')) continue;
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      fichiers.push(...(await listerFiches(complet, base)));
    } else if (entree.isFile() && entree.name.endsWith('.md') && !entree.name.endsWith(SUFFIXE_SCRIPT)) {
      fichiers.push(path.relative(base, complet));
    }
  }
  return fichiers.sort();
}

/** Charge content/glossaire.yml (optionnel). */
async function chargerGlossaire() {
  for (const nom of ['glossaire.yml', 'glossaire.yaml']) {
    const chemin = path.join(dossierContenu, nom);
    if (!existsSync(chemin)) continue;
    const brut = await readFile(chemin, 'utf8');
    let donnees;
    try {
      donnees = YAML.parse(brut) ?? [];
    } catch (e) {
      echouer(`« content/${nom} » est un YAML invalide : ${e.message}`);
    }
    const resultat = glossaireSchema.safeParse(donnees);
    if (!resultat.success) {
      echouer(
        `« content/${nom} » ne respecte pas le format attendu :\n` +
          resultat.error.issues.map((i) => `  - ${i.path.join('.')} : ${i.message}`).join('\n'),
      );
    }
    return resultat.data;
  }
  avertissements.push('Aucun « content/glossaire.yml » : les définitions ne seront pas affichées.');
  return [];
}

/** Parse une section YAML (flashcards / quiz) tolérante aux blocs de code. */
function parserListeYaml(texte, contexte) {
  if (!texte?.trim()) return [];
  // On accepte que la liste soit entourée d'un bloc ```yaml ... ```
  const nettoye = texte.replace(/^\s*```(?:ya?ml)?\s*$/gim, '').trim();
  if (!nettoye) return [];
  let donnees;
  try {
    donnees = YAML.parse(nettoye);
  } catch (e) {
    erreurs.push(`${contexte} : bloc YAML invalide (${e.message.split('\n')[0]})`);
    return [];
  }
  if (donnees === null || donnees === undefined) return [];
  if (!Array.isArray(donnees)) {
    erreurs.push(`${contexte} : le bloc doit être une liste « - ... »`);
    return [];
  }
  return donnees;
}

async function main() {
  const t0 = Date.now();
  console.log(couleur.gris('› Chiffrement du contenu…'));

  const motDePasse = await lireMotDePasse();

  if (!existsSync(dossierContenu)) {
    echouer(
      'Dossier « content/ » introuvable.\n' +
        '  Déposez-y vos fiches, ou copiez le dossier d\'exemple :\n' +
        '      npm run init:contenu',
    );
  }

  const glossaire = await chargerGlossaire();
  const indexGlossaire = construireIndexGlossaire(glossaire, config.glossaire);

  const fichiers = await listerFiches(dossierContenu);
  if (fichiers.length === 0) echouer('Aucune fiche (.md) trouvée dans « content/ ».');

  // --- Lecture et transformation des fiches -------------------------------
  const fiches = [];
  for (const relatif of fichiers) {
    const complet = path.join(dossierContenu, relatif);
    const brut = await readFile(complet, 'utf8');
    const { data, content } = matter(brut);

    const fm = frontMatterSchema.safeParse(data);
    if (!fm.success) {
      erreurs.push(
        `${relatif} : front-matter invalide — ` +
          fm.error.issues.map((i) => `${i.path.join('.') || 'racine'} : ${i.message}`).join(' ; '),
      );
      continue;
    }

    const { sections, inconnues } = decouperSections(content);
    if (inconnues.length) {
      avertissements.push(
        `${relatif} : titres « ## » non reconnus rattachés à la section précédente (${inconnues.join(', ')}).`,
      );
    }
    if (!sections.cours && !sections.fiche) {
      avertissements.push(`${relatif} : ni « ## Cours complet » ni « ## Fiche simplifiée ».`);
    }

    // Identifiant opaque et stable : dérivé du chemin, il ne révèle rien
    // et survit aux rebuilds (la progression enregistrée reste valable).
    const ficheId = await idStable(relatif);

    const dejaVus = new Set();
    const coursHtml = rendreHtml(sections.cours, indexGlossaire, {
      premiereOccurrenceSeulement: config.glossaire.premiereOccurrenceSeulement,
      dejaVus,
    });
    const ficheHtml = rendreHtml(sections.fiche, indexGlossaire, {
      premiereOccurrenceSeulement: config.glossaire.premiereOccurrenceSeulement,
      dejaVus: new Set(),
    });

    const flashcards = [];
    for (const item of parserListeYaml(sections.flashcards, `${relatif} (## Flashcards)`)) {
      const r = flashcardSchema.safeParse(item);
      if (!r.success) {
        erreurs.push(`${relatif} (## Flashcards) : ${r.error.issues.map((i) => i.message).join(' ; ')}`);
        continue;
      }
      flashcards.push({
        // L'identifiant dépend de la question : réordonner les cartes ne perd
        // donc pas l'historique de répétition espacée.
        id: `${ficheId}.c${await idStable(ficheId + '|' + r.data.question, 10)}`,
        ...r.data,
      });
    }

    const quiz = [];
    for (const item of parserListeYaml(sections.quiz, `${relatif} (## Quiz)`)) {
      const r = quizSchema.safeParse(item);
      if (!r.success) {
        erreurs.push(`${relatif} (## Quiz) : ${r.error.issues.map((i) => i.message).join(' ; ')}`);
        continue;
      }
      quiz.push({
        id: `${ficheId}.q${await idStable(ficheId + '|' + r.data.question, 10)}`,
        ...r.data,
      });
    }

    const texteRecherche = [
      fm.data.titre,
      fm.data.tags.join(' '),
      texteBrut(sections.cours),
      texteBrut(sections.fiche),
      flashcards.map((c) => `${c.question} ${c.reponse}`).join(' '),
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    fiches.push({
      id: ficheId,
      chemin: relatif,
      titre: fm.data.titre,
      matiere: fm.data.matiere,
      fascicule: fm.data.fascicule,
      ordre: fm.data.ordre,
      tags: fm.data.tags,
      coursHtml,
      ficheHtml,
      sommaire: extraireSommaire(coursHtml || ficheHtml),
      flashcards,
      quiz,
      texteRecherche,
      motsCours: texteBrut(sections.cours).split(/\s+/).filter(Boolean).length,
      // Fiche audio, si « npm run podcasts » l'a déjà synthétisée.
      podcast: await audioDisponible(ficheId),
    });
  }

  if (erreurs.length) {
    console.error(couleur.rouge(`\n✖ ${erreurs.length} erreur(s) dans le contenu :`));
    for (const e of erreurs) console.error('  - ' + e);
    console.error(couleur.rouge('\nAucun fichier n\'a été écrit. Corrigez puis relancez.\n'));
    process.exit(1);
  }

  // --- Reconstruction de la hiérarchie matière > fascicule > fiche --------
  const parMatiere = new Map();
  for (const f of fiches) {
    if (!parMatiere.has(f.matiere)) parMatiere.set(f.matiere, new Map());
    const fascicules = parMatiere.get(f.matiere);
    if (!fascicules.has(f.fascicule)) fascicules.set(f.fascicule, []);
    fascicules.get(f.fascicule).push(f);
  }

  const matieres = [];
  for (const [nomMatiere, fascicules] of parMatiere) {
    const listeFascicules = [];
    for (const [nomFascicule, liste] of fascicules) {
      liste.sort((a, b) => a.ordre - b.ordre || a.titre.localeCompare(b.titre, 'fr'));
      listeFascicules.push({
        id: await idStable(`${nomMatiere}|${nomFascicule}`, 12),
        nom: nomFascicule,
        fiches: liste.map((f) => ({
          id: f.id,
          titre: f.titre,
          ordre: f.ordre,
          tags: f.tags,
          nbFlashcards: f.flashcards.length,
          nbQuiz: f.quiz.length,
          nbMots: f.motsCours,
          aCours: Boolean(f.coursHtml),
          aFiche: Boolean(f.ficheHtml),
          aPodcast: Boolean(f.podcast),
        })),
      });
    }
    listeFascicules.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    matieres.push({
      id: await idStable(nomMatiere, 12),
      nom: nomMatiere,
      fascicules: listeFascicules,
    });
  }
  matieres.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const manifeste = {
    genereLe: new Date().toISOString(),
    matieres,
    totaux: {
      fiches: fiches.length,
      flashcards: fiches.reduce((n, f) => n + f.flashcards.length, 0),
      quiz: fiches.reduce((n, f) => n + f.quiz.length, 0),
      termesGlossaire: glossaire.length,
      podcasts: fiches.filter((f) => f.podcast).length,
    },
  };

  // --- Chiffrement et écriture -------------------------------------------
  const { iterations, tailleSelOctets, tailleIvOctets, tailleCleBits } = config.crypto;
  const sel = selAleatoire(tailleSelOctets);
  const cle = await deriverCle(motDePasse, sel, iterations, tailleCleBits);

  await rm(dossierSortie, { recursive: true, force: true });
  await mkdir(path.join(dossierSortie, 'fiches'), { recursive: true });

  // Identifiant unique de cette publication. Il sert à versionner les URL du
  // contenu : le sel étant régénéré à chaque build, tout est re-chiffré, et un
  // fichier resservi depuis le cache du navigateur ne serait plus déchiffrable
  // par la nouvelle clé. GitHub Pages ne permettant pas de fixer les en-têtes
  // HTTP, c'est l'URL elle-même qui doit changer.
  const version = await idStable(b64(sel) + manifeste.genereLe, 12);

  // Le fichier « cle.json » ne contient aucun secret : seulement les
  // paramètres publics de dérivation, plus un témoin chiffré qui permet au
  // navigateur de vérifier que la clé dérivée est la bonne.
  await writeFile(
    path.join(dossierSortie, 'cle.json'),
    JSON.stringify(
      {
        v: 1,
        version,
        kdf: 'PBKDF2-SHA256',
        iterations,
        sel: b64(sel),
        chiffrement: 'AES-GCM',
        temoin: await chiffrerJson(cle, { ok: true, genereLe: manifeste.genereLe }, tailleIvOctets),
      },
      null,
      2,
    ),
  );

  // Clé privée de la rubrique Actualités : publiée uniquement sous forme
  // chiffrée, pour que le navigateur puisse déchiffrer les actualités écrites
  // par les routines. Voir scripts/actualites-cles.mjs.
  const cheminClePrivee = path.join(dossierContenu, 'actualites-cle-privee.json');
  const cheminCleChiffree = path.join(racine, 'actualites-data', 'cle-privee-chiffree.json');
  let paireActualites = null;

  if (existsSync(cheminClePrivee)) {
    paireActualites = JSON.parse(await readFile(cheminClePrivee, 'utf8'));
  } else if (existsSync(cheminCleChiffree)) {
    // Copie de travail absente (dépôt fraîchement cloné) : on la reconstitue
    // depuis la copie chiffrée versionnée, que le mot de passe ouvre.
    try {
      paireActualites = await dechiffrerAvecMotDePasse(
        motDePasse,
        JSON.parse(await readFile(cheminCleChiffree, 'utf8')),
      );
      await writeFile(cheminClePrivee, JSON.stringify({ v: 1, ...paireActualites }, null, 2));
      avertissements.push(
        'Clé d\'actualités restaurée depuis « actualites-data/cle-privee-chiffree.json ».',
      );
    } catch (erreur) {
      avertissements.push(`Clé d\'actualités illisible : ${erreur.message}`);
    }
  }

  if (paireActualites) {
    await writeFile(
      path.join(dossierSortie, 'actualites-cle.json'),
      JSON.stringify(
        await chiffrerJson(
          cle,
          { empreinte: paireActualites.empreinte, privee: paireActualites.privee },
          tailleIvOctets,
        ),
      ),
    );
  } else {
    avertissements.push(
      'Aucune clé d\'actualités : la rubrique Actualités restera masquée. ' +
        'Lancez « npm run actualites:cles » pour l\'activer.',
    );
  }

  await writeFile(
    path.join(dossierSortie, 'manifeste.json'),
    JSON.stringify(await chiffrerJson(cle, manifeste, tailleIvOctets)),
  );

  await writeFile(
    path.join(dossierSortie, 'glossaire.json'),
    JSON.stringify(
      await chiffrerJson(
        cle,
        glossaire.map((g) => ({ id: idTerme(g.terme), terme: g.terme, definition: g.definition })),
        tailleIvOctets,
      ),
    ),
  );

  const indexRecherche = fiches.map((f) => ({
    id: f.id,
    titre: f.titre,
    matiere: f.matiere,
    fascicule: f.fascicule,
    tags: f.tags,
    texte: f.texteRecherche.slice(0, 20000),
  }));
  await writeFile(
    path.join(dossierSortie, 'recherche.json'),
    JSON.stringify(await chiffrerJson(cle, indexRecherche, tailleIvOctets)),
  );

  for (const f of fiches) {
    const charge = {
      id: f.id,
      titre: f.titre,
      matiere: f.matiere,
      fascicule: f.fascicule,
      tags: f.tags,
      coursHtml: f.coursHtml,
      ficheHtml: f.ficheHtml,
      sommaire: f.sommaire,
      flashcards: f.flashcards,
      quiz: f.quiz,
      // Le lecteur a besoin de la durée et du poids AVANT de télécharger :
      // c'est ce qui permet d'annoncer « 12 min, 3 Mo » sur le bouton.
      podcast: f.podcast
        ? { secondes: f.podcast.secondes, octets: f.podcast.octets, type: f.podcast.type }
        : null,
    };
    await writeFile(
      path.join(dossierSortie, 'fiches', `${f.id}.json`),
      JSON.stringify(await chiffrerJson(cle, charge, tailleIvOctets)),
    );
  }

  // --- Fiches audio --------------------------------------------------------
  // Même clé que le reste du contenu : le mot de passe ouvre tout, il n'y a
  // pas de second secret à gérer. Le MP3 en clair reste dans « content/ ».
  const avecAudio = fiches.filter((f) => f.podcast);
  if (avecAudio.length) {
    await mkdir(path.join(dossierSortie, 'audio'), { recursive: true });
    for (const f of avecAudio) {
      const chiffre = await chiffrerBinaire(cle, await readFile(f.podcast.chemin), tailleIvOctets);
      await writeFile(path.join(dossierSortie, 'audio', `${f.id}.enc`), chiffre);
    }
  }

  // --- Contrôle final : aucun texte en clair ne doit subsister -------------
  await verifierAucunClair(dossierSortie, fiches);

  const taille = await tailleDossier(dossierSortie);
  console.log(
    couleur.vert('✓') +
      ` ${fiches.length} fiche(s), ${manifeste.totaux.flashcards} flashcard(s), ` +
      `${manifeste.totaux.quiz} question(s) de quiz, ${glossaire.length} terme(s) de glossaire, ` +
      `${manifeste.totaux.podcasts} fiche(s) audio` +
      couleur.gris(` — ${(taille / 1024).toFixed(0)} Ko chiffrés en ${Date.now() - t0} ms`),
  );
  for (const a of avertissements) console.log(couleur.jaune('  ! ' + a));
}

/**
 * Garde-fou : relit les fichiers produits et vérifie qu'aucun titre de fiche
 * n'y apparaît en clair. Protège contre une régression du pipeline.
 */
async function verifierAucunClair(dossier, fiches) {
  const aVerifier = [];
  const audios = [];
  const parcourir = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const c = path.join(d, e.name);
      if (e.isDirectory()) await parcourir(c);
      else if (c.endsWith('.enc')) audios.push(c);
      else aVerifier.push(c);
    }
  };
  await parcourir(dossier);

  const sondes = fiches.flatMap((f) => [f.titre, f.matiere]).filter((s) => s && s.length > 4);

  // Les fiches audio pèsent des centaines de mégaoctets : les passer au crible
  // de toutes les sondes coûterait plus que le reste du build. Chacune n'est
  // confrontée qu'aux siennes — c'est ce qui détecterait un fichier publié
  // par erreur en clair, seul scénario que ce garde-fou vise.
  for (const chemin of audios) {
    const fiche = fiches.find((f) => chemin.endsWith(`${f.id}.enc`));
    if (!fiche) continue;
    const octets = await readFile(chemin);
    for (const sonde of [fiche.titre, fiche.matiere].filter((s) => s && s.length > 4)) {
      if (octets.includes(sonde)) {
        echouer(
          `Fuite détectée : « ${sonde} » apparaît en clair dans ${path.relative(racine, chemin)}.`,
        );
      }
    }
  }

  for (const fichier of aVerifier) {
    const contenu = await readFile(fichier, 'utf8');
    for (const sonde of sondes) {
      if (contenu.includes(sonde)) {
        echouer(
          `Fuite détectée : « ${sonde} » apparaît en clair dans ${path.relative(racine, fichier)}.\n` +
            '  Le build est interrompu pour éviter de publier du contenu lisible.',
        );
      }
    }
  }
}

async function tailleDossier(dossier) {
  let total = 0;
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const c = path.join(dossier, e.name);
    total += e.isDirectory() ? await tailleDossier(c) : (await stat(c)).size;
  }
  return total;
}

main().catch((e) => {
  console.error(couleur.rouge('\n✖ Échec du chiffrement du contenu :'), e);
  process.exit(1);
});
