/**
 * Lire et écrire les cinq magasins de Santé, tous scellés.
 *
 * Même contrat que `donnees-sensible.ts`, dont ce module est le voisin
 * direct : aucun chemin d'écriture ne contourne le coffre, et ce qui part au
 * journal de synchronisation est l'enregistrement **scellé**, jamais son
 * contenu. Les deux modules restent séparés parce que leurs objets le sont :
 * une prise est un geste, un traitement est une période, et les mélanger
 * obligerait chaque lecture à filtrer sur un champ de sorte.
 *
 * Ce module ne contient **aucune règle de santé**. Il range et il relit. Les
 * contrôles qu'il applique sont ceux de `sante.ts`, et ils portent sur la
 * forme — une date qui existe, une unité qui n'est pas vide, une intensité
 * entre 0 et 10 —, jamais sur le sens de ce qui est saisi.
 */
import { db } from '../db';
import { ulid } from '../noyau/ulid';
import { exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import {
  controlerCondition,
  controlerPrelevement,
  controlerRessenti,
  controlerResultat,
  controlerSymptome,
  controlerTraitement,
  type ConditionDeclaree,
  type OrigineDuTraitement,
  type Prelevement,
  type Ressenti,
  type Resultat,
  type SchemaDePrise,
  type Symptome,
  type Traitement,
} from './sante';

type MagasinDeSante =
  | 'odysseeTraitements'
  | 'odysseePrelevements'
  | 'odysseeResultats'
  | 'odysseeSymptomes'
  | 'odysseeConditions'
  | 'odysseeRessentis';

async function journaliser(magasin: MagasinDeSante, scelle: unknown): Promise<void> {
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

/**
 * Sceller, écrire, journaliser — les trois gestes de toute écriture d'ici.
 *
 * Factorisés parce que les cinq magasins les répètent à l'identique, et
 * qu'une écriture qui oublierait le scellement ne se verrait pas : elle
 * réussirait, et la donnée serait en clair.
 */
async function ranger<T extends { id: string }>(magasin: MagasinDeSante, objet: T): Promise<T> {
  const cle = exigerLeCoffre();
  const scelle = await sceller(cle, magasin, objet as unknown as Record<string, unknown>);
  await (await db()).put(magasin as 'odysseeTraitements', scelle as unknown as Traitement);
  await journaliser(magasin, scelle);
  return objet;
}

async function toutOuvrir<T>(magasin: MagasinDeSante): Promise<T[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll(magasin as 'odysseeTraitements')) as unknown as Record<
    string,
    unknown
  >[];
  return Promise.all(rangees.map((r) => ouvrir<T>(cle, r)));
}

async function oublier(magasin: MagasinDeSante, id: string): Promise<void> {
  await (await db()).delete(magasin as 'odysseeTraitements', id);
  await journaliserSuppression([`${magasin}:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   L'activation explicite
   ══════════════════════════════════════════════════════════════════════════ */

const CLEF_ACTIVATION = 'sante.active';

/**
 * L'espace Santé ne s'ouvre que si on le demande.
 *
 * C'est H.1 du prompt, et ce n'est pas une politesse. Un onglet « Santé »
 * garni de champs vides, proposé à quelqu'un qui n'a rien à y mettre, est une
 * invitation à y mettre quelque chose — et ce quelque chose est la catégorie
 * de données la plus coûteuse de l'application. Tant que l'activation n'est
 * pas donnée, l'écran explique ce qu'il ferait et ne range rien.
 *
 * Le drapeau vit dans `etat`, qui **ne voyage pas** : activer la Santé sur
 * l'ordinateur ne l'active pas sur le téléphone. C'est voulu — l'activation
 * est un consentement, et un consentement ne se synchronise pas.
 */
export async function santeActive(): Promise<boolean> {
  const base = await db();
  return ((await base.get('etat', CLEF_ACTIVATION)) as { active?: boolean } | undefined)?.active === true;
}

export async function activerLaSante(active: boolean): Promise<void> {
  await (await db()).put('etat', { active, le: maintenant() }, CLEF_ACTIVATION);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les traitements déclarés
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireTraitement(
  nom: string,
  debut: string,
  options: {
    id?: string;
    moleculeId?: string | null;
    origine?: OrigineDuTraitement;
    prescripteur?: string;
    posologie?: string;
    /** Une prise isolée : pas de fin, pas de schéma, pas de rappel. */
    sporadique?: boolean;
    /** Le schéma prévu, ou rien. `controlerTraitement` refuse les deux ensemble. */
    schema?: SchemaDePrise | null;
    fin?: string;
    note?: string;
  } = {},
): Promise<Traitement> {
  const traitement: Traitement = {
    id: options.id ?? ulid(),
    nom: nom.trim(),
    moleculeId: options.moleculeId ?? null,
    origine: options.origine ?? 'moi',
    prescripteur: options.prescripteur?.trim() ?? '',
    posologie: options.posologie?.trim() ?? '',
    sporadique: options.sporadique ?? false,
    /*
       `null` et non `undefined` : le traitement part dans un enregistrement
       scellé qui sera relu par `JSON.parse`, et `undefined` y disparaît. Un
       champ qui s'efface à l'écriture ne se distingue pas d'un champ qu'on
       n'a pas voulu, et un retrait de schéma passerait pour un oubli.
    */
    schema: options.schema ?? null,
    debut,
    fin: options.fin ?? '',
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerTraitement(traitement));
  return ranger('odysseeTraitements', traitement);
}

export const tousLesTraitements = (): Promise<Traitement[]> =>
  toutOuvrir<Traitement>('odysseeTraitements');

export const supprimerTraitement = (id: string): Promise<void> =>
  oublier('odysseeTraitements', id);

/* ══════════════════════════════════════════════════════════════════════════
   Les prélèvements et leurs résultats
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrirePrelevement(
  jour: string,
  options: {
    id?: string;
    le?: string;
    laboratoire?: string;
    contexte?: string;
    note?: string;
  } = {},
): Promise<Prelevement> {
  const prelevement: Prelevement = {
    id: options.id ?? ulid(),
    jour,
    le: options.le ?? '',
    laboratoire: options.laboratoire?.trim() ?? '',
    contexte: options.contexte?.trim() ?? '',
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerPrelevement(prelevement));
  return ranger('odysseePrelevements', prelevement);
}

export const tousLesPrelevements = (): Promise<Prelevement[]> =>
  toutOuvrir<Prelevement>('odysseePrelevements');

/**
 * Supprimer un prélèvement emporte ses résultats.
 *
 * Un résultat sans prélèvement n'a ni date, ni laboratoire, ni contexte :
 * c'est un nombre orphelin, et le garder reviendrait à garder une valeur que
 * plus rien ne situe. La suppression est donc en cascade, et elle le dit.
 */
export async function supprimerPrelevement(id: string): Promise<number> {
  const resultats = (await tousLesResultats()).filter((r) => r.prelevementId === id);
  for (const r of resultats) await oublier('odysseeResultats', r.id);
  await oublier('odysseePrelevements', id);
  return resultats.length;
}

export async function ecrireResultat(
  prelevementId: string,
  analyte: string,
  valeur: number,
  unite: string,
  options: {
    id?: string;
    intervalleBas?: number | null;
    intervalleHaut?: number | null;
    note?: string;
  } = {},
): Promise<Resultat> {
  const resultat: Resultat = {
    id: options.id ?? ulid(),
    prelevementId,
    analyte: analyte.trim(),
    valeur,
    unite: unite.trim(),
    intervalleBas: options.intervalleBas ?? null,
    intervalleHaut: options.intervalleHaut ?? null,
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerResultat(resultat));
  return ranger('odysseeResultats', resultat);
}

export const tousLesResultats = (): Promise<Resultat[]> => toutOuvrir<Resultat>('odysseeResultats');

export const supprimerResultat = (id: string): Promise<void> => oublier('odysseeResultats', id);

/* ══════════════════════════════════════════════════════════════════════════
   Symptômes et conditions
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrireSymptome(
  jour: string,
  intitule: string,
  intensite: number,
  options: { id?: string; note?: string } = {},
): Promise<Symptome> {
  const symptome: Symptome = {
    id: options.id ?? ulid(),
    jour,
    intitule: intitule.trim(),
    intensite,
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerSymptome(symptome));
  return ranger('odysseeSymptomes', symptome);
}

export const tousLesSymptomes = (): Promise<Symptome[]> => toutOuvrir<Symptome>('odysseeSymptomes');

export const supprimerSymptome = (id: string): Promise<void> => oublier('odysseeSymptomes', id);

export async function ecrireCondition(
  intitule: string,
  debut: string,
  options: { id?: string; fin?: string; note?: string } = {},
): Promise<ConditionDeclaree> {
  const condition: ConditionDeclaree = {
    id: options.id ?? ulid(),
    intitule: intitule.trim(),
    debut,
    fin: options.fin ?? '',
    note: options.note ?? '',
    majLe: maintenant(),
  };
  exiger(controlerCondition(condition));
  return ranger('odysseeConditions', condition);
}

export const toutesLesConditions = (): Promise<ConditionDeclaree[]> =>
  toutOuvrir<ConditionDeclaree>('odysseeConditions');

export const supprimerCondition = (id: string): Promise<void> => oublier('odysseeConditions', id);

/**
 * Combien d'enregistrements de santé existent, **sans ouvrir le coffre**.
 *
 * Même office que `combienDeScelles` du module voisin : le rappel de
 * sauvegarde doit pouvoir dire « vous avez des données chiffrées non
 * sauvegardées » à quelqu'un qui n'a pas ouvert son coffre depuis longtemps.
 * Compter ne lit aucun contenu.
 */
export async function combienDeSante(): Promise<number> {
  const base = await db();
  const comptes = await Promise.all([
    base.count('odysseeTraitements'),
    base.count('odysseePrelevements'),
    base.count('odysseeResultats'),
    base.count('odysseeSymptomes'),
    base.count('odysseeConditions'),
  ]);
  return comptes.reduce((s, n) => s + n, 0);
}

/* ── Les ressentis, rattachés à un traitement (2.3) ───────────────────── */

/**
 * Écrit une note de ressenti.
 *
 * Même chemin que tout le reste de Santé : `ranger()` scelle avant d'écrire,
 * et rien ne passe à côté. Il n'y a pas de variante « rapide » : une note
 * qu'on écrirait en clair parce qu'elle est courte serait la seule du
 * magasin à l'être, et suffirait à trahir le reste.
 */
export async function ecrireRessenti(
  r: Omit<Ressenti, 'id' | 'majLe'> & { id?: string },
): Promise<Ressenti> {
  const complet: Ressenti = { ...r, id: r.id ?? ulid(), majLe: new Date().toISOString() };
  const problemes = controlerRessenti(complet);
  if (problemes.length) throw new Error(problemes.join(' '));
  await ranger('odysseeRessentis', complet);
  return complet;
}

export const tousLesRessentis = (): Promise<Ressenti[]> =>
  toutOuvrir<Ressenti>('odysseeRessentis');

export const supprimerRessenti = (id: string): Promise<void> => oublier('odysseeRessentis', id);

/** Les notes d'un traitement, de la plus récente à la plus ancienne. */
export async function ressentisDuTraitement(traitementId: string): Promise<Ressenti[]> {
  const tous = await tousLesRessentis();
  return tous.filter((r) => r.traitementId === traitementId).sort((a, b) => (a.jour < b.jour ? 1 : -1));
}
