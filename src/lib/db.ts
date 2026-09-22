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

export interface Jour {
  jour: string;
  xp: number;
  cartes: number;
  quiz: number;
  bonnes: number;
  reponses: number;
  secondes: number;
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
}

const NOM_BASE = 'revinsp';
const VERSION = 1;

let promesse: Promise<IDBPDatabase<SchemaRevinsp>> | null = null;

export function db() {
  promesse ??= openDB<SchemaRevinsp>(NOM_BASE, VERSION, {
    upgrade(base) {
      base.createObjectStore('etat');
      const cartes = base.createObjectStore('cartes', { keyPath: 'id' });
      cartes.createIndex('du', 'du');
      cartes.createIndex('matiere', 'matiere');
      base.createObjectStore('fiches', { keyPath: 'id' });
      const quiz = base.createObjectStore('quiz', { keyPath: 'id', autoIncrement: true });
      quiz.createIndex('le', 'le');
      base.createObjectStore('jours', { keyPath: 'jour' });
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
    const tx = base.transaction(['etat', 'cartes', 'fiches', 'quiz', 'jours'], 'readwrite');
    await Promise.all([
      tx.objectStore('etat').clear(),
      tx.objectStore('cartes').clear(),
      tx.objectStore('fiches').clear(),
      tx.objectStore('quiz').clear(),
      tx.objectStore('jours').clear(),
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
  }
}

/** Efface toute la progression locale (bouton « tout réinitialiser »). */
export async function toutEffacer() {
  const base = await db();
  const tx = base.transaction(['etat', 'cartes', 'fiches', 'quiz', 'jours'], 'readwrite');
  await Promise.all([
    tx.objectStore('etat').clear(),
    tx.objectStore('cartes').clear(),
    tx.objectStore('fiches').clear(),
    tx.objectStore('quiz').clear(),
    tx.objectStore('jours').clear(),
  ]);
  await tx.done;
}
