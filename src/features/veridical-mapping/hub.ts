/**
 * Le hub : toutes les paires entraînables d'une famille, et l'arbre couvrant.
 *
 * Une paire ne relie que deux dimensions de la **même famille**. C'est la règle
 * centrale du cahier des charges : on ne fait pas correspondre un « combien » à
 * un « où ». Voir PLAN.md, phase 9, pour ce que cette règle écarte — et pour
 * l'interrupteur qui permet de l'ouvrir en connaissance de cause.
 *
 * Les deux sens d'une paire sont suivis séparément, ce qui est la façon la plus
 * directe de mesurer la **bidirectionnalité** : le seuil de taille → intensité
 * et celui d'intensité → taille se lisent côte à côte.
 */
import {
  DIMENSIONS,
  dimensionParId,
  dimensionsDeFamille,
  type Dimension,
  type Famille,
} from './dimensions';

export interface Arete {
  /** « taille>intensite » — la direction compte. */
  id: string;
  famille: Famille;
  de: Dimension;
  vers: Dimension;
  /** Vrai quand les deux dimensions n'ont pas la même modalité. */
  transmodale: boolean;
}

export function idArete(de: string, vers: string): string {
  return `${de}>${vers}`;
}

/* ── LES ALIAS, AU MOMENT DE RELIRE ────────────────────────────────────── */

/**
 * L'IDENTIFIANT DE RANGEMENT D'UNE DIMENSION, QUEL QUE SOIT LE NOM DONNÉ.
 *
 * Les sept dimensions d'origine ont deux noms : celui sous lequel leurs seuils
 * sont écrits (`taille`) et le canonique de la référence de comportement
 * (`vision.size`). Les deux doivent mener au même seuil, sinon l'alias n'est
 * qu'un commentaire.
 *
 * **Un nom inconnu est rendu tel quel, et ce n'est pas un oubli.** Une
 * dimension ajoutée par un autre lot, sur une version plus récente, laisse des
 * seuils que cette version-ci ne sait pas nommer : les écarter les
 * supprimerait, alors que les garder sous leur nom d'origine les rend
 * relisibles dès que la dimension existe.
 */
export function idDeRangement(id: string): string {
  return dimensionParId(id)?.id ?? id;
}

/**
 * LES TÂCHES RENOMMÉES, ET LEUR NOM D'ALORS.
 *
 * « plan » s'appelle « couple » depuis le 1er novembre : l'écran disait déjà
 * « Un couple », et l'identifiant a rejoint l'écran. Mais la tâche voyage dans
 * la clef des seuils, donc tout seuil mesuré avant le renommage est rangé sous
 * « |plan ».
 *
 * Sans cette table, ces mesures seraient orphelines : l'escalier repartirait
 * de zéro sur une paire déjà travaillée, et rien ne le dirait — ni exception,
 * ni valeur aberrante, juste un seuil qui recommence. C'est le même mode de
 * panne que le renommage d'une dimension, et c'est le même remède : l'ancien
 * nom devient un ALIAS, lu et jamais écrit.
 *
 * Elle ne va que dans un sens, de l'ancien vers le courant. Une table
 * réversible permettrait d'écrire sous l'ancien nom, ce qui est exactement ce
 * qu'il faut empêcher.
 */
const TACHES_RENOMMEES: Record<string, string> = { plan: 'couple' };

/**
 * UNE CLEF DE SEUIL RAMENÉE À SA FORME DE RANGEMENT.
 *
 * La clef est « de>vers », éventuellement suivie de « |tâche » — un seuil
 * mesuré sur la tâche « un couple » n'est pas la même grandeur que celui de la
 * tâche de base, et les deux se rangent séparément. Le suffixe est donc
 * CONSERVÉ comme distinction, et seulement traduit quand la tâche a été
 * renommée : le supprimer confondrait deux mesures que la clef sépare exprès.
 *
 * Une clef qui n'a pas la forme attendue est rendue intacte, comme un nom de
 * dimension inconnu, et pour la même raison : une version plus récente peut
 * avoir ajouté une tâche que celle-ci ne sait pas nommer.
 */
export function clefNormalisee(clef: string): string {
  const [arete, ...suffixe] = clef.split('|');
  const cotes = arete.split('>');
  if (cotes.length !== 2) return clef;
  const taches = suffixe.map((tache) => TACHES_RENOMMEES[tache] ?? tache);
  return [idArete(idDeRangement(cotes[0]), idDeRangement(cotes[1])), ...taches].join('|');
}

/**
 * La forme minimale d'une ligne de seuil dont la relecture a besoin.
 *
 * Déclarée ici plutôt qu'importée de `db.ts` : la base importe déjà ce module,
 * et l'inverse ferait un cycle. Surtout, cela rend la reprise **pure** — elle
 * s'éprouve sans base, comme `reprendreUnSeuil`.
 */
export interface LigneDeSeuil {
  id: string;
  de: string;
  vers: string;
  escalier: { essais: number };
}

/**
 * LES SEUILS RELUS SOUS LEUR NOM DE RANGEMENT, SANS DOUBLON.
 *
 * Deux lignes peuvent désigner la même arête sous deux noms — l'une écrite
 * « taille>intensite », l'autre « vision.size>audition.level ». Elles ne sont
 * pas deux mesures : c'est la même paire, comptée deux fois. Les laisser
 * passer toutes deux ferait apparaître la paire deux fois au tableau de bord
 * et compterait ses essais en double dans la force d'un nœud.
 *
 * **On garde celle dont l'escalier a vu le plus d'essais**, parce que c'est la
 * mieux estimée — la règle est déjà celle de la fusion d'un import dans
 * `db.ts`, et deux règles différentes pour le même arbitrage seraient une
 * incohérence de plus à retenir. À égalité d'essais, la première rencontrée :
 * le choix est arbitraire, il est donc dit.
 *
 * Les seuils ne s'additionnent pas. C'est pourquoi rien n'est fusionné ici.
 */
export function seuilsRelus<T extends LigneDeSeuil>(lignes: T[]): T[] {
  const parClef = new Map<string, T>();
  for (const ligne of lignes) {
    const clef = clefNormalisee(ligne.id);
    const normalisee = {
      ...ligne,
      id: clef,
      de: idDeRangement(ligne.de),
      vers: idDeRangement(ligne.vers),
    };
    const deja = parClef.get(clef);
    if (deja === undefined || normalisee.escalier.essais > deja.escalier.essais) {
      parClef.set(clef, normalisee);
    }
  }
  return [...parClef.values()];
}

/** Identifiant de la paire sans sa direction, pour l'arbre couvrant. */
export function idPaire(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** Toutes les arêtes orientées d'une famille. */
export function aretesDeFamille(famille: Famille): Arete[] {
  const dimensions = dimensionsDeFamille(famille);
  const aretes: Arete[] = [];
  for (const de of dimensions) {
    for (const vers of dimensions) {
      if (de.id === vers.id) continue;
      aretes.push({
        id: idArete(de.id, vers.id),
        famille,
        de,
        vers,
        transmodale: de.modalite !== vers.modalite,
      });
    }
  }
  return aretes;
}

/** Toutes les paires non orientées d'une famille. */
export function pairesDeFamille(famille: Famille): { a: Dimension; b: Dimension }[] {
  const dimensions = dimensionsDeFamille(famille);
  const paires: { a: Dimension; b: Dimension }[] = [];
  for (let i = 0; i < dimensions.length; i += 1) {
    for (let j = i + 1; j < dimensions.length; j += 1) {
      paires.push({ a: dimensions[i], b: dimensions[j] });
    }
  }
  return paires;
}

/**
 * Un arbre couvrant de la famille : le plus petit ensemble de paires reliant
 * toutes ses dimensions — trois paires pour les quatre dimensions prothétiques,
 * deux pour les trois métathétiques.
 *
 * L'arbre est construit par l'algorithme de Prim, en préférant à chaque pas la
 * paire la **moins travaillée**. Le squelette tire ainsi la personne vers les
 * liens neufs au lieu de repasser sur ceux qu'elle connaît déjà, et il change
 * d'une session à l'autre à mesure que l'entraînement avance : c'est bien un
 * squelette courant, et non un chemin figé.
 */
export function arbreCouvrant(
  famille: Famille,
  essaisDeLaPaire: (a: string, b: string) => number,
): { a: Dimension; b: Dimension }[] {
  const dimensions = dimensionsDeFamille(famille);
  if (dimensions.length < 2) return [];

  const atteintes = [dimensions[0]];
  const restantes = dimensions.slice(1);
  const arbre: { a: Dimension; b: Dimension }[] = [];

  while (restantes.length) {
    let meilleure: { a: Dimension; b: Dimension; poids: number } | null = null;
    for (const dedans of atteintes) {
      for (const dehors of restantes) {
        const poids = essaisDeLaPaire(dedans.id, dehors.id);
        if (!meilleure || poids < meilleure.poids) meilleure = { a: dedans, b: dehors, poids };
      }
    }
    if (!meilleure) break;
    arbre.push({ a: meilleure.a, b: meilleure.b });
    atteintes.push(meilleure.b);
    restantes.splice(restantes.indexOf(meilleure.b), 1);
  }
  return arbre;
}

/**
 * Les arêtes qui franchissent la frontière des familles.
 *
 * Elles sont **fermées par défaut**, comme le demande le cahier des charges :
 * on ne fait pas correspondre un « combien » à un « où ». La règle a pourtant un
 * coût qu'il faut connaître — elle écarte précisément hauteur ↔ taille et
 * hauteur ↔ luminosité, qui comptent parmi les correspondances transmodales les
 * mieux répliquées de la littérature, la hauteur étant métathétique quand la
 * taille et la luminosité sont prothétiques. D'où un interrupteur plutôt qu'une
 * impossibilité câblée, et un décompte séparé au tableau de bord pour que les
 * deux régimes ne se mélangent pas.
 */
export function aretesHorsFamille(): Arete[] {
  const aretes: Arete[] = [];
  for (const de of DIMENSIONS) {
    for (const vers of DIMENSIONS) {
      if (de.id === vers.id || de.famille === vers.famille) continue;
      aretes.push({
        id: idArete(de.id, vers.id),
        famille: de.famille,
        de,
        vers,
        transmodale: de.modalite !== vers.modalite,
      });
    }
  }
  return aretes;
}
