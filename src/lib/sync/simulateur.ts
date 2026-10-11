/**
 * Le simulateur de deux appareils.
 *
 * Le prompt le demande comme livrable, et c'est la bonne idée : sans lui, la
 * seule façon d'éprouver une fusion serait d'avoir deux appareils réels, de les
 * faire diverger à la main pendant un mois, puis d'espérer avoir pensé au cas
 * qui casse. Avec lui, trente jours de divergence tiennent dans une boucle, et
 * un cas qui casse se rejoue à l'identique.
 *
 * ## Il ne simule pas le réseau, il simule la divergence
 *
 * Aucune couche de transport ici, et aucun chiffrement : le simulateur fait
 * circuler des paquets **en clair** d'un appareil à l'autre, sous le contrôle du
 * test. C'est voulu. Si l'on simulait aussi le réseau, un essai qui tombe
 * laisserait le doute sur ce qui a échoué — la fusion, le format, ou le canal.
 * Le chiffrement et le transport ont leurs essais, séparément ; celui-ci porte
 * sur la seule chose qui peut abîmer des données.
 *
 * ## Les états dérivés sont vraiment recalculés
 *
 * Un simulateur qui se contenterait de fusionner des journaux ne prouverait rien
 * de la règle centrale du chantier. Chaque appareil porte donc un recalcul
 * injecté — pour les essais, une fonction simple et déterministe — et la
 * vérification compare les états **après** recalcul. C'est là que se verrait une
 * XP comptée deux fois.
 */
import { fusionner, type EtatSynchronisable, type Reglages } from '../noyau/fusion';
import { empreinte } from '../noyau/empreinte';
import { fabriqueUlid } from '../noyau/ulid';
import { Horloge, type Hlc } from '../noyau/hlc';
import { operation, type Operation } from '../noyau/operations';

/** Ce qu'un appareil simulé expose. */
export interface AppareilSimule {
  readonly nom: string;
  readonly identifiant: string;
  /** L'état synchronisable : journal et réglages. */
  etat(): EtatSynchronisable;
  /** Émet un fait local. Rend l'opération écrite. */
  saisir(type: string, cible: string, charge: unknown): Operation;
  /** Écrit un réglage local. */
  regler(champ: string, valeur: unknown): void;
  /** Le paquet à envoyer : les opérations de la tranche demandée. */
  paquet(depuis?: string): { operations: Operation[]; reglages: Reglages };
  /** Intègre un paquet reçu. Rend ce que la fusion a trouvé. */
  recevoir(
    paquet: { operations: Operation[]; reglages: Reglages },
    lot?: string,
  ): ReturnType<typeof fusionner>;
  /** L'empreinte d'état, celle que l'écran affiche. */
  empreinte(): Promise<string>;
  /** L'état dérivé, recalculé depuis le journal. */
  derive(): Record<string, unknown>;
  /** Le décalage d'horloge de cet appareil, en millisecondes. */
  readonly deriveHorloge: number;
}

export interface OptionsAppareil {
  nom: string;
  identifiant: string;
  /** Décalage de l'horloge murale, pour éprouver la dérive. */
  deriveHorloge?: number;
  /** L'instant de départ, partagé par les deux appareils. */
  instant?: () => number;
  /**
   * Le recalcul de l'état dérivé depuis le journal. Injecté, parce que le
   * simulateur n'a pas à connaître FSRS, l'XP ni la série — et parce qu'un
   * essai doit pouvoir en fournir un dont il connaît la réponse exacte.
   */
  recalculer?: (operations: readonly Operation[]) => Record<string, unknown>;
}

/**
 * Le recalcul par défaut : un compte par type et par cible.
 *
 * Déterministe et indépendant de l'ordre, donc comparable entre deux appareils.
 * Il n'imite pas FSRS — ce serait réimplémenter l'ordonnanceur dans un essai —
 * mais il a la propriété qui compte : il ne peut être juste que si les deux
 * journaux sont identiques.
 */
export const recalculParDefaut = (
  operations: readonly Operation[],
): Record<string, unknown> => {
  const parType: Record<string, number> = {};
  const parCible: Record<string, number> = {};
  let points = 0;
  for (const op of operations) {
    parType[op.type] = (parType[op.type] ?? 0) + 1;
    parCible[op.cible] = (parCible[op.cible] ?? 0) + 1;
    // Un « XP » qui dépend du contenu : si une opération était comptée deux
    // fois, ce nombre le dirait, là où un simple décompte pourrait coïncider.
    points += typeof op.charge === 'object' && op.charge && 'valeur' in op.charge
      ? Number((op.charge as { valeur: unknown }).valeur) || 0
      : 1;
  }
  return { parType, parCible, points, total: operations.length };
};

export function appareil(options: OptionsAppareil): AppareilSimule {
  const derive = options.deriveHorloge ?? 0;
  const murale = () => (options.instant?.() ?? Date.now()) + derive;
  const horloge = new Horloge(murale);
  const prochainId = fabriqueUlid(murale);
  const recalculer = options.recalculer ?? recalculParDefaut;

  let operations: Operation[] = [];
  let reglages: Reglages = {};

  const emettre = (): Hlc => horloge.emettre();

  return {
    nom: options.nom,
    identifiant: options.identifiant,
    deriveHorloge: derive,

    etat: () => ({ operations: [...operations], reglages: { ...reglages } }),

    saisir(type, cible, charge) {
      const op = operation({
        id: prochainId(),
        appareil: options.identifiant,
        hlc: emettre(),
        type,
        cible,
        charge,
      });
      operations = [...operations, op];
      return op;
    },

    regler(champ, valeur) {
      const h = emettre();
      reglages = {
        ...reglages,
        [champ]: {
          valeur,
          hlc: `${String(h.ms).padStart(15, '0')}-${h.compteur
            .toString(36)
            .toUpperCase()
            .padStart(4, '0')}`,
          appareil: options.identifiant,
        },
      };
    },

    paquet(depuis) {
      return {
        operations: depuis ? operations.filter((o) => o.hlc > depuis) : [...operations],
        reglages: { ...reglages },
      };
    },

    recevoir(paquet, lot) {
      // L'horloge locale absorbe celle du paquet : c'est ce qui garantit que ce
      // que cet appareil émettra ensuite sera postérieur à ce qu'il vient de
      // voir, même si son horloge murale est en retard.
      for (const op of paquet.operations) {
        const [ms, compteur] = op.hlc.split('-');
        horloge.recevoir({ ms: Number(ms), compteur: parseInt(compteur, 36) });
      }
      const resultat = fusionner(
        { operations, reglages },
        { operations: paquet.operations, reglages: paquet.reglages },
        { lot },
      );
      operations = [...resultat.etat.operations];
      reglages = resultat.etat.reglages;
      return resultat;
    },

    empreinte: () =>
      empreinte({
        operations: operations.map((o) => o.id),
        reglages: Object.fromEntries(
          Object.entries(reglages).map(([c, r]) => [c, [r.valeur, r.hlc, r.appareil]]),
        ),
      }),

    derive: () => recalculer(operations),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le canal, que le test contrôle
   ══════════════════════════════════════════════════════════════════════════ */

export type Avarie =
  | { genre: 'aucune' }
  /** Le paquet n'arrive pas du tout : coupure avant transfert. */
  | { genre: 'perdu' }
  /** Le paquet arrive tronqué : seules les n premières opérations. */
  | { genre: 'tronque'; garder: number }
  /** Le paquet arrive deux fois : l'idempotence doit l'absorber. */
  | { genre: 'double' };

export interface Echange {
  recues: number;
  conflits: number;
  collisions: number;
}

/**
 * Transmet d'un appareil à l'autre, avec l'avarie demandée.
 *
 * `perdu` ne lève pas : une coupure n'est pas une erreur du programme, c'est un
 * état du monde, et le code appelant doit pouvoir réessayer sans rien défaire.
 */
export function transmettre(
  de: AppareilSimule,
  vers: AppareilSimule,
  options: { depuis?: string; lot?: string; avarie?: Avarie } = {},
): Echange {
  const avarie = options.avarie ?? { genre: 'aucune' };
  const paquet = de.paquet(options.depuis);

  if (avarie.genre === 'perdu') return { recues: 0, conflits: 0, collisions: 0 };

  const aLivrer =
    avarie.genre === 'tronque'
      ? { ...paquet, operations: paquet.operations.slice(0, avarie.garder) }
      : paquet;

  const premier = vers.recevoir(aLivrer, options.lot);
  const second = avarie.genre === 'double' ? vers.recevoir(aLivrer, options.lot) : null;

  return {
    recues: premier.recues.length + (second?.recues.length ?? 0),
    conflits: premier.conflits.length,
    collisions: premier.collisions.length,
  };
}

/** Les deux appareils sont-ils identiques, au sens de l'écran ? */
export async function identiques(a: AppareilSimule, b: AppareilSimule): Promise<boolean> {
  return (await a.empreinte()) === (await b.empreinte());
}

/** Et leurs états dérivés, après recalcul ? */
export const deriveIdentique = (a: AppareilSimule, b: AppareilSimule): boolean =>
  JSON.stringify(a.derive()) === JSON.stringify(b.derive());
