/**
 * Le salon : deux appareils qui se trouvent tout seuls.
 *
 * C'est le mode A1, et le chemin privilégié : après un scan, synchroniser ne
 * demande plus qu'un bouton. Les deux appareils rejoignent un salon dont le nom
 * vient du QR, s'y reconnaissent, ouvrent une liaison WebRTC directe, et
 * échangent leurs paquets. Le relais ne sert qu'à la **mise en relation** : les
 * données ne passent jamais par lui.
 *
 * ## Pourquoi Trystero, et ce que j'ai vérifié
 *
 * La décision 1 a retenu l'option (a) — les réseaux publics existants — avec
 * repli obligatoire sur (c), le mode sans relais, construit d'emblée. J'avais
 * assorti cette recommandation d'une réserve : la dernière publication de
 * Trystero que j'avais trouvée datait d'environ un an, et une dépendance mal
 * entretenue tombe un jour sans préavis.
 *
 * **Cette réserve n'est plus vraie.** La version installée ici est la 0.26.0,
 * publiée le 4 octobre 2026, soit une semaine avant que j'écrive ces lignes. Le
 * paquet a été scindé en modules par stratégie ; `trystero` lui-même expose
 * désormais la stratégie Nostr, et les autres sont des paquets séparés —
 * importer `trystero/mqtt` lève une erreur qui le dit. C'est un projet vivant,
 * pas un projet abandonné. Le repli A2 reste construit : non par méfiance
 * envers cette bibliothèque, mais parce qu'un relais public, vivant ou non,
 * peut être inaccessible depuis un réseau donné.
 *
 * ## Ce que le relais voit
 *
 * Le nom du salon, et des adresses IP. Pas les données — elles passent par la
 * liaison directe. Pas la signalisation en clair — elle est chiffrée par une clé
 * dérivée du secret du QR, que le relais n'a pas. Et rien n'y est stocké : un
 * relais Nostr relaie, il n'archive pas de salon.
 *
 * ## Pourquoi ce module ne fait pas le travail de fusion
 *
 * Il rend un canal, et s'arrête là. C'est « service.ts » qui fusionne, et c'est
 * ce découpage qui permet au mode A1, au mode A2 et au transfert de fichier de
 * partager exactement le même chemin de fusion — donc le même refus, les mêmes
 * conflits, le même journal d'annulation.
 */
import { emettre, receveur, type Progression } from './morceaux';
import type { Canal } from './liaison';
import type { Octets } from '../noyau/octets';

/** Le nom de l'application dans le relais : il namespacie les salons. */
export const APPLICATION = 'cyclades';

/** L'action qui porte les paquets. */
const ACTION = 'paquet';

export interface OptionsSalon {
  salon: string;
  secret: string;
  /** Injectable pour les essais : rien d'autre ici ne touche au réseau. */
  rejoindreSalon?: TypeRejoindre;
  /** Plafond de taille d'un paquet reçu. */
  plafond?: number;
}

type Envoi = (
  donnees: Uint8Array,
  options?: { onProgress?: (part: number, contexte: { peerId: string }) => void },
) => Promise<void>;

interface Chambre {
  makeAction: (
    nom: string,
    config?: {
      onMessage?: (donnees: unknown, contexte: { peerId: string }) => void;
      onReceiveProgress?: (part: number, contexte: { peerId: string }) => void;
    },
  ) => { send: Envoi };
  leave: () => Promise<void> | void;
  onPeerJoin: ((pair: string) => void) | null;
  onPeerLeave: ((pair: string) => void) | null;
}

export type TypeRejoindre = (
  config: { appId: string; password?: string },
  salon: string,
) => Chambre;

async function rejoindreParDefaut(): Promise<TypeRejoindre> {
  const module = await import('trystero');
  return (module as unknown as { joinRoom: TypeRejoindre }).joinRoom;
}

export interface Salon {
  /** Le canal partagé : il porte les mêmes paquets que le mode A2. */
  canal: Canal;
  /** Appelé quand un appareil rejoint le salon. */
  surPair: (ecouteur: (pair: string) => void) => void;
  surDepart: (ecouteur: (pair: string) => void) => void;
  /** Les pairs présents, pour savoir si l'on peut envoyer. */
  pairs: () => string[];
  quitter: () => Promise<void>;
}

/**
 * Rejoint un salon et rend un canal.
 *
 * Le canal est rendu **tout de suite**, avant qu'aucun pair ne soit là : c'est
 * ce qui permet à l'écran de s'afficher dans son état d'attente plutôt que de
 * rester vide. Envoyer sans pair ne lève pas — Trystero n'a simplement personne
 * à qui envoyer —, et c'est à l'écran de ne proposer le bouton qu'une fois le
 * pair arrivé.
 */
export async function rejoindre(options: OptionsSalon): Promise<Salon> {
  const joindre = options.rejoindreSalon ?? (await rejoindreParDefaut());
  const pairs = new Set<string>();
  const surPairs: ((pair: string) => void)[] = [];
  const surDeparts: ((pair: string) => void)[] = [];
  const surPaquets: ((paquet: Uint8Array<ArrayBuffer>) => void)[] = [];
  const surProgressions: ((p: Progression) => void)[] = [];
  const surFermetures: (() => void)[] = [];
  const r = receveur(options.plafond);

  const chambre = joindre(
    { appId: APPLICATION, password: options.secret },
    options.salon,
  );

  const action = chambre.makeAction(ACTION, {
    onMessage: (donnees) => {
      /*
         Trystero rend ce qu'on lui a donné : un `Uint8Array` revient en
         `ArrayBuffer` selon les versions. On normalise ici, une fois, plutôt
         que dans le découpage — qui n'a pas à connaître le transport.
      */
      const octets =
        donnees instanceof Uint8Array
          ? donnees
          : donnees instanceof ArrayBuffer
            ? new Uint8Array(donnees)
            : null;
      if (!octets) return;
      const complet = r.recevoir(octets);
      surProgressions.forEach((e) => e(r.progression()));
      if (complet) surPaquets.forEach((e) => e(complet));
    },
  });

  chambre.onPeerJoin = (pair) => {
    pairs.add(pair);
    surPairs.forEach((e) => e(pair));
  };
  chambre.onPeerLeave = (pair) => {
    pairs.delete(pair);
    surDeparts.forEach((e) => e(pair));
    if (!pairs.size) surFermetures.forEach((e) => e());
  };

  const canal: Canal = {
    envoyer: (paquet: Octets, surProgression?: (p: Progression) => void) =>
      emettre((octets) => action.send(octets), paquet, { surProgression }),
    surPaquet: (e) => void surPaquets.push(e),
    surProgression: (e) => void surProgressions.push(e),
    surFermeture: (e) => void surFermetures.push(e),
    fermer: () => void chambre.leave(),
    get ouvert() {
      return pairs.size > 0;
    },
  };

  return {
    canal,
    surPair: (e) => void surPairs.push(e),
    surDepart: (e) => void surDeparts.push(e),
    pairs: () => [...pairs],
    quitter: async () => void (await chambre.leave()),
  };
}
