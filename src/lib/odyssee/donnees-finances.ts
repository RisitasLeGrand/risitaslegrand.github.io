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
import { lireCeQuiSOuvre } from '../noyau/lecture-tolerante';
import {
  CLEF_ETAT,
  REGLAGES_PAR_DEFAUT,
  relireLesReglages,
  type EtatDesConsommateurs,
  type ReglagesConsommateurs,
} from './consommateurs';
import {
  controlerRapprochement,
  identifiantDeRapprochement,
  resoudre,
  type Rapprochement,
  type TypeDeRapprochement,
} from './rapprochement';

type MagasinFinances =
  | 'odysseeComptes'
  | 'odysseeValorisations'
  | 'odysseeOperations'
  | 'odysseeLignesBudget'
  | 'odysseeRapprochements'
  | 'odysseeConsommateurs';

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
  return lireCeQuiSOuvre(rangees, (r) => ouvrir<T>(cle, r));
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

/* ══════════════════════════════════════════════════════════════════════════
   Les rapprochements
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le nom de cet appareil, tel qu'il figurera dans un conflit.
 *
 * Il sert à **nommer** un désaccord, pas à l'arbitrer : l'arbitrage se fait
 * sur le type de décision, jamais sur l'appareil. Si l'identité d'appareil
 * n'est pas disponible, on écrit « cet appareil » plutôt que d'inventer un
 * nom — un conflit entre « inconnu-1 » et « inconnu-2 » n'aiderait personne.
 */
async function nomDeLAppareil(): Promise<string> {
  try {
    const { lireAppareil } = await import('../db');
    return (await lireAppareil()) || 'cet appareil';
  } catch {
    return 'cet appareil';
  }
}

export async function ecrireRapprochement(
  r: Omit<Rapprochement, 'id' | 'majLe' | 'appareil'> & { appareil?: string },
): Promise<Rapprochement> {
  const complet: Rapprochement = {
    ...r,
    id: identifiantDeRapprochement(r.operationId, r.occurrenceId),
    appareil: r.appareil ?? (await nomDeLAppareil()),
    majLe: maintenant(),
  };
  exiger(controlerRapprochement(complet));
  return ecrire('odysseeRapprochements', complet);
}

/**
 * Écrit plusieurs rapprochements d'un coup — ce que fait « Tout confirmer ».
 *
 * Une boucle d'écritures séparées ferait autant d'ouvertures du coffre et
 * autant d'entrées de journal ; sur une file de quatorze, la différence se
 * voit à l'écran.
 */
export async function ecrireRapprochements(
  liste: readonly (Omit<Rapprochement, 'id' | 'majLe' | 'appareil'> & { appareil?: string })[],
): Promise<Rapprochement[]> {
  if (!liste.length) return [];
  const cle = exigerLeCoffre();
  const appareil = await nomDeLAppareil();
  const quand = maintenant();
  const complets = liste.map((r) => ({
    ...r,
    id: identifiantDeRapprochement(r.operationId, r.occurrenceId),
    appareil: r.appareil ?? appareil,
    majLe: quand,
  }));
  for (const c of complets) exiger(controlerRapprochement(c));

  const base = await db();
  const tx = base.transaction('odysseeRapprochements', 'readwrite');
  const scelles = await Promise.all(
    complets.map((c) =>
      sceller(cle, 'odysseeRapprochements', c as unknown as Record<string, unknown>),
    ),
  );
  await Promise.all(scelles.map((s) => tx.store.put(s as unknown as never)));
  await tx.done;
  for (const s of scelles) await journaliser('odysseeRapprochements', s);
  return complets;
}

export const tousLesRapprochements = () => toutLire<Rapprochement>('odysseeRapprochements');

/**
 * L'état retenu, conflits compris.
 *
 * C'est cette lecture-là que les écrans utilisent, et non la liste brute :
 * sans l'arbitrage, deux appareils en désaccord feraient compter une
 * opération deux fois dans les écarts.
 */
export async function etatDesRapprochements() {
  const [rapprochements, operations] = await Promise.all([
    tousLesRapprochements(),
    toutesLesOperations(),
  ]);
  return resoudre(rapprochements, operations);
}

/**
 * Annuler une décision — le geste que le pied de la file propose.
 *
 * La suppression est journalisée comme les autres : un rapprochement défait
 * sur un appareil doit l'être partout, sinon le prochain échange le ferait
 * revenir.
 */
export async function annulerRapprochement(
  operationId: string,
  occurrenceId: string | null,
): Promise<void> {
  const id = identifiantDeRapprochement(operationId, occurrenceId);
  await (await db()).delete('odysseeRapprochements', id);
  await journaliserSuppression([`odysseeRapprochements:${id}`]);
}

/** Annule tout ce qui a été appliqué d'office lors d'un passage de la file. */
export async function annulerLesAutomatiques(depuis: string): Promise<number> {
  const tous = await tousLesRapprochements();
  const cibles = tous.filter((r) => r.type === 'automatique' && r.decideLe >= depuis);
  if (!cibles.length) return 0;
  const base = await db();
  const tx = base.transaction('odysseeRapprochements', 'readwrite');
  await Promise.all(cibles.map((r) => tx.store.delete(r.id)));
  await tx.done;
  await journaliserSuppression(cibles.map((r) => `odysseeRapprochements:${r.id}`));
  return cibles.length;
}

export type { Rapprochement, TypeDeRapprochement };

/* ══════════════════════════════════════════════════════════════════════════
   Qui lit mon budget
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les réglages des consommateurs, **par défaut si rien n'est enregistré**.
 *
 * Et par défaut aussi si la lecture échoue : un coffre fermé ou un
 * enregistrement illisible ne doit pas ouvrir des lecteurs qui étaient
 * fermés, ni fermer ceux que la personne avait laissés ouverts sans le
 * redire. Les valeurs par défaut du registre sont la seule réponse sûre.
 */
export async function lireLesConsommateurs(): Promise<ReglagesConsommateurs> {
  try {
    const tous = await toutLire<EtatDesConsommateurs>('odysseeConsommateurs');
    const etat = tous.find((e) => e.id === CLEF_ETAT);
    return etat ? relireLesReglages(etat.reglages) : { ...REGLAGES_PAR_DEFAUT };
  } catch {
    return { ...REGLAGES_PAR_DEFAUT };
  }
}

export async function ecrireLesConsommateurs(
  reglages: ReglagesConsommateurs,
): Promise<EtatDesConsommateurs> {
  const etat: EtatDesConsommateurs = {
    id: CLEF_ETAT,
    reglages: relireLesReglages(reglages),
    majLe: maintenant(),
  };
  return ecrire('odysseeConsommateurs', etat);
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
    base.count('odysseeRapprochements'),
  ]);
  return comptes.reduce((s, n) => s + n, 0);
}
