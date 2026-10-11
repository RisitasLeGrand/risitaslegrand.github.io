/**
 * Les QR codes : en fabriquer un, en lire un.
 *
 * ## Pourquoi deux bibliothèques, et pourquoi pas les miennes
 *
 * Un encodeur QR est une spécification de cent pages dont soixante-quatre
 * entrées de table de correction d'erreurs — la part la plus facile à recopier
 * de travers, et la plus silencieuse quand elle l'est. Un décodeur est pire :
 * binarisation, recherche des trois cibles, correction de perspective,
 * Reed-Solomon à l'envers. Les écrire aurait été du travail que personne ne
 * relirait, pour un résultat moins éprouvé que deux implémentations qui le sont.
 *
 * Alors `qrcode-generator` (MIT, un fichier, aucune dépendance) encode, et
 * `jsqr` (Apache 2.0, aucune dépendance) décode. Les deux sont **importées
 * dynamiquement** : rien n'entre dans le paquet principal du site, et une page
 * qui n'affiche pas de QR ne les charge pas.
 *
 * Ce que j'écris, c'est ce qui est propre à Cyclades : la trame de ce qui voyage
 * dans le QR, le rendu en SVG — pas de canevas, donc pas de flou à l'impression
 * ni de perte à l'agrandissement — et la lecture.
 *
 * ## Les octets, et non les caractères
 *
 * L'encodeur convertit la chaîne qu'on lui donne en prenant l'octet de bas poids
 * de chaque caractère. Lui passer « Économie » lui fait donc produire un QR qui
 * ne contient pas « Économie » : le premier essai l'a montré, un aller-retour
 * rendait une chaîne vide. On lui passe donc des **octets**, convertis ici, ce
 * qui a deux conséquences heureuses : les accents survivent, et la charge n'a
 * plus besoin de passer par le base64 — lequel l'aurait alourdie d'un tiers,
 * c'est-à-dire de six versions de QR.
 *
 * ## Ce que la lecture d'un QR ne garantit pas
 *
 * Rien, et c'est voulu. Un QR affiché à l'écran peut être photographié par un
 * tiers ; ce qu'il contient ne doit donc jamais suffire à lire des données. Ici
 * il ne porte que de quoi **établir une liaison** : le paquet qui passera
 * ensuite est chiffré avec le mot de passe du site et refusé sans lui. C'est la
 * seule frontière de sécurité, et elle ne dépend pas du canal.
 */
import { comprimer, concatener, decomprimer, type Octets } from '../noyau/octets';

/** La trame d'un QR de Cyclades : un préfixe, un genre, une charge. */
export const PREFIXE = 'CYC1';

export type Genre = 'offre' | 'reponse' | 'salon';
const GENRES: readonly string[] = ['offre', 'reponse', 'salon'];

export interface Charge {
  genre: Genre;
  donnees: Octets;
}

const encodeur = new TextEncoder();
const decodeurTexte = new TextDecoder();
const DEUX_POINTS = 0x3a;

/**
 * Compacte un texte pour le faire tenir dans un QR.
 *
 * Une description de session WebRTC pèse environ 590 octets en clair et 430
 * compactée — mesuré, pas supposé. En octets bruts, cela tient dans un QR de
 * version 13, soit 69 modules de côté : visable par un téléphone à dix
 * centimètres d'un écran d'ordinateur.
 *
 * J'ai écarté l'autre voie, qui était de réduire la description à ses champs
 * essentiels (empreinte, ufrag, mot de passe, candidats) pour descendre à 120
 * octets : il faut alors **reconstruire** une description de session à
 * l'arrivée, et ce qu'on reconstruit de mémoire casse au premier navigateur qui
 * met ses lignes dans un autre ordre. Compacter ne suppose rien.
 *
 * « deflate-raw » plutôt que gzip : dix-huit octets d'en-tête et de somme en
 * moins, et la somme ne servirait à rien ici — un QR mal lu ne se décode pas.
 */
export async function compacter(texte: string): Promise<Uint8Array<ArrayBuffer>> {
  return comprimer(encodeur.encode(texte), 'deflate-raw');
}

export async function decompacter(octets: Octets): Promise<string> {
  return decodeurTexte.decode(await decomprimer(octets, 'deflate-raw'));
}

/** Les octets à mettre dans le QR, préfixe compris. */
export const encoderCharge = (charge: Charge): Uint8Array<ArrayBuffer> =>
  concatener([encodeur.encode(`${PREFIXE}:${charge.genre}:`), charge.donnees]);

/**
 * Relit les octets d'un QR scanné.
 *
 * Rend `null` pour tout ce qui n'est pas un QR de Cyclades, sans jeter : la
 * boucle de lecture voit passer tout ce que la caméra attrape, y compris
 * l'étiquette d'un colis, et une exception par image serait du bruit.
 */
export function lireCharge(octets: Octets): Charge | null {
  const premier = octets.indexOf(DEUX_POINTS);
  if (premier < 0) return null;
  if (decodeurTexte.decode(octets.subarray(0, premier)) !== PREFIXE) return null;
  const second = octets.indexOf(DEUX_POINTS, premier + 1);
  if (second < 0) return null;
  const genre = decodeurTexte.decode(octets.subarray(premier + 1, second));
  if (!GENRES.includes(genre)) return null;
  // Tout ce qui suit le second deux-points est la charge, deux-points compris :
  // elle est binaire, et rien ne lui interdit d'en contenir.
  return { genre: genre as Genre, donnees: octets.subarray(second + 1) };
}

/* ══════════════════════════════════════════════════════════════════════════
   Fabriquer
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le niveau de correction.
 *
 * « L » (7 %) pour l'appairage : la source est un écran propre, pas une
 * étiquette collée sur un carton, et chaque niveau au-dessus coûte des versions
 * de QR donc des modules plus fins à viser. « M » reste le défaut pour tout le
 * reste, où l'on ne sait pas d'où le QR sera lu.
 */
export type Correction = 'L' | 'M' | 'Q' | 'H';

export interface Matrice {
  /** `cote × cote` booléens, vrai pour un module sombre. */
  modules: boolean[][];
  cote: number;
  /** La version choisie par l'encodeur, 1 à 40. */
  version: number;
}

type Code = {
  addData: (donnees: string, mode?: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (ligne: number, colonne: number) => boolean;
};
type Fabrique = (version: number, correction: Correction) => Code;

let fabrique: Fabrique | null = null;

async function chargerFabrique(): Promise<Fabrique> {
  if (fabrique) return fabrique;
  const module = await import('qrcode-generator');
  fabrique = ((module as unknown as { default?: Fabrique }).default ??
    (module as unknown as Fabrique)) as Fabrique;
  return fabrique;
}

/** Les octets, sous la forme que l'encodeur convertit sans les abîmer. */
const enLatin1 = (octets: Octets): string => {
  let texte = '';
  for (const octet of octets) texte += String.fromCharCode(octet);
  return texte;
};

/**
 * La matrice d'un QR.
 *
 * La version 0 demande à l'encodeur de choisir la plus petite qui suffise : un
 * QR plus grand que nécessaire est un QR plus difficile à viser.
 */
export async function matrice(
  contenu: Octets | string,
  correction: Correction = 'M',
): Promise<Matrice> {
  const octets = typeof contenu === 'string' ? encodeur.encode(contenu) : contenu;
  const fabriquer = await chargerFabrique();
  const code = fabriquer(0, correction);
  code.addData(enLatin1(octets), 'Byte');
  code.make();
  const cote = code.getModuleCount();
  const modules: boolean[][] = [];
  for (let ligne = 0; ligne < cote; ligne += 1) {
    const rangee: boolean[] = [];
    for (let colonne = 0; colonne < cote; colonne += 1) rangee.push(code.isDark(ligne, colonne));
    modules.push(rangee);
  }
  // La version se déduit du côté : côté = 17 + 4 × version.
  return { modules, cote, version: (cote - 17) / 4 };
}

/**
 * Le SVG d'un QR, prêt à être inséré.
 *
 * Un seul chemin pour tous les modules sombres, plutôt qu'un rectangle par
 * module : un QR de version 13 compte 4 761 modules, et quatre mille éléments
 * dans le DOM font ramer le téléphone qui doit l'afficher.
 *
 * La zone de silence de quatre modules n'est pas décorative : sans elle, un
 * décodeur ne trouve pas les cibles. Le fond est explicitement blanc, parce
 * qu'un QR sombre sur fond sombre n'est pas un QR — c'est le piège du thème
 * nuit, et il est désamorcé ici une fois pour toutes.
 */
export function enSvg(m: Matrice, options: { silence?: number; titre?: string } = {}): string {
  const silence = options.silence ?? 4;
  const total = m.cote + silence * 2;
  let chemin = '';
  for (let ligne = 0; ligne < m.cote; ligne += 1) {
    for (let colonne = 0; colonne < m.cote; colonne += 1) {
      if (m.modules[ligne][colonne]) chemin += `M${colonne + silence} ${ligne + silence}h1v1h-1z`;
    }
  }
  const etiquette = options.titre ?? 'QR code';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="${etiquette}">` +
    `<title>${etiquette}</title>` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<path d="${chemin}" fill="#000000"/></svg>`
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Lire
   ══════════════════════════════════════════════════════════════════════════ */

interface Trouve {
  data: string;
  binaryData: number[];
}
type Decodeur = (
  donnees: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
  options?: { inversionAttempts?: string },
) => Trouve | null;

let decodeur: Decodeur | null = null;

async function chargerDecodeur(): Promise<Decodeur> {
  if (decodeur) return decodeur;
  const module = await import('jsqr');
  decodeur = ((module as unknown as { default?: Decodeur }).default ??
    (module as unknown as Decodeur)) as Decodeur;
  return decodeur;
}

export interface Lecture {
  /** Le contenu lu comme texte — pour un QR quelconque, une URL par exemple. */
  texte: string;
  /** Les octets exacts — pour une charge de Cyclades, qui est binaire. */
  octets: Uint8Array<ArrayBuffer>;
}

/** Décode une image déjà en mémoire. Rend la lecture, ou `null`. */
export async function decoder(
  donnees: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
): Promise<Lecture | null> {
  const lire = await chargerDecodeur();
  // « attemptBoth » coûte le double mais lit aussi les QR en négatif, que les
  // écrans en thème sombre produisent quand on les photographie.
  const trouve = lire(donnees, largeur, hauteur, { inversionAttempts: 'attemptBoth' });
  if (!trouve) return null;
  return {
    texte: trouve.data,
    octets: new Uint8Array(trouve.binaryData),
  };
}
