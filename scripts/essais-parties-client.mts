/**
 * Les parties d'une fiche jusqu'au navigateur (prompt 46, P2 et P4).
 *
 *   npm run essais:parties-client
 *
 * ## Ce que cet essai constate
 *
 * P2 demande que les repères audio soient « chiffrés avec le contenu, dans
 * `Fiche.podcast.parties` ». P4 demande qu'une carte et un QCM puissent
 * désigner une partie, et que le build refuse une partie absente. Dans les
 * deux cas, la question n'est pas « le code en parle-t-il » mais « le
 * navigateur le reçoit-il ».
 *
 * L'essai lance donc la vraie commande de construction, puis **déchiffre ce
 * qu'elle a publié** et regarde dedans. C'est le seul endroit où le défaut
 * qui compte se voit : un champ produit, validé, chiffré, et jamais recopié
 * dans la charge utile — le prétest l'a vécu, et `build-content.mjs` porte
 * depuis une garde contre cet oubli.
 *
 * ## Le laboratoire, et ce qu'il ne touche pas
 *
 * Il construit « content/ » à partir de « content-exemple/ », avec un mot de
 * passe FACTICE, et efface tout derrière lui. Si « content/ », « .env.local »,
 * le témoin local ou « public/data/ » existent déjà, il ne s'exécute pas et le
 * dit : du contenu réel et un vrai mot de passe ne sont pas un terrain
 * d'essai.
 *
 * La synthèse vocale n'est pas sollicitée — elle demande un modèle de 325 Mo.
 * Les métadonnées audio sont donc écrites à la main, telles que la synthèse
 * les écrit : avec repères pour une fiche, SANS pour une autre. C'est la
 * seconde exigence du prompt, « une fiche audio sans repères se lit comme
 * aujourd'hui », et elle ne se vérifie qu'en ayant les deux cas sous la main.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idStable } from './lib/crypto.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-prompt-46-sans-valeur';

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

/* ── Le laboratoire ──────────────────────────────────────────────────────── */

const APORTEE = [
  path.join(racine, 'content'),
  path.join(racine, '.env.local'),
  path.join(racine, '.temoin-mot-de-passe.local.json'),
  path.join(racine, 'public', 'data'),
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

const nettoyer = () => {
  for (const chemin of APORTEE) rmSync(chemin, { recursive: true, force: true });
};
process.once('exit', nettoyer);

const node = (script: string, env: Record<string, string> = {}) =>
  execFileSync(process.execPath, [path.join(racine, 'scripts', script)], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

console.log('\nLA CONSTRUCTION');
node('init-contenu.mjs');
writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);
node('podcasts.mjs', { REVINSP_SANS_PODCAST: '1' });

/*
   Les métadonnées audio, écrites telles que « synthese-voix.py » les écrit.
   La première fiche a des repères, la deuxième n'en a pas : c'est l'état d'un
   audio produit avant le prompt 46, et il doit rester lisible.
*/
const AVEC = 'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.md';
const SANS = 'droit-public/fascicule-1/fiche-02-principe-de-legalite.md';
const REPERES = [
  { id: 'i-larchitecture-de-lordre-juridique-interne', debut: 26.59 },
  { id: 'ii-le-contrôle-de-constitutionnalité', debut: 64.95 },
  { id: 'iii-larticulation-avec-le-droit-international', debut: 106.49 },
];

const dossierAudio = path.join(racine, 'content', '.audio');
mkdirSync(dossierAudio, { recursive: true });
const idAvec = await idStable(AVEC);
const idSans = await idStable(SANS);

/* Un audio de laboratoire : le build ne lit que ses octets pour les chiffrer. */
const poserAudio = (id: string, meta: Record<string, unknown>) => {
  writeFileSync(path.join(dossierAudio, `${id}.opus`), Buffer.alloc(2048, 7));
  writeFileSync(path.join(dossierAudio, `${id}.json`), JSON.stringify(meta));
};
poserAudio(idAvec, { empreinte: 'x', secondes: 153.8, octets: 2048, moteur: 'kokoro', parties: REPERES });
poserAudio(idSans, { empreinte: 'y', secondes: 123.8, octets: 2048, moteur: 'kokoro' });

const journal = node('build-content.mjs');
verifier('« build-content.mjs » a construit sans erreur', /fiche\(s\)/.test(journal));
verifier('et sans titre de partie orphelin', !/sans identifiant écrit/.test(journal), journal.trim().split('\n').pop());

/* ── Déchiffrer ce qui a été publié ──────────────────────────────────────── */

const dossierSortie = path.join(racine, 'public', 'data');
const parametres = JSON.parse(readFileSync(path.join(dossierSortie, 'cle.json'), 'utf8'));
const materiel = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(MOT_DE_PASSE),
  'PBKDF2',
  false,
  ['deriveKey'],
);
const cle = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: Buffer.from(parametres.sel, 'base64'),
    iterations: parametres.iterations,
    hash: 'SHA-256',
  },
  materiel,
  { name: 'AES-GCM', length: 256 },
  false,
  ['decrypt'],
);

async function ouvrir(relatif: string) {
  const { iv, ct } = JSON.parse(readFileSync(path.join(dossierSortie, relatif), 'utf8'));
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
    cle,
    Buffer.from(ct, 'base64'),
  );
  return JSON.parse(new TextDecoder().decode(clair));
}

console.log('\nCE QUE LE NAVIGATEUR REÇOIT');
const ficheAvec = await ouvrir(path.join('fiches', `${idAvec}.json`));
const ficheSans = await ouvrir(path.join('fiches', `${idSans}.json`));

verifier(
  'la charge utile est bien chiffrée (elle ne s’ouvre qu’avec la clé)',
  typeof ficheAvec?.titre === 'string',
);

/* P2 — les repères arrivent chiffrés, dans « podcast.parties ». */
verifier(
  'Fiche.podcast.parties porte les repères, tels que la synthèse les a mesurés',
  JSON.stringify(ficheAvec.podcast?.parties) === JSON.stringify(REPERES),
  JSON.stringify(ficheAvec.podcast?.parties),
);
verifier(
  'chaque repère désigne une partie que la fiche possède vraiment',
  (ficheAvec.podcast?.parties ?? []).every((r: { id: string }) =>
    (ficheAvec.parties ?? []).some((p: { id: string }) => p.id === r.id),
  ),
);
verifier(
  'une fiche audio sans repères n’a pas le champ du tout — son absence vaut « la fiche entière »',
  ficheSans.podcast !== null && !('parties' in (ficheSans.podcast ?? {})),
  JSON.stringify(ficheSans.podcast),
);
verifier(
  'et elle garde durée, poids et format, comme avant le prompt 46',
  ficheSans.podcast?.secondes === 123.8 && typeof ficheSans.podcast?.type === 'string',
  JSON.stringify(ficheSans.podcast),
);

/* P4 — le rattachement d'une carte et d'un QCM arrive jusqu'au client. */
console.log('\nLE RATTACHEMENT DES CARTES ET DES QCM');
const cartesRattachees = (ficheAvec.flashcards ?? []).filter((c: { partie?: string }) => c.partie);
const qcmRattaches = (ficheAvec.quiz ?? []).filter((q: { partie?: string }) => q.partie);
verifier(
  'une carte portant « partie: » arrive avec son rattachement',
  cartesRattachees.length === 2,
  cartesRattachees.map((c: { partie: string }) => c.partie).join(', '),
);
verifier(
  'une question de quiz aussi',
  qcmRattaches.length === 1,
  qcmRattaches.map((q: { partie: string }) => q.partie).join(', '),
);
verifier(
  'les cartes sans « partie: » n’ont pas le champ — elles restent à la fiche entière',
  (ficheAvec.flashcards ?? []).filter((c: { partie?: string }) => !('partie' in c)).length === 3,
);
verifier(
  'et le rattachement désigne une partie réelle de la fiche',
  [...cartesRattachees, ...qcmRattaches].every((x: { partie: string }) =>
    (ficheAvec.parties ?? []).some((p: { id: string }) => p.id === x.partie),
  ),
);
verifier(
  'les trois parties de la fiche portent un identifiant écrit (« declare »)',
  (ficheAvec.parties ?? []).length === 3 &&
    (ficheAvec.parties ?? []).every((p: { declare: boolean }) => p.declare),
  JSON.stringify((ficheAvec.parties ?? []).map((p: { id: string }) => p.id)),
);

/* ── Le refus : une carte qui cite une partie absente ────────────────────── */

console.log('\nLE REFUS');
const cheminFiche = path.join(racine, 'content', AVEC);
const sain = readFileSync(cheminFiche, 'utf8');
writeFileSync(
  cheminFiche,
  sain.replace(
    'partie: i-larchitecture-de-lordre-juridique-interne',
    'partie: une-partie-qui-nexiste-pas',
  ),
);
let refus = '';
let code = 0;
try {
  node('build-content.mjs');
} catch (e) {
  const erreur = e as { status?: number; stdout?: string; stderr?: string };
  code = erreur.status ?? 0;
  refus = `${erreur.stdout ?? ''}${erreur.stderr ?? ''}`;
}
writeFileSync(cheminFiche, sain);
verifier('le build échoue quand une carte cite une partie absente', code !== 0, `code de sortie ${code}`);
verifier(
  'et il dit laquelle, et dans quelle fiche',
  refus.includes('une-partie-qui-nexiste-pas') && refus.includes('fiche-01-hierarchie-des-normes'),
  refus.split('\n').filter((l) => l.includes('une-partie-qui-nexiste-pas')).join(' ').slice(0, 200),
);

console.log(rouges === 0 ? `\n${vert('Tout est vert.')}` : `\n${rouge(`${rouges} rouge(s).`)}`);
process.exit(rouges === 0 ? 0 : 1);
