/**
 * LA BANQUE « QCM — DGFiP » PUBLIÉE, RAMENÉE EN SOURCE.
 *
 * ## Pourquoi
 *
 * La récupération du corpus rend les fiches au format source, mais dépose la
 * banque de QCM telle quelle, au format publié, dans `annexes/qcm-dgfip.json`.
 * `content/qcm-dgfip/` est donc vide — et par conséquent **540 questions
 * n'existent pour aucun contrôle** : le schéma ne les lit pas, le build ne les
 * voit pas, aucune correction ne peut y être écrite, et les trois parcours
 * DGFiP n'ont rien à servir.
 *
 * Cet outil comble ce trou-là, et rien d'autre.
 *
 * ## Il ne décide pas qu'il a réussi : il le prouve
 *
 * Réécrire du contenu est facile ; le réécrire à l'identique ne se promet pas.
 * L'outil fait donc l'aller-retour AVANT d'écrire quoi que ce soit à
 * destination : il convertit, écrit dans un dossier temporaire hors du dépôt,
 * recharge avec le CHARGEUR DU BUILD — pas un second analyseur, qui ne
 * prouverait que son accord avec lui-même — et compare champ par champ à la
 * banque publiée.
 *
 * Tant qu'un seul écart subsiste, `content/` n'est pas touché et le code de
 * sortie vaut 1. C'est le code de sortie qui tranche, pas le rapport.
 *
 * Ce que cette exigence protège : `id = idStable(rubrique | énoncé)`. Un énoncé
 * réécrit à une espace près reçoit un identifiant neuf, et l'historique par
 * question conservé dans le navigateur de la personne qui révise devient
 * orphelin. L'identité n'est pas une élégance de programmeur.
 *
 * ## L'emploi
 *
 *   npm run qcm:vers-source -- --depuis <annexes/qcm-dgfip.json> --vers content/qcm-dgfip
 *
 * Options :
 *   --depuis <fichier>   la banque au format publié (obligatoire)
 *   --vers <dossier>     où écrire les rubriques (obligatoire)
 *   --remplacer          autorise l'écriture dans un dossier déjà peuplé
 *   --chemins-de-fiches <fichier>  « identifiant<TAB>chemin » par ligne, pour
 *                        défaire les renvois « rappel de cours ». Sans lui, un
 *                        renvoi résolu fait échouer la conversion au lieu de
 *                        disparaître en silence.
 *   --essai-seul         prouve l'aller-retour et n'écrit rien à destination
 */
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { chargerBanqueDgfip } from './lib/banque-dgfip.mjs';
import { estDansLeDepot, RACINE_DEPOT } from './lib/fichier-de-secret.mjs';
import { banqueEnSource, differencesDeBanque } from './lib/qcm-dgfip-en-source.mjs';

const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;
const jaune = (t: string) => `\x1b[33m${t}\x1b[0m`;

function arreter(message: string): never {
  console.error(`\n${rouge('✖')} ${message}\n`);
  process.exit(1);
}

function lireArguments(argv: string[]) {
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) arreter(`argument inattendu : « ${a} »`);
    const nom = a.slice(2);
    if (['remplacer', 'essai-seul'].includes(nom)) {
      opts[nom] = true;
      continue;
    }
    const valeur = argv[i + 1];
    if (valeur === undefined || valeur.startsWith('--')) arreter(`« --${nom} » attend une valeur`);
    opts[nom] = valeur;
    i += 1;
  }
  return opts;
}

/**
 * La destination a-t-elle le droit d'exister ?
 *
 * Le dépôt est public et `content/` est le seul endroit qu'il ignore. Écrire la
 * banque en clair ailleurs dans l'arbre de travail la mettrait à un
 * « git add . » de devenir publique — c'est exactement ce que le chiffrement
 * du site existe pour empêcher. Hors du dépôt, en revanche, la personne fait
 * ce qu'elle veut : c'est sa machine.
 */
function verifierLaDestination(vers: string) {
  const abs = path.resolve(vers);
  if (!estDansLeDepot(abs)) return;
  const contenu = path.join(RACINE_DEPOT, 'content');
  if (abs === contenu || abs.startsWith(contenu + path.sep)) return;
  arreter(
    `« ${vers} » est dans le dépôt mais hors de « content/ ».\n` +
      '  Le dépôt est public, et « content/ » est le seul dossier qu\'il ignore :\n' +
      '  la banque en clair y serait à un « git add . » de devenir publique.\n' +
      '  Écrivez dans « content/qcm-dgfip », ou hors du dépôt.',
  );
}

/** « identifiant<TAB>chemin » par ligne. */
async function lireLesChemins(fichier: string) {
  const index = new Map<string, string>();
  const brut = await readFile(fichier, 'utf8');
  brut.split('\n').forEach((ligne, i) => {
    const net = ligne.trim();
    if (!net || net.startsWith('#')) return;
    const [id, ...reste] = net.split('\t');
    const chemin = reste.join('\t').trim();
    if (!id || !chemin) arreter(`« ${fichier} » ligne ${i + 1} : « identifiant<TAB>chemin » attendu`);
    index.set(id, chemin);
  });
  return index;
}

const opts = lireArguments(process.argv.slice(2));
const depuis = typeof opts.depuis === 'string' ? opts.depuis : undefined;
const vers = typeof opts.vers === 'string' ? opts.vers : undefined;
const essaiSeul = opts['essai-seul'] === true;

if (!depuis) arreter('« --depuis <fichier> » est obligatoire : la banque au format publié.');
if (!vers && !essaiSeul) {
  arreter('« --vers <dossier> » est obligatoire, ou « --essai-seul » pour ne rien écrire.');
}
if (!existsSync(depuis)) arreter(`« ${depuis} » est introuvable.`);
if (vers) verifierLaDestination(vers);

/* --- 1. La banque publiée ------------------------------------------------ */
let publiee: { rubriques?: unknown[]; questions?: unknown[] };
try {
  publiee = JSON.parse(await readFile(depuis, 'utf8'));
} catch (e) {
  arreter(`« ${depuis} » n'est pas un JSON lisible : ${(e as Error).message}`);
}
if (!Array.isArray(publiee.questions) || publiee.questions.length === 0) {
  arreter(`« ${depuis} » ne porte aucune question : ce n'est pas une banque publiée.`);
}

console.log(
  `\nBANQUE PUBLIÉE : ${publiee.questions.length} question(s), ` +
    `${(publiee.rubriques ?? []).length} rubrique(s)\n`,
);

/* --- 2. La conversion ---------------------------------------------------- */
const cheminParId = opts['chemins-de-fiches']
  ? await lireLesChemins(opts['chemins-de-fiches'] as string)
  : new Map<string, string>();

let fichiers: ReturnType<typeof banqueEnSource>;
try {
  fichiers = banqueEnSource(publiee as never, {
    cheminDeLaFiche: (id: string) => cheminParId.get(id),
  });
} catch (e) {
  arreter(`la conversion s'arrête : ${(e as Error).message}`);
}

for (const f of fichiers) {
  console.log(`  ${f.nom.padEnd(44)}${String(f.combien).padStart(5)} question(s)  « ${f.rubrique} »`);
}

/* --- 3. La preuve : aller-retour par le chargeur du build ---------------- */
const laboratoire = await mkdtemp(path.join(os.tmpdir(), 'qcm-dgfip-aller-retour-'));
let ecarts: string[] = [];
let refus: string | undefined;
try {
  for (const f of fichiers) {
    await writeFile(path.join(laboratoire, f.nom), f.texte, 'utf8');
  }
  const rechargee = await chargerBanqueDgfip(laboratoire, {
    echouer: (m: string) => {
      throw new Error(m);
    },
    avertir: (m: string) => console.log(`  ${jaune('!')} ${m}`),
    etiquette: 'la source réécrite',
  });
  ecarts = differencesDeBanque(publiee as never, rechargee, { cheminParId });
} catch (e) {
  refus = (e as Error).message;
}

/*
   LE MÉNAGE AVANT LE VERDICT, ET NON DANS UN « finally ».

   Le dossier temporaire porte le contenu EN CLAIR. `arreter` sort du
   processus, et `process.exit` n'attend pas un `finally` : le dossier
   resterait dans « /tmp », ce qui annulerait la règle qui interdit au corpus
   de sortir de « content/ ». On efface donc d'abord, on tranche ensuite.
*/
await rm(laboratoire, { recursive: true, force: true });
if (refus !== undefined) arreter(`la source réécrite ne se recharge pas : ${refus}`);

if (ecarts.length) {
  console.error(
    `\n${rouge(`✖ L'ALLER-RETOUR N'EST PAS À L'IDENTIQUE : ${ecarts.length} écart(s).`)}\n`,
  );
  for (const e of ecarts.slice(0, 40)) console.error(`  - ${e}`);
  if (ecarts.length > 40) console.error(`  … et ${ecarts.length - 40} autre(s).`);
  console.error(
    `\n${rouge('Rien n\'a été écrit à destination.')} Une conversion qui ne revient pas\n` +
      'à l\'identique changerait des identifiants de question, et la progression\n' +
      'enregistrée pour elles deviendrait orpheline.\n',
  );
  process.exit(1);
}

console.log(
  `\n${vert('✓ ALLER-RETOUR À L\'IDENTIQUE')} — la source réécrite, rechargée par le ` +
    'chargeur du build,\n  redonne la banque publiée champ pour champ : ' +
    `${publiee.questions.length} identifiant(s) de question,\n  ` +
    `${(publiee.rubriques ?? []).length} rubrique(s), même ordre.\n`,
);

/* --- 4. L'écriture ------------------------------------------------------- */
if (essaiSeul || !vers) {
  console.log(`${jaune('« --essai-seul »')} : rien n'a été écrit.\n`);
  process.exit(0);
}

await mkdir(vers, { recursive: true });
const deja = (await readdir(vers)).filter((n) => /\.ya?ml$/i.test(n));
if (deja.length && opts.remplacer !== true) {
  arreter(
    `« ${vers} » contient déjà ${deja.length} fichier(s) de rubrique.\n` +
      '  Ajoutez « --remplacer » si vous voulez les écraser — mais relisez d\'abord :\n' +
      '  les corrections déjà écrites à la main y sont.',
  );
}

for (const f of fichiers) {
  await writeFile(path.join(vers, f.nom), f.texte, 'utf8');
}

const total = fichiers.reduce((n, f) => n + f.combien, 0);
console.log(
  `${vert('✓')} ${fichiers.length} rubrique(s), ${total} question(s) écrites dans « ${vers} ».\n` +
    `  « npm run build-content » les voit désormais, et le schéma les contrôle.\n`,
);
process.exit(0);
