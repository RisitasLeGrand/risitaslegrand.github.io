/**
 * Le vocabulaire visuel des corrections, commun à Cog-Training et aux QCM.
 *
 * Un seul jeu de marqueurs pour tous les exercices : la personne apprend une
 * fois ce que veut dire « élément utilisé » ou « exclu », et le reconnaît
 * ensuite partout. C'est la raison d'être de ce fichier — s'il y avait un
 * vocabulaire par famille d'exercice, chaque correction demanderait de
 * réapprendre à lire avant de comprendre.
 *
 * Deux contraintes gouvernent les choix ci-dessous.
 *
 * **Jamais la couleur seule.** Chaque marqueur se distingue par sa *forme* et
 * son *motif de trait* ; la couleur ne fait que renforcer. Un daltonien, une
 * impression en noir et blanc ou un écran mal réglé doivent laisser la
 * correction lisible.
 *
 * **Les couleurs viennent des tokens du thème**, en `var(--etat-…)`, et non de
 * valeurs figées : le schéma suit donc le thème clair ou sombre sans qu'on
 * duplique les composants.
 */

export type Marqueur =
  | 'utilise'
  | 'inutile'
  | 'deduit'
  | 'ta-reponse'
  | 'bonne-reponse'
  | 'possible'
  | 'exclu';

export type Forme = 'disque' | 'cercle' | 'losange' | 'coche' | 'croix' | 'carre' | 'fleche';

export interface StyleMarqueur {
  /** Libellé de légende, en français. */
  libelle: string;
  /** La forme portée par le marqueur — c'est elle qui le distingue. */
  forme: Forme;
  /** Épaisseur du trait associé, en unités du `viewBox`. */
  epaisseur: number;
  /** Motif de tirets, ou `null` pour un trait plein. */
  tirets: string | null;
  /** Hachures de remplissage, pour les surfaces. */
  hachures: boolean;
  /** Glyphe de repli, pour le texte et les lecteurs d'écran. */
  glyphe: string;
  /** Couleur, en token de thème. */
  couleur: string;
  /** Ce que le marqueur veut dire, pour l'alternative textuelle. */
  sens: string;
}

export const MARQUEURS: Record<Marqueur, StyleMarqueur> = {
  utilise: {
    libelle: 'utilisé',
    forme: 'disque',
    epaisseur: 2.4,
    tirets: null,
    hachures: false,
    glyphe: '●',
    couleur: 'var(--etat-action)',
    sens: 'a servi au raisonnement',
  },
  inutile: {
    libelle: 'inutile',
    forme: 'cercle',
    epaisseur: 1,
    tirets: '2 3',
    hachures: false,
    glyphe: '○',
    couleur: 'var(--etat-texte-faible)',
    sens: 'présent dans l’énoncé mais inutile à la déduction',
  },
  deduit: {
    libelle: 'déduit',
    forme: 'fleche',
    epaisseur: 2,
    tirets: '6 4',
    hachures: false,
    glyphe: '⇢',
    couleur: 'var(--etat-action-forte)',
    sens: 'établi par l’étape en cours, et non donné par l’énoncé',
  },
  'ta-reponse': {
    libelle: 'votre réponse',
    forme: 'losange',
    epaisseur: 2,
    tirets: '3 2',
    hachures: true,
    glyphe: '◆',
    couleur: 'var(--etat-accent)',
    sens: 'ce que vous avez répondu',
  },
  'bonne-reponse': {
    libelle: 'bonne réponse',
    forme: 'coche',
    epaisseur: 2.4,
    tirets: null,
    hachures: false,
    glyphe: '✓',
    couleur: 'var(--etat-succes)',
    sens: 'la réponse attendue',
  },
  possible: {
    libelle: 'possible',
    forme: 'carre',
    epaisseur: 1.8,
    tirets: null,
    hachures: false,
    glyphe: '▣',
    couleur: 'var(--etat-succes)',
    sens: 'cette relation reste compatible avec les prémisses',
  },
  exclu: {
    libelle: 'exclu',
    forme: 'croix',
    epaisseur: 2,
    tirets: null,
    hachures: true,
    glyphe: '✗',
    couleur: 'var(--etat-accent)',
    sens: 'cette relation est écartée par les prémisses',
  },
};

export const ORDRE_LEGENDE: Marqueur[] = [
  'utilise',
  'deduit',
  'inutile',
  'possible',
  'exclu',
  'bonne-reponse',
  'ta-reponse',
];

/** Les marqueurs d'un schéma, dans l'ordre stable de la légende. */
export function legende(employes: Iterable<Marqueur>): { marqueur: Marqueur; style: StyleMarqueur }[] {
  const presents = new Set(employes);
  return ORDRE_LEGENDE.filter((m) => presents.has(m)).map((m) => ({
    marqueur: m,
    style: MARQUEURS[m],
  }));
}

/**
 * La phrase que lit un lecteur d'écran à la place du schéma.
 *
 * Elle est obligatoire sur chaque schéma, et elle est **dynamique** comme le
 * reste : on y nomme les entités de l'item, jamais un gabarit à trous.
 */
export function alternative(sujet: string, elements: { nom: string; marqueur: Marqueur }[]): string {
  if (elements.length === 0) return sujet;
  const parts = elements.map((e) => `${e.nom} (${MARQUEURS[e.marqueur].libelle})`);
  const dernier = parts.pop();
  return parts.length > 0
    ? `${sujet} : ${parts.join(', ')} et ${dernier}.`
    : `${sujet} : ${dernier}.`;
}
