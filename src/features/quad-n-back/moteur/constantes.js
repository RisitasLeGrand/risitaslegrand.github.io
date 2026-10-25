/**
 * Constantes visuelles et sonores du Quad N-Back.
 *
 * Tracés SVG des formes et palettes de couleurs repris de « quad-box »
 * (src/lib/constants.js) :
 *   https://github.com/scottshadow56/quad-box  — licence MIT
 *   Copyright (c) 2025 The Quad Box Project Contributors
 *   Texte complet : src/features/quad-n-back/LICENCE-quad-box.txt
 *
 * Adaptations : un seul jeu de sons (lettres) au lieu de six, positions
 * dérivées plutôt qu'énumérées, et formes rendues en SVG inline plutôt
 * qu'en URL de blob (compatible avec le rendu côté serveur d'Astro).
 */

export const SHAPES = {
  diamond: `
    M55,5 L105,55 L55,105 L5,55 Z
  `,
  heart: `
    M55,92
    C30,77 10,47 30,27
    C40,17 55,22 55,37
    C55,22 70,17 80,27
    C100,47 80,77 55,92 Z
  `,
  hemicircle: `
    M5,40
    A55,60 0 0,1 105,40 
    L105,100
    L5,100 Z
  `,
  octagon: `
    M35,5 L75,5 L105,35 L105,75 L75,105 L35,105 L5,75 L5,35 Z
  `,
  square: `
    M5,5 H105 V105 H5 Z
  `,
  star: `
    M55,5 
    L66.8,40.1 L105,40.1 
    L74.1,62 L85.9,96 
    L55,75 L24.1,96 
    L35.9,62 L5,40.1 
    L43.2,40.1 Z
  `,
  triangle: `
    M55,5 L105,105 L5,105 Z
  `,
  cross: `
    M40,5 H70 V40 H105 V70 H70 V105 H40 V70 H5 V40 H40 Z
  `,
  crescent: `
    M95,22
    A50,50 0 1,0 95,88
    A35,38 0 1,1 95,22 Z
  `,
}

export const LIGHT_PALETTE = {
  red: '#FF2233',
  green: '#35FF55',
  blue: '#2545FF',
  yellow: '#FBFB61',
  purple: '#8831EA',
  cyan: '#69FCFF',
  orange: '#FF9320',
  pink: '#FC75BA',
}

export const DARK_PALETTE = {
  red: '#A4031F',
  green: '#09AA40',
  blue: '#1616CA',
  yellow: '#DFAC28',
  purple: '#56255D',
  cyan: '#57B6C3',
  orange: '#CC5000',
  pink: '#F27191',
}


/*
 * ── Les couleurs propres à l'exercice ───────────────────────────────────
 *
 * Elles sont écrites ici, en dur, et c'est voulu : ce sont des **stimuli**,
 * pas des éléments d'interface. Le Quad N-Back demande de distinguer huit
 * couleurs ; si elles suivaient le thème, elles cesseraient d'être
 * comparables d'une séance à l'autre, et dans Ardoise — sans couleur vive —
 * la dimension « couleur » disparaîtrait purement et simplement. Les faces
 * du cube et les retours sont du même ordre : ils portent le sens de
 * l'épreuve, comme le dessin d'une icône.
 *
 * C'est le seul fichier de l'exercice où une couleur est écrite ;
 * `essais:couleurs-jetons` le déclare en exception, avec cette raison.
 */

/**
 * Les faces du cube et leurs contours, repris de quad-box.
 *
 * Une forme ou un motif impose une face claire qui leur sert de support ;
 * sans eux, c'est la face elle-même qui porte la couleur du tirage.
 */
export const FACES = {
  clair: { support: '#FAFAFA', pleine: '#313131', contour: '#222' },
  sombre: { support: '#FDFDFD', supportColore: '#EEEEEE', pleine: '#FFFFFF', contour: '#333' },
}

/**
 * Les retours immédiats, désormais SUR JETONS et non plus en hexadécimal.
 *
 * ## Pourquoi ceux-là bougent, et pas les stimuli
 *
 * Les huit couleurs du tirage sont des ÉLÉMENTS D'ÉPREUVE : la dimension
 * « Couleur » demande de les distinguer, et les faire suivre le thème les
 * rendrait incomparables d'une séance à l'autre — dans Ardoise, la dimension
 * disparaîtrait. Elles restent donc écrites ici.
 *
 * Les retours, eux, sont de l'INTERFACE : ils disent juste, faux ou manqué,
 * exactement comme le vocabulaire partagé de `correction/vocabulaire.ts`. Rien
 * ne justifiait qu'ils aient leurs propres rouges et verts, qui ne suivaient
 * aucun des quatorze thèmes — et qui, dans un thème sombre, juraient avec tout
 * le reste de l'écran.
 *
 * Le texte vient de `--etat-fond` : les rôles sont construits pour que le fond
 * du thème soit lisible sur ses couleurs d'état, et c'est ce qui remplace le
 * couple « fond + texte » choisi à la main.
 *
 * Ce n'est plus un palier à deux modes : un jeton change de valeur avec le
 * thème, et le mode avec lui. La forme reste celle d'avant pour que les
 * appelants ne changent pas — et parce que l'écran a encore besoin de savoir
 * s'il est sombre, pour les pastilles de légende.
 */
const SUR_JETON = (role) => ['var(--etat-' + role + ')', 'var(--etat-fond)']

export const RETOURS = {
  reussite: { clair: SUR_JETON('succes'), sombre: SUR_JETON('succes') },
  echec: { clair: SUR_JETON('erreur'), sombre: SUR_JETON('erreur') },
  oubli: { clair: SUR_JETON('alerte'), sombre: SUR_JETON('alerte') },
}


export const COLOR_POOL = Object.keys(LIGHT_PALETTE);
export const SHAPE_POOL = Object.keys(SHAPES);

/** Grille 3×3×3 : 27 positions, notées « plan-ligne-colonne ». */
export const POSITION_POOL = Array.from({ length: 27 }, (_, i) =>
  `${Math.floor(i / 9)}-${Math.floor((i % 9) / 3)}-${i % 3}`,
);

/** Grille 3×3 : 9 positions, notées « ligne-colonne ». */
export const POSITION_POOL_2D = Array.from({ length: 9 }, (_, i) =>
  `${Math.floor(i / 3)}-${i % 3}`,
);

/**
 * Sons : les lettres du jeu « Letters2 » de quad-box, choisies pour être
 * nettement distinctes à l'oreille. Les fichiers sont dans
 * « public/quad-n-back/audio/ ».
 */
export const AUDIO_POOL = ['a', 'b', 'd', 'e', 'g', 'i', 'j', 'k', 'm', 'o', 's', 'z'];

/** Libellé affiché pour chaque son (utile en mode sans casque). */
export const AUDIO_LIBELLES = Object.fromEntries(
  AUDIO_POOL.map((lettre) => [lettre, lettre.toUpperCase()]),
);
