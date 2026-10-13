/**
 * Lire et écrire la veille, à travers le coffre.
 *
 * Même forme que `donnees-psyche.ts` : aucune écriture ne contourne
 * `exigerLeCoffre()`, qui **lève** plutôt que de rendre `null`.
 *
 * ## Un seul endroit où tout se rejoint
 *
 * Ce module est le seul à voir en même temps les magasins des branches, le
 * collecteur, le moteur et le cycle de vie. C'est voulu, et c'est pour cela
 * qu'il ne contient aucune règle : les règles vivent dans les modules purs,
 * qu'un essai peut faire tourner sans navigateur et sans coffre. Ici, il n'y
 * a que de la plomberie — et la plomberie se relit.
 *
 * ## Le journal d'usage est lu en clair
 *
 * Il est le seul. Voir `SENSIBLES_EN_CLAIR` dans `noyau/coffre.ts` : scellé,
 * il n'aurait enregistré que les sessions où le coffre est ouvert, soit un
 * échantillon biaisé par exactement ce qu'on cherche à mesurer.
 */
import { db } from '../db';
import { exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import { jourLogique } from '../noyau/jour-logique';
import { construireLesMesures, type SourcesDeMesures } from './mesures-veille';
import type { Contexte } from './moteur-veille';
import {
  REGLAGES_PAR_DEFAUT,
  decider,
  enregistrer,
  repondre,
  tourDeVeille,
  type EtatVeille,
  type ReglagesVeille,
  type Reponse,
  type SignalEnregistre,
  type Tour,
} from './signal-veille';

const maintenant = () => new Date().toISOString();
const CLEF_DES_REGLAGES = 'reglages';

/* ══════════════════════════════════════════════════════════════════════════
   Les réglages
   ══════════════════════════════════════════════════════════════════════════ */

export async function lireLesReglages(): Promise<ReglagesVeille> {
  const cle = exigerLeCoffre();
  const range = (await (await db()).get('odysseeVeilleReglages', CLEF_DES_REGLAGES)) as
    | Record<string, unknown>
    | undefined;
  if (!range) return { ...REGLAGES_PAR_DEFAUT };
  const { id: _id, ...reste } = await ouvrir<ReglagesVeille & { id: string }>(cle, range);
  return reste;
}

export async function ecrireLesReglages(
  modifications: Partial<ReglagesVeille>,
): Promise<ReglagesVeille> {
  const cle = exigerLeCoffre();
  const reglages: ReglagesVeille = {
    ...(await lireLesReglages()),
    ...modifications,
    majLe: maintenant(),
  };
  const scelle = await sceller(cle, 'odysseeVeilleReglages', {
    ...reglages,
    id: CLEF_DES_REGLAGES,
  } as unknown as Record<string, unknown>);
  await (await db()).put(
    'odysseeVeilleReglages',
    scelle as unknown as ReglagesVeille & { id: string },
  );
  return reglages;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les repères
   ══════════════════════════════════════════════════════════════════════════ */

export async function tousLesSignaux(): Promise<SignalEnregistre[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseeVeilleSignaux')) as unknown as Record<
    string,
    unknown
  >[];
  const ouverts = await Promise.all(rangees.map((r) => ouvrir<SignalEnregistre>(cle, r)));
  return ouverts.sort((a, b) => b.jour.localeCompare(a.jour));
}

async function ecrireLeSignal(signal: SignalEnregistre): Promise<SignalEnregistre> {
  const cle = exigerLeCoffre();
  const scelle = await sceller(
    cle,
    'odysseeVeilleSignaux',
    signal as unknown as Record<string, unknown>,
  );
  await (await db()).put('odysseeVeilleSignaux', scelle as unknown as SignalEnregistre);
  return signal;
}

/** Applique une réponse et l'enregistre. */
export async function repondreAuSignal(
  signal: SignalEnregistre,
  reponse: Reponse,
  le = new Date(),
): Promise<SignalEnregistre> {
  return ecrireLeSignal(repondre(signal, reponse, jourLogique(le)));
}

/* ══════════════════════════════════════════════════════════════════════════
   L'état et le tour
   ══════════════════════════════════════════════════════════════════════════ */

export async function lireLEtat(): Promise<EtatVeille> {
  const [reglages, signaux] = await Promise.all([lireLesReglages(), tousLesSignaux()]);
  const ouvert = signaux.find((s) => s.closLe === null) ?? null;
  const clos = signaux.filter((s) => s.closLe !== null);
  return { reglages, ouvert, dernierClos: clos[0] ?? null };
}

/**
 * Rassemble ce que les branches ont enregistré, sous la forme minimale que
 * le collecteur accepte.
 *
 * Le coffre doit être ouvert : la plupart des magasins lus ici ne le sont
 * pas, mais la veille elle-même l'est, et son résultat aussi.
 */
export async function lireLesSources(): Promise<SourcesDeMesures> {
  const base = await db();
  const [nuits, repas, pesees, seances, focus, taches, evenements, usage] = await Promise.all([
    base.getAll('odysseeNuits'),
    base.getAll('odysseeRepas'),
    base.getAll('odysseePesees'),
    base.getAll('sportSeances'),
    base.getAll('odysseeFocus'),
    base.getAll('odysseeTaches'),
    base.getAll('odysseeEvenements'),
    base.getAll('odysseeUsage'),
  ]);
  return {
    nuits: nuits.map((n) => ({ jour: n.jour, coucher: n.coucher, lever: n.lever })),
    repas: repas.map((r) => ({ jour: r.jour, le: r.le })),
    pesees: pesees.map((p) => ({ jour: p.jour, kg: p.kg })),
    seances: seances.map((s) => ({ jour: s.jour, terminee: s.statut === 'terminee' })),
    focus: focus.map((f) => ({
      jour: jourLogique(new Date(f.debut)),
      secondes: f.secondes,
      interrompue: f.interrompue,
    })),
    /*
       « Reportée » : une tâche dont l'échéance est passée et qui n'est ni
       faite ni abandonnée. Renoncer n'est pas repousser — une tâche
       abandonnée a reçu une décision, et c'est tout l'inverse du report.
    */
    taches: taches
      .filter((t) => t.echeance !== null)
      .map((t) => ({
        jour: t.echeance as string,
        reportee: t.faiteLe === null && t.abandonneeLe === null,
      })),
    /*
       « Annulé » vaut pour un événement passé marqué « non fait ». Un
       événement resté « inconnu » n'en est pas un : il n'a pas été relevé,
       ce qui est une absence de saisie et non une annulation. Les deux se
       confondent trop facilement, et les confondre ferait monter
       l'indicateur chaque fois que quelqu'un cesse de tenir son agenda —
       c'est-à-dire exactement l'erreur que tout le dispositif évite.
    */
    evenements: evenements
      .filter((e) => !e.journeeEntiere && e.realise !== 'inconnu')
      .map((e) => ({
        jour: jourLogique(new Date(e.debut)),
        annule: e.realise === 'non-fait',
      })),
    usage,
  };
}

export interface TourComplet extends Tour {
  etat: EtatVeille;
}

/**
 * Un tour complet : lire, décider, évaluer, enregistrer ce qu'il faut.
 *
 * Les réglages ne sont réécrits que si l'évaluation a réellement eu lieu —
 * sans quoi `evalueeLe` avancerait même les jours où la veille est en pause,
 * et la pause se transformerait en amnésie.
 */
export async function faireUnTour(
  le = new Date(),
  contextes: readonly Contexte[] = [],
): Promise<TourComplet> {
  const jour = jourLogique(le);
  const etat = await lireLEtat();
  if (decider(etat, jour).quoi !== 'evaluer') {
    return { ...tourDeVeille({ jour, etat, mesures: {} }), etat };
  }

  const mesures = construireLesMesures(await lireLesSources());
  const tour = tourDeVeille({ jour, etat, mesures, contextes });
  await ecrireLesReglages({ evalueeLe: tour.reglages.evalueeLe });
  if (tour.leve) {
    await ecrireLeSignal(tour.leve);
    return { ...tour, etat: { ...etat, ouvert: tour.leve } };
  }
  return { ...tour, etat };
}

/** Le détail chiffré, pour « Pourquoi ce repère ? ». Jamais sur la carte. */
export async function detailDuJour(le = new Date()): Promise<ReturnType<typeof construireLesMesures>> {
  exigerLeCoffre();
  return construireLesMesures(await lireLesSources());
}

export { enregistrer };
