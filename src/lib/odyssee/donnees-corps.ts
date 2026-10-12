/**
 * Lire et écrire le domaine Corps.
 *
 * Même forme que `donnees.ts` et que `sport/donnees.ts` : chaque écriture est
 * journalisée, chaque suppression aussi, et le journal est **muet en cas
 * d'échec**. Perdre une pesée parce que le journal a échoué serait pire que
 * de la voir ne pas voyager.
 *
 * Le jour logique est calculé ici, à l'écriture, et non à la lecture : une
 * pesée appartient au jour où elle a été faite, pas au jour où on la relit.
 * Recalculer plus tard déplacerait une pesée de 2 h du matin d'un jour à
 * l'autre selon le réglage du moment.
 */
import { db } from '../db';
import { ulid } from '../noyau/ulid';
import { jourLogique } from '../noyau/jour-logique';
import {
  controlerBoisson,
  controlerMesure,
  controlerNuit,
  controlerPesee,
  controlerRepas,
  controlerSante,
  type Boisson,
  type EtatDeSante,
  type MesureCorporelle,
  type Nuit,
  type Pesee,
  type QuoiMesurer,
  type Repas,
} from './corps';

type MagasinCorps =
  | 'odysseePesees'
  | 'odysseeMesures'
  | 'odysseeNuits'
  | 'odysseeRepas'
  | 'odysseeBoissons'
  | 'odysseeSante';

async function journaliser(magasin: MagasinCorps, enregistrement: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement(magasin, enregistrement as Record<string, unknown>);
  } catch {
    // Muet : voir l'en-tête.
  }
}

async function journaliserSuppression(cibles: readonly string[]): Promise<void> {
  try {
    const { journaliserSuppressions } = await import('../sync/faits-domaine');
    await journaliserSuppressions(cibles);
  } catch {
    // Muet, même raison.
  }
}

const maintenant = () => new Date().toISOString();

/** Refuse ce que le modèle refuse. Un écran se contourne, un contrôle non. */
function exiger(problemes: readonly string[]): void {
  if (problemes.length) throw new Error(problemes.join(' '));
}

/* ══════════════════════════════════════════════════════════════════════════
   Les pesées
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrirePesee(
  kg: number,
  options: { id?: string; le?: Date; note?: string } = {},
): Promise<Pesee> {
  const le = options.le ?? new Date();
  const pesee: Pesee = {
    id: options.id ?? ulid(),
    jour: jourLogique(le),
    le: le.toISOString(),
    kg,
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerPesee(pesee));
  await (await db()).put('odysseePesees', pesee);
  await journaliser('odysseePesees', pesee);
  return pesee;
}

export const toutesLesPesees = async (): Promise<Pesee[]> => (await db()).getAll('odysseePesees');

export async function supprimerPesee(id: string): Promise<void> {
  await (await db()).delete('odysseePesees', id);
  await journaliserSuppression([`odysseePesees:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les mesures
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireMesure(
  quoi: QuoiMesurer,
  cm: number,
  options: { id?: string; le?: Date; note?: string } = {},
): Promise<MesureCorporelle> {
  const le = options.le ?? new Date();
  const mesure: MesureCorporelle = {
    id: options.id ?? ulid(),
    jour: jourLogique(le),
    le: le.toISOString(),
    quoi,
    cm,
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerMesure(mesure));
  await (await db()).put('odysseeMesures', mesure);
  await journaliser('odysseeMesures', mesure);
  return mesure;
}

export const toutesLesMesures = async (): Promise<MesureCorporelle[]> =>
  (await db()).getAll('odysseeMesures');

export async function supprimerMesure(id: string): Promise<void> {
  await (await db()).delete('odysseeMesures', id);
  await journaliserSuppression([`odysseeMesures:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le sommeil
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireNuit(
  coucher: string,
  lever: string,
  options: { id?: string; qualite?: number | null; reveils?: number | null; note?: string } = {},
): Promise<Nuit> {
  const nuit: Nuit = {
    id: options.id ?? ulid(),
    // Le jour du **lever** : voir l'en-tête de `corps.ts`.
    jour: jourLogique(new Date(lever)),
    coucher,
    lever,
    qualite: options.qualite ?? null,
    reveils: options.reveils ?? null,
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerNuit(nuit));
  await (await db()).put('odysseeNuits', nuit);
  await journaliser('odysseeNuits', nuit);
  return nuit;
}

export const toutesLesNuits = async (): Promise<Nuit[]> => (await db()).getAll('odysseeNuits');

export async function supprimerNuit(id: string): Promise<void> {
  await (await db()).delete('odysseeNuits', id);
  await journaliserSuppression([`odysseeNuits:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les repas et les boissons
   ══════════════════════════════════════════════════════════════════════════ */

export type RepasNeuf = Omit<Repas, 'id' | 'jour' | 'le' | 'majLe'> &
  Partial<Pick<Repas, 'id' | 'le'>>;

export async function ecrireRepas(neuf: RepasNeuf): Promise<Repas> {
  const le = neuf.le ? new Date(neuf.le) : new Date();
  const repas: Repas = {
    ...neuf,
    id: neuf.id ?? ulid(),
    jour: jourLogique(le),
    le: le.toISOString(),
    majLe: maintenant(),
  };
  exiger(controlerRepas(repas));
  await (await db()).put('odysseeRepas', repas);
  await journaliser('odysseeRepas', repas);
  return repas;
}

export const tousLesRepas = async (): Promise<Repas[]> => (await db()).getAll('odysseeRepas');

export async function supprimerRepas(id: string): Promise<void> {
  await (await db()).delete('odysseeRepas', id);
  await journaliserSuppression([`odysseeRepas:${id}`]);
}

export async function ecrireBoisson(mL: number, le = new Date()): Promise<Boisson> {
  const boisson: Boisson = {
    id: ulid(),
    jour: jourLogique(le),
    le: le.toISOString(),
    mL,
    majLe: maintenant(),
  };
  exiger(controlerBoisson(boisson));
  await (await db()).put('odysseeBoissons', boisson);
  await journaliser('odysseeBoissons', boisson);
  return boisson;
}

export const toutesLesBoissons = async (): Promise<Boisson[]> =>
  (await db()).getAll('odysseeBoissons');

export async function supprimerBoisson(id: string): Promise<void> {
  await (await db()).delete('odysseeBoissons', id);
  await journaliserSuppression([`odysseeBoissons:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   La santé
   ══════════════════════════════════════════════════════════════════════════ */

export type SanteNeuve = Omit<EtatDeSante, 'id' | 'majLe'> & Partial<Pick<EtatDeSante, 'id'>>;

export async function ecrireSante(neuve: SanteNeuve): Promise<EtatDeSante> {
  const etat: EtatDeSante = { ...neuve, id: neuve.id ?? ulid(), majLe: maintenant() };
  exiger(controlerSante(etat));
  await (await db()).put('odysseeSante', etat);
  await journaliser('odysseeSante', etat);
  return etat;
}

export async function refermerSante(id: string, le = new Date()): Promise<EtatDeSante | null> {
  const base = await db();
  const etat = await base.get('odysseeSante', id);
  if (!etat) return null;
  const avec: EtatDeSante = { ...etat, fin: le.toISOString(), majLe: maintenant() };
  await base.put('odysseeSante', avec);
  await journaliser('odysseeSante', avec);
  return avec;
}

export async function rouvrirSante(id: string): Promise<EtatDeSante | null> {
  const base = await db();
  const etat = await base.get('odysseeSante', id);
  if (!etat) return null;
  const avec: EtatDeSante = { ...etat, fin: null, majLe: maintenant() };
  await base.put('odysseeSante', avec);
  await journaliser('odysseeSante', avec);
  return avec;
}

export const toutLEtatDeSante = async (): Promise<EtatDeSante[]> =>
  (await db()).getAll('odysseeSante');

export async function supprimerSante(id: string): Promise<void> {
  await (await db()).delete('odysseeSante', id);
  await journaliserSuppression([`odysseeSante:${id}`]);
}
