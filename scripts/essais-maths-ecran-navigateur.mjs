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
import { idStable } from './lib/crypto.mjs';
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

  /*
     L'identifiant de la fiche se CALCULE comme le build le calcule, et ne
     s'écrit pas en dur : « idStable » du chemin relatif, extension comprise.
     Le manifeste étant chiffré, on ne peut pas l'y lire ; et un identifiant
     recopié à la main se périmerait au premier déplacement de la fiche sans
     que rien ne le dise. La fiche d'exemple ne déclare pas « id_publie », qui
     primerait sinon.
  */
  const idDeLaFiche = await idStable(`${FICHE}.md`);
  console.log(`  fiche de décor : ${idDeLaFiche}`);

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
    /*
       LE THÈME SE POSE PAR LE RÉGLAGE DE L'APPLICATION, pas par celui du
       système.

       « colorScheme » de Playwright ne règle que « prefers-color-scheme », et
       le site ne le suit pas : il a ses propres thèmes, lus dans
       « localStorage » sous « revinsp.theme », et son défaut est « sombre ».
       Mesuré : les deux passages donnaient le même fond, donc le même thème,
       et le contrôle ne comparait rien. On écrit donc le réglage avant le
       premier chargement.
    */
    const contexte = await nav.newContext({ viewport: { width: 390, height: 844 } });
    await contexte.addInitScript((mode) => {
      try {
        localStorage.setItem('revinsp.theme', mode);
        localStorage.setItem('revinsp.bascule-jour-nuit', 'non');
      } catch {
        /* stockage refusé : le thème restera celui du défaut, et le contrôle
           de différence le dira. */
      }
    }, theme);
    const page = await contexte.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

    await page.goto(`${ADRESSE}/fiche?id=${encodeURIComponent(idDeLaFiche)}`, { waitUntil: 'networkidle' });
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

    /*
       LA FONTE EST-ELLE VRAIMENT CHARGÉE ?

       « font-family: KaTeX_Main » peut être calculé alors que le FICHIER
       manque : le navigateur retombe alors sur une fonte système, et la
       formule s'affiche de travers sans que rien ne le signale. La question
       s'est posée en vrai quand le déploiement a été réduit au woff2 seul — si
       une adresse pendait, ce contrôle-ci serait le seul à le voir.

       « document.fonts.ready » attend la fin des chargements, puis « check »
       dit si la fonte demandée est réellement disponible.
    */
    const fonteChargee = await page.evaluate(async () => {
      await document.fonts.ready;
      const chargees = [...document.fonts].filter((f) => f.family.startsWith('KaTeX') && f.status === 'loaded');
      return {
        disponible: document.fonts.check('16px KaTeX_Main'),
        combien: chargees.length,
        familles: [...new Set(chargees.map((f) => f.family))].slice(0, 6),
      };
    });
    verifier(
      `${theme} · la fonte KaTeX est chargée pour de vrai`,
      fonteChargee.disponible && fonteChargee.combien > 0,
      `check=${fonteChargee.disponible} · ${fonteChargee.combien} face(s) : ${fonteChargee.familles.join(', ')}`,
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
        /*
           LA MESURE PORTE SUR LES BOÎTES DES FORMULES, et non sur la page.

           Une première version exigeait que la PAGE ne défile pas
           latéralement, et elle rougissait — mais pour la faute d'un autre :
           « select#selecteur-parcours » fait 110 px et finit à 471 px sur une
           vue de 390. C'est un défaut réel, signalé au pilote, et étranger aux
           mathématiques. Un essai qui rougit pour le défaut du voisin finit
           par être ignoré, et il n'aurait rien dit du nôtre.

           Ce qui relève du point e, c'est que la boîte d'une formule tienne
           dans la largeur offerte. Qu'elle défile EN DEDANS est voulu : une
           formule hors ligne est large, et « overflow-x: auto » la fait
           défiler seule au lieu d'élargir la page.
        */
        droiteBloc: bloc ? Math.round(bloc.getBoundingClientRect().right) : 0,
        droiteEnLigne: enLigne ? Math.round(enLigne.getBoundingClientRect().right) : 0,
        largeurVue: window.innerWidth,
        /* La boîte peut-elle défiler en dedans, si la formule la dépasse ? */
        defileEnDedans: bloc ? getComputedStyle(bloc).overflowX === 'auto' : false,
        formuleDepasseSaBoite: debordeur(bloc),
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
    verifier(
      `${theme} · la boîte du bloc tient dans les 390 px`,
      vu.droiteBloc <= vu.largeurVue + 1,
      `bord droit ${vu.droiteBloc} pour une vue de ${vu.largeurVue}`,
    );
    verifier(
      `${theme} · la formule en ligne aussi`,
      vu.droiteEnLigne <= vu.largeurVue + 1,
      `bord droit ${vu.droiteEnLigne} pour une vue de ${vu.largeurVue}`,
    );
    verifier(
      `${theme} · et le bloc peut défiler en dedans si la formule le dépasse`,
      vu.defileEnDedans,
      `overflow-x calculé : ${vu.defileEnDedans}`,
    );

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
