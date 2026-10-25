/**
 * Les formules mathématiques À L'ÉCRAN — point e du 60.
 *
 * ## Pourquoi un essai de navigateur, alors que « essais:maths » existe déjà
 *
 * `essais:maths` vérifie ce que le rendu PRODUIT : du MathML, une annotation
 * TeX, et le refus d'une formule fausse. C'est de la mécanique de chaîne, et
 * elle ne dit rien de ce que l'œil reçoit. Trois choses ne se voient qu'ici :
 *
 *   - **la feuille de style arrive-t-elle vraiment ?** Le rendu peut être
 *     parfait et la CSS absente : la formule s'affiche alors en pile de
 *     caractères superposés, et aucun essai de chaîne ne s'en aperçoit ;
 *   - **la couleur suit-elle le thème ?** KaTeX hérite de `currentColor`. Si
 *     une règle figeait la teinte, la formule resterait noire sur fond sombre.
 *     On mesure donc la couleur CALCULÉE dans les deux thèmes, et on exige
 *     qu'elle soit celle du texte voisin — c'est l'héritage qui est contrôlé,
 *     pas une valeur écrite d'avance ;
 *   - **tient-elle dans 390 px ?** Une fraction ou une racine est plus large
 *     qu'il n'y paraît, et un débordement horizontal sur un téléphone casse la
 *     lecture de toute la page, pas seulement de la formule.
 *
 * ## Le laboratoire
 *
 * Comme les autres essais de ce genre : le contenu d'exemple, un mot de passe
 * FACTICE, un aperçu sur un port à part, et tout est effacé derrière. L'essai
 * REFUSE de tourner s'il trouve du contenu réel, un `.env.local` ou des
 * données construites — il ne travaillera pas par-dessus le travail d'autrui.
 */
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOT_DE_PASSE = 'laboratoire-maths-ecran-sans-valeur';
const PORT = 4323;
const ADRESSE = `http://localhost:${PORT}`;
const FICHE = 'droit-public/fascicule-1/fiche-01-hierarchie-des-normes';

/* Deux formules de décor, sans valeur de révision : un décor, pas un cours. */
const EN_LIGNE = '\\frac{a}{b}';
const EN_BLOC = '\\sqrt{x^2 + y^2}';

const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

let rouges = 0;
function verifier(quoi, vrai, detail = '') {
  if (vrai) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    rouges += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
  }
}

const gardes = [
  ['content/', path.join(racine, 'content')],
  ['public/data/', path.join(racine, 'public', 'data')],
  ['.env.local', path.join(racine, '.env.local')],
  ['.temoin-mot-de-passe.local.json', path.join(racine, '.temoin-mot-de-passe.local.json')],
];
const occupes = gardes.filter(([, chemin]) => existsSync(chemin)).map(([nom]) => nom);
if (occupes.length) {
  console.log(
    `\n${rouge('✗ REFUS')} — ${occupes.join(', ')} existe déjà.\n` +
      '  Cet essai bâtit un site de laboratoire avec un mot de passe factice et\n' +
      '  efface tout derrière lui : il ne travaillera pas par-dessus du contenu réel.',
  );
  process.exit(1);
}

/**
 * Pose les deux formules dans le cours de la fiche d'exemple.
 *
 * L'ancre est une phrase du contenu d'exemple. Si elle disparaît, l'essai
 * s'arrête en le DISANT, plutôt que de poser son décor n'importe où et de
 * mesurer ensuite quelque chose qui n'a plus de sens.
 */
function injecterLesFormules() {
  const chemin = path.join(racine, 'content', `${FICHE}.md`);
  const avant = readFileSync(chemin, 'utf8');
  const ancre = '## Cours complet';
  if (!avant.includes(ancre)) {
    throw new Error(
      `l'ancre « ${ancre} » n'a pas été trouvée dans ${FICHE}.md — le contenu ` +
        "d'exemple a changé, et le décor de cet essai doit suivre",
    );
  }
  const decor = `${ancre}

Le rapport de laboratoire vaut \`math:${EN_LIGNE}\` dans cet exemple.

\`\`\`math
${EN_BLOC}
\`\`\`
`;
  writeFileSync(chemin, avant.replace(ancre, decor));
}

const node = (script, env = {}) =>
  execFileSync(process.execPath, [path.join(racine, 'scripts', script)], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

function nettoyer() {
  try {
    execFileSync('npx', ['astro', 'preview', 'stop'], { cwd: racine, stdio: 'ignore' });
  } catch {
    /* aucun aperçu à arrêter */
  }
  for (const [, chemin] of gardes) rmSync(chemin, { recursive: true, force: true });
  rmSync(path.join(racine, 'dist'), { recursive: true, force: true });
}

let nav = null;

try {
  console.log('\nLA CONSTRUCTION DU LABORATOIRE');
  node('init-contenu.mjs');
  injecterLesFormules();
  writeFileSync(path.join(racine, '.env.local'), `SITE_PASSWORD=${MOT_DE_PASSE}\n`);
  node('build-content.mjs');
  execFileSync('npx', ['astro', 'build'], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, REVINSP_SANS_PODCAST: '1' },
  });
  /* Le mot de passe ne survit pas à la construction. */
  rmSync(path.join(racine, '.env.local'), { force: true });
  console.log('  site construit, mot de passe retiré');

  spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: racine,
    detached: true,
    stdio: 'ignore',
  }).unref();

  /* On interroge l'aperçu jusqu'à ce qu'il serve, et l'on dit quand on renonce. */
  let sert = false;
  for (let i = 0; i < 60 && !sert; i += 1) {
    sert = await fetch(`${ADRESSE}/robots.txt`, { signal: AbortSignal.timeout(2000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (!sert) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!sert) throw new Error(`l'aperçu n'a pas répondu sur ${ADRESSE} après 60 s`);
  console.log(`  aperçu debout sur ${ADRESSE}`);

  nav = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });

  /*
     LA MESURE, THÈME PAR THÈME.

     Le même parcours dans les deux thèmes, et la comparaison entre les deux à
     la fin : une couleur juste dans un seul thème ne prouve rien, puisque
     l'héritage pourrait être remplacé par une teinte figée qui se trouve être
     la bonne dans le thème clair.
  */
  const mesures = {};
  for (const theme of ['clair', 'sombre']) {
    console.log(`\n${gras(`LE THÈME ${theme.toUpperCase()}, À 390 PX`)}\n`);
    const contexte = await nav.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: theme === 'sombre' ? 'dark' : 'light',
    });
    const page = await contexte.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

    await page.goto(`${ADRESSE}/fiche?id=${encodeURIComponent(FICHE)}`, { waitUntil: 'networkidle' });
    if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
      await page.fill('#champ-mdp', MOT_DE_PASSE);
      await page.click('#bouton-verrou');
    }
    /*
       On attend la formule ELLE-MÊME, et non un conteneur qui la portera :
       c'est la leçon du 25 octobre, écrite dans « cadence-des-essais.md ».
    */
    await page.waitForFunction(
      () => document.querySelectorAll('.maths math').length >= 2,
      undefined,
      { timeout: 60000 },
    );

    const vu = await page.evaluate(() => {
      const enLigne = document.querySelector('.maths-en-ligne');
      const bloc = document.querySelector('.maths-bloc');
      const paragraphe = enLigne?.closest('p');
      const couleur = (el) => (el ? getComputedStyle(el).color : null);
      /* La largeur rendue contre la largeur offerte : un débordement se voit là. */
      const debordeur = (el) => (el ? el.scrollWidth > el.clientWidth + 1 : false);
      return {
        enLigne: Boolean(enLigne),
        bloc: Boolean(bloc),
        mathml: document.querySelectorAll('.maths math').length,
        annotations: [...document.querySelectorAll('.maths annotation')].map((a) => a.textContent.trim()),
        /* KaTeX cache sa partie visuelle aux lecteurs d'écran : sans cela, la
           formule serait annoncée deux fois, une par le MathML et une par le HTML. */
        cachees: document.querySelectorAll('.maths [aria-hidden="true"]').length,
        couleurFormule: couleur(enLigne?.querySelector('.katex')),
        couleurTexte: couleur(paragraphe),
        fondDuCorps: getComputedStyle(document.body).backgroundColor,
        debordeBloc: debordeur(bloc),
        debordePage: document.documentElement.scrollWidth > window.innerWidth + 1,
        /* La feuille de KaTeX est-elle vraiment arrivée ? Sans elle, « .katex »
           n'a aucune règle et sa police reste celle du corps. */
        policeFormule: enLigne ? getComputedStyle(enLigne.querySelector('.katex')).fontFamily : '',
      };
    });

    verifier(`${theme} · la formule en ligne est à l’écran`, vu.enLigne);
    verifier(`${theme} · la formule en bloc est à l’écran`, vu.bloc);
    verifier(`${theme} · les deux sortent en MathML`, vu.mathml >= 2, `${vu.mathml} trouvé(s)`);
    verifier(
      `${theme} · le LaTeX d’origine est en annotation`,
      vu.annotations.includes(EN_LIGNE) && vu.annotations.includes(EN_BLOC),
      JSON.stringify(vu.annotations).slice(0, 90),
    );
    verifier(`${theme} · la partie visuelle est cachée aux lecteurs d’écran`, vu.cachees >= 2);
    verifier(
      `${theme} · la feuille de KaTeX est arrivée`,
      /KaTeX/i.test(vu.policeFormule),
      `police « ${vu.policeFormule} »`,
    );
    verifier(
      `${theme} · la formule prend la couleur du texte voisin`,
      vu.couleurFormule === vu.couleurTexte,
      `formule ${vu.couleurFormule} · texte ${vu.couleurTexte}`,
    );
    verifier(
      `${theme} · et elle se distingue du fond`,
      vu.couleurFormule !== vu.fondDuCorps,
      `formule ${vu.couleurFormule} · fond ${vu.fondDuCorps}`,
    );
    verifier(`${theme} · le bloc ne déborde pas de sa largeur`, !vu.debordeBloc);
    verifier(`${theme} · et la page ne défile pas latéralement`, !vu.debordePage);

    mesures[theme] = vu;
    await contexte.close();
  }

  console.log(`\n${gras('LES DEUX THÈMES NE SE CONFONDENT PAS')}\n`);
  /*
     Le contrôle qui donne son sens aux deux précédents. Une teinte figée — du
     noir écrit en dur — satisferait « la couleur du texte voisin » dans le
     thème clair et passerait inaperçue. Il faut donc que les deux thèmes
     donnent des valeurs DIFFÉRENTES, sans quoi l'héritage n'est pas prouvé.
  */
  verifier(
    'la couleur de la formule change d’un thème à l’autre',
    mesures.clair.couleurFormule !== mesures.sombre.couleurFormule,
    `clair ${mesures.clair.couleurFormule} · sombre ${mesures.sombre.couleurFormule}`,
  );
  verifier(
    'et le fond aussi, sinon les thèmes ne seraient pas appliqués',
    mesures.clair.fondDuCorps !== mesures.sombre.fondDuCorps,
    `clair ${mesures.clair.fondDuCorps} · sombre ${mesures.sombre.fondDuCorps}`,
  );
} catch (erreur) {
  rouges += 1;
  console.log(`\n${rouge('✗ PANNE')} — ${String(erreur?.message ?? erreur).slice(0, 900)}`);
} finally {
  if (nav) await nav.close().catch(() => {});
  nettoyer();
}

if (rouges > 0) {
  console.log(`\n${rouge(`${rouges} essai(s) en échec.`)}\n`);
  process.exit(1);
}
console.log(`\n${vert('Tous les essais passent.')}\n`);
