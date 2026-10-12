/**
 * Ce que Sport propose, et ce qu'il ne dit jamais.
 *
 * ## La lecture de la décision 5, qui tient en une phrase
 *
 * **Sport propose, la personne dispose, et le réel fait foi.**
 *
 * Concrètement, et c'est la partie qui se code :
 *
 * - Sport propose de monter. Vous refusez : la proposition **disparaît** pour
 *   une durée réglable et ne revient que si les données changent nettement.
 * - Vous refusez **et vous montez quand même** : Sport enregistre ce que vous
 *   avez fait, met à jour la progression, et **ne dit rien**.
 * - Vous acceptez **et vous ne montez pas** : même traitement.
 *
 * ## Aucune mémoire de désobéissance
 *
 * Il n'existe nulle part un compteur de « propositions non suivies », et aucun
 * écran ne renvoie un refus. Ce n'est pas une politesse : un logiciel qui
 * tient le compte de ce qu'on ne fait pas devient un logiciel qu'on n'ouvre
 * plus. La seule trace est l'historique de ce qui a eu lieu.
 *
 * Le refus est donc enregistré **pour une seule raison** : ne pas reposer la
 * même question demain. Il porte une date d'expiration, et rien d'autre ne le
 * lit.
 *
 * ## Le garde-fou, qui ne se négocie pas
 *
 * En présence d'une douleur ou d'une blessure déclarée sur un muscle
 * sollicité, Sport **ne propose jamais** de progresser. Il propose de réduire,
 * et de consulter si la douleur persiste. Si vous progressez quand même, il
 * l'enregistre sans commentaire, comme le reste.
 *
 * Cette règle est écrite **avant** toutes les autres dans `proposer`, et aucun
 * réglage ne la désactive.
 */
import type { Blessure, Exercice, Serie } from './modele';
import { musclesEmpeches } from './modele';
import { maximumEstime, plateau, type PointDeForce } from './force';

/** Par défaut, un refus vaut pour trois semaines. */
export const JOURS_DE_SILENCE = 21;

/** En deçà, on ne propose rien : trop peu de séances pour savoir. */
export const SEANCES_MINIMALES = 3;

export type SorteDeProposition = 'monter' | 'reduire' | 'consulter' | 'varier';

export interface Proposition {
  sorte: SorteDeProposition;
  exerciceId: string;
  /** Ce que l'écran affiche. */
  texte: string;
  /** Ce qui l'a produite : la proposition se discute, donc elle s'explique. */
  parceQue: string;
  /** La charge suggérée, quand il y en a une. */
  charge?: number;
}

export interface Silence {
  pourquoi: 'pas-assez-de-seances' | 'refus-recent' | 'rien-a-dire';
  /** Jours restants avant qu'une proposition refusée puisse revenir. */
  joursRestants?: number;
}

export interface Refus {
  exerciceId: string;
  sorte: SorteDeProposition;
  /** Jour logique jusqu'auquel la proposition se tait. */
  jusquAu: string;
  /**
   * La charge au moment du refus.
   *
   * Sert à la seule exception au silence : « les données changent nettement ».
   * Si la charge réelle a monté depuis, le refus ne porte plus sur la même
   * situation, et se taire reviendrait à ignorer un progrès.
   */
  chargeAuRefus: number | null;
}

export interface Contexte {
  exercice: Exercice;
  /** La courbe de force, du plus ancien au plus récent. */
  points: readonly PointDeForce[];
  /** Les séries de la dernière séance portant sur cet exercice. */
  dernieresSeries: readonly Serie[];
  blessures: readonly Blessure[];
  refus: readonly Refus[];
  aujourdhui: string;
  maintenant?: Date;
}

/** L'incrément proposé : 2,5 kg sur les gros mouvements, 1 kg sur les petits. */
const increment = (exercice: Exercice): number =>
  exercice.principaux.some((m) =>
    ['quadriceps', 'ischio-jambiers', 'fessiers', 'dorsaux', 'pectoraux'].includes(m),
  )
    ? 2.5
    : 1;

/**
 * Ce que Sport a à dire sur cet exercice, ou rien.
 *
 * L'ordre des règles **est** la règle : le garde-fou passe avant tout, le
 * silence d'un refus avant les propositions, et « rien à dire » est une
 * réponse légitime qu'il vaut mieux rendre que de meubler.
 */
export function proposer(contexte: Contexte): {
  proposition: Proposition | null;
  silence: Silence | null;
} {
  const maintenant = contexte.maintenant ?? new Date();

  /* ── 1. Le garde-fou. Avant tout, et rien ne le désactive. ──────────────── */
  const empeches = musclesEmpeches(contexte.blessures, maintenant);
  const touches = [...contexte.exercice.principaux, ...contexte.exercice.secondaires].filter((m) =>
    empeches.muscles.has(m),
  );
  if (empeches.general || touches.length) {
    /*
       On propose de réduire, et de consulter si cela dure. Jamais de
       progresser — pas même « si la douleur le permet », qui serait une
       progression déguisée en précaution.
    */
    const ancienne = contexte.blessures.some(
      (b) =>
        b.fin === null &&
        Date.parse(b.debut) < maintenant.getTime() - 14 * 86400000 &&
        (b.muscles.length === 0 || b.muscles.some((m) => touches.includes(m))),
    );
    return {
      proposition: {
        sorte: ancienne ? 'consulter' : 'reduire',
        exerciceId: contexte.exercice.id,
        texte: ancienne
          ? 'Cette douleur dure depuis plus de deux semaines : il vaut mieux consulter.'
          : 'Réduisez la charge, ou passez cet exercice.',
        parceQue: empeches.general
          ? 'Une gêne générale est déclarée et ouverte.'
          : `Une douleur est déclarée sur : ${touches.join(', ')}.`,
      },
      silence: null,
    };
  }

  /* ── 2. Assez de séances pour savoir quelque chose ? ────────────────────── */
  if (contexte.points.length < SEANCES_MINIMALES) {
    return { proposition: null, silence: { pourquoi: 'pas-assez-de-seances' } };
  }

  const dernier = contexte.points[contexte.points.length - 1];

  /* ── 3. Un refus récent tient, sauf si les données ont nettement changé ── */
  for (const refus of contexte.refus) {
    if (refus.exerciceId !== contexte.exercice.id) continue;
    if (refus.jusquAu < contexte.aujourdhui) continue;
    /*
       L'exception : la charge réelle a dépassé celle du refus. La personne a
       progressé d'elle-même, le refus ne porte plus sur la même situation, et
       se taire reviendrait à ignorer ce qui a eu lieu. On ne lui dit pas
       qu'elle avait refusé — c'est précisément ce que « aucune mémoire de
       désobéissance » interdit.
    */
    const aProgresse =
      refus.chargeAuRefus !== null && dernier.charge > refus.chargeAuRefus * 1.02;
    if (aProgresse) break;
    const restants = Math.max(
      0,
      Math.round(
        (Date.parse(`${refus.jusquAu}T00:00:00.000Z`) -
          Date.parse(`${contexte.aujourdhui}T00:00:00.000Z`)) /
          86400000,
      ),
    );
    return { proposition: null, silence: { pourquoi: 'refus-recent', joursRestants: restants } };
  }

  /* ── 4. Monter : la dernière séance était-elle trop facile ? ─────────────
     Deux signaux, et il en faut **deux concordants** : des répétitions en
     réserve sur toutes les séries, et aucune série menée à l'échec. Un seul
     suffirait à proposer une montée après une séance d'échauffement.
  */
  const avecReserve = contexte.dernieresSeries.filter((s) => s.reserve !== null);
  const toutesFaciles =
    avecReserve.length > 0 &&
    avecReserve.length === contexte.dernieresSeries.length &&
    avecReserve.every((s) => (s.reserve ?? 0) >= 2);
  const aucunEchec = contexte.dernieresSeries.every((s) => !s.echec);
  if (toutesFaciles && aucunEchec && dernier.charge > 0) {
    const pas = increment(contexte.exercice);
    return {
      proposition: {
        sorte: 'monter',
        exerciceId: contexte.exercice.id,
        texte: `Essayez ${dernier.charge + pas} kg la prochaine fois.`,
        parceQue: `Toutes les séries de la dernière séance gardaient au moins deux répétitions en réserve.`,
        charge: dernier.charge + pas,
      },
      silence: null,
    };
  }

  /* ── 5. Varier : un plateau n'appelle pas à forcer ───────────────────────
     Un plateau ne déclenche **pas** une proposition de monter. Insister plus
     fort sur ce qui ne progresse plus est la réaction la plus naturelle et la
     moins efficace ; changer de variante, d'angle ou de plage de répétitions
     est ce que ferait quelqu'un qui sait.
  */
  const stagne = plateau(contexte.points);
  if (stagne.atteint) {
    return {
      proposition: {
        sorte: 'varier',
        exerciceId: contexte.exercice.id,
        texte: 'Changez de variante, d’angle ou de plage de répétitions.',
        parceQue: `${stagne.seances} séances sans dépasser ${stagne.record} kg.`,
      },
      silence: null,
    };
  }

  return { proposition: null, silence: { pourquoi: 'rien-a-dire' } };
}

/** Enregistre un refus. C'est la seule chose que le refus produit. */
export function refuser(
  exerciceId: string,
  sorte: SorteDeProposition,
  aujourdhui: string,
  chargeAuRefus: number | null,
  jours = JOURS_DE_SILENCE,
): Refus {
  const jusquAu = new Date(Date.parse(`${aujourdhui}T00:00:00.000Z`) + jours * 86400000)
    .toISOString()
    .slice(0, 10);
  return { exerciceId, sorte, jusquAu, chargeAuRefus };
}

/**
 * Le catalogue des règles se tient-il ?
 *
 * Un contrôle déclaratif, comme ailleurs : il vérifie que le garde-fou est
 * bien le premier test de `proposer`, en l'éprouvant sur un cas où toutes les
 * autres règles voudraient proposer de monter.
 */
export function controlerGardeFou(): string[] {
  const problemes: string[] = [];
  const exercice: Exercice = {
    id: 'X',
    nom: 'Développé couché',
    nature: 'force',
    lateralite: 'bilateral',
    equipement: 'barre',
    variante: '',
    unite: 'kg',
    principaux: ['pectoraux'],
    secondaires: ['triceps'],
    fourni: false,
    majLe: '2026-10-01T00:00:00.000Z',
  };
  const points: PointDeForce[] = ['2026-10-01', '2026-10-05', '2026-10-09'].map((jour) => ({
    jour,
    estime: 100,
    charge: 80,
    repetitions: 8,
    imprecis: false,
    phase: null,
  }));
  const series: Serie[] = [
    { exerciceId: 'X', charge: 80, repetitions: 8, echec: false, reserve: 3, repos: 120, le: '2026-10-09T10:00:00.000Z' },
  ];
  const blessure: Blessure = {
    id: 'B',
    muscles: ['pectoraux'],
    intensite: 5,
    debut: '2026-10-08T00:00:00.000Z',
    fin: null,
    note: '',
    majLe: '2026-10-08T00:00:00.000Z',
  };

  const sans = proposer({
    exercice,
    points,
    dernieresSeries: series,
    blessures: [],
    refus: [],
    aujourdhui: '2026-10-10',
    maintenant: new Date('2026-10-10T10:00:00.000Z'),
  });
  if (sans.proposition?.sorte !== 'monter') {
    problemes.push('Sans blessure, ce cas devrait proposer de monter — le contrôle ne prouve rien.');
  }

  const avec = proposer({
    exercice,
    points,
    dernieresSeries: series,
    blessures: [blessure],
    refus: [],
    aujourdhui: '2026-10-10',
    maintenant: new Date('2026-10-10T10:00:00.000Z'),
  });
  if (avec.proposition?.sorte === 'monter') {
    problemes.push('Une blessure ouverte n’a pas empêché une proposition de progresser.');
  }
  if (avec.proposition?.sorte !== 'reduire') {
    problemes.push('Une blessure ouverte devrait proposer de réduire.');
  }
  return problemes;
}

/** L'estimation, réexportée : les écrans de Sport n'importent qu'ici. */
export { maximumEstime };
