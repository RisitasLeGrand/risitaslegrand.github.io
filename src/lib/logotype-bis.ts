/* ══════════════════════════════════════════════════════════════════════════
   PROMPT 65 BIS — TROIS LOGOS, ET NON TROIS MOTS EN GRAS
   ══════════════════════════════════════════════════════════════════════════

   Le « mot seul » du 65 a été écarté par Alexis, et il avait raison : ce
   n'était pas un logo, c'était du texte courant un peu plus gras. Un logo est
   une marque — on doit la reconnaître sans la lire, et elle ne doit ressembler
   à aucun autre texte de l'écran.

   Les trois propositions ci-dessous prennent trois chemins différents, pour
   que le choix en soit un :

     « archipel-c »  la lettre DESSINÉE : le C est un anneau ouvert d'îles,
                     et le reste du mot suit en petites capitales. C'est la
                     piste du M12, ramenée dans la lettre plutôt qu'à côté.
     « baie »        le GESTE : le mot en serif, et la hampe du y prolongée en
                     une courbe qui passe sous le mot comme une côte, avec une
                     île dans l'anse. Une seule ligne, reconnaissable de loin.
     « capitales »   la TYPOGRAPHIE SEULE : CYCLADES en capitales largement
                     espacées, lapidaires, et un arc ouvert au-dessus. Le plus
                     sobre, le plus lisible en petit.

   DEUX FORMES, ET POURQUOI ELLES SONT DE LA MÊME FAMILLE. L'en-tête a 44 px de
   haut et le voile en a dix fois plus. Chaque proposition a donc une forme
   COMPACTE et une forme COMPLÈTE, et ce n'est pas deux logos : c'est le même
   dessin dont le détail apparaît quand il y a la place. L'anneau garde sa
   courbe et gagne ses îles ; la baie garde sa courbe et gagne son île ; les
   capitales gardent leur lettrage et gagnent leur arc.

   CE QUI NE CHANGE PAS DU 65. Dessin original, en SVG en ligne ; rien du web,
   aucune imitation ; les polices sont celles du site, retravaillées
   (interlettrage, petites capitales, lettres dessinées) et non reprises telles
   quelles ; deux jetons seulement, `--etat-texte` pour le mot et
   `--etat-texte-faible` pour la marque, dont `essais:logotype` garde les
   4,5:1 sur les vingt-cinq couples thème × mode ; le nom lu une seule fois ;
   la place réservée par le `viewBox` ; aucun appel au réseau.

   ET LE DÉFAUT À NE PAS REFAIRE — QUE J'AI D'ABORD REFAIT. Mon « anneau » du
   65 se lisait comme un indicateur de chargement : un cercle RÉGULIER de petits
   points est l'idiome universel du « ça tourne ». J'ai écrit ici, en première
   version, que les trois propositions y échappaient parce que leurs îles
   étaient « franchement inégales ». C'était faux, et le fichier le prouvait
   lui-même : les huit angles de l'archipel étaient espacés de 36 à 38 degrés.
   La première planche l'a montré d'un coup d'œil — en thème sombre, c'était le
   `spinner` de tout le monde.

   Ce que j'en retire, et qui vaut au-delà de ce fichier : une AFFIRMATION dans
   un commentaire n'est pas une mesure, et un dessin ne se juge pas sur le code
   qui l'engendre. Les trois marques ont été corrigées sur l'image, puis
   regardées à nouveau :

     — l'archipel garde son ARC dans les deux formes (une roue de chargement
       n'a pas de trait qui la relie) et ne porte plus que trois îles, groupées
       sur un tiers du tour et de rayons 13, 8 et 5 ;
     — la baie est une courbe unique, qui passe SOUS les jambages et non au
       travers — sa première ligne de base traversait le « y » ;
     — les capitales portent quatre marques de tailles distinctes sur un arc
       OUVERT, jamais refermé en cercle.
   ══════════════════════════════════════════════════════════════════════════ */

export type VarianteBis = 'archipel-c' | 'baie' | 'capitales';
export type FormeLogo = 'compacte' | 'complete';

/* ── La géométrie commune ──────────────────────────────────────────────── */

const MOT = 'Cyclades';
const TRAIT = 'var(--etat-texte)';
const MARQUE = 'var(--etat-texte-faible)';

/** Un point sur un cercle, en coordonnées d'écran (y vers le bas). */
const surLeCercle = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
};
const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Le mot, composé et non simplement écrit.
 *
 * `textLength` ne sert pas qu'à réserver la place : c'est AUSSI l'outil de
 * l'interlettrage. En demandant au mot d'occuper une largeur plus grande que
 * sa largeur naturelle, `lengthAdjust="spacing"` écarte les lettres d'autant —
 * ce qui donne le lettrage espacé d'une marque, et le donne de façon
 * DÉTERMINISTE, quelle que soit la police effectivement servie.
 */
function composer(opts: {
  texte: string;
  x: number | string;
  y: number;
  taille: number;
  largeur: number;
  graisse?: number;
  police?: string;
  ancrage?: string;
}) {
  const { texte, x, y, taille, largeur, graisse = 400, police = '--font-serif', ancrage = '' } = opts;
  return (
    `<text x="${x}" y="${y}"${ancrage} textLength="${largeur}" lengthAdjust="spacing"` +
    ` font-size="${taille}" font-weight="${graisse}" font-family="var(${police})"` +
    ` fill="${TRAIT}">${texte}</text>`
  );
}

/* ── A. « archipel-c » : le C est un anneau ouvert d'îles ──────────────── */

/**
 * L'anneau ouvert qui tient lieu de C.
 *
 * L'ouverture est à DROITE, de 55° à 305°, parce que c'est l'ouverture d'un C
 * et que c'est elle qui fait lire la lettre. Un anneau ouvert en haut ou en bas
 * ne serait qu'un anneau cassé.
 *
 * L'ARC RESTE DANS LES DEUX FORMES, et c'est une planche regardée qui l'a
 * imposé. Ma première version effaçait l'arc en forme complète au profit de
 * huit îles posées sur le cercle. J'avais écrit, en tête de ce fichier, que ces
 * îles étaient « franchement inégales » et donc à l'abri du défaut qui a fait
 * rejeter l'anneau du 65. Les nombres disaient le contraire : 55, 92, 130, 168,
 * 205, 242, 278, 305 — des écarts de 36 à 38 degrés, c'est-à-dire RÉGULIERS. Et
 * l'image le confirmait brutalement : un cercle de points sur fond sombre est
 * la roue de chargement de tout le monde. Une glose n'est pas une mesure.
 *
 * Deux conséquences, et la seconde m'importe autant que la première :
 *
 *   1. une roue de chargement n'a pas de trait qui la relie — garder l'arc est
 *      donc ce qui l'écarte le plus sûrement, bien mieux que d'espérer qu'on
 *      voie l'inégalité de rayons de 6 et 13 à cinquante-six pixels ;
 *   2. la forme compacte et la forme complète se reconnaissent enfin comme un
 *      SEUL logo, ce que ce fichier promettait et que l'arc effacé démentait.
 *
 * Les îles sont donc TROIS, posées sur l'arc, de rayons et d'écarts vraiment
 * distincts — 150°, 212°, 272° : des écarts de 62 et 60 contre une amplitude
 * d'arc de 250, soit un groupe nettement décentré vers le bas-gauche, et non
 * un semis sur tout le tour.
 */
function anneauC(cx: number, cy: number, r: number, forme: FormeLogo, epaisseur: number) {
  const [x1, y1] = surLeCercle(cx, cy, r, 55);
  const [x2, y2] = surLeCercle(cx, cy, r, 305);
  const arc =
    `<path d="M ${arrondi(x1)} ${arrondi(y1)} A ${r} ${r} 0 1 0 ${arrondi(x2)} ${arrondi(y2)}"` +
    ` fill="none" stroke="${TRAIT}" stroke-width="${epaisseur}" stroke-linecap="round" />`;
  if (forme === 'compacte') return arc;

  /* Trois îles seulement, groupées sur un tiers de l'arc et de rayons
     distincts. Le trait qui les porte reste visible : c'est lui qui fait la
     lettre, et c'est lui qui interdit la lecture « ça tourne ». */
  const iles: [number, number][] = [
    [150, 14], [212, 10], [272, 7],
  ];
  const disques = iles
    .map(([deg, rayon]) => {
      const [x, y] = surLeCercle(cx, cy, r, deg);
      return `<circle cx="${arrondi(x)}" cy="${arrondi(y)}" r="${rayon}" fill="${TRAIT}" />`;
    })
    .join('');
  /* Délos, dans le creux du C et décentrée : au centre exact elle ferait une
     cible, et une cible est un autre idiome déjà pris. Elle est posée bas et à
     droite, vers l'ouverture — au milieu du bol elle donnait un œil, et le
     dessin entier se lisait alors comme un visage. */
  const delos = `<circle cx="${cx + 13}" cy="${cy + 14}" r="5" fill="${MARQUE}" />`;
  return arc + disques + delos;
}

/* ── B. « baie » : une seule courbe, qui passe sous le mot ─────────────── */

/**
 * La côte.
 *
 * Une courbe unique qui descend sous le mot et remonte, comme l'anse d'une
 * baie. Elle part sous la deuxième lettre — là où tombe la hampe du « y » —,
 * et c'est ce qui la rattache au mot plutôt que de la poser à côté.
 *
 * En forme compacte, la courbe s'arrête à mi-mot et l'île disparaît : à
 * dix-huit pixels, une île de deux pixels n'est pas une île, c'est une
 * poussière.
 *
 * ELLE PASSE SOUS LES JAMBAGES, et c'est encore une planche regardée qui l'a
 * imposé. Ma première ligne de base était à 104, soit huit pixels sous la
 * ligne d'écriture du mot — mais le « y » de Cyclades descend d'environ un
 * cinquième du corps, c'est-à-dire jusqu'à 117. La courbe TRAVERSAIT donc les
 * lettres, et en forme compacte elle se lisait comme un soulignement raté.
 * Une côte passe sous la terre, pas au travers : la ligne de base est à 128,
 * franchement sous le jambage le plus bas, et la boîte a grandi d'autant.
 */
function baie(largeur: number, ligneDeBase: number, forme: FormeLogo, epaisseur: number) {
  const fin = forme === 'compacte' ? largeur * 0.62 : largeur;
  const creux = ligneDeBase + (forme === 'compacte' ? 24 : 38);
  const courbe =
    `<path d="M ${arrondi(largeur * 0.11)} ${ligneDeBase + 6}` +
    ` C ${arrondi(largeur * 0.3)} ${creux}, ${arrondi(fin * 0.74)} ${creux},` +
    ` ${arrondi(fin)} ${arrondi(ligneDeBase + 2)}"` +
    ` fill="none" stroke="${TRAIT}" stroke-width="${epaisseur}" stroke-linecap="round" />`;
  if (forme === 'compacte') return courbe;
  const ile = `<circle cx="${arrondi(largeur * 0.46)}" cy="${arrondi(creux - 13)}" r="7" fill="${MARQUE}" />`;
  return courbe + ile;
}

/* ── C. « capitales » : le lettrage seul, et un arc ouvert ─────────────── */

/**
 * L'arc ouvert, au-dessus du mot.
 *
 * QUATRE marques de tailles nettement différentes, posées sur une courbe
 * ouverte et à des écarts inégaux. Ni cercle, ni rythme régulier : l'un et
 * l'autre feraient revenir la roue de chargement que la planche du 65 a
 * condamnée, et c'est le seul défaut de ce lot qu'on connaisse déjà.
 */
function arcOuvert(cx: number, y: number, demiLargeur: number) {
  const marques: [number, number, number][] = [
    [cx - demiLargeur, y + 13, 5.5],
    [cx - demiLargeur * 0.34, y + 1, 9.5],
    [cx + demiLargeur * 0.42, y + 5, 7],
    [cx + demiLargeur, y + 16, 4],
  ];
  return marques
    .map(([x, cy, r]) => `<circle cx="${arrondi(x)}" cy="${arrondi(cy)}" r="${r}" fill="${MARQUE}" />`)
    .join('');
}

/* ── L'assemblage ──────────────────────────────────────────────────────── */

/**
 * Un des trois logos, dans l'une de ses deux formes.
 *
 * `decoratif` suit la même règle qu'au 65 : muet là où le balisage autour
 * porte déjà le nom — l'en-tête complet et son `sr-only` —, nommé partout
 * ailleurs. Voir l'en-tête de `svgLogotype`.
 */
export function svgLogoBis(
  variante: VarianteBis,
  hauteur: string,
  forme: FormeLogo = 'complete',
  decoratif = false,
): string {
  const nommage = decoratif ? 'aria-hidden="true"' : 'role="img" aria-label="Cyclades"';
  const ouvrir = (vb: string) =>
    `<svg ${nommage} data-logotype="${variante}" data-forme="${forme}" viewBox="${vb}"` +
    ` style="height:${hauteur};width:auto;display:block">`;

  if (variante === 'archipel-c') {
    /* Le C dessiné occupe la place de sa lettre ; le reste du mot suit. Les
       deux formes gardent le même anneau au même endroit : c'est ce qui les
       fait reconnaître comme un seul logo. */
    const r = 44;
    const cx = 58;
    const cy = 64;
    /* L'arc est FIN en forme complète, et épais en compacte. En compacte il est
       seul et doit tenir à dix-huit pixels ; en complète il n'est plus que le
       fil qui relie les îles, et un fil épais les ravalait au rang de bosses —
       des rayons de 14, 10 et 7 contre un demi-trait de 5,5, la plus petite ne
       sortait pas du trait. */
    const epais = forme === 'compacte' ? 13 : 6;
    const depart = cx + r + 26;
    const largeurMot = 318;
    const total = depart + largeurMot + 10;
    return (
      `${ouvrir(`0 0 ${total} 128`)}` +
      anneauC(cx, cy, r, forme, epais) +
      composer({
        texte: 'yclades',
        x: depart,
        y: 92,
        taille: 86,
        largeur: largeurMot,
        graisse: 500,
      }) +
      `</svg>`
    );
  }

  if (variante === 'baie') {
    const largeurMot = 430;
    const hauteurBoite = forme === 'compacte' ? 162 : 176;
    return (
      `${ouvrir(`0 0 ${largeurMot} ${hauteurBoite}`)}` +
      composer({ texte: MOT, x: 0, y: 96, taille: 100, largeur: largeurMot, graisse: 500 }) +
      baie(largeurMot, 128, forme, forme === 'compacte' ? 9 : 7) +
      `</svg>`
    );
  }

  /* « capitales » */
  const largeurMot = 452;
  const haut = forme === 'compacte' ? 0 : 46;
  return (
    `${ouvrir(`0 0 ${largeurMot} ${haut + 108}`)}` +
    (forme === 'complete' ? arcOuvert(largeurMot / 2, 10, largeurMot * 0.34) : '') +
    composer({
      texte: 'CYCLADES',
      x: 0,
      y: haut + 80,
      taille: 74,
      largeur: largeurMot,
      graisse: 500,
    }) +
    `</svg>`
  );
}
