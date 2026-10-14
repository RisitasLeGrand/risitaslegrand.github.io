# Inventaire des animations — Cyclades

**14 octobre 2026.** Pièce d'audit du prompt 34. Par animation : le lieu, le
déclencheur, la propriété animée, la durée, la courbe, le rendu sous mouvement
réduit, et le gain visé.

**Tout ce qui suit est relevé dans la source**, pas de mémoire : les durées et
les courbes sont les jetons effectivement écrits dans les règles, extraits de
`src/styles/global.css` et des composants. Là où un fait n'a été que *lu* et
non *mesuré*, c'est dit.

## L'échelle, et pourquoi elle est courte

Quatre durées et deux courbes, définies une fois dans `global.css` et employées
partout. Une échelle plus riche aurait donné des animations légèrement
différentes partout, c'est-à-dire du bruit.

| Jeton | Valeur | Emploi |
|---|---|---|
| `--duree-courte` | 120 ms | tout ce qui **part** : fermeture, disparition, pression |
| `--duree-moyenne` | 200 ms | tout ce qui **arrive** : ouverture, apparition |
| `--duree-longue` | 300 ms | le remplissage d'une jauge de valeur |
| `--duree-succes` | 600 ms | réservé au retour explicite d'un succès |
| `--courbe-entree` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | ce qui arrive décélère |
| `--courbe-sortie` | `cubic-bezier(0.4, 0, 1, 1)` | ce qui part accélère |

**La règle qui gouverne tout le reste** : *fermer est plus rapide qu'ouvrir*.
Fermer est une intention déjà formée ; attendre son animation est du temps
perdu. 120 ms contre 200 ms, partout.

## L'inventaire

| # | Lieu | Déclencheur | Propriété | Durée | Courbe | Mouvement réduit | Gain visé |
|---|---|---|---|---|---|---|---|
| 1 | Toute page ordinaire (`Base.astro`) — sortie | navigation | `opacity` (`::view-transition-old`) | 120 ms | sortie | **supprimée** | la navigation ne clignote plus |
| 2 | Toute page ordinaire — entrée | navigation | `opacity` (`::view-transition-new`) | 200 ms | entrée | **supprimée** | idem |
| 3 | Menu de thème (`CommutateurTheme`) — ouverture | clic | `opacity`, `transform`, `display` | 200 ms | entrée | durée neutralisée | le menu ne surgit pas |
| 4 | Menu de thème — fermeture | clic, Échap, clic dehors | idem | 120 ms | sortie | idem | fermer est immédiat |
| 5 | Feuille « Plus » (téléphone) — ouverture | clic | `opacity`, `display` | 200 ms | entrée | durée neutralisée | un voile plein écran qui glisse donnerait le mal de mer : fondu seul |
| 6 | Feuille « Plus » — fermeture | clic, Échap | idem | 120 ms | sortie | idem | — |
| 7 | Boîtes de dialogue (`dialog`) — ouverture | `showModal()` | `opacity`, `display`, `overlay` | 200 ms | entrée | durée neutralisée | la boîte et son fond arrivent ensemble |
| 8 | Fond de dialogue (`::backdrop`) | idem | `opacity` | 200 ms / 120 ms | entrée / sortie | idem | sans lui, le fond apparaîtrait sèchement derrière une boîte qui fond |
| 9 | Contenu d'un dépliant (`details[open]`) | ouverture | `opacity` | 120 ms | entrée | durée neutralisée | **réserve assumée** : la hauteur ne s'anime pas (interdit n° 4) |
| 10 | Message de confirmation — entrée | `notifier()` | `opacity`, `transform` | 200 ms | entrée | durée neutralisée | le message ne saute pas à l'écran |
| 11 | Message de confirmation — sortie | minuteur, 2,6 s | idem | 120 ms | sortie | idem | la durée vit dans la feuille ; le script la relit |
| 12 | Liste des tâches (`odyssee/taches`) | clore ou ajouter une tâche | transition de même document, par `view-transition-name` | **296 ms mesurés** (défaut du navigateur) | défaut du navigateur | **écourtée : 87 ms mesurés** | les cartes glissent au lieu de sauter |
| 13 | Tout bouton pressé | `:active` | `transform: scale(0.97)` | 120 ms | sortie | **transformation annulée** | le doigt obtient une réponse |
| 14 | Marque de correction (`[data-marque]`) | affichage de la correction | `opacity`, `transform` | 200 ms | entrée | durée neutralisée | l'œil trouve le signe sans le chercher |
| 15 | Coche d'un message de succès | `notifier(…, 'succes')` | aucune (apparaît avec la bulle) | — | — | — | décision 3 : une coche, pas un confetti |
| 16 | Contenu d'un écran (`#vue`) | fin du déchiffrement | `opacity` | 200 ms | entrée | durée neutralisée | le contenu paraît au lieu de sauter |
| 17 | Texte d'attente (`#chargement`) | fin du déchiffrement | `opacity`, `display` | 120 ms | sortie | durée neutralisée | l'attente s'efface au lieu de disparaître |
| 18 | Muscles sollicités (`sport/exercices`) | bouton « Voir l'animation » | `fill` de la zone, par étapes | 120 ms, **écrits en dur** | — | inchangé : `fill` ne déplace rien | A7 cas 1 : voir ce qui travaille |
| 19 | Déroulé d'une correction (`Deroule.svelte`) | « Étape suivante » | `opacity`, `transform` | 200 ms | entrée | **animation supprimée** | A7 cas 2 : chaque étape se distingue de la précédente |
| 20 | Jauge de **valeur** (`.jauge-remplissage`) | arrivée de la donnée | `transform: scaleX()` | 300 ms | entrée | durée neutralisée | A7 cas 3 : la valeur se lit comme une progression |
| 21 | Jauge de **séance** (`.jauge-seance`) | changement d'étape | idem | 200 ms | — | idem | une question sur douze, pas un remplissage à chaque fois |
| 22 | Jauge d'Odyssée | arrivée de la donnée | **aucune** | — | — | — | **exclusion du coffre** : Psyché est une source de cette jauge |
| 23 | Barre de chargement de page | chargement | `transform: scaleX()` | 200 ms | — | transition retirée | migrée pour que plus aucune largeur ne soit animée |

## Ce que « mouvement réduit » veut dire ici

Deux sources, la plus restrictive gagne : le réglage du système
(`prefers-reduced-motion`) et l'interrupteur « Réduire les animations » du
profil, porté par `data-animations` et posé **avant le premier rendu**.

**Et trois fois la même leçon**, qu'il vaut mieux écrire comme règle que comme
incident — à chaque fois, « réduire la durée » avait été confondu avec
« supprimer le mouvement » :

| Phase | Ce que la durée ne suffisait pas à arrêter | Correctif |
|---|---|---|
| 0 | une animation **infinie** : elle tourne 0,01 ms par cycle, sans fin | `animation-iteration-count: 1` |
| 3 | les pseudo-éléments de **transition** : `*` ne les atteint pas | règles explicites sur `::view-transition-*` |
| 4 | un **déplacement** : il saute au lieu de glisser | `transform: none` à l'état actif |

## Trois écarts constatés, et non corrigés

Ils ne cassent rien, et aucun ne relevait d'une décision acceptée. Je les
signale plutôt que de les corriger en passant.

1. **La zone d'un muscle transitionne `fill` sur 120 ms écrits en dur**
   (`sport/exercices`), hors de l'échelle. La valeur se trouve être celle de
   `--duree-courte` — mais par coïncidence, pas par construction : si l'échelle
   change, cette ligne ne suivra pas. Antérieur au lot.
2. **La durée de la transition de page de même document** (ligne 12) est celle
   du navigateur, pas la nôtre : l'API ne lit pas nos jetons pour son animation
   par défaut. 296 ms mesurés, au-delà du plafond de 300 ms seulement par la
   marge de mesure. La ramener dans l'échelle demanderait d'écrire nos propres
   `::view-transition-*` pour ce cas, ce que le prompt ne demandait pas.
3. **`--duree-succes` (600 ms) n'est employée nulle part.** Elle a été définie
   en phase 0 pour le retour explicite d'un succès ; la décision 3 ayant retenu
   « une coche, pas de confetti », aucune animation ne la réclame. Un jeton
   inutilisé vaut mieux qu'un jeton inventé après coup, mais il faut le dire.

## Les deux réserves, non levées

1. **Les dépliants (`details`)** — ligne 9. Le contenu paraît en fondu ; la
   **hauteur ne s'anime pas**, parce que l'interdit n° 4 proscrit l'animation
   d'une propriété de mise en page. La boîte s'ouvre d'un coup, son contenu
   paraît. Ce n'est pas le dépliage fluide qu'on imagine en lisant l'A2.
2. **Le schéma du corps** — forme complète livrée, mais « anatomiquement
   crédible » est généreux : les avant-bras restent fins, le bas du dos se lit
   en taches. Soumis sur captures ; en attente de l'avis d'Alexis.

## Deux cibles du prompt qui n'existaient pas

- **Le centre de notifications** (A2) : le prompt 32 n'est pas construit.
  Aucune animation n'a été inventée pour une cible absente.
- **`BarreProgression.astro`** (A7 cas 3) : le prompt la décrivait comme une
  jauge « qui se remplit jusqu'à sa valeur ». C'est la barre de **chargement de
  page** : `aria-valuenow` figé à 0, aucune valeur à atteindre. L'arbitrage du
  14 octobre a redirigé le cas 3 vers les vraies jauges.

## Couverture de l'issue A — les fichiers migrés

L'arbitrage demande d'inventorier les fichiers couverts, **y compris ceux que
le prompt ne nommait pas**. Treize fichiers portent le mécanisme de jauge :

`src/styles/global.css` (le mécanisme), `src/components/BarreProgression.astro`,
`src/lib/chargement.ts` (son pilote), `src/pages/revisions/index.astro` (4
jauges), `src/pages/bibliotheque.astro`, `src/pages/sport/index.astro`,
`src/pages/odyssee/index.astro` (sans animation),
`src/pages/flashcards.astro`, `src/pages/quiz/cours.astro`,
`src/pages/quiz/dgfip.astro`, `src/pages/initialisation.astro`,
`src/pages/apparier.astro`,
et trois composants : `QuadNBack.svelte`, `RelationalReasoning.svelte`,
`VeridicalMapping.svelte`.

**Ces trois derniers ne figuraient ni dans mon relevé ni dans celui du
pilote** : c'est le contrôle qui les a trouvés. Mon décompte initial — « 9
jauges dans 8 pages » — était faux deux fois, et le conflit avec l'interdit
n° 4 **préexistait** : ces barres portaient déjà `transition-all` sur une
largeur. Ne rien faire ne l'aurait pas supprimé.

## Ce que les contrôles établissent

| Essai | Ce qu'il fige |
|---|---|
| `essais:mouvement-reduit` | durée **et** répétitions neutralisées, sur règle et sur écran réel |
| `essais:transitions:navigateur` | une page sous coffre n'est **jamais** photographiée |
| `essais:coffre-transitions` | la liste des pages sous coffre est établie depuis la source, dans les deux sens |
| `essais:apparition` | fermeture plus brève qu'ouverture ; aucune propriété de mise en page |
| `essais:listes` | la transition de page respecte le mouvement réduit ; la liste glisse |
| `essais:retours` | le sens ne repose pas sur la couleur ; sous mouvement réduit le bouton **ne bouge pas** |
| `essais:chargements` | aucun indicateur tournant ; le contenu paraît — **couverture imprimée : 46 pages, 22 avec conteneur** |
| `essais:explicatives` | l'état final **est** l'état réel, interruption comprise |
| `essais:jauges` | aucune largeur animée nulle part ; aucune échelle écrite en pourcents |

Chacun a été **éprouvé rouge** avant d'être déclaré vert — pour les plus
importants, en sabotant délibérément le code et en vérifiant que le contrôle
le dit.
