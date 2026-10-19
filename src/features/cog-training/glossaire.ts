/**
 * Le glossaire de la branche : le mot simple d'abord, le terme technique après.
 *
 * ## La décision, et ce qu'elle refuse des deux côtés
 *
 * Décision 8 d'Alexis : garder les deux termes. Ce n'est pas un compromis mou,
 * c'est un refus de deux solutions qui se valent mal.
 *
 * Retirer le terme technique priverait de la seule chose qui permette de
 * retrouver la notion ailleurs — on ne cherche pas « le plus petit écart que
 * vous distinguez » dans un manuel, on y cherche « seuil ». Retirer le mot
 * simple, c'est l'état qu'on corrige : un écran qui parle d'isomorphisme
 * partiel à quelqu'un qui découvre l'exercice.
 *
 * Donc les deux, et dans cet ordre : **le mot simple porte le sens, le terme
 * technique sert d'adresse.**
 *
 * ## Pourquoi une table, et non des phrases écrites sur place
 *
 * « Seuil » paraît dans trois écrans et « pas » dans deux. Écrits à la main,
 * les équivalents divergent au premier qui corrige l'un sans voir les autres —
 * et c'est exactement le constat C3 : plusieurs mots pour une même chose. La
 * table est la seule source, et l'essai de la branche s'en sert pour vérifier
 * qu'aucun terme n'apparaît seul.
 *
 * ## Deux entrées manquent, et c'est voulu
 *
 * « Item » et « échelon » ne sont pas des notions : ce sont de mauvais mots
 * pour « question » et « niveau ». Le prompt les fait remplacer SANS
 * parenthèse (P10), parce qu'une parenthèse sous-entendrait qu'il y a quelque
 * chose à apprendre derrière. Ils ne sont donc pas ici.
 *
 * Les définitions sont celles du tableau de l'audit, mot pour mot.
 */

export interface Terme {
  /** Le terme technique, tel qu'il s'écrit. */
  technique: string;
  /** L'équivalent simple, qui porte le sens. */
  simple: string;
  /** La définition, pour le glossaire et la bulle. */
  definition: string;
  /** L'exercice où il paraît, pour ranger le glossaire. */
  ou: 'memoire' | 'raisonnement' | 'correspondance';
  /**
   * Comment reconnaître le terme dans du texte, quand son nom nu ne suffit
   * pas.
   *
   * Deux entrées en ont besoin, et l'essai de vocabulaire l'a appris de
   * force : « n » attrape tout mot commençant par n — « ne », « niveau »,
   * « n'y » —, et « pas » attrape l'adverbe, qui est l'un des mots les plus
   * fréquents de la langue. Sans motif, l'essai rougissait vingt fois sur un
   * écran irréprochable.
   */
  motif?: RegExp;
}

export const GLOSSAIRE: Terme[] = [
  {
    technique: 'n',
    simple: 'tours en arrière',
    definition: 'Comparer avec ce qu’on a vu n tours plus tôt.',
    ou: 'memoire',
    /* Le terme ne s'écrit à l'écran que sous la forme « n = 2 ». */
    motif: /\bn\s*=/,
  },
  {
    technique: 'amorçage',
    simple: 'premiers tours',
    definition: 'Premiers tours : rien à comparer encore.',
    ou: 'memoire',
  },
  {
    technique: 'interférence',
    simple: 'presque juste',
    definition: 'Une répétition presque juste, décalée d’un tour, pour vous tromper.',
    ou: 'memoire',
  },
  {
    technique: 'algèbre',
    simple: 'la règle que suit une relation',
    definition: 'La règle que suit une relation.',
    ou: 'raisonnement',
  },
  {
    technique: 'symétrique',
    simple: 'vrai dans les deux sens',
    definition: 'Si A l’est de B, B l’est de A.',
    ou: 'raisonnement',
  },
  {
    technique: 'transitif',
    simple: 'se propage de proche en proche',
    definition: 'Si A l’est de B et B de C, alors A l’est de C.',
    ou: 'raisonnement',
  },
  {
    technique: 'prémisse',
    simple: 'un fait de départ',
    definition: 'Un fait de départ.',
    ou: 'raisonnement',
  },
  {
    technique: 'isomorphisme',
    simple: 'la même structure',
    definition: 'La même structure sous d’autres noms.',
    ou: 'raisonnement',
  },
  {
    technique: 'seuil',
    simple: 'le plus petit écart que vous distinguez',
    definition: 'Le plus petit écart que vous distinguez.',
    ou: 'correspondance',
  },
  {
    technique: 'pas',
    simple: 'unité d’écart',
    definition: 'L’unité d’écart de l’exercice, la même pour toutes les échelles.',
    ou: 'correspondance',
    /* Un compte de pas, et non l'adverbe : « 7 pas », « écart 3 pas ». */
    motif: /\d\s*pas\b/,
  },
  {
    technique: 'escalier',
    simple: 'l’écart qui se resserre',
    definition:
      'L’écart se resserre quand vous réussissez, s’élargit quand vous vous trompez.',
    ou: 'correspondance',
  },
  {
    technique: 'arête',
    simple: 'paire',
    definition: 'Une paire d’échelles mises en correspondance.',
    ou: 'correspondance',
  },
  {
    technique: 'arbre couvrant',
    simple: 'les paires qui relient tout',
    definition: 'Juste assez de paires pour relier toutes les échelles.',
    ou: 'correspondance',
  },
  {
    technique: 'prothétique',
    simple: 'combien',
    definition: 'Combien : les échelles qui mesurent une quantité.',
    ou: 'correspondance',
  },
  {
    technique: 'métathétique',
    simple: 'où',
    definition: 'Où : les échelles qui mesurent une position.',
    ou: 'correspondance',
  },
  {
    technique: 'transmodale',
    simple: 'entre la vue et l’ouïe',
    definition: 'Entre la vue et l’ouïe.',
    ou: 'correspondance',
  },
  {
    technique: 'charge',
    simple: 'correspondances par écran',
    definition: 'Nombre de correspondances par écran.',
    ou: 'correspondance',
  },
];

/** Les termes d'un exercice, dans l'ordre de la table. */
export const termesDe = (ou: Terme['ou']): Terme[] => GLOSSAIRE.filter((t) => t.ou === ou);

/**
 * La forme écrite : « le mot simple (le terme technique) ».
 *
 * Rendue par une fonction et non recopiée, pour que l'ordre et la ponctuation
 * ne varient pas d'un écran à l'autre — c'est l'ordre qui porte la décision.
 */
export const enClair = (terme: Terme): string => `${terme.simple} (${terme.technique})`;
