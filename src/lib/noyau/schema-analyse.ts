/**
 * Le format strict d'une analyse produite par une IA — **déclaré une fois**.
 *
 * ## Pourquoi un schéma déclaré, et non un fichier JSON écrit à la main
 *
 * Trois choses ont besoin du même schéma, et elles doivent dire la même :
 *
 * 1. le **fichier `schema-analyse.json`** servi avec l'export, que l'IA lit ;
 * 2. le **validateur** de l'import, qui refuse ce qui n'est pas conforme ;
 * 3. l'**exemple** `exemple-analyse.json`, qui doit passer ce validateur.
 *
 * Un `schema-analyse.json` écrit à la main et un validateur écrit à la main
 * divergent au premier champ ajouté, et la divergence ne se voit pas : l'IA suit
 * le fichier, le site suit son code, et l'import refuse une réponse pourtant
 * conforme à ce qu'on a demandé. Le schéma est donc **une donnée**, le fichier
 * en est le rendu, et le validateur en est le lecteur.
 *
 * ## Le validateur est écrit à la main, et c'est un choix
 *
 * Une bibliothèque de validation JSON Schema générique pèserait plus que ce
 * qu'elle apporte pour un schéma fermé de cette taille, et les messages d'erreur
 * en français avec le chemin exact — « constats[2].preuves[0].indicateur :
 * identifiant inconnu » — sont précisément ce qu'une bibliothèque rend mal.
 * Ce module porte la **déclaration** ; le validateur viendra la lire.
 *
 * ## Ce que le format interdit, et pourquoi
 *
 * La `nature` d'une proposition est fermée à l'organisation, aux habitudes, aux
 * mesures, aux questions et aux vérifications de données. **Ni dose, ni
 * protocole, ni recommandation d'investissement** : les garde-fous E.1 et E.4
 * ne reposent pas sur la bonne volonté du modèle, mais sur une énumération
 * fermée qui refuse la réponse à l'import.
 */

export const FORMAT_ANALYSE = 'cyclades-analyse';
export const VERSION_ANALYSE = 1;

/* ══════════════════════════════════════════════════════════════════════════
   Les énumérations fermées
   ══════════════════════════════════════════════════════════════════════════ */

export const DOMAINES_ANALYSE: readonly string[] = [
  'corps',
  'cognition',
  'connaissances',
  'psyche',
  'finances',
  'lien',
  'ordre',
  'oeuvre',
  'transverse',
];

export const TYPES_CONSTAT: readonly string[] = [
  'tendance',
  'anomalie',
  'correlation',
  'progres',
  'risque',
  'lacune_de_donnees',
];

export const CONFIANCES: readonly string[] = ['faible', 'moyenne', 'elevee'];

/**
 * Les natures de proposition admises.
 *
 * Fermée volontairement. Une IA qui proposerait une dose, un protocole
 * d'entraînement ou un placement n'a aucune valeur de `nature` pour le dire :
 * sa réponse est refusée à l'import, et le refus ne dépend pas de la prudence
 * du modèle.
 */
export const NATURES_PROPOSITION: readonly string[] = [
  'organisation',
  'habitude',
  'mesure',
  'question',
  'verification_donnee',
];

/* ══════════════════════════════════════════════════════════════════════════
   Les plafonds
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les bornes de volume et de longueur.
 *
 * Elles ne sont pas de la méfiance envers le modèle : ce sont les bornes de ce
 * qu'une personne peut trier. Trente constats font déjà une heure de lecture ;
 * cent en feraient un document qu'on referme.
 */
export const PLAFONDS = {
  constats: 30,
  propositions: 15,
  questions: 20,
  qualite: 30,
  preuvesParConstat: 10,
  explicationsParConstat: 5,
  liensParProposition: 10,
  /** Un texte court : un énoncé, un titre. */
  texteCourt: 300,
  /** Un texte long : une description, des limites. */
  texteLong: 2000,
  /** Le résumé d'ensemble. */
  resume: 4000,
  /** Taille maximale du document importé, en octets. */
  octets: 2 * 1024 * 1024,
  horizonSemaines: 104,
} as const;

/* ══════════════════════════════════════════════════════════════════════════
   La déclaration
   ══════════════════════════════════════════════════════════════════════════ */

export type Forme =
  | { quoi: 'texte'; max: number; min?: number }
  | { quoi: 'entier'; min: number; max: number }
  | { quoi: 'nombre' }
  | { quoi: 'booleen' }
  /** `AAAA-MM-JJ`. */
  | { quoi: 'date' }
  /** ISO 8601 avec fuseau. */
  | { quoi: 'horodatage' }
  /** `sha256:` suivi de soixante-quatre chiffres hexadécimaux. */
  | { quoi: 'empreinte' }
  | { quoi: 'enumeration'; valeurs: readonly string[] }
  | { quoi: 'litteral'; valeur: string | number }
  /** Un identifiant interne à l'analyse : `c1`, `p2`, `q3`. */
  | { quoi: 'identifiant' }
  /** Un identifiant d'indicateur du catalogue : `cog.temps-revision`. */
  | { quoi: 'indicateur' }
  | { quoi: 'objet'; champs: Record<string, Champ> }
  | { quoi: 'liste'; de: Forme; max: number; min?: number };

export interface Champ {
  forme: Forme;
  requis: boolean;
  /** Ce que le champ attend, en français. Sert au schéma **et** aux messages. */
  libelle: string;
}

const C = (forme: Forme, libelle: string, requis = true): Champ => ({ forme, requis, libelle });

const PERIODE: Forme = {
  quoi: 'objet',
  champs: {
    debut: C({ quoi: 'date' }, 'Premier jour de la période, au format AAAA-MM-JJ.'),
    fin: C({ quoi: 'date' }, 'Dernier jour de la période, au format AAAA-MM-JJ.'),
  },
};

const PREUVE: Forme = {
  quoi: 'objet',
  champs: {
    indicateur: C(
      { quoi: 'indicateur' },
      'Identifiant d’un indicateur du catalogue fourni dans indicateurs.json.',
    ),
    periode: C(PERIODE, 'La période sur laquelle la valeur est citée.'),
    valeur_citee: C({ quoi: 'nombre' }, 'La valeur que vous citez, telle que vous l’avez lue.'),
    unite: C({ quoi: 'texte', max: 40 }, 'L’unité de la valeur, telle que le catalogue la donne.'),
  },
};

const CONSTAT: Forme = {
  quoi: 'objet',
  champs: {
    id: C({ quoi: 'identifiant' }, 'Identifiant unique du constat, par exemple « c1 ».'),
    domaine: C({ quoi: 'enumeration', valeurs: DOMAINES_ANALYSE }, 'Le domaine concerné.'),
    type: C({ quoi: 'enumeration', valeurs: TYPES_CONSTAT }, 'La nature du constat.'),
    enonce: C({ quoi: 'texte', max: PLAFONDS.texteCourt, min: 10 }, 'Le constat, en une phrase.'),
    confiance: C({ quoi: 'enumeration', valeurs: CONFIANCES }, 'Votre confiance dans ce constat.'),
    preuves: C(
      { quoi: 'liste', de: PREUVE, max: PLAFONDS.preuvesParConstat, min: 1 },
      'Au moins une preuve chiffrée, rattachée à un indicateur du catalogue.',
    ),
    explications_alternatives: C(
      {
        quoi: 'liste',
        de: { quoi: 'texte', max: PLAFONDS.texteCourt },
        max: PLAFONDS.explicationsParConstat,
      },
      'D’autres lectures possibles du même constat.',
      false,
    ),
    limites: C(
      { quoi: 'texte', max: PLAFONDS.texteLong },
      'Ce que ce constat ne permet pas de conclure.',
      false,
    ),
  },
};

const PROPOSITION: Forme = {
  quoi: 'objet',
  champs: {
    id: C({ quoi: 'identifiant' }, 'Identifiant unique de la proposition, par exemple « p1 ».'),
    domaine: C({ quoi: 'enumeration', valeurs: DOMAINES_ANALYSE }, 'Le domaine concerné.'),
    nature: C(
      { quoi: 'enumeration', valeurs: NATURES_PROPOSITION },
      'La nature de la proposition : ni dose, ni protocole, ni placement.',
    ),
    titre: C({ quoi: 'texte', max: PLAFONDS.texteCourt, min: 5 }, 'Le titre, en une ligne.'),
    description: C(
      { quoi: 'texte', max: PLAFONDS.texteLong, min: 10 },
      'Ce qu’il s’agit de faire, concrètement.',
    ),
    horizon_semaines: C(
      { quoi: 'entier', min: 1, max: PLAFONDS.horizonSemaines },
      'Sur combien de semaines la proposition porte.',
    ),
    indicateur_de_suivi: C(
      { quoi: 'indicateur' },
      'L’indicateur du catalogue qui dira si la proposition a servi.',
    ),
    lie_aux_constats: C(
      { quoi: 'liste', de: { quoi: 'identifiant' }, max: PLAFONDS.liensParProposition, min: 1 },
      'Les identifiants des constats dont la proposition découle.',
    ),
    avertissement_professionnel: C(
      { quoi: 'booleen' },
      'Vrai si la proposition touche au corps, à la santé ou aux finances.',
    ),
  },
};

const QUESTION: Forme = {
  quoi: 'objet',
  champs: {
    id: C({ quoi: 'identifiant' }, 'Identifiant unique de la question, par exemple « q1 ».'),
    question: C({ quoi: 'texte', max: PLAFONDS.texteCourt, min: 10 }, 'La question posée.'),
    pourquoi: C(
      { quoi: 'texte', max: PLAFONDS.texteLong, min: 10 },
      'Pourquoi la réponse changerait votre lecture.',
    ),
  },
};

const QUALITE: Forme = {
  quoi: 'objet',
  champs: {
    domaine: C({ quoi: 'enumeration', valeurs: DOMAINES_ANALYSE }, 'Le domaine concerné.'),
    probleme: C(
      { quoi: 'texte', max: PLAFONDS.texteCourt, min: 10 },
      'Ce qui manque ou ce qui semble douteux dans les données.',
    ),
    reference: C(
      { quoi: 'texte', max: PLAFONDS.texteCourt },
      'Où vous l’avez vu : un identifiant d’indicateur, une période.',
      false,
    ),
  },
};

/** Le schéma racine d'une analyse. */
export const SCHEMA_ANALYSE: Record<string, Champ> = {
  format: C({ quoi: 'litteral', valeur: FORMAT_ANALYSE }, 'Toujours « cyclades-analyse ».'),
  version: C({ quoi: 'litteral', valeur: VERSION_ANALYSE }, 'La version du format : 1.'),
  export_id: C(
    { quoi: 'texte', max: 64, min: 1 },
    'L’identifiant de l’export, repris du manifeste.',
  ),
  export_empreinte: C(
    { quoi: 'empreinte' },
    'L’empreinte de l’export, reprise du manifeste, préfixée « sha256: ».',
  ),
  genere_le: C({ quoi: 'horodatage' }, 'Quand l’analyse a été produite, en ISO 8601 avec fuseau.'),
  periode: C(PERIODE, 'La période analysée, reprise du manifeste.'),
  resume: C(
    { quoi: 'texte', max: PLAFONDS.resume, min: 20 },
    'Le résumé d’ensemble, en texte brut.',
  ),
  constats: C(
    { quoi: 'liste', de: CONSTAT, max: PLAFONDS.constats },
    'Les constats, chacun avec au moins une preuve.',
  ),
  propositions: C(
    { quoi: 'liste', de: PROPOSITION, max: PLAFONDS.propositions },
    'Les propositions, chacune rattachée à un constat.',
  ),
  questions_a_clarifier: C(
    { quoi: 'liste', de: QUESTION, max: PLAFONDS.questions },
    'Ce qu’il faudrait savoir pour aller plus loin.',
    false,
  ),
  qualite_des_donnees: C(
    { quoi: 'liste', de: QUALITE, max: PLAFONDS.qualite },
    'Les lacunes et les doutes sur les données.',
    false,
  ),
  limites_globales: C(
    { quoi: 'texte', max: PLAFONDS.texteLong },
    'Ce que l’analyse entière ne permet pas de conclure.',
    false,
  ),
};

/* ══════════════════════════════════════════════════════════════════════════
   Le rendu en JSON Schema
   ══════════════════════════════════════════════════════════════════════════ */

const MOTIF_IDENTIFIANT = '^[a-z][a-z0-9_-]{0,31}$';
const MOTIF_INDICATEUR = '^[a-z]+\\.[a-z0-9-]+$';
const MOTIF_DATE = '^\\d{4}-\\d{2}-\\d{2}$';
const MOTIF_EMPREINTE = '^sha256:[0-9a-f]{64}$';

export { MOTIF_DATE, MOTIF_EMPREINTE, MOTIF_IDENTIFIANT, MOTIF_INDICATEUR };

function formeEnJson(forme: Forme): Record<string, unknown> {
  switch (forme.quoi) {
    case 'texte':
      return { type: 'string', maxLength: forme.max, ...(forme.min ? { minLength: forme.min } : {}) };
    case 'entier':
      return { type: 'integer', minimum: forme.min, maximum: forme.max };
    case 'nombre':
      return { type: 'number' };
    case 'booleen':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', pattern: MOTIF_DATE };
    case 'horodatage':
      return { type: 'string', format: 'date-time' };
    case 'empreinte':
      return { type: 'string', pattern: MOTIF_EMPREINTE };
    case 'enumeration':
      return { type: 'string', enum: [...forme.valeurs] };
    case 'litteral':
      return { const: forme.valeur };
    case 'identifiant':
      return { type: 'string', pattern: MOTIF_IDENTIFIANT };
    case 'indicateur':
      return { type: 'string', pattern: MOTIF_INDICATEUR };
    case 'liste':
      return {
        type: 'array',
        maxItems: forme.max,
        ...(forme.min ? { minItems: forme.min } : {}),
        items: formeEnJson(forme.de),
      };
    case 'objet':
      return objetEnJson(forme.champs);
  }
}

function objetEnJson(champs: Record<string, Champ>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [nom, champ] of Object.entries(champs)) {
    properties[nom] = { ...formeEnJson(champ.forme), description: champ.libelle };
    if (champ.requis) required.push(nom);
  }
  return {
    type: 'object',
    // Le point qui fait tout : un champ inconnu est **refusé**. Sans cela, une
    // IA inventive glisserait un « conseil » hors énumération, et il passerait.
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
  };
}

/** Le schéma, au format JSON Schema 2020-12, tel que l'export le sert. */
export function schemaJson(): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://cyclades.local/schema-analyse-v1.json',
    title: 'Analyse Cyclades, version 1',
    description:
      'Le format strict attendu en réponse. Répondez par un seul objet JSON conforme, sans texte autour.',
    ...objetEnJson(SCHEMA_ANALYSE),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   L'exemple
   ══════════════════════════════════════════════════════════════════════════ */

export interface ContexteExemple {
  exportId: string;
  empreinte: string;
  debut: string;
  fin: string;
  /** Un indicateur réel du catalogue, pour que l'exemple soit vérifiable. */
  indicateur: string;
  unite: string;
}

/**
 * Un exemple conforme, construit sur un vrai identifiant d'indicateur.
 *
 * Il est **engendré** et non écrit à la main, pour deux raisons : il cite
 * l'identifiant d'export réel, donc l'IA voit où le reprendre, et il passe le
 * validateur par construction. Un exemple non conforme serait pire qu'aucun
 * exemple — il apprendrait le mauvais format.
 */
export function exempleAnalyse(contexte: ContexteExemple): Record<string, unknown> {
  return {
    format: FORMAT_ANALYSE,
    version: VERSION_ANALYSE,
    export_id: contexte.exportId,
    export_empreinte: contexte.empreinte,
    genere_le: `${contexte.fin}T18:00:00+02:00`,
    periode: { debut: contexte.debut, fin: contexte.fin },
    resume:
      'Exemple de réponse. Le volume de travail est régulier sur la période, et la couverture de mesure reste partielle : une seule branche publie des faits.',
    constats: [
      {
        id: 'c1',
        domaine: 'cognition',
        type: 'tendance',
        enonce:
          'Le temps de travail hebdomadaire est stable sur la période, sans rupture visible.',
        confiance: 'moyenne',
        preuves: [
          {
            indicateur: contexte.indicateur,
            periode: { debut: contexte.debut, fin: contexte.fin },
            valeur_citee: 0,
            unite: contexte.unite,
          },
        ],
        explications_alternatives: [
          'La stabilité peut venir d’une contrainte d’agenda plutôt que d’un choix.',
        ],
        limites:
          'La période est courte, et la fiabilité de l’indicateur est limitée par son effectif.',
      },
    ],
    propositions: [
      {
        id: 'p1',
        domaine: 'cognition',
        nature: 'organisation',
        titre: 'Fixer un créneau régulier plutôt que de décider chaque jour',
        description:
          'Réserver le même créneau deux fois par semaine, pour que la décision soit prise une fois pour toutes.',
        horizon_semaines: 4,
        indicateur_de_suivi: contexte.indicateur,
        lie_aux_constats: ['c1'],
        avertissement_professionnel: false,
      },
    ],
    questions_a_clarifier: [
      {
        id: 'q1',
        question: 'Les semaines creuses correspondent-elles à des contraintes extérieures ?',
        pourquoi:
          'Une baisse choisie et une baisse subie ne se corrigent pas de la même manière.',
      },
    ],
    qualite_des_donnees: [
      {
        domaine: 'connaissances',
        probleme: 'Plusieurs indicateurs du domaine n’ont aucune source sur la période.',
        reference: 'qualite-des-donnees.md',
      },
    ],
    limites_globales:
      'Cette analyse ne porte que sur les indicateurs fournis, et ne dit rien des domaines non mesurés.',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle de la déclaration
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Vérifie que la déclaration tient debout.
 *
 * Deux invariants comptent. Que **chaque champ porte un libellé en français** :
 * c'est lui que le schéma servi à l'IA affiche, et c'est lui que le message
 * d'erreur du validateur reprendra. Et qu'**aucune énumération ne soit vide**,
 * car une énumération vide refuse toutes les valeurs, y compris les justes.
 */
export function controlerSchema(): string[] {
  const problemes: string[] = [];
  const visiter = (forme: Forme, chemin: string) => {
    if (forme.quoi === 'enumeration' && !forme.valeurs.length) {
      problemes.push(`L’énumération de « ${chemin} » est vide : elle refuserait tout.`);
    }
    if (forme.quoi === 'texte' && forme.max <= 0) {
      problemes.push(`La longueur maximale de « ${chemin} » doit être positive.`);
    }
    if (forme.quoi === 'liste') {
      if (forme.max <= 0) problemes.push(`Le plafond de « ${chemin} » doit être positif.`);
      visiter(forme.de, `${chemin}[]`);
    }
    if (forme.quoi === 'objet') {
      for (const [nom, champ] of Object.entries(forme.champs)) {
        if (champ.libelle.trim().length < 10 || !champ.libelle.trim().endsWith('.')) {
          problemes.push(`Le champ « ${chemin}.${nom} » n’a pas de libellé en phrase française.`);
        }
        visiter(champ.forme, `${chemin}.${nom}`);
      }
    }
  };
  visiter({ quoi: 'objet', champs: SCHEMA_ANALYSE }, 'analyse');
  return problemes;
}
