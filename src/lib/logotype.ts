/**
 * Le dessin du logotype « Cyclades » (prompt 65).
 *
 * ## Pourquoi un module et non un composant seul
 *
 * Deux choses ont besoin du MÊME dessin : le composant qui le pose dans le
 * site, et `scripts/planche-logotype.mjs`, qui en fait la planche de captures
 * soumise au choix. Un script qui recopierait le balisage montrerait, au
 * premier écart, un logotype différent de celui qu'on livre — et la planche
 * est précisément ce sur quoi la décision se prend. Le dessin est donc ici,
 * une seule fois, et les deux le lisent.
 *
 * `scripts/essais-logotype.mts` lit ce fichier aussi, pour confronter les
 * jetons employés à ceux qu'il garde.
 *
 * ## Ce qu'il est, et pourquoi il est en SVG plutôt qu'en texte
 *
 * Le mot, composé dans les polices du site — jamais une police nouvelle, jamais
 * un fichier chargé. Le SVG n'est pas là pour faire une image : il est là pour
 * **réserver sa place**. Un `<svg>` à `viewBox` a un rapport de forme
 * intrinsèque, donc une boîte connue avant que la police n'arrive. Le même mot
 * posé en HTML mesurerait la largeur d'Arial pendant le chargement, puis celle
 * de Public Sans : l'en-tête sauterait à chaque première visite, et l'en-tête
 * est précisément l'élément que `view-transition-name: entete-principal` fait
 * persister d'une page à l'autre. Un logotype qui saute au moment où tout le
 * reste glisse est le pire endroit pour ce défaut.
 *
 * `textLength` avec `lengthAdjust="spacing"` achève la promesse : le mot occupe
 * la largeur annoncée quelle que soit la police servie, en jouant sur
 * l'interlettrage et non sur le dessin des lettres — `spacingAndGlyphs`
 * déformerait les glyphes quand le substitut est plus étroit.
 *
 * ## Le nom n'est lu QU'UNE FOIS
 *
 * `role="img"` et `aria-label="Cyclades"` : avec ce rôle, les descendants ne
 * sont pas annoncés, de sorte que le `<text>` à l'intérieur ne redit pas le
 * nom. C'est la raison d'être de ce rôle ici, et non une précaution de plus.
 *
 * ## Les couleurs, et ce que la mesure a dit
 *
 * DEUX jetons seulement, et les 25 combinaisons thème × mode ont été mesurées
 * (`scripts/essais-logotype.mts`) : le pire rapport est 10,53:1 pour
 * `--etat-texte` et 5,31:1 pour `--etat-texte-faible`. Les deux tiennent donc
 * le 4,5:1 qu'on demande à un logotype SEUL porteur du nom, partout.
 *
 * J'en avais mis TROIS, le jeton d'action pour Délos, et la garde l'a refusé :
 * voir le commentaire de `DELOS` plus bas. C'est le seul endroit de ce lot où
 * une mesure a changé le dessin.
 *
 * Au passage, une correction de ce que j'allais croire : la couleur actuelle du
 * voile est `--etat-texte-faible`, et elle PASSE déjà le seuil. Porter le mot à
 * `--etat-texte` est un choix de présence, pas une réparation.
 *
 * ## Le clin d'œil, et sa limite
 *
 * Les Cyclades sont un cercle d'îles autour de Délos. La marque est donc un
 * anneau de disques inégaux avec un disque décentré au milieu — original, et
 * assez abstrait pour n'imiter aucune marque existante. Elle n'est JAMAIS
 * seule porteuse du nom : si elle disparaissait, le mot resterait lisible.
 *
 * Trois disques et non sept dans la variante empilée : à seize pixels de haut,
 * sept disques font une tache. La variante le dit dans son commentaire plutôt
 * que de laisser le défaut se découvrir sur un téléphone.
 */

export type VarianteLogotype = 'mot' | 'anneau' | 'archipel';

/*
   LES DISQUES DE L'ANNEAU, posés à la main et non calculés.

   Un cercle régulier de disques égaux fait une horloge, pas un archipel. Les
   rayons et les angles sont donc inégaux — c'est ce qui fait lire « des îles »
   plutôt que « des points ». Sept, comme les sept grandes Cyclades que l'on
   nomme d'ordinaire ; le compte n'est pas une donnée à sourcer, c'est une
   composition.
*/
const ILES: { x: number; y: number; r: number }[] = [
  { x: 56, y: 10, r: 7 },
  { x: 92, y: 28, r: 5 },
  { x: 102, y: 66, r: 8 },
  { x: 74, y: 94, r: 5.5 },
  { x: 36, y: 92, r: 7.5 },
  { x: 10, y: 62, r: 5 },
  { x: 18, y: 24, r: 6.5 },
];

/*
   DÉLOS, au milieu et DÉCENTRÉE : au centre exact, elle ferait une cible.

   ELLE N'EST PAS EN COULEUR D'ACTION, et c'est la garde qui l'a imposé. Je
   l'avais posée en `--etat-action` pour qu'elle se distingue : `essais:logotype`
   a rougi sur « republique/clair », où l'action vaut 13,79:1 contre 10,53:1
   pour le texte. Le clin d'œil y dominait donc le nom, ce qui est l'inverse de
   ce qu'on demande à un logotype — le mot est le sujet, la marque au plus un
   écho.

   Elle se distingue désormais par la TAILLE et la POSITION seules, dans le même
   jeton faible que les îles. Ce n'est pas la garde qu'on fait taire : la mesure
   dit que `texteFaible` est partout plus faible que `texte`, d'au moins 5,21
   points de rapport, donc la subordination est garantie par la construction des
   thèmes et non par la chance d'un réglage.
*/
const DELOS = { x: 62, y: 56, r: 3.5 };

/* Les largeurs sont fixées ici, et c'est ce qui réserve la place. */
const LARGEUR_MOT = 452;
const ECART = 32;
const LARGEUR_MARQUE = 112;

const disque = (x: number, y: number, r: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--etat-texte-faible)" />`;

/**
 * Le mot, composé en SVG.
 *
 * `textLength` avec `lengthAdjust="spacing"` : le mot occupe la largeur
 * annoncée quelle que soit la police servie, en jouant sur l'interlettrage et
 * non sur le dessin des lettres — `spacingAndGlyphs` déformerait les glyphes
 * quand le substitut est plus étroit.
 */
function mot(
  x: number | string,
  y: number,
  taille: number,
  graisse: number,
  police: string,
  ancrage = '',
): string {
  return (
    `<text x="${x}" y="${y}"${ancrage}` +
    ` textLength="${LARGEUR_MOT}" lengthAdjust="spacing"` +
    ` font-size="${taille}" font-weight="${graisse}" font-family="var(${police})"` +
    ` fill="var(--etat-texte)">Cyclades</text>`
  );
}

/** Le logotype entier, prêt à poser. `hauteur` est une longueur CSS. */
export function svgLogotype(variante: VarianteLogotype, hauteur: string): string {
  const ouvrir = (vb: string) =>
    `<svg role="img" aria-label="Cyclades" data-logotype="${variante}" viewBox="${vb}"` +
    ` style="height:${hauteur};width:auto;display:block">`;

  if (variante === 'mot') {
    return `${ouvrir(`0 0 ${LARGEUR_MOT} 128`)}${mot(0, 96, 100, 600, '--font-sans')}</svg>`;
  }

  if (variante === 'anneau') {
    const large = LARGEUR_MARQUE + ECART + LARGEUR_MOT;
    /* La marque n'a ni titre ni rôle : le rôle d'image du parent empêche déjà
       toute annonce de ses descendants, et lui donner un titre ferait dire le
       nom deux fois. */
    const marque =
      `<g transform="translate(0,8)">` +
      ILES.map((i) => disque(i.x, i.y, i.r)).join('') +
      disque(DELOS.x, DELOS.y, DELOS.r) +
      `</g>`;
    return (
      `${ouvrir(`0 0 ${large} 128`)}${marque}` +
      `${mot(LARGEUR_MARQUE + ECART, 96, 100, 600, '--font-sans')}</svg>`
    );
  }

  /*
     TROIS DISQUES, et non les sept de l'anneau. À seize pixels de haut, sept
     disques empilés au-dessus d'un mot font une tache grise ; trois se lisent
     encore. La variante empilée est pour le voile, qui a de la place — mais la
     règle vaut d'être écrite ici plutôt que découverte sur un téléphone.

     Composée en SERIF, l'autre police du site : empilée et centrée, la
     composition est un frontispice, et Spectral y est chez elle là où Public
     Sans est une police d'interface.
  */
  const milieu = LARGEUR_MOT / 2;
  const marque = disque(milieu - 46, 38, 9) + disque(milieu, 26, 5) + disque(milieu + 44, 40, 7.5);
  return (
    `${ouvrir(`0 0 ${LARGEUR_MOT} 232`)}${marque}` +
    `${mot(milieu, 190, 112, 500, '--font-serif', ' text-anchor="middle"')}</svg>`
  );
}
