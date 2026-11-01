/**
 * RELEVER LES TEMPORISATIONS À L'AVEUGLE, ET CELLES QUI COMPTENT.
 *
 * ## À quoi sert ce relevé
 *
 * `docs/cyclades/cadence-des-essais.md` § 4 tient le chantier qui remplace les
 * `waitForTimeout` des essais par des post-conditions. Ce script en donne
 * l'assiette : combien il en reste, et dans quels essais.
 *
 * Seules comptent les temporisations qui ont une **lecture derrière** — un
 * `isVisible`, un `textContent`, un `count()`, un `evaluate`, une assertion.
 * Une temporisation suivie de rien ne ment pas sur l'écran : elle ne fait que
 * ralentir la batterie, et elle se retire sans précaution.
 *
 * ## Ce que le chiffre vaut
 *
 * C'est une ESTIMATION, et la fenêtre de douze lignes en est la raison.
 * L'élargir ramasse des lectures qui appartiennent au geste suivant ; la
 * rétrécir manque celles qu'un bloc `waitForFunction` sépare de leur
 * temporisation. Deux relevés qui ne disent pas leur fenêtre ne sont donc pas
 * comparables — ce qui m'est arrivé entre deux annonces au Pilote, et c'est la
 * raison d'être de ce fichier : le chiffre à retenir est celui qui a un script
 * derrière lui.
 *
 * ## La faute que ce motif a déjà commise
 *
 * Sa première version omettait **`evaluate(`**, qui est la façon la plus
 * courante de lire l'écran dans ces essais, et elle sous-comptait d'un quart.
 * Un motif de mesure se vérifie sur un fichier DÉJÀ traité, où le reste doit
 * être zéro.
 *
 * ## L'usage
 *
 *     node scripts/relever-temporisations.mjs
 *     node scripts/relever-temporisations.mjs --fenetre 20
 *     node scripts/relever-temporisations.mjs --amortissements
 *     node scripts/relever-temporisations.mjs --bornes
 *     node scripts/relever-temporisations.mjs --bornes --dans <dossier>
 *     node scripts/relever-temporisations.mjs --pour 'coffre|sauvegarde'
 *
 * Le dernier relève les délais que le SITE s'impose, c'est-à-dire ce qui peut
 * légitimer une attente à l'aveugle dans un essai. Une sur vingt-six au
 * pilote ; les relever avant un lot évite de « réparer » ce qui n'est pas
 * cassé.
 *
 * ## Les deux formes d'un délai, et pourquoi la seconde se manque
 *
 * **Un minuteur** — `setTimeout` — diffère une action. Il se cherche par son
 * nom, et c'est la forme à laquelle on pense.
 *
 * `--pour <motif>` rend la LISTE, fichier par fichier et ligne par ligne, des
 * sites dont le nom d'essai correspond au motif. C'est de quoi confier un
 * périmètre à quelqu'un d'autre sans lui faire refaire le relevé, et chaque
 * ligne porte la durée pariée et la lecture qui suit — de quoi décider du
 * remède avant d'ouvrir le fichier.
 *
 * `--bornes` cherche une autre faute, trouvée le 26 octobre : le second
 * argument de `waitForFunction` est la VALEUR passée à la fonction, et les
 * options sont au troisième. Une borne écrite au second est donc ignorée, et
 * la borne réelle est celle par défaut. Seize appels en portaient une. Une
 * borne qu'on croit avoir fixée est pire qu'une borne absente, et les deux
 * formes se ressemblent assez pour que rien ne se voie.
 *
 * Ce balayage-là est AU SOCLE, par `npm run essais:bornes` — qui lance
 * `scripts/essais-bornes.mjs`, lequel éprouve la reconnaissance elle-même
 * avant de balayer le dépôt. Il REFUSE — code 2 — s'il ne lit aucun appel du
 * tout : un dossier renommé rendrait sinon le vert d'une mesure qui n'a rien
 * mesuré. `--dans <dossier>` sert à le braquer ailleurs, ce dont son essai se
 * sert pour éprouver ses trois codes de sortie. La reconnaissance vit dans
 * `scripts/lib/bornes-de-waitforfunction.mjs`, pour que l'essai puisse
 * l'appeler sans lancer cette ligne de commande.
 *
 * **Ce que ce balayage ne voyait pas, et que son essai a trouvé** : la forme
 * sur plusieurs lignes. La virgule que le formateur pose après le dernier
 * argument rendait un troisième argument vide, l'appel n'en avait donc plus
 * deux, et la faute passait. Trente-quatre bornes étaient au mauvais rang
 * dans huit essais, derrière un « 0 borne » qui se lisait comme un verdict.
 * Les seize du 26 octobre n'étaient que la forme sur une ligne.
 *
 * **Un repos comparé à l'horloge** n'a aucun minuteur : le site garde l'instant
 * du dernier geste et refuse le suivant s'il arrive trop tôt. `src/lib/geste.ts`
 * fait cela — `performance.now() - derniere < repos`, 600 ms par défaut, pour
 * tous les gestes qui passent par `unSeulGeste`. **C'est exactement le cas qui a
 * légitimé la seule temporisation gardée du pilote, et un relevé des
 * `setTimeout` ne le voit pas.** Ma première version de ce fichier annonçait le
 * contraire ; elle se trompait sur son propre exemple.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { bornesAuMauvaisRang } from './lib/bornes-de-waitforfunction.mjs';

const LECTURE =
  /isVisible|textContent|innerText|innerHTML|getAttribute|\$\$eval|\$eval|\.count\(\)|evaluate\(|verifier\(|verifierPresque\(|inputValue|checkVisibility/;

const args = process.argv.slice(2);
const iFenetre = args.indexOf('--fenetre');
const FENETRE = iFenetre === -1 ? 12 : Number(args[iFenetre + 1]);
const AMORTISSEMENTS = args.includes('--amortissements');
const BORNES = args.includes('--bornes');
const iDans = args.indexOf('--dans');
const DANS = iDans === -1 ? 'scripts' : args[iDans + 1];
const iPour = args.indexOf('--pour');
const POUR = iPour === -1 ? null : args[iPour + 1];

if (!Number.isInteger(FENETRE) || FENETRE < 1) {
  console.error('La fenêtre se donne en lignes, par un entier positif.');
  process.exit(2);
}

/* ── Les essais ───────────────────────────────────────────────────────── */

const essais = readdirSync('scripts')
  .filter((f) => /^essais-.*\.(mjs|mts)$/.test(f))
  .sort();

let total = 0;
let avecLecture = 0;
const parFichier = new Map();
const sites = [];

for (const f of essais) {
  const lignes = readFileSync(`scripts/${f}`, 'utf8').split('\n');
  lignes.forEach((l, i) => {
    if (!/waitForTimeout\(/.test(l)) return;
    total += 1;
    const fenetre = lignes.slice(i + 1, i + 1 + FENETRE).join('\n');
    if (!LECTURE.test(fenetre)) return;
    avecLecture += 1;
    parFichier.set(f, (parFichier.get(f) ?? 0) + 1);
    sites.push({ fichier: f, ligne: i + 1, code: l.trim().slice(0, 72) });
  });
}

/* ── Les amortissements du site, qui légitiment une attente ───────────── */

/** Les fichiers d'écran et de bibliothèque, à plat. */
function sourcesDuSite(racine) {
  const sortie = [];
  const pile = [racine];
  while (pile.length) {
    const d = pile.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const c = `${d}/${e.name}`;
      if (e.isDirectory()) pile.push(c);
      else if (/\.(ts|svelte|astro)$/.test(e.name)) sortie.push(c);
    }
  }
  return sortie.sort();
}

/**
 * Les délais que le site s'impose, par forme.
 *
 * Rendu brut, à lire : la décision reste humaine. Ce qu'on cherche est un délai
 * dont l'essai doit attendre l'échéance parce que ce qu'il vérifie est qu'il ne
 * se passe RIEN — et cela ne se remplace pas par une marque à l'écran sans
 * annoncer ce que le site rend invisible.
 */
function amortissements(racine) {
  /* Un repos comparé à l'horloge : aucun minuteur, donc invisible à l'autre
     relevé. C'est la forme qui compte le plus, et la plus rare. */
  const REPOS = /(?:Date|performance)\.now\(\)\s*-\s*[\w.?[\]]+\s*[<>]/;
  /* Un minuteur, hors annulation. */
  const MINUTEUR = /setTimeout\(/;
  /* Et les constantes en millisecondes, qui servent d'index : un délai nommé
     est presque toujours un délai qui compte pour quelqu'un. */
  const CONSTANTE = /^\s*(?:export\s+)?const\s+([A-Z][A-Z_]*_MS|[A-Z][A-Z_]*MS)\s*=\s*([\d_]+)/;

  const repos = [];
  const minuteurs = [];
  const constantes = [];
  for (const c of sourcesDuSite(racine)) {
    readFileSync(c, 'utf8')
      .split('\n')
      .forEach((l, i) => {
        const site = { fichier: c, ligne: i + 1, code: l.trim().slice(0, 86) };
        if (REPOS.test(l)) repos.push(site);
        if (MINUTEUR.test(l) && !/clearTimeout/.test(l)) minuteurs.push(site);
        const m = l.match(CONSTANTE);
        /* Un jour en millisecondes est une unité de calendrier, pas un repos. */
        if (m && Number(m[2].replace(/_/g, '')) < 600_000) constantes.push(site);
      });
  }
  return { repos, minuteurs, constantes };
}


/* ── Le rendu ─────────────────────────────────────────────────────────── */

if (POUR) {
  /*
     LA LISTE D'UN PÉRIMÈTRE, pour la confier. On rend la ligne du site, la
     durée pariée, et la première lecture qui suit dans la fenêtre : c'est ce
     qui dit le remède — une lecture d'écran, une lecture de base, ou la
     cadence d'un geste.
  */
  const motif = new RegExp(POUR);
  let combien = 0;
  const concernes = essais.filter((f) => motif.test(f));
  console.log(`\nSites dont le nom d'essai correspond à « ${POUR} », fenêtre de ${FENETRE} lignes.\n`);
  for (const f of concernes) {
    const lignes = readFileSync(`scripts/${f}`, 'utf8').split('\n');
    const siens = [];
    lignes.forEach((l, i) => {
      if (!/waitForTimeout\(/.test(l)) return;
      const fenetre = lignes.slice(i + 1, i + 1 + FENETRE);
      const lue = fenetre.find((x) => LECTURE.test(x));
      if (!lue) return;
      siens.push({
        ligne: i + 1,
        duree: (l.match(/waitForTimeout\(([^)]*)\)/) ?? [, '?'])[1],
        lecture: lue.trim().slice(0, 66),
      });
    });
    if (siens.length === 0) continue;
    combien += siens.length;
    console.log(`  scripts/${f} — ${siens.length} site(s)`);
    for (const s of siens) {
      console.log(`      l. ${String(s.ligne).padStart(4)} · ${String(s.duree).padStart(7)} → ${s.lecture}`);
    }
    console.log('');
  }
  console.log(`  ${combien} site(s) dans ${concernes.length} essai(s) du périmètre.\n`);
} else if (BORNES) {
  const { fautes, appels, fichiers } = bornesAuMauvaisRang(DANS);
  /*
     LE REFUS QUI MANQUAIT. Zéro faute et zéro appel lu se rendaient de la même
     façon : « 0 borne au mauvais rang », et l'enchaînement continuait. Or ce
     passage entre au socle, c'est-à-dire devant un `&&` : un dossier renommé,
     un `--dans` mal orthographié ou une extension oubliée rendraient le vert
     d'un balayage qui n'a rien lu. C'est la leçon du chemin du navigateur —
     ne rien trouver doit lever — et elle vaut aussi pour les balayages de
     source.
  */
  if (appels === 0) {
    console.error(
      `\n✗ REFUS — aucun appel à « waitForFunction » dans « ${DANS} » ` +
        `(${fichiers} fichier(s) lu(s)).\n` +
        '  Ce dépôt en porte plus de deux cents : un balayage qui n’en lit aucun\n' +
        '  ne mesure rien, et son silence ne vaut pas un verdict.\n',
    );
    process.exit(2);
  }
  console.log(
    `\n${fautes.length} borne(s) de « waitForFunction » au mauvais rang ` +
      `(${appels} appels lus dans ${fichiers} fichiers de « ${DANS} »).\n`,
  );
  for (const f of fautes) console.log(`  ${f.fichier}:${f.ligne}  second argument : ${f.code}`);
  console.log('');
  process.exit(fautes.length === 0 ? 0 : 1);
} else if (AMORTISSEMENTS) {
  const { repos, minuteurs, constantes } = amortissements('src');
  const dire = (titre, liste) => {
    console.log(`\n${titre} — ${liste.length}\n`);
    for (const a of liste) console.log(`  ${a.fichier}:${a.ligne}  ${a.code}`);
  };
  dire('REPOS COMPARÉS À L’HORLOGE (aucun minuteur : à lire en premier)', repos);
  /*
     Et la PORTÉE du premier des trois, qui est ce qu'on veut savoir avant un
     lot : sur ces écrans, un geste répété à données identiques en moins de
     600 ms est pris pour un rebond, et l'essai doit laisser passer le repos.
  */
  const gestes = sourcesDuSite('src').filter((c) =>
    /unSeulGeste\(/.test(readFileSync(c, 'utf8')),
  );
  console.log(`\nÉCRANS QUE LE REBOND DE « geste.ts » GOUVERNE — ${gestes.length}\n`);
  for (const c of gestes) console.log(`  ${c}`);
  dire('MINUTEURS', minuteurs);
  dire('DÉLAIS NOMMÉS, comme index', constantes);
  console.log('');
} else {
  console.log(`\nFenêtre de ${FENETRE} lignes.\n`);
  console.log(`  ${total} temporisations dans ${essais.length} essais`);
  console.log(`  ${avecLecture} avec une lecture derrière, dans ${parFichier.size} essais\n`);
  console.log('Les essais les plus chargés :\n');
  for (const [f, n] of [...parFichier].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(3)}  ${f}`);
  }
  console.log('');
}
