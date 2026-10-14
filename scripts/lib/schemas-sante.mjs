/**
 * Les schémas des fichiers déclaratifs de Santé et de Musculation.
 *
 * ## Ce que ces schémas existent pour rendre impossible
 *
 * La règle du chantier tient en une phrase, reprise du prompt (0.3) : **aucune
 * valeur numérique n'entre dans l'application sans sa source**, et « inconnu »
 * plutôt qu'une valeur inventée, partout.
 *
 * Une règle écrite dans un document est une intention. Ici elle devient une
 * condition de build : une demi-vie posée sans référence, sans date de
 * consultation et sans niveau de confiance **ne passe pas**. C'est tout
 * l'objet de ces schémas, et c'est pourquoi ils arrivent avant le moindre
 * écran — après, il serait trop tard : une valeur entrée sans source dans un
 * fichier qu'on relit six mois plus tard ne se distingue plus d'une valeur
 * sourcée dont on a perdu la référence.
 *
 * ## Pourquoi « inconnue » est une valeur de première classe
 *
 * Elle n'est pas l'absence du champ : c'est une **affirmation**, celle qu'on a
 * cherché et qu'on n'a pas trouvé. Le champ `demiVie` vaut donc soit
 * `'inconnue'`, soit un objet complet avec sa source. Rendre le champ
 * optionnel aurait laissé un troisième état — « pas encore regardé » —
 * impossible à distinguer à l'écran des deux autres, et c'est précisément la
 * distinction qui compte pour quelqu'un qui décide d'une prise.
 *
 * ## Ce que ces schémas ne font pas
 *
 * ## Pourquoi tous sont « stricts »
 *
 * Un objet qui accepte les champs en trop accepte une dose glissée dans une
 * fiche de molécule. L'essai l'a montré avant que le premier fichier
 * n'existe : sans `.strict()`, `{ ..., dose: 200 }` passait. Un champ qu'on
 * n'a pas prévu n'est pas une tolérance, c'est une porte.
 *
 * Ils ne jugent pas une source. Qu'une référence soit un RCP ou un billet de
 * forum, ils l'acceptent — mais le `type` et la `confiance` sont obligatoires
 * et énumérés, donc la faiblesse d'une source est **écrite** et affichable, et
 * non pas tue. Le jugement reste humain ; le schéma garantit seulement qu'il y
 * a de quoi juger.
 */
import { z } from 'zod';

/** Les types de source admis, du plus fort au plus faible. Repris du registre. */
export const TYPES_DE_SOURCE = [
  'rcp',
  'agence',
  'recommandation',
  'revue-systematique',
  'meta-analyse',
  'essai',
  'preprint',
  'praticien',
  'encyclopedie',
];

/** Les niveaux de confiance, également repris du registre des sources. */
export const CONFIANCES = ['solide', 'plausible', 'faible', 'heuristique', 'controverse'];

/**
 * Une référence : de quoi il s'agit, où, quand consultée, et ce qu'elle vaut.
 *
 * `consulteeLe` est la date de **consultation**, pas de publication : c'est
 * elle qui dit si la vérification est encore fraîche, et c'est la seule des
 * deux qu'on puisse garantir exacte.
 */
export const reference = z.object({
  intitule: z.string().min(8, 'Une référence se retrouve : donnez-en l’intitulé complet.'),
  type: z.enum(TYPES_DE_SOURCE),
  evalueeParLesPairs: z.union([z.boolean(), z.literal('sans-objet')]),
  consulteeLe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de consultation au format AAAA-MM-JJ.'),
  lien: z.string().url().nullable(),
  confiance: z.enum(CONFIANCES),
  /** La population ou la condition de validité : « adulte sain », « à jeun ». */
  valablePour: z.string().min(3, 'Une valeur vaut pour quelqu’un, dans des conditions : dites-les.'),
}).strict();

/**
 * Une valeur chiffrée **et** sa source, ou l'aveu qu'on ne sait pas.
 *
 * Les deux branches sont exclusives et toutes deux explicites : c'est ce qui
 * interdit le troisième état silencieux.
 */
export const valeurSourcee = (unites) =>
  z.union([
    z.literal('inconnue'),
    z.object({
      valeur: z.number().finite(),
      unite: z.enum(unites),
      /** Une fourchette quand la source en donne une : un chiffre seul ment moins s'il est borné. */
      intervalle: z.tuple([z.number(), z.number()]).nullable(),
      source: reference,
    }).strict(),
  ]);

export const MATURITES = [
  'medicament-autorise',
  'medicament-hors-amm',
  'complement-alimentaire',
  'molecule-de-recherche',
  'inconnue',
];

export const STATUTS_ANTIDOPAGE = ['interdit', 'interdit-en-competition', 'autorise', 'inconnu'];

/** Une molécule du catalogue. */
export const molecule = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'L’identifiant est en minuscules, chiffres et tirets.'),
  nom: z.string().min(2),
  synonymes: z.array(z.string()),
  maturiteClinique: z.enum(MATURITES),
  /** Existe-t-il des données **chez l'humain** ? La question précède toute dose. */
  donneesHumaines: z.union([z.boolean(), z.literal('inconnu')]),
  statutAntidopage: z.enum(STATUTS_ANTIDOPAGE),
  demiVie: valeurSourcee(['h', 'j']),
  /*
     Pas de champ « dose ». C'est délibéré et ce n'est pas un oubli : une dose
     affichée est une dose proposée, quel que soit l'avertissement qui
     l'entoure. Le catalogue décrit une molécule ; il ne conseille pas.
  */
  notes: z.array(z.object({ texte: z.string().min(10), source: reference }).strict()),
}).strict();

/** Une interaction entre deux molécules ou deux classes. */
export const interaction = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  entre: z.tuple([z.string(), z.string()]),
  famille: z.enum(['pharmacocinetique', 'pharmacodynamique', 'additive', 'documentee-par-cas']),
  statut: z.enum(['deconseille', 'surveillance', 'sans-consequence-connue', 'inconnu']),
  explication: z.string().min(20, 'Une interaction qu’on ne sait pas expliquer ne s’affiche pas.'),
  source: reference,
}).strict();

/** Une méthode d'entraînement. */
export const methode = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  nom: z.string().min(3),
  resume: z.string().min(20),
  /** L'étiquette de preuve est obligatoire : une méthode sans elle serait un avis. */
  niveauDePreuve: z.enum(CONFIANCES),
  sources: z.array(reference).min(1, 'Une méthode sans aucune source n’entre pas.'),
}).strict();

/** Une question d'initialisation « Approfondi ». */
export const question = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  chapitre: z.number().int().min(1).max(6),
  intitule: z.string().min(8),
  forme: z.enum(['choix-unique', 'choix-multiple', 'nombre', 'texte-court', 'oui-non']),
  options: z.array(z.string()),
  /** Ce que la réponse renseigne : un champ du profil, nommé. */
  renseigne: z.string().min(3),
  /** Toujours sautable : une initialisation qui exige une réponse se referme. */
  facultative: z.literal(true),
}).strict();

export const SCHEMAS = { molecule, interaction, methode, question };
