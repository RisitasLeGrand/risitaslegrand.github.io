/**
 * Le générateur des quatorze thèmes.
 *
 *   npm run themes            écrit les fichiers
 *   npm run themes -- --voir  les affiche sans rien écrire
 *
 * ## Ce qu'il fait, et pourquoi il existe
 *
 * Le site est écrit avec les classes Tailwind habituelles : 5 420 « slate-* »,
 * 934 « indigo-* », 468 « amber-* »… Réécrire ces classes quatorze fois est
 * hors de question ; heureusement Tailwind 4 ne compile pas une couleur mais
 * une variable (« .bg-slate-50 { background-color: var(--color-slate-50) } »).
 * On redéfinit donc les variables, thème par thème, et pas une page n'a à
 * changer. C'est le mécanisme qui existait déjà pour la palette de l'État ;
 * il est ici généralisé et **calculé** au lieu d'être recopié à la main.
 *
 * ## Comment une échelle est dérivée — la réponse à « dire comment »
 *
 * Tout part des **douze rôles** de `src/lib/themes.ts`. Le calcul se fait en
 * OKLCH, et pas en sRGB : éclaircir « #0B4F8A » en sRGB donne un bleu
 * délavé qui vire au gris, parce que les trois canaux ne portent pas la même
 * part de luminosité perçue.
 *
 * 1. **Les neutres** (slate, gray, zinc, neutral, stone) suivent les rôles de
 *    surface, dans l'ordre où le site les emploie déjà :
 *    - en clair : 50 = fond, 100 = fond alternatif, 200 = bordure,
 *      400 = bordure forte, 500 = texte secondaire, 600 = texte,
 *      900 = texte fort ;
 *    - en sombre, l'échelle est **retournée**, parce que le site écrit
 *      « dark:bg-slate-900 » pour une carte et « dark:text-slate-400 » pour
 *      un texte secondaire : 950 = fond, 900 = fond élevé, 800 = fond
 *      alternatif, 700 = bordure, 600 = bordure forte, 400 = texte
 *      secondaire, 200 = texte, 50 = texte fort.
 *    Les crans intermédiaires sont interpolés entre leurs deux voisins.
 * 2. **Les familles colorées** sont ancrées sur un rôle, au cran où le site
 *    l'emploie : « indigo-600 » en clair et « indigo-400 » en sombre sont la
 *    couleur d'action, parce que c'est ainsi que les pages sont écrites
 *    (« text-indigo-600 dark:text-indigo-400 »). Le reste de l'échelle est
 *    interpolé entre un lavis clair et un fond sombre, à teinte constante.
 * 3. **Les correspondances** : indigo, violet, purple, blue → action ;
 *    emerald, green, teal, lime → réussite ; amber, yellow, orange →
 *    alerte ; red → erreur ; rose, pink, fuchsia → erreur à +12° de teinte,
 *    pour rester distinctes du rouge ; sky, cyan → action à +35°, qui est la
 *    place de l'information (le code le disait déjà : « cyan plutôt qu'un
 *    bleu : deux bleus voisins ne se distingueraient pas »).
 * 4. **« white » et « black »** sont des variables comme les autres.
 *    En clair, `--color-white` est le fond élevé : une carte « bg-white »
 *    devient ivoire dans Papier sans qu'on touche à la page. En sombre, il
 *    reste le texte fort, parce que le site y écrit « dark:text-white » pour
 *    un titre. L'asymétrie est assumée : ce sont deux usages distincts d'une
 *    même classe, et c'est le mode qui tranche.
 *
 * ## Ce que le générateur dérive en plus des douze rôles
 *
 * - **bordure forte** : la bordure poussée jusqu'à 3:1 sur le fond, comme
 *   l'addendum le demande pour les bordures de champ et les icônes. La
 *   valeur dérivée est imprimée par `--voir` : elle n'est pas devinée.
 * - **texte fort**, **action forte**, **ombre**, **barre de défilement** :
 *   dérivés par clarté, à teinte et chroma constants.
 *
 * Rien n'est écrit à la main dans les fichiers produits : les modifier
 * serait perdre le prochain tour de générateur. `essais:themes-a-jour` fait
 * échouer la batterie si le dépôt et le générateur ne disent plus la même
 * chose.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { contraste, depuisOklch, oklch, renforcer } from './lib/couleurs.mjs';
import {
  THEMES,
  THEMES_DE_SEANCE,
  THEME_PAR_DEFAUT,
  type Mode,
  type Roles,
} from '../src/lib/themes.ts';

const CRANS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/**
 * Les familles Tailwind employées par le site, et le rôle qui les ancre.
 *
 * **Seules celles qui servent** y figurent : en couvrir vingt doublerait le
 * poids de chaque fichier pour des échelles que personne n'écrit. Le
 * revers est qu'une famille nouvelle (« bg-green-500 ») prendrait la
 * couleur de Tailwind et ne suivrait aucun thème ; c'est pourquoi
 * `essais:couleurs-jetons` relève les familles employées dans `src/` et
 * échoue si l'une d'elles manque ici.
 */
export const FAMILLES: { noms: string[]; role: keyof Roles | 'neutre'; teinte?: number }[] = [
  { noms: ['slate', 'gray'], role: 'neutre' },
  { noms: ['indigo', 'violet', 'purple'], role: 'action' },
  { noms: ['emerald', 'teal'], role: 'succes' },
  { noms: ['amber'], role: 'alerte' },
  { noms: ['red'], role: 'erreur' },
  { noms: ['rose'], role: 'erreur', teinte: 12 },
  { noms: ['sky', 'cyan'], role: 'action', teinte: 35 },
];

type Lch = { L: number; C: number; H: number };

const clarte = (couleur: string, L: number) => depuisOklch({ ...oklch(couleur), L });
const teinter = (couleur: string, degres: number): Lch => {
  const c = oklch(couleur);
  return { ...c, H: c.H + degres };
};

/** Interpolation linéaire en OKLCH entre deux couleurs. */
function entre(a: Lch, b: Lch, part: number): Lch {
  const dH = ((((b.H - a.H) % 360) + 540) % 360) - 180;
  return { L: a.L + (b.L - a.L) * part, C: a.C + (b.C - a.C) * part, H: a.H + dH * part };
}

/**
 * Une échelle de onze crans, à partir d'ancres posées sur certains crans.
 *
 * La clarté est ensuite **forcée à ne jamais remonter** du cran 50 au cran
 * 950, et ce n'est pas un raffinement : Contraste élevé pose une bordure
 * blanche en sombre et noire en clair, et cette bordure ancre le cran 700
 * (ou 400). Sans contrainte, `bg-slate-700` y sortait plus clair que
 * `bg-slate-600`, et toutes les nuances du site s'inversaient par endroits.
 * Les crans écrasés sont rapportés par `npm run themes` : un thème dont
 * l'intention est contrariée doit se voir, pas se taire. Les rôles
 * eux-mêmes (`--etat-bordure`) gardent la valeur voulue par le thème.
 */
function echelle(ancres: Map<number, Lch>, ecrases?: number[]): Record<number, string> {
  const poses = [...ancres.keys()].sort((x, y) => x - y);
  const bruts: Lch[] = CRANS.map((cran) => {
    const avant = [...poses].reverse().find((p) => p <= cran);
    const apres = poses.find((p) => p >= cran);
    if (avant === undefined) return ancres.get(apres!)!;
    if (apres === undefined) return ancres.get(avant)!;
    if (avant === apres) return ancres.get(cran)!;
    return entre(ancres.get(avant)!, ancres.get(apres)!, (cran - avant) / (apres - avant));
  });
  const sortie: Record<number, string> = {};
  let plafond = Infinity;
  CRANS.forEach((cran, i) => {
    let L = Math.min(bruts[i].L, plafond);
    if (L < bruts[i].L - 0.0005) ecrases?.push(cran);
    let hexa = depuisOklch({ ...bruts[i], L });
    /*
       Le plafond porte sur la clarté RENDUE, pas sur la clarté demandée.
       Contraste élevé sombre l'a montré : son action est un jaune pur, hors
       gamut dès qu'on l'éclaircit. Le cran 200 recevait donc un jaune
       désaturé à 0,9489 de clarté réelle, et le cran 300 le jaune pur à
       0,9507 — l'échelle remontait de deux millièmes, invisible à l'œil mais
       bien réelle. On redescend jusqu'à ce que la mesure, et non la
       consigne, respecte le plafond.
    */
    for (let essai = 0; essai < 12 && oklch(hexa).L > plafond + 0.0001; essai += 1) {
      L -= oklch(hexa).L - plafond + 0.002;
      hexa = depuisOklch({ ...bruts[i], L });
    }
    plafond = Math.min(plafond, oklch(hexa).L);
    sortie[cran] = hexa;
  });
  return sortie;
}

/** Les valeurs dérivées des douze rôles : ce que le thème ne dit pas. */
export function derivees(r: Roles, mode: Mode) {
  const sombre = mode === 'sombre';
  /*
     LA BORDURE FORTE TIENT 3:1 SUR LES DEUX FONDS, et non sur le seul fond du
     corps (E2 du prompt 43).

     Mesuré le 25 octobre sur le thème par défaut : `--etat-bordure-forte`
     donnait 3,01:1 en clair et 3,08:1 en sombre sur `--etat-fond` — conforme,
     et c'est ce que l'essai des thèmes éprouvait — mais **2,72:1 en sombre sur
     `--etat-fond-eleve`**. Or un champ bordé vit aussi sur une carte
     surélevée : onze contrôles des paramètres et de l'entraînement cognitif y
     étaient, et un relevé sur les soixante et une routes les a trouvés.

     Deux renforcements enchaînés, et l'ordre est sans effet dans le cas
     ordinaire : `renforcer` pousse vers le sombre quand le fond est clair et
     vers le clair sinon, donc tant que les deux fonds sont du même côté — ce
     qui est le cas de tous les thèmes livrés —, le second appel continue dans
     la direction du premier et ne peut pas le défaire. Un thème dont le fond
     et le fond élevé se trouveraient de part et d'autre du milieu ferait
     échouer le couple ajouté à `essais:contrastes-themes`, ce qui est
     exactement ce qu'on veut : dit par un rouge, et non deviné ici.

     CONSÉQUENCE À CONNAÎTRE : la barre de défilement se dérive de cette
     valeur, quelques lignes plus bas. Elle s'éclaircit donc d'autant en
     sombre, ce qui va dans le même sens — une barre plus visible.
  */
  const bordureForte = renforcer(renforcer(r.bordure, r.fond, 3), r.fondEleve, 3);
  const texteFort = sombre
    ? clarte(r.texte, oklch(r.texte).L + (1 - oklch(r.texte).L) * 0.85)
    : clarte(r.texte, oklch(r.texte).L * 0.55);
  const actionForte = sombre
    ? clarte(r.action, Math.min(0.98, oklch(r.action).L + (1 - oklch(r.action).L) * 0.3))
    : clarte(r.action, oklch(r.action).L * 0.8);
  const ombre = clarte(r.fond, Math.min(oklch(r.fond).L, 0.12));
  /*
     La barre de défilement se dérive de la bordure forte, en clarté
     seulement. Première version : une interpolation entre la bordure et le
     texte secondaire — mais dans Égée la bordure est chaude (beige) et le
     texte secondaire froid (ardoise), et l'interpolation de teinte prenait
     le chemin court… par le vert. La barre d'Égée clair sortait en #A4ADA5.
     Une dérivation en clarté ne peut pas changer de teinte.
  */
  const defilement = clarte(bordureForte, oklch(bordureForte).L + (1 - oklch(bordureForte).L) * (sombre ? -0.2 : 0.3));
  return { bordureForte, texteFort, actionForte, ombre, defilement };
}

/** Les ancres d'une famille colorée, selon le mode. */
function ancresColorees(base: Lch, mode: Mode, lavis: string | null): Map<number, Lch> {
  const ancres = new Map<number, Lch>();
  if (mode === 'clair') {
    ancres.set(50, lavis ? oklch(lavis) : { L: 0.965, C: base.C * 0.22, H: base.H });
    ancres.set(600, base);
    ancres.set(700, { ...base, L: base.L * 0.82 });
    ancres.set(950, { L: Math.min(base.L, 0.24), C: base.C * 0.75, H: base.H });
  } else {
    ancres.set(50, { L: 0.95, C: base.C * 0.35, H: base.H });
    ancres.set(300, { ...base, L: Math.min(0.97, base.L + (1 - base.L) * 0.22) });
    ancres.set(400, base);
    ancres.set(950, lavis ? oklch(lavis) : { L: 0.23, C: base.C * 0.5, H: base.H });
  }
  return ancres;
}

/** Les ancres des neutres : les rôles de surface, à l'endroit en clair,
    retournés en sombre — c'est ainsi que les pages les emploient. */
function ancresNeutres(r: Roles, mode: Mode): Map<number, Lch> {
  const d = derivees(r, mode);
  const a = new Map<number, Lch>();
  if (mode === 'clair') {
    a.set(50, oklch(r.fond));
    a.set(100, oklch(r.fondAlt));
    a.set(200, oklch(r.bordure));
    a.set(400, oklch(d.bordureForte));
    a.set(500, oklch(r.texteFaible));
    a.set(600, oklch(r.texte));
    a.set(900, oklch(d.texteFort));
    a.set(950, { ...oklch(d.texteFort), L: oklch(d.texteFort).L * 0.7 });
  } else {
    a.set(50, oklch(d.texteFort));
    a.set(200, oklch(r.texte));
    a.set(400, oklch(r.texteFaible));
    a.set(600, oklch(d.bordureForte));
    a.set(700, oklch(r.bordure));
    a.set(800, oklch(r.fondAlt));
    a.set(900, oklch(r.fondEleve));
    a.set(950, oklch(r.fond));
  }
  return a;
}

/** Le bloc de déclarations d'un mode : rôles, familles, blanc et noir. */
export function declarations(r: Roles, mode: Mode, ecrases?: number[]): string[] {
  const d = derivees(r, mode);
  const lignes = [
    `--etat-fond: ${r.fond};`,
    `--etat-fond-eleve: ${r.fondEleve};`,
    `--etat-fond-alt: ${r.fondAlt};`,
    `--etat-bordure: ${r.bordure};`,
    `--etat-bordure-forte: ${d.bordureForte};`,
    `--etat-texte: ${r.texte};`,
    `--etat-texte-fort: ${d.texteFort};`,
    `--etat-texte-faible: ${r.texteFaible};`,
    `--etat-action: ${r.action};`,
    `--etat-action-forte: ${d.actionForte};`,
    `--etat-action-fond: ${r.actionFond};`,
    `--etat-texte-sur-action: ${r.texteSurAction};`,
    `--etat-accent: ${r.erreur};`,
    `--etat-succes: ${r.succes};`,
    `--etat-alerte: ${r.alerte};`,
    `--etat-erreur: ${r.erreur};`,
    `--etat-ombre: ${d.ombre};`,
    `--etat-defilement: ${d.defilement};`,
    `--etat-defilement-survol: ${d.bordureForte};`,
  ];
  for (const famille of FAMILLES) {
    const aplatis: number[] = [];
    const crans =
      famille.role === 'neutre'
        ? echelle(ancresNeutres(r, mode), aplatis)
        : echelle(
            ancresColorees(
              famille.teinte ? teinter(r[famille.role], famille.teinte) : oklch(r[famille.role]),
              mode,
              famille.role === 'action' && !famille.teinte ? r.actionFond : null,
            ),
            aplatis,
          );
    if (aplatis.length && ecrases) ecrases.push(...aplatis);
    for (const nom of famille.noms)
      for (const cran of CRANS) lignes.push(`--color-${nom}-${cran}: ${crans[cran]};`);
  }
  lignes.push(`--color-white: ${mode === 'clair' ? r.fondEleve : d.texteFort};`);
  lignes.push(`--color-black: ${mode === 'clair' ? d.texteFort : r.fond};`);
  return lignes;
}

const bloc = (selecteur: string, lignes: string[]) =>
  `${selecteur} {\n${lignes.map((l) => `  ${l}`).join('\n')}\n}\n`;

const ENTETE = (quoi: string) =>
  `/* ${quoi}\n   Fichier ENGENDRÉ par « npm run themes » — ne pas modifier à la main.\n` +
  `   La source est src/lib/themes.ts (douze rôles par mode) ; la dérivation\n` +
  `   est expliquée en tête de scripts/construire-themes.mts. */\n\n`;

function fichierDeTheme(id: string): string {
  const t = THEMES.find((x) => x.id === id)!;
  const defaut = id === THEME_PAR_DEFAUT;
  let sortie = ENTETE(`Thème « ${t.nom} ».`);
  for (const mode of ['clair', 'sombre'] as Mode[]) {
    const roles = t[mode];
    if (!roles) continue;
    const selecteurs = [`:root[data-palette='${id}'][data-theme='${mode}']`];
    /* Égée est aussi le thème servi quand aucune palette n'est posée : avant
       que le script d'amorçage ne s'exécute, et si rien n'est enregistré. */
    if (defaut) selecteurs.unshift(`:root[data-theme='${mode}']`);
    /*
       ET SANS AUCUN ATTRIBUT. Le script d'amorçage pose `data-theme` avant
       le premier rendu ; s'il échoue — script bloqué, erreur en amont — plus
       une seule variable ne serait définie, et la page se rendrait aux
       couleurs par défaut de Tailwind, c'est-à-dire du noir sur blanc sans
       aucun de nos jetons. Le mode clair sert donc de socle nu, et une
       requête de préférence rend le mode sombre à qui le demande.
    */
    if (defaut && mode === 'clair') selecteurs.unshift(':root');
    sortie += bloc(selecteurs.join(',\n'), declarations(roles, mode));
    sortie += '\n';
    if (defaut && mode === 'sombre') {
      sortie += `@media (prefers-color-scheme: dark) {\n${bloc(
        '  :root:not([data-theme])',
        declarations(roles, mode),
      )
        .split('\n')
        .map((l) => (l ? `  ${l}` : l))
        .join('\n')
        .replace(/^ {4}:root/, '  :root')}}\n\n`;
    }
  }
  return sortie;
}

function fichierDeSeance(): string {
  let sortie = ENTETE('Thème « Séance », hors sélecteur.');
  for (const v of THEMES_DE_SEANCE) {
    /*
       L'attribut est répété pour passer devant la palette.

       Une séance doit l'emporter sur le thème choisi, quel qu'il soit. Les
       sélecteurs de palette pèsent 0,3,0 (`:root` plus deux attributs) ;
       répéter `[data-seance]` porte celui-ci à 0,4,0 et tranche sans
       dépendre de l'ordre des fichiers — or cet ordre n'est pas garanti,
       puisque le fichier de thème est chargé après coup.
    */
    sortie += bloc(
      `:root[data-seance='${v.id}'][data-seance][data-seance]`,
      declarations(v.roles, v.mode),
    );
    sortie += '\n';
  }
  return sortie;
}

/* ── Écriture ────────────────────────────────────────────────────────────── */

/*
   Le module s'importe aussi : `essais:contrastes-themes` appelle
   `declarations()` pour mesurer ce que le site rendra vraiment, plutôt
   qu'une table recopiée. Il ne faut donc rien écrire à l'import.
*/
const appeleDirectement =
  process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split('/').pop()!);

/** Ce que les fichiers doivent contenir. L'essai `themes-a-jour` compare. */
export function fichiersAttendus(): Record<string, string> {
  const sortie: Record<string, string> = {
    'src/styles/theme-defaut.css': fichierDeTheme(THEME_PAR_DEFAUT) + fichierDeSeance(),
  };
  for (const t of THEMES) {
    if (t.id === THEME_PAR_DEFAUT) continue;
    sortie[`public/themes/${t.id}.css`] = fichierDeTheme(t.id);
  }
  return sortie;
}

const voir = process.argv.includes('--voir');
const fichiers = fichiersAttendus();

if (!appeleDirectement) {
  /* importé : on se tait */
} else if (voir) {
  for (const [chemin, contenu] of Object.entries(fichiers))
    console.log(`\n===== ${chemin} (${contenu.length} octets) =====\n${contenu.slice(0, 900)}…`);
} else {
  mkdirSync('public/themes', { recursive: true });
  let changes = 0;
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    let avant = '';
    try {
      avant = readFileSync(chemin, 'utf8');
    } catch {
      /* fichier neuf */
    }
    if (avant !== contenu) {
      writeFileSync(chemin, contenu);
      changes += 1;
    }
  }
  const poids = Object.entries(fichiers).map(([c, t]) => [c, t.length] as const);
  const total = poids.reduce((s, [, n]) => s + n, 0);
  console.log(
    `${Object.keys(fichiers).length} fichiers (${changes} réécrits), ${(total / 1024).toFixed(1)} Kio en tout ;` +
      ` le plus lourd : ${poids.sort((a, b) => b[1] - a[1])[0][0]} (${(poids[0][1] / 1024).toFixed(1)} Kio).`,
  );
  /* Un mot sur les bordures dérivées, puisque l'addendum demande de dire
     lesquelles ont dû être poussées à 3:1. */
  for (const t of THEMES)
    for (const mode of ['clair', 'sombre'] as Mode[]) {
      const r = t[mode];
      if (!r) continue;
      const d = derivees(r, mode);
      if (d.bordureForte.toLowerCase() !== r.bordure.toLowerCase())
        console.log(
          `  ${t.nom} ${mode} : bordure ${r.bordure} (${contraste(r.bordure, r.fond).toFixed(2)}:1)` +
            ` → bordure forte ${d.bordureForte} (${contraste(d.bordureForte, r.fond).toFixed(2)}:1)`,
        );
    }
}
