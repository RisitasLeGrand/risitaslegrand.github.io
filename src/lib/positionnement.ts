/**
 * Prétest de positionnement — estimer le niveau d'entrée, puis orienter.
 *
 * Le prétest d'une fiche ouvre la lecture de **cette** fiche : il ne peut pas
 * orienter, puisqu'on est déjà arrivé. Ce module fait l'autre moitié du
 * travail : il pioche quelques questions dans le vivier de plusieurs fiches
 * d'un même fascicule, en tire une note d'entrée, et dit par quels cours
 * commencer.
 *
 * **La zone proximale de développement reste le seul critère.** Elle l'est
 * deux fois ici, et c'est voulu :
 *
 *  1. **au tirage** — les questions sont ordonnées par proximité avec la zone
 *     dès qu'une note d'entrée existe, de sorte qu'un second positionnement ne
 *     repose pas sur des questions dont la réponse était d'avance connue ou
 *     d'avance hors d'atteinte ;
 *  2. **à l'orientation** — un cours est recommandé parce que sa réussite
 *     prédite tombe dans la bande de la zone, jamais parce qu'il vient plus tôt
 *     dans le fascicule ou parce qu'une question s'y rapportant a été manquée.
 *
 * **Ce que ce module refuse de faire.** Il ne consomme pas les prétests des
 * fiches qu'il interroge : les questions servies sont retenues, pour qu'elles
 * ne reviennent pas, mais la fiche garde son prétest — c'est précisément à cela
 * que sert un vivier de trois à seize questions. Il n'interroge pas non plus
 * les fiches déjà lues : là, la réussite mesurerait une mémoire, pas un niveau
 * d'entrée, et les deux n'orientent pas vers la même chose.
 *
 * **Une limite à connaître.** Situer un cours demande de connaître sa
 * difficulté, et celle-ci s'estime à partir des réponses données **en quiz**,
 * après lecture — jamais à partir d'un prétest, qui dirait seulement qu'une
 * question posée trop tôt est difficile. Sur un fascicule neuf, l'orientation
 * est donc muette, et elle le dit. Elle se remplit au fil de l'usage du site,
 * fiche par fiche.
 */
import type { FicheResume, Manifeste, QuestionQuiz } from './contenu';
import { MATIERE_CAS_PRATIQUE, estMethodologique } from './contenu-ecarte';
import { tousLesEtatsFiches, type EtatFiche } from './db';
import {
  BANDE_ZPD,
  PREFIXE_ENTREE,
  REGLAGES_CONTENU_PAR_DEFAUT,
  enregistrerPretest,
  niveauDEntree,
  ordonnerParZoneProximale,
  situerFiches,
  type NoteEntree,
  type ReglagesContenu,
  type ReponsePretest,
  type Situation,
} from './niveau';
import { memoriserServies, melanger, parFraicheur } from './pretest-noyau';

/**
 * Combien de questions viser.
 *
 * Douze, parce qu'il faut de quoi bouger une note depuis la valeur de départ
 * sans transformer l'orientation en examen : à ce volume, l'estimation se
 * déplace d'environ cent soixante points entre un sans-faute et un zéro, soit
 * l'écart qui sépare deux crans d'auto-estimation.
 */
export const QUESTIONS_VISEES = 12;

/** En dessous, le résultat est trop maigre pour qu'on en tire une orientation. */
export const QUESTIONS_MINIMALES = 4;

/**
 * Jamais plus de deux questions sur la même fiche.
 *
 * Un positionnement doit couvrir le fascicule, pas sonder une fiche en
 * profondeur : trois questions sur la même fiche mesureraient cette fiche et
 * laisseraient les onze autres sans aucune observation.
 */
export const QUESTIONS_PAR_FICHE = 2;

/**
 * Combien de fiches il faut au minimum pour qu'un positionnement ait un sens.
 *
 * Dérivé, et non choisi : avec au plus deux questions par fiche, une seule
 * fiche ne peut pas atteindre le minimum de questions. Proposer un tel
 * fascicule serait offrir une porte qui ne s'ouvre pas — c'est exactement ce
 * qu'un essai en navigateur a trouvé, le premier fascicule de la liste étant
 * un « Méthodologie et sujet corrigé » d'une seule fiche.
 */
export const FICHES_MINIMALES = Math.ceil(QUESTIONS_MINIMALES / QUESTIONS_PAR_FICHE);

/** Un périmètre positionnable : un fascicule, et ce qu'il reste à y interroger. */
export interface Perimetre {
  matiere: string;
  fascicule: string;
  /** Fiches non lues dotées d'un vivier de prétest. */
  eligibles: number;
  /** Fiches du fascicule, toutes confondues. */
  total: number;
}

/**
 * Les fiches d'un fascicule qu'on peut interroger pour se positionner.
 *
 * Quatre conditions, et chacune pour une raison différente : un vivier de
 * prétest, parce qu'il faut des questions ; non lue, parce qu'après la lecture
 * on mesurerait une mémoire et non un niveau d'entrée ; et, quand les réglages
 * les écartent, ni méthodologie ni cas pratique — là, la réussite ne dit rien
 * d'une connaissance de matière, donc aucune note d'entrée ne serait écrite et
 * la page ne pourrait rien orienter.
 */
function interrogeables(
  fiches: readonly FicheResume[],
  matiere: string,
  lues: ReadonlySet<string>,
  ecartes: Pick<ReglagesContenu, 'casPratique' | 'methodologie'>,
): FicheResume[] {
  if (!ecartes.casPratique && matiere === MATIERE_CAS_PRATIQUE) return [];
  return fiches.filter(
    (f) =>
      f.aPretest && !lues.has(f.id) && (ecartes.methodologie || !estMethodologique(f)),
  );
}

function clefEntreeFascicule(matiere: string, fascicule: string): string {
  return `${PREFIXE_ENTREE}fascicule:${matiere}|${fascicule}`;
}

/**
 * Les fascicules qu'on peut encore positionner, du plus fourni au moins fourni.
 *
 * Un fascicule entièrement lu disparaît de la liste : il n'y a plus rien à y
 * pré-tester, et proposer un positionnement qui ne pourrait poser aucune
 * question serait une impasse offerte comme une porte.
 */
export function perimetres(
  manifeste: Manifeste,
  etats: readonly EtatFiche[],
  ecartes: Pick<ReglagesContenu, 'casPratique' | 'methodologie'> = REGLAGES_CONTENU_PAR_DEFAUT,
): Perimetre[] {
  const lues = new Set(etats.filter((e) => e.lu).map((e) => e.id));
  const liste: Perimetre[] = [];
  for (const matiere of manifeste.matieres) {
    for (const fascicule of matiere.fascicules) {
      const eligibles = interrogeables(fascicule.fiches, matiere.nom, lues, ecartes).length;
      if (eligibles < FICHES_MINIMALES) continue;
      liste.push({
        matiere: matiere.nom,
        fascicule: fascicule.nom,
        eligibles,
        total: fascicule.fiches.length,
      });
    }
  }
  // Le plus fourni d'abord, et non l'ordre alphabétique : c'est la première
  // entrée qui sert de choix par défaut, et un positionnement vaut d'autant
  // mieux qu'il a de quoi interroger. L'ordre des noms ne départage qu'à
  // égalité.
  return liste.sort(
    (a, b) =>
      b.eligibles - a.eligibles ||
      a.matiere.localeCompare(b.matiere, 'fr') ||
      a.fascicule.localeCompare(b.fascicule, 'fr', { numeric: true }),
  );
}

export interface QuestionPositionnement extends QuestionQuiz {
  ficheId: string;
  ficheTitre: string;
  matiere: string;
  fascicule: string;
}

/**
 * Compose le questionnaire : échantillonne les fiches, puis tire dans leurs
 * viviers.
 *
 * L'échantillonnage vient **avant** le déchiffrement, et pas l'inverse : un
 * fascicule de dix-huit fiches se déchiffrerait en entier pour n'en garder que
 * douze questions, ce qui coûterait dix-huit déchiffrements là où douze
 * suffisent.
 */
export async function composer(
  manifeste: Manifeste,
  matiere: string,
  fascicule: string,
  etats: readonly EtatFiche[],
  ecartes: Pick<ReglagesContenu, 'casPratique' | 'methodologie'> = REGLAGES_CONTENU_PAR_DEFAUT,
): Promise<QuestionPositionnement[]> {
  const lues = new Set(etats.filter((e) => e.lu).map((e) => e.id));
  const parId = new Map(etats.map((e) => [e.id, e]));
  const bloc = manifeste.matieres
    .find((m) => m.nom === matiere)
    ?.fascicules.find((f) => f.nom === fascicule);
  if (!bloc) return [];

  // Le même filtre que « perimetres », et pas une copie approchante : un
  // périmètre proposé dans la liste doit poser exactement les fiches que la
  // liste a comptées.
  const eligibles = interrogeables(bloc.fiches, matiere, lues, ecartes);
  if (!eligibles.length) return [];

  // Une question par fiche quand il y a de quoi couvrir la cible, deux sinon —
  // jamais plus : voir QUESTIONS_PAR_FICHE.
  const parFiche = Math.min(
    QUESTIONS_PAR_FICHE,
    Math.max(1, Math.ceil(QUESTIONS_VISEES / eligibles.length)),
  );
  const retenues = melanger(eligibles).slice(0, Math.ceil(QUESTIONS_VISEES / parFiche));
  const clefSujet = clefEntreeFascicule(matiere, fascicule);

  // Import différé de la couche de contenu chiffré : ce module est pour le
  // reste du calcul pur, et le garder chargeable hors navigateur permet de
  // l'éprouver — le tirage et le périmètre sont exactement ce qui doit l'être.
  const { chargerFiche } = await import('./contenu');

  const questions: QuestionPositionnement[] = [];
  for (const resume of retenues) {
    const complete = await chargerFiche(resume.id);
    const vivier = complete.pretest ?? [];
    if (!vivier.length) continue;
    // Deux critères, et leur ordre n'est pas négociable : l'inédit d'abord —
    // une question déjà corrigée ne mesurerait plus qu'un souvenir —, la zone
    // proximale **à l'intérieur** de chaque groupe. Trier le tout d'un coup
    // ferait remonter une question revue devant une inédite dès qu'elle serait
    // mieux calibrée, ce qui est exactement ce qu'il faut éviter.
    const { inedites, revues } = parFraicheur(vivier, parId.get(resume.id)?.pretestVues ?? []);
    const choisies = [
      ...(await ordonnerParZoneProximale(inedites, clefSujet)),
      ...(await ordonnerParZoneProximale(revues, clefSujet)),
    ].slice(0, parFiche);
    for (const question of choisies) {
      questions.push({
        ...question,
        ficheId: resume.id,
        ficheTitre: complete.titre,
        matiere,
        fascicule,
      });
    }
  }

  return melanger(questions).slice(0, QUESTIONS_VISEES);
}

/**
 * Retient les questions d'un questionnaire comme servies, fiche par fiche.
 *
 * **À appeler quand le questionnaire est affiché, jamais pendant sa
 * composition.** Deux raisons, et toutes deux ont été des défauts avant d'être
 * des règles : un fascicule trop mince fait renoncer la page après la
 * composition, et les questions auraient alors été consommées pour rien ; et le
 * mélange final écarte le surplus au-delà de la cible, qui ne doit pas non plus
 * être compté comme vu.
 *
 * Qu'une question affichée mais laissée sans réponse soit retenue, en revanche,
 * est voulu : l'avoir vue, et vu sa correction, suffit à l'user.
 */
export async function memoriserQuestionnaire(
  questions: readonly QuestionPositionnement[],
): Promise<void> {
  const parFiche = new Map<string, { matiere: string; ids: string[] }>();
  for (const question of questions) {
    const entree = parFiche.get(question.ficheId) ?? { matiere: question.matiere, ids: [] };
    entree.ids.push(question.id);
    parFiche.set(question.ficheId, entree);
  }
  for (const [ficheId, { matiere, ids }] of parFiche) {
    await memoriserServies({ id: ficheId, matiere }, ids);
  }
}

/** Une fiche du fascicule, telle que l'orientation la présente. */
export interface FicheOrientee {
  id: string;
  titre: string;
  ordre: number;
  situation: Situation;
  /** Réussite prédite par la zone proximale, nulle si la fiche n'est pas située. */
  chance: number | null;
  /** Vrai si une question de cette fiche vient d'être posée. */
  interrogee: boolean;
  /** Part de justesse obtenue sur ces questions, nulle si aucune. */
  justesse: number | null;
}

export interface Bilan {
  /** Note d'entrée du fascicule, ou de la matière à défaut. */
  entree: NoteEntree | null;
  /** Questions réellement comptées comme observations. */
  observations: number;
  /** Part de justesse d'ensemble, sur les questions tentées. */
  justesse: number | null;
  /** Toutes les fiches non lues du fascicule, situées quand c'est possible. */
  fiches: FicheOrientee[];
  /** Combien de fiches ont pu être situées dans la zone proximale. */
  situees: number;
}

/**
 * Enregistre les réponses, puis situe les cours du fascicule.
 *
 * L'ordre importe : l'orientation se fait **après** l'enregistrement, pour
 * qu'elle soit calculée contre la note que ce positionnement vient de produire
 * et non contre celle d'avant.
 */
export async function conclure(
  reponses: readonly ReponsePretest[],
  manifeste: Manifeste,
  matiere: string,
  fascicule: string,
): Promise<Bilan> {
  await enregistrerPretest(reponses);
  const entree = await niveauDEntree(matiere, fascicule);

  const etats = await tousLesEtatsFiches();
  const lues = new Set(etats.filter((e) => e.lu).map((e) => e.id));
  const bloc = manifeste.matieres
    .find((m) => m.nom === matiere)
    ?.fascicules.find((f) => f.nom === fascicule);
  const candidates = (bloc?.fiches ?? []).filter((f) => !lues.has(f.id));

  // Les réponses, regroupées par fiche : elles ne servent pas à situer — une
  // ou deux questions n'y suffiraient pas — mais à montrer où l'on vient de
  // trébucher, ce qui est une information et non une orientation.
  const parFiche = new Map<string, number[]>();
  for (const reponse of reponses) {
    if (!reponse.ficheId) continue;
    parFiche.set(reponse.ficheId, [...(parFiche.get(reponse.ficheId) ?? []), reponse.resultat]);
  }

  const situees = entree ? await situerFiches(candidates, entree.note) : [];
  const situationParId = new Map(situees.map((s) => [s.fiche.id, s]));

  const fiches: FicheOrientee[] = candidates
    .map((f) => {
      const place = situationParId.get(f.id);
      const obtenues = parFiche.get(f.id);
      return {
        id: f.id,
        titre: f.titre,
        ordre: f.ordre,
        situation: place?.situation ?? ('non-situee' as Situation),
        chance: place?.chance ?? null,
        interrogee: Boolean(obtenues?.length),
        justesse: obtenues?.length
          ? obtenues.reduce((somme, r) => somme + r, 0) / obtenues.length
          : null,
      };
    })
    .sort((a, b) => a.ordre - b.ordre);

  const tentees = reponses.length;
  return {
    entree,
    observations: tentees,
    justesse: tentees ? reponses.reduce((somme, r) => somme + r.resultat, 0) / tentees : null,
    fiches,
    situees: fiches.filter((f) => f.situation !== 'non-situee').length,
  };
}

/** Libellés des quatre situations, dans l'ordre où elles se présentent. */
export const LIBELLES_SITUATION: {
  situation: Situation;
  titre: string;
  explication: string;
}[] = [
  {
    situation: 'dans-la-zone',
    titre: 'Dans votre zone proximale',
    explication:
      `Réussite prédite entre ${Math.round(BANDE_ZPD.bas * 100)} et ` +
      `${Math.round(BANDE_ZPD.haut * 100)} %. C'est ici que la lecture rapporte le plus : ` +
      'assez accessible pour être suivie, assez exigeante pour apprendre quelque chose.',
  },
  {
    situation: 'au-dessus',
    titre: 'Sans doute déjà acquis',
    explication:
      `Réussite prédite au-delà de ${Math.round(BANDE_ZPD.haut * 100)} %. Un survol suffit ` +
      'probablement ; le quiz de la fiche tranchera plus vite que la lecture.',
  },
  {
    situation: 'en-dessous',
    titre: 'À garder pour plus tard',
    explication:
      `Réussite prédite sous ${Math.round(BANDE_ZPD.bas * 100)} %. Rien n'interdit d'y aller, ` +
      'mais les cours de la zone proximale y préparent mieux que l’obstination.',
  },
  {
    situation: 'non-situee',
    titre: 'Pas encore situées',
    explication:
      'La difficulté d’un cours s’estime à partir des réponses données en quiz, après lecture. ' +
      'Tant qu’il n’y en a pas assez, l’ordre du fascicule reste le meilleur guide — c’est lui ' +
      'qui porte la progression voulue par le cours.',
  },
];
