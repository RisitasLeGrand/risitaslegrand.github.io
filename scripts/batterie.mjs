#!/usr/bin/env node
/**
 * La batterie complète : les 234 essais, dans l'ordre, et un verdict.
 *
 *   npm run batterie
 *
 * ## Pourquoi cette commande existe
 *
 * La règle de travail est « batterie complète avant chaque poussée et avant
 * chaque fusion ». Tant que la batterie n'était qu'une boucle shell écrite à
 * la main dans un dossier temporaire, elle n'était ni reproductible ni
 * vérifiable : deux lancements pouvaient ne pas couvrir les mêmes essais, et
 * personne ne pouvait relire ce qui avait tourné.
 *
 * ## Ce qu'elle refuse de faire
 *
 * Elle ne lance rien si les conditions d'un verdict honnête ne sont pas
 * réunies, et elle le dit au lieu de rendre des rouges qui n'en sont pas :
 *
 * - sans `SITE_PASSWORD`, les essais de navigateur ne peuvent pas
 *   déverrouiller le site : tous seraient rouges, pour une raison qui
 *   n'appartient pas au site ;
 * - sans aperçu servant `localhost:4321`, ils n'ont rien à visiter — et un
 *   aperçu d'un AUTRE répertoire de travail répondrait quand même, ce qui
 *   mesurerait un autre site que celui qu'on croit. L'adresse est donc
 *   affichée, et c'est à l'appelant de savoir ce qu'elle sert.
 *
 * Elle ne décide pas non plus si un rouge est acceptable : elle les nomme,
 * et la comparaison au tableau des anomalies reste un geste humain.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync as lireFichier, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const ADRESSE = process.env.RACINE ?? 'http://localhost:4321';
const DELAI_MS = Number(process.env.BATTERIE_DELAI_MS ?? 500_000);

const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {};
/* Tout ce qui commence par « essais » : la liste ne se tient pas à la main. */
const noms = Object.keys(scripts).filter((n) => n.startsWith('essais'));

if (noms.length === 0) {
  console.error('✗ PANNE — aucun essai trouvé dans package.json.');
  process.exit(1);
}

/* ── Les deux refus ────────────────────────────────────────────────────── */

if (!process.env.SITE_PASSWORD) {
  console.error(
    '✗ REFUS — SITE_PASSWORD n’est pas dans l’environnement.\n' +
      '  Les essais de navigateur ne pourraient pas déverrouiller le site, et\n' +
      '  la batterie rendrait des rouges qui n’appartiennent pas au site.\n' +
      '  Donnez-le dans l’environnement de la commande, jamais dans un fichier\n' +
      '  suivi par Git.',
  );
  process.exit(1);
}

const sert = await fetch(`${ADRESSE}/robots.txt`, { signal: AbortSignal.timeout(20_000) })
  .then((r) => r.ok)
  .catch(() => false);
if (!sert) {
  console.error(
    `✗ REFUS — rien ne répond sur ${ADRESSE}.\n` +
      '  Construisez puis lancez l’aperçu avant la batterie :\n' +
      '    REVINSP_SANS_PODCAST=1 npx astro build   (avec .env.local, puis effacé)\n' +
      '    npx astro preview stop && npx astro preview --port 4321\n' +
      '  Un aperçu d’un AUTRE répertoire de travail répondrait aussi : vérifiez\n' +
      '  qu’il sert bien le « dist/ » que vous venez de construire.',
  );
  process.exit(1);
}

/* ── Le passage ────────────────────────────────────────────────────────── */

/*
   REPRENDRE UNE BATTERIE INTERROMPUE — 19 octobre.

   Le conteneur a redémarré au 151ᵉ essai sur 235, après deux heures et
   demie. Tout refaire aurait coûté deux heures et demie de plus pour
   remesurer la même construction, et la règle « batterie complète avant
   chaque poussée » serait devenue impraticable au premier incident.

   `BATTERIE_JOURNAL` désigne un journal existant : les essais qui y ont
   déjà un verdict sont REPRIS tels quels, et seuls les autres tournent.
   C'est juste à une condition, qui ne se devine pas et qui est donc
   rappelée à l'écran : la construction servie doit être la même. Reprendre
   un journal après un `astro build` mesurerait deux sites à la fois.

   Les verdicts s'écrivent au fur et à mesure, et non à la fin : un journal
   d'une batterie tuée en route doit rester exploitable, sinon il ne sert à
   rien le jour où il sert.
*/
const journal = process.env.BATTERIE_JOURNAL ?? mkdtempSync(join(tmpdir(), 'batterie-'));
if (!existsSync(journal)) mkdirSync(journal, { recursive: true });
const cheminDesVerdicts = join(journal, 'verdicts.json');

let verdicts = {};
if (existsSync(cheminDesVerdicts)) {
  try {
    verdicts = JSON.parse(lireFichier(cheminDesVerdicts, 'utf8'));
  } catch {
    /* Journal illisible : on remesure tout plutôt que de deviner. */
    verdicts = {};
  }
}

/*
   Les journaux de la batterie tuée au redémarrage n'ont pas de verdict
   écrit — le fichier n'existait pas encore. On les relit, et on les juge
   sur ce que le journal porte : la croix rouge, ou une signature de panne.
   Le code de sortie, lui, est perdu : c'est dit, essai par essai, dans le
   récapitulatif, parce qu'un juge amputé qui se présente comme entier est
   pire qu'un essai relancé.
*/
const PANNE = /\n(?:node:internal|.*Error: |npm error )/;
const reprisSansCode = [];
for (const nom of noms) {
  if (verdicts[nom]) continue;
  const fichier = join(journal, `${nom.replace(/[:/]/g, '-')}.log`);
  if (!existsSync(fichier)) continue;
  const texte = lireFichier(fichier, 'utf8');
  const croix = /\u001b\[31m✗/.test(texte);
  const panne = PANNE.test(texte);
  verdicts[nom] = { code: null, croix: croix || panne, repris: true };
  reprisSansCode.push(nom);
}

console.log(`\nBATTERIE COMPLÈTE — ${noms.length} essais, aperçu sur ${ADRESSE}`);
console.log(`Journaux : ${journal}`);
const dejaJuges = noms.filter((n) => verdicts[n]).length;
if (dejaJuges > 0) {
  console.log(
    `Repris du journal : ${dejaJuges} essais (dont ${reprisSansCode.length} jugés sur leur ` +
      'journal seul, code de sortie perdu).\n' +
      '  Valable À LA SEULE CONDITION que la construction servie soit la même.',
  );
}
console.log('');

const rouges = [];
let verts = 0;
const debut = Date.now();

for (const [index, nom] of noms.entries()) {
  const compteur = `${String(index + 1).padStart(3, ' ')}/${noms.length}`;

  /* Déjà jugé : on reprend le verdict, on ne relance pas. */
  const connu = verdicts[nom];
  if (connu) {
    if (connu.croix || (connu.code !== null && connu.code !== 0)) {
      rouges.push(nom);
      console.log(`  \x1b[31m✗\x1b[0m ${compteur} ${nom} (repris du journal)`);
    } else {
      verts += 1;
      console.log(`  \x1b[32m✓\x1b[0m ${compteur} ${nom} (repris)`);
    }
    continue;
  }
  let sortie = '';
  let code = 0;
  const depart = Date.now();
  try {
    sortie = execFileSync('npm', ['run', '--silent', nom], {
      encoding: 'utf8',
      timeout: DELAI_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
  } catch (erreur) {
    code = erreur.status ?? (erreur.signal ? 124 : 1);
    sortie = `${erreur.stdout ?? ''}${erreur.stderr ?? ''}`;
    if (erreur.signal) sortie += `\n[batterie] interrompu après ${DELAI_MS} ms (${erreur.signal})`;
  }
  writeFileSync(join(journal, `${nom.replace(/[:/]/g, '-')}.log`), sortie);
  verdicts[nom] = { code, croix: /\u001b\[31m✗/.test(sortie) };
  writeFileSync(cheminDesVerdicts, JSON.stringify(verdicts, null, 1));

  /*
     Deux juges, et non un seul : le code de sortie, et la présence d'une
     croix ROUGE. Certains essais rendent 0 en affichant des croix — c'est un
     défaut de ces essais, consigné ailleurs, mais la batterie ne doit pas
     s'en rendre complice en les comptant verts.

     Pourquoi la couleur compte. « essais:retours » affiche, dans un libellé
     VERT, « et ✗ pour une réponse fausse » : il décrit le signe, il ne
     l'émet pas. Chercher la croix nue le déclarait donc rouge alors qu'il
     finit sur « 0 échec(s) » et rend 0 — un rouge fabriqué par l'instrument,
     du même genre que les deux essais fantômes du 19 octobre. Les lignes
     d'échec, elles, écrivent toutes la croix en rouge.
  */
  const croix = /\u001b\[31m✗/.test(sortie);
  const secondes = ((Date.now() - depart) / 1000).toFixed(0);
  if (code === 0 && !croix) {
    verts += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${compteur} ${nom} (${secondes} s)`);
  } else {
    rouges.push(nom);
    console.log(`  \x1b[31m✗\x1b[0m ${compteur} ${nom} (code ${code}, ${secondes} s)`);
    for (const ligne of sortie.split('\n').filter((l) => /\u001b\[31m✗/.test(l)).slice(0, 3)) {
      console.log(`        ${ligne.trim().slice(0, 160)}`);
    }
  }
}

const minutes = ((Date.now() - debut) / 60_000).toFixed(0);
console.log(`\nbatterie complète : ${verts} verts ; ${rouges.length} rouges (${minutes} min)`);
if (rouges.length > 0) {
  console.log(`rouges : ${rouges.join(' ')}`);
  console.log(
    'À comparer au tableau des anomalies avant toute poussée : un rouge qui n’y\n' +
      'figure pas est un rouge NOUVEAU, et il se corrige avant de pousser.',
  );
}
console.log(`Journaux conservés : ${journal}\n`);
/* Le code de sortie ne juge pas : la batterie rapporte, l'humain tranche. */
process.exit(0);
