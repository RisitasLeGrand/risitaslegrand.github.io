/**
 * LE RENDU PORTÉ PAR LA DIMENSION, ET NON PAR LE COMPOSANT.
 *
 * Prompt 63, lot L5. Décision du pilote du 1er novembre, après vérification
 * dans les deux fichiers concernés : « le rendu va SUR LA DIMENSION, dans le
 * registre, exactement comme `attribut` a remplacé le switch ».
 *
 * ## Le problème que cela lève
 *
 * `stimulus()` ne connaît plus la liste des dimensions depuis qu'elles portent
 * leur `attribut` : A a levé cette frontière-là. Mais le DESSIN est resté dans
 * `Stimulus.svelte`, qui branche sur `stimulus.dimension === 'teinte'` et lit
 * des attributs nommés un par un ; et le SON est resté dans `audio.ts`, qui
 * joue une sinusoïde depuis trois nombres. Aucune forme, aucune texture, aucun
 * motif rythmique et aucune parole n'y est possible.
 *
 * La frontière de fichiers du lot L5 — vision-forme et vision-texture,
 * audition-motif et audition-parle à B ; vision-simple et audition-simple à
 * A — n'était donc pas constructible : on ne peut ni se passer de rendu, ni
 * mettre le rendu chez A sans franchir sa ligne.
 *
 * ## La forme retenue, et pourquoi elle garde la ligne d'A
 *
 * Une dimension peut porter un rendu. Les composants d'A ont alors UN point
 * d'appel générique chacun, et tout le code de dessin vit dans
 * `dimensions/rendus/`, qui est à B. Le contact reste ce qu'A avait fixé : une
 * ligne par dimension dans le registre.
 *
 * **Les sept dimensions d'origine ne portent pas de rendu et ne passent pas par
 * ce point.** Leurs branches dans `Stimulus.svelte` sont intactes ; c'est la
 * condition que le pilote a posée, et les essais d'A la vérifient en restant
 * verts.
 *
 * ## Pourquoi un canevas, et non du HTML
 *
 * Les sept d'origine sont des `<span>` stylés, ce qui suffit à un disque et à
 * une pastille. Une forme, une texture ou une grille ne s'écrivent pas en CSS,
 * et rendre du HTML construit par une fonction ouvrirait une injection dans un
 * écran qui n'en a pas besoin. Un rendu reçoit donc un contexte de dessin et
 * la valeur `z`, et il ne rend rien : il dessine. Le composant garde la main
 * sur le DOM.
 */

/**
 * CE QU'UN RENDU VISUEL REÇOIT.
 *
 * `z` est la position sur l'étendue de la dimension, de 0 à 1 — l'unité de la
 * mesure, et non une valeur physique. Un rendu qui aurait besoin de pixels les
 * calcule depuis `largeur` et `hauteur`, qui sont ceux du canevas réel : les
 * coder en dur produirait un stimulus dont la taille dépend de l'écran, donc un
 * seuil qui en dépend aussi.
 */
export interface CadreVisuel {
  ctx: CanvasRenderingContext2D;
  largeur: number;
  hauteur: number;
  z: number;
  /**
   * La référence n'est montrée qu'en partie, et il faut la compléter.
   *
   * Les sept d'origine le font par `clip-path`. Un rendu de canevas doit le
   * faire lui-même, parce que découper après coup effacerait la moitié de ce
   * qu'il vient de dessiner sans savoir si cette moitié portait l'information.
   */
  partiel: boolean;
  /**
   * LE GRIS NEUTRE, imposé aux dimensions qui varient dans le temps.
   *
   * Règle photosensible validée par Alexis. Le champ est fourni par l'appelant
   * plutôt que lu par le rendu : un rendu qui déciderait lui-même de sa couleur
   * pourrait l'oublier, et l'oubli ne se verrait que sur l'écran de quelqu'un.
   */
  grisNeutre: boolean;
}

export type RenduVisuel = (cadre: CadreVisuel) => void;

/**
 * CE QU'UN RENDU SONORE REÇOIT.
 *
 * Il reçoit le contexte audio et rend une promesse : un motif rythmique ou une
 * phrase parlée durent, et l'appelant doit savoir quand c'est fini — sans quoi
 * deux stimulus se chevaucheraient et la personne entendrait un troisième son
 * qui n'est ni l'un ni l'autre.
 */
export interface CadreSonore {
  contexte: AudioContext;
  z: number;
  partiel: boolean;
}

export type RenduSonore = (cadre: CadreSonore) => Promise<void>;

/**
 * Ce qu'une dimension de L5 ajoute au registre d'A : son rendu, et rien d'autre.
 *
 * Déclaré en option sur un type à part, pour que le registre d'A n'ait pas à
 * connaître ces types et qu'une dimension d'origine n'ait pas à porter un champ
 * qui ne la concerne pas.
 */
export interface PorteUnRendu {
  rendu?: RenduVisuel | RenduSonore;
}

/** Le rendu est-il celui d'un son ? Lu sur la modalité, non sur la fonction. */
export function estRenduSonore(
  modalite: 'visuelle' | 'auditive',
  rendu: RenduVisuel | RenduSonore | undefined,
): rendu is RenduSonore {
  return modalite === 'auditive' && rendu !== undefined;
}

/**
 * LE z D'UN STIMULUS, RELU DEPUIS SON ATTRIBUT PHYSIQUE.
 *
 * Un `Stimulus` porte des valeurs physiques — des pixels, des hertz — et pas le
 * `z` dont un rendu a besoin. On ne peut pas le lui demander : il n'y a qu'un
 * nombre par attribut, et l'échelle qui l'a produit vit dans la dimension.
 *
 * On inverse donc l'échelle en cherchant le pas qui redonne la valeur. **La
 * recherche est exacte, et ce n'est pas une approximation heureuse** :
 * `stimulus()` pose `[attribut] = dimension.valeur(pas)` pour un pas entier de
 * la grille, donc la valeur cherchée EST sur la grille, et l'écart du meilleur
 * pas vaut zéro. L'inversion serait fausse si quelqu'un écrivait un attribut à
 * la main sans passer par l'échelle ; c'est pourquoi elle rend aussi l'écart,
 * que l'appelant peut regarder.
 *
 * **Cette fonction vit ici et non dans le composant**, parce qu'un composant
 * Svelte ne s'importe pas depuis un essai : la part subtile du point d'appel
 * serait restée non éprouvée. C'est la seule raison du déplacement.
 */
export function zDepuisLAttribut(
  dimension: { attribut: string; valeur(pas: number): number },
  stimulus: Record<string, unknown>,
  pas: number,
): { z: number; ecart: number } {
  const cible = Number(stimulus[dimension.attribut]);
  if (!Number.isFinite(cible)) {
    throw new Error(
      `Le stimulus ne porte pas d’attribut « ${dimension.attribut} » lisible. ` +
        'Un rendu sans valeur dessinerait un stimulus immobile, et l’essai qui ' +
        'en dépend mesurerait un tirage au sort en se présentant comme une mesure.',
    );
  }
  let meilleur = 0;
  let ecart = Infinity;
  for (let p = 0; p < pas; p += 1) {
    const e = Math.abs(dimension.valeur(p) - cible);
    if (e < ecart) {
      ecart = e;
      meilleur = p;
    }
  }
  return { z: meilleur / (pas - 1), ecart };
}
