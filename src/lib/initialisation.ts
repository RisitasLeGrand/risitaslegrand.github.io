/**
 * L'initialisation, côté base : ce qui est observé, ce qui est reporté, ce qui
 * est posé.
 *
 * `noyau/initialisation.ts` tient le parcours et `noyau/observation.ts` les
 * constats ; ce module leur donne IndexedDB, le registre de parcours et les
 * niveaux estimés. Même frontière que partout : les règles sont éprouvables
 * sans navigateur, les lectures ne le sont pas.
 */
import { lireAppareil, toutesLesOperations } from './db';
import { prochaineHlc } from './sync/horloge-locale';
import { decoderHlc } from './noyau/hlc';
import { operation, SANS_LOT, type Operation } from './noyau/operations';
import { ulid } from './noyau/ulid';
import { db } from './db';
import {
  TYPE_MODULE,
  TYPE_REPORT,
  cibleDuModule,
  cibleDuReport,
  etat,
  lireModules,
  lireReports,
  parcours,
  porte,
  type ChargeReport,
  type EtatInitialisation,
  type Parcours,
  type Porte,
} from './noyau/initialisation';
import { deduire, observer, type Deduction, type Observation } from './noyau/observation';

async function journaliser(cible: string, type: string, charge: unknown): Promise<Operation> {
  const op = operation({
    id: ulid(),
    appareil: await lireAppareil(),
    hlc: decoderHlc(await prochaineHlc()),
    type,
    cible,
    lot: SANS_LOT,
    charge,
  });
  await (await db()).put('operations', op);
  return op;
}

/* ══════════════════════════════════════════════════════════════════════════
   « Plus tard », et les modules posés
   ══════════════════════════════════════════════════════════════════════════ */

/** Reporte une question. Elle ne sera plus posée par le parcours. */
export async function reporter(champ: string): Promise<void> {
  await journaliser(cibleDuReport(champ), TYPE_REPORT, {
    reporteLe: new Date().toISOString(),
  } satisfies ChargeReport);
}

/** Lève un report : la question redevient à poser. */
export async function leverReport(champ: string): Promise<void> {
  await journaliser(cibleDuReport(champ), TYPE_REPORT, { annule: true } satisfies ChargeReport);
}

/** Marque le module d'une branche comme posé. Idempotente. */
export async function marquerModule(branche: string): Promise<void> {
  const operations = await toutesLesOperations();
  if (lireModules(operations).has(branche)) return;
  await journaliser(cibleDuModule(branche), TYPE_MODULE, { poseLe: new Date().toISOString() });
}

export async function reportsLocaux(): Promise<Set<string>> {
  return new Set(lireReports(await toutesLesOperations()).keys());
}

export async function etatLocal(): Promise<EtatInitialisation> {
  return etat(await toutesLesOperations());
}

/* ══════════════════════════════════════════════════════════════════════════
   L'installation est-elle neuve ?
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Y a-t-il déjà de l'usage dans cette base ?
 *
 * C'est ce qui distingue l'initialisation d'A.1 de l'allégée d'A.7. La question
 * se lit dans les **magasins journalisés**, et non dans le journal : une base
 * restaurée d'une sauvegarde, ou migrée avant que son socle ait été posé, porte
 * des séances sans porter encore leurs opérations. Lire le journal aurait fait
 * reposer les quatorze questions à quelqu'un qui révise depuis un an, ce qui
 * est exactement ce que A.7 interdit.
 *
 * Le compte s'arrête au premier magasin non vide : huit `count()` au pire, et
 * un seul dans le cas qui compte.
 */
export async function installationExistante(): Promise<boolean> {
  const { MAGASINS_JOURNALISES } = await import('./noyau/enregistrements');
  const base = await db();
  for (const declare of MAGASINS_JOURNALISES) {
    if ((await base.count(declare.magasin as never)) > 0) return true;
  }
  return false;
}

export async function porteLocale(branche?: string): Promise<Porte> {
  const operations = await toutesLesOperations();
  /*
   * Le compte des magasins n'est demandé que si l'initialisation n'a pas eu
   * lieu : passé ce point, « allégée » ne change plus rien, et cette garde est
   * traversée à chaque ouverture de page.
   */
  const dejaFaite = porte(operations, branche ? { branche } : {});
  if (dejaFaite.quoi !== 'initialiser') return dejaFaite;
  return porte(operations, {
    ...(branche ? { branche } : {}),
    existante: await installationExistante(),
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Ce que l'usage observé propose
   ══════════════════════════════════════════════════════════════════════════ */

export interface Observe {
  observation: Observation;
  deductions: Deduction[];
}

/**
 * Observe l'usage et en tire les propositions de l'initialisation allégée.
 *
 * Les faits sont publiés par la branche, pas lus des magasins : c'est la même
 * source que l'XP, les indicateurs et les désaccords, et une seconde lecture
 * des magasins finirait par en diverger. La publication est bornée à la fenêtre
 * d'observation — inutile de projeter cinq ans pour mesurer huit semaines.
 */
export async function observerUsage(options: { semaines?: number } = {}): Promise<Observe> {
  const [{ publierFaitsRevisions }, { tableauDeNiveaux }, { parcoursCourant }, { DOMAINES_ACTIFS_PAR_DEFAUT }] =
    await Promise.all([
      import('./odyssee/faits-revisions'),
      import('./niveau'),
      import('./parcours/courant'),
      import('./noyau/domaines'),
    ]);

  const { faits } = await publierFaitsRevisions();
  const observation = observer(faits, options.semaines ? { semaines: options.semaines } : {});

  const niveaux = (await tableauDeNiveaux()).map(({ matiere }) => ({
    matiere: matiere.matiere,
    libelle: matiere.libelle,
    note: matiere.note,
    fiable: matiere.fiable,
  }));

  const courant = parcoursCourant();
  const deductions = deduire({
    observation,
    // Le registre ne porte qu'un parcours courant : c'est lui, et lui seul, que
    // l'usage atteste. Proposer les quatre parcours déclarés reviendrait à
    // deviner, ce que l'écran annoncerait pourtant comme une observation.
    parcoursActifs: observation.faits > 0 ? [{ id: courant.id, libelle: courant.libelle }] : [],
    niveaux,
    domainesParDefaut: DOMAINES_ACTIFS_PAR_DEFAUT,
  });

  return { observation, deductions };
}

/** Le parcours local : les étapes, les reports, et les déductions s'il y en a. */
export async function parcoursLocal(
  options: { branche?: string; deductions?: readonly Deduction[] } = {},
): Promise<Parcours> {
  return parcours(await toutesLesOperations(), {
    ...(options.branche ? { branche: options.branche } : {}),
    ...(options.deductions ? { deductions: options.deductions } : {}),
  });
}
