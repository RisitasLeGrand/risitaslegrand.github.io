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
 * `--bornes` cherche une autre faute, trouvée le 26 octobre : le second
 * argument de `waitForFunction` est la VALEUR passée à la fonction, et les
 * options sont au troisième. Une borne écrite au second est donc ignorée, et
 * la borne réelle est celle par défaut. Seize appels en portaient une. Une
 * borne qu'on croit avoir fixée est pire qu'une borne absente, et les deux
 * formes se ressemblent assez pour que rien ne se voie.
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

const LECTURE =
  /isVisible|textContent|innerText|innerHTML|getAttribute|\$\$eval|\$eval|\.count\(\)|evaluate\(|verifier\(|verifierPresque\(|inputValue|checkVisibility/;

const args = process.argv.slice(2);
const iFenetre = args.indexOf('--fenetre');
const FENETRE = iFenetre === -1 ? 12 : Number(args[iFenetre + 1]);
const AMORTISSEMENTS = args.includes('--amortissements');
const BORNES = args.includes('--bornes');

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


/* ── Les bornes au mauvais rang ───────────────────────────────────────── */

/**
 * Les arguments de premier niveau d'un appel, à partir de sa parenthèse.
 *
 * Écrit à la main plutôt que par une expression régulière : une fonction
 * fléchée passée en argument contient ses propres parenthèses, ses accolades
 * et parfois des virgules, et aucun motif plat ne les distingue des virgules
 * de l'appel.
 */
function argumentsDePremierNiveau(texte, debut) {
  let profondeur = 0;
  let arg = '';
  const args = [];
  let chaine = null;
  for (let i = debut; i < texte.length; i += 1) {
    const c = texte[i];
    if (chaine) {
      if (c === chaine && texte[i - 1] !== '\\') chaine = null;
      arg += c;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      chaine = c;
      arg += c;
      continue;
    }
    if ('([{'.includes(c)) profondeur += 1;
    if (')]}'.includes(c)) {
      profondeur -= 1;
      if (profondeur === 0) {
        args.push(arg.trim());
        return args;
      }
    }
    if (c === ',' && profondeur === 1) {
      args.push(arg.trim());
      arg = '';
      continue;
    }
    if (!(profondeur === 1 && arg === '' && /\s/.test(c))) arg += c;
  }
  return null;
}

function bornesAuMauvaisRang() {
  const fautes = [];
  for (const f of readdirSync('scripts').sort()) {
    if (!/\.(mjs|mts)$/.test(f)) continue;
    const texte = readFileSync(`scripts/${f}`, 'utf8');
    for (const m of texte.matchAll(/waitForFunction\(/g)) {
      const args = argumentsDePremierNiveau(texte, m.index + 'waitForFunction'.length);
      if (!args || args.length !== 2) continue;
      if (!/^\(?\{[\s\S]*timeout\s*:/.test(args[1])) continue;
      fautes.push({
        fichier: `scripts/${f}`,
        ligne: texte.slice(0, m.index).split('\n').length,
        code: args[1].replace(/\s+/g, ' ').slice(0, 60),
      });
    }
  }
  return fautes;
}

/* ── Le rendu ─────────────────────────────────────────────────────────── */

if (BORNES) {
  const fautes = bornesAuMauvaisRang();
  console.log(`\n${fautes.length} borne(s) de « waitForFunction » au mauvais rang.\n`);
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
