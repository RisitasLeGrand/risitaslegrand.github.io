/**
 * Chargement du contenu chiffré et mise en cache mémoire après déchiffrement.
 * Rien n'est jamais écrit en clair sur le disque : tout reste en mémoire vive
 * pour la durée de l'onglet.
 */
import { dechiffrerBinaire, dechiffrerJson, type Blob as BlobChiffre, type ParametresCle } from './crypto';
import { obtenirCle } from './auth';

export interface FicheResume {
  id: string;
  titre: string;
  ordre: number;
  tags: string[];
  /**
   * La racine de contenu d'où vient la fiche : `'dgfip-b'`, `'commun'`, ou
   * `''` pour l'INSP, dont les fiches sont à la racine de `content/`.
   *
   * Un fait du rangement, vérifiable contre le disque — à la différence des
   * parcours servis, qui en sont DÉDUITS par le registre.
   */
  racine?: string;
  /** La fiche est-elle servie à plus d'un parcours ? Déduit de `parcoursServis`. */
  partagee?: boolean;
  /**
   * Les parcours auxquels cette fiche est servie.
   *
   * Écrit par le build depuis `parcoursDuChemin(relatif)`. Au pluriel, parce
   * qu'une fiche de `content/commun/` en sert trois : élire un parcours aurait
   * obligé à mentir sur les deux autres.
   *
   * **Facultatif, et son absence ne veut pas dire « aucun ».** Un manifeste
   * construit avant que le champ existe n'en porte pas, et refuser alors de
   * servir la fiche viderait l'écran de qui n'a pas reconstruit. Son absence se
   * lit donc « on ne sait pas », et la fiche passe — c'est la convention des
   * autres champs facultatifs de ce type (`nbParties`, `aPretest`).
   */
  parcoursServis?: string[];
  nbFlashcards: number;
  nbQuiz: number;
  nbMots: number;
  aCours: boolean;
  aFiche: boolean;
  /** Une fiche audio a-t-elle été synthétisée pour cette fiche ? */
  aPodcast?: boolean;
  /**
   * La fiche propose-t-elle un prétest ? Annoncé par le manifeste pour que la
   * séance n'ait pas à déchiffrer une fiche entière afin de le découvrir.
   */
  aPretest?: boolean;
  /**
   * Combien de parties la fiche compte — et non lesquelles (prompt 46, P5).
   *
   * De quoi savoir s'il y a un choix de parties à proposer au lancement
   * d'une séance, sans ouvrir la fiche. Les TITRES, eux, restent dans la
   * charge utile de la fiche : l'interdit 2 du prompt 46 en fait du contenu
   * de fiche, et le manifeste est chargé en entier par presque chaque écran.
   *
   * Absent d'un manifeste construit avant ce prompt : son absence se lit
   * « aucun choix de partie à proposer ».
   */
  nbParties?: number;
}

export interface Fascicule {
  id: string;
  nom: string;
  fiches: FicheResume[];
}

export interface Matiere {
  id: string;
  nom: string;
  fascicules: Fascicule[];
}

export interface ParametresPublics extends ParametresCle {
  /** Identifiant de la publication, utilisé pour versionner les URL. */
  version?: string;
}

export interface Manifeste {
  genereLe: string;
  matieres: Matiere[];
  totaux: {
    fiches: number;
    flashcards: number;
    quiz: number;
    termesGlossaire: number;
    podcasts?: number;
    qcmDgfip?: number;
  };
  /** Rubriques de la banque « QCM - DGFiP », absentes si la banque est vide. */
  rubriquesDgfip?: RubriqueDgfip[];
}

export interface Flashcard {
  id: string;
  question: string;
  reponse: string;
  /**
   * La partie de la fiche dont elle relève (prompt 46, P4). Facultative :
   * son absence veut dire « la fiche entière », ce qui est le cas de tout
   * ce qui a été écrit avant — et le restera tant qu'une lecture humaine
   * n'aura pas tranché, le rattachement ne se devinant pas.
   */
  partie?: string;
}

/**
 * La correction détaillée d'une question de QCM, telle que la banque la porte.
 *
 * Contrairement à celle des exercices de Cog-Training, qu'un solveur calcule,
 * celle-ci est **rédigée et stockée** : la question vient d'une banque, il n'y a
 * pas de dérivation à produire. Elle voyage donc dans le contenu chiffré, avec
 * la question, et n'exige aucun chargement supplémentaire.
 *
 * Le miroir de `correctionSchema`, qui la valide au build.
 */
export interface Correction {
  resume: string;
  par_option: { verdict: 'juste' | 'faux'; pourquoi: string }[];
  detail: string;
  /**
   * Les fiches à relire, **résolues au build**.
   *
   * Le contenu les écrit par chemin ; le build les remplace par l'identifiant
   * de la fiche et son titre, et refuse un chemin qui ne désigne rien. Le site
   * reçoit donc de quoi fabriquer un lien et de quoi le nommer — un condensat
   * de chemin ne serait affichable ni l'un ni l'autre.
   */
  rappel_de_cours: { id: string; titre: string }[];
  sources: { nom: string; url?: string }[];
  confiance: 'haute' | 'moyenne';
  visuel: {
    type: string;
    donnees?: unknown;
    legende?: string;
    alt?: string;
    raison_aucun?: string;
  };
}

export interface QuestionQuiz {
  id: string;
  question: string;
  options: string[];
  bonnes: number[];
  explication?: string;
  correction?: Correction;
  /** La partie de la fiche dont elle relève (prompt 46, P4), s'il y en a une. */
  partie?: string;
}

export interface Fiche {
  id: string;
  titre: string;
  matiere: string;
  fascicule: string;
  tags: string[];
  coursHtml: string;
  ficheHtml: string;
  sommaire: { niveau: number; id: string; titre: string }[];
  /**
   * Les parties de la fiche : un titre de niveau 2 ou 3 du cours, avec son
   * identifiant **stable** (prompt 46, P1). `declare` dit si cet identifiant
   * est écrit dans le Markdown ou seulement dérivé du titre — dans le second
   * cas, il changera si le titre est corrigé, et c'est ce que la transition
   * doit finir de supprimer.
   *
   * Facultatif : une fiche construite avant le prompt 46 n'en a pas, et son
   * absence veut dire « on ne sait pas découper cette fiche ».
   */
  parties?: { niveau: number; id: string; titre: string; declare: boolean }[];
  flashcards: Flashcard[];
  quiz: QuestionQuiz[];
  /**
   * Questions posées **avant** la première lecture du cours. Facultatif : les
   * fiches écrites avant la phase 10b n'en ont pas.
   */
  pretest?: QuestionQuiz[];
  /** Durée, poids et format de la fiche audio, connus avant de la télécharger. */
  podcast: {
    secondes: number | null;
    octets: number;
    type: string;
    /**
     * Où commence chaque partie dans la fiche audio, en secondes depuis le
     * début (prompt 46, P2). `id` est l'identifiant stable de la partie,
     * celui que porte aussi `Fiche.parties`.
     *
     * Facultatif, et son absence se lit « on ne sait pas découper cet
     * audio » : une fiche synthétisée avant le prompt 46 n'en a pas, et
     * s'écoute d'un bloc, exactement comme auparavant.
     */
    parties?: { id: string; debut: number }[];
  } | null;
}

export interface RubriqueDgfip {
  id: string;
  nom: string;
  ordre: number;
  total: number;
}

/** Les cinq natures du prompt 20 (§ 3). Voir « scripts/lib/schema.mjs ». */
export type NatureQcm =
  | 'intemporelle'
  | 'historique'
  | 'actuelle'
  | 'passee-non-historique'
  | 'a-venir';

export interface Temporalite {
  nature: NatureQcm;
  /** Jour auquel la réponse est vraie (natures « actuelle » et « a-venir »). */
  date_de_reference?: string;
  /** Jour où rouvrir la question. Avertit à la construction, ne bloque pas. */
  a_reverifier_le?: string;
  /** Jour après lequel la question ne doit plus être servie. */
  expire_le?: string;
}

export interface QuestionDgfip {
  id: string;
  rubrique: string;
  rubriqueId: string;
  question: string;
  options: string[];
  bonnes: number[];
  explication: string;
  /** Annale d'origine, ou mention de rédaction maison. */
  source?: string;
  /**
   * D'où vient la question, et donc dans quels parcours elle est tirée.
   *
   * « maison » n'était pas prévu par le prompt 20, qui annonçait `A | B`. La
   * banque en a démenti la prémisse : 153 questions sur 540 ne viennent
   * d'aucune annale. Leur écrire « B » aurait faussé le tirage de DGFiP B au
   * profit de questions que la DGFiP n'a jamais posées.
   */
  categorie_origine: 'A' | 'B' | 'maison';
  /** La temporalité de la réponse. Absente : la question n'est pas étiquetée. */
  temporalite?: Temporalite;
  /** Présent quand la bonne réponse ne peut pas être garantie. */
  incertain?: string;
  correction?: Correction;
}

export interface BanqueDgfip {
  rubriques: RubriqueDgfip[];
  questions: QuestionDgfip[];
}

export interface TermeGlossaire {
  id: string;
  terme: string;
  definition: string;
}

export interface EntreeRecherche {
  id: string;
  titre: string;
  matiere: string;
  fascicule: string;
  tags: string[];
  texte: string;
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const urlData = (chemin: string) => `${base}/data/${chemin}`;

const cache = new Map<string, unknown>();

let promesseParametres: Promise<ParametresPublics> | null = null;

/**
 * Charge les paramètres publics de chiffrement.
 * Toujours revalidé auprès du serveur : c'est ce fichier qui porte le numéro
 * de publication dont dépendent toutes les autres URL.
 */
/**
 * La copie de secours des paramètres publics — M8, deuxième cause.
 *
 * `cle.json` n'est jamais mis en cache par le service worker, et c'est
 * voulu : c'est lui qui porte le numéro de publication, donc la preuve de sa
 * propre fraîcheur. Le cacher reviendrait à mémoriser cette preuve, et à
 * resservir indéfiniment une version périmée.
 *
 * Mais hors ligne, ce refus coûtait tout : la lecture échouait, et l'échec
 * remontait jusqu'à `obtenirCle`, qui en concluait que la clé mémorisée
 * était périmée et l'effaçait. Passer en mode avion faisait donc perdre sa
 * session — et il fallait retaper le mot de passe au retour du réseau.
 *
 * La page garde donc sa propre copie, qui ne change rien au contrat du
 * worker : **le réseau est toujours essayé en premier**, et la copie ne
 * sert que lorsqu'il ne répond pas. Une publication nouvelle est donc
 * toujours vue dès qu'on est en ligne.
 *
 * Ce que cette copie contient n'est pas un secret : `cle.json` est servi en
 * clair par le site à qui le demande. Elle porte le sel, le nombre
 * d'itérations, la version et le témoin chiffré — tout ce que le visiteur
 * reçoit déjà. Elle ne contient ni clé, ni mot de passe.
 */
const CLE_SECOURS = 'cyclades.parametres-publics';

function garderLesParametres(p: ParametresPublics): void {
  try {
    localStorage.setItem(CLE_SECOURS, JSON.stringify(p));
  } catch {
    /* Navigation privée, quota : on s'en passe. */
  }
}

function parametresDeSecours(): ParametresPublics | null {
  try {
    const brut = localStorage.getItem(CLE_SECOURS);
    return brut ? (JSON.parse(brut) as ParametresPublics) : null;
  } catch {
    return null;
  }
}

export function chargerParametresCle(): Promise<ParametresPublics> {
  promesseParametres ??= (async () => {
    try {
      const reponse = await fetch(urlData('cle.json'), { cache: 'no-cache' });
      if (!reponse.ok) throw new Error('Paramètres de chiffrement introuvables (data/cle.json).');
      const params = (await reponse.json()) as ParametresPublics;
      garderLesParametres(params);
      return params;
    } catch (erreur) {
      const secours = parametresDeSecours();
      if (secours) return secours;
      throw erreur;
    }
  })().catch((erreur) => {
    promesseParametres = null; // un échec réseau ne doit pas être mémorisé
    throw erreur;
  });
  return promesseParametres;
}

/** Récupère un fichier chiffré et le déchiffre, avec cache mémoire. */
async function charger<T>(chemin: string): Promise<T> {
  if (cache.has(chemin)) return cache.get(chemin) as T;

  const cle = await obtenirCle();
  if (!cle) throw new Error('Session verrouillée.');

  // La version en paramètre d'URL garantit qu'un fichier mis en cache par une
  // publication précédente n'est jamais resservi : il aurait été chiffré avec
  // une autre clé et serait illisible.
  const { version } = await chargerParametresCle();
  const url = version ? `${urlData(chemin)}?v=${encodeURIComponent(version)}` : urlData(chemin);

  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Contenu introuvable : ${chemin}`);
  const blob: BlobChiffre = await reponse.json();

  let valeur: T;
  try {
    valeur = await dechiffrerJson<T>(cle, blob);
  } catch {
    // Seul cas plausible : le fichier vient d'une autre publication que la clé.
    throw new Error(
      'Ce contenu ne correspond pas à la clé de la session. ' +
        'Le site a été republié entre-temps : rechargez la page (Ctrl+Maj+R), ' +
        'puis ressaisissez le mot de passe si besoin.',
    );
  }

  cache.set(chemin, valeur);
  return valeur;
}

/**
 * Récupère un fichier chiffré binaire (fiche audio) et le déchiffre.
 *
 * Volontairement hors du cache mémoire : un podcast pèse plusieurs
 * mégaoctets, les garder tous ouverts remplirait l'onglet pour rien.
 */
export async function chargerBinaire(chemin: string): Promise<ArrayBuffer> {
  const cle = await obtenirCle();
  if (!cle) throw new Error('Session verrouillée.');

  const { version } = await chargerParametresCle();
  const url = version ? `${urlData(chemin)}?v=${encodeURIComponent(version)}` : urlData(chemin);

  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Contenu introuvable : ${chemin}`);
  try {
    return await dechiffrerBinaire(cle, await reponse.arrayBuffer());
  } catch {
    throw new Error(
      'Ce contenu ne correspond pas à la clé de la session. ' +
        'Le site a été republié entre-temps : rechargez la page (Ctrl+Maj+R).',
    );
  }
}

/**
 * Une référence de la copie figée de la bibliographie (NooTopics).
 *
 * Les champs numériques sont des **index** dans les tables du même paquet :
 * un thème ou un portail répété vingt-cinq mille fois en toutes lettres
 * pèserait plus que tout le reste.
 */
export interface ReferenceBibliographie {
  titre: string;
  url: string;
  /** Index dans `themes`, ou null. */
  theme: number | null;
  /** Index dans `sousThemes[theme]`. */
  sousThemes: number[];
  /** Date d'ajout à la bibliothèque, « AAAA-MM-JJ ». */
  ajouteLe: string;
  /** Index dans `portails`. */
  portail: number | null;
  /** Index dans `typesEtude`. */
  typeEtude: number | null;
  /** PMID, DOI… tel que la source l'écrit. */
  identifiant: string;
  /** Index dans `composes`. */
  composes: number[];
  annee: number | null;
  revue: string;
}

export interface Bibliographie {
  genereLe: string;
  attribution: string;
  premierPartage: string;
  dernierPartage: string;
  /** Paires « grand thème / sous-thème ». */
  themes: [string, string][];
  sousThemes: Record<string, string[]>;
  portails: string[];
  typesEtude: string[];
  composes: string[];
  references: ReferenceBibliographie[];
}

let bibliographie: Promise<Bibliographie> | null = null;

/**
 * La copie figée de la bibliographie, déchiffrée puis décompressée.
 *
 * **Chargée une seule fois, et seulement si on ouvre l'écran.** Le paquet
 * pèse 1,76 Mo sur le réseau et huit fois plus une fois décompressé : le
 * charger au démarrage du site ferait payer à chaque visite une donnée qu'on
 * consulte rarement. La promesse est mémorisée, pas le résultat d'un premier
 * échec — une panne de réseau ne doit pas condamner l'écran pour la durée de
 * l'onglet.
 */
export function chargerBibliographie(): Promise<Bibliographie> {
  bibliographie ??= (async () => {
    const { decomprimer, compressionDisponible } = await import('./noyau/octets');
    if (!compressionDisponible()) {
      throw new Error(
        'Ce navigateur ne sait pas décompresser le paquet (DecompressionStream absent). ' +
          'La bibliographie hors ligne demande un navigateur plus récent.',
      );
    }
    const chiffre = await chargerBinaire('bibliographie.bin');
    const clair = await decomprimer(new Uint8Array(chiffre));
    return JSON.parse(new TextDecoder().decode(clair)) as Bibliographie;
  })().catch((e) => {
    bibliographie = null;
    throw e;
  });
  return bibliographie;
}

export const chargerManifeste = () => charger<Manifeste>('manifeste.json');
export const chargerFiche = (id: string) => charger<Fiche>(`fiches/${id}.json`);

/**
 * L'URL exacte d'une fiche chiffrée, version comprise.
 *
 * Elle existe pour le cache hors ligne (D-025), qui doit garder **la même
 * URL** que celle que `charger` demandera ensuite : garder une fiche sans son
 * paramètre de version reviendrait à garder un fichier qu'une publication
 * suivante rendrait illisible, sans qu'on puisse distinguer les deux.
 */
export async function urlDeLaFiche(id: string): Promise<string> {
  const { version } = await chargerParametresCle();
  const url = urlData(`fiches/${id}.json`);
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}
export const chargerGlossaire = () => charger<TermeGlossaire[]>('glossaire.json');
export const chargerIndexRecherche = () => charger<EntreeRecherche[]>('recherche.json');
export const chargerBanqueDgfip = () => charger<BanqueDgfip>('qcm-dgfip.json');

/**
 * Le registre des noms de molécules du menu de déclaration (2.8).
 *
 * Absent tant que « npm run molecules:registre » n'a pas été lancé, et c'est
 * un état normal, pas une panne : le menu retombe alors sur le catalogue de
 * Cyclades et le dit. Le registre ne porte que des noms — aucun champ ne dit
 * d'où ils viennent, et aucun module d'analyse ne le lit.
 */
export const chargerRegistreMolecules = () =>
  charger<
    {
      id: string;
      nom: string;
      alias: string[];
      nomenclature: string | null;
      fiche: boolean;
      identiteVerifiee: boolean;
    }[]
  >('molecules.json');

/**
 * Clé privée de la rubrique Actualités, publiée chiffrée par le build.
 * Absente si « npm run actualites:cles » n'a jamais été lancé : la rubrique
 * reste alors simplement masquée.
 */
export const chargerCleActualites = () =>
  charger<{ empreinte: string; privee: JsonWebKey }>('actualites-cle.json');

/** Vide le cache mémoire (au verrouillage de la session). */
export function viderCache() {
  cache.clear();
  promesseParametres = null;
}

/** Liste à plat de toutes les fiches, avec leur matière et leur fascicule. */
export function aplatirFiches(manifeste: Manifeste) {
  return manifeste.matieres.flatMap((m) =>
    m.fascicules.flatMap((f) =>
      f.fiches.map((fiche) => ({
        ...fiche,
        matiere: m.nom,
        matiereId: m.id,
        fascicule: f.nom,
        fasciculeId: f.id,
      })),
    ),
  );
}

export type FicheAplatie = ReturnType<typeof aplatirFiches>[number];

/*
   Les étiquettes qui désignent un contenu écarté (matière de cas pratique, tag
   de méthodologie) vivent dans « contenu-ecarte.ts » : ce module-ci tire le
   chargement chiffré et l'environnement Astro derrière lui, et l'estimation de
   niveau a besoin des étiquettes sans avoir besoin de tout cela. Réexportées
   ici pour que l'import reste naturel depuis le contenu.
*/
export {
  estMethodologique,
  MATIERE_CAS_PRATIQUE,
  TAG_METHODOLOGIE,
} from './contenu-ecarte';
