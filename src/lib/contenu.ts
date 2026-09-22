/**
 * Chargement du contenu chiffré et mise en cache mémoire après déchiffrement.
 * Rien n'est jamais écrit en clair sur le disque : tout reste en mémoire vive
 * pour la durée de l'onglet.
 */
import { dechiffrerJson, type Blob as BlobChiffre, type ParametresCle } from './crypto';
import { obtenirCle } from './auth';

export interface FicheResume {
  id: string;
  titre: string;
  ordre: number;
  tags: string[];
  nbFlashcards: number;
  nbQuiz: number;
  nbMots: number;
  aCours: boolean;
  aFiche: boolean;
}

export interface Fascicule {
  id: string;
  nom: string;
  fiches: FicheResume[];
}

export interface Matiere {
  id: string;
  nom: string;
  fascicules: Fascicule[];
}

export interface Manifeste {
  genereLe: string;
  matieres: Matiere[];
  totaux: { fiches: number; flashcards: number; quiz: number; termesGlossaire: number };
}

export interface Flashcard {
  id: string;
  question: string;
  reponse: string;
}

export interface QuestionQuiz {
  id: string;
  question: string;
  options: string[];
  bonnes: number[];
  explication?: string;
}

export interface Fiche {
  id: string;
  titre: string;
  matiere: string;
  fascicule: string;
  tags: string[];
  coursHtml: string;
  ficheHtml: string;
  sommaire: { niveau: number; id: string; titre: string }[];
  flashcards: Flashcard[];
  quiz: QuestionQuiz[];
}

export interface TermeGlossaire {
  id: string;
  terme: string;
  definition: string;
}

export interface EntreeRecherche {
  id: string;
  titre: string;
  matiere: string;
  fascicule: string;
  tags: string[];
  texte: string;
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const urlData = (chemin: string) => `${base}/data/${chemin}`;

const cache = new Map<string, unknown>();

export async function chargerParametresCle(): Promise<ParametresCle> {
  const reponse = await fetch(urlData('cle.json'), { cache: 'no-cache' });
  if (!reponse.ok) throw new Error('Paramètres de chiffrement introuvables (data/cle.json).');
  return reponse.json();
}

/** Récupère un fichier chiffré et le déchiffre, avec cache mémoire. */
async function charger<T>(chemin: string): Promise<T> {
  if (cache.has(chemin)) return cache.get(chemin) as T;
  const cle = await obtenirCle();
  if (!cle) throw new Error('Session verrouillée.');
  const reponse = await fetch(urlData(chemin));
  if (!reponse.ok) throw new Error(`Contenu introuvable : ${chemin}`);
  const blob: BlobChiffre = await reponse.json();
  const valeur = await dechiffrerJson<T>(cle, blob);
  cache.set(chemin, valeur);
  return valeur;
}

export const chargerManifeste = () => charger<Manifeste>('manifeste.json');
export const chargerFiche = (id: string) => charger<Fiche>(`fiches/${id}.json`);
export const chargerGlossaire = () => charger<TermeGlossaire[]>('glossaire.json');
export const chargerIndexRecherche = () => charger<EntreeRecherche[]>('recherche.json');

/** Vide le cache mémoire (au verrouillage de la session). */
export function viderCache() {
  cache.clear();
}

/** Liste à plat de toutes les fiches, avec leur matière et leur fascicule. */
export function aplatirFiches(manifeste: Manifeste) {
  return manifeste.matieres.flatMap((m) =>
    m.fascicules.flatMap((f) =>
      f.fiches.map((fiche) => ({
        ...fiche,
        matiere: m.nom,
        matiereId: m.id,
        fascicule: f.nom,
        fasciculeId: f.id,
      })),
    ),
  );
}

export type FicheAplatie = ReturnType<typeof aplatirFiches>[number];
