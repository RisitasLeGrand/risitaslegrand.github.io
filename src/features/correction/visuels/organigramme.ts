/**
 * Les deux lectures d'un schéma, et son texte complet.
 *
 * ## Pourquoi cette logique n'est pas dans le composant
 *
 * `VisuelSchema.svelte` dessine ; ce module décide **ce qui est dessiné** et
 * **ce qui est dit**. La séparation n'est pas de l'élégance : un `.svelte` ne
 * s'importe pas depuis un essai de nœud sans compilateur, de sorte qu'une règle
 * écrite dans le composant ne se mesure qu'en navigateur — un essai par règle,
 * trois quarts de minute chacun, et une panne de rendu pour seule trace quand
 * la règle est fausse. Ici, les mêmes règles se mesurent en quelques
 * millisecondes et se lisent dans leur énoncé.
 *
 * ## Les deux lectures
 *
 * Un organigramme d'administration a deux lectures utiles : le **squelette**,
 * ce que toutes les directions partagent, et le **détail**, avec ses divisions
 * nommées. Les écrire en deux visuels aurait laissé les deux dériver, et
 * personne n'aurait vu le jour où ils cesseraient de dire la même chose. Un
 * nœud porte donc `essentiel`, et le même objet se lit dans les deux sens.
 *
 * Un lien ne survit au squelette que si **ses deux bouts** y sont. L'autre
 * règle possible — garder un lien dont une extrémité manque — dessinerait un
 * trait vers une boîte absente, c'est-à-dire un rattachement inventé.
 */
import type { DonneesSchema } from './types';

export interface NoeudDeSchema {
  id: string;
  libelle: string;
  niveau: number;
  essentiel?: boolean;
}

/**
 * Y a-t-il deux dessins différents à offrir ?
 *
 * Il en faut deux, et c'est la seule condition qui vaille : au moins deux nœuds
 * essentiels — un dessin d'une seule boîte n'est pas une lecture —, et au moins
 * un nœud qui ne l'est pas, sans quoi le squelette serait le détail. Une
 * bascule qui mènerait au même dessin serait une bascule qui mente.
 */
export function offreDeuxLectures(donnees: DonneesSchema): boolean {
  const essentiels = donnees.noeuds.filter((n) => n.essentiel).length;
  return essentiels >= 2 && essentiels < donnees.noeuds.length;
}

/**
 * Les nœuds et les liens d'une lecture.
 *
 * `squelette` n'a d'effet que si les deux lectures existent : demander le
 * squelette d'un schéma qui n'en déclare pas rendrait un dessin vide, et un
 * dessin vide est pire qu'un dessin dense — il laisse croire qu'il n'y a rien.
 */
export function lecture(
  donnees: DonneesSchema,
  squelette: boolean,
): { noeuds: DonneesSchema['noeuds']; liens: NonNullable<DonneesSchema['liens']> } {
  const simplifie = squelette && offreDeuxLectures(donnees);
  const noeuds = simplifie ? donnees.noeuds.filter((n) => n.essentiel) : donnees.noeuds;
  const vus = new Set(noeuds.map((n) => n.id));
  const liens = (donnees.liens ?? []).filter((l) => vus.has(l.de) && vus.has(l.a));
  return { noeuds, liens };
}

export interface SchemaEnTexte {
  /** Un rang par niveau déclaré, dans l'ordre, avec les libellés qui y sont. */
  rangs: { niveau: number; libelles: string[] }[];
  /** Un rattachement par lien, en une phrase. */
  liens: string[];
}

/**
 * Le texte complet d'un schéma, engendré depuis ses données.
 *
 * ## Pourquoi engendré, et non écrit à la main
 *
 * `alt` est une phrase : elle annonce ce que le dessin montre, elle ne le
 * remplace pas. Pour un organigramme de vingt boîtes, qui ne voit pas le dessin
 * n'a aucun moyen de reconstruire la hiérarchie, et qui le voit sur un écran de
 * 390 points lit des boîtes réduites. Il faut donc un équivalent textuel
 * complet — et s'il était écrit à la main, il se périmerait au premier nœud
 * ajouté, sans que rien ne le signale. Engendré, il ne peut pas mentir sur le
 * dessin : c'est le même objet qui produit les deux.
 *
 * Les libellés des liens sont rendus par le libellé du nœud, et non par son
 * identifiant : `dir` ne dit rien à personne, « Directeur départemental » dit
 * tout. Un identifiant qui ne correspond à aucun nœud est rendu tel quel
 * plutôt que tu : le contrôle de contenu refuse déjà ce cas, et le taire ici
 * ferait disparaître un rattachement au lieu de le montrer cassé.
 */
export function enTexte(donnees: DonneesSchema, squelette: boolean): SchemaEnTexte {
  const { noeuds, liens } = lecture(donnees, squelette);
  const niveaux = [...new Set(noeuds.map((n) => n.niveau))].sort((a, b) => a - b);
  const libelleDe = new Map(donnees.noeuds.map((n) => [n.id, n.libelle]));
  return {
    rangs: niveaux.map((niveau) => ({
      niveau,
      libelles: noeuds.filter((n) => n.niveau === niveau).map((n) => n.libelle),
    })),
    liens: liens.map((l) => {
      const de = libelleDe.get(l.de) ?? l.de;
      const a = libelleDe.get(l.a) ?? l.a;
      return l.libelle ? `De « ${de} » à « ${a} » : ${l.libelle}.` : `De « ${de} » à « ${a} ».`;
    }),
  };
}
