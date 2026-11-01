/**
 * LA GRAINE QUE LES ESSAIS IMPOSENT, ET QUE PERSONNE D'AUTRE NE PEUT POSER.
 *
 * ## Le besoin
 *
 * Trois écrans de l'Entraînement cognitif tirent leur contenu au hasard. Un
 * essai qui mesure la mise en page de ces écrans mesure donc une page dont la
 * taille change à chaque passage : son verdict devient un tirage, et son texte
 * ne se compare pas d'un passage à l'autre. C'est ce qui a rendu
 * `essais:cog:navigateur` instable — entre un et six rouges, sur n'importe
 * quel arbre, relevé le 1er novembre 2026.
 *
 * ## Les deux conditions, et pourquoi il en faut DEUX
 *
 * Elles doivent être réunies pour que la graine s'applique :
 *
 *  1. `navigator.webdriver` — vrai seulement quand la page est pilotée par une
 *     automatisation. Mesuré : vrai sous le Chromium des essais, et faux pour
 *     quiconque ouvre le site. Une personne ne peut donc pas l'allumer, quoi
 *     qu'elle fasse : ni réglage, ni adresse, ni rien de persistant.
 *  2. `window.__revinspGraineEssais` — posé par l'essai AVANT le chargement de
 *     la page. Rien dans l'application ne l'écrit, et aucun écran ne l'expose.
 *
 * La première seule ne suffirait pas : toute automatisation figerait alors le
 * hasard, y compris celle qui veut justement mesurer la variété. La seconde
 * seule ne suffirait pas non plus : un nom de variable est devinable, et
 * l'exiger seul laisserait un visiteur figer son propre entraînement — ce qui
 * ôterait à l'exercice ce qui le fait fonctionner.
 *
 * ## Ce qui reste dans le site publié
 *
 * Ces quelques lignes, et rien d'autre : une lecture qui rend toujours
 * `undefined` chez une personne. Il n'y a pas de réglage, pas de paramètre
 * d'adresse, pas d'entrée en base. Le hasard du site publié est donc
 * exactement celui d'avant.
 *
 * Un paramètre d'adresse aurait été plus simple à écrire et bien pire : il se
 * garde dans un signet, se partage par message, et se retrouve un jour dans
 * l'historique de quelqu'un qui ne saura pas pourquoi son exercice ne change
 * plus.
 */
export function graineDesEssais(): number | undefined {
  try {
    if (typeof navigator === 'undefined' || !navigator.webdriver) return undefined;
    const pose = (globalThis as { __revinspGraineEssais?: unknown }).__revinspGraineEssais;
    /*
       Un entier fini, et rien d'autre. Une chaîne, un flottant ou un NaN
       passés par mégarde produiraient un générateur muet plutôt qu'une erreur,
       et l'essai mesurerait alors une page dont il croit connaître le contenu.
    */
    return typeof pose === 'number' && Number.isFinite(pose) ? Math.trunc(pose) : undefined;
  } catch {
    /* Un contexte sans `navigator` ni `globalThis` utilisable : pas de graine. */
    return undefined;
  }
}
