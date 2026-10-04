/**
 * Le contrat de trace de résolution, commun à tous les exercices de
 * Cog-Training.
 *
 * Pourquoi un contrat, et non une explication par moteur : une explication
 * rédigée à côté du solveur peut **contredire la réponse attendue**, et c'est
 * l'erreur la plus coûteuse qu'une correction puisse commettre — elle apprend
 * le faux. On impose donc que la trace sorte du calcul lui-même, par un
 * `Journal` que le solveur alimente au fur et à mesure, et que la conclusion
 * de la trace soit la réponse de l'item. Un essai automatique le vérifie sur
 * des centaines d'items tirés au hasard, moteur par moteur.
 *
 * Rien ici ne touche à l'affichage : la trace est une donnée, les gabarits
 * français et les schémas la lisent.
 */

/** Ce qu'une étape peut désigner dans l'énoncé affiché. */
export type SorteRef =
  | 'premisse'
  | 'entite'
  | 'arete'
  | 'noeud'
  | 'option'
  | 'axe'
  | 'intervalle'
  | 'region'
  | 'classe';

/**
 * Une poignée sur un morceau de l'énoncé.
 *
 * La clef est celle que l'énoncé emploie déjà — le nom de l'entité, l'index de
 * la prémisse, `A→B` pour une arête. C'est ce qui permet au schéma d'allumer le
 * bon élément sans qu'on ait à dupliquer l'énoncé dans la trace.
 */
export interface Ref {
  sorte: SorteRef;
  clef: string;
}

export const ref = (sorte: SorteRef, clef: string | number): Ref => ({
  sorte,
  clef: String(clef),
});

/**
 * Les erreurs types qu'un distracteur incarne.
 *
 * Nommer l'erreur plutôt que de dire « faux » change la correction : on peut
 * commencer par « vous avez pris la relation inverse », ce qui désigne le geste
 * à corriger. `non-etiquete` existe pour les réponses libres qui ne
 * correspondent à aucun distracteur : la correction passe alors directement au
 * raisonnement juste.
 */
export type EtiquetteErreur =
  | 'relation-inverse'
  | 'transitivite-abusive'
  | 'leurre-de-surface'
  | 'option-redondante'
  | 'option-oubliee'
  | 'axe-permute'
  | 'quantificateur-affaibli'
  | 'cycle-ignore'
  | 'hors-zone'
  | 'non-etiquete';

/** Ce que la correction dit en préambule, selon l'erreur commise. */
export const DIAGNOSTIC: Record<EtiquetteErreur, string> = {
  'relation-inverse': 'c’est la relation inverse de celle qui découle des prémisses',
  'transitivite-abusive': 'cette relation n’est pas transitive : on ne peut pas enchaîner',
  'leurre-de-surface': 'cette option ressemble à la bonne, mais elle n’en garde pas la structure',
  'option-redondante': 'cette option est déjà impliquée par une autre : elle est en trop',
  'option-oubliee': 'cette option était possible, et elle manquait à votre sélection',
  'axe-permute': 'les deux axes ont été échangés en route',
  'quantificateur-affaibli': 'le quantificateur a été affaibli : « certains » ne donne pas « tous »',
  'cycle-ignore': 'le cycle a été parcouru comme un ordre, alors qu’il revient sur lui-même',
  'hors-zone': 'cette position est exclue par ce que les prémisses établissent déjà',
  'non-etiquete': '',
};

/**
 * Une étape de raisonnement.
 *
 * `produit` est déjà en français, parce que c'est le solveur qui sait nommer ce
 * qu'il vient d'établir ; `legende` est la phrase affichée sous le schéma ; et
 * `surbrillance` dit ce que le schéma allume à cette étape — ce qui est souvent
 * plus que `utilise`, car on garde visible ce qui a servi aux étapes passées.
 */
export interface Etape {
  rang: number;
  utilise: Ref[];
  produit: string;
  /** « composition », « transitivité », « conversion », « contraposée »… */
  loi?: string;
  legende: string;
  surbrillance: Ref[];
}

/**
 * La conclusion, dans la forme même de la réponse de l'item.
 *
 * C'est délibérément le décalque de `Reponse` : la comparaison avec la bonne
 * réponse doit être une égalité, pas une interprétation.
 */
export type Conclusion =
  | { genre: 'unique'; indice: number }
  | { genre: 'multiple'; indices: number[] }
  | { genre: 'appariement'; paires: Record<string, string> };

export interface TraceResolution {
  etapes: Etape[];
  /** Prémisses, arêtes et nœuds réellement mobilisés. */
  elementsUtiles: Ref[];
  /** Les distracteurs de l'énoncé, à signaler comme inutiles à la déduction. */
  elementsInutiles: Ref[];
  conclusion: Conclusion;
}

/**
 * Le carnet que le solveur tient pendant qu'il calcule.
 *
 * Le solveur ne construit donc pas une trace *après* avoir trouvé la réponse :
 * il la dépose en chemin, et `sceller` refuse une conclusion qui ne serait pas
 * celle de la dernière étape déposée. C'est ce qui rend la divergence
 * impossible par construction, et non seulement improbable.
 */
export interface Journal {
  etape(etape: Omit<Etape, 'rang'>): void;
  utile(...refs: Ref[]): void;
  inutile(...refs: Ref[]): void;
  /** Le nombre d'étapes déjà déposées — pratique pour les légendes. */
  readonly rang: number;
  sceller(conclusion: Conclusion): TraceResolution;
}

export function journal(): Journal {
  const etapes: Etape[] = [];
  const utiles = new Map<string, Ref>();
  const inutiles = new Map<string, Ref>();
  const clef = (r: Ref) => `${r.sorte}:${r.clef}`;

  return {
    get rang() {
      return etapes.length;
    },
    etape(etape) {
      etapes.push({ ...etape, rang: etapes.length + 1 });
      for (const r of etape.utilise) utiles.set(clef(r), r);
    },
    utile(...refs) {
      for (const r of refs) utiles.set(clef(r), r);
    },
    inutile(...refs) {
      for (const r of refs) inutiles.set(clef(r), r);
    },
    sceller(conclusion) {
      if (etapes.length === 0) {
        throw new Error('trace scellée sans aucune étape : le solveur n’a rien déposé');
      }
      // Un élément ne peut pas être à la fois utile et inutile : s'il a servi,
      // il a servi, et le dire inutile tromperait la personne.
      for (const c of utiles.keys()) inutiles.delete(c);
      return {
        etapes,
        elementsUtiles: [...utiles.values()],
        elementsInutiles: [...inutiles.values()],
        conclusion,
      };
    },
  };
}

/** Deux conclusions sont-elles la même ? */
export function memeConclusion(a: Conclusion, b: Conclusion): boolean {
  if (a.genre !== b.genre) return false;
  if (a.genre === 'unique' && b.genre === 'unique') return a.indice === b.indice;
  if (a.genre === 'multiple' && b.genre === 'multiple') {
    const x = [...a.indices].sort((p, q) => p - q);
    const y = [...b.indices].sort((p, q) => p - q);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  if (a.genre === 'appariement' && b.genre === 'appariement') {
    const ca = Object.keys(a.paires);
    const cb = Object.keys(b.paires);
    return ca.length === cb.length && ca.every((k) => a.paires[k] === b.paires[k]);
  }
  return false;
}

/** La conclusion que la trace devrait porter, lue sur la réponse de l'item. */
export function conclusionAttendue(reponse: {
  genre: string;
  bonne?: number;
  bonnes?: number[];
  paires?: Record<string, string>;
}): Conclusion | null {
  if (reponse.genre === 'unique' && typeof reponse.bonne === 'number') {
    return { genre: 'unique', indice: reponse.bonne };
  }
  if (reponse.genre === 'multiple' && Array.isArray(reponse.bonnes)) {
    return { genre: 'multiple', indices: reponse.bonnes };
  }
  if (reponse.genre === 'appariement' && reponse.paires) {
    return { genre: 'appariement', paires: reponse.paires };
  }
  return null;
}

/**
 * Les défauts d'une trace, en français, ou un tableau vide.
 *
 * Sert aux essais automatiques et, en développement, à refuser une trace
 * incohérente plutôt qu'à l'afficher.
 */
export function defautsDeLaTrace(
  trace: TraceResolution,
  reponse: Parameters<typeof conclusionAttendue>[0],
): string[] {
  const defauts: string[] = [];
  const attendue = conclusionAttendue(reponse);

  if (!attendue) {
    defauts.push('la réponse de l’item n’a pas de conclusion comparable');
  } else if (!memeConclusion(trace.conclusion, attendue)) {
    defauts.push('la conclusion de la trace n’est pas la bonne réponse de l’item');
  }

  if (trace.etapes.length === 0) defauts.push('trace sans étape');

  trace.etapes.forEach((etape, i) => {
    if (etape.rang !== i + 1) defauts.push(`étape ${i + 1} : rang incohérent (${etape.rang})`);
    if (!etape.legende.trim()) defauts.push(`étape ${etape.rang} : légende vide`);
    if (!etape.produit.trim()) defauts.push(`étape ${etape.rang} : rien de produit`);
  });

  const clef = (r: Ref) => `${r.sorte}:${r.clef}`;
  const utiles = new Set(trace.elementsUtiles.map(clef));
  for (const r of trace.elementsInutiles) {
    if (utiles.has(clef(r))) {
      defauts.push(`${clef(r)} est donné à la fois utile et inutile`);
    }
  }
  for (const etape of trace.etapes) {
    for (const r of etape.utilise) {
      if (!utiles.has(clef(r))) {
        defauts.push(`étape ${etape.rang} : ${clef(r)} utilisé mais absent des éléments utiles`);
      }
    }
  }

  return defauts;
}
