/**
 * Lecture des sons du Quad N-Back.
 *
 * Remplace la dépendance « howler » utilisée par quad-box : le besoin réel se
 * limite au préchargement, au repli opus → mp3 et à une lecture non bloquante.
 * L'API Audio native suffit, ce qui évite une dépendance de plus dans un projet
 * destiné à être maintenu par une personne non-développeuse.
 */
import { AUDIO_POOL } from './constantes.js';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const dossier = `${base}/quad-n-back/audio`;

/** Choisit le format servi : opus si le navigateur le gère, sinon mp3. */
function extension() {
  const test = document.createElement('audio');
  return test.canPlayType('audio/ogg; codecs=opus') ? 'opus' : 'mp3';
}

class LecteurAudio {
  constructor() {
    this.cache = new Map();
    this.ext = null;
    this.actif = true;
    /** Vrai dès qu'une lecture a échoué dans la session en cours. */
    this.aEchoue = false;
    /** Posé par l'écran : appelé une fois quand la lecture échoue. */
    this.surEchec = null;
  }

  url(lettre) {
    this.ext ??= extension();
    return `${dossier}/${lettre}.${this.ext}`;
  }

  /** Précharge tous les sons : évite tout blanc au premier stimulus. */
  precharger() {
    for (const lettre of AUDIO_POOL) {
      if (this.cache.has(lettre)) continue;
      const element = new Audio(this.url(lettre));
      element.preload = 'auto';
      this.cache.set(lettre, element);
    }
  }

  /**
   * Joue un son. N'attend pas la fin : la boucle de jeu doit rester à l'heure.
   *
   * ## L'échec n'interrompt plus la partie, mais il ne se tait plus
   *
   * Il était silencieux, et c'était le défaut Q6 : sur un téléphone en mode
   * silencieux, la dimension Son devenait inaudible SANS QUE RIEN NE LE DISE.
   * On jouait une partie à quatre dimensions dont une était impossible, et le
   * score en tenait compte — la faute paraissait venir de la personne.
   *
   * La partie continue (une exception ici arrêterait le jeu au premier
   * stimulus), mais `surEchec` est appelé une fois, et l'écran décide quoi en
   * faire. Une fois seulement : trente épreuves qui échouent ne sont pas
   * trente nouvelles pour qui regarde.
   */
  jouer(lettre) {
    if (!this.actif || !lettre) return;
    let element = this.cache.get(lettre);
    if (!element) {
      element = new Audio(this.url(lettre));
      this.cache.set(lettre, element);
    }
    try {
      element.currentTime = 0;
      const promesse = element.play();
      if (promesse) promesse.catch(() => this.#direLEchec());
    } catch {
      this.#direLEchec();
    }
  }

  /** L'échec de lecture, dit une seule fois par session. */
  #direLEchec() {
    if (this.aEchoue) return;
    this.aEchoue = true;
    try {
      this.surEchec?.();
    } catch {
      /* l'écran a le droit de ne rien savoir faire de cette nouvelle */
    }
  }

  /** Remis à zéro au lancement d'une partie, pour que l'écran puisse redire. */
  oublierLEchec() {
    this.aEchoue = false;
  }

  /**
   * Débloque la lecture audio.
   * Les navigateurs mobiles exigent qu'un premier son parte d'une interaction
   * utilisateur ; on le fait au clic sur « Commencer », en volume nul.
   */
  async debloquer() {
    const lettre = AUDIO_POOL[0];
    const element = this.cache.get(lettre) ?? new Audio(this.url(lettre));
    this.cache.set(lettre, element);
    const volume = element.volume;
    try {
      element.volume = 0;
      await element.play();
      element.pause();
      element.currentTime = 0;
    } catch {
      /* refusé : les sons suivants échoueront silencieusement */
    } finally {
      element.volume = volume;
    }
  }
}

export const lecteurAudio = new LecteurAudio();
