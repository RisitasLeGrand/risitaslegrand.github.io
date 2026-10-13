/**
 * Lire et écrire Psyché, à travers le coffre.
 *
 * Même forme que `donnees-sensible.ts` : aucune écriture ne contourne
 * `exigerLeCoffre()`, qui **lève** plutôt que de rendre `null`. Ce qui part au
 * journal de synchronisation est l'enregistrement **scellé** : un paquet qui
 * traverse un QR code ne doit pas exposer un journal intime.
 *
 * ## Un check-in par jour, remplacé et non empilé
 *
 * L'identifiant d'un check-in est **son jour**, pas un ULID. Pointer deux fois
 * le même jour corrige le premier au lieu d'en créer un second — ce qui est le
 * comportement attendu d'une glissière qu'on rajuste le soir, et ce qui évite
 * qu'un jour compte double dans la ligne de base.
 *
 * Le journal, lui, porte des ULID : on y écrit plusieurs fois par jour, et
 * chaque entrée est la sienne.
 */
import { db } from '../db';
import { ulid } from '../noyau/ulid';
import { jourLogique } from '../noyau/jour-logique';
import { exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import {
  controlerCheckin,
  controlerEntree,
  controlerHebdo,
  type Checkin,
  type CheckinHebdo,
  type Entree,
} from './psyche';

type MagasinPsyche = 'odysseeCheckins' | 'odysseeHebdos' | 'odysseeJournal';

async function journaliser(magasin: MagasinPsyche, scelle: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement(magasin, scelle as Record<string, unknown>);
  } catch {
    // Muet : perdre un check-in parce que le journal a échoué serait pire.
  }
}

async function journaliserSuppression(cibles: readonly string[]): Promise<void> {
  try {
    const { journaliserSuppressions } = await import('../sync/faits-domaine');
    await journaliserSuppressions(cibles);
  } catch {
    // Muet.
  }
}

const maintenant = () => new Date().toISOString();

function exiger(problemes: readonly string[]): void {
  if (problemes.length) throw new Error(problemes.join(' '));
}

/** Le lundi de la semaine d'un jour logique, en jour logique. */
export function lundiDe(jour: string): string {
  const d = new Date(`${jour}T12:00:00.000Z`);
  // getUTCDay : 0 = dimanche. On ramène au lundi précédent.
  const recul = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - recul * 86_400_000).toISOString().slice(0, 10);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le check-in quotidien
   ══════════════════════════════════════════════════════════════════════════ */

export type CheckinNeuf = Partial<Pick<Checkin, 'humeur' | 'energie' | 'stress' | 'motivation' | 'note'>>;

export async function ecrireCheckin(neuf: CheckinNeuf, le = new Date()): Promise<Checkin> {
  const cle = exigerLeCoffre();
  const jour = jourLogique(le);
  const checkin: Checkin = {
    // Le jour **est** l'identifiant : voir l'en-tête.
    id: jour,
    jour,
    le: le.toISOString(),
    humeur: neuf.humeur ?? null,
    energie: neuf.energie ?? null,
    stress: neuf.stress ?? null,
    motivation: neuf.motivation ?? null,
    note: neuf.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerCheckin(checkin));

  const scelle = await sceller(cle, 'odysseeCheckins', checkin as unknown as Record<string, unknown>);
  await (await db()).put('odysseeCheckins', scelle as unknown as Checkin);
  await journaliser('odysseeCheckins', scelle);
  return checkin;
}

export async function tousLesCheckins(): Promise<Checkin[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseeCheckins')) as unknown as Record<string, unknown>[];
  const ouverts = await Promise.all(rangees.map((r) => ouvrir<Checkin>(cle, r)));
  return ouverts.sort((a, b) => a.jour.localeCompare(b.jour));
}

export async function checkinDuJour(le = new Date()): Promise<Checkin | null> {
  const cle = exigerLeCoffre();
  const range = (await (await db()).get('odysseeCheckins', jourLogique(le))) as unknown as
    | Record<string, unknown>
    | undefined;
  return range ? ouvrir<Checkin>(cle, range) : null;
}

export async function supprimerCheckin(jour: string): Promise<void> {
  await (await db()).delete('odysseeCheckins', jour);
  await journaliserSuppression([`odysseeCheckins:${jour}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le point de semaine
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireHebdo(
  neuf: Pick<CheckinHebdo, 'porte' | 'pese' | 'besoin'>,
  le = new Date(),
): Promise<CheckinHebdo> {
  const cle = exigerLeCoffre();
  const semaine = lundiDe(jourLogique(le));
  const hebdo: CheckinHebdo = {
    // Même principe que le check-in : la semaine est l'identifiant.
    id: semaine,
    semaine,
    le: le.toISOString(),
    porte: neuf.porte.trim(),
    pese: neuf.pese.trim(),
    besoin: neuf.besoin.trim(),
    majLe: maintenant(),
  };
  exiger(controlerHebdo(hebdo));

  const scelle = await sceller(cle, 'odysseeHebdos', hebdo as unknown as Record<string, unknown>);
  await (await db()).put('odysseeHebdos', scelle as unknown as CheckinHebdo);
  await journaliser('odysseeHebdos', scelle);
  return hebdo;
}

export async function tousLesHebdos(): Promise<CheckinHebdo[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseeHebdos')) as unknown as Record<string, unknown>[];
  const ouverts = await Promise.all(rangees.map((r) => ouvrir<CheckinHebdo>(cle, r)));
  return ouverts.sort((a, b) => b.semaine.localeCompare(a.semaine));
}

export async function supprimerHebdo(semaine: string): Promise<void> {
  await (await db()).delete('odysseeHebdos', semaine);
  await journaliserSuppression([`odysseeHebdos:${semaine}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le journal
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireEntree(texte: string, le = new Date()): Promise<Entree> {
  const cle = exigerLeCoffre();
  const entree: Entree = {
    id: ulid(),
    jour: jourLogique(le),
    le: le.toISOString(),
    texte,
    majLe: maintenant(),
  };
  exiger(controlerEntree(entree));

  const scelle = await sceller(cle, 'odysseeJournal', entree as unknown as Record<string, unknown>);
  await (await db()).put('odysseeJournal', scelle as unknown as Entree);
  await journaliser('odysseeJournal', scelle);
  return entree;
}

export async function toutLeJournal(): Promise<Entree[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseeJournal')) as unknown as Record<string, unknown>[];
  const ouverts = await Promise.all(rangees.map((r) => ouvrir<Entree>(cle, r)));
  return ouverts.sort((a, b) => b.le.localeCompare(a.le));
}

export async function supprimerEntree(id: string): Promise<void> {
  await (await db()).delete('odysseeJournal', id);
  await journaliserSuppression([`odysseeJournal:${id}`]);
}

/**
 * Combien d'enregistrements de Psyché existent, **sans ouvrir le coffre**.
 *
 * Le rappel de sauvegarde en a besoin, et il doit pouvoir s'afficher coffre
 * fermé. Compter ne lit aucun contenu.
 */
export async function combienDePsyche(): Promise<number> {
  const base = await db();
  const [c, h, j] = await Promise.all([
    base.count('odysseeCheckins'),
    base.count('odysseeHebdos'),
    base.count('odysseeJournal'),
  ]);
  return c + h + j;
}
