/**
 * Prétest — ce qui décide, séparé de ce qui affiche.
 *
 * Le raisonnement du prétest est dans l'en-tête de `pretest.ts`, qui construit
 * le panneau ; ce module ne tient que les décisions : proposer ou non, quelles
 * questions tirer, quelle justesse attribuer, quoi retenir en mémoire.
 *
 * **Pourquoi deux fichiers.** Le panneau touche au DOM et aux liens, donc à la
 * couche d'interface, qui a besoin de la base d'URL de Vite. Ce noyau n'en a
 * pas besoin, et le garder à l'écart le rend éprouvable hors navigateur — or
 * c'est exactement la partie qui doit l'être : un tirage qui cesse de
 * privilégier les questions inédites, ou une justesse qui retombe en tout ou
 * rien, ne produit aucune erreur visible. Il produit, quelques semaines plus
 * tard, une orientation fausse que rien ne relie à sa cause.
 */
import type { Fiche, QuestionQuiz } from './contenu';
import { ecrireEtatFiche, jourISO, lireEtatFiche } from './db';

export type Issue = 'tente' | 'passe';

/**
 * Combien de questions poser à la fois.
 *
 * Assez pour amorcer la lecture, trop peu pour ressembler à un examen d'entrée.
 * Le reste du vivier attend un éventuel second passage.
 */
export const QUESTIONS_PAR_PRETEST = 3;

/** La fiche propose-t-elle un prétest ? */
export function aPretest(fiche: Pick<Fiche, 'pretest'>): boolean {
  return (fiche.pretest?.length ?? 0) > 0;
}

/**
 * Le prétest de cette fiche doit-il être proposé maintenant ?
 *
 * Non s'il a déjà été tenté, non s'il a été passé aujourd'hui, non si la fiche
 * a déjà été lue — après la lecture, il n'y a plus de « pré ».
 */
export async function aProposer(fiche: Pick<Fiche, 'id' | 'pretest'>): Promise<boolean> {
  if (!aPretest(fiche)) return false;
  const etat = await lireEtatFiche(fiche.id);
  if (!etat) return true;
  if (etat.lu || etat.pretesteeLe) return false;
  return etat.pretestPasseLe !== jourISO();
}

/** Mélange une liste sans la modifier. Fonction pure, hasard mis à part. */
export function melanger<T>(liste: readonly T[]): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/**
 * Sépare un vivier en questions jamais servies et questions revues, chaque
 * groupe mélangé.
 *
 * La séparation est exposée, et non enfouie dans `tirer`, parce que la priorité
 * de fraîcheur est **absolue** : aucun autre critère ne doit pouvoir faire
 * passer une question déjà corrigée devant une question inédite. Un appelant
 * qui veut appliquer son propre ordre — le positionnement trie par zone
 * proximale — le fait donc à l'intérieur de chaque groupe, jamais sur le tout.
 */
export function parFraicheur(
  questions: readonly QuestionQuiz[],
  dejaVues: readonly string[] = [],
): { inedites: QuestionQuiz[]; revues: QuestionQuiz[] } {
  const vues = new Set(dejaVues);
  return {
    inedites: melanger(questions.filter((q) => !vues.has(q.id))),
    revues: melanger(questions.filter((q) => vues.has(q.id))),
  };
}

/**
 * Tire les questions à poser : d'abord celles jamais servies, puis, s'il en
 * manque, les moins récemment servies — au hasard dans chaque groupe.
 */
export function tirer(
  questions: readonly QuestionQuiz[],
  dejaVues: readonly string[] = [],
  combien = QUESTIONS_PAR_PRETEST,
): QuestionQuiz[] {
  const { inedites, revues } = parFraicheur(questions, dejaVues);
  return [...inedites, ...revues].slice(0, combien);
}

/**
 * Part de justesse d'une réponse, de 0 à 1.
 *
 * Pour une question à réponse unique, c'est 1 ou 0. Pour une question à
 * réponses multiples, c'est le recouvrement entre ce qui a été coché et ce
 * qu'il fallait cocher — autrement dit la taille de l'intersection divisée par
 * celle de l'union. Deux bonnes sur trois sans erreur donnent donc 0,67, et
 * deux bonnes plus une fausse 0,5.
 *
 * Le tout ou rien aurait été plus simple, mais il rangerait « presque juste »
 * avec « complètement à côté », et c'est exactement la distinction qu'une note
 * d'entrée doit saisir.
 */
export function justesse(
  question: Pick<QuestionQuiz, 'bonnes'>,
  choisies: ReadonlySet<number>,
): number {
  if (!choisies.size) return 0;
  const bonnes = new Set(question.bonnes);
  let communes = 0;
  for (const i of choisies) if (bonnes.has(i)) communes += 1;
  const union = bonnes.size + choisies.size - communes;
  return union ? communes / union : 0;
}

async function etaler(
  fiche: Pick<Fiche, 'id' | 'matiere'>,
  servies: readonly string[],
  marque: Record<string, string>,
): Promise<void> {
  const etat = await lireEtatFiche(fiche.id);
  // L'étalement d'abord, pour ne rien effacer de ce que ce module ignore.
  await ecrireEtatFiche({
    ...etat,
    id: fiche.id,
    matiere: fiche.matiere,
    lu: etat?.lu ?? false,
    derniereOuverture: etat?.derniereOuverture ?? new Date().toISOString(),
    secondes: etat?.secondes ?? 0,
    // Les questions servies sont retenues quelle que soit l'issue : les avoir
    // vues suffit à les user, même sans y répondre.
    pretestVues: [...new Set([...(etat?.pretestVues ?? []), ...servies])],
    ...marque,
  });
}

/** Consigne l'issue du prétest d'une fiche, et les questions qu'il a servies. */
export async function enregistrerIssue(
  fiche: Pick<Fiche, 'id' | 'matiere'>,
  issue: Issue,
  servies: readonly string[] = [],
): Promise<void> {
  await etaler(
    fiche,
    servies,
    issue === 'tente' ? { pretesteeLe: new Date().toISOString() } : { pretestPasseLe: jourISO() },
  );
}

/**
 * Retient des questions servies **sans consommer** le prétest de la fiche.
 *
 * C'est ce dont a besoin le prétest de positionnement, qui pioche une question
 * dans le vivier de plusieurs fiches sans pour autant les prétester : la fiche
 * garde son propre prétest, simplement amputé des questions déjà vues — ce que
 * le vivier est précisément là pour permettre.
 */
export async function memoriserServies(
  fiche: Pick<Fiche, 'id' | 'matiere'>,
  servies: readonly string[],
): Promise<void> {
  await etaler(fiche, servies, {});
}
