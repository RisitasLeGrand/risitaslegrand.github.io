/**
 * Lire et écrire ce qu'Odyssée possède.
 *
 * ## Pourquoi ces fonctions ne sont pas dans « db.ts »
 *
 * `db.ts` ouvre la base et porte l'accès aux magasins de Révisions, pour des
 * raisons d'histoire. Rien n'oblige à continuer : une branche qui ajoute ses
 * écritures au fichier commun le fait grossir sans fin, et mêle à la lecture
 * ce que trois domaines différents font de la base. L'ouverture reste commune
 * — il n'y a qu'une base —, les accès sont chez eux.
 *
 * ## Toute écriture est journalisée, et c'est le contrat
 *
 * Chaque `put` est suivi d'une inscription au journal d'opérations, sans quoi
 * la donnée ne voyagerait pas : ni synchronisation, ni fusion, ni empreinte
 * d'état. Comme dans `db.ts`, l'échec du journal est **muet** et n'annule pas
 * l'écriture — perdre une tâche parce que son inscription a échoué serait pire
 * que de la garder non synchronisée, et `soclerFaitsDomaine` rattrape ce qui
 * manque.
 *
 * ## Les suppressions voyagent aussi
 *
 * Une tâche supprimée sur l'ordinateur doit disparaître du téléphone. Une
 * suppression qui ne laisse pas de trace est réintroduite à la première fusion
 * par l'appareil qui ne l'a pas vue, et la personne a alors raison de croire
 * le logiciel cassé.
 */
import { db } from '../db';
import { ulid } from '../noyau/ulid';
import { jourLogique } from '../noyau/jour-logique';
import type { IdDomaine } from '../noyau/domaines';
import {
  controlerEvenement,
  controlerQuete,
  controlerTache,
  type Evenement,
  type Focus,
  type Quete,
  type Revue,
  type Tache,
  type TypeDeRevue,
} from './modele';

type MagasinOdyssee =
  | 'odysseeTaches'
  | 'odysseeQuetes'
  | 'odysseeEvenements'
  | 'odysseeFocus'
  | 'odysseeRevues';

async function journaliser(magasin: MagasinOdyssee, enregistrement: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement(magasin, enregistrement as Record<string, unknown>);
  } catch {
    // Volontairement muet : voir l'en-tête.
  }
}

async function journaliserSuppression(cibles: readonly string[]): Promise<void> {
  try {
    const { journaliserSuppressions } = await import('../sync/faits-domaine');
    await journaliserSuppressions(cibles);
  } catch {
    // Volontairement muet : voir l'en-tête.
  }
}

const maintenant = () => new Date().toISOString();

/* ════════════════════════════════════════════════════════════════════════
   Les tâches
   ════════════════════════════════════════════════════════════════════════ */

export interface TacheNeuve {
  titre: string;
  domaine: IdDomaine;
  echeance?: string | null;
  note?: string;
}

export async function ajouterTache(neuve: TacheNeuve): Promise<Tache> {
  const tache: Tache = {
    id: ulid(),
    titre: neuve.titre.trim(),
    domaine: neuve.domaine,
    echeance: neuve.echeance ?? null,
    faiteLe: null,
    note: neuve.note ?? '',
    creeeLe: maintenant(),
    majLe: maintenant(),
  };
  const problemes = controlerTache(tache);
  if (problemes.length) throw new Error(problemes.join(' '));
  await (await db()).put('odysseeTaches', tache);
  await journaliser('odysseeTaches', tache);
  return tache;
}

export async function ecrireTache(tache: Tache): Promise<void> {
  const problemes = controlerTache(tache);
  if (problemes.length) throw new Error(problemes.join(' '));
  const avec = { ...tache, majLe: maintenant() };
  await (await db()).put('odysseeTaches', avec);
  await journaliser('odysseeTaches', avec);
}

/**
 * Clore ou rouvrir une tâche.
 *
 * `jour` est le **jour logique**, pas la date du calendrier : une tâche close
 * à 2 h du matin appartient à la veille, et c'est ce que la personne attend
 * en voyant son plancher du jour.
 */
export async function clore(id: string, fait: boolean, le = new Date()): Promise<Tache | null> {
  const base = await db();
  const tache = await base.get('odysseeTaches', id);
  if (!tache) return null;
  const avec: Tache = {
    ...tache,
    faiteLe: fait ? jourLogique(le) : null,
    majLe: maintenant(),
  };
  await base.put('odysseeTaches', avec);
  await journaliser('odysseeTaches', avec);
  return avec;
}

export async function supprimerTache(id: string): Promise<void> {
  await (await db()).delete('odysseeTaches', id);
  await journaliserSuppression([`odysseeTaches:${id}`]);
}

export const toutesLesTaches = async (): Promise<Tache[]> => (await db()).getAll('odysseeTaches');

/* ════════════════════════════════════════════════════════════════════════
   Les quêtes
   ════════════════════════════════════════════════════════════════════════ */

export interface QueteNeuve {
  titre: string;
  domaine: IdDomaine;
  cadence: Quete['cadence'];
}

export async function ajouterQuete(neuve: QueteNeuve): Promise<Quete> {
  const quete: Quete = {
    id: ulid(),
    titre: neuve.titre.trim(),
    domaine: neuve.domaine,
    cadence: neuve.cadence,
    active: true,
    tenues: [],
    creeeLe: maintenant(),
    majLe: maintenant(),
  };
  const problemes = controlerQuete(quete);
  if (problemes.length) throw new Error(problemes.join(' '));
  await (await db()).put('odysseeQuetes', quete);
  await journaliser('odysseeQuetes', quete);
  return quete;
}

export async function ecrireQuete(quete: Quete): Promise<void> {
  const problemes = controlerQuete(quete);
  if (problemes.length) throw new Error(problemes.join(' '));
  const avec = { ...quete, majLe: maintenant() };
  await (await db()).put('odysseeQuetes', avec);
  await journaliser('odysseeQuetes', avec);
}

/**
 * Tenir une quête un jour donné, ou revenir sur ce geste.
 *
 * La liste reste **triée et sans doublon** : c'est elle que lisent la série et
 * le plancher du jour, et un doublon y compterait deux fois le même jour.
 */
export async function tenir(id: string, tenue: boolean, le = new Date()): Promise<Quete | null> {
  const base = await db();
  const quete = await base.get('odysseeQuetes', id);
  if (!quete) return null;
  const jour = jourLogique(le);
  const sansCeJour = quete.tenues.filter((j) => j !== jour);
  const avec: Quete = {
    ...quete,
    tenues: tenue ? [...sansCeJour, jour].sort() : sansCeJour,
    majLe: maintenant(),
  };
  await base.put('odysseeQuetes', avec);
  await journaliser('odysseeQuetes', avec);
  return avec;
}

export async function supprimerQuete(id: string): Promise<void> {
  await (await db()).delete('odysseeQuetes', id);
  await journaliserSuppression([`odysseeQuetes:${id}`]);
}

export const toutesLesQuetes = async (): Promise<Quete[]> => (await db()).getAll('odysseeQuetes');

/* ════════════════════════════════════════════════════════════════════════
   Les événements
   ════════════════════════════════════════════════════════════════════════ */

export type EvenementNeuf = Omit<Evenement, 'id' | 'majLe'> & Partial<Pick<Evenement, 'id'>>;

export async function ecrireEvenement(neuf: EvenementNeuf): Promise<Evenement> {
  const evenement: Evenement = { ...neuf, id: neuf.id ?? ulid(), majLe: maintenant() };
  const problemes = controlerEvenement(evenement);
  if (problemes.length) throw new Error(problemes.join(' '));
  await (await db()).put('odysseeEvenements', evenement);
  await journaliser('odysseeEvenements', evenement);
  return evenement;
}

export async function supprimerEvenement(id: string): Promise<void> {
  await (await db()).delete('odysseeEvenements', id);
  await journaliserSuppression([`odysseeEvenements:${id}`]);
}

export const tousLesEvenements = async (): Promise<Evenement[]> =>
  (await db()).getAll('odysseeEvenements');

/**
 * Les événements d'un intervalle, par l'index.
 *
 * Les bornes sont des instants ISO ; la comparaison est lexicographique, ce
 * qui est exact pour l'ISO 8601 en UTC. Un événement **commencé avant** la
 * borne basse et qui déborde dedans n'est pas rendu par l'index seul : il est
 * donc cherché à part, sur une fenêtre élargie d'un jour, parce qu'un
 * événement plus long qu'une journée entière est assez rare pour qu'une
 * lecture complète ne se justifie pas.
 */
export async function evenementsEntre(debut: string, fin: string): Promise<Evenement[]> {
  const base = await db();
  const veille = new Date(Date.parse(debut) - 24 * 3600 * 1000).toISOString();
  const candidats = await base.getAllFromIndex(
    'odysseeEvenements',
    'debut',
    IDBKeyRange.bound(veille, fin),
  );
  return candidats.filter((e) => e.fin >= debut);
}

/* ════════════════════════════════════════════════════════════════════════
   Le focus
   ════════════════════════════════════════════════════════════════════════ */

export type FocusNeuf = Omit<Focus, 'id' | 'majLe'>;

export async function ajouterFocus(neuf: FocusNeuf): Promise<Focus> {
  const focus: Focus = { ...neuf, id: ulid(), majLe: maintenant() };
  await (await db()).put('odysseeFocus', focus);
  await journaliser('odysseeFocus', focus);
  return focus;
}

export const toutLeFocus = async (): Promise<Focus[]> => (await db()).getAll('odysseeFocus');

/* ════════════════════════════════════════════════════════════════════════
   Les revues
   ════════════════════════════════════════════════════════════════════════ */

export async function ecrireRevue(
  type: TypeDeRevue,
  jour: string,
  reponses: Record<string, string>,
): Promise<Revue> {
  /*
     L'identifiant est **déterministe** : une revue du soir se tient une fois
     par jour, et rouvrir l'écran pour compléter une réponse doit modifier la
     revue existante, pas en créer une seconde. Un ULID tiré à chaque
     enregistrement aurait fait trois revues d'un soir où l'on revient deux
     fois sur sa réponse.
  */
  const revue: Revue = { id: `${type}:${jour}`, type, jour, reponses, majLe: maintenant() };
  await (await db()).put('odysseeRevues', revue);
  await journaliser('odysseeRevues', revue);
  return revue;
}

export const toutesLesRevues = async (): Promise<Revue[]> => (await db()).getAll('odysseeRevues');

export const revueDu = async (type: TypeDeRevue, jour: string): Promise<Revue | undefined> =>
  (await db()).get('odysseeRevues', `${type}:${jour}`);
