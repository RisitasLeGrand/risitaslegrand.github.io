/**
 * Découper un paquet, le réassembler, dire où l'on en est.
 *
 * Un canal de données WebRTC ne transporte pas un paquet de huit mégaoctets en
 * un message : au-delà de quelques dizaines de kilooctets, selon le navigateur,
 * l'envoi échoue ou la connexion tombe. Il faut donc découper — et, puisqu'on
 * découpe, donner la progression, parce qu'une barre qui avance est la
 * différence entre « ça marche » et « ça a planté ».
 *
 * ## Ce que ce module suppose du canal, et ce qu'il ne suppose pas
 *
 * Il suppose **l'ordre et la fiabilité** : c'est ce que donne un canal SCTP
 * ouvert par défaut, et c'est la seule hypothèse. Il ne suppose ni la taille
 * maximale d'un message — elle est passée en paramètre —, ni l'absence de
 * doublon : un morceau reçu deux fois est reconnu et ignoré, parce que c'est
 * gratuit à écrire et impossible à diagnostiquer après coup.
 *
 * Il ne vérifie **pas** l'intégrité : le paquet porte déjà sa somme de contrôle,
 * et `paquet.ouvrir` refuse un fichier abîmé. Une seconde somme ici ne dirait
 * rien de plus, et dirait peut-être le contraire — deux vérités sur la même
 * chose finissent toujours par se contredire.
 */
import { concatener, type Octets } from '../noyau/octets';

/**
 * Seize kilooctets.
 *
 * C'est la taille qu'aucun navigateur ne refuse. Les implémentations modernes
 * acceptent 256 Kio sur un canal, mais la valeur est négociée dans la
 * description de session (`a=max-message-size`), et se tromper ne se voit qu'à
 * l'exécution, sur l'appareil qu'on n'a pas sous la main.
 */
export const TAILLE_MORCEAU = 16 * 1024;

const ENTETE = 1;
const MORCEAU = 2;

export interface Progression {
  /** Octets transmis jusqu'ici. */
  faits: number;
  total: number;
}

/** Ce que ce module demande au canal : envoyer des octets, et rien d'autre. */
export type Emetteur = (octets: Uint8Array<ArrayBuffer>) => void | Promise<void>;

const vue = (octets: Uint8Array<ArrayBuffer>) =>
  new DataView(octets.buffer, octets.byteOffset, octets.byteLength);

/**
 * Découpe et envoie, en annonçant la progression.
 *
 * `attendreVidange` est l'ingrédient qu'on oublie : sans lui, on remplit le
 * tampon d'envoi plus vite que le réseau ne le vide, et le canal se ferme sur
 * un paquet un peu gros. L'appelant sait comment attendre — c'est propre à son
 * canal —, ce module sait seulement qu'il faut le faire.
 */
export async function emettre(
  emetteur: Emetteur,
  paquet: Octets,
  options: {
    taille?: number;
    surProgression?: (p: Progression) => void;
    attendreVidange?: () => Promise<void>;
  } = {},
): Promise<void> {
  const taille = options.taille ?? TAILLE_MORCEAU;
  const entete = new Uint8Array(new ArrayBuffer(5));
  entete[0] = ENTETE;
  vue(entete).setUint32(1, paquet.length);
  await emetteur(entete);

  for (let debut = 0, index = 0; debut < paquet.length; debut += taille, index += 1) {
    const tranche = paquet.subarray(debut, Math.min(debut + taille, paquet.length));
    const message = new Uint8Array(new ArrayBuffer(5 + tranche.length));
    message[0] = MORCEAU;
    vue(message).setUint32(1, index);
    message.set(tranche, 5);
    if (options.attendreVidange) await options.attendreVidange();
    await emetteur(message);
    options.surProgression?.({ faits: Math.min(debut + taille, paquet.length), total: paquet.length });
  }
  // Un paquet vide n'existe pas — « fabriquer » refuse de n'avoir rien à dire —
  // mais l'en-tête seul resterait cohérent, et le récepteur le conclurait.
  if (paquet.length === 0) options.surProgression?.({ faits: 0, total: 0 });
}

export class ReceptionRefusee extends Error {
  constructor(readonly motif: 'sans-entete' | 'trop-gros' | 'message-inconnu' | 'debordement') {
    super(`réception refusée : ${motif}`);
    this.name = 'ReceptionRefusee';
  }
}

export interface Receveur {
  /** À appeler pour chaque message reçu. Rend le paquet complet, ou `null`. */
  recevoir: (octets: Octets) => Uint8Array<ArrayBuffer> | null;
  /** Où l'on en est, pour l'affichage. */
  progression: () => Progression;
}

/**
 * Réassemble les morceaux.
 *
 * `plafond` n'est pas une précaution de principe : l'en-tête annonce une taille,
 * et sans plafond un en-tête malveillant ou abîmé ferait allouer quatre
 * gigaoctets avant même le premier morceau.
 */
export function receveur(plafond = 64 * 1024 * 1024): Receveur {
  let attendu = -1;
  let recu = 0;
  const morceaux: Uint8Array<ArrayBuffer>[] = [];
  const vus = new Set<number>();

  return {
    recevoir(octets) {
      if (octets.length < 1) throw new ReceptionRefusee('message-inconnu');
      const type = octets[0];
      const corps = octets.subarray(1);
      if (type === ENTETE) {
        if (corps.length < 4) throw new ReceptionRefusee('message-inconnu');
        const copie = new Uint8Array(corps);
        attendu = new DataView(copie.buffer).getUint32(0);
        if (attendu > plafond) throw new ReceptionRefusee('trop-gros');
        recu = 0;
        morceaux.length = 0;
        vus.clear();
        return attendu === 0 ? new Uint8Array(new ArrayBuffer(0)) : null;
      }
      if (type !== MORCEAU) throw new ReceptionRefusee('message-inconnu');
      if (corps.length < 4) throw new ReceptionRefusee('message-inconnu');
      const copie = new Uint8Array(corps);
      const index = new DataView(copie.buffer).getUint32(0);
      /*
         LE DOUBLON SE VÉRIFIE AVANT L’EN-TÊTE, ET L’ORDRE EST TOUT.

         Le dernier morceau d’un paquet remet `attendu` à -1 : un doublon de
         CE morceau-là arrivait donc sur « sans-entete » et levait, au lieu
         d’être ignoré comme les autres doublons. Le dédoublonnage ne servait
         qu’aux morceaux du milieu.

         Ce n’est pas un cas d’école : deux des quatre transports relisent la
         même trame sans qu’on le veuille — un QR qu’on scanne deux fois, un
         salon qui retransmet. La panne tombait pile sur la dernière trame,
         c’est-à-dire sur un paquet par ailleurs complet.

         Un morceau jamais vu alors qu’aucun en-tête n’est passé lève
         toujours : ce refus-là garde son sens.
      */
      if (vus.has(index)) return null;
      if (attendu < 0) throw new ReceptionRefusee('sans-entete');
      vus.add(index);
      const donnees = copie.subarray(4);
      recu += donnees.length;
      if (recu > attendu) throw new ReceptionRefusee('debordement');
      morceaux.push(donnees);
      if (recu < attendu) return null;
      const complet = concatener(morceaux);
      attendu = -1;
      return complet;
    },
    progression: () => ({ faits: recu, total: Math.max(attendu, 0) }),
  };
}
