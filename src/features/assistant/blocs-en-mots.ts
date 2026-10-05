/**
 * Un énoncé de Relational Reasoning, mis en mots.
 *
 * ## Pourquoi cette pièce n'existait pas
 *
 * Un item relationnel s'affiche en `Bloc` : du texte, des faits déjà en
 * français, mais aussi une grille de coordonnées, un graphe d'arêtes
 * étiquetées, un tableau. Ces trois-là sont des **structures**, lues par l'œil
 * et non par la phrase — c'est tout l'intérêt de l'exercice. Elles n'ont donc
 * jamais eu de rendu textuel, et il en faut un ici : un assistant à qui l'on
 * colle « [object Object] » ne peut rien faire, et l'omettre poserait une
 * question sans énoncé.
 *
 * ## Ce que la conversion ne prétend pas faire
 *
 * Elle ne reconstitue pas le dessin : elle en **énumère le contenu**, dans
 * l'ordre où il est posé. Un graphe devient la liste de ses arêtes, une grille
 * la liste de ses points. C'est verbeux, et c'est exact. Chercher une tournure
 * plus élégante demanderait d'interpréter la structure — de dire « A est au
 * nord-est de B » là où le système ne définit peut-être pas de nord — et une
 * interprétation fausse vaut moins qu'une énumération juste.
 */
import type { Bloc, Reponse } from '../relational-reasoning/moteurs/types';
import type { Donnee } from '../relational-reasoning/noyaux/notation';

/** L'arête manquante se dit, puisqu'elle est la question. */
function arete(a: { de: string; a: string; libelle: string; sorte?: string }): string {
  const negation = a.sorte === 'negatif' ? 'n’est pas ' : '';
  return `${a.de} ${negation}${a.libelle} ${a.a}`;
}

export function blocEnMots(bloc: Bloc): string {
  switch (bloc.type) {
    case 'texte':
      return bloc.texte;
    case 'faits':
      return bloc.phrases.map((p) => `- ${p}`).join('\n');
    case 'grille': {
      const axes = bloc.axes.map((a) => a.libelle).join(', ');
      const points = bloc.points
        .map((p) => {
          const coords = p.coord
            .map((c, i) => `${bloc.axes[i]?.libelle ?? `axe ${i + 1}`} ${c}`)
            .join(', ');
          const marque = bloc.souligne?.includes(p.etiquette) ? ' (entité interrogée)' : '';
          return `- ${p.etiquette} : ${coords}${marque}`;
        })
        .join('\n');
      return `Positions sur les axes ${axes} :\n${points}`;
    }
    case 'graphe': {
      const liens = bloc.aretes.map((a) => `- ${arete(a)}`).join('\n');
      const manquante = bloc.manquante
        ? `\nLa relation à trouver est celle de ${bloc.manquante.de} vers ${bloc.manquante.a}.`
        : '';
      return `Entités : ${bloc.noeuds.join(', ')}.\nRelations données :\n${liens}${manquante}`;
    }
    case 'tableau': {
      const entetes = `| ${bloc.entetes.join(' | ')} |`;
      const separation = `| ${bloc.entetes.map(() => '---').join(' | ')} |`;
      const lignes = bloc.lignes.map((l) => `| ${l.join(' | ')} |`).join('\n');
      return [entetes, separation, lignes].join('\n');
    }
    default:
      // Un type de bloc ajouté plus tard : on ne jette pas, et on le dit.
      return '[élément d’énoncé non convertible en texte]';
  }
}

export function enonceEnMots(blocs: readonly Bloc[]): string {
  return blocs.map(blocEnMots).join('\n\n');
}

/**
 * Une réponse de Relational Reasoning, en mots.
 *
 * Les options portent soit du texte, soit des blocs ; une option purement
 * graphique — une grille, un graphe — n'a pas de libellé, et le prompt dirait
 * alors « j'ai répondu : », suivi de rien. On convertit donc ses blocs, comme
 * l'énoncé.
 */
export function optionEnMots(option: { texte?: string; blocs?: readonly Bloc[] }): string {
  if (option.texte) return option.texte;
  if (option.blocs?.length) return enonceEnMots(option.blocs);
  return '(option sans libellé)';
}

export function reponseEnMots(reponse: Reponse, donnee: Donnee | null): {
  mienne: string;
  bonne: string;
} {
  if (reponse.genre === 'unique') {
    const mienne =
      donnee?.genre === 'unique' && donnee.choix !== null
        ? optionEnMots(reponse.options[donnee.choix])
        : 'rien';
    return { mienne, bonne: optionEnMots(reponse.options[reponse.bonne]) };
  }
  if (reponse.genre === 'multiple') {
    const choisies = donnee?.genre === 'multiple' ? donnee.choix : [];
    const dire = (indices: readonly number[]) =>
      indices.length ? indices.map((i) => optionEnMots(reponse.options[i])).join(' ; ') : 'rien';
    return { mienne: dire(choisies), bonne: dire(reponse.bonnes) };
  }
  const dire = (paires: Record<string, string>) =>
    reponse.gauche.map((g) => `${g} → ${paires[g] ?? '?'}`).join(' ; ');
  return {
    mienne: donnee?.genre === 'appariement' ? dire(donnee.paires) : 'rien',
    bonne: dire(reponse.paires),
  };
}
