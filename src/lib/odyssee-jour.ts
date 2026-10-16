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
import { publierTousLesFaits } from './odyssee/faits-branches';
import {
  evenementsEntre,
  revueDu,
  toutesLesQuetes,
  toutesLesTaches,
} from './odyssee/donnees';
import type { Evenement, Quete, Tache } from './odyssee/modele';
import { enRetard, occurrencesLues } from './odyssee/occurrences-lues';
import type { OccurrenceAffichee } from './odyssee/occurrences-de-la-fenetre';
import {
  JOURS_DE_LA_ROUE,
  couverture,
  derniersJours,
  plancherDuJour,
  planTenu,
  queFaireMaintenant,
  roue,
  semaineCourante,
  type Couverture,
  type PlanTenu,
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
  /** Le suivi « prévu / réalisé » sur la fenêtre de sept jours. */
  plan: PlanTenu;
  /** Les moments passés dont le relevé manque, à n'importe quel jour de la fenêtre. */
  aRelever: Evenement[];
  /**
   * Les occurrences des tâches répétées, pour aujourd'hui — prompt 39, C4.
   *
   * Elles sont ici et non dans chaque écran parce que le tableau de bord et
   * la Revue doivent en montrer **les mêmes**. Et elles ne coûtent presque
   * rien de plus : les faits et les tâches sont déjà lus pour la roue et les
   * suggestions, et `occurrencesLues` les accepte plutôt que de les relire.
   */
  occurrences: OccurrenceAffichee[];
  evenementsDuJour: Evenement[];
  taches: Tache[];
  quetes: Quete[];
  /** Les faits de la fenêtre, pour les derniers gains. */
  faits: Fait[];
  /** La revue du soir est-elle faite ? */
  revueFaite: boolean;
  /**
   * Les jours dont la revue manque, sept au plus — et non le rappel seul.
   *
   * Le tableau de bord n'affiche qu'une phrase groupée, mais le centre de
   * notifications a besoin des jours : un élément par jour, pour que
   * tenir la revue de mardi fasse disparaître mardi. Les exposer coûte
   * zéro lecture de plus, puisqu'ils sont déjà calculés pour le rappel.
   */
  revuesManquees: string[];
  /**
   * Les occurrences dépassées de la fenêtre, sur les mêmes sept jours.
   *
   * La fenêtre est celle de la roue, et non le seul jour : une occurrence
   * du jour n'est jamais en retard, donc un tableau de bord qui ne lirait
   * qu'aujourd'hui n'en trouverait jamais aucune.
   */
  occurrencesEnRetard: OccurrenceAffichee[];
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

async function heureDeclaree(nom: 'lever' | 'coucher'): Promise<string | undefined> {
  const valeur = (await champ(nom))?.valeur;
  return typeof valeur === 'string' && /^\d{2}:\d{2}$/.test(valeur) ? valeur : undefined;
}

async function momentDeLaRevue(): Promise<'matin' | 'soir'> {
  const { lireMoment } = await import('./odyssee/moment-revue');
  return lireMoment((await champ('moment-revue'))?.valeur);
}

/**
 * Les revues qui manquent, et le rappel groupé qui en découle.
 *
 * Les deux ensemble, parce que deux appelants n'en veulent pas la même
 * forme : l'écran veut une phrase, le centre de notifications veut les
 * jours. Les recalculer séparément relirait toutes les revues deux fois,
 * et surtout permettrait aux deux de diverger.
 */
async function revuesEnAttente(
  moment: 'matin' | 'soir',
  maintenant: Date,
): Promise<{ manques: string[]; rappel: string | null }> {
  const [{ toutesLesRevues }, { rappelDeRevue, revuesManquees }] = await Promise.all([
    import('./odyssee/donnees'),
    import('./odyssee/moment-revue'),
  ]);
  const tenues = (await toutesLesRevues()).filter((r) => r.type === 'soir').map((r) => r.jour);
  const manques = revuesManquees(tenues, moment, maintenant);
  return { manques, rappel: rappelDeRevue(manques) };
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
  /*
     Toutes les branches, et non seulement Révisions et Odyssée. La roue
     mesure l'équilibre entre domaines : lui cacher le sport et le corps
     reviendrait à dire « tu négliges ton corps » à quelqu'un qui vient de
     s'entraîner et de peser.
  */
  const [publication, taches, quetes, actifs, cibles, coucher, lever, moment] = await Promise.all([
    publierTousLesFaits({ reglages }),
    toutesLesTaches(),
    toutesLesQuetes(),
    domainesActifs(),
    ciblesDeLaRoue(),
    heureDeclaree('coucher'),
    heureDeclaree('lever'),
    momentDeLaRevue(),
  ]);
  const faits = publication.faits;

  const debutDuJour = `${aujourdhui}T00:00:00.000Z`;
  const finDuJour = `${aujourdhui}T23:59:59.999Z`;
  /*
     Deux fenêtres, et elles ne servent pas à la même chose. Le jour, pour
     l'agenda et les suggestions. Les sept jours, pour le suivi du plan et
     pour les relevés en retard — un moment de mardi non relevé doit rester
     posable vendredi, sans quoi il suffirait d'ignorer la question un jour
     pour qu'elle disparaisse, et le taux ne porterait que sur les jours
     assidus.
  */
  const evenementsDuJour = await evenementsEntre(debutDuJour, finDuJour);
  const evenementsDeLaFenetre = await evenementsEntre(
    `${jours[0]}T00:00:00.000Z`,
    finDuJour,
  );
  const revueFaite = Boolean(await revueDu('soir', aujourdhui));
  const revues = await revuesEnAttente(moment, maintenant);

  const laRoue = roue(faits, { actifs, cibles, jours });
  const lePlancher = plancherDuJour(quetes, { aujourdhui, semaine, actifs });
  const quoi = queFaireMaintenant(
    { quetes, taches, evenementsDuJour, faits },
    {
      maintenant,
      aujourdhui,
      semaine,
      actifs,
      coucher,
      lever,
      moment,
      revueFaite,
      rappelDeRevue: revues.rappel,
    },
  );

  /*
     Les occurrences du jour, avec les faits et les tâches DÉJÀ lus plus
     haut : aucune seconde projection, aucune seconde lecture des tâches.
     Le coffre fermé ne lève rien — les occurrences scellées reviennent
     illisibles, et chaque écran décide comment le dire.
  */
  /*
     Sur les sept jours, et non sur le seul jour. Le tableau de bord
     n'affiche que les occurrences d'aujourd'hui — on les filtre juste
     après —, mais « en retard » ne peut se voir que sur les jours
     précédents, et relire la fenêtre une seconde fois pour cela aurait
     doublé la lecture des tâches et des exceptions.
  */
  const fenetreDOccurrences = await occurrencesLues(jours[0], aujourdhui, { taches, faits });
  const occurrences = fenetreDOccurrences.occurrences.filter((o) => o.jour === aujourdhui);
  const occurrencesEnRetard = fenetreDOccurrences.occurrences.filter((o) =>
    enRetard(o, aujourdhui),
  );

  const plan = planTenu(taches, evenementsDeLaFenetre, { jours, maintenant, actifs });
  const aRelever = evenementsDeLaFenetre
    .filter(
      (e) =>
        e.realise === 'inconnu' &&
        !e.journeeEntiere &&
        actifs.includes(e.domaine) &&
        Date.parse(e.fin) <= maintenant.getTime(),
    )
    .sort((a, b) => b.debut.localeCompare(a.debut));

  return {
    occurrences,
    aujourdhui,
    jours,
    semaine,
    actifs,
    plan,
    aRelever,
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
    revuesManquees: revues.manques,
    occurrencesEnRetard,
  };
}
