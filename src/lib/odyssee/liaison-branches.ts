/**
 * Le pointage partagé : quelles actions de branche une tâche peut viser —
 * phase 5 du prompt 38.
 *
 * ## Le vocabulaire est emprunté, pas inventé
 *
 * L'identifiant d'une action **est** celui de son type de fait, au catalogue
 * de `noyau/faits.ts` : `sport.seance`, `odyssee.checkin`, `revision.qcm`.
 * C'était la condition posée par `donnees-occurrences.ts`, qui refusait de
 * figer une liste de branches que personne n'avait arrêtée. Elle existe
 * désormais, et elle ne dit rien de neuf : elle choisit, parmi des types
 * déjà déclarés, ceux qu'un geste de calendrier peut toucher.
 *
 * ## Les quatre sens, et pourquoi il en faut quatre
 *
 * Le prompt veut un pointage « dans les deux sens » (décision 4). Les
 * décisions du 15 octobre ont ensuite restreint trois cas, chacun pour une
 * raison différente — et les confondre aurait produit soit des données
 * fausses, soit un lot impossible à finir.
 *
 * | Sens | Ce que cela veut dire |
 * |---|---|
 * | `deux-sens` | Pointer la tâche écrit le fait ; faire le fait coche la tâche. |
 * | `branche-vers-tache` | Faire le fait coche la tâche. L'inverse est **impossible** : le fait exige des résultats qu'un geste ne peut pas inventer (décision 5). |
 * | `ouvre-ecran` | Pointer **ouvre** l'écran de la branche ; rien n'est écrit tant que rien n'est répondu (décision 4 du 15 octobre). |
 * | `hors-du-lot` | La branche n'est pas liable dans ce lot (décision 1 du 15 octobre). |
 *
 * ## Ce que ce module décide, et que la couche de stockage attendait
 *
 * `magasinDeLException()` : une exception se range en clair, ou sous scellé
 * si la tâche vise une branche sous coffre. C'est la variante retenue de la
 * décision 3 — une occurrence quotidienne à 8 h liée à une branche sensible
 * révèle un rythme, même sans libellé.
 */
import type { Tache } from './modele';

export type SensDuLien = 'deux-sens' | 'branche-vers-tache' | 'ouvre-ecran' | 'hors-du-lot';

export interface ActionLiable {
  /** L'identifiant du type de fait, au catalogue. */
  id: string;
  /** La branche, telle que les écrans la nomment. */
  branche: string;
  libelle: string;
  sens: SensDuLien;
  /** Son magasin est-il scellé ? Décide du rangement des exceptions. */
  sousCoffre: boolean;
  /** Pourquoi ce sens-là, et sur quelle décision. */
  pourquoi: string;
}

const A = (a: ActionLiable): ActionLiable => a;

/**
 * Les actions qu'une tâche peut viser.
 *
 * La liste est **délibérément courte**. Toute action du catalogue n'est pas
 * liable : « un record de force » ou « un niveau estimé » sont des résultats
 * calculés, pas des gestes, et les proposer dans une liste de liens
 * laisserait croire qu'on peut les pointer.
 */
export const ACTIONS_LIABLES: readonly ActionLiable[] = [
  A({
    id: 'sport.seance',
    branche: 'sport',
    libelle: 'Une séance de sport',
    sens: 'deux-sens',
    sousCoffre: false,
    pourquoi:
      'Une séance peut naître sans séries : « à compléter » est un état légal du modèle, et c’est exactement le cas prévu par le prompt.',
  }),
  A({
    id: 'revision.seance',
    branche: 'revisions',
    libelle: 'Une séance de révision',
    sens: 'branche-vers-tache',
    sousCoffre: false,
    pourquoi:
      'Décision 5 du 15 octobre, prise au mot : « faire la séance dans la branche coche la tâche ; pointer la tâche ne crée pas de séance. » Et la raison technique suit la décision : une séance de révision porte `secondes`, une durée mesurée dont le fait déduit son instant de début. La justifier par « un thème, un jour et un statut » était une erreur de ma part, corrigée ici : il y avait un quatrième champ, et c’était une mesure.',
  }),
  A({
    id: 'revision.qcm',
    branche: 'revisions',
    libelle: 'Un QCM',
    sens: 'branche-vers-tache',
    sousCoffre: false,
    pourquoi:
      'Décision 5 du 15 octobre : une session de QCM exige posées, bonnes, mauvaises, abstentions, points et maximum. Un geste ne peut pas les inventer, et des zéros fausseraient l’historique — un zéro n’est pas une absence.',
  }),
  A({
    id: 'revision.cog-training',
    branche: 'revisions',
    libelle: 'Un entraînement cognitif',
    sens: 'branche-vers-tache',
    sousCoffre: false,
    pourquoi:
      'Même raison : une session de Veridical Mapping exige un seuil médian, une charge et des essais réussis.',
  }),
  A({
    id: 'odyssee.quete',
    branche: 'odyssee',
    libelle: 'Une quête tenue',
    sens: 'deux-sens',
    sousCoffre: false,
    pourquoi: 'Tenir une quête est un geste, et il ne porte qu’un jour.',
  }),
  A({
    id: 'odyssee.focus',
    branche: 'odyssee',
    libelle: 'Un temps de concentration',
    sens: 'branche-vers-tache',
    sousCoffre: false,
    pourquoi:
      'Un focus porte une durée mesurée. La créer d’un geste reviendrait à déclarer un temps qu’on n’a pas passé.',
  }),
  A({
    id: 'odyssee.poids',
    branche: 'corps',
    libelle: 'Une pesée',
    sens: 'branche-vers-tache',
    sousCoffre: false,
    pourquoi: 'Une pesée porte un poids. Il se mesure, il ne se pointe pas.',
  }),
  A({
    id: 'odyssee.hydratation',
    branche: 'corps',
    libelle: 'Une boisson',
    sens: 'branche-vers-tache',
    sousCoffre: false,
    pourquoi: 'Une boisson porte un volume, qui se saisit.',
  }),
  A({
    id: 'odyssee.checkin',
    branche: 'psyche',
    libelle: 'Un check-in',
    sens: 'ouvre-ecran',
    sousCoffre: true,
    pourquoi:
      'Décision 4 du 15 octobre : un check-in vide est légal, et compterait comme fait sans rien mesurer. Pointer ouvre l’écran ; rien n’est écrit tant que rien n’est répondu.',
  }),
  A({
    id: 'odyssee.operation',
    branche: 'finances',
    libelle: 'Un pointage budgétaire',
    sens: 'ouvre-ecran',
    sousCoffre: true,
    pourquoi:
      'Un pointage vise une opération précise, qu’un geste de calendrier ne choisit pas. Et le champ « pourquoi » reçoit un texte neutre (décision 6 du 15 octobre).',
  }),
  A({
    id: 'odyssee.medicament',
    branche: 'sante',
    libelle: 'Une prise déclarée',
    sens: 'hors-du-lot',
    sousCoffre: true,
    pourquoi:
      'Décision 1 du 15 octobre : Santé reste hors des liens dans ce lot. Le magasin des prises existe pourtant — c’est une erreur que j’avais faite et qui est corrigée — donc ce lien est techniquement constructible. Il attend une décision, pas une capacité.',
  }),
];

const PAR_ID = new Map(ACTIONS_LIABLES.map((a) => [a.id, a]));

export const actionLiable = (id: string): ActionLiable | undefined => PAR_ID.get(id);

/** Celles qu'on propose dans l'écran : tout sauf ce qui est hors du lot. */
export const actionsProposables = (): ActionLiable[] =>
  ACTIONS_LIABLES.filter((a) => a.sens !== 'hors-du-lot');

/**
 * Pointer la tâche peut-il **créer** le fait de la branche ?
 *
 * Faux pour les trois autres sens, et pour une action inconnue : un lien qui
 * nomme une action que ce module ne connaît pas ne donne droit à rien. Le
 * défaut est le refus, parce qu'un défaut permissif écrirait dans une branche
 * sur la foi d'une chaîne de caractères.
 */
export const ecritDansLaBranche = (id: string): boolean =>
  PAR_ID.get(id)?.sens === 'deux-sens';

/** Pointer ouvre-t-il l'écran de la branche, sans rien écrire ? */
export const ouvreLEcran = (id: string): boolean => PAR_ID.get(id)?.sens === 'ouvre-ecran';

/**
 * Faire le fait dans la branche coche-t-il la tâche liée ?
 *
 * Vrai pour `deux-sens` **et** `branche-vers-tache` : c'est le sens qui
 * marche toujours, puisqu'il ne demande rien d'autre que de constater un
 * fait déjà écrit.
 */
export const cocheLaTache = (id: string): boolean => {
  const sens = PAR_ID.get(id)?.sens;
  return sens === 'deux-sens' || sens === 'branche-vers-tache';
};

/* ══════════════════════════════════════════════════════════════════════════
   Où range-t-on les exceptions ? — la décision que le stockage attendait
   ══════════════════════════════════════════════════════════════════════════ */

/** Une branche est-elle sous coffre ? Déduit du registre, jamais écrit deux fois. */
export const brancheSousCoffre = (branche: string): boolean =>
  ACTIONS_LIABLES.some((a) => a.branche === branche && a.sousCoffre);

/**
 * Le magasin où ranger une exception de cette tâche.
 *
 * Décision 3 du 15 octobre, variante retenue : les occurrences voyagent en
 * clair et sans libellé, **sauf** celles des tâches liées à une branche sous
 * coffre, scellées elles aussi — une occurrence quotidienne à 8 h liée à une
 * branche sensible révèle un rythme, même sans libellé.
 *
 * **Le défaut est le clair**, et c'est volontaire malgré la règle habituelle
 * du coffre, qui veut qu'un champ nouveau soit scellé par défaut. La raison
 * est que l'inverse rendrait le calendrier illisible coffre fermé pour
 * l'immense majorité des tâches, qui ne touchent rien de sensible. Le
 * scellement suit donc un lien **déclaré**, et un lien qui nomme une action
 * inconnue ne scelle pas — mais il n'écrit rien non plus dans la branche,
 * puisque `ecritDansLaBranche()` le refuse.
 */
export const magasinDeLException = (
  tache: Tache,
): 'odysseeOccurrences' | 'odysseeExceptionsScellees' =>
  tache.lien && actionLiable(tache.lien.action)?.sousCoffre
    ? 'odysseeExceptionsScellees'
    : 'odysseeOccurrences';

/* ══════════════════════════════════════════════════════════════════════════
   Le libellé neutre — décision 6
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'un pointage venu du calendrier écrit dans un champ en clair.
 *
 * Décision 6 du 15 octobre : **un texte neutre, sans le titre de la tâche**.
 * Le titre peut être sensible, et le recopier dans une branche scellée irait
 * contre la décision 5 du prompt, qui exige un libellé neutre.
 *
 * Une constante, et non un gabarit : un gabarit se remplit, et ce qui se
 * remplit finit par recevoir un titre.
 */
export const LIBELLE_NEUTRE_DU_POINTAGE = 'Pointé depuis le calendrier';
