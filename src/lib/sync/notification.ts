/**
 * Avertir d'une fusion automatique — sans jamais promettre un PUSH.
 *
 * ## Ce qui est possible, et ce qui ne l'est pas
 *
 * Le protocole Web Push fait envoyer la notification par un **serveur
 * applicatif** : il chiffre la charge pour l'abonnement, signe un jeton VAPID
 * et poste vers le service de push. Cyclades n'a pas de serveur, et un
 * navigateur ne peut pas jouer ce rôle — les services de push ont retiré le
 * partage de ressources entre origines de leur point de terminaison. Il n'y a
 * donc **aucune notification PUSH dans Cyclades, ni vraie ni imitée** : ni
 * relais public, ni workflow d'intégration continue en expéditeur. Décision du
 * 11 octobre 2026 : « si le PUSH est impossible, ne pas le faire. »
 *
 * ## Ce qu'il y a à la place
 *
 * Deux chemins, qui ne mentent ni l'un ni l'autre :
 *
 * 1. **sur le site** — l'entrée dans l'historique des fusions, visible à
 *    l'ouverture de Cyclades sur n'importe quel appareil ;
 * 2. **sur l'appareil** — l'API `Notification`, depuis la page quand elle est
 *    ouverte, et depuis le *service worker* quand le navigateur le réveille.
 *
 * La différence avec un vrai push : la notification arrive à la prochaine
 * ouverture ou au prochain réveil, pas dans la seconde. Pour un journal de
 * révision, c'est sans conséquence. Et c'est **vrai**, ce qui est la propriété
 * qui compte.
 *
 * ## Pourquoi passer par le *service worker* quand il est là
 *
 * Une notification affichée par la page disparaît avec elle. Celle d'un
 * *service worker* survit à la fermeture de l'onglet et porte des actions. On
 * tente donc le *service worker* d'abord, et la page ensuite — sans jamais
 * faire dépendre la fusion de la notification : une permission refusée ne doit
 * pas empêcher une synchronisation de se faire.
 */

/** Le chemin du *service worker*, servi à la racine du site. */
export const CHEMIN_SERVICE_WORKER = 'sw.js';

export type EtatPermission = 'accordee' | 'refusee' | 'a-demander' | 'indisponible';

export function etatPermission(): EtatPermission {
  if (typeof Notification === 'undefined') return 'indisponible';
  if (Notification.permission === 'granted') return 'accordee';
  if (Notification.permission === 'denied') return 'refusee';
  return 'a-demander';
}

/**
 * Demande la permission. À appeler **depuis un geste**, jamais au chargement :
 * un navigateur refuse une demande non sollicitée, et certains la retiennent
 * contre le site.
 */
export async function demanderPermission(): Promise<EtatPermission> {
  if (typeof Notification === 'undefined') return 'indisponible';
  if (Notification.permission !== 'default') return etatPermission();
  try {
    await Notification.requestPermission();
  } catch {
    /* Safari ancien : la forme à rappel. On lit l'état ensuite. */
  }
  return etatPermission();
}

/** Enregistre le *service worker*, s'il est disponible. Sans lui, la page suffit. */
export async function enregistrerServiceWorker(
  base = '/',
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const racine = base.endsWith('/') ? base : `${base}/`;
    return await navigator.serviceWorker.register(`${racine}${CHEMIN_SERVICE_WORKER}`, {
      scope: racine,
    });
  } catch {
    return null;
  }
}

export interface Avis {
  titre: string;
  corps: string;
  /** Où le clic emmène. Chemin du site, déjà préfixé par la base. */
  vers: string;
  /** Pour ne pas empiler deux fois la même fusion. */
  marque: string;
}

/**
 * Affiche un avis. Rend `true` si quelque chose s'est affiché.
 *
 * Jamais d'exception vers l'appelant : la fusion a réussi, et une notification
 * qui échoue ne doit pas la faire paraître échouée.
 */
export async function avertir(avis: Avis): Promise<boolean> {
  if (etatPermission() !== 'accordee') return false;
  const options: NotificationOptions = {
    body: avis.corps,
    tag: avis.marque,
    data: { vers: avis.vers },
    lang: 'fr',
  };
  try {
    const enregistrement =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null;
    if (enregistrement) {
      await enregistrement.showNotification(avis.titre, options);
      return true;
    }
  } catch {
    /* On retombe sur la page. */
  }
  try {
    new Notification(avis.titre, options);
    return true;
  } catch {
    return false;
  }
}
