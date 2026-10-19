/**
 * Les cycles, les statistiques de la personne, les fenêtres passées.
 *
 *   npm run essais:cycles
 *
 * ## Ce module ne calcule rien aujourd'hui, et c'est son objet
 *
 * La décision 24 du plan de phase 0 : les paramètres de produit sont
 * « proposés chiffrés en phase 3, **aucun appliqué avant ta réponse** ». La
 * décision 8 ajoute que la fenêtre « avant les règles » est « à fixer avec
 * toi ». Alexis n'a pas répondu.
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
 *   paramètres explicites (`ReglesDeDerivation`). Les essais l'exercent avec
 *   des chiffres d'essai qui ne sont PAS les valeurs proposées, pour qu'aucune
 *   proposition ne se glisse dans une mesure et réciproquement ;
 * - **les portes publiques refusent**. `cyclesDeLHistorique` demande
 *   `reglesApplicables()`, qui rend `null` tant qu'un paramètre n'est pas
 *   tranché, et rend alors `{ impossible: 'parametres-non-tranches' }`.
 *
 * Donc : rien ne s'affiche, rien n'est deviné, et le jour où Alexis répond, il
 * suffit de passer `applique: true` avec sa valeur. Un essai balaie le module
 * et rougit si un calcul lit une valeur proposée.
 *
 * ## Ce qui n'est pas ici, et ne le sera jamais
 *
 * Aucune prévision. Les fenêtres sont **passées** : ancrées sur un J1 qui a eu
 * lieu. La décision 12 est non levable — pas de fenêtre fertile, pas
 * d'ovulation prédite, pas de conseil de contraception — et `JAMAIS_CALCULE`
 * (`odyssee/cycle-confidentialite.ts`) la tient par un essai qui lit les
 * identifiants de ce module.
 *
 * Aucune comparaison à une population non plus : décision 16, « contexte
 * affiché seulement ». Les statistiques portent sur la seule base de la
 * personne, et ne disent jamais si un chiffre est « normal ».
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
  unite: 'jours' | 'cycles';
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
 * Les six chiffres qu'Alexis doit trancher.
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
      'écartent le spotting d’un jour sans écarter des règles courtes, qui existent. À un jour, ' +
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
    intitule: 'Combien de cycles complets et fiables avant d’afficher une médiane.',
    propose: 3,
    unite: 'cycles',
    motivation:
      'Une médiane sur deux cycles est un chiffre qui a l’air d’un savoir. Trois est le minimum ' +
      'pour qu’une valeur centrale ait un sens, et c’est aussi trois mois d’attente avant que ' +
      'l’écran montre quoi que ce soit — ce qui est long. Plus haut, l’écran reste muet une ' +
      'demi-année ; plus bas, il affirme.',
    applique: false,
  },
  {
    cle: 'largeur-fenetre-avant',
    intitule: 'La largeur de la fenêtre « avant les règles », en jours avant un J1 passé.',
    propose: 5,
    unite: 'jours',
    motivation:
      'Explicitement renvoyée à Alexis par la décision 8. Cinq jours couvrent la période que les ' +
      'gens décrivent le plus souvent, sans s’étendre assez pour que la fenêtre recouvre la ' +
      'moitié du cycle — à quoi elle ne distinguerait plus rien. Cette fenêtre est **passée** : ' +
      'elle se calcule sur un J1 qui a eu lieu, jamais sur un J1 attendu.',
    applique: false,
  },
  {
    cle: 'delai-du-constat-de-retard',
    intitule:
      'Au bout de combien de jours après la fin de la plage estimée le constat de retard paraît.',
    propose: 7,
    unite: 'jours',
    motivation:
      'C’est le « [N] jours » de la chaîne imposée `retard.constat`. Sept jours laissent passer ' +
      'la variation ordinaire d’un cycle sans laisser quelqu’un sans phrase pendant des ' +
      'semaines. Plus bas, le constat paraît pour une variation banale et inquiète ; plus haut, ' +
      'il ne paraît plus quand il servirait. Le constat reste un **fait affiché**, sans signal ' +
      'codé : décision 11, tant qu’aucune source n’est atteignable.',
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
   L'algorithme, qui reçoit ses chiffres
   ══════════════════════════════════════════════════════════════════════════ */

export interface ReglesDeDerivation {
  joursPourOuvrir: number;
  ecartMinimalEntreJ1: number;
  dureeMaximaleFiable: number;
}

export interface Cycle {
  /** Le premier jour, au format `AAAA-MM-JJ`. */
  debut: string;
  /**
   * Le dernier jour, ou `null` pour le cycle en cours.
   *
   * Un cycle va d'un J1 au jour qui **précède** le J1 suivant : la veille, et
   * non le J1 suivant lui-même, qui appartient au cycle d'après.
   */
  fin: string | null;
  /** En jours, bornes incluses. `null` pour le cycle en cours. */
  duree: number | null;
  /**
   * Faux quand la durée dépasse `dureeMaximaleFiable`.
   *
   * Le cycle reste affiché — l'écarter serait effacer ce que la personne a
   * vécu au profit d'une statistique plus jolie. Il n'entre pas dans les
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
 * « J1 = premier jour de saignement menstruel, **traces isolées exclues** ».
 * Les traces ne sont jamais un saignement franc, donc elles n'ouvrent jamais
 * un cycle — l'exclusion est structurelle et non un cas particulier à la fin.
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
 * Les cycles d'un historique. Le dernier est en cours.
 *
 * Pur, et il reçoit ses chiffres : c'est ce qui permet de le mesurer sans
 * appliquer aucun paramètre. La porte publique est `cyclesDeLHistorique`
 * plus bas, qui refuse tant qu'Alexis n'a pas répondu.
 */
export function derivationDesCycles(
  saisies: readonly SaisieDuCycle[],
  regles: ReglesDeDerivation,
): Cycle[] {
  const j1 = joursUn(saisies, regles);
  return j1.map((debut, i) => {
    const suivant = j1[i + 1];
    if (suivant === undefined) {
      return { debut, fin: null, duree: null, fiable: true };
    }
    const duree = enJours(debut, suivant);
    return {
      debut,
      fin: jourDecale(suivant, -1),
      duree,
      fiable: duree <= regles.dureeMaximaleFiable,
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Les statistiques de la personne, et d'elle seule
   ══════════════════════════════════════════════════════════════════════════ */

export interface StatistiquesDuSuivi {
  /** Tous les cycles clos, fiables ou non. */
  closIdentifies: number;
  /** Ceux qui entrent dans les calculs. */
  closFiables: number;
  /** Ceux écartés des calculs, pour que l'écran puisse le dire. */
  closEcartes: number;
  /** `null` tant qu'il n'y a pas assez de cycles fiables. */
  medianeEnJours: number | null;
  /** La plus courte et la plus longue des durées fiables. `null` si aucune. */
  plusCourteEnJours: number | null;
  plusLongueEnJours: number | null;
}

const mediane = (valeurs: readonly number[]): number | null => {
  if (!valeurs.length) return null;
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

/**
 * Les statistiques, sur la seule base de la personne.
 *
 * Aucune comparaison à une population, aucun « normal », aucun « au-dessus de
 * la moyenne » : décision 16, « contexte affiché seulement ». Ce module ne
 * sait pas ce qu'est un cycle normal, et c'est voulu — il ne dispose d'aucune
 * source atteignable qui le dirait, et un chiffre de référence sans source
 * serait exactement ce que le § 1 n° 6 interdit.
 *
 * `minimumDeCycles` est reçu, pas lu : même raison que le reste.
 */
export function statistiques(
  cycles: readonly Cycle[],
  minimumDeCycles: number,
): StatistiquesDuSuivi {
  const clos = cycles.filter((c) => c.duree !== null);
  const fiables = clos.filter((c) => c.fiable).map((c) => c.duree as number);
  return {
    closIdentifies: clos.length,
    closFiables: fiables.length,
    closEcartes: clos.length - fiables.length,
    medianeEnJours: fiables.length >= minimumDeCycles ? mediane(fiables) : null,
    plusCourteEnJours: fiables.length ? Math.min(...fiables) : null,
    plusLongueEnJours: fiables.length ? Math.max(...fiables) : null,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les fenêtres, et elles sont passées
   ══════════════════════════════════════════════════════════════════════════ */

export interface Fenetre {
  /** Le J1 sur lequel la fenêtre est ancrée. Il a eu lieu. */
  ancre: string;
  du: string;
  au: string;
}

/**
 * Les fenêtres « avant les règles », ancrées sur des J1 **passés**.
 *
 * C'est la seule forme de fenêtre que ce module connaîtra. Une fenêtre ancrée
 * sur un J1 **attendu** serait une prévision, donc une fenêtre fertile
 * déguisée dès qu'on en déduit quoi que ce soit, et la décision 12 est non
 * levable. Le nom même d'« ancre » dit le choix : on s'accroche à ce qui a eu
 * lieu.
 *
 * Le premier J1 n'a pas de fenêtre si l'historique ne couvre pas les jours
 * qui le précèdent — on ne fabrique pas des jours qu'on n'a pas.
 */
export function fenetresAvantLesRegles(
  cycles: readonly Cycle[],
  largeurEnJours: number,
  premierJourConnu: string | null,
): Fenetre[] {
  const fenetres: Fenetre[] = [];
  for (const cycle of cycles) {
    const du = jourDecale(cycle.debut, -largeurEnJours);
    const au = jourDecale(cycle.debut, -1);
    if (premierJourConnu !== null && du < premierJourConnu) continue;
    fenetres.push({ ancre: cycle.debut, du, au });
  }
  return fenetres;
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

/** Les statistiques, ou un refus motivé. **Refuse aujourd'hui.** */
export function statistiquesDeLHistorique(
  saisies: readonly SaisieDuCycle[],
): { statistiques: StatistiquesDuSuivi } | Refus {
  const minimum = parametre('cycles-avant-une-mediane');
  const derives = cyclesDeLHistorique(saisies);
  if ('impossible' in derives) return derives;
  if (minimum === null) return refus(['cycles-avant-une-mediane']);
  return { statistiques: statistiques(derives.cycles, minimum) };
}

/** Les fenêtres passées, ou un refus motivé. **Refuse aujourd'hui.** */
export function fenetresDeLHistorique(
  saisies: readonly SaisieDuCycle[],
): { fenetres: Fenetre[] } | Refus {
  const largeur = parametre('largeur-fenetre-avant');
  const derives = cyclesDeLHistorique(saisies);
  if ('impossible' in derives) return derives;
  if (largeur === null) return refus(['largeur-fenetre-avant']);
  const jours = saisies.map((s) => s.jour).sort();
  return {
    fenetres: fenetresAvantLesRegles(derives.cycles, largeur, jours[0] ?? null),
  };
}
