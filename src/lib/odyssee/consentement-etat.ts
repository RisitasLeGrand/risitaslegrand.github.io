/**
 * L'état du consentement à l'apprentissage étendu — anomalie A-13.
 *
 * ## Ce qui était cassé
 *
 * `consentement.ts` porte le texte depuis le 12 octobre, et il le dit
 * lui-même : « Il ne lit ni n'écrit rien. » Pendant ce temps,
 * `observerUsage()` observait. Le texte promettait « vous n'avez jamais à
 * l'autoriser » ; aucun mécanisme ne tenait cette phrase, et aucun écran
 * n'a jamais demandé l'autorisation.
 *
 * La promesse de **confidentialité** était tenue — rien ne quitte
 * l'appareil, et c'est vérifiable : pas un `POST`, pas un `sendBeacon`,
 * pas un WebSocket dans tout `src/`. C'est la promesse de **consentement**
 * qui ne l'était pas.
 *
 * ## La règle qui porte ce module : la révocation l'emporte
 *
 * Cyclades se synchronise entre appareils par un journal répliqué, sans
 * serveur, et le dernier écrivain gagne. Appliquée telle quelle à un
 * consentement, cette règle produit exactement ce qu'il ne faut pas :
 *
 * > On révoque sur le téléphone. L'ordinateur, resté hors ligne, portait
 * > encore l'accord et le réécrit plus tard. À la fusion, l'accord est le
 * > plus récent — **le consentement revient tout seul.**
 *
 * Un consentement qui se rétablit sans geste n'en est pas un.
 *
 * D'où la règle : **un accord ne l'emporte sur une révocation que s'il la
 * nomme.** Une reprise porte `remplace`, l'instant de la révocation
 * qu'elle lève. Un appareil qui n'a jamais vu la révocation ne peut pas
 * la nommer, donc son accord ne la lève pas — et c'est précisément le cas
 * qu'on veut perdre.
 *
 * Ce n'est pas « dernier écrivain gagne » corrigé après coup : c'est une
 * règle d'absorption, et elle se relit sans connaître l'ordre d'arrivée
 * des paquets.
 *
 * ## Ce que ce module ne décide pas
 *
 * Il ne lit aucun magasin et n'écrit rien. On lui donne les entrées du
 * journal, il rend l'état. C'est ce qui permet de l'éprouver dans les deux
 * sens — l'accord qui doit valoir, et celui qui ne doit pas.
 */

/** Une inscription au journal du consentement. */
export interface EntreeDeConsentement {
  type: 'accord' | 'revocation';
  /** L'instant du geste, en ISO. C'est l'ordre, pas l'arrivée du paquet. */
  le: string;
  /**
   * Pour un accord seulement : l'instant de la révocation qu'il lève.
   *
   * Absent sur un premier accord — il n'y a rien à lever. Absent aussi sur
   * l'accord d'un appareil qui n'a pas vu la révocation : c'est cet
   * accord-là que la règle écarte.
   */
  remplace?: string;
}

export interface EtatDuConsentement {
  accorde: boolean;
  /** L'instant du geste qui fait foi, ou `null` si rien n'a été dit. */
  depuis: string | null;
  /**
   * La révocation en vigueur qu'un accord devrait nommer pour la lever.
   *
   * C'est ce que l'écran passe à `accorder()` : sans elle, il écrirait un
   * accord qui ne lèverait rien, et la personne croirait avoir réautorisé.
   */
  revocationAlever: string | null;
}

/** Rien n'a été dit : on n'observe pas. Le défaut est le silence. */
export const CONSENTEMENT_VIERGE: EtatDuConsentement = {
  accorde: false,
  depuis: null,
  revocationAlever: null,
};

/**
 * L'état, à partir des entrées du journal, **dans n'importe quel ordre**.
 *
 * L'ordre d'arrivée ne doit rien changer : deux appareils qui ont reçu les
 * mêmes gestes dans des ordres différents doivent conclure la même chose,
 * sans quoi l'un observerait et l'autre non.
 */
export function resoudreConsentement(
  entrees: readonly EntreeDeConsentement[],
): EtatDuConsentement {
  if (!entrees.length) return CONSENTEMENT_VIERGE;

  const parDate = [...entrees].sort((a, b) => a.le.localeCompare(b.le));

  /* La dernière révocation prononcée, qu'elle ait été levée ou non. */
  const revocations = parDate.filter((e) => e.type === 'revocation');
  const derniereRevocation = revocations.length ? revocations[revocations.length - 1]!.le : null;

  if (!derniereRevocation) {
    const accords = parDate.filter((e) => e.type === 'accord');
    if (!accords.length) return CONSENTEMENT_VIERGE;
    return { accorde: true, depuis: accords[accords.length - 1]!.le, revocationAlever: null };
  }

  /*
     LA RÈGLE. Seul un accord qui NOMME cette révocation la lève. Sa date
     n'y fait rien : un accord postérieur venu d'un appareil qui n'avait
     pas vu la révocation ne la nomme pas, et ne la lève donc pas.
  */
  const leveurs = parDate.filter((e) => e.type === 'accord' && e.remplace === derniereRevocation);
  if (!leveurs.length) {
    return { accorde: false, depuis: derniereRevocation, revocationAlever: derniereRevocation };
  }

  return {
    accorde: true,
    depuis: leveurs[leveurs.length - 1]!.le,
    revocationAlever: null,
  };
}

/**
 * L'entrée à écrire pour accorder, au vu de l'état courant.
 *
 * Rendue plutôt qu'écrite : l'écran voit ce qu'il va inscrire, et la règle
 * de `remplace` ne dépend pas de la vigilance de l'appelant.
 */
export function accorder(
  etat: EtatDuConsentement,
  le: string,
): EntreeDeConsentement {
  return {
    type: 'accord',
    le,
    ...(etat.revocationAlever ? { remplace: etat.revocationAlever } : {}),
  };
}

/** L'entrée à écrire pour révoquer. Elle ne nomme rien : elle absorbe. */
export const revoquer = (le: string): EntreeDeConsentement => ({ type: 'revocation', le });
