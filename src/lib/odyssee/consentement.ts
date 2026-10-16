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
 * Il ne lit ni n'écrit rien. Aucun état, aucun magasin. Ici il n'y a que des
 * mots et des listes de ce qui pourra être coché — de quoi relire et
 * contester avant qu'une ligne de code ne les applique.
 *
 * ## CE QUI N'EXISTE PAS, AU 16 OCTOBRE 2026 — anomalie A-13
 *
 * Ce bloc est daté et factuel, et il est ici parce qu'un texte de
 * consentement qui promet plus que le code ne tient est pire qu'un texte
 * absent : il rassure à tort.
 *
 * **Ce qui existe désormais** : l'interrupteur maître. Sans accord,
 * `observerUsage()` ne lit aucun fait et rend son silence — la garde est
 * dans la fonction qui lit, et `essais:consentement-porte` vérifie
 * qu'aucun autre chemin n'observe. La révocation l'emporte sur l'accord
 * d'un appareil resté hors ligne (`consentement-etat.ts`).
 *
 * **Ce qui n'existe pas** :
 *
 * - **les interrupteurs par domaine et par source** que
 *   `DOMAINES_DU_CONSENTEMENT` et `SOURCES_DU_CONSENTEMENT` énumèrent.
 *   Huit domaines et quatre sources y sont listés ; **un seul domaine est
 *   effectivement observé** — les Révisions, par `publierFaitsRevisions`.
 *   L'interrupteur maître le couvre donc entièrement. La promesse
 *   granulaire est tenue par l'absence de ce qu'elle gouvernerait, et non
 *   par un interrupteur fantôme. `essais:consentement-porte` échoue si
 *   l'observation vient un jour à lire une autre branche ;
 * - **le journal d'accès** que `commentArreter` annonce (« Un journal vous
 *   montre ce qui a été lu, et quand »). Il n'y en a pas ;
 * - **le choix d'effacer ou de conserver les observations** à la
 *   révocation. Il est sans objet aujourd'hui : l'observation est
 *   **calculée à chaque lecture, jamais stockée**. Seules les décisions
 *   prises sur les propositions sont journalisées, et ce sont des réponses
 *   de la personne, non des observations sur elle ;
 * - **le rappel périodique** que `RAPPEL` décrit. Les constantes existent,
 *   rien ne les lit.
 *
 * Tant que ces quatre lignes sont vraies, elles restent ici. Les effacer
 * sans construire ce qu'elles nomment serait la faute que tout ce bloc
 * existe pour empêcher.
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
