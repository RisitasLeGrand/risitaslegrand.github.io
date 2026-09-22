/**
 * Rubrique « Actualités » : chargement et déchiffrement.
 *
 * Les actualités sont écrites directement sur la branche publiée par des
 * routines qui tournent dans le nuage. Elles n'ont pas le mot de passe du
 * site : elles chiffrent avec une CLÉ PUBLIQUE publiée à côté des données
 * (« actualites-data/cle-publique.json »). Une routine peut donc publier une
 * actualité, mais jamais relire celles qui existent.
 *
 * La clé privée correspondante est publiée par le build, chiffrée avec le mot
 * de passe du site (« data/actualites-cle.json ») : elle n'est disponible ici
 * qu'après déverrouillage de la session. Rien n'est lisible sur GitHub Pages
 * sans le mot de passe — ni le contenu, ni même les dates, les noms de
 * fichiers étant des empreintes.
 */
import { lien } from './ui';
import { idStable, importerPriveeActualites, ouvrirEnveloppe, type Enveloppe } from './crypto';
import { chargerCleActualites } from './contenu';

export const RACINE_ACTUALITES = lien('/actualites-data');

export type Theme = 'juridique' | 'economique' | 'international';

export interface Source {
  nom: string;
  url: string;
}

export interface ImageActu {
  /** URL d'origine : l'image n'est jamais hébergée dans le dépôt. */
  url: string;
  credit?: string;
}

export interface FicheActu {
  id: string;
  titre: string;
  resume: string;
  sources?: Source[];
  lien_cours?: string;
  /** Termes servant à rattacher l'actualité aux fiches de cours. */
  mots_cles?: string[];
  derniere_maj?: string;
}

export interface ItemActu {
  titre: string;
  theme?: Theme | string;
  resume: string;
  sources?: Source[];
  image?: ImageActu;
  lien_cours?: string;
  /** Termes servant à rattacher l'actualité aux fiches de cours. */
  mots_cles?: string[];
}

export interface PeriodeActu {
  /** Identifiant de période : « semaine », « trimestre » ou « annee » selon le dossier. */
  semaine?: string;
  trimestre?: string;
  annee?: string;
  id?: string;
  periode?: string;
  items?: ItemActu[];
}

/** Les quatre thèmes suivis en continu, dans l'ordre d'affichage. */
export const FICHES_SUIVIES: { id: string; titre: string }[] = [
  { id: 'premier-ministre', titre: 'Premier ministre' },
  { id: 'ministres-finances', titre: 'Ministres économiques et financiers' },
  { id: 'chiffres-economie', titre: "Chiffres clés de l'économie française" },
  { id: 'legislation', titre: 'Changements législatifs majeurs' },
];

export const THEMES: Record<string, { libelle: string; classe: string }> = {
  juridique: {
    libelle: 'Juridique',
    classe: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  },
  economique: {
    libelle: 'Économique',
    classe: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  international: {
    libelle: 'International',
    classe: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
};

export function etiquetteTheme(theme?: string) {
  return (
    THEMES[(theme ?? '').toLowerCase()] ?? {
      libelle: theme || 'Divers',
      classe: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    }
  );
}

let promesseClePrivee: Promise<CryptoKey | null> | null = null;

/**
 * Clé privée de déchiffrement des actualités.
 * Retourne « null » si la rubrique n'a pas été activée sur ce site
 * (« npm run actualites:cles » jamais lancé) : ce n'est pas une erreur.
 */
export function clePriveeActualites(): Promise<CryptoKey | null> {
  promesseClePrivee ??= (async () => {
    try {
      const { privee } = await chargerCleActualites();
      return await importerPriveeActualites(privee);
    } catch {
      return null;
    }
  })();
  return promesseClePrivee;
}

/** Oublie la clé en mémoire : appelé au verrouillage de la session. */
export function oublierCleActualites() {
  promesseClePrivee = null;
}

/**
 * Récupère et déchiffre une entrée de la rubrique.
 *
 * Le nom du fichier publié est l'empreinte de « <dossier>/<id> », calculée de
 * la même façon par le script de chiffrement et par le navigateur : la liste
 * des fichiers en ligne ne révèle donc ni les dates ni les thèmes suivis.
 *
 * Retourne « null » si l'entrée n'existe pas encore (avant le premier passage
 * d'une routine) ou si elle est illisible : l'absence de données n'est jamais
 * une erreur bloquante pour la page.
 */
export async function chargerEntree<T>(dossier: string, id: string): Promise<T | null> {
  const privee = await clePriveeActualites();
  if (!privee) return null;

  const nom = await idStable(`${dossier}/${id}`);
  let reponse: Response;
  try {
    reponse = await fetch(`${RACINE_ACTUALITES}/${dossier}/${nom}.json`, { cache: 'no-cache' });
  } catch {
    return null; // hors ligne, ou fichier absent en développement local
  }
  if (!reponse.ok) return null;

  try {
    const enveloppe = (await reponse.json()) as Enveloppe;
    return await ouvrirEnveloppe<T>(privee, enveloppe);
  } catch {
    // Entrée chiffrée avec une autre paire de clés, ou fichier corrompu.
    console.warn(`Actualités : « ${dossier}/${id} » est illisible avec la clé actuelle.`);
    return null;
  }
}

// --- Semaines ISO ----------------------------------------------------------

/** Numéro de semaine ISO 8601 (la semaine 1 est celle du premier jeudi). */
export function semaineISO(date: Date): { annee: number; semaine: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // On se place sur le jeudi de la semaine courante : son année est l'année ISO.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((d.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7);
  return { annee: d.getUTCFullYear(), semaine };
}

export function idSemaine(date: Date): string {
  const { annee, semaine } = semaineISO(date);
  return `${annee}-W${String(semaine).padStart(2, '0')}`;
}

/** Lundi de la semaine contenant « date ». */
function lundiDe(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jour = d.getDay() || 7; // dimanche = 7
  d.setDate(d.getDate() - (jour - 1));
  return d;
}

/** Identifiants des « nombre » dernières semaines, de la plus récente à la plus ancienne. */
export function dernieresSemaines(nombre: number, depuis = new Date()): string[] {
  const lundi = lundiDe(depuis);
  const ids: string[] = [];
  for (let i = 0; i < nombre; i++) {
    ids.push(idSemaine(lundi));
    lundi.setDate(lundi.getDate() - 7);
  }
  return ids;
}

export function trimestreCourant(date = new Date()): string {
  return `${date.getFullYear()}-T${Math.floor(date.getMonth() / 3) + 1}`;
}

/** Identifiants des « nombre » derniers trimestres, du plus récent au plus ancien. */
export function derniersTrimestres(nombre: number, depuis = new Date()): string[] {
  const ids: string[] = [];
  let annee = depuis.getFullYear();
  let trimestre = Math.floor(depuis.getMonth() / 3) + 1;
  for (let i = 0; i < nombre; i++) {
    ids.push(`${annee}-T${trimestre}`);
    if (--trimestre === 0) {
      trimestre = 4;
      annee--;
    }
  }
  return ids;
}

export function dernieresAnnees(nombre: number, depuis = new Date()): string[] {
  const annee = depuis.getFullYear();
  return Array.from({ length: nombre }, (_, i) => String(annee - i));
}

// --- Chargements de haut niveau -------------------------------------------

export async function chargerFiches(): Promise<FicheActu[]> {
  const fiches = await Promise.all(
    FICHES_SUIVIES.map((f) => chargerEntree<FicheActu>('fiches', f.id)),
  );
  return fiches
    .map((fiche, i) => (fiche ? { ...FICHES_SUIVIES[i], ...fiche } : null))
    .filter((f): f is FicheActu => f !== null);
}

export async function chargerSemaine(id: string): Promise<PeriodeActu | null> {
  return chargerEntree<PeriodeActu>('semaines', id);
}

/**
 * Dernière veille hebdomadaire disponible, en remontant depuis la semaine en
 * cours. Une routine qui n'a pas encore tourné, ou une semaine sans publication,
 * ne doit pas laisser le tableau de bord vide.
 */
export async function chargerDerniereSemaine(
  recul = 6,
): Promise<{ entree: PeriodeActu; id: string; courante: boolean } | null> {
  const ids = dernieresSemaines(recul);
  for (const [rang, id] of ids.entries()) {
    const entree = await chargerSemaine(id);
    if (entree) return { entree, id, courante: rang === 0 };
  }
  return null;
}

/**
 * Récupère les entrées hebdomadaires existantes, de la plus récente à la plus
 * ancienne.
 *
 * GitHub Pages ne permet pas de lister un dossier : on sonde donc les
 * identifiants de semaine en remontant le temps, par petits lots parallèles.
 * Deux garde-fous évitent de lancer la fenêtre entière de requêtes :
 *  - « amorce » : nombre de semaines sondées avant d'abandonner lorsque rien
 *    n'a encore été trouvé (rubrique vide, avant le premier passage d'une
 *    routine) ;
 *  - « tolerance » : nombre de semaines vides consécutives admises après une
 *    trouvaille, qui borne la taille d'une interruption de la veille.
 * Les 404 correspondants sont attendus : ils sont traités comme « pas encore
 * publié », jamais comme une erreur.
 */
export async function chargerSemaines(
  { fenetre = 78, amorce = 16, tolerance = 20, lot = 8 } = {},
): Promise<PeriodeActu[]> {
  const ids = dernieresSemaines(fenetre);
  const trouvees: PeriodeActu[] = [];
  let manquantesConsecutives = 0;

  for (let debut = 0; debut < ids.length; debut += lot) {
    const tranche = ids.slice(debut, debut + lot);
    const resultats = await Promise.all(tranche.map((id) => chargerSemaine(id)));
    for (const [i, entree] of resultats.entries()) {
      if (entree) {
        trouvees.push({ semaine: tranche[i], ...entree });
        manquantesConsecutives = 0;
      } else {
        manquantesConsecutives++;
      }
    }
    if (manquantesConsecutives >= (trouvees.length ? tolerance : amorce)) break;
  }
  return trouvees;
}

/** Charge les entrées d'un dossier de périodes, en ignorant celles qui n'existent pas. */
async function chargerPeriodes(
  dossier: string,
  ids: string[],
  cle: 'trimestre' | 'annee',
): Promise<PeriodeActu[]> {
  const resultats = await Promise.all(ids.map((id) => chargerEntree<PeriodeActu>(dossier, id)));
  const entrees: PeriodeActu[] = [];
  for (const [i, entree] of resultats.entries()) {
    if (entree) entrees.push({ [cle]: ids[i], ...entree });
  }
  return entrees;
}

export async function chargerTrimestres(nombre = 8): Promise<PeriodeActu[]> {
  return chargerPeriodes('trimestres', derniersTrimestres(nombre), 'trimestre');
}

export async function chargerAnnees(nombre = 4): Promise<PeriodeActu[]> {
  return chargerPeriodes('annees', dernieresAnnees(nombre), 'annee');
}

/** Étiquette lisible d'une période, quel que soit le dossier d'origine. */
export function titrePeriode(entree: PeriodeActu): string {
  const id = entree.semaine ?? entree.trimestre ?? entree.annee ?? entree.id ?? '';
  if (entree.periode) return `${id} · ${entree.periode}`;
  return id;
}
