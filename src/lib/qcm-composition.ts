/**
 * La composition d'une épreuve : qui fournit combien, et ce qu'il faut dire
 * quand une rubrique n'a pas de quoi.
 *
 * ## Pourquoi un module à part
 *
 * `repartir` vient de `qcm.ts`, qui importe `./ui` et n'existe donc que dans
 * un navigateur. La règle du prompt 49 — annoncer avant le début qu'une
 * rubrique ne remplira pas son quota — repose entièrement sur cette
 * répartition, et une règle d'honnêteté qu'on ne peut pas éprouver ne vaut
 * pas grand-chose. Elle vit donc ici, avec elle, en Node.
 *
 * Même raisonnement que pour `qcm-temporalite.ts`, et même conséquence :
 * aucune dépendance au navigateur dans ce fichier.
 */
import type { RubriqueDgfip } from './contenu';

/**
 * Nombre de questions d'une session complète, comme à l'épreuve.
 *
 * Ici plutôt que dans `qcm.ts` parce que `repartir` s'en sert comme valeur
 * par défaut, et qu'un module pur ne peut pas aller la chercher dans un
 * module qui ne s'importe qu'au navigateur. Réexportée par `qcm.ts`.
 */
export const TAILLE_SESSION = 54;

/**
 * Répartit « total » questions entre les rubriques, sans jamais en demander
 * plus qu'il n'en existe.
 *
 * Sans quota imposé, la répartition est égale puis le reliquat va aux rubriques
 * les mieux pourvues : sur quatre rubriques et 54 questions, cela donne
 * 14/14/13/13. Avec un quota — les formats reproduisant un sujet réel —, seules
 * les rubriques nommées sont tirées, et ce qu'une rubrique trop courte ne peut
 * fournir est repris par les autres du même format, pour que la session
 * conserve sa longueur.
 */
export function repartir(
  rubriques: readonly RubriqueDgfip[],
  total = TAILLE_SESSION,
  quotas?: Record<string, number>,
): Map<string, number> {
  const quota = new Map<string, number>();
  const disponibles = rubriques.filter(
    (r) => r.total > 0 && (!quotas || quotas[r.nom] !== undefined),
  );
  if (!disponibles.length) return quota;

  let restant = Math.min(total, disponibles.reduce((n, r) => n + r.total, 0));

  if (quotas) {
    for (const r of disponibles) {
      const n = Math.min(quotas[r.nom] ?? 0, r.total, restant);
      quota.set(r.id, n);
      restant -= n;
    }
  } else {
    const part = Math.floor(restant / disponibles.length);
    for (const r of disponibles) {
      const n = Math.min(part, r.total);
      quota.set(r.id, n);
      restant -= n;
    }
  }

  // Le reliquat va aux rubriques les mieux pourvues : c'est là qu'il coûte le
  // moins en répétition d'une session à l'autre.
  const parStock = [...disponibles].sort((a, b) => b.total - a.total);
  while (restant > 0) {
    const avant = restant;
    for (const r of parStock) {
      if (restant === 0) break;
      const actuel = quota.get(r.id) ?? 0;
      if (actuel >= r.total) continue;
      quota.set(r.id, actuel + 1);
      restant -= 1;
    }
    if (restant === avant) break; // plus aucune place : stock épuisé
  }
  return quota;
}

/* ══════════════════════════════════════════════════════════════════════════
   La composition annoncée
   ══════════════════════════════════════════════════════════════════════════ */

export interface LigneDeComposition {
  rubrique: string;
  /** Ce que le sujet 2026 prévoit pour cette rubrique. */
  prevu: number;
  /** Ce que la copie servira réellement, le stock étant ce qu'il est. */
  servies: number;
}

/**
 * Ce que la copie servira, rubrique par rubrique, comparé au sujet.
 *
 * ## Le défaut que cette fonction existe pour empêcher
 *
 * Les deux formats 2026 promettent une structure : dix questions d'Union
 * européenne, cinq d'anglais, et ainsi de suite. La copie ne tire que les
 * questions qui tiennent dans une ligne de quatre cases ; si l'anglais n'en a
 * que trois, `repartir` prend les deux manquantes ailleurs — et la session
 * garde sa longueur, mais plus sa structure.
 *
 * Sans annonce, une épreuve intitulée « Catégorie A — 45 questions (sujet
 * 2026) » servirait douze questions de logique et trois d'anglais en laissant
 * croire au contraire. La longueur ne se voit pas mentir ; la composition,
 * si — et seulement si on la dit.
 *
 * Rend une ligne par rubrique du format, et seulement pour les formats à
 * quotas : sans quota imposé, le format ne promet aucune structure, et il n'y
 * a rien à démentir.
 */
export function compositionDeLaCopie(
  rubriques: readonly RubriqueDgfip[],
  format: { total: number; repartition?: Record<string, number> },
): LigneDeComposition[] {
  if (!format.repartition) return [];
  const effectif = repartir(rubriques, format.total, format.repartition);
  const lignes: LigneDeComposition[] = [];
  for (const rubrique of rubriques) {
    const prevu = format.repartition[rubrique.nom];
    if (prevu === undefined) continue;
    lignes.push({ rubrique: rubrique.nom, prevu, servies: effectif.get(rubrique.id) ?? 0 });
  }
  return lignes;
}

/** Les rubriques qui ne fourniront pas ce que le sujet prévoit. */
export const rubriquesEnManque = (lignes: readonly LigneDeComposition[]): LigneDeComposition[] =>
  lignes.filter((l) => l.servies < l.prevu);

/**
 * La composition est-elle adaptée, c'est-à-dire différente du sujet ?
 *
 * Elle l'est dès qu'une rubrique sert moins que prévu. Qu'une autre serve
 * davantage en est la conséquence, pas une seconde anomalie : c'est le report
 * de `repartir`, et le signaler deux fois ferait croire à deux problèmes.
 */
export const compositionAdaptee = (lignes: readonly LigneDeComposition[]): boolean =>
  rubriquesEnManque(lignes).length > 0;
