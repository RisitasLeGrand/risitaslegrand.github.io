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
  type PartPointee,
  type Pointage,
} from './pointage';
import { controlerLesParts } from './fractionnement';
import { apercuSurLePasse, type Apercu, type OperationPointable } from './regles-pointage';
import { typeDe } from './taxonomie';
import type { OperationBancaire } from './finances';
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

/**
 * La part qui porte le plus gros montant.
 *
 * Elle sert à deux choses : donner au pointage un `typeId` qui veuille dire
 * quelque chose pour qui ne lit pas les parts, et décider de ce que devient
 * l'opération si l'on défait le fractionnement. Le départage en cas
 * d'égalité est l'ordre d'édition — celui dans lequel la personne a saisi
 * ses parts —, et non l'ordre alphabétique : c'est le seul qui ait un sens
 * pour elle.
 */
export const partPrincipale = (parts: readonly PartPointee[]): PartPointee | null =>
  parts.reduce<PartPointee | null>(
    (meilleure, p) =>
      meilleure === null || Math.abs(p.centimes) > Math.abs(meilleure.centimes) ? p : meilleure,
    null,
  );

/**
 * Répartit une opération entre plusieurs types.
 *
 * Le pointage qui en sort est **de moi** : il est donc protégé contre les
 * règles, le dictionnaire et les réimports, comme tout ce que la personne a
 * décidé elle-même. C'est voulu — on ne fractionne pas une opération pour
 * qu'une règle la recolle au prochain import.
 *
 * Le contrôle complet, celui qui vérifie que les parts somment à
 * l'opération, se fait ici parce que c'est le seul endroit où le montant de
 * l'opération est en main.
 */
export async function fractionnerLOperation(
  operation: OperationBancaire,
  parts: readonly PartPointee[],
  vendeurNom: string | null = null,
): Promise<Pointage> {
  exiger(controlerLesParts(operation, parts));
  const principale = partPrincipale(parts);
  const { ecrits } = await ecrireLesPointages([
    {
      operationId: operation.id,
      statut: 'pointee-par-moi',
      vendeurNom,
      typeId: principale?.typeId ?? null,
      parts: parts.map((p) => ({ ...p })),
      auteur: 'moi',
      pourquoi: `Réparti par vous en ${parts.length} parts.`,
    },
  ]);
  if (!ecrits.length) throw new Error('Le fractionnement n’a rien écrit.');
  return ecrits[0];
}

/**
 * Défait un fractionnement : l'opération retourne à un seul type.
 *
 * Elle ne retourne pas « à pointer » — ce serait perdre ce que la personne
 * savait déjà. Elle garde le type de sa part la plus grosse, à moins qu'on
 * n'en impose un autre.
 */
export async function defractionnerLOperation(
  operationId: string,
  typeId?: string,
): Promise<Pointage | null> {
  const ancien = (await tousLesPointages()).find((p) => p.operationId === operationId);
  if (!ancien) return null;
  const retenu = typeId ?? partPrincipale(ancien.parts)?.typeId ?? ancien.typeId;
  const { ecrits } = await ecrireLesPointages([
    {
      operationId,
      statut: 'pointee-par-moi',
      vendeurNom: ancien.vendeurNom,
      typeId: retenu,
      parts: [],
      auteur: 'moi',
      pourquoi: 'Fractionnement défait par vous.',
    },
  ]);
  return ecrits[0] ?? null;
}

/* ── Appliquer une règle au passé ─────────────────────────────────────── */

/**
 * Les opérations sous la forme que l'aperçu attend, avec ce qui les protège.
 *
 * Les opérations sont passées en paramètre plutôt que lues ici : ce module
 * tient le pointage, pas les relevés, et aller les chercher créerait un lien
 * entre deux magasins qui n'ont aucune raison de se connaître.
 */
export async function pointables(
  operations: readonly OperationBancaire[],
): Promise<OperationPointable[]> {
  const pointages = new Map((await tousLesPointages()).map((p) => [p.operationId, p]));
  return operations.map((o) => ({
    id: o.id,
    libelle: o.libelle,
    centimes: o.centimes,
    pointeeParMoi: pointages.get(o.id)?.auteur === 'moi',
  }));
}

/** Ce qu'une règle ferait au passé. Ne touche à rien. */
export async function apercuDeLaRegle(
  regle: RegleDePointage,
  operations: readonly OperationBancaire[],
): Promise<Apercu> {
  return apercuSurLePasse(regle, await pointables(operations));
}

/**
 * Applique une règle aux opérations déjà importées.
 *
 * ## Pourquoi un type « jamais automatique » est refusé ici
 *
 * Reclasser vingt-trois opérations d'un geste **est** un pointage
 * automatique, quoi qu'en dise le bouton qui le déclenche. Les types marqués
 * `jamaisAuto` — la santé, et ce qui lui ressemble — existent précisément
 * pour que ce geste-là n'existe pas sur eux. On refuse donc, en disant
 * pourquoi, plutôt que d'accepter en désobéissant en silence à un drapeau
 * qu'on a posé soi-même.
 *
 * ## Pourquoi l'auteur reste « règle »
 *
 * Alors que la personne a décidé, explicitement, devant l'aperçu. Parce que
 * « Défaire ses pointages », sur l'écran des règles, cherche les pointages
 * d'auteur « règle » portant le nom de la règle : les écrire au nom de la
 * personne rendrait une application de masse impossible à défaire autrement
 * qu'opération par opération. Ce qu'elle a décidé, c'est d'appliquer la
 * règle ; c'est donc la règle qui signe, et elle se défait comme telle.
 */
export async function appliquerLaRegleAuPasse(
  regle: RegleDePointage,
  operations: readonly OperationBancaire[],
): Promise<{ ecrits: number; protegees: number; apercu: Apercu }> {
  const type = typeDe(regle.typeId);
  if (type?.jamaisAuto) {
    throw new Error(
      `« ${type.libelle} » n’est jamais pointé automatiquement, et reclasser d’un geste des ` +
        'opérations déjà importées en est un. Classez-les une par une, ou changez de type.',
    );
  }
  const apercu = await apercuDeLaRegle(regle, operations);
  if (!apercu.touchees.length) return { ecrits: 0, protegees: apercu.protegees.length, apercu };

  const { ecrits, protegees } = await ecrireLesPointages(
    apercu.touchees.map((o) => ({
      operationId: o.id,
      statut: 'pointee-auto' as const,
      vendeurNom: regle.nom,
      typeId: regle.typeId,
      auteur: 'regle' as const,
      pourquoi: `Règle « ${regle.nom} » appliquée par vous aux opérations déjà importées.`,
    })),
  );
  return { ecrits: ecrits.length, protegees: protegees + apercu.protegees.length, apercu };
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
