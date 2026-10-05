/**
 * Ce qu'un écran sait de ce qu'on y fait, mis en forme pour un assistant.
 *
 * ## Le site ne contacte aucune IA
 *
 * Il fabrique un texte et le donne à copier. Cette règle n'est pas une
 * promesse mais une propriété du module, garantie de deux façons :
 *
 * - **aucun appel réseau** — un essai parcourt la clôture des imports et
 *   échoue sur `fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource`,
 *   `WebSocket` ou un `import()` d'URL ;
 * - **aucun secret** — ce module n'importe ni `lib/secret`, ni `lib/crypto`,
 *   ni rien qui porte le mot de passe, la clé dérivée, le sel ou les
 *   paramètres de dérivation. Il ne peut donc pas les atteindre, et un essai
 *   le vérifie sur la clôture des imports plutôt que sur le texte produit :
 *   un contrôle de chaîne se contournerait au premier champ ajouté.
 *
 * ## Un contexte est une liste de blocs, et chaque bloc sait quand mourir
 *
 * Le budget est de 8 000 caractères. Quand le contexte dépasse, il faut
 * couper, et **l'ordre de la coupe est une décision pédagogique** : on
 * sacrifie d'abord ce qui parle de moi, ensuite ce qui parle du cours, jamais
 * la question posée ni ce que j'ai répondu. Chaque bloc porte donc son rang,
 * et le constructeur de prompt n'a plus qu'à les retirer du plus sacrifiable
 * au moins.
 */

/** D'où vient la demande. Neuf emplacements, et pas un de plus sans raison. */
export type Provenance =
  | 'quiz-cours'
  | 'qcm-dgfip'
  | 'seance'
  | 'journal'
  | 'flashcard'
  | 'fiche'
  | 'cog-training'
  | 'actualite'
  | 'glossaire';

/**
 * Le rang de sacrifice d'un bloc.
 *
 * 1 ne se coupe jamais — c'est la question et ma réponse, sans quoi la demande
 * n'a plus d'objet. 5 part en premier.
 */
export type Rang = 1 | 2 | 3 | 4 | 5;

export interface Bloc {
  /** Le titre du bloc dans le prompt, sans dièse : le gabarit s'en charge. */
  titre: string;
  texte: string;
  rang: Rang;
}

export interface Contexte {
  provenance: Provenance;
  /** Une ligne disant de quoi il s'agit : l'énoncé, le terme, le titre. */
  sujet: string;
  /**
   * Où l'on se trouve, du plus large au plus étroit : matière, fascicule,
   * fiche — ou la rubrique, pour une banque qui n'a pas de fiche.
   */
  situation: string[];
  blocs: Bloc[];
}

/**
 * Ce qu'un écran doit savoir faire pour offrir le bouton.
 *
 * `construire` est asynchrone parce que la plupart des fournisseurs lisent
 * IndexedDB — le journal, le niveau, les séances — et que le contenu d'une
 * fiche se déchiffre à la demande.
 */
export interface FournisseurDeContexte<Sujet> {
  provenance: Provenance;
  construire(sujet: Sujet, options: OptionsDeContexte): Promise<Contexte>;
}

/** Les trois blocs « moi », que la personne active ou non. */
export interface OptionsDeContexte {
  monNiveau: boolean;
  mesErreurs: boolean;
  mesNotes: boolean;
}

export const OPTIONS_PAR_DEFAUT: OptionsDeContexte = {
  monNiveau: false,
  mesErreurs: false,
  mesNotes: false,
};

/** Un bloc, ou rien du tout si son texte est vide. */
export function bloc(titre: string, texte: string | null | undefined, rang: Rang): Bloc[] {
  const propre = texte?.trim();
  return propre ? [{ titre, texte: propre, rang }] : [];
}

/**
 * Le texte d'un fragment de HTML, pour les extraits de cours.
 *
 * Les fiches sont stockées en HTML ; un prompt n'a que faire des balises, et
 * les y laisser consommerait le budget en pure perte. On ne rend pas le texte
 * brut pour autant : les titres gardent leurs dièses et les listes leurs
 * tirets, parce que la structure d'un cours est une partie de ce qu'il dit.
 */
export function texteDuHtml(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>/gi, (_, n) => `\n\n${'#'.repeat(Number(n))} `)
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|tr|ul|ol|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Le niveau estimé, dit en mots.
 *
 * Jamais le nombre : le site s'astreint déjà à ne pas montrer la note brute,
 * et un prompt qui annoncerait « ma note est 1 247 » demanderait à l'assistant
 * d'interpréter une échelle qu'il ne connaît pas — il inventerait ce qu'elle
 * vaut. Cinq paliers suffisent à dire ce qui sert : à quel point adapter
 * l'explication.
 */
export function niveauEnMots(note: number): string {
  if (note < 1000) return 'débutant sur ce sujet';
  if (note < 1200) return 'des bases fragiles';
  if (note < 1400) return 'un niveau moyen';
  if (note < 1600) return 'un bon niveau';
  return 'un niveau avancé';
}
