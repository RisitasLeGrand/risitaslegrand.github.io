/**
 * L'horloge logique hybride, qui ordonne les opérations de deux appareils.
 *
 * ## Pourquoi pas un horodatage
 *
 * Deux appareils dont les horloges diffèrent de trois minutes — ce qui est
 * ordinaire — produiraient un ordre de fusion faux : une révision faite sur le
 * téléphone à 9 h 02 paraîtrait antérieure à une révision faite sur
 * l'ordinateur à 9 h 00 alors qu'elle l'a suivie. Et un appareil dont l'horloge
 * **recule** produirait des opérations antérieures à des opérations qu'il a
 * lui-même déjà vues, ce qui rend le journal incohérent avec lui-même.
 *
 * ## Pourquoi pas un compteur
 *
 * Un compteur de Lamport ordonne correctement mais perd la date : on ne pourrait
 * plus dire à l'écran « reçu du téléphone, hier à 7 h 40 », ni appliquer une
 * rétention par période, ni répondre à « qu'ai-je saisi la semaine dernière ».
 *
 * ## L'hybride
 *
 * Une horloge hybride porte les deux : une partie murale en millisecondes, et un
 * compteur qui ne sert qu'à départager ce que la partie murale ne distingue pas.
 * La règle, à chaque événement, est de prendre le maximum entre l'horloge
 * locale, la dernière horloge émise et celle reçue ; le compteur s'incrémente
 * quand ce maximum n'a pas progressé, et retombe à zéro quand il a progressé.
 *
 * On obtient alors la propriété qui compte : **si un appareil a observé une
 * opération avant d'en émettre une autre, l'ordre des deux est conservé partout**,
 * même si son horloge murale est fausse. La date affichée, elle, peut être
 * légèrement en avance sur l'horloge locale — c'est le prix, et il est juste :
 * mieux vaut une date à une seconde près qu'un ordre faux.
 *
 * ## La dérive bornée
 *
 * Un appareil dont l'horloge est en avance d'un an contaminerait toutes les
 * horloges qu'il touche, et pour toujours. Une horloge reçue trop en avance est
 * donc **refusée** plutôt qu'absorbée, et le refus est nommé : c'est un cas que
 * l'écran de synchronisation doit pouvoir expliquer.
 */

/** Une horloge hybride : partie murale en ms, puis compteur de départage. */
export interface Hlc {
  ms: number;
  compteur: number;
}

/** Au-delà, une horloge reçue est tenue pour fautive et non pour en avance. */
export const DERIVE_MAX_MS = 60 * 60 * 1000;

/** Le compteur tient sur quatre signes en base 36, soit 1 679 616 valeurs. */
const COMPTEUR_MAX = 36 ** 4 - 1;

export const HLC_ZERO: Hlc = { ms: 0, compteur: 0 };

export function comparerHlc(a: Hlc, b: Hlc): number {
  return a.ms - b.ms || a.compteur - b.compteur;
}

/**
 * La forme stockée : une chaîne qui se trie comme l'horloge se compare.
 *
 * C'est ce qui permet d'indexer le journal sur l'horloge et d'interroger un
 * intervalle sans désérialiser. Quinze signes pour la partie murale — de quoi
 * tenir jusqu'à l'an 275 760 — puis quatre pour le compteur, en base 36
 * majuscule pour que l'ordre des signes soit l'ordre des valeurs.
 */
export function encoderHlc(h: Hlc): string {
  const ms = String(h.ms).padStart(15, '0');
  const compteur = h.compteur.toString(36).toUpperCase().padStart(4, '0');
  return `${ms}-${compteur}`;
}

export function decoderHlc(code: string): Hlc {
  const separation = code.indexOf('-');
  if (separation !== 15) throw new TypeError(`Horloge illisible : ${code}`);
  const ms = Number(code.slice(0, 15));
  const compteur = parseInt(code.slice(16), 36);
  if (!Number.isInteger(ms) || !Number.isInteger(compteur)) {
    throw new TypeError(`Horloge illisible : ${code}`);
  }
  return { ms, compteur };
}

export type MotifDeRefusHlc = 'derive-excessive' | 'compteur-sature';

export class HlcRefusee extends Error {
  constructor(
    readonly motif: MotifDeRefusHlc,
    message: string,
  ) {
    super(message);
    this.name = 'HlcRefusee';
  }
}

/**
 * L'horloge d'un appareil. Elle n'écrit rien : la persistance est au-dessus,
 * de sorte que ce module reste vérifiable sans navigateur.
 */
export class Horloge {
  private etat: Hlc;

  constructor(
    private readonly murale: () => number = Date.now,
    depart: Hlc = HLC_ZERO,
  ) {
    this.etat = { ...depart };
  }

  /** L'état courant, à persister après chaque émission ou réception. */
  get valeur(): Hlc {
    return { ...this.etat };
  }

  /** Au moment d'émettre une opération. */
  emettre(): Hlc {
    const maintenant = this.murale();
    if (maintenant > this.etat.ms) this.etat = { ms: maintenant, compteur: 0 };
    else this.etat = { ms: this.etat.ms, compteur: this.suivant(this.etat.compteur) };
    return this.valeur;
  }

  /**
   * Au moment de recevoir une opération d'un autre appareil.
   *
   * Rend l'horloge locale mise à jour. Refuse une horloge trop en avance :
   * l'absorber propagerait la faute de l'autre appareil à tout le journal, et
   * aucune opération postérieure ne pourrait plus la corriger.
   */
  recevoir(recue: Hlc): Hlc {
    const maintenant = this.murale();
    if (recue.ms - maintenant > DERIVE_MAX_MS) {
      throw new HlcRefusee(
        'derive-excessive',
        `L’horloge reçue est en avance de ${Math.round((recue.ms - maintenant) / 60000)} min ` +
          `sur celle de cet appareil. L’un des deux est mal réglé : la fusion est suspendue ` +
          `plutôt que d’enregistrer un ordre faux.`,
      );
    }
    const plafond = Math.max(maintenant, this.etat.ms, recue.ms);
    if (plafond === this.etat.ms && plafond === recue.ms) {
      this.etat = { ms: plafond, compteur: this.suivant(Math.max(this.etat.compteur, recue.compteur)) };
    } else if (plafond === this.etat.ms) {
      this.etat = { ms: plafond, compteur: this.suivant(this.etat.compteur) };
    } else if (plafond === recue.ms) {
      this.etat = { ms: plafond, compteur: this.suivant(recue.compteur) };
    } else {
      this.etat = { ms: plafond, compteur: 0 };
    }
    return this.valeur;
  }

  private suivant(compteur: number): number {
    if (compteur >= COMPTEUR_MAX) {
      // Un million d'opérations dans la même milliseconde : la saturation dit
      // qu'autre chose est cassé. On refuse plutôt que de repartir à zéro, ce
      // qui ferait reculer l'horloge.
      throw new HlcRefusee(
        'compteur-sature',
        'Le compteur de l’horloge logique est saturé pour cette milliseconde.',
      );
    }
    return compteur + 1;
  }
}
