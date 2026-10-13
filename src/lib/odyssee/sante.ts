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

/**
 * Le catalogue livré : **vide**, et il le dit.
 *
 * Ce n'est pas un oubli de phase 1. Le catalogue est la phase 2, et la
 * phase 2 attend les RCP et le Thésaurus, qui attendent eux-mêmes un accès
 * réseau ou un dépôt de fichiers (`sources-a-atteindre.md`, lot 2). Un
 * catalogue pré-rempli « en attendant » serait exactement la valeur inventée
 * que tout ce module est fait pour empêcher.
 */
export const CATALOGUE: readonly FicheMolecule[] = [];

export const POURQUOI_CATALOGUE_VIDE =
  'Aucune fiche de molécule n’est publiée : leurs valeurs demandent des sources ' +
  'primaires (RCP, Thésaurus des interactions) qui ne sont pas encore au dossier. ' +
  'Vous pouvez déclarer un traitement par son nom sans attendre.';

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
