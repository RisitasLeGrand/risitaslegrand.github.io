/**
 * L'ALLER-RETOUR : le corpus chiffré, récupéré, puis comparé à l'original.
 *
 *   npm run essais:recuperation-corpus
 *
 * ## Ce que cet essai démontre
 *
 * `scripts/recuperer-corpus.mts` existe pour un seul usage : reconstruire un
 * corpus dont il ne reste **qu'un exemplaire au monde**, chiffré, dans une
 * publication. Un outil pareil ne se livre pas sur la foi de sa lecture. Il se
 * livre quand on l'a vu rendre un corpus qu'on connaissait déjà.
 *
 * L'essai fait donc le tour complet, avec un mot de passe **jetable** et le
 * corpus d'exemple :
 *
 *   1. il construit `content-exemple/` comme le vrai build le ferait ;
 *   2. il récupère la publication avec l'outil ;
 *   3. il compare le récupéré à l'original, champ par champ ;
 *   4. il **reconstruit** depuis le récupéré et compare les deux publications.
 *
 * L'étape 4 est celle qui tranche. Les étapes précédentes disent si les
 * fichiers se ressemblent ; celle-là dit si le **site servirait les mêmes
 * pages**. C'est la seule question qui compte pour qui révise : un corpus
 * récupéré dont le site ne bouge pas d'un caractère est un corpus récupéré.
 *
 * ## Le mot de passe de cet essai
 *
 * Il est écrit en clair, juste en dessous, et c'est voulu : il ne vaut rien,
 * il n'ouvre rien, et il ne sert qu'à chiffrer un corpus d'exemple qui est
 * déjà dans le dépôt. Le vrai mot de passe du site n'entre jamais ici.
 *
 * ## Le laboratoire, et ce qu'il ne touche pas
 *
 * Même garde que les autres essais de laboratoire : si `content/`,
 * `.env.local`, le témoin local ou `public/data/` existent déjà, l'essai ne
 * s'exécute pas et le dit. Du contenu réel et un vrai mot de passe ne sont pas
 * un terrain d'essai. Tout est effacé en sortant, y compris en cas d'échec.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import YAML from 'yaml';

import { deriverCle, idStable } from './lib/crypto.mjs';
import { empreinteRapide } from './lib/chemin-de-fiche.mjs';
import { blocYaml, questionEnSource } from './lib/fiche-en-source.mjs';
import { quizSchema } from './lib/schema.mjs';
import { b64VersOctets } from './lib/secret.mjs';
import { decouperSections } from './lib/markdown.mjs';
import { formatAudio } from './lib/voix.mjs';
import config from '../site.config.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* Jetable, sans valeur, et sans rapport avec le mot de passe du site. */
const MOT_DE_PASSE = 'aller-retour-corpus-sans-valeur';

let rouges = 0;
const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;
const jaune = (t: string) => `\x1b[33m${t}\x1b[0m`;

function verifier(quoi: string, vrai: boolean, detail = '') {
  if (vrai) {
    console.log(`${vert('✓')} ${quoi}${detail ? ` ${jaune(detail)}` : ''}`);
    return;
  }
  console.log(`${rouge('✗')} ${quoi}${detail ? `\n    ${detail}` : ''}`);
  rouges += 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   0. LES INVARIANTS QUI NE DOIVENT JAMAIS ÊTRE SAUTÉS
   ══════════════════════════════════════════════════════════════════════════ */

/*
   Ces vérifications passent AVANT la garde du laboratoire, et c'est délibéré.

   La garde fait sortir l'essai sans rien mesurer quand « content/ » existe —
   ce qui est juste pour tout ce qui construit, et faux pour ce qui ne
   construit rien. Les deux défauts les plus graves de cet outil se voient
   ici, sans laboratoire : ils n'ont aucune raison d'être sautés parce qu'un
   autre essai tourne à côté.
*/
console.log('\n0. LES INVARIANTS PURS');

/*
   L'EMPREINTE RAPIDE DOIT ÊTRE L'EMPREINTE DU DÉPÔT.

   La recherche de chemin éprouve des millions de candidats et ne peut pas
   attendre une promesse par candidat : elle emploie `node:crypto` au lieu de
   `crypto.subtle`. Si les deux divergeaient d'un bit, la recherche
   chercherait la mauvaise empreinte et ne trouverait plus RIEN — en silence,
   sans erreur, en rendant simplement « chemin non certifié » pour les 427
   fiches. Cette ligne est ce qui interdit à l'optimisation de dériver.
*/
for (const texte of [
  'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.md',
  'questions-européennes/fascicule-3/fiche-12-é-à-ü-œ.md',
  '',
]) {
  verifier(
    `« empreinteRapide » = « idStable » pour ${JSON.stringify(texte.slice(0, 40))}`,
    empreinteRapide(texte) === (await idStable(texte)),
  );
}

/*
   UNE CORRECTION IMBRIQUÉE DOIT SURVIVRE À L'ÉCRITURE EN SOURCE.

   C'est le défaut qui a fait refuser le corpus réel en bloc : le YAML écrit à
   la main rendait `par_option` — une liste d'objets — par la chaîne
   « [object Object] », et le build répondait « expected array, received
   string » sur des centaines de fiches. Les trois fiches de
   « content-exemple » n'ont AUCUNE correction : l'aller-retour ne pouvait pas
   le voir, et un corpus d'exemple est un échantillon, pas une garantie.

   On éprouve donc la structure complète ici, contre le schéma du dépôt
   lui-même, sans dépendre de ce que l'exemple contient.
*/
const CORRECTION_COMPLETE = {
  resume: 'Un résumé qui tient en une phrase.',
  par_option: [
    { verdict: 'juste', pourquoi: 'parce que oui' },
    { verdict: 'faux', pourquoi: "parce que non, avec une apostrophe" },
  ],
  detail: 'Un détail plus long, sur plusieurs idées.',
  rappel_de_cours: ['droit-public/fascicule-1/fiche-01-hierarchie-des-normes'],
  sources: [{ nom: 'Une source', url: 'https://example.org/a' }],
  confiance: 'haute',
  visuel: { type: 'aucun', raison_aucun: 'aucun dessin n’aiderait ici' },
};

const questionEcrite = blocYaml([
  questionEnSource({
    question: 'Une question à deux options ?',
    options: ['oui', 'non'],
    bonnes: [0],
    explication: 'Une explication.',
    correction: CORRECTION_COMPLETE,
  }),
]);
verifier(
  'aucun « [object Object] » dans le YAML écrit',
  !questionEcrite.includes('[object Object]'),
  questionEcrite.includes('[object Object]') ? questionEcrite.slice(0, 200) : undefined,
);

const relu = YAML.parse(questionEcrite) as unknown[];
const valide = quizSchema.safeParse(relu[0]);
verifier(
  'le schéma du dépôt accepte la question réécrite',
  valide.success,
  valide.success ? undefined : JSON.stringify(valide.error.issues.slice(0, 3)),
);
if (valide.success) {
  verifier(
    'et « correction » revient structure pour structure',
    JSON.stringify(valide.data.correction) === JSON.stringify(CORRECTION_COMPLETE),
    JSON.stringify(valide.data.correction)?.slice(0, 200),
  );
}

/*
   UN RENVOI « rappel de cours » EST UN CHEMIN DANS LA SOURCE, UN OBJET DANS
   LA PUBLICATION — et le schéma le dit, ce qui justifie de le défaire.
*/
const avecObjet = quizSchema.safeParse({
  question: 'Une question ?',
  options: ['a', 'b'],
  reponse: 0,
  correction: { ...CORRECTION_COMPLETE, rappel_de_cours: [{ id: 'abc', titre: 'Un titre' }] },
});
verifier(
  'le schéma REFUSE un renvoi déjà résolu — défaire la résolution est obligatoire',
  !avecObjet.success,
);

/* ── Le laboratoire ──────────────────────────────────────────────────────── */

const APORTEE = [
  path.join(racine, 'content'),
  path.join(racine, '.env.local'),
  path.join(racine, '.temoin-mot-de-passe.local.json'),
  path.join(racine, 'public', 'data'),
  path.join(racine, 'public', 'data-origine'),
];
const dejaLa = APORTEE.filter((c) => existsSync(c));
if (dejaLa.length) {
  console.log(
    jaune('! essai non exécuté : ') +
      dejaLa.map((c) => path.relative(racine, c)).join(', ') +
      ' existe déjà.\n' +
      '  Cet essai construit avec un mot de passe factice et efface tout derrière lui ;\n' +
      '  il ne touchera ni à des fiches réelles ni à un vrai mot de passe.',
  );
  process.exit(0);
}

/* Le corpus récupéré sort DEHORS : l'outil refuse d'écrire dans le dépôt, et
   c'est une de ses garanties — l'essai la vérifie plus bas, en la provoquant. */
const dehors = mkdtempSync(path.join(tmpdir(), 'recup-corpus-'));
const nettoyer = () => {
  for (const chemin of APORTEE) rmSync(chemin, { recursive: true, force: true });
  rmSync(dehors, { recursive: true, force: true });
};
process.once('exit', nettoyer);

const node = (script: string, env: Record<string, string> = {}) =>
  execFileSync(process.execPath, [path.join(racine, 'scripts', script)], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

/** L'outil de récupération, lancé comme Alexis le lancera. */
function recuperer(args: string[], motDePasse: string | null = MOT_DE_PASSE) {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (motDePasse !== null) env.MDP_ESSAI = motDePasse;
  try {
    const sortie = execFileSync(
      'npx',
      ['tsx', path.join(racine, 'scripts', 'recuperer-corpus.mts'), ...args],
      { cwd: racine, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { code: 0, sortie: String(sortie) };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/* ── Déchiffrer une publication ──────────────────────────────────────────── */

const decodeur = new TextDecoder();

async function ouvrirPublication(dossierData: string) {
  const entete = JSON.parse(readFileSync(path.join(dossierData, 'cle.json'), 'utf8'));
  const cle = await deriverCle(
    MOT_DE_PASSE,
    b64VersOctets(entete.sel),
    entete.iterations,
    config.crypto.tailleCleBits,
  );
  const ouvrir = async (nom: string) => {
    const blob = JSON.parse(readFileSync(path.join(dossierData, nom), 'utf8'));
    const clair = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64VersOctets(blob.iv) },
      cle,
      b64VersOctets(blob.ct),
    );
    return JSON.parse(decodeur.decode(clair));
  };
  const fiches = new Map<string, Record<string, unknown>>();
  for (const nom of readdirSync(path.join(dossierData, 'fiches'))) {
    fiches.set(nom.replace(/\.json$/, ''), await ouvrir(`fiches/${nom}`));
  }
  return { fiches, ouvrir };
}

/* ══════════════════════════════════════════════════════════════════════════
   1. LA PUBLICATION D'ORIGINE
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. LA PUBLICATION D’ORIGINE');
node('init-contenu.mjs');
writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);

/*
   Un audio de laboratoire, pour que l'aller-retour couvre aussi le binaire.
   La synthèse vocale n'est pas sollicitée — elle demande un modèle de 325 Mo.
   Ces octets suffisent : le build ne fait que les chiffrer, et l'essai vérifie
   qu'ils reviennent identiques.
*/
const FICHE_AUDIO = 'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.md';
const idAudio = await idStable(FICHE_AUDIO);
const octetsAudio = Buffer.from(
  Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) % 256),
);
const dossierAudioOrigine = path.join(racine, 'content', '.audio');
execFileSync('mkdir', ['-p', dossierAudioOrigine]);
const extension = formatAudio(config.podcast).extension;
writeFileSync(path.join(dossierAudioOrigine, `${idAudio}.${extension}`), octetsAudio);
writeFileSync(
  path.join(dossierAudioOrigine, `${idAudio}.json`),
  JSON.stringify({ empreinte: 'laboratoire', secondes: 153.8, octets: octetsAudio.length }),
);

const fichesOrigine = new Map<string, { brut: string; donnees: Record<string, unknown> }>();
for (const relatif of listerFiches(path.join(racine, 'content'))) {
  const brut = readFileSync(path.join(racine, 'content', relatif), 'utf8');
  fichesOrigine.set(relatif, { brut, donnees: matter(brut) as unknown as Record<string, unknown> });
}

const journal = node('build-content.mjs');
verifier('la publication d’origine est construite', /fiche\(s\)/.test(journal));
const origine = await ouvrirPublication(path.join(racine, 'public', 'data'));
verifier(
  `elle porte ${fichesOrigine.size} fiche(s) chiffrée(s)`,
  origine.fiches.size === fichesOrigine.size,
  `${origine.fiches.size} publiée(s) pour ${fichesOrigine.size} source(s)`,
);

/** Les fiches d'un dossier `content/`, chemins relatifs, comme le build les lit. */
function listerFiches(dossier: string, prefixe = ''): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith('.')) continue;
    const relatif = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    if (entree.isDirectory()) sortie.push(...listerFiches(path.join(dossier, entree.name), relatif));
    else if (entree.name.endsWith('.md') && !entree.name.endsWith('.podcast.md'))
      sortie.push(relatif);
  }
  return sortie.sort();
}

/* ══════════════════════════════════════════════════════════════════════════
   2. LES REFUS : ce que l'outil doit empêcher avant tout le reste
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n2. LES REFUS');

const dansLeDepot = recuperer([
  '--depuis',
  path.join(racine, 'public', 'data'),
  '--vers',
  path.join(racine, 'content-recupere'),
  '--mot-de-passe-env',
  'MDP_ESSAI',
]);
verifier(
  'une sortie DANS le dépôt est refusée',
  dansLeDepot.code !== 0 && /est dans le dépôt/.test(dansLeDepot.sortie),
  dansLeDepot.sortie.trim().split('\n')[0],
);
verifier(
  'et rien n’a été écrit à cet endroit',
  !existsSync(path.join(racine, 'content-recupere')),
);

const mauvaisMotDePasse = recuperer(
  [
    '--depuis',
    path.join(racine, 'public', 'data'),
    '--vers',
    path.join(dehors, 'refus'),
    '--mot-de-passe-env',
    'MDP_ESSAI',
  ],
  'ce-n-est-pas-le-bon',
);
verifier(
  'un mot de passe faux est refusé sur le témoin',
  mauvaisMotDePasse.code !== 0 && /témoin/.test(mauvaisMotDePasse.sortie),
  mauvaisMotDePasse.sortie.trim().split('\n').filter(Boolean).pop(),
);
verifier(
  'et rien n’a été écrit avant le refus',
  !existsSync(path.join(dehors, 'refus', 'content')),
);

/*
   LE MOT DE PASSE N'EST JAMAIS DIT.

   Ni sur la sortie, ni dans un fichier produit. C'est l'interdit central de
   l'outil, et il se vérifie en cherchant la chaîne elle-même — un essai qui
   lirait le code au lieu de fouiller le résultat ne prouverait rien.
*/
verifier(
  'aucune sortie de l’outil ne contient le mot de passe',
  ![dansLeDepot.sortie, mauvaisMotDePasse.sortie].some((s) => s.includes(MOT_DE_PASSE)),
);

/* ══════════════════════════════════════════════════════════════════════════
   3. LA RÉCUPÉRATION
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n3. LA RÉCUPÉRATION');

const sortieRecup = path.join(dehors, 'recupere');
const recup = recuperer([
  '--depuis',
  path.join(racine, 'public', 'data'),
  '--vers',
  sortieRecup,
  '--mot-de-passe-env',
  'MDP_ESSAI',
]);
verifier('l’outil termine sans erreur', recup.code === 0, recup.sortie.trim().split('\n').pop());

const dossierRecupere = path.join(sortieRecup, 'content');
const fichesRecuperees = existsSync(dossierRecupere) ? listerFiches(dossierRecupere) : [];
verifier(
  `${fichesOrigine.size} fiche(s) réécrite(s)`,
  fichesRecuperees.length === fichesOrigine.size,
  `${fichesRecuperees.length} trouvée(s)`,
);

/*
   LES CHEMINS SONT CERTIFIÉS, PAS DEVINÉS.

   L'identifiant d'une fiche est l'empreinte SHA-256 de son chemin source. Le
   chemin n'est pas publié. Qu'ils reviennent tous au bon endroit démontre que
   la vérification par empreinte fonctionne — et c'est elle qui décide si la
   progression enregistrée dans le navigateur survit à la récupération.
*/
const manquants = [...fichesOrigine.keys()].filter((c) => !fichesRecuperees.includes(c));
verifier(
  'chaque fiche retrouve son chemin exact, certifié par son empreinte',
  manquants.length === 0,
  manquants.length ? `absente(s) : ${manquants.join(', ')}` : undefined,
);

const rapport = existsSync(path.join(sortieRecup, 'RAPPORT.md'))
  ? readFileSync(path.join(sortieRecup, 'RAPPORT.md'), 'utf8')
  : '';
verifier('un rapport est écrit', rapport.length > 2000, `${rapport.length} caractères`);
verifier(
  'le rapport ne contient pas le mot de passe',
  rapport.length > 0 && !rapport.includes(MOT_DE_PASSE),
);
for (const perte of [
  'Le chemin de chaque fiche',
  'formes:',
  'commentaires',
  'empreinte des fiches audio',
]) {
  verifier(`le rapport nomme la perte « ${perte} »`, rapport.includes(perte));
}

/* ══════════════════════════════════════════════════════════════════════════
   4. CHAMP PAR CHAMP, CONTRE L'ORIGINAL
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n4. CHAMP PAR CHAMP');

/** Les items d'une section YAML, lus comme le build les lit. */
function itemsYaml(texte: string): Record<string, unknown>[] {
  if (!texte?.trim()) return [];
  /* Le même analyseur que le build : une relecture maison mesurerait sa
     propre indulgence, pas la fidélité de la récupération. */
  const lu = YAML.parse(texte);
  return Array.isArray(lu) ? (lu as Record<string, unknown>[]) : [];
}

let frontMatterJustes = 0;
let flashcardsJustes = 0;
let quizJustes = 0;
let ecarts: string[] = [];

for (const [relatif, origineFiche] of fichesOrigine) {
  if (!fichesRecuperees.includes(relatif)) continue;
  const brutRecupere = readFileSync(path.join(dossierRecupere, relatif), 'utf8');
  const lu = matter(brutRecupere);
  const avant = (origineFiche.donnees as { data: Record<string, unknown> }).data;
  const apres = lu.data as Record<string, unknown>;

  const memeFrontMatter =
    avant.matiere === apres.matiere &&
    avant.fascicule === apres.fascicule &&
    avant.titre === apres.titre &&
    Number(avant.ordre ?? 999) === Number(apres.ordre ?? 999) &&
    JSON.stringify(avant.tags ?? []) === JSON.stringify(apres.tags ?? []);
  if (memeFrontMatter) frontMatterJustes += 1;
  else ecarts.push(`${relatif} : front-matter (${JSON.stringify(avant)} → ${JSON.stringify(apres)})`);

  const sectionsAvant = decouperSections(
    (origineFiche.donnees as { content: string }).content,
  ).sections;
  const sectionsApres = decouperSections(lu.content).sections;

  /* Les cartes : la source peut écrire « q: »/« r: », la récupération écrit
     « question: »/« reponse: ». Le schéma accepte les deux, donc on compare
     ce que le schéma en retiendrait, pas la graphie. */
  const cartesAvant = itemsYaml(sectionsAvant.flashcards).map((c) => ({
    question: String(c.q ?? c.question ?? '').trim(),
    reponse: String(c.r ?? c.reponse ?? '').trim(),
  }));
  const cartesApres = itemsYaml(sectionsApres.flashcards).map((c) => ({
    question: String(c.q ?? c.question ?? '').trim(),
    reponse: String(c.r ?? c.reponse ?? '').trim(),
  }));
  if (JSON.stringify(cartesAvant) === JSON.stringify(cartesApres)) flashcardsJustes += 1;
  else ecarts.push(`${relatif} : flashcards (${cartesAvant.length} → ${cartesApres.length})`);

  /* Les questions : l'énoncé et les options, dans l'ordre. La réponse revient
     par son rang là où la source la donnait peut-être par son texte ; c'est
     l'étape 5 qui tranche l'équivalence, en comparant les publications. */
  const questionsAvant = itemsYaml(sectionsAvant.quiz).map((q) => ({
    question: String(q.question ?? '').trim(),
    options: (q.options as unknown[] ?? []).map((o) => String(o).trim()),
  }));
  const questionsApres = itemsYaml(sectionsApres.quiz).map((q) => ({
    question: String(q.question ?? '').trim(),
    options: (q.options as unknown[] ?? []).map((o) => String(o).trim()),
  }));
  if (JSON.stringify(questionsAvant) === JSON.stringify(questionsApres)) quizJustes += 1;
  else ecarts.push(`${relatif} : quiz (${questionsAvant.length} → ${questionsApres.length})`);
}

verifier(
  `front-matter identique pour ${frontMatterJustes}/${fichesOrigine.size} fiche(s)`,
  frontMatterJustes === fichesOrigine.size,
);
verifier(
  `flashcards identiques pour ${flashcardsJustes}/${fichesOrigine.size} fiche(s)`,
  flashcardsJustes === fichesOrigine.size,
);
verifier(
  `quiz identiques pour ${quizJustes}/${fichesOrigine.size} fiche(s)`,
  quizJustes === fichesOrigine.size,
);
if (ecarts.length) console.log(`    ${ecarts.slice(0, 6).join('\n    ')}`);

/* L'audio : le fichier publié EST le fichier source chiffré, donc il doit
   revenir octet pour octet. Rien ici n'est reconstruit, et c'est pourquoi
   c'est la seule partie du corpus dont la fidélité est totale. */
const audioRecupere = path.join(dossierRecupere, '.audio', `${idAudio}.${extension}`);
verifier('l’audio est récupéré', existsSync(audioRecupere));
verifier(
  'et il est identique octet pour octet',
  existsSync(audioRecupere) && readFileSync(audioRecupere).equals(octetsAudio),
);

/* ══════════════════════════════════════════════════════════════════════════
   5. L'ÉPREUVE QUI TRANCHE : reconstruire depuis le récupéré
   ══════════════════════════════════════════════════════════════════════════ */

/*
   Les comparaisons de l'étape 4 disent si les fichiers se ressemblent. Celle-ci
   dit si le SITE SERVIRAIT LES MÊMES PAGES — et c'est la seule question qui
   compte pour qui révise.

   On remplace `content/` par le corpus récupéré, on reconstruit avec le même
   mot de passe, et on compare les deux charges utiles déchiffrées, champ par
   champ. Un `coursHtml` identique signifie que la page de cours est au
   caractère près celle d'aujourd'hui. Un identifiant de carte identique
   signifie que l'historique de répétition espacée continue de tomber juste.
*/
console.log('\n5. RECONSTRUIRE DEPUIS LE RÉCUPÉRÉ');

renameSync(path.join(racine, 'public', 'data'), path.join(racine, 'public', 'data-origine'));
rmSync(path.join(racine, 'content'), { recursive: true, force: true });
cpSync(dossierRecupere, path.join(racine, 'content'), { recursive: true });

/* Un build qui refuse le corpus récupéré est le pire des résultats, et doit
   se lire comme un échec d'essai avec son message — pas comme une exception. */
let journal2 = '';
try {
  journal2 = node('build-content.mjs');
} catch (e) {
  const err = e as { stdout?: string; stderr?: string };
  journal2 = `${err.stdout ?? ''}${err.stderr ?? ''}`;
}
verifier(
  'le corpus récupéré se reconstruit sans erreur',
  /fiche\(s\) chiffr|fiche\(s\)/.test(journal2) && !/✖/.test(journal2),
  /✖/.test(journal2) ? journal2.trim().slice(0, 600) : undefined,
);
verifier(
  'et sans avertissement de titre « ## » non reconnu',
  !/non reconnus/.test(journal2),
  (/.*non reconnus.*/.exec(journal2) ?? [''])[0],
);

const refait = await ouvrirPublication(path.join(racine, 'public', 'data'));
verifier(
  'la reconstruction publie le même nombre de fiches',
  refait.fiches.size === origine.fiches.size,
  `${refait.fiches.size} contre ${origine.fiches.size}`,
);

/*
   LES IDENTIFIANTS, D'ABORD.

   Un identifiant de fiche qui change rend orpheline toute la progression
   enregistrée pour elle : révisions, répétition espacée, séances, favoris.
   C'est la conséquence la plus coûteuse d'une récupération approximative, et
   elle ne se voit nulle part dans le site — elle se voit ici.
*/
const idsAvant = [...origine.fiches.keys()].sort();
const idsApres = [...refait.fiches.keys()].sort();
verifier(
  'chaque fiche garde son identifiant — la progression enregistrée reste valable',
  JSON.stringify(idsAvant) === JSON.stringify(idsApres),
  JSON.stringify(idsApres.filter((i) => !idsAvant.includes(i))),
);

/*
   LE SOULIGNEMENT DU GLOSSAIRE EST COMPARÉ À PART, ET VOICI POURQUOI.

   `glossaire.json` ne publie que `{terme, definition}` : les `formes:` — les
   variantes déclinées, « QPC » pour « question prioritaire de
   constitutionnalité » — ne sont pas publiées, donc pas récupérables. Le
   corpus reconstruit souligne par conséquent moins de termes que l'original.

   C'est une perte réelle, nommée dans le rapport, et il ne faut ni la cacher
   ni la laisser masquer le reste. On compare donc le HTML **hors
   soulignement** — là, l'exigence est l'égalité stricte, parce que c'est le
   texte de la fiche — et on mesure séparément combien de fiches ne diffèrent
   QUE par ce soulignement. Confondre les deux ferait passer la perte des
   `formes:` pour un défaut de conversion, ou l'inverse.
*/
const sansDfn = (h: unknown) =>
  String(h ?? '').replace(/<dfn\b[^>]*>([\s\S]*?)<\/dfn>/g, '$1');

const CHAMPS = [
  'id',
  'titre',
  'matiere',
  'fascicule',
  'tags',
  'sommaire',
  'parties',
  'flashcards',
  'quiz',
  'pretest',
] as const;

/*
   UNE COMPARAISON À VIDE EST UN PIÈGE, ET C'EST ARRIVÉ.

   La boucle ci-dessous sautait les fiches absentes de la reconstruction. Quand
   TOUS les identifiants changeaient, elle ne comparait donc rien, et douze
   assertions passaient au vert sur un corpus qui n'avait pas été retrouvé.
   Un essai qui se tait quand il n'a rien mesuré est pire qu'un essai rouge.
*/
const communs = idsAvant.filter((id) => refait.fiches.has(id));
verifier(
  `les deux publications ont ${idsAvant.length} fiche(s) en commun à comparer`,
  communs.length === idsAvant.length,
  `${communs.length} en commun — les champs ne sont comparés que sur celles-là`,
);

const divergents: Record<string, string[]> = {};
for (const id of communs) {
  const a = origine.fiches.get(id);
  const b = refait.fiches.get(id);
  if (!a || !b) continue;
  for (const champ of CHAMPS) {
    if (JSON.stringify(a[champ]) !== JSON.stringify(b[champ])) {
      (divergents[champ] ??= []).push(id);
    }
  }
}

for (const champ of CHAMPS) {
  const mauvais = divergents[champ] ?? [];
  verifier(
    `« ${champ} » identique pour les ${communs.length} fiche(s) comparée(s)`,
    mauvais.length === 0 && communs.length === idsAvant.length,
    mauvais.length ? `diverge pour ${mauvais.join(', ')}` : undefined,
  );
}

/* Le texte des deux sections rendues : égalité stricte, hors soulignement. */
const texteDivergent: Record<string, string[]> = {};
const glossaireSeul: string[] = [];
for (const id of communs) {
  const a = origine.fiches.get(id)!;
  const b = refait.fiches.get(id)!;
  for (const champ of ['coursHtml', 'ficheHtml'] as const) {
    if (sansDfn(a[champ]) !== sansDfn(b[champ])) (texteDivergent[champ] ??= []).push(id);
    else if (String(a[champ] ?? '') !== String(b[champ] ?? '')) glossaireSeul.push(`${id}/${champ}`);
  }
}
for (const champ of ['coursHtml', 'ficheHtml'] as const) {
  const mauvais = texteDivergent[champ] ?? [];
  verifier(
    `« ${champ} » : texte identique pour les ${communs.length} fiche(s), hors soulignement`,
    mauvais.length === 0 && communs.length === idsAvant.length,
    mauvais.length ? `diverge pour ${mauvais.join(', ')}` : undefined,
  );
}
verifier(
  `le seul écart restant est le soulignement du glossaire (${glossaireSeul.length} section(s))`,
  Object.keys(texteDivergent).length === 0,
  glossaireSeul.length
    ? `${glossaireSeul.join(', ')} — conséquence attendue de la perte des « formes: »`
    : 'aucun écart du tout',
);

/*
   LE DÉTAIL D'UN ÉCART, QUAND IL Y EN A UN.

   Un essai qui dit « coursHtml diverge » laisse chercher pendant une heure.
   On montre donc le premier caractère qui diffère, avec son voisinage : c'est
   ce qui transforme un échec en correction.
*/
for (const champ of ['coursHtml', 'ficheHtml'] as const) {
  const id = (texteDivergent[champ] ?? [])[0];
  if (!id) continue;
  const a = sansDfn(origine.fiches.get(id)?.[champ]);
  const b = sansDfn(refait.fiches.get(id)?.[champ]);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  console.log(
    `    ${champ} de ${id}, premier écart au caractère ${i} :\n` +
      `      publié  : …${JSON.stringify(a.slice(Math.max(0, i - 60), i + 60))}\n` +
      `      refait  : …${JSON.stringify(b.slice(Math.max(0, i - 60), i + 60))}`,
  );
}

/* L'audio, une seconde fois : chiffré à nouveau, il doit redonner les mêmes
   octets. Le chiffré lui-même diffère — l'IV est tiré au sort à chaque build —
   et c'est pour cela qu'on compare le clair, pas le fichier publié. */
const audioRefait = path.join(racine, 'public', 'data', 'audio', `${idAudio}.enc`);
verifier('la reconstruction republie l’audio', existsSync(audioRefait));
const podcastAvant = origine.fiches.get(idAudio)?.podcast as { octets?: number } | null;
const podcastApres = refait.fiches.get(idAudio)?.podcast as { octets?: number } | null;
verifier(
  'et il pèse le même nombre d’octets',
  Boolean(podcastAvant && podcastApres && podcastAvant.octets === podcastApres.octets),
  `${podcastAvant?.octets} → ${podcastApres?.octets}`,
);

/* ══════════════════════════════════════════════════════════════════════════
   Le verdict
   ══════════════════════════════════════════════════════════════════════════ */

console.log(
  rouges === 0
    ? `\n${vert('Aller-retour complet : le corpus récupéré republie à l’identique.')}\n`
    : `\n${rouge(`${rouges} échec(s).`)}\n`,
);
process.exit(rouges === 0 ? 0 : 1);
