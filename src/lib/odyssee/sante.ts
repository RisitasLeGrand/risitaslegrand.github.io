/**
 * Santé et traitements : la **forme**, et seulement la forme.
 *
 * Phase 1 du plan `docs/cyclades/sante-musculation/plan.md`, livrée sous la
 * ligne `D-024` de l'audit, dont la réponse est : « Construire la forme
 * maintenant, chaque valeur "inconnue" avec un bandeau qui le dit. »
 *
 * ## Pourquoi la forme sans les valeurs
 *
 * Les demi-vies, les niveaux d'interaction et les limites de sécurité sont
 * bloqués sur des sources que ce conteneur ne peut pas atteindre
 * (`docs/cyclades/acces-sources.md`). Le plan a tranché, et le prompt avant
 * lui : **une valeur inventée coûterait plus cher qu'une case vide.** Le
 * modèle est donc écrit de sorte qu'une valeur non sourcée ne puisse pas
 * entrer discrètement — elle ne peut entrer que comme « inconnue », avec la
 * raison de son absence.
 *
 * ## Ce que ce module ne fait pas, et ne fera pas
 *
 * Il reprend l'interdit de `sensible.ts`, parce qu'il l'élargit sans le
 * lever : **enregistrement seul.** Aucune posologie proposée, aucune dose
 * calculée, aucun rappel d'oubli, aucune courbe de concentration projetée —
 * la décision 3.2 du plan le dit : « une courbe projetée à partir des doses
 * déclarées **est** un outil de planification de dose, quel que soit
 * l'avertissement qui l'accompagne ».
 *
 * Ce qui est rendu à la place, quand les sources arriveront : la demi-vie de
 * référence **sourcée**, le délai écoulé depuis la dernière administration,
 * et la frise des prises et des résultats. Trois faits, aucune extrapolation.
 * Le délai écoulé est le seul des trois que ce module calcule aujourd'hui,
 * parce qu'il ne demande aucune source : c'est une soustraction entre deux
 * instants que la personne a elle-même saisis.
 */

/*
   Le seul import de ce module. `sante.ts` était un module feuille ; il
   emprunte au noyau le type de la population visée et la fabrique de son
   absence, parce que le § 3.3 du prompt du cycle demande qu'un repère
   sourcé porte à qui il s'applique — et qu'une seconde définition de cette
   notion, ici, se désynchroniserait de celle du noyau.
*/
import { populationNonLue, type PopulationVisee } from '../noyau/population';

/* ══════════════════════════════════════════════════════════════════════════
   La valeur sourcée, ou pas
   ══════════════════════════════════════════════════════════════════════════ */

export interface Source {
  /** Le nom de la source, tel qu'on le citerait : « RCP Androtardyl », « ANSM ». */
  nom: string;
  /** L'URL exacte, ou le chemin du fichier déposé. */
  ou: string;
  /** La date de consultation, en ISO court. */
  le: string;
  /** L'empreinte SHA-256 du document retenu, quand il a été conservé. */
  empreinte?: string;
  /**
   * À qui ce document s'applique, ou pourquoi on ne le sait pas.
   *
   * **Obligatoire**, et c'est la même raison qui rend `ValeurSourcee` une
   * union : avec un champ facultatif, on peut citer une source sans dire
   * qui elle vise, et rien ne s'en aperçoit avant l'écran — où le repère
   * s'affiche comme s'il concernait tout le monde. Le § 3.3 du prompt du
   * cycle demande l'inverse : un repère sourcé porte sa population.
   *
   * `populationNonLue(...)` est la réponse honnête quand le document
   * n'a pas été relu pour cela, et c'est aujourd'hui le cas de tous.
   */
  populationVisee: PopulationVisee;
}

/**
 * Une valeur qui ne peut pas exister sans dire d'où elle vient.
 *
 * Le type est une **union**, pas un objet à champ facultatif. La différence
 * est tout l'intérêt : avec `{ valeur?: T; source?: Source }`, on peut écrire
 * une valeur sans source, et rien ne s'en aperçoit avant l'écran. Ici, le
 * compilateur refuse — il n'existe aucune manière d'en construire une qui
 * porte un nombre et pas de source.
 */
export type ValeurSourcee<T> =
  | { readonly connue: true; valeur: T; source: Source }
  | { readonly connue: false; pourquoi: string };

export const inconnue = (pourquoi: string): ValeurSourcee<never> => ({ connue: false, pourquoi });

export const sourcee = <T>(valeur: T, source: Source): ValeurSourcee<T> => ({
  connue: true,
  valeur,
  source,
});

/**
 * Ce qu'un écran affiche d'une valeur, sans jamais avoir à choisir lui-même.
 *
 * Rendre « — » pour une valeur inconnue serait une perte : « — » veut dire
 * « rien à dire », et ici il y a quelque chose à dire, à savoir pourquoi on
 * ne sait pas. Le bandeau n'est pas une décoration, c'est le contenu.
 */
export interface Affichage {
  texte: string;
  /** Vrai quand l'écran doit poser son bandeau « valeur non sourcée ». */
  bandeau: boolean;
  /** La phrase du bandeau, ou la citation de la source. */
  precision: string;
}

export function afficher<T>(v: ValeurSourcee<T>, rendu: (valeur: T) => string): Affichage {
  if (!v.connue) {
    return {
      texte: 'inconnue',
      bandeau: true,
      precision: v.pourquoi,
    };
  }
  return {
    texte: rendu(v.valeur),
    bandeau: false,
    precision: `${v.source.nom}, consulté le ${v.source.le}`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le catalogue des molécules — la fiche, pas encore son contenu
   ══════════════════════════════════════════════════════════════════════════ */

/** Ce que l'on sait de la maturité clinique d'une molécule. */
export type MaturiteClinique =
  | 'autorisee'
  | 'essais-humains'
  | 'precliniques-seuls'
  | 'inconnue';

export const MATURITES: Record<MaturiteClinique, string> = {
  autorisee: 'Autorisée, avec un RCP',
  'essais-humains': 'Essais humains publiés',
  'precliniques-seuls': 'Travaux précliniques seulement',
  inconnue: 'Maturité inconnue',
};

export type StatutAntidopage = 'interdit' | 'interdit-en-competition' | 'autorise' | 'inconnu';

export const STATUTS_ANTIDOPAGE: Record<StatutAntidopage, string> = {
  interdit: 'Interdit',
  'interdit-en-competition': 'Interdit en compétition',
  autorise: 'Non listé',
  inconnu: 'Statut inconnu',
};

/**
 * Une fiche de molécule.
 *
 * Les quatre champs qui portent une valeur — demi-vie, maturité, données
 * humaines, statut antidopage — passent tous par `ValeurSourcee`. C'est la
 * règle du lot : « je ne promets pas de sourcer les dix-neuf ; je promets
 * qu'**aucune valeur non sourcée n'entrera**, et que le registre dira pour
 * chacune où j'en suis ».
 */
export interface FicheMolecule {
  id: string;
  nom: string;
  /** Les autres noms sous lesquels on la rencontre. */
  synonymes: readonly string[];
  demiVie: ValeurSourcee<string>;
  maturite: ValeurSourcee<MaturiteClinique>;
  donneesHumaines: ValeurSourcee<boolean>;
  antidopage: ValeurSourcee<StatutAntidopage>;
}

export function controlerFiche(f: FicheMolecule): string[] {
  const problemes: string[] = [];
  if (!f.id.trim()) problemes.push('Une fiche a besoin d’un identifiant.');
  if (!f.nom.trim()) problemes.push('Une fiche a besoin d’un nom.');
  /*
     Une valeur déclarée connue sans source n'est pas constructible en
     TypeScript, mais une fiche peut venir d'un fichier JSON que le
     compilateur n'a jamais vu. Le contrôle est donc refait ici, et c'est le
     seul endroit où il peut l'être.
  */
  for (const [champ, v] of Object.entries({
    'demi-vie': f.demiVie,
    maturité: f.maturite,
    'données humaines': f.donneesHumaines,
    antidopage: f.antidopage,
  }) as [string, ValeurSourcee<unknown>][]) {
    if (v.connue && !v.source?.ou?.trim()) {
      problemes.push(`La ${champ} de « ${f.nom} » se dit connue sans dire d’où elle vient.`);
    }
    if (!v.connue && !v.pourquoi.trim()) {
      problemes.push(`La ${champ} de « ${f.nom} » est inconnue sans dire pourquoi.`);
    }
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le premier lot du catalogue — phase 2, 16 octobre 2026

   **Le blocage est levé, et il l'était depuis deux jours sans que ce
   fichier le sache.** L'en-tête disait que la phase 2 attendait les RCP et
   le Thésaurus ; ils sont arrivés le 14 octobre dans la collecte du
   pilote, rangée hors du dépôt public. Cinq RCP exploitables s'y
   trouvaient, et le Thésaurus de septembre 2023 avec ses deux index.

   **Chaque valeur ci-dessous a été lue dans le PDF**, pas rappelée de
   mémoire : le texte est extrait du fichier déposé, l'empreinte SHA-256
   est celle du fichier lu, et la phrase citée se retrouve dans le
   document. C'est la règle apprise sur les échelles de la psyché, où
   trois relevés confiés à des modèles externes avaient été rejetés — deux
   donnaient huit items faux sur neuf en ayant l'air parfaitement
   plausibles.

   ## Ce que ces cinq fiches apprennent, et qui vaut pour les suivantes

   - **Une demi-vie n'existe pas seule.** L'énantate en a deux dans le même
     RCP — 4,5 jours pour la libération de l'ester, 7,8 jours pour les
     métabolites — et l'undécanoate aussi, 90 ± 40 jours pour le dépôt
     contre environ une heure pour la testostérone elle-même. Écrire un
     seul nombre sans dire duquel on parle serait faux tout en étant
     exact. Le champ est une chaîne : il porte donc la précision.
   - **Une valeur juste peut tromper par sa population.** Le seul RCP de
     caféine de la collecte est un citrate pour l'apnée du **nouveau-né**,
     et ses 36 à 144 heures ne décrivent pas un adulte. La fiche le dit
     dans la valeur même, plutôt que de laisser l'écran le supposer.
   - **Un RCP peut ne pas répondre.** Celui de la N-acétylcystéine ne
     mentionne aucune demi-vie. C'est un `inconnue` **constaté**, pas
     supposé, et c'est la seule espèce d'inconnue qui vaille.
   - **Le statut antidopage reste inconnu pour les cinq.** La liste des
     interdictions de l'AMA n'est pas dans la collecte : c'est le point
     2.4 des sources à atteindre, et aucun RCP ne la remplace. Les
     déduire du bon sens — « un stéroïde anabolisant, voyons » — serait
     exactement la valeur inventée que ce module empêche.
   ══════════════════════════════════════════════════════════════════════════ */

/** Le dossier de dépôt, hors du dépôt public. Cité pour que la source se retrouve. */
const COLLECTE =
  'sources/collecte-pilote-2026-10-14/documents/collecte-01-sante-D2-D8-D9-E1-E2-E3-G1-G2';

/** Le jour où j'ai lu ces PDF et calculé leurs empreintes. */
const LU_LE = '2026-10-16';

/**
 * La raison, la même pour les cinq RCP.
 *
 * Un RCP dit à qui le médicament est indiqué — c'est sa section 4.1 — et
 * cette phrase est donc **lisible**, contrairement aux demi-vies, qui
 * demanderaient une lecture pharmacocinétique. Mais les PDF sont dans
 * `sources/`, hors du dépôt public et absents de ce conteneur : personne ne
 * les a relus pour cela. Déduire la population de l'intitulé du médicament
 * serait l'inventer, exactement comme le statut antidopage.
 */
const POPULATION_NON_RELUE =
  'les RCP sont dans la collecte déposée hors du dépôt, et aucun n’a été relu pour sa ' +
  'section 4.1 — celle qui dit à qui le médicament est indiqué.';

const rcp = (nom: string, fichier: string, empreinte: string): Source => ({
  nom,
  ou: `${COLLECTE}/${fichier}`,
  le: LU_LE,
  empreinte,
  populationVisee: populationNonLue(POPULATION_NON_RELUE),
});

/**
 * Pourquoi le statut antidopage est inconnu partout, et le restera tant que
 * la liste n'aura pas été déposée. Une constante, pour que la raison soit la
 * même sur chaque fiche — cinq formulations voisines finiraient par se
 * contredire sur le motif.
 */
const SANS_LISTE_ANTIDOPAGE =
  'La liste des interdictions de l’AMA n’est pas dans la collecte — point 2.4 des ' +
  'sources à atteindre. Aucun RCP ne la remplace, et la déduire serait l’inventer.';

const SOURCE_ANDROTARDYL = rcp(
  'RCP Androtardyl (testostérone énantate)',
  'E1-rcp-testosterone-enantate-androtardyl.pdf',
  '9a38f64c4f3f5c718f4229f9f517f5bb7e09a93fea005a7d75e281d018fb5747',
);
const SOURCE_NEBIDO = rcp(
  'RCP Nebido (testostérone undécanoate)',
  'E1-rcp-testosterone-undecanoate-nebido.pdf',
  'dc1123e4b627adf35ce6c543ad5ccb3a6de701582fc413ab3181fb6ca51c382c',
);
const SOURCE_MODIODAL = rcp(
  'RCP Modiodal (modafinil)',
  'E1-rcp-modafinil-modiodal.pdf',
  'afc15aaca04eb561d05a0c3b91df26de43ec762e7654fce5722cec54cded7a7f',
);
const SOURCE_FLUIMUCIL = rcp(
  'RCP Fluimucil 600 (N-acétylcystéine)',
  'E1-rcp-n-acetylcysteine-fluimucil-600.pdf',
  '641bc623c22fe26ea88aa23c179802a9e807a0cc3db8e6110e891e5779327bf0',
);
const SOURCE_CAFEINE = rcp(
  'RCP citrate de caféine Cooper',
  'E1-rcp-cafeine-citrate-de-cafeine-cooper.pdf',
  '3b932cf72729ba80254e35984bb4bac52a9f5844aee03a762a81d08291c8c432',
);

/**
 * Le catalogue. Cinq fiches, et dix-neuf molécules visées.
 *
 * Les quatorze autres n'y sont pas parce que leur source n'est pas arrivée,
 * et non parce que je les aurais oubliées : le plan nomme déjà les neuf dont
 * la demi-vie restera « inconnue » faute de source primaire atteignable.
 * Une fiche absente se voit ; une fiche présente et creuse se croit.
 */
export const CATALOGUE: readonly FicheMolecule[] = [
  {
    id: 'testosterone-enantate',
    nom: 'Testostérone énantate',
    synonymes: ['Androtardyl', 'énanthate de testostérone'],
    /*
       Deux demi-vies dans le même RCP, et la fiche porte les deux. Garder
       la seule plus courte ferait croire à une sortie rapide ; garder la
       seule plus longue, à une rémanence du produit actif.
    */
    demiVie: sourcee(
      'environ 4,5 jours pour la libération de l’ester et la décroissance de la ' +
        'testostérone plasmatique ; 7,8 jours pour l’élimination des métabolites',
      SOURCE_ANDROTARDYL,
    ),
    maturite: sourcee('autorisee', SOURCE_ANDROTARDYL),
    donneesHumaines: sourcee(true, SOURCE_ANDROTARDYL),
    antidopage: inconnue(SANS_LISTE_ANTIDOPAGE),
  },
  {
    id: 'testosterone-undecanoate',
    nom: 'Testostérone undécanoate',
    synonymes: ['Nebido', 'undécanoate de testostérone'],
    demiVie: sourcee(
      'environ 90 ± 40 jours pour le dépôt intramusculaire ; environ une heure pour ' +
        'l’élimination de la testostérone elle-même, mesurée chez des hommes âgés',
      SOURCE_NEBIDO,
    ),
    maturite: sourcee('autorisee', SOURCE_NEBIDO),
    donneesHumaines: sourcee(true, SOURCE_NEBIDO),
    antidopage: inconnue(SANS_LISTE_ANTIDOPAGE),
  },
  {
    id: 'modafinil',
    nom: 'Modafinil',
    synonymes: ['Modiodal'],
    demiVie: sourcee(
      'environ 15 heures — demi-vie d’élimination efficace après doses multiples, chez l’adulte',
      SOURCE_MODIODAL,
    ),
    maturite: sourcee('autorisee', SOURCE_MODIODAL),
    donneesHumaines: sourcee(true, SOURCE_MODIODAL),
    antidopage: inconnue(SANS_LISTE_ANTIDOPAGE),
  },
  {
    id: 'n-acetylcysteine',
    nom: 'N-acétylcystéine',
    synonymes: ['NAC', 'Fluimucil'],
    /*
       Constaté, pas supposé : le RCP déposé ne porte aucune mention de
       demi-vie. La recherche a été faite sur le texte entier du PDF.
    */
    demiVie: inconnue(
      'Le RCP de Fluimucil 600 déposé dans la collecte ne mentionne aucune demi-vie. ' +
        'Une autre source serait nécessaire ; elle n’est pas arrivée.',
    ),
    maturite: sourcee('autorisee', SOURCE_FLUIMUCIL),
    donneesHumaines: sourcee(true, SOURCE_FLUIMUCIL),
    antidopage: inconnue(SANS_LISTE_ANTIDOPAGE),
  },
  {
    id: 'cafeine',
    nom: 'Caféine',
    synonymes: ['citrate de caféine'],
    /*
       La valeur est juste et ne décrit pas un adulte : le seul RCP de
       caféine de la collecte est un citrate pour l’apnée du nouveau-né.
       La population entre donc DANS la valeur, où personne ne peut la
       manquer, plutôt qu’en note de bas de page.
    */
    demiVie: sourcee(
      'de 36 à 144 heures **chez le nouveau-né** — le seul RCP déposé est un citrate ' +
        'pour l’apnée du prématuré, et cette valeur ne décrit pas un adulte',
      SOURCE_CAFEINE,
    ),
    maturite: sourcee('autorisee', SOURCE_CAFEINE),
    donneesHumaines: sourcee(true, SOURCE_CAFEINE),
    antidopage: inconnue(SANS_LISTE_ANTIDOPAGE),
  },
];

/*
   A-21. Ce texte disait « Aucune fiche de molécule n'est publiée », ce qui
   était vrai à l'écriture et faux depuis le 16 octobre : cinq fiches sont
   publiées, chacune lue dans son RCP, avec onze interactions tirées du
   Thésaurus de l'ANSM. Une phrase que l'application montre et qui ment vaut
   moins que pas de phrase du tout — elle apprend à se méfier du reste.

   Le nom de la constante est gardé : il nomme l'emplacement — « pourquoi
   telle molécule n'a pas de fiche » — et non l'état du catalogue.
*/
export const POURQUOI_CATALOGUE_VIDE =
  'Cette molécule n’a pas encore de fiche : ses valeurs demandent une source ' +
  'primaire (RCP, Thésaurus des interactions) qui n’est pas au dossier. ' +
  'Vous pouvez déclarer un traitement par son nom sans attendre, et consulter ' +
  'les fiches déjà documentées depuis « Les fiches de molécules documentées ».';

/* ══════════════════════════════════════════════════════════════════════════
   Ce que la personne déclare
   ══════════════════════════════════════════════════════════════════════════ */

/** Qui a décidé de ce traitement. Déclaratif, jamais vérifié. */
export type OrigineDuTraitement = 'moi' | 'prescrit';

export const ORIGINES: Record<OrigineDuTraitement, string> = {
  moi: 'De ma propre initiative',
  prescrit: 'Prescrit',
};

/**
 * Un traitement déclaré : ce que la personne dit prendre, et sur quelle
 * période.
 *
 * `moleculeId` est **facultatif**, et c'est délibéré. Exiger une fiche de
 * catalogue rendrait l'écran inutilisable tant que le catalogue est vide, et
 * surtout : la personne sait ce qu'elle prend avant que Cyclades en ait une
 * fiche. Le nom libre est la vérité de départ ; le rattachement à une fiche
 * est un enrichissement qui viendra.
 *
 * `posologie` est un texte libre, jamais un nombre. Un nombre appellerait un
 * calcul, le calcul appellerait une comparaison, et la comparaison serait
 * l'avis que ce module n'a pas le droit de rendre.
 */
export interface Traitement {
  id: string;
  /** Le nom tel que la personne l'écrit. */
  nom: string;
  /** La fiche du catalogue, si elle existe. */
  moleculeId: string | null;
  origine: OrigineDuTraitement;
  /** Qui l'a prescrit, pour un traitement externe. Texte libre. */
  prescripteur: string;
  /** Texte libre : « 1 comprimé le matin », « 250 mg tous les 10 jours ». */
  posologie: string;
  /**
   * Une prise isolée, sans schéma ni rappel (décision 12).
   *
   * Un type plutôt qu'un magasin : une prise sporadique **est** un traitement
   * d'un jour. Lui donner son propre magasin aurait dupliqué le modèle, les
   * contrôles, le chiffrement et la synchronisation pour une différence qui
   * tient dans un booléen — et aurait obligé chaque écran à lire deux listes
   * là où il en lit une.
   */
  sporadique: boolean;
  debut: string;
  /** Vide tant qu'il court. */
  fin: string;
  note: string;
  majLe: string;
}

export function controlerTraitement(t: Traitement): string[] {
  const problemes: string[] = [];
  if (!t.nom.trim()) problemes.push('Un traitement a besoin d’un nom.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.debut)) problemes.push('Un traitement a une date de début.');
  if (t.fin && t.fin < t.debut) problemes.push('Un traitement ne finit pas avant de commencer.');
  if (!(t.origine in ORIGINES)) problemes.push(`Origine inconnue : « ${t.origine} ».`);
  return problemes;
}

export const traitementEnCours = (t: Traitement, jour: string): boolean =>
  t.debut <= jour && (!t.fin || t.fin >= jour);

/* ── Ce que je ressens, rattaché à ce que je prends (2.3) ─────────────── */

/**
 * Une note de ressenti, liée à un traitement.
 *
 * C'est **ma** donnée d'expérience, et la seule que Cyclades regarde : les
 * témoignages de tiers restent dans la ressource externe, que je consulte
 * moi-même et que l'application n'utilise pas.
 *
 * Aucun score, aucune moyenne, aucun message rassurant, aucune XP. Un module
 * qui noterait un ressenti sur dix aurait transformé une observation en
 * jugement, et un « vous allez mieux » calculé sur trois notes serait une
 * affirmation que rien n'étaye.
 */
export interface Ressenti {
  id: string;
  /** Le traitement concerné. Une note de ressenti sans objet n'en est pas une. */
  traitementId: string;
  jour: string;
  /** Ce que je ressens, dans mes mots. */
  ressenti: string;
  /** Ce que je tiens pour un effet indésirable, dans mes mots. */
  indesirable: string;
  /** Texte libre : « supporté », « moins net qu'au début ». Jamais un chiffre. */
  tolerance: string;
  note: string;
  majLe: string;
}

export function controlerRessenti(r: Ressenti): string[] {
  const problemes: string[] = [];
  if (!r.traitementId?.trim()) problemes.push('Un ressenti se rattache à un traitement.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.jour)) problemes.push('Un ressenti a une date.');
  if (!r.ressenti.trim() && !r.indesirable.trim() && !r.tolerance.trim() && !r.note.trim()) {
    problemes.push('Un ressenti entièrement vide n’est pas une note.');
  }
  return problemes;
}

/* ── Les prélèvements et leurs résultats ─────────────────────────────── */

/**
 * Un prélèvement : la date, le laboratoire, et le contexte.
 *
 * Le contexte n'est pas du décor. Un bilan fait à jeun et un bilan fait deux
 * heures après une prise ne se comparent pas, et c'est précisément ce que la
 * phase 5 appellera une « rupture de comparabilité ». Le noter au moment du
 * prélèvement coûte une ligne ; le reconstituer six mois plus tard est
 * impossible.
 */
export interface Prelevement {
  id: string;
  jour: string;
  /** L'instant, quand il est connu : le délai depuis la dernière prise en dépend. */
  le: string;
  laboratoire: string;
  /** « à jeun », « 3 h après la prise », texte libre. */
  contexte: string;
  note: string;
  majLe: string;
}

export function controlerPrelevement(p: Prelevement): string[] {
  const problemes: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.jour)) problemes.push('Un prélèvement appartient à un jour.');
  return problemes;
}

/**
 * Un résultat d'analyse.
 *
 * L'intervalle de référence est **celui du laboratoire**, saisi avec le
 * résultat, et non une valeur que Cyclades connaîtrait. Deux laboratoires
 * donnent des intervalles différents pour le même analyte, selon leur
 * technique de dosage ; un intervalle « de référence » posé par le logiciel
 * serait faux pour l'un des deux, sans moyen de savoir lequel.
 *
 * Les bornes sont facultatives : un compte rendu n'en donne pas toujours.
 */
export interface Resultat {
  id: string;
  prelevementId: string;
  /** Ce qui est dosé, tel que le compte rendu l'écrit. */
  analyte: string;
  valeur: number;
  unite: string;
  intervalleBas: number | null;
  intervalleHaut: number | null;
  note: string;
  majLe: string;
}

export function controlerResultat(r: Resultat): string[] {
  const problemes: string[] = [];
  if (!r.prelevementId) problemes.push('Un résultat appartient à un prélèvement.');
  if (!r.analyte.trim()) problemes.push('Un résultat dit ce qui a été dosé.');
  if (!Number.isFinite(r.valeur)) problemes.push('Un résultat porte une valeur numérique.');
  if (!r.unite.trim()) problemes.push('Un résultat sans unité ne veut rien dire.');
  if (
    r.intervalleBas !== null &&
    r.intervalleHaut !== null &&
    r.intervalleBas > r.intervalleHaut
  ) {
    problemes.push('L’intervalle du laboratoire est à l’envers.');
  }
  return problemes;
}

/**
 * Où tombe un résultat dans l'intervalle **du laboratoire**.
 *
 * Rend `null` quand l'intervalle n'est pas complet : sans les deux bornes,
 * « dans la norme » n'a pas de sens, et l'inventer serait un avis médical
 * rendu sur rien.
 */
export function situerDansLIntervalle(r: Resultat): 'sous' | 'dans' | 'au-dessus' | null {
  if (r.intervalleBas === null || r.intervalleHaut === null) return null;
  if (r.valeur < r.intervalleBas) return 'sous';
  if (r.valeur > r.intervalleHaut) return 'au-dessus';
  return 'dans';
}

/* ── Symptômes et conditions déclarées ───────────────────────────────── */

/**
 * Un symptôme, tel que la personne le décrit.
 *
 * L'intensité est sur dix et elle est **déclarative** : c'est la sienne, pas
 * une mesure. Elle sert à se relire — « c'était pire en mars » —, jamais à
 * déclencher quoi que ce soit.
 */
export interface Symptome {
  id: string;
  jour: string;
  intitule: string;
  /** De 0 à 10, déclaré. */
  intensite: number;
  note: string;
  majLe: string;
}

export function controlerSymptome(s: Symptome): string[] {
  const problemes: string[] = [];
  if (!s.intitule.trim()) problemes.push('Un symptôme a besoin d’un intitulé.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.jour)) problemes.push('Un symptôme appartient à un jour.');
  if (!Number.isInteger(s.intensite) || s.intensite < 0 || s.intensite > 10) {
    problemes.push('L’intensité déclarée va de 0 à 10.');
  }
  return problemes;
}

/**
 * Une condition déclarée : ce qui dure, et que la personne déclare elle-même.
 *
 * Ce n'est pas un diagnostic posé par Cyclades, et le champ ne s'appelle donc
 * ni « diagnostic » ni « pathologie ». C'est une ligne de contexte que la
 * personne écrit pour elle-même, et que Sport lit — comme le statut hormonal
 * — pour **contextualiser**, jamais pour ajuster une proposition.
 */
export interface ConditionDeclaree {
  id: string;
  intitule: string;
  debut: string;
  /** Vide tant qu'elle dure. */
  fin: string;
  note: string;
  majLe: string;
}

export function controlerCondition(c: ConditionDeclaree): string[] {
  const problemes: string[] = [];
  if (!c.intitule.trim()) problemes.push('Une condition a besoin d’un intitulé.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.debut)) problemes.push('Une condition a une date de début.');
  if (c.fin && c.fin < c.debut) problemes.push('Une condition ne finit pas avant de commencer.');
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le seul calcul de la phase : le délai depuis la dernière administration
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Combien de temps s'est écoulé depuis la dernière prise rattachée à ce
 * traitement.
 *
 * C'est une soustraction entre deux instants que la personne a saisis, et
 * c'est pour cela qu'elle est permise là où la courbe de concentration ne
 * l'est pas : elle ne projette rien, elle ne suppose aucune demi-vie, et elle
 * ne répond pas à « quand reprendre ». Elle répond à « quand est-ce que
 * c'était », ce que la personne a le droit de relire.
 *
 * Rend `null` s'il n'y a aucune prise : « 0 heure » serait faux, et « jamais »
 * est une information que l'écran doit rendre lui-même.
 */
export function heuresDepuisLaDernierePrise(
  prises: readonly { traitementId?: string | null; le: string }[],
  traitementId: string,
  maintenant: string,
): number | null {
  const instants = prises
    .filter((p) => p.traitementId === traitementId)
    .map((p) => Date.parse(p.le))
    .filter((t) => Number.isFinite(t));
  if (!instants.length) return null;
  const derniere = Math.max(...instants);
  const fin = Date.parse(maintenant);
  if (!Number.isFinite(fin)) return null;
  return Math.max(0, (fin - derniere) / 3_600_000);
}
