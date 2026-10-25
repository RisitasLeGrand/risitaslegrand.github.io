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
import {
  idsPubliesEnDouble,
  frontMatterSchema,
  flashcardSchema,
  quizSchema,
  glossaireSchema,
} from './lib/schema.mjs';
import { chargerBanqueDgfip } from './lib/banque-dgfip.mjs';
import { indexerFichesParChemin, resoudreRappels } from './lib/rappels.mjs';
import { motDeLEpreuve } from './lib/pretest.mjs';
import { defautsDesParties, titresSansIdentifiant } from './lib/parties.mjs';
import { dechiffrerAvecMotDePasse } from './lib/secret.mjs';
import { construireIndexGlossaire, idTerme } from './lib/glossaire.mjs';
import {
  decouperSections,
  extraireParties,
  extraireSommaire,
  poserLesIdentifiants,
  rendreHtml,
  texteBrut,
} from './lib/markdown.mjs';
import { gzipSync } from 'node:zlib';
import { sha256Hex, deriverCle, selAleatoire, chiffrerJson, chiffrerBinaire, idStable, b64 } from './lib/crypto.mjs';

/** Gzip, niveau maximal : le fichier est écrit une fois et lu souvent. */
const comprimerGzip = async (octets) => gzipSync(octets, { level: 9 });
import { audioDisponible, SUFFIXE_SCRIPT } from './podcasts.mjs';
import { motDePasseDuTexte } from './lib/motdepasse.mjs';
/*
   Le registre des parcours est en TypeScript, et Node 22 le lit tel quel.
   On l'importe donc plutôt que de recopier les racines ici : deux listes
   finiraient par diverger, et le jour où elles divergeraient, des fiches
   changeraient de parcours sans que rien ne le dise.
*/
import {
  PARCOURS,
  parcoursDuChemin,
  racineDuChemin,
} from '../src/lib/parcours/registre.ts';

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
/*
   Les fiches dont un titre de partie n'a pas encore d'identifiant écrit.
   Toléré pendant la transition du prompt 46, et **dit** : un titre sans
   identifiant garde une ancre dérivée de son texte, donc une ancre qui
   changera si le titre est corrigé — ce que tout le prompt existe pour
   éviter.
*/
const partiesSansIdentifiant = [];

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
  /*
     LA RÈGLE DE LECTURE VIENT DU MODULE PARTAGÉ, PAS D'ICI.

     Elle était écrite trois fois — ici, dans `lib/motdepasse.mjs` et dans
     `lib/mot-de-passe-essais.mjs` — et la troisième divergeait. Le build
     chiffrait sans le retour de chariot final là où les essais
     déverrouillaient avec lui.

     Ce qui reste ici est la POLITIQUE, et elle ne change pas : le build
     n'accepte que le fichier, jamais l'environnement, parce qu'une commande
     s'enregistre en clair dans le journal du terminal et que le build est la
     commande qu'on tape à la main.
  */
  const motDePasse = motDePasseDuTexte(await readFile(chemin, 'utf8'));
  if (motDePasse === null) {
    echouer(
      '« .env.local » ne porte pas de mot de passe lisible : il faut une ligne\n' +
        '  « SITE_PASSWORD=… » dont la valeur ne soit pas vide.',
    );
  }

  await verifierContreLeTemoinLocal(motDePasse);
  return motDePasse;
}

/**
 * Le témoin **local** : construire deux fois de suite avec deux mots de passe
 * différents, sans s'en apercevoir.
 *
 * ## Ce qu'il remplace, et pourquoi
 *
 * Cette garde comparait une empreinte SHA-256 sans sel rangée dans
 * `site.config.mjs`. Elle était utile — elle attrape la faute de frappe qui
 * republierait tout le contenu sous un mot de passe qu'on croit connaître —
 * mais `site.config.mjs` part dans le paquet publié, et une empreinte sans
 * sel publiée rend le mot de passe trouvable en quelques secondes.
 *
 * La garde reste, son témoin déménage : un fichier **ignoré par Git et jamais
 * publié**, à côté de `.env.local`, qui vit sur la machine qui construit et
 * nulle part ailleurs. Même raisonnement que `.env.local` lui-même : le
 * secret de construction n'a aucune raison de voyager.
 *
 * ## Et il est salé, et lent
 *
 * PBKDF2, 600 000 itérations, sel tiré au sort. Même s'il fuitait, il ne
 * donnerait pas le mot de passe pour le prix d'un balayage de carte
 * graphique. Un témoin local n'est pas une raison d'être négligent.
 *
 * ## Absent, il ne bloque pas
 *
 * Première construction sur une machine neuve : le fichier n'existe pas. On
 * le crée et on laisse passer — il n'y avait rien à comparer, et refuser
 * empêcherait simplement de construire. Le message le dit, plutôt que de
 * faire comme si la vérification avait eu lieu.
 */
async function verifierContreLeTemoinLocal(motDePasse) {
  const { createHash, pbkdf2Sync, randomBytes } = await import('node:crypto');
  const { existsSync, readFileSync, writeFileSync } = await import('node:fs');
  void createHash;

  const CHEMIN = '.temoin-mot-de-passe.local.json';
  const ITERATIONS = 600000;

  const derive = (sel) =>
    pbkdf2Sync(motDePasse, Buffer.from(sel, 'hex'), ITERATIONS, 32, 'sha256').toString('hex');

  if (!existsSync(CHEMIN)) {
    const sel = randomBytes(16).toString('hex');
    writeFileSync(
      CHEMIN,
      `${JSON.stringify({ sel, iterations: ITERATIONS, verificateur: derive(sel) }, null, 2)}\n`,
    );
    console.log(
      `  Témoin local créé (${CHEMIN}, ignoré par Git). Les constructions\n` +
        '  suivantes refuseront un mot de passe différent de celui-ci.',
    );
    return;
  }

  const temoin = JSON.parse(readFileSync(CHEMIN, 'utf8'));
  if (derive(temoin.sel) !== temoin.verificateur) {
    echouer(
      'Le mot de passe de « .env.local » n’est pas celui des constructions\n' +
        'précédentes sur cette machine.\n\n' +
        '  Construire ainsi republierait TOUT le contenu sous un autre mot de\n' +
        '  passe, et les sauvegardes faites avant ne s’ouvriraient plus avec.\n\n' +
        `  Si le changement est voulu, supprimez « ${CHEMIN} »\n` +
        '  et relancez : le témoin sera recréé sur le nouveau mot de passe.',
    );
  }
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

/*
   À QUEL PARCOURS APPARTIENT UNE FICHE — LA RÉPONSE A CHANGÉ DE FORME.

   Cette fonction vivait ici, rendait UN identifiant de parcours, et dérivait
   du premier segment du chemin. Elle corrigeait un vrai défaut : `racineContenu`
   était déclaré depuis des semaines et aucun code ne le lisait, de sorte que
   deux fiches déposées dans `content/dgfip-a/` paraissaient comme une matière
   de plus du parcours INSP.

   Elle est remontée dans `src/lib/parcours/registre.ts` et rend maintenant une
   LISTE, pour une raison qui n'est pas de commodité : une fiche rangée sous
   `content/commun/` est au programme des trois concours DGFiP, et lui attribuer
   un parcours unique serait écrire un faux dans le manifeste. Le registre est
   aussi le bon endroit : l'application en a besoin autant que ce chargeur, et
   deux copies de la règle auraient fini par différer.

   Ce qui n'a pas changé : la règle du plus long préfixe, et le fait que la
   racine vide de l'INSP soit un repli plutôt qu'un préfixe — tout chemin
   commence par la chaîne vide.

   Ce que ce chargeur ne fait toujours PAS : filtrer. Le manifeste porte
   l'information, la bibliothèque continue d'afficher toutes les matières. Ce
   second pas change ce qui s'affiche tous les jours ; il se fait à part, avec
   ses essais, et non glissé dans le même geste.
*/

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
  const banqueDgfip = await chargerBanqueDgfip(path.join(dossierContenu, 'qcm-dgfip'), {
    echouer,
    avertir: (m) => avertissements.push(m),
  });
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

    // Le tag « méthodologie » n'est pas décoratif : c'est lui qui écarte ces
    // fiches de l'estimation de niveau et des révisions. Une fiche de méthode
    // qui l'oublierait rentrerait silencieusement dans la file du jour, et la
    // méthode d'une épreuve n'a pas à être révisée comme une fiche de fond.
    const titreMethodologique = /^\s*(m[ée]thode|devoir|corrig[ée]|sujet corrig[ée])\b/i.test(
      fm.data.titre,
    );
    if (titreMethodologique && !(fm.data.tags ?? []).includes('méthodologie')) {
      erreurs.push(
        `${relatif} : le titre annonce une fiche de méthode, d'entraînement ou de corrigé, ` +
          'mais le tag « méthodologie » manque — sans lui, la fiche sera révisée comme une ' +
          'fiche de fond et comptera dans l\'estimation de niveau.',
      );
    }

    /*
       Identifiant opaque et stable : dérivé du chemin, il ne révèle rien et
       survit aux reconstructions — la progression enregistrée reste valable.

       Sauf quand la fiche déclare « id_publie ». Ce cas vient de la
       récupération du corpus : le chemin d'origine de certaines fiches n'a
       pas pu être certifié, et les replacer ailleurs leur donnerait un
       identifiant neuf, orphelinant la progression de qui révise et leur
       fiche audio déjà synthétisée. Le champ est documenté dans
       « lib/schema.mjs », avec ce qu'il ne faut pas en faire.
    */
    const ficheId = fm.data.id_publie ?? (await idStable(relatif));

    /*
       LES PARTIES DE LA FICHE (prompt 46, P1).

       Les marqueurs « {#identifiant} » sont retirés du Markdown avant le
       rendu, puis reposés sur les titres du HTML. L'ancienne ancre — celle
       que fabrique `rehype-slug` depuis le texte du titre — reste
       atteignable, posée sur une balise vide juste avant : des liens vers
       elle existent déjà, et un identifiant stable qui casserait les anciens
       liens aurait tout gâché au premier jour.
    */
    const { markdown: coursPropre, parties: partiesDeclarees } = extraireParties(sections.cours);

    const dejaVus = new Set();
    const coursHtml = poserLesIdentifiants(
      rendreHtml(coursPropre, indexGlossaire, {
        premiereOccurrenceSeulement: config.glossaire.premiereOccurrenceSeulement,
        dejaVus,
      }),
      partiesDeclarees,
    );
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

    // --- Prétest ---------------------------------------------------------
    // Section facultative : répondre à quelques questions *avant* d'avoir lu
    // améliore la mémorisation, même — et surtout — quand la tentative échoue.
    // Les fiches écrites avant cette phase n'en ont pas, et n'en affichent donc
    // aucun ; rien n'est dérivé du quiz à leur place, car une question de quiz
    // vue en prétest, corrigée, ne mesure plus rien lorsqu'elle revient au quiz.
    //
    // La section est un **vivier** : le site n'en affiche que quelques questions
    // à la fois, tirées au sort. Un vivier fourni est ce qui permet à un prétest
    // reproposé — après une progression effacée, par exemple — de rester un
    // prétest, et non la répétition d'un exercice déjà corrigé.
    const pretest = [];
    for (const item of parserListeYaml(sections.pretest, `${relatif} (## Prétest)`)) {
      const r = quizSchema.safeParse(item);
      if (!r.success) {
        erreurs.push(`${relatif} (## Prétest) : ${r.error.issues.map((i) => i.message).join(' ; ')}`);
        continue;
      }
      // Un prétest ouvre la lecture d'un sujet ; il ne révise pas le mode
      // d'emploi du concours. Le contrôle vit dans « lib/pretest.mjs », partagé
      // avec « npm run verifier:pretests » pour que les deux disent la même
      // chose — et il refuse ici, sans quoi il resterait facultatif.
      const mot = motDeLEpreuve(r.data.question);
      if (mot) {
        erreurs.push(
          `${relatif} (## Prétest) : « ${r.data.question} » porte sur l'épreuve ` +
            `(« ${mot} ») — les questions sur l'épreuve sont proscrites en prétest.`,
        );
        continue;
      }
      pretest.push({
        id: `${ficheId}.p${await idStable(ficheId + '|' + r.data.question, 10)}`,
        ...r.data,
      });
    }
    if (sections.pretest.trim() && (pretest.length < 3 || pretest.length > 16)) {
      erreurs.push(
        `${relatif} (## Prétest) : ${pretest.length} question(s). Le vivier en demande 3 à 16 — ` +
          'le site n\'en tire que quelques-unes à la fois, mais il lui en faut assez pour que ' +
          'deux passages ne se ressemblent pas.',
      );
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

    /*
       Les parties, telles que le site les servira : on les relit dans le
       HTML rendu plutôt que dans le Markdown, parce que c'est le HTML qui
       porte les identifiants réellement posés. Une liste tirée du Markdown
       aurait pu diverger du document servi, et c'est exactement le genre
       d'écart qu'on ne découvre qu'au moment où un repère audio tombe à côté.
    */
    const sommaire = extraireSommaire(coursHtml || ficheHtml);
    const parties = sommaire.map((s, i) => ({
      ...s,
      /* Déclaré dans le Markdown, ou simplement dérivé du titre : le second
         cas est toléré pendant la transition, et signalé plus bas. */
      declare: Boolean(partiesDeclarees[i]?.id),
    }));

    erreurs.push(
      ...defautsDesParties(relatif, parties, [
        ['## Flashcards', flashcards],
        ['## Quiz', quiz],
        ['## Prétest', pretest],
      ]),
    );
    const sansIdentifiant = titresSansIdentifiant(parties);
    if (sansIdentifiant > 0) {
      partiesSansIdentifiant.push({ chemin: relatif, combien: sansIdentifiant });
    }

    fiches.push({
      id: ficheId,
      chemin: relatif,
      /*
         LA RACINE, PUIS LES PARCOURS — et les deux, parce qu'ils ne disent pas
         la même chose. La racine est un fait du rangement, vérifiable contre le
         disque ; les parcours servis en sont déduits par le registre, et une
         fiche partagée en a trois. Garder un champ `parcours` au singulier
         aurait obligé à en élire un, c'est-à-dire à mentir sur deux.
      */
      racine: racineDuChemin(relatif),
      parcoursServis: parcoursDuChemin(relatif),
      titre: fm.data.titre,
      matiere: fm.data.matiere,
      fascicule: fm.data.fascicule,
      ordre: fm.data.ordre,
      tags: fm.data.tags,
      coursHtml,
      ficheHtml,
      sommaire,
      parties,
      flashcards,
      quiz,
      pretest,
      texteRecherche,
      motsCours: texteBrut(sections.cours).split(/\s+/).filter(Boolean).length,
      // Fiche audio, si « npm run podcasts » l'a déjà synthétisée.
      podcast: await audioDisponible(ficheId),
    });
  }

  /*
   * --- Les « rappel de cours » d'une correction deviennent de vrais liens ---
   *
   * La mécanique vit dans « lib/rappels.mjs », avec ses raisons et ses essais :
   * le contenu désigne une fiche par son chemin, le site a besoin de son
   * identifiant et de son titre, et une référence qui ne désigne rien arrête le
   * build plutôt que de donner un lien mort à qui vient de rater la question.
   */
  /*
     Deux fiches sous le même identifiant déclaré se confondent à l'écran, et
     leur progression se mélange. On refuse AVANT de chiffrer quoi que ce
     soit : un corpus publié avec deux fiches homonymes se répare moins bien
     qu'un build qui s'arrête.
  */
  for (const { id, chemins } of idsPubliesEnDouble(fiches)) {
    erreurs.push(
      `« id_publie: ${id} » est déclaré par ${chemins.length} fiches : ${chemins.join(', ')}.\n` +
        '  Un identifiant ne désigne qu\'une fiche ; deux fiches homonymes se confondraient.',
    );
  }

  const indexFiches = indexerFichesParChemin(fiches);
  for (const f of fiches) {
    for (const q of f.quiz) {
      erreurs.push(...resoudreRappels(q.correction, indexFiches, `${f.chemin} (## Quiz)`));
    }
    for (const q of f.pretest) {
      erreurs.push(...resoudreRappels(q.correction, indexFiches, `${f.chemin} (## Prétest)`));
    }
  }
  for (const q of banqueDgfip.questions) {
    erreurs.push(
      ...resoudreRappels(q.correction, indexFiches, `QCM DGFiP, rubrique « ${q.rubrique} »`),
    );
  }

  if (partiesSansIdentifiant.length) {
    const titres = partiesSansIdentifiant.reduce((somme, f) => somme + f.combien, 0);
    avertissements.push(
      `${titres} titre(s) de partie sans identifiant écrit, dans ` +
        `${partiesSansIdentifiant.length} fiche(s). Leur ancre est dérivée du titre et changera ` +
        's\u2019il est corrigé : « npm run parties:identifiants » les pose une fois pour toutes.',
    );
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
          /*
             Les parcours servis par la fiche, dérivés de son dossier par le
             registre. Le manifeste les PORTE ; rien ne les filtre encore, et
             c'est dit en toutes lettres plus haut. Sans ce champ, la
             bibliothèque ne pourra jamais filtrer, parce qu'elle ne lit que
             le manifeste.

             La racine voyage avec, parce qu'elle seule se vérifie contre le
             disque : un manifeste qui se contredirait sur les parcours servis
             resterait cohérent avec lui-même.
          */
          racine: f.racine,
          partagee: f.parcoursServis.length > 1,
          parcoursServis: f.parcoursServis,
          ordre: f.ordre,
          tags: f.tags,
          nbFlashcards: f.flashcards.length,
          nbQuiz: f.quiz.length,
          nbMots: f.motsCours,
          aCours: Boolean(f.coursHtml),
          aFiche: Boolean(f.ficheHtml),
          aPodcast: Boolean(f.podcast),
          // Annoncé ici pour que la séance sache, sans rien déchiffrer, quelles
          // fiches valent la peine d'être ouvertes pour leur prétest.
          aPretest: f.pretest.length > 0,
          /*
             COMBIEN de parties, et non lesquelles (prompt 46, P5).

             La séance a besoin de savoir s'il y a un choix de parties à
             proposer, sans ouvrir la fiche. Un NOMBRE suffit à cela, là où
             la liste des titres serait du contenu de fiche — et l'interdit 2
             du prompt 46 est net : « une liste de titres de parties est du
             contenu de fiche », et sa place est donc dans la charge utile de
             la fiche. Le manifeste est chiffré comme elle — ce n'est pas une
             question de secret —, mais il est chargé EN ENTIER par presque
             chaque écran : y verser les titres de parties des 262 fiches
             alourdirait toutes les pages pour une liste que seule la séance
             déplie, deux fiches à la fois.
          */
          nbParties: (f.parties ?? []).length,
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
      qcmDgfip: banqueDgfip.questions.length,
    },
    /** Rubriques de la banque « QCM - DGFiP », pour la page d'accueil. */
    rubriquesDgfip: banqueDgfip.rubriques,
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

  /*
     Le registre des molécules, s'il existe (2.8 du prompt bibliothèque).

     Il n'est **pas** dans le dépôt, pas plus que le reste de `content/` : il
     est produit chez la personne par `npm run molecules:registre`, puis
     chiffré ici comme tout le contenu. Les noms n'apparaissent donc jamais en
     clair dans le dépôt public, ce qui est la condition pour que la contrainte
     « la liste doit apparaître dans le menu » n'emporte pas avec elle la
     publication d'une base sans licence.

     Son absence n'est pas une erreur : le menu retombe alors sur le catalogue
     de Cyclades, et le dit. Un build qui échouerait faute de ce fichier
     rendrait le site inconstructible par quelqu'un qui n'a pas voulu
     l'extraction.
  */
  const cheminRegistre = path.join(dossierContenu, 'sante', 'molecules.json');
  if (existsSync(cheminRegistre)) {
    const registre = JSON.parse(await readFile(cheminRegistre, 'utf8'));
    await writeFile(
      path.join(dossierSortie, 'molecules.json'),
      JSON.stringify(await chiffrerJson(cle, registre, tailleIvOctets)),
    );
  }

  /*
     La copie figée de la bibliographie de NooTopics.

     **Compressée puis chiffrée, et dans cet ordre.** Huit mégaoctets de JSON
     deviennent 1,76 Mo ; chiffrer d'abord aurait rendu la compression
     inopérante, puisqu'un texte chiffré est du bruit. C'est le même ordre que
     le format de sauvegarde « .cyclades », pour la même raison.

     Elle part donc en **binaire** (`bibliographie.bin`), comme les fiches
     audio, et non en enveloppe JSON : un fichier de 1,76 Mo encodé en base64
     en pèserait 2,3.

     Son absence n'est pas une erreur, comme pour le registre : le site se
     construit sans, et l'écran le dit.
  */
  const cheminBiblio = path.join(dossierContenu, 'sante', 'bibliographie.json');
  if (existsSync(cheminBiblio)) {
    const octets = await readFile(cheminBiblio);
    const comprime = await comprimerGzip(octets);
    await writeFile(
      path.join(dossierSortie, 'bibliographie.bin'),
      await chiffrerBinaire(cle, comprime, tailleIvOctets),
    );
  }

  // La banque DGFiP est publiée en un seul fichier : 54 questions tirées au
  // hasard dans l'ensemble, il faudrait de toute façon tout télécharger.
  if (banqueDgfip.questions.length) {
    await writeFile(
      path.join(dossierSortie, 'qcm-dgfip.json'),
      JSON.stringify(await chiffrerJson(cle, banqueDgfip, tailleIvOctets)),
    );
  }

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
      parties: f.parties,
      flashcards: f.flashcards,
      quiz: f.quiz,
      pretest: f.pretest,
      // Le lecteur a besoin de la durée et du poids AVANT de télécharger :
      // c'est ce qui permet d'annoncer « 12 min, 3 Mo » sur le bouton.
      podcast: f.podcast
        ? {
            secondes: f.podcast.secondes,
            octets: f.podcast.octets,
            type: f.podcast.type,
            /*
               Les repères de partie voyagent CHIFFRÉS, avec le reste de la
               fiche (prompt 46, P2, et interdit 2) : la seconde où commence
               « II. Le contrôle de constitutionnalité » dit déjà beaucoup du
               plan du cours, et le plan d'un cours est du contenu.

               Le champ est absent quand la synthèse n'a rien mesuré — audio
               produit avant ce prompt. Son absence veut dire « la fiche
               entière », comme partout ailleurs dans le prompt 46.
            */
            ...(f.podcast.parties ? { parties: f.podcast.parties } : {}),
          }
        : null,
    };

    // Cette charge utile est recopiée champ par champ, et une recopie finit
    // toujours par oublier le champ qu'on vient d'ajouter : le prétest a été
    // produit, validé et chiffré sans jamais parvenir au navigateur. Tout champ
    // d'une fiche doit donc être soit transmis, soit écarté explicitement.
    const ECARTES_DU_CLIENT = new Set([
      'chemin', // interne au build
      'ordre', // porté par le manifeste
      'texteRecherche', // porté par l'index de recherche
      'motsCours', // porté par le manifeste
      /*
         Portés par le manifeste, comme « ordre » : la bibliothèque doit
         pouvoir filtrer par parcours AVANT de déchiffrer quoi que ce soit.
         Les mettre dans la charge chiffrée de chaque fiche obligerait à les
         ouvrir toutes pour savoir lesquelles afficher.

         `parcours` au singulier a cédé la place à `parcoursServis`, au pluriel,
         le jour où une fiche a pu appartenir à trois parcours à la fois — voir
         `racinesPartagees` au registre. `racine` l'accompagne parce qu'elle est
         la seule des deux qui se vérifie contre le disque.

         `partagee` n'est pas un champ de fiche : il est calculé au moment
         d'écrire le manifeste, depuis la longueur de `parcoursServis`. Deux
         sources pour le même fait auraient fini par se contredire.
      */
      'racine',
      'parcoursServis',
    ]);
    const oublies = Object.keys(f).filter((c) => !(c in charge) && !ECARTES_DU_CLIENT.has(c));
    if (oublies.length) {
      echouer(
        `Champ(s) de fiche jamais transmis au navigateur : ${oublies.join(', ')}.\n` +
          '  Ajoutez-les à « charge » dans scripts/build-content.mjs, ou inscrivez-les\n' +
          '  dans ECARTES_DU_CLIENT si c\'est délibéré.',
      );
    }

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
  await verifierAucunClair(dossierSortie, fiches, banqueDgfip.questions);

  const taille = await tailleDossier(dossierSortie);
  console.log(
    couleur.vert('✓') +
      ` ${fiches.length} fiche(s), ${manifeste.totaux.flashcards} flashcard(s), ` +
      `${manifeste.totaux.quiz} question(s) de quiz, ${glossaire.length} terme(s) de glossaire, ` +
      `${manifeste.totaux.podcasts} fiche(s) audio` +
      (banqueDgfip.questions.length
        ? `, ${banqueDgfip.questions.length} question(s) QCM DGFiP`
        : '') +
      couleur.gris(` — ${(taille / 1024).toFixed(0)} Ko chiffrés en ${Date.now() - t0} ms`),
  );
  for (const a of avertissements) console.log(couleur.jaune('  ! ' + a));
}

/**
 * Garde-fou : relit les fichiers produits et vérifie qu'aucun titre de fiche
 * n'y apparaît en clair. Protège contre une régression du pipeline.
 */
async function verifierAucunClair(dossier, fiches, questionsDgfip = []) {
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

  const sondes = [
    ...fiches.flatMap((f) => [f.titre, f.matiere]),
    // Quelques énoncés de la banque DGFiP : le fichier est chiffré comme le
    // reste, encore faut-il que le garde-fou puisse le constater.
    ...questionsDgfip.slice(0, 40).map((q) => q.question),
  ].filter((s) => s && s.length > 4);

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
