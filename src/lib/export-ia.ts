/**
 * L'export pour une IA, côté base : rassembler, hacher, inscrire au journal.
 *
 * `odyssee/export-ia.ts` construit les fichiers et ne touche à rien ; ce module
 * va chercher les données, calcule l'empreinte, pose le vecteur de versions, et
 * inscrit l'export au journal **sans son contenu**.
 *
 * ## Aucune copie conservée
 *
 * E.7 l'exige, et c'est la raison pour laquelle le journal ne porte que
 * l'identifiant, l'empreinte, la date et le périmètre. Garder le contenu
 * reviendrait à faire du site l'archive de ce qu'on a confié dehors — ce qui
 * est exactement l'inverse du but. L'import, plus tard, retrouvera l'export par
 * son identifiant et son empreinte, pas par une copie.
 *
 * ## Le vecteur de versions est ce qui rend la vérification possible
 *
 * Et ce qui dit quand elle ne l'est pas. Les bornes d'horloge par appareil
 * disent jusqu'où le journal portait ; le périmètre de compaction dit ce qui
 * avait déjà été effacé. C'est la brique dont la vérification des chiffres
 * (B.6.4) aura besoin pour répondre « non vérifiable » au lieu d'inventer.
 */
import { db, lireAppareil, toutesLesOperations } from './db';
import { signalerEcriture } from './sync/signal-ecriture';
import { sha256Hex } from './crypto';
import { decoderHlc } from './noyau/hlc';
import { operation, SANS_LOT } from './noyau/operations';
import { ulid } from './noyau/ulid';
import { prochaineHlc } from './sync/horloge-locale';
import { compactagesDeclares, perimetre } from './sync/compaction';
import { retirerCeQuiNeSortPas } from './noyau/jamais-partage';
import { jourLogique } from './noyau/jour-logique';
import {
  CATEGORIES,
  CATEGORIES_SOUS_COFFRE,
  categoriesParDefaut,
  construire,
  controlerExport,
  estimer,
  fichierUnique,
  manifeste,
  type AnalysePrecedente,
  type Estimation,
  type FichierExporte,
  type Manifeste,
  type Serie,
  type VecteurDeVersions,
} from './odyssee/export-ia';
import { rassembler, serieDe } from './indicateurs';
import { periode, periodeLibre, precedente, comparer, synthese } from './odyssee/syntheses';
import type { Portee, TypePeriode } from './odyssee/syntheses';
import { INDICATEURS } from './odyssee/indicateurs';
import { SCHEMA_REVISIONS } from './sauvegarde/service';

/* ══════════════════════════════════════════════════════════════════════════
   Le journal des exports
   ══════════════════════════════════════════════════════════════════════════ */

export const TYPE_EXPORT = 'export.ia';

export const cibleDeLExport = (id: string): string => `export:${id}`;

export interface EntreeJournalExport {
  exportId: string;
  empreinte: string;
  genereLe: string;
  periode: { debut: string; fin: string };
  portee: string;
  categories: readonly string[];
  /** Le poids en octets, pour savoir ce qui a été confié. Jamais le contenu. */
  octets: number;
  appareil: string;
}

/**
 * Le journal des exports : une opération par export, et c'est tout.
 *
 * Une opération et non un magasin, pour la même raison que le profil : elle
 * voyage déjà, elle se fusionne déjà, et un magasin aurait fait deux vérités du
 * même fait. L'avantage se voit le jour où l'on importe une analyse sur le
 * téléphone à partir d'un export fait sur l'ordinateur : le journal est là.
 */
export async function inscrireAuJournal(entree: Omit<EntreeJournalExport, 'appareil'>) {
  const appareil = await lireAppareil();
  const op = operation({
    id: ulid(),
    appareil,
    hlc: decoderHlc(await prochaineHlc()),
    type: TYPE_EXPORT,
    cible: cibleDeLExport(entree.exportId),
    lot: SANS_LOT,
    charge: entree,
  });
  await (await db()).put('operations', op);
  signalerEcriture();
  return op;
}

export async function journalDesExports(): Promise<EntreeJournalExport[]> {
  const operations = await toutesLesOperations();
  return operations
    .filter((o) => o.type === TYPE_EXPORT)
    .map((o) => ({ ...(o.charge as EntreeJournalExport), appareil: o.appareil }))
    .filter((e) => typeof e.exportId === 'string' && typeof e.empreinte === 'string')
    .sort((a, b) => (a.genereLe < b.genereLe ? 1 : -1));
}

/** Retrouve un export du journal par son identifiant. Pour l'import. */
export async function exportConnu(id: string): Promise<EntreeJournalExport | null> {
  return (await journalDesExports()).find((e) => e.exportId === id) ?? null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le vecteur de versions
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les bornes d'horloge par appareil, et le périmètre de compaction.
 *
 * La borne d'un appareil est la **plus haute horloge** de ses opérations : c'est
 * ce que le journal portait de lui au moment de l'export, donc l'état auquel un
 * recalcul devra se placer.
 */
export async function vecteurDeVersions(): Promise<VecteurDeVersions> {
  const operations = await toutesLesOperations();
  const bornes: Record<string, string> = {};
  for (const op of operations) {
    if (!bornes[op.appareil] || op.hlc > bornes[op.appareil]) bornes[op.appareil] = op.hlc;
  }
  const compaction = Object.fromEntries(perimetre(compactagesDeclares(operations)));

  /*
   * Le premier jour encore détaillé : sans compaction, tout l'est. Avec
   * compaction, le détail commence après la plus haute borne effacée — et une
   * preuve portant sur une période antérieure sera « non vérifiable » plutôt
   * que fausse.
   */
  const bornesEffacees = Object.values(compaction).sort();
  const plusHaute = bornesEffacees[bornesEffacees.length - 1];
  const detailDepuis = plusHaute
    ? operations
        .filter((o) => o.hlc > plusHaute)
        .map((o) => o.id)
        .sort()[0]
    : undefined;

  return {
    bornes,
    compaction,
    ...(plusHaute && detailDepuis ? { detailDepuis: jourLogique(new Date()) } : {}),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Construire l'export
   ══════════════════════════════════════════════════════════════════════════ */

export interface OptionsExport {
  type?: TypePeriode;
  ancre?: string;
  /** Une période libre, qui prend le pas sur `type`. */
  de?: string;
  a?: string;
  portee?: Portee;
  /** Les catégories retenues. Celles d'E.7 par défaut. */
  categories?: readonly string[];
  /** Le nom employé dans les textes. Jamais le prénom réel. */
  pseudonyme?: string;
  maintenant?: Date;
  /** Les séries à joindre. Par défaut, celles des indicateurs mesurés. */
  series?: readonly string[];
}

export interface Export {
  fichiers: FichierExporte[];
  manifeste: Manifeste;
  estimation: Estimation;
  /** La variante fichier unique, toujours construite : elle ne coûte rien. */
  unique: FichierExporte;
  /** Les problèmes trouvés par le contrôle, qui empêchent l'écriture. */
  problemes: string[];
}

/** Le pseudonyme par défaut : neutre, et jamais le prénom. */
export const PSEUDONYME_PAR_DEFAUT = 'la personne';

/**
 * Construit l'export complet, empreinte et manifeste compris.
 *
 * L'ordre est imposé par le hachage : les huit fichiers d'abord, leur empreinte
 * ensuite, le manifeste en dernier. Un manifeste construit avant ne pourrait
 * pas porter l'empreinte de fichiers qui n'existent pas encore, et un manifeste
 * inclus dans son propre hachage serait impossible à vérifier.
 */
export async function construireExport(options: OptionsExport = {}): Promise<Export> {
  const maintenant = options.maintenant ?? new Date();
  const { reglagesJourLogiqueLocaux } = await import('./adaptation');
  const reglages = await reglagesJourLogiqueLocaux();
  const ancre = options.ancre ?? jourLogique(maintenant, reglages);
  const p =
    options.de && options.a ? periodeLibre(options.de, options.a) : periode(options.type ?? 'mois', ancre);
  const portee: Portee = options.portee ?? { quoi: 'globale' };
  const categories = options.categories ?? categoriesParDefaut();

  /*
     LES BRANCHES QUE CET EXPORT A LE DROIT DE LIRE.
     
     Les quatre branches ordinaires toujours ; les deux branches sous coffre
     **seulement si leur case est cochée**. Sans ce filtre, Psyché et Finances
     entreraient dans la synthèse d'office — elles publient leurs faits comme
     les autres — et se retrouveraient dans le fichier produit sans que
     personne l'ait demandé. C'est très exactement ce que l'interdit 4
     proscrit : « rien ne sort sans mon geste ».
     
     Le filtre est posé ICI, au point de sortie, et non dans les écrans :
     c'est l'export qui fait sortir les données, c'est donc à lui de restreindre.
  */
  const sources = [
    'revisions',
    'odyssee',
    'corps',
    'sport',
    ...(categories.includes('psyche') ? ['psyche'] : []),
    ...(categories.includes('finances') ? ['finances'] : []),
  ];

  /*
     LA SECONDE BARRIÈRE, ET ELLE N'EST PAS REDONDANTE.

     La liste `sources` ci-dessus ne nomme pas « sensible », donc les
     traitements et le statut hormonal ne devraient pas arriver jusqu'ici.
     Le tamis de type les retire quand même, et pour une raison précise :
     la liste est une énumération que quelqu'un étendra un jour — en
     ajoutant une branche, en passant `sources` depuis un appelant, en
     réécrivant ce filtre. Le tamis, lui, ne dépend d'aucune énumération :
     il nomme les deux types que l'amendement signé interdit de faire
     sortir, et il tient quoi qu'on fasse au-dessus.

     Les deux barrières sont éprouvées **séparément** — le tamis dans
     `essais:jamais-partage`, la séparation des sources dans
     `essais:faits-branches-sensible`. Les tester l'une à travers l'autre
     ne prouverait que la première ; ce prompt l'a appris trois fois.
  */
  const brute = await rassembler(p, { maintenant, reglages, sources });
  const fenetre = { ...brute, faits: retirerCeQuiNeSortPas(brute.faits) };
  const vue = synthese(p, fenetre, portee);
  const avantPeriode = precedente(p);
  const avant = synthese(
    avantPeriode,
    await rassembler(avantPeriode, { maintenant, reglages, sources }),
    portee,
  );

  /* Les séries : celles des indicateurs mesurés, sauf demande contraire. */
  const voulues =
    options.series ?? vue.evaluations.filter((e) => e.mesure).map((e) => e.indicateur.id);
  const series: Serie[] = [];
  if (categories.includes('series')) {
    for (const id of voulues) {
      const indic = INDICATEURS.find((i) => i.id === id);
      if (!indic) continue;
      try {
        const points = await serieDe(id, p.de, p.a, { maintenant, reglages, sources });
        if (points.length) series.push({ indicateur: id, unite: indic.unite, points });
      } catch (erreur) {
        console.warn(`Série indisponible pour « ${id} » :`, erreur);
      }
    }
  }

  /* Le profil et les objectifs : seulement si la catégorie est cochée, et
     toujours sans prénom ni nom. */
  const { profil, objectifs, interdits } = await lireProfilPourExport(categories);
  const decisions = categories.includes('decisions') ? await lireDecisionsPourExport() : [];

  /*
     Les analyses précédentes (p24 § B.8.5), décochées par défaut.

     Elles permettent l'analyse en deux temps : une passe par domaine, puis
     une passe transversale qui relit les premières. On n'emporte **pas** le
     document d'analyse — il contient des phrases écrites par un modèle, et
     les recoller reviendrait à souffler ses conclusions au suivant. On
     emporte les constats et le verdict que **le site** leur a donné après
     recalcul : ce que nous avons établi de l'analyse, non ce qu'elle
     affirmait d'elle-même.
  */
  const analyses = categories.includes('analyses') ? await lireAnalysesPourExport() : [];

  const entrees = {
    synthese: vue,
    comparaisons: comparer(vue, avant),
    ...(series.length ? { series } : {}),
    ...(Object.keys(profil).length ? { profil } : {}),
    ...(Object.keys(objectifs).length ? { objectifs } : {}),
    ...(decisions.length ? { decisions } : {}),
    ...(analyses.length ? { analyses } : {}),
    vecteur: await vecteurDeVersions(),
    exportId: ulid(),
    genereLe: maintenant.toISOString(),
    pseudonyme: options.pseudonyme?.trim() || PSEUDONYME_PAR_DEFAUT,
    categories,
    /*
     * La version du schéma de la branche, et non un numéro de version du site :
     * c'est elle qui dit ce que les données savent porter, donc ce qu'une
     * analyse peut citer. Un numéro de version décoratif n'aiderait personne à
     * relire un export dans six mois.
     */
    versionSite: `schema-revisions-${SCHEMA_REVISIONS}`,
  };

  const fichiers = construire(entrees);
  const empreinte = await empreindre(fichiers);
  const complet: Manifeste = {
    ...manifeste(entrees),
    empreinte: `sha256:${empreinte}`,
    fichiers: fichiers.map((f) => ({
      nom: f.nom,
      octets: new TextEncoder().encode(f.contenu).length,
    })),
  };
  fichiers.push({
    nom: 'manifest.json',
    type: 'application/json;charset=utf-8',
    contenu: JSON.stringify(complet, null, 2),
  });

  const domaines = [...new Set(INDICATEURS.map((i) => i.domaine))];
  return {
    fichiers,
    manifeste: complet,
    estimation: estimer(fichiers, domaines),
    unique: fichierUnique(fichiers),
    problemes: controlerExport(fichiers, interdits),
  };
}

/**
 * L'empreinte de l'ensemble : les noms **et** les contenus, dans l'ordre.
 *
 * Les noms en font partie : deux exports dont les mêmes contenus porteraient
 * des noms différents ne sont pas le même export, et une empreinte qui ne
 * verrait que les contenus les confondrait.
 */
export async function empreindre(fichiers: readonly FichierExporte[]): Promise<string> {
  const ordonnes = [...fichiers].sort((a, b) => (a.nom < b.nom ? -1 : 1));
  const chaine = ordonnes.map((f) => `${f.nom}\n${f.contenu}`).join('\n\u0000\n');
  return sha256Hex(`cyclades-export:1\n${ordonnes.length}\n${chaine}`);
}

/**
 * Le profil retenu, et les mots qui ne doivent jamais sortir.
 *
 * Les mots interdits sont lus **même quand la catégorie profil est décochée** :
 * c'est tout l'intérêt du contrôle, qui cherche le prénom dans les textes
 * libres, où la personne peut s'être nommée elle-même.
 */
/** Les analyses conservées, réduites à ce qui se cite. */
async function lireAnalysesPourExport(): Promise<AnalysePrecedente[]> {
  const { analysesConservees } = await import('./import-analyse');
  return (await analysesConservees()).map((a) => ({
    id: a.id,
    periode: a.periode,
    importeeLe: a.importeeLe,
    etiquette: a.etiquette,
    constats: a.verifications.map((v) => ({ constat: v.constat, etat: v.etat })),
  }));
}

async function lireProfilPourExport(categories: readonly string[]) {
  const { profilLocal } = await import('./profil');
  const { repartirProfilPourExport } = await import('./noyau/profil');
  const champs = await profilLocal();
  const interdits: string[] = [];
  for (const nom of ['prenom', 'nom']) {
    const valeur = champs.get(nom)?.valeur;
    if (typeof valeur === 'string' && valeur.trim().length >= 3) interdits.push(valeur.trim());
  }

  /*
     CE QUI SORT, ET CE QUI NE SORT JAMAIS : la règle est dans le noyau.

     Elle y est pour deux raisons, et la seconde est la plus forte.

     D'abord parce qu'une règle pure s'éprouve sans base : on lui passe des
     champs, elle rend deux objets, et l'essai se lit en une ligne.

     Ensuite parce que ce module n'a PAS LE DROIT de nommer les trois champs
     de naissance. L'essai sur le graphe d'imports l'interdit à tout fichier
     hors d'une courte liste, et c'est cette interdiction qui rend vraie la
     promesse « pas de lecture silencieuse ». Un export qui les nommerait
     pour les exclure serait, pour ce contrôle, indistinguable d'un export
     qui les nomme pour les lire. Le catalogue les marque `jamaisExporte`,
     et ce module ne connaît qu'une liste de noms qu'il n'a pas écrite.

     U1 DU 43, ET LE DÉFAUT CORRIGÉ. Cette fonction n'écartait que le prénom
     et le nom. L'année de naissance, le mois et la majorité déclarée
     sortaient dès que la case « Profil » était cochée — alors que le
     registre des usages promet, mot pour mot, « L'année n'y figure
     jamais ». La promesse était fausse à la lettre, et la case ne les
     mentionnait pas : personne ne pouvait le voir à l'écran.
  */
  const { profil, objectifs } = repartirProfilPourExport(
    [...champs].map(([nom, valeur]) => [nom, valeur.valeur] as const),
    categories,
  );
  return { profil, objectifs, interdits };
}

async function lireDecisionsPourExport() {
  const { decisionsLocales } = await import('./adaptation');
  const { regleAdaptation } = await import('./noyau/adaptation');
  const decisions = await decisionsLocales();
  return [...decisions.values()]
    .filter((d) => d.issue !== 'remise')
    .map((d) => ({
      regle: d.regle,
      libelle: regleAdaptation(d.regle)?.libelle ?? d.regle,
      issue: d.issue,
      le: d.le,
    }));
}

/* ══════════════════════════════════════════════════════════════════════════
   Écrire
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inscrit l'export au journal. À appeler **après** que la personne l'a généré.
 *
 * Et pas avant : un export qu'on a construit pour l'aperçu, puis abandonné, n'a
 * jamais quitté la machine, et l'inscrire au journal ferait croire qu'il est
 * dehors.
 */
export async function noterExport(resultat: Export): Promise<EntreeJournalExport> {
  const entree = {
    exportId: resultat.manifeste.export_id,
    empreinte: resultat.manifeste.empreinte ?? '',
    genereLe: resultat.manifeste.genere_le,
    periode: resultat.manifeste.periode,
    portee: resultat.manifeste.portee,
    categories: resultat.manifeste.categories,
    octets: resultat.estimation.octets,
  };
  await inscrireAuJournal(entree);
  return { ...entree, appareil: await lireAppareil() };
}

export { CATEGORIES, CATEGORIES_SOUS_COFFRE, categoriesParDefaut };
export type { Estimation, FichierExporte, Manifeste, VecteurDeVersions };
