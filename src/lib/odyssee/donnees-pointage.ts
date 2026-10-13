/**
 * Lire et écrire le pointage, à travers le coffre — phase 3 bis d.
 *
 * Quatre magasins scellés, et une règle qui les traverse tous : **ce que la
 * personne a décidé ne se défait que par elle**. Une mise à jour du
 * dictionnaire, une règle nouvelle, un réimport : aucun des trois ne touche
 * un pointage dont l'auteur est « moi ».
 *
 * ## Annuler, à quatre échelles
 *
 * Une opération, un vendeur, une règle, un import entier. Les quatre
 * existent parce que les quatre arrivent : on se trompe sur une ligne, on
 * se trompe de type pour un commerçant, on écrit une règle trop large, et
 * on importe le mauvais fichier. Offrir seulement la première oblige à
 * défaire quatorze fois ce qu'une erreur a fait en une.
 */
import { db } from '../db';
import { exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import { lireAppareil } from '../db';
import {
  controlerPointage,
  jugerLaRegle,
  type AuteurDuPointage,
  type Pointage,
} from './pointage';
import type { RegleDePointage, Vendeur } from './vendeurs';
import {
  CLEF_TAXONOMIE,
  type EtatDeLaTaxonomie,
  type ModificationDeType,
} from './taxonomie';

type MagasinDePointage =
  | 'odysseeVendeurs'
  | 'odysseeReglesPointage'
  | 'odysseePointages'
  | 'odysseeTaxonomie';

const maintenant = () => new Date().toISOString();

async function journaliser(magasin: MagasinDePointage, scelle: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement(magasin, scelle as Record<string, unknown>);
  } catch {
    // Muet : perdre un pointage parce que le journal a échoué serait pire.
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

async function ecrire<T extends { id: string }>(
  magasin: MagasinDePointage,
  valeur: T,
): Promise<T> {
  const cle = exigerLeCoffre();
  const scelle = await sceller(cle, magasin, valeur as unknown as Record<string, unknown>);
  await (await db()).put(magasin, scelle as unknown as never);
  await journaliser(magasin, scelle);
  return valeur;
}

async function toutLire<T>(magasin: MagasinDePointage): Promise<T[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll(magasin)) as unknown as Record<string, unknown>[];
  return Promise.all(rangees.map((r) => ouvrir<T>(cle, r)));
}

async function ecrireEnLot<T extends { id: string }>(
  magasin: MagasinDePointage,
  valeurs: readonly T[],
): Promise<T[]> {
  if (!valeurs.length) return [];
  const cle = exigerLeCoffre();
  const base = await db();
  const scelles = await Promise.all(
    valeurs.map((v) => sceller(cle, magasin, v as unknown as Record<string, unknown>)),
  );
  const tx = base.transaction(magasin, 'readwrite');
  await Promise.all(scelles.map((s) => tx.store.put(s as unknown as never)));
  await tx.done;
  for (const s of scelles) await journaliser(magasin, s);
  return [...valeurs];
}

/* ══════════════════════════════════════════════════════════════════════════
   Les vendeurs
   ══════════════════════════════════════════════════════════════════════════ */

export const identifiantDeVendeur = (nom: string): string =>
  `v-${nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

export const tousLesVendeurs = () => toutLire<Vendeur>('odysseeVendeurs');

/**
 * Enregistre un vendeur, en **ajoutant** l'alias plutôt qu'en le remplaçant.
 *
 * C'est ce qui fait qu'un vendeur reconnu sous trois formes de libellé le
 * reste : écraser la liste à chaque écriture perdrait la précédente, et
 * l'appariement approché n'aurait jamais plus d'un point de comparaison.
 */
export async function noterLeVendeur(
  nom: string,
  typeId: string,
  alias: string,
): Promise<Vendeur> {
  const id = identifiantDeVendeur(nom);
  const connus = await tousLesVendeurs();
  const deja = connus.find((v) => v.id === id);
  const vendeur: Vendeur = {
    id,
    nom,
    typeId,
    alias: deja ? [...new Set([...deja.alias, alias])] : [alias],
    vu: (deja?.vu ?? 0) + 1,
    majLe: maintenant(),
  };
  return ecrire('odysseeVendeurs', vendeur);
}

export async function oublierLeVendeur(id: string): Promise<void> {
  await (await db()).delete('odysseeVendeurs', id);
  await journaliserSuppression([`odysseeVendeurs:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les règles
   ══════════════════════════════════════════════════════════════════════════ */

export const toutesLesRegles = () => toutLire<RegleDePointage>('odysseeReglesPointage');

export const ecrireLaRegle = (r: RegleDePointage) =>
  ecrire('odysseeReglesPointage', { ...r, majLe: maintenant() });

export async function supprimerLaRegle(id: string): Promise<void> {
  await (await db()).delete('odysseeReglesPointage', id);
  await journaliserSuppression([`odysseeReglesPointage:${id}`]);
}

/**
 * Compte une application, ou une correction, et **rétrograde** s'il le faut.
 *
 * La rétrogradation est automatique et annoncée : une règle souvent
 * corrigée qui continuerait à pointer seule referait la même erreur chaque
 * mois, et la personne la corrigerait chaque mois sans comprendre pourquoi
 * elle revient.
 */
export async function compterLaRegle(
  id: string,
  quoi: 'appliquee' | 'corrigee',
): Promise<{ regle: RegleDePointage; retrogradee: boolean; phrase: string } | null> {
  const regles = await toutesLesRegles();
  const r = regles.find((x) => x.id === id);
  if (!r) return null;
  const maj: RegleDePointage = {
    ...r,
    appliquee: r.appliquee + (quoi === 'appliquee' ? 1 : 0),
    corrigee: r.corrigee + (quoi === 'corrigee' ? 1 : 0),
    majLe: maintenant(),
  };
  const verdict = jugerLaRegle(maj.appliquee, maj.corrigee);
  const retrogradee = verdict.retrograder && maj.mode === 'auto';
  if (retrogradee) maj.mode = 'proposer';
  await ecrire('odysseeReglesPointage', maj);
  return { regle: maj, retrogradee, phrase: verdict.phrase };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les pointages
   ══════════════════════════════════════════════════════════════════════════ */

export const tousLesPointages = () => toutLire<Pointage>('odysseePointages');

function exiger(problemes: readonly string[]): void {
  if (problemes.length) throw new Error(problemes.join(' '));
}

export interface NouveauPointage {
  operationId: string;
  statut: Pointage['statut'];
  vendeurNom: string | null;
  typeId: string | null;
  parts?: Pointage['parts'];
  auteur: AuteurDuPointage;
  pourquoi: string;
  versionDuDictionnaire?: string | null;
  importId?: string | null;
}

/**
 * Écrit des pointages, en **respectant ce qui a été pointé à la main**.
 *
 * Une opération dont l'auteur est « moi » n'est pas remplacée par une règle
 * ni par le dictionnaire : elle est laissée telle quelle, et le nombre
 * d'opérations ainsi protégées est rendu pour que l'écran puisse le dire.
 */
export async function ecrireLesPointages(
  nouveaux: readonly NouveauPointage[],
): Promise<{ ecrits: Pointage[]; protegees: number }> {
  if (!nouveaux.length) return { ecrits: [], protegees: 0 };
  const anciens = new Map((await tousLesPointages()).map((p) => [p.operationId, p]));
  const appareil = await nomDeLAppareil();
  const quand = maintenant();

  const ecrits: Pointage[] = [];
  let protegees = 0;
  for (const n of nouveaux) {
    const ancien = anciens.get(n.operationId);
    if (ancien?.auteur === 'moi' && n.auteur !== 'moi') {
      protegees += 1;
      continue;
    }
    const p: Pointage = {
      id: n.operationId,
      operationId: n.operationId,
      statut: n.statut,
      vendeurNom: n.vendeurNom,
      typeId: n.typeId,
      parts: n.parts ?? [],
      auteur: n.auteur,
      pourquoi: n.pourquoi,
      versionDuDictionnaire: n.versionDuDictionnaire ?? null,
      importId: n.importId ?? null,
      precedent: ancien
        ? { typeId: ancien.typeId, vendeurNom: ancien.vendeurNom, auteur: ancien.auteur }
        : null,
      appareil,
      decideLe: quand,
      majLe: quand,
    };
    exiger(controlerPointage(p));
    ecrits.push(p);
  }
  await ecrireEnLot('odysseePointages', ecrits);
  return { ecrits, protegees };
}

async function nomDeLAppareil(): Promise<string> {
  try {
    return (await lireAppareil()) || 'cet appareil';
  } catch {
    return 'cet appareil';
  }
}

/* ── Annuler, à quatre échelles ───────────────────────────────────────── */

export async function annulerLePointage(operationId: string): Promise<void> {
  await (await db()).delete('odysseePointages', operationId);
  await journaliserSuppression([`odysseePointages:${operationId}`]);
}

async function annulerPlusieurs(cibles: readonly Pointage[]): Promise<number> {
  if (!cibles.length) return 0;
  const base = await db();
  const tx = base.transaction('odysseePointages', 'readwrite');
  await Promise.all(cibles.map((p) => tx.store.delete(p.id)));
  await tx.done;
  await journaliserSuppression(cibles.map((p) => `odysseePointages:${p.id}`));
  return cibles.length;
}

/**
 * Tout ce qui a été classé sous ce vendeur, défait.
 *
 * Sauf ce que la personne a pointé elle-même : annuler « le vendeur » veut
 * dire défaire ce que la machine en a fait, pas ses propres décisions.
 */
export const annulerLeVendeur = async (nom: string): Promise<number> =>
  annulerPlusieurs(
    (await tousLesPointages()).filter((p) => p.vendeurNom === nom && p.auteur !== 'moi'),
  );

export const annulerLaRegle = async (nomDeLaRegle: string): Promise<number> =>
  annulerPlusieurs(
    (await tousLesPointages()).filter(
      (p) => p.auteur === 'regle' && p.pourquoi.includes(nomDeLaRegle),
    ),
  );

export const annulerLImport = async (importId: string): Promise<number> =>
  annulerPlusieurs(
    (await tousLesPointages()).filter((p) => p.importId === importId && p.auteur !== 'moi'),
  );

/* ══════════════════════════════════════════════════════════════════════════
   La taxonomie modifiée
   ══════════════════════════════════════════════════════════════════════════ */

export async function lireLesModifications(): Promise<ModificationDeType[]> {
  try {
    const tous = await toutLire<EtatDeLaTaxonomie>('odysseeTaxonomie');
    return [...(tous.find((t) => t.id === CLEF_TAXONOMIE)?.modifications ?? [])];
  } catch {
    return [];
  }
}

export const ecrireLesModifications = (modifications: readonly ModificationDeType[]) =>
  ecrire('odysseeTaxonomie', {
    id: CLEF_TAXONOMIE,
    modifications: [...modifications],
    majLe: maintenant(),
  } satisfies EtatDeLaTaxonomie);

/* ── Les entrées du dictionnaire masquées ─────────────────────────────── */

/**
 * Masquer une entrée du dictionnaire se range avec les règles, sous la
 * forme d'une règle sans type : c'est la seule chose qui voyage, et elle
 * doit survivre à une mise à jour du fichier embarqué.
 */
export const MASQUE = 'masque' as const;

export const nomsMasques = async (): Promise<string[]> =>
  (await toutesLesRegles()).filter((r) => r.typeId === MASQUE).map((r) => r.nom);
