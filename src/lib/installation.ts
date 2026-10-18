/**
 * L'installation sur l'écran d'accueil : la proposer sans la réclamer.
 *
 * ## Les trois situations, et elles n'ont rien à voir entre elles
 *
 * 1. **Android, Chrome, Edge.** Le navigateur émet `beforeinstallprompt`
 *    quand il juge le site installable. On le retient, et c'est tout
 *    l'intérêt : l'invite native ne peut être ouverte qu'à partir d'un geste
 *    de la personne, donc il faut un bouton à nous pour la déclencher.
 * 2. **iOS, Safari.** Aucun événement, aucune API : l'installation passe par
 *    le menu « Partager », puis « Sur l'écran d'accueil ». Rien ne peut
 *    l'automatiser, et rien ne permet non plus de savoir si elle a eu lieu.
 *    La seule chose honnête est d'expliquer le chemin.
 * 3. **Déjà installé.** La page tourne alors en mode `standalone`, et
 *    proposer l'installation y serait absurde.
 *
 * ## Ce qui est volontairement absent
 *
 * Aucune insistance. L'invitation se montre, se refuse, et le refus **tient**
 * — il est gardé dans `localStorage`, et rien ne le réarme. Une bannière qui
 * revient est une bannière qu'on apprend à fermer sans lire, ce qui rend
 * inutile la seule fois où elle aurait servi.
 */

/** Le refus, gardé pour de bon. */
const CLEF_REFUS = 'cyclades.installation.refusee';

/** L'événement de Chrome, qui n'est pas dans la bibliothèque de types. */
interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type SituationInstallation =
  | { quoi: 'installee' }
  | { quoi: 'proposable'; installer: () => Promise<'acceptee' | 'refusee'> }
  | { quoi: 'manuelle'; systeme: 'ios' }
  | { quoi: 'rien' };

/**
 * L'application tourne-t-elle déjà hors du navigateur ?
 *
 * Deux épreuves, parce qu'elles ne couvrent pas les mêmes systèmes :
 * `display-mode: standalone` est la réponse du standard, et `navigator.standalone`
 * celle d'iOS, qui ne l'implémente pas.
 */
export function dejaInstallee(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    // matchMedia absent : on continue, l'autre épreuve tranchera.
  }
  return (navigator as { standalone?: boolean }).standalone === true;
}

/** iOS, qui n'a ni l'événement ni l'API. */
export function estIOS(): boolean {
  const ua = navigator.userAgent;
  /*
     L'iPad récent se déclare « Macintosh ». Le distinguer d'un vrai Mac
     demande de regarder s'il a un écran tactile — c'est laid, et c'est la
     seule façon qui marche.
  */
  return (
    /iphone|ipod|ipad/i.test(ua) ||
    (/macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
  );
}

export const installationRefusee = (): boolean => {
  try {
    return localStorage.getItem(CLEF_REFUS) === 'oui';
  } catch {
    return false;
  }
};

export const refuserLInstallation = (): void => {
  try {
    localStorage.setItem(CLEF_REFUS, 'oui');
  } catch {
    // Stockage refusé : l'invitation reviendra, et c'est le moins mauvais des deux.
  }
};

/**
 * Observe la situation et prévient quand elle est connue.
 *
 * Elle ne l'est pas forcément tout de suite : `beforeinstallprompt` arrive
 * **après** le chargement, parfois plusieurs secondes après. D'où un rappel
 * plutôt qu'une valeur de retour — une fonction qui rendrait « rien » au
 * premier appel se tromperait pour la seule situation qui méritait une
 * invitation.
 */
export function observerLInstallation(
  prevenir: (situation: SituationInstallation) => void,
): () => void {
  if (dejaInstallee()) {
    prevenir({ quoi: 'installee' });
    return () => {};
  }
  if (installationRefusee()) {
    prevenir({ quoi: 'rien' });
    return () => {};
  }

  if (estIOS()) {
    prevenir({ quoi: 'manuelle', systeme: 'ios' });
    return () => {};
  }

  const surInvite = (evenement: Event) => {
    /*
       On empêche l'invite spontanée du navigateur, et il faut dire pourquoi :
       non pour la cacher, mais pour la **replacer**. Telle quelle, elle
       surgit au milieu d'une lecture ; reprise par un bouton à nous, elle
       part d'un geste voulu. C'est le seul usage légitime de ce preventDefault.
    */
    evenement.preventDefault();
    const garde = evenement as EvenementInstallation;
    prevenir({
      quoi: 'proposable',
      installer: async () => {
        await garde.prompt();
        const { outcome } = await garde.userChoice;
        return outcome === 'accepted' ? 'acceptee' : 'refusee';
      },
    });
  };

  window.addEventListener('beforeinstallprompt', surInvite);
  /*
     Et l'installation réussie, qui arrive aussi quand elle a été faite par le
     menu du navigateur plutôt que par notre bouton.
  */
  const surInstallee = () => prevenir({ quoi: 'installee' });
  window.addEventListener('appinstalled', surInstallee);

  return () => {
    window.removeEventListener('beforeinstallprompt', surInvite);
    window.removeEventListener('appinstalled', surInstallee);
  };
}
