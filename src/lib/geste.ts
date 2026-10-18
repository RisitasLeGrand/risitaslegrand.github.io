/**
 * Un geste, une écriture (M6).
 *
 * ## Le défaut visé, et pourquoi il ne se voit pas
 *
 * Mesuré le 18 octobre sur « Valider la série » (`sport/seance.astro`), deux
 * appuis à 0, 60, 150 et 300 ms d'écart : **une seule série écrite à chaque
 * fois**. La protection existe donc déjà — mais par accident.
 *
 * `enregistrerSerie()` vide le champ « Répétitions » après chaque série, et
 * ce champ porte `required` : c'est la validation native du navigateur qui
 * refuse la seconde soumission. Le jour où l'on gardera les répétitions
 * comme on garde déjà la charge — ce qui serait une bonne idée d'ergonomie —
 * le double appui écrira deux séries, en silence, et personne ne reliera la
 * cause à l'effet.
 *
 * Une garantie qui tient par effet de bord n'est pas une garantie. Celle-ci
 * est explicite, et un essai la mord.
 *
 * ## Ce que le garde-fou fait, et pourquoi le recouvrement ne suffisait pas
 *
 * Première version : elle refusait le second appel **tant que le premier
 * n'avait pas fini**, et son commentaire affirmait qu'un délai après coup
 * serait arbitraire — « ce n'est pas le rythme qu'on surveille, c'est le
 * recouvrement ».
 *
 * C'était faux, et la mesure l'a dit en trois minutes. L'accident retiré et
 * ce garde-fou en place, deux appuis à 60, 150 et 300 ms d'écart écrivaient
 * **deux séries**. Écrire une série prend quelques millisecondes : à 60 ms,
 * le premier appel est fini depuis longtemps, il n'y a aucun recouvrement à
 * refuser, et le second passe. Un pouce qui rebondit ne recouvre rien.
 *
 * Le garde-fou a donc deux temps, et il faut les deux :
 *
 * 1. **le recouvrement**, pour les actions lentes, où le second appui tombe
 *    pendant que la première écriture est en cours ;
 * 2. **un repos après la fin**, pour les actions rapides, où le second appui
 *    tombe juste après. Le repos vaut 600 ms par défaut — au-delà du rebond
 *    d'un pouce (moins de 300 ms, mesuré), bien en dessous d'un geste
 *    réfléchi. Un essai vérifie aussi qu'une seconde action **voulue**, une
 *    seconde plus tard, passe : un garde-fou qui accuse à tort se fait
 *    désactiver, et on perd les deux.
 */

/**
 * Le repos après la fin d'une action, en millisecondes.
 *
 * Mesuré : un rebond de pouce arrive en moins de 300 ms. 600 laisse le double
 * de marge sans jamais gêner un geste réfléchi, qui demande de relire l'écran.
 */
const REPOS_MS = 600;

/** Les contrôles dont l'action est en cours, et l'instant de leur dernière fin. */
const enCours = new WeakSet<Element>();
const finiA = new WeakMap<Element, number>();

/** Les mêmes, pour les gestes désignés par une clé plutôt que par un élément. */
const sansControle = new Map<string, boolean>();
const finiAParCle = new Map<string, number>();

/**
 * Exécute `action` une seule fois à la fois pour ce contrôle.
 *
 * Rend ce que l'action a rendu, ou `undefined` si l'appel a été refusé parce
 * qu'un précédent n'était pas terminé. Le bouton est désactivé pendant ce
 * temps : la règle se voit, elle n'est pas seulement appliquée.
 *
 * @param controle le bouton ou le formulaire qui porte le geste, ou une clé
 *   si le geste n'a pas d'élément à lui
 */
export async function unSeulGeste<T>(
  controle: Element | string | null,
  action: () => Promise<T> | T,
  options: { repos?: number } = {},
): Promise<T | undefined> {
  if (!controle) return action();

  const repos = options.repos ?? REPOS_MS;
  const parCle = typeof controle === 'string';
  const pris = parCle ? sansControle.get(controle) === true : enCours.has(controle);
  if (pris) return undefined;

  /* Et le repos : le premier appel est fini, mais trop récemment pour que le
     second soit autre chose qu'un rebond. */
  const derniere = parCle ? finiAParCle.get(controle) : finiA.get(controle);
  if (derniere !== undefined && performance.now() - derniere < repos) return undefined;

  if (typeof controle === 'string') sansControle.set(controle, true);
  else enCours.add(controle);

  /*
     Désactiver pendant l'action, et rendre l'état d'avant — jamais
     « false » en dur : un bouton qui était déjà désactivé pour une autre
     raison le redeviendrait actif, et la raison d'origine serait perdue.
  */
  const bouton =
    controle instanceof HTMLButtonElement
      ? controle
      : controle instanceof HTMLElement
        ? controle.querySelector('button[type="submit"]')
        : null;
  const desactiveAvant = bouton instanceof HTMLButtonElement ? bouton.disabled : null;
  if (bouton instanceof HTMLButtonElement) bouton.disabled = true;

  try {
    return await action();
  } finally {
    if (parCle) {
      sansControle.delete(controle);
      finiAParCle.set(controle, performance.now());
    } else {
      enCours.delete(controle);
      finiA.set(controle, performance.now());
    }
    if (bouton instanceof HTMLButtonElement && desactiveAvant !== null) {
      bouton.disabled = desactiveAvant;
    }
  }
}
