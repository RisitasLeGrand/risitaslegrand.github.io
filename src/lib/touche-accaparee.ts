/**
 * L'élément focalisé fait-il déjà quelque chose de cette touche ?
 *
 * ## Le défaut que cette règle existe pour empêcher
 *
 * Un raccourci global qui appelle `preventDefault()` vole la touche à TOUT
 * l'écran. Mesuré le 25 octobre sur les flashcards : Espace et Entrée étaient
 * interceptés pour toute la session, donc un bouton de notation qui avait le
 * focus ne s'activait **ni** à l'une **ni** à l'autre — les deux touches
 * étaient avalées avant de l'atteindre, et il ne se passait rien. La boucle de
 * révision n'était pas menable au clavier.
 *
 * ## Pourquoi un module, alors que la règle était déjà écrite
 *
 * Elle vivait dans `QuadNBack.svelte`, en fonction locale, et son commentaire
 * disait déjà juste : « sans quoi régler un curseur suffirait à désactiver le
 * lancement au clavier ». Je l'ai réécrite inline pour les flashcards, en plus
 * grossier — et deux versions d'une même règle, c'est la divergence garantie le
 * jour où l'une des deux change. Celle-ci est la fine, et c'est elle qui reste.
 *
 * ## Ce que « fine » veut dire ici
 *
 * Le type décide, et non la balise seule :
 *
 * - un **bouton**, un **lien**, une **liste déroulante**, une **zone de
 *   texte** : ils réagissent à Entrée et à Espace, on ne leur vole rien ;
 * - une **case à cocher** ou un **bouton radio** : ils possèdent Espace, qui
 *   les bascule, mais ignorent Entrée ;
 * - un **curseur** : il ignore les deux — ses touches sont les flèches —, donc
 *   un raccourci peut s'appliquer alors même qu'il a le focus ;
 * - un **champ de saisie textuel** : Entrée y vaut soumission, et une lettre y
 *   est une lettre. On ne lui vole rien non plus.
 *
 * Elle ne dit rien des flèches, de Échap ni des chiffres : chaque écran décide
 * de ceux-là, parce que leur sens dépend de ce qu'il affiche. Elle répond à une
 * seule question, celle de l'activation.
 */

/** Les balises qui réagissent toujours à Entrée comme à Espace. */
const TOUJOURS = new Set(['BUTTON', 'A', 'SELECT', 'TEXTAREA']);

/**
 * `true` quand l'élément focalisé attend cette touche pour lui-même.
 *
 * L'appelant s'arrête alors là : ni `preventDefault()`, ni raccourci. C'est le
 * navigateur qui traduit la touche en activation, et il le fait mieux.
 */
export function accapareLaTouche(cible: EventTarget | null, touche: string): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  if (cible.isContentEditable) return true;
  if (TOUJOURS.has(cible.tagName)) return true;

  if (cible.tagName === 'INPUT') {
    const type = (cible.getAttribute('type') ?? 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return touche === ' ';
    if (type === 'range') return false;
    return true;
  }
  return false;
}
