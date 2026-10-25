/**
 * Les cycles, les statistiques de la personne, les fenêtres passées.
 *
 *   npm run essais:cycles
 *
 * ## Ce module ne calcule rien aujourd'hui, et c'est son objet
 *
 * La décision 24 du plan de phase 0 : les paramètres de produit sont
 * « proposés chiffrés en phase 3, **aucun appliqué avant ta réponse** ». Le
 * prompt 30 le redit pour chacun : « chacun étiqueté "règle de produit",
 * testé, soumis à moi ». Alexis n'a pas répondu.
 *
 * Il aurait été facile de ne rien écrire et d'attendre. Il aurait été facile
 * aussi d'écrire l'algorithme avec les valeurs proposées « en attendant », ce
 * qui aurait appliqué la décision 24 à l'envers : un chiffre posé par un
 * programme et habillé d'un commentaire reste un chiffre appliqué.
 *
 * Ce module fait un troisième choix, et c'est le seul qui tienne les deux
 * bouts :
 *
 * - **l'algorithme est écrit et mesuré**, mais il reçoit ses chiffres en
 *   paramètres explicites. Les essais l'exercent avec des chiffres d'essai qui
 *   ne sont PAS les valeurs proposées, pour qu'aucune proposition ne se glisse
 *   dans une mesure et réciproquement ;
 * - **les portes publiques refusent**. Elles demandent `parametre()`, qui rend
 *   `null` tant qu'un paramètre n'est pas tranché, et rendent alors
 *   `{ impossible: 'parametres-non-tranches', manquants: [...] }`.
 *
 * Donc : rien ne s'affiche, rien n'est deviné, et le jour où Alexis répond, il
 * suffit de passer `applique: true` avec sa valeur. Un essai balaie le module
 * et rougit si un calcul lit une valeur proposée.
 *
 * ## Ce qui n'est pas ici, et ne le sera jamais
 *
 * Aucune prévision. Les fenêtres sont **passées** : 4.5 l'écrit deux fois —
 * « ces fenêtres ne s'établissent qu'a posteriori, sur des cycles dont le J1
 * suivant est observé » et « aucune fenêtre "avant les règles" n'est affichée
 * pour le futur ni pour le cycle en cours ». La décision 12 est non levable :
 * pas de fenêtre fertile, pas d'ovulation prédite, pas de conseil de
 * contraception.
 *
 * **Pas de phase folliculaire ni lutéale** non plus (4.5) : elles ne se
 * déduisent pas d'un calendrier. Elles demanderaient des marqueurs
 * d'ovulation saisis (phase 8), et seraient alors étiquetées « estimée ».
 *
 * Aucune comparaison à une population : décision 16, « contexte affiché
 * seulement », et 0.4 du prompt — « ma propre base est la seule référence
 * défendable ». Les repères publiés du 4.4.3 (FIGO) **ne sont pas ici** : ils
 * demandent une vérification à la source que personne n'a faite, et le prompt
 * l'écrit lui-même (« re-vérifie chaque nombre à la source »).
 */
import { ORDRE_DES_NIVEAUX, type NiveauDeSaignement, type SaisieDuCycle } from './cycle';

/* ══════════════════════════════════════════════════════════════════════════
   Les paramètres, proposés et non appliqués
   ══════════════════════════════════════════════════════════════════════════ */

export interface ParametreDuSuivi {
  /** L'identifiant, pour que la réponse d'Alexis se raccroche sans ambiguïté. */
  cle: string;
  /** Ce que le chiffre décide, en une phrase. */
  intitule: string;
  /** La valeur proposée. **Jamais lue par un calcul tant que `applique` est faux.** */
  propose: number;
  unite: 'jours' | 'cycles' | 'mois';
  /** Pourquoi cette valeur-là, et ce que l'écran dit si elle change. */
  motivation: string;
  /**
   * Faux tant qu'Alexis n'a pas répondu.
   *
   * Il n'y a pas de champ « valeur retenue » séparé : le jour où la réponse
   * arrive, `propose` devient la valeur et `applique` passe à vrai. Deux
   * champs auraient permis l'état incohérent « appliqué, mais quelle
   * valeur ? ».
   */
  applique: boolean;
}

/**
 * Les huit chiffres qu'Alexis doit trancher.
 *
 * Chacun est motivé, et chaque motivation dit **ce qui change si on prend
 * autrement** — c'est ce qui permet de répondre sans relire le code.
 *
 * Ils sont proposés dans
 * `docs/cyclades/decisions-en-attente-cycle-2026-10-19.md`, section 3, dans
 * les mêmes termes. Un essai vérifie que les deux listes concordent : une
 * proposition qui changerait ici sans changer là laisserait Alexis répondre à
 * une question qui n'est plus posée.
 */
export const PARAMETRES_DU_SUIVI: readonly ParametreDuSuivi[] = [
  {
    cle: 'jours-pour-ouvrir',
    intitule:
      'Combien de jours de saignement consécutifs, au moins « Légers », ouvrent un cycle.',
    propose: 2,
    unite: 'jours',
    motivation:
      'La décision 8 exclut les « traces isolées », et « isolé » demande un chiffre. Deux jours ' +
      'écartent le saignement d’un jour sans écarter des règles courtes, qui existent. À un jour, ' +
      'un saignement isolé ouvrirait un cycle et fausserait toutes les durées ; à trois, des ' +
      'règles de deux jours ne seraient jamais comptées et l’écran dirait « aucun cycle » à ' +
      'quelqu’un qui en a.',
    applique: false,
  },
  {
    cle: 'ecart-minimal-entre-j1',
    intitule: 'L’écart minimal entre deux J1 pour compter deux cycles et non un seul.',
    propose: 15,
    unite: 'jours',
    motivation:
      'Sans ce seuil, un saignement de milieu de cycle ouvrirait un second cycle et diviserait ' +
      'la durée par deux. Quinze jours est la moitié d’un cycle de trente : en dessous, deux ' +
      'débuts sont plus probablement un seul épisode interrompu. Plus bas, les durées se ' +
      'morcellent ; plus haut, deux cycles réellement courts se confondent en un.',
    applique: false,
  },
  {
    cle: 'duree-maximale-fiable',
    intitule: 'La durée au-delà de laquelle un cycle est dit non clos plutôt que long.',
    propose: 90,
    unite: 'jours',
    motivation:
      'Un écart de plusieurs mois entre deux J1 est plus souvent une saisie manquée qu’un cycle ' +
      'long, et le compter comme une durée abîmerait la médiane. Quatre-vingt-dix jours laisse ' +
      'passer les cycles longs réels — ils existent, et les écarter serait effacer la personne ' +
      'au profit d’une jolie statistique — tout en écartant les trous d’usage. Le cycle reste ' +
      'affiché ; il n’entre pas dans les statistiques, et l’écran dit pourquoi.',
    applique: false,
  },
  {
    cle: 'cycles-avant-une-mediane',
    intitule: 'Combien de cycles complets et retenus avant d’afficher une médiane.',
    propose: 3,
    unite: 'cycles',
    motivation:
      'Le 4.4.2 du prompt l’écrit lui-même — « effectif minimal : trois cycles complets (règle ' +
      'de produit, décision 24) » —, donc la proposition est la sienne et il reste à la ' +
      'confirmer. Une médiane sur deux cycles est un chiffre qui a l’air d’un savoir. Trois est ' +
      'le minimum pour qu’une valeur centrale ait un sens, et c’est aussi trois mois d’attente ' +
      'avant que l’écran montre quoi que ce soit — ce qui est long. Plus haut, l’écran reste ' +
      'muet une demi-année ; plus bas, il affirme. En dessous du seuil, l’écran dit « données ' +
      'insuffisantes » ET ce qui manque, comme le prompt le demande.',
    applique: false,
  },
  {
    cle: 'largeur-fenetre-avant',
    intitule:
      'La largeur de la fenêtre « avant les règles », en jours avant le J1 SUIVANT, observé.',
    propose: 5,
    unite: 'jours',
    motivation:
      'Explicitement renvoyée à Alexis par les décisions 8 et 24, et nommée « N » par le 4.5. ' +
      'Cinq jours couvrent la période que les gens décrivent le plus souvent, sans s’étendre ' +
      'assez pour que la fenêtre recouvre la moitié du cycle — à quoi elle ne distinguerait ' +
      'plus rien. Plus large, elle mord sur « le reste du cycle » et les deux cessent de se ' +
      'distinguer ; plus étroite, elle manque les jours que la personne décrit. Cette fenêtre ' +
      'est **passée** : elle se calcule sur un J1 qui a eu lieu, jamais sur un J1 attendu.',
    applique: false,
  },
  {
    cle: 'delai-du-constat-de-retard',
    intitule:
      'Au bout de combien de jours après la fin de la plage estimée le constat de retard paraît.',
    propose: 7,
    unite: 'jours',
    motivation:
      'C’est le « [N] jours » de la chaîne imposée `retard.constat`, et le « délai N » de la ' +
      'décision 24. Sept jours laissent passer la variation ordinaire d’un cycle sans laisser ' +
      'quelqu’un sans phrase pendant des semaines. Plus bas, le constat paraît pour une ' +
      'variation banale et inquiète ; plus haut, il ne paraît plus quand il servirait. Le ' +
      'constat reste un **fait affiché**, sans signal codé : décision 11, tant qu’aucune source ' +
      'n’est atteignable.',
    applique: false,
  },
  {
    cle: 'tolerance-de-comparaison-des-dates',
    intitule: 'La tolérance appliquée quand une durée est comparée à un repère.',
    propose: 1,
    unite: 'jours',
    motivation:
      'Demandée par le 4.4.3 — « les dates étant saisies à la main (± 1 ou 2 jours), précise la ' +
      'tolérance appliquée aux comparaisons (décision 24) ». Un jour est le minimum qui ait un ' +
      'sens : sans tolérance, un cycle de 39 jours serait dit « au-delà du repère de 38 » alors ' +
      'qu’un seul jour de saisie approximative suffit à l’expliquer. À deux jours, la tolérance ' +
      'devient plus large que l’écart qu’elle couvre et le repère ne distingue plus rien. ' +
      'ATTENTION : aucun repère publié n’est encore dans Cyclades — le 4.4.3 demande de ' +
      're-vérifier chaque nombre FIGO à la source, ce que personne n’a fait. Cette tolérance ' +
      'n’a donc rien à comparer aujourd’hui ; elle est proposée pour que la réponse soit prête.',
    applique: false,
  },
  {
    cle: 'fenetre-par-defaut',
    intitule: 'La fenêtre d’étude par défaut des statistiques.',
    propose: 12,
    unite: 'mois',
    motivation:
      'Le 4.4.2 propose « les 12 derniers mois (règle de produit) », donc la valeur est la ' +
      'sienne. Douze mois donnent une dizaine de cycles chez la plupart des gens — assez pour ' +
      'une médiane, assez court pour que ce qui a changé il y a trois ans ne pèse pas sur ce ' +
      'qu’on lit aujourd’hui. Plus court, la médiane devient instable ; plus long, elle décrit ' +
      'quelqu’un qu’on n’est plus. Le prompt ajoute un avertissement qu’il faut répéter : ' +
      '**la fenêtre et la mesure que le FIGO 2018 retient pour la régularité n’ont pas été ' +
      'lues**, et si elles diffèrent, ce sont celles de la source qui s’appliquent — au seul ' +
      'tableau des repères, pas à cette fenêtre-ci.',
    applique: false,
  },
];

const PAR_CLE = new Map(PARAMETRES_DU_SUIVI.map((p) => [p.cle, p]));

/**
 * La valeur d'un paramètre, **ou `null` tant qu'il n'est pas tranché**.
 *
 * C'est la seule porte vers un chiffre, et elle ne rend la proposition
 * qu'après la réponse d'Alexis. Un calcul qui lirait `propose` directement
 * contournerait la décision 24 ; un essai balaie le module pour cela.
 */
export function parametre(cle: string): number | null {
  const p = PAR_CLE.get(cle);
  if (!p || !p.applique) return null;
  return p.propose;
}

/** Les paramètres encore en attente, pour que l'écran puisse le dire. */
export const parametresEnAttente = (): readonly ParametreDuSuivi[] =>
  PARAMETRES_DU_SUIVI.filter((p) => !p.applique);

/* ══════════════════════════════════════════════════════════════════════════
   Les libellés que 4.5 impose
   ══════════════════════════════════════════════════════════════════════════ */

export type GenreDeFenetre = 'jours-de-regles' | 'avant-les-regles' | 'reste-du-cycle';

/**
 * Les trois libellés, mot pour mot ceux du 4.5.
 *
 * « Les libellés de l'interface disent "jours de règles", "avant les règles",
 * "jour du cycle" : ils ne portent aucun présupposé hormonal. » Ils sont
 * déclarés ici plutôt que dans les gabarits pour la raison qui vaut pour les
 * chaînes imposées : une phrase prescrite par le prompt doit être relisible en
 * un endroit, et un essai doit pouvoir la comparer au texte.
 *
 * « Le reste du cycle » n'est pas un libellé d'interface imposé — c'est le nom
 * de la troisième fenêtre dans le prompt. Il est ici pour que les trois genres
 * aient un libellé, et il ne porte pas non plus de présupposé.
 */
export const LIBELLES_DES_FENETRES: Record<GenreDeFenetre, string> = {
  'jours-de-regles': 'jours de règles',
  'avant-les-regles': 'avant les règles',
  'reste-du-cycle': 'reste du cycle',
};

/** Le libellé de la coordonnée du jour, imposé par 4.5 lui aussi. */
export const LIBELLE_DU_JOUR_DE_CYCLE = 'jour du cycle';

/* ══════════════════════════════════════════════════════════════════════════
   L'algorithme, qui reçoit ses chiffres
   ══════════════════════════════════════════════════════════════════════════ */

export interface ReglesDeDerivation {
  joursPourOuvrir: number;
  ecartMinimalEntreJ1: number;
  dureeMaximaleFiable: number;
}

export interface Cycle {
  /** Le J1, au format `AAAA-MM-JJ`. */
  debut: string;
  /**
   * Le J1 **suivant**, quand il est observé.
   *
   * C'est lui qui clôt le cycle : 4.4.1, « un cycle va d'un J1 au J1 suivant »,
   * et « un cycle est **complet** si ses deux J1 sont connus ». Le garder
   * explicitement plutôt que de le déduire évite la confusion que j'avais
   * d'abord installée, où `fin` servait des deux usages.
   */
  suivant: string | null;
  /** Le dernier jour COMPRIS dans le cycle : la veille du J1 suivant. */
  fin: string | null;
  /**
   * La longueur, en jours : `suivant − debut`.
   *
   * C'est la convention du prompt — d'un J1 au J1 suivant — et celle de tout
   * le monde : deux J1 au 1er et au 29 font un cycle de 28 jours, pas de 29.
   */
  duree: number | null;
  /** Les deux J1 sont connus (4.4.1). */
  complet: boolean;
  /**
   * Faux quand la durée dépasse `dureeMaximaleFiable`.
   *
   * Le cycle reste affiché — l'écarter serait effacer ce que la personne a
   * vécu au profit d'une statistique plus jolie, et 4.4.1 l'interdit :
   * « jamais retiré en silence, toujours visible ». Il n'entre pas dans les
   * calculs, et l'écran dit pourquoi.
   */
  fiable: boolean;
}

const JOUR_MS = 86_400_000;
const enJours = (du: string, au: string) =>
  Math.round((Date.parse(`${au}T00:00:00Z`) - Date.parse(`${du}T00:00:00Z`)) / JOUR_MS);
const jourDecale = (jour: string, decalage: number) =>
  new Date(Date.parse(`${jour}T00:00:00Z`) + decalage * JOUR_MS).toISOString().slice(0, 10);

/** Un niveau compte-t-il comme un saignement menstruel, et non comme des traces ? */
const estUnSaignementFranc = (niveau: NiveauDeSaignement): boolean =>
  ORDRE_DES_NIVEAUX.indexOf(niveau) >= ORDRE_DES_NIVEAUX.indexOf('leger');

/**
 * Les J1 d'un historique, selon la décision 8.
 *
 * « J1 = premier jour de saignement menstruel, **traces isolées précédant les
 * règles exclues** » (4.3). Les traces ne sont jamais un saignement franc,
 * donc elles n'ouvrent jamais un cycle — l'exclusion est structurelle et non
 * un cas particulier à la fin.
 *
 * Un J1 est le premier jour d'une suite de `joursPourOuvrir` jours civils
 * consécutifs de saignement franc. « Consécutifs » se lit sur le calendrier et
 * non sur les saisies : deux saisies franches séparées par un jour sans saisie
 * ne sont pas consécutives, parce qu'un jour sans saisie n'est pas un jour
 * sans saignement — il est un jour dont on ne sait rien, et il ne faut pas le
 * remplir.
 */
export function joursUn(
  saisies: readonly SaisieDuCycle[],
  regles: ReglesDeDerivation,
): string[] {
  const francs = new Set(
    saisies.filter((s) => estUnSaignementFranc(s.niveau)).map((s) => s.jour),
  );
  const ordonnes = [...francs].sort();
  const candidats: string[] = [];
  for (const jour of ordonnes) {
    let suite = 1;
    while (suite < regles.joursPourOuvrir && francs.has(jourDecale(jour, suite))) suite += 1;
    if (suite < regles.joursPourOuvrir) continue;
    /*
       Le premier jour de la suite, et non n'importe quel jour dedans : sans
       cette condition, chaque jour d'une semaine de règles serait un J1, et il
       y aurait sept cycles par mois. Un jour n'ouvre un cycle que si la veille
       n'est pas elle-même franche.
    */
    if (francs.has(jourDecale(jour, -1))) continue;
    candidats.push(jour);
  }

  /* L'écart minimal, appliqué du plus ancien au plus récent. */
  const retenus: string[] = [];
  for (const jour of candidats) {
    const dernier = retenus[retenus.length - 1];
    if (dernier !== undefined && enJours(dernier, jour) < regles.ecartMinimalEntreJ1) continue;
    retenus.push(jour);
  }
  return retenus;
}

/**
 * Les cycles d'un historique. Le dernier est en cours, donc incomplet.
 *
 * Pur, et il reçoit ses chiffres : c'est ce qui permet de le mesurer sans
 * appliquer aucun paramètre.
 */
export function derivationDesCycles(
  saisies: readonly SaisieDuCycle[],
  regles: ReglesDeDerivation,
): Cycle[] {
  const j1 = joursUn(saisies, regles);
  return j1.map((debut, i) => {
    const suivant = j1[i + 1];
    if (suivant === undefined) {
      return { debut, suivant: null, fin: null, duree: null, complet: false, fiable: true };
    }
    const duree = enJours(debut, suivant);
    return {
      debut,
      suivant,
      fin: jourDecale(suivant, -1),
      duree,
      complet: true,
      fiable: duree <= regles.dureeMaximaleFiable,
    };
  });
}

/**
 * La durée des règles d'un cycle, en jours.
 *
 * La suite de jours francs qui commence au J1, lue sur le calendrier. Rend
 * `null` si le J1 lui-même n'a pas de saisie franche — ce qui n'arrive pas
 * pour un cycle dérivé, mais arriverait pour un J1 fourni à la main, et rendre
 * zéro dirait « des règles de zéro jour » au lieu de « on ne sait pas ».
 */
export function dureeDesRegles(
  saisies: readonly SaisieDuCycle[],
  debut: string,
): number | null {
  const francs = new Set(
    saisies.filter((s) => estUnSaignementFranc(s.niveau)).map((s) => s.jour),
  );
  if (!francs.has(debut)) return null;
  let duree = 1;
  while (francs.has(jourDecale(debut, duree))) duree += 1;
  return duree;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les exclusions : jamais en silence, toujours réintégrables
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un cycle écarté des calculs, et par qui.
 *
 * 4.4.1 : un cycle « peut être **exclu des calculs** par un statut (4.2) ou
 * par moi ("cycle perturbé", avec un motif libre) : jamais retiré en silence,
 * toujours visible et réintégrable ».
 *
 * Trois conséquences, et chacune se lit dans la forme :
 *
 * - l'exclusion est une **donnée à part**, pas un champ du cycle : un cycle se
 *   dérive de l'historique et n'a pas de place pour une décision humaine ;
 * - elle porte **qui** et **pourquoi**, donc l'écran peut le dire ;
 * - la retirer suffit à réintégrer le cycle, puisque rien n'a été effacé.
 *
 * **Le stockage n'existe pas encore**, et c'est volontaire : rien ne s'affiche
 * tant qu'Alexis n'a pas tranché les chiffres, donc rien ne permet encore
 * d'exclure. Les exclusions sont passées en argument, elles seront lues d'un
 * magasin quand l'écran arrivera. L'ordre compte : le modèle d'abord, pour que
 * les statistiques les honorent dès leur premier jour.
 */
export interface ExclusionDeCycle {
  /** Le J1 du cycle écarté. */
  debut: string;
  par: 'statut' | 'personne';
  /** L'intitulé du statut, ou le motif libre de la personne. Jamais vide. */
  motif: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les statistiques de la personne, et d'elle seule
   ══════════════════════════════════════════════════════════════════════════ */

export interface MesureDeLongueur {
  medianeEnJours: number;
  /**
   * L'écart absolu médian, en jours — la dispersion robuste du 4.4.2.
   *
   * Robuste veut dire : un cycle de 90 jours ne la fait pas exploser, là où
   * l'écart-type le ferait. C'est ce qu'il faut ici, parce qu'un historique de
   * cycles contient presque toujours un épisode qui n'est pas du bruit mais
   * qui n'est pas la règle non plus.
   */
  dispersionEnJours: number;
  minEnJours: number;
  maxEnJours: number;
}

export interface StatistiquesDuSuivi {
  /** La fenêtre étudiée, bornes incluses. `null` si aucune saisie. */
  fenetre: { du: string; au: string } | null;
  /** Les cycles complets de la fenêtre, exclusions comprises. */
  complets: number;
  /** Ceux qui entrent dans les calculs. */
  retenus: number;
  /** Ce qui a été écarté, et par quoi — pour que l'écran le dise (4.4.1). */
  ecartes: {
    pourDuree: number;
    parStatut: number;
    parLaPersonne: number;
  };
  /** L'effectif minimal est-il atteint ? */
  suffisant: boolean;
  /**
   * Ce qui manque, quand ce n'est pas suffisant.
   *
   * 4.4.2 : « en dessous, "données insuffisantes", **avec ce qui manque** ».
   * Un écran qui dit seulement « données insuffisantes » laisse la personne
   * sans rien à faire ; dire « il manque deux cycles complets » lui dit quand
   * revenir.
   */
  ceQuiManque: string | null;
  /** `null` tant que l'effectif n'est pas atteint. */
  longueur: MesureDeLongueur | null;
  /**
   * La variation : l'écart entre le cycle le plus long et le plus court de la
   * fenêtre (4.4.2). `null` tant que l'effectif n'est pas atteint.
   */
  variationEnJours: number | null;
  /** La durée des règles, mesurée sur les mêmes cycles retenus. */
  dureeDesReglesEnJours: MesureDeLongueur | null;
}

const mediane = (valeurs: readonly number[]): number => {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  if (triees.length % 2 === 1) return triees[milieu];
  /*
     Moyenne des deux valeurs centrales, arrondie au jour. Une médiane de
     « 28,5 jours » sur un nombre de jours entiers donne une précision que la
     saisie n'a pas : la personne note un jour, pas une demi-journée.
  */
  return Math.round((triees[milieu - 1] + triees[milieu]) / 2);
};

/** L'écart absolu médian : la médiane des écarts à la médiane. */
const dispersionRobuste = (valeurs: readonly number[]): number => {
  const centre = mediane(valeurs);
  return mediane(valeurs.map((v) => Math.abs(v - centre)));
};

const mesure = (valeurs: readonly number[]): MesureDeLongueur | null => {
  if (!valeurs.length) return null;
  return {
    medianeEnJours: mediane(valeurs),
    dispersionEnJours: dispersionRobuste(valeurs),
    minEnJours: Math.min(...valeurs),
    maxEnJours: Math.max(...valeurs),
  };
};

const pluriel = (n: number, singulier: string, pluriel_: string) =>
  `${n.toLocaleString('fr-FR')} ${n === 1 ? singulier : pluriel_}`;

/**
 * Les statistiques, sur la seule base de la personne.
 *
 * Aucune comparaison à une population, aucun « normal », aucun « au-dessus de
 * la moyenne » : décision 16 et 0.4 du prompt, « ma propre base est la seule
 * référence défendable ». Ce module ne sait pas ce qu'est un cycle normal, et
 * c'est voulu — aucune source atteignable ne le dirait, et un chiffre de
 * référence sans source est exactement ce que le § 1 n° 6 interdit.
 *
 * Tous les chiffres sont **reçus**, pas lus : même raison que le reste.
 */
export function statistiques(
  cycles: readonly Cycle[],
  saisies: readonly SaisieDuCycle[],
  exclusions: readonly ExclusionDeCycle[],
  minimumDeCycles: number,
  fenetre: { du: string; au: string } | null,
): StatistiquesDuSuivi {
  const dansLaFenetre = (c: Cycle) =>
    fenetre === null || (c.debut >= fenetre.du && c.debut <= fenetre.au);
  const complets = cycles.filter((c) => c.complet && dansLaFenetre(c));

  const exclusPar = new Map(exclusions.map((e) => [e.debut, e.par]));
  const retenus = complets.filter((c) => c.fiable && !exclusPar.has(c.debut));
  const durees = retenus.map((c) => c.duree as number);
  const dureesDesRegles = retenus
    .map((c) => dureeDesRegles(saisies, c.debut))
    .filter((d): d is number => d !== null);

  const suffisant = retenus.length >= minimumDeCycles;
  const manquants = minimumDeCycles - retenus.length;

  return {
    fenetre,
    complets: complets.length,
    retenus: retenus.length,
    ecartes: {
      pourDuree: complets.filter((c) => !c.fiable).length,
      parStatut: complets.filter((c) => exclusPar.get(c.debut) === 'statut').length,
      parLaPersonne: complets.filter((c) => exclusPar.get(c.debut) === 'personne').length,
    },
    suffisant,
    ceQuiManque: suffisant
      ? null
      : `Il manque ${pluriel(manquants, 'cycle complet', 'cycles complets')}.`,
    longueur: suffisant ? mesure(durees) : null,
    variationEnJours:
      suffisant && durees.length ? Math.max(...durees) - Math.min(...durees) : null,
    dureeDesReglesEnJours: suffisant ? mesure(dureesDesRegles) : null,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les deux coordonnées du jour (4.5)
   ══════════════════════════════════════════════════════════════════════════ */

/** Le cycle auquel un jour appartient, ou `null`. */
const cycleDuJour = (jour: string, cycles: readonly Cycle[]): Cycle | null =>
  cycles.find((c) => jour >= c.debut && (c.fin === null || jour <= c.fin)) ?? null;

/**
 * `jour_depuis_J1` : le rang du jour dans son cycle, J1 compris.
 *
 * Un J1 est le jour 1 et non le jour 0 : c'est ce que « J1 » veut dire, et
 * c'est ce que la personne lira sous le libellé « jour du cycle ».
 */
export function jourDepuisJ1(jour: string, cycles: readonly Cycle[]): number | null {
  const cycle = cycleDuJour(jour, cycles);
  if (!cycle) return null;
  return enJours(cycle.debut, jour) + 1;
}

/**
 * `jours_avant_prochain_J1`, **et seulement quand il est observé**.
 *
 * 4.5 : cette coordonnée n'existe « une fois le J1 suivant connu ». Pour le
 * cycle en cours, elle rend `null` — pas une estimation, pas un compte à
 * rebours. Un compte à rebours vers un J1 attendu serait une prévision, donc
 * la chose que la décision 12 refuse sans levée possible.
 */
export function joursAvantProchainJ1(jour: string, cycles: readonly Cycle[]): number | null {
  const cycle = cycleDuJour(jour, cycles);
  if (!cycle || cycle.suivant === null) return null;
  return enJours(jour, cycle.suivant);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les trois fenêtres, et elles sont passées
   ══════════════════════════════════════════════════════════════════════════ */

export interface Fenetre {
  genre: GenreDeFenetre;
  /** Le J1 du cycle sur lequel la fenêtre est ancrée. Il a eu lieu. */
  ancre: string;
  du: string;
  au: string;
}

/**
 * Les fenêtres d'un cycle **complet**, et d'aucun autre.
 *
 * 4.5 nomme trois fenêtres : *jours de règles*, *les N jours précédant les
 * règles suivantes*, *le reste du cycle*. Et il pose deux fois la même
 * condition : « ces fenêtres ne s'établissent qu'a posteriori, sur des cycles
 * dont le J1 suivant est observé » et « aucune fenêtre "avant les règles"
 * n'est affichée pour le futur ni pour le cycle en cours ».
 *
 * ## L'erreur que j'avais faite, et qu'il faut nommer
 *
 * Ma première version ancrait la fenêtre « avant les règles » sur le J1 **du
 * cycle lui-même** : les N jours qui précèdent son début. Ces jours existent
 * et sont passés, donc rien ne rougissait — mais ils appartiennent au cycle
 * **précédent**, dont ils annonçaient les règles. La fenêtre était attribuée
 * au mauvais cycle, et le premier cycle de l'historique en recevait une alors
 * que ses jours d'avant appartiennent à un cycle inconnu.
 *
 * Le prompt dit « les N jours précédant les règles **suivantes** » : la
 * fenêtre d'un cycle se calcule sur son J1 suivant. D'où la condition
 * `complet`, qui n'était pas un détail de forme.
 *
 * ## Le reste du cycle peut être vide, et ce n'est pas une erreur
 *
 * Pour un cycle court dont les règles sont longues, les jours de règles et la
 * fenêtre d'avant se touchent ou se recouvrent. Le reste est alors vide, et la
 * fenêtre n'est pas rendue — plutôt qu'une plage inversée, qu'un appelant
 * lirait comme un intervalle.
 */
export function fenetresDUnCycle(
  cycle: Cycle,
  saisies: readonly SaisieDuCycle[],
  largeurAvant: number,
): Fenetre[] {
  if (!cycle.complet || cycle.suivant === null) return [];
  const fenetres: Fenetre[] = [];

  const regles = dureeDesRegles(saisies, cycle.debut);
  if (regles !== null) {
    fenetres.push({
      genre: 'jours-de-regles',
      ancre: cycle.debut,
      du: cycle.debut,
      au: jourDecale(cycle.debut, regles - 1),
    });
  }

  const avantDu = jourDecale(cycle.suivant, -largeurAvant);
  const avantAu = jourDecale(cycle.suivant, -1);
  /*
     La fenêtre d'avant ne remonte jamais avant le J1 de son propre cycle :
     sinon elle empiéterait sur le cycle précédent, et les N jours seraient
     comptés deux fois.
  */
  const avant = { du: avantDu < cycle.debut ? cycle.debut : avantDu, au: avantAu };
  if (avant.du <= avant.au) {
    fenetres.push({ genre: 'avant-les-regles', ancre: cycle.debut, ...avant });
  }

  const resteDu = regles === null ? cycle.debut : jourDecale(cycle.debut, regles);
  const resteAu = jourDecale(avant.du, -1);
  if (resteDu <= resteAu) {
    fenetres.push({ genre: 'reste-du-cycle', ancre: cycle.debut, du: resteDu, au: resteAu });
  }

  return fenetres;
}

/** Les fenêtres de tous les cycles complets. Le cycle en cours n'en a aucune. */
export function fenetresDesCycles(
  cycles: readonly Cycle[],
  saisies: readonly SaisieDuCycle[],
  largeurAvant: number,
): Fenetre[] {
  return cycles.flatMap((c) => fenetresDUnCycle(c, saisies, largeurAvant));
}

/* ══════════════════════════════════════════════════════════════════════════
   Les portes publiques, qui refusent
   ══════════════════════════════════════════════════════════════════════════ */

export type RaisonDeNePasCalculer = 'parametres-non-tranches';

export interface Refus {
  impossible: RaisonDeNePasCalculer;
  /** Les clés des paramètres manquants, pour que l'écran les nomme. */
  manquants: readonly string[];
}

/**
 * Les règles, **ou `null` tant qu'un chiffre manque**.
 *
 * Tout ou rien, et c'est voulu : dériver des cycles avec deux chiffres sur
 * trois donnerait des durées, donc une médiane, donc un écran qui affirme — à
 * partir d'un paramètre que personne n'a tranché.
 */
export function reglesApplicables(): ReglesDeDerivation | null {
  const joursPourOuvrir = parametre('jours-pour-ouvrir');
  const ecartMinimalEntreJ1 = parametre('ecart-minimal-entre-j1');
  const dureeMaximaleFiable = parametre('duree-maximale-fiable');
  if (joursPourOuvrir === null || ecartMinimalEntreJ1 === null || dureeMaximaleFiable === null) {
    return null;
  }
  return { joursPourOuvrir, ecartMinimalEntreJ1, dureeMaximaleFiable };
}

const refus = (clefs: readonly string[]): Refus => ({
  impossible: 'parametres-non-tranches',
  manquants: clefs.filter((c) => parametre(c) === null),
});

/** Les cycles, ou un refus motivé. **Refuse aujourd'hui.** */
export function cyclesDeLHistorique(
  saisies: readonly SaisieDuCycle[],
): { cycles: Cycle[] } | Refus {
  const regles = reglesApplicables();
  if (regles === null) {
    return refus(['jours-pour-ouvrir', 'ecart-minimal-entre-j1', 'duree-maximale-fiable']);
  }
  return { cycles: derivationDesCycles(saisies, regles) };
}

/**
 * La fenêtre d'étude, calculée depuis le dernier jour saisi.
 *
 * Depuis le dernier jour SAISI et non depuis aujourd'hui : une personne qui
 * n'a rien noté depuis six mois verrait sinon une fenêtre à moitié vide, et
 * une médiane calculée sur ce qui reste serait présentée comme celle des douze
 * derniers mois. La fenêtre décrit ce qu'on a regardé, pas le calendrier.
 */
export function fenetreDEtude(
  saisies: readonly SaisieDuCycle[],
  mois: number,
): { du: string; au: string } | null {
  const jours = saisies.map((s) => s.jour).sort();
  const au = jours[jours.length - 1];
  if (au === undefined) return null;
  const fin = new Date(`${au}T00:00:00Z`);
  const debut = new Date(
    Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - mois, fin.getUTCDate() + 1),
  );
  return { du: debut.toISOString().slice(0, 10), au };
}

/** Les statistiques, ou un refus motivé. **Refuse aujourd'hui.** */
export function statistiquesDeLHistorique(
  saisies: readonly SaisieDuCycle[],
  exclusions: readonly ExclusionDeCycle[] = [],
): { statistiques: StatistiquesDuSuivi } | Refus {
  const minimum = parametre('cycles-avant-une-mediane');
  const mois = parametre('fenetre-par-defaut');
  const derives = cyclesDeLHistorique(saisies);
  if ('impossible' in derives) return derives;
  if (minimum === null || mois === null) {
    return refus(['cycles-avant-une-mediane', 'fenetre-par-defaut']);
  }
  return {
    statistiques: statistiques(
      derives.cycles,
      saisies,
      exclusions,
      minimum,
      fenetreDEtude(saisies, mois),
    ),
  };
}

/** Les fenêtres passées, ou un refus motivé. **Refuse aujourd'hui.** */
export function fenetresDeLHistorique(
  saisies: readonly SaisieDuCycle[],
): { fenetres: Fenetre[] } | Refus {
  const largeur = parametre('largeur-fenetre-avant');
  const derives = cyclesDeLHistorique(saisies);
  if ('impossible' in derives) return derives;
  if (largeur === null) return refus(['largeur-fenetre-avant']);
  return { fenetres: fenetresDesCycles(derives.cycles, saisies, largeur) };
}
