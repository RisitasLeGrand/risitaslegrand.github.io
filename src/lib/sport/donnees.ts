/**
 * Lire et écrire ce que Sport possède, et la bibliothèque livrée.
 *
 * ## La sauvegarde à chaque série
 *
 * `ajouterSerie` écrit la séance entière après chaque série. C'est la seule
 * façon qu'une séance interrompue — téléphone éteint, application fermée,
 * batterie vide — se reprenne sans perte. Écrire en fin de séance serait plus
 * économe et perdrait tout à la première coupure, c'est-à-dire précisément le
 * jour où cela coûte.
 *
 * Le coût est tenable parce que la séance **porte** ses séries : une séance de
 * trente séries fait trente écritures d'un seul enregistrement, pas trente
 * enregistrements à réconcilier.
 *
 * ## La bibliothèque livrée
 *
 * Trente exercices courants, posés à la première ouverture et marqués
 * `fourni`. Ils ne sont pas figés : on peut les modifier et les supprimer. Ce
 * qu'ils évitent est la page blanche — un carnet d'entraînement vide qui
 * demande de saisir « développé couché » avant de pouvoir noter la première
 * série est un carnet qu'on n'ouvre pas deux fois.
 */
import { db } from '../db';
import { ulid } from '../noyau/ulid';
import { jourLogique } from '../noyau/jour-logique';
import {
  controlerExercice,
  controlerSerie,
  type Blessure,
  type Exercice,
  type Phase,
  type Seance,
  type Serie,
  type TypeDePhase,
} from './modele';
import { controlerProgramme, type Programme } from './programmes';

type MagasinSport =
  | 'sportExercices'
  | 'sportSeances'
  | 'sportPhases'
  | 'sportBlessures'
  | 'sportProgrammes';

async function journaliser(magasin: MagasinSport, enregistrement: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement(magasin, enregistrement as Record<string, unknown>);
  } catch {
    // Muet : perdre une série parce que le journal a échoué serait pire.
  }
}

async function journaliserSuppression(cibles: readonly string[]): Promise<void> {
  try {
    const { journaliserSuppressions } = await import('../sync/faits-domaine');
    await journaliserSuppressions(cibles);
  } catch {
    // Muet, même raison.
  }
}

const maintenant = () => new Date().toISOString();

/* ══════════════════════════════════════════════════════════════════════════
   Les exercices
   ══════════════════════════════════════════════════════════════════════════ */

export type ExerciceNeuf = Omit<Exercice, 'id' | 'majLe' | 'fourni'> &
  Partial<Pick<Exercice, 'id' | 'fourni'>>;

export async function ecrireExercice(neuf: ExerciceNeuf): Promise<Exercice> {
  const exercice: Exercice = {
    ...neuf,
    id: neuf.id ?? ulid(),
    fourni: neuf.fourni ?? false,
    majLe: maintenant(),
  };
  const problemes = controlerExercice(exercice);
  if (problemes.length) throw new Error(problemes.join(' '));
  await (await db()).put('sportExercices', exercice);
  await journaliser('sportExercices', exercice);
  return exercice;
}

export async function supprimerExercice(id: string): Promise<void> {
  await (await db()).delete('sportExercices', id);
  await journaliserSuppression([`sportExercices:${id}`]);
}

export const tousLesExercices = async (): Promise<Exercice[]> =>
  (await db()).getAll('sportExercices');

/* ══════════════════════════════════════════════════════════════════════════
   Les séances
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La séance en cours, s'il y en a une.
 *
 * Lue par l'index : c'est la première question que pose l'écran de séance au
 * chargement, et la poser en parcourant l'historique entier coûterait de plus
 * en plus cher à mesure que l'historique grossit — pour trouver au plus une
 * ligne.
 */
export async function seanceEnCours(): Promise<Seance | undefined> {
  const liste = await (await db()).getAllFromIndex('sportSeances', 'statut', 'en-cours');
  // Plus d'une serait une anomalie ; on rend la plus récente et on n'en fait pas un échec.
  return liste.sort((a, b) => b.debut.localeCompare(a.debut))[0];
}

export async function ouvrirSeance(
  programmeId: string | null = null,
  le = new Date(),
): Promise<Seance> {
  const existante = await seanceEnCours();
  // Rouvrir alors qu'une séance est en cours la rendrait orpheline.
  if (existante) return existante;
  const seance: Seance = {
    id: ulid(),
    jour: jourLogique(le),
    debut: le.toISOString(),
    fin: null,
    statut: 'en-cours',
    series: [],
    difficulte: null,
    note: '',
    programmeId,
    majLe: maintenant(),
  };
  await (await db()).put('sportSeances', seance);
  await journaliser('sportSeances', seance);
  return seance;
}

/** Ajoute une série, et **écrit la séance aussitôt**. */
export async function ajouterSerie(seanceId: string, serie: Serie): Promise<Seance | null> {
  const problemes = controlerSerie(serie);
  if (problemes.length) throw new Error(problemes.join(' '));
  const base = await db();
  const seance = await base.get('sportSeances', seanceId);
  if (!seance) return null;
  const avec: Seance = {
    ...seance,
    series: [...seance.series, serie],
    majLe: maintenant(),
  };
  await base.put('sportSeances', avec);
  await journaliser('sportSeances', avec);
  return avec;
}

/** Retire la dernière série : l'erreur de saisie la plus fréquente. */
export async function retirerDerniereSerie(seanceId: string): Promise<Seance | null> {
  const base = await db();
  const seance = await base.get('sportSeances', seanceId);
  if (!seance || !seance.series.length) return seance ?? null;
  const avec: Seance = { ...seance, series: seance.series.slice(0, -1), majLe: maintenant() };
  await base.put('sportSeances', avec);
  await journaliser('sportSeances', avec);
  return avec;
}

export async function cloreSeance(
  seanceId: string,
  options: { difficulte?: number | null; note?: string; le?: Date } = {},
): Promise<Seance | null> {
  const base = await db();
  const seance = await base.get('sportSeances', seanceId);
  if (!seance) return null;
  const le = options.le ?? new Date();
  const avec: Seance = {
    ...seance,
    statut: 'terminee',
    fin: le.toISOString(),
    difficulte: options.difficulte ?? seance.difficulte,
    note: options.note ?? seance.note,
    majLe: maintenant(),
  };
  await base.put('sportSeances', avec);
  await journaliser('sportSeances', avec);
  return avec;
}

export async function supprimerSeance(id: string): Promise<void> {
  await (await db()).delete('sportSeances', id);
  await journaliserSuppression([`sportSeances:${id}`]);
}

export const toutesLesSeancesSport = async (): Promise<Seance[]> =>
  (await db()).getAll('sportSeances');

/* ══════════════════════════════════════════════════════════════════════════
   Les phases et les blessures
   ══════════════════════════════════════════════════════════════════════════ */

export async function ecrirePhase(
  type: TypeDePhase,
  debut: string,
  options: { id?: string; fin?: string | null; note?: string } = {},
): Promise<Phase> {
  const phase: Phase = {
    id: options.id ?? ulid(),
    type,
    debut,
    fin: options.fin ?? null,
    note: options.note ?? '',
    majLe: maintenant(),
  };
  await (await db()).put('sportPhases', phase);
  await journaliser('sportPhases', phase);
  return phase;
}

export const toutesLesPhases = async (): Promise<Phase[]> => (await db()).getAll('sportPhases');

export async function ecrireBlessure(
  blessure: Omit<Blessure, 'id' | 'majLe'> & Partial<Pick<Blessure, 'id'>>,
): Promise<Blessure> {
  const avec: Blessure = { ...blessure, id: blessure.id ?? ulid(), majLe: maintenant() };
  await (await db()).put('sportBlessures', avec);
  await journaliser('sportBlessures', avec);
  return avec;
}

/** Refermer une blessure : c'est ce qui lève le garde-fou. */
export async function refermerBlessure(id: string, le = new Date()): Promise<Blessure | null> {
  const base = await db();
  const blessure = await base.get('sportBlessures', id);
  if (!blessure) return null;
  const avec: Blessure = { ...blessure, fin: le.toISOString(), majLe: maintenant() };
  await base.put('sportBlessures', avec);
  await journaliser('sportBlessures', avec);
  return avec;
}

export const toutesLesBlessures = async (): Promise<Blessure[]> =>
  (await db()).getAll('sportBlessures');

/**
 * Rouvre une blessure refermée trop tôt.
 *
 * La symétrie n'est pas un confort : une douleur qu'on croyait passée et qui
 * revient est le cas courant, et sans ce chemin on la saisirait comme une
 * **nouvelle** blessure, ce qui ferait paraître récente une gêne ancienne —
 * exactement la distinction sur laquelle le garde-fou s'appuie pour proposer
 * de consulter plutôt que de réduire.
 */
export async function rouvrirBlessure(id: string): Promise<Blessure | null> {
  const base = await db();
  const blessure = await base.get('sportBlessures', id);
  if (!blessure) return null;
  const avec: Blessure = { ...blessure, fin: null, majLe: maintenant() };
  await base.put('sportBlessures', avec);
  await journaliser('sportBlessures', avec);
  return avec;
}

export async function supprimerBlessure(id: string): Promise<void> {
  await (await db()).delete('sportBlessures', id);
  await journaliserSuppression([`sportBlessures:${id}`]);
}

/** Referme la phase en cours, s'il y en a une. Une seule phase court à la fois. */
export async function cloreLaPhaseEnCours(le = new Date()): Promise<void> {
  const base = await db();
  for (const phase of await base.getAll('sportPhases')) {
    if (phase.fin !== null) continue;
    const avec: Phase = { ...phase, fin: le.toISOString(), majLe: maintenant() };
    await base.put('sportPhases', avec);
    await journaliser('sportPhases', avec);
  }
}

export async function supprimerPhase(id: string): Promise<void> {
  await (await db()).delete('sportPhases', id);
  await journaliserSuppression([`sportPhases:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   La bibliothèque livrée
   ══════════════════════════════════════════════════════════════════════════ */

type Livre = Omit<Exercice, 'id' | 'majLe' | 'fourni'>;

const F = (
  nom: string,
  equipement: string,
  principaux: string[],
  secondaires: string[],
  reste: Partial<Livre> = {},
): Livre => ({
  nom,
  nature: 'force',
  lateralite: 'bilateral',
  equipement,
  variante: '',
  unite: 'kg',
  principaux,
  secondaires,
  ...reste,
});

/**
 * Trente exercices courants.
 *
 * Choisis pour couvrir les dix-huit muscles du schéma avec le moins d'entrées
 * possible, et non pour faire une encyclopédie : une bibliothèque de trois
 * cents exercices est aussi décourageante qu'une bibliothèque vide, parce
 * qu'on y cherche plus longtemps qu'on ne saisirait.
 */
export const BIBLIOTHEQUE: readonly Livre[] = [
  F('Développé couché', 'barre', ['pectoraux'], ['triceps', 'deltoide-anterieur']),
  F('Développé incliné', 'haltères', ['pectoraux'], ['deltoide-anterieur', 'triceps']),
  F('Écarté couché', 'haltères', ['pectoraux'], []),
  F('Dips', 'barres parallèles', ['pectoraux', 'triceps'], ['deltoide-anterieur'], {
    unite: 'corps-leste',
  }),
  F('Développé militaire', 'barre', ['deltoide-anterieur'], ['triceps', 'trapezes']),
  F('Élévations latérales', 'haltères', ['deltoide-lateral'], []),
  F('Oiseau', 'haltères', ['deltoide-posterieur'], ['trapezes']),
  F('Tractions pronation', 'barre fixe', ['dorsaux'], ['biceps', 'avant-bras'], {
    unite: 'corps-leste',
  }),
  F('Rowing buste penché', 'barre', ['dorsaux'], ['biceps', 'trapezes', 'lombaires']),
  F('Tirage vertical', 'poulie', ['dorsaux'], ['biceps']),
  F('Tirage horizontal', 'poulie', ['dorsaux'], ['biceps', 'trapezes']),
  F('Shrugs', 'haltères', ['trapezes'], ['avant-bras']),
  F('Curl biceps', 'haltères', ['biceps'], ['avant-bras']),
  F('Curl marteau', 'haltères', ['biceps', 'avant-bras'], []),
  F('Extension triceps à la poulie', 'poulie', ['triceps'], []),
  F('Barre au front', 'barre EZ', ['triceps'], []),
  F('Squat', 'barre', ['quadriceps', 'fessiers'], ['ischio-jambiers', 'lombaires', 'abdominaux']),
  F('Presse à cuisses', 'machine', ['quadriceps'], ['fessiers']),
  F('Fentes', 'haltères', ['quadriceps', 'fessiers'], ['ischio-jambiers'], {
    lateralite: 'unilateral',
  }),
  F('Soulevé de terre', 'barre', ['ischio-jambiers', 'lombaires'], ['fessiers', 'dorsaux', 'trapezes']),
  F('Soulevé de terre jambes tendues', 'barre', ['ischio-jambiers'], ['fessiers', 'lombaires']),
  F('Leg curl', 'machine', ['ischio-jambiers'], []),
  F('Hip thrust', 'barre', ['fessiers'], ['ischio-jambiers']),
  F('Adducteurs à la machine', 'machine', ['adducteurs'], []),
  F('Mollets debout', 'machine', ['mollets'], []),
  F('Extensions lombaires', 'banc à lombaires', ['lombaires'], ['fessiers'], { unite: 'corps-leste' }),
  {
    nom: 'Gainage ventral',
    nature: 'gainage',
    lateralite: 'bilateral',
    equipement: 'sol',
    variante: '',
    unite: 'duree',
    principaux: ['abdominaux'],
    secondaires: ['obliques', 'lombaires'],
  },
  {
    nom: 'Gainage latéral',
    nature: 'gainage',
    lateralite: 'unilateral',
    equipement: 'sol',
    variante: '',
    unite: 'duree',
    principaux: ['obliques'],
    secondaires: ['abdominaux'],
  },
  {
    nom: 'Relevés de jambes suspendu',
    nature: 'force',
    lateralite: 'bilateral',
    equipement: 'barre fixe',
    variante: '',
    unite: 'corps',
    principaux: ['abdominaux'],
    secondaires: ['obliques', 'avant-bras'],
  },
  /*
     Le cou n'était travaillé par aucun exercice livré, et l'essai l'a vu : un
     muscle du schéma sur lequel rien n'est cliquable est une case du corps où
     l'on ne peut rien noter sans créer d'abord son exercice.
  */
  F('Extensions du cou', 'sangle de tête', ['cou'], ['trapezes']),
  {
    nom: 'Course',
    nature: 'cardio',
    lateralite: 'bilateral',
    equipement: 'extérieur',
    variante: '',
    unite: 'duree',
    principaux: ['quadriceps', 'mollets'],
    secondaires: ['ischio-jambiers', 'fessiers'],
  },
];

/**
 * Pose la bibliothèque livrée si le magasin est vide.
 *
 * **Si le magasin est vide**, et pas « si les exercices fournis manquent » :
 * quelqu'un qui a supprimé un exercice livré ne doit pas le voir revenir à la
 * prochaine ouverture. Un logiciel qui remet ce qu'on a enlevé est un logiciel
 * contre lequel on lutte.
 */
export async function installerBibliotheque(): Promise<number> {
  const base = await db();
  if ((await base.count('sportExercices')) > 0) return 0;
  for (const livre of BIBLIOTHEQUE) {
    await ecrireExercice({ ...livre, fourni: true });
  }
  return BIBLIOTHEQUE.length;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les programmes
   ══════════════════════════════════════════════════════════════════════════ */

export type ProgrammeNeuf = Omit<Programme, 'id' | 'majLe'> & Partial<Pick<Programme, 'id'>>;

/**
 * Écrit un programme, et **désactive les autres** s'il devient actif.
 *
 * Deux programmes actifs à la fois n'auraient pas de sens : « le programme que
 * je suis » est au singulier, et c'est lui que la séance en direct propose au
 * démarrage. Laisser l'invariant à la charge de l'écran le casserait le jour
 * où un second écran écrirait un programme.
 */
export async function ecrireProgramme(neuf: ProgrammeNeuf): Promise<Programme> {
  const programme: Programme = { ...neuf, id: neuf.id ?? ulid(), majLe: maintenant() };
  const problemes = controlerProgramme(programme);
  if (problemes.length) throw new Error(problemes.join(' '));

  const base = await db();
  await base.put('sportProgrammes', programme);
  await journaliser('sportProgrammes', programme);

  if (programme.actif) {
    for (const autre of await base.getAll('sportProgrammes')) {
      if (autre.id === programme.id || !autre.actif) continue;
      const eteint = { ...autre, actif: false, majLe: maintenant() };
      await base.put('sportProgrammes', eteint);
      await journaliser('sportProgrammes', eteint);
    }
  }
  return programme;
}

export async function supprimerProgramme(id: string): Promise<void> {
  await (await db()).delete('sportProgrammes', id);
  await journaliserSuppression([`sportProgrammes:${id}`]);
}

export const tousLesProgrammes = async (): Promise<Programme[]> =>
  (await db()).getAll('sportProgrammes');

export const programmeActif = async (): Promise<Programme | undefined> =>
  (await tousLesProgrammes()).find((p) => p.actif);
