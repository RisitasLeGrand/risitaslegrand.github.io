/**
 * Le service worker de Cyclades, et il ne fait qu'une chose.
 *
 * Il affiche les notifications de fusion automatique, et gère le clic. Rien
 * d'autre : pas de cache, pas d'interception de requête, pas de mode hors
 * ligne. Un service worker qui met en cache un site chiffré servirait un jour
 * du contenu chiffré avec un mot de passe qui n'est plus le bon, et le
 * diagnostic serait illisible.
 *
 * Il ne synchronise pas, et ne peut pas : « RTCPeerConnection » n'existe pas
 * ici. Il n'y a pas non plus de PUSH — Cyclades n'a pas de serveur pour en
 * envoyer, et aucun substitut ne prendra ce nom. Voir
 * « docs/cyclades/synchronisation/arriere-plan.md ».
 */

// Prendre la main sans attendre la fermeture des onglets : ce worker n'a aucun
// état à préserver d'une version à l'autre, donc rien à perdre à être remplacé.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evenement) => evenement.waitUntil(self.clients.claim()));

/**
 * La page demande l'affichage, parce qu'elle seule sait ce qui a fusionné.
 *
 * Le worker n'interroge pas la base : deux lecteurs de la même base, dont l'un
 * ne sait pas si l'autre est en train d'écrire, c'est une course pour un gain
 * nul. La page tient la vérité, le worker tient l'affichage.
 */
self.addEventListener('message', (evenement) => {
  const avis = evenement.data;
  if (!avis || avis.genre !== 'cyclades:avis') return;
  evenement.waitUntil(
    self.registration.showNotification(avis.titre, {
      body: avis.corps,
      tag: avis.marque,
      data: { vers: avis.vers },
      lang: 'fr',
    }),
  );
});

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const vers = evenement.notification.data?.vers ?? '/';
  evenement.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Une fenêtre déjà ouverte est ramenée au premier plan plutôt que
      // doublée : deux onglets de Cyclades, c'est deux horloges logiques qui
      // écrivent, et c'est exactement ce qu'on évite ailleurs.
      for (const fenetre of fenetres) {
        if (fenetre.url.includes(vers) && 'focus' in fenetre) return fenetre.focus();
      }
      if (fenetres.length && 'navigate' in fenetres[0]) {
        await fenetres[0].focus();
        return fenetres[0].navigate(vers);
      }
      return self.clients.openWindow(vers);
    })(),
  );
});
