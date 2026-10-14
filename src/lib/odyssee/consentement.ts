/**
 * Le texte de consentement à l'apprentissage étendu (J.5), et ses réglages.
 *
 * ## Pourquoi un module, et pourquoi maintenant
 *
 * Le plan le livre en phase 0, avant tout écran, pour une raison simple : un
 * texte de consentement écrit **après** la fonctionnalité décrit ce qu'on a
 * construit. Écrit avant, il dit ce qu'on s'autorise à construire, et le
 * reste du chantier doit s'y tenir. L'ordre n'est pas une formalité, il
 * décide du contenu.
 *
 * Il vit dans un module plutôt que dans un gabarit parce que trois endroits
 * devront le citer sans le reformuler : l'écran de consentement,
 * l'initialisation « Approfondi », et le rappel périodique. Trois copies d'un
 * texte de consentement, c'est trois versions qui divergent, et la personne
 * ne sait plus laquelle elle a acceptée.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne lit ni n'écrit rien. Aucun état, aucun magasin : les interrupteurs et
 * le journal d'accès viennent avec la phase 13. Ici il n'y a que des mots et
 * des listes de ce qui pourra être coché — de quoi relire et contester avant
 * qu'une ligne de code ne les applique.
 */

/** Les trois paragraphes, lisibles en une minute. L'ordre compte. */
export const TEXTE_DE_CONSENTEMENT = {
  /** Ce que Cyclades lit. Concret, sans euphémisme. */
  ceQueCycladesLit:
    'Si vous l’autorisez, Cyclades regarde ce que vous notez et comment vous vous en ' +
    'servez : les domaines que vous ouvrez, les moments où vous le faites, ce que vous ' +
    'laissez de côté. Il s’en sert pour vous proposer des choses plus justes — une heure ' +
    'de révision, un rythme, un rappel. Rien ne quitte votre appareil : ces observations ' +
    'sont lues et écrites ici, et chiffrées comme le reste.',

  /**
   * Ce qui ne change jamais. En toutes lettres, comme J.5.3 l'exige — un
   * engagement résumé n'est pas un engagement.
   */
  ceQuiNeChangeJamais:
    'Ce que vous avez écrit ne sera jamais modifié, réinterprété ni effacé par cette ' +
    'fonction. Cyclades ne décide rien à votre place : il propose, et vous refusez d’un ' +
    'geste. Un refus est retenu, et la même proposition ne revient pas. Aucune de ces ' +
    'observations ne sort de l’appareil, n’est envoyée à un service tiers, ni ne sert à ' +
    'autre chose qu’à vos propres écrans. Et vous n’avez jamais à l’autoriser pour que ' +
    'le reste de Cyclades fonctionne : tout marche sans.',

  /** Comment arrêter. Avant d'avoir commencé, pas enterré dans un réglage. */
  commentArreter:
    'Vous pouvez mettre en pause, retirer un domaine ou une source, ou tout révoquer, à ' +
    'tout moment et sans justification. En révoquant, vous choisissez si les observations ' +
    'déjà faites sont effacées ou conservées. Un journal vous montre ce qui a été lu, et ' +
    'quand.',
} as const;

/** Les huit domaines, un interrupteur chacun. Aucun n'est coché au départ. */
export const DOMAINES_DU_CONSENTEMENT = [
  'corps',
  'sante',
  'psyche',
  'finances',
  'lien',
  'ordre',
  'oeuvre',
  'connaissances',
] as const;

/** Les quatre sources d'observation, également un interrupteur chacune. */
export const SOURCES_DU_CONSENTEMENT = [
  'journal-d-usage',
  'texte-libre',
  'imports',
  'capteurs',
] as const;

/**
 * Le rappel périodique : trois mois par défaut, réglable, désactivable.
 *
 * Et **dans l'application, jamais en notification** : un consentement qu'on
 * rappelle par une alerte sur un téléphone se renouvelle par agacement.
 */
export const RAPPEL = {
  moisParDefaut: 3,
  moisMinimum: 1,
  moisMaximum: 12,
  desactivable: true,
  dansLApplicationSeulement: true,
} as const;

/**
 * L'état de départ : **rien n'est coché**.
 *
 * Exporté comme une fonction et non comme un objet constant, pour qu'un
 * appelant ne puisse pas, en modifiant le sien, cocher le départ de tous les
 * autres.
 */
export function consentementVierge(): {
  accorde: false;
  domaines: Record<string, boolean>;
  sources: Record<string, boolean>;
} {
  return {
    accorde: false,
    domaines: Object.fromEntries(DOMAINES_DU_CONSENTEMENT.map((d) => [d, false])),
    sources: Object.fromEntries(SOURCES_DU_CONSENTEMENT.map((s) => [s, false])),
  };
}
