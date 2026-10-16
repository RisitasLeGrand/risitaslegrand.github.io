/**
 * Où mène un élément, et sous quel nom — prompt 32, phase 2.
 *
 * ## Pourquoi un second registre, à côté de `filtre-cycle.ts`
 *
 * Les deux listent les mêmes sources, et ce n'est pas une redite : elles
 * ne répondent pas à la même question, et surtout elles n'ont pas le même
 * défaut.
 *
 * - `filtre-cycle.ts` répond « cette source a-t-elle le droit d'entrer ? ».
 *   Son défaut est **le refus** : une source qu'il ne connaît pas est
 *   écartée. Le fusionner avec celui-ci ferait du routage une condition
 *   d'admission, et un oubli de route deviendrait une fuite.
 * - Celui-ci répond « où va le clic, et comment s'appelle ce groupe ? ».
 *   Son défaut est **l'affichage dégradé** : une source sans route reste
 *   visible, sans lien. Un élément muet vaut mieux qu'un élément perdu.
 *
 * Deux registres, deux défauts opposés, chacun du côté le moins coûteux de
 * son erreur. Un contrôle vérifie qu'aucune source déclarée admissible
 * n'est inconnue ici — c'est le pont entre les deux, et il est testé.
 *
 * ## Les libellés ne disent rien du contenu
 *
 * « Question à trancher », pas « Conflit sur votre poids du 12 octobre ».
 * Le § 2.3 veut un élément sans contenu, et un libellé de groupe est du
 * texte affiché : il nomme **le genre de la chose**, jamais la chose. Le
 * détail se recalcule depuis la source, sur l'écran d'origine, où le
 * coffre est ouvert si besoin.
 */

/** La branche d'où vient un élément. `aucune` : ce qui sert Cyclades entier. */
export type BrancheDeSource = 'revisions' | 'odyssee' | 'sport' | 'aucune';

export interface RouteDeSource {
  /** L'identifiant, le même que dans `filtre-cycle.ts`. */
  id: string;
  /**
   * Cette source a-t-elle le droit d'émettre une **notification du
   * système** ?
   *
   * C'est une interdiction distincte du filtre du cycle, et elle lui est
   * orthogonale : `filtre-cycle.ts` décide de l'entrée au centre, ceci
   * décide du droit d'interrompre. Deux sources sont admises au centre et
   * muettes au système — la veille du rythme (le 27 l'interdit) et
   * l'apprentissage étendu (le 25). Les confondre avec le filtre du cycle
   * aurait été commode et faux : elles n'ont rien à voir avec le cycle, et
   * les y ranger aurait rendu la raison de leur silence incompréhensible
   * à la première relecture.
   *
   * Le champ est **obligatoire**, sans valeur par défaut : une source
   * nouvelle oblige à répondre à la question plutôt qu'à l'hériter.
   */
  peutNotifier: boolean;
  /** Le nom du groupe dans le panneau. Neutre, et au pluriel. */
  libelle: string;
  /** La branche, pour le filtre du § 3.1. */
  branche: BrancheDeSource;
  /**
   * Le chemin de l'écran d'origine, **sans** le préfixe de base.
   *
   * `null` quand la source n'a pas encore d'écran : l'élément s'affiche
   * alors sans lien plutôt que de mener à une page absente. Une route
   * fausse serait pire qu'une route manquante — elle se découvre au clic,
   * quand on cherchait justement à comprendre quelque chose.
   */
  vers: string | null;
}

const R = (r: RouteDeSource): RouteDeSource => r;

/**
 * Les sources, et où elles mènent.
 *
 * **Cinq sont branchées** : les deux de la phase 2 (« d'abord sur les
 * avis de fusion et les questions à trancher »), puis les trois de la
 * phase 3 — sauvegarde, revues manquées, occurrences en retard. Les
 * autres figurent avec leur route parce qu'elles existent déjà dans le
 * code et qu'un registre qui ne les nommerait pas les ferait passer pour
 * inconnues ; elles n'alimentent pas encore le centre, et
 * `alimentation.ts` dit lesquelles.
 */
export const ROUTES: readonly RouteDeSource[] = [
  R({ id: 'question-a-trancher', peutNotifier: true, libelle: 'Questions à trancher', branche: 'aucune', vers: '/appareils/#conflits' }),
  R({ id: 'avis-de-fusion', peutNotifier: true, libelle: 'Synchronisation', branche: 'aucune', vers: '/appareils/' }),
  R({ id: 'proposition', peutNotifier: true, libelle: 'Propositions', branche: 'aucune', vers: '/profil/' }),
  R({ id: 'avertissement-avant-analyse', peutNotifier: true, libelle: 'Avant une analyse', branche: 'aucune', vers: '/exporter-ia/' }),
  R({ id: 'rappel-de-prise', peutNotifier: true, libelle: 'Rappels de prise', branche: 'odyssee', vers: '/odyssee/sante/' }),
  /* Muette : « jamais de notification du système — le 27 l’interdit ». */
  R({ id: 'veille-du-rythme', peutNotifier: false, libelle: 'Veille du rythme', branche: 'odyssee', vers: null }),
  R({ id: 'rappel-de-sauvegarde', peutNotifier: true, libelle: 'Sauvegarde', branche: 'aucune', vers: '/stockage/' }),
  R({ id: 'revue-manquee', peutNotifier: true, libelle: 'Revues en attente', branche: 'odyssee', vers: '/odyssee/' }),
  R({ id: 'occurrence-manquee', peutNotifier: true, libelle: 'Occurrences manquées', branche: 'odyssee', vers: '/odyssee/calendrier/' }),
  R({ id: 'pointage-a-reporter', peutNotifier: true, libelle: 'Gestes à reporter', branche: 'odyssee', vers: '/odyssee/' }),
  /* Muette : « jamais par notification du système (le 25) ». */
  R({ id: 'apprentissage-etendu', peutNotifier: false, libelle: 'Apprentissage étendu', branche: 'aucune', vers: '/profil/' }),
  R({ id: 'trajectoire', peutNotifier: true, libelle: 'Trajectoires', branche: 'aucune', vers: '/syntheses/' }),
  /*
     Les deux sources du cycle ont une ligne, et c'est délibéré : le filtre
     les écarte à l'écriture, donc aucun élément ne les portera jamais. Les
     omettre ici ferait croire à un oubli de routage le jour où quelqu'un
     comparera les deux registres ; les nommer dit qu'elles sont connues et
     qu'elles n'arrivent pas.
  */
  R({ id: 'journal-du-cycle', peutNotifier: false, libelle: 'Journal', branche: 'aucune', vers: null }),
  R({ id: 'statut-du-cycle', peutNotifier: false, libelle: 'Statut', branche: 'aucune', vers: null }),
];

const PAR_ID = new Map(ROUTES.map((r) => [r.id, r]));

/**
 * La route d'une source, ou un repli muet.
 *
 * Ne lève pas, et ne rend pas `undefined` : un panneau qui planterait sur
 * une source inconnue effacerait aussi les éléments qui, eux, allaient
 * bien. Le repli porte l'identifiant comme libellé — illisible, mais
 * honnête : on voit qu'il manque une déclaration.
 */
export const routeDeLaSource = (id: string): RouteDeSource =>
  /*
     Le repli est MUET. Une source inconnue n'a le droit ni d'interrompre
     ni de se faire proposer : le défaut du droit d'interrompre est le
     refus, comme celui du filtre du cycle, même si le défaut de
     l'affichage est l'indulgence. Les deux règles cohabitent dans la même
     ligne, et c'est la seule manière qu'aucune ne soit oubliée.
  */
  PAR_ID.get(id) ?? { id, peutNotifier: false, libelle: id, branche: 'aucune', vers: null };

/** Les sources qui ont le droit d'émettre une notification du système. */
export const peutNotifier = (id: string): boolean => routeDeLaSource(id).peutNotifier;

/** Les branches qui ont au moins une source, pour peupler le filtre. */
export const branchesDesSources = (): BrancheDeSource[] => [
  ...new Set(ROUTES.map((r) => r.branche)),
];
