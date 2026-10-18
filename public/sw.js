/**
 * Le service worker de Cyclades : les notifications, et le cache hors ligne.
 *
 * ## Ce qu'il faisait, et ce qui a changé
 *
 * Il n'affichait que les notifications de fusion. Le refus du cache y était
 * écrit, avec sa raison : « un service worker qui met en cache un site
 * chiffré servirait un jour du contenu chiffré avec un mot de passe qui n'est
 * plus le bon, et le diagnostic serait illisible. »
 *
 * La raison était juste ; c'est la conclusion qui était trop large. La
 * décision `D-025` a tranché pour un **cache à moyen terme** — la coquille et
 * les fiches du jour —, et la garantie qui la rend tenable est que le cache
 * est **nommé par la publication** : `cyclades-<version>`, où la version est
 * celle que porte `data/cle.json`. Toute autre est effacée dès que la page
 * annonce la sienne. Un contenu chiffré avec une clé d'hier ne peut donc pas
 * être resservi aujourd'hui : son cache n'existe plus.
 *
 * Trois règles qui découlent de là, et qu'il ne faut pas desserrer :
 *
 * 1. **Tant que la publication est inconnue, rien n'est mis en cache.** Le
 *    worker démarre muet et attend que la page lui dise à quelle publication
 *    elle appartient. Un cache sans nom de publication serait un cache qu'on
 *    ne sait pas invalider.
 * 2. **`cle.json` n'est jamais mis en cache.** C'est lui qui porte la
 *    version ; le mettre en cache reviendrait à mémoriser la preuve de sa
 *    propre fraîcheur.
 * 3. **Les fichiers de contenu ne sont gardés que sur demande explicite** de
 *    la page, par le message « garder ». Le worker ne décide pas tout seul
 *    de conserver une fiche : seule la page sait lesquelles sont au programme
 *    du jour, et remplir le cache de tout ce qui passe le rendrait
 *    impossible à borner.
 *
 * Il ne synchronise pas, et ne peut pas : « RTCPeerConnection » n'existe pas
 * ici. Il n'y a pas non plus de PUSH — Cyclades n'a pas de serveur pour en
 * envoyer, et aucun substitut ne prendra ce nom. Voir
 * « docs/cyclades/synchronisation/arriere-plan.md ».
 */

const PREFIXE = 'cyclades-';

/** La publication en cours, annoncée par la page. `null` = on ne cache rien. */
let publication = null;

const nomDuCache = () => (publication ? `${PREFIXE}${publication}` : null);

/**
 * RETROUVER LA PUBLICATION APRÈS UN REDÉMARRAGE — M8, première cause.
 *
 * Un service worker est arrêté dès qu'il se tait, et relancé au premier
 * événement. `publication` étant une variable de module, elle repart à
 * `null` à chaque réveil, et `nomDuCache()` avec elle : le worker ne
 * servait alors plus rien, même pour des fichiers qu'il avait gardés.
 *
 * Hors ligne, c'est fatal : la page qui aurait pu le renseigner ne peut pas
 * se charger sans lui. Le worker attendait une annonce que seule une page
 * chargée peut faire, et la page attendait un worker qui s'était tu.
 *
 * Il n'a pourtant besoin de rien de neuf pour se souvenir : le nom du cache
 * PORTE la publication. S'il n'en existe qu'un, c'est forcément celui de la
 * publication courante — `purgerLesAutres` a effacé les autres à la
 * dernière annonce. Le worker le reprend donc, et la page corrigera si elle
 * annonce autre chose.
 *
 * Deux caches ou plus : on ne devine pas. Cela ne devrait pas arriver, et
 * choisir au hasard resservirait peut-être du contenu chiffré avec une clé
 * qui n'est plus la bonne — exactement ce que tout ce mécanisme empêche.
 */
async function nomDuCacheRetrouve() {
  const connu = nomDuCache();
  if (connu) return connu;
  const noms = (await caches.keys()).filter((n) => n.startsWith(PREFIXE));
  if (noms.length !== 1) return null;
  publication = noms[0].slice(PREFIXE.length);
  return noms[0];
}

/**
 * Efface tout cache d'une autre publication.
 *
 * C'est le mécanisme entier de l'invalidation : il n'y a pas de date
 * d'expiration, pas de taille maximale, pas de stratégie d'éviction. Une
 * publication nouvelle rend l'ancienne intégralement caduque, parce que ses
 * fichiers sont chiffrés avec d'autres paramètres.
 */
async function purgerLesAutres() {
  const garde = nomDuCache();
  const noms = await caches.keys();
  await Promise.all(
    noms.filter((n) => n.startsWith(PREFIXE) && n !== garde).map((n) => caches.delete(n)),
  );
}

/** Les ressources de la coquille : immuables, parce que leur nom porte une empreinte. */
const estDeLaCoquille = (url) =>
  url.pathname.includes('/_astro/') ||
  /\.(?:css|js|woff2?|svg|ico|png)$/.test(url.pathname);

const estLaCle = (url) => url.pathname.endsWith('/cle.json');

/**
 * Répondre depuis le réseau, et garder la copie.
 *
 * Les erreurs sont avalées : un cache qui échoue à écrire ne doit pas faire
 * échouer la réponse qu'il vient d'obtenir.
 */
async function reseauPuisCache(requete, nom) {
  const reponse = await fetch(requete);
  if (reponse && reponse.ok && reponse.type === 'basic') {
    try {
      const cache = await caches.open(nom);
      await cache.put(requete, reponse.clone());
    } catch {
      /* Quota plein, mode privé : la réponse reste bonne. */
    }
  }
  return reponse;
}

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (estLaCle(url)) return;

  /*
     On répond toujours nous-mêmes, parce que retrouver la publication demande
     de lire `caches.keys()`, donc d'attendre. `respondWith` veut une promesse,
     pas un résultat : on la lui donne. Quand il n'y a rien à servir, la
     promesse rend un `fetch` ordinaire — ce que le navigateur aurait fait si
     l'on s'était tu.
  */
  evenement.respondWith(repondre(evenement, requete, url));
});

async function repondre(evenement, requete, url) {
  const nom = await nomDuCacheRetrouve();
  if (!nom) return fetch(requete);

  /*
     Une navigation passe par le réseau d'abord : hors ligne, on sert la
     coquille gardée. L'inverse — le cache d'abord — ferait vivre une page
     d'hier sur un site remis en ligne, et le temps qu'une publication
     nouvelle se fasse connaître, on aurait servi l'ancienne.
  */
  if (requete.mode === 'navigate') {
    return reseauPuisCache(requete, nom).catch(async () => {
      const cache = await caches.open(nom);
      return (
        (await cache.match(requete)) ??
        (await cache.match(requete, { ignoreSearch: true })) ??
        Response.error()
      );
    });
  }

  /*
     La coquille, elle, part du cache : ses noms portent une empreinte, donc
     un fichier servi depuis le cache est forcément le bon, et c'est ce qui
     rend l'ouverture immédiate.
  */
  if (estDeLaCoquille(url)) {
    const cache = await caches.open(nom);
    const gardee = await cache.match(requete);
    if (gardee) return gardee;
    return reseauPuisCache(requete, nom);
  }

  /*
     Tout le reste — les fiches chiffrées, les manifestes — n'est servi depuis
     le cache que s'il y a **été mis exprès**. Le worker ne garde jamais de
     lui-même ce qu'il voit passer.
  */
  const cache = await caches.open(nom);
  const gardee = await cache.match(requete);
  if (gardee) {
    /* Rafraîchir en arrière-plan : la réponse est déjà partie. */
    evenement.waitUntil(reseauPuisCache(requete, nom).catch(() => undefined));
    return gardee;
  }
  return fetch(requete);
}

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
  const message = evenement.data;

  /*
     La page annonce sa publication. C'est le seul moment où le worker
     apprend qu'il a le droit de cacher quelque chose, et c'est aussi celui
     où tout cache d'une publication antérieure disparaît.
  */
  if (message?.genre === 'cyclades:publication') {
    publication = typeof message.version === 'string' ? message.version : null;
    evenement.waitUntil(purgerLesAutres());
    return;
  }

  /*
     « Garder » : les fiches du jour, nommées par la page, parce qu'elle seule
     connaît le programme. Les échecs sont silencieux — ne pas réussir à
     garder une fiche n'est pas une panne, c'est une fiche qu'il faudra
     retélécharger.
  */
  if (message?.genre === 'cyclades:garder') {
    const nom = nomDuCache();
    const urls = Array.isArray(message.urls) ? message.urls : [];
    if (!nom || !urls.length) return;
    evenement.waitUntil(
      (async () => {
        const cache = await caches.open(nom);
        await Promise.all(
          urls.map(async (u) => {
            try {
              await cache.add(new Request(u, { cache: 'no-cache' }));
            } catch {
              /* Hors ligne, 404, quota : on n'insiste pas. */
            }
          }),
        );
      })(),
    );
    return;
  }

  const avis = message;
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
