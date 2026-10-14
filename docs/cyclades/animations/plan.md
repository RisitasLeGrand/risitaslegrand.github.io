# Plan — animations et schéma du corps (prompt 34)

**14 octobre 2026.** Plan court soumis à validation. **Rien n'est codé** et rien
ne le sera avant le « go » d'Alexis sur ce document.

## Les six décisions sont closes

| | Décision | Tranchée par |
|---|---|---|
| 1 | Transitions entre pages : View Transitions entre documents, CSS seul | pilote, délégation **confirmée par Alexis le 14 octobre** |
| 2 | Intensité : sobre | idem |
| 3 | Célébrations : discrètes | idem |
| 4 | Interrupteur « Réduire les animations » dans les préférences | idem |
| 5 | Animations explicatives : les trois cas de A7 | idem |
| 6 | **Forme du corps par défaut : simplifiée** | **Alexis, 14 octobre** |

Sur la 6 : Alexis a répondu « simplifiée », sans reprendre la nuance par
appareil que recommandait le pilote. Le défaut est donc **simplifiée partout**,
le choix restant mémorisé et réversible comme le prompt le prévoit.

## Relevé de départ, refait dans l'état réel (`3b9c0af`)

M1 à M4 du prompt : **les quatre constats tiennent**. Vérifié par lecture.
`prefers-reduced-motion` en place (`global.css:317`) ; zéro occurrence de
`ClientRouter`, `ViewTransitions`, `svelte/transition`, `svelte/animate` ;
`schema-corps.ts` à 218 lignes, boîte 200 × 420.

**Un défaut non signalé par le prompt**, que j'ajoute : le bloc M2 neutralise
les **durées** mais pas `animation-iteration-count`. Sous mouvement réduit, une
animation infinie ne s'arrête donc pas — elle s'accélère. Pré-existant, traité
en phase 0, non compté comme une régression de ce lot.

> **Correction du 14 octobre, après mesure.** J'avais d'abord annoncé *deux*
> animations en cause, `Grille.svelte:95` et `QuadNBack.svelte:615`. C'était
> faux pour la première : `Grille.svelte` **se protège lui-même**, lignes 120 à
> 124, par `@media (prefers-reduced-motion: reduce) { .tourne { animation:
> none } }`. J'avais lu la ligne 95 sans lire la 120. `BarreProgression.astro`
> et `Deroule.svelte` ont également leur garde locale. **Une seule** animation
> était réellement exposée : `animate-pulse` sur le bouton de capture de touche
> du quad n-back.
>
> Et le constat n'est plus « lu dans le code » : il est **mesuré**.
> `animation-iteration-count` valait bien `infinite` sous mouvement réduit, sur
> la règle comme sur l'écran réel.

## Ordre des phases, et pourquoi il diffère de l'ordre du prompt

Le prompt liste A6 (cohérence) en sixième position. **Elle passe en premier** :
toutes les autres familles consomment son échelle de durées. Et la phase 6
(schéma du corps) précède la phase 7, parce que le premier cas de A7 allume des
muscles sur ce schéma.

---

## Phase 0 — socle : A6, décision 4, et le défaut du mouvement réduit

- **Technique** : jeton de durées et de courbes dans `global.css` (court 120 ms,
  moyen 200 ms, long 300 ms) ; `animation-iteration-count: 1 !important` ajouté
  au bloc `prefers-reduced-motion` ; extension du script avant peinture de
  `Base.astro:148` — il lit déjà `revinsp.theme`, il lira `revinsp.animations`
  et posera `data-animations` sur la racine. Le plus restrictif du réglage
  système et du réglage d'application s'applique.
- **Fichiers** : `src/styles/global.css`, `src/layouts/Base.astro`, l'écran des
  préférences, nouveau `scripts/essais-mouvement-reduit-navigateur.mjs`.
- **Risque** : l'arrêt des animations infinies touche le quad n-back. Vérifier
  que l'exercice reste jouable sous mouvement réduit, pas seulement qu'il
  cesse de clignoter.
- **Contrôle** : essai de navigateur sous `prefers-reduced-motion: reduce` sur
  les 54 routes. **Il doit être rouge avant le correctif** — sinon il ne mesure
  rien.

## Phase 1 — A1, transitions entre pages

- **Technique** : `@view-transition { navigation: auto }` en CSS seul.
- **Fichiers** : `src/styles/global.css`, `src/layouts/Base.astro`.
- **Le risque est le coffre, et il est précis.** Une transition entre documents
  capture la page sortante. **11 routes sont sous coffre** : `odyssee/psyche`,
  `finances`, `sante`, `molecule`, `mes-regles`, `corps`, `echelles`, `veille`,
  `rapprocher`, `bibliographie`, `qui-lit-mon-budget`.
- **Réserve de méthode** : je **retire ces 11 routes de la transition**, au lieu
  de poser `view-transition-name: none` sur chaque région sensible. L'interdit
  n° 2 est absolu ; une exclusion de route se prouve d'une ligne, un inventaire
  de régions se re-prouve à chaque écran ajouté.
- **Autres effets à vérifier et à lister** : scripts qui ne se relancent plus,
  connexions IndexedDB, minuteurs du quad n-back et des séances chronométrées,
  centre de notifications, raccourcis clavier, focus et annonce de la nouvelle
  page aux lecteurs d'écran.
- **Contrôle** : essai qui ferme le coffre, navigue, et vérifie qu'aucune donnée
  sensible n'apparaît ni dans la page ni dans la transition ; essai du focus et
  de l'annonce au clavier.

## Phase 2 — A2, apparition et disparition

- **Technique** : fondu et glissement courts sur menus, panneaux, centre de
  notifications, boîtes de dialogue, messages de confirmation. Fermeture plus
  rapide que l'ouverture.
- **Réserve** : les sections dépliables (`details`) **posent un conflit avec
  l'interdit n° 4**. Animer un dépliage suppose d'animer une hauteur, ce que
  l'interdit proscrit. Deux issues honnêtes : un fondu du contenu **sans**
  animation de hauteur, ou `details` écarté de ce lot. Je propose le fondu seul,
  et je le dirai dans l'inventaire.

## Phase 3 — A3, listes qui changent

- **Technique** : `animate:flip` de Svelte sur les cartes à réviser, les tâches,
  les notifications lues.
- **Risque** : `flip` exige des blocs `each` **clés**. Toute liste non clée
  animera de travers. Le relevé des listes concernées précède le code.

## Phase 4 — A4, retours d'action

- **Technique** : retour bref sur bouton pressé, réponse juste ou fausse,
  carte révisée, enregistrement réussi. Décision 3 : une coche, pas de confetti.
- **Contrainte tenue** : le sens ne repose jamais sur l'animation ni sur la
  couleur seules — le texte ou l'icône dit déjà juste ou faux, et le reste.

## Phase 5 — A5, chargements

- **Technique** : squelette ou fondu d'arrivée au déchiffrement, à la lecture
  IndexedDB, à la construction d'un graphique. Aucun indicateur tournant sans
  texte.

## Phase 6 — schéma du corps, deux formes

- **Technique** : les formes deviennent des **chemins SVG déclarés par muscle**,
  en deux jeux — complète et simplifiée — au lieu des ellipses et rectangles
  actuels. Défaut : **simplifiée**. Choix mémorisé dans les préférences
  existantes, sans nouveau modèle de données.
- **Fichiers** : `src/lib/sport/schema-corps.ts`, `/sport/exercices/`,
  l'essai « chaque muscle a sa forme », étendu **aux deux jeux**.
- **Source et licence** : **dessin original**. Le réseau de ce conteneur ne
  donne accès à aucune banque d'images, et aucune planche protégée ne sera
  reprise. Les contours seront écrits à la main d'après des proportions
  humaines usuelles. Attribution : aucune à porter, l'œuvre est produite ici.
- **Réserve, et c'est la plus sérieuse du lot** : « une silhouette aux contours
  anatomiquement crédibles » écrite à la main en données de chemin est la partie
  dont je garantis le moins le résultat. Je propose de livrer cette phase
  **en dernier** et de la soumettre sur captures — deux formes, deux faces, deux
  thèmes — avant d'aller plus loin. Si le rendu ne convainc pas, il vaudra mieux
  une simplifiée très soignée qu'une complète approximative.
- **Exigences conservées de la décision antérieure** : nom accessible par zone,
  coloration selon le volume, sélection, cases à cocher synchronisées et égales
  au schéma, un muscle sur sa seule face, SVG uniquement, contrastes AA.

## Phase 7 — A7, animations explicatives

- **Les trois cas, dans l'ordre du prompt** : muscles sollicités sur le schéma
  (dépend de la phase 6) ; déroulé de `src/features/correction/composants/Deroule.svelte`
  révélant chaque étape ; `src/components/BarreProgression.astro` se remplissant
  jusqu'à sa valeur, une seule fois, le chiffre affiché d'emblée.
- **Règles tenues** : lancement à la demande, jamais en boucle ; pause, rejeu,
  pas à pas au clavier ; état final lisible sans l'animation ; aucune animation
  explicative sur une donnée du coffre.
- **Les deux propositions supplémentaires** : **je n'en fais aucune pour
  l'instant.** Le prompt en autorise deux au plus, soumises à l'audit ; en
  proposer avant que le pilote ait jugé les trois premières serait deviner.

## Livrables

- Commits séparés par phase, chacun décrit.
- `docs/cyclades/inventaire-animations.md` : par animation, le lieu, le
  déclencheur, la propriété animée, la durée, la courbe, le rendu en mouvement
  réduit, et le gain visé. C'est la pièce sur laquelle le pilote fera son audit.
- Batterie complète verte avant et après ; mesure de performance et de CLS
  avant et après ; captures par famille en 390 × 844, données synthétiques.

## Réserves sur les décisions 1 à 5, en clair

1. **Décision 1** : aucune réserve sur le choix. Une sur la méthode — exclusion
   des 11 routes sous coffre plutôt qu'un inventaire de régions.
2. **Décision 2** : aucune.
3. **Décision 3** : aucune.
4. **Décision 4** : aucune sur le choix. Le mécanisme existe déjà pour le thème ;
   je m'y branche.
5. **Décision 5** : une remarque d'ordre — le cas 1 dépend de la phase 6, donc
   le schéma passe avant. Et zéro proposition supplémentaire avant l'audit.

Une réserve de plus, hors décisions : **`details` contre l'interdit n° 4**,
phase 2.

## Ce qui attend un « go »

Ce plan. Après quoi : phase 0, puis les suivantes, chacune testée, livrées une
par une.
