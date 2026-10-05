/**
 * Moteur « Sous-système commun » — catégorie Isomorphisme.
 *
 * Deux réseaux sont montrés, tirés de **systèmes différents** ou du même système
 * mais réétiquetés. La question : quel est le plus grand motif que les deux
 * partagent ?
 *
 * Le choix qui rend l'exercice possible est le suivant : **on ne demande pas de
 * construire le motif, mais de reconnaître sa taille**. Demander de le dessiner
 * exigerait une interface de saisie de graphe ; demander « lequel de ces quatre
 * motifs est commun aux deux » retomberait sur Recherche de motif. Demander la
 * **taille du plus grand commun** est la question qui porte réellement sur la
 * comparaison des deux structures, et elle se corrige par un entier.
 *
 * Le calcul est une énumération : pour k décroissant, on cherche une
 * sous-structure de taille k du premier réseau qui apparaisse dans le second. La
 * lecture est **non induite** ici, à la différence de Recherche de motif : ce
 * qu'on partage, ce sont des relations présentes, et exiger que les absences
 * concordent aussi rendrait la réponse presque toujours égale à deux.
 *
 * ## Le seuil de relations, et pourquoi il doit être dit à la personne
 *
 * La lecture non induite rend la question **dégénérée** si l'on n'y prend garde :
 * un groupe dont les entités ne sont liées par rien se retrouve dans n'importe
 * quel réseau d'au moins autant d'entités, et la réponse serait toujours la
 * taille du plus petit des deux réseaux. Le solveur exige donc que le groupe
 * porte au moins **k − 1** relations.
 *
 * Cette exigence était dans le calcul sans être dans l'énoncé, et c'était un
 * défaut : mesuré sur neuf cents tirages, deux donnaient une réponse que le
 * solveur comptait juste alors que la définition affichée en rendait une autre
 * vraie — sur `digraph`, dont les matrices portent des cases vides. L'énoncé la
 * dit donc maintenant, et la correction s'y réfère. Aligner l'énoncé sur le
 * calcul valait mieux que retirer le seuil, qui ne fait pas que gagner du temps :
 * sans lui, il n'y a plus d'exercice. Les
 * réseaux comptent au plus sept entités, soit trente-cinq sous-ensembles de
 * taille trois — l'énumération est immédiate.
 *
 * ## La trace a deux moitiés, et la seconde est la vraie
 *
 * **Le témoin** : quelles entités forment le motif dans le premier réseau, et
 * sur lesquelles du second il se retrouve. C'est ce qui prouve que la taille
 * annoncée est atteinte.
 *
 * **La maximalité** : qu'aucun groupe plus grand n'y parvienne. C'est la moitié
 * qu'une correction paresseuse omet, et c'est pourtant celle qui distingue la
 * bonne réponse de celle juste au-dessus. La trace dit **combien** de groupes de
 * taille supérieure ont été essayés, puisque c'est exactement ce que le calcul a
 * fait.
 */
import { matrice, occurrences, sousMatrice } from '../../noyaux/isomorphisme';
import { blocMatrice, texte } from '../../noyaux/presentation';
import { journal, ref } from '../../../correction/trace';
import type { Matrice } from '../../noyaux/isomorphisme';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 40;

/** Tous les sous-ensembles d'indices de taille `k`. */
function combinaisons(n: number, k: number): number[][] {
  const resultat: number[][] = [];
  const courant: number[] = [];
  const parcourir = (depart: number): void => {
    if (courant.length === k) {
      resultat.push([...courant]);
      return;
    }
    for (let i = depart; i < n; i += 1) {
      courant.push(i);
      parcourir(i + 1);
      courant.pop();
    }
  };
  parcourir(0);
  return resultat;
}

/**
 * La taille du plus grand motif commun, et un témoin.
 *
 * Le motif doit compter au moins une arête par sommet au-delà du premier, sans
 * quoi un ensemble de sommets sans aucune relation compterait comme « commun » —
 * ce qui est formellement vrai et pédagogiquement vide.
 */
function plusGrandCommun(
  gauche: Matrice,
  droite: Matrice,
  maximum: number,
): { taille: number; indices: number[] } | null {
  for (let k = Math.min(maximum, gauche.length, droite.length); k >= 2; k -= 1) {
    for (const indices of combinaisons(gauche.length, k)) {
      const motif = sousMatrice(gauche, indices);
      const aretes = motif.flat().filter(Boolean).length;
      if (aretes < k - 1) continue;
      if (occurrences(motif, droite, false).length) return { taille: k, indices };
    }
  }
  return null;
}

export const sousSystemeCommun: Moteur = {
  id: 'sous-systeme-commun',
  nom: 'Sous-système commun',
  categorie: 'isomorphisme',
  resume: 'Deux réseaux : quelle est la taille du plus grand motif qu’ils partagent ?',
  regimes: ['algebre', 'clos'],

  /**
   * Un **ordre total** rend la question dégénérée, et le moteur le refuse.
   *
   * Un ordre total sur k éléments est unique à isomorphisme près : tout
   * sous-ensemble de l'un se retrouve donc dans l'autre, et le plus grand motif
   * commun vaut toujours la taille du plus petit des deux réseaux. Il n'y a rien
   * à comparer, et la réponse se devine sans regarder.
   *
   * Le refus est explicite plutôt que laissé au hasard des tirages : ainsi le
   * couple n'apparaît pas dans « Mon entraînement », et l'essai le dit — « le
   * moteur refuse ce système » — au lieu d'un rendement de zéro pour cent qui
   * ressemblerait à une panne. Les systèmes à un seul axe sont exactement
   * `line` et `grandeur`.
   */
  compatible: (systeme: Systeme) => (systeme.axes?.length ?? 0) !== 1,

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const premier = systeme.engendrer(Math.max(3, Math.min(echelon + 2, 8)), alea);
      const second = systeme.engendrer(Math.max(3, Math.min(echelon + 2, 8)), alea);
      if (premier.entites.length < 4 || second.entites.length < 4) continue;

      const gauche = matrice(systeme, premier);
      const droite = matrice(systeme, second);

      /*
       * La recherche va jusqu'à la taille du plus petit des deux réseaux, et
       * non jusqu'à cinq comme auparavant.
       *
       * Le plafond de cinq était un plafond de **recherche** présenté comme un
       * **maximum**, ce qui est tout autre chose. Sur deux ordres totaux de sept
       * entités, tout sous-ensemble de l'un se retrouve dans l'autre — un ordre
       * total sur k éléments est unique à isomorphisme près —, de sorte que le
       * plus grand motif commun vaut sept. Le moteur répondait cinq, et comptait
       * donc faux la bonne réponse, qui figurait parmi les options proposées.
       *
       * Une fois la recherche exhaustive, ces tirages tombent d'eux-mêmes sur le
       * refus `commun.taille >= plafond` juste en dessous : la question est
       * **dégénérée** sur un ordre total, et ne pas la poser est la seule
       * réponse juste. `line` et `grandeur` ne rendent donc plus d'items, et
       * c'est le correctif, non la perte.
       */
      const commun = plusGrandCommun(gauche, droite, Math.min(gauche.length, droite.length));
      if (!commun) continue;

      // Une réponse égale au minimum ou au maximum possible se devinerait sans
      // examen : on ne retient que les valeurs intermédiaires.
      const plafond = Math.min(premier.entites.length, second.entites.length);
      if (commun.taille < 3 || commun.taille >= plafond) continue;
      // Le palier « une entité de plus » est donc toujours parcouru, puisque la
      // recherche monte jusqu'au plafond et que la réponse retenue lui est
      // strictement inférieure. La correction peut affirmer la maximalité.

      const proposees = [commun.taille - 1, commun.taille, commun.taille + 1, commun.taille + 2]
        .filter((n) => n >= 2 && n <= plafond);
      if (proposees.length < 3) continue;

      const melange = alea.melanger(proposees);
      const bonne = melange.indexOf(commun.taille);

      /*
       * La valeur juste au-dessus est le leurre instructif : on a trouvé un
       * motif commun et l'on a cru qu'il s'étendait d'une entité. Celles plus
       * hautes encore, et celle du dessous, n'illustrent rien de nommable.
       */
      /*
       * Aucune étiquette ici. La valeur juste au-dessus est bien le leurre le
       * plus tentant — on a trouvé un motif et l'on a cru qu'il s'étendait d'une
       * entité —, mais aucune des étiquettes du vocabulaire ne nomme cette
       * erreur, et en poser une de travers vaut moins que n'en poser aucune.
       */
      const options: Option[] = melange.map((n) => ({ texte: `${n} entités` }));

      // ----- La trace : le témoin, puis la maximalité --------------------
      const carnet = journal();
      const motif = sousMatrice(gauche, commun.indices);
      const image = occurrences(motif, droite, false)[0];
      const nomsGauche = commun.indices.map((i) => premier.entites[i]);
      const nomsDroite = image.map((i) => second.entites[i]);

      carnet.etape({
        utilise: [...nomsGauche.map((n) => ref('entite', n)), ...nomsDroite.map((n) => ref('noeud', n))],
        loi: 'témoin',
        produit: `${commun.taille} entités : ${nomsGauche.join(', ')} ↔ ${nomsDroite.join(', ')}`,
        legende:
          `Dans le premier réseau, ${nomsGauche.join(', ')} forment une structure qui se ` +
          `retrouve dans le second sur ${nomsDroite.join(', ')} — dans cet ordre. La taille ` +
          `${commun.taille} est donc atteinte, et vous pouvez le vérifier relation par relation.`,
        surbrillance: [
          ...nomsGauche.map((n) => ref('entite', n)),
          ...nomsDroite.map((n) => ref('noeud', n)),
        ],
      });

      // Le nombre de groupes de taille supérieure du premier réseau, tous
      // essayés sans succès : c'est la moitié « maximalité » de la preuve.
      // Les groupes réellement essayés à ce palier : ceux qui franchissent le
      // seuil de relations. Les autres n'ont pas été testés, et l'affirmer
      // serait faux.
      const essayes = [...combinaisons(gauche.length, commun.taille + 1)].filter(
        (indices) =>
          sousMatrice(gauche, indices).flat().filter(Boolean).length >= commun.taille,
      ).length;
      carnet.etape({
        utilise: [ref('option', bonne)],
        loi: 'maximalité',
        produit: `${commun.taille} entités, et pas plus`,
        legende:
          `Reste à voir qu’on ne fait pas mieux. Parmi les groupes de ${commun.taille + 1} ` +
          'entités du premier réseau, ' +
          (essayes === 0
            ? 'aucun ne franchit le seuil de relations : il n’y a rien de plus grand à comparer.'
            : essayes === 1
              ? 'un seul franchit le seuil de relations ; il a été essayé, et ne se retrouve ' +
                'pas dans le second.'
              : `${essayes} franchissent le seuil de relations ; tous ont été essayés, et aucun ` +
                'ne se retrouve dans le second.') +
          ` La réponse est donc ${commun.taille}, et non ${commun.taille + 1} — c’est cette ` +
          'seconde moitié qui tranche entre les deux.',
        surbrillance: [ref('option', bonne)],
      });

      return {
        moteur: 'sous-systeme-commun',
        systeme: systeme.id,
        consigne: 'Combien d’entités compte le plus grand motif commun aux deux réseaux ?',
        enonce: [
          texte(
            'Deux réseaux indépendants. Un motif est « commun » lorsqu’on peut choisir le ' +
              'même nombre d’entités dans chacun, de telle sorte que les relations du premier ' +
              'groupe se retrouvent toutes dans le second — les noms n’ayant aucune importance. ' +
              'Un groupe ne compte que s’il porte **au moins une relation de moins qu’il n’a ' +
              'd’entités** : un groupe dont rien ne relie les entités se retrouverait dans ' +
              'n’importe quel réseau, et ne dirait rien de la comparaison.',
          ),
          texte('Premier réseau.'),
          blocMatrice(systeme, premier),
          texte('Second réseau.'),
          blocMatrice(systeme, second),
        ],
        reponse: { genre: 'unique', options, bonne },
        explication:
          `Le plus grand motif commun compte ${commun.taille} entités : dans le premier réseau, ` +
          `${commun.indices.map((i) => premier.entites[i]).join(', ')} forment une structure qui ` +
          'se retrouve dans le second. Aucun groupe plus grand n’y parvient — l’énumération des ' +
          'sous-ensembles de taille supérieure, parmi ceux qui portent assez de relations, ne ' +
          'donne aucune correspondance.',
        trace: carnet.sceller({ genre: 'unique', indice: bonne }),
      };
    }
    return null;
  },
};
