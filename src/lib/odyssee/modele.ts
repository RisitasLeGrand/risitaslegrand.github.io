/**
 * Ce qu'Odyssée possède en propre.
 *
 * ## Pourquoi un fichier de types séparé de « db.ts »
 *
 * `db.ts` porte le schéma de Révisions depuis le premier jour, et il fait déjà
 * mille sept cents lignes. Y verser cinq magasins de plus mêlerait deux
 * branches dans le fichier que tout le site importe. Les formes sont donc
 * déclarées ici, dans la branche qui les possède ; `db.ts` ne connaît que leur
 * nom et leurs index, ce qui est le minimum pour ouvrir la base.
 *
 * ## Le vocabulaire, et pourquoi il n'est pas interchangeable
 *
 * | Objet | Ce qui le distingue |
 * |---|---|
 * | **Tâche** | Une chose à faire **une fois**. Elle a une échéance, elle se clôt. |
 * | **Quête** | Une chose à refaire **à chaque jour ou à chaque semaine**. Elle ne se clôt pas, elle se tient ou non. |
 * | **Événement** | Une chose qui occupe un **moment donné**. Elle vient souvent d'un agenda. |
 * | **Focus** | Un **temps mesuré** de concentration, rattaché à un domaine. |
 * | **Revue** | Un **rendez-vous avec soi-même**, hebdomadaire ou plus long. |
 *
 * Confondre tâche et quête serait la première erreur, et elle coûterait cher :
 * une quête close disparaîtrait, une tâche répétée s'accumulerait. Le plancher
 * du jour se calcule sur les quêtes ; l'arriéré, sur les tâches.
 *
 * ## Les dates
 *
 * Un **jour logique** (`AAAA-MM-JJ`) partout où la chose appartient à une
 * journée — une quête tenue, un plancher atteint. Un **instant ISO** partout où
 * elle a une heure — un événement, un focus. Mélanger les deux obligerait
 * chaque lecture à deviner, et le jour logique bascule à 4 h : « hier soir à
 * 2 h » appartient à la veille, et seule la conversion explicite le sait.
 */
import type { IdDomaine } from '../noyau/domaines';

/** L'identité commune : un ULID, et de quoi fusionner. */
export interface Possede {
  id: string;
  /** Instant ISO de la dernière écriture, pour l'affichage — la fusion, elle, lit l'horloge logique. */
  majLe: string;
}

/* ════════════════════════════════════════════════════════════════════════
   Les tâches
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Une tâche.
 *
 * `faiteLe` porte le **jour logique** de la clôture, et `null` tant qu'elle
 * est ouverte. Un booléen aurait suffi à l'affichage et aurait perdu la seule
 * information qui compte ensuite : **quand**. Sans elle, aucun indicateur ne
 * peut dire combien de tâches ont été closes la semaine dernière.
 */
export interface Tache extends Possede {
  titre: string;
  domaine: IdDomaine;
  /** Jour logique d'échéance, ou `null` : une tâche sans date n'est pas en retard. */
  echeance: string | null;
  faiteLe: string | null;
  /** Texte libre, jamais obligatoire. */
  note: string;
  creeeLe: string;
}

/* ════════════════════════════════════════════════════════════════════════
   Les quêtes
   ════════════════════════════════════════════════════════════════════════ */

export type Cadence = 'jour' | 'semaine';

export const CADENCES: readonly Cadence[] = ['jour', 'semaine'];

/**
 * Une quête : ce qu'on se propose de tenir, et non de finir.
 *
 * `tenues` est la liste des jours logiques où elle l'a été — pour une quête
 * hebdomadaire, le jour où la semaine a été validée. Garder la liste plutôt
 * qu'un compteur coûte quelques octets et permet tout le reste : la série, le
 * plancher du jour, la tendance, et la correction d'une erreur de saisie. Un
 * compteur ne se corrige pas, il se croit.
 *
 * `active` plutôt qu'une suppression : une quête qu'on cesse de tenir garde son
 * histoire, et la roue d'équilibre ne doit pas voir un trou là où il y a eu un
 * renoncement assumé.
 */
export interface Quete extends Possede {
  titre: string;
  domaine: IdDomaine;
  cadence: Cadence;
  active: boolean;
  /** Jours logiques où la quête a été tenue, triés, sans doublon. */
  tenues: string[];
  creeeLe: string;
}

/* ════════════════════════════════════════════════════════════════════════
   Les événements
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Un événement d'agenda.
 *
 * `uidIcs` est l'identifiant que porte l'événement dans le fichier dont il
 * vient. Il n'est pas décoratif : réimporter le même agenda doit **mettre à
 * jour** les événements déjà connus, pas les dupliquer. Un événement saisi à
 * la main n'en a pas, et c'est ce qui le protège d'être écrasé par un import.
 */
export interface Evenement extends Possede {
  titre: string;
  domaine: IdDomaine;
  /** Instant ISO de début. */
  debut: string;
  /** Instant ISO de fin. Jamais antérieur au début — « controlerEvenement » le vérifie. */
  fin: string;
  /** Vrai pour un événement qui occupe la journée entière : les heures n'ont alors pas de sens. */
  journeeEntiere: boolean;
  lieu: string;
  note: string;
  uidIcs: string | null;
}

/* ════════════════════════════════════════════════════════════════════════
   Le focus
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Une session de concentration mesurée.
 *
 * `secondes` est le temps **réellement** écoulé, pas la durée visée : un
 * Pomodoro de vingt-cinq minutes interrompu au bout de neuf en vaut neuf.
 * Compter la durée visée gonflerait l'indicateur de temps focus exactement les
 * jours où l'on s'est le moins concentré.
 */
export interface Focus extends Possede {
  domaine: IdDomaine;
  tacheId: string | null;
  debut: string;
  fin: string;
  secondes: number;
  /** Vrai si la session a été arrêtée avant son terme. */
  interrompue: boolean;
}

/* ════════════════════════════════════════════════════════════════════════
   Les revues
   ════════════════════════════════════════════════════════════════════════ */

export type TypeDeRevue = 'soir' | 'semaine' | 'mois' | 'trimestre' | 'annee';

export const TYPES_DE_REVUE: readonly TypeDeRevue[] = [
  'soir',
  'semaine',
  'mois',
  'trimestre',
  'annee',
];

/**
 * Une revue tenue.
 *
 * `reponses` est un dictionnaire libre : les questions d'une revue changeront,
 * et un schéma figé obligerait à migrer l'historique à chaque changement de
 * formulation. Ce qui ne change pas, c'est la **période** couverte.
 */
export interface Revue extends Possede {
  type: TypeDeRevue;
  /** Jour logique de la revue. */
  jour: string;
  reponses: Record<string, string>;
}

/* ════════════════════════════════════════════════════════════════════════
   Les contrôles de forme
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Les contrôles ne rendent pas un booléen mais la liste de ce qui cloche.
 *
 * Un écran qui dit « invalide » n'aide personne. Et ces mêmes messages servent
 * à l'import ICS, où le fichier vient du dehors et où il faut pouvoir dire
 * **quelle ligne** a été écartée, et pourquoi.
 */
export function controlerTache(t: Tache): string[] {
  const problemes: string[] = [];
  if (!t.titre.trim()) problemes.push('Une tâche a besoin d’un titre.');
  if (t.echeance !== null && !/^\d{4}-\d{2}-\d{2}$/.test(t.echeance)) {
    problemes.push('L’échéance doit être un jour au format AAAA-MM-JJ.');
  }
  if (t.faiteLe !== null && !/^\d{4}-\d{2}-\d{2}$/.test(t.faiteLe)) {
    problemes.push('La date de clôture doit être un jour au format AAAA-MM-JJ.');
  }
  return problemes;
}

export function controlerQuete(q: Quete): string[] {
  const problemes: string[] = [];
  if (!q.titre.trim()) problemes.push('Une quête a besoin d’un titre.');
  if (!CADENCES.includes(q.cadence)) problemes.push('La cadence est « jour » ou « semaine ».');
  if (q.tenues.some((j) => !/^\d{4}-\d{2}-\d{2}$/.test(j))) {
    problemes.push('Les jours tenus doivent être au format AAAA-MM-JJ.');
  }
  const uniques = new Set(q.tenues);
  if (uniques.size !== q.tenues.length) {
    problemes.push('Un même jour ne peut être tenu deux fois.');
  }
  return problemes;
}

export function controlerEvenement(e: Evenement): string[] {
  const problemes: string[] = [];
  if (!e.titre.trim()) problemes.push('Un événement a besoin d’un titre.');
  const debut = Date.parse(e.debut);
  const fin = Date.parse(e.fin);
  if (Number.isNaN(debut)) problemes.push('La date de début est illisible.');
  if (Number.isNaN(fin)) problemes.push('La date de fin est illisible.');
  /*
     Fin **avant** début est refusé ; fin **égale** à début ne l'est pas. Un
     agenda exporté note couramment un rappel ou un jalon avec une durée nulle,
     et le refuser ferait perdre à l'import des entrées parfaitement valides.
  */
  if (!Number.isNaN(debut) && !Number.isNaN(fin) && fin < debut) {
    problemes.push('Un événement ne peut pas finir avant d’avoir commencé.');
  }
  return problemes;
}

/** Les secondes qu'occupe un événement. Une journée entière en vaut 24 h. */
export function dureeDeLEvenement(e: Evenement): number {
  if (e.journeeEntiere) return 24 * 3600;
  const debut = Date.parse(e.debut);
  const fin = Date.parse(e.fin);
  if (Number.isNaN(debut) || Number.isNaN(fin)) return 0;
  return Math.max(0, Math.round((fin - debut) / 1000));
}

/**
 * Deux événements se chevauchent-ils ?
 *
 * Le contact simple n'est pas un chevauchement : une réunion qui finit à 10 h
 * et une autre qui commence à 10 h se suivent, elles ne se superposent pas.
 * Les signaler toutes les deux rendrait l'avertissement inutilisable, puisque
 * c'est ainsi qu'une journée bien remplie est normalement construite.
 */
export function seChevauchent(a: Evenement, b: Evenement): boolean {
  if (a.journeeEntiere || b.journeeEntiere) return false;
  const debutA = Date.parse(a.debut);
  const finA = Date.parse(a.fin);
  const debutB = Date.parse(b.debut);
  const finB = Date.parse(b.fin);
  if ([debutA, finA, debutB, finB].some(Number.isNaN)) return false;
  return debutA < finB && debutB < finA;
}

/** Les paires d'événements qui se chevauchent, chacune une seule fois. */
export function chevauchements(evenements: readonly Evenement[]): [Evenement, Evenement][] {
  const paires: [Evenement, Evenement][] = [];
  const tries = [...evenements].sort((x, y) => x.debut.localeCompare(y.debut));
  for (let i = 0; i < tries.length; i += 1) {
    for (let j = i + 1; j < tries.length; j += 1) {
      /*
         Les événements sont triés par début : dès que le suivant commence
         après la fin du courant, aucun de ceux d'après ne peut le chevaucher.
         Sans cette sortie, une année d'agenda coûterait un carré d'itérations
         pour trouver une poignée de paires.
      */
      if (!tries[i].journeeEntiere && tries[j].debut >= tries[i].fin) break;
      if (seChevauchent(tries[i], tries[j])) paires.push([tries[i], tries[j]]);
    }
  }
  return paires;
}
