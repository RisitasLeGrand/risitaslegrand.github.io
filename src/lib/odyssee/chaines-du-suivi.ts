/**
 * Les chaînes imposées du suivi personnel, et les mots qu'il n'emploie pas.
 *
 * ## Pourquoi un fichier, et pourquoi avant les écrans
 *
 * Le § 9 du plan de phase 0 le demande ainsi : « un fichier unique,
 * versionné, relu par toi ». L'ordre compte. Une phrase imposée écrite dans
 * l'écran qui l'affiche se relit à l'endroit où elle sert, c'est-à-dire
 * nulle part : il faut ouvrir onze fichiers pour vérifier que les onze
 * mentions obligatoires y sont, et rien ne signale celle qui manque. Ici,
 * elles sont ensemble, le contrôle les compte, et l'écran les emprunte.
 *
 * Plusieurs de ces chaînes n'ont **aucun appelant aujourd'hui** : les écrans
 * qu'elles habilleront viennent aux lots 5 à 8. C'est voulu, et c'est la
 * raison d'être du fichier — elles sont relues maintenant, par une personne,
 * avant qu'un écran ne les affiche. `essais:vocabulaire` leur sert
 * d'appelant en attendant, en vérifiant qu'elles sont là et qu'aucune n'est
 * vide.
 *
 * ## Ce que ce fichier n'est pas
 *
 * Ce n'est pas une sixième liste de mots interdits. Le dépôt en porte déjà
 * — `MOTS_INTERDITS` dans Psyché, `MOTS_INTERDITS_FINANCES`,
 * `MOTS_INTERDITS_VEILLE`, `MOTS_DE_CAUSE` dans les tendances,
 * `VERBES_INTERDITS` et `FORMULES_INTERDITES` dans les molécules. Le
 * balayage les **lit là où elles sont** plutôt que d'en recopier le contenu :
 * une copie se désynchronise en silence, et le jour où l'une d'elles
 * s'allonge, la copie mentirait sans que rien ne le dise.
 *
 * `MOTS_INTERDITS_SUIVI` ci-dessous ne double aucune d'elles : ce sont les
 * mots propres à ce domaine, que le § 9 nomme et qu'aucune liste existante
 * ne porte.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Les chaînes imposées
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une chaîne que Cyclades doit afficher mot pour mot, et d'où elle vient.
 *
 * `origine` n'est pas de la documentation : c'est ce qui permet de retrouver
 * la demande quand la phrase paraîtra maladroite à quelqu'un, dans six mois,
 * et d'éviter qu'on la « améliore ».
 */
export interface ChaineImposee {
  /** Le texte, exactement. */
  texte: string;
  /** Le point du prompt qui l'impose. */
  origine: string;
}

const C = (texte: string, origine: string): ChaineImposee => ({ texte, origine });

/**
 * Les dix chaînes du § 9, à la lettre.
 *
 * Deux portent un gabarit entre crochets — `retard.constat` attend un nombre
 * de jours. Elles sont stockées avec le gabarit visible plutôt qu'en
 * fonction : une fonction cacherait le texte imposé derrière une
 * concaténation, et la relecture porterait sur le code au lieu de la phrase.
 */
export const CHAINES_IMPOSEES = {
  'mention.pas-contraceptif': C(
    'Cyclades n’est pas une méthode contraceptive et n’est pas un dispositif médical.',
    '1 n° 2',
  ),
  'mention.ouverture-module': C(
    'Cyclades n’est pas une méthode contraceptive, n’est pas un dispositif médical et ne ' +
      'remplace pas un professionnel de santé.',
    '4.0',
  ),
  'retard.constat': C(
    'Aucun début de règles n’est enregistré depuis [N] jours après la fin de la plage ' +
      'estimée. Vous pouvez saisir vos règles, ou indiquer « règles sautées » ou « saisie ' +
      'oubliée ».',
    '4.4.4',
  ),
  'orientation.cloture': C(
    'Cela peut avoir de nombreuses causes. À signaler à un professionnel de santé, notamment ' +
      'si cela vous gêne.',
    '4.4.5',
  ),
  'fiche.bloc-final': C(
    'D’autres facteurs, mesurés ou non par Cyclades, ont pu intervenir.',
    '5.3',
  ),
  'fiche.pas-explication': C('Ce n’est pas une explication.', '5.3'),
  'piste.avertissement': C('piste, pas une cause', '5.4'),
  'rdv.pas-diagnostic': C('Document factuel, pas un diagnostic.', '4.4.7'),
  'repere.general': C('repère général, pas une prévision', '4.4.4'),
} as const satisfies Record<string, ChaineImposee>;

export type CleDeChaine = keyof typeof CHAINES_IMPOSEES;

/** Le texte d'une chaîne imposée. Passe par la clé, jamais par une copie. */
export const chaineImposee = (cle: CleDeChaine): string => CHAINES_IMPOSEES[cle].texte;

/**
 * La dixième entrée du § 9 — `doc.citations` — n'est pas ici.
 *
 * Le § 9 la décrit comme « citations de l'étude de 2019, entre guillemets,
 * avec leur source », c'est-à-dire non pas une chaîne mais une **forme**.
 * Elle est portée par `Citation` ci-dessous, et son contenu arrivera avec la
 * source : l'étude de 2019 n'est pas atteignable depuis ce conteneur.
 */
export const CITATIONS_SANS_SOURCE_ATTEIGNABLE = 'doc.citations' as const;

/* ══════════════════════════════════════════════════════════════════════════
   Les citations, et pourquoi elles sont une structure et non des guillemets
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une phrase reprise d'une source, affichable telle quelle.
 *
 * ## La structure EST l'exemption, et ce n'est pas un détail de mise en œuvre
 *
 * Le § 9 interdit certains mots « hors citation d'une source ». Il faut donc
 * que le balayage sache reconnaître une citation. S'il le décidait sur la
 * présence de guillemets, l'exemption serait un trou : n'importe quelle
 * phrase d'écran peut porter des guillemets, et il suffirait d'en mettre
 * autour d'une affirmation maison pour la faire passer.
 *
 * Une citation est donc un objet qui **nomme sa source**. Le balayage
 * exempte les champs de cet objet, et rien d'autre. Une phrase qui voudrait
 * dire « anormal » devrait se déclarer comme citation d'une source nommée —
 * c'est-à-dire faire exactement le geste qu'on veut rendre visible.
 *
 * Trois familles en ont besoin, et elles sont apparues dans cet ordre :
 * les citations de source (les signes d'alerte), les déclarations de
 * prohibition (une liste de mots interdits contient forcément des mots
 * interdits), et les énoncés d'instruments validés — les items du WHO-5, du
 * PHQ-9 et du GAD-7 portent « senti(e) » et « déprimé(e) », et corriger
 * l'énoncé d'un instrument validé serait plus grave que la faute de format
 * qu'on y lit.
 */
export interface Citation {
  /** Le texte, mot pour mot, tel que la source l'écrit. */
  texte: string;
  /** La source, telle que la collecte la numérote et la nomme. */
  source: string;
  /** La page ou la section, quand la source en porte. */
  ou?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les mots que ce domaine n'emploie pas
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les mots interdits propres au suivi, hors citation d'une source.
 *
 * Ils viennent du § 9. Aucun n'est dans une liste existante du dépôt, et
 * c'est pourquoi celle-ci existe. « cause » n'y figure pas en tant que mot :
 * le § 9 l'interdit « hors liste blanche », et deux chaînes imposées le
 * portent — `orientation.cloture` et `piste.avertissement`. C'est donc la
 * liste blanche qui l'autorise, pas un mot à bannir.
 */
export const MOTS_INTERDITS_SUIVI: readonly string[] = [
  'normal',
  'anormal',
  'jours sûrs',
  'fertile',
  'infertile',
  'tout va bien',
  'rassurant',
  'idéal',
  'optimal',
  'diagnostic',
];

/**
 * Les libellés de ce domaine autorisés à porter « cycle » ou « phase ».
 *
 * ## Pourquoi une liste d'autorisés plutôt qu'une règle de qualificatif
 *
 * Le § 9 demande qu'« aucun libellé ne dise "cycle" ou "phase" sans
 * qualificatif dans une zone où les deux sens coexistent ». Une règle qui
 * chercherait un qualificatif devrait savoir ce qui qualifie, et se
 * contenterait du premier mot qui suit : « phase de test » passerait.
 *
 * Une liste d'autorisés, dont la **taille est elle-même vérifiée**, demande
 * un geste délibéré et visible en relecture. C'est le motif de la liste
 * `AUTORISES` du graphe d'imports, et c'est celui qui a le mieux tenu dans
 * ce projet.
 *
 * La zone concernée est Odyssée > Corps, où le statut hormonal porte déjà
 * une nature « cycle » au sens d'une cure de substances, et où le cycle
 * menstruel arrivera.
 */
export const LIBELLES_AUTORISES_CYCLE_OU_PHASE: readonly string[] = [
  /*
     Le statut hormonal. « Phase de cure » et non « Phase du cycle » : dans
     une liste qui dit par ailleurs « Traitement hormonal » et « Substance »,
     « cycle » désigne une cure — et il allait désigner les règles le jour où
     le suivi arriverait. Décision B du plan, premier temps : le libellé
     change, la clé stockée ne bouge pas, aucune migration.
  */
  'Phase de cure',
];
