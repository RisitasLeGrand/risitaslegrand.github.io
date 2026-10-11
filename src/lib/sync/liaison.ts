/**
 * La liaison directe entre deux appareils, sans aucun tiers.
 *
 * C'est le mode A2 de la décision 1 : deux QR échangés, aucun relais, aucun
 * compte, rien qui puisse tomber en panne chez quelqu'un d'autre. Il est
 * construit **d'emblée** et non promis pour plus tard, précisément parce que
 * c'est le repli de A1 : le jour où le relais public disparaît, la
 * synchronisation doit marcher le même jour, avec trois gestes de plus.
 *
 * ## Pourquoi la négociation n'est pas « goutte à goutte »
 *
 * Normalement, un navigateur envoie sa description de session puis ses candidats
 * de connexion au fur et à mesure qu'il les découvre. Ici il n'y a pas de canal
 * pour les envoyer : le QR est une photographie, pas une conversation. On attend
 * donc que la collecte soit **terminée** avant d'afficher le QR, pour que la
 * description le contienne tout entier.
 *
 * L'attente est bornée. Certains réseaux ne terminent jamais leur collecte — un
 * candidat relais qu'on n'a pas demandé, une interface qui ne répond pas — et
 * attendre indéfiniment afficherait un écran vide sans rien dire. Au bout du
 * délai, on prend ce qu'on a : une description avec les candidats locaux
 * fonctionne sur le même réseau, qui est le cas d'usage.
 *
 * ## Ce que la liaison ne protège pas, et ce qui protège
 *
 * Quiconque photographie le QR affiché peut répondre à la place du téléphone. Il
 * obtiendrait alors un canal vers cet appareil — et **rien d'autre** : le paquet
 * qui y passe est chiffré avec le mot de passe du site, et celui qu'il
 * enverrait serait refusé sans ce mot de passe. La frontière de sécurité est le
 * paquet, pas le canal. C'est ce qui permet d'afficher un QR à l'écran sans
 * cérémonie.
 */
import { emettre, receveur, TAILLE_MORCEAU, type Progression } from './morceaux';
import type { Octets } from '../noyau/octets';

/**
 * Les serveurs STUN.
 *
 * Ils ne voient aucune donnée : ils disent seulement à l'appareil sous quelle
 * adresse il est vu de l'extérieur, ce qui est nécessaire dès que les deux
 * appareils ne sont pas sur le même réseau. La décision 0 les accepte, avec
 * l'argument qui compte : le navigateur révèle déjà son adresse à GitHub Pages
 * à chaque chargement du site, et refuser STUN protégerait d'une fuite qui a
 * déjà lieu par ailleurs.
 *
 * Deux serveurs plutôt qu'un, de deux maisons différentes : si l'un ne répond
 * pas, la collecte ne s'arrête pas pour autant.
 */
export const SERVEURS_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** Deux secondes et demie : au-delà, on affiche le QR avec ce qu'on a. */
export const DELAI_COLLECTE_MS = 2_500;

export interface Canal {
  /** Envoie un paquet entier, découpé, en annonçant la progression. */
  envoyer: (paquet: Octets, surProgression?: (p: Progression) => void) => Promise<void>;
  /** Appelé à chaque paquet complet reçu. */
  surPaquet: (ecouteur: (paquet: Uint8Array<ArrayBuffer>) => void) => void;
  surProgression: (ecouteur: (p: Progression) => void) => void;
  surFermeture: (ecouteur: () => void) => void;
  fermer: () => void;
  readonly ouvert: boolean;
}

export interface OptionsLiaison {
  /** Injectable pour les essais : rien d'autre dans ce module ne touche au monde. */
  fabriquerConnexion?: () => RTCPeerConnection;
  delaiCollecteMs?: number;
  /** Plafond de taille d'un paquet reçu. */
  plafond?: number;
}

const connexionParDefaut = () => new RTCPeerConnection({ iceServers: SERVEURS_ICE });

/**
 * Attend la fin de la collecte des candidats, sans jamais bloquer pour de bon.
 */
function attendreCollecte(pc: RTCPeerConnection, delai: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resoudre) => {
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      pc.removeEventListener('icegatheringstatechange', surEtat);
      clearTimeout(minuteur);
      resoudre();
    };
    const surEtat = () => pc.iceGatheringState === 'complete' && terminer();
    const minuteur = setTimeout(terminer, delai);
    pc.addEventListener('icegatheringstatechange', surEtat);
  });
}

function habiller(dc: RTCDataChannel, plafond?: number): Canal {
  dc.binaryType = 'arraybuffer';
  const r = receveur(plafond);
  const surPaquets: ((p: Uint8Array<ArrayBuffer>) => void)[] = [];
  const surProgressions: ((p: Progression) => void)[] = [];
  const surFermetures: (() => void)[] = [];

  dc.addEventListener('message', (evenement) => {
    const brut = evenement.data;
    const octets =
      brut instanceof ArrayBuffer ? new Uint8Array(brut) : new Uint8Array(brut as ArrayBufferLike);
    const complet = r.recevoir(octets);
    surProgressions.forEach((e) => e(r.progression()));
    if (complet) surPaquets.forEach((e) => e(complet));
  });
  dc.addEventListener('close', () => surFermetures.forEach((e) => e()));

  /*
     La vidange : on laisse le tampon d'envoi redescendre avant d'y remettre.
     « bufferedamountlow » est l'événement prévu pour cela ; le minuteur est là
     parce qu'un canal qui se ferme pendant l'envoi ne l'émettra jamais, et
     l'envoi resterait suspendu pour toujours.
  */
  const SEUIL = 4 * TAILLE_MORCEAU;
  dc.bufferedAmountLowThreshold = SEUIL;
  const attendreVidange = () =>
    new Promise<void>((resoudre) => {
      if (dc.bufferedAmount <= SEUIL || dc.readyState !== 'open') return resoudre();
      const fini = () => {
        dc.removeEventListener('bufferedamountlow', fini);
        clearTimeout(minuteur);
        resoudre();
      };
      const minuteur = setTimeout(fini, 2_000);
      dc.addEventListener('bufferedamountlow', fini);
    });

  return {
    envoyer: (paquet, surProgression) =>
      emettre((octets) => dc.send(octets as Uint8Array<ArrayBuffer>), paquet, {
        surProgression,
        attendreVidange,
      }),
    surPaquet: (e) => void surPaquets.push(e),
    surProgression: (e) => void surProgressions.push(e),
    surFermeture: (e) => void surFermetures.push(e),
    fermer: () => {
      dc.close();
      // Fermer le canal sans fermer la connexion laisserait un objet qui tient
      // des sockets ouvertes jusqu'au rechargement de la page.
      (dc as unknown as { __pc?: RTCPeerConnection }).__pc?.close();
    },
    get ouvert() {
      return dc.readyState === 'open';
    },
  };
}

const ouvert = (dc: RTCDataChannel, pc: RTCPeerConnection, plafond?: number): Promise<Canal> =>
  new Promise((resoudre, rejeter) => {
    (dc as unknown as { __pc?: RTCPeerConnection }).__pc = pc;
    if (dc.readyState === 'open') return resoudre(habiller(dc, plafond));
    dc.addEventListener('open', () => resoudre(habiller(dc, plafond)));
    dc.addEventListener('error', () => rejeter(new Error('le canal n’a pas pu s’ouvrir')));
  });

export interface Proposition {
  /** La description à mettre dans le premier QR. */
  offre: string;
  /** À appeler avec la réponse lue dans le second QR. */
  accepter: (reponse: string) => Promise<void>;
  /** Le canal, une fois la liaison établie. */
  canal: Promise<Canal>;
  abandonner: () => void;
}

/** Côté qui affiche le premier QR. */
export async function proposer(options: OptionsLiaison = {}): Promise<Proposition> {
  const pc = (options.fabriquerConnexion ?? connexionParDefaut)();
  const dc = pc.createDataChannel('cyclades', { ordered: true });
  const canal = ouvert(dc, pc, options.plafond);
  await pc.setLocalDescription(await pc.createOffer());
  await attendreCollecte(pc, options.delaiCollecteMs ?? DELAI_COLLECTE_MS);
  return {
    offre: pc.localDescription?.sdp ?? '',
    accepter: async (reponse) => {
      await pc.setRemoteDescription({ type: 'answer', sdp: reponse });
    },
    canal,
    abandonner: () => pc.close(),
  };
}

export interface Reponse {
  /** La description à mettre dans le second QR. */
  reponse: string;
  canal: Promise<Canal>;
  abandonner: () => void;
}

/** Côté qui a scanné le premier QR. */
export async function repondre(offre: string, options: OptionsLiaison = {}): Promise<Reponse> {
  const pc = (options.fabriquerConnexion ?? connexionParDefaut)();
  const canal = new Promise<Canal>((resoudre, rejeter) => {
    pc.addEventListener('datachannel', (evenement) => {
      ouvert(evenement.channel, pc, options.plafond).then(resoudre, rejeter);
    });
  });
  await pc.setRemoteDescription({ type: 'offer', sdp: offre });
  await pc.setLocalDescription(await pc.createAnswer());
  await attendreCollecte(pc, options.delaiCollecteMs ?? DELAI_COLLECTE_MS);
  return { reponse: pc.localDescription?.sdp ?? '', canal, abandonner: () => pc.close() };
}
