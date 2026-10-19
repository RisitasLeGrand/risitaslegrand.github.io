/**
 * Ce qui alimente le centre — prompt 32, phase 2.
 *
 * ## Dix sources branchées, deux impossibles, et pas douze d'un coup
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
 * La phase 5 en branche deux sous coffre — trajectoires closes, veille du
 * rythme — et **en déclare deux impossibles** : `SOURCES_NON_BRANCHEES`
 * dit pourquoi, et un contrôle tient la liste dans les deux sens. Les
 * deux dernières sont celles du cycle, que le filtre écarte à l'écriture.
 * Un registre de routage complet et une alimentation explicite, c'est ce
 * qui permet de dire exactement ce qui est branché, et de le vérifier.
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
export const intentionsDAvertissement = (
  analysesAverties: readonly { id: string; importeeLe: string }[],
  aujourdHui: string,
): Intention[] =>
  analysesAverties
    /* A-19 : sans cette borne, l'élément ressusciterait après la purge. */
    .filter((a) => estRecent(a.importeeLe, aujourdHui))
    .map((a) => ({
      refSource: a.id,
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
  analysesAverties: readonly { id: string; importeeLe: string }[],
  aujourdHui: string,
): Promise<Recensement> =>
  synchroniser(SOURCE_AVERTISSEMENT, intentionsDAvertissement(analysesAverties, aujourdHui));

/** Dépose ou retire la demande de consentement à l'apprentissage étendu. */
export const signalerLApprentissage = (jamaisDemande: boolean): Promise<Recensement> =>
  synchroniser(SOURCE_APPRENTISSAGE, intentionsDApprentissage(jamaisDemande));

/* ══════════════════════════════════════════════════════════════════════════
   Phase 5 — les sources sous coffre, et deux manques nommés.
   ══════════════════════════════════════════════════════════════════════════ */

/** La source des trajectoires closes. */
export const SOURCE_TRAJECTOIRE = 'trajectoire';
/** La source du rappel discret de la veille du rythme. Muette (le 27). */
export const SOURCE_VEILLE = 'veille-du-rythme';

/**
 * Combien de jours un événement **clos** reste une nouvelle.
 *
 * ## L'anomalie A-19, trouvée en écrivant cette phase
 *
 * Une source dont la condition est **permanente** ressuscite ses éléments.
 * Une trajectoire atteinte le reste pour toujours ; une analyse conservée
 * reste conservée. La rétention supprime l'élément au bout de
 * `supprimerApres` jours, le recensement suivant le redépose avec la date
 * du jour, et il revient **non lu** — un élément qu'on a rangé, qui
 * reparaît des mois plus tard comme s'il était neuf. C'est pire que du
 * bruit : c'est un centre auquel on cesse de croire.
 *
 * Les sources de la phase 3 n'avaient pas le défaut, et c'est ce qui me
 * l'a caché : une revue manquée sort de la fenêtre de rattrapage au bout
 * de sept jours, une occurrence rattrapée cesse d'être en retard, une
 * sauvegarde faite éteint son rappel. Toutes trois ont une condition qui
 * **s'éteint**. `avertissement-avant-analyse`, livré en phase 4, ne l'a
 * pas : le défaut est donc corrigé ici pour les deux sources concernées,
 * et dit plutôt que rattrapé en silence.
 *
 * Trente jours, et non la durée de rétention : un événement entre au
 * centre tant qu'il est une nouvelle, puis il sort **par sa source**, ce
 * qui est la seule sortie que `synchroniser` sache rendre définitive.
 */
export const JOURS_AU_CENTRE = 30;

/**
 * L'événement est-il encore une nouvelle ?
 *
 * Compare des **jours calendaires**, pas des jours logiques : la borne est
 * de trente jours, et la frontière de 4 h du matin ne change rien à
 * trente. Lire l'instant exact pour l'arrondir ensuite n'aurait ajouté
 * qu'une dépendance.
 */
export const estRecent = (
  quand: string | null,
  aujourdHui: string,
  jours = JOURS_AU_CENTRE,
): boolean => {
  if (!quand) return false;
  const debut = Date.parse(`${quand.slice(0, 10)}T00:00:00Z`);
  const fin = Date.parse(`${aujourdHui.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(debut) || !Number.isFinite(fin)) return false;
  return (fin - debut) / 86_400_000 < jours;
};

/**
 * Une intention par trajectoire close récemment.
 *
 * Atteinte ou abandonnée : les deux méritent d'être vues, et le centre ne
 * dit pas laquelle — « Trajectoires » est le libellé du groupe, et
 * l'écran des synthèses montre le reste. Une trajectoire **refusée** n'y
 * est pas : refuser est déjà une réponse, et la rappeler reviendrait à
 * reposer la question (même règle que pour le consentement).
 *
 * La référence est l'identifiant, jamais l'intitulé : « Dormir avant
 * minuit » est un objectif, donc une donnée de vie.
 */
export const intentionsDeTrajectoires = (
  closes: readonly { id: string; statut: string; closeLe: string | null }[],
  aujourdHui: string,
): Intention[] =>
  closes
    .filter(
      (t) =>
        (t.statut === 'atteinte' || t.statut === 'abandonnee') &&
        estRecent(t.closeLe, aujourdHui),
    )
    .map((t) => ({
      refSource: t.id,
      genre: 'a-savoir' as const,
      regroupement: SOURCE_TRAJECTOIRE,
    }));

/**
 * Le repère de veille à montrer, s'il y en a un.
 *
 * **C'est un déplacement, pas un ajout** : le § 2.2 dit que l'entrée du
 * centre EST le rappel discret unique du 5.1 du 27. D'où la forme — un
 * seul élément, jamais deux, puisque le signal lui-même n'autorise qu'un
 * repère ouvert à la fois.
 *
 * Et la source est **muette** au système : le 27 l'interdit, `sources.ts`
 * le garde par `peutNotifier: false`. Un rappel discret qui ferait sonner
 * le téléphone ne serait plus discret ; c'est tout le sens du mot.
 *
 * La référence est l'identifiant du signal. Ni l'indicateur, ni le
 * domaine, ni la sensibilité : la carte de la veille les montre, sur son
 * écran, coffre ouvert.
 */
export const intentionsDeVeille = (idDuRepere: string | null): Intention[] =>
  idDuRepere ? [{ refSource: idDuRepere, genre: 'a-savoir', regroupement: null }] : [];

/** Met le centre d'accord avec les trajectoires closes récemment. */
export const recenserLesTrajectoires = (
  closes: readonly { id: string; statut: string; closeLe: string | null }[],
  aujourdHui: string,
): Promise<Recensement> =>
  synchroniser(SOURCE_TRAJECTOIRE, intentionsDeTrajectoires(closes, aujourdHui));

/** Dépose ou retire le rappel discret de la veille du rythme. */
export const signalerLaVeille = (idDuRepere: string | null): Promise<Recensement> =>
  synchroniser(SOURCE_VEILLE, intentionsDeVeille(idDuRepere));

/**
 * La source du rappel de prise, branchée depuis la phase 4 de Santé.
 *
 * Elle a passé trois jours dans `SOURCES_NON_BRANCHEES`, avec une raison
 * datée : « pas de rappel de prise tant qu'il n'y a pas de posologie
 * structurée », signé par Alexis le 16 octobre. La condition de levée était
 * nommée ; le prompt 52 la remplit. `SchemaDePrise` **est** cette posologie
 * structurée, et `odyssee/rappels.ts` lit ce qui était prévu sans jamais
 * l'inventer.
 *
 * Ce qui n'a pas changé : le libellé neutre reste la règle, `prisesDuJour()`
 * reste un constat, et rien ici ne décide pour quelqu'un d'autre quand il a
 * oublié un médicament — c'est la personne qui fixe le délai, et le rappel
 * ne porte que sa propre déclaration.
 */
export const SOURCE_RAPPEL_DE_PRISE = 'rappel-de-prise';

/**
 * Dépose les rappels d'oubli du jour, et retire ceux qui ne le sont plus.
 *
 * Prend des **références toutes faites**, et non des traitements : les
 * producteurs du centre ne connaissent aucune branche, et faire entrer les
 * types de Santé ici ferait du centre un module qui sait ce qu'est une
 * molécule. Le calcul vit dans `odyssee/rappels.ts`, où il appartient.
 *
 * Genre `a-savoir` et non `a-trancher` : une question à trancher ne quitte
 * jamais le compteur tant qu'elle n'est pas résolue (§ 1 n° 8), et une prise
 * sans réponse n'est pas une question — « pas aujourd'hui » est une réponse
 * comme une autre, et ne rien répondre du tout en est une aussi. En faire
 * une question à trancher aurait fabriqué le compteur d'oublis que
 * l'interdit § 1 n° 3 refuse.
 *
 * Une seule relance par créneau sans aucun code de garde : l'identifiant
 * d'un élément dérive de `source + refSource`, et `deposer` n'émet que pour
 * un élément **neuf**. Recenser à chaque chargement de l'écran ne réémet
 * donc rien.
 */
export const recenserLesOublis = (refs: readonly string[]): Promise<Recensement> =>
  synchroniser(
    SOURCE_RAPPEL_DE_PRISE,
    refs.map((refSource) => ({ refSource, genre: 'a-savoir' as const, regroupement: null })),
  );

/**
 * La source du § 2.2 qu'on ne peut pas brancher, et pourquoi.
 *
 * Déclarée, pas tue. Le § 2.2 l'annonce « à brancher », et un lot qui la
 * laisserait simplement de côté ferait croire à un oubli — ou, pire,
 * laisserait quelqu'un la brancher sans retrouver ce qui l'en empêche.
 *
 * `rappel-de-prise` y figurait et n'y est plus : sa condition de levée est
 * remplie (voir `recenserLesOublis` ci-dessus). Elle était « différée » et
 * non « impossible », et la distinction, qui avait l'air d'une nuance le
 * 16 octobre, est exactement ce qui permet de la brancher aujourd'hui sans
 * contredire personne.
 *
 * - **`pointage-a-reporter`** existe exactement quand le coffre est
 *   **fermé** — c'est sa définition. Or le centre n'écrit rien coffre
 *   fermé (le magasin est scellé), et le § 3.2 lui interdit d'afficher le
 *   moindre nombre dans cet état. La source et le lieu sont donc
 *   incompatibles par construction, et pas par oubli. S'y ajoute que
 *   `combienDeReports` et `rejouerLesReports` ne sont appelés par aucun
 *   écran : le report n'a pas encore d'interface, et une notification qui
 *   mènerait à un écran incapable d'agir vaudrait moins que rien.
 *
 * Le contrôle `essais:centre-alimentation` tient cette liste : si l'une
 * de ces sources se met à alimenter le centre, la déclaration ment et
 * doit tomber.
 */
export const SOURCES_NON_BRANCHEES: readonly string[] = ['pointage-a-reporter'];
