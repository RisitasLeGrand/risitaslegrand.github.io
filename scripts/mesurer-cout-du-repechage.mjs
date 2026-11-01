/**
 * CE QUE LE REPÊCHAGE COÛTE, ET CE QU'IL RAPPORTE.
 *
 * `docs/cyclades/poids-du-manifeste.md` a établi que `recherche.json` pèse
 * 8,8 Mo sur le réseau, et que son champ `texte` — le corps entier des 429
 * fiches — ne sert QUE dans la branche de repêchage de `rattacher`. Ce
 * document nommait deux mesures qu'il ne faisait pas :
 *
 *   1. le TEMPS que ce fichier coûte à chaque page qui le charge ;
 *   2. la PART du repêchage dans les rattachements.
 *
 * Ce script les fait. Il ne change rien : il écrit des chiffres.
 *
 *     npm run mesure:repechage
 *
 * ## Il mesure la VRAIE fonction, et le détour par esbuild est pour cela
 *
 * Transcrire les vingt lignes de `rattacher` dans le script aurait été plus
 * simple, et aurait mesuré une COPIE — qui dérive du jour où quelqu'un touche
 * au barème, sans que rien ne le dise.
 *
 * Mais `rattachement.ts` tire `normaliser` de `src/lib/ui.ts`, qui lit
 * `import.meta.env.BASE_URL` : une substitution que Vite fait à la
 * construction et que `tsx` ne fournit pas. C'est la raison pour laquelle les
 * autres scripts du dépôt n'importent que de `src/lib/noyau/`, qui est
 * justement la partie tenue à l'écart de ces globales.
 *
 * On passe donc les deux modules à esbuild, avec `import.meta.env.BASE_URL`
 * défini, et l'on importe le paquet obtenu. Le code mesuré est bien celui du
 * dépôt ; seule la globale manquante est fournie. Déplacer `normaliser` dans
 * le noyau serait plus propre et touche à du code que ce lot n'a pas à
 * remuer — c'est noté pour plus tard, pas fait ici.
 *
 * ## Et pourquoi ce fichier est en « .mjs » alors qu'il appelle du TypeScript
 *
 * Parce qu'esbuild fait désormais le pont, il n'a plus besoin d'être
 * transpilé. Et il ne DOIT pas l'être : écrit en « .mts », sa première version
 * est tombée sur « __name is not defined » dans `page.evaluate`. Le
 * transpileur garde les noms des fonctions et injecte un `__name(…)` qui
 * n'existe que du côté de Node ; rien de ce qui est nommé ne traverse donc
 * vers le navigateur. Le dépôt a déjà payé cette leçon — tous ses essais de
 * navigateur sont en « .mjs » — et je l'ai repayée en une heure.
 *
 * ## Les cinq phases, et pourquoi on ne mesure pas « le déchiffrement »
 *
 * « Déchiffrer » est le nom de l'étape, pas celui du coût. Le fichier porte
 * `{ iv, ct }` avec `ct` en base64, donc la page paie :
 *
 *   1. `reponse.json()` — qui parse un JSON de 8,8 Mo dont le corps est UNE
 *      chaîne base64 ;
 *   2. la base64 vers octets ;
 *   3. `crypto.subtle.decrypt` — la seule étape qui porte le nom ;
 *   4. le décodage UTF-8 des 11,6 Mo obtenus ;
 *   5. `JSON.parse` de ces 11,6 Mo.
 *
 * Les séparer n'est pas du zèle : si `JSON.parse` domine, alléger le fichier
 * paie à proportion de sa taille ; si c'est l'AES, le gain suit le volume
 * chiffré. On ne peut pas le deviner, et la proposition en dépend.
 *
 * PBKDF2 est HORS du chiffre par page, et c'est dit : ses 600 000 itérations
 * sont payées une fois par session, à l'ouverture du coffre.
 *
 * ## Le corpus de la seconde mesure, et ce qu'il vaut
 *
 * Les actualités ne sont pas dans le dépôt — elles viennent d'un flux — donc
 * on ne peut pas mesurer sur les vraies. Le script balaie donc DEUX corpus de
 * mots-clés, et les deux sont nécessaires parce qu'ils sont biaisés en sens
 * contraires. Chaque mot est pris comme mot-clé unique, et l'on compare le
 * résultat de `rattacher` avec et sans index.
 *
 * **Le vocabulaire des CORPS de fiches : un plafond, et un plafond très
 * lâche.** Ces mots sont par construction présents dans un corps, donc l'index
 * les trouve forcément. Ce corpus ne dit pas « le repêchage sert dans 84 % des
 * cas » ; il dit « quand le mot-clé est dans un corps, il sert dans 84 % des
 * cas ». C'est le biais le plus grossier possible, et la première version de
 * ce script le présentait comme « exhaustif, donc sans biais de sélection » —
 * ce qui était faux : exhaustif SUR UN ESPACE CHOISI n'est pas sans biais.
 *
 * **Le vocabulaire du GLOSSAIRE : un corpus qui n'est pas choisi pour cela.**
 * Ce sont les termes du domaine, retenus parce qu'ils méritent une définition,
 * et non parce qu'ils figurent dans un corps. Un mot-clé de veille ressemble
 * davantage à cela qu'à un mot tiré d'un corps. Ce n'est pas non plus un
 * échantillon des vraies actualités, et ce n'est pas dit comme tel.
 *
 * Les deux encadrent, et aucun ne conclut. Ce qu'on peut affirmer est ce qui
 * vaut dans les deux.
 */
import { readFileSync } from 'node:fs';

import { chromium } from 'playwright-core';

import { build } from 'esbuild';

import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

/** Le module du dépôt, rendu importable : voir l'en-tête. */
const PAQUET = 'node_modules/.cache/mesure-rattachement.mjs';
await build({
  entryPoints: ['scripts/lib/surface-rattachement.ts'],
  outfile: PAQUET,
  bundle: true,
  format: 'esm',
  platform: 'node',
  define: { 'import.meta.env.BASE_URL': '"/"' },
  logLevel: 'silent',
});
const { aplatirFiches, construireIndexTexte, rattacher, normaliser } = await import(
  `../${PAQUET}`
);

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const PARAMS = JSON.parse(readFileSync('public/data/cle.json', 'utf8'));

const ms = (t) => `${t.toFixed(1).padStart(9)} ms`;
const pc = (n, sur) => `${((100 * n) / sur).toFixed(1)} %`;

const b64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'));

async function deriverCle(motDePasse) {
  const materiel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(motDePasse),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64(PARAMS.sel), iterations: PARAMS.iterations, hash: 'SHA-256' },
    materiel,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt'],
  );
}

async function dechiffrer(cle, chemin) {
  const blob = JSON.parse(readFileSync(chemin, 'utf8'));
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64(blob.iv) },
    cle,
    b64(blob.ct),
  );
  return JSON.parse(new TextDecoder().decode(clair));
}

console.log('\n\x1b[1mCE QUE LE REPÊCHAGE COÛTE, ET CE QU’IL RAPPORTE\x1b[0m');

const cle = await deriverCle(MDP);
const entrees = await dechiffrer(cle, 'public/data/recherche.json');
const manifeste = await dechiffrer(cle, 'public/data/manifeste.json');
const glossaire = await dechiffrer(cle, 'public/data/glossaire.json');
const fiches = aplatirFiches(manifeste);

console.log(`\n  ${entrees.length} entrées de recherche, ${fiches.length} fiches au manifeste.`);

/* ══════════════════════════════════════════════════════════════════════════
   2. LA PART DU REPÊCHAGE — d'abord, parce qu'elle décide du reste
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n\x1b[1m2. LA PART DU REPÊCHAGE DANS LES RATTACHEMENTS\x1b[0m\n');

const index = construireIndexTexte(entrees);

/** Le balayage, sur un corpus de mots-clés donné. */
function balayer(mots) {
  let sansIndexVide = 0;
  let sauves = 0;
  let change = 0;
  let identiques = 0;
  let ajoutees = 0;
  const ids = (r) => r.map((x) => x.fiche.id).join('|');
  for (const mot of mots) {
    const actu = { titre: '', mots_cles: [mot] };
    const sans = rattacher(actu, fiches, null);
    const avec = rattacher(actu, fiches, index);
    if (sans.length === 0) {
      sansIndexVide += 1;
      if (avec.length > 0) sauves += 1;
    }
    if (ids(sans) === ids(avec)) identiques += 1;
    else {
      change += 1;
      ajoutees += Math.max(0, avec.length - sans.length);
    }
  }
  return { combien: mots.length, sansIndexVide, sauves, change, identiques, ajoutees };
}

function dire(titre, r) {
  console.log(`  \x1b[1m${titre}\x1b[0m — ${r.combien} mots-clés\n`);
  console.log(`    ${r.identiques} (${pc(r.identiques, r.combien)}) : l’index ne change RIEN au résultat`);
  console.log(`    ${r.change} (${pc(r.change, r.combien)}) : il change les trois fiches rendues`);
  console.log(`    ${r.sansIndexVide} (${pc(r.sansIndexVide, r.combien)}) : aucun rattachement sans l’index`);
  console.log(`        dont ${r.sauves} sauvés par le repêchage`);
  console.log(`    ${r.ajoutees} fiches ajoutées en tout\n`);
}

/* Le vocabulaire des CORPS : les mots que seul le repêchage peut atteindre. */
const MOTS_VIDES_APPROX = new Set(
  ('le la les un une des du de au aux et ou en dans sur pour par avec sans sous vers chez que ' +
    'qui quoi dont ce ces cet cette son sa ses leur leurs est sont ete plus moins tres entre ' +
    'apres avant nouveau nouvelle nouvelles france francais francaise annee mois semaine jour')
    .split(' '),
);
const vocabulaire = new Set();
for (const e of entrees) {
  for (const mot of normaliser(e.texte).split(/[^a-z0-9]+/)) {
    if (mot.length >= 5 && !MOTS_VIDES_APPROX.has(mot)) vocabulaire.add(mot);
  }
}
const mots = [...vocabulaire].sort();

const DU_GLOSSAIRE = (() => {
  const v = new Set();
  for (const t of glossaire) {
    for (const mot of normaliser(`${t.terme ?? ''} ${t.definition ?? ''}`).split(/[^a-z0-9]+/)) {
      if (mot.length >= 5 && !MOTS_VIDES_APPROX.has(mot)) v.add(mot);
    }
  }
  return [...v].sort();
})();

dire('VOCABULAIRE DES CORPS — plafond lâche, ces mots y sont par construction', balayer(mots));
dire('VOCABULAIRE DU GLOSSAIRE — corpus non choisi pour cela', balayer(DU_GLOSSAIRE));

/* ══════════════════════════════════════════════════════════════════════════
   1. CE QUE LE FICHIER COÛTE À CHAQUE PAGE, DANS LE NAVIGATEUR
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\x1b[1m1. CE QUE « recherche.json » COÛTE À CHAQUE PAGE\x1b[0m\n');

const nav = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await nav.newContext()).newPage();
await page.goto(`${RACINE}/`, { waitUntil: 'domcontentloaded' });

const phases = await page.evaluate(
  async ([racine, mdp, params]) => {
    const b64v = (s) => {
      const brut = atob(s);
      const o = new Uint8Array(brut.length);
      for (let i = 0; i < brut.length; i += 1) o[i] = brut.charCodeAt(i);
      return o;
    };
    const materiel = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(mdp),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const cle = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64v(params.sel), iterations: params.iterations, hash: 'SHA-256' },
      materiel,
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt'],
    );

    const url = `${racine}/data/recherche.json?v=${encodeURIComponent(params.version)}`;
    const t0 = performance.now();
    const reponse = await fetch(url);
    const brut = await reponse.text();
    const t1 = performance.now();
    const blob = JSON.parse(brut);
    const t2 = performance.now();
    const octets = b64v(blob.ct);
    const t3 = performance.now();
    const clair = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64v(blob.iv) },
      cle,
      octets,
    );
    const t4 = performance.now();
    const texte = new TextDecoder().decode(clair);
    const t5 = performance.now();
    const valeur = JSON.parse(texte);
    const t6 = performance.now();

    return {
      reseau: t1 - t0,
      parseEnveloppe: t2 - t1,
      base64: t3 - t2,
      aes: t4 - t3,
      utf8: t5 - t4,
      parseClair: t6 - t5,
      sansReseau: t6 - t1,
      octetsServis: brut.length,
      octetsClairs: texte.length,
      combien: valeur.length,
    };
  },
  [RACINE, MDP, PARAMS],
);
await nav.close();

console.log(`  ${(phases.octetsServis / 1024).toFixed(0)} Ko servis → ${(phases.octetsClairs / 1024).toFixed(0)} Ko en clair, ${phases.combien} entrées\n`);
console.log(`  réseau (localhost, non représentatif) ${ms(phases.reseau)}`);
console.log(`  1. JSON.parse de l’enveloppe base64  ${ms(phases.parseEnveloppe)}`);
console.log(`  2. base64 vers octets                ${ms(phases.base64)}`);
console.log(`  3. AES-GCM decrypt                   ${ms(phases.aes)}`);
console.log(`  4. décodage UTF-8                    ${ms(phases.utf8)}`);
console.log(`  5. JSON.parse du clair               ${ms(phases.parseClair)}`);
console.log(`  ─────────────────────────────────────────────────`);
console.log(`  LE COÛT PAR PAGE, HORS RÉSEAU        ${ms(phases.sansReseau)}\n`);
