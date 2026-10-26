/**
 * LIRE UN MAGASIN SCELLÉ SANS QU'UNE SEULE ENTRÉE ÉTRANGÈRE EMPORTE LE RESTE.
 *
 * ## Le défaut, et il n'est pas théorique
 *
 * Les lecteurs ouvraient leurs entrées par `Promise.all(rangees.map(ouvrir))`.
 * Cette forme rejette **au premier échec** : une seule entrée illisible — un
 * scellé venu d'un autre appareil, ou d'un coffre précédent de celui-ci — et
 * c'est la lecture ENTIÈRE qui échoue. L'écran ne montre plus rien, alors que
 * les quatre-vingt-dix-neuf autres entrées étaient parfaitement lisibles.
 *
 * Une donnée étrangère rendait donc illisibles les données LOCALES. C'est la
 * seconde moitié du constat B-2 du prompt 58, et c'est celle qui fait le
 * dégât visible.
 *
 * ## Ce que fait cette lecture
 *
 * Elle ouvre tout ce qui s'ouvre, met de côté ce qui ne s'ouvre pas, et le
 * COMPTE. Elle ne supprime rien et ne répare rien : une entrée isolée reste
 * dans son magasin, intacte, et redeviendra lisible le jour où sa clé sera
 * là. « Isoler, c'est écarter, compter et dire ; jamais supprimer. »
 *
 * ## Pourquoi une fonction, et non quinze fois la même forme
 *
 * Parce qu'il y a quinze lectures de ce genre, dans onze fichiers — mesuré en
 * isolant chaque `Promise.all` par équilibrage de parenthèses et en gardant
 * celles dont le corps appelle `ouvrir`. Quinze `allSettled` écrits à la main
 * divergeraient : l'un compterait les isolées, l'autre les avalerait, un
 * troisième les compterait deux fois. C'est la leçon des cinq lecteurs du mot
 * de passe, et je ne la réapprends pas.
 *
 * Le compte, lui, sert à l'écran : il doit pouvoir dire combien d'entrées il
 * n'a pas pu lire, sans prétendre savoir pourquoi.
 */

/** Ce qu'une lecture tolérante rapporte : ce qui s'est ouvert, et le reste. */
export interface LectureTolerante<T> {
  /** Les entrées ouvertes, dans l'ordre du magasin. */
  lues: T[];
  /** Combien n'ont pas pu l'être. Zéro est le cas normal. */
  isolees: number;
}

/**
 * Ouvre ce qui s'ouvre, compte ce qui résiste.
 *
 * `ouvrirUne` est la fonction de déchiffrement du module appelant : on ne la
 * fabrique pas ici, pour que chaque magasin garde la sienne et son typage.
 */
export async function lireEnTolerant<R, T>(
  rangees: readonly R[],
  ouvrirUne: (rangee: R) => Promise<T>,
): Promise<LectureTolerante<T>> {
  const issues = await Promise.allSettled(rangees.map((r) => ouvrirUne(r)));
  const lues: T[] = [];
  let isolees = 0;
  for (const issue of issues) {
    if (issue.status === 'fulfilled') lues.push(issue.value);
    else isolees += 1;
  }
  return { lues, isolees };
}

/**
 * La même, pour les appelants qui ne veulent que la liste.
 *
 * Le compte est perdu, et c'est assumé : un appelant qui n'affiche rien à ce
 * sujet n'a pas à le porter. Il reste que l'entrée isolée ne fait plus tomber
 * les autres, ce qui est le point.
 */
export async function lireCeQuiSOuvre<R, T>(
  rangees: readonly R[],
  ouvrirUne: (rangee: R) => Promise<T>,
): Promise<T[]> {
  return (await lireEnTolerant(rangees, ouvrirUne)).lues;
}
