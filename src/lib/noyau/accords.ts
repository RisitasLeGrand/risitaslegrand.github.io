/**
 * Les accords de nombre : un nom, un adjectif, un participe (G4 du 61).
 *
 * ## Pourquoi un module pur, et pas deux lignes dans `ui.ts`
 *
 * `pluriel()` vivait dans `lib/ui.ts`, qui appelle `zoneDesNotifications()`
 * **à l'import** : importer `ui.ts` hors d'un navigateur jette. La seule
 * fonction d'accord du site était donc impossible à éprouver autrement qu'à
 * l'écran, et elle ne l'était par personne.
 *
 * Elle vient donc ici, dans `noyau/`, où vivent les règles qui se mesurent
 * sans navigateur. `ui.ts` la réexporte : aucun appelant ne change, et il y
 * en a des dizaines.
 *
 * ## Pourquoi `accorde` existe
 *
 * `pluriel(2, 'jour')` rend « 2 jours ». Mais une phrase française accorde
 * aussi ce qui suit : « 2 cartes **suivies** », « 8 enregistrements
 * **écrits** », « 2 bases **annexes** ». Faute de compagnon, le dépôt
 * écrivait soit la forme interdite — « carte(s) suivie(s) » —, soit six fois
 * le même ternaire à la main.
 *
 * Les deux fonctions sont séparées parce qu'elles ne répondent pas à la même
 * question. `pluriel` rend **le nombre et le nom** ; `accorde` rend **le seul
 * mot accordé**, sans nombre, pour ce qui suit le nom. Une seule fonction qui
 * ferait les deux obligerait à lui passer un nombre qu'elle n'afficherait
 * pas, et l'appelant finirait par le lui passer deux fois.
 *
 * ## Le seuil est 2, et il n'est pas discutable ici
 *
 * En français, zéro et un prennent le singulier : « 0 jour », « 1 jour »,
 * « 2 jours ». C'est la règle de l'Académie, et c'est aussi ce que faisait
 * déjà `pluriel`. Elle est écrite une fois, ici, pour que les deux fonctions
 * ne puissent pas en avoir deux idées.
 */

/** Le singulier vaut jusqu'à 1 inclus : « 0 jour », « 1 jour », « 2 jours ». */
const auPluriel = (n: number): boolean => n > 1;

/**
 * Le nombre et son nom, accordés : `pluriel(2, 'jour')` → « 2 jours ».
 *
 * Le nombre est rendu **brut**. Qui a besoin d'une mise en forme française —
 * « 4 128 » plutôt que « 4128 », parce qu'un grand nombre arrête une main que
 * l'autre n'arrête pas — ne peut pas passer par ici : il compose lui-même son
 * nombre avec `accorde()`. C'est dit plutôt que découvert.
 */
export function pluriel(n: number, singulier: string, plurielForme = `${singulier}s`): string {
  return `${n} ${auPluriel(n) ? plurielForme : singulier}`;
}

/**
 * Le seul mot accordé, sans nombre : `accorde(2, 'suivie')` → « suivies ».
 *
 * Pour ce qui suit le nom — un adjectif, un participe, un second nom :
 *
 *     `${pluriel(n, 'carte')} ${accorde(n, 'suivie')}`   → « 2 cartes suivies »
 *     `${n.toLocaleString('fr-FR')} ${accorde(n, 'enregistrement')}`
 *
 * Le second exemple est le cas qui a fait naître la fonction : un nombre mis
 * en forme ne peut pas passer par `pluriel`, mais son nom doit s'accorder
 * quand même.
 *
 * La forme irrégulière se donne en troisième argument, comme pour `pluriel` :
 * `accorde(n, 'principal', 'principaux')`.
 */
export function accorde(n: number, singulier: string, plurielForme = `${singulier}s`): string {
  return auPluriel(n) ? plurielForme : singulier;
}
