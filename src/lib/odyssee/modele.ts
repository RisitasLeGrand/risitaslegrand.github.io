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
  /**
   * Jour logique de l'abandon, ou `null`.
   *
   * Renoncer n'est pas oublier. Une tâche abandonnée quitte l'arriéré — elle
   * ne reparaît plus dans « Que faire maintenant ? » — **sans** être
   * supprimée : elle compte dans le suivi du plan tenu, du côté de ce qui
   * n'a pas été fait, et la supprimer ferait remonter le taux de réalisation
   * à chaque renoncement. C'est exactement l'inverse de ce qu'un suivi doit
   * faire.
   */
  abandonneeLe: string | null;
  /** Pourquoi on y a renoncé. Exigé à l'abandon, `null` sinon. */
  motifAbandon: MotifNonFait | null;
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

/* ════════════════════════════════════════════════════════════════════════
   Le relevé : ce qui était prévu a-t-il eu lieu ?
   ════════════════════════════════════════════════════════════════════════ */

/**
 * L'écart entre le plan et le réel, dit par la personne.
 *
 * ## Pourquoi `inconnu` est une valeur et non une absence
 *
 * Un agenda dit ce qui était **prévu**. Sans relevé, le site ne peut que le
 * supposer vécu — et c'est ce qu'il faisait, en marquant les faits `estime`.
 * Mais « je ne sais pas » et « ce n'était pas fait » sont deux choses
 * différentes, et les confondre fabriquerait un taux de réalisation faux dans
 * les deux sens : à la baisse si l'on compte tout ce qui n'est pas relevé
 * comme non fait, à la hausse si l'on compte tout comme fait.
 *
 * `inconnu` est donc la valeur de départ, elle est **comptée à part**, et le
 * taux de réalisation ne porte que sur ce qui a été relevé.
 *
 * ## Pourquoi « partiel » existe
 *
 * Sans lui, une séance de deux heures écourtée à vingt minutes obligerait à
 * mentir dans un sens ou dans l'autre. Et c'est le cas le plus fréquent : la
 * plupart des plans ne sont ni tenus ni abandonnés, ils sont rognés.
 */
export type Realisation = 'inconnu' | 'fait' | 'partiel' | 'non-fait';

export const REALISATIONS: readonly Realisation[] = ['inconnu', 'fait', 'partiel', 'non-fait'];

export const LIBELLE_REALISATION: Record<Realisation, string> = {
  inconnu: 'Pas encore dit',
  fait: 'Fait',
  partiel: 'En partie',
  'non-fait': 'Pas fait',
};

/* ════════════════════════════════════════════════════════════════════════
   Pourquoi cela n'a pas eu lieu
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Les motifs d'un plan non tenu.
 *
 * ## Pourquoi une liste déclarée, et pas seulement un texte libre
 *
 * Un texte libre dit tout et ne se compte pas. « Odyssée doit savoir
 * pourquoi » ne veut rien dire si la réponse n'est lisible que par un humain
 * qui relirait trois ans de notes : il faut que la raison dominante se
 * **calcule**. La liste est donc fermée — et le texte libre existe à côté,
 * pour ce que la liste ne dit pas.
 *
 * ## Pourquoi ces motifs-là
 *
 * Ils couvrent les causes réelles d'un plan qui tombe, et ils sont rangés du
 * plus extérieur au plus intérieur. Deux choix méritent d'être défendus :
 *
 * **`trop-ambitieux` met en cause le plan, pas la personne.** C'est le motif
 * le plus utile de la liste, parce que c'est celui qui débouche sur une
 * correction — planifier moins —, là où « je n'ai pas réussi » ne débouche sur
 * rien. Sans lui, tout échec de planification se lirait comme un échec de
 * volonté.
 *
 * **`sans-envie` existe, et il est dit sans détour.** L'omettre forcerait à
 * choisir un motif faux, et un suivi qu'on remplit de travers ne vaut rien.
 * Il n'est pas plus mal noté qu'un autre : aucun motif ne l'est, parce que ce
 * relevé n'est pas une note.
 */
export type MotifNonFait =
  | 'imprevu'
  | 'annule-par-autrui'
  | 'manque-de-temps'
  | 'trop-ambitieux'
  | 'sante'
  | 'fatigue'
  | 'sans-envie'
  | 'priorite-changee'
  | 'oubli'
  | 'autre';

export interface Motif {
  id: MotifNonFait;
  libelle: string;
  /** Ce qu'il recouvre, pour que deux motifs voisins ne soient pas confondus. */
  precision: string;
}

export const MOTIFS: readonly Motif[] = [
  {
    id: 'imprevu',
    libelle: 'Un imprévu',
    precision: 'Quelque chose d’autre s’est imposé, hors de votre main.',
  },
  {
    id: 'annule-par-autrui',
    libelle: 'Annulé par quelqu’un d’autre',
    precision: 'Ce n’est pas vous qui avez renoncé.',
  },
  {
    id: 'manque-de-temps',
    libelle: 'Pas eu le temps',
    precision: 'La journée était pleine ; rien ne s’est substitué en particulier.',
  },
  {
    id: 'trop-ambitieux',
    libelle: 'Le plan était trop chargé',
    precision: 'Ce n’était pas tenable au départ. C’est le plan qu’il faut revoir.',
  },
  {
    id: 'sante',
    libelle: 'Santé',
    precision: 'Douleur, maladie, rendez-vous médical.',
  },
  {
    id: 'fatigue',
    libelle: 'Trop fatigué',
    precision: 'Possible sur le papier, hors d’atteinte ce jour-là.',
  },
  {
    id: 'sans-envie',
    libelle: 'Pas eu envie',
    precision: 'Dit sans détour : un suivi qu’on remplit de travers ne vaut rien.',
  },
  {
    id: 'priorite-changee',
    libelle: 'Ce n’était plus la priorité',
    precision: 'Vous avez fait autre chose, et c’était le bon choix.',
  },
  {
    id: 'oubli',
    libelle: 'Oublié',
    precision: 'Jamais revenu à l’esprit au bon moment.',
  },
  {
    id: 'autre',
    libelle: 'Autre',
    precision: 'À préciser en deux mots.',
  },
];

const MOTIF_PAR_ID = new Map(MOTIFS.map((m) => [m.id, m]));

export const motif = (id: string): Motif | undefined =>
  MOTIF_PAR_ID.get(id as MotifNonFait);

export const libelleDuMotif = (id: string): string => MOTIF_PAR_ID.get(id as MotifNonFait)?.libelle ?? id;

/**
 * Un événement d'agenda.
 *
 * `uidIcs` est l'identifiant que porte l'événement dans le fichier dont il
 * vient. Il n'est pas décoratif : réimporter le même agenda doit **mettre à
 * jour** les événements déjà connus, pas les dupliquer. Un événement saisi à
 * la main n'en a pas, et c'est ce qui le protège d'être écrasé par un import.
 *
 * `realise` porte le relevé — voir `Realisation`. Il n'est **jamais** déduit :
 * un événement passé reste `inconnu` tant que la personne n'a pas répondu.
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
  realise: Realisation;
  /** Instant du relevé, pour distinguer « répondu » de « jamais ouvert ». */
  releveLe: string | null;
  /**
   * Pourquoi cela n'a pas eu lieu, ou pas entièrement.
   *
   * Exigé quand `realise` vaut `non-fait` — c'est tout l'intérêt du relevé —,
   * proposé sans être exigé quand il vaut `partiel`, et nécessairement `null`
   * sinon : un motif de non-réalisation sur un événement fait serait une
   * contradiction que personne ne remarquerait avant de compter.
   */
  motif: MotifNonFait | null;
  /** Les deux mots qui précisent le motif. Jamais obligatoires. */
  motifLibre: string;
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
  /*
     Faite **et** abandonnée est contradictoire, et ce n'est pas une subtilité :
     le suivi du plan tenu compterait la même tâche des deux côtés.
  */
  if (t.faiteLe && t.abandonneeLe) {
    problemes.push('Une tâche ne peut pas être à la fois faite et abandonnée.');
  }
  /*
     Un abandon sans motif ne serait qu'une disparition. La contrainte est ici,
     dans le contrôle, et non dans l'écran : un écran se contourne, un contrôle
     refuse l'écriture.
  */
  if (t.abandonneeLe && !t.motifAbandon) {
    problemes.push('Dire pourquoi vous y renoncez fait partie du renoncement.');
  }
  if (!t.abandonneeLe && t.motifAbandon) {
    problemes.push('Une tâche qui n’est pas abandonnée ne porte pas de motif d’abandon.');
  }
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
  if (!REALISATIONS.includes(e.realise)) {
    problemes.push('Le relevé doit être « inconnu », « fait », « partiel » ou « non-fait ».');
  }
  if (e.realise === 'non-fait' && !e.motif) {
    problemes.push('Dire que cela n’a pas eu lieu demande d’en dire la raison.');
  }
  if ((e.realise === 'fait' || e.realise === 'inconnu') && e.motif) {
    problemes.push('Un motif de non-réalisation n’a pas de sens ici.');
  }
  if (e.motif && !MOTIF_PAR_ID.has(e.motif)) {
    problemes.push(`Motif inconnu : « ${e.motif} ».`);
  }
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
