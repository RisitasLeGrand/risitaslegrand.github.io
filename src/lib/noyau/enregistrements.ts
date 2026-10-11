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
}

const M = (m: MagasinJournalise): MagasinJournalise => m;

/**
 * Les magasins dont chaque enregistrement entre au journal.
 *
 * Cinq, et tous **immuables** : un résultat de QCM, une partie de N-Back, une
 * session de Veridical Mapping ne se modifient pas après coup. C'est ce qui
 * rend la règle « la dernière opération gagne » sans conséquence ici — il n'y
 * en a jamais qu'une par cible, sauf socle redondant.
 *
 * Ce que la liste ne contient pas, et pourquoi chaque absence est une décision :
 *
 * - **Les séances** se modifient (prévue, puis terminée, puis sa durée), et
 *   **les notes de séance** sont des textes rédigés à la main. Un dernier
 *   écrivain silencieux y perdrait deux pages de restitution. Elles demandent
 *   leur propre règle, et elles l'auront.
 * - **Les états de fiche** portent un **compteur** — les secondes passées
 *   dessus — et une date d'ouverture locale. Un compteur fusionné par « le
 *   dernier gagne » perd le temps lu sur l'autre appareil, ce qui est faux et
 *   invisible. Il faut une somme par appareil, donc une règle de plus.
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

export const idSocle = (magasin: string, clef: string): string =>
  `${PREFIXE_SOCLE}${magasin}-${clef}`;

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
): Operation | null {
  const declare = PAR_MAGASIN.get(magasin);
  if (!declare) return null;
  const clef = enregistrement[declare.clef];
  if (typeof clef !== 'string' || !clef) return null;
  return operation({
    id: idSocle(magasin, clef),
    appareil: APPAREIL_SOCLE,
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
  const derniere = new Map<string, Operation>();

  for (const op of operations) {
    // Une cible qui ne vient pas d'un magasin journalisé n'est pas notre
    // affaire : le journal porte aussi les noms d'appareils, les compactages,
    // les résolutions de conflit.
    if (!lireCible(op.cible)) continue;
    if (retenues && !retenues.has(op.cible)) continue;
    const vue = derniere.get(op.cible);
    if (!vue || comparerOperations(vue, op) < 0) derniere.set(op.cible, op);
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
      if (derniere.has(cible)) continue;
      const defaite = lireCible(cible);
      if (!defaite) continue;
      aEffacer.push({ magasin: defaite.magasin.magasin, clef: defaite.clef, cible });
    }
  }

  for (const cible of [...derniere.keys()].sort()) {
    const op = derniere.get(cible)!;
    const defaite = lireCible(cible)!;
    if (op.type === TYPE_SUPPRESSION) {
      aEffacer.push({ magasin: defaite.magasin.magasin, clef: defaite.clef, cible });
      continue;
    }
    const charge = lireCharge(op);
    if (!charge) {
      illisibles.push({
        id: op.id,
        cible,
        motif: 'La charge ne porte pas d’enregistrement lisible.',
      });
      continue;
    }
    if (charge.magasin !== defaite.magasin.magasin) {
      illisibles.push({
        id: op.id,
        cible,
        motif: `La charge annonce le magasin « ${charge.magasin} », la cible dit « ${defaite.magasin.magasin} ».`,
      });
      continue;
    }
    if (charge.enregistrement[defaite.magasin.clef] !== defaite.clef) {
      illisibles.push({
        id: op.id,
        cible,
        motif: `L’enregistrement porte une clé différente de celle de la cible.`,
      });
      continue;
    }
    aEcrire.push({
      magasin: defaite.magasin.magasin,
      enregistrement: charge.enregistrement,
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
