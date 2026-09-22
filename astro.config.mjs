// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import config from './site.config.mjs';

import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  // Chemin de base sur GitHub Pages (voir site.config.mjs).
  base: config.base,

  trailingSlash: 'ignore',

  // L'ancienne rubrique « Entraînement » est devenue « Cog-Training » : on
  // conserve une redirection pour les favoris et les liens déjà partagés.
  redirects: {
    '/entrainement': '/cog-training',
  },

  build: {
    // Un dossier par page : les URL restent propres sur GitHub Pages.
    format: 'directory',
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [svelte()],
});