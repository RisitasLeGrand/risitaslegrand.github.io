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
 * `aUnCycle` n'est stocké nulle part, et ce module rend donc honnêtement
 * `null` pour lui : **pas une valeur par défaut**, pas « oui », pas « non ».
 * Les consommateurs reçoivent `inconnu`, et les écrans le disent. `sexe` et le
 * statut hormonal, eux, sont lus — sous coffre, voir plus bas.
 */
import { champ } from './profil';
import type { EtatDeLaPersonne } from './noyau/registre-usages';
import { ETAT_VIERGE } from './noyau/registre-usages';

const entier = (valeur: unknown): number | null =>
  typeof valeur === 'number' && Number.isInteger(valeur) ? valeur : null;

const booleen = (valeur: unknown): boolean | null =>
  typeof valeur === 'boolean' ? valeur : null;

/**
 * Ce que le coffre fermé rend, et pourquoi c'est un `null` comme les autres.
 *
 * Les deux lectures sous coffre **lèvent** quand la clé n'est pas en mémoire,
 * et c'est voulu du côté des couches de données : rendre `null` y aurait
 * laissé passer une écriture en clair. Ici, à la porte, le refus se traduit
 * en `null`, parce que la doctrine du fichier est déjà celle-là — « un champ
 * absent, inconnu ou refusé donne `null` ». Le coffre fermé est un quatrième
 * cas qui se lit comme les trois autres : **personne ne sait**.
 *
 * Ce que cela coûte en clarté est réel : un consommateur ne distingue pas
 * « coffre fermé » de « non répondu ». Mais la distinction ne lui servirait à
 * rien — il ne sait rien dans les deux cas — et la lui donner reviendrait à
 * lui dire que le coffre est fermé, c'est-à-dire à lui apprendre qu'il y a
 * quelque chose derrière.
 */
const sansLeverSiFerme = async <T>(lire: () => Promise<T>, defaut: T): Promise<T> => {
  try {
    return await lire();
  } catch {
    return defaut;
  }
};

/**
 * L'état de la personne, tel que les consommateurs le verront — après
 * réduction par le registre.
 *
 * Un champ absent, inconnu ou refusé donne `null` : les trois se lisent de la
 * même façon ici, parce que la différence entre eux sert à **la question** (ne
 * pas reposer un refus) et non au **calcul** (qui ne sait rien dans les trois
 * cas).
 *
 * ## Ce que la porte lit maintenant, et ce qu'elle ne peut toujours pas lire
 *
 * L'âge vient du **profil commun**, en clair. Le suivi du cycle et le statut
 * hormonal viennent d'**Odyssée > Corps, sous coffre** — c'est ce que la
 * phase 1 avait laissé à « la phase qui les crée », et c'est celle-ci.
 *
 * `sexe` **est lu maintenant**, et il ne l'était pas il y a quelques heures.
 * J'avais écrit ici qu'aucun magasin du dépôt ne le stockait — c'était exact,
 * vérifié ligne par ligne, et la conséquence était que
 * `profil.question-cycle` ne pouvait jamais être actif. La décision d'Alexis
 * du 19 octobre a changé la question : le suivi du cycle ne s'affiche que pour
 * un sexe féminin, ce qui demande de savoir, donc d'enregistrer. Le champ
 * existe depuis (`odyssee/sexe.ts`, magasin `odysseeSexe`, schéma 38), rangé
 * dans Odyssée > Corps et sous coffre comme le plan de phase 0 le prévoyait.
 *
 * `profil.question-cycle` n'est donc plus un usage qui ne s'allume jamais :
 * c'est une **restriction**, et son effet visible est que le suivi n'apparaît
 * pas sans cette réponse.
 */
export async function etatDeLaPersonne(): Promise<EtatDeLaPersonne> {
  const [annee, mois, majeur] = await Promise.all([
    champ('naissanceAnnee'),
    champ('naissanceMois'),
    champ('majeurDeclare'),
  ]);

  const [suiviActif, statut, sexeDeclare] = await Promise.all([
    sansLeverSiFerme(async () => {
      const { lireLesReglages } = await import('./odyssee/donnees-cycle');
      return (await lireLesReglages()).actif;
    }, false),
    sansLeverSiFerme<string | null>(async () => {
      const { tousLesStatuts } = await import('./odyssee/donnees-sensible');
      const { statutsEnCours } = await import('./odyssee/sensible');
      /*
         L'intitulé du statut le plus récemment commencé, et un seul : la clé
         `statut_hormonal` du registre est une chaîne, pas une liste. Deux
         statuts simultanés existent (une cure et un traitement), et en rendre
         un seul est une perte — mais en rendre deux demanderait de changer la
         forme de l'export du registre, ce que le pilote veut savoir avant.
      */
      const courants = statutsEnCours(await tousLesStatuts());
      if (!courants.length) return null;
      const dernier = [...courants].sort((a, b) => b.debut.localeCompare(a.debut))[0];
      return dernier.intitule || null;
    }, null),
    /*
       LE SEXE DÉCLARÉ, depuis le 19 octobre — décision d'Alexis.

       Il est lu sous coffre, comme les deux au-dessus, et traduit en
       `SexePhysio` pour le registre : `'sans-reponse'` devient `null`, parce
       que c'est la vérité du point de vue d'un consommateur — personne ne
       sait. Le refus lui-même reste dans le magasin, pour que la question ne
       se repose pas, et il n'a pas à voyager jusqu'ici.

       Coffre fermé rend `null`, donc `inconnu` pour les consommateurs. Ce
       n'est pas un défaut de repli : c'est la décision point 2, « on ne peut
       pas savoir », et `leSuiviEstVisible` la traite comme telle.
    */
    sansLeverSiFerme<import('./noyau/registre-usages').SexePhysio | null>(async () => {
      const { lireLeSexe } = await import('./odyssee/donnees-sexe');
      const { versSexePhysio } = await import('./odyssee/sexe');
      return versSexePhysio(await lireLeSexe());
    }, null),
  ]);

  return {
    ...ETAT_VIERGE,
    age: {
      naissanceAnnee: entier(annee?.valeur),
      naissanceMois: entier(mois?.valeur),
      majeurDeclare: booleen(majeur?.valeur),
    },
    sexe: sexeDeclare,
    suiviCycleActif: suiviActif,
    statutHormonal: statut,
  };
}
