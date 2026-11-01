/**
 * L'escalier adaptatif : un seuil de discrimination par paire, plutôt qu'un
 * pourcentage de bonnes réponses.
 *
 * Procédure **3-down-1-up** : TROIS réponses justes de suite resserrent l'écart
 * entre les deux candidats, une erreur l'élargit. Elle converge vers le point
 * où la personne réussit **79,4 %** des essais — 0,5 à la puissance un tiers —
 * bien au-dessus du hasard, qui est ici de 50 %.
 *
 * ## Ce qui a changé le 31 octobre, et pourquoi
 *
 * Cette procédure était **2-down-1-up**, convergeant vers 70,7 %, avec un pas
 * géométrique qui se resserrait par paliers — facteur 2, puis 1,41 après deux
 * inversions, puis 1,19 après quatre. Le prompt 63 aligne le moteur sur la
 * référence de comportement : 3-down, et des facteurs **constants et
 * asymétriques**.
 *
 * **L'asymétrie est le point qui se remarque le moins et qui compte le plus.**
 * L'ancienne version appliquait le MÊME facteur dans les deux sens — on
 * divisait pour resserrer, on multipliait pour élargir. Désormais on resserre
 * de 13 % et l'on élargit de 20 % : une erreur coûte plus qu'une réussite ne
 * rapporte, ce qui est ce qui empêche l'escalier de s'installer trop bas quand
 * la personne devine juste deux fois de suite.
 *
 * **Un seuil est rendu dès quatre inversions** — il en fallait huit. Les
 * premières servent à descendre depuis l'écart initial, mais quatre suffisent
 * à encadrer : attendre huit faisait payer une séance entière avant le premier
 * chiffre. La convergence, elle, demande **six inversions**.
 *
 * ## Ce que la convergence ne mesure plus, et il faut le dire
 *
 * Elle reposait sur la dispersion du log des dernières inversions, plafonnée à
 * 0,1. Le prompt 63 la place sur le NOMBRE d'inversions, et `dispersion`
 * reste exportée parce que le tableau de bord la montre — mais elle ne
 * gouverne plus le statut. C'est un assouplissement, et il est volontaire :
 * une dispersion faible sur six inversions peut venir d'un escalier coincé
 * contre sa borne, ce qui se lit « stabilisé » alors que rien ne l'est.
 *
 * ## L'échelle est z, et non les pas
 *
 * Les écarts sont **en z**, c'est-à-dire en part de l'étendue utile de la
 * dimension, de 0 à 1. Ils étaient en pas jusqu'au 31 octobre — un seuil
 * dépendait donc du découpage choisi, et changer `PAS` aurait changé tous les
 * seuils enregistrés sans que la personne ait rien appris.
 *
 * La grille de 120 points reste, mais au moment de DESSINER : `pasDuZ` y
 * ramène le z du tirage, et c'est la quantification `qz`. L'escalier, lui,
 * ignore la grille.
 *
 * Les trois valeurs viennent de la référence de comportement : départ 0,18,
 * bornes 0,02 et 0,45. Nos anciennes bornes, 1 et 60 pas, valaient 0,0084 et
 * 0,504 : le resserrement est réel, et il est voulu — un écart de la moitié de
 * l'étendue ne mesure plus rien, et un écart de 0,0084 est sous le
 * discriminable de presque tout le monde.
 */
export const REGLAGES = {
  /** Écart initial, en z : largement au-dessus de tout seuil plausible. */
  departDelta: 0.18,
  deltaMinimum: 0.02,
  deltaMaximum: 0.45,
  /** Bonnes réponses consécutives avant de resserrer. Trois : « 3-down ». */
  bonnesRequises: 3,
  /**
   * Les deux facteurs, et ils ne sont pas inverses l'un de l'autre.
   *
   * On resserre de 13 %, on élargit de 20 %. Une erreur coûte donc plus qu'une
   * réussite ne rapporte, et c'est ce qui empêche l'escalier de s'installer
   * trop bas sur une série de devinettes heureuses. Les écrire tous les deux
   * plutôt qu'un seul facteur et son inverse est ce qui rend l'asymétrie
   * visible à la relecture.
   */
  facteurResserre: 0.87,
  facteurElargit: 1.2,
  /** Inversions retenues pour le calcul du seuil. */
  inversionsRetenues: 6,
  /** Inversions nécessaires avant de rendre un seuil. */
  inversionsRequises: 4,
  /** Inversions nécessaires pour dire l'escalier stabilisé. */
  inversionsPourConverger: 6,
} as const;

export type Statut = 'jamais' | 'en-cours' | 'converge';

export interface EtatEscalier {
  /** Écart courant entre le bon candidat et le leurre, en z. */
  delta: number;
  /**
   * LE PLUS PETIT ÉCART QUE CET ESCALIER A LE DROIT DE DEMANDER, en z.
   *
   * Requis, et non facultatif avec `REGLAGES.deltaMinimum` par défaut. Un
   * défaut serait exactement l'exclusion non gardée que ce chantier a déjà
   * payée deux fois : un appelant qui l'oublie mesurerait une dimension
   * discrète au plancher global de 2 %, en silence, en présentant deux
   * stimulus identiques. Requis, le compilateur nomme chaque site.
   *
   * Sa valeur vient de `plancherReel(dimension)` — le plus grossier du
   * plancher de la procédure et du grain mesuré sur le rendu. Elle n'est
   * JAMAIS relue d'un magasin : le plancher est une propriété de la dimension,
   * pas de l'historique de la personne. Un plancher stocké survivrait à un
   * changement du nombre de niveaux et vaudrait alors pour une dimension qui
   * n'existe plus.
   */
  plancher: number;
  /** Bonnes réponses consécutives depuis le dernier changement d'écart. */
  bonnesDeSuite: number;
  /** Écarts relevés à chaque inversion, en z, dans l'ordre. */
  inversions: number[];
  /** Sens du dernier changement d'écart. */
  derniereDirection: 'resserre' | 'elargit' | null;
  essais: number;
  reussis: number;
}

/**
 * LE SEUIL LE PLUS FIN QUE LA PROCÉDURE PEUT ENCADRER.
 *
 * Le double de `deltaMinimum`, et le facteur deux n'est pas une marge de
 * prudence : pour encadrer un seuil, l'escalier doit pouvoir présenter des
 * écarts DE PART ET D'AUTRE de lui. Sous le double de la borne basse, les
 * excursions vers le bas sont tronquées, la moyenne des rebroussements se
 * place au-dessus du seuil vrai, et la mesure surestime l'écart.
 *
 * Le biais est donc vers le HAUT, toujours. C'est la direction protectrice —
 * elle sous-estime ce que la personne distingue —, mais il faut le dire à
 * l'écran, sans quoi un palier à cette valeur se lit comme un palier de
 * l'aptitude.
 *
 * **La constante vit ici, et non dans la vue.** Le tableau de bord écrivait
 * « REGLAGES.deltaMinimum * 2 » dans son propre fichier : un sabotage a montré
 * que supprimer le facteur deux laissait l'écran afficher « 2 % » — un chiffre
 * faux, dans une phrase d'aide, qui ne lève pas. Une vue qui calcule une
 * grandeur de la mesure est une seconde source ; elle lit maintenant un nom.
 */
export const PLANCHER_MESURABLE = REGLAGES.deltaMinimum * 2;

/* ── LE DÉPART D'UN ESCALIER NEUF ──────────────────────────────────────── */

/**
 * LE RAPPORT ENTRE LA DIFFICULTÉ D'UNE TÂCHE ET CELLE DE LA TÂCHE DE BASE.
 *
 * Une personne qui distingue un écart de 4 % sur la tâche de base n'a aucune
 * raison de repartir de 18 % sur une autre : son seuil y sera du même ordre, à
 * un facteur près que la référence de comportement donne par tâche. Partir du
 * seuil connu multiplié par ce facteur épargne la vingtaine d'essais que
 * l'escalier passait à descendre depuis un écart trivialement visible — des
 * essais qui ne mesuraient rien et qui fatiguaient.
 *
 * Les valeurs viennent de la table `RATIO` de la référence (l. 1349), relevée
 * au L0. **Toute tâche absente de la table vaut 1**, et c'est délibéré : une
 * tâche nouvelle part du seuil de référence lui-même, ce qui est l'hypothèse
 * la plus neutre. Une table qui lèverait sur un nom inconnu obligerait à la
 * compléter avant d'ajouter une tâche, et c'est exactement la frontière que ce
 * prompt supprime ailleurs.
 */
export const RATIO_DE_DEPART: Record<string, number> = {
  matching: 0.5,
  coherence: 1.2,
  one_to_many: 1.3,
  sequence: 1.1,
  transposition: 1.2,
  completion: 1.1,
};

/**
 * Les bornes du DÉPART, plus serrées que celles de l'escalier, et pour cause.
 *
 * L'escalier vit entre 0,02 et 0,45. Un départ posé pile sur une de ces bornes
 * laisserait l'escalier sans place : parti à 0,02, il ne peut que remonter, et
 * la première inversion ne serait pas un rebroussement mais un effet de bord.
 * Le départ est donc tenu à l'intérieur — 0,03 en bas, ce qui laisse un cran
 * de resserrement, 0,45 en haut où la borne est déjà celle de l'escalier.
 */
export const DEPART_MINIMUM = 0.03;
export const DEPART_MAXIMUM = REGLAGES.deltaMaximum;

/** Le facteur d'une tâche, ou 1 si la table ne la nomme pas. */
export function ratioDeDepart(exercice: string): number {
  return RATIO_DE_DEPART[exercice] ?? 1;
}

/**
 * L'écart de départ d'un escalier neuf, d'après un seuil déjà mesuré.
 *
 * Sans seuil de référence — personne n'a encore travaillé la tâche de base —
 * on repart du départ général. **Un seuil absent n'est pas un seuil nul** : le
 * confondre avec zéro ferait partir l'escalier contre sa borne basse, où tout
 * est faux et où rien ne lèverait, puisque 0,02 est un écart parfaitement
 * valide.
 *
 * Un seuil non fini ou négatif est traité comme absent. Il ne peut pas venir
 * de `seuil()`, qui rend une moyenne géométrique de valeurs positives ; il
 * peut venir d'un magasin, d'un import, ou d'une version future — et c'est
 * précisément ce qu'on ne veut pas voir arriver jusqu'au départ d'une mesure.
 */
export function departPour(exercice: string, seuilDeReference: number | null): number {
  if (seuilDeReference === null || !Number.isFinite(seuilDeReference) || seuilDeReference <= 0) {
    return REGLAGES.departDelta;
  }
  const vise = seuilDeReference * ratioDeDepart(exercice);
  return Math.min(DEPART_MAXIMUM, Math.max(DEPART_MINIMUM, vise));
}

/**
 * LE PLANCHER EST-IL UN PLANCHER ? On refuse plutôt que de le remplacer.
 *
 * Trois refus, et chacun fermerait une panne muette :
 *
 * - **non fini** : un plancher `NaN` rendrait tous les `Math.max` égaux à
 *   `NaN`, l'escalier descendrait sans borne et le seuil serait `NaN` —
 *   affiché, un `NaN` ne rougit pas, il s'affiche.
 * - **sous le plancher global** : la procédure ne sait pas encadrer un seuil
 *   sous 2 × `deltaMinimum`. Un plancher plus bas serait une permission de
 *   mesurer ce qui ne se mesure pas.
 * - **au-dessus de l'écart maximum** : l'escalier n'aurait aucune place pour
 *   se mouvoir, les trois bonnes réponses ne resserreraient rien, et il
 *   rendrait un seuil égal à son départ sans avoir rien mesuré. Une dimension
 *   dans ce cas est à écarter — ce que dit `raisonDInaptitude` — et non à
 *   mesurer quand même.
 *
 * Lever est ici le bon comportement, et c'est l'inverse de la règle usuelle du
 * chantier : un analyseur cassé doit rendre zéro plutôt que lever, mais un
 * plancher inadmissible n'est pas une absence de mesure, c'est une mesure qui
 * se croit valide. La remplacer en silence par le plancher global est
 * précisément ce qu'on veut rendre impossible.
 */
export function verifierLePlancher(plancher: number): void {
  if (!Number.isFinite(plancher)) {
    throw new Error(
      `Plancher d’escalier non fini : ${plancher}. Il vient de ` +
        '« plancherReel(dimension) », qui ne rend jamais cela : la valeur a été ' +
        'calculée ailleurs, ou relue d’un magasin — ce qui est interdit.',
    );
  }
  if (plancher < REGLAGES.deltaMinimum) {
    throw new Error(
      `Plancher d’escalier à ${plancher}, sous la borne basse de l’escalier ` +
        `${REGLAGES.deltaMinimum}. Un plancher plus bas que le mouvement lui-même ne ` +
        'borne rien : il serait une permission de descendre sans limite.',
    );
  }
  if (plancher > REGLAGES.deltaMaximum) {
    throw new Error(
      `Plancher d’escalier à ${plancher}, au-dessus de l’écart maximum ` +
        `${REGLAGES.deltaMaximum}. L’escalier n’aurait aucune place pour se mouvoir : ` +
        'il rendrait son départ comme seuil. Cette dimension est à écarter, pas à mesurer.',
    );
  }
}

/**
 * L'ESCALIER EST-IL ARRIVÉ AU PLUS FIN QUE CETTE DIMENSION MONTRE ?
 *
 * Vrai quand un resserrement de plus ne descendrait plus. On compare au
 * plancher et non à `deltaMinimum`, et c'est tout l'objet du lot : sur une
 * dimension discrète, l'escalier bute sur le grain AVANT d'avoir trouvé le
 * seuil de la personne. Dire alors « vous ne faites pas mieux » attribuerait à
 * la personne une limite de l'appareil — la phrase à montrer est celle de
 * `phraseDuPlusFin`, qui le dit dans l'autre sens.
 *
 * La comparaison porte sur le resserrement À VENIR, non sur l'écart courant :
 * un escalier posé pile au plancher n'y est pas encore coincé — il peut encore
 * s'élargir —, mais il ne peut plus descendre, et c'est cela qu'il faut dire.
 */
export function estAuPlusFin(etat: EtatEscalier): boolean {
  return etat.delta * REGLAGES.facteurResserre < etat.plancher;
}

/**
 * Un escalier neuf, parti de l'écart donné — ou du départ général.
 *
 * L'écart est ramené dans les bornes de l'escalier, et non seulement dans
 * celles du départ : `departPour` rend déjà une valeur admissible, mais un
 * appelant qui calculerait son départ autrement ne doit pas pouvoir poser un
 * escalier hors bornes. Le premier `repondre` l'y ramènerait de toute façon,
 * en silence et une réponse trop tard.
 */
export function escalierNeuf(depart: number, plancher: number): EtatEscalier {
  verifierLePlancher(plancher);
  return {
    delta: Math.min(REGLAGES.deltaMaximum, Math.max(plancher, depart)),
    plancher,
    bonnesDeSuite: 0,
    inversions: [],
    derniereDirection: null,
    essais: 0,
    reussis: 0,
  };
}

/**
 * Enregistre une réponse et rend le nouvel état.
 *
 * L'inversion est relevée **au moment où le sens change**, et l'écart consigné
 * est celui qui précède le changement : c'est le point de rebroussement, et
 * c'est lui qui encadre le seuil.
 */
export function repondre(etat: EtatEscalier, juste: boolean): EtatEscalier {
  verifierLePlancher(etat.plancher);
  const suivant: EtatEscalier = {
    ...etat,
    inversions: [...etat.inversions],
    essais: etat.essais + 1,
    reussis: etat.reussis + (juste ? 1 : 0),
  };

  if (juste) {
    suivant.bonnesDeSuite = etat.bonnesDeSuite + 1;
    // Trois bonnes de suite avant de resserrer : c'est ce qui fait la règle
    // « 3-down » et place le point de convergence à 79,4 %.
    if (suivant.bonnesDeSuite < REGLAGES.bonnesRequises) return suivant;
    suivant.bonnesDeSuite = 0;
    if (etat.derniereDirection === 'elargit') suivant.inversions.push(etat.delta);
    suivant.derniereDirection = 'resserre';
    suivant.delta = Math.max(etat.plancher, etat.delta * REGLAGES.facteurResserre);
    return suivant;
  }

  suivant.bonnesDeSuite = 0;
  if (etat.derniereDirection === 'resserre') suivant.inversions.push(etat.delta);
  suivant.derniereDirection = 'elargit';
  suivant.delta = Math.min(REGLAGES.deltaMaximum, etat.delta * REGLAGES.facteurElargit);
  return suivant;
}

/** Les dernières inversions retenues pour le seuil. */
function dernieres(etat: EtatEscalier): number[] {
  return etat.inversions.slice(-REGLAGES.inversionsRetenues);
}

/**
 * Le seuil, **en z** — donc comparable d'une dimension à l'autre, et d'une
 * version du logiciel à l'autre, puisqu'il ne dépend plus du découpage de la
 * grille. Rend `null` tant que les inversions requises ne sont pas atteintes.
 */
export function seuil(etat: EtatEscalier): number | null {
  if (etat.inversions.length < REGLAGES.inversionsRequises) return null;
  const retenues = dernieres(etat);
  const somme = retenues.reduce((total, valeur) => total + Math.log(valeur), 0);
  return Math.exp(somme / retenues.length);
}

/** Dispersion des dernières inversions, en log décimal. */
export function dispersion(etat: EtatEscalier): number | null {
  const retenues = dernieres(etat);
  if (retenues.length < REGLAGES.inversionsRetenues) return null;
  const logs = retenues.map((valeur) => Math.log10(valeur));
  const moyenne = logs.reduce((total, valeur) => total + valeur, 0) / logs.length;
  const variance =
    logs.reduce((total, valeur) => total + (valeur - moyenne) ** 2, 0) / logs.length;
  return Math.sqrt(variance);
}

export function statut(etat: EtatEscalier): Statut {
  if (!etat.essais) return 'jamais';
  /*
     SIX INVERSIONS, ET RIEN D'AUTRE. La dispersion ne gouverne plus le statut
     — voir l'en-tête : une dispersion faible peut venir d'un escalier coincé
     contre sa borne, ce qui se lirait « stabilisé » alors que rien ne l'est.
     `dispersion` reste exportée, et le tableau de bord la montre.
  */
  if (etat.inversions.length >= REGLAGES.inversionsPourConverger) return 'converge';
  return 'en-cours';
}

export const INTITULES_STATUT: Record<Statut, string> = {
  jamais: 'jamais travaillée',
  'en-cours': 'en cours',
  converge: 'stabilisée',
};

/* ── LA REPRISE D'UNE MESURE ÉCRITE AVANT LE 1er NOVEMBRE 2026 ──────────── */

/**
 * La forme minimale qu'une ligne enregistrée doit avoir pour être reprise.
 *
 * Volontairement structurelle et non importée de `db.ts` : l'escalier ne doit
 * rien savoir du magasin, et la reprise se contrôle alors sans base.
 */
/**
 * UN ESCALIER TEL QU'IL DORT DANS LE MAGASIN : son plancher y est FACULTATIF.
 *
 * L'invariant n'est pas « le plancher n'est jamais écrit » — un état gardé en
 * mémoire finit dans le magasin, et une règle qui demande de l'en retirer
 * avant chaque écriture serait oubliée un jour. L'invariant est **le plancher
 * n'est jamais CRU à la lecture** : `reprendreUnSeuil` le repose d'après la
 * dimension, qu'il soit écrit ou non, et la valeur stockée ne sert jamais.
 *
 * Cette formulation-là, le code la fait respecter tout seul. L'autre reposait
 * sur la vigilance de chaque appelant, ce qui n'est pas une garde.
 */
export type EscalierStocke = Omit<EtatEscalier, 'plancher'> & { plancher?: number };

/** Une ligne telle qu'elle dort dans le magasin. */
export interface SeuilStocke {
  escalier: EscalierStocke;
  seuil: number | null;
  statut: Statut;
  echelle?: 'pas' | 'z';
  regle?: '2-down' | '3-down';
  ancienneMesure?: number | null;
}

/** La même, relue : son escalier porte son plancher. */
export interface SeuilRepris {
  escalier: EtatEscalier;
  seuil: number | null;
  statut: Statut;
  echelle?: 'pas' | 'z';
  regle?: '2-down' | '3-down';
  ancienneMesure?: number | null;
}

/**
 * REPREND UNE MESURE ENREGISTRÉE, ET REFUSE DE MÉLANGER DEUX RÈGLES.
 *
 * ## Le défaut que cette fonction existe pour empêcher
 *
 * Le 1er novembre 2026, deux choses ont changé d'un coup : l'unité des écarts
 * — des pas vers `z` — et la règle de l'escalier — 2-down vers 3-down. Les
 * deux touchent des valeurs **enregistrées**.
 *
 * Sans cette reprise, le code neuf relirait les anciennes lignes comme si elles
 * étaient neuves, et de deux façons fausses à la fois : un seuil de 7,3 pas se
 * lirait 730 % de l'étendue, seize fois la borne haute de l'escalier ; et un
 * escalier 2-down se poursuivrait sous les règles du 3-down, rendant un seuil
 * qui ne mesure ni les 70,7 % de l'un ni les 79,4 % de l'autre.
 *
 * Aucune des deux n'aurait levé. La première aurait donné des cellules à
 * « 730 % », qu'on aurait prises pour un défaut d'affichage ; la seconde
 * n'aurait rien donné du tout, qu'un nombre un peu faux.
 *
 * ## Ce qu'elle fait, et ce qu'elle ne fait pas
 *
 * Elle CONVERTIT ce qui est en pas, et elle REPART de zéro quand la règle a
 * changé — décision du pilote : les anciennes mesures sont gardées, affichées
 * « ancienne mesure », et chaque paire repart d'un escalier neuf.
 *
 * Elle ne réécrit **rien** dans le magasin : c'est une lecture. La réécriture
 * est la migration, et elle attend le prompt 58 p2. La lecture, elle, ne peut
 * pas attendre, puisque le code qui lit est déjà le nouveau.
 *
 * **Elle est idempotente**, et c'est éprouvé : une ligne déjà reprise porte
 * `echelle: 'z'` et `regle: '3-down'`, et ressort inchangée. Sans cette
 * propriété, deux lectures successives diviseraient deux fois par 119.
 */
export function reprendreUnSeuil(
  ligne: SeuilStocke,
  pasParEtendue: number,
  plancher: number,
): SeuilRepris {
  verifierLePlancher(plancher);
  const enPas = ligne.echelle !== 'z';
  const ancienneRegle = ligne.regle !== '3-down';
  /*
     LE PLANCHER NE SE RELIT PAS DU MAGASIN, il est recalculé à chaque lecture.

     Une ligne déjà reprise ressort donc inchangée SAUF son plancher, qui est
     reposé. C'est voulu, et c'est ce qui préserve l'idempotence utile : deux
     lectures successives donnent le même objet, et une dimension dont le
     nombre de niveaux a changé depuis l'écriture ne traîne pas un plancher
     périmé. Un plancher stocké CRU serait une mesure du passé appliquée au
     présent — la faute exacte que « PAS_HISTORIQUE » a coûtée ailleurs. Écrit,
     il est inoffensif ; relu comme vrai, il ne l'est pas.
  */
  if (!enPas && !ancienneRegle) {
    /*
       La condition PROUVE que le plancher est déjà posé et qu'il est le bon :
       la ligne est donc déjà une ligne reprise, et c'est le seul endroit où
       elle ressort à l'identique — ce que l'essai d'idempotence vérifie par
       identité d'objet, et non par égalité de contenu.
    */
    if (ligne.escalier.plancher === plancher) return ligne as SeuilRepris;
    return {
      ...ligne,
      escalier: {
        ...ligne.escalier,
        plancher,
        delta: Math.max(plancher, ligne.escalier.delta),
      },
    };
  }

  /* La conversion : un écart en pas devient une part de l'étendue. */
  const enZ = (valeur: number): number => (enPas ? valeur / pasParEtendue : valeur);

  /*
     L'ANCIENNE MESURE EST GARDÉE, convertie, et elle n'alimente plus aucun
     calcul. La mêler au nouveau seuil serait moyenner deux points différents
     de la courbe psychométrique — c'est exactement ce que la décision du
     pilote interdit.
  */
  if (ancienneRegle) {
    return {
      escalier: escalierNeuf(REGLAGES.departDelta, plancher),
      seuil: null,
      statut: 'jamais',
      echelle: 'z',
      regle: '3-down',
      ancienneMesure: ligne.seuil === null ? null : enZ(ligne.seuil),
    };
  }

  /* Même règle, autre unité : on convertit sans rien perdre. */
  return {
    ...ligne,
    escalier: {
      ...ligne.escalier,
      plancher,
      /*
         L'écart COURANT est relevé au plancher s'il est passé dessous ; les
         INVERSIONS ne sont pas réécrites. Une inversion est une mesure déjà
         prise, et la remonter inventerait un rebroussement qui n'a pas eu
         lieu. Si elle a été relevée sous le grain de la dimension, c'est le
         seuil entier qui est sans objet, et c'est au tableau de bord de le
         dire — pas à une conversion d'unité de le maquiller.
      */
      delta: Math.max(plancher, enZ(ligne.escalier.delta)),
      inversions: ligne.escalier.inversions.map(enZ),
    },
    seuil: ligne.seuil === null ? null : enZ(ligne.seuil),
    echelle: 'z',
    regle: '3-down',
  };
}
