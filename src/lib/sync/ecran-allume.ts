/**
 * Garder l'écran allumé **pendant** une synchronisation, et pas une seconde
 * de plus.
 *
 * ## Pourquoi c'est nécessaire, et pas seulement confortable
 *
 * Les navigateurs mobiles suspendent une page passée en arrière-plan, et
 * éteindre l'écran revient au même. Une synchronisation dure quelques
 * secondes — deux dérivations PBKDF2 de 600 000 itérations, une négociation
 * WebRTC, un échange de paquets — et elle se fait souvent pendant qu'on
 * regarde l'autre appareil. L'écran qui s'éteint au milieu ne corrompt rien :
 * la fusion est idempotente, et un échange interrompu se refait. Mais il
 * transforme « ça marche tout seul » en « ça ne marche jamais quand je ne
 * regarde pas », ce qui est la seule chose que la synchronisation ne doit
 * pas être.
 *
 * ## Pendant, et pas plus
 *
 * Un verrou d'écran que l'on garde est une batterie que l'on vide. Il est
 * pris à l'entrée de l'échange et rendu dans le `finally`, échec compris.
 *
 * ## Le verrou se perd tout seul
 *
 * Le navigateur relâche le verrou dès que la page devient cachée, et ne le
 * rend pas au retour. Un échange long survivrait donc à un aller-retour par
 * une autre application en ayant perdu sa protection. On réécoute
 * `visibilitychange` tant que le jeton n'est pas rendu, et on redemande.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il n'empêche pas de verrouiller son téléphone à la main, ne réveille pas
 * un écran éteint, et peut être refusé — batterie faible, onglet caché,
 * navigateur qui ne connaît pas l'API. Chacun de ces cas est **normal** :
 * la fonction rend alors un jeton qui ne tient rien, et l'appelant continue
 * sans le savoir. Une synchronisation qui échouerait faute de verrou d'écran
 * serait une régression, pas une protection.
 */

export interface VerrouDEcran {
  /** Vrai si le navigateur a réellement accordé le verrou. */
  tenu: () => boolean;
  rendre: () => Promise<void>;
}

type DemandeurDeVerrou = () => Promise<{ release: () => Promise<void> }>;

function demandeurDuNavigateur(): DemandeurDeVerrou | null {
  const nav = globalThis.navigator as (Navigator & { wakeLock?: WakeLock }) | undefined;
  if (!nav?.wakeLock) return null;
  return () => nav.wakeLock.request('screen');
}

/**
 * Prend le verrou d'écran, ou rend un jeton inerte si c'est impossible.
 *
 * Ne lève jamais : l'appelant est une synchronisation, et une
 * synchronisation ne doit pas tomber parce qu'un écran risque de s'éteindre.
 */
export async function garderLEcranAllume(
  demander: DemandeurDeVerrou | null = demandeurDuNavigateur(),
): Promise<VerrouDEcran> {
  if (!demander) return { tenu: () => false, rendre: async () => {} };

  let jeton: { release: () => Promise<void> } | null = null;
  let rendu = false;

  const prendre = async () => {
    if (rendu) return;
    try {
      jeton = await demander();
    } catch {
      // Refusé : batterie faible, onglet caché, geste utilisateur exigé.
      jeton = null;
    }
  };

  /*
     Le navigateur relâche le verrou quand la page se cache. Au retour, il
     faut le redemander — personne ne le fait à notre place, et un échange
     qui dure se retrouverait sans protection exactement au moment où elle
     compte.
  */
  const auRetour = () => {
    if (!rendu && globalThis.document?.visibilityState === 'visible') void prendre();
  };
  globalThis.document?.addEventListener?.('visibilitychange', auRetour);

  await prendre();

  return {
    tenu: () => jeton !== null,
    rendre: async () => {
      rendu = true;
      globalThis.document?.removeEventListener?.('visibilitychange', auRetour);
      const aRendre = jeton;
      jeton = null;
      try {
        await aRendre?.release();
      } catch {
        // Déjà relâché par le navigateur : c'est le cas normal, pas une panne.
      }
    },
  };
}
