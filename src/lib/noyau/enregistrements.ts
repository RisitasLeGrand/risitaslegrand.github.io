/**
 * Les enregistrements journalisés : comment un fait de domaine voyage.
 *
 * ## Le défaut que ce module corrige
 *
 * À la fin de la phase 5, je l'avais écrit dans le plan : « les faits de
 * domaine ne sont pas journalisés, donc ils ne voyagent pas ». Deux appareils
 * synchronisés échangeaient leurs révisions FSRS, leurs réglages, leur registre
 * d'appareils — et **pas** leurs séances, leurs QCM, leurs sessions de
 * Cog-Training. L'écran disait « identiques ✓ » en ne regardant que les
 * journaux, ce qui était vrai et trompeur à la fois.
 *
 * Ce module est la réponse, et elle est volontairement la plus petite qui
 * tienne : **l'enregistrement lui-même entre au journal**, dans une opération.
 * Le magasin reste ce que les écrans lisent ; le journal devient ce qui voyage
 * et ce qui se rejoue.
 *
 * ## Pourquoi l'enregistrement entier, et pas le fait typé
 *
 * Le contrat de faits (`faits.ts`) décrit ce qu'une branche **publie** : un
 * type, une date, une valeur, des détails. C'est une vue, faite pour les
 * indicateurs et pour l'XP, et elle perd ce qui ne l'intéresse pas — les
 * identifiants de fiches couvertes par une séance, le score par rubrique d'un
 * QCM. Faire voyager la vue aurait donc perdu des données à chaque
 * synchronisation.
 *
 * L'opération porte donc l'enregistrement tel que le magasin le contient, et le
 * fait typé redevient ce qu'il est : une lecture, calculée à l'arrivée.
 *
 * ## La règle de matérialisation, en une phrase
 *
 * Pour une cible donnée, **la dernière opération gagne**, et une suppression
 * l'emporte sur tout ce qui la précède. C'est « l'état dérivé est recalculé
 * depuis le journal » appliqué à un magasin plutôt qu'à une carte : rien de
 * neuf, le même principe qu'au recalcul FSRS.
 *
 * Deux écritures du même appareil ne sont pas un conflit — c'est une
 * correction, et la plus récente gagne. Deux appareils qui écrivent la même
 * cible différemment sont un conflit, et `fusion.ts` le montre pour les types
 * qu'il faut montrer.
 *
 * ## Le socle est déterministe, et c'est tout l'intérêt
 *
 * L'existant n'a pas de journal : il faut l'y faire entrer. Pour les cartes
 * FSRS, le socle porte l'identité de l'appareil qui a migré, et deux appareils
 * migrant séparément produisent deux socles concurrents — un cas que la
 * première fusion **refuse**, faute de pouvoir savoir laquelle des deux
 * histoires a eu lieu.
 *
 * Ici, le problème n'existe pas : un socle d'enregistrement est une **copie**,
 * pas une histoire. Deux appareils qui portent la même séance doivent produire
 * la **même** opération, au signe près — même identifiant, même horloge, même
 * appareil déclaré. L'union les dédoublonne alors sans rien signaler, et les
 * deux journaux se retrouvent identiques.
 *
 * D'où un identifiant dérivé de la cible, une horloge au plancher et un
 * appareil nommé `socle` plutôt que le nom de la machine. Et une conséquence
 * heureuse : si les deux appareils portaient le même enregistrement **avec un
 * contenu différent**, l'identifiant est le même et les contenus diffèrent —
 * `normaliserJournal` signale alors une **collision**, retient la même version
 * des deux côtés, et le dit. C'est exactement ce qu'on veut qu'il arrive.
 */
import { typeDeFait } from './faits';
import { TYPE_SUPPRESSION } from './fusion';
import { comparerOperations, operation, SANS_LOT, type Operation } from './operations';
import { decoderHlc, encoderHlc, HLC_ZERO } from './hlc';

/* ══════════════════════════════════════════════════════════════════════════
   Les magasins journalisés
   ══════════════════════════════════════════════════════════════════════════ */

export interface MagasinJournalise {
  /** Le nom du magasin IndexedDB. */
  magasin: string;
  /** Le type de fait déclaré au catalogue, qui sert de type d'opération. */
  type: string;
  /** Le champ qui porte la clé de l'enregistrement. */
  clef: string;
  /** Ce que c'est, en français, pour les écrans et les messages. */
  libelle: string;
  /**
   * Un socle **partagé** ou **par appareil**, et le choix n'est pas cosmétique.
   *
   * `partage` (le défaut) : l'identifiant du socle ne dépend que de la cible,
   * donc deux appareils qui portent le même enregistrement produisent **une
   * seule** opération et se réconcilient en silence. C'est ce qu'il faut pour un
   * événement **immuable** — un QCM passé le 3 mai est le même des deux côtés,
   * et deux opérations pour un seul fait seraient du bruit.
   *
   * `appareil` : l'identifiant porte aussi l'appareil, et l'opération son nom.
   * C'est ce qu'il faut dès que l'enregistrement peut **légitimement différer**
   * d'un appareil à l'autre : l'état d'une fiche, qui se combine, et la note
   * d'une séance, dont le désaccord doit être **montré**. Avec un socle
   * partagé, les deux versions auraient le même identifiant : l'union n'en
   * aurait gardé qu'une, choisie par une règle de départage qui n'a aucun sens
   * métier, et la seconde aurait disparu sans que rien ne le dise.
   */
  soclePar?: 'partage' | 'appareil';
  /**
   * Comment plusieurs appareils se combinent, quand « le dernier gagne » est faux.
   *
   * Reçoit **la dernière version de chaque appareil**, dans l'ordre de l'horloge,
   * et rend l'enregistrement à écrire. Deux écritures du même appareil ne sont
   * pas une divergence : c'est une correction, et seule la plus récente est
   * présentée ici.
   *
   * Sans `combiner`, la règle reste « la dernière opération gagne », ce qui est
   * juste pour un événement immuable et pour une séance.
   */
  combiner?: (
    versions: readonly { appareil: string; enregistrement: Record<string, unknown> }[],
  ) => Record<string, unknown>;
}

const M = (m: MagasinJournalise): MagasinJournalise => m;

/* --- La règle de l'état d'une fiche -------------------------------------- */

const ouLogique = (versions: readonly Record<string, unknown>[], champ: string): boolean =>
  versions.some((v) => v[champ] === true);

/** Le plus grand des textes comparables — donc la date la plus récente, en ISO. */
function dateMax(versions: readonly Record<string, unknown>[], champ: string): string | undefined {
  let haut: string | undefined;
  for (const v of versions) {
    const valeur = v[champ];
    if (typeof valeur !== 'string' || !valeur) continue;
    if (!haut || valeur > haut) haut = valeur;
  }
  return haut;
}

/** La plus ancienne des dates. */
function dateMin(versions: readonly Record<string, unknown>[], champ: string): string | undefined {
  let bas: string | undefined;
  for (const v of versions) {
    const valeur = v[champ];
    if (typeof valeur !== 'string' || !valeur) continue;
    if (!bas || valeur < bas) bas = valeur;
  }
  return bas;
}

function nombreMax(versions: readonly Record<string, unknown>[], champ: string): number {
  let haut = 0;
  for (const v of versions) {
    const valeur = v[champ];
    if (typeof valeur === 'number' && Number.isFinite(valeur) && valeur > haut) haut = valeur;
  }
  return haut;
}

function union(versions: readonly Record<string, unknown>[], champ: string): string[] {
  const vus = new Set<string>();
  for (const v of versions) {
    const valeur = v[champ];
    if (!Array.isArray(valeur)) continue;
    for (const x of valeur) if (typeof x === 'string') vus.add(x);
  }
  return [...vus].sort();
}

/**
 * L'état d'une fiche se **combine**, champ par champ, et ne s'écrase pas.
 *
 * C'est le seul magasin où « la dernière écriture gagne » serait faux, et pour
 * une raison simple : ses champs ne décrivent pas un état instantané, ils
 * accumulent une histoire. Lue sur l'ordinateur, elle est lue ; prétestée sur
 * le téléphone, elle est prétestée. Prendre la version la plus récente
 * effacerait l'une des deux, et personne ne saurait laquelle.
 *
 * Champ par champ, et chaque règle a sa raison :
 *
 * - `lu` : **ou logique**. Une fiche lue ne redevient pas non lue.
 * - `pretesteeLe` : **la plus ancienne**. L'effet de prétest tient à ce qu'il
 *   précède la première lecture ; c'est donc la première tentative qui compte.
 * - `pretestPasseLe` : **la plus récente**. « Passer » n'est pas répondre, et le
 *   prétest revient un autre jour : c'est le dernier report qui décide.
 * - `pretestVues` : **union**. Les questions déjà servies ne doivent pas
 *   revenir, d'où qu'elles aient été servies.
 * - `derniereOuverture` : **la plus récente**, qui est la seule lecture juste.
 * - `secondes` : **le maximum**. Un compteur fusionné par le maximum
 *   sous-estime quand on a lu la même fiche sur deux appareils ; il ne
 *   surestime jamais, et une surestimation serait pire — elle ferait croire à
 *   un travail qui n'a pas eu lieu. (Le champ n'est d'ailleurs incrémenté
 *   nulle part aujourd'hui : il est reporté tel quel d'une écriture à l'autre.)
 * - `matiere` : celle de la version la plus récente. C'est une étiquette, pas
 *   une histoire.
 */
export function combinerEtatDeFiche(
  versions: readonly { appareil: string; enregistrement: Record<string, unknown> }[],
): Record<string, unknown> {
  const tous = versions.map((v) => v.enregistrement);
  const derniere = tous[tous.length - 1] ?? {};
  const combine: Record<string, unknown> = {
    ...derniere,
    lu: ouLogique(tous, 'lu'),
    secondes: nombreMax(tous, 'secondes'),
  };

  const ouverture = dateMax(tous, 'derniereOuverture');
  combine.derniereOuverture = ouverture ?? null;

  const pretestee = dateMin(tous, 'pretesteeLe');
  if (pretestee) combine.pretesteeLe = pretestee;
  else delete combine.pretesteeLe;

  const passe = dateMax(tous, 'pretestPasseLe');
  if (passe) combine.pretestPasseLe = passe;
  else delete combine.pretestPasseLe;

  const vues = union(tous, 'pretestVues');
  if (vues.length) combine.pretestVues = vues;
  else delete combine.pretestVues;

  return combine;
}

/**
 * Les magasins dont chaque enregistrement entre au journal.
 *
 * Cinq d'abord, tous **immuables** : un résultat de QCM, une partie de N-Back,
 * une session de Veridical Mapping ne se modifient pas après coup. C'est ce qui
 * rend la règle « la dernière opération gagne » sans conséquence pour eux — il
 * n'y en a jamais qu'une par cible, sauf socle redondant.
 *
 * Deux de plus, qui ont demandé chacune leur règle :
 *
 * - **Les séances** se modifient : prévue, puis terminée, puis sa durée
 *   corrigée. La dernière écriture gagne, et c'est juste ici — les champs d'une
 *   séance sont objectifs, et l'écriture la plus récente est la mieux informée.
 * - **Les notes de séance** sont des textes rédigés à la main, parfois deux
 *   pages. La dernière écriture gagne **aussi**, mais le désaccord entre deux
 *   appareils est **montré** et non résolu : `revision.note-seance` est dans
 *   `TYPES_TEXTE_A_CONFLIT`, la version la plus récente s'affiche en attendant,
 *   et la réponse donnée au conflit décide — `materialiser` la respecte.
 *
 * - **Les états de fiche** ne s'écrasent pas, ils se **combinent** : lue sur
 *   l'ordinateur, prétestée sur le téléphone, les deux doivent tenir. C'est le
 *   seul magasin à porter un `combiner`, et chaque champ y a sa règle — voir
 *   `combinerEtatDeFiche`. Ils n'entrent au journal qu'au **changement réel** :
 *   l'écriture a lieu à chaque ouverture de fiche, et journaliser une visite
 *   ferait des milliers d'opérations pour aucune information.
 *
 * Ce que la liste ne contient toujours pas, et pourquoi c'est une décision :
 *
 * - **Les compteurs de tirage DGFiP** (`qcmDgfip`) sont un **état dérivé** des
 *   sessions, et un état dérivé ne se fusionne pas : il se recalcule. Mais les
 *   sessions d'avant ne portent pas le détail par question, donc le recalcul
 *   est impossible pour l'historique. Ils restent donc locaux, et c'est dit
 *   plutôt que caché : une session reçue d'un autre appareil compte dans les
 *   statistiques et l'XP, pas encore dans la pondération du tirage.
 * - **Les cartes FSRS** n'y seront jamais : elles ont déjà leur journal, et en
 *   avoir deux voudrait dire deux règles de fusion pour la même donnée.
 */
export const MAGASINS_JOURNALISES: readonly MagasinJournalise[] = [
  M({ magasin: 'quiz', type: 'revision.qcm', clef: 'id', libelle: 'QCM de cours' }),
  M({ magasin: 'qcmSessions', type: 'revision.qcm', clef: 'id', libelle: 'QCM DGFiP' }),
  M({ magasin: 'nback', type: 'revision.cog-training', clef: 'id', libelle: 'Quad N-Back' }),
  M({
    magasin: 'relationnel',
    type: 'revision.cog-training',
    clef: 'id',
    libelle: 'Relational Reasoning',
  }),
  M({
    magasin: 'vmSessions',
    type: 'revision.cog-training',
    clef: 'id',
    libelle: 'Veridical Mapping',
  }),
  M({
    magasin: 'seances',
    type: 'revision.seance',
    clef: 'id',
    libelle: 'Séance de révision',
    soclePar: 'appareil',
  }),
  M({
    magasin: 'notes',
    type: 'revision.note-seance',
    clef: 'seanceId',
    libelle: 'Note de séance',
    soclePar: 'appareil',
  }),
  M({
    magasin: 'fiches',
    type: 'revision.fiche',
    clef: 'id',
    libelle: 'État d’une fiche',
    soclePar: 'appareil',
    combiner: combinerEtatDeFiche,
  }),
  /*
     Odyssée. Les cinq magasins entrent dès leur création, et non après coup :
     une donnée écrite avant d'être inscrite ici ne voyagerait pas, et le
     socle de rattrapage devrait inventer une horloge pour elle.

     La dernière écriture gagne partout, et c'est juste pour les cinq. Une
     tâche, une quête, un événement et une revue sont des objets que la
     personne modifie entièrement depuis un écran : l'appareil qui a écrit en
     dernier est celui devant lequel elle était. Le focus, lui, ne se modifie
     pas du tout — une session enregistrée est close.

     Les jours tenus d'une quête mériteraient en théorie une union plutôt
     qu'un écrasement : tenue le matin sur le téléphone, tenue le soir sur
     l'ordinateur hors ligne, la dernière écriture perd le jour de l'autre.
     Mais une quête se tient **une fois par jour**, et le cas suppose deux
     appareils tenant la même quête le même jour sans s'être synchronisés
     entre les deux. Le coût d'une règle de combinaison de plus — et d'une
     règle de plus à tenir juste pour toujours — dépasse celui de ce cas-là.
     Si l'usage le dément, `combiner` est là pour ça, comme pour les fiches.
  */
  M({ magasin: 'odysseeTaches', type: 'odyssee.tache', clef: 'id', libelle: 'Tâche' }),
  M({ magasin: 'odysseeQuetes', type: 'odyssee.quete', clef: 'id', libelle: 'Quête' }),
  M({
    magasin: 'odysseeEvenements',
    type: 'odyssee.evenement',
    clef: 'id',
    libelle: 'Événement d’agenda',
  }),
  M({ magasin: 'odysseeFocus', type: 'odyssee.focus', clef: 'id', libelle: 'Temps focus' }),
  M({ magasin: 'odysseeRevues', type: 'odyssee.revue', clef: 'id', libelle: 'Revue' }),
  /*
     Sport. La séance porte ses séries : une seule opération par séance, et la
     dernière écriture gagne. C'est ce qui rend la sauvegarde à chaque série
     tenable — sans quoi une séance de trente séries ferait trente opérations
     dont vingt-neuf seraient aussitôt périmées.

     Conséquence à connaître : deux appareils qui enregistreraient la **même**
     séance en parallèle garderaient celle du dernier. Le cas suppose de
     s'entraîner en saisissant sur deux téléphones à la fois ; le prix d'une
     règle de combinaison pour cela dépasse ce qu'elle éviterait.
  */
  M({ magasin: 'sportExercices', type: 'sport.record', clef: 'id', libelle: 'Exercice' }),
  M({ magasin: 'sportSeances', type: 'sport.seance', clef: 'id', libelle: 'Séance de sport' }),
  M({ magasin: 'sportPhases', type: 'sport.phase', clef: 'id', libelle: 'Phase d’entraînement' }),
  M({ magasin: 'sportBlessures', type: 'sport.blessure', clef: 'id', libelle: 'Blessure' }),
  M({ magasin: 'sportProgrammes', type: 'sport.phase', clef: 'id', libelle: 'Programme' }),

  /*
     Le domaine Corps d'Odyssée. Ni médicaments ni statut hormonal : la
     décision 3 n'est pas tranchée, et inscrire au registre un magasin qui
     n'existe pas encore serait promettre un voyage à une donnée sensible
     avant d'avoir décidé comment elle doit être écrite.
  */
  M({ magasin: 'odysseePesees', type: 'odyssee.poids', clef: 'id', libelle: 'Pesée' }),
  M({ magasin: 'odysseeMesures', type: 'odyssee.mesure', clef: 'id', libelle: 'Mesure corporelle' }),
  M({ magasin: 'odysseeNuits', type: 'odyssee.sommeil', clef: 'id', libelle: 'Nuit' }),
  M({ magasin: 'odysseeRepas', type: 'odyssee.repas', clef: 'id', libelle: 'Repas' }),
  M({ magasin: 'odysseeBoissons', type: 'odyssee.hydratation', clef: 'id', libelle: 'Boisson' }),
  M({ magasin: 'odysseeSante', type: 'odyssee.sante', clef: 'id', libelle: 'État de santé' }),
  /*
     Une trajectoire **voyage**, contrairement aux refus de Sport : elle porte
     un choix de fond sur les prochains mois, pas une consigne de silence de
     trois semaines. La perdre en changeant d'appareil coûterait quelque chose.
  */
  M({ magasin: 'odysseeTrajectoires', type: 'odyssee.quete', clef: 'id', libelle: 'Trajectoire' }),
];

const PAR_MAGASIN = new Map(MAGASINS_JOURNALISES.map((m) => [m.magasin, m]));

export const magasinJournalise = (magasin: string): MagasinJournalise | undefined =>
  PAR_MAGASIN.get(magasin);

/**
 * La cible d'une opération d'enregistrement.
 *
 * Le nom du magasin est dans la cible, et il doit y être : deux magasins
 * peuvent porter le même type de fait — les trois familles de Cog-Training en
 * sont l'exemple —, et sans le préfixe, une session de N-Back et une session de
 * Veridical Mapping de même identifiant se matérialiseraient l'une sur l'autre.
 */
export const cibleDe = (magasin: string, clef: string): string => `${magasin}:${clef}`;

/** Défait une cible. Rend `null` si elle ne vient pas d'un magasin journalisé. */
export function lireCible(cible: string): { magasin: MagasinJournalise; clef: string } | null {
  const separation = cible.indexOf(':');
  if (separation <= 0) return null;
  const magasin = PAR_MAGASIN.get(cible.slice(0, separation));
  if (!magasin) return null;
  const clef = cible.slice(separation + 1);
  return clef ? { magasin, clef } : null;
}

/* ══════════════════════════════════════════════════════════════════════════
   La charge
   ══════════════════════════════════════════════════════════════════════════ */

export interface ChargeEnregistrement {
  /** Le magasin, répété dans la charge pour qu'elle se relise seule. */
  magasin: string;
  /** L'enregistrement tel que le magasin le contient. */
  enregistrement: Record<string, unknown>;
}

export function lireCharge(op: Operation): ChargeEnregistrement | null {
  const charge = op.charge as Partial<ChargeEnregistrement> | undefined;
  if (!charge || typeof charge.magasin !== 'string') return null;
  const enregistrement = charge.enregistrement;
  if (!enregistrement || typeof enregistrement !== 'object' || Array.isArray(enregistrement)) {
    return null;
  }
  return { magasin: charge.magasin, enregistrement: enregistrement as Record<string, unknown> };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le socle
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'appareil déclaré par une opération de socle.
 *
 * Ce n'est pas un nom d'appareil, et c'est voulu : un socle n'a pas été émis
 * par une machine, il constate ce qui était là avant le journal. Mettre le nom
 * de la machine qui a migré rendrait les deux socles différents, donc les deux
 * journaux inégaux pour toujours.
 */
export const APPAREIL_SOCLE = 'socle';

/** L'horloge d'un socle : le plancher, donc avant toute opération réelle. */
export const HLC_SOCLE = encoderHlc(HLC_ZERO);

/** Le préfixe d'identifiant d'un socle. Lisible, et hors de l'espace des ULID. */
export const PREFIXE_SOCLE = 'SOCLE-';

export const idSocle = (magasin: string, clef: string, appareil?: string): string =>
  appareil
    ? `${PREFIXE_SOCLE}${magasin}-${clef}-${appareil}`
    : `${PREFIXE_SOCLE}${magasin}-${clef}`;

export const estSocle = (op: Operation): boolean => op.id.startsWith(PREFIXE_SOCLE);

/**
 * L'opération de socle d'un enregistrement existant.
 *
 * Déterministe : deux appareils portant le même enregistrement rendent la même
 * opération, au signe près. C'est la propriété qui rend la première fusion de
 * deux bases migrées séparément non seulement possible, mais silencieuse.
 */
export function operationSocle(
  magasin: string,
  enregistrement: Record<string, unknown>,
  appareil?: string,
): Operation | null {
  const declare = PAR_MAGASIN.get(magasin);
  if (!declare) return null;
  const clef = enregistrement[declare.clef];
  if (typeof clef !== 'string' || !clef) return null;
  /*
     Un socle par appareil sans appareil serait un socle partagé, donc une
     version perdue en silence : on préfère ne rien écrire et le dire.
  */
  const parAppareil = declare.soclePar === 'appareil';
  if (parAppareil && !appareil) return null;
  return operation({
    id: idSocle(magasin, clef, parAppareil ? appareil : undefined),
    appareil: parAppareil ? appareil! : APPAREIL_SOCLE,
    hlc: decoderHlc(HLC_SOCLE),
    type: declare.type,
    cible: cibleDe(magasin, clef),
    lot: SANS_LOT,
    charge: { magasin, enregistrement } satisfies ChargeEnregistrement,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   La matérialisation
   ══════════════════════════════════════════════════════════════════════════ */

export interface AEcrire {
  magasin: string;
  enregistrement: Record<string, unknown>;
  /** La cible dont il vient, pour les messages. */
  cible: string;
}

export interface AEffacer {
  magasin: string;
  clef: string;
  cible: string;
}

export interface Materialisation {
  aEcrire: AEcrire[];
  aEffacer: AEffacer[];
  /** Les opérations d'enregistrement illisibles, qui ne sont pas appliquées. */
  illisibles: { id: string; cible: string; motif: string }[];
}

export interface OptionsMaterialisation {
  /**
   * Ne matérialiser que ces cibles. Sans quoi tout le journal est matérialisé —
   * ce qui est juste, et cher : on ne le fait qu'à la réparation.
   */
  cibles?: Iterable<string>;
  /**
   * Les réponses données aux conflits, lues du journal (`corrections.ts`).
   *
   * Sans elles, la matérialisation prendrait toujours la version la plus
   * récente — ce qui est le bon affichage **en attendant** une réponse, et le
   * mauvais une fois la réponse donnée. Répondre « garder celle de
   * l'ordinateur » et voir s'afficher celle du téléphone rendrait la réponse
   * inutile, donc le conflit insoluble.
   *
   * Seule l'issue « retenue » change quelque chose : « les deux sont justes »
   * et « ignoré » laissent la plus récente, puisqu'aucune des deux n'a été
   * désignée.
   */
  retenues?: Iterable<{ cible: string; retenue?: string; issue: string }>;
}

/**
 * Ce qu'il faut écrire et effacer pour que les magasins disent ce que dit le
 * journal.
 *
 * Pure et déterministe : les opérations entrent, deux listes sortent. Les
 * suppressions l'emportent sur toute écriture antérieure, et une écriture
 * postérieure à une suppression ressuscite la cible — un objet supprimé puis
 * recréé est un objet qui existe, et c'est le même raisonnement qu'à la
 * compaction.
 */
export function materialiser(
  operations: readonly Operation[],
  options: OptionsMaterialisation = {},
): Materialisation {
  const retenues = options.cibles ? new Set(options.cibles) : null;

  /*
     Les réponses aux conflits, par cible : seule l'issue « retenue » désigne une
     opération. « Les deux sont justes » et « ignoré » laissent la règle du
     magasin décider, puisqu'aucune version n'a été choisie.
  */
  const designee = new Map<string, string>();
  for (const resolution of options.retenues ?? []) {
    if (resolution.issue !== 'retenue' || !resolution.retenue) continue;
    designee.set(resolution.cible, resolution.retenue);
  }

  // Toutes les opérations d'enregistrement, groupées par cible.
  const parCible = new Map<string, Operation[]>();
  for (const op of operations) {
    // Une cible qui ne vient pas d'un magasin journalisé n'est pas notre
    // affaire : le journal porte aussi les noms d'appareils, les compactages,
    // les résolutions de conflit.
    if (!lireCible(op.cible)) continue;
    if (retenues && !retenues.has(op.cible)) continue;
    const groupe = parCible.get(op.cible);
    if (groupe) groupe.push(op);
    else parCible.set(op.cible, [op]);
  }

  const aEcrire: AEcrire[] = [];
  const aEffacer: AEffacer[] = [];
  const illisibles: Materialisation['illisibles'] = [];

  /*
     Une cible demandée dont le journal ne dit **plus rien** doit disparaître du
     magasin. C'est le cas de l'annulation d'un lot : les opérations reçues sont
     retirées, et l'enregistrement qu'elles avaient fait apparaître n'a plus
     aucune raison d'être là. Sans cette ligne, annuler une fusion laisserait
     derrière elle les séances et les QCM de l'autre appareil — une annulation
     qui n'annule pas.
  */
  if (retenues) {
    for (const cible of [...retenues].sort()) {
      if (parCible.has(cible)) continue;
      const defaite = lireCible(cible);
      if (!defaite) continue;
      aEffacer.push({ magasin: defaite.magasin.magasin, clef: defaite.clef, cible });
    }
  }

  for (const cible of [...parCible.keys()].sort()) {
    const defaite = lireCible(cible)!;
    const magasin = defaite.magasin;
    const ordonnees = [...parCible.get(cible)!].sort(comparerOperations);
    const derniere = ordonnees[ordonnees.length - 1];

    if (derniere.type === TYPE_SUPPRESSION) {
      aEffacer.push({ magasin: magasin.magasin, clef: defaite.clef, cible });
      continue;
    }

    /*
       On ne regarde que ce qui suit la **dernière suppression** : un objet
       supprimé puis recréé repart de zéro, et combiner son avant et son après
       ressusciterait ce que la suppression avait écarté.
    */
    let depuis = -1;
    for (let i = 0; i < ordonnees.length; i += 1) {
      if (ordonnees[i].type === TYPE_SUPPRESSION) depuis = i;
    }
    const utiles = ordonnees.slice(depuis + 1);

    /** Lit la charge d'une opération, ou la signale illisible. */
    const charge = (op: Operation) => {
      const lue = lireCharge(op);
      if (!lue) {
        illisibles.push({
          id: op.id,
          cible,
          motif: 'La charge ne porte pas d’enregistrement lisible.',
        });
        return null;
      }
      if (lue.magasin !== magasin.magasin) {
        illisibles.push({
          id: op.id,
          cible,
          motif: `La charge annonce le magasin « ${lue.magasin} », la cible dit « ${magasin.magasin} ».`,
        });
        return null;
      }
      if (lue.enregistrement[magasin.clef] !== defaite.clef) {
        illisibles.push({
          id: op.id,
          cible,
          motif: 'L’enregistrement porte une clé différente de celle de la cible.',
        });
        return null;
      }
      return lue;
    };

    /*
       Une réponse au conflit désigne une version : elle décide, et la règle du
       magasin ne s'applique plus. Répondre « garder celle de l'ordinateur » et
       voir s'afficher une combinaison des deux ne serait pas une réponse.
    */
    const choisie = designee.get(cible);
    if (choisie) {
      const op = utiles.find((o) => o.id === choisie);
      if (op) {
        const lue = charge(op);
        if (lue) {
          aEcrire.push({ magasin: magasin.magasin, enregistrement: lue.enregistrement, cible });
        }
        continue;
      }
      // Désignée mais absente de ce qui suit la dernière suppression : la
      // réponse portait sur une version que le journal ne porte plus.
    }

    if (!magasin.combiner) {
      const lue = charge(utiles[utiles.length - 1]);
      if (lue) {
        aEcrire.push({ magasin: magasin.magasin, enregistrement: lue.enregistrement, cible });
      }
      continue;
    }

    /*
       La règle du magasin combine **la dernière version de chaque appareil**.
       Deux écritures du même appareil ne sont pas une divergence : c'est une
       correction, et la plus récente la remplace.
    */
    const parAppareil = new Map<string, Operation>();
    for (const op of utiles) parAppareil.set(op.appareil, op);
    const versions: { appareil: string; enregistrement: Record<string, unknown> }[] = [];
    for (const op of [...parAppareil.values()].sort(comparerOperations)) {
      const lue = charge(op);
      if (lue) versions.push({ appareil: op.appareil, enregistrement: lue.enregistrement });
    }
    if (!versions.length) continue;
    aEcrire.push({
      magasin: magasin.magasin,
      enregistrement: magasin.combiner(versions),
      cible,
    });
  }

  return { aEcrire, aEffacer, illisibles };
}

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle du catalogue
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Vérifie que chaque magasin journalisé annonce un type déclaré au catalogue.
 *
 * Même raison que pour les types à conflit explicite : une liste écrite à la
 * main dérive du catalogue, et un type renommé sortirait d'ici sans bruit — ses
 * enregistrements cesseraient alors de voyager, ce qui est précisément le défaut
 * que ce module corrige.
 */
export function controlerMagasins(): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();
  for (const m of MAGASINS_JOURNALISES) {
    if (vus.has(m.magasin)) problemes.push(`Le magasin « ${m.magasin} » est déclaré deux fois.`);
    vus.add(m.magasin);
    if (!typeDeFait(m.type)) {
      problemes.push(
        `Le magasin « ${m.magasin} » annonce le type « ${m.type} », absent du catalogue de faits.`,
      );
    }
  }
  return problemes;
}
