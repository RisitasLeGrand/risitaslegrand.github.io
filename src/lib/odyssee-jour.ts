/**
 * Ce que le tableau de bord d'Odyssée lit, en une fois.
 *
 * ## Pourquoi une seule fonction, et pas huit appels depuis l'écran
 *
 * Le tableau de bord montre la roue, le plancher, les suggestions, les
 * derniers gains et la couverture. Les cinq lisent la même chose : les faits
 * des deux branches, les tâches, les quêtes, les événements du jour, le profil.
 * Les laisser lire chacun de leur côté ferait cinq parcours de la base à chaque
 * ouverture, et surtout **cinq instants différents** : la roue calculée à
 * 23 h 59 et les suggestions à 0 h 00 ne parleraient pas du même jour.
 *
 * `etatDuJour` fixe donc l'instant une fois, lit une fois, et rend tout.
 *
 * ## Les faits viennent des deux branches
 *
 * Révisions publie les siens, Odyssée les siens, et la roue additionne. C'est
 * le sens même de la roue d'équilibre : si elle ne voyait que les faits
 * d'Odyssée, Cognition et Connaissances seraient vides alors que ce sont les
 * deux domaines les mieux nourris.
 */
import { jourLogique } from './noyau/jour-logique';
import { reglagesJourLogiqueLocaux } from './adaptation';
import { DOMAINES_ACTIFS_PAR_DEFAUT, type IdDomaine } from './noyau/domaines';
import type { Fait } from './noyau/faits';
import { champ } from './profil';
import { publierFaitsRevisions } from './odyssee/faits-revisions';
import { publierFaitsOdyssee } from './odyssee/faits-odyssee';
import {
  evenementsEntre,
  revueDu,
  toutesLesQuetes,
  toutesLesTaches,
} from './odyssee/donnees';
import type { Evenement, Quete, Tache } from './odyssee/modele';
import {
  JOURS_DE_LA_ROUE,
  couverture,
  derniersJours,
  plancherDuJour,
  queFaireMaintenant,
  roue,
  semaineCourante,
  type Couverture,
  type Plancher,
  type Roue,
  type Suggestion,
} from './odyssee/jour';

export interface EtatDuJour {
  aujourdhui: string;
  jours: string[];
  semaine: string[];
  actifs: IdDomaine[];
  roue: Roue;
  plancher: Plancher;
  suggestions: Suggestion[];
  /** Suggestions écartées parce que la journée est surchargée. */
  retenues: number;
  surchargee: boolean;
  couverture: Couverture;
  evenementsDuJour: Evenement[];
  taches: Tache[];
  quetes: Quete[];
  /** Les faits de la fenêtre, pour les derniers gains. */
  faits: Fait[];
  /** La revue du soir est-elle faite ? */
  revueFaite: boolean;
}

/**
 * Les domaines que la personne suit.
 *
 * Le champ de profil fait foi ; à défaut, les cinq allumés par la décision 1.
 * Un tableau vide est **une réponse** et non une absence : quelqu'un qui a tout
 * éteint doit voir une roue sans branche, pas la roue par défaut.
 */
export async function domainesActifs(): Promise<IdDomaine[]> {
  const valeur = (await champ('domainesActifs'))?.valeur;
  if (Array.isArray(valeur)) return valeur.map(String);
  return [...DOMAINES_ACTIFS_PAR_DEFAUT];
}

/** Les cibles de la roue, par domaine, entre 0 et 1. */
async function ciblesDeLaRoue(): Promise<Record<string, number>> {
  const valeur = (await champ('ciblesEquilibre'))?.valeur;
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return {};
  const cibles: Record<string, number> = {};
  for (const [clef, part] of Object.entries(valeur as Record<string, unknown>)) {
    if (typeof part === 'number' && Number.isFinite(part)) cibles[clef] = part;
  }
  return cibles;
}

async function heureDeCoucher(): Promise<string | undefined> {
  const valeur = (await champ('coucher'))?.valeur;
  return typeof valeur === 'string' && /^\d{2}:\d{2}$/.test(valeur) ? valeur : undefined;
}

/** Tout ce que le tableau de bord affiche, lu à un seul instant. */
export async function etatDuJour(maintenant = new Date()): Promise<EtatDuJour> {
  const reglages = await reglagesJourLogiqueLocaux();
  const aujourdhui = jourLogique(maintenant, reglages);
  const jours = derniersJours(aujourdhui, JOURS_DE_LA_ROUE);
  const semaine = semaineCourante(aujourdhui);

  /*
     La fenêtre des faits part du plus ancien des deux ensembles de jours. La
     semaine en cours peut remonter plus loin que sept jours un dimanche ? Non
     — sept jours couvrent toujours la semaine entamée. Mais `domaine-delaisse`
     a besoin de savoir si un domaine a été mesuré **un jour**, pas seulement
     cette semaine : la fenêtre des faits est donc large, et c'est la règle qui
     restreint, pas la lecture.
  */
  const [revisions, odyssee, taches, quetes, actifs, cibles, coucher] = await Promise.all([
    publierFaitsRevisions({ reglages }),
    publierFaitsOdyssee({ reglages }),
    toutesLesTaches(),
    toutesLesQuetes(),
    domainesActifs(),
    ciblesDeLaRoue(),
    heureDeCoucher(),
  ]);
  const faits = [...revisions.faits, ...odyssee.faits];

  const debutDuJour = `${aujourdhui}T00:00:00.000Z`;
  const finDuJour = `${aujourdhui}T23:59:59.999Z`;
  const evenementsDuJour = await evenementsEntre(debutDuJour, finDuJour);
  const revueFaite = Boolean(await revueDu('soir', aujourdhui));

  const laRoue = roue(faits, { actifs, cibles, jours });
  const lePlancher = plancherDuJour(quetes, { aujourdhui, semaine, actifs });
  const quoi = queFaireMaintenant(
    { quetes, taches, evenementsDuJour, faits },
    { maintenant, aujourdhui, semaine, actifs, coucher, revueFaite },
  );

  return {
    aujourdhui,
    jours,
    semaine,
    actifs,
    roue: laRoue,
    plancher: lePlancher,
    suggestions: quoi.suggestions,
    retenues: quoi.retenues,
    surchargee: quoi.surchargee,
    couverture: couverture(faits, actifs, jours),
    evenementsDuJour,
    taches,
    quetes,
    faits,
    revueFaite,
  };
}
