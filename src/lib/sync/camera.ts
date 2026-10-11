/**
 * Lire un QR avec la caméra de l'appareil.
 *
 * ## Pourquoi un lecteur embarqué alors que l'appareil photo du téléphone suffit
 *
 * Pour le parcours privilégié — l'ordinateur affiche, le téléphone vise —
 * l'appareil photo du système suffit, et c'est le plus rapide : il reconnaît
 * l'URL et propose de l'ouvrir. Mais trois cas lui échappent, et ce sont des cas
 * réels :
 *
 *  - l'appareil photo de certains systèmes ne propose pas d'ouvrir un lien ;
 *  - dans le repli sans relais, c'est **l'ordinateur** qui doit lire le QR du
 *    téléphone, et un ordinateur n'a pas d'appareil photo qui ouvre des liens ;
 *  - un QR peut avoir besoin d'être lu sans quitter la page en cours.
 *
 * ## Les refus, nommés
 *
 * Une caméra refuse pour des raisons très différentes, et « ça ne marche pas »
 * ne permet pas d'agir. Chacune a donc son motif et sa phrase : permission
 * refusée, aucune caméra, contexte non sécurisé — ce dernier étant le piège de
 * l'ouverture d'un fichier local, où `getUserMedia` n'existe tout simplement
 * pas. Le site est servi en HTTPS, mais un essai local ne l'est pas forcément.
 */
import { decoder, type Lecture } from './qr';

export type MotifCamera = 'refusee' | 'absente' | 'non-securise' | 'indisponible';

export class CameraRefusee extends Error {
  constructor(readonly motif: MotifCamera) {
    super(
      {
        refusee: 'L’accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur.',
        absente: 'Aucune caméra n’a été trouvée sur cet appareil.',
        'non-securise':
          'La caméra n’est accessible qu’en HTTPS. Ouvrez le site publié plutôt qu’un fichier local.',
        indisponible: 'La caméra est occupée par une autre application.',
      }[motif],
    );
    this.name = 'CameraRefusee';
  }
}

export interface Lecteur {
  arreter: () => void;
  /** Vrai tant que la boucle tourne. */
  readonly actif: boolean;
}

export interface OptionsLecteur {
  /** Appelé à chaque lecture réussie. Rendre `true` arrête la boucle. */
  surLecture: (lecture: Lecture) => boolean | void;
  /** Appelé quand l'image ne contient pas de QR, pour l'état « je cherche ». */
  surRecherche?: () => void;
  /** Millisecondes entre deux analyses. */
  intervalleMs?: number;
}

function motifDe(erreur: unknown): MotifCamera {
  const nom = (erreur as { name?: string } | null)?.name ?? '';
  if (nom === 'NotAllowedError' || nom === 'SecurityError') return 'refusee';
  if (nom === 'NotFoundError' || nom === 'OverconstrainedError') return 'absente';
  if (nom === 'NotReadableError' || nom === 'AbortError') return 'indisponible';
  return 'indisponible';
}

/**
 * Ouvre la caméra arrière si elle existe, et analyse les images.
 *
 * `facingMode: 'environment'` est une **préférence** et non une contrainte :
 * exigée, elle fait échouer l'ouverture sur un ordinateur qui n'a qu'une caméra
 * frontale — c'est-à-dire précisément sur l'appareil qui a besoin de lire dans
 * le repli sans relais.
 */
export async function lireAvecCamera(
  video: HTMLVideoElement,
  options: OptionsLecteur,
): Promise<Lecteur> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraRefusee('non-securise');
  }

  let flux: MediaStream;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (erreur) {
    throw new CameraRefusee(motifDe(erreur));
  }

  video.srcObject = flux;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play().catch(() => {
    /* Certains navigateurs refusent la lecture automatique : l'image reste
       figée mais les trames sont là, et l'analyse fonctionne quand même. */
  });

  const toile = document.createElement('canvas');
  const pinceau = toile.getContext('2d', { willReadFrequently: true });
  let actif = true;
  let minuteur: number | null = null;

  const arreter = () => {
    if (!actif) return;
    actif = false;
    if (minuteur !== null) clearTimeout(minuteur);
    for (const piste of flux.getTracks()) piste.stop();
    // Sans cela, la petite lumière de la caméra reste allumée : l'utilisateur a
    // raison de s'en inquiéter, et c'est un bogue courant de ces lecteurs.
    video.srcObject = null;
  };

  const analyser = async () => {
    if (!actif) return;
    const largeur = video.videoWidth;
    const hauteur = video.videoHeight;
    if (!pinceau || !largeur || !hauteur) {
      minuteur = window.setTimeout(analyser, options.intervalleMs ?? 250);
      return;
    }
    toile.width = largeur;
    toile.height = hauteur;
    pinceau.drawImage(video, 0, 0, largeur, hauteur);
    const image = pinceau.getImageData(0, 0, largeur, hauteur);
    let lecture: Lecture | null = null;
    try {
      lecture = await decoder(image.data, largeur, hauteur);
    } catch {
      /* Un décodeur qui échoue sur une image ne doit pas arrêter la boucle. */
    }
    if (!actif) return;
    if (lecture) {
      if (options.surLecture(lecture) === true) return arreter();
    } else {
      options.surRecherche?.();
    }
    minuteur = window.setTimeout(analyser, options.intervalleMs ?? 250);
  };

  void analyser();

  return {
    arreter,
    get actif() {
      return actif;
    },
  };
}
