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
import {
  instantDeLOccurrence,
  suitLaRegle,
  type Repetition,
  type Serie,
} from './repetition';
import type { ReglagesJourLogique } from '../noyau/jour-logique';

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

const rcp = (nom: string, fichier: string, empreinte: string): Source => ({
  nom,
  ou: `${COLLECTE}/${fichier}`,
  le: LU_LE,
  empreinte,
});

/**
 * Pourquoi le statut antidopage est inconnu partout, et le restera tant que
 * la liste n'aura pas été déposée. Une constante, pour que la raison soit la
 * même sur chaque fiche — cinq formulations voisines finiraient par se
 * contredire sur le motif.
 *
 * ## Ce qui a été cherché, pour que personne ne recommence
 *
 * Les deux pages de l'AFLD de la collecte ont été lues en entier. Elles ne
 * classent **aucune** des cinq molécules : l'article du 5 janvier 2026 ne
 * donne que les **ajouts** de la liste 2026, classe par classe, et la page
 * « liste des substances » ne fait que renvoyer au PDF de l'AMA.
 *
 * Un piège s'y trouve, et il vaut d'être nommé : l'article liste, sous
 * « S6. Stimulants », le **flmodafinil** et le **fladrafinil**. Ce ne sont pas
 * le modafinil. Lire cette ligne comme classant le modafinil serait une
 * erreur de lecture, pas une déduction.
 *
 * ## Les deux documents qui lèveraient le voile
 *
 * Le PDF officiel de l'AMA (`wada-ama.org`), et le **décret n° 2025-1226 du
 * 15 décembre 2025** (`JORFTEXT000053036083`), qui transpose la liste 2026 en
 * droit français. Les deux sont relevés « trouvé, non téléchargeable » dans la
 * collecte : défi anti-robot sur l'un, sur Légifrance pour l'autre.
 */
const SANS_LISTE_ANTIDOPAGE =
  'La liste des interdictions de l’AMA n’est pas dans la collecte — point 2.4 des ' +
  'sources à atteindre. Les deux pages de l’AFLD déposées ne classent aucune ' +
  'molécule : elles renvoient au document de l’AMA. Aucun RCP ne le remplace, et ' +
  'déduire un statut serait l’inventer.';

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
/*
   Exportée : la limite de dose de cette molécule vit dans « molecules.ts »,
   avec les autres limites, et doit citer EXACTEMENT le même document que sa
   maturité ici — même nom, même chemin, même empreinte. Recopier la source
   là-bas aurait créé deux vérités qui finiraient par diverger.
*/
export const SOURCE_FLUIMUCIL = rcp(
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
  /**
   * Le schéma prévu, ou rien — phase 4, P1.
   *
   * **Facultatif, et absent se lit « pas de schéma ».** Un traitement écrit
   * avant ce lot reste valide tel quel et se comporte comme avant : aucun
   * créneau, aucun rappel. Poser un schéma vide sur chaque ligne existante
   * aurait été une migration qui touche des données pour y écrire une valeur
   * déjà lisible dans leur absence — du risque sans contrepartie.
   */
  schema?: SchemaDePrise | null;
  /**
   * Le réglage de rappel, ou rien — phase 4, P3 et P4.
   *
   * Facultatif comme le schéma, et absent se lit « aucun rappel », ce qui
   * est le défaut voulu : rien ne sonne tant que personne ne l'a demandé.
   */
  rappel?: ReglageDeRappel | null;
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
  /*
     Un schéma sur une prise sporadique est refusé **au contrôle**, et non
     seulement masqué à l'écran. La décision 12 dit « pas de fin, pas de
     schéma, pas de rappel » ; un objet qui porterait les deux serait
     contradictoire, et c'est le genre de contradiction qui entre par un
     import ou par une synchronisation, jamais par le formulaire.
  */
  if (t.schema && t.sporadique) {
    problemes.push('Une prise sporadique n’a pas de schéma prévu : elle est isolée.');
  }
  if (t.schema) problemes.push(...controlerSchema(t.schema));
  if (t.rappel) problemes.push(...controlerReglage(t.rappel));
  /*
     Un rappel sans schéma n'a aucune heure à rappeler. Le refus est au
     contrôle parce qu'un réglage et un schéma s'écrivent par deux chemins
     différents : retirer le schéma sans toucher au réglage laisserait un
     rappel qui ne sonnerait jamais, sans que rien ne le dise.
  */
  if (t.rappel?.actif && !t.schema) {
    problemes.push('Un rappel a besoin d’un schéma prévu : il n’aurait aucune heure à rappeler.');
  }
  return problemes;
}

export const traitementEnCours = (t: Traitement, jour: string): boolean =>
  t.debut <= jour && (!t.fin || t.fin >= jour);

/* ══════════════════════════════════════════════════════════════════════════
   Le schéma prévu — phase 4, P1

   La règle posée en phase 1 était « enregistrement seul », et elle tenait à
   un fait : la posologie est du **texte libre**, donc rien ne sait ce qui
   était prévu. Le 16 octobre, Alexis a signé la condition de sa levée —
   « pas de rappel de prise tant qu'il n'y a pas de posologie structurée ».
   Ce qui suit est cette posologie structurée, et rien de plus.

   **Ce que le schéma n'est pas.** Il n'est pas une dose, pas une
   recommandation, pas une correction. Il porte ce que la personne déclare :
   des jours, des heures, et une quantité dans ses mots. Cyclades ne le
   propose jamais, ne le compare à aucune fiche, et ne le modifie pas.

   **Il reste facultatif.** Un traitement sans schéma se comporte exactement
   comme avant ce lot — le champ est absent, et absent se lit « pas de
   schéma ». Aucune ligne existante n'est réécrite.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La règle des jours d'un schéma prévu.
 *
 * C'est un **sous-ensemble du calendrier existant**, et non un type nouveau :
 * « tous les jours » s'écrit `{ type: 'jours', tous: 1 }`, « tous les trois
 * jours » `{ type: 'jours', tous: 3 }`, « lundi et jeudi »
 * `{ type: 'semaines', tous: 1, jours: [1, 4] }`.
 *
 * Réécrire ici une arithmétique de calendrier aurait produit une seconde
 * implémentation du jour logique et du changement d'heure, c'est-à-dire deux
 * codes qui divergent le 25 octobre et se ressemblent les trois cent
 * soixante-quatre autres jours. `repetition.ts` porte déjà les deux règles,
 * et il est éprouvé.
 *
 * Les formes mensuelles et annuelle de `Repetition` sont **exclues par le
 * type**, parce que le prompt en demande trois et que la personne n'en verra
 * que trois. Une quatrième forme que seul le modèle saurait construire serait
 * une porte qu'aucun écran n'ouvre et qu'aucun essai ne garde.
 */
export type RepetitionDePrise = Extract<Repetition, { type: 'jours' } | { type: 'semaines' }>;

/**
 * Ce qu'une personne déclare prévoir pour un traitement.
 *
 * `heures` est une liste, parce que « matin et soir » est le cas ordinaire et
 * qu'un champ unique aurait obligé à déclarer deux traitements pour une seule
 * molécule — avec deux historiques de prises qu'on ne pourrait plus réunir.
 *
 * `quantite` est un texte libre affiché tel quel, pour la raison qui vaut
 * déjà pour `posologie` : un nombre appellerait un calcul, le calcul une
 * comparaison, et la comparaison serait l'avis que ce module n'a pas le droit
 * de rendre.
 */
export interface SchemaDePrise {
  repetition: RepetitionDePrise;
  /** Les heures murales prévues, « HH:MM ». Au moins une, triées, sans doublon. */
  heures: readonly string[];
  /** « 5 g », « un comprimé ». Jamais lu comme un nombre. */
  quantite: string;
}

/** Une heure murale, de `00:00` à `23:59`. */
const HEURE_MURALE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Range les heures : triées, sans doublon.
 *
 * Deux fois « 08:00 » dans la même journée donnerait deux créneaux
 * indiscernables — donc deux rappels pour une prise, et un « rien n'est
 * noté » qui resterait vrai après qu'on a noté. Le doublon se retire à
 * l'écriture plutôt que de se contourner à chaque lecture.
 */
export const rangerLesHeures = (heures: readonly string[]): string[] =>
  [...new Set(heures.map((h) => h.trim()))].filter(Boolean).sort();

export function controlerSchema(s: SchemaDePrise): string[] {
  const problemes: string[] = [];
  if (!s.heures.length) problemes.push('Un schéma prévu porte au moins une heure.');
  for (const h of s.heures) {
    if (!HEURE_MURALE.test(h)) problemes.push(`« ${h} » n’est pas une heure.`);
  }
  if (new Set(s.heures).size !== s.heures.length) {
    problemes.push('Une même heure ne peut pas être prévue deux fois le même jour.');
  }
  const r = s.repetition;
  if (!Number.isInteger(r.tous) || r.tous < 1) {
    problemes.push('Une répétition se compte en nombres entiers, à partir de un.');
  }
  if (r.type === 'semaines') {
    if (!r.jours.length) problemes.push('Un schéma par semaine nomme au moins un jour.');
    if (r.jours.some((j) => !Number.isInteger(j) || j < 0 || j > 6)) {
      problemes.push('Un jour de la semaine va de 0 (dimanche) à 6 (samedi).');
    }
  }
  return problemes;
}

/**
 * La série équivalente à un traitement : sa période **est** la fin de série.
 *
 * C'est la traduction qui permet de réutiliser `repetition.ts` sans y toucher,
 * et elle n'invente rien : un traitement commence le `debut`, il s'arrête à
 * la `fin` quand elle est posée, il court sans fin sinon. Les trois champs
 * existaient déjà ; ils disaient déjà cela.
 *
 * `heure` est passée par l'appelant parce qu'un schéma en porte plusieurs et
 * qu'une série n'en porte qu'une. C'est la seule entorse, et elle est locale :
 * on construit une série par heure, le temps d'un calcul.
 */
export const serieDuSchema = (
  t: Traitement,
  schema: SchemaDePrise,
  heure: string | null = null,
): Serie => ({
  depuis: t.debut,
  repetition: schema.repetition,
  fin: t.fin ? { type: 'date', jusquAu: t.fin } : { type: 'jamais' },
  heure,
});

/**
 * Un créneau prévu : un traitement, un jour logique, une heure.
 *
 * `instant` est calculé par `instantDeLOccurrence()`, qui porte déjà les deux
 * conversions qui comptent et qu'on ne refait donc pas ici : le jour logique
 * vers le jour du calendrier — une prise de 0 h 30 appartient à la veille,
 * puisque la journée bascule à 4 h — et l'heure murale vers l'instant, avec
 * l'heure sautée de mars et l'heure dédoublée d'octobre.
 */
export interface CreneauPrevu {
  traitementId: string;
  /** Le jour logique auquel le créneau appartient. */
  jour: string;
  /** L'heure murale, « HH:MM ». */
  heure: string;
  instant: Date;
}

/**
 * Les créneaux prévus d'un traitement, un jour logique donné.
 *
 * Rend une liste vide dans quatre cas, et chacun est une règle :
 *
 * - **pas de schéma** : c'est le cas par défaut, et il ne change rien au
 *   comportement d'avant ce lot ;
 * - **traitement sporadique** : la décision 12 pose « pas de fin, pas de
 *   schéma, pas de rappel », et l'interdit du § 1 la reprend mot pour mot.
 *   Le refus est ici, au calcul, et non seulement à l'écran : un schéma posé
 *   par un import ou une synchronisation ne doit pas produire de créneau non
 *   plus ;
 * - **hors de la période** du traitement ;
 * - **jour qui ne suit pas la règle**.
 */
export function creneauxDuJour(
  t: Traitement,
  jour: string,
  reglages: Partial<ReglagesJourLogique> = {},
): CreneauPrevu[] {
  const schema = t.schema;
  if (!schema || t.sporadique) return [];
  if (!traitementEnCours(t, jour)) return [];
  if (!suitLaRegle(serieDuSchema(t, schema), jour)) return [];
  return rangerLesHeures(schema.heures).map((heure) => ({
    traitementId: t.id,
    jour,
    heure,
    /*
       `instantDeLOccurrence` ne rend `null` que pour une série sans heure, et
       celle-ci en porte une. Le `!` dit cette lecture plutôt que de laisser
       un `null` impossible remonter jusqu'aux écrans, où il faudrait le
       traiter partout sans jamais pouvoir l'obtenir.
    */
    instant: instantDeLOccurrence(serieDuSchema(t, schema, heure), jour, reglages)!,
  }));
}

/* ── Le réglage de rappel — phase 4, P3 et P4 ─────────────────────────── */

/**
 * Les trois niveaux de libellé du § 3.3 du plan Santé.
 *
 * Ils n'existaient que dans le plan : aucun des trois mots n'apparaissait
 * dans le code avant ce lot. Ils sont ici, et non à l'écran, parce qu'un
 * libellé part dans un fichier qui **quitte l'appareil** — c'est une
 * décision de confidentialité, pas une préférence d'affichage.
 *
 * Pas de niveau intermédiaire par catégorie : « Rappel Cyclades — hormonal »
 * en dirait déjà trop sur un agenda synchronisé chez un tiers.
 */
export type NiveauDeLibelle = 'neutre' | 'explicite' | 'personnalise';

/** Le libellé neutre, et il n'y en a qu'un. § 3.3, mot pour mot. */
export const LIBELLE_NEUTRE = 'Rappel Cyclades';

/**
 * L'avertissement qui accompagne le libellé explicite, § 3.3.
 *
 * Il n'est pas facultatif et il n'est pas décoratif : choisir « explicite »
 * sans savoir que l'agenda est peut-être synchronisé chez un tiers n'est pas
 * un choix éclairé, et c'est le seul endroit où Cyclades peut le dire.
 */
export const AVERTISSEMENT_LIBELLE_EXPLICITE =
  'Votre agenda peut être synchronisé avec un service tiers. Un libellé explicite y sera lisible.';

/**
 * Les deux voies d'un rappel, et ce qu'elles valent vraiment.
 *
 * Elles ne sont pas équivalentes, et l'écran le dit plutôt que de laisser
 * choisir à l'aveugle : **seul l'agenda sonne quand l'application est
 * fermée** (§ 5 n° 2 du plan). La notification de Cyclades part quand
 * l'application est ouverte, ou quand le navigateur la réveille — ce qu'il
 * ne fait que sur Android avec l'application installée.
 */
export type VoieDeRappel = 'agenda' | 'notification';

/** Les délais proposés pour le rappel d'oubli, en minutes. */
export const DELAIS_D_OUBLI: readonly number[] = [30, 60, 120, 240];

/** Deux heures, décision 5 du prompt, arrêtée par le pilote sous délégation. */
export const DELAI_D_OUBLI_PAR_DEFAUT = 120;

/**
 * Ce qu'une personne règle pour un traitement donné.
 *
 * **Tout est désactivé par défaut** (décision 3), et le type l'impose : il
 * n'existe pas de réglage implicite, puisque `reglageParDefaut()` est la
 * seule manière d'en fabriquer un et qu'elle met les deux drapeaux à faux.
 * Un rappel qu'on n'a pas demandé est une interruption qu'on n'a pas
 * demandée.
 */
export interface ReglageDeRappel {
  /** « Me rappeler ». Faux par défaut. */
  actif: boolean;
  voie: VoieDeRappel;
  libelle: NiveauDeLibelle;
  /** Le texte, pour `personnalise` seulement. Affiché tel quel. */
  texte: string;
  /** « Me le rappeler si je n'ai rien noté ». Faux par défaut. */
  oubli: boolean;
  /** Le délai du rappel d'oubli, en minutes. */
  delaiOubli: number;
}

export const reglageParDefaut = (): ReglageDeRappel => ({
  actif: false,
  voie: 'agenda',
  libelle: 'neutre',
  texte: '',
  oubli: false,
  delaiOubli: DELAI_D_OUBLI_PAR_DEFAUT,
});

export function controlerReglage(r: ReglageDeRappel): string[] {
  const problemes: string[] = [];
  if (r.voie !== 'agenda' && r.voie !== 'notification') {
    problemes.push(`Voie de rappel inconnue : « ${r.voie} ».`);
  }
  if (!['neutre', 'explicite', 'personnalise'].includes(r.libelle)) {
    problemes.push(`Niveau de libellé inconnu : « ${r.libelle} ».`);
  }
  /*
     Un libellé personnalisé vide retomberait silencieusement sur le neutre,
     ce qui est le bon repli mais un mauvais réglage : la personne croirait
     avoir écrit quelque chose. On le refuse à la saisie.
  */
  if (r.libelle === 'personnalise' && !r.texte.trim()) {
    problemes.push('Un libellé personnalisé a besoin de son texte.');
  }
  if (!DELAIS_D_OUBLI.includes(r.delaiOubli)) {
    problemes.push(`Délai de rappel inconnu : ${r.delaiOubli} minutes.`);
  }
  /*
     Le rappel d'oubli suppose le rappel : sans schéma rappelé, « rien n'est
     noté » n'a pas de créneau auquel se rapporter. Le refus est ici plutôt
     qu'à l'écran, pour la raison habituelle — un import ou une
     synchronisation n'ouvre aucun formulaire.
  */
  if (r.oubli && !r.actif) {
    problemes.push('Un rappel d’oubli suppose un rappel : activez d’abord « Me rappeler ».');
  }
  return problemes;
}

/**
 * Ce qui s'écrit dans l'agenda, ou dans le centre, pour ce traitement.
 *
 * **Le repli est toujours le neutre**, et jamais le nom : un niveau inconnu
 * — venu d'un enregistrement plus récent qu'une version installée — ne doit
 * pas révéler un traitement par accident. C'est le même défaut que partout
 * ailleurs dans Cyclades : quand on ne sait pas, on se tait.
 */
export function libelleDuRappel(t: Traitement): string {
  const r = t.rappel;
  if (!r) return LIBELLE_NEUTRE;
  if (r.libelle === 'explicite') return t.nom.trim() || LIBELLE_NEUTRE;
  if (r.libelle === 'personnalise') return r.texte.trim() || LIBELLE_NEUTRE;
  return LIBELLE_NEUTRE;
}

/* ── Ce qui est noté d'un créneau — phase 4, P2 ───────────────────────── */

/**
 * Les deux réponses possibles à un créneau prévu.
 *
 * `pas-aujourdhui` **n'est pas un échec**, et le vocabulaire le dit : ni
 * « manqué », ni « oublié », ni « non pris ». L'interdit § 1 n° 3 est
 * explicite — « "Pas aujourd'hui" est un choix comme un autre et ne laisse
 * aucune marque négative ». Un nom de valeur qui jugerait finirait par se
 * retrouver à l'écran, puis dans un compte.
 *
 * Il n'existe pas de troisième valeur pour « rien n'est noté » : c'est
 * l'**absence** de marque, et il faut qu'elle le reste. Un état « en
 * attente » rangé en base ferait du silence une donnée, et le rappel
 * d'oubli se mettrait à dépendre de l'existence d'une ligne plutôt que de
 * son absence.
 */
export type EtatDeCreneau = 'pris' | 'pas-aujourdhui';

/**
 * Ce que la personne a répondu à un créneau.
 *
 * ## Pourquoi un magasin à part, et pas un champ sur la prise
 *
 * `Prise` dit « une prise telle qu'elle a eu lieu », et son module ajoute :
 * « `prevu` n'existe pas ». Y glisser un drapeau « pas pris » ferait du seul
 * magasin qui soit un constat un magasin d'intentions — et `prisesDuJour()`,
 * qui compte ce qui a été pris, compterait des non-prises.
 *
 * ## L'identifiant est une EMPREINTE, et c'est le point qui compte
 *
 * Les clés restent **en clair** dans la base : `controlerCoffre()` l'exige,
 * puisque c'est par elles qu'on retrouve un enregistrement sans l'ouvrir. Un
 * identifiant valant `t-01/2026-10-19/08:00` dirait donc, sans aucune clé,
 * qu'il se passe quelque chose tous les jours à 8 h pour ce traitement.
 * C'est exactement le rythme que le scellement protège, et ce serait une
 * fuite **nouvelle** : le traitement, lui, est scellé.
 *
 * L'empreinte garde le déterminisme — deux appareils dérivent la même clé
 * pour le même créneau, donc une marque se met à jour au lieu de se
 * dupliquer — sans rien dire. C'est le mécanisme du centre de notifications
 * (`notifications/modele.ts`), repris ici plutôt que réinventé.
 */
export interface MarqueDeCreneau {
  /** L'empreinte de `traitementId ‧ jour ‧ heure`. Déterministe, et muette. */
  id: string;
  traitementId: string;
  /** Le jour logique du créneau. */
  jour: string;
  /** L'heure **prévue**, « HH:MM ». */
  heure: string;
  etat: EtatDeCreneau;
  /** La prise créée par « Pris », s'il y en a une. `null` pour « Pas aujourd'hui ». */
  priseId: string | null;
  /**
   * L'instant du geste — **l'heure réelle**, pas l'heure prévue.
   *
   * Les deux diffèrent presque toujours, et c'est l'information : « Prévu à
   * 8 h, noté à 8 h 12 » est un constat ; « Prévu à 8 h, noté à 8 h » serait
   * une recopie de la prévision, c'est-à-dire une donnée fabriquée.
   */
  le: string;
  majLe: string;
}

const encodeurDeCreneau = new TextEncoder();

/**
 * L'empreinte d'un créneau. Seize octets en hexadécimal, soit 32 signes.
 *
 * Même longueur et même raison qu'au centre : une collision demanderait 2^64
 * créneaux pour une chance sur deux, et une vie de traitements en compte
 * quelques dizaines de milliers.
 */
export async function idDuCreneau(
  traitementId: string,
  jour: string,
  heure: string,
): Promise<string> {
  const brut = await crypto.subtle.digest(
    'SHA-256',
    encodeurDeCreneau.encode(`${traitementId}\u0000${jour}\u0000${heure}`),
  );
  return Array.from(new Uint8Array(brut).slice(0, 16))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

export function controlerMarque(m: MarqueDeCreneau): string[] {
  const problemes: string[] = [];
  if (!/^[0-9a-f]{32}$/.test(m.id)) {
    problemes.push('L’identifiant d’un créneau est une empreinte de 32 signes.');
  }
  if (!m.traitementId.trim()) problemes.push('Une marque se rattache à un traitement.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.jour)) problemes.push('Une marque appartient à un jour.');
  if (!HEURE_MURALE.test(m.heure)) problemes.push(`« ${m.heure} » n’est pas une heure.`);
  if (m.etat !== 'pris' && m.etat !== 'pas-aujourdhui') {
    problemes.push(`État de créneau inconnu : « ${m.etat} ».`);
  }
  /*
     Une marque « pas aujourd'hui » qui porterait une prise serait
     contradictoire, et la contradiction se propagerait : le dépointage
     effacerait une prise que le geste n'a pas créée.
  */
  if (m.etat === 'pas-aujourdhui' && m.priseId) {
    problemes.push('« Pas aujourd’hui » ne crée aucune prise.');
  }
  return problemes;
}

/**
 * Ce qu'un écran dit d'un créneau, sans avoir à choisir lui-même.
 *
 * `prevu` n'est **pas** un retard et ne doit jamais s'afficher comme tel : un
 * créneau de 20 h regardé à 9 h est prévu, et un créneau de 8 h regardé à
 * 23 h sans rien de noté l'est encore. Ce module ne sait pas ce qu'est un
 * oubli — `rappels.ts` le saura, avec un délai que la personne aura choisi,
 * et lui seul.
 */
export type RenduDeCreneau =
  | { etat: 'prevu' }
  | { etat: 'pris'; le: string }
  | { etat: 'pas-aujourdhui' };

export function etatDuCreneau(
  creneau: CreneauPrevu,
  marques: readonly MarqueDeCreneau[],
): RenduDeCreneau {
  const marque = marques.find(
    (m) =>
      m.traitementId === creneau.traitementId &&
      m.jour === creneau.jour &&
      m.heure === creneau.heure,
  );
  if (!marque) return { etat: 'prevu' };
  if (marque.etat === 'pris') return { etat: 'pris', le: marque.le };
  return { etat: 'pas-aujourdhui' };
}

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
