/**
 * Mise en forme d'une instance : phrases françaises et blocs d'affichage.
 *
 * Aucun moteur ne fabrique lui-même ses phrases : elles sortent toutes d'ici,
 * pour qu'un système qui change de vocabulaire n'oblige pas à retoucher trente
 * générateurs.
 */
import type { Bloc } from '../moteurs/types';
import type { Fait, Instance, Systeme } from '../systemes/types';

/** « A est à l'est de B ». */
export function phrase(systeme: Systeme, fait: Fait): string {
  const relation = systeme.relations.find((r) => r.id === fait.relation);
  return `${fait.sujet} ${relation?.libelle ?? fait.relation} ${fait.objet}.`;
}

export function phrases(systeme: Systeme, faits: readonly Fait[]): string[] {
  return faits.map((fait) => phrase(systeme, fait));
}

/**
 * « que » ou « qu’ », selon l'initiale de ce qui suit.
 *
 * Les gabarits de correction enchâssent des propositions dont on ne connaît pas
 * l'initiale à l'écriture — elle dépend de l'item. Sans élision, on obtient
 * « exige que au moins un membre soit vrai », qu'aucun lecteur francophone ne
 * laisse passer.
 */
export const que = (clause: string) =>
  /^[aeiouyàâéèêëîïôöûüh]/i.test(clause) ? `qu’${clause}` : `que ${clause}`;

/** Le libellé d'une relation, ou son identifiant à défaut. */
export function libelle(systeme: Systeme, relation: string): string {
  return systeme.relations.find((r) => r.id === relation)?.libelle ?? relation;
}

/** Le libellé sans le « est » initial : « à l'est de ». */
export function libelleNu(systeme: Systeme, relation: string): string {
  return libelle(systeme, relation).replace(/^(est|occupe) /, '');
}

/** Les faits énoncés, en phrases. */
export function blocFaits(systeme: Systeme, faits: readonly Fait[]): Bloc {
  return { type: 'faits', phrases: phrases(systeme, faits) };
}

/**
 * Le dessin d'un modèle : une grille pour les systèmes-produits à deux axes ou
 * plus, un graphe sinon.
 *
 * Les systèmes à un seul axe passent aussi par la grille : une ligne de cases
 * se lit mieux qu'un graphe en chaîne.
 */
export function blocModele(systeme: Systeme, instance: Instance, souligne?: string[]): Bloc {
  const coordonnees = instance.modele?.coordonnees;
  if (systeme.axes && coordonnees) {
    return {
      type: 'grille',
      axes: systeme.axes,
      points: instance.entites.map((etiquette) => ({
        etiquette,
        coord: coordonnees[etiquette] ?? systeme.axes!.map(() => 0),
      })),
      souligne,
    };
  }
  return blocGraphe(systeme, instance);
}

/**
 * Le réseau **complet** d'une instance : toutes les paires, et non les seuls
 * faits énoncés. C'est ce qu'il faut montrer quand l'exercice porte sur la
 * structure entière — apparier deux réseaux, en reconnaître un isomorphe.
 */
export function blocGraphe(systeme: Systeme, instance: Instance, manquante?: { de: string; a: string }): Bloc {
  const aretes: { de: string; a: string; libelle: string; sorte?: 'positif' | 'negatif' }[] = [];
  const modele = instance.modele;
  const vues = new Set<string>();

  for (const a of instance.entites) {
    for (const b of instance.entites) {
      if (a === b) continue;
      // Une relation symétrique ne se trace qu'une fois.
      const relation = modele
        ? systeme.relationDansModele(modele, a, b)
        : instance.faits.find((f) => f.sujet === a && f.objet === b)?.relation;
      if (!relation) continue;
      const symetrique = systeme.converse(relation) === relation;
      const clef = symetrique ? [a, b].sort().join('|') : `${a}|${b}`;
      if (vues.has(clef)) continue;
      vues.add(clef);
      const meta = systeme.relations.find((r) => r.id === relation);
      aretes.push({
        de: a,
        a: b,
        libelle: meta?.bref ?? relation,
        sorte: meta?.algebre === 'opposition' ? 'negatif' : 'positif',
      });
    }
  }

  return { type: 'graphe', noeuds: instance.entites, aretes, manquante };
}

/**
 * La matrice complète des relations : une ligne et une colonne par entité.
 *
 * C'est la présentation qui convient aux structures denses — un ordre total sur
 * cinq entités compte dix arêtes, illisibles en graphe — et celle qui cache le
 * mieux la disposition, puisqu'elle n'en a aucune. Relational Web s'en sert pour
 * cette raison : le cahier des charges demande que la position des nœuds ne
 * donne aucun indice.
 */
export function blocMatrice(systeme: Systeme, instance: Instance): Bloc {
  const modele = instance.modele;
  const bref = (relation: string) =>
    systeme.relations.find((r) => r.id === relation)?.bref ?? relation;

  return {
    type: 'tableau',
    entetes: ['', ...instance.entites],
    lignes: instance.entites.map((a) => [
      a,
      ...instance.entites.map((b) => {
        if (a === b) return '·';
        const relation = modele
          ? systeme.relationDansModele(modele, a, b)
          : instance.faits.find((f) => f.sujet === a && f.objet === b)?.relation;
        return relation ? bref(relation) : '?';
      }),
    ]),
  };
}

/** Un bloc de texte, pour les consignes intercalées. */
export function texte(contenu: string): Bloc {
  return { type: 'texte', texte: contenu };
}

/**
 * La négation de surface est-elle univoque sur ce système ?
 *
 * « A n'est pas après B » ne désigne une relation que si le vocabulaire en
 * compte **exactement deux**, exclusives et exhaustives : nier l'une revient
 * alors à affirmer l'autre. Dès trois relations la négation cesse de trancher —
 * « A n'est pas plus grand que B » laisse ouvert entre « plus petit » et « à la
 * même place ».
 *
 * Deux conditions, donc, et la seconde n'est pas cosmétique. Le libellé du
 * complément doit commencer par « est », sans quoi la phrase niée se brise :
 * « A n'est pas **précède** B ». C'est la même faute que celle relevée sur
 * l'analogie inter-systèmes, et la règle évite de la refaire.
 *
 * L'exhaustivité, elle, n'est pas testable depuis la seule déclaration : elle
 * est vérifiée par `essais:relationnel`, qui exige de tout système à deux
 * relations que toute paire distincte en porte une. Un système à deux relations
 * qui admettrait un troisième état y serait pris, au lieu de rendre des
 * prémisses ambiguës en séance.
 */
export function negationUnivoque(systeme: Systeme): boolean {
  if (systeme.relations.length !== 2) return false;
  return systeme.relations.every((relation) => /^est /.test(relation.libelle));
}

/** L'autre relation, sur un système à deux. */
export function complement(systeme: Systeme, relation: string): string | null {
  if (!negationUnivoque(systeme)) return null;
  return systeme.relations.find((autre) => autre.id !== relation)?.id ?? null;
}

/** « A n'est pas après B. » — l'affirmation dite par la négation de l'autre. */
export function phraseNiee(systeme: Systeme, fait: Fait): string | null {
  const autre = complement(systeme, fait.relation);
  if (!autre) return null;
  return `${fait.sujet} n’est pas ${libelleNu(systeme, autre)} ${fait.objet}.`;
}
