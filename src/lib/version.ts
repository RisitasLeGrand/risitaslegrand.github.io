/**
 * La version de l'application, telle qu'elle est injectée à l'assemblage.
 *
 * ## Le défaut que ce module ferme — B4 du prompt 58
 *
 * `sauvegarde/service.ts` écrivait dans chaque fichier :
 *
 *     versionApplication: (config as { version?: string }).version ?? 'inconnue'
 *
 * Or `site.config.mjs` ne porte AUCUN champ `version`. Toute sauvegarde
 * annonçait donc « inconnue », et l'écran de restauration l'affichait sous
 * l'étiquette « Version de Cyclades ». Pire, `sync/service.ts` écrivait la
 * chaîne littérale `'cyclades'` dans le même champ : ce n'est pas une version
 * fausse, c'est le nom du produit mis à la place d'une version.
 *
 * Le champ n'était donc pas une donnée mais une décoration. Et il sert à
 * quelque chose : quand une restauration se comporte mal, la première question
 * est « de quelle version vient ce fichier ». « Inconnue » ferme la seule
 * piste qui mène quelque part.
 *
 * ## Ce que la version dit, et pourquoi elle dit sa provenance
 *
 * Trois formes possibles, et chacune se reconnaît :
 *
 * - `g1a2b3c4 · 2026-10-31` — l'empreinte courte du commit assemblé et le jour
 *   de l'assemblage. C'est le cas normal, et c'est la seule forme qui permette
 *   de retrouver le code EXACT qui a écrit un fichier ;
 * - ce que `CYCLADES_VERSION` annonce, quand l'assemblage le donne. Une chaîne
 *   publiée, un numéro de version, ce que l'on veut ;
 * - `indéterminée (assemblage hors dépôt)` — un assemblage sans dépôt git et
 *   sans variable. Elle DIT qu'elle ne sait pas, au lieu de prétendre.
 *
 * La troisième forme est volontairement longue et explicite. Un fichier qui la
 * porte se reconnaît d'un coup d'œil, et l'on sait qu'il faut chercher
 * ailleurs — là où « inconnue » laissait croire à un champ jamais rempli.
 *
 * ## La garde
 *
 * `estUneVraieVersion` dit si la valeur vaut quelque chose. `essais:version`
 * l'emploie pour refuser que les anciens placeholders — « inconnue »,
 * « cyclades », une chaîne vide — reviennent par une autre porte. Un champ
 * décoratif se répare une fois ; ce qui empêche de le redevenir, c'est un
 * essai.
 */

/**
 * Remplacée à l'assemblage par `vite.define` (voir `astro.config.mjs`).
 *
 * Le repli n'est pas un défaut mais une nécessité : ce module est importé par
 * des essais qui tournent sous `tsx`, hors de tout assemblage Vite, où la
 * constante n'existe pas. Il est marqué pour ne pas se confondre avec une
 * vraie version.
 */
declare const __VERSION_CYCLADES__: string | undefined;

export const HORS_ASSEMBLAGE = 'hors-assemblage';

/** Ce qu'une version vaut quand rien ne permet de la déterminer. */
export const INDETERMINEE = 'indéterminée (assemblage hors dépôt)';

/**
 * Les valeurs qu'on refuse, et qui ont toutes été écrites pour de vrai.
 *
 * `inconnue` venait du repli de `service.ts`, `cyclades` de `sync/service.ts`.
 * Les nommer ici plutôt que dans l'essai leur donne un seul endroit : une
 * quatrième qui apparaîtrait se refuserait du même coup partout.
 */
export const PLACEHOLDERS_REFUSES: readonly string[] = [
  '',
  'inconnue',
  'cyclades',
  'undefined',
  'null',
  /*
     ET LA MARQUE DU HORS-ASSEMBLAGE, que l'essai m'a fait ajouter ici.

     La distinction avec `INDETERMINEE` est subtile et elle compte.
     `INDETERMINEE` est une réponse d'ASSEMBLAGE : on a construit le site, il
     n'y avait pas de dépôt, et on le dit. Elle a donc sa place dans un
     fichier.

     `HORS_ASSEMBLAGE` veut dire que ce code n'est jamais passé par un
     assemblage du tout — `vite.define` n'a rien remplacé. C'est le cas d'un
     essai sous `tsx`, et c'est légitime là ; dans un fichier livré, c'est le
     signe que quelque chose a écrit une sauvegarde depuis un chemin qui ne
     passe pas par la construction. Elle ne doit donc pas passer pour une
     version, et l'essai le tient.
  */
  HORS_ASSEMBLAGE,
];

export function versionDeLApplication(): string {
  const injectee = typeof __VERSION_CYCLADES__ === 'string' ? __VERSION_CYCLADES__ : undefined;
  if (injectee && injectee.trim() !== '') return injectee;
  return HORS_ASSEMBLAGE;
}

/**
 * Cette valeur peut-elle figurer dans un fichier sans mentir ?
 *
 * `INDETERMINEE` passe, et c'est voulu : elle dit la vérité sur elle-même. Les
 * placeholders ne passent pas, parce qu'ils prétendent être une version.
 */
export function estUneVraieVersion(valeur: unknown): boolean {
  if (typeof valeur !== 'string') return false;
  const v = valeur.trim();
  if (v === '') return false;
  if (PLACEHOLDERS_REFUSES.includes(v.toLowerCase())) return false;
  return true;
}

/**
 * La forme d'une version tirée du dépôt : l'empreinte courte, puis le jour.
 *
 * LE SUFFIXE `-modifie` EN FAIT PARTIE, et il a d'abord manqué. Ma première
 * écriture de cette expression refusait `g4d7df433-modifie · 2026-10-31`, qui
 * est exactement ce que la configuration produit sur un arbre de travail
 * modifié — c'est-à-dire dans le cas le plus courant pendant le développement.
 *
 * L'essai ne l'a pas vu parce qu'il testait l'expression contre une chaîne
 * qu'il RECONSTRUISAIT lui-même, sans le suffixe : il éprouvait sa propre
 * reconstruction et non ce que la configuration écrit. Une forme déclarée doit
 * être confrontée à la valeur réelle, sinon elle décrit une intention.
 */
export const FORME_DEPOT = /^g[0-9a-f]{7,40}(-modifie)? · \d{4}-\d{2}-\d{2}$/;
