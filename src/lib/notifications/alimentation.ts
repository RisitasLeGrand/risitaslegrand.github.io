/**
 * Ce qui alimente le centre — prompt 32, phase 2.
 *
 * ## Huit sources, et pas douze d'un coup
 *
 * Le plan de la phase 2 le dit : « branchés **d'abord** sur les avis de
 * fusion et les questions à trancher, puis sur les autres sources une par
 * une ». Brancher les douze d'un coup aurait produit un panneau qu'aucun
 * essai ne couvre, et douze occasions de laisser passer du contenu là où
 * le § 2.3 n'en veut pas.
 *
 * La phase 3 en ajoute trois, choisies pour ce qu'elles ne demandent pas :
 * la sauvegarde, les revues manquées et les occurrences en retard ont un
 * producteur **pur** et un signal **sans contenu**. Rien à déchiffrer pour
 * décider, rien à taire une fois décidé.
 *
 * La phase 4 en ajoute trois de plus — proposition, avertissement avant
 * analyse, apprentissage étendu —, qui ne touchent aucun magasin scellé
 * pour décider et dont la référence est un identifiant de mécanisme :
 * une règle, une analyse, un état. Jamais une valeur.
 *
 * Les quatre autres sont **nommées dans `sources.ts`** et absentes ici : un
 * registre de routage complet et une alimentation partielle, c'est ce qui
 * permet de dire exactement ce qui est branché, et de le vérifier.
 *
 * ## Le recensement est idempotent, parce qu'il tourne à chaque page
 *
 * Les recensements s'appellent au chargement d'écrans ordinaires. Un
 * conflit encore ouvert au troisième chargement ne doit pas produire trois
 * éléments : l'identifiant dérive de `source + refSource`
 * (`idDeLElement`), donc la même chose rend toujours la même clé, et le
 * `put` écrase au lieu d'empiler. C'est la raison d'être de l'empreinte
 * déterministe, et c'est ici qu'elle sert.
 *
 * ## Un conflit refermé retire son élément
 *
 * Le § 1 n° 8 dit qu'une question quitte le compteur **à la résolution de
 * sa source**. C'est donc ici, et nulle part ailleurs, que la sortie se
 * fait : `synchroniser` compare ce que la source affirme aux éléments
 * présents et supprime ceux qu'elle n'affirme plus — une revue tenue, une
 * occurrence rattrapée, une sauvegarde faite. Sans cette moitié, le § 1
 * n° 8 ferait du centre une liste qui ne décroît jamais — et un compteur
 * qui ne redescend pas finit par ne plus être lu.
 */
import { jourLogique } from '../noyau/jour-logique';
import {
  centreLisible,
  deposer,
  elementsDuCentre,
  oublier,
  type Depot,
} from './donnees';
import { idDeLElement, type ElementDuCentre, type GenreDElement } from './modele';
import type { Insistance } from '../noyau/coffre';

/** La source des conflits de synchronisation et des désaccords de branche. */
export const SOURCE_CONFLITS = 'question-a-trancher';
/** La source des fusions automatiques réussies. */
export const SOURCE_FUSION = 'avis-de-fusion';

export interface Recensement {
  /** Les éléments créés ou rafraîchis. */
  deposes: number;
  /** Les éléments retirés parce que leur conflit est tranché. */
  retires: number;
  /** Pourquoi rien n'a été fait, le cas échéant. */
  silence: 'coffre-ferme' | null;
}

/**
 * Une intention de dépôt : ce qu'une source dit qu'il faudrait trouver.
 *
 * Pas un élément : ni `id` (c'est une empreinte, donc un calcul), ni
 * `creeLe` (c'est au magasin de le garder), ni `etat` (c'est à la
 * personne). Cette séparation est ce qui rend les producteurs
 * **purs** — ils se contrôlent sans base, sans coffre et sans horloge —
 * et laisse l'écriture en un seul endroit, où le `creeLe` du premier
 * dépôt survit.
 */
export interface Intention {
  refSource: string;
  genre: GenreDElement;
  regroupement: string | null;
}

/**
 * Met le magasin d'accord avec ce qu'une source affirme, dans les deux sens.
 *
 * Ce que `recenser` faisait pour les conflits, et que les autres sources
 * demandent mot pour mot : déposer ce qui manque, **retirer ce qui n'est
 * plus attendu**. La seconde moitié est celle qu'on oublie, et son absence
 * ne se voit pas tout de suite — elle se voit trois mois plus tard, sur un
 * centre qui ne décroît jamais.
 *
 * Le retrait ne touche que `source` : chaque source est maîtresse de ses
 * éléments et d'aucun autre. Sans cette borne, brancher une source
 * viderait les autres.
 *
 * **Coffre fermé, ne fait rien.** Écrire demande de sceller, donc une clé.
 */
export async function synchroniser(
  source: string,
  attendues: readonly Intention[],
): Promise<Recensement> {
  if (!centreLisible()) return { deposes: 0, retires: 0, silence: 'coffre-ferme' };

  const jour = jourLogique();
  /*
     Une seule lecture du magasin, et non une par intention : la version
     précédente relisait tout à chaque tour, ce qui tenait tant qu'il n'y
     avait qu'une poignée de conflits et aurait fini par se voir.
  */
  const presents = new Map((await elementsDuCentre()).map((e) => [e.id, e]));

  const attendus = new Map<string, ElementDuCentre>();
  for (const intention of attendues) {
    const id = await idDeLElement(source, intention.refSource);
    const dejaLa = presents.get(id);
    attendus.set(id, {
      id,
      source,
      refSource: intention.refSource,
      genre: intention.genre,
      /*
         Le `creeLe` du premier dépôt survit : la rétention s'y réfère, et
         un élément qui se redaterait à chaque page ne vieillirait jamais.
         L'état aussi — sinon archiver un élément ne tiendrait pas jusqu'au
         prochain chargement, ce qui est la définition d'un bouton qui ment.
      */
      creeLe: dejaLa?.creeLe ?? jour,
      etat: dejaLa?.etat ?? 'non_lu',
      regroupement: intention.regroupement,
    });
  }

  let deposes = 0;
  for (const element of attendus.values()) {
    const resultat: Depot = await deposer(element);
    if (resultat.quoi === 'depose') deposes += 1;
  }

  let retires = 0;
  for (const present of presents.values()) {
    if (present.source !== source) continue;
    if (attendus.has(present.id)) continue;
    await oublier(present.id);
    retires += 1;
  }

  return { deposes, retires, silence: null };
}

/**
 * Recense les questions à trancher, et retire celles qui ne le sont plus.
 *
 * **Coffre fermé, ne fait rien.** Écrire demande de sceller, donc une clé.
 * Un recensement qui échouerait à moitié laisserait le magasin en désaccord
 * avec les conflits réels, et le § 3.2 n'attend de toute façon rien du
 * centre coffre fermé — pas même une mise à jour silencieuse.
 */
export const recenser = (
  conflitsOuverts: readonly { type: string; cible: string }[],
): Promise<Recensement> =>
  synchroniser(
    SOURCE_CONFLITS,
    conflitsOuverts.map((conflit) => ({
      /*
         La référence est `type:cible`, et c'est ce que l'écran des conflits
         sait retrouver. Elle ne porte aucune valeur en désaccord — seulement
         de quoi la rechercher là où le coffre est déjà ouvert.
      */
      refSource: `${conflit.type}:${conflit.cible}`,
      genre: 'a-trancher' as const,
      /*
         Pas de regroupement : chaque question se tranche séparément, et
         « 3 questions » cacherait qu'il y en a une de plus qu'hier. Le § 3.3
         exclut d'ailleurs explicitement le § 1 n° 8 du budget d'attention.
      */
      regroupement: null,
    })),
  );

/**
 * Dépose l'avis d'une fusion automatique.
 *
 * **Sans aucun nombre**, et c'est la décision 5 : « Reçu : 1 opération »
 * dit qu'une saisie a eu lieu sur l'autre appareil, et une saisie unique
 * un soir donné en dit déjà beaucoup. Le centre ne porte de toute façon
 * pas de texte (§ 2.3) ; ce qui compte ici est que la **référence** n'en
 * porte pas non plus — elle nomme le lot, pas son volume.
 *
 * Genre `a-savoir` : une fusion est une information, pas une question. Elle
 * ne compte donc pas dans la pastille, s'archive et se purge normalement.
 */
export async function signalerUneFusion(lot: string): Promise<Depot> {
  const refSource = `lot:${lot}`;
  return deposer({
    id: await idDeLElement(SOURCE_FUSION, refSource),
    source: SOURCE_FUSION,
    refSource,
    genre: 'a-savoir',
    creeLe: jourLogique(),
    etat: 'non_lu',
    /*
       Regroupées : trois synchronisations dans la journée sont un fait, pas
       trois. C'est exactement le cas que le § 3.3 vise par « et 4 autres ».
    */
    regroupement: SOURCE_FUSION,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Phase 3 — les trois sources dont le producteur est pur et le signal sans
   contenu : la sauvegarde, les revues manquées, les occurrences en retard.

   Elles viennent les premières parce qu'elles n'ouvrent aucun coffre pour
   décider, et que ce qu'elles déposent ne révèle rien de plus que son
   existence. Les sources scellées — rappel de prise, trajectoires — ont
   leurs propres questions, et les mêler à celles-ci aurait fait un lot où
   l'on ne saurait plus quelle précaution protège quoi.
   ══════════════════════════════════════════════════════════════════════════ */

/** La source du rappel de sauvegarde, la seule sans aucune sensibilité. */
export const SOURCE_SAUVEGARDE = 'rappel-de-sauvegarde';
/** La source des revues du soir non tenues. */
export const SOURCE_REVUE = 'revue-manquee';
/** La source des occurrences de série dépassées. */
export const SOURCE_OCCURRENCE = 'occurrence-manquee';

/**
 * La référence unique du rappel de sauvegarde.
 *
 * **Constante, et non l'insistance.** Le rappel « se renforce » avec le
 * temps ; si la référence portait le degré, passer de discret à insistant
 * fabriquerait un second élément et le premier resterait là. Un seul état,
 * une seule référence : il entre quand il y a lieu, il sort quand il n'y a
 * plus lieu, et son ancienneté est celle du premier jour où il a eu lieu —
 * ce qui est exactement ce qu'on veut lire.
 */
export const REF_SAUVEGARDE = 'etat';

/**
 * Le rappel de sauvegarde entre-t-il au centre ?
 *
 * Oui dès qu'il y a quelque chose à dire, quel que soit le degré. Le degré
 * **ne voyage pas** : il se recalcule à l'affichage, comme tout le reste
 * (§ 2.3), et le stocker aurait fait du centre le seul endroit du dépôt où
 * un « urgent » peut survivre à la sauvegarde qui l'a réglé.
 */
export const intentionsDeSauvegarde = (insistance: Insistance): Intention[] =>
  insistance === 'aucune'
    ? []
    : [{ refSource: REF_SAUVEGARDE, genre: 'a-savoir', regroupement: null }];

/**
 * Une intention par jour de revue manquée, toutes regroupées.
 *
 * Un élément par jour, et non un seul pour « 3 revues » : tenir la revue
 * de mardi doit faire disparaître mardi, pas attendre que les trois soient
 * rattrapées. Le regroupement est ce qui rend quand même « et 2 autres »
 * possible à l'affichage — c'est le § 3.3, et il travaille sur des
 * éléments distincts, pas sur un élément qui compte.
 *
 * Les jours viennent de `revuesManquees`, qui ne remonte que sept jours :
 * une revue plus ancienne n'est plus rattrapable, son élément n'est donc
 * plus attendu et `synchroniser` le retire. Ce n'est pas un oubli, c'est la
 * même borne, vue depuis le centre.
 */
export const intentionsDesRevues = (joursManques: readonly string[]): Intention[] =>
  joursManques.map((jour) => ({
    refSource: jour,
    genre: 'a-savoir' as const,
    regroupement: SOURCE_REVUE,
  }));

/**
 * Une intention par occurrence en retard.
 *
 * La référence est `tâche:jour prévu`, **jamais le titre** : le § 2.3 ne
 * veut pas de contenu, et un intitulé de tâche en est. Le jour prévu, et
 * non le jour d'affichage : une occurrence déplacée reste la même, et la
 * redéposer sous une autre clé à chaque déplacement empilerait des
 * doublons d'une seule chose.
 *
 * Le prompt 38 veut ce signal « une fois, jamais accumulé » : c'est ce que
 * donne une référence stable, puisque le même retard rend toujours la même
 * empreinte et que le dépôt écrase au lieu d'empiler.
 */
export const intentionsDesOccurrences = (
  enRetard: readonly { tacheId: string; jourPrevu: string }[],
): Intention[] =>
  enRetard.map((o) => ({
    refSource: `${o.tacheId}:${o.jourPrevu}`,
    genre: 'a-savoir' as const,
    regroupement: SOURCE_OCCURRENCE,
  }));

/** Dépose ou retire le rappel de sauvegarde, selon son insistance. */
export const signalerLaSauvegarde = (insistance: Insistance): Promise<Recensement> =>
  synchroniser(SOURCE_SAUVEGARDE, intentionsDeSauvegarde(insistance));

/** Met le centre d'accord avec les revues qui manquent. */
export const recenserLesRevues = (joursManques: readonly string[]): Promise<Recensement> =>
  synchroniser(SOURCE_REVUE, intentionsDesRevues(joursManques));

/** Met le centre d'accord avec les occurrences en retard. */
export const recenserLesOccurrences = (
  enRetard: readonly { tacheId: string; jourPrevu: string }[],
): Promise<Recensement> => synchroniser(SOURCE_OCCURRENCE, intentionsDesOccurrences(enRetard));

/* ══════════════════════════════════════════════════════════════════════════
   Phase 4 — les trois sources du profil et des analyses.

   Elles ne touchent aucun magasin scellé pour décider : le journal
   d'opérations et les analyses conservées suffisent. Ce qu'elles ont en
   commun, et qui justifie de les prendre ensemble, est la nature de leur
   référence : un identifiant de RÈGLE, un identifiant d'ANALYSE, un état
   unique. Aucune valeur, aucun domaine, aucun chiffre.
   ══════════════════════════════════════════════════════════════════════════ */

/** La source des propositions d'adaptation. */
export const SOURCE_PROPOSITION = 'proposition';
/** La source de l'avertissement qui précède une analyse importée. */
export const SOURCE_AVERTISSEMENT = 'avertissement-avant-analyse';
/** La source de la demande de consentement à l'apprentissage étendu. */
export const SOURCE_APPRENTISSAGE = 'apprentissage-etendu';

/** La référence unique de la demande de consentement. */
export const REF_APPRENTISSAGE = 'jamais-demande';

/**
 * La proposition du jour, s'il y en a une.
 *
 * La référence est **l'identifiant de la règle**, jamais la valeur
 * proposée. Une règle est un mécanisme ; « coucher à 23 h 15 » est une
 * donnée de vie, et le § 2.3 n'en veut pas dans un élément. L'écran du
 * profil, lui, recalcule la proposition entière et l'affiche.
 *
 * Pas de regroupement : le plafond du § 1 n° 6 est d'**une par semaine**,
 * toutes catégories. Regrouper ce qui ne peut pas être deux ne ferait
 * qu'ajouter un titre de groupe à une liste d'un élément. Les écarts
 * connus mais non proposés n'entrent pas non plus : le centre dirait
 * « il y a quelque chose » d'une chose que le profil a décidé de taire
 * aujourd'hui, ce qui contournerait le plafond au lieu de le servir.
 */
export const intentionsDeProposition = (regle: string | null): Intention[] =>
  regle ? [{ refSource: regle, genre: 'a-savoir', regroupement: null }] : [];

/**
 * Une intention par analyse conservée qui porte un avertissement.
 *
 * La référence est l'identifiant de l'analyse : il mène à l'écran qui la
 * montre, et il ne dit pas **quel** domaine est averti — le domaine est
 * justement ce que l'inventaire note comme sensible pour cette source.
 * « Une analyse demande un avis professionnel » suffit à faire ouvrir
 * l'écran ; lequel de ses conseils le demande est l'affaire de l'écran.
 *
 * Regroupées : importer deux analyses en un jour est banal, et deux
 * lignes identiques de plus dans le panneau le seraient moins.
 */
export const intentionsDAvertissement = (idsDAnalyse: readonly string[]): Intention[] =>
  idsDAnalyse.map((id) => ({
    refSource: id,
    genre: 'a-savoir' as const,
    regroupement: SOURCE_AVERTISSEMENT,
  }));

/**
 * La demande de consentement, tant qu'elle n'a jamais été posée.
 *
 * `jamaisDemande` vaut « rien n'a été dit » — ni accord, ni révocation.
 * Un refus est une réponse : il ferme la question, et la reposer serait
 * harceler. C'est pour cela que la condition n'est pas « non accordé ».
 *
 * La source est **muette** au système (le 25), et `sources.ts` le garde
 * par `peutNotifier: false` ; rien n'est à redire ici, et surtout rien
 * n'est à redire DEUX fois — une interdiction écrite à deux endroits
 * finit par n'être vraie qu'à un seul.
 */
export const intentionsDApprentissage = (jamaisDemande: boolean): Intention[] =>
  jamaisDemande
    ? [{ refSource: REF_APPRENTISSAGE, genre: 'a-savoir', regroupement: null }]
    : [];

/** Met le centre d'accord avec la proposition du jour. */
export const signalerUneProposition = (regle: string | null): Promise<Recensement> =>
  synchroniser(SOURCE_PROPOSITION, intentionsDeProposition(regle));

/** Met le centre d'accord avec les analyses conservées qui avertissent. */
export const recenserLesAvertissements = (
  idsDAnalyse: readonly string[],
): Promise<Recensement> =>
  synchroniser(SOURCE_AVERTISSEMENT, intentionsDAvertissement(idsDAnalyse));

/** Dépose ou retire la demande de consentement à l'apprentissage étendu. */
export const signalerLApprentissage = (jamaisDemande: boolean): Promise<Recensement> =>
  synchroniser(SOURCE_APPRENTISSAGE, intentionsDApprentissage(jamaisDemande));
