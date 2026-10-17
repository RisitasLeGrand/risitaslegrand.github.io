/**
 * Le verrouillage automatique du coffre.
 *
 * ## Le défaut qu'il corrige
 *
 * Rien ne refermait le coffre. Une fois ouvert, il le restait tant que
 * l'onglet vivait : on ouvrait son journal psychique le matin, on laissait
 * l'ordinateur sur le bureau, et n'importe qui passant devant l'écran lisait
 * tout sans rien taper. Le chiffrement au repos ne protège que ce qui est au
 * repos ; un coffre qui ne se referme jamais n'est au repos qu'une fois par
 * jour.
 *
 * ## Ce qui compte, et qu'un simple minuteur rate
 *
 * Le cas dangereux n'est pas « l'onglet est resté ouvert dix minutes sans
 * clic ». C'est « l'ordinateur a été fermé et rouvert trois heures plus
 * tard ». Or une machine en veille **n'exécute pas les minuteurs** : un
 * `setTimeout` de quinze minutes posé avant la mise en veille se déclenche
 * quinze minutes de temps *éveillé* plus tard, c'est-à-dire bien après le
 * retour.
 *
 * Ce module ne compte donc pas le temps qui passe : il **compare deux
 * horodatages**, celui de la dernière activité et celui de maintenant. Un
 * réveil après trois heures de veille trouve un écart de trois heures, et
 * verrouille avant d'avoir rien affiché.
 *
 * ## Le recul d'horloge
 *
 * Un changement d'heure, une synchronisation réseau, et `Date.now()` peut
 * reculer. L'écart devient négatif. On ne verrouille pas dans ce cas — mais
 * on **replace** la dernière activité à maintenant, sans quoi l'écart
 * resterait négatif jusqu'à ce que l'horloge ait rattrapé, et le verrou
 * serait suspendu pendant tout ce temps.
 *
 * ## Zéro veut dire jamais
 *
 * Un délai nul ou négatif désactive le verrou. C'est un choix de la personne,
 * et le module l'applique sans discuter : un garde-fou qu'on ne peut pas
 * débrayer se contourne autrement, et plus mal.
 */

/** Le délai par défaut : quinze minutes. */
export const DELAI_PAR_DEFAUT_MS = 15 * 60 * 1000;

/** La clé du réglage, dans le magasin « etat ». */
export const CLEF_DELAI = 'coffre.verrou-automatique.delai';

export interface EtatDuVerrou {
  /** Quand la dernière activité a eu lieu, en millisecondes epoch. */
  derniereActivite: number;
  /** Le délai d'inactivité toléré. 0 ou moins : jamais de verrouillage. */
  delaiMs: number;
}

export type Decision =
  | { verrouiller: true; raison: 'inactivite'; ecoule: number }
  | { verrouiller: false; raison: 'desactive' | 'dans-les-temps' | 'horloge-reculee'; ecoule: number };

/**
 * Faut-il verrouiller, à cet instant ?
 *
 * Pure, et c'est volontaire : toute la difficulté est dans les trois cas
 * limites — la veille, le recul d'horloge, le délai nul — et aucun des trois
 * ne s'éprouve avec une vraie horloge sans attendre vraiment.
 */
export function decider(etat: EtatDuVerrou, maintenant: number): Decision {
  const ecoule = maintenant - etat.derniereActivite;
  if (etat.delaiMs <= 0) return { verrouiller: false, raison: 'desactive', ecoule };
  if (ecoule < 0) return { verrouiller: false, raison: 'horloge-reculee', ecoule };
  if (ecoule >= etat.delaiMs) return { verrouiller: true, raison: 'inactivite', ecoule };
  return { verrouiller: false, raison: 'dans-les-temps', ecoule };
}

/**
 * Ce dont le moteur a besoin du monde extérieur.
 *
 * Trois fonctions, et pas davantage : c'est ce qui permet de faire tourner
 * des journées entières en quelques millisecondes dans un essai, avec une
 * horloge que l'on avance à la main.
 */
export interface MondeDuVerrou {
  maintenant(): number;
  coffreOuvert(): boolean;
  fermer(): void;
}

/**
 * Le moteur, sans minuteur ni écouteur : on l'appelle, il décide.
 *
 * Les minuteurs et les écouteurs d'activité vivent dans la page, qui sait ce
 * qu'est un clic. Ici, deux gestes seulement : « il s'est passé quelque
 * chose » et « regarde l'heure ». C'est ce qui rend la logique vérifiable
 * sans navigateur.
 */
export class VerrouAutomatique {
  private derniereActivite: number;

  constructor(
    private readonly monde: MondeDuVerrou,
    private delaiMs: number = DELAI_PAR_DEFAUT_MS,
  ) {
    this.derniereActivite = monde.maintenant();
  }

  /** Le délai courant, pour l'afficher. */
  get delai(): number {
    return this.delaiMs;
  }

  /**
   * Change le délai. Le compte repart de maintenant.
   *
   * Sans cette remise à zéro, allonger le délai depuis un écran de réglages
   * pourrait verrouiller **à l'instant même** où on vient de le régler, si
   * l'inactivité précédente dépassait déjà la nouvelle valeur.
   */
  reglerLeDelai(ms: number): void {
    this.delaiMs = ms;
    this.derniereActivite = this.monde.maintenant();
  }

  /** Quelque chose s'est passé : un clic, une touche, une saisie. */
  activite(): void {
    this.derniereActivite = this.monde.maintenant();
  }

  /**
   * Regarde l'heure et verrouille s'il le faut. Rend la décision prise.
   *
   * À appeler sur un minuteur, mais **aussi** au retour de l'onglet et au
   * réveil de la machine : c'est là que l'écart est grand, et c'est là que le
   * minuteur n'a pas tourné.
   */
  verifier(): Decision {
    const decision = decider(
      { derniereActivite: this.derniereActivite, delaiMs: this.delaiMs },
      this.monde.maintenant(),
    );
    if (decision.raison === 'horloge-reculee') {
      // On replace le repère : sinon l'écart reste négatif jusqu'à ce que
      // l'horloge ait rattrapé, et le verrou dort pendant tout ce temps.
      this.derniereActivite = this.monde.maintenant();
      return decision;
    }
    if (decision.verrouiller && this.monde.coffreOuvert()) {
      this.monde.fermer();
      this.derniereActivite = this.monde.maintenant();
    }
    return decision;
  }
}
