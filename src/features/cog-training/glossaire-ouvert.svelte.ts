/**
 * Quel terme le glossaire doit montrer, et où rendre le focus ensuite.
 *
 * ## Pourquoi un état partagé, et non une propriété passée de main en main
 *
 * Le terme cliquable et le glossaire ne se connaissent pas : le premier vit
 * au milieu d'une phrase, parfois à trois composants de profondeur — dans une
 * consigne, dans un libellé de réglage, dans un bilan —, le second est posé une
 * fois en bas de l'écran. Les relier par des propriétés aurait obligé chaque
 * composant intermédiaire à transporter une donnée qui ne le concerne pas, et
 * le jour où l'un oublie de la passer, le terme devient muet sans erreur.
 *
 * ## Pourquoi il garde aussi l'élément d'origine
 *
 * Ouvrir le glossaire déplace le focus sur la définition — sinon un lecteur
 * d'écran ne saurait pas que quelque chose s'est ouvert. Mais refermer doit
 * ramener là où l'on était : la phrase qu'on lisait, au mot près. Sans cela,
 * la tabulation reprend au début de la page, et l'on a perdu sa place pour
 * avoir voulu une définition.
 */
import { GLOSSAIRE } from './glossaire';

/** Le terme à mettre en évidence, ou `null` si le glossaire n'est pas appelé. */
let demande = $state<string | null>(null);

/** D'où l'on vient, pour y revenir à la fermeture. */
let origine: HTMLElement | null = null;

export const glossaireOuvert = {
  get terme() {
    return demande;
  },

  /**
   * Demande l'ouverture sur un terme.
   *
   * Un terme inconnu est refusé plutôt que d'ouvrir le glossaire sur rien :
   * c'est le genre de faute de frappe qui, sans ce garde-fou, se verrait
   * seulement à l'usage — un mot souligné qui n'ouvre rien.
   */
  ouvrir(technique: string, depuis?: HTMLElement | null) {
    if (!GLOSSAIRE.some((t) => t.technique === technique)) return;
    origine = depuis ?? null;
    demande = technique;
  },

  /** Referme, et rend le focus d'où il venait. */
  fermer() {
    demande = null;
    const retour = origine;
    origine = null;
    /*
       Le focus est rendu APRÈS le rendu : rendu tout de suite, il serait
       déplacé une seconde fois par la fermeture du dépliant.
     */
    if (retour) requestAnimationFrame(() => retour.focus());
  },
};
