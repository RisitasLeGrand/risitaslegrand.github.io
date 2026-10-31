/**
 * Lire et écrire ce qui passe par le coffre.
 *
 * ## Tout passe par `sceller` et `ouvrir`, sans exception
 *
 * Il n'existe pas de chemin d'écriture qui contourne le coffre : chaque
 * fonction d'ici appelle `exigerLeCoffre()`, qui **lève** si la clé n'est pas
 * en mémoire. Rendre `null` aurait semblé plus doux et aurait produit la seule
 * erreur qui compte : un appelant distrait écrivant en clair dans un magasin
 * scellé.
 *
 * ## Le journal ne reçoit que des identifiants
 *
 * Les magasins scellés sont journalisés comme les autres — ils voyagent, se
 * sauvegardent et s'effacent par le même mécanisme —, mais ce qui part au
 * journal est **l'enregistrement scellé**, pas son contenu. La synchronisation
 * transporte donc du chiffré, ce qui est exactement ce qu'on veut : un paquet
 * de synchronisation qui traverserait un QR code ou un dossier partagé ne doit
 * pas exposer un journal intime.
 */
import { db } from '../db';
import { ulid } from '../noyau/ulid';
import { jourLogique } from '../noyau/jour-logique';
import { exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import { lireCeQuiSOuvre } from '../noyau/lecture-tolerante';
import {
  controlerPrise,
  controlerStatut,
  type NatureDuStatut,
  type Prise,
  type StatutHormonal,
  type VoieDAdministration,
} from './sensible';

type MagasinSensible = 'odysseeMedicaments' | 'odysseeHormonal';

async function journaliser(magasin: MagasinSensible, scelle: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement(magasin, scelle as Record<string, unknown>);
  } catch {
    // Muet : voir les autres couches de données.
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

/* ══════════════════════════════════════════════════════════════════════════
   Les prises
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrirePrise(
  nom: string,
  dose: string,
  options: {
    id?: string;
    le?: Date;
    voie?: VoieDAdministration;
    motif?: string;
    note?: string;
    /**
     * Le traitement auquel cette prise se rattache.
     *
     * **Le champ existait au type depuis la phase 1 de Santé ; aucun chemin
     * d'écriture ne le remplissait.** La conséquence ne se voyait pas en
     * relisant le code : `heuresDepuisLaDernierePrise()` filtre sur lui, et
     * rendait donc `null` pour tous les traitements, toujours — l'écran
     * Santé affichait « aucune prise enregistrée » sous chaque traitement, y
     * compris sous ceux dont on venait de noter une prise. Le seul calcul
     * que la phase 1 revendiquait ne pouvait pas s'afficher.
     *
     * Il reste facultatif : une prise notée depuis « Mon corps » n'est
     * rattachée à rien, et c'est la vérité pour elle.
     */
    traitementId?: string | null;
  } = {},
): Promise<Prise> {
  const cle = exigerLeCoffre();
  const le = options.le ?? new Date();
  const prise: Prise = {
    id: options.id ?? ulid(),
    jour: jourLogique(le),
    le: le.toISOString(),
    nom: nom.trim(),
    traitementId: options.traitementId ?? null,
    dose: dose.trim(),
    voie: options.voie ?? 'orale',
    motif: options.motif ?? '',
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerPrise(prise));

  const scelle = await sceller(cle, 'odysseeMedicaments', prise as unknown as Record<string, unknown>);
  await (await db()).put('odysseeMedicaments', scelle as unknown as Prise);
  await journaliser('odysseeMedicaments', scelle);
  return prise;
}

/** Toutes les prises, ouvertes. Lève si le coffre est fermé. */
export async function toutesLesPrises(): Promise<Prise[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseeMedicaments')) as unknown as Record<
    string,
    unknown
  >[];
  return lireCeQuiSOuvre(rangees, (r) => ouvrir<Prise>(cle, r));
}

/**
 * Combien d'enregistrements scellés existent, **sans ouvrir le coffre**.
 *
 * Le rappel de sauvegarde en a besoin, et il doit pouvoir s'afficher coffre
 * fermé : prévenir « vous avez des données chiffrées non sauvegardées » est
 * précisément utile à quelqu'un qui n'a pas ouvert le coffre depuis
 * longtemps. Compter ne lit aucun contenu.
 */
export async function combienDeScelles(): Promise<number> {
  const base = await db();
  const [prises, statuts] = await Promise.all([
    base.count('odysseeMedicaments'),
    base.count('odysseeHormonal'),
  ]);
  return prises + statuts;
}

export async function supprimerPrise(id: string): Promise<void> {
  await (await db()).delete('odysseeMedicaments', id);
  await journaliserSuppression([`odysseeMedicaments:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le statut hormonal
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireStatut(
  intitule: string,
  options: {
    id?: string;
    nature?: NatureDuStatut;
    debut?: string;
    fin?: string | null;
    note?: string;
  } = {},
): Promise<StatutHormonal> {
  const cle = exigerLeCoffre();
  const statut: StatutHormonal = {
    id: options.id ?? ulid(),
    nature: options.nature ?? 'traitement',
    intitule: intitule.trim(),
    debut: options.debut ?? maintenant(),
    fin: options.fin ?? null,
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerStatut(statut));

  const scelle = await sceller(cle, 'odysseeHormonal', statut as unknown as Record<string, unknown>);
  await (await db()).put('odysseeHormonal', scelle as unknown as StatutHormonal);
  await journaliser('odysseeHormonal', scelle);
  return statut;
}

export async function tousLesStatuts(): Promise<StatutHormonal[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseeHormonal')) as unknown as Record<
    string,
    unknown
  >[];
  return lireCeQuiSOuvre(rangees, (r) => ouvrir<StatutHormonal>(cle, r));
}

export async function refermerStatut(id: string, le = new Date()): Promise<StatutHormonal | null> {
  const statuts = await tousLesStatuts();
  const statut = statuts.find((s) => s.id === id);
  if (!statut) return null;
  return ecrireStatut(statut.intitule, {
    id: statut.id,
    nature: statut.nature,
    debut: statut.debut,
    fin: le.toISOString(),
    note: statut.note,
  });
}

export async function supprimerStatut(id: string): Promise<void> {
  await (await db()).delete('odysseeHormonal', id);
  await journaliserSuppression([`odysseeHormonal:${id}`]);
}
