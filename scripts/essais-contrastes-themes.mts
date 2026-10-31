/**
 * Les contrastes des quatorze thèmes, dans leurs vingt-cinq modes.
 *
 *   npm run essais:contrastes-themes
 *
 * ## Ce qu'il mesure, et sur quoi
 *
 * Pas la table de l'addendum : **les valeurs que le générateur produit**.
 * Une table recopiée se périme au premier ajustement, et c'est le fichier
 * CSS qui s'affiche, pas le tableau du prompt. Les déclarations sont donc
 * demandées à `declarations()`, la fonction même qu'emploie
 * `npm run themes`.
 *
 * Trois séries :
 *
 * 1. **Les couples du § 4.3** — texte, texte secondaire, action, réussite,
 *    alerte et erreur sur le fond ; texte sur action ; action sur fond
 *    d'action. Seuil 4,5:1.
 * 2. **Les couples que le site écrit vraiment** avec les classes Tailwind :
 *    `text-slate-500` sur `bg-white`, `dark:text-slate-400` sur
 *    `dark:bg-slate-900`, `text-indigo-600` sur `bg-indigo-50`… C'est là que
 *    la dérivation se vérifie : les rôles peuvent être parfaits et l'échelle
 *    dérivée fausse. Seuil 4,5:1 pour du texte, 3:1 pour une bordure.
 * 3. **La monotonie des échelles** : du cran 50 au cran 950, la clarté doit
 *    décroître (en clair) ou croître (en sombre). Une échelle qui repart en
 *    arrière rend `bg-slate-200` plus clair que `bg-slate-100`, et toutes
 *    les nuances du site s'inversent par endroits.
 *
 * ## Ce qu'il ne mesure pas
 *
 * Le rendu réel d'un écran : un texte gris sur une photo, un texte posé sur
 * un dégradé, une opacité appliquée par une classe (`text-slate-500/60`).
 * `essais:contraste-rendu` s'en charge dans le navigateur, et c'est lui qui
 * fait foi pour ce qui est composé à l'écran.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { contraste, oklch } from './lib/couleurs.mjs';
import { declarations } from './construire-themes.mts';
import { THEMES, THEMES_DE_SEANCE, type Mode, type Roles } from '../src/lib/themes.ts';

let rouges = 0;
const verifier = (quoi: string, obtenu: number, seuil: number) => {
  if (obtenu >= seuil) return;
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi} — ${obtenu.toFixed(2)}:1, il en faut ${seuil.toFixed(1)}:1`,
  );
  rouges += 1;
};

/** Les déclarations d'un mode, rangées par nom de variable. */
function jetons(roles: Roles, mode: Mode): Record<string, string> {
  const table: Record<string, string> = {};
  for (const ligne of declarations(roles, mode)) {
    const [nom, valeur] = ligne.replace(';', '').split(': ');
    table[nom.trim()] = valeur.trim();
  }
  return table;
}

/** Les couples que les pages écrivent, en classes Tailwind. */
const COUPLES_CLAIR: [string, string, number, string][] = [
  ['--color-slate-500', '--color-white', 4.5, 'text-slate-500 sur bg-white'],
  ['--color-slate-600', '--color-white', 4.5, 'text-slate-600 sur bg-white'],
  ['--color-slate-900', '--color-white', 4.5, 'text-slate-900 sur bg-white'],
  ['--color-slate-500', '--color-slate-50', 4.5, 'text-slate-500 sur bg-slate-50'],
  ['--color-slate-600', '--color-slate-100', 4.5, 'text-slate-600 sur bg-slate-100'],
  ['--color-indigo-600', '--color-white', 4.5, 'text-indigo-600 sur bg-white'],
  ['--color-indigo-700', '--color-indigo-50', 4.5, 'text-indigo-700 sur bg-indigo-50'],
  ['--color-white', '--color-indigo-600', 4.5, 'text-white sur bg-indigo-600'],
  ['--color-emerald-700', '--color-emerald-50', 4.5, 'text-emerald-700 sur bg-emerald-50'],
  ['--color-amber-900', '--color-amber-50', 4.5, 'text-amber-900 sur bg-amber-50'],
  ['--color-amber-700', '--color-white', 4.5, 'text-amber-700 sur bg-white'],
  ['--color-red-700', '--color-red-50', 4.5, 'text-red-700 sur bg-red-50'],
  ['--color-rose-700', '--color-white', 4.5, 'text-rose-700 sur bg-white'],
  ['--color-sky-900', '--color-sky-50', 4.5, 'text-sky-900 sur bg-sky-50'],
  ['--color-slate-300', '--color-white', 1.2, 'border-slate-300 sur bg-white (décor)'],
  ['--etat-bordure-forte', '--etat-fond', 3, 'bordure de champ sur le fond'],
  ['--etat-bordure-forte', '--etat-fond-eleve', 3, 'bordure de champ sur une carte'],

  /* ──────────────────────────────────────────────────────────────────────
     REPRIS DE « npm run contrastes », QUI EST RETIRÉ.

     Cet outil-là lisait ses teintes dans « [data-theme='clair'] » de
     « tokens.css », où les couleurs ne sont plus depuis qu'elles sont
     engendrées par thème. Dix-neuf de ses vingt-trois combinaisons claires
     rendaient « teinte absente », et son total les comptait comme « sous le
     seuil » — un faux verdict, et personne ne le voyait puisqu'il n'était pas
     dans la batterie.

     Ses combinaisons, elles, étaient justes. Elles sont donc reprises ici
     avant le retrait, et chacune a d'abord été cherchée dans « src/ » : on
     n'ajoute pas une exigence pour une classe que le site n'écrit plus. Les
     seuils sont les siens — 3 pour une pastille, qui est un élément non
     textuel, 1,1 pour une bordure de décor, qui doit seulement se distinguer.

     Elles n'avaient jamais été éprouvées sur les thèmes engendrés : l'ancien
     outil n'en connaissait qu'un, et son thème clair ne mesurait rien.
     ────────────────────────────────────────────────────────────────────── */
  ['--color-slate-800', '--color-slate-50', 4.5, 'text-slate-800 sur bg-slate-50 (texte courant)'],
  ['--color-indigo-600', '--color-slate-50', 4.5, 'text-indigo-600 sur bg-slate-50'],
  ['--color-indigo-700', '--color-white', 4.5, 'text-indigo-700 sur bg-white'],
  ['--color-emerald-700', '--color-white', 4.5, 'domaine « économie » sur une carte'],
  ['--color-cyan-700', '--color-white', 4.5, 'domaine « international » sur une carte'],
  ['--color-emerald-500', '--color-white', 3, 'pastille « économie »'],
  ['--color-amber-500', '--color-white', 3, 'pastille « finances publiques »'],
  ['--color-rose-500', '--color-white', 3, 'pastille « social »'],
  ['--color-indigo-500', '--color-white', 3, 'pastille « juridique »'],
  ['--color-cyan-600', '--color-white', 3, 'pastille « international »'],
  ['--color-red-800', '--color-red-50', 4.5, 'alerte : texte sur fond d’alerte'],
  ['--color-white', '--color-red-600', 4.5, 'bouton d’alerte : texte sur rouge'],
  ['--color-slate-200', '--color-slate-50', 1.1, 'bordure de carte sur le fond (décor)'],
];

const COUPLES_SOMBRE: [string, string, number, string][] = [
  ['--color-slate-400', '--color-slate-900', 4.5, 'dark:text-slate-400 sur dark:bg-slate-900'],
  ['--color-slate-300', '--color-slate-900', 4.5, 'dark:text-slate-300 sur dark:bg-slate-900'],
  ['--color-slate-400', '--color-slate-950', 4.5, 'dark:text-slate-400 sur le fond'],
  ['--color-white', '--color-slate-900', 4.5, 'dark:text-white sur dark:bg-slate-900'],
  ['--color-indigo-400', '--color-slate-900', 4.5, 'dark:text-indigo-400 sur dark:bg-slate-900'],
  ['--color-indigo-300', '--color-indigo-950', 4.5, 'dark:text-indigo-300 sur dark:bg-indigo-950'],
  ['--color-emerald-300', '--color-emerald-950', 4.5, 'dark:text-emerald-300 sur emerald-950'],
  ['--color-amber-300', '--color-amber-950', 4.5, 'dark:text-amber-300 sur amber-950'],
  ['--color-red-300', '--color-red-950', 4.5, 'dark:text-red-300 sur red-950'],
  ['--color-rose-300', '--color-rose-950', 4.5, 'dark:text-rose-300 sur rose-950'],
  ['--color-sky-200', '--color-sky-950', 4.5, 'dark:text-sky-200 sur sky-950'],
  ['--etat-bordure-forte', '--etat-fond', 3, 'bordure de champ sur le fond'],
  ['--etat-bordure-forte', '--etat-fond-eleve', 3, 'bordure de champ sur une carte'],

  /* ──────────────────────────────────────────────────────────────────────
     REPRIS DE « npm run contrastes », QUI EST RETIRÉ.

     Cet outil-là lisait ses teintes dans « [data-theme='clair'] » de
     « tokens.css », où les couleurs ne sont plus depuis qu'elles sont
     engendrées par thème. Dix-neuf de ses vingt-trois combinaisons claires
     rendaient « teinte absente », et son total les comptait comme « sous le
     seuil » — un faux verdict, et personne ne le voyait puisqu'il n'était pas
     dans la batterie.

     Ses combinaisons, elles, étaient justes. Elles sont donc reprises ici
     avant le retrait, et chacune a d'abord été cherchée dans « src/ » : on
     n'ajoute pas une exigence pour une classe que le site n'écrit plus. Les
     seuils sont les siens — 3 pour une pastille, qui est un élément non
     textuel, 1,1 pour une bordure de décor, qui doit seulement se distinguer.

     Elles n'avaient jamais été éprouvées sur les thèmes engendrés : l'ancien
     outil n'en connaissait qu'un, et son thème clair ne mesurait rien.
     ────────────────────────────────────────────────────────────────────── */
  ['--color-slate-200', '--color-slate-950', 4.5, 'dark:text-slate-200 sur le fond (texte courant)'],
  ['--color-indigo-400', '--color-slate-950', 4.5, 'dark:text-indigo-400 sur le fond'],
  ['--color-emerald-300', '--color-slate-900', 4.5, 'domaine « économie » sur une carte'],
  ['--color-amber-300', '--color-slate-900', 4.5, 'domaine « finances publiques » sur une carte'],
  ['--color-rose-300', '--color-slate-900', 4.5, 'domaine « social » sur une carte'],
  ['--color-indigo-300', '--color-slate-900', 4.5, 'domaine « juridique » sur une carte'],
  ['--color-cyan-300', '--color-slate-900', 4.5, 'domaine « international » sur une carte'],
  ['--color-emerald-500', '--color-slate-900', 3, 'pastille « économie »'],
  ['--color-amber-500', '--color-slate-900', 3, 'pastille « finances publiques »'],
  ['--color-rose-500', '--color-slate-900', 3, 'pastille « social »'],
  ['--color-indigo-500', '--color-slate-900', 3, 'pastille « juridique »'],
  /*
     LA PASTILLE « INTERNATIONAL » EST LA SEULE À PORTER UNE VARIANTE SOMBRE,
     ET CE N'EST PAS UNE INCOHÉRENCE : C'EST LA SEULE QUI EN AVAIT BESOIN.

     « bg-cyan-600 » sur une carte sombre rendait 3,00:1 dans le thème
     République — c'est-à-dire 2,995, sous le plancher de 3:1 des éléments non
     textuels, de cinq millièmes. Les quatre autres pastilles passent partout.
     D'où « dark:bg-cyan-500 » dans « actualites.ts », et c'est ce cran-là que
     ce couple éprouve.
  */
  ['--color-cyan-500', '--color-slate-900', 3, 'pastille « international » (variante sombre)'],
  ['--color-red-400', '--color-red-950', 4.5, 'alerte : texte sur fond d’alerte'],
  ['--color-slate-800', '--color-slate-950', 1.1, 'bordure de carte sur le fond (décor)'],
];

/* ══════════════════════════════════════════════════════════════════════════
   Les bulles de « notifier() »
   ══════════════════════════════════════════════════════════════════════════

   POURQUOI ELLES SONT LUES DANS « ui.ts » ET NON RECOPIÉES ICI.

   C'est la doctrine de ce fichier, appliquée à un cas où elle a déjà servi :
   une table recopiée se périme au premier ajustement. Si quelqu'un change
   « bg-emerald-800 » pour autre chose, cet essai doit mesurer LE NOUVEAU
   choix, pas l'ancien.

   On ne peut pas importer « ui.ts » : il appelle « zoneDesNotifications() »
   dès l'import, donc il touche le document, et il n'y en a pas ici. On lit
   donc son texte, ce qui a l'avantage de ne rien exécuter.

   CE QUI EST MESURÉ, ET POURQUOI DEUX FOIS.

   1. Le TEXTE sur le fond de la bulle, seuil 4,5:1. Avant correction, au pire
      cas des quatorze thèmes : « succes » 2,94:1 dans le thème « contraste »,
      « badge » 2,24:1 dans « adaptées ». Les deux thèmes faits pour qui voit
      mal étaient les pires.

   2. Le BORD de la bulle contre le fond de page, seuil 3:1 — celui des
      éléments non textuels. Sans cela, on raterait le défaut le plus grave :
      en mode sombre des thèmes à fort contraste, « --color-slate-800 » et le
      fond valent tous deux #000000, et la bulle d'information était
      INVISIBLE — 1,00:1, c'est-à-dire la même couleur. Un texte parfaitement
      contrasté sur une bulle qu'on ne voit pas reste un défaut.

   ET POURQUOI LE BORD EST COMPOSITÉ. Il est écrit « border-white/50 » : un
   blanc à moitié transparent. Ce que l'œil voit n'est ni le blanc ni le fond
   de la bulle, mais leur mélange — c'est ce mélange qu'il faut mesurer, et le
   calculer est la seule façon de mesurer ce que le navigateur affiche.
*/
const SOURCE_UI = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'ui.ts'),
  'utf8',
);

/** Une classe Tailwind de couleur, rendue en nom de jeton. */
const jetonDe = (classe: string) => `--color-${classe.replace(/^(?:bg|text|border)-/, '')}`;

/** Les trois bulles, lues dans « ui.ts ». */
function bulles(): { variante: string; fond: string; texte: string }[] {
  const trouvees = [...SOURCE_UI.matchAll(/^\s*(info|succes|badge):\s*'(bg-[\w-]+)\s+(text-[\w-]+)',$/gm)];
  return trouvees.map(([, variante, fond, texte]) => ({
    variante,
    fond: jetonDe(fond),
    texte: jetonDe(texte),
  }));
}

/**
 * Le bord de la bulle, tel que le navigateur le composite.
 *
 * Rend `null` s'il n'y a pas de bord à moitié transparent : l'absence est
 * alors dite comme un défaut, et non passée sous silence.
 */
function bordComposite(fond: string): ((valeurDuFond: string) => string) | null {
  const m = /border\s+border-(\w+)\/(\d+)/.exec(SOURCE_UI);
  if (!m) return null;
  const [, couleur, part] = m;
  if (couleur !== 'white') return null;
  const alpha = Number(part) / 100;
  return (valeurDuFond: string) => {
    const [r, v, b] = [1, 3, 5].map((i) => parseInt(valeurDuFond.slice(i, i + 2), 16));
    const melange = (c: number) => Math.round(255 * alpha + c * (1 - alpha));
    return '#' + [melange(r), melange(v), melange(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  };
}

const LES_BULLES = bulles();
const BORD = bordComposite('');

/*
   LES DEUX PRÉMISSES, DITES AVANT TOUT VERDICT.

   Un essai qui lit son objet dans un fichier doit dire quand il ne l'a pas
   trouvé. Sans ces deux lignes, un renommage dans « ui.ts » ferait rendre
   zéro bulle, zéro assertion, et un vert parfaitement silencieux — la pire
   des sorties, parce qu'elle ressemble à une réussite.
*/
if (LES_BULLES.length !== 3) {
  console.log(
    `\x1b[31m✗\x1b[0m les bulles de « ui.ts » ne sont plus lisibles : ${LES_BULLES.length} trouvée(s) au lieu de 3 — rien n’a été mesuré`,
  );
  rouges += 1;
}
if (!BORD) {
  console.log(
    '\x1b[31m✗\x1b[0m les bulles n’ont pas de bord à moitié transparent (« border border-white/NN ») :\n' +
      '      sans lui, une bulle dont le fond vaut la couleur de la page est INVISIBLE, et\n' +
      '      c’est le cas en mode sombre des thèmes à fort contraste, où « slate-800 » et le\n' +
      '      fond valent tous deux #000000.',
  );
  rouges += 1;
}

function eprouver(nom: string, roles: Roles, mode: Mode) {
  const j = jetons(roles, mode);
  const sur = (a: string, b: string) => contraste(j[a], j[b]);

  /* 1. Les couples du § 4.3, sur les rôles eux-mêmes. */
  for (const role of [
    '--etat-texte',
    '--etat-texte-faible',
    '--etat-action',
    '--etat-succes',
    '--etat-alerte',
    '--etat-erreur',
  ])
    verifier(`${nom} ${mode} — ${role} sur le fond`, sur(role, '--etat-fond'), 4.5);
  verifier(
    `${nom} ${mode} — texte sur action`,
    sur('--etat-texte-sur-action', '--etat-action'),
    4.5,
  );
  verifier(
    `${nom} ${mode} — action sur fond d’action`,
    sur('--etat-action', '--etat-action-fond'),
    4.5,
  );

  /* 2. Les couples écrits dans les pages. */
  for (const [a, b, seuil, quoi] of mode === 'clair' ? COUPLES_CLAIR : COUPLES_SOMBRE)
    verifier(`${nom} ${mode} — ${quoi}`, sur(a, b), seuil);

  /* 3. Les bulles de « notifier() », lues dans « ui.ts ». */
  for (const bulle of LES_BULLES) {
    verifier(
      `${nom} ${mode} — bulle « ${bulle.variante} » : son texte sur son fond`,
      sur(bulle.texte, bulle.fond),
      4.5,
    );
    /*
       SE DÉTACHER DE LA PAGE : PAR LE FOND OU PAR LE BORD, ET LE PREMIER
       ÉCRIT LE DISAIT MAL.

       J'ai d'abord éprouvé le bord seul. Vingt-sept rouges, tous en thème
       clair : un blanc à moitié transparent sur une bulle sombre composite en
       gris moyen, et un gris moyen sur une page claire ne fait que 2,6 à
       2,99:1. L'assertion était fausse, pas le site — en thème clair, c'est
       le FOND de la bulle qui la détache, et il le fait de 8 à 13:1.

       L'exigence juste est donc : la bulle se voit, par l'un OU l'autre. Le
       bord sauve le cas noir sur noir, le fond sauve tout le reste, et c'est
       le meilleur des deux qui compte — parce que l'œil, lui, voit le bord le
       plus marqué.
    */
    const parLeFond = contraste(j[bulle.fond], j['--etat-fond']);
    const parLeBord = BORD ? contraste(BORD(j[bulle.fond]), j['--etat-fond']) : 0;
    verifier(
      `${nom} ${mode} — bulle « ${bulle.variante} » se détache de la page ` +
        `(fond ${parLeFond.toFixed(2)}:1, bord ${parLeBord.toFixed(2)}:1)`,
      Math.max(parLeFond, parLeBord),
      3,
    );
  }

  /* 4. La monotonie des échelles. */
  const familles = new Set(
    Object.keys(j)
      .filter((k) => /^--color-[a-z]+-\d+$/.test(k))
      .map((k) => k.split('-')[3]),
  );
  for (const famille of familles) {
    const crans = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    const clartes = crans.map((c) => oklch(j[`--color-${famille}-${c}`]).L);
    for (let i = 1; i < clartes.length; i += 1) {
      if (clartes[i] > clartes[i - 1] + 0.001) {
        console.log(
          `\x1b[31m✗\x1b[0m ${nom} ${mode} — ${famille} : le cran ${crans[i]} est plus clair que le ${crans[i - 1]}`,
        );
        rouges += 1;
      }
    }
  }
}

for (const t of THEMES)
  for (const mode of ['clair', 'sombre'] as Mode[]) if (t[mode]) eprouver(t.nom, t[mode]!, mode);
for (const v of THEMES_DE_SEANCE) eprouver(`Séance ${v.nom}`, v.roles, v.mode);

console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
