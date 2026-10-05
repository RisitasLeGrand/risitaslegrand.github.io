/**
 * Système `plan-temps` : un plan, et le temps comme troisième axe.
 *
 * Même produit que `space`, un axe de plus que `plane`, et pourtant un exercice
 * qui ne se confond avec aucun des deux : le troisième axe n'est pas une
 * hauteur mais une **date**. L'écart n'est pas cosmétique, il porte sur ce que
 * l'on peut se représenter — un volume se visualise d'un coup, une suite
 * d'instants se parcourt. Tenir « au nord-est de et après » demande un autre
 * geste mental que tenir « au nord-est de et au-dessus ».
 *
 * Techniquement, c'est une déclaration : le vocabulaire se compose, et les
 * seize moteurs y tournent sans qu'une ligne de moteur soit touchée. C'est
 * exactement ce que la séparation système / moteur devait rendre possible, et
 * la raison pour laquelle ajouter un système coûte si peu.
 */
import { systemeProduit } from './axes';

export const planTemps = systemeProduit({
  id: 'plan-temps',
  nom: 'Plan et temps',
  resume: 'Des événements situés sur une carte et dans le temps.',
  rendu: 'texte',
  axes: [
    {
      id: 'x',
      libelle: "d'ouest en est",
      taille: 4,
      versLeBas: "est à l'ouest de",
      versLeHaut: "est à l'est de",
      egal: 'est sur la même colonne que',
    },
    {
      id: 'y',
      libelle: 'du sud au nord',
      taille: 4,
      versLeBas: 'est au sud de',
      versLeHaut: 'est au nord de',
      egal: 'est sur la même ligne que',
    },
    {
      id: 't',
      libelle: 'du passé vers l’avenir',
      taille: 4,
      versLeBas: 'est avant',
      versLeHaut: 'est après',
      egal: 'est en même temps que',
    },
  ],
});
