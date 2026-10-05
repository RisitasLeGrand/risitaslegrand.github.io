/**
 * Système `grandeur` : des objets rangés par taille.
 *
 * Il tient en quinze lignes parce que la séparation en deux couches fait tout
 * le travail — mais il comble un vrai manque. `line` porte déjà un ordre
 * strict, au vocabulaire **chronologique** (« est avant », « est après ») :
 * c'est la comparaison dans le temps. Il n'existait rien pour la comparaison
 * de **magnitude**, qui est l'autre moitié de ce que les chaînes de prémisses
 * demandent, et dont le vocabulaire n'est pas interchangeable — « A est plus
 * grand que B » ne se lit pas comme « A est après B ».
 *
 * L'axe n'est **pas strict**, à la différence de `line` : deux objets peuvent
 * être de même taille. C'est un choix de fond, pas de confort. Comparer des
 * magnitudes laisse toujours l'égalité ouverte, et une chaîne de « plus grand
 * que » qui exclurait l'égalité par construction rendrait indécidables des
 * paires que l'on croirait tranchées.
 */
import { systemeProduit } from './axes';

export const grandeur = systemeProduit({
  id: 'grandeur',
  nom: 'Grandeurs',
  resume: 'Des objets comparés par leur taille, du plus petit au plus grand.',
  rendu: 'texte',
  axes: [
    {
      id: 'g',
      libelle: 'du plus petit au plus grand',
      taille: 7,
      versLeBas: 'est plus petit que',
      versLeHaut: 'est plus grand que',
      egal: 'est de la même taille que',
    },
  ],
});
