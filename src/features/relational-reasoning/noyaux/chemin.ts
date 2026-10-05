/**
 * Les chemins de prémisses, partagés par les moteurs de la famille.
 *
 * Un **chemin** est la suite de prémisses qui, composées l'une après l'autre,
 * mènent d'une entité à une autre. C'est la forme que prend la justification
 * dans un raisonnement relationnel, et c'est ce que la correction pas à pas doit
 * pouvoir dérouler : sans chemin, on ne peut que montrer le résultat.
 *
 * Extrait de `conclusion.ts` quand `composee.ts` en a eu besoin, puis remonté
 * de la famille Chaînes aux noyaux quand les moteurs d'incomplétude ont eu
 * besoin du même objet : les uns et les autres cherchent la même chose, et une
 * seconde copie aurait divergé.
 */
import { journal as _journal, ref, type Journal, type Ref } from '../../correction/trace';
import { libelle } from './presentation';
import type { Fait, Systeme } from '../systemes/types';

export interface Arete {
  de: string;
  a: string;
  relation: string;
  /** Rang de la prémisse dans la liste affichée. */
  indice: number;
}

export interface Chemin {
  aretes: Arete[];
  /** L'ensemble des relations que ce chemin laisse possibles entre les bouts. */
  obtenu: Set<string>;
}

/** Les arêtes parcourables : chaque prémisse dans ses deux sens. */
export function aretes(systeme: Systeme, faits: readonly Fait[]): Arete[] {
  const liste: Arete[] = [];
  faits.forEach((fait, indice) => {
    liste.push({ de: fait.sujet, a: fait.objet, relation: fait.relation, indice });
    liste.push({
      de: fait.objet,
      a: fait.sujet,
      relation: systeme.converse(fait.relation),
      indice,
    });
  });
  return liste;
}

/**
 * Le chemin le plus informatif de `a` vers `b`, parmi les chemins simples.
 *
 * « Le plus informatif » et non « le plus court » : un détour qui ne laisse
 * qu'une relation possible justifie une conclusion qu'un raccourci ambigu ne
 * justifierait pas. À égalité d'information, le plus court gagne — une
 * correction de trois étapes se suit mieux qu'une de cinq.
 */
export function meilleurChemin(
  systeme: Systeme,
  liste: readonly Arete[],
  a: string,
  b: string,
  longueurMax: number,
): Chemin | null {
  if (!systeme.composer) return null;
  let meilleur: Chemin | null = null;

  const explorer = (courant: string, vus: Set<string>, prises: Arete[], obtenu: Set<string>) => {
    if (prises.length > 0 && courant === b) {
      const candidat: Chemin = { aretes: [...prises], obtenu: new Set(obtenu) };
      if (
        !meilleur ||
        candidat.obtenu.size < meilleur.obtenu.size ||
        (candidat.obtenu.size === meilleur.obtenu.size &&
          candidat.aretes.length < meilleur.aretes.length)
      ) {
        meilleur = candidat;
      }
      return;
    }
    if (prises.length >= longueurMax) return;

    for (const arete of liste) {
      if (arete.de !== courant) continue;
      if (vus.has(arete.a)) continue;
      if (prises.some((p) => p.indice === arete.indice)) continue;

      const suivant = new Set<string>();
      if (obtenu.size === 0) {
        suivant.add(arete.relation);
      } else {
        for (const r of obtenu) for (const t of systeme.composer!(r, arete.relation)) suivant.add(t);
      }
      // Un chemin dont la composition est vide est contradictoire : il ne
      // justifie rien et n'a pas à être exploré plus loin.
      if (suivant.size === 0) continue;

      vus.add(arete.a);
      prises.push(arete);
      explorer(arete.a, vus, prises, suivant);
      prises.pop();
      vus.delete(arete.a);
    }
  };

  explorer(a, new Set([a]), [], new Set());
  return meilleur;
}

/**
 * Un système dont deux relations ne se composent jamais en plusieurs.
 *
 * La propriété décide du mode de réponse des moteurs de la famille : sur un
 * système fonctionnel, une chaîne couvrant les entités fixe **tout** le réseau,
 * de sorte qu'une conclusion y est nécessairement entraînée ou contredite,
 * jamais entre les deux.
 *
 * Mémoïsé, parce que le test parcourt le carré du vocabulaire et que
 * `plan-temps` en compte sept cent vingt-neuf cases.
 */
const memoFonctionnel = new WeakMap<Systeme, boolean>();
export function fonctionnel(systeme: Systeme): boolean {
  const connu = memoFonctionnel.get(systeme);
  if (connu !== undefined) return connu;
  let resultat = Boolean(systeme.composer) && systeme.cheminComplet;
  if (resultat && systeme.composer) {
    for (const r of systeme.relations) {
      for (const s of systeme.relations) {
        if (systeme.composer(r.id, s.id).size > 1) {
          resultat = false;
          break;
        }
      }
      if (!resultat) break;
    }
  }
  memoFonctionnel.set(systeme, resultat);
  return resultat;
}

/** De quoi adapter la narration à l'énoncé qui l'affiche. */
export interface OptionsNarration {
  /**
   * Le nombre de prémisses affichées. Les prémisses **hors du chemin** sont
   * alors déclarées inutiles.
   *
   * Omis quand les prémisses hors du chemin servent ailleurs. C'est le cas de
   * « Contradiction » : chaque fait entre dans un conflit, et en déclarer un
   * inutile serait faux.
   */
  inutilesParmi?: number;
  /**
   * La référence d'une prémisse, quand l'énoncé ne l'affiche pas comme une
   * prémisse. « Prémisse manquante » fait passer un candidat par le chemin : il
   * est affiché comme une **option**, et c'est là qu'il faut le surligner.
   */
  refDe?: (indice: number) => Ref;
  /** Le nom d'une prémisse dans les légendes — « la prémisse 2 » par défaut. */
  nomDe?: (indice: number) => string;
}

/**
 * Dépose dans le carnet la composition du chemin, étape par étape, et rend
 * l'ensemble des relations qu'il laisse ouvertes entre ses deux bouts.
 *
 * C'est la narration commune de tous les moteurs qui justifient quelque chose
 * par une chaîne de prémisses — ceux de la famille Chaînes comme ceux de
 * l'incomplétude. Elle était écrite dans `conclusion.ts` ; la reprendre ailleurs
 * aurait fait deux récits du même calcul, qui auraient fini par ne plus dire la
 * même chose.
 */
export function tracerChemin(
  carnet: Journal,
  systeme: Systeme,
  chemin: Chemin,
  depart: string,
  options: OptionsNarration = {},
): Set<string> {
  const refDe = options.refDe ?? ((indice: number) => ref('premisse', indice));
  const nomDe = options.nomDe ?? ((indice: number) => `la prémisse ${indice + 1}`);

  if (options.inutilesParmi !== undefined) {
    const surLeChemin = new Set(chemin.aretes.map((arete) => arete.indice));
    for (let indice = 0; indice < options.inutilesParmi; indice += 1) {
      if (!surLeChemin.has(indice)) carnet.inutile(refDe(indice));
    }
  }

  let accumule = new Set<string>();
  chemin.aretes.forEach((arete, rang) => {
    const avant = accumule;
    accumule =
      avant.size === 0
        ? new Set([arete.relation])
        : new Set([...avant].flatMap((r) => [...systeme.composer!(r, arete.relation)]));
    const mobilisees = chemin.aretes.slice(0, rang + 1).map((x) => refDe(x.indice));
    carnet.etape({
      utilise: [refDe(arete.indice)],
      loi: rang === 0 ? undefined : 'composition',
      produit:
        accumule.size === 1
          ? `${depart} ${libelle(systeme, [...accumule][0])} ${arete.a}`
          : `${depart} et ${arete.a} : ${accumule.size} relations encore possibles`,
      legende:
        rang === 0
          ? `${majuscule(nomDe(arete.indice))} relie ${arete.de} à ${arete.a}.`
          : accumule.size === 1
            ? `En composant avec ${nomDe(arete.indice)}, on obtient : ` +
              `${depart} ${libelle(systeme, [...accumule][0])} ${arete.a}.`
            : `En composant avec ${nomDe(arete.indice)}, ${accumule.size} relations ` +
              `restent possibles entre ${depart} et ${arete.a}.`,
      surbrillance: [...mobilisees, ref('entite', depart), ref('entite', arete.a)],
    });
  });

  return accumule;
}

const majuscule = (mots: string) => mots.charAt(0).toUpperCase() + mots.slice(1);

/** Un carnet neuf — réexporté pour que l'appelant n'ait pas deux imports. */
export const journal = _journal;
