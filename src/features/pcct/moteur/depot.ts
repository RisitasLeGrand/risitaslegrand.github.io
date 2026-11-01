/**
 * Le dépôt : ce que la séance écrit, sans savoir où.
 *
 * ## Pourquoi une interface, et pas la base tout de suite
 *
 * Le moteur et l'écran de PCCT se livrent avant que les magasins, la politique
 * de schéma et les groupes de sauvegarde ne soient sur la branche principale.
 * Les attendre bloquerait deux lots sur une dépendance qui n'a rien à voir avec
 * le calcul ni avec le clavier.
 *
 * La séance écrit donc contre CE contrat, et le lot du stockage en fournira une
 * mise en œuvre sur IndexedDB sans toucher au moteur. L'implantation en mémoire
 * ci-dessous n'est pas un bouchon d'essai : c'est aussi ce qui fait marcher la
 * découverte d'une minute, qui n'enregistre rien par décision.
 *
 * Aucune méthode ne rend de données : un dépôt qui se relirait obligerait le
 * moteur à savoir ce que la base répond, et c'est précisément ce qu'on ne veut
 * pas ici. La lecture appartient au bilan, donc au lot du stockage.
 */
import type { ConsigneJugee, Essai, Reponse, Scores } from './types';
import type { Reglages } from './reglages';

/** Un essai tel qu'il part au dépôt : ce qui a été posé, et ce qui a suivi. */
export interface EssaiJoue {
  essai: Essai;
  reponse: Reponse;
  juste: boolean;
}

/** Le résumé d'une séance. */
export interface SeanceFinie {
  /** Horodatage ISO du début. */
  le: string;
  mode: 'standard' | 'personnalise' | 'decouverte';
  reglages: Reglages;
  secondes: number;
  notes: number;
  justes: number;
  intervalleDepart: number;
  intervalleFin: number;
  intervalleMedian: number | null;
  reactionMediane: number | null;
  reactionP90: number | null;
  scores: Scores;
}

export interface DepotPcct {
  /** Un essai joué. Appelé une fois par essai noté, l'échauffement excepté. */
  noterEssai(essai: EssaiJoue): Promise<void>;
  /** Une consigne jugée. */
  noterConsigne(consigne: ConsigneJugee): Promise<void>;
  /** La séance, à sa fin. */
  cloreSeance(seance: SeanceFinie): Promise<void>;
}

/**
 * Un dépôt qui garde tout en mémoire, et rien de plus.
 *
 * Employé par la découverte — qui ne doit rien enregistrer — et par les essais
 * du moteur, qui ont besoin de relire ce qui a été écrit pour le vérifier.
 */
export class DepotEnMemoire implements DepotPcct {
  readonly essais: EssaiJoue[] = [];
  readonly consignes: ConsigneJugee[] = [];
  seance: SeanceFinie | null = null;

  async noterEssai(essai: EssaiJoue): Promise<void> {
    this.essais.push(essai);
  }

  async noterConsigne(consigne: ConsigneJugee): Promise<void> {
    this.consignes.push(consigne);
  }

  async cloreSeance(seance: SeanceFinie): Promise<void> {
    /*
       UNE GARDE, parce que la référence n'en a pas et peut compter une séance
       deux fois : son `endSession` ne vérifie pas qu'il n'a pas déjà couru, et
       la fin par le minuteur peut croiser la fin par le bouton.
    */
    if (this.seance) return;
    this.seance = seance;
  }
}

/** Un dépôt qui n'enregistre rien du tout, pour la découverte. */
export const DEPOT_MUET: DepotPcct = {
  async noterEssai() {},
  async noterConsigne() {},
  async cloreSeance() {},
};
