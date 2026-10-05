/**
 * Des mots-fantômes français : des noms plausibles qui ne veulent rien dire.
 *
 * Pourquoi ne pas employer des mots réels. Un exercice relationnel mesure la
 * capacité à **inférer** une structure, et un mot connu apporte avec lui tout
 * ce qu'on sait déjà. « Le chat est avant le tigre » se résout en partie par
 * autre chose que les prémisses — c'est le biais de croyance, et il est d'autant
 * plus gênant que la personne ne s'en aperçoit pas.
 *
 * Pourquoi ne pas employer `A`, `B`, `C` partout non plus. Des lettres sont
 * neutres mais pauvres : elles ne se retiennent pas, et sur six entités l'œil
 * les confond. Un mot prononçable tient en mémoire de travail, ce qui est
 * précisément la ressource que l'on veut exercer sur la *structure* et non sur
 * l'étiquetage.
 *
 * D'où des pseudo-mots **phonotactiquement français** : une attaque, un noyau,
 * parfois une coda, assemblés en deux ou trois syllabes. On les veut lisibles à
 * voix haute par un francophone, et dépourvus de sens.
 */
import type { Alea } from '../systemes/types';

/** Attaques courantes en français, consonnes simples et groupes licites. */
const ATTAQUES = [
  'b', 'd', 'f', 'g', 'j', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v',
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr', 'vr',
];

/** Noyaux : voyelles et digrammes vocaliques du français. */
const NOYAUX = ['a', 'e', 'i', 'o', 'u', 'ai', 'ei', 'ou', 'eu', 'oi', 'an', 'on', 'in'];

/** Codas admises en fin de mot. Vide le plus souvent : le français aime l'ouvert. */
const CODAS = ['', '', '', '', 'l', 'r', 'n', 's', 'le', 'rd', 'nt'];

/**
 * Les suites que l'on refuse, parce qu'elles sonnent étranger ou se lisent mal.
 *
 * Une voyelle nasale suivie d'une voyelle (« ana », « oni ») dénasalise à la
 * lecture et trahit la construction ; un doublement de la même voyelle produit
 * des formes qu'aucun lecteur français n'attaque spontanément.
 */
const INTERDITS = /(an|on|in)[aeiou]|([aeiou])\2|qu[^ieéè]|^[aeiou]/;

/**
 * Des mots réels qu'il serait fâcheux de produire par hasard.
 *
 * La liste est courte à dessein : elle ne couvre pas le lexique français, elle
 * écarte les formes que ce générateur précis atteint souvent. Un mot réel qui
 * passerait malgré tout ne ruine pas l'exercice — il faudrait qu'il entretienne
 * en plus une relation sémantique avec un autre mot du même item —, mais autant
 * éviter ceux que l'on sait produire.
 */
const REELS = new Set([
  'ballon', 'baton', 'bidon', 'bijou', 'bouton', 'brebis', 'briser', 'cailou',
  'canon', 'carton', 'citron', 'coton', 'crayon', 'dindon', 'donner', 'farine',
  'fenil', 'ferme', 'file', 'filon', 'fondre', 'gamin', 'garcon', 'genou',
  'jardin', 'jeton', 'laine', 'larme', 'lundi', 'maison', 'manon', 'marin',
  'melon', 'menton', 'moulin', 'mouton', 'nature', 'navire', 'parle', 'patin',
  'pigeon', 'piton', 'poisson', 'pont', 'poule', 'prison', 'raison', 'rideau',
  'rondin', 'sardine', 'savon', 'semaine', 'tapis', 'tison', 'vallon', 'venir',
  'vigne', 'voisin',
]);

function syllabe(alea: Alea): string {
  return alea.un(ATTAQUES) + alea.un(NOYAUX);
}

function forger(alea: Alea): string {
  // Deux syllabes le plus souvent : trois allonge sans rien ajouter à la
  // mémorabilité, et encombre les étiquettes de graphe.
  const syllabes = alea.reel() < 0.78 ? 2 : 3;
  let mot = '';
  for (let i = 0; i < syllabes; i += 1) mot += syllabe(alea);
  mot += alea.un(CODAS);
  return mot;
}

/**
 * `combien` mots-fantômes distincts, capitalisés.
 *
 * Deux contraintes au-delà de la distinction : des **initiales différentes**, et
 * des longueurs voisines. L'initiale sert de repère quand on relit un énoncé de
 * six prémisses, et deux mots commençant par la même lettre font perdre ce
 * repère au moment précis où l'on en a besoin.
 */
export function motsFantomes(combien: number, alea: Alea): string[] {
  const mots: string[] = [];
  const initiales = new Set<string>();

  for (let essai = 0; essai < 4000 && mots.length < combien; essai += 1) {
    const mot = forger(alea);
    if (mot.length < 4 || mot.length > 8) continue;
    if (INTERDITS.test(mot)) continue;
    if (REELS.has(mot)) continue;
    if (initiales.has(mot[0])) continue;
    initiales.add(mot[0]);
    mots.push(mot[0].toUpperCase() + mot.slice(1));
  }

  // Filet de sécurité : si le tirage s'épuise — ce qui demande un hasard très
  // mal distribué —, on complète par des lettres plutôt que de rendre une liste
  // trop courte, qu'un générateur de système interpréterait comme une erreur.
  const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; mots.length < combien; i += 1) mots.push(LETTRES[i % 26]);

  return mots;
}
