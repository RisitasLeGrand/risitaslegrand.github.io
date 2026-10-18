/**
 * Le manifeste d'installation, fabriqué plutôt que recopié.
 *
 * ## Pourquoi un point d'accès et non un fichier dans `public/`
 *
 * Deux valeurs du manifeste — `start_url` et `scope` — doivent porter la
 * **base** du site, et la base change selon l'endroit où le paquet est
 * publié : « / » sur un dépôt `<compte>.github.io`, « /<dépôt>/ » ailleurs.
 * Un fichier statique les figerait, et une installation faite sous la
 * mauvaise base s'ouvre sur une page introuvable — après coup, sur l'écran
 * d'accueil d'un téléphone, c'est-à-dire là où on ne débogue pas.
 *
 * Fabriqué ici, le manifeste lit la même constante que le reste du site.
 *
 * ## Ce que `id` garantit
 *
 * Il fixe l'identité de l'application indépendamment de `start_url`. Sans
 * lui, changer un jour la page de départ ferait voir au système une
 * application **différente** : une seconde icône apparaîtrait à côté de la
 * première, et l'ancienne resterait installée sur son ancienne adresse.
 */
import type { APIRoute } from 'astro';
import config from '../../site.config.mjs';

export const prerender = true;

const base = (config as { base: string }).base.replace(/\/$/, '');
const titre = (config as { titre: string }).titre;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        id: `${base}/`,
        name: titre,
        short_name: titre,
        description:
          'Révisions, Odyssée et Sport — un espace privé et chiffré, qui fonctionne hors ligne.',
        lang: 'fr',
        dir: 'ltr',
        start_url: `${base}/`,
        scope: `${base}/`,
        display: 'standalone',
        orientation: 'portrait-primary',
        /*
           Le fond de l'écran de lancement est l'indigo du site, et non le
           blanc : le lancement se fait ainsi sans l'éclair blanc qui, sur un
           téléphone en thème sombre, réveille autant qu'une lampe.
        */
        background_color: '#4f46e5',
        theme_color: '#4f46e5',
        icons: [
          { src: `${base}/icone-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}/icone-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: `${base}/icone-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      null,
      2,
    ),
    { headers: { 'content-type': 'application/manifest+json; charset=utf-8' } },
  );
