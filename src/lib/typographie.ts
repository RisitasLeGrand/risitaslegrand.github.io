/**
 * Les espaces insécables de la typographie française, posées à l'affichage.
 *
 * ## Le défaut, et pourquoi il n'est ni dans le code ni dans les données
 *
 * En français, les signes doubles — `? ! ; :` — veulent une espace avant eux,
 * et cette espace doit être **insécable**, sans quoi le navigateur y coupe la
 * ligne et le point d'interrogation tombe seul en début de ligne suivante.
 * Dans les gabarits, la personne qui écrit tape `&nbsp;` et le problème ne se
 * pose pas. Mais une question de QCM, un intitulé de fiche ou un terme de
 * glossaire arrivent d'un fichier de contenu où personne ne pense à ça, et
 * sont injectés par `textContent` — qui ne connaît aucune entité HTML.
 *
 * ## Ce que la fonction fait, et ce qu'elle ne touche pas
 *
 * Elle remplace une espace **déjà présente** avant un signe double, et autour
 * des guillemets français. Elle n'en ajoute jamais là où il n'y en a pas :
 * `Vraiment?` est peut-être une citation, un titre d'œuvre ou de l'anglais, et
 * ce n'est pas à l'affichage d'en décider. `https://` n'a pas d'espace avant
 * ses deux-points, et reste donc intact — c'est la raison pour laquelle la
 * règle porte sur l'espace et non sur le signe.
 *
 * Fine insécable (U+202F) devant `? ! ;`, insécable ordinaire (U+00A0) devant
 * `:` et autour des guillemets : c'est l'usage de l'Imprimerie nationale, et
 * la fine est ce que les navigateurs rendent le moins large devant un signe
 * haut.
 */

/** Fine insécable : devant les signes qui montent. */
const FINE = ' ';
/** Insécable ordinaire : devant les deux-points, et autour des guillemets. */
const INSECABLE = ' ';

/**
 * Pose les insécables sur un texte venu des données.
 *
 * Idempotente : une insécable déjà posée n'est pas une espace ordinaire, donc
 * un second passage ne change rien.
 */
export function insecables(texte: string): string {
  return texte
    .replace(/[ \t]+([?!;])/g, `${FINE}$1`)
    .replace(/[ \t]+:/g, `${INSECABLE}:`)
    .replace(/«[ \t]+/g, `«${INSECABLE}`)
    .replace(/[ \t]+»/g, `${INSECABLE}»`);
}
