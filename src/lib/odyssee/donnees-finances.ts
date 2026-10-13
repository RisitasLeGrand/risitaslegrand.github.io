/**
 * Lire et écrire Finances, à travers le coffre.
 *
 * Même forme que `donnees-psyche.ts` : aucune écriture ne contourne
 * `exigerLeCoffre()`, qui **lève** plutôt que de rendre `null`. Ce qui part au
 * journal de synchronisation est l'enregistrement **scellé** : un paquet qui
 * traverse un QR code ne doit pas exposer un relevé bancaire.
 *
 * ## L'identifiant d'une opération est son empreinte
 *
 * Pas un ULID. Deux imports qui se chevauchent — un relevé de septembre puis
 * un relevé d'octobre qui reprend la fin de septembre — doivent reconnaître
 * les mêmes opérations, et un identifiant tiré au hasard les dédoublerait.
 *
 * L'empreinte mêle compte, jour, montant, libellé normalisé **et rang** parmi
 * les identiques : cinq virements de 5 € le même jour avec le même libellé
 * existent vraiment, et une empreinte sans rang les réduirait à un.
 *
 * ## Le libellé est masqué avant d'être écrit, pas à l'affichage
 *
 * Les libellés de relevé sont pleins de numéros de carte et d'IBAN. Ils sont
 * réduits à leurs quatre derniers chiffres **à la lecture du fichier** : une
 * donnée masquée à l'écran mais enregistrée en clair n'est pas masquée.
 */
import { db } from '../db';
import { exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import {
  controlerCompte,
  controlerOperation,
  controlerValorisation,
  type Compte,
  type OperationBancaire,
  type Valorisation,
} from './finances';
import { controlerLigne, type LigneBudget } from './budget';

type MagasinFinances =
  | 'odysseeComptes'
  | 'odysseeValorisations'
  | 'odysseeOperations'
  | 'odysseeLignesBudget';

async function journaliser(magasin: MagasinFinances, scelle: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement(magasin, scelle as Record<string, unknown>);
  } catch {
    // Muet : perdre une opération parce que le journal a échoué serait pire.
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

async function ecrire<T extends { id: string }>(
  magasin: MagasinFinances,
  valeur: T,
): Promise<T> {
  const cle = exigerLeCoffre();
  const scelle = await sceller(cle, magasin, valeur as unknown as Record<string, unknown>);
  await (await db()).put(magasin, scelle as unknown as never);
  await journaliser(magasin, scelle);
  return valeur;
}

async function toutLire<T>(magasin: MagasinFinances): Promise<T[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll(magasin)) as unknown as Record<string, unknown>[];
  return Promise.all(rangees.map((r) => ouvrir<T>(cle, r)));
}

/* ══════════════════════════════════════════════════════════════════════════
   Les comptes
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'identifiant d'un compte est dérivé de son intitulé.
 *
 * Un relevé ne porte aucun identifiant utilisable — le numéro de compte est
 * précisément ce qu'on refuse d'enregistrer. Le nom imprimé est donc la seule
 * clé stable, et deux imports du même relevé doivent retrouver le même compte
 * plutôt que d'en créer un second.
 */
export function identifiantDeCompte(libelle: string): string {
  return (
    'c-' +
    libelle
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)
  );
}

export async function ecrireCompte(c: Omit<Compte, 'majLe'>): Promise<Compte> {
  const compte: Compte = { ...c, majLe: maintenant() };
  exiger(controlerCompte(compte));
  return ecrire('odysseeComptes', compte);
}

export const tousLesComptes = () => toutLire<Compte>('odysseeComptes');

export async function supprimerCompte(id: string): Promise<void> {
  await (await db()).delete('odysseeComptes', id);
  await journaliserSuppression([`odysseeComptes:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les valorisations
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireValorisation(
  v: Omit<Valorisation, 'id' | 'majLe'>,
): Promise<Valorisation> {
  /*
     Une valorisation par compte et par jour : l'identifiant les compose, donc
     corriger une saisie remplace au lieu d'empiler. Deux valeurs du même
     compte le même jour n'ont pas de sens — la seconde est une correction.
  */
  const valorisation: Valorisation = {
    ...v,
    id: `${v.compteId}:${v.jour}`,
    majLe: maintenant(),
  };
  exiger(controlerValorisation(valorisation));
  return ecrire('odysseeValorisations', valorisation);
}

export const toutesLesValorisations = () => toutLire<Valorisation>('odysseeValorisations');

/* ══════════════════════════════════════════════════════════════════════════
   Les opérations
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireOperations(
  operations: readonly OperationBancaire[],
): Promise<{ ecrites: number; dejaLa: number }> {
  const cle = exigerLeCoffre();
  const base = await db();
  const existants = new Set(await base.getAllKeys('odysseeOperations'));

  let ecrites = 0;
  let dejaLa = 0;
  for (const o of operations) {
    if (existants.has(o.id)) {
      dejaLa += 1;
      continue;
    }
    exiger(controlerOperation(o));
    const scelle = await sceller(cle, 'odysseeOperations', o as unknown as Record<string, unknown>);
    await base.put('odysseeOperations', scelle as unknown as never);
    await journaliser('odysseeOperations', scelle);
    ecrites += 1;
  }
  return { ecrites, dejaLa };
}

export const toutesLesOperations = () => toutLire<OperationBancaire>('odysseeOperations');

export async function supprimerOperations(ids: readonly string[]): Promise<void> {
  const base = await db();
  for (const id of ids) await base.delete('odysseeOperations', id);
  await journaliserSuppression(ids.map((id) => `odysseeOperations:${id}`));
}

/* ══════════════════════════════════════════════════════════════════════════
   Les lignes de budget
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireLigne(l: Omit<LigneBudget, 'majLe'>): Promise<LigneBudget> {
  const ligne: LigneBudget = { ...l, majLe: maintenant() };
  exiger(controlerLigne(ligne));
  return ecrire('odysseeLignesBudget', ligne);
}

export const toutesLesLignes = () => toutLire<LigneBudget>('odysseeLignesBudget');

export async function supprimerLigne(id: string): Promise<void> {
  await (await db()).delete('odysseeLignesBudget', id);
  await journaliserSuppression([`odysseeLignesBudget:${id}`]);
}

/**
 * Combien d'enregistrements financiers existent, **sans ouvrir le coffre**.
 *
 * Le rappel de sauvegarde en a besoin, et il doit pouvoir s'afficher coffre
 * fermé. Compter ne lit aucun contenu.
 */
export async function combienDeFinances(): Promise<number> {
  const base = await db();
  const comptes = await Promise.all([
    base.count('odysseeComptes'),
    base.count('odysseeValorisations'),
    base.count('odysseeOperations'),
    base.count('odysseeLignesBudget'),
  ]);
  return comptes.reduce((s, n) => s + n, 0);
}
