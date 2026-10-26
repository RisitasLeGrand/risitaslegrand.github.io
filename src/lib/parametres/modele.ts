/**
 * Ce qu'est un réglage, pour la page « Paramètres ».
 *
 * Le registre (`registre.ts`) décrit **tous** les réglages du site : leur
 * nom en français, ce à quoi ils servent, leur portée, leur valeur par
 * défaut, et surtout la façon de les lire et de les écrire — qui passe
 * toujours par les fonctions existantes. C'est l'interdit n° 2 du prompt 42,
 * et il n'est pas décoratif : un réglage que la page centrale écrirait à sa
 * façon aurait deux vérités, et la seconde finirait par mentir.
 *
 * Le champ `stockage` n'est pas de la documentation : il porte l'identifiant
 * exact que rend l'inventaire mécanique (`scripts/lib/inventaire-reglages.mjs`),
 * et c'est lui qui permet à `essais:reglages-orphelins` de dire « cette clé
 * se change quelque part et n'est pas sur la page centrale ».
 */
import type { NomDIcone } from '../icones';

export type Portee = 'appareil' | 'tous' | 'coffre';

export const DIRE_LA_PORTEE: Record<Portee, string> = {
  appareil: 'Ce téléphone seulement',
  tous: 'Tous vos appareils',
  coffre: 'Protégé par le coffre',
};

export type Nature =
  | { genre: 'interrupteur' }
  | { genre: 'choix'; options: { valeur: string; libelle: string; detail?: string }[] }
  | { genre: 'nombre'; min: number; max: number; pas?: number; unite?: string }
  | { genre: 'heure' }
  /** Affiché, mais modifié sur son écran : une liste, une table, un dossier. */
  | { genre: 'ailleurs'; vers: string; texte: string };

export interface Reglage {
  /** Sert d'ancre : `/parametres/#<id>`. */
  id: string;
  libelle: string;
  /** Une ligne, en mots simples, qui dit à quoi il sert. */
  aQuoiCaSert: string;
  section: string;
  portee: Portee;
  /** L'identifiant de l'inventaire : « localStorage::revinsp.theme ». */
  stockage: string;
  nature: Nature;
  defaut: unknown;
  /**
   * Ce que veut dire un champ **vide**, en français.
   *
   * P10 du prompt 56. « Ma journée » affichait 07:00 et 21:00 quand rien
   * n'était renseigné, comme si ces heures avaient été choisies — alors que
   * « Mon profil », pour le même champ, disait « non renseigné ». Le vide a un
   * sens, il est différent selon le réglage, et il se déclare donc ici plutôt
   * que de se devoir au hasard du rendu.
   */
  siVide?: string;
  /** L'écran d'où il venait, pour le lien « Réglages de cet écran ». */
  ecran?: string;
  /** Vrai si la valeur ne peut pas être lue coffre fermé. */
  sousCoffre?: boolean;
}

/**
 * Lire et écrire un réglage — rangés à part du catalogue, et pour une raison.
 *
 * Le catalogue est **pur** : il ne contient que des mots et des valeurs par
 * défaut, et la page le lit à la construction pour écrire son HTML. Les
 * accès, eux, touchent IndexedDB, `localStorage` et le coffre : ils n'ont
 * rien à faire dans un rendu de page, et ne sont chargés que par le script
 * de l'écran. L'essai des orphelins, lui, n'a besoin que du catalogue — il
 * tourne donc sans navigateur.
 */
export interface Acces {
  lire: () => Promise<unknown>;
  ecrire: (valeur: unknown) => Promise<void>;
}

export interface Section {
  id: string;
  titre: string;
  /** Ce que la section rassemble, en une phrase. */
  propos: string;
  /**
   * Le nom de l'icône au catalogue — un SENS, pas un dessin.
   *
   * Le type le restreint aux noms connus, parce qu'une faute de frappe
   * donnerait une icône VIDE : un carré de rien à côté d'un titre juste, que
   * personne ne remarque avant longtemps.
   */
  icone: NomDIcone;
}
