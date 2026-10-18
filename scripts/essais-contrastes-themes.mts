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
];

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

  /* 3. La monotonie des échelles. */
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
