/**
 * Ce qu'un moteur produit, et rien de plus.
 *
 * Tous les moteurs — les trente du cahier des charges — rendent le même type
 * d'`Item`. C'est ce qui permet à un seul jeu de composants de les afficher
 * tous, et à la session de compter les réussites sans savoir de quel moteur
 * elles viennent. Un moteur qui aurait besoin d'un affichage propre ajoute une
 * variante de `Bloc`, jamais un composant de session.
 */
import type { Alea, Axe, Regime, Systeme } from '../systemes/types';
import type { EtiquetteErreur, TraceResolution } from '../../correction/trace';

/** Un morceau affichable d'énoncé ou d'option. */
export type Bloc =
  | { type: 'texte'; texte: string }
  /** Des faits déjà mis en français : « A est à l'est de B ». */
  | { type: 'faits'; phrases: string[] }
  /** Une position par entité sur les axes d'un système-produit. */
  | {
      type: 'grille';
      axes: Axe[];
      points: { etiquette: string; coord: number[] }[];
      /** Entités à faire ressortir — la paire interrogée, par exemple. */
      souligne?: string[];
    }
  /** Un réseau d'arêtes étiquetées. */
  | {
      type: 'graphe';
      noeuds: string[];
      aretes: { de: string; a: string; libelle: string; sorte?: 'positif' | 'negatif' }[];
      /** L'arête à deviner, tracée en pointillés. */
      manquante?: { de: string; a: string };
    }
  | { type: 'tableau'; entetes: string[]; lignes: string[][] };

/** Une option de réponse : du texte, un dessin, ou les deux. */
export interface Option {
  texte?: string;
  blocs?: Bloc[];
  /**
   * L'erreur type qu'incarne ce distracteur.
   *
   * C'est ce qui permet à la correction de commencer par « vous avez pris la
   * relation inverse » plutôt que par « faux » : on nomme le geste à corriger.
   * Absente sur la bonne réponse, et sur un distracteur qui n'illustre aucune
   * erreur identifiable.
   */
  etiquette?: EtiquetteErreur;
}

export type Reponse =
  | { genre: 'unique'; options: Option[]; bonne: number }
  /**
   * Plusieurs bonnes réponses. C'est le format des moteurs qui demandent
   * « toutes les relations encore possibles » : la réponse *est* un ensemble,
   * et n'accepter qu'un élément trahirait la question.
   */
  | { genre: 'multiple'; options: Option[]; bonnes: number[] }
  /** Chaque élément de gauche va avec un élément de droite. */
  | {
      genre: 'appariement';
      gauche: string[];
      droite: string[];
      paires: Record<string, string>;
    };

export interface Item {
  moteur: string;
  systeme: string;
  /** Ce que l'on demande, en une phrase. */
  consigne: string;
  enonce: Bloc[];
  reponse: Reponse;
  /** Montrée après correction : le raisonnement, non le seul verdict. */
  explication: string;
  /**
   * La trace de résolution, déposée par le solveur pendant qu'il calcule.
   *
   * Facultative le temps que les seize moteurs y passent : un moteur qui n'en
   * fournit pas encore affiche son `explication` seule. L'essai
   * `npm run essais:correction` liste ceux qui restent, et vérifie pour les
   * autres que la trace conclut bien à la réponse attendue.
   */
  trace?: TraceResolution;
  /**
   * Second temps facultatif, posé une fois le premier corrigé. Hidden Algebra
   * s'en sert pour demander de prédire une relation non montrée sous l'algèbre
   * qui vient d'être identifiée.
   */
  suite?: {
    consigne: string;
    enonce: Bloc[];
    reponse: Reponse;
    explication: string;
  };
}

export type Categorie =
  | 'isomorphisme'
  | 'analogie'
  | 'incompletude'
  | 'algebres'
  | 'induction'
  | 'chaines';

/**
 * Comment un moteur monte son échelle, quand la règle commune ne convient pas.
 *
 * La règle commune — trois réussites d'affilée — suppose qu'une réussite ait du
 * sens. Sur une réponse à deux options, elle n'en a guère : trois réussites de
 * suite arrivent une fois sur huit par pur hasard. Un moteur à peu d'options
 * déclare donc une fenêtre, et la progression s'y conforme.
 */
export interface RegleDEchelle {
  /** Réussites exigées sur une fenêtre pleine pour monter d'un cran. */
  reussites: number;
  /** Taille de la fenêtre, en items de ce moteur. */
  fenetre: number;
  /** Réussites au plus, sur une fenêtre pleine, pour redescendre d'un cran. */
  descente: number;
}

export interface Moteur {
  id: string;
  nom: string;
  categorie: Categorie;
  /** Une phrase : ce que le moteur demande de faire. */
  resume: string;
  /** Les régimes d'inférence dans lesquels le moteur sait travailler. */
  regimes: Regime[];
  /**
   * Règle d'échelle propre au moteur. Absente, la règle commune s'applique :
   * trois réussites d'affilée pour monter, deux fautes de suite pour descendre.
   */
  echelle?: RegleDEchelle;
  /**
   * Ce moteur offre-t-il la correction détaillée ? Vrai par défaut.
   *
   * Déclaré ici pour qu'un moteur nouveau soit couvert sans qu'on ait à penser
   * à l'inscrire ailleurs. Aucun moteur relationnel ne le met à faux : le seul
   * exercice exclu de Cog-Training est Quad N-Back, qui n'a pas de moteurs.
   */
  correctionDetaillee?: boolean;
  /**
   * Filtre plus fin que le régime, quand il le faut. `groups` appartient au
   * régime algébrique mais sa composition est fonctionnelle : aucune paire n'y
   * reste ouverte, ce qui le rend inutilisable pour les moteurs
   * d'indétermination sans qu'aucun régime ne le dise.
   *
   * `voisins` est le catalogue complet, pour le seul moteur qui en a besoin :
   * une analogie inter-systèmes n'est praticable que s'il existe **ailleurs**
   * un système où transférer. Le paramètre est facultatif, de sorte que les
   * dix-huit autres moteurs gardent leur signature à un argument.
   */
  compatible?(systeme: Systeme, voisins?: readonly Systeme[]): boolean;
  /**
   * Rend `null` quand le tirage ne donne pas d'item valide — structure trop
   * symétrique pour avoir une réponse unique, indétermination absente là où
   * elle est nécessaire. La session retire alors une autre graine plutôt que de
   * poser une question douteuse.
   *
   * `voisins` suit la même règle que pour `compatible` : le moteur reçoit les
   * autres systèmes, il ne les importe pas. La séparation des deux couches
   * tient toujours — un moteur ne connaît aucun système par son nom.
   */
  engendrer(
    systeme: Systeme,
    difficulte: number,
    alea: Alea,
    voisins?: readonly Systeme[],
  ): Item | null;
}

/** Un moteur peut-il tourner sur un système ? */
export function accepte(
  moteur: Moteur,
  systeme: Systeme,
  voisins?: readonly Systeme[],
): boolean {
  if (!moteur.regimes.some((regime) => systeme.regimes.includes(regime))) return false;
  return moteur.compatible ? moteur.compatible(systeme, voisins) : true;
}
