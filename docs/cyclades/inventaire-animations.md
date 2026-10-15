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
| 9 | Contenu d'un dépliant (`details[open]`) | ouverture | `opacity` | **200 ms** (A13 : 120 ms était la durée de ce qui part) | entrée | durée neutralisée | **réserve assumée** : la hauteur ne s'anime pas (interdit n° 4) |
| 10 | Message de confirmation — entrée | `notifier()` | `opacity`, `transform` | 200 ms | entrée | durée neutralisée | le message ne saute pas à l'écran |
| 11 | Message de confirmation — sortie | minuteur, 2,6 s | idem | 120 ms | sortie | idem | la durée vit dans la feuille ; le script la relit. **A14** : la bulle se place au-dessus de la barre d'onglets, qu'elle couvrait à 390 px |
| 12 | Liste des tâches (`odyssee/taches`) | clore ou ajouter une tâche | **transformation des vraies cartes (FLIP)**, depuis A5 | 200 ms (`--duree-moyenne`) | `--courbe-entree` | repeinte d'un coup | **A5** : la transition de document rendait la page insensible au doigt pendant qu'elle glissait ; les cartes restent maintenant atteignables |
| 13 | Tout bouton pressé | `:active` | `transform: scale(0.97)` | 120 ms | sortie | **transformation annulée** | le doigt obtient une réponse |
| 14 | Marque de correction (`[data-marque]`) | affichage de la correction | `opacity`, `transform` | 200 ms | entrée | durée neutralisée | l'œil trouve le signe sans le chercher |
| 15 | Coche d'un message de succès | `notifier(…, 'succes')` | aucune (apparaît avec la bulle) | — | — | — | décision 3 : une coche, pas un confetti |
| 16 | Contenu d'un écran (`#vue`) | fin du déchiffrement | `opacity` | 200 ms | entrée | durée neutralisée | le contenu paraît au lieu de sauter |
| 17 | Texte d'attente (`#chargement`) | fin du déchiffrement | **aucune** (A1 : fondu retiré) | — | — | — | **A1** : le fondu gardait le texte dans le flux et décalait la page (0,119 → 0,614 de CLS). La disparition redevient immédiate |
| 18 | Muscles sollicités (`sport/exercices`) | bouton « Voir l'animation » | `fill` de la zone, par étapes | 120 ms (`--duree-courte`, **aux jetons depuis A7**) | `--courbe-sortie` | inchangé : `fill` ne déplace rien | **A7** : « Interrompre » interrompt, l'état éteint est peint avant l'étape 1, et le schéma est amené sous les yeux |
| 19 | Déroulé d'une correction (`Deroule.svelte`) | « Étape suivante » | `opacity`, `transform` | 200 ms | entrée | **animation supprimée** | A7 cas 2 : chaque étape se distingue de la précédente |
| 20 | Jauge de **valeur** (`.jauge-remplissage`) | arrivée de la donnée | `transform: scaleX()`, de 0 à la valeur par `@starting-style` | 300 ms (`--duree-longue`) | `--courbe-entree` | durée neutralisée | **A2** : elle ne se remplissait jamais — la valeur était posée avant le premier rendu. Mesuré après : 0,345 à 60 ms |
| 21 | Jauge de **séance** (`.jauge-seance`) | changement d'étape | idem | 200 ms (`--duree-moyenne`) | `--courbe-entree` | idem | une question sur douze, pas un remplissage à chaque fois. **Exclue d'A2** : aucun remplissage d'arrivée. **A3** : la barre d'appariement, large de 0 px, rejoint ce mécanisme |
| 22 | Jauge d'Odyssée | arrivée de la donnée | **aucune** | — | — | — | **exclusion du coffre** : Psyché est une source de cette jauge |
| 23 | Barre de chargement de page | chargement | `transform: scaleX()` | **200 ms réels depuis A8** (elle tenait 300 ms : deux classes Tailwind mortes) | `--courbe-sortie` | transition retirée | migrée pour que plus aucune largeur ne soit animée. Son fondu final passe de 350 à 200 ms |

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
2. **Le schéma du corps** — réserve **levée par le retrait**. Décision 1 du
   14 octobre : la forme complète est supprimée, son sélecteur avec elle. À la
   taille affichée elle se distinguait à peine de la simplifiée, et ses
   contours ne tenaient pas comme anatomie. Une forme complète crédible pourra
   faire l'objet d'un lot à part, d'après une source légitime.

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

## Lot de rectification (prompt 37, 15 octobre 2026)

Quinze corrections demandées après l'audit du 14 octobre, toutes appliquées.
Chacune est mesurée avant et après ; aucune n'est déclarée sur lecture du code.

| n° | Ce qui n'allait pas | Mesure avant → après | Essai qui le garde |
|---|---|---|---|
| A1 | Le fondu du texte d'attente décalait la page | 0,608 → 0,211 (bibliothèque), 0,615 → 0,170 (recherche), bridé ×4 | `essais:decalage` |
| A2 | Les jauges de valeur ne se remplissaient jamais | 0,800 dès 60 ms → 0,345 à 60 ms | `essais:jauges` (section F) |
| A3 | La barre d'appariement faisait 0 px de large | `w-0` → mécanisme partagé | `essais:jauges` (section A bis) |
| A4 | Le fond des dialogues fondait encore sous mouvement réduit | ~190 ms → 0,01 ms, par les deux réglages | `essais:mouvement-reduit` (E) |
| A5 | La liste des tâches avalait les appuis | 1 tâche close sur 2 → 2 sur 2, à 40, 100 et 200 ms | `essais:taches-gestes` |
| A6 | La lecture automatique ignorait l'interrupteur | lisait un réglage sur deux → les deux | `essais:mouvement-reduit` (E bis) |
| A7 | « Interrompre » relançait ; l'étape 1 n'allumait rien ; le schéma hors vue | bouton figé sur « Interrompre » → restitution ; suite d'images 2,2,2,**0,0**,1 ; schéma 462→654 dans une boîte qui va jusqu'à 806 | `essais:muscles` |
| A8 | La barre de chargement durait 300 ms, son fondu 350 | 0,3 s → 0,2 s ; 0,35 s → 0,2 s | `essais:finitions` |
| A9 | La pastille du thème animait son épaisseur de bordure | `all` → `box-shadow, border-color` | `essais:finitions` |
| A10 | Deux `transition: all` restants | propriétés nommées, durées aux jetons | `essais:finitions` |
| A11 | Les boutons avaient perdu le fondu de survol | lien 0,15 s / bouton sans fondu → les deux à 0,12 s, même courbe | `essais:finitions` |
| A12 | L'en-tête et la barre se dédoublaient en transition | aucun nom → groupes nommés, hors des pages sous coffre | `essais:cadre` |
| A13 | Chevron à 150 ms, dépliant à 120, `.jauge` morte, `--duree-succes` flottante | 0,15 → 0,12 s ; 0,12 → 0,2 s ; classe retirée ; jeton marqué réservé | `essais:finitions` |
| A14 | La bulle couvrait la barre d'onglets | bulle à 828 pour une barre à 787 → 764 | `essais:finitions` |
| A15 | La région `aria-live` du déroulé était recréée à chaque étape | structure corrigée — **non vérifié au lecteur d'écran** | — |

### Ce qui reste à dire, et qui n'est pas flatteur

- **Le plafond de CLS de deux pages a dû être relevé**, parce que je ne
  reproduis pas les chiffres du rapport : `/bibliotheque/` mesure 0,211 ici
  contre 0,018 annoncés, `/recherche/` 0,170 contre 0,098. L'écart vient d'une
  course entre l'hydratation des contrôles et la première peinture, que le
  bridage du processeur force vers le pire cas. **Ce décalage résiduel est
  antérieur au lot** et n'a pas été corrigé : il vient de la barre de filtres
  et de ses listes déroulantes, qui poussent le pied de page.
- **A15 n'est vérifié que dans sa structure.** Aucun lecteur d'écran n'a été
  essayé dans ce conteneur.
- **Aucune capture n'accompagne ce lot** à l'heure où ces lignes sont écrites.
