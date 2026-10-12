/**
 * L'adaptation : ce que l'usage contredit, proposé une fois par semaine au plus.
 *
 * ## Ce que A.8 demande, et pourquoi chaque mot compte
 *
 * « Au plus une proposition par semaine, jamais bloquante, acceptée, reportée
 * ou refusée, **refus mémorisé**, et un bouton Réinitialiser l'adaptation qui
 * remet tous les réglages adaptatifs à leur valeur déclarée. »
 *
 * - **Au plus une par semaine** : le plafond se lit dans le journal des
 *   décisions, et non dans un compteur local — sinon deux appareils en
 *   proposeraient deux. Une personne qui ouvre l'application tous les jours doit
 *   la trouver silencieuse six jours sur sept.
 * - **Jamais bloquante** : ce module rend une proposition ; il ne sait pas
 *   l'afficher et n'a aucun moyen d'exiger une réponse. L'écran la pose à côté,
 *   et l'ignorer est une réponse valable qui ne coûte rien.
 * - **Refus mémorisé** : une règle refusée ne revient **jamais**. Pas « pas
 *   avant trois mois » : jamais. Redemander ce qu'on a refusé est la façon la
 *   plus sûre de faire désinstaller un logiciel.
 * - **Réinitialiser** : la remise à zéro ne devine pas la valeur déclarée, elle
 *   la **retrouve**. Le journal garde toutes les versions de chaque champ : il
 *   suffit de reprendre celle qui précédait l'acceptation. Un « retour aux
 *   valeurs par défaut » aurait effacé la déclaration en même temps que
 *   l'adaptation.
 *
 * ## Ce que l'adaptation ne fait pas
 *
 * Elle ne touche **jamais** un fait. Un écart entre le déclaré et l'observé sur
 * un *fait* n'est pas son affaire : c'est un désaccord au sens de la phase 3f,
 * et `desaccords.ts` le montre sans rien réécrire. Ici, l'écart porte sur un
 * **champ de profil** — ce que la personne a dit d'elle-même —, et la seule
 * réponse admissible est de lui poser la question.
 */
import { comparerOperations, type Operation } from './operations';
import {
  PREFIXE_CIBLE,
  TYPE_CHAMP_PROFIL,
  champDeCible,
  champDeclare,
  type Source,
} from './profil';
import { SEANCES_MINIMALES, type Observation } from './observation';

/* ══════════════════════════════════════════════════════════════════════════
   Les décisions, qui sont des faits journalisés
   ══════════════════════════════════════════════════════════════════════════ */

export const TYPE_DECISION = 'profil.adaptation';

export const cibleDeLaRegle = (regle: string): string =>
  `${PREFIXE_CIBLE}:adaptation:${regle}`;

export function regleDeCible(cible: string): string | null {
  const prefixe = `${PREFIXE_CIBLE}:adaptation:`;
  if (!cible.startsWith(prefixe)) return null;
  return cible.slice(prefixe.length) || null;
}

export type Issue =
  /** Appliquée : le champ a été réécrit avec la valeur observée. */
  | 'acceptee'
  /** Pas maintenant : elle reviendra après le délai de report. */
  | 'reportee'
  /** Non : elle ne reviendra jamais. */
  | 'refusee'
  /** « Réinitialiser l'adaptation » : les acceptations sont défaites. */
  | 'remise';

export interface ChargeDecision {
  issue: Issue;
  /** Quand, en ISO. */
  le: string;
  /** Ce qui avait été proposé, pour que l'écran puisse le rappeler. */
  valeurProposee?: unknown;
}

export interface Decision {
  regle: string;
  issue: Issue;
  le: string;
  appareil: string;
  hlc: string;
  valeurProposee?: unknown;
}

const ISSUES: readonly Issue[] = ['acceptee', 'reportee', 'refusee', 'remise'];

/** Les décisions prises, la dernière par règle. */
export function lireDecisions(operations: readonly Operation[]): Map<string, Decision> {
  const parRegle = new Map<string, Operation[]>();
  for (const op of operations) {
    if (op.type !== TYPE_DECISION) continue;
    const regle = regleDeCible(op.cible);
    if (!regle) continue;
    const groupe = parRegle.get(regle);
    if (groupe) groupe.push(op);
    else parRegle.set(regle, [op]);
  }

  const sorties = new Map<string, Decision>();
  for (const [regle, ops] of parRegle) {
    const derniere = [...ops].sort(comparerOperations)[ops.length - 1];
    const charge = derniere.charge as Partial<ChargeDecision> | undefined;
    if (!charge?.issue || !ISSUES.includes(charge.issue)) continue;
    sorties.set(regle, {
      regle,
      issue: charge.issue,
      le: typeof charge.le === 'string' ? charge.le : '',
      appareil: derniere.appareil,
      hlc: derniere.hlc,
      ...(charge.valeurProposee !== undefined ? { valeurProposee: charge.valeurProposee } : {}),
    });
  }
  return sorties;
}

/** Toutes les décisions, dans l'ordre de l'horloge — pour la réinitialisation. */
export function historiqueDesDecisions(operations: readonly Operation[]): Decision[] {
  return operations
    .filter((o) => o.type === TYPE_DECISION && regleDeCible(o.cible))
    .sort(comparerOperations)
    .flatMap((op) => {
      const charge = op.charge as Partial<ChargeDecision> | undefined;
      if (!charge?.issue || !ISSUES.includes(charge.issue)) return [];
      return [
        {
          regle: regleDeCible(op.cible)!,
          issue: charge.issue,
          le: typeof charge.le === 'string' ? charge.le : '',
          appareil: op.appareil,
          hlc: op.hlc,
          ...(charge.valeurProposee !== undefined
            ? { valeurProposee: charge.valeurProposee }
            : {}),
        },
      ];
    });
}

/* ══════════════════════════════════════════════════════════════════════════
   Les règles
   ══════════════════════════════════════════════════════════════════════════ */

/** Au plus une proposition par semaine : le délai depuis la dernière décision. */
export const DELAI_ENTRE_PROPOSITIONS_JOURS = 7;

/** Une proposition reportée revient après deux semaines. */
export const DELAI_DE_REPORT_JOURS = 14;

/** En deçà, un domaine actif mais muet n'est pas encore « délaissé ». */
export const JOURS_AVANT_DELAISSEMENT = 30;

export interface Proposition {
  regle: string;
  /** Le champ que l'acceptation réécrirait. */
  champ: string;
  valeurProposee: unknown;
  valeurActuelle: unknown;
  /** Ce qui a été **vu**. */
  constat: string;
  /** Ce qui est **proposé**, formulé comme une question. */
  question: string;
}

export interface Entrees {
  observation: Observation;
  /** La lecture du profil : le champ, et sa valeur ou rien. */
  lire: (champ: string) => unknown;
  /** Le jour logique courant, pour mesurer les délais. */
  jour: string;
}

export interface RegleAdaptation {
  id: string;
  libelle: string;
  champ: string;
  /**
   * L'ordre de passage quand plusieurs règles se déclenchent le même jour.
   *
   * Le plus petit passe d'abord. Le rythme avant le reste : c'est l'écart qui
   * fausse le plus de choses en aval — plafonds de séance, objectif de
   * l'histogramme, et jusqu'à l'estimation de ce qui est tenable.
   */
  priorite: number;
  detecter: (entrees: Entrees) => Proposition | null;
}

const nombre = (valeur: unknown): number | null =>
  typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;

const liste = (valeur: unknown): string[] =>
  Array.isArray(valeur) ? valeur.filter((x): x is string => typeof x === 'string') : [];

const JOUR_MS = 86_400_000;
const ecartJours = (de: string, a: string): number =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / JOUR_MS);

const heures = (n: number) => `${n.toLocaleString('fr-FR')} h`;

export const REGLES_ADAPTATION: readonly RegleAdaptation[] = [
  {
    id: 'rythme-declare',
    libelle: 'Les heures de révision déclarées et celles observées s’écartent',
    champ: 'heuresRevision',
    priorite: 1,
    detecter: ({ observation, lire }) => {
      const declare = nombre(lire('heuresRevision'));
      const observe = observation.heuresMedianes;
      if (declare === null || observe === null) return null;
      const ecart = Math.abs(observe - declare);
      /*
       * Deux conditions, et les deux sont nécessaires. L'écart relatif seul
       * ferait proposer un changement de 1 h à 1 h 30 ; l'écart absolu seul
       * ferait proposer de passer de 30 h à 28 h. Il faut que ce soit à la fois
       * beaucoup en proportion et beaucoup en heures.
       */
      if (ecart < 2 || ecart / Math.max(declare, 1) < 0.5) return null;
      return {
        regle: 'rythme-declare',
        champ: 'heuresRevision',
        valeurProposee: observe,
        valeurActuelle: declare,
        constat: `Vous avez dit ${heures(declare)} par semaine ; sur les ${observation.semaines.length} dernières semaines, la médiane observée est de ${heures(observe)}.`,
        question: `Mettre vos heures de révision à ${heures(observe)} ?`,
      };
    },
  },
  {
    id: 'temps-disponible',
    libelle: 'Le temps disponible déclaré est inférieur au temps déjà passé',
    champ: 'tempsParSemaine',
    priorite: 2,
    detecter: ({ observation, lire }) => {
      const declare = nombre(lire('tempsParSemaine'));
      const observe = observation.heuresMedianes;
      if (declare === null || observe === null) return null;
      // Un plancher dépassé n'est pas un écart : c'est une impossibilité.
      if (observe <= declare) return null;
      const propose = Math.ceil(observe);
      return {
        regle: 'temps-disponible',
        champ: 'tempsParSemaine',
        valeurProposee: propose,
        valeurActuelle: declare,
        constat: `Vous avez dit pouvoir y consacrer ${heures(declare)} par semaine, et vous en passez ${heures(observe)} en médiane.`,
        question: `Porter le temps disponible à ${heures(propose)} ? Vous l’avez déjà fait.`,
      };
    },
  },
  {
    id: 'moment-prefere',
    libelle: 'Le moment de révision déclaré n’est pas celui observé',
    champ: 'momentRevision',
    priorite: 3,
    detecter: ({ observation, lire }) => {
      const declare = lire('momentRevision');
      if (typeof declare !== 'string' || !declare) return null;
      if (!observation.plageDominante || observation.faits < SEANCES_MINIMALES) return null;
      const observe =
        observation.plageDominante === 'matin'
          ? 'matin'
          : observation.plageDominante === 'soir' || observation.plageDominante === 'nuit'
            ? 'soir'
            : 'variable';
      if (observe === declare) return null;
      const part = Math.round((observation.parPlage[observation.plageDominante] / observation.faits) * 100);
      return {
        regle: 'moment-prefere',
        champ: 'momentRevision',
        valeurProposee: observe,
        valeurActuelle: declare,
        constat: `${part} % de vos activités tombent sur la plage « ${observation.plageDominante} ».`,
        question: `Vous avez dit « ${declare} » : garder, ou passer à « ${observe} » ?`,
      };
    },
  },
  {
    id: 'coucher-depasse',
    libelle: 'L’activité se prolonge après l’heure de coucher déclarée',
    champ: 'coucher',
    priorite: 4,
    detecter: ({ observation, lire }) => {
      const coucher = lire('coucher');
      if (typeof coucher !== 'string') return null;
      const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(coucher);
      if (!m || observation.heureDerniere === null) return null;
      const declare = Number(m[1]);
      /*
       * Un coucher après minuit se compare dans le jour logique, pas dans
       * l'horloge : 1 h déclaré est *après* 23 h observé. Les heures d'avant la
       * bascule sont donc décalées de 24 avant la comparaison, des deux côtés.
       */
      const tard = (heure: number) => (heure < 5 ? heure + 24 : heure);
      if (tard(observation.heureDerniere) <= tard(declare)) return null;
      if (observation.faits < SEANCES_MINIMALES) return null;
      const propose = `${String(observation.heureDerniere).padStart(2, '0')}:30`;
      return {
        regle: 'coucher-depasse',
        champ: 'coucher',
        valeurProposee: propose,
        valeurActuelle: coucher,
        constat: `Vous avez dit vous coucher à ${coucher}, et votre activité va jusqu’à ${observation.heureDerniere} h.`,
        question: `Mettre l’heure de coucher à ${propose} ? Rien d’autre ne changera.`,
      };
    },
  },
  {
    id: 'domaine-delaisse',
    libelle: 'Un domaine suivi n’a rien reçu depuis un mois',
    champ: 'domainesActifs',
    priorite: 5,
    detecter: ({ observation, lire, jour }) => {
      const actifs = liste(lire('domainesActifs'));
      if (actifs.length < 2) return null;
      const vus = new Map(observation.parDomaine.map((d) => [d.domaine, d.dernierJour]));
      const muets = actifs.filter((domaine) => {
        const dernier = vus.get(domaine);
        return !dernier || ecartJours(dernier, jour) >= JOURS_AVANT_DELAISSEMENT;
      });
      /*
       * Tous muets veut dire que l'application n'est pas utilisée, pas que les
       * domaines sont mal choisis. Proposer d'en éteindre huit serait prendre
       * une absence pour un choix.
       */
      if (!muets.length || muets.length === actifs.length) return null;
      const propose = actifs.filter((d) => !muets.includes(d));
      return {
        regle: 'domaine-delaisse',
        champ: 'domainesActifs',
        valeurProposee: propose,
        valeurActuelle: actifs,
        constat: `Rien dans ${muets.join(', ')} depuis au moins ${JOURS_AVANT_DELAISSEMENT} jours.`,
        question: `Retirer ${muets.length > 1 ? 'ces domaines' : 'ce domaine'} de la roue ? Vos données y restent, et vous pouvez les rallumer.`,
      };
    },
  },
];

const PAR_ID = new Map(REGLES_ADAPTATION.map((r) => [r.id, r]));

export const regleAdaptation = (id: string): RegleAdaptation | undefined => PAR_ID.get(id);

/* ══════════════════════════════════════════════════════════════════════════
   Choisir : une seule, et pas trop souvent
   ══════════════════════════════════════════════════════════════════════════ */

export interface OptionsProposition extends Entrees {
  decisions: Map<string, Decision>;
}

/** Pourquoi rien n'est proposé. Rendu pour que « Mon profil » puisse le dire. */
export type Silence =
  | { pourquoi: 'aucun-ecart' }
  /** Une décision récente : le plafond hebdomadaire tient encore. */
  | { pourquoi: 'trop-tot'; joursRestants: number }
  /** Les écarts connus ont tous été reportés, et reviendront. */
  | { pourquoi: 'ajourne'; joursRestants: number }
  /** Les écarts connus portent tous sur des questions refusées. */
  | { pourquoi: 'tout-refuse' };

export interface Choix {
  proposition: Proposition | null;
  silence: Silence | null;
  /** Les écarts détectés, même ceux qui ne seront pas proposés aujourd'hui. */
  ecarts: Proposition[];
}

/**
 * La proposition du jour, ou le silence et sa raison.
 *
 * L'ordre des contrôles n'est pas indifférent. Le délai est vérifié **après**
 * la détection, pour que l'écran puisse dire « il y a quelque chose, je vous en
 * parle dans trois jours » plutôt que de ne rien dire du tout : la personne qui
 * ouvre « Mon profil » a le droit de savoir qu'un écart est connu.
 */
export function proposer(options: OptionsProposition): Choix {
  const { decisions, jour } = options;

  const ecarts = REGLES_ADAPTATION.slice()
    .sort((a, b) => a.priorite - b.priorite)
    .flatMap((regle) => {
      const proposition = regle.detecter(options);
      return proposition ? [proposition] : [];
    });

  if (!ecarts.length) return { proposition: null, silence: { pourquoi: 'aucun-ecart' }, ecarts };

  const recevables = ecarts.filter((e) => {
    const decision = decisions.get(e.regle);
    if (!decision) return true;
    if (decision.issue === 'refusee') return false;
    if (decision.issue === 'reportee') {
      return ecartJours(decision.le.slice(0, 10), jour) >= DELAI_DE_REPORT_JOURS;
    }
    return true;
  });

  if (!recevables.length) {
    /*
     * Reporté n'est pas refusé, et l'écran ne doit pas dire l'un pour l'autre :
     * « vous avez refusé » à quelqu'un qui a répondu « plus tard » est une
     * petite trahison, et elle se remarque. On rend donc le délai qui reste au
     * report le plus proche, et « tout refusé » seulement quand c'est vrai de
     * tous les écarts connus.
     */
    const attentes = ecarts
      .map((e) => decisions.get(e.regle))
      .filter((d): d is Decision => d?.issue === 'reportee')
      .map((d) => DELAI_DE_REPORT_JOURS - ecartJours(d.le.slice(0, 10), jour));
    if (attentes.length) {
      return {
        proposition: null,
        silence: { pourquoi: 'ajourne', joursRestants: Math.max(1, Math.min(...attentes)) },
        ecarts,
      };
    }
    return { proposition: null, silence: { pourquoi: 'tout-refuse' }, ecarts };
  }

  /*
   * Le plafond hebdomadaire se mesure sur **toutes** les décisions, et non sur
   * celles des règles recevables : avoir refusé une proposition lundi ne doit
   * pas en faire apparaître une autre mardi. « Au plus une par semaine » parle
   * de l'attention demandée, pas de la règle qui la demande.
   */
  const derniere = [...decisions.values()]
    .map((d) => d.le.slice(0, 10))
    .filter(Boolean)
    .sort()
    .pop();
  if (derniere) {
    const depuis = ecartJours(derniere, jour);
    if (depuis < DELAI_ENTRE_PROPOSITIONS_JOURS) {
      return {
        proposition: null,
        silence: { pourquoi: 'trop-tot', joursRestants: DELAI_ENTRE_PROPOSITIONS_JOURS - depuis },
        ecarts,
      };
    }
  }

  return { proposition: recevables[0], silence: null, ecarts };
}

/* ══════════════════════════════════════════════════════════════════════════
   Réinitialiser : retrouver la valeur déclarée, et non la deviner
   ══════════════════════════════════════════════════════════════════════════ */

export interface Retour {
  champ: string;
  /** La valeur à réécrire, ou rien quand le champ n'existait pas avant. */
  valeur?: unknown;
  source?: Source;
  /** Vrai quand il faut **supprimer** le champ : il n'avait pas de valeur avant. */
  supprimer: boolean;
  /** La règle dont l'acceptation est défaite. */
  regle: string;
}

/**
 * Ce qu'il faut réécrire pour défaire toutes les adaptations acceptées.
 *
 * La valeur n'est pas devinée : elle est **retrouvée**. Le journal garde chaque
 * version de chaque champ, donc la dernière écriture antérieure à l'acceptation
 * *est* la valeur déclarée d'alors. Un « retour aux valeurs par défaut » aurait
 * effacé la déclaration en même temps que l'adaptation, et la personne aurait
 * perdu une réponse qu'elle avait donnée.
 *
 * Les champs sont rendus une seule fois, dans l'état qui précède la **première**
 * acceptation encore en vigueur : deux acceptations successives sur le même
 * champ se défont d'un coup, et non en deux remontées.
 */
export function reinitialisation(operations: readonly Operation[]): Retour[] {
  const decisions = historiqueDesDecisions(operations);

  /* La dernière remise : tout ce qui la précède est déjà défait. */
  let borne = '';
  for (const decision of decisions) if (decision.issue === 'remise') borne = decision.hlc;

  const acceptations = decisions.filter((d) => d.issue === 'acceptee' && d.hlc > borne);
  if (!acceptations.length) return [];

  const ecritures = operations
    .filter((o) => o.type === TYPE_CHAMP_PROFIL && champDeCible(o.cible))
    .sort(comparerOperations);

  const sorties: Retour[] = [];
  const vus = new Set<string>();
  for (const acceptation of acceptations) {
    const regle = PAR_ID.get(acceptation.regle);
    if (!regle || vus.has(regle.champ)) continue;
    vus.add(regle.champ);
    if (!champDeclare(regle.champ)) continue;

    /*
     * Les écritures antérieures à l'acceptation — dont **celle de
     * l'acceptation elle-même** : `accepter()` écrit le champ puis journalise
     * la décision, dans cet ordre, pour qu'aucune décision ne prétende qu'une
     * écriture a eu lieu si elle a échoué. Il faut donc la retirer avant de
     * chercher la valeur d'avant, sans quoi la remise réécrirait la valeur
     * adaptée — et ne défairait rien du tout.
     *
     * Elle se reconnaît à sa valeur : la décision porte ce qui avait été
     * proposé. À défaut — une décision d'une version antérieure, sans
     * `valeurProposee` —, on retire la dernière écriture, qui est la seule
     * candidate possible.
     */
    const avant = ecritures.filter(
      (o) => champDeCible(o.cible) === regle.champ && o.hlc < acceptation.hlc,
    );
    const memeValeur = (op: Operation): boolean => {
      const charge = op.charge as { valeur?: unknown } | undefined;
      return (
        charge !== undefined &&
        'valeur' in charge &&
        JSON.stringify(charge.valeur) === JSON.stringify(acceptation.valeurProposee)
      );
    };
    if ('valeurProposee' in acceptation) {
      while (avant.length && memeValeur(avant[avant.length - 1])) avant.pop();
    } else {
      avant.pop();
    }
    const derniere = avant[avant.length - 1];
    const charge = derniere?.charge as { valeur?: unknown; source?: Source; supprime?: boolean } | undefined;
    if (!derniere || !charge || charge.supprime === true || !('valeur' in charge)) {
      sorties.push({ champ: regle.champ, supprimer: true, regle: regle.id });
      continue;
    }
    sorties.push({
      champ: regle.champ,
      valeur: charge.valeur,
      source: charge.source ?? 'declare',
      supprimer: false,
      regle: regle.id,
    });
  }
  return sorties;
}

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle
   ══════════════════════════════════════════════════════════════════════════ */

/** Vérifie que chaque règle nomme un champ déclaré, et qu'aucune n'est double. */
export function controlerRegles(): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();
  const priorites = new Set<number>();
  for (const regle of REGLES_ADAPTATION) {
    if (vus.has(regle.id)) problemes.push(`La règle « ${regle.id} » est déclarée deux fois.`);
    vus.add(regle.id);
    if (priorites.has(regle.priorite)) {
      problemes.push(`Deux règles portent la priorité ${regle.priorite} : l’ordre serait arbitraire.`);
    }
    priorites.add(regle.priorite);
    if (!champDeclare(regle.champ)) {
      problemes.push(`La règle « ${regle.id} » porte sur « ${regle.champ} », qui n’est pas un champ.`);
    }
    if (regle.libelle.trim().length < 15) {
      problemes.push(`La règle « ${regle.id} » n’a pas de libellé lisible.`);
    }
  }
  return problemes;
}
