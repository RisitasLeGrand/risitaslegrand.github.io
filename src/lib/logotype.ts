/**
 * Le dessin du logotype « Cyclades » — variante « capitales », choisie par
 * Alexis au prompt 65 bis.
 *
 * ## Pourquoi un module et non un composant seul
 *
 * Trois choses ont besoin du MÊME dessin : le composant qui le pose dans le
 * site, `scripts/planche-logotype.mjs` qui en fait les captures, et
 * `scripts/essais-logotype.mts` qui confronte les jetons employés à ceux qu'il
 * garde. Un script qui recopierait le balisage montrerait, au premier écart, un
 * logotype différent de celui qu'on livre. Le dessin est donc ici, une seule
 * fois, et les trois le lisent.
 *
 * ## DEUX FORMES, ET NON DEUX LOGOS
 *
 * L'en-tête a 44 px de haut, le voile dix fois plus. Le logotype a donc une
 * forme COMPACTE et une forme COMPLÈTE : le même lettrage, auquel la seconde
 * ajoute l'arc de quatre marques quand il y a la place. Ce n'est pas un choix
 * entre deux dessins — c'est un seul dessin dont le détail paraît quand il
 * tient.
 *
 * ## Ce qui a été écarté, et par quoi
 *
 * Le 65 proposait trois variantes dont le « mot seul », retenu d'abord puis
 * écarté par Alexis : ce n'était pas un logo, c'était du texte courant un peu
 * plus gras. L'« anneau » du même lot avait été écarté plus tôt, sur la
 * planche : à dix-huit pixels, un anneau de petits disques est l'idiome de
 * l'indicateur de chargement — que le site possède par ailleurs pour de vrai.
 *
 * Le 65 bis en a proposé trois autres (`docs/cyclades/planche-65-bis/`), et la
 * première version de son « archipel-C » a REFAIT ce défaut : ses huit îles
 * étaient espacées de 36 à 38 degrés, c'est-à-dire régulières, malgré le
 * commentaire qui les disait « franchement inégales ». Une affirmation dans un
 * commentaire n'est pas une mesure.
 *
 * C'est pourquoi l'arc d'ici est OUVERT, jamais refermé en cercle, et porte
 * quatre marques de rayons nettement distincts (9,5 · 7 · 5,5 · 4) à des écarts
 * inégaux. Le dessin ne tourne pas.
 *
 * ## Les capitales viennent du STYLE, jamais du texte
 *
 * Le contenu du `<text>` est « Cyclades », et `text-transform: uppercase` le
 * met en capitales. Écrire « CYCLADES » dans le balisage ferait courir le
 * risque qu'un lecteur d'écran l'ÉPELLE — beaucoup le font pour un mot tout en
 * majuscules. `role="img"` tait déjà les descendants, mais on ne fait pas
 * reposer la prononciation du nom sur une seule ligne de défense.
 *
 * ## Le SVG réserve la place, et `textLength` remplit la boîte
 *
 * Un `<svg>` à `viewBox` a un rapport de forme intrinsèque, donc une boîte
 * connue avant que la police n'arrive. Le même mot posé en HTML mesurerait la
 * largeur d'Arial pendant le chargement puis celle de Spectral : l'en-tête
 * sauterait à chaque première visite — et l'en-tête est précisément l'élément
 * que `view-transition-name: entete-principal` fait persister d'une page à
 * l'autre.
 *
 * `textLength` fait AUTRE CHOSE, et c'est un sabotage qui m'a obligé à le
 * réécrire : le retirer ne décale rien, parce que la boîte est tenue par le
 * `viewBox` seul. Ce qu'il tient, lui, c'est le REMPLISSAGE de cette boîte, et
 * ici il fait DE PLUS l'interlettrage : en demandant au mot une largeur plus
 * grande que sa largeur naturelle, `lengthAdjust="spacing"` écarte les lettres
 * d'autant. Le lettrage espacé d'une marque, obtenu de façon déterministe quelle
 * que soit la police servie. `spacingAndGlyphs` déformerait les glyphes quand le
 * substitut est plus étroit.
 *
 * ## Le nom n'est lu QU'UNE FOIS
 *
 * `role="img"` et `aria-label="Cyclades"` : avec ce rôle, les descendants ne
 * sont pas annoncés, de sorte que le `<text>` ne redit pas le nom.
 *
 * ## Les couleurs, et ce que la mesure a dit
 *
 * DEUX jetons seulement, et les 25 combinaisons thème × mode sont mesurées par
 * `scripts/essais-logotype.mts` : le pire rapport est 10,53:1 pour
 * `--etat-texte` (le mot) et 5,31:1 pour `--etat-texte-faible` (les marques).
 * Les deux tiennent le 4,5:1 qu'on demande à un logotype seul porteur du nom.
 *
 * J'en avais mis TROIS au 65, le jeton d'action pour la marque, et la garde l'a
 * refusé : sur « republique/clair », l'action vaut 13,79:1 contre 10,53:1 pour
 * le texte, de sorte que le clin d'œil y dominait le nom — l'inverse de ce
 * qu'on demande. Les marques se distinguent donc par la TAILLE et la POSITION
 * seules, dans le jeton faible.
 */

/** Les deux formes du même logotype. */
export type VarianteLogotype = 'compacte' | 'complete';

/**
 * LE CHOIX, À UN SEUL ENDROIT.
 *
 * Rien d'autre ne nomme une forme : ni la mise en page, ni le voile, ni les
 * essais. C'est la raison d'être de ces deux constantes, et c'est pourquoi
 * elles sont ici plutôt qu'à l'appel.
 */
export const VARIANTE_EN_TETE: VarianteLogotype = 'compacte';
export const VARIANTE_VOILE: VarianteLogotype = 'complete';

/** La largeur du lettrage, fixée ici : c'est elle qui réserve la place. */
const LARGEUR_MOT = 452;
/** La hauteur que la forme complète ajoute au-dessus, pour l'arc. */
const HAUTEUR_ARC = 46;
/** La hauteur du lettrage seul, jambages compris. */
const HAUTEUR_MOT = 108;

/*
   LES QUATRE MARQUES DE L'ARC, posées à la main et non calculées.

   Rayons 9,5 · 7 · 5,5 · 4 et écarts inégaux : ni cercle, ni rythme régulier.
   L'un et l'autre feraient revenir l'indicateur de chargement qui a écarté
   l'anneau du 65 — et que la première version du 65 bis avait refait sans le
   voir. Les valeurs sont relatives à la demi-largeur de l'arc, de sorte qu'un
   changement de `LARGEUR_MOT` ne disloque pas la composition.
*/
const DEMI_ARC = 0.34;
const MARQUES: { dx: number; dy: number; r: number }[] = [
  { dx: -1, dy: 13, r: 5.5 },
  { dx: -0.34, dy: 1, r: 9.5 },
  { dx: 0.42, dy: 5, r: 7 },
  { dx: 1, dy: 16, r: 4 },
];

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** L'arc ouvert, au-dessus du mot. Forme complète seulement. */
function arcOuvert(): string {
  const cx = LARGEUR_MOT / 2;
  const demi = LARGEUR_MOT * DEMI_ARC;
  return MARQUES.map(
    (m) =>
      `<circle cx="${arrondi(cx + m.dx * demi)}" cy="${m.dy + 10}" r="${m.r}"` +
      ` fill="var(--etat-texte-faible)" />`,
  ).join('');
}

/**
 * Le lettrage, composé en SVG.
 *
 * Le contenu est « Cyclades » et les capitales viennent de `text-transform` :
 * voir l'en-tête de ce fichier. Composé en SERIF, l'autre police du site —
 * lapidaire, Spectral est chez elle là où Public Sans est une police
 * d'interface.
 */
function lettrage(y: number): string {
  return (
    `<text x="0" y="${y}"` +
    ` textLength="${LARGEUR_MOT}" lengthAdjust="spacing"` +
    ` font-size="74" font-weight="500" font-family="var(--font-serif)"` +
    ` style="text-transform:uppercase"` +
    ` fill="var(--etat-texte)">Cyclades</text>`
  );
}

/**
 * Le logotype entier, prêt à poser. `hauteur` est une longueur CSS.
 *
 * ## `decoratif`, et pourquoi il existe
 *
 * Par défaut le logotype se NOMME : `role="img"` et `aria-label="Cyclades"`,
 * et comme ce rôle tait les descendants, le nom est lu une fois et une seule.
 *
 * Mais l'en-tête complet pose le logotype DANS un lien qui porte déjà
 * « Menu de Cyclades » en `sr-only`. Là, un logotype qui se nomme ferait
 * entendre « Cyclades, Menu de Cyclades » : le nom deux fois, pour un seul
 * élément. `decoratif` le rend muet, et le lien garde le nom accessible qu'il
 * avait avant que le logotype arrive.
 *
 * L'en-tête léger est l'inverse : son `sr-only` ne dit que « — revenir au
 * menu », donc le logotype doit se nommer, sans quoi le lien s'annoncerait
 * « — revenir au menu » sans dire de quoi. Deux emplacements voisins, deux
 * réponses contraires, et c'est le balisage AUTOUR qui tranche — jamais le
 * logotype seul.
 */
export function svgLogotype(
  variante: VarianteLogotype,
  hauteur: string,
  decoratif = false,
): string {
  const nommage = decoratif ? 'aria-hidden="true"' : 'role="img" aria-label="Cyclades"';
  const haut = variante === 'complete' ? HAUTEUR_ARC : 0;
  const ouvrir =
    `<svg ${nommage} data-logotype="${variante}"` +
    ` viewBox="0 0 ${LARGEUR_MOT} ${haut + HAUTEUR_MOT}"` +
    ` style="height:${hauteur};width:auto;display:block">`;
  /* L'arc n'a ni titre ni rôle : le rôle d'image du parent empêche déjà toute
     annonce de ses descendants, et lui donner un titre ferait dire le nom deux
     fois. */
  const marque = variante === 'complete' ? arcOuvert() : '';
  return `${ouvrir}${marque}${lettrage(haut + 80)}</svg>`;
}
