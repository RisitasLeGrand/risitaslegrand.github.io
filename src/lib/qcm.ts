/**
 * Moteur des sessions « QCM - DGFiP ».
 *
 * Une session reproduit les conditions de l'épreuve : un nombre fixe de
 * questions réparties entre les rubriques, un barème qui sanctionne l'erreur
 * plus qu'il ne récompense le hasard, et donc la possibilité de ne pas
 * répondre. Le tirage, lui, ne reproduit pas l'épreuve : il s'appuie sur
 * l'historique local pour ramener plus souvent ce qui est mal su.
 */
import type { BanqueDgfip, QuestionDgfip, RubriqueDgfip } from './contenu';
import type { EtatQuestionDgfip, ScoreRubriqueDgfip } from './db';
import { ecartJours, jourISO } from './db';
import { melanger } from './ui';

/** Nombre de questions d'une session complète, comme à l'épreuve. */
export const TAILLE_SESSION = 54;

/** Barème officiel : le hasard a un coût, l'abstention n'en a pas. */
export const BAREME = { bonne: 1, mauvaise: -0.5, abstention: 0 } as const;

export type Issue = 'bonne' | 'mauvaise' | 'abstention';

export interface QuestionTiree extends QuestionDgfip {
  /** Ordre d'affichage mélangé des options. */
  ordre: number[];
}

export interface ReponseSession {
  question: QuestionTiree;
  /** Indices choisis, dans l'ordre des options d'origine. Vide = abstention. */
  choisis: number[];
  issue: Issue;
}

/**
 * Répartit « total » questions entre les rubriques, au prorata de ce que
 * chacune contient, sans jamais demander plus de questions qu'il n'en existe.
 *
 * Sur quatre rubriques de taille comparable et 54 questions, cela donne
 * 14/14/13/13 — la répartition observée dans les annales, où chaque rubrique
 * compte 13 ou 14 questions.
 */
export function repartir(rubriques: RubriqueDgfip[], total = TAILLE_SESSION): Map<string, number> {
  const quota = new Map<string, number>();
  const disponibles = rubriques.filter((r) => r.total > 0);
  if (!disponibles.length) return quota;

  const capacite = disponibles.reduce((n, r) => n + r.total, 0);
  const vise = Math.min(total, capacite);

  // Premier tour : part entière égale pour toutes, plafonnée par le stock.
  let restant = vise;
  const part = Math.floor(vise / disponibles.length);
  for (const r of disponibles) {
    const n = Math.min(part, r.total);
    quota.set(r.id, n);
    restant -= n;
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

/**
 * Poids d'une question dans le tirage. Jamais nul : même une question sue
 * doit pouvoir retomber, sans quoi les sessions finiraient par se répéter à
 * l'identique sur le résidu mal maîtrisé.
 */
function poids(etat: EtatQuestionDgfip | undefined, aujourdhui: string): number {
  if (!etat || etat.vues === 0) return 3; // jamais posée : priorité haute

  const echecs = (etat.mauvaises + etat.abstentions * 0.5) / etat.vues;
  const fragilite = 0.6 + 3 * echecs; // de 0,6 (toujours juste) à 3,6 (toujours faux)

  // Une question vue hier n'a rien à apprendre aujourd'hui ; deux semaines
  // plus tard, elle a retrouvé tout son intérêt.
  const jours = Math.max(0, ecartJours(etat.derniereLe, aujourdhui));
  const fraicheur = Math.min(1, 0.2 + jours / 14);

  return Math.max(0.15, fragilite * fraicheur);
}

/** Tirage sans remise, proportionnel aux poids. */
function tirerPonderé<T>(candidats: { valeur: T; poids: number }[], combien: number): T[] {
  const restants = [...candidats];
  const tires: T[] = [];
  while (tires.length < combien && restants.length) {
    const somme = restants.reduce((n, c) => n + c.poids, 0);
    let seuil = Math.random() * somme;
    let index = restants.length - 1;
    for (let i = 0; i < restants.length; i += 1) {
      seuil -= restants[i].poids;
      if (seuil <= 0) {
        index = i;
        break;
      }
    }
    tires.push(restants[index].valeur);
    restants.splice(index, 1);
  }
  return tires;
}

/**
 * Compose une session : le quota de chaque rubrique, tiré parmi ses questions
 * en tenant compte de l'historique, puis l'ensemble mélangé pour que les
 * rubriques s'entremêlent comme à l'épreuve.
 */
export function composerSession(
  banque: BanqueDgfip,
  historique: EtatQuestionDgfip[],
  total = TAILLE_SESSION,
): QuestionTiree[] {
  const parId = new Map(historique.map((e) => [e.id, e]));
  const aujourdhui = jourISO();
  const quota = repartir(banque.rubriques, total);

  const retenues: QuestionDgfip[] = [];
  for (const [rubriqueId, combien] of quota) {
    if (combien <= 0) continue;
    const candidats = banque.questions
      .filter((q) => q.rubriqueId === rubriqueId)
      .map((q) => ({ valeur: q, poids: poids(parId.get(q.id), aujourdhui) }));
    retenues.push(...tirerPonderé(candidats, combien));
  }

  return melanger(retenues).map((q) => ({
    ...q,
    ordre: melanger(q.options.map((_, i) => i)),
  }));
}

/** Une réponse est bonne si elle désigne exactement les bonnes options. */
export function evaluer(question: QuestionDgfip, choisis: number[]): Issue {
  if (!choisis.length) return 'abstention';
  const attendues = [...question.bonnes].sort((a, b) => a - b);
  const donnees = [...new Set(choisis)].sort((a, b) => a - b);
  const juste =
    attendues.length === donnees.length && attendues.every((v, i) => v === donnees[i]);
  return juste ? 'bonne' : 'mauvaise';
}

export function points(issue: Issue): number {
  return BAREME[issue];
}

/** Score global et détail par rubrique, à partir des réponses de la session. */
export function noter(reponses: ReponseSession[], rubriques: RubriqueDgfip[]) {
  const parRubrique = new Map<string, ScoreRubriqueDgfip>();
  let total = 0;

  for (const r of reponses) {
    const cle = r.question.rubriqueId;
    const ligne =
      parRubrique.get(cle) ??
      {
        rubriqueId: cle,
        rubrique: r.question.rubrique,
        posees: 0,
        bonnes: 0,
        mauvaises: 0,
        abstentions: 0,
        points: 0,
      };
    ligne.posees += 1;
    if (r.issue === 'bonne') ligne.bonnes += 1;
    else if (r.issue === 'mauvaise') ligne.mauvaises += 1;
    else ligne.abstentions += 1;
    ligne.points += points(r.issue);
    parRubrique.set(cle, ligne);
    total += points(r.issue);
  }

  const ordre = new Map(rubriques.map((r, i) => [r.id, i]));
  const lignes = [...parRubrique.values()].sort(
    (a, b) => (ordre.get(a.rubriqueId) ?? 99) - (ordre.get(b.rubriqueId) ?? 99),
  );

  return {
    points: Math.round(total * 2) / 2,
    maximum: reponses.length,
    posees: reponses.length,
    bonnes: reponses.filter((r) => r.issue === 'bonne').length,
    mauvaises: reponses.filter((r) => r.issue === 'mauvaise').length,
    abstentions: reponses.filter((r) => r.issue === 'abstention').length,
    parRubrique: lignes,
  };
}

/** « 12,5 » plutôt que « 12.5 », et « −3 » plutôt que « -3 ». */
export function formaterPoints(valeur: number): string {
  const arrondi = Math.round(valeur * 2) / 2;
  const texte = Number.isInteger(arrondi)
    ? String(arrondi)
    : arrondi.toFixed(1).replace('.', ',');
  return texte.replace('-', '−');
}
