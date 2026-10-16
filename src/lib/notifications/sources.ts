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
 * **Deux sont branchées à ce lot** (phase 2 : « d'abord sur les avis de
 * fusion et les questions à trancher »). Les autres figurent avec leur
 * route parce qu'elles existent déjà dans le code et qu'un registre qui
 * ne les nommerait pas les ferait passer pour inconnues ; elles
 * n'alimentent pas encore le centre, et `alimentation.ts` dit lesquelles.
 */
export const ROUTES: readonly RouteDeSource[] = [
  R({ id: 'question-a-trancher', libelle: 'Questions à trancher', branche: 'aucune', vers: '/appareils/#conflits' }),
  R({ id: 'avis-de-fusion', libelle: 'Synchronisation', branche: 'aucune', vers: '/appareils/' }),
  R({ id: 'proposition', libelle: 'Propositions', branche: 'aucune', vers: '/profil/' }),
  R({ id: 'avertissement-avant-analyse', libelle: 'Avant une analyse', branche: 'aucune', vers: '/exporter-ia/' }),
  R({ id: 'rappel-de-prise', libelle: 'Rappels de prise', branche: 'odyssee', vers: '/odyssee/sante/' }),
  R({ id: 'veille-du-rythme', libelle: 'Veille du rythme', branche: 'odyssee', vers: null }),
  R({ id: 'rappel-de-sauvegarde', libelle: 'Sauvegarde', branche: 'aucune', vers: '/stockage/' }),
  R({ id: 'revue-manquee', libelle: 'Revues en attente', branche: 'odyssee', vers: '/odyssee/' }),
  R({ id: 'occurrence-manquee', libelle: 'Occurrences manquées', branche: 'odyssee', vers: '/odyssee/calendrier/' }),
  R({ id: 'pointage-a-reporter', libelle: 'Gestes à reporter', branche: 'odyssee', vers: '/odyssee/' }),
  R({ id: 'apprentissage-etendu', libelle: 'Apprentissage étendu', branche: 'aucune', vers: '/profil/' }),
  R({ id: 'trajectoire', libelle: 'Trajectoires', branche: 'aucune', vers: '/syntheses/' }),
  /*
     Les deux sources du cycle ont une ligne, et c'est délibéré : le filtre
     les écarte à l'écriture, donc aucun élément ne les portera jamais. Les
     omettre ici ferait croire à un oubli de routage le jour où quelqu'un
     comparera les deux registres ; les nommer dit qu'elles sont connues et
     qu'elles n'arrivent pas.
  */
  R({ id: 'journal-du-cycle', libelle: 'Journal', branche: 'aucune', vers: null }),
  R({ id: 'statut-du-cycle', libelle: 'Statut', branche: 'aucune', vers: null }),
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
  PAR_ID.get(id) ?? { id, libelle: id, branche: 'aucune', vers: null };

/** Les branches qui ont au moins une source, pour peupler le filtre. */
export const branchesDesSources = (): BrancheDeSource[] => [
  ...new Set(ROUTES.map((r) => r.branche)),
];
