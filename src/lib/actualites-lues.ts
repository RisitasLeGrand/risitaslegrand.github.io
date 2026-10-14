/**
 * Le marqueur « lu / non lu » des actualités (D-039).
 *
 * ## Ce que ce module résout
 *
 * L'archive compte cent neuf articles sur une quarantaine de semaines. Sans
 * marqueur, revenir dessus une semaine plus tard oblige à relire les titres
 * pour retrouver où l'on s'était arrêté — et c'est exactement ce que la
 * critique reprochait à cet écran : « impossible de savoir où l'on en est ».
 *
 * ## La clef, et pourquoi le titre n'y est pas en clair
 *
 * Un item d'actualité n'a pas d'identifiant : il n'a qu'un titre et la
 * période qui le porte. La clef est donc « <période>:<empreinte du titre> ».
 *
 * La période reste lisible — savoir que quelqu'un a lu quelque chose en
 * semaine 40 n'apprend rien. Le titre, lui, est réduit à une empreinte :
 * IndexedDB n'est pas chiffré pour les données de Révisions, et une liste de
 * titres d'actualités en clair sur le disque dirait ce que la personne lit.
 *
 * L'empreinte est un FNV-1a 32 bits, et ce choix se justifie : il ne s'agit
 * pas de résister à une attaque mais d'éviter d'écrire une phrase lisible. La
 * collision est le vrai risque, et il est borné — une dizaine d'items par
 * période, donc une chance sur des dizaines de millions que deux titres de la
 * **même semaine** partagent leur empreinte. Si cela arrivait, deux
 * actualités se marqueraient lues ensemble : gênant, jamais grave.
 *
 * ## Ce qui n'est pas fait, et pourquoi
 *
 * Ouvrir « Lire la suite » ne marque pas l'article comme lu. Déplier une
 * carte pour vérifier une source n'est pas la lire, et un marqueur qui se
 * pose tout seul ne veut plus rien dire au bout d'une semaine.
 */
import { db, type ActualiteLue } from './db';

/** Empreinte FNV-1a 32 bits, en hexadécimal. */
function empreinte(texte: string): string {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** La clef d'un item : sa période, et l'empreinte de son titre. */
export function cleActualite(periode: string, titre: string): string {
  return `${periode}:${empreinte(titre.trim())}`;
}

/** Toutes les clefs marquées lues. Un seul passage, au chargement de l'écran. */
export async function lues(): Promise<Set<string>> {
  try {
    const toutes = await (await db()).getAll('actualitesLues');
    return new Set(toutes.map((l) => l.id));
  } catch {
    /* Base indisponible : l'archive s'affiche sans marqueur plutôt que pas
       du tout. Un confort de lecture ne doit jamais empêcher la lecture. */
    return new Set();
  }
}

/** Marque ou démarque une actualité. Rend l'état obtenu. */
export async function marquer(cle: string, lu: boolean): Promise<boolean> {
  const base = await db();
  if (lu) {
    const ligne: ActualiteLue = { id: cle, luLe: new Date().toISOString() };
    await base.put('actualitesLues', ligne);
  } else {
    await base.delete('actualitesLues', cle);
  }
  return lu;
}
