/**
 * UNE ICÔNE POUR LES SCRIPTS QUI CONSTRUISENT LEURS ÉLÉMENTS.
 *
 * ## Le problème que ce module résout
 *
 * Plusieurs écrans fabriquent leurs lignes en JavaScript — le panneau des
 * notifications, la liste des règles, les deux tableaux de rapprochement. Leurs
 * boutons portaient un émoji écrit dans le script — un œil posé par
 * `innerHTML`. Le composant `Icone.astro` ne leur sert à rien : il s'exécute à
 * la construction du site, pas dans le navigateur.
 *
 * ## Pourquoi un gabarit, et non le catalogue importé
 *
 * La solution évidente serait d'importer `ICONES` dans le script. Elle coûte
 * **dix-sept kilooctets** envoyés au navigateur — les soixante-deux tracés,
 * dont le script n'emploie qu'un ou deux : un objet indexé par une variable ne
 * s'élague pas.
 *
 * Le gabarit, lui, est écrit par le site. La page pose
 *
 *     <template id="gabarit-alerte"><Icone nom="alerte" taille={16} /></template>
 *
 * et le script en prend une copie. Le SVG part dans le HTML de la page, une
 * fois, déjà rendu ; rien de plus ne traverse le réseau, et le dessin reste
 * décrit à UN seul endroit — le catalogue, par le composant.
 *
 * Un `<template>` n'est pas affiché et son contenu n'est pas chargé : c'est
 * exactement ce qu'on veut d'un modèle à copier.
 *
 * ## Deux usages, parce qu'il y a deux façons de construire
 *
 * `iconeDuGabarit` rend un NŒUD, à passer à `append` — c'est la bonne façon,
 * elle n'écrit pas de HTML et ne demande donc aucun échappement.
 *
 * `htmlDuGabarit` rend la CHAÎNE, pour les quelques endroits qui composent
 * encore leur ligne en HTML autour de données échappées à la main. Elle ne
 * crée pas de risque nouveau : la chaîne vient du site, pas d'une donnée.
 */

/** Le `<template>` d'un identifiant, ou l'arrêt net. */
function gabarit(id: string): HTMLTemplateElement {
  const element = document.getElementById(id);
  /*
     UN GABARIT ABSENT ARRÊTE TOUT, et c'est voulu.

     Sans ce refus, `querySelector` rendrait `null`, l'icône manquerait, et la
     ligne s'afficherait sans elle — un bouton muet, que personne ne signale
     parce qu'il a l'air d'un bouton. Mieux vaut une erreur dans la console au
     premier rendu : elle se voit, et elle se corrige.
  */
  if (!(element instanceof HTMLTemplateElement)) {
    throw new Error(
      `icone-gabarit : « ${id} » n'est pas un <template> de cette page. ` +
        'Posez-le dans le gabarit, avec le composant « Icone » dedans.',
    );
  }
  return element;
}

/** Une copie de l'icône du gabarit, à poser dans la page. */
export function iconeDuGabarit(id: string): Element {
  const premier = gabarit(id).content.firstElementChild;
  if (!premier) throw new Error(`icone-gabarit : « ${id} » est vide.`);
  return premier.cloneNode(true) as Element;
}

/** Le HTML de l'icône du gabarit, pour les lignes composées en chaîne. */
export function htmlDuGabarit(id: string): string {
  return gabarit(id).innerHTML.trim();
}
