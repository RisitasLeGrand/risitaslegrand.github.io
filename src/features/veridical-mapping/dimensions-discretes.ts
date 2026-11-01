/**
 * LES TRENTE-DEUX DIMENSIONS DISCRÈTES, DÉCLARÉES.
 *
 * Prompt 63. Décision du pilote du 1er novembre : « Chacune de nos dimensions
 * discrètes DÉCLARE son nombre de niveaux et dit si elle est circulaire. Les
 * valeurs viennent de ta fiche. Un essai vérifie que la déclaration et la
 * fiche concordent pour les 32. »
 *
 * ## CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS
 *
 * Il ne déclare ni rendu, ni plage, ni fonction `valeur` : ces dimensions ne
 * sont pas encore dans le registre, et B a eu raison de ne pas les inventer.
 * Il ne porte que les deux nombres dont la MESURE dépend — le nombre de
 * niveaux et le rebouclage — et qui ensemble donnent le grain, donc le
 * plancher. Quand les dimensions arriveront avec leur rendu, c'est ce fichier
 * qui dira ce que chacune doit montrer, et `grainMesure` dira ce qu'elle
 * montre pour de vrai.
 *
 * ## CE QUE L'ESSAI DE CONCORDANCE ATTRAPE, ET CE QU'IL LAISSE PASSER
 *
 * Les valeurs ci-dessous ont été **transcrites à la main** depuis
 * `docs/cyclades/p63-dimensions-reference.md`, et `essais:fiche-dimensions`
 * relit la fiche pour les comparer ligne par ligne. Il attrape donc toute
 * faute de transcription — un 12 pour un 16, un `circ` oublié — et c'est le
 * genre de faute qu'une relecture ne voit pas.
 *
 * **Il n'attrape pas une erreur de la fiche elle-même**, puisque les deux
 * côtés en descendent. Le dire est la seule façon de ne pas faire passer cette
 * concordance pour une validation : la fiche fait foi parce que le pilote l'a
 * déclarée telle, pas parce qu'un essai la confirme. Ce qui la confirmera est
 * le rendu, le jour où il existera — et c'est `desaccordDeNiveaux` qui tiendra
 * ce contrôle-là.
 *
 * ## POURQUOI AUCUNE N'EST ÉCARTÉE
 *
 * Toutes ont trois niveaux ou plus. Le critère de refus est celui du pilote —
 * « on ne rejette que les dimensions de moins de 3 niveaux » — et non la
 * capacité de l'escalier à les encadrer : une dimension à sept niveaux ne se
 * mesure pas par escalier, mais elle se mesure par IDENTIFICATION, et c'est
 * le lot L6. Confondre les deux l'aurait supprimée du chantier.
 */
import type { DimensionL5 } from './dimensions-l5';

/** Ce que la fiche de référence porte en plus, et qui sert à la concordance. */
export interface DimensionDiscrete extends DimensionL5 {
  niveaux: number;
  /** L'échelle, telle que la fiche la note : `lin`, `log` ou `circ`. */
  echelle: 'lin' | 'log' | 'circ';
  /**
   * Le PIRE grain sur la plage, en z — celui que la fiche imprime.
   *
   * Pour une échelle régulière il se déduit du nombre de niveaux. Pour une
   * échelle logarithmique il ne se déduit pas : il se mesure sur la plage, et
   * il est le plus grossier en bas. Les deux cas logarithmiques portent donc
   * ici un nombre qu'aucune formule ne redonne, et c'est la raison d'être de
   * ce champ.
   */
  pireGrain: number;
}

/* eslint-disable prettier/prettier */
export const DIMENSIONS_DISCRETES: DimensionDiscrete[] = [
  /* ── Vision ─────────────────────────────────────────────────────────── */
  { id: 'vision.numerosity',           niveaux: 49, echelle: 'log',  circulaire: false, pireGrain: 0.097 },
  { id: 'vision.flash_count',          niveaux: 9,  echelle: 'lin',  circulaire: false, pireGrain: 0.125 },
  { id: 'vision.polygon_sides',        niveaux: 6,  echelle: 'lin',  circulaire: false, pireGrain: 0.2   },
  { id: 'vision.hole_count',           niveaux: 6,  echelle: 'lin',  circulaire: false, pireGrain: 0.2   },
  { id: 'vision.nesting_depth',        niveaux: 5,  echelle: 'lin',  circulaire: false, pireGrain: 0.25  },
  { id: 'vision.rotational_symmetry',  niveaux: 6,  echelle: 'lin',  circulaire: false, pireGrain: 0.2   },
  { id: 'vision.divisor_richness',     niveaux: 7,  echelle: 'lin',  circulaire: false, pireGrain: 0.167 },
  { id: 'vision.period_length',        niveaux: 8,  echelle: 'lin',  circulaire: false, pireGrain: 0.143 },
  { id: 'vision.recursion_depth',      niveaux: 5,  echelle: 'lin',  circulaire: false, pireGrain: 0.25  },
  { id: 'vision.accent_phase',         niveaux: 6,  echelle: 'circ', circulaire: true,  pireGrain: 0.167 },
  { id: 'vision.motif_rotation',       niveaux: 16, echelle: 'circ', circulaire: true,  pireGrain: 0.062 },
  { id: 'vision.weekday',              niveaux: 7,  echelle: 'circ', circulaire: true,  pireGrain: 0.143 },
  { id: 'vision.month',                niveaux: 12, echelle: 'circ', circulaire: true,  pireGrain: 0.083 },
  { id: 'vision.clock_hour',           niveaux: 12, echelle: 'circ', circulaire: true,  pireGrain: 0.083 },
  { id: 'vision.compass_point',        niveaux: 8,  echelle: 'circ', circulaire: true,  pireGrain: 0.125 },
  { id: 'vision.note_name',            niveaux: 7,  echelle: 'circ', circulaire: true,  pireGrain: 0.143 },
  { id: 'vision.letter',               niveaux: 26, echelle: 'lin',  circulaire: false, pireGrain: 0.04  },
  { id: 'vision.number',               niveaux: 20, echelle: 'lin',  circulaire: false, pireGrain: 0.053 },
  /* ── Audition ───────────────────────────────────────────────────────── */
  { id: 'audition.event_count',          niveaux: 15, echelle: 'log',  circulaire: false, pireGrain: 0.24  },
  { id: 'audition.spectral_complexity',  niveaux: 14, echelle: 'lin',  circulaire: false, pireGrain: 0.077 },
  { id: 'audition.divisor_richness',     niveaux: 7,  echelle: 'lin',  circulaire: false, pireGrain: 0.167 },
  { id: 'audition.period_length',        niveaux: 8,  echelle: 'lin',  circulaire: false, pireGrain: 0.143 },
  { id: 'audition.recursion_depth',      niveaux: 5,  echelle: 'lin',  circulaire: false, pireGrain: 0.25  },
  { id: 'audition.accent_phase',         niveaux: 6,  echelle: 'circ', circulaire: true,  pireGrain: 0.167 },
  { id: 'audition.motif_rotation',       niveaux: 16, echelle: 'circ', circulaire: true,  pireGrain: 0.062 },
  { id: 'audition.weekday',              niveaux: 7,  echelle: 'circ', circulaire: true,  pireGrain: 0.143 },
  { id: 'audition.month',                niveaux: 12, echelle: 'circ', circulaire: true,  pireGrain: 0.083 },
  { id: 'audition.clock_hour',           niveaux: 12, echelle: 'circ', circulaire: true,  pireGrain: 0.083 },
  { id: 'audition.compass_point',        niveaux: 8,  echelle: 'circ', circulaire: true,  pireGrain: 0.125 },
  { id: 'audition.note_name',            niveaux: 7,  echelle: 'circ', circulaire: true,  pireGrain: 0.143 },
  { id: 'audition.letter',               niveaux: 26, echelle: 'lin',  circulaire: false, pireGrain: 0.04  },
  { id: 'audition.number',               niveaux: 20, echelle: 'lin',  circulaire: false, pireGrain: 0.053 },
];
/* eslint-enable prettier/prettier */

/**
 * LE NOMBRE DE NIVEAUX AU-DESSOUS DUQUEL UNE DIMENSION EST ÉCARTÉE.
 *
 * Décision du pilote : trois. En dessous, il n'y a pas de quoi présenter un
 * écart de part et d'autre d'un seuil — deux niveaux n'offrent qu'un seul
 * écart non nul, et un escalier qui ne peut pas rebrousser ne mesure rien.
 *
 * **Ce seuil-ci ne dit pas « mesurable par escalier ».** Une dimension à sept
 * niveaux a un grain de 14 %, donc un seul écart présentable sous un départ à
 * 18 % : l'escalier ne l'encadre pas. Elle n'est pas écartée pour autant, elle
 * change de tâche — identification, lot L6. Les deux critères sont donc deux
 * fonctions, et les confondre a failli supprimer sept dimensions du chantier.
 */
export const NIVEAUX_MINIMUM = 3;
