# Plan de développement

Découpage retenu avant l'écriture du code, et état d'avancement.
Chaque phase est utilisable telle quelle : le site reste fonctionnel à la fin
de chacune d'elles.

## Phase 1 — Socle et protection réelle ✅

Fondation du projet et, surtout, la garantie que le contenu publié est
illisible sans le mot de passe. Tout le reste en dépend.

- Projet Astro + Tailwind, `.gitignore` excluant `content/` et `.env.local`
  dès le premier commit.
- Pipeline de build : lecture de `content/`, validation du schéma (Zod),
  rendu Markdown → HTML, chiffrement AES-GCM (clé PBKDF2, 600 000 itérations).
- Écran de connexion : vérification SHA-256 puis dérivation de la clé réelle.
- Garde-fou de publication : le build s'interrompt si un titre de fiche
  apparaît en clair dans les fichiers produits.
- Non-indexation : `robots.txt` + `<meta name="robots">` sur toutes les pages.

## Phase 2 — Bibliothèque de contenu ✅

- Manifeste chiffré reconstruisant la hiérarchie matière → fascicule → fiche.
- Bibliothèque navigable, avec filtres par matière et par statut.
- Page fiche : bascule « cours complet » / « fiche simplifiée », sommaire,
  navigation vers la fiche précédente et suivante.
- Glossaire automatique : détection des termes au build (`<dfn>`), bulles de
  définition via l'API `popover` native, repli accessible au clavier.

## Phase 3 — Flashcards et persistance ✅

- IndexedDB (`idb`) : cartes, fiches, quiz, agrégats journaliers, profil.
- Algorithme SM-2 avec notation difficile / moyen / facile.
- File « à réviser aujourd'hui » recalculée automatiquement, aperçu du
  prochain intervalle sur chaque bouton, raccourcis clavier.

## Phase 4 — Quiz et gamification ✅

- QCM avec correction immédiate, explications, récapitulatif des erreurs.
- XP, niveaux, série de jours consécutifs avec relance visuelle, 13 badges,
  barres de progression par matière et par fascicule.

## Phase 5 — Transversal ✅

- Recherche plein texte sur l'index chiffré, filtres par matière, par tag et
  par niveau de maîtrise, extraits surlignés.
- Statistiques : temps passé, régularité hebdomadaire, taux de réussite par
  matière, échéancier des cartes, fiches les plus fragiles.
- Export / import JSON de la progression (fusion ou remplacement).
- Interface responsive, thème clair et sombre.

## Phase 6 — Déploiement et documentation ✅

- `npm run deploy` : chiffrement, build, publication sur `gh-pages`.
- `npm run hash` pour la procédure de changement de mot de passe.
- README couvrant installation, format des fiches, glossaire, publication,
  changement de mot de passe, sauvegarde et dépannage.

## Pistes pour la suite

Prévues par l'architecture, non réalisées à ce stade :

- Cas pratiques et notes de synthèse annotées : ajouter un titre de section
  reconnu dans `scripts/lib/markdown.mjs` puis une page dédiée
  (voir « Ajouter un nouveau format de contenu » dans le README).
- Objectif hebdomadaire paramétrable (actuellement fixé à 10 h dans les
  statistiques).
- Révision ciblée sur les seules fiches marquées fragiles.
