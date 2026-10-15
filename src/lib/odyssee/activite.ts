/**
 * Le moteur d'activité : XP, niveau et série, calculés **une seule fois**.
 *
 * ## La règle, et ce qu'elle coûte si on y renonce
 *
 * B.1 l'impose, la décision 2 l'a confirmée : l'XP, le niveau et la série sont
 * calculés par Odyssée, à partir des faits, et nulle part ailleurs. Deux
 * calculateurs produisent deux vérités, et c'est le genre de divergence qu'on
 * ne découvre qu'après des mois d'historique — quand il est trop tard pour la
 * réconcilier. Révisions montre sa part, Sport la sienne ; le total n'a qu'une
 * source.
 *
 * ## Un catalogue de règles, et non des formules dans les écrans
 *
 * Aujourd'hui, l'XP est attribuée à neuf endroits du code, chacun appelant
 * `gagnerXp` avec sa propre formule. Rien n'est faux là-dedans, mais trois
 * choses y sont impossibles : dire d'où vient un total, rejouer l'histoire sous
 * les règles d'aujourd'hui, et répondre à « pourquoi ai-je gagné 34 XP hier ? ».
 * Les règles sont donc déclarées ici, chacune nommant le type de fait qu'elle
 * écoute et la formule qu'elle applique, et le moteur rend un **journal** :
 * une ligne par fait crédité, avec sa règle, sa base et son multiplicateur.
 *
 * Les formules sont celles du site actuel, au point près. C'est volontaire :
 * la migration (décision 2) convertit sans recalculer, et une règle réécrite
 * « en mieux » aurait fait mentir la comparaison qui prouve la migration.
 *
 * ## Aucun multiplicateur n'est déclaré, et c'est une décision
 *
 * Le mécanisme existe — une règle rend une base, les multiplicateurs
 * s'appliquent dessus, et le journal les nomme — mais la liste est vide. L'XP
 * du site n'a jamais eu de multiplicateur ; en introduire un ici, au moment où
 * l'on reprend l'historique, changerait les totaux sans que personne l'ait
 * demandé. Le jour où il en faut un, il s'ajoute à `MULTIPLICATEURS` et le
 * journal l'explique de lui-même.
 *
 * ## Ce module est pur
 *
 * Il ne lit ni la base, ni les réglages, ni l'heure. Les faits entrent, le
 * journal sort. C'est ce qui permet de l'éprouver sur des cas construits, et
 * de rejouer cinq ans d'historique en mémoire sans rien écrire.
 */
import config from '../../../site.config.mjs';
import type { Fait } from '../noyau/faits';
import { decalerJourLogique, ecartJoursLogiques } from '../noyau/jour-logique';

const XP = (config as { xp: Record<string, number> }).xp;

/* ══════════════════════════════════════════════════════════════════════════
   L'échelle des niveaux
   ══════════════════════════════════════════════════════════════════════════ */

export interface Niveau {
  niveau: number;
  xpDansNiveau: number;
  xpRequisNiveau: number;
  /** De 0 à 1. */
  progression: number;
}

/**
 * Le niveau n coûte 100 + (n−1) × 50 XP.
 *
 * Barème inchangé depuis le premier jour du site. Il vit ici parce que le
 * niveau est une propriété de l'activité, et que `gamification.ts` le
 * ré-exporte pour que les écrans n'aient rien à savoir de ce déplacement.
 */
export function coutNiveau(niveau: number): number {
  return 100 + (niveau - 1) * 50;
}

export function calculerNiveau(xpTotal: number): Niveau {
  let niveau = 1;
  let reste = Math.max(0, xpTotal);
  while (reste >= coutNiveau(niveau)) {
    reste -= coutNiveau(niveau);
    niveau += 1;
  }
  const requis = coutNiveau(niveau);
  return { niveau, xpDansNiveau: reste, xpRequisNiveau: requis, progression: reste / requis };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les règles
   ══════════════════════════════════════════════════════════════════════════ */

export interface RegleXp {
  id: string;
  libelle: string;
  /** Le type de fait écouté. */
  type: string;
  /**
   * Discrimine deux règles sur un même type.
   *
   * Les trois familles de Cog-Training partagent le type
   * `revision.cog-training` et n'ont pas la même formule : la famille est dans
   * les détails du fait, et c'est elle qui choisit la règle.
   */
  quand?: (fait: Fait) => boolean;
  /** Le domaine crédité. Celui du fait, sauf mention contraire. */
  domaine?: string;
  /** La base en XP, avant multiplicateurs. */
  base: (fait: Fait) => number;
  /** Le détail du calcul, en français, pour le journal. */
  pourquoi: (fait: Fait) => string;
}

/** Lit un nombre dans les détails d'un fait, sans jamais rendre `NaN`. */
const nombre = (fait: Fait, clef: string): number => {
  const v = fait.details?.[clef];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

const drapeau = (fait: Fait, clef: string): boolean => fait.details?.[clef] === true;

const texte = (fait: Fait, clef: string): string => {
  const v = fait.details?.[clef];
  return typeof v === 'string' ? v : '';
};

/** Le palier de la note de séance : une à deux pages rédigées. */
function paliernote(signes: number): number {
  return signes >= 1200 ? 20 : signes >= 400 ? 10 : 0;
}

export const REGLES: readonly RegleXp[] = [
  {
    id: 'seance-tenue',
    libelle: 'Séance de révision tenue',
    type: 'revision.seance',
    base: (f) =>
      20 + nombre(f, 'restitutions') * 8 + paliernote(nombre(f, 'signesNote')) + (drapeau(f, 'etendue') ? 10 : 0),
    pourquoi: (f) => {
      const parts = ['20 pour la séance tenue'];
      const r = nombre(f, 'restitutions');
      if (r) parts.push(`${r} × 8 pour les restitutions à blanc rédigées`);
      const n = paliernote(nombre(f, 'signesNote'));
      if (n) parts.push(`${n} pour la note de séance (${nombre(f, 'signesNote')} signes)`);
      if (drapeau(f, 'etendue')) parts.push('10 pour la séance étendue du 1er du mois');
      return parts.join(', ');
    },
  },
  {
    id: 'flashcards-notees',
    libelle: 'Flashcards notées',
    type: 'revision.flashcards',
    base: (f) =>
      nombre(f, 'oublie') * XP.flashcardOublie +
      nombre(f, 'difficile') * XP.flashcardDifficile +
      nombre(f, 'correct') * XP.flashcardCorrect +
      nombre(f, 'facile') * XP.flashcardFacile,
    pourquoi: (f) =>
      (
        [
          ['oublie', XP.flashcardOublie, 'oubliée'],
          ['difficile', XP.flashcardDifficile, 'difficile'],
          ['correct', XP.flashcardCorrect, 'correcte'],
          ['facile', XP.flashcardFacile, 'facile'],
        ] as const
      )
        .filter(([clef]) => nombre(f, clef) > 0)
        .map(([clef, prix, nom]) => `${nombre(f, clef)} × ${prix} (${nom})`)
        .join(', ') || 'aucune carte notée',
  },
  {
    id: 'qcm-passe',
    libelle: 'QCM passé',
    type: 'revision.qcm',
    base: (f) => XP.quizTermine + nombre(f, 'bonnes') * XP.quizBonneReponse,
    pourquoi: (f) =>
      `${XP.quizTermine} pour le QCM passé, ${nombre(f, 'bonnes')} × ${XP.quizBonneReponse} par bonne réponse` +
      (texte(f, 'origine') ? ` (${texte(f, 'origine')})` : ''),
  },
  {
    id: 'fiche-terminee',
    libelle: 'Fiche terminée',
    type: 'revision.fiche',
    base: () => XP.ficheTerminee,
    pourquoi: () => `${XP.ficheTerminee} pour la fiche marquée terminée`,
  },
  {
    id: 'pretest-tente',
    libelle: 'Prétest tenté',
    type: 'revision.pretest',
    base: () => XP.pretestTente,
    pourquoi: () => `${XP.pretestTente} pour le prétest tenté — répondre avant de lire est l’effet cherché`,
  },
  {
    id: 'cog-nback',
    libelle: 'Session de Quad N-Back',
    type: 'revision.cog-training',
    quand: (f) => texte(f, 'famille') === 'nback',
    base: (f) =>
      XP.nbackSession +
      nombre(f, 'n') * XP.nbackParNiveau +
      (nombre(f, 'taux') >= 0.8 ? XP.nbackBonusReussite : 0),
    pourquoi: (f) =>
      `${XP.nbackSession} pour la partie, ${nombre(f, 'n')} × ${XP.nbackParNiveau} pour la profondeur` +
      (nombre(f, 'taux') >= 0.8 ? `, ${XP.nbackBonusReussite} pour la réussite au-delà de 80 %` : ''),
  },
  {
    id: 'cog-relationnel',
    libelle: 'Session de Relational Reasoning',
    type: 'revision.cog-training',
    quand: (f) => texte(f, 'famille') === 'relationnel',
    base: (f) =>
      XP.relationnelSession +
      nombre(f, 'reussis') *
        (XP.relationnelParItem + Math.max(0, nombre(f, 'echelonMoyen') - 1) * XP.relationnelParPhase),
    pourquoi: (f) =>
      `${XP.relationnelSession} pour la session, ${nombre(f, 'reussis')} item(s) réussi(s) à ` +
      `${XP.relationnelParItem} + ${Math.max(0, nombre(f, 'echelonMoyen') - 1).toFixed(1)} × ${XP.relationnelParPhase} d’échelon`,
  },
  {
    id: 'cog-veridical',
    libelle: 'Session de Veridical Mapping',
    type: 'revision.cog-training',
    quand: (f) => texte(f, 'famille') === 'veridical',
    base: (f) =>
      XP.veridicalSession +
      nombre(f, 'reussis') * XP.veridicalParEssai +
      nombre(f, 'convergences') * XP.veridicalConvergence,
    pourquoi: (f) =>
      `${XP.veridicalSession} pour la session, ${nombre(f, 'reussis')} × ${XP.veridicalParEssai} par essai réussi` +
      (nombre(f, 'convergences')
        ? `, ${nombre(f, 'convergences')} × ${XP.veridicalConvergence} par seuil stabilisé`
        : ''),
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   Les multiplicateurs
   ══════════════════════════════════════════════════════════════════════════ */

export interface Multiplicateur {
  id: string;
  libelle: string;
  /** Pourquoi il s'applique, pour le journal. */
  motif: string;
  sapplique: (fait: Fait, regle: RegleXp) => boolean;
  facteur: number;
}

/**
 * Vide, et volontairement.
 *
 * Voir l'en-tête : le site n'a jamais eu de multiplicateur, et en inventer un
 * au moment de reprendre l'historique changerait des totaux que personne n'a
 * demandé de changer. Le mécanisme est là pour que le jour où il en faut un,
 * il se déclare et s'explique tout seul.
 */
export const MULTIPLICATEURS: readonly Multiplicateur[] = [];

/* ══════════════════════════════════════════════════════════════════════════
   Le journal d'XP
   ══════════════════════════════════════════════════════════════════════════ */

export interface LigneXp {
  faitId: string;
  type: string;
  regle: string;
  libelleRegle: string;
  domaine: string;
  jour: string;
  base: number;
  /** Les multiplicateurs appliqués, dans l'ordre de leur déclaration. */
  multiplicateurs: { id: string; facteur: number; motif: string }[];
  /** Le facteur total. 1 quand aucun multiplicateur ne s'applique. */
  facteur: number;
  xp: number;
  pourquoi: string;
}

export interface FaitSansRegle {
  faitId: string;
  type: string;
  /** Pourquoi il ne crédite rien : un type sans règle n'est pas une erreur. */
  motif: string;
}

export interface JournalXp {
  lignes: LigneXp[];
  total: number;
  parDomaine: Record<string, number>;
  parJour: Record<string, number>;
  /** Les faits qu'aucune règle n'écoute. */
  sansRegle: FaitSansRegle[];
}

export interface OptionsXp {
  regles?: readonly RegleXp[];
  multiplicateurs?: readonly Multiplicateur[];
  /** Arrondi d'une ligne. L'XP du site est entière. */
  arrondir?: (xp: number) => number;
}

/**
 * Le journal d'XP d'une liste de faits.
 *
 * L'arrondi se fait **par ligne**, et non sur le total : une ligne est ce que
 * la personne voit, et un total qui ne serait pas la somme de ses lignes
 * n'expliquerait rien.
 */
export function calculerXp(faits: readonly Fait[], options: OptionsXp = {}): JournalXp {
  const regles = options.regles ?? REGLES;
  const multiplicateurs = options.multiplicateurs ?? MULTIPLICATEURS;
  const arrondir = options.arrondir ?? Math.round;

  const lignes: LigneXp[] = [];
  const sansRegle: FaitSansRegle[] = [];
  const parDomaine: Record<string, number> = {};
  const parJour: Record<string, number> = {};
  let total = 0;

  for (const fait of faits) {
    const regle = regles.find((r) => r.type === fait.type && (!r.quand || r.quand(fait)));
    if (!regle) {
      sansRegle.push({
        faitId: fait.id,
        type: fait.type,
        motif: `Aucune règle d’XP n’écoute « ${fait.type} ». Le fait compte pour les indicateurs, pas pour l’XP.`,
      });
      continue;
    }
    const base = regle.base(fait);
    const appliques = multiplicateurs
      .filter((m) => m.sapplique(fait, regle))
      .map((m) => ({ id: m.id, facteur: m.facteur, motif: m.motif }));
    const facteur = appliques.reduce((f, m) => f * m.facteur, 1);
    const xp = arrondir(base * facteur);
    const domaine = regle.domaine ?? fait.domaine;
    lignes.push({
      faitId: fait.id,
      type: fait.type,
      regle: regle.id,
      libelleRegle: regle.libelle,
      domaine,
      jour: fait.jourLogique,
      base,
      multiplicateurs: appliques,
      facteur,
      xp,
      pourquoi: regle.pourquoi(fait),
    });
    total += xp;
    parDomaine[domaine] = (parDomaine[domaine] ?? 0) + xp;
    parJour[fait.jourLogique] = (parJour[fait.jourLogique] ?? 0) + xp;
  }

  return { lignes, total, parDomaine, parJour, sansRegle };
}

/* ══════════════════════════════════════════════════════════════════════════
   La série
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les types de faits qui font qu'une journée **compte**.
 *
 * La décision 2 a tranché le sens de la série : un jour compte si l'on a fait
 * **quelque chose** — révisé, s'entraîner, tenir un check-in —, et c'est
 * précisément parce que ce sens est plus large qu'avant que la série repart de
 * zéro à la migration.
 *
 * Ce que la liste écarte est aussi une décision. Une pesée, un repas, une
 * mesure, une opération bancaire ne sont pas des actes de conduite : les
 * compter ferait une série de la **mesure de soi**, ce que E.3 refuse
 * exactement. On ne garde donc que ce qui est fait, pas ce qui est constaté.
 */
export const TYPES_SERIE: readonly string[] = [
  'revision.seance',
  'revision.flashcards',
  'revision.qcm',
  'revision.fiche',
  'revision.pretest',
  'revision.cog-training',
  'sport.seance',
  'odyssee.focus',
  'odyssee.tache',
  /*
     Décision d'Alexis du 15 octobre : une occurrence pointée compte, mais
     SEULEMENT si sa tâche n'est pas liée. Le filtre ne peut pas vivre ici —
     une liste de types ne sait pas regarder la tâche d'origine — il vit à la
     projection (`faits-odyssee.ts`), qui n'émet tout simplement pas ce fait
     pour une tâche liée. Le type peut donc figurer ici sans réserve : un
     fait `odyssee.occurrence` qui existe est, par construction, celui d'une
     tâche non liée.
  */
  'odyssee.occurrence',
  'odyssee.quete',
  'odyssee.checkin',
  'odyssee.revue',
  'odyssee.apport-externe',
  'odyssee.interaction',
];

/**
 * Au-delà de quinze jours, ce n'est plus un repos, c'est une interruption.
 *
 * Même borne que la série actuelle (`gamification.ts`), pour la même raison :
 * respecter son propre planning ne peut pas coûter une série, mais un planning
 * qui prévoit trois semaines sans rien n'est pas un planning de repos.
 */
export const ECART_MAXIMAL_RATTRAPABLE = 15;

export interface Serie {
  courante: number;
  record: number;
  /** Le dernier jour logique qui compte, ou `null` s'il n'y en a aucun. */
  dernierJour: string | null;
  /** Les jours sautés qui n'ont pas cassé la série, parce qu'ils étaient de repos. */
  reposTraverses: string[];
}

export interface OptionsSerie {
  /**
   * Le jour de repos déclaré, lu à l'extérieur du moteur.
   *
   * Injecté plutôt qu'importé : la question « ce jour était-il un jour de
   * repos ? » se répond dans les réglages de planification, et un moteur qui
   * irait les lire ne serait plus éprouvable sur un cas construit.
   */
  estRepos?: (jour: string) => boolean;
  /** Jusqu'à quel jour la série est arrêtée. Par défaut, le dernier jour actif. */
  jusqua?: string;
  /** Le record déjà atteint avant la fenêtre considérée. */
  recordAnterieur?: number;
}

/** Les jours logiques qui comptent, triés, sans doublon. */
export function joursActifs(
  faits: readonly Fait[],
  types: readonly string[] = TYPES_SERIE,
): string[] {
  const vus = new Set<string>();
  for (const fait of faits) {
    if (!types.includes(fait.type)) continue;
    if (!fait.jourLogique) continue;
    vus.add(fait.jourLogique);
  }
  return [...vus].sort();
}

/**
 * La série courante et le record, à partir des jours actifs.
 *
 * Un trou ne casse la série que si l'un des jours sautés n'était pas un jour de
 * repos déclaré. Et la série ne « court » que si le dernier jour actif est
 * encore atteignable depuis `jusqua` — sans quoi une série de 240 jours
 * abandonnée en mars s'afficherait encore en octobre.
 */
export function serie(jours: readonly string[], options: OptionsSerie = {}): Serie {
  const estRepos = options.estRepos ?? (() => false);
  const ordonnes = [...new Set(jours)].sort();
  if (!ordonnes.length) {
    return {
      courante: 0,
      record: options.recordAnterieur ?? 0,
      dernierJour: null,
      reposTraverses: [],
    };
  }

  /** La série est-elle intacte entre deux jours actifs consécutifs ? */
  const continuee = (precedent: string, suivant: string): { oui: boolean; repos: string[] } => {
    const e = ecartJoursLogiques(precedent, suivant);
    if (e <= 0) return { oui: true, repos: [] };
    if (e === 1) return { oui: true, repos: [] };
    if (e > ECART_MAXIMAL_RATTRAPABLE) return { oui: false, repos: [] };
    const repos: string[] = [];
    for (let jour = decalerJourLogique(precedent, 1); jour < suivant; jour = decalerJourLogique(jour, 1)) {
      if (!estRepos(jour)) return { oui: false, repos: [] };
      repos.push(jour);
    }
    return { oui: true, repos };
  };

  let courante = 1;
  let record = Math.max(1, options.recordAnterieur ?? 0);
  let reposTraverses: string[] = [];
  for (let i = 1; i < ordonnes.length; i += 1) {
    const { oui, repos } = continuee(ordonnes[i - 1], ordonnes[i]);
    if (oui) {
      courante += 1;
      reposTraverses = [...reposTraverses, ...repos];
    } else {
      courante = 1;
      reposTraverses = [];
    }
    if (courante > record) record = courante;
  }

  const dernierJour = ordonnes[ordonnes.length - 1];
  const jusqua = options.jusqua;
  if (jusqua && jusqua > dernierJour) {
    const { oui } = continuee(dernierJour, jusqua);
    // « jusqua » n'est pas un jour actif : il n'ajoute rien, mais il peut
    // montrer que la série est déjà tombée.
    if (!oui) courante = 0;
  }

  return { courante, record, dernierJour, reposTraverses };
}
