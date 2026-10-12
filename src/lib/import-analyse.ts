/**
 * L'import d'une analyse : valider, recalculer, conserver, trier.
 *
 * `noyau/validateur-analyse.ts` dit si le document tient ;
 * `noyau/verification.ts` dit ce que valent les chiffres cités. Ce module leur
 * donne la base : le catalogue réel, le journal des exports, le recalcul des
 * indicateurs, et la conservation de l'analyse.
 *
 * ## Recalculer « à la version des données de l'export »
 *
 * B.6.4 le demande, et c'est la seule lecture honnête. Le vecteur de versions du
 * manifeste dit deux choses : jusqu'où le journal portait, et ce qui avait déjà
 * été compacté. La seconde est celle qui sauve la vérification : une preuve
 * portant sur une période dont le détail a été effacé est **non vérifiable**, et
 * non « non retrouvée ». Dire « non retrouvée » accuserait l'IA d'avoir inventé
 * alors que c'est nous qui ne savons plus.
 *
 * ## L'analyse conservée est une donnée, jamais une consigne
 *
 * Elle est stockée journalisée — donc chiffrée et synchronisée comme le reste —
 * et **étiquetée** « analyse externe produite par une IA, non vérifiée ». Son
 * texte peut contenir n'importe quoi, y compris des instructions : il n'est
 * jamais rendu autrement qu'en texte échappé, et jamais interprété.
 */
import { db, lireAppareil, toutesLesOperations } from './db';
import { decoderHlc } from './noyau/hlc';
import { operation, SANS_LOT } from './noyau/operations';
import { ulid } from './noyau/ulid';
import { prochaineHlc } from './sync/horloge-locale';
import { jourLogique } from './noyau/jour-logique';
import { INDICATEURS, indicateur } from './odyssee/indicateurs';
import { periodeLibre } from './odyssee/syntheses';
import { rassembler } from './indicateurs';
import { exportConnu } from './export-ia';
import {
  validerTexte,
  promptDeReparation,
  type Contexte,
  type Erreur,
  type Verdict as VerdictValidation,
} from './noyau/validateur-analyse';
import {
  compter,
  controlerTri,
  etatDuConstat,
  verifier,
  type EtatConstat,
  type Recalcul,
  type Tri,
  type Verification,
} from './noyau/verification';

/* ══════════════════════════════════════════════════════════════════════════
   L'analyse conservée
   ══════════════════════════════════════════════════════════════════════════ */

export const TYPE_ANALYSE = 'analyse.importee';

export const cibleDeLAnalyse = (id: string): string => `analyse:${id}`;

/** L'étiquette, obligatoire et jamais modifiable. */
export const ETIQUETTE = 'analyse externe produite par une IA, non vérifiée';

export interface AnalyseConservee {
  id: string;
  /** L'export dont elle répond, ou vide si l'export est inconnu. */
  exportId: string;
  empreinte: string;
  /** Vrai quand l'export n'a pas été retrouvé au journal. */
  exportInconnu: boolean;
  periode: { debut: string; fin: string };
  importeeLe: string;
  etiquette: string;
  /** Le document validé, tel quel. Lu comme une donnée, jamais exécuté. */
  analyse: Record<string, unknown>;
  /** Les verdicts de vérification, pour ne pas les recalculer à chaque lecture. */
  verifications: {
    constat: string;
    etat: EtatConstat;
    preuves: { indicateur: string; verdict: string; raison: string; recalculee?: number }[];
  }[];
  /** Le tri appliqué, quand il l'a été. */
  tri?: Tri;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le recalcul, à la version de l'export
   ══════════════════════════════════════════════════════════════════════════ */

export interface Borne {
  /** Le premier jour dont le détail existe encore, s'il y a eu compaction. */
  detailDepuis?: string;
}

/**
 * Recalcule un indicateur sur une période, ou dit pourquoi il ne peut pas.
 *
 * La borne de compaction est vérifiée **avant** toute lecture : recalculer sur
 * un journal amputé rendrait un chiffre faux présenté comme vrai, ce qui est
 * exactement ce que B.6.4 interdit.
 */
export async function recalculer(
  id: string,
  periode: { debut: string; fin: string },
  borne: Borne,
  options: { maintenant?: Date; reglages?: { heureBascule: number; fuseau: string } } = {},
): Promise<Recalcul> {
  const indic = indicateur(id);
  if (!indic) return { quoi: 'inconnu' };
  if (borne.detailDepuis && periode.debut < borne.detailDepuis) {
    return { quoi: 'compacte', detailDepuis: borne.detailDepuis };
  }

  const p = periodeLibre(periode.debut, periode.fin);
  const fenetre = await rassembler(p, options);
  const mesure = indic.calcul(fenetre);
  if (!mesure) return { quoi: 'aucune-donnee' };
  return { quoi: 'valeur', valeur: mesure.valeur, unite: indic.unite };
}

/* ══════════════════════════════════════════════════════════════════════════
   L'aperçu
   ══════════════════════════════════════════════════════════════════════════ */

export interface Apercu {
  /** Le verdict de la validation : en échec, rien d'autre n'est rempli. */
  validation: VerdictValidation;
  /** Le prompt à copier, quand la validation a échoué. */
  reparation?: string;
  /** L'analyse lue, quand elle est recevable. */
  analyse?: Record<string, unknown>;
  /** L'export d'origine, s'il est au journal. */
  exportInconnu?: boolean;
  /** Les vérifications, par constat. */
  parConstat?: { constat: string; enonce: string; etat: EtatConstat; verifications: Verification[] }[];
  /** Le compte par verdict, pour le résumé. */
  comptes?: Record<string, number>;
  /** Les liens proposition → constats, pour le contrôle du tri. */
  liens?: Record<string, string[]>;
}

const texte = (valeur: unknown, defaut = ''): string =>
  typeof valeur === 'string' ? valeur : defaut;

/**
 * Valide un texte collé, puis vérifie ses chiffres.
 *
 * Rien n'est conservé à ce stade : l'aperçu de B.6.5 précède l'intégration, et
 * une analyse qu'on a seulement regardée ne doit pas se retrouver en base.
 */
export async function apercevoir(brut: string): Promise<Apercu> {
  const { reglagesJourLogiqueLocaux } = await import('./adaptation');
  const reglages = await reglagesJourLogiqueLocaux();

  /*
   * Premier passage **sans** contexte d'export : il faut avoir lu
   * `export_id` pour aller le chercher au journal, et la validation est la
   * seule façon sûre de le lire.
   */
  const sansContexte: Contexte = { indicateurs: INDICATEURS.map((i) => i.id) };
  const premier = validerTexte(brut, sansContexte);
  if (!premier.recevable || !premier.analyse) {
    return { validation: premier, reparation: promptDeReparation(premier.erreurs) };
  }

  const exportId = texte(premier.analyse.export_id);
  const connu = exportId ? await exportConnu(exportId) : null;

  /* Second passage, avec le contexte : la période et l'empreinte sont alors
     comparées à celles du manifeste. */
  const contexte: Contexte = connu
    ? {
        indicateurs: sansContexte.indicateurs,
        periode: connu.periode,
        exportId: connu.exportId,
        empreinte: connu.empreinte,
      }
    : sansContexte;
  const validation = connu ? validerTexte(brut, contexte) : premier;
  if (!validation.recevable || !validation.analyse) {
    return { validation, reparation: promptDeReparation(validation.erreurs) };
  }

  const borne = await borneDeCompaction();
  const constats = Array.isArray(validation.analyse.constats) ? validation.analyse.constats : [];
  const parConstat: NonNullable<Apercu['parConstat']> = [];
  const toutes: Verification[] = [];

  for (const brutConstat of constats) {
    if (!brutConstat || typeof brutConstat !== 'object') continue;
    const constat = brutConstat as Record<string, unknown>;
    const preuves = Array.isArray(constat.preuves) ? constat.preuves : [];
    const verifications: Verification[] = [];
    for (const brutPreuve of preuves) {
      if (!brutPreuve || typeof brutPreuve !== 'object') continue;
      const preuve = brutPreuve as Record<string, unknown>;
      const periode = (preuve.periode ?? {}) as { debut?: unknown; fin?: unknown };
      const lue = {
        indicateur: texte(preuve.indicateur),
        periode: { debut: texte(periode.debut), fin: texte(periode.fin) },
        valeurCitee: typeof preuve.valeur_citee === 'number' ? preuve.valeur_citee : NaN,
        unite: texte(preuve.unite),
      };
      const recalcul = await recalculer(lue.indicateur, lue.periode, borne, { reglages });
      verifications.push(verifier(lue, recalcul));
    }
    toutes.push(...verifications);
    parConstat.push({
      constat: texte(constat.id),
      enonce: texte(constat.enonce),
      etat: etatDuConstat(verifications),
      verifications,
    });
  }

  const propositions = Array.isArray(validation.analyse.propositions)
    ? validation.analyse.propositions
    : [];
  const liens: Record<string, string[]> = {};
  for (const brutProposition of propositions) {
    if (!brutProposition || typeof brutProposition !== 'object') continue;
    const proposition = brutProposition as Record<string, unknown>;
    liens[texte(proposition.id)] = Array.isArray(proposition.lie_aux_constats)
      ? proposition.lie_aux_constats.filter((x): x is string => typeof x === 'string')
      : [];
  }

  return {
    validation,
    analyse: validation.analyse,
    exportInconnu: !connu,
    parConstat,
    comptes: compter(toutes),
    liens,
  };
}

/**
 * La borne de compaction, lue du journal local.
 *
 * Et non du manifeste de l'export : une compaction peut avoir eu lieu **depuis**
 * l'export, et c'est précisément le cas où la vérification devient impossible.
 * Lire le manifeste dirait « tout était là au moment de l'export », ce qui est
 * vrai et sans intérêt pour un recalcul fait aujourd'hui.
 */
export async function borneDeCompaction(): Promise<Borne> {
  const { compactagesDeclares, perimetre } = await import('./sync/compaction');
  const operations = await toutesLesOperations();
  const bornes = [...perimetre(compactagesDeclares(operations)).values()].sort();
  if (!bornes.length) return {};
  /*
   * La borne est une horloge logique, pas une date. Le jour à partir duquel le
   * détail existe est celui de la plus ancienne opération qui lui survit.
   */
  const plusHaute = bornes[bornes.length - 1];
  const survivantes = operations.filter((o) => o.hlc > plusHaute);
  if (!survivantes.length) return { detailDepuis: jourLogique(new Date()) };
  const plusAncienne = survivantes.reduce((a, b) => (a.hlc < b.hlc ? a : b));
  const charge = plusAncienne.charge as { jour?: unknown } | undefined;
  return {
    detailDepuis:
      typeof charge?.jour === 'string' ? charge.jour : jourLogique(new Date()),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Conserver
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Conserve l'analyse, étiquetée, rattachée à sa période.
 *
 * Journalisée et non mise en magasin : elle voyage alors avec le reste, et le
 * téléphone verra l'analyse importée sur l'ordinateur. L'étiquette est posée
 * ici et non par l'appelant — un appelant qui l'oublierait conserverait une
 * analyse d'IA indiscernable d'une donnée mesurée.
 */
export async function conserver(apercu: Apercu, tri?: Tri): Promise<AnalyseConservee> {
  if (!apercu.analyse) throw new Error('Rien à conserver : l’analyse n’est pas recevable.');
  const analyse = apercu.analyse;
  const periode = (analyse.periode ?? {}) as { debut?: unknown; fin?: unknown };
  const conservee: AnalyseConservee = {
    id: ulid(),
    exportId: texte(analyse.export_id),
    empreinte: texte(analyse.export_empreinte),
    exportInconnu: apercu.exportInconnu === true,
    periode: { debut: texte(periode.debut), fin: texte(periode.fin) },
    importeeLe: new Date().toISOString(),
    etiquette: ETIQUETTE,
    analyse,
    verifications: (apercu.parConstat ?? []).map((c) => ({
      constat: c.constat,
      etat: c.etat,
      preuves: c.verifications.map((v) => ({
        indicateur: v.preuve.indicateur,
        verdict: v.verdict,
        raison: v.raison,
        ...(v.recalculee !== undefined ? { recalculee: v.recalculee } : {}),
      })),
    })),
    ...(tri ? { tri } : {}),
  };

  const op = operation({
    id: ulid(),
    appareil: await lireAppareil(),
    hlc: decoderHlc(await prochaineHlc()),
    type: TYPE_ANALYSE,
    cible: cibleDeLAnalyse(conservee.id),
    lot: SANS_LOT,
    charge: conservee,
  });
  await (await db()).put('operations', op);
  return conservee;
}

export async function analysesConservees(): Promise<AnalyseConservee[]> {
  const operations = await toutesLesOperations();
  return operations
    .filter((o) => o.type === TYPE_ANALYSE)
    .map((o) => o.charge as AnalyseConservee)
    .filter((a) => typeof a?.id === 'string')
    .sort((a, b) => (a.importeeLe < b.importeeLe ? 1 : -1));
}

/** Les analyses rattachées à une période, pour la revue correspondante. */
export async function analysesDeLaPeriode(
  debut: string,
  fin: string,
): Promise<AnalyseConservee[]> {
  return (await analysesConservees()).filter(
    (a) => a.periode.debut >= debut && a.periode.fin <= fin,
  );
}

export { ETIQUETTE as ETIQUETTE_ANALYSE, controlerTri, promptDeReparation };
export type { Erreur, Tri, Verification };
