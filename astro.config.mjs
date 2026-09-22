// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import config from './site.config.mjs';

// https://astro.build/config
export default defineConfig({
  // Chemin de base sur GitHub Pages (voir site.config.mjs).
  base: config.base,
  trailingSlash: 'ignore',
  build: {
    // Un dossier par page : les URL restent propres sur GitHub Pages.
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
