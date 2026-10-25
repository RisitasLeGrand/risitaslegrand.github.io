/**
 * L'épreuve DGFiP laissée en cours : sa forme, et la décision de la reprendre
 * ou non (C3 du prompt 43).
 *
 * ## Pourquoi un module pur, et séparé de la base
 *
 * Ce qu'il y a de délicat dans « Garder pour plus tard » n'est pas d'écrire
 * l'enregistrement : c'est de décider, à la reprise, si ce qu'on a gardé a
 * encore un sens. La banque de questions bouge — une question est retirée d'un
 * parcours, une autre disparaît d'une banque rechargée. Recomposer alors une
 * épreuve **différente** sous le même nom donnerait une note sur un sujet que
 * la personne n'a pas commencé.
 *
 * Cette décision se prend sans navigateur, sans base et sans coffre : elle est
 * ici, et les deux cas que le pilote demande — question retirée, question
 * absente — s'éprouvent en trois lignes.
 *
 * ## Ce que l'enregistrement porte, et ce qu'il ne porte pas
 *
 * Des **identifiants**, et non les énoncés : la banque les recompose, et
 * recopier les questions ferait une seconde source qui dériverait de la
 * première. Mais aussi l'**ordre des propositions** de chaque question, qui
 * est tiré au sort à la composition. Sans lui, reprendre l'épreuve la
 * remélangerait : mêmes questions, autre écran, et des cases cochées qui
 * sembleraient avoir bougé toutes seules. « Reprendre exactement où l'on
 * était » tombe sur ce détail-là.
 *
 * C'est une pièce que ma première description au pilote ne portait pas ; je
 * l'ai trouvée en lisant `composerSession`, et elle est signalée comme telle.
 */
import type { QuestionDgfip } from '../contenu';

/** La clé de l'unique enregistrement : on ne garde qu'une épreuve à la fois. */
export const CLE_EPREUVE_EN_COURS = 'courante';

export interface EpreuveEnCours {
  /** Toujours `CLE_EPREUVE_EN_COURS` : le magasin n'en porte qu'une. */
  id: string;
  /** Quand l'épreuve a été commencée. C'est le `CHAMP_DATE` du magasin. */
  le: string;
  /** Quand elle a été gardée pour plus tard. */
  majLe: string;
  /** Le format choisi, pour le dire à la reprise. */
  formatId: string;
  /** Le parcours courant au moment du tirage. */
  parcoursId: string;
  /** Les questions tirées, dans l'ordre de l'épreuve. */
  questionIds: readonly string[];
  /** L'ordre d'affichage des propositions, une liste par question. */
  ordres: readonly (readonly number[])[];
  /** Les réponses données, indices dans l'ordre d'origine des options. */
  choix: readonly (readonly number[])[];
  /** Où l'on s'était arrêté. */
  position: number;
}

/**
 * Pourquoi une épreuve gardée ne peut pas être reprise.
 *
 * `null` quand elle le peut. Les deux motifs ne se confondent pas, et c'est
 * voulu : l'un dit que la banque ne connaît plus la question, l'autre qu'elle
 * la connaît mais ne la sert plus à ce parcours. La personne n'a pas à faire
 * la différence ; l'essai, si.
 */
export type RefusDeReprise = 'question-absente' | 'question-retiree' | 'forme-illisible';

/**
 * L'épreuve gardée peut-elle être reprise avec cette banque ?
 *
 * `servables` est l'ensemble des questions que la banque sert **aujourd'hui à
 * ce parcours** — c'est l'écran qui le calcule, avec la même fonction qui
 * compose une épreuve neuve, pour que les deux ne puissent pas diverger.
 */
export function refusDeReprise(
  epreuve: EpreuveEnCours | null | undefined,
  connues: ReadonlySet<string>,
  servables: ReadonlySet<string>,
): RefusDeReprise | null {
  if (!estLisible(epreuve)) return 'forme-illisible';
  for (const id of epreuve.questionIds) {
    if (!connues.has(id)) return 'question-absente';
    if (!servables.has(id)) return 'question-retiree';
  }
  return null;
}

/**
 * La forme tient-elle debout ?
 *
 * L'enregistrement vient de la base, donc d'une version peut-être antérieure :
 * il est traité comme une entrée inconnue. Une forme qui ne tient pas n'est
 * pas une erreur à afficher — c'est une épreuve qu'on ne peut pas reprendre,
 * et le même message le dit.
 */
export function estLisible(epreuve: unknown): epreuve is EpreuveEnCours {
  if (!epreuve || typeof epreuve !== 'object') return false;
  const e = epreuve as Partial<EpreuveEnCours>;
  if (typeof e.formatId !== 'string' || typeof e.position !== 'number') return false;
  if (!Array.isArray(e.questionIds) || !e.questionIds.length) return false;
  if (!Array.isArray(e.ordres) || !Array.isArray(e.choix)) return false;
  if (e.ordres.length !== e.questionIds.length) return false;
  if (e.choix.length !== e.questionIds.length) return false;
  if (e.position < 0 || e.position >= e.questionIds.length) return false;
  return (
    e.questionIds.every((id) => typeof id === 'string') &&
    e.ordres.every((o) => Array.isArray(o) && o.every((n) => typeof n === 'number')) &&
    e.choix.every((c) => Array.isArray(c) && c.every((n) => typeof n === 'number'))
  );
}

/**
 * Remet les questions dans l'ordre de l'épreuve gardée.
 *
 * Rend `null` dès qu'une manque : la reprise est tout ou rien, et rendre une
 * épreuve amputée serait précisément le silence que `refusDeReprise` existe
 * pour empêcher.
 */
export function questionsDeLEpreuve<Q extends QuestionDgfip>(
  epreuve: EpreuveEnCours,
  parId: ReadonlyMap<string, Q>,
): (Q & { ordre: number[] })[] | null {
  const sortie: (Q & { ordre: number[] })[] = [];
  for (const [rang, id] of epreuve.questionIds.entries()) {
    const question = parId.get(id);
    if (!question) return null;
    sortie.push({ ...question, ordre: [...epreuve.ordres[rang]] });
  }
  return sortie;
}

/** La phrase du refus, qui ne dit pas « erreur » et propose la suite. */
export const PHRASE_DE_REFUS =
  'Cette épreuve ne peut plus être reprise : la banque de questions a changé depuis que vous l’avez gardée. Vous pouvez en lancer une neuve.';
