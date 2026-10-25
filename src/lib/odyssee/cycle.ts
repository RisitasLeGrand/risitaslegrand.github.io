/**
 * Le suivi personnel : la forme de ce qui est saisi, et rien de plus.
 *
 * ## Ce que ce fichier contient, et ce qu'il ne contient pas encore
 *
 * Deux formes et leurs contrôles. Pas de calcul de cycle, pas de
 * statistique, pas de fenêtre : ils viennent au lot suivant, et ils
 * demandent des paramètres de produit qu'Alexis n'a pas encore tranchés
 * (décision 24 : « proposés chiffrés en phase 3, aucun appliqué avant ta
 * réponse »).
 *
 * Les formes arrivent maintenant parce que la confidentialité arrive
 * maintenant : on ne peut pas déclarer un magasin scellé sans dire ce qu'il
 * range.
 *
 * ## Le vocabulaire de l'écran, et pourquoi il est si pauvre ici
 *
 * La décision 4.8 — la discrétion — veut que le mot « règles » n'apparaisse
 * qu'à l'intérieur du module. Les identifiants de ce fichier le respectent
 * déjà : un `niveau` de saignement, une `saisie`, un `jour`. Rien dans un
 * nom de champ ne dit de quoi il s'agit si la valeur n'est pas lue.
 *
 * Ce n'est pas de la pudeur : les noms de champs voyagent. Ils sont dans
 * les messages d'erreur, dans les outils de développement, dans les
 * exports de diagnostic. Un champ `joursDeRegles` se lirait par-dessus
 * l'épaule aussi sûrement qu'un titre d'écran.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Ce qu'une journée porte
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les cinq niveaux de la maquette 8.2, et leur ordre est celui de l'écran.
 *
 * « aucun » existe et n'est pas l'absence de saisie : une journée déclarée
 * sans saignement est une information, une journée non saisie n'en est pas
 * une. Les confondre ferait d'un oubli une donnée.
 */
export type NiveauDeSaignement = 'aucun' | 'traces' | 'leger' | 'moyen' | 'abondant';

/**
 * Les libellés, accordés au pluriel comme la maquette 8.2 les écrit.
 *
 * « Légers », « Moyens », « Abondants » s'accordent avec « saignements », qui
 * est la question posée juste au-dessus. Le singulier aurait obligé l'écran à
 * poser une question au singulier, ou à laisser un désaccord — et le format G
 * demande des pluriels accordés, pas des parenthèses.
 *
 * « Aucun » reste au singulier : c'est une réponse qui se tient seule.
 */
export const NIVEAUX_DE_SAIGNEMENT: Record<NiveauDeSaignement, string> = {
  aucun: 'Aucun',
  traces: 'Traces',
  leger: 'Légers',
  moyen: 'Moyens',
  abondant: 'Abondants',
};

/** L'ordre d'affichage, qui est celui de la maquette et non celui de l'objet. */
export const ORDRE_DES_NIVEAUX: readonly NiveauDeSaignement[] = [
  'aucun',
  'traces',
  'leger',
  'moyen',
  'abondant',
];

export interface SaisieDuCycle {
  /** L'empreinte du jour — jamais le jour lui-même. Voir `cleDuJourDeCycle`. */
  id: string;
  /**
   * Le jour logique, en ISO court.
   *
   * Il est dans la **valeur**, donc chiffré, et non dans la clé. C'est ce
   * qui permet de le relire après ouverture du coffre sans qu'il paraisse
   * dans la liste des clés.
   */
  jour: string;
  niveau: NiveauDeSaignement;
  /**
   * Ce que la personne a noté, librement.
   *
   * Pas de liste de symptômes imposée dans ce lot : une liste est une
   * suggestion, et suggérer des symptômes est une façon d'en faire
   * apparaître. Elle viendra avec le catalogue des facteurs, où elle sera
   * sourcée ou déclarée comme ne l'étant pas.
   */
  note: string;
  /** Le début déclaré, quand la personne l'indique elle-même. */
  debutDeclare: boolean;
  majLe: string;
}

export function controlerSaisie(s: SaisieDuCycle): string[] {
  const problemes: string[] = [];
  if (!s.id.trim()) problemes.push('Une saisie a besoin de son empreinte.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.jour)) {
    problemes.push(`« ${s.jour} » n’est pas un jour au format attendu.`);
  }
  if (!(s.niveau in NIVEAUX_DE_SAIGNEMENT)) {
    problemes.push(`Niveau inconnu : « ${s.niveau} ».`);
  }
  /*
     UN DÉBUT DÉCLARÉ SANS SAIGNEMENT EST UNE CONTRADICTION, et elle est
     silencieuse : l'écran afficherait un début de cycle sur une journée que
     la personne a déclarée sans rien. Mieux vaut le refuser à l'écriture
     que de le découvrir dans une statistique.
  */
  if (s.debutDeclare && s.niveau === 'aucun') {
    problemes.push('Un début déclaré sur une journée sans saignement n’a pas de sens.');
  }
  return problemes;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les réglages du module
   ══════════════════════════════════════════════════════════════════════════ */

/** L'identifiant fixe : il n'y a qu'un enregistrement de réglages. */
export const ID_DES_REGLAGES = 'suivi-personnel';

export interface ReglagesDuCycle {
  id: typeof ID_DES_REGLAGES;
  /**
   * Le suivi est-il actif ?
   *
   * `false` au départ, et ce n'est pas un détail : la décision 3 veut que la
   * question soit posée d'office à certaines personnes, pas que le module
   * s'ouvre tout seul. Un module actif par défaut écrirait un réglage que
   * personne n'a demandé.
   */
  actif: boolean;
  /**
   * Le jour où le suivi a été activé, pour que l'écran puisse dire « depuis
   * le … » au lieu de laisser croire qu'il observe depuis toujours.
   */
  activeLe: string | null;
  majLe: string;
}

export const REGLAGES_AU_DEPART: ReglagesDuCycle = {
  id: ID_DES_REGLAGES,
  actif: false,
  activeLe: null,
  majLe: '',
};

export function controlerReglagesDuCycle(r: ReglagesDuCycle): string[] {
  const problemes: string[] = [];
  if (r.id !== ID_DES_REGLAGES) problemes.push(`Identifiant de réglages inattendu : « ${r.id} ».`);
  if (r.actif && !r.activeLe) {
    problemes.push('Un suivi actif sans date d’activation : l’écran ne pourrait pas dire depuis quand.');
  }
  if (!r.actif && r.activeLe) {
    problemes.push('Une date d’activation sur un suivi inactif laisserait croire qu’il observe.');
  }
  return problemes;
}
