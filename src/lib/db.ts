/**
 * Persistance locale (IndexedDB via « idb »).
 * Toute la progression reste dans le navigateur : aucun serveur, aucun compte.
 * L'export/import JSON (page « Progression ») sert à synchroniser manuellement
 * plusieurs appareils.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type Difficulte = 'difficile' | 'moyen' | 'facile';

export interface EtatCarte {
  id: string;
  ficheId: string;
  matiere: string;
  /** Nombre de révisions réussies consécutives (SM-2). */
  repetitions: number;
  /** Intervalle courant, en jours. */
  intervalle: number;
  /** Facteur de facilité SM-2 (>= 1.3). */
  facilite: number;
  /** Prochaine échéance, au format AAAA-MM-JJ. */
  du: string;
  derniereRevision: string | null;
  oublis: number;
  revisions: number;
}

export interface ResultatQuiz {
  id?: number;
  ficheId: string;
  matiere: string;
  le: string;
  bonnes: number;
  total: number;
}

export interface EtatFiche {
  id: string;
  matiere: string;
  lu: boolean;
  derniereOuverture: string | null;
  secondes: number;
}

export interface SessionNBack {
  id?: number;
  le: string;
  /** Identifiant du mode joué : sert à ne comparer que des parties similaires. */
  titre?: string;
  /**
   * « terminee » pour une partie jouée, « jalon » pour la marque posée lors
   * d'un changement de niveau — elle empêche de recompter les mêmes parties.
   */
  statut?: 'terminee' | 'jalon';
  /** Profondeur jouée (n-back). */
  n: number;
  /** Dimensions actives lors de la partie. */
  dimensions: string[];
  nombreEpreuves: number;
  /** Précision équilibrée, de 0 à 1. */
  taux: number;
  reperees: number;
  aReperer: number;
  erreurs: number;
  secondes: number;
}

/**
 * Séance de révision planifiée.
 *
 * Une séance porte sur UN thème de planification et un jour donné. Les
 * restitutions « feuille blanche » sont conservées avec la séance : ce sont
 * elles, et non un décompte calendaire, qui servent à retrouver les séances
 * n-1 et n-2 d'une matière (voir src/lib/planification.ts).
 */
export interface Seance {
  id?: number;
  /** Identifiant du thème de planification. */
  theme: string;
  /** Jour de la séance, au format AAAA-MM-JJ. */
  jour: string;
  statut: 'prevue' | 'terminee';
  termineeLe?: string | null;
  secondes: number;
  /** Note de séance rédigée par la personne (1 à 2 pages visées). */
  note: string;
  /**
   * Restitutions à blanc des séances antérieures, indexées par l'identifiant
   * de la séance restituée.
   */
  restitutions?: Record<string, string>;
  /**
   * Identifiants des fiches réellement couvertes pendant la séance.
   *
   * C'est ce qui permet, aux séances suivantes, de proposer un rappel par
   * flashcards et par QCM portant sur le contenu vraiment vu ce jour-là,
   * et non sur la matière entière.
   */
  fiches?: string[];
  /** Séance étendue du 1er du mois : rappel n-1 à n-4. */
  etendue: boolean;
}

export interface Jour {
  jour: string;
  xp: number;
  cartes: number;
  quiz: number;
  bonnes: number;
  reponses: number;
  secondes: number;
}

/**
 * Historique d'une question de la banque « QCM - DGFiP ».
 * Sert à pondérer le tirage : une question ratée doit revenir plus vite
 * qu'une question sue, sans jamais disparaître complètement du hasard.
 */
export interface EtatQuestionDgfip {
  id: string;
  rubriqueId: string;
  vues: number;
  bonnes: number;
  mauvaises: number;
  abstentions: number;
  derniereLe: string;
}

/** Score par rubrique à l'intérieur d'une session. */
export interface ScoreRubriqueDgfip {
  rubriqueId: string;
  rubrique: string;
  posees: number;
  bonnes: number;
  mauvaises: number;
  abstentions: number;
  points: number;
}

export interface SessionDgfip {
  id?: number;
  le: string;
  posees: number;
  bonnes: number;
  mauvaises: number;
  abstentions: number;
  /** Total au barème +1 / −0,5 / 0, arrondi au demi-point. */
  points: number;
  /** Maximum atteignable sur cette session (= nombre de questions posées). */
  maximum: number;
  parRubrique: ScoreRubriqueDgfip[];
}

export interface Profil {
  xp: number;
  streakCourante: number;
  streakRecord: number;
  dernierJourEtudie: string | null;
  badges: string[];
  creeLe: string;
}

interface SchemaRevinsp extends DBSchema {
  etat: { key: string; value: unknown };
  cartes: { key: string; value: EtatCarte; indexes: { du: string; matiere: string } };
  fiches: { key: string; value: EtatFiche };
  quiz: { key: number; value: ResultatQuiz; indexes: { le: string } };
  jours: { key: string; value: Jour };
  nback: { key: number; value: SessionNBack; indexes: { le: string } };
  seances: { key: number; value: Seance; indexes: { jour: string; theme: string } };
  qcmDgfip: { key: string; value: EtatQuestionDgfip; indexes: { rubriqueId: string } };
  qcmSessions: { key: number; value: SessionDgfip; indexes: { le: string } };
}

const NOM_BASE = 'revinsp';
const VERSION = 4;

let promesse: Promise<IDBPDatabase<SchemaRevinsp>> | null = null;

export function db() {
  promesse ??= openDB<SchemaRevinsp>(NOM_BASE, VERSION, {
    // « ancienneVersion » vaut 0 pour une base neuve. Chaque bloc est donc
    // écrit pour s'appliquer aussi bien à une création qu'à une mise à niveau,
    // sans jamais toucher aux données déjà enregistrées.
    upgrade(base, ancienneVersion) {
      if (ancienneVersion < 1) {
        base.createObjectStore('etat');
        const cartes = base.createObjectStore('cartes', { keyPath: 'id' });
        cartes.createIndex('du', 'du');
        cartes.createIndex('matiere', 'matiere');
        base.createObjectStore('fiches', { keyPath: 'id' });
        const quiz = base.createObjectStore('quiz', { keyPath: 'id', autoIncrement: true });
        quiz.createIndex('le', 'le');
        base.createObjectStore('jours', { keyPath: 'jour' });
      }
      if (ancienneVersion < 2) {
        // Sessions d'entraînement cognitif (Quad N-Back).
        const nback = base.createObjectStore('nback', { keyPath: 'id', autoIncrement: true });
        nback.createIndex('le', 'le');
      }
      if (ancienneVersion < 3) {
        // Séances de révision planifiées.
        const seances = base.createObjectStore('seances', { keyPath: 'id', autoIncrement: true });
        seances.createIndex('jour', 'jour');
        seances.createIndex('theme', 'theme');
      }
      if (ancienneVersion < 4) {
        // Banque « QCM - DGFiP » : historique par question et par session.
        const dgfip = base.createObjectStore('qcmDgfip', { keyPath: 'id' });
        dgfip.createIndex('rubriqueId', 'rubriqueId');
        const sessions = base.createObjectStore('qcmSessions', { keyPath: 'id', autoIncrement: true });
        sessions.createIndex('le', 'le');
      }
    },
  });
  return promesse;
}

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
export function jourISO(date = new Date()): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00`);
  d.setDate(d.getDate() + n);
  return jourISO(d);
}

export function ecartJours(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.round(ms / 86400000);
}

const PROFIL_PAR_DEFAUT: Profil = {
  xp: 0,
  streakCourante: 0,
  streakRecord: 0,
  dernierJourEtudie: null,
  badges: [],
  creeLe: new Date().toISOString(),
};

export async function lireProfil(): Promise<Profil> {
  const base = await db();
  const stocke = (await base.get('etat', 'profil')) as Partial<Profil> | undefined;
  return { ...PROFIL_PAR_DEFAUT, ...(stocke ?? {}) };
}

export async function ecrireProfil(profil: Profil) {
  const base = await db();
  await base.put('etat', profil, 'profil');
}

export async function lireJour(jour: string): Promise<Jour> {
  const base = await db();
  return (
    (await base.get('jours', jour)) ?? {
      jour,
      xp: 0,
      cartes: 0,
      quiz: 0,
      bonnes: 0,
      reponses: 0,
      secondes: 0,
    }
  );
}

export async function majJour(jour: string, delta: Partial<Omit<Jour, 'jour'>>) {
  const base = await db();
  const actuel = await lireJour(jour);
  await base.put('jours', {
    ...actuel,
    xp: actuel.xp + (delta.xp ?? 0),
    cartes: actuel.cartes + (delta.cartes ?? 0),
    quiz: actuel.quiz + (delta.quiz ?? 0),
    bonnes: actuel.bonnes + (delta.bonnes ?? 0),
    reponses: actuel.reponses + (delta.reponses ?? 0),
    secondes: actuel.secondes + (delta.secondes ?? 0),
  });
}

export async function tousLesJours(): Promise<Jour[]> {
  const base = await db();
  return (await base.getAll('jours')).sort((a, b) => a.jour.localeCompare(b.jour));
}

export async function toutesLesCartes(): Promise<EtatCarte[]> {
  return (await db()).getAll('cartes');
}

export async function lireCarte(id: string): Promise<EtatCarte | undefined> {
  return (await db()).get('cartes', id);
}

export async function ecrireCarte(carte: EtatCarte) {
  await (await db()).put('cartes', carte);
}

export async function lireEtatFiche(id: string): Promise<EtatFiche | undefined> {
  return (await db()).get('fiches', id);
}

export async function tousLesEtatsFiches(): Promise<EtatFiche[]> {
  return (await db()).getAll('fiches');
}

export async function ecrireEtatFiche(etat: EtatFiche) {
  await (await db()).put('fiches', etat);
}

export async function ajouterResultatQuiz(resultat: ResultatQuiz) {
  await (await db()).add('quiz', resultat);
}

export async function tousLesResultatsQuiz(): Promise<ResultatQuiz[]> {
  return (await db()).getAll('quiz');
}

export async function ajouterSessionNBack(session: SessionNBack) {
  await (await db()).add('nback', session);
}

export async function toutesLesSessionsNBack(): Promise<SessionNBack[]> {
  return (await db()).getAll('nback');
}

/* --- Séances de révision -------------------------------------------------- */

// --- Banque « QCM - DGFiP » -------------------------------------------------

export async function etatsQuestionsDgfip(): Promise<EtatQuestionDgfip[]> {
  return (await db()).getAll('qcmDgfip');
}

/**
 * Enregistre en une transaction le passage d'une session : l'historique de
 * chaque question posée, puis la session elle-même.
 */
export async function enregistrerSessionDgfip(
  session: SessionDgfip,
  reponses: { id: string; rubriqueId: string; issue: 'bonne' | 'mauvaise' | 'abstention' }[],
): Promise<number> {
  const base = await db();
  const tx = base.transaction(['qcmDgfip', 'qcmSessions'], 'readwrite');
  const magasin = tx.objectStore('qcmDgfip');
  for (const reponse of reponses) {
    const ancien = await magasin.get(reponse.id);
    const etat: EtatQuestionDgfip = ancien ?? {
      id: reponse.id,
      rubriqueId: reponse.rubriqueId,
      vues: 0,
      bonnes: 0,
      mauvaises: 0,
      abstentions: 0,
      derniereLe: session.le,
    };
    etat.rubriqueId = reponse.rubriqueId;
    etat.vues += 1;
    if (reponse.issue === 'bonne') etat.bonnes += 1;
    else if (reponse.issue === 'mauvaise') etat.mauvaises += 1;
    else etat.abstentions += 1;
    etat.derniereLe = session.le;
    await magasin.put(etat);
  }
  const { id: _ignore, ...sansId } = session;
  const id = await tx.objectStore('qcmSessions').add(sansId as SessionDgfip);
  await tx.done;
  return id as number;
}

export async function toutesLesSessionsDgfip(): Promise<SessionDgfip[]> {
  return (await db()).getAll('qcmSessions');
}

export async function toutesLesSeances(): Promise<Seance[]> {
  const seances = await (await db()).getAll('seances');
  return seances.sort((a, b) => a.jour.localeCompare(b.jour) || (a.id ?? 0) - (b.id ?? 0));
}

export async function lireSeance(id: number): Promise<Seance | undefined> {
  return (await db()).get('seances', id);
}

/** Crée ou met à jour une séance et retourne son identifiant. */
export async function ecrireSeance(seance: Seance): Promise<number> {
  const base = await db();
  return (await base.put('seances', seance)) as number;
}

export async function supprimerSeance(id: number) {
  await (await db()).delete('seances', id);
}

/* --- Réglages de session -------------------------------------------------- */

/**
 * Plafonds de session.
 *
 * Le site est dense : à ce jour plus de deux mille flashcards et neuf cents
 * questions. Présenter d'un coup tout ce qui est « dû » rendrait la moindre
 * reprise décourageante. On plafonne donc chaque session, en servant d'abord
 * les éléments les plus en retard.
 */
export interface ReglagesSession {
  plafondCartes: number;
  plafondQuestions: number;
}

export const REGLAGES_SESSION_PAR_DEFAUT: ReglagesSession = {
  plafondCartes: 25,
  plafondQuestions: 20,
};

export async function lireReglagesSession(): Promise<ReglagesSession> {
  const base = await db();
  const stockes = (await base.get('etat', 'reglagesSession')) as Partial<ReglagesSession> | undefined;
  const fusion = { ...REGLAGES_SESSION_PAR_DEFAUT, ...(stockes ?? {}) };
  // Un réglage aberrant ne doit pas pouvoir vider ou saturer une session.
  return {
    plafondCartes: Math.min(200, Math.max(5, Math.round(fusion.plafondCartes))),
    plafondQuestions: Math.min(200, Math.max(5, Math.round(fusion.plafondQuestions))),
  };
}

export async function ecrireReglagesSession(reglages: ReglagesSession) {
  await (await db()).put('etat', reglages, 'reglagesSession');
}

/* --- Réglages de planification -------------------------------------------- */

export interface ReglagesPlanification {
  /** Thème proposé pour chaque jour de la semaine, index 0 = dimanche. */
  rotation: string[];
  /** Dernier trimestre pour lequel la suggestion a été écartée (ex. « 2026-T1 »). */
  trimestreEcarte: string | null;
}

export async function lireReglagesPlanification(): Promise<ReglagesPlanification | null> {
  const base = await db();
  return ((await base.get('etat', 'planification')) as ReglagesPlanification | undefined) ?? null;
}

export async function ecrireReglagesPlanification(reglages: ReglagesPlanification) {
  await (await db()).put('etat', reglages, 'planification');
}

/** Sérialise l'intégralité de la progression (export JSON). */
export async function exporterTout() {
  const base = await db();
  return {
    format: 'revinsp-progression',
    version: 1,
    exporteLe: new Date().toISOString(),
    profil: await lireProfil(),
    cartes: await base.getAll('cartes'),
    fiches: await base.getAll('fiches'),
    quiz: await base.getAll('quiz'),
    jours: await base.getAll('jours'),
    nback: await base.getAll('nback'),
    seances: await base.getAll('seances'),
    qcmDgfip: await base.getAll('qcmDgfip'),
    qcmSessions: await base.getAll('qcmSessions'),
    planification: await lireReglagesPlanification(),
    reglagesSession: (await base.get('etat', 'reglagesSession')) as ReglagesSession | undefined,
  };
}

export type ExportProgression = Awaited<ReturnType<typeof exporterTout>>;

/**
 * Importe une sauvegarde.
 *  - mode « fusion » : conserve l'état le plus avancé pour chaque élément ;
 *  - mode « remplacement » : écrase toute la progression locale.
 */
export async function importerTout(donnees: ExportProgression, mode: 'fusion' | 'remplacement') {
  if (donnees?.format !== 'revinsp-progression') {
    throw new Error('Ce fichier n\'est pas une sauvegarde de progression valide.');
  }
  const base = await db();

  if (mode === 'remplacement') {
    const tx = base.transaction(
      ['etat', 'cartes', 'fiches', 'quiz', 'jours', 'seances', 'qcmDgfip', 'qcmSessions'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('etat').clear(),
      tx.objectStore('cartes').clear(),
      tx.objectStore('fiches').clear(),
      tx.objectStore('quiz').clear(),
      tx.objectStore('jours').clear(),
      tx.objectStore('seances').clear(),
      tx.objectStore('qcmDgfip').clear(),
      tx.objectStore('qcmSessions').clear(),
    ]);
    await tx.done;
  }

  const profilLocal = await lireProfil();
  const profilImporte = { ...PROFIL_PAR_DEFAUT, ...(donnees.profil ?? {}) };
  await ecrireProfil(
    mode === 'remplacement'
      ? profilImporte
      : {
          ...profilLocal,
          xp: Math.max(profilLocal.xp, profilImporte.xp),
          streakCourante: Math.max(profilLocal.streakCourante, profilImporte.streakCourante),
          streakRecord: Math.max(profilLocal.streakRecord, profilImporte.streakRecord),
          dernierJourEtudie: [profilLocal.dernierJourEtudie, profilImporte.dernierJourEtudie]
            .filter(Boolean)
            .sort()
            .pop() as string | null,
          badges: [...new Set([...profilLocal.badges, ...profilImporte.badges])],
          creeLe: [profilLocal.creeLe, profilImporte.creeLe].filter(Boolean).sort()[0],
        },
  );

  for (const carte of donnees.cartes ?? []) {
    const locale = mode === 'fusion' ? await base.get('cartes', carte.id) : undefined;
    // En fusion, on garde la révision la plus récente.
    const gagnante =
      locale && (locale.derniereRevision ?? '') > (carte.derniereRevision ?? '') ? locale : carte;
    await base.put('cartes', gagnante);
  }

  for (const fiche of donnees.fiches ?? []) {
    const locale = mode === 'fusion' ? await base.get('fiches', fiche.id) : undefined;
    await base.put('fiches', {
      ...fiche,
      lu: Boolean(locale?.lu || fiche.lu),
      secondes: Math.max(locale?.secondes ?? 0, fiche.secondes ?? 0),
      derniereOuverture: [locale?.derniereOuverture, fiche.derniereOuverture]
        .filter(Boolean)
        .sort()
        .pop() as string | null,
    });
  }

  if (mode === 'fusion') {
    // Les résultats de quiz sont des événements : on ne dédoublonne que par
    // couple (fiche, horodatage) pour éviter les doublons d'import répété.
    const existants = new Set((await base.getAll('quiz')).map((q) => `${q.ficheId}|${q.le}`));
    for (const q of donnees.quiz ?? []) {
      if (existants.has(`${q.ficheId}|${q.le}`)) continue;
      const { id: _ignore, ...sansId } = q;
      await base.add('quiz', sansId as ResultatQuiz);
    }
    // Les séances sont identifiées par le couple (jour, thème) : deux séances
    // du même thème le même jour sont forcément la même.
    const seancesExistantes = new Set((await base.getAll('seances')).map((s) => `${s.jour}|${s.theme}`));
    for (const seance of donnees.seances ?? []) {
      if (seancesExistantes.has(`${seance.jour}|${seance.theme}`)) continue;
      const { id: _ignore, ...sansId } = seance;
      await base.add('seances', sansId as Seance);
    }
    const sessionsExistantes = new Set((await base.getAll('nback')).map((s) => s.le));
    for (const session of donnees.nback ?? []) {
      if (sessionsExistantes.has(session.le)) continue;
      const { id: _ignore, ...sansId } = session;
      await base.add('nback', sansId as SessionNBack);
    }
    // QCM DGFiP : les compteurs par question s'additionnent, l'appareil le
    // plus avancé n'étant pas forcément le même selon la question.
    for (const etat of donnees.qcmDgfip ?? []) {
      const local = await base.get('qcmDgfip', etat.id);
      await base.put('qcmDgfip', {
        id: etat.id,
        rubriqueId: etat.rubriqueId || local?.rubriqueId || '',
        vues: Math.max(local?.vues ?? 0, etat.vues),
        bonnes: Math.max(local?.bonnes ?? 0, etat.bonnes),
        mauvaises: Math.max(local?.mauvaises ?? 0, etat.mauvaises),
        abstentions: Math.max(local?.abstentions ?? 0, etat.abstentions),
        derniereLe:
          !local || etat.derniereLe > local.derniereLe ? etat.derniereLe : local.derniereLe,
      });
    }
    const sessionsDgfipExistantes = new Set((await base.getAll('qcmSessions')).map((s) => s.le));
    for (const session of donnees.qcmSessions ?? []) {
      if (sessionsDgfipExistantes.has(session.le)) continue;
      const { id: _ignore, ...sansId } = session;
      await base.add('qcmSessions', sansId as SessionDgfip);
    }
    for (const j of donnees.jours ?? []) {
      const local = await base.get('jours', j.jour);
      await base.put('jours', {
        jour: j.jour,
        xp: Math.max(local?.xp ?? 0, j.xp),
        cartes: Math.max(local?.cartes ?? 0, j.cartes),
        quiz: Math.max(local?.quiz ?? 0, j.quiz),
        bonnes: Math.max(local?.bonnes ?? 0, j.bonnes),
        reponses: Math.max(local?.reponses ?? 0, j.reponses),
        secondes: Math.max(local?.secondes ?? 0, j.secondes),
      });
    }
  } else {
    for (const q of donnees.quiz ?? []) {
      const { id: _ignore, ...sansId } = q;
      await base.add('quiz', sansId as ResultatQuiz);
    }
    for (const j of donnees.jours ?? []) await base.put('jours', j);
    for (const session of donnees.nback ?? []) {
      const { id: _ignore, ...sansId } = session;
      await base.add('nback', sansId as SessionNBack);
    }
    for (const seance of donnees.seances ?? []) {
      const { id: _ignore, ...sansId } = seance;
      await base.add('seances', sansId as Seance);
    }
    for (const etat of donnees.qcmDgfip ?? []) await base.put('qcmDgfip', etat);
    for (const session of donnees.qcmSessions ?? []) {
      const { id: _ignore, ...sansId } = session;
      await base.add('qcmSessions', sansId as SessionDgfip);
    }
  }

  if (donnees.planification) await ecrireReglagesPlanification(donnees.planification);
  if (donnees.reglagesSession) await ecrireReglagesSession(donnees.reglagesSession);
}

/** Efface toute la progression locale (bouton « tout réinitialiser »). */
export async function toutEffacer() {
  const base = await db();
  const tx = base.transaction(
    ['etat', 'cartes', 'fiches', 'quiz', 'jours', 'nback', 'seances', 'qcmDgfip', 'qcmSessions'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('etat').clear(),
    tx.objectStore('cartes').clear(),
    tx.objectStore('fiches').clear(),
    tx.objectStore('quiz').clear(),
    tx.objectStore('jours').clear(),
    tx.objectStore('nback').clear(),
    tx.objectStore('seances').clear(),
    tx.objectStore('qcmDgfip').clear(),
    tx.objectStore('qcmSessions').clear(),
  ]);
  await tx.done;
}
