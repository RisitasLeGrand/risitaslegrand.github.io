/**
 * Les molécules : le registre du menu, les statuts d'interaction, les limites
 * sourcées et les doses étudiées.
 *
 * ## Ce que ce fichier contient, et ce qu'il ne contient pas
 *
 * Il contient des **formes** et des **contrôles**. Il ne contient **aucune
 * valeur de molécule** : pas une demi-vie, pas une dose, pas une interaction.
 * La raison est la même que pour le catalogue de `sante.ts` et elle n'a pas
 * bougé : aucune source primaire n'est atteignable depuis la machine qui
 * construit ce site, et une valeur écrite de mémoire serait exactement ce que
 * tout ce module existe pour empêcher.
 *
 * Les contrôles ci-dessous sont donc écrits pour un catalogue qui se remplira
 * plus tard, et ils sont **durs** : une paire « probable » sans publication
 * citée, une limite sans source, une ligne de dose sans population font
 * échouer la validation. Un contrôle écrit après coup s'adapte toujours au
 * contenu qu'il trouve ; celui-ci est écrit avant, et c'est le contenu qui
 * devra s'y plier.
 *
 * ## Ce que ce fichier n'a pas le droit de savoir
 *
 * Rien de la bibliothèque externe n'entre ici. Le registre des noms ne porte
 * **aucun marqueur de provenance** : Cyclades ne sait pas, et ne doit pas
 * pouvoir déduire, ce que cette bibliothèque contient pour une molécule
 * donnée. C'est une contrainte de conception, pas une précaution de forme —
 * un champ « vu dans la bibliothèque » suffirait à transformer le registre en
 * analyse, ce que la consigne « donnée morte » interdit.
 */
import type { Source, ValeurSourcee } from './sante';

/* ══════════════════════════════════════════════════════════════════════════
   Le registre des noms (2.8)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une entrée du menu de déclaration.
 *
 * Cinq champs, et c'est tout. Pas de catégorie, pas de thème, pas de
 * compteur, pas d'ordre d'origine, aucun champ qui dirait d'où vient le nom.
 * La liste est triée alphabétiquement par Cyclades : toute autre règle de tri
 * serait un classement de popularité déguisé.
 */
export interface EntreeRegistre {
  id: string;
  nom: string;
  /** Autres graphies **vérifiées**. Vide tant que rien n'a pu l'être. */
  alias: readonly string[];
  /** Identifiant de nomenclature, s'il a été retrouvé. */
  nomenclature: string | null;
  /** Une fiche du catalogue porte-t-elle ce nom ? */
  fiche: boolean;
  /**
   * Le nom a-t-il été confronté à une nomenclature de référence ?
   *
   * Faux ne veut pas dire « douteux » : il veut dire « non confronté ». Un nom
   * non confronté **reste dans le menu**, étiqueté, parce que l'écarter
   * reviendrait à décider à la place de la personne qu'elle ne prend pas ce
   * qu'elle prend.
   */
  identiteVerifiee: boolean;
}

/** Les champs admis dans une entrée. Tout autre champ fait échouer le contrôle. */
const CHAMPS_REGISTRE = new Set([
  'id',
  'nom',
  'alias',
  'nomenclature',
  'fiche',
  'identiteVerifiee',
]);

/**
 * Les mots qui trahiraient une reprise de la bibliothèque.
 *
 * Un registre qui porterait une catégorie, un thème, un compteur de mentions
 * ou un marqueur de provenance ne serait plus une liste de noms : ce serait
 * une partie de la base recopiée. Le contrôle nomme donc ce qu'il refuse,
 * plutôt que de faire confiance à la relecture.
 */
const CHAMPS_INTERDITS = [
  'categorie',
  'category',
  'theme',
  'topic',
  'compound',
  'liens',
  'links',
  'mentions',
  'shares',
  'anec',
  'temoignages',
  'auteur',
  'pseudonyme',
  'dose',
  'provenance',
  'source_liste',
  'bibliotheque',
];

export function controlerRegistre(entrees: readonly EntreeRegistre[]): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();

  for (const e of entrees) {
    const champs = Object.keys(e as unknown as Record<string, unknown>);
    for (const c of champs) {
      if (CHAMPS_INTERDITS.includes(c.toLowerCase())) {
        problemes.push(`« ${e.nom || e.id} » porte le champ interdit « ${c} ».`);
      } else if (!CHAMPS_REGISTRE.has(c)) {
        problemes.push(`« ${e.nom || e.id} » porte un champ inconnu « ${c} ».`);
      }
    }
    if (!e.id?.trim()) problemes.push('Une entrée du registre n’a pas d’identifiant.');
    if (!e.nom?.trim()) problemes.push(`L’entrée « ${e.id} » n’a pas de nom.`);
    if (vus.has(e.id)) problemes.push(`Identifiant en double : « ${e.id} ».`);
    vus.add(e.id);
    if (e.nomenclature === null && e.identiteVerifiee) {
      problemes.push(`« ${e.nom} » se dit vérifiée sans identifiant de nomenclature.`);
    }
  }

  const tries = [...entrees].map((e) => e.nom);
  const attendu = [...tries].sort((a, b) => comparerNoms(a, b));
  if (tries.join('\u0000') !== attendu.join('\u0000')) {
    problemes.push('Le registre n’est pas trié par ordre alphabétique.');
  }
  return problemes;
}

/** Comparaison française, insensible à la casse et aux accents. */
export const comparerNoms = (a: string, b: string): number =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' });

/** La forme repliée d'un nom : sans accent, sans casse, pour la recherche. */
export const replier = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Cherche dans le registre.
 *
 * « Mes molécules » d'abord — celles que la personne a déjà déclarées —, puis
 * le reste par ordre alphabétique. Aucune rubrique « populaires » : le
 * registre ne porte aucun compteur, et c'est voulu (2.8).
 *
 * Aucune trace n'est gardée de ce qui est tapé. La fonction est pure, elle
 * n'écrit nulle part, et c'est la seule garantie qui tienne : un historique
 * de ce qu'on cherche dans une liste de molécules est une donnée de santé.
 */
export function chercher(
  registre: readonly EntreeRegistre[],
  requete: string,
  miennes: ReadonlySet<string> = new Set(),
  plafond = 200,
): EntreeRegistre[] {
  const q = replier(requete);
  const retenues = q
    ? registre.filter(
        (e) => replier(e.nom).includes(q) || e.alias.some((a) => replier(a).includes(q)),
      )
    : [...registre];
  const mien = (e: EntreeRegistre) => (miennes.has(e.id) ? 0 : 1);
  return retenues
    .sort((a, b) => mien(a) - mien(b) || comparerNoms(a.nom, b.nom))
    .slice(0, plafond);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les statuts d'interaction (2.4 bis)
   ══════════════════════════════════════════════════════════════════════════ */

export type StatutInteraction =
  | 'documentee'
  | 'probable'
  | 'theorique'
  | 'non-documentee'
  | 'etudiee-sans-interaction';

/** L'ordre d'affichage : du plus établi au moins établi. */
export const ORDRE_STATUTS: readonly StatutInteraction[] = [
  'documentee',
  'probable',
  'theorique',
  'non-documentee',
  'etudiee-sans-interaction',
];

/**
 * Le message de « probable », qui doit porter **trois idées** et un renvoi.
 *
 * Il est écrit ici en une seule place, et un essai vérifie que les trois
 * idées y sont. La tentation, en relisant, est d'alléger : « interaction
 * possible, voyez un médecin ». Ce serait perdre « non documentée » — donc
 * laisser croire que quelqu'un a étudié la question — et perdre « des
 * précautions sont à prendre », qui est la seule chose actionnable de la
 * phrase.
 */
export const MESSAGE_PROBABLE =
  'Interaction probable : une interaction potentielle existe entre ces molécules, ' +
  'non documentée. Des précautions sont à prendre. À aborder avec un médecin ou un ' +
  'pharmacien.';

/** La nature d'une publication qui peut fonder un « probable ». */
export type NaturePublication =
  | 'cas-rapporte'
  | 'pharmacocinetique'
  | 'pharmacodynamique'
  | 'essai';

export const NATURES: Record<NaturePublication, string> = {
  'cas-rapporte': 'Cas rapporté',
  pharmacocinetique: 'Étude pharmacocinétique',
  pharmacodynamique: 'Étude pharmacodynamique',
  essai: 'Essai clinique',
};

/** La base obligatoire d'une paire « probable ». */
export interface BasePubliee {
  nature: NaturePublication;
  source: Source;
}

export interface PaireInteraction {
  a: string;
  b: string;
  statut: StatutInteraction;
  /** Obligatoire si et seulement si le statut est « probable ». */
  base: BasePubliee | null;
  /** Donnée par une source de référence, jamais inventée. */
  gravite: ValeurSourcee<string> | null;
}

export function controlerPaire(p: PaireInteraction): string[] {
  const problemes: string[] = [];
  const nom = `${p.a} × ${p.b}`;
  if (!ORDRE_STATUTS.includes(p.statut)) problemes.push(`Statut inconnu pour ${nom}.`);
  if (p.statut === 'probable') {
    if (!p.base) {
      problemes.push(
        `${nom} est « probable » sans base publiée. Une paire « probable » sans ` +
          'publication primaire vérifiée n’est pas inscriptible.',
      );
    } else {
      if (!(p.base.nature in NATURES)) problemes.push(`Nature de publication inconnue pour ${nom}.`);
      if (!p.base.source?.ou?.trim()) problemes.push(`La base de ${nom} ne dit pas d’où elle vient.`);
    }
  } else if (p.base) {
    problemes.push(`${nom} porte une base publiée sans être « probable ».`);
  }
  if (p.gravite?.connue && !p.gravite.source?.ou?.trim()) {
    problemes.push(`La gravité de ${nom} se dit connue sans source.`);
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les limites à ne pas dépasser (2.5)
   ══════════════════════════════════════════════════════════════════════════ */

export type NatureLimite = 'autorite' | 'rcp' | 'max-etudiee';

export const NATURES_LIMITE: Record<NatureLimite, string> = {
  autorite: 'Limite supérieure fixée par une autorité',
  rcp: 'Dose maximale du résumé des caractéristiques du produit',
  'max-etudiee': 'Dose maximale étudiée',
};

/** Le libellé que `max-etudiee` doit porter, mot pour mot. */
export const LIBELLE_MAX_ETUDIEE =
  'Dose maximale étudiée. Ce n’est pas une limite de sécurité.';

/** Ce qu'affiche une molécule sans limite établie. */
export const AUCUNE_LIMITE =
  'Aucune limite de sécurité établie par une autorité. L’absence de limite n’est pas ' +
  'une preuve d’innocuité.';

export interface LimiteSourcee {
  nature: NatureLimite;
  /** Énoncé factuel, sans verbe de prescription. */
  valeur: string;
  population: string;
  voie: string;
  source: Source;
  date: string;
}

/**
 * Les mots qu'une limite ne peut pas contenir.
 *
 * H.9 interdit la prescription ; la liste la rend contrôlable. « sûr » y
 * figure parce que « sûr jusqu'à X » est la formule qui transforme une limite
 * en autorisation.
 */
export const VERBES_INTERDITS = [
  'ne dépassez pas',
  'ne pas dépasser',
  'recommandé',
  'recommandée',
  'conseillé',
  'conseillée',
  'sûr jusqu',
  'dose habituelle',
  'dose idéale',
  'dose optimale',
  'dose efficace',
  'dose typique',
  'posologie usuelle',
];

export function controlerLimite(l: LimiteSourcee): string[] {
  const problemes: string[] = [];
  if (!(l.nature in NATURES_LIMITE)) problemes.push(`Nature de limite inconnue : « ${l.nature} ».`);
  for (const [champ, v] of [
    ['valeur', l.valeur],
    ['population', l.population],
    ['voie', l.voie],
    ['date', l.date],
  ] as [string, string][]) {
    if (!v?.trim()) problemes.push(`Une limite sans ${champ} n’est pas affichable.`);
  }
  if (!l.source?.ou?.trim()) problemes.push('Une limite sans source n’est pas affichable.');
  const t = replier(l.valeur);
  for (const mot of VERBES_INTERDITS) {
    if (t.includes(replier(mot))) problemes.push(`La limite emploie « ${mot} », que H.9 interdit.`);
  }
  if (l.nature === 'max-etudiee' && !l.valeur.includes(LIBELLE_MAX_ETUDIEE)) {
    problemes.push('Une dose maximale étudiée doit porter son libellé fixe.');
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les doses étudiées (2.7)
   ══════════════════════════════════════════════════════════════════════════ */

/** D'où vient une affirmation. Sans étiquette, elle ne s'affiche pas. */
export type Provenance = 'humain' | 'animal' | 'cellules' | 'mecanisme-deduit';

export const PROVENANCES: Record<Provenance, string> = {
  humain: 'Humain',
  animal: 'Animal',
  cellules: 'Cellules',
  'mecanisme-deduit': 'Mécanisme déduit',
};

export const LIBELLE_DOSES =
  'Ces valeurs décrivent des études. Elles ne disent pas quelle dose prendre.';

export const AUCUNE_DOSE_HUMAINE = 'Aucune donnée de dose chez l’humain.';

export const OBSERVATION_PERSONNELLE = 'observation personnelle, non généralisable';

/**
 * Les familles dont le tableau est **masqué par défaut** (décision 8).
 *
 * Masqué, pas absent : la personne l'ouvre d'un geste, après une
 * confirmation. Le but n'est pas de lui cacher la littérature, c'est de ne
 * pas poser un tableau de doses sous les yeux de quelqu'un qui venait
 * déclarer une prise.
 */
export const FAMILLES_MASQUEES = [
  'androgenes',
  'anabolisants',
  'stimulants',
  'opioides',
  'psychedeliques',
] as const;

export type FamilleMasquee = (typeof FAMILLES_MASQUEES)[number];

export interface LigneDose {
  /** Toujours « humain » : une dose animale n'est jamais affichée comme dose. */
  provenance: 'humain';
  dose: string;
  voie: string;
  frequence: string;
  population: string;
  effectif: string;
  duree: string;
  effet: string;
  indesirables: string;
  typeEtude: string;
  source: Source;
}

/** Les formules interdites dans un tableau de doses. */
export const FORMULES_INTERDITES = [
  'dose efficace',
  'dose optimale',
  'dose habituelle',
  'minimale efficace',
  'dose typique',
  'equivalent a',
  'plus puissant',
  'moins puissant',
];

export function controlerLigneDose(l: LigneDose): string[] {
  const problemes: string[] = [];
  if (l.provenance !== 'humain') {
    problemes.push('Une dose animale ou cellulaire ne s’affiche pas comme une dose.');
  }
  for (const [champ, v] of [
    ['dose', l.dose],
    ['voie', l.voie],
    ['population', l.population],
    ['effectif', l.effectif],
    ['durée', l.duree],
    ['type d’étude', l.typeEtude],
  ] as [string, string][]) {
    if (!v?.trim()) problemes.push(`Une ligne de dose sans ${champ} n’est pas affichable.`);
  }
  if (!l.source?.ou?.trim()) problemes.push('Une ligne de dose sans source n’est pas affichable.');
  const t = replier(`${l.dose} ${l.effet} ${l.typeEtude}`);
  for (const mot of FORMULES_INTERDITES) {
    if (t.includes(replier(mot))) problemes.push(`La ligne emploie « ${mot} », que H.9 interdit.`);
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   La fiche minimale (2.8, décision 13)
   ══════════════════════════════════════════════════════════════════════════ */

export const BANDEAU_SANS_FICHE =
  'Aucune fiche Cyclades pour cette molécule : ses effets et ses interactions n’ont pas ' +
  'été examinés par l’application. L’absence d’alerte ne signifie pas l’absence de risque.';

export const NON_DOCUMENTE = 'Non documenté';

/* ══════════════════════════════════════════════════════════════════════════
   Les interactions connues — phase 2, 16 octobre 2026

   **Des faits dérivés, jamais une recopie.** C'est la décision 8 du plan,
   et elle commande la forme de tout ce qui suit : le dépôt est public, le
   Thésaurus de l'ANSM ne l'est pas sous cette forme. Chaque paire porte
   donc trois choses — les deux substances, le **niveau** que l'agence lui
   donne, et où le lire. Pas une ligne du mécanisme, pas un mot de la
   conduite à tenir : ce sont eux, le contenu du Thésaurus, et c'est à
   l'ANSM de les publier.

   Le niveau, lui, est un fait : quatre valeurs possibles, une par paire,
   et c'est précisément ce que Cyclades a besoin de savoir pour alerter.

   ## D'où vient ce premier lot

   Du Thésaurus de **septembre 2023**, déposé dans la collecte du pilote
   du 14 octobre. Onze paires, qui sont toutes celles que le document
   donne pour les trois molécules du catalogue qui y figurent. La
   N-acétylcystéine n'a **aucune entrée** à l'index des substances — ce
   n'est pas un oubli de ma part, et ce n'est pas non plus une absence
   d'interaction : c'est une absence du document, ce qui n'est pas la
   même chose et que le statut `non-documentee` dit exactement.

   La testostérone, elle, n'a pas d'entrée propre : l'index renvoie à la
   classe **androgènes**, et c'est sous ce nom que le Thésaurus la traite
   — avec l'androstanolone et la noréthandrolone. Les paires portent donc
   le nom de la classe, parce que c'est ce que la source dit ; prétendre
   que l'entrée vise la testostérone seule serait la surinterpréter.
   ══════════════════════════════════════════════════════════════════════════ */

/** Le document, cité une fois. Son empreinte vaut pour les onze paires. */
const THESAURUS: Source = {
  nom: 'Thésaurus des interactions médicamenteuses, ANSM, version de septembre 2023',
  ou:
    'sources/collecte-pilote-2026-10-14/documents/' +
    'collecte-01-sante-D2-D8-D9-E1-E2-E3-G1-G2/E2-ansm-thesaurus-interactions-septembre-2023.pdf',
  le: '2026-10-16',
  empreinte: '0db64c85e805a8cf03c304d2c378045a50766d7c2faed6911871eaf091df4f37',
};

/**
 * Les quatre niveaux de l'ANSM, écrits comme l'agence les écrit.
 *
 * Une constante par niveau, et non une chaîne recopiée onze fois : onze
 * occurrences d'« Association déconseillée » finiraient par comporter une
 * variante, et c'est sur une variante qu'un écran cesse de reconnaître la
 * gravité qu'il doit afficher en rouge.
 */
export const NIVEAUX_ANSM = {
  contreIndication: 'Contre-indication',
  deconseillee: 'Association déconseillée',
  precaution: 'Précaution d’emploi',
  aPrendreEnCompte: 'À prendre en compte',
} as const;

/** Une paire documentée par le Thésaurus : le niveau, et la page où le lire. */
const duThesaurus = (
  a: string,
  b: string,
  niveau: string,
  page: number,
): PaireInteraction => ({
  a,
  b,
  statut: 'documentee',
  base: null,
  gravite: {
    connue: true,
    valeur: niveau,
    source: { ...THESAURUS, nom: `${THESAURUS.nom}, p. ${page}` },
  },
});

/**
 * Les interactions du premier lot.
 *
 * **Onze, et pas une de plus.** Ce que le Thésaurus donne pour les
 * molécules du catalogue, exhaustivement, et rien d'ailleurs. Une douzième
 * paire « de bon sens » serait une paire inventée, et le prompt 25 range
 * ce genre d'invention parmi les dangers, pas parmi les services.
 */
export const INTERACTIONS: readonly PaireInteraction[] = [
  /* Androgènes — la classe sous laquelle le Thésaurus traite la testostérone. */
  duThesaurus('androgènes', 'antivitamines K', NIVEAUX_ANSM.precaution, 17),
  duThesaurus('androgènes', 'inducteurs enzymatiques', NIVEAUX_ANSM.precaution, 17),

  /* Modafinil — entrée en propre. */
  duThesaurus('modafinil', 'ciclosporine', NIVEAUX_ANSM.deconseillee, 177),
  duThesaurus('modafinil', 'estroprogestatifs contraceptifs', NIVEAUX_ANSM.deconseillee, 177),

  /* Caféine — entrée en propre, sept paires. */
  duThesaurus('caféine', 'ciprofloxacine', NIVEAUX_ANSM.aPrendreEnCompte, 47),
  duThesaurus('caféine', 'dipyridamole', NIVEAUX_ANSM.precaution, 47),
  duThesaurus('caféine', 'énoxacine', NIVEAUX_ANSM.deconseillee, 47),
  duThesaurus('caféine', 'lithium', NIVEAUX_ANSM.aPrendreEnCompte, 47),
  duThesaurus('caféine', 'méxilétine', NIVEAUX_ANSM.aPrendreEnCompte, 47),
  duThesaurus('caféine', 'norfloxacine', NIVEAUX_ANSM.aPrendreEnCompte, 47),
  duThesaurus('caféine', 'stiripentol', NIVEAUX_ANSM.precaution, 47),
];

/**
 * Les molécules du catalogue que le Thésaurus ne connaît pas.
 *
 * Déclarées, parce que « absent du document » et « sans interaction » se
 * ressemblent à l'écran et ne se ressemblent pas du tout. Une molécule
 * d'ici doit rendre `non-documentee`, qui veut dire « personne n'a
 * publié », et jamais `etudiee-sans-interaction`, qui voudrait dire
 * « quelqu'un a cherché et n'a rien trouvé ».
 */
export const ABSENTES_DU_THESAURUS: readonly string[] = ['n-acétylcystéine'];
