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
 * ## Le seuil est 2, et il se dit « moins de deux » et non « plus de un »
 *
 * En français, le singulier vaut jusqu'à DEUX exclu : « 0 jour », « 1 jour »,
 * « 1,25 jour », « 2 jours ». C'est la règle de l'Académie, et la nuance n'est
 * pas théorique : `pluriel` s'écrivait `n > 1`, ce qui met au pluriel dès
 * 1,0001.
 *
 * Trouvé en corrigeant « 1,25 sortie(s) par jour » sur l'écran du budget —
 * une cadence, donc un décimal. Avec `n > 1` il aurait dit « 1,25 sorties ».
 * Le seuil est donc écrit `n >= 2`, ce qui ne change rien aux entiers et
 * corrige les décimaux. Il est écrit une fois, ici, pour que les deux
 * fonctions ne puissent pas en avoir deux idées.
 */

/** Le singulier vaut jusqu'à DEUX exclu : « 1,25 jour », « 2 jours ». */
const auPluriel = (n: number): boolean => n >= 2;

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

/**
 * Un nombre écrit en français : `nombreFr(1234.5, 1)` → « 1 234,5 ».
 *
 * ## Pourquoi ici, à côté des accords
 *
 * Parce que c'est la même question — comment ce nombre S'ÉCRIT en français —
 * et parce que les deux se tiennent : `accorde()` n'existe que parce qu'un
 * nombre mis en forme ne peut pas passer par `pluriel()`. Les avoir dans deux
 * modules obligerait à importer deux fois pour écrire une seule phrase.
 *
 * ## Pourquoi un nombre EXACT de décimales, et non un maximum
 *
 * Parce que cette fonction remplace des `toFixed`, et qu'un remplacement doit
 * montrer les mêmes chiffres. `maximumFractionDigits` seul écrirait « 12,5 € »
 * là où « 12,50 € » était affiché : sur un montant, la décimale muette n'est
 * pas du bruit, c'est la preuve qu'on parle de centimes. Qui veut un maximum
 * passe par `toLocaleString` et le dit.
 *
 * ## Ce que `toFixed` faisait de mal, et que la règle G proscrit
 *
 * Deux choses, et la première est la pire : `toFixed` écrit un POINT décimal
 * — « 12.50 € » dans une phrase française —, et il n'espace pas les milliers,
 * donc « 4128,00 € » là où un œil attend « 4 128,00 € ». On trouvait dans le
 * dépôt le contournement `toFixed(2).replace('.', ',')`, qui corrige la
 * virgule et laisse les milliers collés : à moitié faux, donc plus difficile
 * à voir.
 *
 * L'espace des milliers rendue par `Intl` est une espace FINE INSÉCABLE, et
 * non une espace ordinaire. Un essai qui compare deux chaînes « identiques à
 * l'œil » doit donc normaliser ses blancs — c'est l'assertion de
 * `essais:accords` qui l'a appris, en rendant « obtenu "4 128", attendu
 * "4 128" ».
 */
export function nombreFr(n: number, decimales = 0): string {
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
