/**
 * LA MARQUE DE FIN DE PEINTURE, EN UN SEUL ENDROIT.
 *
 * ## Ce qu'elle résout
 *
 * Un essai qui vient de cliquer doit attendre que l'écran ait fini de se
 * repeindre. Sans marque, il attend un délai — et un délai est un pari : il
 * réduit le risque sans le supprimer, et il cède exactement là où il était
 * censé protéger. Le relevé du 1er novembre compte 287 temporisations dans les
 * essais, dont 208 suivies d'une lecture : ce sont celles-là qui peuvent rendre
 * une mesure fausse plutôt que lente.
 *
 * `docs/cyclades/cadence-des-essais.md` tranche la forme à prendre, et
 * `scripts/lib/post-condition.mjs` l'emploie déjà sous le nom
 * `apresLaPeinture` : la zone compte ses peintures, l'essai relève la valeur
 * AVANT le geste et attend qu'elle change. Aucun passage antérieur ne peut
 * avoir rendu cette condition vraie, puisqu'elle porte sur une valeur relevée
 * après eux. Il ne manquait que la marque côté site.
 *
 * ## Pourquoi `aria-busy` ne suffit pas, et pourquoi on le garde quand même
 *
 * Au repos, une zone n'est pas occupée : attendre « plus occupée » est donc
 * déjà vrai AVANT le geste. L'écran des notifications s'en tire parce qu'on ne
 * l'ouvre qu'une fois par mesure ; l'import bancaire, non, et
 * `essais-rapprocher-ecran` enchaîne cinq relevés.
 *
 * `aria-busy` garde pourtant sa valeur propre, qui n'est pas celle des essais :
 * sans lui, une technologie d'assistance annonce une région vide, puis la même
 * région à nouveau remplie. On pose donc les deux, et du même geste — c'est
 * tout l'intérêt d'`enPeignant`, qu'un écran ne puisse pas en poser un et
 * oublier l'autre.
 *
 * ## LE COMPTEUR EST COMMUN À TOUTES LES ZONES, et ce n'est pas un raccourci
 *
 * Un compteur par zone semble plus juste, et c'est ce que le premier écran à
 * porter cette marque faisait. Il a un défaut : si la zone est REMPLACÉE — un
 * `innerHTML` sur son parent, un écran qui se reconstruit —, le compte repart
 * de rien. La valeur peut alors retomber sur une valeur déjà vue, et
 * `apresLaPeinture`, qui attend un CHANGEMENT, attendrait pour toujours.
 *
 * Un compteur de module ne retombe jamais sur une valeur déjà vue, puisque
 * toute peinture, de n'importe quelle zone, le fait avancer. Ce qu'on perd —
 * savoir combien de fois CETTE zone a été peinte — n'est utile à personne :
 * aucune post-condition ne lit ce nombre, elles lisent seulement qu'il a changé.
 *
 * ## Ce que cette marque n'est pas
 *
 * Elle ne dit pas que l'écran est JUSTE, seulement qu'il a fini de peindre. Un
 * essai qui attendrait la marque et n'affirmerait rien d'autre ne mesurerait
 * rien. Elle remplace une attente, pas une assertion.
 */

/**
 * Le compte de toutes les peintures depuis le chargement de la page.
 *
 * Il ne sert qu'à produire une valeur qui n'a jamais été vue. Sa valeur
 * absolue n'a aucun sens et ne doit être lue par personne.
 */
let peintures = 0;

/**
 * Marque une zone comme repeinte.
 *
 * À appeler dans un `finally`, pour que la marque soit posée même quand la
 * peinture échoue : un essai qui attend une marque qui ne vient jamais expire
 * au bout de trente secondes et accuse le geste, alors que c'est la peinture
 * qui a échoué. Mieux vaut une marque posée et une assertion qui tombe sur ce
 * que l'écran montre.
 */
export function marquerLaPeinture(zone: Element | null | undefined): void {
  peintures += 1;
  if (zone instanceof HTMLElement) zone.dataset.peint = String(peintures);
}

/**
 * Peint une zone en posant les deux marques, et rend ce que la peinture rend.
 *
 * `aria-busy` pendant, le compteur après — et le `finally` garantit que les
 * deux sont tenus quelle que soit la sortie, y compris un `return` au milieu ou
 * une exception.
 *
 * On rend la valeur de la peinture plutôt que `void` pour que l'enveloppe
 * puisse être posée sans rien réorganiser autour d'elle : une fonction qui
 * rendait quelque chose continue de le rendre.
 */
export async function enPeignant<T>(
  zone: Element | null | undefined,
  peindre: () => T | Promise<T>,
): Promise<T> {
  if (zone instanceof HTMLElement) zone.setAttribute('aria-busy', 'true');
  try {
    return await peindre();
  } finally {
    if (zone instanceof HTMLElement) zone.removeAttribute('aria-busy');
    marquerLaPeinture(zone);
  }
}
