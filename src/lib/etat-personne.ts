/**
 * Le pont entre le stockage et la porte, et il n'y en a qu'un.
 *
 * ## Pourquoi un module pour trois lectures
 *
 * `contextePersonne()` est une fonction pure : on lui passe l'état, elle ne va
 * le chercher nulle part. C'est ce qui la rend testable sans base, et c'est ce
 * qui rend vraie la promesse « pas de lecture silencieuse » — il n'y a pas de
 * lecture à l'intérieur.
 *
 * Mais il faut bien que quelqu'un lise. Ce module est ce quelqu'un, et il est
 * **seul** : l'essai sur le graphe d'imports interdit à tout autre fichier de
 * `src/` de nommer `naissanceAnnee`, `naissanceMois` ou `majeurDeclare`. Un
 * écran qui voudrait contourner la porte devrait donc ajouter une ligne à une
 * liste dont la taille est elle-même vérifiée — c'est-à-dire le faire
 * délibérément, et le laisser voir.
 *
 * ## Ce qui n'est pas encore là
 *
 * `sexe`, `aUnCycle` et le statut hormonal appartiennent à Odyssée > Corps,
 * sous coffre et sous la matrice de permissions (A.3, B.2). Leur lecture
 * arrivera avec la phase qui les crée. En attendant, ce module rend
 * honnêtement `null` : **pas une valeur par défaut**, pas « homme », pas
 * « femme ». Les consommateurs reçoivent `inconnu`, et les écrans le disent.
 */
import { champ } from './profil';
import type { EtatDeLaPersonne } from './noyau/registre-usages';
import { ETAT_VIERGE } from './noyau/registre-usages';

const entier = (valeur: unknown): number | null =>
  typeof valeur === 'number' && Number.isInteger(valeur) ? valeur : null;

const booleen = (valeur: unknown): boolean | null =>
  typeof valeur === 'boolean' ? valeur : null;

/**
 * L'état de la personne, tel que les consommateurs le verront — après
 * réduction par le registre.
 *
 * Un champ absent, inconnu ou refusé donne `null` : les trois se lisent de la
 * même façon ici, parce que la différence entre eux sert à **la question** (ne
 * pas reposer un refus) et non au **calcul** (qui ne sait rien dans les trois
 * cas).
 */
export async function etatDeLaPersonne(): Promise<EtatDeLaPersonne> {
  const [annee, mois, majeur] = await Promise.all([
    champ('naissanceAnnee'),
    champ('naissanceMois'),
    champ('majeurDeclare'),
  ]);
  return {
    ...ETAT_VIERGE,
    age: {
      naissanceAnnee: entier(annee?.valeur),
      naissanceMois: entier(mois?.valeur),
      majeurDeclare: booleen(majeur?.valeur),
    },
  };
}
