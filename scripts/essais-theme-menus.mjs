/**
 * Le thème de Cyclades sur tous les menus.
 *
 *   npm run essais:theme-menus
 *
 * ## Ce qu'il garde
 *
 * Demande d'Alexis : « L'ensemble des menus doivent avoir le thème de
 * Cyclades. » Les menus et la navigation prennent donc les jetons de
 * `tokens.css` et les polices de `polices.css`, en clair comme en sombre —
 * barre du bas, en-tête, feuille « Plus », onglets internes, panneaux
 * déroulants, centre de notifications, cadenas du coffre, sélecteur de
 * parcours. Aucune couleur, aucun rayon, aucune police hors jetons.
 *
 * ## Ce qu'il mesure, et ce qu'il ne mesure pas
 *
 * Il relève le **style calculé** des éléments de navigation et le compare
 * aux valeurs déclarées dans `tokens.css`. C'est donc le rendu qu'il juge,
 * pas le texte du code : une couleur hors palette est prise, où qu'elle
 * vienne.
 *
 * CE QU'IL LAISSE PASSER, et il vaut mieux l'écrire que de le découvrir :
 * une utilitaire Tailwind dont la valeur **coïncide** avec un jeton passe
 * pour conforme. Elle l'est à l'œil — c'est la bonne couleur — mais elle
 * n'est pas reliée au jeton, et un changement de palette la laisserait en
 * arrière. Ce contrôle garde l'apparence ; il ne garde pas la filiation.
 * Le dire est la seule façon de ne pas le croire plus fort qu'il n'est.
 *
 * ## Les deux thèmes
 *
 * Mesurés tous les deux, par `data-theme`. Un menu juste en clair et faux
 * en sombre est le défaut le plus courant, parce qu'on ne regarde qu'un
 * thème en travaillant.
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/** Les sélecteurs de ce qui est « un menu ou de la navigation ». */
const MENUS = [
  '#barre-du-bas',
  '#barre-du-bas a',
  '#entete-principal',
  '#feuille-plus',
  '#feuille-plus a',
  '.groupe-onglets > summary',
  '.groupe-onglets ul',
  '#cadenas-coffre-bouton',
  '#cadenas-coffre-menu',
  '#cadenas-coffre-menu button',
];

/**
 * Les exceptions, chacune avec sa raison. Vide si possible, et elle l'est.
 */
const EXCEPTIONS = [];

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};

/* ── La palette : les NOMS des jetons, résolus par le navigateur ──── */

/*
   PREMIÈRE VERSION, FAUSSE, ET LA LEÇON. Elle lisait les « #rrggbb » de
   `tokens.css` et les convertissait en « rgb(r, g, b) » pour comparer. Or
   Chromium rend les couleurs en `oklch()` depuis que Tailwind les y écrit :
   aucune comparaison ne tombait juste, et le contrôle accusait les neuf
   éléments de navigation, à toutes les tailles. Un contrôle qui accuse tout
   n'accuse rien.

   On ne convertit donc plus : on donne au navigateur le **nom** de chaque
   jeton, il le résout lui-même, et les deux côtés parlent la même langue.
*/
const tokens = readFileSync(resolve(ICI, '..', 'src', 'styles', 'tokens.css'), 'utf8');

/*
   DEUXIÈME LEÇON, ET ELLE EST PIRE QUE LA PREMIÈRE. Jusqu'au 18 octobre,
   les couleurs étaient écrites dans `tokens.css` et c'est là que ce
   contrôle allait les chercher. Depuis `ae1291b`, elles sont **engendrées**
   dans `src/styles/theme-defaut.css` par `npm run themes`, et `tokens.css`
   ne garde que la typographie et les rayons. Le contrôle a continué de lire
   `tokens.css` — et y a trouvé **zéro** jeton de couleur. Une palette vide
   ne contient aucune des couleurs mesurées : il a donc accusé les dix
   surfaces de navigation, aux trois tailles, dans les deux thèmes.

   Le symptôme était « le site est faux partout ». La cause était « l'essai
   ne sait plus où regarder ». C'est exactement le défaut que la première
   leçon décrivait, et il est revenu par l'autre bout : un contrôle qui
   accuse tout n'accuse rien. La ligne « palette : N jetons de couleur »
   imprimée plus bas existe pour cela — **si N vaut zéro, ce n'est pas le
   site qui est en cause.**

   On lit donc les noms là où ils vivent maintenant. `theme-defaut.css`
   porte Égée dans ses deux modes, et Égée est le thème que cet essai
   mesure : les treize autres sont chargés à la demande par `data-palette`,
   qu'on ne pose pas ici.
*/
const themeDefaut = readFileSync(
  resolve(ICI, '..', 'src', 'styles', 'theme-defaut.css'),
  'utf8',
);

const nomsJetons = [
  ...new Set(
    [...tokens.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm), ...themeDefaut.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map(
      (m) => m[1],
    ),
  ),
];
const nomsCouleurs = nomsJetons.filter((n) => !/radius|font|duree|courbe|espace/.test(n));
if (nomsCouleurs.length === 0) {
  console.log(
    "\x1b[31m✗\x1b[0m PANNE — aucun jeton de couleur trouvé : les couleurs ont encore " +
      'déménagé, et cet essai mesurerait contre une palette vide. Il refuse de rendre ' +
      'un verdict plutôt que d’accuser tout le site.',
  );
  process.exit(1);
}
const rayonsJetons = new Set(['0px', '9999px']);
for (const m of tokens.matchAll(/--radius-[a-z0-9]+:\s*([0-9.]+)rem/g)) {
  rayonsJetons.add(`${Number.parseFloat(m[1]) * 16}px`);
}
const policesJetons = [];
for (const m of tokens.matchAll(/--font-[a-z]+:\s*([^;]+);/g)) {
  policesJetons.push(m[1].split(',')[0].trim().replace(/['"]/g, ''));
}

console.log(
  `  palette : ${nomsCouleurs.length} jetons de couleur, ${rayonsJetons.size} rayons, ` +
    `polices ${policesJetons.join(' / ')}`,
);

/* ── La mesure ─────────────────────────────────────────────────────── */

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

for (const { nom, width, height } of [
  { nom: '360×740', width: 360, height: 740 },
  { nom: '390×844', width: 390, height: 844 },
  { nom: '1280×800', width: 1280, height: 800 },
]) {
  const contexte = await nav.newContext({
    viewport: { width, height },
    hasTouch: width < 1024,
    isMobile: width < 1024,
  });
  const page = await contexte.newPage();
  await franchirInitialisation(page, RACINE, MDP);

  // Coffre ouvert : sans cela le cadenas n'existe pas, et on mesurerait
  // une navigation amputée de deux de ses menus.
  await page.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
  if (await page.locator('#mdp-coffre').isVisible().catch(() => false)) {
    await page.fill('#mdp-coffre', MDP);
    await page.click('#ouvrir-coffre');
  }
  await page.waitForSelector('#temoin-coffre', { timeout: 40000 }).catch(() => {});

  for (const theme of ['clair', 'sombre']) {
    await page.goto(`${RACINE}/odyssee/`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForTimeout(400);

    const horsPalette = await page.evaluate(
      ([selecteurs, noms, rayons, polices]) => {
        /* La palette résolue PAR LE NAVIGATEUR, dans le thème courant : la
           même fonction qui peint les menus donne les valeurs admises. */
        const sonde = document.createElement('span');
        sonde.style.display = 'none';
        document.body.appendChild(sonde);
        const couleurs = ['rgba(0, 0, 0, 0)'];
        for (const n of noms) {
          sonde.style.color = `var(${n})`;
          const resolue = getComputedStyle(sonde).color;
          if (resolue) couleurs.push(resolue);
        }
        sonde.remove();

        /*
           LA TRANSPARENCE N'EST PAS UNE COULEUR HORS PALETTE. La barre du
           bas et l'en-tête se posent en « bg-white/95 » : la teinte vient
           bien du thème, seule l'opacité change, pour que le contenu se
           devine dessous au défilement. Comparer avec l'alpha accusait ces
           deux surfaces — à tort, puisque c'est la bonne couleur.

           On compare donc la teinte seule. Une couleur étrangère au thème
           échoue toujours ; une couleur du thème à 90 % passe.
        */
        /*
           COMPARER DES CHAÎNES NE MARCHE PAS. Le navigateur rend tantôt
           « oklch(...) », tantôt « oklab(... / 0.95) », tantôt « rgb(...) »,
           selon d'où vient la couleur. Deux notations de la même teinte ne
           se ressemblent pas, et la comparaison textuelle accusait des
           surfaces parfaitement conformes.

           Le seul juge qui ne se trompe pas est le pixel : on peint chaque
           couleur sur une toile de 1 × 1 et on lit les trois octets. L'alpha
           est écarté — la barre du bas se pose en « bg-white/95 », et c'est
           la bonne teinte à 95 %, pas une couleur étrangère.
        */
        const toile = document.createElement('canvas');
        toile.width = 1;
        toile.height = 1;
        const pinceau = toile.getContext('2d', { willReadFrequently: true });

        /*
           ON PEINT DEUX FOIS, SUR BLANC PUIS SUR NOIR. Peindre une seule
           fois ne suffisait pas : « bg-white/95 » et « bg-white/90 » sortent
           deux octets différents, et aucun des deux n'égale le jeton opaque.
           L'alpha change vraiment le pixel — « ignorer la transparence » ne
           peut donc pas se faire en peignant.

           Deux fonds connus donnent deux équations. Sur noir, on lit c×a ;
           sur blanc, c×a + 255×(1−a). Leur écart donne l'alpha, et l'alpha
           rend la teinte. On compare alors des teintes, quelle que soit
           l'opacité — ce qui est précisément la question posée : la couleur
           vient-elle du thème ?
        */
        const surFond = (valeur, fond) => {
          pinceau.globalCompositeOperation = 'source-over';
          pinceau.clearRect(0, 0, 1, 1);
          pinceau.fillStyle = fond;
          pinceau.fillRect(0, 0, 1, 1);
          pinceau.fillStyle = valeur;
          pinceau.fillRect(0, 0, 1, 1);
          return [...pinceau.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const teinte = (valeur) => {
          if (!valeur) return 'inconnue';
          const noir = surFond(valeur, '#000000');
          const blanc = surFond(valeur, '#ffffff');
          // (1 − a) × 255, moyenné sur les trois canaux pour amortir l'arrondi.
          const ecart = (blanc[0] - noir[0] + (blanc[1] - noir[1]) + (blanc[2] - noir[2])) / 3;
          const a = 1 - ecart / 255;
          if (a < 0.02) return 'transparent';
          return noir.map((v) => Math.round(v / a)).join(',');
        };
        /*
           DEUX POINTS DE TOLÉRANCE PAR CANAL, et c'est de l'arithmétique,
           pas de l'indulgence. Reconstruire une teinte depuis un pixel
           composé à 90 % passe par deux arrondis à l'octet : slate-900,
           qui vaut 15, 23, 42, revient en 16, 23, 42. Exiger l'égalité
           stricte ferait échouer une couleur parfaitement juste.

           Deux points ne laissent passer aucune couleur étrangère : les
           jetons voisins de la palette sont séparés de bien davantage.
        */
        const palette = couleurs.map(teinte).filter((t) => t !== 'inconnue');
        const dansLaPalette = (v) => {
          const t = teinte(v);
          if (t === 'transparent' || t === 'inconnue') return true;
          const [r, g, b] = t.split(',').map(Number);
          return palette.some((p) => {
            if (p === 'transparent') return false;
            const [pr, pg, pb] = p.split(',').map(Number);
            return Math.abs(pr - r) <= 2 && Math.abs(pg - g) <= 2 && Math.abs(pb - b) <= 2;
          });
        };

        const fautes = [];
        const vus = new Set();
        for (const s of selecteurs) {
          for (const el of document.querySelectorAll(s)) {
            if (el.getClientRects().length === 0) continue;
            const c = getComputedStyle(el);
            const nom = `${s}`;
            const ajouter = (quoi, valeur) => {
              const cle = `${nom}|${quoi}|${valeur}`;
              if (vus.has(cle)) return;
              vus.add(cle);
              fautes.push(`${nom} ${quoi} ${valeur}`);
            };
            if (!dansLaPalette(c.color)) ajouter('couleur', c.color);
            if (!dansLaPalette(c.backgroundColor)) ajouter('fond', c.backgroundColor);
            if (!rayons.includes(c.borderTopLeftRadius)) {
              ajouter('rayon', c.borderTopLeftRadius);
            }
            const premiere = c.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
            if (!polices.includes(premiere)) ajouter('police', premiere);
          }
        }
        return fautes;
      },
      [MENUS, nomsCouleurs, [...rayonsJetons], policesJetons],
    );

    const retenues = horsPalette.filter((f) => !EXCEPTIONS.some((e) => f.startsWith(e)));
    verifier(`${nom} · thème ${theme} — aucun menu hors palette`, retenues, []);
  }

  await contexte.close();
}

await nav.close();
process.exit(rouges === 0 ? 0 : 1);
